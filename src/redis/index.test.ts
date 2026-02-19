/**
 * Bush Platform - Redis Client Tests
 *
 * Unit tests for Redis client singleton and health check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ioredis
const mockRedis = {
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
  ping: vi.fn().mockResolvedValue("PONG"),
};

vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => mockRedis),
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    REDIS_URL: "redis://localhost:6379",
    REDIS_KEY_PREFIX: "bush:",
    NODE_ENV: "test",
  },
}));

describe("Redis Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton between tests by reimporting
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getRedis", () => {
    it("should create a Redis client with correct options", async () => {
      // Reimport to get fresh module state
      const { getRedis: freshGetRedis } = await import("./index.js");
      const redis = freshGetRedis();

      expect(redis).toBeDefined();
      expect(redis.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(redis.on).toHaveBeenCalledWith("connect", expect.any(Function));
    });

    it("should return the same instance on multiple calls", async () => {
      const { getRedis: freshGetRedis } = await import("./index.js");
      const redis1 = freshGetRedis();
      const redis2 = freshGetRedis();

      expect(redis1).toBe(redis2);
    });

    it("should not log in test environment", async () => {
      const { getRedis: freshGetRedis } = await import("./index.js");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      freshGetRedis();

      // Find the connect callback and call it
      const connectCall = mockRedis.on.mock.calls.find(
        (call: any[]) => call[0] === "connect"
      );
      if (connectCall) {
        connectCall[1](); // Call the connect handler
      }

      // Should not log in test environment
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("closeRedis", () => {
    it("should call quit on the Redis client", async () => {
      const { getRedis: freshGetRedis, closeRedis: freshCloseRedis } = await import("./index.js");

      // First get the client to initialize it
      freshGetRedis();

      await freshCloseRedis();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it("should do nothing if client not initialized", async () => {
      const { closeRedis: freshCloseRedis } = await import("./index.js");

      // Should not throw
      await expect(freshCloseRedis()).resolves.toBeUndefined();
    });
  });

  describe("redisHealthCheck", () => {
    it("should return true when ping succeeds", async () => {
      mockRedis.ping.mockResolvedValueOnce("PONG");
      const { getRedis: freshGetRedis, redisHealthCheck: freshHealthCheck } = await import("./index.js");

      // Initialize client first
      freshGetRedis();
      const result = await freshHealthCheck();

      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it("should return false when ping throws", async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error("Connection refused"));
      const { getRedis: freshGetRedis, redisHealthCheck: freshHealthCheck } = await import("./index.js");

      // Initialize client first
      freshGetRedis();
      const result = await freshHealthCheck();

      expect(result).toBe(false);
    });

    it("should return false when ping returns unexpected response", async () => {
      mockRedis.ping.mockResolvedValueOnce("UNEXPECTED");
      const { getRedis: freshGetRedis, redisHealthCheck: freshHealthCheck } = await import("./index.js");

      // Initialize client first
      freshGetRedis();
      const result = await freshHealthCheck();

      expect(result).toBe(false);
    });
  });

  describe("default export", () => {
    it("should export getRedis as default", async () => {
      const freshModule = await import("./index.js");
      const defaultExport = freshModule.default;

      expect(defaultExport).toBe(freshModule.getRedis);
    });
  });
});
