/**
 * Bush Platform - Authentication Middleware
 *
 * Hono middleware for authenticating requests using sessions or bearer tokens.
 * Supports WorkOS session cookie (wos-session) for browser access,
 * bush_session cookie / bearer tokens for API access, and
 * bush_key_ prefixed API keys for service-to-service authentication.
 * Reference: specs/02-authentication.md
 * Reference: specs/04-api-reference.md Section 2
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import { unsealData } from "iron-session";
import { sessionCache, parseSessionCookie } from "../auth/session-cache.js";
import { authService } from "../auth/service.js";
import { apiKeyService } from "./api-key-service.js";
import { AuthenticationError, generateRequestId } from "../errors/index.js";
import { SESSION_KEY, REQUEST_CONTEXT_KEY } from "../permissions/middleware.js";
import type { SessionData } from "../auth/types.js";
import { config } from "../config/index.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("Auth");

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
    log.error("Failed to unseal wos-session", error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Demo session for back-pressure testing (deterministic IDs matching seed.ts)
 */
function getDemoSession(): SessionData {
  return {
    sessionId: "demo-session",
    userId: "usr_0e7b8c3e3b7f94ed81538a56",
    email: "alice@alpha.studio",
    displayName: "Alice Chen",
    currentAccountId: "acc_7877e0d885c4b988e2437c67",
    accountRole: "owner",
    workosOrganizationId: "demo-org",
    workosUserId: "workos_user_alice",
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    avatarUrl: null,
  };
}

/**
 * Extract session from cookie or bearer token
 */
async function extractSession(c: Context): Promise<SessionData | null> {
  if (config.DEMO_MODE) {
    return getDemoSession();
  }

  const path = c.req.path;
  const method = c.req.method;

  // Try bearer token first (API access)
  const bearerToken = parseBearerToken(c);
  if (bearerToken) {
    if (bearerToken.startsWith("bush_tok_")) {
      const tokenParts = bearerToken.split("_");
      if (tokenParts.length >= 3) {
        const userId = tokenParts[2];
        const sessionId = tokenParts.slice(3).join("_") || tokenParts[2];
        const session = await sessionCache.get(userId, sessionId);
        if (!session) {
          log.warn("Authentication failed: session not found in cache", {
            auth_method: "bearer_token",
            token_type: "bush_tok",
            user_id: userId,
            path,
            method,
          });
        }
        return session;
      }
    } else if (bearerToken.startsWith("bush_key_")) {
      // API key authentication - validate and return session
      const session = await apiKeyService.validateKey(bearerToken);
      if (!session) {
        log.warn("Authentication failed: invalid API key", {
          auth_method: "api_key",
          key_prefix: bearerToken.substring(0, 12) + "...",
          path,
          method,
        });
      }
      return session;
    } else {
      const parts = bearerToken.split(":");
      if (parts.length === 2) {
        const [userId, sessionId] = parts;
        const session = await sessionCache.get(userId, sessionId);
        if (!session) {
          log.warn("Authentication failed: session not found in cache", {
            auth_method: "bearer_token",
            token_type: "legacy",
            user_id: userId,
            path,
            method,
          });
        }
        return session;
      }
    }
    // Invalid bearer token format
    log.warn("Authentication failed: invalid bearer token format", {
      auth_method: "bearer_token",
      token_type: "unknown",
      path,
      method,
    });
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
    // Session cookie parsed but not found in cache
    log.warn("Authentication failed: session cookie valid but not found in cache", {
      auth_method: "session_cookie",
      user_id: bushSessionData.userId,
      path,
      method,
    });
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
    const path = c.req.path;
    const method = c.req.method;

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
        // Log failed authentication attempt
        log.warn("Authentication failed: no valid session found", {
          path,
          method,
          has_cookie: !!c.req.header("cookie"),
          has_auth_header: !!c.req.header("authorization"),
          request_id: requestId,
        });
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
      log.error("Unexpected error during authentication", error instanceof Error ? error : undefined, {
        request_id: requestId,
        path,
        method,
      });
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
