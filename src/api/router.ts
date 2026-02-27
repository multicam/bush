/**
 * Bush Platform - API Router Utilities
 *
 * Base utilities for creating API route handlers.
 */
import { Hono, type Context } from "hono";
import type { AppError, JsonApiErrorResponse } from "../errors/index.js";
import { toErrorResponse, toAppError, generateRequestId } from "../errors/index.js";
import { isProd } from "../config/env.js";
import { createLogger, scrubSecrets } from "../lib/logger.js";

const log = createLogger("API");

/**
 * Create a new Hono router with common configuration
 */
export function createRouter(): Hono {
  return new Hono();
}

/**
 * Global error handler for API routes
 * Converts errors to JSON:API format
 *
 * Security: In production, internal error details (including stack traces) are:
 * - Logged server-side for debugging
 * - Never sent to the client (generic message returned instead)
 * In development, stack traces may be included in responses for debugging.
 */
export function errorHandler(error: Error, c: Context): Response {
  // Generate request ID if not present
  const requestId = c.get("requestContext")?.requestId ?? generateRequestId();

  const appError = toAppError(error);

  // Always log the full error server-side for debugging (with secrets scrubbed)
  log.error("Unhandled error in request", error, {
    request_id: requestId,
    error_name: error.name,
    error_message: scrubSecrets(error.message),
  });

  // In production, sanitize internal server errors to prevent leaking details
  let response: JsonApiErrorResponse;
  if (isProd && appError.status === 500) {
    // Return generic error message without internal details
    response = {
      errors: [{
        title: "Internal Server Error",
        detail: "An unexpected error occurred. Please try again later.",
        status: 500,
        code: "internal_error",
        meta: { request_id: requestId },
      }],
    };
  } else {
    response = toErrorResponse(appError);
  }

  // Set rate limit headers if it's a rate limit error
  if ("retryAfter" in appError) {
    c.header("Retry-After", String((appError as AppError & { retryAfter: number }).retryAfter));
  }

  return c.json(response, appError.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503);
}

/**
 * Not found handler
 */
export function notFoundHandler(c: Parameters<Parameters<Hono["notFound"]>[0]>[0]): Response {
  return c.json({
    errors: [{
      title: "Not Found",
      detail: `Route ${c.req.path} not found`,
      status: 404,
      code: "not_found",
    }],
  }, 404);
}

// Re-export generateId from shared module for convenience
export { generateId } from "../shared/id.js";

/**
 * Parse include parameter for relationships
 */
export function parseInclude(include?: string): string[] {
  if (!include) return [];
  return include.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Parse fields parameter for sparse fieldsets
 */
export function parseFields(fields?: string): string[] {
  if (!fields) return [];
  return fields.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Validate and coerce pagination limit
 */
export function parseLimit(limit?: string, defaultLimit = 50, maxLimit = 100): number {
  if (!limit) return defaultLimit;
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}
