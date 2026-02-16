/**
 * Bush Platform - Authentication Service
 *
 * High-level authentication operations that integrate WorkOS with Bush.
 * Reference: specs/12-authentication.md
 */
import { db } from "../db/index.js";
import { accounts, users, accountMemberships } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { sessionCache, generateSessionId } from "./session-cache.js";
import type { SessionData, AccountRole } from "./types.js";

/**
 * User info returned from WorkOS after authentication
 */
export interface WorkOSUserInfo {
  workosUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  organizationId: string;
}

/**
 * Authentication service operations
 */
export const authService = {
  /**
   * Find or create a Bush user from WorkOS user info
   */
  async findOrCreateUser(workosUser: WorkOSUserInfo): Promise<{
    userId: string;
    isNewUser: boolean;
  }> {
    // Check if user exists by WorkOS ID
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.workosUserId, workosUser.workosUserId))
      .limit(1);

    if (existingUsers.length > 0) {
      // Update user info if needed
      const user = existingUsers[0];
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (workosUser.firstName && workosUser.firstName !== user.firstName) {
        updates.firstName = workosUser.firstName;
      }
      if (workosUser.lastName && workosUser.lastName !== user.lastName) {
        updates.lastName = workosUser.lastName;
      }
      if (workosUser.avatarUrl && workosUser.avatarUrl !== user.avatarUrl) {
        updates.avatarUrl = workosUser.avatarUrl;
      }

      if (Object.keys(updates).length > 1) {
        await db
          .update(users)
          .set(updates)
          .where(eq(users.id, user.id));
      }

      return { userId: user.id, isNewUser: false };
    }

    // Create new user
    const newUserId = generateId("usr");
    await db.insert(users).values({
      id: newUserId,
      workosUserId: workosUser.workosUserId,
      email: workosUser.email,
      firstName: workosUser.firstName || null,
      lastName: workosUser.lastName || null,
      avatarUrl: workosUser.avatarUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { userId: newUserId, isNewUser: true };
  },

  /**
   * Get user's accounts and memberships
   */
  async getUserAccounts(userId: string): Promise<Array<{
    accountId: string;
    accountName: string;
    accountSlug: string;
    role: AccountRole;
  }>> {
    const results = await db
      .select({
        accountId: accounts.id,
        accountName: accounts.name,
        accountSlug: accounts.slug,
        role: accountMemberships.role,
      })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accountMemberships.accountId, accounts.id))
      .where(eq(accountMemberships.userId, userId));

    return results.map((r) => ({
      accountId: r.accountId,
      accountName: r.accountName,
      accountSlug: r.accountSlug,
      role: r.role as AccountRole,
    }));
  },

  /**
   * Get user's role for a specific account
   */
  async getUserRole(userId: string, accountId: string): Promise<AccountRole | null> {
    const results = await db
      .select({ role: accountMemberships.role })
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.userId, userId),
          eq(accountMemberships.accountId, accountId)
        )
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return results[0].role as AccountRole;
  },

  /**
   * Create a session for an authenticated user
   */
  async createSession(
    userId: string,
    accountId: string,
    workosOrganizationId: string,
    workosUserId: string
  ): Promise<SessionData> {
    // Get user info
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResults.length === 0) {
      throw new Error("User not found");
    }

    const user = userResults[0];

    // Get user's role for this account
    const role = await this.getUserRole(userId, accountId);
    if (!role) {
      throw new Error("User is not a member of this account");
    }

    // Create session
    const sessionId = await generateSessionId();
    const now = Date.now();

    const session: SessionData = {
      sessionId,
      userId,
      email: user.email,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      currentAccountId: accountId,
      accountRole: role,
      workosOrganizationId,
      workosUserId,
      createdAt: now,
      lastActivityAt: now,
      avatarUrl: user.avatarUrl,
    };

    // Cache in Redis
    await sessionCache.set(session);

    return session;
  },

  /**
   * Get session from cache
   */
  async getSession(userId: string, sessionId: string): Promise<SessionData | null> {
    return sessionCache.get(userId, sessionId);
  },

  /**
   * Invalidate session (logout)
   */
  async invalidateSession(userId: string, sessionId: string): Promise<void> {
    await sessionCache.delete(userId, sessionId);
  },

  /**
   * Invalidate all sessions for a user (force logout all devices)
   */
  async invalidateAllSessions(userId: string): Promise<number> {
    return sessionCache.deleteAllForUser(userId);
  },

  /**
   * Switch active account
   */
  async switchAccount(
    userId: string,
    sessionId: string,
    newAccountId: string
  ): Promise<SessionData | null> {
    // Verify user is a member of the new account
    const role = await this.getUserRole(userId, newAccountId);
    if (!role) {
      throw new Error("User is not a member of this account");
    }

    // Get current session to preserve WorkOS info
    const currentSession = await sessionCache.get(userId, sessionId);
    if (!currentSession) {
      return null;
    }

    // Update session with new account
    const success = await sessionCache.switchAccount(
      userId,
      sessionId,
      newAccountId,
      role
    );

    if (!success) {
      return null;
    }

    // Return updated session
    return sessionCache.get(userId, sessionId);
  },

  /**
   * Check if user has required role for an operation
   */
  async checkPermission(
    userId: string,
    accountId: string,
    requiredRole: AccountRole
  ): Promise<boolean> {
    const role = await this.getUserRole(userId, accountId);
    if (!role) {
      return false;
    }

    // Role hierarchy: owner > content_admin > member > guest > reviewer
    const roleHierarchy: AccountRole[] = [
      "reviewer",
      "guest",
      "member",
      "content_admin",
      "owner",
    ];

    const userRoleIndex = roleHierarchy.indexOf(role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    return userRoleIndex >= requiredRoleIndex;
  },
};

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix: string): string {
  const crypto = require("crypto");
  const hash = crypto.randomBytes(16).toString("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}
