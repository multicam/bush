/**
 * Bush Platform - Real-time Module Entry Point
 *
 * Exports all real-time infrastructure components.
 * Phase 2: Redis pub/sub for horizontal scaling, presence, event recovery.
 * Reference: specs/05-realtime.md
 */

// Event bus and types
export { eventBus, generateEventId, type RealtimeEvent, type EventType, type ChannelType } from "./event-bus.js";

// Event emission helpers
export {
  emitEvent,
  emitCommentEvent,
  emitFileEvent,
  emitUploadProgress,
  emitProcessingEvent,
  emitVersionEvent,
  emitFolderEvent,
  emitNotificationEvent,
  emitShareEvent,
  emitMetadataEvent,
  type EmitEventOptions,
} from "./emit.js";

// WebSocket manager
export {
  wsManager,
  WsCloseCode,
  type WebSocketData,
  type ServerMessage,
} from "./ws-manager.js";

// Redis pub/sub (Phase 2)
export {
  redisPubSub,
  REDIS_WS_CHANNEL_PREFIX,
  MAX_EVENTS_PER_CHANNEL,
  EVENT_LOG_TTL_SECONDS,
  PRESENCE_TTL_SECONDS,
  type PresenceStatus,
  type PresenceState,
  type PresenceUser,
  type RedisPubSubMessage,
} from "./redis-pubsub.js";
