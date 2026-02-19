/**
 * Tests for auth module index exports
 */
import { describe, it, expect } from "vitest";
import { sessionCache, generateSessionId, authService } from "./index.js";
import * as authTypes from "./types.js";

describe("auth index exports", () => {
  describe("sessionCache", () => {
    it("exports sessionCache object", () => {
      expect(sessionCache).toBeDefined();
    });

    it("has get method", () => {
      expect(typeof sessionCache.get).toBe("function");
    });

    it("has set method", () => {
      expect(typeof sessionCache.set).toBe("function");
    });

    it("has delete method", () => {
      expect(typeof sessionCache.delete).toBe("function");
    });

    it("has deleteAllForUser method", () => {
      expect(typeof sessionCache.deleteAllForUser).toBe("function");
    });

    it("has update method", () => {
      expect(typeof sessionCache.update).toBe("function");
    });

    it("has touch method", () => {
      expect(typeof sessionCache.touch).toBe("function");
    });

    it("has getWithValidation method", () => {
      expect(typeof sessionCache.getWithValidation).toBe("function");
    });

    it("has getSessionIds method", () => {
      expect(typeof sessionCache.getSessionIds).toBe("function");
    });

    it("has switchAccount method", () => {
      expect(typeof sessionCache.switchAccount).toBe("function");
    });

    it("has invalidateOnRoleChange method", () => {
      expect(typeof sessionCache.invalidateOnRoleChange).toBe("function");
    });
  });

  describe("generateSessionId", () => {
    it("exports generateSessionId function", () => {
      expect(typeof generateSessionId).toBe("function");
    });

    it("generates unique session IDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("authService", () => {
    it("exports authService object", () => {
      expect(authService).toBeDefined();
    });

    it("has findOrCreateUser method", () => {
      expect(typeof authService.findOrCreateUser).toBe("function");
    });

    it("has getUserAccounts method", () => {
      expect(typeof authService.getUserAccounts).toBe("function");
    });

    it("has getUserRole method", () => {
      expect(typeof authService.getUserRole).toBe("function");
    });

    it("has createSession method", () => {
      expect(typeof authService.createSession).toBe("function");
    });

    it("has getSession method", () => {
      expect(typeof authService.getSession).toBe("function");
    });

    it("has invalidateSession method", () => {
      expect(typeof authService.invalidateSession).toBe("function");
    });

    it("has invalidateAllSessions method", () => {
      expect(typeof authService.invalidateAllSessions).toBe("function");
    });

    it("has switchAccount method", () => {
      expect(typeof authService.switchAccount).toBe("function");
    });

    it("has checkPermission method", () => {
      expect(typeof authService.checkPermission).toBe("function");
    });
  });

  describe("type exports", () => {
    it("re-exports AccountRole type", () => {
      // Type check at compile time - owner is a valid AccountRole
      const role: authTypes.AccountRole = "owner";
      expect(role).toBe("owner");
    });

    it("exports isRoleAtLeast function", () => {
      expect(typeof authTypes.isRoleAtLeast).toBe("function");
    });

    it("exports hasCapability function", () => {
      expect(typeof authTypes.hasCapability).toBe("function");
    });

    it("exports ROLE_CAPABILITIES constant", () => {
      expect(authTypes.ROLE_CAPABILITIES).toBeDefined();
    });

    it("exports ROLE_HIERARCHY constant", () => {
      expect(authTypes.ROLE_HIERARCHY).toBeDefined();
    });

    it("isRoleAtLeast works correctly", () => {
      expect(authTypes.isRoleAtLeast("owner", "member")).toBe(true);
      expect(authTypes.isRoleAtLeast("guest", "member")).toBe(false);
    });

    it("hasCapability works correctly", () => {
      expect(authTypes.hasCapability("owner", "billing:read")).toBe(true);
      expect(authTypes.hasCapability("guest", "billing:read")).toBe(false);
    });

    it("ROLE_HIERARCHY is ordered correctly", () => {
      expect(authTypes.ROLE_HIERARCHY).toEqual([
        "reviewer",
        "guest",
        "member",
        "content_admin",
        "owner",
      ]);
    });

    it("ROLE_CAPABILITIES has all roles", () => {
      expect(Object.keys(authTypes.ROLE_CAPABILITIES)).toEqual([
        "owner",
        "content_admin",
        "member",
        "guest",
        "reviewer",
      ]);
    });
  });
});
