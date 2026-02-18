/**
 * Bush Platform - Redis Client
 *
 * Redis client for caching, sessions, rate limiting, and pub/sub.
 * Uses ioredis for Redis connectivity.
 */
import Redis from "ioredis";
import { config } from "../config/index.js";

// Singleton Redis client instance
let _redis: Redis | null = null;

// Flag to prevent concurrent initialization
let _isInitializing = false;

/**
 * Get the Redis client instance
 * Creates the client lazily on first access (thread-safe)
 */
export function getRedis(): Redis {
  // Double-check pattern for thread-safe lazy initialization
  if (_redis) {
    return _redis;
  }

  // Prevent concurrent initialization
  if (_isInitializing) {
    // Spin-wait until initialization completes
    // In JavaScript's single-threaded event loop, this won't actually block
    // but it ensures we don't create multiple clients
    throw new Error("[Redis] Client is being initialized. Call getRedis() after initialization completes.");
  }

  _isInitializing = true;

  try {
    _redis = new Redis(config.REDIS_URL, {
      keyPrefix: config.REDIS_KEY_PREFIX,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error("[Redis] Connection failed after 3 retries");
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    _redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });

    _redis.on("connect", () => {
      if (config.NODE_ENV !== "test") {
        console.log("[Redis] Connected");
      }
    });
  } finally {
    _isInitializing = false;
  }

  return _redis;
}

/**
 * Close the Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

/**
 * Check Redis health
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

// Export the Redis client getter as default
export default getRedis;
