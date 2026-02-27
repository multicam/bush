/**
 * Bush Platform - CSRF Protection Tests
 *
 * Tests for CSRF token generation, validation, and middleware.
 */
import { describe, it, expect, vi } from "vitest";
import {
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  setupCsrfToken,
  getCsrfToken,
  csrfMiddleware,
} from "./csrf.js";
import { CsrfError } from "../errors/index.js";
import type { Context } from "hono";

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    APP_URL: "https://app.example.com",
    API_URL: "https://api.example.com",
  },
  isDev: false,
}));

// Mock logger
vi.mock("../lib/logger.js", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("CSRF Protection", () => {
  describe("generateCsrfToken", () => {
    it("should generate a URL-safe base64 token", () => {
      const token = generateCsrfToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(20);
      // Should be URL-safe base64 (no +, /, or = padding)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("setupCsrfToken", () => {
    it("should set CSRF cookie and return token", () => {
      const mockHeader = vi.fn();
      const mockContext = {
        header: mockHeader,
        req: {
          header: vi.fn().mockReturnValue(undefined),
          method: "GET",
          path: "/test",
        },
      } as unknown as Context;

      const token = setupCsrfToken(mockContext);

      expect(token).toBeDefined();
      // Check that header was called with the correct cookie name
      expect(mockHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringMatching(new RegExp(`^${CSRF_COOKIE_NAME}=`)),
        { append: true }
      );
      // Check cookie contains required attributes
      const call = mockHeader.mock.calls[0];
      expect(call[1]).toContain("HttpOnly");
      expect(call[1]).toContain("SameSite=Strict");
    });
  });

  describe("getCsrfToken", () => {
    it("should return null when no cookie is present", () => {
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as Context;

      expect(getCsrfToken(mockContext)).toBeNull();
    });

    it("should extract token from cookie", () => {
      const token = generateCsrfToken();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(`${CSRF_COOKIE_NAME}=${token}`),
        },
      } as unknown as Context;

      expect(getCsrfToken(mockContext)).toBe(token);
    });

    it("should handle multiple cookies", () => {
      const token = generateCsrfToken();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(
            `other=value; ${CSRF_COOKIE_NAME}=${token}; another=cookie`
          ),
        },
      } as unknown as Context;

      expect(getCsrfToken(mockContext)).toBe(token);
    });
  });

  describe("csrfMiddleware", () => {
    const createMockContext = (options: {
      method?: string;
      cookie?: string;
      csrfHeader?: string;
      authorization?: string;
      origin?: string;
    } = {}) => {
      const headers: Record<string, string | undefined> = {};
      if (options.cookie) {
        headers["cookie"] = options.cookie;
      }
      if (options.csrfHeader) {
        headers[CSRF_HEADER_NAME] = options.csrfHeader; // X-CSRF-Token
      }
      if (options.authorization) {
        headers["authorization"] = options.authorization;
      }
      if (options.origin) {
        headers["origin"] = options.origin;
      }

      // Hono's header() method is case-insensitive for lookups
      const getHeader = (name: string): string | undefined => {
        const lowerName = name.toLowerCase();
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === lowerName) {
            return headers[key];
          }
        }
        return undefined;
      };

      return {
        req: {
          method: options.method || "GET",
          path: "/test",
          header: getHeader,
        },
        header: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
      } as unknown as Context;
    };

    it("should allow GET requests without CSRF token", async () => {
      const mockContext = createMockContext({ method: "GET" });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow bearer token requests without CSRF validation", async () => {
      const mockContext = createMockContext({
        method: "POST",
        authorization: "Bearer test-token",
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow requests without cookies (no session)", async () => {
      const mockContext = createMockContext({
        method: "POST",
        // No cookie header
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject POST requests with cookies but no CSRF header", async () => {
      const token = generateCsrfToken();
      const mockContext = createMockContext({
        method: "POST",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${token}`,
        // No X-CSRF-Token header
      });
      const mockNext = vi.fn();

      await expect(csrfMiddleware()(mockContext, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject POST requests with mismatched CSRF tokens", async () => {
      const cookieToken = generateCsrfToken();
      const headerToken = generateCsrfToken(); // Different token
      const mockContext = createMockContext({
        method: "POST",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${cookieToken}`,
        csrfHeader: headerToken,
      });
      const mockNext = vi.fn();

      await expect(csrfMiddleware()(mockContext, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow POST requests with valid CSRF token", async () => {
      const token = generateCsrfToken();
      const mockContext = createMockContext({
        method: "POST",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${token}`,
        csrfHeader: token,
        origin: "https://app.example.com",
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow PUT requests with valid CSRF token", async () => {
      const token = generateCsrfToken();
      const mockContext = createMockContext({
        method: "PUT",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${token}`,
        csrfHeader: token,
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow PATCH requests with valid CSRF token", async () => {
      const token = generateCsrfToken();
      const mockContext = createMockContext({
        method: "PATCH",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${token}`,
        csrfHeader: token,
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow DELETE requests with valid CSRF token", async () => {
      const token = generateCsrfToken();
      const mockContext = createMockContext({
        method: "DELETE",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${token}`,
        csrfHeader: token,
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject requests with invalid origin", async () => {
      const token = generateCsrfToken();
      const mockContext = createMockContext({
        method: "POST",
        cookie: `bush_session=test-session; ${CSRF_COOKIE_NAME}=${token}`,
        csrfHeader: token,
        origin: "https://malicious-site.com",
      });
      const mockNext = vi.fn();

      await expect(csrfMiddleware()(mockContext, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests with wos-session cookie without CSRF token", async () => {
      const mockContext = createMockContext({
        method: "POST",
        cookie: "wos-session=workos-session-value",
        // No CSRF token
      });
      const mockNext = vi.fn();

      await expect(csrfMiddleware()(mockContext, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should set CSRF cookie for safe requests if not present", async () => {
      const mockContext = createMockContext({
        method: "GET",
        // No cookies
      });
      const mockNext = vi.fn();

      await csrfMiddleware()(mockContext, mockNext);

      // Check that header was called with the correct cookie name
      expect(mockContext.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringMatching(new RegExp(`^${CSRF_COOKIE_NAME}=`)),
        { append: true }
      );
    });
  });
});
