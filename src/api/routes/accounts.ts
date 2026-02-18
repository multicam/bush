/**
 * Bush Platform - Account Routes
 *
 * API routes for account management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { accounts, accountMemberships, users } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyAccountMembership } from "../access-control.js";
import { getEmailService } from "../../lib/email/index.js";
import { sessionCache } from "../../auth/session-cache.js";
import type { AccountRole } from "../../auth/types.js";

const app = new Hono();

// Apply authentication to all routes (rate limiting applied at v4 router level)
app.use("*", authMiddleware());

/**
 * GET /v4/accounts - List accounts for current user
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const limit = parseLimit(c.req.query("limit"));

  // Get all accounts the user is a member of
  const memberships = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      slug: accounts.slug,
      plan: accounts.plan,
      storageQuotaBytes: accounts.storageQuotaBytes,
      storageUsedBytes: accounts.storageUsedBytes,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .innerJoin(accounts, eq(accountMemberships.accountId, accounts.id))
    .where(eq(accountMemberships.userId, session.userId))
    .limit(limit);

  const items = memberships.map((m) => ({
    ...formatDates(m),
    role: m.role,
  }));

  return sendCollection(c, items, RESOURCE_TYPES.ACCOUNT, {
    basePath: "/v4/accounts",
    limit,
    totalCount: items.length,
  });
});

/**
 * GET /v4/accounts/:id - Get account by ID
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");

  // Verify user is a member of this account
  const membership = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      slug: accounts.slug,
      plan: accounts.plan,
      storageQuotaBytes: accounts.storageQuotaBytes,
      storageUsedBytes: accounts.storageUsedBytes,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .innerJoin(accounts, eq(accountMemberships.accountId, accounts.id))
    .where(
      and(
        eq(accountMemberships.userId, session.userId),
        eq(accountMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (membership.length === 0) {
    throw new NotFoundError("account", accountId);
  }

  const account = membership[0];
  return sendSingle(c, formatDates(account), RESOURCE_TYPES.ACCOUNT);
});

/**
 * POST /v4/accounts - Create a new account
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("Account name is required", { pointer: "/data/attributes/name" });
  }

  if (!body.slug || typeof body.slug !== "string") {
    throw new ValidationError("Account slug is required", { pointer: "/data/attributes/slug" });
  }

  // Check if slug is already taken
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.slug, body.slug))
    .limit(1);

  if (existing.length > 0) {
    throw new ValidationError("Account slug is already taken", { pointer: "/data/attributes/slug" });
  }

  // Create account
  const accountId = generateId("acc");
  const now = new Date();

  await db.insert(accounts).values({
    id: accountId,
    name: body.name,
    slug: body.slug,
    plan: "free",
    storageQuotaBytes: 2147483648, // 2GB
    storageUsedBytes: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Add user as owner
  const membershipId = generateId("am");
  await db.insert(accountMemberships).values({
    id: membershipId,
    accountId,
    userId: session.userId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created account
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return sendSingle(c, formatDates(account), RESOURCE_TYPES.ACCOUNT);
});

/**
 * PATCH /v4/accounts/:id - Update account
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");
  const body = await c.req.json();

  // Verify user is owner or content_admin
  const memberRole = await verifyAccountMembership(session.userId, accountId, "content_admin");
  if (!memberRole) {
    throw new AuthorizationError("Only account owners and content admins can update account settings");
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    updates.name = body.name;
  }

  // Only owner can change slug
  if (body.slug !== undefined && memberRole === "owner") {
    // Check if slug is taken
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.slug, body.slug))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== accountId) {
      throw new ValidationError("Account slug is already taken", { pointer: "/data/attributes/slug" });
    }
    updates.slug = body.slug;
  }

  // Update account
  await db.update(accounts).set(updates).where(eq(accounts.id, accountId));

  // Fetch and return updated account
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return sendSingle(c, formatDates(account), RESOURCE_TYPES.ACCOUNT);
});

/**
 * GET /v4/accounts/:id/storage - Get storage usage for account
 */
