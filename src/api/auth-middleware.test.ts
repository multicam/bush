/**
 * Bush Platform - Authentication Middleware Tests
 *
 * Unit tests for authentication middleware utilities.
 * Tests the exported middleware functions and helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

// Mock iron-session
vi.mock("iron-session", () => ({
  unsealData: vi.fn(),
}));

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    WORKOS_COOKIE_PASSWORD: "test-workos-password",
    SESSION_SECRET: "test-session-secret-at-least-32-characters",
  },
}));

// Mock session-cache
vi.mock("../auth/session-cache.js", () => ({
  sessionCache: {
    get: vi.fn(),
  },
  parseSessionCookie: vi.fn(),
}));

// Mock auth service
vi.mock("../auth/service.js", () => ({
  authService: {
    findOrCreateUser: vi.fn(),
    getUserAccounts: vi.fn(),
    createSession: vi.fn(),
  },
}));

// Import after mocks are set up
import {
  SESSION_COOKIE_NAME,
  requireAuth,
  getCurrentUserId,
  getCurrentAccountId,
  getCurrentUserRole,
  authMiddleware,
  optionalAuthMiddleware,
} from "./auth-middleware.js";
import type { SessionData } from "../auth/types.js";
import { unsealData } from "iron-session";
import { sessionCache, parseSessionCookie } from "../auth/session-cache.js";
import { authService } from "../auth/service.js";

// Helper to create mock Hono context with full request interface
function createMockContext(session?: SessionData, headers: Record<string, string> = {}): Context {
  const store: Record<string, unknown> = { session };

  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
    header: vi.fn(),
  } as unknown as Context;
}

// Helper to create mock session
function createMockSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: "sess_test123",
    userId: "usr_test123",
    email: "test@example.com",
    displayName: "Test User",
    currentAccountId: "acc_test123",
    accountRole: "member",
    workosOrganizationId: "org_test123",
    workosUserId: "wusr_test123",
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

describe("Authentication Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Constants", () => {
    it("should have correct session cookie name", () => {
      expect(SESSION_COOKIE_NAME).toBe("bush_session");
    });
  });

  describe("requireAuth", () => {
    it("should return session when authenticated", () => {
      const session = createMockSession();
      const c = createMockContext(session);

      const result = requireAuth(c);

      expect(result).toEqual(session);
    });

    it("should throw AuthenticationError when not authenticated", () => {
      const c = createMockContext(undefined);

      expect(() => requireAuth(c)).toThrow("Authentication required");
    });
  });

  describe("getCurrentUserId", () => {
    it("should return user ID when session exists", () => {
      const session = createMockSession({ userId: "usr_abc123" });
      const c = createMockContext(session);

      expect(getCurrentUserId(c)).toBe("usr_abc123");
    });

    it("should return undefined when no session", () => {
      const c = createMockContext(undefined);

      expect(getCurrentUserId(c)).toBeUndefined();
    });
  });

  describe("getCurrentAccountId", () => {
    it("should return account ID when session exists", () => {
      const session = createMockSession({ currentAccountId: "acc_xyz789" });
      const c = createMockContext(session);

      expect(getCurrentAccountId(c)).toBe("acc_xyz789");
    });

    it("should return undefined when no session", () => {
      const c = createMockContext(undefined);

      expect(getCurrentAccountId(c)).toBeUndefined();
    });
  });

  describe("getCurrentUserRole", () => {
    it("should return role when session exists", () => {
      const session = createMockSession({ accountRole: "owner" });
      const c = createMockContext(session);

      expect(getCurrentUserRole(c)).toBe("owner");
    });

    it("should return undefined when no session", () => {
      const c = createMockContext(undefined);

      expect(getCurrentUserRole(c)).toBeUndefined();
    });

    it("should return guest role for guest user", () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext(session);

      expect(getCurrentUserRole(c)).toBe("guest");
    });

    it("should return content_admin role for content admin", () => {
      const session = createMockSession({ accountRole: "content_admin" });
      const c = createMockContext(session);

      expect(getCurrentUserRole(c)).toBe("content_admin");
    });
  });

  describe("authMiddleware", () => {
    it("should authenticate with valid bearer token in bush_tok_ format", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer bush_tok_usr123_sess456",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(sessionCache.get).toHaveBeenCalledWith("usr123", "sess456");
      expect(next).toHaveBeenCalled();
    });

    it("should authenticate with bearer token in userId:sessionId format", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer usr_abc123:sess_xyz789",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(sessionCache.get).toHaveBeenCalledWith("usr_abc123", "sess_xyz789");
      expect(next).toHaveBeenCalled();
    });

    it("should return 401 for invalid bearer token format", async () => {
      const c = createMockContext(undefined, {
        authorization: "Bearer invalid-token",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for bush_key_ prefix (API keys not supported)", async () => {
      const c = createMockContext(undefined, {
        authorization: "Bearer bush_key_abc123",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
      expect(next).not.toHaveBeenCalled();
    });

    it("should authenticate with valid bush_session cookie", async () => {
      const session = createMockSession();
      vi.mocked(parseSessionCookie).mockReturnValue({ userId: "usr_123", sessionId: "sess_456" });
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        cookie: "bush_session=usr_123:sess_456:sig",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(parseSessionCookie).toHaveBeenCalledWith("bush_session=usr_123:sess_456:sig");
      expect(next).toHaveBeenCalled();
    });

    it("should fall back to wos-session cookie when bush_session fails", async () => {
      const session = createMockSession();
      vi.mocked(parseSessionCookie).mockReturnValue({ userId: "usr_123", sessionId: "sess_456" });
      vi.mocked(sessionCache.get).mockResolvedValueOnce(null); // bush_session cache miss

      // Mock WorkOS session extraction
      vi.mocked(unsealData).mockResolvedValueOnce({
        accessToken: "access_token",
        refreshToken: "refresh_token",
        user: {
          id: "wos_user_123",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          profilePictureUrl: "https://example.com/avatar.png",
        },
        organizationId: "org_123",
      });

      vi.mocked(authService.findOrCreateUser).mockResolvedValueOnce({
        userId: "usr_123",
        isNewUser: false,
      });

      vi.mocked(authService.getUserAccounts).mockResolvedValueOnce([
        { accountId: "acc_123", accountName: "Account", accountSlug: "account", role: "owner" },
      ]);

      vi.mocked(authService.createSession).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        cookie: "wos-session=encrypted_value",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(unsealData).toHaveBeenCalled();
      expect(authService.findOrCreateUser).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("should return 401 when no authentication provided", async () => {
      const c = createMockContext(undefined, {});

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when session cache returns null", async () => {
      vi.mocked(sessionCache.get).mockResolvedValueOnce(null);
      vi.mocked(parseSessionCookie).mockReturnValue(null);

      const c = createMockContext(undefined, {
        authorization: "Bearer bush_tok_usr123_sess456",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should set X-Request-Id header", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer usr_123:sess_456",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(c.header).toHaveBeenCalledWith("X-Request-Id", expect.any(String));
    });

    it("should update lastActivityAt on authenticated request", async () => {
      const session = createMockSession();
      const originalActivity = session.lastActivityAt;
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer usr_123:sess_456",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 5));
      await middleware(c, next);

      const updatedSession = c.get("session") as SessionData;
      expect(updatedSession.lastActivityAt).toBeGreaterThanOrEqual(originalActivity);
    });
  });

  describe("optionalAuthMiddleware", () => {
    it("should proceed without authentication when optional", async () => {
      const c = createMockContext(undefined, {});

      const next = vi.fn().mockResolvedValue(undefined);

      await optionalAuthMiddleware(c, next);

      expect(next).toHaveBeenCalled();
    });

    it("should still set request context when optional and not authenticated", async () => {
      const c = createMockContext(undefined, {});

      const next = vi.fn().mockResolvedValue(undefined);

      await optionalAuthMiddleware(c, next);

      expect(c.get("requestContext")).toBeDefined();
    });

    it("should authenticate when valid token provided and optional", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer usr_123:sess_456",
      });

      const next = vi.fn().mockResolvedValue(undefined);

      await optionalAuthMiddleware(c, next);

      expect(c.get("session")).toEqual(session);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("WorkOS session extraction", () => {
    it("should handle unseal errors gracefully", async () => {
      vi.mocked(parseSessionCookie).mockReturnValue(null);
      vi.mocked(unsealData).mockRejectedValueOnce(new Error("Unseal failed"));

      const c = createMockContext(undefined, {
        cookie: "wos-session=invalid_encrypted_value",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should handle missing user in unsealed session", async () => {
      vi.mocked(parseSessionCookie).mockReturnValue(null);
      vi.mocked(unsealData).mockResolvedValueOnce({
        accessToken: "access_token",
        refreshToken: "refresh_token",
        user: null,
      });

      const c = createMockContext(undefined, {
        cookie: "wos-session=encrypted_value",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should handle user with no accounts", async () => {
      vi.mocked(parseSessionCookie).mockReturnValue(null);
      vi.mocked(unsealData).mockResolvedValueOnce({
        accessToken: "access_token",
        refreshToken: "refresh_token",
        user: {
          id: "wos_user_123",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          profilePictureUrl: null,
        },
        organizationId: "org_123",
      });

      vi.mocked(authService.findOrCreateUser).mockResolvedValueOnce({
        userId: "usr_123",
        isNewUser: false,
      });

      vi.mocked(authService.getUserAccounts).mockResolvedValueOnce([]);

      const c = createMockContext(undefined, {
        cookie: "wos-session=encrypted_value",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should handle missing organization ID", async () => {
      const session = createMockSession();
      vi.mocked(parseSessionCookie).mockReturnValue(null);
      vi.mocked(unsealData).mockResolvedValueOnce({
        accessToken: "access_token",
        refreshToken: "refresh_token",
        user: {
          id: "wos_user_123",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          profilePictureUrl: null,
        },
        // No organizationId
      });

      vi.mocked(authService.findOrCreateUser).mockResolvedValueOnce({
        userId: "usr_123",
        isNewUser: false,
      });

      vi.mocked(authService.getUserAccounts).mockResolvedValueOnce([
        { accountId: "acc_123", accountName: "Account", accountSlug: "account", role: "owner" },
      ]);

      vi.mocked(authService.createSession).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        cookie: "wos-session=encrypted_value",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(authService.createSession).toHaveBeenCalledWith(
        "usr_123",
        "acc_123",
        "",
        "wos_user_123"
      );
    });
  });

  describe("Bearer token edge cases", () => {
    it("should handle bearer token with multiple underscores", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer bush_tok_usr123_part1_part2_part3",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      // Token parts: ["bush", "tok", "usr123", "part1", "part2", "part3"]
      // userId = tokenParts[2] = "usr123"
      // sessionId = tokenParts.slice(3).join("_") = "part1_part2_part3"
      expect(sessionCache.get).toHaveBeenCalledWith("usr123", "part1_part2_part3");
    });

    it("should handle bearer token with exactly 3 parts", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer bush_tok_usr123",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      // With exactly 3 parts, sessionId defaults to userId
      expect(sessionCache.get).toHaveBeenCalledWith("usr123", "usr123");
    });

    it("should handle bearer token with less than 3 parts", async () => {
      const c = createMockContext(undefined, {
        authorization: "Bearer bush_tok",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should handle empty authorization header", async () => {
      const c = createMockContext(undefined, {
        authorization: "",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should handle authorization header without Bearer prefix", async () => {
      const c = createMockContext(undefined, {
        authorization: "Basic abc123",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should handle Bearer with only whitespace after", async () => {
      const c = createMockContext(undefined, {
        authorization: "Bearer   ",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();

      await expect(middleware(c, next)).rejects.toThrow("Authentication required");
    });

    it("should trim whitespace from bearer token", async () => {
      const session = createMockSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        authorization: "Bearer   usr_123:sess_456  ",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(sessionCache.get).toHaveBeenCalledWith("usr_123", "sess_456");
    });
  });

  describe("parseCookie helper", () => {
    it("should extract cookie from multiple cookies", async () => {
      const session = createMockSession();
      vi.mocked(parseSessionCookie).mockReturnValue({ userId: "usr_123", sessionId: "sess_456" });
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session);

      const c = createMockContext(undefined, {
        cookie: "session=abc; bush_session=usr_123:sess_456:sig; other=value",
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const middleware = authMiddleware();
      await middleware(c, next);

      expect(parseSessionCookie).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});
