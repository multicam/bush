/**
 * Bush Platform - Error Handling Utilities Tests
 *
 * Tests for error classes and utilities.
 */
import { describe, it, expect } from "vitest";
import {
  ValidationError,
  BadRequestError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  InternalServerError,
  toErrorResponse,
  toMultiErrorResponse,
  toAppError,
  generateRequestId,
} from "./index.js";

describe("Error Classes", () => {
  describe("ValidationError", () => {
    it("should create a validation error with source pointer", () => {
      const error = new ValidationError("Name is required", {
        pointer: "/data/attributes/name",
      });

      expect(error.name).toBe("Validation Error");
      expect(error.message).toBe("Name is required");
      expect(error.status).toBe(422);
      expect(error.code).toBe("validation_error");
      expect(error.source?.pointer).toBe("/data/attributes/name");
    });

    it("should create a validation error with source parameter", () => {
      const error = new ValidationError("Invalid filter", {
        parameter: "filter[status]",
      });

      expect(error.source?.parameter).toBe("filter[status]");
    });

    it("should convert to JSON:API format", () => {
      const error = new ValidationError("Name is required", {
        pointer: "/data/attributes/name",
      });
      const json = error.toJsonApi();

      expect(json.title).toBe("Validation Error");
      expect(json.detail).toBe("Name is required");
      expect(json.status).toBe(422);
      expect(json.code).toBe("validation_error");
      expect(json.source?.pointer).toBe("/data/attributes/name");
    });
  });

  describe("BadRequestError", () => {
    it("should create a bad request error", () => {
      const error = new BadRequestError("Invalid JSON in request body");

      expect(error.name).toBe("Bad Request");
      expect(error.message).toBe("Invalid JSON in request body");
      expect(error.status).toBe(400);
      expect(error.code).toBe("bad_request");
    });
  });

  describe("AuthenticationError", () => {
    it("should create an authentication error with default message", () => {
      const error = new AuthenticationError();

      expect(error.name).toBe("Unauthorized");
      expect(error.message).toBe("Authentication required");
      expect(error.status).toBe(401);
      expect(error.code).toBe("unauthorized");
    });

    it("should create an authentication error with custom message", () => {
      const error = new AuthenticationError("Session expired");

      expect(error.message).toBe("Session expired");
    });
  });

  describe("AuthorizationError", () => {
    it("should create an authorization error with default message", () => {
      const error = new AuthorizationError();

      expect(error.name).toBe("Forbidden");
      expect(error.message).toBe(
        "You do not have permission to perform this action"
      );
      expect(error.status).toBe(403);
      expect(error.code).toBe("forbidden");
    });

    it("should create an authorization error with custom message", () => {
      const error = new AuthorizationError("Only admins can delete workspaces");

      expect(error.message).toBe("Only admins can delete workspaces");
    });
  });

  describe("NotFoundError", () => {
    it("should create a not found error with default message", () => {
      const error = new NotFoundError();

      expect(error.name).toBe("Not Found");
      expect(error.message).toBe("Resource not found");
      expect(error.status).toBe(404);
      expect(error.code).toBe("not_found");
    });

    it("should create a not found error with resource info", () => {
      const error = new NotFoundError("Project", "proj_abc123");

      expect(error.message).toBe("Project with id 'proj_abc123' not found");
    });
  });

  describe("ConflictError", () => {
    it("should create a conflict error", () => {
      const error = new ConflictError("A project with this name already exists");

      expect(error.name).toBe("Conflict");
      expect(error.message).toBe("A project with this name already exists");
      expect(error.status).toBe(409);
      expect(error.code).toBe("conflict");
    });
  });

  describe("RateLimitError", () => {
    it("should create a rate limit error with default retry after", () => {
      const error = new RateLimitError();

      expect(error.name).toBe("Too Many Requests");
      expect(error.message).toBe("Rate limit exceeded. Please try again later.");
      expect(error.status).toBe(429);
      expect(error.code).toBe("rate_limit_exceeded");
      expect(error.retryAfter).toBe(60);
    });

    it("should create a rate limit error with custom retry after", () => {
      const error = new RateLimitError(120);

      expect(error.retryAfter).toBe(120);
    });

    it("should include retry_after in JSON:API format", () => {
      const error = new RateLimitError(30);
      const json = error.toJsonApi();

      expect(json.meta?.retry_after).toBe(30);
    });
  });

  describe("ServiceUnavailableError", () => {
    it("should create a service unavailable error with default message", () => {
      const error = new ServiceUnavailableError();

      expect(error.name).toBe("Service Unavailable");
      expect(error.message).toBe("Service temporarily unavailable");
      expect(error.status).toBe(503);
      expect(error.code).toBe("service_unavailable");
    });
  });

  describe("InternalServerError", () => {
    it("should create an internal server error with default message", () => {
      const error = new InternalServerError();

      expect(error.name).toBe("Internal Server Error");
      expect(error.message).toBe("An unexpected error occurred");
      expect(error.status).toBe(500);
      expect(error.code).toBe("internal_error");
    });

    it("should create an internal server error with custom message", () => {
      const error = new InternalServerError("Database connection failed");

      expect(error.message).toBe("Database connection failed");
    });
  });
});

describe("Error Utilities", () => {
  describe("toErrorResponse", () => {
    it("should convert an error to JSON:API response format", () => {
      const error = new NotFoundError("Project", "proj_123");
      const response = toErrorResponse(error);

      expect(response.errors).toHaveLength(1);
      expect(response.errors[0].title).toBe("Not Found");
      expect(response.errors[0].detail).toBe(
        "Project with id 'proj_123' not found"
      );
    });
  });

  describe("toMultiErrorResponse", () => {
    it("should convert multiple errors to JSON:API response format", () => {
      const errors = [
        new ValidationError("Name is required", {
          pointer: "/data/attributes/name",
        }),
        new ValidationError("Email is invalid", {
          pointer: "/data/attributes/email",
        }),
      ];
      const response = toMultiErrorResponse(errors);

      expect(response.errors).toHaveLength(2);
      expect(response.errors[0].source?.pointer).toBe(
        "/data/attributes/name"
      );
      expect(response.errors[1].source?.pointer).toBe(
        "/data/attributes/email"
      );
    });
  });

  describe("toAppError", () => {
    it("should return the same AppError if already an AppError", () => {
      const original = new NotFoundError();
      const converted = toAppError(original);

      expect(converted).toBe(original);
    });

    it("should convert Error to InternalServerError", () => {
      const original = new Error("Something went wrong");
      const converted = toAppError(original);

      expect(converted).toBeInstanceOf(InternalServerError);
      expect(converted.message).toBe("Something went wrong");
    });

    it("should convert string to InternalServerError", () => {
      const converted = toAppError("Unknown error");

      expect(converted).toBeInstanceOf(InternalServerError);
      expect(converted.message).toBe("Unknown error");
    });

    it("should convert unknown types to InternalServerError", () => {
      const converted = toAppError({ weird: "object" });

      expect(converted).toBeInstanceOf(InternalServerError);
      expect(converted.message).toBe("[object Object]");
    });
  });

  describe("generateRequestId", () => {
    it("should generate a request ID with req_ prefix", () => {
      const requestId = generateRequestId();

      expect(requestId).toMatch(/^req_/);
    });

    it("should generate unique request IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }

      expect(ids.size).toBe(100);
    });
  });
});
