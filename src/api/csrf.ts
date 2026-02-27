/**
 * Bush Platform - CSRF Protection
 *
 * Implements Cross-Site Request Forgery protection using the Double Submit Cookie pattern.
 * This provides protection for cookie-based session authentication.
 *
 * Reference: specs/12-security.md Section 5.4
 *
 * Security approach:
 * 1. Double Submit Cookie: A random CSRF token is generated and sent both as a cookie
 *    and in response bodies. The client must include the token in request headers.
 * 2. Origin header validation: For additional protection, the Origin header is validated
 *    against allowed origins on state-changing requests.
 *
 * API bearer token requests are inherently CSRF-safe because browsers don't include
 * Authorization headers in cross-origin requests.
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import crypto from "crypto";
import { config, isDev } from "../config/index.js";
import { createLogger } from "../lib/logger.js";
import { CsrfError } from "../errors/index.js";

const log = createLogger("CSRF");

/**
 * CSRF token cookie name
 */
export const CSRF_COOKIE_NAME = "bush_csrf";

/**
 * CSRF token header name
 * Clients must include this header with the token value
 */
export const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * CSRF token length in bytes (before base64 encoding)
 * 32 bytes = 256 bits of entropy
 */
const CSRF_TOKEN_BYTES = 32;

/**
 * HTTP methods that require CSRF protection
 * These are "state-changing" methods that can modify server state
 */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Generate a cryptographically secure CSRF token
 * Returns a URL-safe base64 encoded string
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
}

/**
 * Get allowed origins for Origin header validation
 * Includes APP_URL and API_URL as valid origins
 */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Add APP_URL (frontend)
  if (config.APP_URL) {
    origins.add(config.APP_URL);
  }

  // Add API_URL (backend)
  if (config.API_URL) {
    origins.add(config.API_URL);
  }

  // In development, also allow localhost variants
  if (isDev) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://localhost:3001");
    origins.add("http://127.0.0.1:3001");
  }

  return origins;
}

/**
 * Validate the Origin header against allowed origins
 * Returns true if the origin is valid or if no Origin header is present
 * (no Origin header on a GET request is normal)
 */
