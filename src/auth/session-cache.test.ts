/**
 * Bush Platform - Session Cache Tests
 *
 * Tests for Redis-backed session cache operations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sessionCache,
  generateSessionId,
  SESSION_COOKIE_NAME,
  parseSessionCookie,
} from "./session-cache.js";
import type { SessionData } from "./types.js";

// Mock multi chain
const mockMultiChain = {
  setex: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue(["OK"]),
};

// Mock Redis
const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
  keys: vi.fn(),
  scan: vi.fn(),
  watch: vi.fn(),
  multi: vi.fn(() => mockMultiChain),
  unwatch: vi.fn(),
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
    // Restore multi chain and mock implementations after clearAllMocks
    mockMultiChain.setex.mockReturnThis();
    mockMultiChain.exec.mockResolvedValue(["OK"]);
    mockRedis.multi.mockReturnValue(mockMultiChain);
    mockRedis.scan.mockResolvedValue(["0", []]);
    mockRedis.watch.mockResolvedValue("OK");
    mockRedis.unwatch.mockResolvedValue("OK");
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
    it("should update session using WATCH/MULTI transaction", async () => {
      const existingSession = { ...mockSession, displayName: "Old Name" };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));

      const result = await sessionCache.update(
        mockSession.userId,
        mockSession.sessionId,
        { displayName: "New Name" }
      );

      expect(result).toBe(true);
      expect(mockRedis.watch).toHaveBeenCalled();
      expect(mockRedis.multi).toHaveBeenCalled();
      expect(mockMultiChain.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining("New Name")
      );
      expect(mockMultiChain.exec).toHaveBeenCalled();
    });

    it("should return false if session does not exist", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await sessionCache.update("nonexistent", "session", {
        displayName: "New Name",
      });

      expect(result).toBe(false);
      expect(mockRedis.unwatch).toHaveBeenCalled();
    });

    it("should update lastActivityAt", async () => {
      const oldTime = Date.now() - 10000;
      const existingSession = { ...mockSession, lastActivityAt: oldTime };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));

      await sessionCache.update(mockSession.userId, mockSession.sessionId, {});

      const storedValue = JSON.parse(mockMultiChain.setex.mock.calls[0][2]);
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

      await sessionCache.touch(mockSession.userId, mockSession.sessionId);

      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it("should not update if lastActivityAt is recent", async () => {
      const recentTime = Date.now() - 60 * 1000; // 1 minute ago
      const existingSession = { ...mockSession, lastActivityAt: recentTime };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));

      await sessionCache.touch(mockSession.userId, mockSession.sessionId);

      expect(mockRedis.multi).not.toHaveBeenCalled();
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
      mockRedis.scan.mockResolvedValueOnce(["0", [
        "session:usr_abc123:session1",
        "session:usr_abc123:session2",
      ]]);
      mockRedis.del.mockResolvedValueOnce(2);

      const result = await sessionCache.deleteAllForUser(mockSession.userId);

      expect(result).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith(
        "session:usr_abc123:session1",
        "session:usr_abc123:session2"
      );
    });

    it("should return 0 if no sessions exist", async () => {
      mockRedis.scan.mockResolvedValueOnce(["0", []]);

      const result = await sessionCache.deleteAllForUser(mockSession.userId);

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("getSessionIds", () => {
    it("should return all session IDs for a user", async () => {
      mockRedis.scan.mockResolvedValueOnce(["0", [
        "session:usr_abc123:session1",
        "session:usr_abc123:session2",
      ]]);

      const result = await sessionCache.getSessionIds(mockSession.userId);

      expect(result).toEqual(["session1", "session2"]);
    });
  });

  describe("switchAccount", () => {
    it("should update account context in session", async () => {
      const existingSession = { ...mockSession };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(existingSession));

      const result = await sessionCache.switchAccount(
        mockSession.userId,
        mockSession.sessionId,
        "acc_new",
        "member"
      );

      expect(result).toBe(true);
      expect(mockMultiChain.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining("acc_new")
      );
    });
  });

  describe("invalidateOnRoleChange", () => {
    it("should invalidate sessions for account matching role change", async () => {
      mockRedis.scan.mockResolvedValueOnce(["0", [
        "session:usr_abc123:session1",
        "session:usr_abc123:session2",
      ]]);
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

  it("should return null for empty cookie header", () => {
    const result = parseSessionCookie("");
    expect(result).toBeNull();
  });

  it("should return null when cookie value has no colon separator", () => {
    const cookieHeader = `${SESSION_COOKIE_NAME}=invalidnocolon`;
    const result = parseSessionCookie(cookieHeader);
    expect(result).toBeNull();
  });

  it("should handle cookie with special characters in values", () => {
    const cookieHeader = `${SESSION_COOKIE_NAME}=usr_abc-123:session_xyz-789`;
    const result = parseSessionCookie(cookieHeader);
    expect(result).toEqual({
      userId: "usr_abc-123",
      sessionId: "session_xyz-789",
    });
  });

  it("should handle cookie with only colon", () => {
    const cookieHeader = `${SESSION_COOKIE_NAME}=:`;
    const result = parseSessionCookie(cookieHeader);
    // Empty userId or sessionId - implementation returns empty strings
    expect(result).toEqual({ userId: "", sessionId: "" });
  });

  it("should parse signed cookie format (base64url.signature)", () => {
    // Create a signed cookie value that will pass verification
    // The format is: base64url(JSON{userId, sessionId}).signature
    // We need to mock the verifyCookieSignature to return true for this test
    const payload = Buffer.from(JSON.stringify({ userId: "usr_123", sessionId: "sess_456" })).toString("base64url");
    // Note: signature variable not used since we can't easily mock verifyCookieSignature

    // Since we can't easily mock the internal verifyCookieSignature function,
    // we test that the parseSessionCookie handles the format correctly
    // by testing what happens when the signature is invalid
    const cookieHeader = `${SESSION_COOKIE_NAME}=${payload}.invalid_signature`;
    const result = parseSessionCookie(cookieHeader);

    // Should return null when signature verification fails
    expect(result).toBeNull();
  });

  it("should reject cookie with invalid signature", () => {
    const payload = Buffer.from(JSON.stringify({ userId: "usr_123", sessionId: "sess_456" })).toString("base64url");
    const cookieHeader = `${SESSION_COOKIE_NAME}=${payload}.bad_signature`;
    const result = parseSessionCookie(cookieHeader);

    // Should return null when signature is invalid
    expect(result).toBeNull();
  });

  it("should handle malformed signed cookie payload", () => {
    const cookieHeader = `${SESSION_COOKIE_NAME}=invalid_base64.signature`;
    const result = parseSessionCookie(cookieHeader);

    // Should return null for malformed base64
    expect(result).toBeNull();
  });

  it("should handle signed cookie with missing fields", () => {
    const payload = Buffer.from(JSON.stringify({ userId: "usr_123" })).toString("base64url");
    const cookieHeader = `${SESSION_COOKIE_NAME}=${payload}.signature`;
    const result = parseSessionCookie(cookieHeader);

    // Should return null when sessionId is missing
    expect(result).toBeNull();
  });
});

describe("SESSION_COOKIE_NAME", () => {
  it("should be 'bush_session'", () => {
    expect(SESSION_COOKIE_NAME).toBe("bush_session");
  });
});

describe("createSignedCookieValue", () => {
  it("should create a signed cookie value with correct format", async () => {
    const { createSignedCookieValue } = await import("./session-cache.js");
    const userId = "usr_test123";
    const sessionId = "sess_abc456";

    const result = createSignedCookieValue(userId, sessionId);

    // Format should be: base64url(JSON{userId, sessionId}).signature
    expect(result).toContain(".");
    const parts = result.split(".");
    expect(parts).toHaveLength(2);

    // Decode the payload to verify
    const decoded = Buffer.from(parts[0], "base64url").toString();
    const parsed = JSON.parse(decoded);
    expect(parsed.userId).toBe(userId);
    expect(parsed.sessionId).toBe(sessionId);
  });

  it("should create verifiable signatures", async () => {
    const { createSignedCookieValue, parseSessionCookie } = await import("./session-cache.js");
    const userId = "usr_test123";
    const sessionId = "sess_abc456";

    const signedValue = createSignedCookieValue(userId, sessionId);
    const cookieHeader = `${SESSION_COOKIE_NAME}=${signedValue}`;

    const result = parseSessionCookie(cookieHeader);

    expect(result).toEqual({
      userId,
      sessionId,
    });
  });
});

describe("parseSessionCookie legacy formats", () => {
  it("should parse legacy base64 JSON format", () => {
    // Legacy format: base64(JSON{userId, sessionId}) without signature
    const payload = Buffer.from(JSON.stringify({
      userId: "usr_legacy",
      sessionId: "sess_legacy"
    })).toString("base64"); // Note: base64, not base64url

    const cookieHeader = `${SESSION_COOKIE_NAME}=${payload}`;
    const result = parseSessionCookie(cookieHeader);

    expect(result).toEqual({
      userId: "usr_legacy",
      sessionId: "sess_legacy",
    });
  });

  it("should return null for legacy format with invalid JSON", () => {
    const payload = Buffer.from("not valid json").toString("base64");
    const cookieHeader = `${SESSION_COOKIE_NAME}=${payload}`;
    const result = parseSessionCookie(cookieHeader);

    // Should fall through to plain format check, which will fail
    expect(result).toBeNull();
  });

  it("should parse legacy format with missing sessionId", () => {
    const payload = Buffer.from(JSON.stringify({ userId: "usr_123" })).toString("base64");
    const cookieHeader = `${SESSION_COOKIE_NAME}=${payload}`;
    const result = parseSessionCookie(cookieHeader);

    // Should fall through to plain format, which fails due to colon check
    expect(result).toBeNull();
  });
});

describe("sessionCache.getWithValidation", () => {
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
    mockMultiChain.setex.mockReturnThis();
    mockMultiChain.exec.mockResolvedValue(["OK"]);
    mockRedis.multi.mockReturnValue(mockMultiChain);
    mockRedis.scan.mockResolvedValue(["0", []]);
    mockRedis.watch.mockResolvedValue("OK");
    mockRedis.unwatch.mockResolvedValue("OK");
  });

  it("should return session when userId matches", async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockSession));

    const result = await sessionCache.getWithValidation(
      mockSession.userId,
      mockSession.sessionId
    );

    expect(result).toEqual(mockSession);
  });

  it("should return null and delete session when userId does not match", async () => {
    const tamperedSession = { ...mockSession, userId: "usr_different" };
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(tamperedSession));
    mockRedis.del.mockResolvedValueOnce(1);

    const result = await sessionCache.getWithValidation(
      "usr_abc123", // Different from session's userId
      mockSession.sessionId
    );

    expect(result).toBeNull();
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it("should return null when session not found", async () => {
    mockRedis.get.mockResolvedValueOnce(null);

    const result = await sessionCache.getWithValidation("nonexistent", "session");

    expect(result).toBeNull();
  });
});

describe("sessionCache.update retry logic", () => {
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
    mockMultiChain.setex.mockReturnThis();
    mockRedis.multi.mockReturnValue(mockMultiChain);
    mockRedis.scan.mockResolvedValue(["0", []]);
    mockRedis.watch.mockResolvedValue("OK");
    mockRedis.unwatch.mockResolvedValue("OK");
  });

  it("should retry when transaction is aborted", async () => {
    // First attempt: transaction aborted (returns null)
    mockMultiChain.exec.mockResolvedValueOnce(null);
    // Second attempt: success
    mockMultiChain.exec.mockResolvedValueOnce(["OK"]);
    mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));

    const result = await sessionCache.update(
      mockSession.userId,
      mockSession.sessionId,
      { displayName: "New Name" }
    );

    expect(result).toBe(true);
    expect(mockRedis.watch).toHaveBeenCalledTimes(2);
  });

  it("should return false after max retries", async () => {
    // All attempts fail
    mockMultiChain.exec.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));

    const result = await sessionCache.update(
      mockSession.userId,
      mockSession.sessionId,
      { displayName: "New Name" }
    );

    expect(result).toBe(false);
    expect(mockRedis.watch).toHaveBeenCalledTimes(3);
  });

  it("should retry on error and succeed", async () => {
    // First attempt throws
    mockMultiChain.exec.mockRejectedValueOnce(new Error("Redis error"));
    // Second attempt succeeds
    mockMultiChain.exec.mockResolvedValueOnce(["OK"]);
    mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));

    const result = await sessionCache.update(
      mockSession.userId,
      mockSession.sessionId,
      { displayName: "New Name" }
    );

    expect(result).toBe(true);
    expect(mockRedis.watch).toHaveBeenCalledTimes(2);
  });

  it("should return false after errors exhaust retries", async () => {
    mockMultiChain.exec.mockRejectedValue(new Error("Redis error"));
    mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));

    const result = await sessionCache.update(
      mockSession.userId,
      mockSession.sessionId,
      { displayName: "New Name" }
    );

    expect(result).toBe(false);
    expect(mockRedis.watch).toHaveBeenCalledTimes(3);
  });
});
