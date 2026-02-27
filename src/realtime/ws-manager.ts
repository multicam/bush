/**
 * Bush Platform - WebSocket Connection Manager
 *
 * Manages WebSocket connections for real-time updates.
 * Handles authentication, subscription management, and event broadcasting.
 * Phase 2: Redis pub/sub for horizontal scaling, presence, event recovery.
 * Reference: specs/05-realtime.md
 * Reference: specs/README.md "Realtime Architecture"
 */
import type { ServerWebSocket } from "bun";
import { unsealData } from "iron-session";
import { randomBytes } from "crypto";
import { eventBus, type RealtimeEvent, type ChannelType } from "./event-bus.js";
import { redisPubSub, type PresenceState, type PresenceUser } from "./redis-pubsub.js";
import { sessionCache, parseSessionCookie } from "../auth/session-cache.js";
import { authService } from "../auth/service.js";
import { config } from "../config/index.js";
import type { SessionData } from "../auth/types.js";
import { db } from "../db/index.js";
import { files, shares, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyProjectAccess, verifyAccountAccess } from "../api/access-control.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("WebSocket");

// ============================================================================
// Types
// ============================================================================

/**
 * WebSocket close codes (custom range 4000-4999)
 */
export const WsCloseCode = {
  NORMAL: 1000,
  AUTHENTICATION_FAILED: 4001,
  FORBIDDEN: 4003,
  RATE_LIMIT_EXCEEDED: 4008,
  INVALID_MESSAGE: 4009,
  TOO_MANY_CONNECTIONS: 4029,
} as const;

/**
 * Connection data attached to each WebSocket
 */
export interface WebSocketData {
  /** Connection ID */
  connectionId: string;
  /** Authenticated user ID */
  userId: string;
  /** User display name for presence */
  userName: string;
  /** User avatar URL for presence */
  userAvatarUrl: string | null;
  /** Session data */
  session: SessionData;
  /** Connected at timestamp */
  connectedAt: Date;
  /** Active subscriptions: Set of channel keys */
  subscriptions: Set<string>;
  /** Rate limiting: message timestamps */
  messageTimestamps: number[];
}

/**
 * Client-to-server message format
 */
interface ClientMessage {
  action: "subscribe" | "unsubscribe" | "ping" | "presence";
  channel?: ChannelType;
  resourceId?: string;
  projectId?: string;
  /** For event recovery on reconnect */
  sinceEventId?: string;
  /** Presence state for presence action */
  state?: PresenceState;
}

/**
 * Server-to-client control message format
 */
export interface ControlMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Server-to-client event message format
 */
export interface EventMessage {
  channel: ChannelType;
  resourceId: string;
  event: string;
  eventId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Union type for all server messages
 */
export type ServerMessage = ControlMessage | EventMessage;

/**
 * Channel key format: {channelType}:{resourceId}
 */
type ChannelKey = `${ChannelType}:${string}`;

// ============================================================================
// Connection Manager
// ============================================================================

/**
 * Get configurable rate limits from environment
 * Reference: specs/05-realtime.md Section 10.3
 */
const getMaxSubscriptions = () => config.WS_MAX_SUBSCRIPTIONS;
const getRateLimitMessages = () => config.WS_RATE_LIMIT_MESSAGES;
const getRateLimitWindow = () => config.WS_RATE_LIMIT_WINDOW_MS;
const getMaxConnectionsPerUser = () => config.WS_MAX_CONNECTIONS_PER_USER;

/**
 * WebSocket connection manager
 */
class WebSocketManager {
  /** All active connections by connection ID */
  private connections = new Map<string, ServerWebSocket<WebSocketData>>();

  /** Connections by user ID (for multi-connection support) */
  private connectionsByUser = new Map<string, Set<string>>();

  /** Connections by channel (for broadcasting) */
  private connectionsByChannel = new Map<string, Set<string>>();

  /** Event bus unsubscribe function */
  private eventBusUnsubscribe: (() => void) | null = null;

  /** Lock flag to prevent concurrent modifications during broadcast */
  private isBroadcasting = false;

