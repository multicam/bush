/**
 * Bush Platform - Authentication Middleware Tests
 *
 * Unit tests for authentication middleware utilities.
 * Tests the exported middleware functions and helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
} from "./auth-middleware.js";
import type { SessionData } from "../auth/types.js";

// Helper to create mock Hono context
function createMockContext(session?: SessionData) {
  const store: Record<string, unknown> = { session };
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as any;
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
});