function validateOrigin(origin: string | undefined): boolean {
  if (!origin) {
    // No Origin header - this is fine for same-site requests
    // The CSRF token check will catch cross-site attacks
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // Normalize origin (remove trailing slash)
  const normalizedOrigin = origin.replace(/\/$/, "");

  return allowedOrigins.has(normalizedOrigin);
}

/**
 * Parse CSRF token from cookie header
 */
function getCsrfTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${CSRF_COOKIE_NAME}=`)) {
      return cookie.slice(CSRF_COOKIE_NAME.length + 1);
    }
  }

  return null;
}

/**
 * Get CSRF token from request header
 */
function getCsrfTokenFromHeader(c: Context): string | null {
  return c.req.header(CSRF_HEADER_NAME) ?? null;
}

/**
 * Check if the request uses cookie-based authentication
 * CSRF protection is only needed for cookie-based auth, not bearer tokens
 */
function usesCookieAuth(c: Context): boolean {
  const cookieHeader = c.req.header("cookie");
  if (!cookieHeader) {
    return false;
  }

  // Check if bush_session cookie is present
  return cookieHeader.includes("bush_session=") || cookieHeader.includes("wos-session=");
}

/**
 * Check if the request uses bearer token authentication
 * Bearer token requests are inherently CSRF-safe
 */
function usesBearerAuth(c: Context): boolean {
  const authHeader = c.req.header("authorization");
  return authHeader?.startsWith("Bearer ") ?? false;
}

/**
 * Set CSRF cookie on the response
 * Uses SameSite=Strict for additional CSRF protection
 */
function setCsrfCookie(c: Context, token: string): void {
  c.header(
    "Set-Cookie",
    `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; ${!isDev ? "Secure; " : ""}Max-Age=31536000`, // 1 year
    { append: true }
  );
}

/**
 * Generate and set a new CSRF token
 * Returns the token value to be included in response bodies
 *
 * This should be called when a user authenticates or when a new CSRF token is needed.
 * The token is set as an HttpOnly cookie and should also be returned to the client
 * for inclusion in subsequent request headers.
 */
export function setupCsrfToken(c: Context): string {
  const token = generateCsrfToken();
  setCsrfCookie(c, token);
  return token;
}

/**
 * Get the current CSRF token from the cookie
 * Returns null if no token is set
 */
export function getCsrfToken(c: Context): string | null {
  return getCsrfTokenFromCookie(c.req.header("cookie"));
}

/**
 * CSRF protection middleware
 *
 * This middleware implements the Double Submit Cookie pattern:
 * 1. For safe methods (GET, HEAD, OPTIONS): Generate/refresh CSRF token cookie if needed
 * 2. For state-changing methods (POST, PUT, PATCH, DELETE): Validate CSRF token
 *
 * The middleware skips CSRF validation for:
 * - Requests without cookies (no session = no CSRF risk)
 * - Bearer token authenticated requests (inherently CSRF-safe)
 *
 * Usage:
 * - Apply globally or to routes that need CSRF protection
 * - Client must include X-CSRF-Token header with the token from the cookie
 * - Return the CSRF token in authentication responses so client can read it
 */
export function csrfMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const method = c.req.method;

    // Skip CSRF for requests without cookie-based auth
    if (!usesCookieAuth(c)) {
      // Ensure CSRF cookie is set for future cookie-authenticated requests
      if (!getCsrfToken(c)) {
        setupCsrfToken(c);
      }
      return next();
    }

    // Skip CSRF for bearer token requests (inherently safe)
    if (usesBearerAuth(c)) {
      return next();
    }

    // For safe methods, just ensure CSRF cookie exists
    if (!STATE_CHANGING_METHODS.has(method)) {
      if (!getCsrfToken(c)) {
        setupCsrfToken(c);
        log.debug("Generated new CSRF token for safe request", {
          method,
          path: c.req.path,
        });
      }
      return next();
    }

    // For state-changing methods, validate CSRF token
    const cookieToken = getCsrfToken(c);
    const headerToken = getCsrfTokenFromHeader(c);

    // Check if tokens are present
    if (!cookieToken || !headerToken) {
      log.warn("CSRF validation failed: missing token", {
        method,
        path: c.req.path,
        has_cookie_token: !!cookieToken,
        has_header_token: !!headerToken,
      });

      throw new CsrfError(
        !cookieToken
          ? "CSRF token not found in cookie. Please refresh the page."
          : "CSRF token required. Include X-CSRF-Token header with your request."
      );
    }

    // Validate tokens match (timing-safe comparison)
    try {
      const cookieBuffer = Buffer.from(cookieToken, "base64url");
      const headerBuffer = Buffer.from(headerToken, "base64url");

      if (cookieBuffer.length !== headerBuffer.length) {
        log.warn("CSRF validation failed: token length mismatch", {
          method,
          path: c.req.path,
          cookie_length: cookieBuffer.length,
          header_length: headerBuffer.length,
        });
        throw new CsrfError("Invalid CSRF token");
      }

      if (!crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
        log.warn("CSRF validation failed: token mismatch", {
          method,
          path: c.req.path,
        });
        throw new CsrfError("Invalid CSRF token");
      }
    } catch (error) {
      if (error instanceof CsrfError) {
        throw error;
      }
      // Buffer.from can throw on invalid base64
      log.warn("CSRF validation failed: invalid token format", {
        method,
        path: c.req.path,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new CsrfError("Invalid CSRF token format");
    }

    // Additional protection: validate Origin header
    const origin = c.req.header("origin");
    if (origin && !validateOrigin(origin)) {
      log.warn("CSRF validation failed: invalid origin", {
        method,
        path: c.req.path,
        origin,
      });
      throw new CsrfError("Invalid request origin");
    }

    // CSRF validation passed
    log.debug("CSRF validation passed", {
      method,
      path: c.req.path,
    });

    return next();
  };
}

/**
 * CSRF token endpoint handler
 * Returns the current CSRF token for the client to use
 *
 * GET /v4/auth/csrf-token
 *
 * Response:
 * {
 *   "data": {
 *     "token": "base64-encoded-token"
 *   }
 * }
 */
export function getCsrfTokenHandler(c: Context): Response {
  let token = getCsrfToken(c);

  // Generate a new token if none exists
  if (!token) {
    token = setupCsrfToken(c);
  }

  return c.json({
    data: {
      token,
    },
  });
}
