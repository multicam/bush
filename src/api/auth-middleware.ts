/**
 * Bush Platform - Authentication Middleware
 *
 * Hono middleware for authenticating requests using sessions or bearer tokens.
 * Supports WorkOS session cookie (wos-session) for browser access and
 * bush_session cookie / bearer tokens for API access.
 * Reference: specs/12-authentication.md
 * Reference: specs/17-api-complete.md Section 2
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import { unsealData } from "iron-session";
import { sessionCache, parseSessionCookie } from "../auth/session-cache.js";
import { authService } from "../auth/service.js";
import { AuthenticationError, generateRequestId } from "../errors/index.js";
import { SESSION_KEY, REQUEST_CONTEXT_KEY } from "../permissions/middleware.js";
import type { SessionData } from "../auth/types.js";
import { config } from "../config/index.js";

/**
 * Session cookie name
 */
export const SESSION_COOKIE_NAME = "bush_session";

/**
 * WorkOS session cookie name
 */
const WOS_SESSION_COOKIE = "wos-session";

/**
 * Authorization header prefix
 */
const BEARER_PREFIX = "Bearer ";

/**
 * Parse a named cookie from the cookie header
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }
  return null;
}

/**
 * Parse bearer token from Authorization header
 */
function parseBearerToken(c: Context): string | null {
  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return authHeader.slice(BEARER_PREFIX.length).trim();
}

/**
 * Extract session from WorkOS wos-session cookie
 * Unseals the iron-session encrypted cookie and creates/retrieves a Bush session
 */
async function extractWorkOSSession(cookieHeader: string): Promise<SessionData | null> {
  const wosCookieValue = parseCookie(cookieHeader, WOS_SESSION_COOKIE);
  if (!wosCookieValue) {
    return null;
  }

  try {
    // Unseal the iron-session encrypted cookie
    const password = config.WORKOS_COOKIE_PASSWORD || config.SESSION_SECRET;
    const session = await unsealData<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profilePictureUrl: string | null;
      };
      organizationId?: string;
    }>(wosCookieValue, { password });

    if (!session?.user?.id) {
      return null;
    }

    // Find or create Bush user from WorkOS user info
    const { userId } = await authService.findOrCreateUser({
      workosUserId: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName ?? undefined,
      lastName: session.user.lastName ?? undefined,
      avatarUrl: session.user.profilePictureUrl ?? undefined,
      organizationId: session.organizationId || "",
    });

    // Get user's accounts
    const accounts = await authService.getUserAccounts(userId);
    if (accounts.length === 0) {
      return null;
    }

    // Create or retrieve cached session
    const defaultAccount = accounts[0];
    return authService.createSession(
      userId,
      defaultAccount.accountId,
      session.organizationId || "",
      session.user.id
    );
  } catch (error) {
    console.error("[Auth] Failed to unseal wos-session:", error);
    return null;
  }
}

/**
 * Extract session from cookie or bearer token
 */
async function extractSession(c: Context): Promise<SessionData | null> {
  // Try bearer token first (API access)
  const bearerToken = parseBearerToken(c);
  if (bearerToken) {
    if (bearerToken.startsWith("bush_tok_")) {
      const tokenParts = bearerToken.split("_");
      if (tokenParts.length >= 3) {
        const userId = tokenParts[2];
        const sessionId = tokenParts.slice(3).join("_") || tokenParts[2];
        return sessionCache.get(userId, sessionId);
      }
    } else if (bearerToken.startsWith("bush_key_")) {
      return null;
    } else {
      const parts = bearerToken.split(":");
      if (parts.length === 2) {
        const [userId, sessionId] = parts;
        return sessionCache.get(userId, sessionId);
      }
    }
    return null;
  }

  // Try cookies (browser access)
  const cookieHeader = c.req.header("cookie");
  if (!cookieHeader) {
    return null;
  }

  // Try bush_session cookie first (fastest path)
  const bushSessionData = parseSessionCookie(cookieHeader);
  if (bushSessionData) {
    const cached = await sessionCache.get(bushSessionData.userId, bushSessionData.sessionId);
    if (cached) {
      return cached;
    }
  }

  // Fall back to wos-session cookie (WorkOS AuthKit)
  return extractWorkOSSession(cookieHeader);
}

/**
 * Authentication middleware
 *
 * Validates session from cookie or bearer token and populates context.
 */
export function authMiddleware(options: { optional?: boolean } = {}): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const requestId = generateRequestId();

    try {
      const session = await extractSession(c);

      if (session) {
        session.lastActivityAt = Date.now();
        c.set(SESSION_KEY, session);
        c.set(REQUEST_CONTEXT_KEY, {
          requestId,
          userId: session.userId,
          accountId: session.currentAccountId,
        });
      } else if (!options.optional) {
        throw new AuthenticationError("Authentication required");
      } else {
        c.set(REQUEST_CONTEXT_KEY, { requestId });
      }

      c.header("X-Request-Id", requestId);
      await next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error("[Auth] Unexpected error during authentication:", error);
      throw new AuthenticationError("Authentication failed");
    }
  };
}

/**
 * Optional authentication middleware
 */
export const optionalAuthMiddleware = authMiddleware({ optional: true });

/**
 * Require authenticated user
 */
export function requireAuth(c: Context): SessionData {
  const session = c.get(SESSION_KEY);
  if (!session) {
    throw new AuthenticationError("Authentication required");
  }
  return session;
}

/**
 * Get current user ID from context
 */
export function getCurrentUserId(c: Context): string | undefined {
  return c.get(SESSION_KEY)?.userId;
}

/**
 * Get current account ID from context
 */
export function getCurrentAccountId(c: Context): string | undefined {
  return c.get(SESSION_KEY)?.currentAccountId;
}

/**
 * Get current user role from context
 */
export function getCurrentUserRole(c: Context): string | undefined {
  return c.get(SESSION_KEY)?.accountRole;
}
