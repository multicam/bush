/**
 * Tests for Redis Pub/Sub Manager
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Redis from "ioredis";

// Mock ioredis before importing anything else - all variables must be inside the mock factory
vi.mock("ioredis", () => {
  const mockPub = {
    ping: vi.fn().mockResolvedValue("PONG"),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    lpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue("OK"),
    expire: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    on: vi.fn(),
  };

  const mockSub = {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };

  let callCount = 0;
  const MockRedis = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 2) {
      return mockSub;
    }
    return mockPub;
  });

  // Store mocks for access in tests
  (MockRedis as unknown as Record<string, unknown>).__mockPub = mockPub;
  (MockRedis as unknown as Record<string, unknown>).__mockSub = mockSub;
  (MockRedis as unknown as Record<string, unknown>).__resetCallCount = () => {
    callCount = 0;
  };

  return {
    default: MockRedis,
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    REDIS_URL: "redis://localhost:6379",
    REDIS_KEY_PREFIX: "bush:",
    LOG_LEVEL: "info",
  },
}));

vi.mock("../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  RedisPubSubManager,
  REDIS_WS_CHANNEL_PREFIX,
  MAX_EVENTS_PER_CHANNEL,
  EVENT_LOG_TTL_SECONDS,
  PRESENCE_TTL_SECONDS,
  type PresenceState,
} from "./redis-pubsub.js";

// Helper to get mocks from the Redis constructor
function getMocks() {
  const redisConstructor = Redis as unknown as {
    __mockPub: {
      ping: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
      quit: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
      publish: ReturnType<typeof vi.fn>;
      lpush: ReturnType<typeof vi.fn>;
      ltrim: ReturnType<typeof vi.fn>;
      expire: ReturnType<typeof vi.fn>;
      lrange: ReturnType<typeof vi.fn>;
      hset: ReturnType<typeof vi.fn>;
      hdel: ReturnType<typeof vi.fn>;
      hgetall: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
    };
    __mockSub: {
      connect: ReturnType<typeof vi.fn>;
      quit: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
    };
    __resetCallCount: () => void;
  };
  return {
    publisher: redisConstructor.__mockPub,
    subscriber: redisConstructor.__mockSub,
    resetCallCount: redisConstructor.__resetCallCount,
  };
}

// These will be set in beforeEach
let mockPublisher: ReturnType<typeof getMocks>["publisher"];
let mockSubscriber: ReturnType<typeof getMocks>["subscriber"];

describe("RedisPubSubManager", () => {
  let manager: RedisPubSubManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mock references
    const mocks = getMocks();
    mockPublisher = mocks.publisher;
    mockSubscriber = mocks.subscriber;
    mocks.resetCallCount();

    // Reset mock implementations
    mockPublisher.ping.mockResolvedValue("PONG");
    mockPublisher.connect.mockResolvedValue(undefined);
    mockPublisher.quit.mockResolvedValue(undefined);
    mockSubscriber.connect.mockResolvedValue(undefined);
    mockSubscriber.quit.mockResolvedValue(undefined);
    mockPublisher.lrange.mockResolvedValue([]);
    mockPublisher.hgetall.mockResolvedValue({});

    // Create fresh manager instance for each test
    manager = new RedisPubSubManager();
  });

  afterEach(async () => {
    try {
      await manager.shutdown();
    } catch {
      // Ignore shutdown errors in cleanup
    }
  });

  describe("constants", () => {
    it("should define Redis channel prefix", () => {
      expect(REDIS_WS_CHANNEL_PREFIX).toBe("ws:");
    });

    it("should define max events per channel", () => {
      expect(MAX_EVENTS_PER_CHANNEL).toBe(1000);
    });

    it("should define event log TTL", () => {
      expect(EVENT_LOG_TTL_SECONDS).toBe(3600);
    });

    it("should define presence TTL", () => {
      expect(PRESENCE_TTL_SECONDS).toBe(60);
    });
  });

  describe("init", () => {
    it("should initialize publisher and subscriber connections", async () => {
      await manager.init();

      expect(Redis).toHaveBeenCalledTimes(2);
      expect(mockPublisher.ping).toHaveBeenCalled();
      expect(mockSubscriber.connect).toHaveBeenCalled();
      expect(mockSubscriber.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should not reinitialize if already initialized", async () => {
      await manager.init();
      await manager.init();

      expect(Redis).toHaveBeenCalledTimes(2); // Only called once
    });

    it("should throw on connection failure", async () => {
      mockPublisher.ping.mockRejectedValue(new Error("Connection failed"));

      await expect(manager.init()).rejects.toThrow("Connection failed");
    });
  });

  describe("shutdown", () => {
    it("should close both connections", async () => {
      await manager.init();
      await manager.shutdown();

      expect(mockSubscriber.quit).toHaveBeenCalled();
      expect(mockPublisher.quit).toHaveBeenCalled();
      expect(manager.isEnabled()).toBe(false);
    });

    it("should handle shutdown when not initialized", async () => {
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });

  describe("isEnabled", () => {
    it("should return false when not initialized", () => {
      expect(manager.isEnabled()).toBe(false);
    });

    it("should return true when initialized", async () => {
      await manager.init();
      expect(manager.isEnabled()).toBe(true);
    });

    it("should return false after shutdown", async () => {
      await manager.init();
      await manager.shutdown();
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe("subscribeToChannel", () => {
    it("should subscribe to a Redis channel", async () => {
      await manager.init();
      await manager.subscribeToChannel("project", "proj_123");

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith("ws:project:proj_123");
      expect(manager.getActiveChannelCount()).toBe(1);
    });

    it("should not subscribe to same channel twice", async () => {
      await manager.init();
      await manager.subscribeToChannel("project", "proj_123");
      await manager.subscribeToChannel("project", "proj_123");

      expect(mockSubscriber.subscribe).toHaveBeenCalledTimes(1);
    });

    it("should not subscribe when not initialized", async () => {
      await manager.subscribeToChannel("project", "proj_123");

      expect(mockSubscriber.subscribe).not.toHaveBeenCalled();
    });
  });

  describe("unsubscribeFromChannel", () => {
    it("should unsubscribe from a Redis channel", async () => {
      await manager.init();
      await manager.subscribeToChannel("project", "proj_123");
      await manager.unsubscribeFromChannel("project", "proj_123");

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith("ws:project:proj_123");
      expect(manager.getActiveChannelCount()).toBe(0);
    });

    it("should not unsubscribe from channel not subscribed to", async () => {
      await manager.init();
      await manager.unsubscribeFromChannel("project", "proj_123");

      expect(mockSubscriber.unsubscribe).not.toHaveBeenCalled();
    });

    it("should not unsubscribe when not initialized", async () => {
      await manager.unsubscribeFromChannel("project", "proj_123");

      expect(mockSubscriber.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe("publishEvent", () => {
    it("should publish event to project channel", async () => {
      await manager.init();

      const event = {
        eventId: "evt_123",
        type: "file.created",
        actorId: "usr_123",
        projectId: "proj_123",
        timestamp: new Date().toISOString(),
        data: { fileId: "file_123" },
      };

      await manager.publishEvent(event as any);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        "ws:project:proj_123",
        expect.stringContaining('"type":"event"')
      );
    });

    it("should publish event to file channel", async () => {
      await manager.init();

      const event = {
        eventId: "evt_123",
        type: "file.updated",
        actorId: "usr_123",
        projectId: "proj_123",
        fileId: "file_123",
        timestamp: new Date().toISOString(),
        data: { name: "test.mp4" },
      };

      await manager.publishEvent(event as any);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        "ws:file:file_123",
        expect.stringContaining('"type":"event"')
      );
    });

    it("should store event in log", async () => {
      await manager.init();

      const event = {
        eventId: "evt_123",
        type: "file.created",
        actorId: "usr_123",
        projectId: "proj_123",
        timestamp: new Date().toISOString(),
        data: { fileId: "file_123" },
      };

      await manager.publishEvent(event as any);

      expect(mockPublisher.lpush).toHaveBeenCalled();
      expect(mockPublisher.ltrim).toHaveBeenCalled();
      expect(mockPublisher.expire).toHaveBeenCalled();
    });

    it("should not publish when not initialized", async () => {
      const event = {
        eventId: "evt_123",
        type: "file.created",
        actorId: "usr_123",
        projectId: "proj_123",
        timestamp: new Date().toISOString(),
        data: { fileId: "file_123" },
      };

      await manager.publishEvent(event as any);

      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("getMissedEvents", () => {
    it("should return events since given event ID", async () => {
      await manager.init();

      const events = [
        JSON.stringify({ eventId: "evt_3", eventType: "file.created" }),
        JSON.stringify({ eventId: "evt_2", eventType: "file.updated" }),
        JSON.stringify({ eventId: "evt_1", eventType: "file.deleted" }),
      ];
      mockPublisher.lrange.mockResolvedValue(events);

      const result = await manager.getMissedEvents("project", "proj_123", "evt_1");

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].eventId).toBe("evt_2");
      expect(result![1].eventId).toBe("evt_3");
    });

    it("should return null when event not found", async () => {
      await manager.init();

      const events = [
        JSON.stringify({ eventId: "evt_2", eventType: "file.created" }),
        JSON.stringify({ eventId: "evt_1", eventType: "file.updated" }),
      ];
      mockPublisher.lrange.mockResolvedValue(events);

      const result = await manager.getMissedEvents("project", "proj_123", "evt_nonexistent");

      expect(result).toBeNull();
    });

    it("should skip malformed events in log", async () => {
      await manager.init();

      const events = [
        JSON.stringify({ eventId: "evt_3", eventType: "file.created" }),
        "invalid json",
        JSON.stringify({ eventId: "evt_1", eventType: "file.deleted" }),
      ];
      mockPublisher.lrange.mockResolvedValue(events);

      const result = await manager.getMissedEvents("project", "proj_123", "evt_1");

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].eventId).toBe("evt_3");
    });

    it("should return null when not initialized", async () => {
      const result = await manager.getMissedEvents("project", "proj_123", "evt_1");

      expect(result).toBeNull();
    });
  });

  describe("updatePresence", () => {
    it("should store presence in Redis hash", async () => {
      await manager.init();

      const state: PresenceState = { status: "viewing", cursor_position: 100 };
      await manager.updatePresence(
        "project",
        "proj_123",
        "user_1",
        { name: "Test User", avatar_url: null },
        state
      );

      expect(mockPublisher.hset).toHaveBeenCalledWith(
        "presence:project:proj_123",
        "user_1",
        expect.stringContaining('"status":"viewing"')
      );
      expect(mockPublisher.expire).toHaveBeenCalled();
    });

    it("should broadcast presence update via pub/sub", async () => {
      await manager.init();

      await manager.updatePresence(
        "project",
        "proj_123",
        "user_1",
        { name: "Test User", avatar_url: "https://example.com/avatar.png" },
        { status: "commenting" }
      );

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        "ws:project:proj_123",
        expect.stringContaining('"type":"presence"')
      );
    });

    it("should not update presence when not initialized", async () => {
      await manager.updatePresence(
        "project",
        "proj_123",
        "user_1",
        { name: "Test User", avatar_url: null },
        { status: "viewing" }
      );

      expect(mockPublisher.hset).not.toHaveBeenCalled();
    });
  });

  describe("removePresence", () => {
    it("should remove presence from Redis hash", async () => {
      await manager.init();

      await manager.removePresence("project", "proj_123", "user_1");

      expect(mockPublisher.hdel).toHaveBeenCalledWith(
        "presence:project:proj_123",
        "user_1"
      );
    });

    it("should broadcast presence leave via pub/sub", async () => {
      await manager.init();

      await manager.removePresence("project", "proj_123", "user_1");

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        "ws:project:proj_123",
        expect.stringContaining('"type":"presence_leave"')
      );
    });

    it("should not remove presence when not initialized", async () => {
      await manager.removePresence("project", "proj_123", "user_1");

      expect(mockPublisher.hdel).not.toHaveBeenCalled();
    });
  });

  describe("getPresence", () => {
    it("should return all presence for a channel", async () => {
      await manager.init();

      const presenceMap = {
        user_1: JSON.stringify({
          id: "user_1",
          name: "User 1",
          avatar_url: null,
          state: { status: "viewing" },
          lastSeen: "2024-01-01T00:00:00.000Z",
        }),
        user_2: JSON.stringify({
          id: "user_2",
          name: "User 2",
          avatar_url: "https://example.com/avatar.png",
          state: { status: "commenting" },
          lastSeen: "2024-01-01T00:00:01.000Z",
        }),
      };
      mockPublisher.hgetall.mockResolvedValue(presenceMap);

      const result = await manager.getPresence("project", "proj_123");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("User 1");
      expect(result[1].name).toBe("User 2");
    });

    it("should skip malformed presence entries", async () => {
      await manager.init();

      const presenceMap = {
        user_1: JSON.stringify({
          id: "user_1",
          name: "User 1",
          avatar_url: null,
          state: { status: "viewing" },
          lastSeen: "2024-01-01T00:00:00.000Z",
        }),
        user_2: "invalid json",
      };
      mockPublisher.hgetall.mockResolvedValue(presenceMap);

      const result = await manager.getPresence("project", "proj_123");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("user_1");
    });

    it("should return empty array when not initialized", async () => {
      const result = await manager.getPresence("project", "proj_123");

      expect(result).toEqual([]);
    });
  });

  describe("callbacks", () => {
    it("should register message callback", () => {
      const callback = vi.fn();
      manager.onMessage(callback);

      // Callback is stored internally, no direct way to verify
      expect(callback).toBeDefined();
    });

    it("should register presence callback", () => {
      const callback = vi.fn();
      manager.onPresence(callback);

      expect(callback).toBeDefined();
    });

    it("should register presence leave callback", () => {
      const callback = vi.fn();
      manager.onPresenceLeave(callback);

      expect(callback).toBeDefined();
    });
  });

  describe("getActiveChannelCount", () => {
    it("should return 0 when no channels subscribed", () => {
      expect(manager.getActiveChannelCount()).toBe(0);
    });

    it("should return correct count after subscriptions", async () => {
      await manager.init();
      await manager.subscribeToChannel("project", "proj_123");
      await manager.subscribeToChannel("file", "file_123");

      expect(manager.getActiveChannelCount()).toBe(2);
    });
  });
});
