/**
 * Bush Platform - Session Cookie Utility Tests
 */
import { describe, it, expect } from "vitest";
import {
  BUSH_SESSION_COOKIE,
  encodeSessionCookie,
  decodeSessionCookie,
} from "./session-cookie.js";
import type { SessionData } from "../../auth/types.js";

describe("session-cookie", () => {
  const mockSession: SessionData = {
    sessionId: "test-session-id",
    userId: "usr_123",
    email: "test@example.com",
    displayName: "Test User",
    currentAccountId: "acc_456",
    accountRole: "owner",
    workosOrganizationId: "org_789",
    workosUserId: "workos_123",
    createdAt: 1700000000000,
    lastActivityAt: 1700000000000,
  };

  it("should export the correct cookie name", () => {
    expect(BUSH_SESSION_COOKIE).toBe("bush_session");
  });

  it("should round-trip encode/decode a session", () => {
    const encoded = encodeSessionCookie(mockSession);
    const decoded = decodeSessionCookie(encoded);
    expect(decoded).toEqual(mockSession);
  });

  it("should return null for invalid base64", () => {
    expect(decodeSessionCookie("not-valid!!!")).toBeNull();
  });

  it("should return null for invalid JSON in base64", () => {
    const encoded = Buffer.from("not json").toString("base64");
    expect(decodeSessionCookie(encoded)).toBeNull();
  });

  it("should handle partial session data", () => {
    const partial = { userId: "usr_123", email: "test@example.com" };
    const encoded = encodeSessionCookie(partial);
    const decoded = decodeSessionCookie(encoded);
    expect(decoded).toEqual(partial);
  });
});
