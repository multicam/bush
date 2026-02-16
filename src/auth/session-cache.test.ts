/**
 * Bush Platform - Session Cache Tests
 *
 * Tests for Redis-backed session cache operations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sessionCache,
  generateSessionId,
  SESSION_COOKIE_NAME,
  parseSessionCookie,
} from "./session-cache.js";
import type { SessionData } from "./types.js";

// Mock Redis
const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
  keys: vi.fn(),
};

vi.mock("../redis/index.js", () => ({
  getRedis: () => mockRedis,
}));

describe("sessionCache", () => {
  const mockSession: SessionData = {
    sessionId: "test-session-123",
    userId: "usr_abc123",
    email: "test@example.com",
    displayName: "Test User",
    currentAccountId: "acc_xyz789",
    accountRole: "owner",
    workosOrganizationId: "org_workos123",
    workosUserId: "user_workos456",
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("set", () => {
    it("should store session in Redis with default TTL", async () => {
      mockRedis.setex.mockResolvedValueOnce("OK");

      await sessionCache.set(mockSession);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `session:${mockSession.userId}:${mockSession.sessionId}`,
        7 * 24 * 60 * 60, // 7 days in seconds
        JSON.stringify(mockSession)
      );
    });

    it("should store session with custom TTL", async () => {
      mockRedis.setex.mockResolvedValueOnce("OK");

      await sessionCache.set(mockSession, 3600); // 1 hour

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        3600,
        expect.any(String)
      );
    });
  });

  describe("get", () => {
    it("should retrieve session from Redis", async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockSession));

      const result = await sessionCache.get(mockSession.userId, mockSession.sessionId);

      expect(result).toEqual(mockSession);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `session:${mockSession.userId}:${mockSession.sessionId}`
      );
    });

    it("should return null if session not found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await sessionCache.get("nonexistent", "session");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update session and preserve TTL", async () => {
      const existingSession = { ...mockSession, displayName: "Old Name" };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));
      mockRedis.ttl.mockResolvedValueOnce(5000);
      mockRedis.setex.mockResolvedValueOnce("OK");

      const result = await sessionCache.update(
        mockSession.userId,
        mockSession.sessionId,
        { displayName: "New Name" }
      );

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        5000, // preserved TTL
        expect.stringContaining("New Name")
      );
    });

    it("should return false if session does not exist", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await sessionCache.update("nonexistent", "session", {
        displayName: "New Name",
      });

      expect(result).toBe(false);
    });

    it("should update lastActivityAt", async () => {
      const oldTime = Date.now() - 10000;
      const existingSession = { ...mockSession, lastActivityAt: oldTime };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));
      mockRedis.ttl.mockResolvedValueOnce(5000);
      mockRedis.setex.mockResolvedValueOnce("OK");

      await sessionCache.update(mockSession.userId, mockSession.sessionId, {});

      const storedValue = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(storedValue.lastActivityAt).toBeGreaterThan(oldTime);
    });
  });

  describe("touch", () => {
    it("should update lastActivityAt if more than 5 minutes old", async () => {
      const oldTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const existingSession = { ...mockSession, lastActivityAt: oldTime };
      // First get call in touch(), second get call in update()
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(existingSession))
        .mockResolvedValueOnce(JSON.stringify(existingSession));
      mockRedis.ttl.mockResolvedValueOnce(5000);
      mockRedis.setex.mockResolvedValueOnce("OK");

      await sessionCache.touch(mockSession.userId, mockSession.sessionId);

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it("should not update if lastActivityAt is recent", async () => {
      const recentTime = Date.now() - 60 * 1000; // 1 minute ago
      const existingSession = { ...mockSession, lastActivityAt: recentTime };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));

      await sessionCache.touch(mockSession.userId, mockSession.sessionId);

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete session from Redis", async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await sessionCache.delete(mockSession.userId, mockSession.sessionId);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `session:${mockSession.userId}:${mockSession.sessionId}`
      );
    });
  });

  describe("deleteAllForUser", () => {
    it("should delete all sessions for a user", async () => {
      mockRedis.keys.mockResolvedValueOnce([
        "session:usr_abc123:session1",
        "session:usr_abc123:session2",
      ]);
      mockRedis.del.mockResolvedValueOnce(2);

      const result = await sessionCache.deleteAllForUser(mockSession.userId);

      expect(result).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith(
        "session:usr_abc123:session1",
        "session:usr_abc123:session2"
      );
    });

    it("should return 0 if no sessions exist", async () => {
      mockRedis.keys.mockResolvedValueOnce([]);

      const result = await sessionCache.deleteAllForUser(mockSession.userId);

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("getSessionIds", () => {
    it("should return all session IDs for a user", async () => {
      mockRedis.keys.mockResolvedValueOnce([
        "session:usr_abc123:session1",
        "session:usr_abc123:session2",
      ]);

      const result = await sessionCache.getSessionIds(mockSession.userId);

      expect(result).toEqual(["session1", "session2"]);
    });
  });

  describe("switchAccount", () => {
    it("should update account context in session", async () => {
      const existingSession = { ...mockSession };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));
      mockRedis.ttl.mockResolvedValueOnce(5000);
      mockRedis.setex.mockResolvedValueOnce("OK");
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({ ...existingSession, currentAccountId: "acc_new", accountRole: "member" })
      );

      const result = await sessionCache.switchAccount(
        mockSession.userId,
        mockSession.sessionId,
        "acc_new",
        "member"
      );

      expect(result).toBe(true);
    });
  });

  describe("invalidateOnRoleChange", () => {
    it("should invalidate sessions for account matching role change", async () => {
      mockRedis.keys.mockResolvedValueOnce([
        "session:usr_abc123:session1",
        "session:usr_abc123:session2",
      ]);
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({ ...mockSession, currentAccountId: "acc_xyz789" })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ ...mockSession, currentAccountId: "acc_other" })
        );
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await sessionCache.invalidateOnRoleChange(
        mockSession.userId,
        "acc_xyz789"
      );

      expect(result).toBe(1); // Only session1 was invalidated
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });
  });
});

describe("generateSessionId", () => {
  it("should generate a unique session ID", async () => {
    const id1 = await generateSessionId();
    const id2 = await generateSessionId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(20); // base64url encoded 32 bytes
  });
});

describe("parseSessionCookie", () => {
  it("should parse valid session cookie", () => {
    const cookieHeader = `${SESSION_COOKIE_NAME}=usr_abc123:session_xyz789`;

    const result = parseSessionCookie(cookieHeader);

    expect(result).toEqual({
      userId: "usr_abc123",
      sessionId: "session_xyz789",
    });
  });

  it("should parse session cookie among multiple cookies", () => {
    const cookieHeader = `other=value; ${SESSION_COOKIE_NAME}=usr_abc123:session_xyz789; another=cookie`;

    const result = parseSessionCookie(cookieHeader);

    expect(result).toEqual({
      userId: "usr_abc123",
      sessionId: "session_xyz789",
    });
  });

  it("should return null if session cookie not found", () => {
    const cookieHeader = "other=value; another=cookie";

    const result = parseSessionCookie(cookieHeader);

    expect(result).toBeNull();
  });

  it("should return null if cookie format is invalid", () => {
    const cookieHeader = `${SESSION_COOKIE_NAME}=invalid_format`;

    const result = parseSessionCookie(cookieHeader);

    expect(result).toBeNull();
  });
});