app.get("/:id/storage", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");

  // Verify user is a member of this account
  const [account] = await db
    .select({
      storageUsedBytes: accounts.storageUsedBytes,
      storageQuotaBytes: accounts.storageQuotaBytes,
    })
    .from(accounts)
    .innerJoin(
      accountMemberships,
      and(
        eq(accountMemberships.accountId, accounts.id),
        eq(accountMemberships.userId, session.userId)
      )
    )
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new NotFoundError("account", accountId);
  }

  const usedBytes = BigInt(account.storageUsedBytes);
  const quotaBytes = BigInt(account.storageQuotaBytes);
  const availableBytes = quotaBytes - usedBytes;
  const usagePercent = quotaBytes > 0n ? Number((usedBytes * 100n) / quotaBytes) : 0;

  return c.json({
    data: {
      id: accountId,
      type: "storage",
      attributes: {
        used_bytes: account.storageUsedBytes,
        quota_bytes: account.storageQuotaBytes,
        available_bytes: Number(availableBytes),
        usage_percent: usagePercent,
      },
    },
  });
});

/**
 * POST /v4/accounts/:id/switch - Switch to this account
 */
app.post("/:id/switch", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");

  // Verify user is a member of this account
  const [membership] = await db
    .select({ role: accountMemberships.role })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, session.userId),
        eq(accountMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new NotFoundError("account", accountId);
  }

  // Import authService to switch account
  const { authService } = await import("../../auth/service.js");

  // Update session with new account
  const updatedSession = await authService.switchAccount(
    session.userId,
    session.sessionId,
    accountId
  );

  if (!updatedSession) {
    throw new Error("Failed to switch account");
  }

  return c.json({
    data: {
      id: accountId,
      type: "account",
      attributes: {
        current: true,
        role: membership.role,
      },
    },
  });
});

// ============================================================================
// MEMBER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /v4/accounts/:id/members - List account members
 *
 * Returns all members of the account with their roles and user info.
 * Permission: Account Member (any role)
 */
app.get("/:id/members", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Verify user is a member of this account
  const memberRole = await verifyAccountMembership(session.userId, accountId);
  if (!memberRole) {
    throw new NotFoundError("account", accountId);
  }

  // Get all members with user info
  const members = await db
    .select({
      id: accountMemberships.id,
      role: accountMemberships.role,
      createdAt: accountMemberships.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(accountMemberships)
    .innerJoin(users, eq(accountMemberships.userId, users.id))
    .where(eq(accountMemberships.accountId, accountId))
    .orderBy(desc(accountMemberships.createdAt))
    .limit(limit);

  const items = members.map((m) => ({
    id: m.id,
    role: m.role,
    created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt as number).toISOString(),
    user: {
      id: m.userId,
      email: m.userEmail,
      first_name: m.userFirstName,
      last_name: m.userLastName,
      avatar_url: m.userAvatarUrl,
    },
  }));

  return sendCollection(c, items, "member", {
    basePath: `/v4/accounts/${accountId}/members`,
    limit,
    totalCount: items.length,
  });
});

/**
 * POST /v4/accounts/:id/members - Invite new member to account
 *
 * Sends an invitation email to the specified address.
 * If user exists, they're added immediately. If not, they're added on first login.
 * Permission: Account Owner, Content Admin
 */
