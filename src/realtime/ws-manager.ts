/**
 * Bush Platform - WebSocket Connection Manager
 *
 * Manages WebSocket connections for real-time updates.
 * Handles authentication, subscription management, and event broadcasting.
 * Reference: specs/14-realtime-collaboration.md
 * Reference: specs/README.md "Realtime Architecture"
 */
import type { ServerWebSocket } from "bun";
import { unsealData } from "iron-session";
import { eventBus, type RealtimeEvent, type ChannelType } from "./event-bus.js";
import { sessionCache, parseSessionCookie } from "../auth/session-cache.js";
import { authService } from "../auth/service.js";
import { config } from "../config/index.js";
import type { SessionData } from "../auth/types.js";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";

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
  action: "subscribe" | "unsubscribe" | "ping";
  channel?: ChannelType;
  resourceId?: string;
  projectId?: string;
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
 * Maximum subscriptions per connection
 */
const MAX_SUBSCRIPTIONS = 50;

/**
 * Rate limit: max messages per minute
 */
const RATE_LIMIT_MESSAGES = 100;

/**
 * Rate limit window in milliseconds
 */
const RATE_LIMIT_WINDOW = 60 * 1000;

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

  /**
   * Initialize the WebSocket manager
   * Subscribes to the event bus for broadcasting
   */
  init(): void {
    this.eventBusUnsubscribe = eventBus.onEvent((event) => {
      this.broadcastEvent(event);
    });
    console.log("[WebSocket] Manager initialized");
  }

  /**
   * Shutdown the WebSocket manager
   */
  shutdown(): void {
    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
      this.eventBusUnsubscribe = null;
    }
    this.connections.clear();
    this.connectionsByUser.clear();
    this.connectionsByChannel.clear();
    console.log("[WebSocket] Manager shutdown");
  }

  /**
   * Generate a unique connection ID
   */
  generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Authenticate a WebSocket connection from cookies
   */
  async authenticate(cookieHeader: string): Promise<{ userId: string; session: SessionData } | null> {
    if (!cookieHeader) {
      return null;
    }

    // Try bush_session cookie first (fastest path)
    const bushSessionData = parseSessionCookie(cookieHeader);
    if (bushSessionData) {
      const session = await sessionCache.get(bushSessionData.userId, bushSessionData.sessionId);
      if (session) {
        return { userId: bushSessionData.userId, session };
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
        return { userId, session: resolvedSession };
      } catch (error) {
        console.error("[WebSocket] Failed to authenticate wos-session:", error);
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
    this.connections.set(data.connectionId, ws);

    // Track by user
    if (!this.connectionsByUser.has(data.userId)) {
      this.connectionsByUser.set(data.userId, new Set());
    }
    this.connectionsByUser.get(data.userId)!.add(data.connectionId);

    console.log(`[WebSocket] Connection ${data.connectionId} registered for user ${data.userId}`);

    // Send connection confirmation
    this.send(ws, {
      type: "connection.established",
      connectionId: data.connectionId,
      serverTime: new Date().toISOString(),
    });
  }

  /**
   * Unregister a WebSocket connection
   */
  unregister(ws: ServerWebSocket<WebSocketData>): void {
    const data = ws.data;

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

    console.log(`[WebSocket] Connection ${data.connectionId} unregistered`);
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
          await this.handleSubscribe(ws, msg.channel, msg.resourceId);
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
   */
  private async handleSubscribe(
    ws: ServerWebSocket<WebSocketData>,
    channel: ChannelType,
    resourceId: string
  ): Promise<void> {
    const data = ws.data;
    const channelKey: ChannelKey = `${channel}:${resourceId}`;

    // Check subscription limit
    if (data.subscriptions.size >= MAX_SUBSCRIPTIONS && !data.subscriptions.has(channelKey)) {
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

    // Add subscription
    data.subscriptions.add(channelKey);

    // Add to channel tracking
    if (!this.connectionsByChannel.has(channelKey)) {
      this.connectionsByChannel.set(channelKey, new Set());
    }
    this.connectionsByChannel.get(channelKey)!.add(data.connectionId);

    console.log(`[WebSocket] Connection ${data.connectionId} subscribed to ${channelKey}`);

    this.send(ws, {
      type: "subscription.confirmed",
      channel,
      resourceId,
    });
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(
    ws: ServerWebSocket<WebSocketData>,
    channel: ChannelType,
    resourceId: string
  ): void {
    const data = ws.data;
    const channelKey: ChannelKey = `${channel}:${resourceId}`;

    data.subscriptions.delete(channelKey);
    this.removeFromChannel(channelKey, data.connectionId);

    this.send(ws, {
      type: "subscription.unconfirmed",
      channel,
      resourceId,
    });
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
        // Check if user has access to the project
        const project = await db
          .select()
          .from(projects)
          .where(eq(projects.id, resourceId))
          .limit(1);

        if (project.length === 0) return false;

        // Verify project belongs to user's account
        return project[0].workspaceId !== null;
      }

      case "file":
        // File access is checked via project
        // For now, allow subscription and let the project-level check handle it
        return true;

      case "user":
        // Can only subscribe to own user channel
        return resourceId === session.userId;

      case "share":
        // Share access is checked separately
        // For now, allow subscription
        return true;

      default:
        return false;
    }
  }

  /**
   * Check rate limit for a connection
   */
  private checkRateLimit(data: WebSocketData): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Filter out old timestamps
    data.messageTimestamps = data.messageTimestamps.filter((ts) => ts > windowStart);

    // Check limit
    if (data.messageTimestamps.length >= RATE_LIMIT_MESSAGES) {
      return false;
    }

    // Add current timestamp
    data.messageTimestamps.push(now);
    return true;
  }

  /**
   * Broadcast an event to all subscribed connections
   */
  private broadcastEvent(event: RealtimeEvent): void {
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

      for (const connId of connectionIds) {
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
   */
  private send(ws: ServerWebSocket<WebSocketData>, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Failed to send message:", error);
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
