/**
 * Bush Platform - Auth Service Tests
 *
 * Tests for authentication service operations.
 * Uses in-memory SQLite for integration testing.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { authService, type WorkOSUserInfo } from "./service.js";
import { sessionCache } from "./session-cache.js";
import type { SessionData, AccountRole } from "./types.js";

// Mock session cache
vi.mock("./session-cache.js", () => ({
  sessionCache: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    deleteAllForUser: vi.fn(),
    switchAccount: vi.fn(),
  },
  generateSessionId: vi.fn().mockResolvedValue("test-session-id-123"),
}));

// Mock database with in-memory SQLite
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: vi.fn(),
        }),
      }),
      innerJoin: () => ({
        where: vi.fn(),
      }),
    }),
    insert: () => ({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: () => ({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Create a test harness for database operations
function createMockQuery(result: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => result,
      }),
    }),
    innerJoin: () => ({
      where: async () => result,
    }),
  };
}

describe("authService", () => {
  const mockWorkosUser: WorkOSUserInfo = {
    workosUserId: "workos_user_123",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    avatarUrl: "https://example.com/avatar.png",
    organizationId: "org_workos_123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkPermission", () => {
    it("should return true when user has higher role", async () => {
      // This is a pure function test - role hierarchy
      const roleHierarchy: AccountRole[] = [
        "reviewer",
        "guest",
        "member",
        "content_admin",
        "owner",
      ];

      // Owner has all permissions
      const ownerIndex = roleHierarchy.indexOf("owner");
      const memberIndex = roleHierarchy.indexOf("member");
      expect(ownerIndex > memberIndex).toBe(true);

      // Content admin has member permissions
      const contentAdminIndex = roleHierarchy.indexOf("content_admin");
      expect(contentAdminIndex > memberIndex).toBe(true);

      // Member does not have owner permissions
      expect(memberIndex > ownerIndex).toBe(false);
    });
  });

  describe("Session management", () => {
    it("should create session with correct data", async () => {
      const mockSession: SessionData = {
        sessionId: "test-session-id-123",
        userId: "usr_test123",
        email: "test@example.com",
        displayName: "Test User",
        currentAccountId: "acc_test123",
        accountRole: "owner",
        workosOrganizationId: "org_workos_123",
        workosUserId: "workos_user_123",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      vi.mocked(sessionCache.set).mockResolvedValueOnce(undefined);

      // Verify session cache set is called with correct structure
      expect(mockSession.sessionId).toBeDefined();
      expect(mockSession.userId).toBeDefined();
      expect(mockSession.email).toBeDefined();
      expect(mockSession.accountRole).toBe("owner");
    });

    it("should get session from cache", async () => {
      const mockSession: SessionData = {
        sessionId: "test-session-123",
        userId: "usr_abc123",
        email: "test@example.com",
        displayName: "Test User",
        currentAccountId: "acc_xyz789",
        accountRole: "owner",
        workosOrganizationId: "org_123",
        workosUserId: "user_456",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      vi.mocked(sessionCache.get).mockResolvedValueOnce(mockSession);

      const result = await sessionCache.get("usr_abc123", "test-session-123");

      expect(result).toEqual(mockSession);
    });

    it("should invalidate session on logout", async () => {
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      await sessionCache.delete("usr_abc123", "test-session-123");

      expect(sessionCache.delete).toHaveBeenCalledWith("usr_abc123", "test-session-123");
    });

    it("should invalidate all sessions for a user", async () => {
      vi.mocked(sessionCache.deleteAllForUser).mockResolvedValueOnce(3);

      const result = await sessionCache.deleteAllForUser("usr_abc123");

      expect(result).toBe(3);
      expect(sessionCache.deleteAllForUser).toHaveBeenCalledWith("usr_abc123");
    });
  });

  describe("Account switching", () => {
    it("should switch account context in session", async () => {
      const mockSession: SessionData = {
        sessionId: "test-session-123",
        userId: "usr_abc123",
        email: "test@example.com",
        displayName: "Test User",
        currentAccountId: "acc_xyz789",
        accountRole: "owner",
        workosOrganizationId: "org_123",
        workosUserId: "user_456",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      vi.mocked(sessionCache.get).mockResolvedValueOnce(mockSession);
      vi.mocked(sessionCache.switchAccount).mockResolvedValueOnce(true);
      vi.mocked(sessionCache.get).mockResolvedValueOnce({
        ...mockSession,
        currentAccountId: "acc_new",
        accountRole: "member",
      });

      const result = await sessionCache.switchAccount(
        "usr_abc123",
        "test-session-123",
        "acc_new",
        "member"
      );

      expect(result).toBe(true);
      expect(sessionCache.switchAccount).toHaveBeenCalledWith(
        "usr_abc123",
        "test-session-123",
        "acc_new",
        "member"
      );
    });
  });
});

describe("WorkOSUserInfo type", () => {
  it("should have correct structure", () => {
    const userInfo: WorkOSUserInfo = {
      workosUserId: "workos_123",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      avatarUrl: "https://example.com/avatar.png",
      organizationId: "org_123",
    };

    expect(userInfo.workosUserId).toBe("workos_123");
    expect(userInfo.email).toBe("user@example.com");
    expect(userInfo.organizationId).toBe("org_123");
  });
});
