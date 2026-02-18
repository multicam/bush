/**
 * Bush Platform - Real-time Module Entry Point
 *
 * Exports all real-time infrastructure components.
 * Reference: specs/14-realtime-collaboration.md
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
