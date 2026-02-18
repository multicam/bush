/**
 * Bush Platform - Real-time Event Bus
 *
 * In-process EventEmitter for MVP real-time infrastructure.
 * Events are broadcast to WebSocket clients via the ws-manager.
 * Reference: specs/14-realtime-collaboration.md
 * Reference: specs/README.md "Realtime Architecture"
 */
import { EventEmitter } from "events";

// ============================================================================
// Event Types
// ============================================================================

/**
 * Channel types for subscription scoping
 */
export type ChannelType = "project" | "file" | "user" | "share";

/**
 * Base event payload structure
 */
export interface BaseEventPayload {
  /** Event ID for ordering/deduplication */
  eventId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** User ID who triggered the event */
  actorId: string;
  /** Project ID for routing */
  projectId: string;
  /** Optional file ID for file-specific events */
  fileId?: string;
}

/**
 * Comment event types
 */
export interface CommentCreatedPayload extends BaseEventPayload {
  type: "comment.created";
  data: {
    commentId: string;
    fileId: string;
    parentId?: string;
    text: string;
    annotations?: Array<{
      type: "rectangle" | "ellipse" | "arrow" | "line" | "freehand";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
    }>;
    timestamp?: number; // for video/audio comments
    internal: boolean;
  };
}

export interface CommentUpdatedPayload extends BaseEventPayload {
  type: "comment.updated";
  data: {
    commentId: string;
    fileId: string;
    text: string;
  };
}

export interface CommentDeletedPayload extends BaseEventPayload {
  type: "comment.deleted";
  data: {
    commentId: string;
    fileId: string;
  };
}

export interface CommentCompletedPayload extends BaseEventPayload {
  type: "comment.completed";
  data: {
    commentId: string;
    fileId: string;
    completedBy: string;
    completedAt: string;
  };
}

/**
 * File event types
 */
export interface FileCreatedPayload extends BaseEventPayload {
  type: "file.created";
  data: {
    fileId: string;
    name: string;
    mimeType: string;
    size: number;
    folderId: string;
  };
}

export interface FileDeletedPayload extends BaseEventPayload {
  type: "file.deleted";
  data: {
    fileId: string;
  };
}

export interface FileMovedPayload extends BaseEventPayload {
  type: "file.moved";
  data: {
    fileId: string;
    oldFolderId: string;
    newFolderId: string;
  };
}

export interface FileUpdatedPayload extends BaseEventPayload {
  type: "file.updated";
  data: {
    fileId: string;
    changes: Record<string, unknown>;
  };
}

export interface FileStatusChangedPayload extends BaseEventPayload {
  type: "file.status_changed";
  data: {
    fileId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
  };
}

export interface UploadProgressPayload extends BaseEventPayload {
  type: "upload.progress";
  data: {
    fileId: string;
    bytesUploaded: number;
    bytesTotal: number;
    percentage: number;
  };
}

/**
 * Processing event types
 */
export interface ProcessingStartedPayload extends BaseEventPayload {
  type: "processing.started";
  data: {
    fileId: string;
    jobType: "transcode" | "thumbnail" | "filmstrip" | "waveform" | "metadata";
  };
}

export interface ProcessingProgressPayload extends BaseEventPayload {
  type: "processing.progress";
  data: {
    fileId: string;
    jobType: "transcode" | "thumbnail" | "filmstrip" | "waveform" | "metadata";
    percentage: number;
  };
}

export interface ProcessingCompletedPayload extends BaseEventPayload {
  type: "processing.completed";
  data: {
    fileId: string;
    jobType: "transcode" | "thumbnail" | "filmstrip" | "waveform" | "metadata";
    outputUrls?: Record<string, string>;
  };
}

export interface ProcessingFailedPayload extends BaseEventPayload {
  type: "processing.failed";
  data: {
    fileId: string;
    jobType: "transcode" | "thumbnail" | "filmstrip" | "waveform" | "metadata";
    errorMessage: string;
  };
}

export interface TranscriptionCompletedPayload extends BaseEventPayload {
  type: "transcription.completed";
  data: {
    fileId: string;
    language: string;
    wordCount: number;
  };
}

/**
 * Version stack event types
 */
