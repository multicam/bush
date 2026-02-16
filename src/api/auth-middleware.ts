/**
 * Bush Platform - Authentication Middleware
 *
 * Hono middleware for authenticating requests using sessions or bearer tokens.
 * Integrates with session cache for fast lookups.
 * Reference: specs/12-authentication.md
 * Reference: specs/17-api-complete.md Section 2
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import { sessionCache, parseSessionCookie } from "../auth/session-cache.js";
import { authService } from "../auth/service.js";
import { AuthenticationError, generateRequestId } from "../errors/index.js";
import { SESSION_KEY, REQUEST_CONTEXT_KEY } from "../permissions/middleware.js";
import type { SessionData } from "../auth/types.js";

/**
 * Session cookie name
 */
export const SESSION_COOKIE_NAME = "bush_session";

/**
 * Authorization header prefix
 */
const BEARER_PREFIX = "Bearer ";

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
 * Extract session from cookie or bearer token
 */
async function extractSession(c: Context): Promise<SessionData | null> {
  // Try bearer token first (API access)
  const bearerToken = parseBearerToken(c);
  if (bearerToken) {
    // Validate bearer token format: bush_tok_ or session ID
    if (bearerToken.startsWith("bush_tok_")) {
      // TODO: Implement full OAuth token validation with WorkOS
      // For now, treat as session ID for development
      const tokenParts = bearerToken.split("_");
      if (tokenParts.length >= 3) {
        // Extract user_id and session_id from token (format: bush_tok_{user_id}_{session_id})
        const userId = tokenParts[2];
        const sessionId = tokenParts.slice(3).join("_") || tokenParts[2];
        return sessionCache.get(userId, sessionId);
      }
    } else if (bearerToken.startsWith("bush_key_")) {
      // API key authentication - TODO: Implement API key validation
      // For now, reject
      return null;
    } else {
      // Treat as raw session ID - extract from format {userId}:{sessionId}
      const parts = bearerToken.split(":");
      if (parts.length === 2) {
        const [userId, sessionId] = parts;
        return sessionCache.get(userId, sessionId);
      }
    }
    return null;
  }

  // Try session cookie (browser access)
  const cookieHeader = c.req.header("cookie");
  if (cookieHeader) {
    const sessionData = parseSessionCookie(cookieHeader);
    if (sessionData) {
      return sessionCache.get(sessionData.userId, sessionData.sessionId);
    }
  }

  return null;
}

/**
 * Authentication middleware
 *
 * Validates session from cookie or bearer token and populates context.
 *
 * @example
 * // Protect all API routes
 * app.use('/v4/*', authMiddleware());
 *
 * // Optional authentication (doesn't throw if not authenticated)
 * app.use('/v4/public/*', authMiddleware({ optional: true }));
 */
export function authMiddleware(options: { optional?: boolean } = {}): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    // Generate request ID for tracing
    const requestId = generateRequestId();

    try {
      const session = await extractSession(c);

      if (session) {
        // Update last activity
        session.lastActivityAt = Date.now();

        // Store session in context
        c.set(SESSION_KEY, session);

        // Store request context
        c.set(REQUEST_CONTEXT_KEY, {
          requestId,
          userId: session.userId,
          accountId: session.currentAccountId,
        });
      } else if (!options.optional) {
        throw new AuthenticationError("Authentication required");
      } else {
        // Optional auth - no session, but set request context
        c.set(REQUEST_CONTEXT_KEY, { requestId });
      }

      // Add request ID to response headers
      c.header("X-Request-Id", requestId);

      await next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      // Log unexpected errors but don't expose details
      console.error("[Auth] Unexpected error during authentication:", error);
      throw new AuthenticationError("Authentication failed");
    }
  };
}

/**
 * Optional authentication middleware
 * Sets session if available but doesn't require it
 */
export const optionalAuthMiddleware = authMiddleware({ optional: true });

/**
 * Require authenticated user
 * Helper for routes that always require auth
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
