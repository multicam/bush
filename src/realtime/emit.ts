/**
 * Bush Platform - Real-time Event Emission Helper
 *
 * Convenience functions for emitting real-time events from route handlers.
 * Reference: specs/14-realtime-collaboration.md
 * Reference: specs/README.md "Realtime Architecture"
 */
import { eventBus, generateEventId, type RealtimeEvent, type EventType } from "./event-bus.js";

/**
 * Options for emitting an event
 */
export interface EmitEventOptions {
  /** Event type */
  type: EventType;
  /** User ID who triggered the event */
  actorId: string;
  /** Project ID for routing */
  projectId: string;
  /** Optional file ID for file-specific events */
  fileId?: string;
  /** Event-specific data payload */
  data: Record<string, unknown>;
}

/**
 * Emit a real-time event to all connected WebSocket clients
 *
 * This function creates a properly structured event and broadcasts it
 * through the event bus. The WebSocket manager will receive the event
 * and forward it to appropriate subscribers.
 *
 * @example
 * ```ts
 * // Emit a comment created event
 * await emitEvent({
 *   type: "comment.created",
 *   actorId: session.userId,
 *   projectId: project.id,
 *   fileId: file.id,
 *   data: {
 *     commentId: comment.id,
 *     fileId: file.id,
 *     text: comment.text,
 *   },
 * });
 * ```
 */
export function emitEvent(options: EmitEventOptions): void {
  const event: RealtimeEvent = {
    type: options.type as RealtimeEvent["type"],
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    actorId: options.actorId,
    projectId: options.projectId,
    fileId: options.fileId,
    data: options.data,
  } as RealtimeEvent;

  eventBus.emitEvent(event);
}

/**
 * Emit a comment event
 */
export function emitCommentEvent(
  type: "comment.created" | "comment.updated" | "comment.deleted" | "comment.completed",
  params: {
    actorId: string;
    projectId: string;
    fileId: string;
    commentId: string;
    data: Record<string, unknown>;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId,
    fileId: params.fileId,
    data: {
      commentId: params.commentId,
      fileId: params.fileId,
      ...params.data,
    },
  });
}

/**
 * Emit a file event
 */
export function emitFileEvent(
  type: "file.created" | "file.deleted" | "file.moved" | "file.updated" | "file.status_changed",
  params: {
    actorId: string;
    projectId: string;
    fileId: string;
    data: Record<string, unknown>;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId,
    fileId: params.fileId,
    data: params.data,
  });
}

/**
 * Emit an upload progress event
 */
export function emitUploadProgress(params: {
  actorId: string;
  projectId: string;
  fileId: string;
  bytesUploaded: number;
  bytesTotal: number;
}): void {
  const percentage = Math.round((params.bytesUploaded / params.bytesTotal) * 100);
  emitEvent({
    type: "upload.progress",
    actorId: params.actorId,
    projectId: params.projectId,
    fileId: params.fileId,
    data: {
      fileId: params.fileId,
      bytesUploaded: params.bytesUploaded,
      bytesTotal: params.bytesTotal,
      percentage,
    },
  });
}

/**
 * Emit a processing event
 */
export function emitProcessingEvent(
  type: "processing.started" | "processing.progress" | "processing.completed" | "processing.failed",
  params: {
    actorId: string;
    projectId: string;
    fileId: string;
    jobType: "transcode" | "thumbnail" | "filmstrip" | "waveform" | "metadata";
    percentage?: number;
    outputUrls?: Record<string, string>;
    errorMessage?: string;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId,
    fileId: params.fileId,
    data: {
      fileId: params.fileId,
      jobType: params.jobType,
      ...(params.percentage !== undefined && { percentage: params.percentage }),
      ...(params.outputUrls && { outputUrls: params.outputUrls }),
      ...(params.errorMessage && { errorMessage: params.errorMessage }),
    },
  });
}

/**
 * Emit a version stack event
 */
export function emitVersionEvent(
  type: "version.created" | "version.current_changed",
  params: {
    actorId: string;
    projectId: string;
    stackId: string;
    fileId: string;
    data: Record<string, unknown>;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId,
    fileId: params.fileId,
    data: {
      stackId: params.stackId,
      ...params.data,
    },
  });
}

/**
 * Emit a folder event
 */
export function emitFolderEvent(
  type: "folder.created" | "folder.deleted",
  params: {
    actorId: string;
    projectId: string;
    folderId: string;
    data: Record<string, unknown>;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId,
    data: {
      folderId: params.folderId,
      ...params.data,
    },
  });
}

/**
 * Emit a notification event
 */
export function emitNotificationEvent(
  type: "notification.created" | "notification.read",
  params: {
    actorId: string;
    projectId?: string;
    notificationId: string;
    data: Record<string, unknown>;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId || "",
    data: {
      notificationId: params.notificationId,
      ...params.data,
    },
  });
}

/**
 * Emit a share event
 */
export function emitShareEvent(
  type: "share.viewed" | "share.downloaded",
  params: {
    actorId: string;
    projectId: string;
    shareId: string;
    data: Record<string, unknown>;
  }
): void {
  emitEvent({
    type,
    actorId: params.actorId,
    projectId: params.projectId,
    data: {
      shareId: params.shareId,
      ...params.data,
    },
  });
}

/**
 * Emit a metadata update event
 */
export function emitMetadataEvent(params: {
  actorId: string;
  projectId: string;
  fileId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}): void {
  emitEvent({
    type: "metadata.field_updated",
    actorId: params.actorId,
    projectId: params.projectId,
    fileId: params.fileId,
    data: {
      fileId: params.fileId,
      fieldName: params.fieldName,
      oldValue: params.oldValue,
      newValue: params.newValue,
    },
  });
}

// Re-export types and event bus for direct access
export { eventBus, generateEventId, type RealtimeEvent, type EventType };
