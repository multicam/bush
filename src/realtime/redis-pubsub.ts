/**
 * Bush Platform - Redis Pub/Sub for Realtime Events
 *
 * Manages Redis pub/sub for cross-instance event distribution.
 * Phase 2 feature for horizontal scaling.
 * Reference: specs/05-realtime.md Section 4 (Redis Pub/Sub)
 */
import Redis from "ioredis";
import { config } from "../config/index.js";
import type { RealtimeEvent, ChannelType } from "./event-bus.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("RedisPubSub");

// ============================================================================
// Constants
// ============================================================================

/**
 * Redis channel prefix for WebSocket events
 * Format: bush:ws:{channel_type}:{resource_id}
 */
export const REDIS_WS_CHANNEL_PREFIX = "ws:";

/**
 * Maximum events to store per channel in the event log
 */
export const MAX_EVENTS_PER_CHANNEL = 1000;

/**
 * TTL for event log entries (1 hour in seconds)
 */
export const EVENT_LOG_TTL_SECONDS = 3600;

/**
 * TTL for presence entries (60 seconds)
 */
export const PRESENCE_TTL_SECONDS = 60;

// ============================================================================
// Types
// ============================================================================

/**
 * Presence status values
 */
export type PresenceStatus = "viewing" | "idle" | "commenting";

/**
 * Presence state submitted by client
 */
export interface PresenceState {
  status: PresenceStatus;
  cursor_position?: number;
}

/**
 * Presence user info for broadcasting
 */
export interface PresenceUser {
  id: string;
  name: string;
  avatar_url: string | null;
  state: PresenceState;
  lastSeen: string;
}

/**
 * Message received from Redis pub/sub
 */
export interface RedisPubSubMessage {
  channel: ChannelType;
  resourceId: string;
  event: RealtimeEvent;
}

// ============================================================================
// Redis Pub/Sub Manager
// ============================================================================

/**
 * Redis Pub/Sub manager for cross-instance communication
 */
export class RedisPubSubManager {
  /** Publisher client (shared with getRedis() for efficiency) */
  private publisher: Redis | null = null;

  /** Subscriber client (must be separate for pub/sub) */
  private subscriber: Redis | null = null;

  /** Active Redis subscriptions */
  private activeRedisChannels = new Set<string>();

  /** Callback when a Redis message is received */
  private onMessageCallback: ((message: RedisPubSubMessage) => void) | null = null;

  /** Callback when a presence update is received */
  private onPresenceCallback: ((channel: ChannelType, resourceId: string, presence: PresenceUser) => void) | null = null;

  /** Callback when a presence leave is received */
  private onPresenceLeaveCallback: ((channel: ChannelType, resourceId: string, userId: string) => void) | null = null;

  /** Flag to track if initialized */
  private initialized = false;

  /**
   * Initialize Redis pub/sub connections
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create publisher client
      this.publisher = new Redis(config.REDIS_URL, {
        keyPrefix: config.REDIS_KEY_PREFIX,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });

      // Create separate subscriber client
      this.subscriber = new Redis(config.REDIS_URL, {
        keyPrefix: config.REDIS_KEY_PREFIX,
        maxRetriesPerRequest: null, // Required for subscriber
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });

      // Set up message handler
      this.subscriber.on("message", (channel: string, message: string) => {
        this.handleRedisMessage(channel, message);
      });

      this.subscriber.on("error", (err) => {
        log.error("Subscriber error", err instanceof Error ? err : undefined);
      });

      // Connect both clients
      await Promise.all([this.publisher.ping(), this.subscriber.connect()]);

      this.initialized = true;
      log.info("Initialized");
    } catch (error) {
      log.error("Failed to initialize", error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Shutdown Redis pub/sub connections
   */
  async shutdown(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    this.activeRedisChannels.clear();
    this.initialized = false;
    log.info("Shutdown complete");
  }