export interface VersionCreatedPayload extends BaseEventPayload {
  type: "version.created";
  data: {
    stackId: string;
    fileId: string;
    versionNumber: number;
  };
}

export interface VersionCurrentChangedPayload extends BaseEventPayload {
  type: "version.current_changed";
  data: {
    stackId: string;
    oldFileId: string;
    newFileId: string;
  };
}

/**
 * Folder event types
 */
export interface FolderCreatedPayload extends BaseEventPayload {
  type: "folder.created";
  data: {
    folderId: string;
    name: string;
    parentId: string | null;
  };
}

export interface FolderDeletedPayload extends BaseEventPayload {
  type: "folder.deleted";
  data: {
    folderId: string;
  };
}

/**
 * Member event types
 */
export interface MemberAddedPayload extends BaseEventPayload {
  type: "member.added";
  data: {
    userId: string;
    permissionLevel: string;
  };
}

export interface MemberRemovedPayload extends BaseEventPayload {
  type: "member.removed";
  data: {
    userId: string;
  };
}

/**
 * Notification event types
 */
export interface NotificationCreatedPayload extends Omit<BaseEventPayload, "projectId" | "fileId"> {
  type: "notification.created";
  projectId?: string;
  fileId?: string;
  data: {
    notificationId: string;
    notificationType: string;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
  };
}

export interface NotificationReadPayload extends Omit<BaseEventPayload, "projectId" | "fileId"> {
  type: "notification.read";
  projectId?: string;
  fileId?: string;
  data: {
    notificationId: string;
  };
}

/**
 * Share event types
 */
export interface ShareViewedPayload extends BaseEventPayload {
  type: "share.viewed";
  data: {
    shareId: string;
    viewerName?: string;
    viewerEmail?: string;
  };
}

export interface ShareDownloadedPayload extends BaseEventPayload {
  type: "share.downloaded";
  data: {
    shareId: string;
    fileId: string;
    viewerName?: string;
    viewerEmail?: string;
  };
}

/**
 * Metadata event types
 */
export interface MetadataFieldUpdatedPayload extends BaseEventPayload {
  type: "metadata.field_updated";
  data: {
    fileId: string;
    fieldName: string;
    oldValue: unknown;
    newValue: unknown;
  };
}

/**
 * Union of all event payload types
 */
export type RealtimeEvent =
  | CommentCreatedPayload
  | CommentUpdatedPayload
  | CommentDeletedPayload
  | CommentCompletedPayload
  | FileCreatedPayload
  | FileDeletedPayload
  | FileMovedPayload
  | FileUpdatedPayload
  | FileStatusChangedPayload
  | UploadProgressPayload
  | ProcessingStartedPayload
  | ProcessingProgressPayload
  | ProcessingCompletedPayload
  | ProcessingFailedPayload
  | TranscriptionCompletedPayload
  | VersionCreatedPayload
  | VersionCurrentChangedPayload
  | FolderCreatedPayload
  | FolderDeletedPayload
  | MemberAddedPayload
  | MemberRemovedPayload
  | NotificationCreatedPayload
  | NotificationReadPayload
  | ShareViewedPayload
  | ShareDownloadedPayload
  | MetadataFieldUpdatedPayload;

/**
 * Event type strings for type-safe emission
 */
export type EventType = RealtimeEvent["type"];

// ============================================================================
// Event Bus Implementation
// ============================================================================

/**
 * Event bus channel name
 */
const EVENT_BUS_CHANNEL = "bush:realtime:event";

/**
 * Global event bus instance
 * Uses Node.js EventEmitter for in-process event distribution
 */
class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for many WebSocket connections
    this.setMaxListeners(100);
  }

  /**
   * Emit a real-time event to all listeners
   */
  emitEvent(event: RealtimeEvent): void {
    this.emit(EVENT_BUS_CHANNEL, event);
  }

  /**
   * Subscribe to all real-time events
   */
  onEvent(handler: (event: RealtimeEvent) => void): () => void {
    this.on(EVENT_BUS_CHANNEL, handler);
    return () => this.off(EVENT_BUS_CHANNEL, handler);
  }
}

/**
 * Singleton event bus instance
 */
export const eventBus = new RealtimeEventBus();

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
