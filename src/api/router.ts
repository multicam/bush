/**
 * Bush Platform - API Router Utilities
 *
 * Base utilities for creating API route handlers.
 */
import { Hono, type Context } from "hono";
import type { AppError } from "../errors/index.js";
import { toErrorResponse, toAppError, generateRequestId } from "../errors/index.js";
import { generateId } from "../shared/id.js";

/**
 * Create a new Hono router with common configuration
 */
export function createRouter(): Hono {
  return new Hono();
}

/**
 * Global error handler for API routes
 * Converts errors to JSON:API format
 */
export function errorHandler(error: Error, c: Context): Response {
  // Generate request ID if not present
  const requestId = c.get("requestContext")?.requestId ?? generateRequestId();

  const appError = toAppError(error);
  const response = toErrorResponse(appError);

  // Log error for debugging
  console.error(JSON.stringify({
    level: "error",
    request_id: requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    timestamp: new Date().toISOString(),
  }));

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
