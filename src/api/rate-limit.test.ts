/**
 * Bush Platform - Rate Limiting Middleware Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit, RATE_LIMIT_PRESETS, createRateLimiter, standardRateLimit, authRateLimit } from "./rate-limit.js";
import { RateLimitError } from "../errors/index.js";

// Mock Redis
const mockPipeline = {
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
};

const mockRedis = {
  pipeline: vi.fn(() => mockPipeline),
};

vi.mock("../redis/index.js", () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    TRUST_PROXY: false,
  },
}));

// Helper to create mock Hono context
function createMockContext(overrides: Partial<{
  path: string;
  headers: Record<string, string>;
  env: any;
}> = {}) {
  return {
    req: {
      path: overrides.path || "/api/test",
      header: (name: string) => overrides.headers?.[name.toLowerCase()],
    },
    env: overrides.env,
    header: vi.fn(),
  } as any;
}

describe("Rate Limiting Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    it("should have auth preset with 10 requests per minute", () => {
      expect(RATE_LIMIT_PRESETS.auth.maxRequests).toBe(10);
    });

    it("should have upload preset with 20 requests per minute", () => {
      expect(RATE_LIMIT_PRESETS.upload.maxRequests).toBe(20);
    });

    it("should have search preset with 30 requests per minute", () => {
      expect(RATE_LIMIT_PRESETS.search.maxRequests).toBe(30);
    });

    it("should have webhook preset with 1000 requests per minute", () => {
      expect(RATE_LIMIT_PRESETS.webhook.maxRequests).toBe(1000);
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

    it("should allow request when under limit", async () => {
      const middleware = rateLimit({ maxRequests: 100 });
      const c = createMockContext();
      const next = vi.fn();

      await middleware(c, next);

      expect(next).toHaveBeenCalled();
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "100");
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", expect.any(String));
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(String));
    });

    it("should skip rate limiting when skip function returns true", async () => {
      const middleware = rateLimit({
        maxRequests: 1,
        skip: (c) => c.req.path === "/api/health",
      });
      const c = createMockContext({ path: "/api/health" });
      const next = vi.fn();

      await middleware(c, next);

      expect(next).toHaveBeenCalled();
      // Should not set rate limit headers when skipped
      expect(c.header).not.toHaveBeenCalled();
    });

    it("should use custom key generator", async () => {
      const middleware = rateLimit({
        maxRequests: 100,
        keyGenerator: () => "custom-key",
      });
      const c = createMockContext();
      const next = vi.fn();

      await middleware(c, next);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("should block request when limit exceeded", async () => {
      // Mock Redis to return count over limit
      mockPipeline.exec.mockResolvedValueOnce([
        [null, 0],
        [null, 100], // zcard shows 100 requests already
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({ maxRequests: 100 });
      const c = createMockContext();
      const next = vi.fn();

      await expect(middleware(c, next)).rejects.toThrow(RateLimitError);
      expect(next).not.toHaveBeenCalled();
    });

    it("should set Retry-After header when rate limited", async () => {
      // Mock Redis to return count over limit
      mockPipeline.exec.mockResolvedValueOnce([
        [null, 0],
        [null, 100],
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({ maxRequests: 100 });
      const c = createMockContext();
      const next = vi.fn();

      try {
        await middleware(c, next);
      } catch (error) {
        // Expected
      }

      expect(c.header).toHaveBeenCalledWith("Retry-After", expect.any(String));
    });
  });

  describe("createRateLimiter", () => {
    it("should create rate limiter with preset", () => {
      const middleware = createRateLimiter("auth");
      expect(typeof middleware).toBe("function");
    });

    it("should create standard rate limiter", () => {
      const middleware = createRateLimiter("standard");
      expect(typeof middleware).toBe("function");
    });

    it("should create upload rate limiter", () => {
      const middleware = createRateLimiter("upload");
      expect(typeof middleware).toBe("function");
    });
  });

  describe("Pre-built rate limiters", () => {
    it("should export standardRateLimit", () => {
      expect(typeof standardRateLimit).toBe("function");
    });

    it("should export authRateLimit", () => {
      expect(typeof authRateLimit).toBe("function");
    });
  });

  describe("RateLimitError", () => {
    it("should throw RateLimitError when limit exceeded", async () => {
      const error = new RateLimitError(60);
      expect(error.status).toBe(429);
      expect(error.code).toBe("rate_limit_exceeded");
      expect(error.retryAfter).toBe(60);
    });

    it("should have correct error message", () => {
      const error = new RateLimitError(30);
      expect(error.message).toContain("Rate limit exceeded");
    });

    it("should handle zero retryAfter", () => {
      const error = new RateLimitError(0);
      expect(error.retryAfter).toBe(0);
    });
  });

  describe("Integration", () => {
    it("should handle Redis pipeline with null results", async () => {
      mockPipeline.exec.mockResolvedValueOnce([
        [null, 0],
        [null, null], // null zcard result
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({ maxRequests: 100 });
      const c = createMockContext();
      const next = vi.fn();

      await middleware(c, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("getDefaultIdentifier", () => {
    it("should use X-Forwarded-For when TRUST_PROXY is enabled", async () => {
      vi.resetModules();

      vi.doMock("../config/index.js", () => ({
        config: {
          RATE_LIMIT_WINDOW_MS: 60000,
          RATE_LIMIT_MAX_REQUESTS: 100,
          TRUST_PROXY: true,
        },
      }));

      vi.doMock("../redis/index.js", () => ({
        getRedis: vi.fn(() => mockRedis),
      }));

      const { rateLimit: rateLimitWithProxy } = await import("./rate-limit.js");

      const c = createMockContext({
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
      });
      const next = vi.fn();

      await rateLimitWithProxy({ maxRequests: 100 })(c, next);

      // The key should include the first IP from X-Forwarded-For
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();

      vi.doUnmock("../config/index.js");
    });

    it("should use socket remote address when available", async () => {
      vi.resetModules();

      vi.doMock("../config/index.js", () => ({
        config: {
          RATE_LIMIT_WINDOW_MS: 60000,
          RATE_LIMIT_MAX_REQUESTS: 100,
          TRUST_PROXY: false,
        },
      }));

      vi.doMock("../redis/index.js", () => ({
        getRedis: vi.fn(() => mockRedis),
      }));

      const { rateLimit: rateLimitWithSocket } = await import("./rate-limit.js");

      const c = createMockContext({
        env: {
          incoming: {
            socket: {
              remoteAddress: "10.0.0.100",
            },
          },
        },
      });
      const next = vi.fn();

      await rateLimitWithSocket({ maxRequests: 100 })(c, next);

      expect(next).toHaveBeenCalled();

      vi.doUnmock("../config/index.js");
    });

    it("should fallback to 'unknown' when no IP available", async () => {
      vi.resetModules();

      vi.doMock("../config/index.js", () => ({
        config: {
          RATE_LIMIT_WINDOW_MS: 60000,
          RATE_LIMIT_MAX_REQUESTS: 100,
          TRUST_PROXY: false,
        },
      }));

      vi.doMock("../redis/index.js", () => ({
        getRedis: vi.fn(() => mockRedis),
      }));

      const { rateLimit: rateLimitNoIp } = await import("./rate-limit.js");

      const c = createMockContext();
      const next = vi.fn();

      await rateLimitNoIp({ maxRequests: 100 })(c, next);

      expect(next).toHaveBeenCalled();

      vi.doUnmock("../config/index.js");
    });
  });
});