  /** Queue of pending modifications */
  private pendingModifications: Array<() => void> = [];

  /** Presence rate limiting: last presence update per connection */
  private presenceLastUpdate = new Map<string, number>();

  /**
   * Initialize the WebSocket manager
   * Subscribes to the event bus for broadcasting
   * Initializes Redis pub/sub for cross-instance communication (Phase 2)
   */
  async init(): Promise<void> {
    this.eventBusUnsubscribe = eventBus.onEvent((event) => {
      this.broadcastEvent(event);
    });

    // Initialize Redis pub/sub (Phase 2)
    try {
      await redisPubSub.init();

      // Set up callbacks for Redis messages
      redisPubSub.onMessage((message) => {
        this.handleRedisMessage(message);
      });

      redisPubSub.onPresence((channel, resourceId, presence) => {
        this.broadcastPresenceUpdate(channel, resourceId, presence);
      });

      redisPubSub.onPresenceLeave((channel, resourceId, userId) => {
        this.broadcastPresenceLeave(channel, resourceId, userId);
      });

      log.info("Manager initialized with Redis pub/sub");
    } catch (error) {
      log.warn("Redis pub/sub unavailable, running in single-instance mode", { error: String(error) });
    }
  }

  /**
   * Shutdown the WebSocket manager
   */
  async shutdown(): Promise<void> {
    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
      this.eventBusUnsubscribe = null;
    }
    this.connections.clear();
    this.connectionsByUser.clear();
    this.connectionsByChannel.clear();
    this.presenceLastUpdate.clear();

    // Shutdown Redis pub/sub
    await redisPubSub.shutdown();

    log.info("Manager shutdown");
  }

  /**
   * Generate a unique connection ID (cryptographically secure)
   */
  generateConnectionId(): string {
    return `conn_${Date.now()}_${randomBytes(6).toString("base64url")}`;
  }

  /**
   * Execute a modification safely, queuing if currently broadcasting
   */
  private safeModify(modification: () => void): void {
    if (this.isBroadcasting) {
      this.pendingModifications.push(modification);
    } else {
      modification();
    }
  }

