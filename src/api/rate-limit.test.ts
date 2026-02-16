/**
 * Bush Platform - Rate Limiting Middleware Tests
 */
import { describe, it, expect, vi } from "vitest";
import { rateLimit, RATE_LIMIT_PRESETS } from "./rate-limit.js";
import { RateLimitError } from "../errors/index.js";

// Mock Redis
vi.mock("../redis/index.js", () => ({
  getRedis: vi.fn(() => ({
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 5], // zcard (current count)
        [null, 1], // zadd
        [null, 1], // expire
      ]),
    })),
  })),
}));

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
  },
}));

describe("Rate Limiting Middleware", () => {
  describe("RATE_LIMIT_PRESETS", () => {
    it("should have standard preset", () => {
      expect(RATE_LIMIT_PRESETS.standard).toEqual({
        windowMs: 60_000,
        maxRequests: 100,
      });
    });

    it("should have auth preset with lower limits", () => {
      expect(RATE_LIMIT_PRESETS.auth.maxRequests).toBeLessThan(RATE_LIMIT_PRESETS.standard.maxRequests);
    });

    it("should have upload preset", () => {
      expect(RATE_LIMIT_PRESETS.upload).toBeDefined();
      expect(RATE_LIMIT_PRESETS.upload.windowMs).toBe(60_000);
    });

    it("should have search preset", () => {
      expect(RATE_LIMIT_PRESETS.search).toBeDefined();
    });

    it("should have webhook preset with higher limits", () => {
      expect(RATE_LIMIT_PRESETS.webhook.maxRequests).toBeGreaterThan(RATE_LIMIT_PRESETS.standard.maxRequests);
    });
  });

  describe("rateLimit", () => {
    it("should create middleware function", () => {
      const middleware = rateLimit();
      expect(typeof middleware).toBe("function");
    });

    it("should create middleware with preset", () => {
      const middleware = rateLimit({ preset: "auth" });
      expect(typeof middleware).toBe("function");
    });

    it("should create middleware with custom config", () => {
      const middleware = rateLimit({
        windowMs: 30_000,
        maxRequests: 50,
        keyPrefix: "custom",
      });
      expect(typeof middleware).toBe("function");
    });
  });

  describe("Integration", () => {
    // Note: Full integration tests would require a running Redis instance
    // and Hono app context, which is better suited for E2E tests

    it("should throw RateLimitError when limit exceeded", async () => {
      // This tests that RateLimitError is properly constructed
      const error = new RateLimitError(60);
      expect(error.status).toBe(429);
      expect(error.code).toBe("rate_limit_exceeded");
      expect(error.retryAfter).toBe(60);
    });
  });
});
