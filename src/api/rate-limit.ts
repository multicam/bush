/**
 * Bush Platform - Rate Limiting Middleware
 *
 * Redis-backed rate limiting using sliding window algorithm.
 * Reference: specs/17-api-complete.md Section 5
 * Reference: specs/00-complete-support-documentation.md Section 21.2
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import { getRedis } from "../redis/index.js";
import { config } from "../config/index.js";
import { RateLimitError } from "../errors/index.js";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Key prefix for Redis */
  keyPrefix: string;
  /** Function to extract identifier (defaults to IP) */
  keyGenerator?: (c: Context) => string;
  /** Whether to skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
  /** Custom error message */
  message?: string;
}

/**
 * Rate limit headers
 */
interface RateLimitHeaders {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Default rate limit configurations per endpoint type
 * Reference: specs/17-api-complete.md Section 5.2
 */
export const RATE_LIMIT_PRESETS = {
  /** Standard API endpoints - 100 req/min */
  standard: {
    windowMs: 60_000,
    maxRequests: 100,
  },
  /** Authentication endpoints - 10 req/min */
  auth: {
    windowMs: 60_000,
    maxRequests: 10,
  },
  /** Upload endpoints - 20 req/min */
  upload: {
    windowMs: 60_000,
    maxRequests: 20,
  },
  /** Search endpoints - 30 req/min */
  search: {
    windowMs: 60_000,
    maxRequests: 30,
  },
  /** Webhook endpoints - 1000 req/min */
  webhook: {
    windowMs: 60_000,
    maxRequests: 1000,
  },
} as const;

/**
 * Extract client identifier from request
 * Uses X-Forwarded-For header if behind a proxy, otherwise falls back to IP
 */
function getDefaultIdentifier(c: Context): string {
  // Check for forwarded header (when behind reverse proxy)
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0].trim();
  }

  // Fall back to connection remote address
  // Hono stores this in the runtime-specific location
  const addr = c.env?.incoming?.socket?.remoteAddress;
  if (addr) {
    return addr;
  }

  // Fallback for node server
  return "unknown";
}

/**
 * Check rate limit using sliding window algorithm
 * Returns headers and whether the request should be blocked
 */
async function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; headers: RateLimitHeaders }> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowMs;

  // Use Redis pipeline for atomic operations
  const pipeline = redis.pipeline();

  // Remove old entries outside the window
  pipeline.zremrangebyscore(key, "-inf", windowStart);

  // Count current entries
  pipeline.zcard(key);

  // Add current request timestamp
  pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);

  // Set expiry on the key
  pipeline.expire(key, Math.ceil(windowMs / 1000));

  const results = await pipeline.exec();

  // Get count from zcard result (index 1)
  const currentCount = (results?.[1]?.[1] as number) || 0;
  const count = currentCount + 1; // +1 for the request we're about to add

  const remaining = Math.max(0, maxRequests - count);
  const resetTime = now + windowMs;
  const retryAfter = count > maxRequests ? Math.ceil(windowMs / 1000) : undefined;

  return {
    allowed: count <= maxRequests,
    headers: {
      limit: maxRequests,
      remaining,
      reset: Math.floor(resetTime / 1000), // Unix timestamp in seconds
      retryAfter,
    },
  };
}

/**
 * Create rate limiting middleware
 *
 * @example
 * // Use preset
 * app.use('/api/*', rateLimit({ preset: 'standard' }));
 *
 * // Custom config
 * app.use('/api/auth/*', rateLimit({
 *   windowMs: 60_000,
 *   maxRequests: 10,
 *   keyPrefix: 'rl:auth'
 * }));
 */
export function rateLimit(options: Partial<RateLimitConfig> & { preset?: keyof typeof RATE_LIMIT_PRESETS } = {}): MiddlewareHandler {
  const preset = options.preset ? RATE_LIMIT_PRESETS[options.preset] : null;

  const config_: RateLimitConfig = {
    windowMs: options.windowMs ?? preset?.windowMs ?? config.RATE_LIMIT_WINDOW_MS,
    maxRequests: options.maxRequests ?? preset?.maxRequests ?? config.RATE_LIMIT_MAX_REQUESTS,
    keyPrefix: options.keyPrefix ?? "rl",
    keyGenerator: options.keyGenerator,
    skip: options.skip,
    message: options.message,
  };

  return async (c: Context, next: Next) => {
    // Skip if skip function returns true
    if (config_.skip?.(c)) {
      await next();
      return;
    }

    // Generate key
    const identifier = config_.keyGenerator?.(c) ?? getDefaultIdentifier(c);
    const path = c.req.path;
    const key = `${config_.keyPrefix}:${identifier}:${path}`;

    // Check rate limit
    const { allowed, headers } = await checkRateLimit(
      key,
      config_.windowMs,
      config_.maxRequests
    );

    // Set rate limit headers on response
    c.header("X-RateLimit-Limit", String(headers.limit));
    c.header("X-RateLimit-Remaining", String(headers.remaining));
    c.header("X-RateLimit-Reset", String(headers.reset));

    if (!allowed) {
      // Set retry-after header
      if (headers.retryAfter) {
        c.header("Retry-After", String(headers.retryAfter));
      }

      throw new RateLimitError(headers.retryAfter ?? 60);
    }

    await next();
  };
}

/**
 * Create a rate limiter for a specific preset
 */
export function createRateLimiter(preset: keyof typeof RATE_LIMIT_PRESETS) {
  return rateLimit({ preset });
}

/**
 * Standard rate limiter (100 req/min)
 */
export const standardRateLimit = createRateLimiter("standard");

/**
 * Auth rate limiter (10 req/min)
 */
export const authRateLimit = createRateLimiter("auth");

/**
 * Upload rate limiter (20 req/min)
 */
export const uploadRateLimit = createRateLimiter("upload");

/**
 * Search rate limiter (30 req/min)
 */
export const searchRateLimit = createRateLimiter("search");
