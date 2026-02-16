/**
 * Bush Platform - Account Routes
 *
 * API routes for account management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { accounts, accountMemberships } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyAccountMembership } from "../access-control.js";

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

export default app;