  /**
   * Process any pending modifications after broadcast completes
   */
  private processPendingModifications(): void {
    const pending = this.pendingModifications.splice(0);
    for (const modification of pending) {
      try {
        modification();
      } catch (error) {
        log.error("Error processing pending modification", error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * Authenticate a WebSocket connection from cookies
   */
  async authenticate(cookieHeader: string): Promise<{
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    session: SessionData;
  } | null> {
    if (!cookieHeader) {
      return null;
    }

    // Try bush_session cookie first (fastest path)
    const bushSessionData = parseSessionCookie(cookieHeader);
    if (bushSessionData) {
      const session = await sessionCache.get(bushSessionData.userId, bushSessionData.sessionId);
      if (session) {
        // Fetch user info for presence
        const [user] = await db
          .select({ name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, bushSessionData.userId))
          .limit(1);

        return {
          userId: bushSessionData.userId,
          userName: user?.name || "Unknown",
          userAvatarUrl: user?.avatarUrl || null,
          session,
        };
      }
    }

    // Try wos-session cookie (WorkOS AuthKit)
    const wosCookieMatch = cookieHeader.match(/wos-session=([^;]+)/);
    if (wosCookieMatch) {
      try {
        const password = config.WORKOS_COOKIE_PASSWORD || config.SESSION_SECRET;
        const session = await unsealData<{
          accessToken: string;
          refreshToken: string;
          user: {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
            profilePictureUrl: string | null;
          };
          organizationId?: string;
        }>(wosCookieMatch[1], { password });

        if (!session?.user?.id) {
          return null;
        }

        // Find or create Bush user from WorkOS user info
        const { userId } = await authService.findOrCreateUser({
          workosUserId: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName ?? undefined,
          lastName: session.user.lastName ?? undefined,
          avatarUrl: session.user.profilePictureUrl ?? undefined,
          organizationId: session.organizationId || "",
        });

        // Get user's accounts
        const accounts = await authService.getUserAccounts(userId);
        if (accounts.length === 0) {
          return null;
        }

        // Create or retrieve cached session
        const defaultAccount = accounts[0];
        const bushSession = authService.createSession(
          userId,
          defaultAccount.accountId,
          session.organizationId || "",
          session.user.id
        );

        const resolvedSession = await bushSession;

        // Fetch user info for presence
        const [user] = await db
          .select({ name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        return {
          userId,
          userName: user?.name || `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() || "Unknown",
          userAvatarUrl: user?.avatarUrl || session.user.profilePictureUrl,
          session: resolvedSession,
        };
      } catch (error) {
        log.error("Failed to authenticate wos-session", error instanceof Error ? error : undefined);
        return null;
      }
    }

    return null;
  }

  /**
   * Register a new WebSocket connection
   */
  register(ws: ServerWebSocket<WebSocketData>): void {
    const data = ws.data;

    this.safeModify(() => {
      this.connections.set(data.connectionId, ws);

      // Track by user
      if (!this.connectionsByUser.has(data.userId)) {
        this.connectionsByUser.set(data.userId, new Set());
      }
      this.connectionsByUser.get(data.userId)!.add(data.connectionId);
    });

    log.info(`Connection ${data.connectionId} registered for user ${data.userId}`);

    // Send connection confirmation
    this.send(ws, {
      type: "connection.established",
      connectionId: data.connectionId,
      serverTime: new Date().toISOString(),
    });
  }

  /**
   * Unregister a WebSocket connection
   * Phase 2: Removes presence from all subscribed channels
   */
  async unregister(ws: ServerWebSocket<WebSocketData>): Promise<void> {
    const data = ws.data;

    // Remove presence from all subscribed channels (Phase 2)
    if (redisPubSub.isEnabled()) {
      for (const channelKey of data.subscriptions) {
        const [channel, ...resourceIdParts] = channelKey.split(":") as [ChannelType, ...string[]];
        const resourceId = resourceIdParts.join(":");
        await redisPubSub.removePresence(channel, resourceId, data.userId);
      }
    }

    this.safeModify(() => {
      // Remove from all channels
      for (const channelKey of data.subscriptions) {
        this.removeFromChannel(channelKey, data.connectionId);
      }

      // Remove from user tracking
      const userConnections = this.connectionsByUser.get(data.userId);
      if (userConnections) {
        userConnections.delete(data.connectionId);
        if (userConnections.size === 0) {
          this.connectionsByUser.delete(data.userId);
        }
      }

      // Remove connection
      this.connections.delete(data.connectionId);

      // Clean up presence rate limit tracking
      this.presenceLastUpdate.delete(data.connectionId);
    });

    log.info(`Connection ${data.connectionId} unregistered`);
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: ServerWebSocket<WebSocketData>, message: string): Promise<void> {
    const data = ws.data;

    // Rate limiting
    if (!this.checkRateLimit(data)) {
      this.send(ws, {
        type: "error",
        code: "rate_limited",
        message: "Too many messages",
      });
      return;
    }

    // Parse message
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      this.send(ws, {
        type: "error",
        code: "invalid_message",
        message: "Invalid JSON",
      });
      return;
    }

    // Handle actions
    switch (msg.action) {
      case "subscribe":
        if (msg.channel && msg.resourceId) {
          await this.handleSubscribe(ws, msg.channel, msg.resourceId, msg.sinceEventId);
        }
        break;

      case "unsubscribe":
        if (msg.channel && msg.resourceId) {
          this.handleUnsubscribe(ws, msg.channel, msg.resourceId);
        }
        break;

      case "ping":
        this.send(ws, { type: "pong", timestamp: new Date().toISOString() });
        break;

      case "presence":
        if (msg.channel && msg.resourceId && msg.state) {
          await this.handlePresence(ws, msg.channel, msg.resourceId, msg.state);
        }
        break;

      default:
        this.send(ws, {
          type: "error",
          code: "unknown_action",
          message: `Unknown action: ${(msg as { action: string }).action}`,
        });
    }
  }

  /**
   * Handle subscription request
   * Phase 2: Supports event recovery with sinceEventId
   */
  private async handleSubscribe(
    ws: ServerWebSocket<WebSocketData>,
    channel: ChannelType,
    resourceId: string,
    sinceEventId?: string
  ): Promise<void> {
    const data = ws.data;
    const channelKey: ChannelKey = `${channel}:${resourceId}`;

    // Check subscription limit
    if (data.subscriptions.size >= getMaxSubscriptions() && !data.subscriptions.has(channelKey)) {
      this.send(ws, {
        type: "subscription.rejected",
        channel,
        resourceId,
        reason: "subscription_limit_exceeded",
      });
      return;
    }

    // Check permissions
    const hasPermission = await this.checkPermission(data.session, channel, resourceId);
    if (!hasPermission) {
      this.send(ws, {
        type: "subscription.rejected",
        channel,
        resourceId,
        reason: "insufficient_permissions",
      });
      return;
    }

    // Check if this is the first subscriber for this channel
    const isFirstSubscriber = !this.connectionsByChannel.has(channelKey) ||
      this.connectionsByChannel.get(channelKey)!.size === 0;

    // Add subscription
    data.subscriptions.add(channelKey);

    // Add to channel tracking
    if (!this.connectionsByChannel.has(channelKey)) {
      this.connectionsByChannel.set(channelKey, new Set());
    }
    this.connectionsByChannel.get(channelKey)!.add(data.connectionId);

    // Subscribe to Redis channel (Phase 2)
    if (isFirstSubscriber && redisPubSub.isEnabled()) {
      await redisPubSub.subscribeToChannel(channel, resourceId);
    }

    log.debug(`Connection ${data.connectionId} subscribed to ${channelKey}`);

    // Handle event recovery (Phase 2)
    if (sinceEventId && redisPubSub.isEnabled()) {
      const missedEvents = await redisPubSub.getMissedEvents(channel, resourceId, sinceEventId);

      if (missedEvents === null) {
        // Gap too large - client must reset
        this.send(ws, {
          type: "subscription.reset",
          channel,
          resourceId,
          reason: "event_gap_too_large",
          message: "Too many events missed. Please refetch full state.",
        });
        return;
      }

      // Send missed events
      for (const event of missedEvents) {
        this.send(ws, {
          channel,
          resourceId,
          event: event.type,
          eventId: event.eventId,
          timestamp: event.timestamp,
          data: event.data,
        });
      }
    }

    // Send subscription confirmed
    this.send(ws, {
      type: "subscription.confirmed",
      channel,
      resourceId,
    });

    // Send current presence (Phase 2)
    if (redisPubSub.isEnabled()) {
      const presence = await redisPubSub.getPresence(channel, resourceId);
      if (presence.length > 0) {
        this.send(ws, {
          type: "presence.initial",
          channel,
          resourceId,
          presence,
        });
      }
    }
  }

  /**
   * Handle unsubscribe request
   * Phase 2: Removes presence and unsubscribes from Redis when last client leaves
   */
  private async handleUnsubscribe(
    ws: ServerWebSocket<WebSocketData>,
    channel: ChannelType,
    resourceId: string
  ): Promise<void> {
    const data = ws.data;
    const channelKey: ChannelKey = `${channel}:${resourceId}`;

    // Remove presence (Phase 2)
    if (redisPubSub.isEnabled()) {
      await redisPubSub.removePresence(channel, resourceId, data.userId);
    }

    data.subscriptions.delete(channelKey);

    // Check if this was the last subscriber
    const wasLastSubscriber = this.connectionsByChannel.has(channelKey) &&
      this.connectionsByChannel.get(channelKey)!.size === 1;

    this.removeFromChannel(channelKey, data.connectionId);

    // Unsubscribe from Redis channel when last client leaves (Phase 2)
    if (wasLastSubscriber && redisPubSub.isEnabled()) {
      await redisPubSub.unsubscribeFromChannel(channel, resourceId);
    }

    this.send(ws, {
      type: "subscription.unconfirmed",
      channel,
      resourceId,
    });
  }

  /**
   * Handle presence update (Phase 2)
   * Rate limited to 10 updates per 10 seconds per connection
   */
  private async handlePresence(
    ws: ServerWebSocket<WebSocketData>,
    channel: ChannelType,
    resourceId: string,
    state: PresenceState
  ): Promise<void> {
    const data = ws.data;
    const channelKey: ChannelKey = `${channel}:${resourceId}`;

    // Must be subscribed to the channel
    if (!data.subscriptions.has(channelKey)) {
      this.send(ws, {
        type: "error",
        code: "not_subscribed",
        message: "Must be subscribed to update presence",
      });
      return;
    }

    // Rate limit presence updates (10 per 10 seconds)
    const now = Date.now();
    const lastUpdate = this.presenceLastUpdate.get(data.connectionId) || 0;
    if (now - lastUpdate < 1000) { // 1 second minimum between updates
      return; // Silently drop
    }
    this.presenceLastUpdate.set(data.connectionId, now);

    // Update presence in Redis
    if (redisPubSub.isEnabled()) {
      await redisPubSub.updatePresence(
        channel,
        resourceId,
        data.userId,
        { name: data.userName, avatar_url: data.userAvatarUrl },
        state
      );
    }
  }

  /**
   * Handle message received from Redis pub/sub (Phase 2)
   */
  private handleRedisMessage(message: { channel: ChannelType; resourceId: string; event: RealtimeEvent }): void {
    const channelKey: ChannelKey = `${message.channel}:${message.resourceId}`;

    // Broadcast to local subscribers
    const connectionIds = this.connectionsByChannel.get(channelKey);
    if (!connectionIds) return;

    const connIdSnapshot = [...connectionIds];

    for (const connId of connIdSnapshot) {
      const ws = this.connections.get(connId);
      if (!ws) continue;

      // Skip the actor (don't send their own events back)
      if (ws.data.userId === message.event.actorId) continue;

      this.send(ws, {
        channel: message.channel,
        resourceId: message.resourceId,
        event: message.event.type,
        eventId: message.event.eventId,
        timestamp: message.event.timestamp,
        data: message.event.data,
      });
    }
  }

  /**
   * Broadcast presence update to local subscribers (Phase 2)
   */
  private broadcastPresenceUpdate(channel: ChannelType, resourceId: string, presence: PresenceUser): void {
    const channelKey: ChannelKey = `${channel}:${resourceId}`;
    const connectionIds = this.connectionsByChannel.get(channelKey);
    if (!connectionIds) return;

    const connIdSnapshot = [...connectionIds];

    for (const connId of connIdSnapshot) {
      const ws = this.connections.get(connId);
      if (!ws) continue;

      // Don't send presence back to the user who originated it
      if (ws.data.userId === presence.id) continue;

      this.send(ws, {
        type: "presence.update",
        channel,
        resourceId,
        user: {
          id: presence.id,
          name: presence.name,
          avatar_url: presence.avatar_url,
        },
        state: presence.state,
      });
    }
  }

  /**
   * Broadcast presence leave to local subscribers (Phase 2)
   */
  private broadcastPresenceLeave(channel: ChannelType, resourceId: string, userId: string): void {
    const channelKey: ChannelKey = `${channel}:${resourceId}`;
    const connectionIds = this.connectionsByChannel.get(channelKey);
    if (!connectionIds) return;

    const connIdSnapshot = [...connectionIds];

    for (const connId of connIdSnapshot) {
      const ws = this.connections.get(connId);
      if (!ws) continue;

      this.send(ws, {
        type: "presence.leave",
        channel,
        resourceId,
        user_id: userId,
      });
    }
  }

  /**
   * Check if user has permission to subscribe to a channel
   */
  private async checkPermission(
    session: SessionData,
    channel: ChannelType,
    resourceId: string
  ): Promise<boolean> {
    switch (channel) {
      case "project": {
        // Check if user has access to the project via account membership
        const access = await verifyProjectAccess(resourceId, session.currentAccountId);
        return access !== null;
      }

      case "file": {
        // File access is checked via project membership
        const [file] = await db
          .select()
          .from(files)
          .where(eq(files.id, resourceId))
          .limit(1);

        if (!file) return false;

        // Check if user has access to the file's project
        const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
        return access !== null;
      }

      case "user":
        // Can only subscribe to own user channel
        return resourceId === session.userId;

      case "share": {
        // Share access is checked via account membership
        const [share] = await db
          .select()
          .from(shares)
          .where(eq(shares.id, resourceId))
          .limit(1);

        if (!share) return false;

        // Check if user has access to the share's account
        return verifyAccountAccess(share.accountId, session.currentAccountId);
      }

      default:
        return false;
    }
  }

  /**
   * Check rate limit for a connection
   */
  private checkRateLimit(data: WebSocketData): boolean {
    const now = Date.now();
    const windowStart = now - getRateLimitWindow();

    // Filter out old timestamps
    data.messageTimestamps = data.messageTimestamps.filter((ts) => ts > windowStart);

    // Check limit
    if (data.messageTimestamps.length >= getRateLimitMessages()) {
      return false;
    }

    // Add current timestamp
    data.messageTimestamps.push(now);
    return true;
  }

  /**
   * Broadcast an event to all subscribed connections
   * Phase 2: Also publishes to Redis for cross-instance distribution
   */
  private broadcastEvent(event: RealtimeEvent): void {
    // Publish to Redis for cross-instance distribution (Phase 2)
    if (redisPubSub.isEnabled()) {
      // Fire-and-forget publish to Redis
      redisPubSub.publishEvent(event).catch((error) => {
        log.error("Failed to publish event to Redis", error instanceof Error ? error : undefined);
      });
    }

    // Set broadcast flag to queue any modifications during iteration
    this.isBroadcasting = true;

    try {
      // Determine which channels to broadcast to
      const channels: ChannelKey[] = [];

      // Project-level events go to project channel
      if (event.projectId) {
        channels.push(`project:${event.projectId}`);
      }

      // File-level events also go to file channel
      if (event.fileId) {
        channels.push(`file:${event.fileId}`);
      }

      // Broadcast to each channel
      const actorId = event.actorId;

      for (const channelKey of channels) {
        const connectionIds = this.connectionsByChannel.get(channelKey);
        if (!connectionIds) continue;

        // Snapshot connection IDs to avoid modification during iteration
        const connIdSnapshot = [...connectionIds];

        for (const connId of connIdSnapshot) {
          const ws = this.connections.get(connId);
          if (!ws) continue;

          // Skip the actor (don't send their own events back)
          if (ws.data.userId === actorId) continue;

          // Send the event
          this.send(ws, {
            channel: channelKey.split(":")[0] as ChannelType,
            resourceId: channelKey.split(":")[1],
            event: event.type,
            eventId: event.eventId,
            timestamp: event.timestamp,
            data: event.data,
          });
        }
      }
    } finally {
      // Clear broadcast flag and process any queued modifications
      this.isBroadcasting = false;
      this.processPendingModifications();
    }
  }

  /**
   * Remove a connection from a channel
   */
  private removeFromChannel(channelKey: string, connectionId: string): void {
    const channelConnections = this.connectionsByChannel.get(channelKey);
    if (channelConnections) {
      channelConnections.delete(connectionId);
      if (channelConnections.size === 0) {
        this.connectionsByChannel.delete(channelKey);
      }
    }
  }

  /**
   * Send a message to a WebSocket
   * @returns true if sent successfully, false if failed
   */
  private send(ws: ServerWebSocket<WebSocketData>, message: ServerMessage): boolean {
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      log.error("Failed to send message", error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    activeChannels: number;
  } {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.connectionsByUser.size,
      activeChannels: this.connectionsByChannel.size,
    };
  }
}

/**
 * Singleton WebSocket manager instance
 */
export const wsManager = new WebSocketManager();
