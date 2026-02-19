/**
 * Bush Platform - Realtime Emit Tests
 *
 * Tests for event emission helper functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
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
} from "./emit.js";
import { eventBus } from "./event-bus.js";

describe("emit", () => {
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = vi.fn();
    eventBus.onEvent(handler);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe("emitEvent", () => {
    it("should emit an event with all required fields", () => {
      emitEvent({
        type: "file.created",
        actorId: "usr_1",
        projectId: "prj_1",
        data: { fileId: "file_1" },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];

      expect(event.type).toBe("file.created");
      expect(event.eventId).toMatch(/^evt_/);
      expect(event.timestamp).toBeDefined();
      expect(event.actorId).toBe("usr_1");
      expect(event.projectId).toBe("prj_1");
      expect(event.data.fileId).toBe("file_1");
    });

    it("should include optional fileId", () => {
      emitEvent({
        type: "file.deleted",
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        data: { fileId: "file_1" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.fileId).toBe("file_1");
    });

    it("should generate unique event IDs", () => {
      emitEvent({
        type: "file.created",
        actorId: "usr_1",
        projectId: "prj_1",
        data: {},
      });

      emitEvent({
        type: "file.created",
        actorId: "usr_1",
        projectId: "prj_1",
        data: {},
      });

      const event1 = handler.mock.calls[0][0];
      const event2 = handler.mock.calls[1][0];
      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it("should generate ISO timestamp", () => {
      const before = new Date().toISOString();
      emitEvent({
        type: "file.created",
        actorId: "usr_1",
        projectId: "prj_1",
        data: {},
      });
      const after = new Date().toISOString();

      const event = handler.mock.calls[0][0];
      expect(event.timestamp >= before).toBe(true);
      expect(event.timestamp <= after).toBe(true);
    });
  });

  describe("emitCommentEvent", () => {
    it("should emit comment.created event", () => {
      emitCommentEvent("comment.created", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        commentId: "cmt_1",
        data: { text: "Test comment", internal: false },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("comment.created");
      expect(event.data.commentId).toBe("cmt_1");
      expect(event.data.fileId).toBe("file_1");
      expect(event.data.text).toBe("Test comment");
    });

    it("should emit comment.updated event", () => {
      emitCommentEvent("comment.updated", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        commentId: "cmt_1",
        data: { text: "Updated text" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("comment.updated");
    });

    it("should emit comment.deleted event", () => {
      emitCommentEvent("comment.deleted", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        commentId: "cmt_1",
        data: {},
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("comment.deleted");
    });

    it("should emit comment.completed event", () => {
      emitCommentEvent("comment.completed", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        commentId: "cmt_1",
        data: { completedBy: "usr_2", completedAt: "2024-01-01T00:00:00Z" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("comment.completed");
      expect(event.data.completedBy).toBe("usr_2");
    });
  });

  describe("emitFileEvent", () => {
    it("should emit file.created event", () => {
      emitFileEvent("file.created", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        data: { fileId: "file_1", name: "video.mp4", mimeType: "video/mp4", size: 1024 },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("file.created");
      expect(event.data.fileId).toBe("file_1");
    });

    it("should emit file.deleted event", () => {
      emitFileEvent("file.deleted", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        data: {},
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("file.deleted");
    });

    it("should emit file.moved event", () => {
      emitFileEvent("file.moved", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        data: { oldFolderId: "fld_1", newFolderId: "fld_2" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("file.moved");
    });

    it("should emit file.updated event", () => {
      emitFileEvent("file.updated", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        data: { changes: { name: "renamed.mp4" } },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("file.updated");
    });

    it("should emit file.status_changed event", () => {
      emitFileEvent("file.status_changed", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        data: { oldStatus: "uploading", newStatus: "ready", changedBy: "usr_1" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("file.status_changed");
    });
  });

  describe("emitUploadProgress", () => {
    it("should emit upload.progress event with calculated percentage", () => {
      emitUploadProgress({
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        bytesUploaded: 500000,
        bytesTotal: 1000000,
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("upload.progress");
      expect(event.data.fileId).toBe("file_1");
      expect(event.data.bytesUploaded).toBe(500000);
      expect(event.data.bytesTotal).toBe(1000000);
      expect(event.data.percentage).toBe(50);
    });

    it("should calculate percentage correctly", () => {
      emitUploadProgress({
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        bytesUploaded: 333333,
        bytesTotal: 1000000,
      });

      const event = handler.mock.calls[0][0];
      expect(event.data.percentage).toBe(33); // Math.round(33.333) = 33
    });

    it("should handle 100% upload", () => {
      emitUploadProgress({
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        bytesUploaded: 1000000,
        bytesTotal: 1000000,
      });

      const event = handler.mock.calls[0][0];
      expect(event.data.percentage).toBe(100);
    });
  });

  describe("emitProcessingEvent", () => {
    it("should emit processing.started event", () => {
      emitProcessingEvent("processing.started", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        jobType: "thumbnail",
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("processing.started");
      expect(event.data.jobType).toBe("thumbnail");
      expect(event.data.percentage).toBeUndefined();
    });

    it("should emit processing.progress event with percentage", () => {
      emitProcessingEvent("processing.progress", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        jobType: "transcode",
        percentage: 75,
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("processing.progress");
      expect(event.data.percentage).toBe(75);
    });

    it("should emit processing.completed event with outputUrls", () => {
      emitProcessingEvent("processing.completed", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        jobType: "filmstrip",
        outputUrls: { filmstrip: "https://example.com/filmstrip.jpg" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("processing.completed");
      expect(event.data.outputUrls).toEqual({ filmstrip: "https://example.com/filmstrip.jpg" });
    });

    it("should emit processing.failed event with error message", () => {
      emitProcessingEvent("processing.failed", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        jobType: "metadata",
        errorMessage: "Failed to extract metadata",
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("processing.failed");
      expect(event.data.errorMessage).toBe("Failed to extract metadata");
    });

    it("should not include undefined optional fields", () => {
      emitProcessingEvent("processing.started", {
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        jobType: "thumbnail",
      });

      const event = handler.mock.calls[0][0];
      expect(event.data.percentage).toBeUndefined();
      expect(event.data.outputUrls).toBeUndefined();
      expect(event.data.errorMessage).toBeUndefined();
    });
  });

  describe("emitVersionEvent", () => {
    it("should emit version.created event", () => {
      emitVersionEvent("version.created", {
        actorId: "usr_1",
        projectId: "prj_1",
        stackId: "stack_1",
        fileId: "file_1",
        data: { versionNumber: 2 },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("version.created");
      expect(event.data.stackId).toBe("stack_1");
      expect(event.data.versionNumber).toBe(2);
    });

    it("should emit version.current_changed event", () => {
      emitVersionEvent("version.current_changed", {
        actorId: "usr_1",
        projectId: "prj_1",
        stackId: "stack_1",
        fileId: "file_1",
        data: { oldFileId: "file_1", newFileId: "file_2" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("version.current_changed");
    });
  });

  describe("emitFolderEvent", () => {
    it("should emit folder.created event", () => {
      emitFolderEvent("folder.created", {
        actorId: "usr_1",
        projectId: "prj_1",
        folderId: "fld_1",
        data: { name: "New Folder", parentId: null },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("folder.created");
      expect(event.data.folderId).toBe("fld_1");
    });

    it("should emit folder.deleted event", () => {
      emitFolderEvent("folder.deleted", {
        actorId: "usr_1",
        projectId: "prj_1",
        folderId: "fld_1",
        data: {},
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("folder.deleted");
    });
  });

  describe("emitNotificationEvent", () => {
    it("should emit notification.created event", () => {
      emitNotificationEvent("notification.created", {
        actorId: "usr_1",
        projectId: "prj_1",
        notificationId: "notif_1",
        data: { notificationType: "comment", title: "New comment" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("notification.created");
      expect(event.data.notificationId).toBe("notif_1");
    });

    it("should emit notification.read event", () => {
      emitNotificationEvent("notification.read", {
        actorId: "usr_1",
        notificationId: "notif_1",
        data: {},
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("notification.read");
      expect(event.projectId).toBe("");
    });

    it("should handle missing projectId", () => {
      emitNotificationEvent("notification.created", {
        actorId: "usr_1",
        notificationId: "notif_1",
        data: { title: "Test" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.projectId).toBe("");
    });
  });

  describe("emitShareEvent", () => {
    it("should emit share.viewed event", () => {
      emitShareEvent("share.viewed", {
        actorId: "usr_1",
        projectId: "prj_1",
        shareId: "share_1",
        data: { viewerName: "John", viewerEmail: "john@example.com" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("share.viewed");
      expect(event.data.shareId).toBe("share_1");
    });

    it("should emit share.downloaded event", () => {
      emitShareEvent("share.downloaded", {
        actorId: "usr_1",
        projectId: "prj_1",
        shareId: "share_1",
        data: { fileId: "file_1", viewerName: "Jane" },
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("share.downloaded");
    });
  });

  describe("emitMetadataEvent", () => {
    it("should emit metadata.field_updated event", () => {
      emitMetadataEvent({
        actorId: "usr_1",
        projectId: "prj_1",
        fileId: "file_1",
        fieldName: "description",
        oldValue: "Old text",
        newValue: "New text",
      });

      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("metadata.field_updated");
      expect(event.data.fileId).toBe("file_1");
      expect(event.data.fieldName).toBe("description");
      expect(event.data.oldValue).toBe("Old text");
      expect(event.data.newValue).toBe("New text");
    });
  });
});
