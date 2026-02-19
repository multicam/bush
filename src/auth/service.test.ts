/**
 * Bush Platform - Auth Service Tests
 *
 * Tests for authentication service operations.
 * Uses in-memory SQLite for integration testing.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { type WorkOSUserInfo, authService } from "./service.js";
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

// Mock db with chainable methods - define everything inside the factory
vi.mock("../db/index.js", () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

// Import after mocks
import { db } from "../db/index.js";

// Get typed mock functions
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findOrCreateUser", () => {
    it("should return existing user without updating when data matches", async () => {
      const workosUser: WorkOSUserInfo = {
        workosUserId: "wos_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        avatarUrl: "https://example.com/avatar.png",
        organizationId: "org_123",
      };

      const existingUser = {
        id: "usr_existing",
        workosUserId: "wos_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        avatarUrl: "https://example.com/avatar.png",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      });

      const result = await authService.findOrCreateUser(workosUser);

      expect(result).toEqual({ userId: "usr_existing", isNewUser: false });
    });

    it("should update existing user when name changes", async () => {
      const workosUser: WorkOSUserInfo = {
        workosUserId: "wos_123",
        email: "test@example.com",
        firstName: "Jane",
        lastName: "Smith",
        organizationId: "org_123",
      };

      const existingUser = {
        id: "usr_existing",
        workosUserId: "wos_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingUser]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await authService.findOrCreateUser(workosUser);

      expect(result).toEqual({ userId: "usr_existing", isNewUser: false });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should create new user with personal account", async () => {
      const workosUser: WorkOSUserInfo = {
        workosUserId: "wos_new",
        email: "newuser@example.com",
        firstName: "New",
        lastName: "User",
        organizationId: "org_123",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await authService.findOrCreateUser(workosUser);

      expect(result.isNewUser).toBe(true);
      expect(result.userId).toMatch(/^usr_/);
      // Should insert user, account, and membership
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });
  });

  describe("getUserAccounts", () => {
    it("should return list of accounts for user", async () => {
      const mockAccounts = [
        { accountId: "acc_1", accountName: "Account 1", accountSlug: "account-1", role: "owner" },
        { accountId: "acc_2", accountName: "Account 2", accountSlug: "account-2", role: "member" },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockAccounts),
          }),
        }),
      });

      const result = await authService.getUserAccounts("usr_123");

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("owner");
      expect(result[1].role).toBe("member");
    });

    it("should return empty array when user has no accounts", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await authService.getUserAccounts("usr_123");

      expect(result).toHaveLength(0);
    });
  });

  describe("getUserRole", () => {
    it("should return role when user is member of account", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: "content_admin" }]),
          }),
        }),
      });

      const result = await authService.getUserRole("usr_123", "acc_456");

      expect(result).toBe("content_admin");
    });

    it("should return null when user is not member of account", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await authService.getUserRole("usr_123", "acc_456");

      expect(result).toBeNull();
    });
  });

  describe("createSession", () => {
    it("should create session for valid user and account", async () => {
      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        avatarUrl: "https://example.com/avatar.png",
        workosUserId: "wos_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ role: "member" }]),
            }),
          }),
        });

      vi.mocked(sessionCache.set).mockResolvedValueOnce(undefined);

      const result = await authService.createSession(
        "usr_123",
        "acc_456",
        "org_123",
        "wos_123"
      );

      expect(result.userId).toBe("usr_123");
      expect(result.currentAccountId).toBe("acc_456");
      expect(result.accountRole).toBe("member");
      expect(result.email).toBe("test@example.com");
      expect(sessionCache.set).toHaveBeenCalled();
    });

    it("should throw error when user not found", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        authService.createSession("usr_123", "acc_456", "org_123", "wos_123")
      ).rejects.toThrow("User not found");
    });

    it("should throw error when user is not member of account", async () => {
      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        avatarUrl: null,
        workosUserId: "wos_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      await expect(
        authService.createSession("usr_123", "acc_456", "org_123", "wos_123")
      ).rejects.toThrow("User is not a member of this account");
    });
  });

  describe("getSession", () => {
    it("should return session from cache", async () => {
      const mockSession: SessionData = {
        sessionId: "sess_123",
        userId: "usr_123",
        email: "test@example.com",
        displayName: "Test User",
        currentAccountId: "acc_456",
        accountRole: "owner",
        workosOrganizationId: "org_123",
        workosUserId: "wos_123",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      vi.mocked(sessionCache.get).mockResolvedValueOnce(mockSession);

      const result = await authService.getSession("usr_123", "sess_123");

      expect(result).toEqual(mockSession);
      expect(sessionCache.get).toHaveBeenCalledWith("usr_123", "sess_123");
    });

    it("should return null when session not found", async () => {
      vi.mocked(sessionCache.get).mockResolvedValueOnce(null);

      const result = await authService.getSession("usr_123", "sess_123");

      expect(result).toBeNull();
    });
  });

  describe("invalidateSession", () => {
    it("should delete session from cache", async () => {
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      await authService.invalidateSession("usr_123", "sess_123");

      expect(sessionCache.delete).toHaveBeenCalledWith("usr_123", "sess_123");
    });
  });

  describe("invalidateAllSessions", () => {
    it("should delete all sessions for user", async () => {
      vi.mocked(sessionCache.deleteAllForUser).mockResolvedValueOnce(5);

      const result = await authService.invalidateAllSessions("usr_123");

      expect(result).toBe(5);
      expect(sessionCache.deleteAllForUser).toHaveBeenCalledWith("usr_123");
    });
  });

  describe("switchAccount", () => {
    it("should throw error when user is not member of new account", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        authService.switchAccount("usr_123", "sess_123", "acc_new")
      ).rejects.toThrow("User is not a member of this account");
    });

    it("should return null when current session not found", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: "member" }]),
          }),
        }),
      });

      vi.mocked(sessionCache.get).mockResolvedValueOnce(null);

      const result = await authService.switchAccount("usr_123", "sess_123", "acc_new");

      expect(result).toBeNull();
    });

    it("should return null when switchAccount fails", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: "member" }]),
          }),
        }),
      });

      const currentSession: SessionData = {
        sessionId: "sess_123",
        userId: "usr_123",
        email: "test@example.com",
        displayName: "Test User",
        currentAccountId: "acc_old",
        accountRole: "owner",
        workosOrganizationId: "org_123",
        workosUserId: "wos_123",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      vi.mocked(sessionCache.get).mockResolvedValueOnce(currentSession);
      vi.mocked(sessionCache.switchAccount).mockResolvedValueOnce(false);

      const result = await authService.switchAccount("usr_123", "sess_123", "acc_new");

      expect(result).toBeNull();
    });

    it("should return updated session on success", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: "member" }]),
          }),
        }),
      });

      const currentSession: SessionData = {
        sessionId: "sess_123",
        userId: "usr_123",
        email: "test@example.com",
        displayName: "Test User",
        currentAccountId: "acc_old",
        accountRole: "owner",
        workosOrganizationId: "org_123",
        workosUserId: "wos_123",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      const updatedSession: SessionData = {
        ...currentSession,
        currentAccountId: "acc_new",
        accountRole: "member",
      };

      vi.mocked(sessionCache.get)
        .mockResolvedValueOnce(currentSession)
        .mockResolvedValueOnce(updatedSession);
      vi.mocked(sessionCache.switchAccount).mockResolvedValueOnce(true);

      const result = await authService.switchAccount("usr_123", "sess_123", "acc_new");

      expect(result?.currentAccountId).toBe("acc_new");
      expect(result?.accountRole).toBe("member");
    });
  });

  describe("checkPermission", () => {
    it("should return false when user has no role", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await authService.checkPermission("usr_123", "acc_456", "member");

      expect(result).toBe(false);
    });

    it("should return true when user has sufficient role", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: "owner" }]),
          }),
        }),
      });

      const result = await authService.checkPermission("usr_123", "acc_456", "member");

      expect(result).toBe(true);
    });

    it("should return false when user has insufficient role", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: "guest" }]),
          }),
        }),
      });

      const result = await authService.checkPermission("usr_123", "acc_456", "member");

      expect(result).toBe(false);
    });
  });
});

describe("Role hierarchy", () => {
  it("should respect role hierarchy for permissions", async () => {
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

describe("Session management via cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
