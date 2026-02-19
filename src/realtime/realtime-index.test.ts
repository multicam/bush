/**
 * Tests for realtime module index exports
 */
import { describe, it, expect } from "vitest";
import {
  eventBus,
  generateEventId,
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
  wsManager,
  WsCloseCode,
} from "./index.js";
import type { EventType, ChannelType, EmitEventOptions, WebSocketData, ServerMessage } from "./index.js";

describe("realtime index exports", () => {
  describe("eventBus", () => {
    it("exports eventBus singleton", () => {
      expect(eventBus).toBeDefined();
    });
  });

  describe("generateEventId", () => {
    it("exports generateEventId function", () => {
      expect(typeof generateEventId).toBe("function");
    });

    it("generates unique IDs", () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("emit functions", () => {
    it("exports emitEvent function", () => {
      expect(typeof emitEvent).toBe("function");
    });

    it("exports emitCommentEvent function", () => {
      expect(typeof emitCommentEvent).toBe("function");
    });

    it("exports emitFileEvent function", () => {
      expect(typeof emitFileEvent).toBe("function");
    });

    it("exports emitUploadProgress function", () => {
      expect(typeof emitUploadProgress).toBe("function");
    });

    it("exports emitProcessingEvent function", () => {
      expect(typeof emitProcessingEvent).toBe("function");
    });

    it("exports emitVersionEvent function", () => {
      expect(typeof emitVersionEvent).toBe("function");
    });

    it("exports emitFolderEvent function", () => {
      expect(typeof emitFolderEvent).toBe("function");
    });

    it("exports emitNotificationEvent function", () => {
      expect(typeof emitNotificationEvent).toBe("function");
    });

    it("exports emitShareEvent function", () => {
      expect(typeof emitShareEvent).toBe("function");
    });

    it("exports emitMetadataEvent function", () => {
      expect(typeof emitMetadataEvent).toBe("function");
    });
  });

  describe("wsManager", () => {
    it("exports wsManager singleton", () => {
      expect(wsManager).toBeDefined();
    });

    it("has init method", () => {
      expect(typeof wsManager.init).toBe("function");
    });

    it("has shutdown method", () => {
      expect(typeof wsManager.shutdown).toBe("function");
    });

    it("has authenticate method", () => {
      expect(typeof wsManager.authenticate).toBe("function");
    });

    it("has register method", () => {
      expect(typeof wsManager.register).toBe("function");
    });

    it("has unregister method", () => {
      expect(typeof wsManager.unregister).toBe("function");
    });

    it("has handleMessage method", () => {
      expect(typeof wsManager.handleMessage).toBe("function");
    });

    it("has getStats method", () => {
      expect(typeof wsManager.getStats).toBe("function");
    });

    it("has generateConnectionId method", () => {
      expect(typeof wsManager.generateConnectionId).toBe("function");
    });
  });

  describe("WsCloseCode", () => {
    it("exports WsCloseCode object", () => {
      expect(WsCloseCode).toBeDefined();
    });

    it("has NORMAL close code (1000)", () => {
      expect(WsCloseCode.NORMAL).toBe(1000);
    });

    it("has AUTHENTICATION_FAILED close code (4001)", () => {
      expect(WsCloseCode.AUTHENTICATION_FAILED).toBe(4001);
    });

    it("has FORBIDDEN close code (4003)", () => {
      expect(WsCloseCode.FORBIDDEN).toBe(4003);
    });

    it("has RATE_LIMIT_EXCEEDED close code (4008)", () => {
      expect(WsCloseCode.RATE_LIMIT_EXCEEDED).toBe(4008);
    });

    it("has INVALID_MESSAGE close code (4009)", () => {
      expect(WsCloseCode.INVALID_MESSAGE).toBe(4009);
    });

    it("has TOO_MANY_CONNECTIONS close code (4029)", () => {
      expect(WsCloseCode.TOO_MANY_CONNECTIONS).toBe(4029);
    });
  });

  describe("Type exports", () => {
    it("EventType type is exported", () => {
      const types: EventType[] = [
        "file.created",
        "file.updated",
        "file.deleted",
        "comment.created",
        "comment.updated",
        "comment.deleted",
      ];
      expect(types.length).toBeGreaterThan(0);
    });

    it("ChannelType type is exported", () => {
      const channels: ChannelType[] = [
        "file",
        "project",
        "user",
        "share",
      ];
      expect(channels.length).toBeGreaterThan(0);
    });

    it("EmitEventOptions type is exported", () => {
      const options: EmitEventOptions = {
        type: "file.created",
        actorId: "user-123",
        projectId: "project-123",
        data: { fileId: "file-123" },
      };
      expect(options.type).toBe("file.created");
    });

    it("WebSocketData type is exported", () => {
      const data: WebSocketData = {
        connectionId: "conn-123",
        userId: "user-123",
        session: {} as WebSocketData["session"],
        connectedAt: new Date(),
        subscriptions: new Set(),
        messageTimestamps: [],
      };
      expect(data.connectionId).toBe("conn-123");
    });

    it("ServerMessage type is exported", () => {
      const message: ServerMessage = {
        type: "event",
        channel: "file",
        resourceId: "file-123",
        event: "file.created",
        eventId: "event-123",
        timestamp: new Date().toISOString(),
        data: {},
      };
      expect(message.type).toBe("event");
    });
  });
});
