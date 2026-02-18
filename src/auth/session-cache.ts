/**
 * Bush Platform - Session Cache Service
 *
 * Redis-backed session cache for storing Bush-specific session data.
 * Avoids decoding JWTs on every request and stores account context.
 * Reference: specs/12-authentication.md Section "Redis Session Cache"
 */
import { getRedis } from "../redis/index.js";
import { config } from "../config/index.js";
import type { SessionData } from "./types.js";
import { getSessionCacheKey } from "./types.js";
import crypto from "crypto";

// Default session TTL (7 days in seconds)
const DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60;

// Only update last activity if older than this threshold (5 minutes in ms)
const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Get the HMAC secret for session cookie signing
 * Uses the session secret from config
 */
function getHmacSecret(): Buffer {
  // Use SESSION_SECRET from config (must be at least 32 characters)
  const secret = config.SESSION_SECRET;
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Create HMAC signature for session cookie value
 */
function signCookieValue(data: string): string {
  const hmac = crypto.createHmac("sha256", getHmacSecret());
  hmac.update(data);
  return hmac.digest("hex");
}

/**
 * Verify HMAC signature for session cookie value
 */
function verifyCookieSignature(data: string, signature: string): boolean {
  const expectedSignature = signCookieValue(data);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Scan keys matching a pattern using SCAN instead of KEYS
 * KEYS can block Redis for long periods on large datasets
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}

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
   * IMPORTANT: Always call this with the userId from the cookie, and the returned
   * session's userId is verified to match the requested userId in getSessionWithValidation.
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
   * Get session with validation that userId in cookie matches session data.
   * This prevents session hijacking by validating the user identity.
   */
  async getWithValidation(
    cookieUserId: string,
    sessionId: string
  ): Promise<SessionData | null> {
    const session = await this.get(cookieUserId, sessionId);

    if (!session) {
      return null;
    }

    // CRITICAL: Verify that the userId in the cookie matches the userId in the session
    // This prevents attackers from using a valid sessionId with a different userId
    if (session.userId !== cookieUserId) {
      // Session mismatch - this could indicate tampering, delete the session
      await this.delete(cookieUserId, sessionId);
      return null;
    }

    return session;
  },

  /**
   * Update session data using atomic WATCH/MULTI to prevent TOCTOU race conditions
   * Also implements sliding expiration by refreshing TTL on activity
   */
  async update(userId: string, sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    const redis = getRedis();
    const key = getSessionCacheKey(userId, sessionId);

    // Use WATCH for optimistic locking to prevent race conditions
    // If the key changes between WATCH and EXEC, the transaction fails
    let retries = 3;
    while (retries > 0) {
      try {
        // Watch the key for changes
        await redis.watch(key);

        // Get existing session
        const existing = await this.get(userId, sessionId);
        if (!existing) {
          await redis.unwatch();
          return false;
        }

        // Merge updates
        const updated: SessionData = {
          ...existing,
          ...updates,
          lastActivityAt: Date.now(),
        };

        // Execute atomic update with sliding expiration
        const multi = redis.multi();
        multi.setex(key, DEFAULT_SESSION_TTL, JSON.stringify(updated));
        const results = await multi.exec();

        // If exec returns null, the transaction was aborted due to concurrent modification
        if (!results) {
          retries--;
          continue;
        }

        return true;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error("[session-cache] Update failed after retries:", error);
          return false;
        }
      }
    }

    return false;
  },

  /**
   * Update last activity timestamp
   */
  async touch(userId: string, sessionId: string): Promise<void> {
    const existing = await this.get(userId, sessionId);
    if (existing) {
      // Only update if last activity is more than 5 minutes old
      const fiveMinutesAgo = Date.now() - TOUCH_THROTTLE_MS;
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
    const pattern = `session:${userId}:*`;
    const keys = await scanKeys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    const redis = getRedis();
    await redis.del(...keys);
    return keys.length;
  },

  /**
   * Get all session IDs for a user
   */
  async getSessionIds(userId: string): Promise<string[]> {
    const pattern = `session:${userId}:*`;
    const keys = await scanKeys(pattern);
    // Extract session IDs from keys
    return keys.map((key: string) => {
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
    const keys = await scanKeys(pattern);
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

/**
 * Session cookie name
 */
export const SESSION_COOKIE_NAME = "bush_session";

/**
 * Create a signed session cookie value
 * Format: base64(JSON{userId, sessionId}).signature
 */
export function createSignedCookieValue(userId: string, sessionId: string): string {
  const data = JSON.stringify({ userId, sessionId });
  const encoded = Buffer.from(data).toString("base64url");
  const signature = signCookieValue(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Parse session from cookie header with integrity verification
 * Returns userId and sessionId if valid session cookie exists
 *
 * Security: Uses HMAC signature to verify cookie hasn't been tampered with
 */
export function parseSessionCookie(cookieHeader: string): { userId: string; sessionId: string } | null {
  // Parse cookies from header
  const cookies = cookieHeader.split(";").map(c => c.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const value = cookie.slice(SESSION_COOKIE_NAME.length + 1);

      // Try signed format first (new secure format)
      // Format: base64(JSON{userId, sessionId}).signature
      const signedParts = value.split(".");
      if (signedParts.length === 2) {
        const [encoded, signature] = signedParts;

        // Verify HMAC signature
        if (verifyCookieSignature(encoded, signature)) {
          try {
            const decoded = Buffer.from(encoded, "base64url").toString();
            const parsed = JSON.parse(decoded) as Record<string, unknown>;
            if (parsed.userId && parsed.sessionId) {
              return {
                userId: parsed.userId as string,
                sessionId: parsed.sessionId as string,
              };
            }
          } catch {
            // Invalid base64 or JSON, fall through to legacy format
          }
        }
        // If signature verification fails, don't fall through to legacy format
        // as it could be a tampering attempt
        continue;
      }

      // Legacy format support (unsigned, for backward compatibility during migration)
      // WARNING: This should be removed after migration period
      // Try base64-encoded JSON format (set by Next.js auth callback)
      try {
        const decoded = Buffer.from(value, "base64").toString();
        const parsed = JSON.parse(decoded) as Record<string, unknown>;
        if (parsed.userId && parsed.sessionId) {
          // Log warning about legacy cookie format
          console.warn(
            "[session] Legacy unsigned cookie format detected. " +
            "Session will be migrated to signed format on next refresh."
          );
          return {
            userId: parsed.userId as string,
            sessionId: parsed.sessionId as string,
          };
        }
      } catch {
        // Not base64 JSON, try plain format below
      }

      // Plain format: {userId}:{sessionId}
      // WARNING: This is the least secure format and should be migrated
      const parts = value.split(":");
      if (parts.length === 2) {
        console.warn(
          "[session] Legacy plain cookie format detected. " +
          "Session will be migrated to signed format on next refresh."
        );
        return {
          userId: parts[0],
          sessionId: parts[1],
        };
      }

      break;
    }
  }

  return null;
}
