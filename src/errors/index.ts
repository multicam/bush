/**
 * Bush Platform - Error Handling Utilities
 *
 * Standardized error classes and utilities for API responses.
 * Reference: specs/17-api-complete.md Section 3.4-3.5
 * Reference: IMPLEMENTATION_PLAN.md QW4
 */

/**
 * JSON:API-style error object
 */
export interface JsonApiError {
  title: string;
  detail: string;
  status?: number;
  code?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, unknown>;
}

/**
 * JSON:API-style error response
 */
export interface JsonApiErrorResponse {
  errors: JsonApiError[];
}

/**
 * Base application error class
 */
export abstract class AppError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(
    title: string,
    detail: string,
    status: number,
    code: string
  ) {
    super(detail);
    this.name = title;
    this.status = status;
    this.code = code;
  }

  /**
   * Convert to JSON:API error format
   */
  toJsonApi(): JsonApiError {
    return {
      title: this.name,
      detail: this.message,
      status: this.status,
      code: this.code,
    };
  }
}

/**
 * Validation error (400 Bad Request, 422 Unprocessable Entity)
 */
export class ValidationError extends AppError {
  constructor(
    detail: string,
    source?: { pointer?: string; parameter?: string }
  ) {
    super("Validation Error", detail, 422, "validation_error");
    this.source = source;
  }

  source?: { pointer?: string; parameter?: string };

  override toJsonApi(): JsonApiError {
    const error: JsonApiError = super.toJsonApi();
    error.status = 422;
    if (this.source) {
      error.source = this.source;
    }
    return error;
  }
}

/**
 * Bad request error (400)
 */
export class BadRequestError extends AppError {
  constructor(detail: string) {
    super("Bad Request", detail, 400, "bad_request");
  }
}

/**
 * Authentication error (401 Unauthorized)
 */
export class AuthenticationError extends AppError {
  constructor(detail: string = "Authentication required") {
    super("Unauthorized", detail, 401, "unauthorized");
  }
}

/**
 * Authorization/Permission error (403 Forbidden)
 */
export class AuthorizationError extends AppError {
  constructor(
    detail: string = "You do not have permission to perform this action"
  ) {
    super("Forbidden", detail, 403, "forbidden");
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resourceType?: string, resourceId?: string) {
    const detail =
      resourceType && resourceId
        ? `${resourceType} with id '${resourceId}' not found`
        : "Resource not found";
    super("Not Found", detail, 404, "not_found");
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(detail: string) {
    super("Conflict", detail, 409, "conflict");
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      "Too Many Requests",
      "Rate limit exceeded. Please try again later.",
      429,
      "rate_limit_exceeded"
    );
    this.retryAfter = retryAfter;
  }

  override toJsonApi(): JsonApiError {
    const error = super.toJsonApi();
    error.meta = { retry_after: this.retryAfter };
    return error;
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(detail: string = "Service temporarily unavailable") {
    super("Service Unavailable", detail, 503, "service_unavailable");
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends AppError {
  constructor(detail: string = "An unexpected error occurred") {
    super("Internal Server Error", detail, 500, "internal_error");
  }
}

/**
 * Convert an AppError to a JSON:API error response
 */
export function toErrorResponse(error: AppError): JsonApiErrorResponse {
  return {
    errors: [error.toJsonApi()],
  };
}

/**
 * Convert multiple errors to a JSON:API error response
 */
export function toMultiErrorResponse(
  errors: AppError[]
): JsonApiErrorResponse {
  return {
    errors: errors.map((e) => e.toJsonApi()),
  };
}

/**
 * Convert an unknown error to an AppError
 * Useful in catch blocks where the error type is unknown
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }

  return new InternalServerError(String(error));
}

/**
 * Request ID context type
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  accountId?: string;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Error logger with structured output
 */
export const errorLogger = {
  info(message: string, context: RequestContext, data?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        request_id: context.requestId,
        user_id: context.userId,
        account_id: context.accountId,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },

  warn(message: string, context: RequestContext, data?: Record<string, unknown>): void {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        request_id: context.requestId,
        user_id: context.userId,
        account_id: context.accountId,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },

  error(message: string, context: RequestContext, error?: Error, data?: Record<string, unknown>): void {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        request_id: context.requestId,
        user_id: context.userId,
        account_id: context.accountId,
        timestamp: new Date().toISOString(),
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
        ...data,
      })
    );
  },
};
