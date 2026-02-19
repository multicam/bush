/**
 * Bush Platform - Realtime Event Bus Tests
 *
 * Tests for the event bus EventEmitter wrapper.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eventBus, generateEventId, type RealtimeEvent } from "./event-bus.js";

describe("RealtimeEventBus", () => {
  beforeEach(() => {
    // Remove all listeners before each test
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe("emitEvent and onEvent", () => {
    it("should emit and receive events", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "file.created",
        eventId: "evt_test",
        timestamp: new Date().toISOString(),
        actorId: "usr_test",
        projectId: "prj_test",
        data: {
          fileId: "file_test",
          name: "test.mp4",
          mimeType: "video/mp4",
          size: 1024,
          folderId: "fld_test",
        },
      };

      eventBus.emitEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support multiple listeners", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.onEvent(handler1);
      eventBus.onEvent(handler2);
      eventBus.onEvent(handler3);

      const event: RealtimeEvent = {
        type: "file.deleted",
        eventId: "evt_test",
        timestamp: new Date().toISOString(),
        actorId: "usr_test",
        projectId: "prj_test",
        data: { fileId: "file_test" },
      };

      eventBus.emitEvent(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledWith(event);
    });

    it("should return unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "comment.created",
        eventId: "evt_test",
        timestamp: new Date().toISOString(),
        actorId: "usr_test",
        projectId: "prj_test",
        data: {
          commentId: "cmt_test",
          fileId: "file_test",
          text: "Test comment",
          internal: false,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("should allow same handler to be subscribed multiple times", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "folder.created",
        eventId: "evt_test",
        timestamp: new Date().toISOString(),
        actorId: "usr_test",
        projectId: "prj_test",
        data: {
          folderId: "fld_test",
          name: "Test Folder",
          parentId: null,
        },
      };

      eventBus.emitEvent(event);

      // Handler called twice because registered twice
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("event types", () => {
    it("should handle comment.created event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "comment.created",
        eventId: "evt_1",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          commentId: "cmt_1",
          fileId: "file_1",
          text: "Great work!",
          internal: false,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "comment.created" })
      );
    });

    it("should handle comment.updated event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "comment.updated",
        eventId: "evt_2",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          commentId: "cmt_1",
          fileId: "file_1",
          text: "Updated text",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "comment.updated" })
      );
    });

    it("should handle comment.deleted event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "comment.deleted",
        eventId: "evt_3",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          commentId: "cmt_1",
          fileId: "file_1",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "comment.deleted" })
      );
    });

    it("should handle comment.completed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "comment.completed",
        eventId: "evt_4",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          commentId: "cmt_1",
          fileId: "file_1",
          completedBy: "usr_2",
          completedAt: new Date().toISOString(),
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "comment.completed" })
      );
    });

    it("should handle file.created event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "file.created",
        eventId: "evt_5",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          name: "video.mp4",
          mimeType: "video/mp4",
          size: 1048576,
          folderId: "fld_1",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "file.created" })
      );
    });

    it("should handle file.moved event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "file.moved",
        eventId: "evt_6",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          oldFolderId: "fld_1",
          newFolderId: "fld_2",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "file.moved" })
      );
    });

    it("should handle file.updated event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "file.updated",
        eventId: "evt_7",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          changes: { name: "renamed.mp4" },
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "file.updated" })
      );
    });

    it("should handle file.status_changed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "file.status_changed",
        eventId: "evt_8",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          oldStatus: "uploading",
          newStatus: "ready",
          changedBy: "usr_1",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "file.status_changed" })
      );
    });

    it("should handle upload.progress event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "upload.progress",
        eventId: "evt_9",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          bytesUploaded: 500000,
          bytesTotal: 1000000,
          percentage: 50,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "upload.progress" })
      );
    });

    it("should handle processing.started event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "processing.started",
        eventId: "evt_10",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          jobType: "thumbnail",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "processing.started" })
      );
    });

    it("should handle processing.progress event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "processing.progress",
        eventId: "evt_11",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          jobType: "transcode",
          percentage: 75,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "processing.progress" })
      );
    });

    it("should handle processing.completed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "processing.completed",
        eventId: "evt_12",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          jobType: "filmstrip",
          outputUrls: { filmstrip: "https://example.com/filmstrip.jpg" },
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "processing.completed" })
      );
    });

    it("should handle processing.failed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "processing.failed",
        eventId: "evt_13",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          jobType: "metadata",
          errorMessage: "Failed to extract metadata",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "processing.failed" })
      );
    });

    it("should handle transcription.completed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "transcription.completed",
        eventId: "evt_14",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          language: "en",
          wordCount: 1500,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "transcription.completed" })
      );
    });

    it("should handle version.created event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "version.created",
        eventId: "evt_15",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          stackId: "stack_1",
          fileId: "file_1",
          versionNumber: 2,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "version.created" })
      );
    });

    it("should handle version.current_changed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "version.current_changed",
        eventId: "evt_16",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          stackId: "stack_1",
          oldFileId: "file_1",
          newFileId: "file_2",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "version.current_changed" })
      );
    });

    it("should handle folder.created event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "folder.created",
        eventId: "evt_17",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          folderId: "fld_1",
          name: "New Folder",
          parentId: null,
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "folder.created" })
      );
    });

    it("should handle folder.deleted event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "folder.deleted",
        eventId: "evt_18",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          folderId: "fld_1",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "folder.deleted" })
      );
    });

    it("should handle member.added event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "member.added",
        eventId: "evt_19",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          userId: "usr_2",
          permissionLevel: "edit",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "member.added" })
      );
    });

    it("should handle member.removed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "member.removed",
        eventId: "evt_20",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          userId: "usr_2",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "member.removed" })
      );
    });

    it("should handle notification.created event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "notification.created",
        eventId: "evt_21",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        data: {
          notificationId: "notif_1",
          notificationType: "comment",
          title: "New comment",
          body: "Someone commented on your file",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "notification.created" })
      );
    });

    it("should handle notification.read event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "notification.read",
        eventId: "evt_22",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        data: {
          notificationId: "notif_1",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "notification.read" })
      );
    });

    it("should handle share.viewed event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "share.viewed",
        eventId: "evt_23",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          shareId: "share_1",
          viewerName: "John Doe",
          viewerEmail: "john@example.com",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "share.viewed" })
      );
    });

    it("should handle share.downloaded event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "share.downloaded",
        eventId: "evt_24",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          shareId: "share_1",
          fileId: "file_1",
          viewerName: "Jane Doe",
          viewerEmail: "jane@example.com",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "share.downloaded" })
      );
    });

    it("should handle metadata.field_updated event", () => {
      const handler = vi.fn();
      eventBus.onEvent(handler);

      const event: RealtimeEvent = {
        type: "metadata.field_updated",
        eventId: "evt_25",
        timestamp: new Date().toISOString(),
        actorId: "usr_1",
        projectId: "prj_1",
        data: {
          fileId: "file_1",
          fieldName: "description",
          oldValue: "Old description",
          newValue: "New description",
        },
      };

      eventBus.emitEvent(event);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "metadata.field_updated" })
      );
    });
  });
});

describe("generateEventId", () => {
  it("should generate unique event IDs", () => {
    const id1 = generateEventId();
    const id2 = generateEventId();
    const id3 = generateEventId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it("should start with 'evt_' prefix", () => {
    const id = generateEventId();
    expect(id.startsWith("evt_")).toBe(true);
  });

  it("should contain timestamp", () => {
    const before = Date.now();
    const id = generateEventId();
    const after = Date.now();

    // Extract timestamp from ID
    const timestampPart = id.split("_")[1];
    const timestamp = parseInt(timestampPart, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("should have expected format", () => {
    const id = generateEventId();
    // Format: evt_{timestamp}_{random_string}
    const parts = id.split("_");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("evt");
    expect(parseInt(parts[1], 10)).not.toBeNaN();
    expect(parts[2].length).toBeGreaterThan(0);
  });
});
