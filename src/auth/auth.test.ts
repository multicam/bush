/**
 * Bush Platform - Authentication Tests
 *
 * Tests for session cache, auth types, and service functions.
 */
import { describe, it, expect } from "vitest";
import {
  getSessionCacheKey,
  hasCapability,
  isRoleAtLeast,
  ROLE_CAPABILITIES,
} from "./types.js";

describe("Auth Types", () => {
  describe("getSessionCacheKey", () => {
    it("should generate correct cache key format", () => {
      const key = getSessionCacheKey("user_123", "session_abc");
      expect(key).toBe("session:user_123:session_abc");
    });
  });

  describe("ROLE_CAPABILITIES", () => {
    it("should have owner with most capabilities", () => {
      expect(ROLE_CAPABILITIES.owner.length).toBeGreaterThan(ROLE_CAPABILITIES.member.length);
      expect(ROLE_CAPABILITIES.owner).toContain("billing:read");
      expect(ROLE_CAPABILITIES.owner).toContain("billing:write");
    });

    it("should have reviewer with least capabilities", () => {
      expect(ROLE_CAPABILITIES.reviewer).toContain("content:read");
      expect(ROLE_CAPABILITIES.reviewer).not.toContain("content:write");
    });

    it("should have guest limited to content:read", () => {
      expect(ROLE_CAPABILITIES.guest).toContain("content:read");
      expect(ROLE_CAPABILITIES.guest).not.toContain("content:write");
      expect(ROLE_CAPABILITIES.guest).not.toContain("shares:write");
    });
  });

  describe("hasCapability", () => {
    it("should return true for owner with any capability", () => {
      expect(hasCapability("owner", "billing:read")).toBe(true);
      expect(hasCapability("owner", "content:delete")).toBe(true);
    });

    it("should return false for reviewer with write capabilities", () => {
      expect(hasCapability("reviewer", "content:write")).toBe(false);
      expect(hasCapability("reviewer", "shares:write")).toBe(false);
    });

    it("should return true for member with allowed capabilities", () => {
      expect(hasCapability("member", "content:read")).toBe(true);
      expect(hasCapability("member", "content:write")).toBe(true);
      expect(hasCapability("member", "shares:write")).toBe(true);
    });

    it("should return false for member with restricted capabilities", () => {
      expect(hasCapability("member", "billing:read")).toBe(false);
      expect(hasCapability("member", "users:delete")).toBe(false);
    });
  });

  describe("isRoleAtLeast", () => {
    it("should correctly compare roles in hierarchy", () => {
      // Owner is at least any role
      expect(isRoleAtLeast("owner", "content_admin")).toBe(true);
      expect(isRoleAtLeast("owner", "member")).toBe(true);
      expect(isRoleAtLeast("owner", "guest")).toBe(true);

      // Content admin is at least member but not owner
      expect(isRoleAtLeast("content_admin", "member")).toBe(true);
      expect(isRoleAtLeast("content_admin", "owner")).toBe(false);

      // Member is at least guest but not content_admin
      expect(isRoleAtLeast("member", "guest")).toBe(true);
      expect(isRoleAtLeast("member", "content_admin")).toBe(false);

      // Guest is at least reviewer but not member
      expect(isRoleAtLeast("guest", "reviewer")).toBe(true);
      expect(isRoleAtLeast("guest", "member")).toBe(false);
    });

    it("should return true for equal roles", () => {
      expect(isRoleAtLeast("owner", "owner")).toBe(true);
      expect(isRoleAtLeast("member", "member")).toBe(true);
      expect(isRoleAtLeast("reviewer", "reviewer")).toBe(true);
    });
  });
});