app.post("/:id/members", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");
  const body = await c.req.json();

  // Verify user is owner or content_admin
  const memberRole = await verifyAccountMembership(session.userId, accountId, "content_admin");
  if (!memberRole) {
    throw new AuthorizationError("Only account owners and content admins can invite members");
  }

  // Validate input
  const email = body.data?.attributes?.email;
  const role = body.data?.attributes?.role as AccountRole | undefined;

  if (!email || typeof email !== "string") {
    throw new ValidationError("Email is required", { pointer: "/data/attributes/email" });
  }

  // Validate role
  const validRoles: AccountRole[] = ["owner", "content_admin", "member", "guest", "reviewer"];
  const targetRole = role || "member";

  if (!validRoles.includes(targetRole)) {
    throw new ValidationError("Invalid role. Must be one of: owner, content_admin, member, guest, reviewer", {
      pointer: "/data/attributes/role",
    });
  }

  // Only owner can assign owner or content_admin role
  if ((targetRole === "owner" || targetRole === "content_admin") && memberRole !== "owner") {
    throw new AuthorizationError("Only account owners can assign owner or content_admin roles");
  }

  // Check if email is already a member
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUser) {
    // Check if already a member of this account
    const [existingMembership] = await db
      .select({ id: accountMemberships.id })
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.accountId, accountId),
          eq(accountMemberships.userId, existingUser.id)
        )
      )
      .limit(1);

    if (existingMembership) {
      throw new ValidationError("User is already a member of this account", {
        pointer: "/data/attributes/email",
      });
    }

    // Add user to account immediately
    const membershipId = generateId("am");
    const now = new Date();

    await db.insert(accountMemberships).values({
      id: membershipId,
      accountId,
      userId: existingUser.id,
      role: targetRole,
      createdAt: now,
      updatedAt: now,
    });

    // Get the created membership with user info
    const [newMembership] = await db
      .select({
        id: accountMemberships.id,
        role: accountMemberships.role,
        createdAt: accountMemberships.createdAt,
        userId: users.id,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userAvatarUrl: users.avatarUrl,
      })
      .from(accountMemberships)
      .innerJoin(users, eq(accountMemberships.userId, users.id))
      .where(eq(accountMemberships.id, membershipId))
      .limit(1);

    // Send invitation email (async, don't wait)
    const emailService = getEmailService();
    emailService.sendTemplate({
      to: { email },
      template: "member-invitation",
      data: {
        accountName: (await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId)).limit(1))[0]?.name || "Account",
        invitedBy: session.displayName || session.email,
        role: targetRole,
      },
    }).catch((err) => console.error("Failed to send invitation email:", err));

    return sendSingle(c, {
      id: newMembership!.id,
      role: newMembership!.role,
      created_at: newMembership!.createdAt instanceof Date ? newMembership!.createdAt.toISOString() : new Date(newMembership!.createdAt as number).toISOString(),
      user: {
        id: newMembership!.userId,
        email: newMembership!.userEmail,
        first_name: newMembership!.userFirstName,
        last_name: newMembership!.userLastName,
        avatar_url: newMembership!.userAvatarUrl,
      },
    }, "member", { selfLink: `/v4/accounts/${accountId}/members` });
  }

  // User doesn't exist - for MVP, we return an error asking them to sign up first
  // In the future, this would create a pending invitation
  throw new ValidationError(
    "No account found with this email address. The user must sign up for Bush first before they can be invited to an account.",
    { pointer: "/data/attributes/email" }
  );
});

/**
 * PATCH /v4/accounts/:id/members/:memberId - Update member role
 *
 * Permission: Account Owner (can change any role)
 *             Content Admin (can only change member/guest/reviewer roles)
 */
