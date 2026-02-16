/**
 * Bush Platform - Session Cache Service
 *
 * Redis-backed session cache for storing Bush-specific session data.
 * Avoids decoding JWTs on every request and stores account context.
 * Reference: specs/12-authentication.md Section "Redis Session Cache"
 */
import { getRedis } from "../redis/index.js";
import type { SessionData } from "./types.js";
import { getSessionCacheKey } from "./types.js";

// Default session TTL (7 days in seconds)
const DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * Session cache operations
 */
export const sessionCache = {
  /**
   * Store session data in Redis
   */
  async set(session: SessionData, ttlSeconds = DEFAULT_SESSION_TTL): Promise<void> {
    const redis = getRedis();
    const key = getSessionCacheKey(session.userId, session.sessionId);
    const value = JSON.stringify(session);
    await redis.setex(key, ttlSeconds, value);
  },

  /**
   * Get session data from Redis
   */
  async get(userId: string, sessionId: string): Promise<SessionData | null> {
    const redis = getRedis();
    const key = getSessionCacheKey(userId, sessionId);
    const value = await redis.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as SessionData;
  },

  /**
   * Update session data (preserves TTL)
   */
  async update(userId: string, sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    const redis = getRedis();
    const key = getSessionCacheKey(userId, sessionId);

    // Get existing session
    const existing = await this.get(userId, sessionId);
    if (!existing) {
      return false;
    }

    // Merge updates
    const updated: SessionData = {
      ...existing,
      ...updates,
      lastActivityAt: Date.now(),
    };

    // Get remaining TTL and update
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(updated));
    } else {
      // TTL expired or key doesn't exist, use default TTL
      await redis.setex(key, DEFAULT_SESSION_TTL, JSON.stringify(updated));
    }

    return true;
  },

  /**
   * Update last activity timestamp
   */
  async touch(userId: string, sessionId: string): Promise<void> {
    const existing = await this.get(userId, sessionId);
    if (existing) {
      // Only update if last activity is more than 5 minutes old
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (existing.lastActivityAt < fiveMinutesAgo) {
        await this.update(userId, sessionId, { lastActivityAt: Date.now() });
      }
    }
  },

  /**
   * Delete session from Redis
   */
  async delete(userId: string, sessionId: string): Promise<void> {
    const redis = getRedis();
    const key = getSessionCacheKey(userId, sessionId);
    await redis.del(key);
  },

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const redis = getRedis();
    const pattern = `session:${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    await redis.del(...keys);
    return keys.length;
  },

  /**
   * Get all session IDs for a user
   */
  async getSessionIds(userId: string): Promise<string[]> {
    const redis = getRedis();
    const pattern = `session:${userId}:*`;
    const keys = await redis.keys(pattern);
    // Extract session IDs from keys
    return keys.map((key) => {
      const parts = key.split(":");
      return parts[2] || "";
    }).filter(Boolean);
  },

  /**
   * Switch active account for a session
   */
  async switchAccount(
    userId: string,
    sessionId: string,
    newAccountId: string,
    newRole: string
  ): Promise<boolean> {
    return this.update(userId, sessionId, {
      currentAccountId: newAccountId,
      accountRole: newRole as SessionData["accountRole"],
    });
  },

  /**
   * Invalidate sessions when role changes
   * Call this when a user's role is updated
   */
  async invalidateOnRoleChange(userId: string, accountId: string): Promise<number> {
    const redis = getRedis();
    const pattern = `session:${userId}:*`;
    const keys = await redis.keys(pattern);
    let invalidated = 0;

    for (const key of keys) {
      const value = await redis.get(key);
      if (value) {
        const session = JSON.parse(value) as SessionData;
        if (session.currentAccountId === accountId) {
          await redis.del(key);
          invalidated++;
        }
      }
    }

    return invalidated;
  },
};

/**
 * Generate a unique session ID
 */
export async function generateSessionId(): Promise<string> {
  const crypto = await import("crypto");
  return crypto.randomBytes(32).toString("base64url");
}
