/**
 * Bush Platform - User Routes
 *
 * API routes for user management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { users, accountMemberships, accounts } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, RESOURCE_TYPES, formatDates } from "../response.js";
import { NotFoundError, AuthorizationError } from "../../errors/index.js";

const app = new Hono();

// Apply authentication to all routes (rate limiting applied at v4 router level)
app.use("*", authMiddleware());

/**
 * GET /v4/users/me - Get current user
 */
app.get("/me", async (c) => {
  const session = requireAuth(c);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("user", session.userId);
  }

  // Get user's accounts
  const memberships = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      slug: accounts.slug,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .innerJoin(accounts, eq(accountMemberships.accountId, accounts.id))
    .where(eq(accountMemberships.userId, session.userId));

  const userData = formatDates(user);

  return c.json({
    data: {
      id: user.id,
      type: "user",
      attributes: {
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        display_name: [userData.firstName, userData.lastName].filter(Boolean).join(" ") || null,
        avatar_url: userData.avatarUrl,
        created_at: userData.createdAt,
        updated_at: userData.updatedAt,
      },
    },
    relationships: {
      current_account: {
        data: {
          id: session.currentAccountId,
          type: "account",
        },
      },
      accounts: {
        data: memberships.map((m) => ({
          id: m.id,
          type: "account",
        })),
      },
    },
    included: [
      {
        id: session.currentAccountId,
        type: "account",
        attributes: {
          name: memberships.find((m) => m.id === session.currentAccountId)?.name,
          slug: memberships.find((m) => m.id === session.currentAccountId)?.slug,
          role: session.accountRole,
        },
      },
    ],
  });
});

/**
 * GET /v4/users/:id - Get user by ID
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const userId = c.req.param("id");

  // Users can only view their own profile or users in same account
  if (userId !== session.userId) {
    // Check if target user is in same account
    const [membership] = await db
      .select()
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.accountId, session.currentAccountId),
          eq(accountMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundError("user", userId);
    }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("user", userId);
  }

  // Return limited info for other users
  const userData = formatDates(user);

  return sendSingle(c, {
    id: userData.id,
    email: userId === session.userId ? userData.email : undefined,
    first_name: userData.firstName,
    last_name: userData.lastName,
    display_name: [userData.firstName, userData.lastName].filter(Boolean).join(" ") || null,
    avatar_url: userData.avatarUrl,
    created_at: userData.createdAt,
    updated_at: userData.updatedAt,
  }, RESOURCE_TYPES.USER);
});

/**
 * PATCH /v4/users/:id - Update user profile
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const userId = c.req.param("id");
  const body = await c.req.json();

  // Users can only update their own profile
  if (userId !== session.userId) {
    throw new AuthorizationError("You can only update your own profile");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("user", userId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.first_name !== undefined) {
    updates.firstName = body.first_name;
  }
  if (body.last_name !== undefined) {
    updates.lastName = body.last_name;
  }
  if (body.avatar_url !== undefined) {
    updates.avatarUrl = body.avatar_url;
  }

  // Update user
  await db.update(users).set(updates).where(eq(users.id, userId));

  // Fetch and return updated user
  const [updatedUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const userData = formatDates(updatedUser);

  return sendSingle(c, {
    id: userData.id,
    email: userData.email,
    first_name: userData.firstName,
    last_name: userData.lastName,
    display_name: [userData.firstName, userData.lastName].filter(Boolean).join(" ") || null,
    avatar_url: userData.avatarUrl,
    created_at: userData.createdAt,
    updated_at: userData.updatedAt,
  }, RESOURCE_TYPES.USER);
});

export default app;