app.patch("/:id/members/:memberId", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");
  const membershipId = c.req.param("memberId");
  const body = await c.req.json();

  // Verify user is owner or content_admin
  const actorRole = await verifyAccountMembership(session.userId, accountId, "content_admin");
  if (!actorRole) {
    throw new AuthorizationError("Only account owners and content admins can update member roles");
  }

  // Validate input
  const newRole = body.data?.attributes?.role as AccountRole | undefined;

  if (!newRole) {
    throw new ValidationError("Role is required", { pointer: "/data/attributes/role" });
  }

  const validRoles: AccountRole[] = ["owner", "content_admin", "member", "guest", "reviewer"];
  if (!validRoles.includes(newRole)) {
    throw new ValidationError("Invalid role. Must be one of: owner, content_admin, member, guest, reviewer", {
      pointer: "/data/attributes/role",
    });
  }

  // Get the membership to update
  const [targetMembership] = await db
    .select({
      id: accountMemberships.id,
      role: accountMemberships.role,
      userId: accountMemberships.userId,
    })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.id, membershipId),
        eq(accountMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (!targetMembership) {
    throw new NotFoundError("member", membershipId);
  }

  // Prevent changing own role
  if (targetMembership.userId === session.userId) {
    throw new ValidationError("You cannot change your own role", {
      pointer: "/data/attributes/role",
    });
  }

  // Only owner can assign owner or content_admin role
  if ((newRole === "owner" || newRole === "content_admin") && actorRole !== "owner") {
    throw new AuthorizationError("Only account owners can assign owner or content_admin roles");
  }

  // Content admins can only downgrade (not upgrade) and only for member/guest/reviewer
  if (actorRole === "content_admin") {
    const currentRole = targetMembership.role as AccountRole;
    if (currentRole === "owner" || currentRole === "content_admin") {
      throw new AuthorizationError("Content admins cannot modify owner or content admin roles");
    }
  }

  // Update the role
  await db
    .update(accountMemberships)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(eq(accountMemberships.id, membershipId));

  // Get updated membership with user info
  const [updatedMembership] = await db
    .select({
      id: accountMemberships.id,
      role: accountMemberships.role,
      createdAt: accountMemberships.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(accountMemberships)
    .innerJoin(users, eq(accountMemberships.userId, users.id))
    .where(eq(accountMemberships.id, membershipId))
    .limit(1);

  // Invalidate session cache for the affected user so role change takes effect immediately
  await sessionCache.invalidateOnRoleChange(targetMembership.userId, accountId);

  return sendSingle(c, {
    id: updatedMembership!.id,
    role: updatedMembership!.role,
    created_at: updatedMembership!.createdAt instanceof Date ? updatedMembership!.createdAt.toISOString() : new Date(updatedMembership!.createdAt as number).toISOString(),
    user: {
      id: updatedMembership!.userId,
      email: updatedMembership!.userEmail,
      first_name: updatedMembership!.userFirstName,
      last_name: updatedMembership!.userLastName,
      avatar_url: updatedMembership!.userAvatarUrl,
    },
  }, "member");
});

/**
 * DELETE /v4/accounts/:id/members/:memberId - Remove member from account
 *
 * Permission: Account Owner, Content Admin
 */
app.delete("/:id/members/:memberId", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("id");
  const membershipId = c.req.param("memberId");

  // Verify user is owner or content_admin
  const actorRole = await verifyAccountMembership(session.userId, accountId, "content_admin");
  if (!actorRole) {
    throw new AuthorizationError("Only account owners and content admins can remove members");
  }

  // Get the membership to delete
  const [targetMembership] = await db
    .select({
      id: accountMemberships.id,
      role: accountMemberships.role,
      userId: accountMemberships.userId,
    })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.id, membershipId),
        eq(accountMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (!targetMembership) {
    throw new NotFoundError("member", membershipId);
  }

  // Prevent removing self
  if (targetMembership.userId === session.userId) {
    throw new ValidationError("You cannot remove yourself from the account", {
      pointer: "/data/id",
    });
  }

  // Content admins cannot remove owners or other content admins
  if (actorRole === "content_admin") {
    const targetRole = targetMembership.role as AccountRole;
    if (targetRole === "owner" || targetRole === "content_admin") {
      throw new AuthorizationError("Content admins cannot remove owners or content admins");
    }
  }

  // Delete the membership
  await db.delete(accountMemberships).where(eq(accountMemberships.id, membershipId));

  // Invalidate session cache for the affected user
  await sessionCache.invalidateOnRoleChange(targetMembership.userId, accountId);

  return sendNoContent(c);
});

export default app;
