/**
 * Bush Platform - Auth Routes
 *
 * API routes for authentication operations.
 * Reference: specs/17-api-complete.md Section 2.3
 */
import { Hono } from "hono";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { formatDates } from "../response.js";
import { sessionCache } from "../../auth/session-cache.js";
import { db } from "../../db/index.js";
import { users, accounts, accountMemberships, workspaces } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { ValidationError, AuthenticationError } from "../../errors/index.js";

const app = new Hono();

// Apply authentication to all routes (optional for token endpoint which may use refresh token)
app.use("*", authMiddleware({ optional: true }));

/**
 * POST /v4/auth/token - Exchange refresh token for new access token
 *
 * This endpoint handles token refresh for API clients using bearer tokens.
 * For web clients, the session is managed via cookies.
 */
app.post("/token", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  // Validate grant_type
  if (body.grant_type !== "refresh_token") {
    throw new ValidationError("Unsupported grant_type. Only 'refresh_token' is supported.", {
      pointer: "/data/attributes/grant_type",
    });
  }

  // Validate refresh token
  const refreshToken = body.refresh_token;
  if (!refreshToken || typeof refreshToken !== "string") {
    throw new ValidationError("refresh_token is required", {
      pointer: "/data/attributes/refresh_token",
    });
  }

  // Parse refresh token format: bush_rt_{userId}:{sessionId}
  if (!refreshToken.startsWith("bush_rt_")) {
    throw new AuthenticationError("Invalid refresh token format");
  }

  const tokenPayload = refreshToken.slice(8); // Remove 'bush_rt_' prefix
  const parts = tokenPayload.split(":");

  if (parts.length !== 2) {
    throw new AuthenticationError("Invalid refresh token format");
  }

  const [userId, sessionId] = parts;

  // Get session from cache
  const session = await sessionCache.get(userId, sessionId);
  if (!session) {
    throw new AuthenticationError("Invalid or expired refresh token");
  }

  // Extend session TTL (refresh the session)
  await sessionCache.touch(userId, sessionId);

  // Generate new access token (in a real implementation, this would be a JWT or similar)
  // For now, we use a simple format: bush_tok_{userId}:{sessionId}
  const accessToken = `bush_tok_${userId}:${sessionId}`;

  // Generate new refresh token (token rotation for security)
  const newRefreshToken = `bush_rt_${userId}:${sessionId}`;

  return c.json({
    data: {
      id: sessionId,
      type: "token",
      attributes: {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 300, // 5 minutes per specs/12-authentication.md
        refresh_token: newRefreshToken,
      },
    },
  });
});

/**
 * POST /v4/auth/revoke - Revoke a token (logout)
 *
 * Revokes the current session or a specific token.
 */
app.post("/revoke", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const session = c.get("session");

  // If we have a current session, revoke it
  if (session) {
    await sessionCache.delete(session.userId, session.sessionId);
    return c.json({
      data: {
        id: session.sessionId,
        type: "token",
        attributes: {
          revoked: true,
        },
      },
    });
  }

  // Otherwise, try to revoke the token from the request body
  const token = body.token;
  if (!token || typeof token !== "string") {
    throw new ValidationError("token is required when not authenticated", {
      pointer: "/data/attributes/token",
    });
  }

  // Parse token format
  let userId: string;
  let sessionId: string;

  if (token.startsWith("bush_rt_")) {
    const payload = token.slice(8);
    const parts = payload.split(":");
    if (parts.length !== 2) {
      throw new AuthenticationError("Invalid token format");
    }
    [userId, sessionId] = parts;
  } else if (token.startsWith("bush_tok_")) {
    const payload = token.slice(9);
    const parts = payload.split(":");
    if (parts.length !== 2) {
      throw new AuthenticationError("Invalid token format");
    }
    [userId, sessionId] = parts;
  } else {
    // Try userId:sessionId format
    const parts = token.split(":");
    if (parts.length !== 2) {
      throw new AuthenticationError("Invalid token format");
    }
    [userId, sessionId] = parts;
  }

  // Revoke the session
  await sessionCache.delete(userId, sessionId);

  return c.json({
    data: {
      id: sessionId,
      type: "token",
      attributes: {
        revoked: true,
      },
    },
  });
});

/**
 * GET /v4/auth/me - Get current authenticated user and permissions
 *
 * Returns the current user's profile, current account, and available accounts.
 */
app.get("/me", async (c) => {
  const session = requireAuth(c);

  // Get full user info
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    throw new AuthenticationError("User not found");
  }

  // Get current account info
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, session.currentAccountId))
    .limit(1);

  // Get all accounts user has access to
  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      slug: accounts.slug,
      plan: accounts.plan,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .innerJoin(accounts, eq(accountMemberships.accountId, accounts.id))
    .where(eq(accountMemberships.userId, session.userId));

  // Get workspaces for current account
  const workspacesList = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
    })
    .from(workspaces)
    .where(eq(workspaces.accountId, session.currentAccountId));

  return c.json({
    data: {
      id: user.id,
      type: "user",
      attributes: {
        ...formatDates({
          email: user.email,
          display_name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
          first_name: user.firstName,
          last_name: user.lastName,
          avatar_url: user.avatarUrl,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
        }),
      },
      relationships: {
        current_account: {
          data: account ? { id: account.id, type: "account" } : null,
        },
        accounts: {
          data: allAccounts.map((a) => ({ id: a.id, type: "account" })),
        },
        workspaces: {
          data: workspacesList.map((w) => ({ id: w.id, type: "workspace" })),
        },
      },
    },
    included: [
      // Include current account with role
      ...(account
        ? [
            {
              id: account.id,
              type: "account",
              attributes: {
                ...formatDates({
                  name: account.name,
                  slug: account.slug,
                  plan: account.plan,
                  storage_used_bytes: account.storageUsedBytes,
                  storage_quota_bytes: account.storageQuotaBytes,
                  role: allAccounts.find((a) => a.id === account.id)?.role || "member",
                  created_at: account.createdAt,
                  updated_at: account.updatedAt,
                }),
              },
            },
          ]
        : []),
      // Include all accounts
      ...allAccounts
        .filter((a) => a.id !== session.currentAccountId)
        .map((a) => ({
          id: a.id,
          type: "account",
          attributes: {
            name: a.name,
            slug: a.slug,
            plan: a.plan,
            role: a.role,
          },
        })),
      // Include workspaces
      ...workspacesList.map((w) => ({
        id: w.id,
        type: "workspace",
        attributes: {
          name: w.name,
        },
      })),
    ],
  });
});

export default app;