  /**
   * Set callback for received messages
   */
  onMessage(callback: (message: RedisPubSubMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for presence updates
   */
  onPresence(callback: (channel: ChannelType, resourceId: string, presence: PresenceUser) => void): void {
    this.onPresenceCallback = callback;
  }

  /**
   * Set callback for presence leave events
   */
  onPresenceLeave(callback: (channel: ChannelType, resourceId: string, userId: string) => void): void {
    this.onPresenceLeaveCallback = callback;
  }

  /**
   * Subscribe to a Redis channel (if not already subscribed)
   */
  async subscribeToChannel(channel: ChannelType, resourceId: string): Promise<void> {
    if (!this.subscriber || !this.initialized) {
      return;
    }

    const redisChannel = this.getRedisChannelName(channel, resourceId);

    if (!this.activeRedisChannels.has(redisChannel)) {
      await this.subscriber.subscribe(redisChannel);
      this.activeRedisChannels.add(redisChannel);
      log.debug(`Subscribed to ${redisChannel}`);
    }
  }

  /**
   * Unsubscribe from a Redis channel
   */
  async unsubscribeFromChannel(channel: ChannelType, resourceId: string): Promise<void> {
    if (!this.subscriber || !this.initialized) {
      return;
    }

    const redisChannel = this.getRedisChannelName(channel, resourceId);

    if (this.activeRedisChannels.has(redisChannel)) {
      await this.subscriber.unsubscribe(redisChannel);
      this.activeRedisChannels.delete(redisChannel);
      log.debug(`Unsubscribed from ${redisChannel}`);
    }
  }

  /**
   * Publish an event to Redis
   */
  async publishEvent(event: RealtimeEvent): Promise<void> {
    if (!this.publisher || !this.initialized) {
      return;
    }

    // Publish to project channel if available
    if (event.projectId) {
      const redisChannel = this.getRedisChannelName("project", event.projectId);
      const message = JSON.stringify({
        type: "event",
        event,
      });
      await this.publisher.publish(redisChannel, message);
    }

    // Publish to file channel if available
    if (event.fileId) {
      const redisChannel = this.getRedisChannelName("file", event.fileId);
      const message = JSON.stringify({
        type: "event",
        event,
      });
      await this.publisher.publish(redisChannel, message);
    }

    // Store event in log for recovery
    await this.storeEventInLog(event);
  }

  /**
   * Store event in Redis log for recovery
   */
  private async storeEventInLog(event: RealtimeEvent): Promise<void> {
    if (!this.publisher || !this.initialized) return;

    const eventJson = JSON.stringify(event);

    // Store for project channel
    if (event.projectId) {
      const logKey = this.getEventLogKey("project", event.projectId);
      await this.publisher.lpush(logKey, eventJson);
      await this.publisher.ltrim(logKey, 0, MAX_EVENTS_PER_CHANNEL - 1);
      await this.publisher.expire(logKey, EVENT_LOG_TTL_SECONDS);
    }

    // Store for file channel
    if (event.fileId) {
      const logKey = this.getEventLogKey("file", event.fileId);
      await this.publisher.lpush(logKey, eventJson);
      await this.publisher.ltrim(logKey, 0, MAX_EVENTS_PER_CHANNEL - 1);
      await this.publisher.expire(logKey, EVENT_LOG_TTL_SECONDS);
    }
  }

  /**
   * Get missed events since a given event ID
   * Returns null if gap is too large (reset needed)
   */
  async getMissedEvents(
    channel: ChannelType,
    resourceId: string,
    sinceEventId: string
  ): Promise<RealtimeEvent[] | null> {
    if (!this.publisher || !this.initialized) {
      return null;
    }

    const logKey = this.getEventLogKey(channel, resourceId);
    const events = await this.publisher.lrange(logKey, 0, MAX_EVENTS_PER_CHANNEL - 1);

    // Find the position of sinceEventId
    const foundIndex = events.findIndex((eventJson) => {
      try {
        const event = JSON.parse(eventJson) as RealtimeEvent;
        return event.eventId === sinceEventId;
      } catch {
        return false;
      }
    });

    // Event not found in log - gap is too large
    if (foundIndex === -1) {
      return null;
    }

    // Return events after the sinceEventId (events are in reverse chronological order)
    const missedEvents: RealtimeEvent[] = [];
    for (let i = 0; i < foundIndex; i++) {
      try {
        const event = JSON.parse(events[i]) as RealtimeEvent;
        missedEvents.push(event);
      } catch {
        // Skip malformed events
      }
    }

    // Reverse to get chronological order
    return missedEvents.reverse();
  }

  // ============================================================================
  // Presence Management
  // ============================================================================

  /**
   * Update user presence in Redis
   */
  async updatePresence(
    channel: ChannelType,
    resourceId: string,
    userId: string,
    userInfo: { name: string; avatar_url: string | null },
    state: PresenceState
  ): Promise<void> {
    if (!this.publisher || !this.initialized) return;

    const presenceKey = this.getPresenceKey(channel, resourceId);
    const presenceData: PresenceUser = {
      id: userId,
      name: userInfo.name,
      avatar_url: userInfo.avatar_url,
      state,
      lastSeen: new Date().toISOString(),
    };

    // Store in Redis hash
    await this.publisher.hset(presenceKey, userId, JSON.stringify(presenceData));
    await this.publisher.expire(presenceKey, PRESENCE_TTL_SECONDS);

    // Broadcast presence update via pub/sub
    const redisChannel = this.getRedisChannelName(channel, resourceId);
    const message = JSON.stringify({
      type: "presence",
      channel,
      resourceId,
      presence: presenceData,
    });
    await this.publisher.publish(redisChannel, message);
  }

  /**
   * Remove user presence from Redis
   */
  async removePresence(
    channel: ChannelType,
    resourceId: string,
    userId: string
  ): Promise<void> {
    if (!this.publisher || !this.initialized) return;

    const presenceKey = this.getPresenceKey(channel, resourceId);
    await this.publisher.hdel(presenceKey, userId);

    // Broadcast presence leave via pub/sub
    const redisChannel = this.getRedisChannelName(channel, resourceId);
    const message = JSON.stringify({
      type: "presence_leave",
      channel,
      resourceId,
      userId,
    });
    await this.publisher.publish(redisChannel, message);
  }

  /**
   * Get all presence for a channel
   */
  async getPresence(
    channel: ChannelType,
    resourceId: string
  ): Promise<PresenceUser[]> {
    if (!this.publisher || !this.initialized) {
      return [];
    }

    const presenceKey = this.getPresenceKey(channel, resourceId);
    const presenceMap = await this.publisher.hgetall(presenceKey);

    const presences: PresenceUser[] = [];
    for (const userId in presenceMap) {
      try {
        const presence = JSON.parse(presenceMap[userId]) as PresenceUser;
        presences.push(presence);
      } catch {
        // Skip malformed entries
      }
    }

    return presences;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get Redis channel name for pub/sub
   */
  private getRedisChannelName(channel: ChannelType, resourceId: string): string {
    return `${REDIS_WS_CHANNEL_PREFIX}${channel}:${resourceId}`;
  }

  /**
   * Get Redis key for event log
   */
  private getEventLogKey(channel: ChannelType, resourceId: string): string {
    return `events:${channel}:${resourceId}`;
  }

  /**
   * Get Redis key for presence
   */
  private getPresenceKey(channel: ChannelType, resourceId: string): string {
    return `presence:${channel}:${resourceId}`;
  }

  /**
   * Handle incoming Redis message
   */
  private handleRedisMessage(redisChannel: string, message: string): void {
    try {
      const parsed = JSON.parse(message);

      // Handle presence updates
      if (parsed.type === "presence" && this.onPresenceCallback) {
        this.onPresenceCallback(parsed.channel, parsed.resourceId, parsed.presence);
        return;
      }

      // Handle presence leave
      if (parsed.type === "presence_leave" && this.onPresenceLeaveCallback) {
        this.onPresenceLeaveCallback(parsed.channel, parsed.resourceId, parsed.userId);
        return;
      }

      // Handle events
      if (parsed.type === "event" && this.onMessageCallback) {
        // Parse channel from redis channel name
        const channelParts = redisChannel.replace(REDIS_WS_CHANNEL_PREFIX, "").split(":");
        const channel = channelParts[0] as ChannelType;
        const resourceId = channelParts.slice(1).join(":");

        this.onMessageCallback({
          channel,
          resourceId,
          event: parsed.event as RealtimeEvent,
        });
      }
    } catch (error) {
      log.error("Failed to parse message", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Check if Redis pub/sub is enabled and connected
   */
  isEnabled(): boolean {
    return this.initialized && this.publisher !== null && this.subscriber !== null;
  }

  /**
   * Get active Redis channel count
   */
  getActiveChannelCount(): number {
    return this.activeRedisChannels.size;
  }
}

/**
 * Singleton Redis pub/sub manager
 */
export const redisPubSub = new RedisPubSubManager();
