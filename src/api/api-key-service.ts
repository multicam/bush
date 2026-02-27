/**
 * Bush Platform - API Key Service
 *
 * Service for generating, validating, and managing API keys.
 * API keys use the `bush_key_` prefix followed by a 48-character base62 string.
 *
 * Reference: specs/02-authentication.md Section 10.1
 * Reference: specs/04-api-reference.md Section 2.1
 */
import { db } from "../db/index.js";
import { apiKeys, users, accountMemberships } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { hash, compare } from "bcrypt";
import { generateId } from "../shared/id.js";
import type { SessionData, AccountRole } from "../auth/types.js";

/**
 * API key prefix
 */
export const API_KEY_PREFIX = "bush_key_";

/**
 * Length of the key suffix (after prefix) - 48 characters per spec
 */
const KEY_SUFFIX_LENGTH = 48;

/**
 * Length of the key prefix stored for identification (after bush_key_)
 */
const KEY_PREFIX_LENGTH = 8;

/**
 * Base62 character set for key generation
 */
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * API key scope types
 */
export type ApiKeyScope = "read_only" | "read_write" | "admin";

/**
 * API key returned after creation (includes the plain text key once)
 */
export interface ApiKeyWithSecret {
  id: string;
  accountId: string;
  userId: string;
  name: string;
  scope: ApiKeyScope;
  keyPrefix: string;
  key: string; // Only returned on creation
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * API key data returned in listings (without the secret)
 */
export interface ApiKeyData {
  id: string;
  accountId: string;
  userId: string;
  userName: string | null;
  name: string;
  scope: ApiKeyScope;
  keyPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Generate a random base62 string of specified length
 */
function generateBase62String(length: number): string {
  const bytes = randomBytes(Math.ceil(length * 0.75));
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
  }
  return result;
}

/**
 * Generate a new API key with the bush_key_ prefix
 */
export function generateApiKey(): string {
  return API_KEY_PREFIX + generateBase62String(KEY_SUFFIX_LENGTH);
}

/**
 * Extract the identifiable prefix from an API key
 * Returns the first 8 characters after bush_key_
 */
export function extractKeyPrefix(key: string): string {
  if (!key.startsWith(API_KEY_PREFIX)) {
    throw new Error("Invalid API key format");
  }
  const suffix = key.slice(API_KEY_PREFIX.length);
  return suffix.slice(0, KEY_PREFIX_LENGTH);
}

/**
 * Hash an API key for storage
 */
export async function hashKey(key: string): Promise<string> {
  return hash(key, 10);
}

/**
 * Verify an API key against a hash
 */
export async function verifyKey(key: string, hash: string): Promise<boolean> {
  return compare(key, hash);
}

/**
 * API Key service operations
 */
export const apiKeyService = {
  /**
   * Create a new API key
   */
  async createKey(params: {
    accountId: string;
    userId: string;
    name: string;
    scope: ApiKeyScope;
    expiresAt?: Date | null;
  }): Promise<ApiKeyWithSecret> {
    // Generate the key
    const plainKey = generateApiKey();
    const keyPrefix = extractKeyPrefix(plainKey);
    const keyHash = await hashKey(plainKey);

    // Create the database record
    const id = generateId("key");
    await db.insert(apiKeys).values({
      id,
      accountId: params.accountId,
      userId: params.userId,
      name: params.name,
      keyHash,
      keyPrefix,
      scope: params.scope,
      expiresAt: params.expiresAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      id,
      accountId: params.accountId,
      userId: params.userId,
      name: params.name,
      scope: params.scope,
      keyPrefix,
      key: plainKey,
      expiresAt: params.expiresAt || null,
      createdAt: new Date(),
    };
  },

  /**
   * Validate an API key and return session data
   * Returns null if key is invalid, expired, or revoked
   */
  async validateKey(key: string): Promise<SessionData | null> {
    // Check format
    if (!key.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    // Extract prefix and look up key
    const keyPrefix = extractKeyPrefix(key);

    const results = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyPrefix, keyPrefix),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const keyRecord = results[0];

    // Check expiration
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return null;
    }

    // Verify the key hash
    const isValid = await verifyKey(key, keyRecord.keyHash);
    if (!isValid) {
      return null;
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    // Get user info
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, keyRecord.userId))
      .limit(1);

    if (userResults.length === 0) {
      return null;
    }

    const user = userResults[0];

    // Get user's role for the account
    const membershipResults = await db
      .select({ role: accountMemberships.role })
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.userId, keyRecord.userId),
          eq(accountMemberships.accountId, keyRecord.accountId)
        )
      )
      .limit(1);

    if (membershipResults.length === 0) {
      return null;
    }

    const role = membershipResults[0].role as AccountRole;

    // Create session data for the API key user
    const now = Date.now();
    const session: SessionData = {
      sessionId: `apikey:${keyRecord.id}`,
      userId: keyRecord.userId,
      email: user.email,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      currentAccountId: keyRecord.accountId,
      accountRole: role,
      workosOrganizationId: "", // API keys don't have WorkOS org
      workosUserId: "", // API keys don't have WorkOS user
      createdAt: now,
      lastActivityAt: now,
      avatarUrl: user.avatarUrl,
    };

    return session;
  },

  /**
   * List API keys for an account
   */
  async listKeys(accountId: string): Promise<ApiKeyData[]> {
    const results = await db
      .select({
        id: apiKeys.id,
        accountId: apiKeys.accountId,
        userId: apiKeys.userId,
        userName: users.firstName,
        name: apiKeys.name,
        scope: apiKeys.scope,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(eq(apiKeys.accountId, accountId))
      .orderBy(apiKeys.createdAt);

    return results.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      userId: r.userId,
      userName: r.userName,
      name: r.name,
      scope: r.scope as ApiKeyScope,
      keyPrefix: r.keyPrefix,
      lastUsedAt: r.lastUsedAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
    }));
  },

  /**
   * Get a single API key by ID
   */
  async getKey(keyId: string, accountId: string): Promise<ApiKeyData | null> {
    const results = await db
      .select({
        id: apiKeys.id,
        accountId: apiKeys.accountId,
        userId: apiKeys.userId,
        userName: users.firstName,
        name: apiKeys.name,
        scope: apiKeys.scope,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.accountId, accountId)
        )
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const r = results[0];
    return {
      id: r.id,
      accountId: r.accountId,
      userId: r.userId,
      userName: r.userName,
      name: r.name,
      scope: r.scope as ApiKeyScope,
      keyPrefix: r.keyPrefix,
      lastUsedAt: r.lastUsedAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
    };
  },

  /**
   * Revoke an API key (soft delete)
   */
  async revokeKey(keyId: string, accountId: string): Promise<boolean> {
    // Check if key exists and is not already revoked
    const existing = await this.getKey(keyId, accountId);
    if (!existing || existing.revokedAt) {
      return false;
    }

    await db
      .update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.accountId, accountId)
        )
      );

    return true;
  },

  /**
   * Delete an API key permanently
   */
  async deleteKey(keyId: string, accountId: string): Promise<boolean> {
    // Check if key exists first
    const existing = await this.getKey(keyId, accountId);
    if (!existing) {
      return false;
    }

    await db
      .delete(apiKeys)
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.accountId, accountId)
        )
      );

    return true;
  },

  /**
   * Update an API key's name or scope
   */
  async updateKey(
    keyId: string,
    accountId: string,
    updates: { name?: string; scope?: ApiKeyScope }
  ): Promise<ApiKeyData | null> {
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name) setValues.name = updates.name;
    if (updates.scope) setValues.scope = updates.scope;

    await db
      .update(apiKeys)
      .set(setValues)
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.accountId, accountId)
        )
      );

    return this.getKey(keyId, accountId);
  },

  /**
   * Get scope permissions
   * Maps API key scopes to permission levels
   */
  getScopePermissions(scope: ApiKeyScope): string[] {
    switch (scope) {
      case "admin":
        return ["read", "write", "delete", "admin"];
      case "read_write":
        return ["read", "write"];
      case "read_only":
        return ["read"];
      default:
        return [];
    }
  },
};
