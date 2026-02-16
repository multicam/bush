/**
 * Bush Platform - Permission Middleware Tests
 *
 * Unit tests for permission middleware utilities.
 * Integration tests with the database are in permissions-integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

// Mock the permission service
vi.mock("./service.js", () => ({
  permissionService: {
    canPerformAction: vi.fn(),
    getWorkspacePermission: vi.fn(),
    getProjectPermission: vi.fn(),
    getFolderPermission: vi.fn(),
    hasGuestReachedProjectLimit: vi.fn(),
  },
}));

// Mock the errors module
vi.mock("../errors/index.js", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
    constructor(message: string) {
      super(message);
      this.name = "Forbidden";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    status = 404;
    constructor(resourceType?: string, resourceId?: string) {
      super(resourceType && resourceId
        ? `${resourceType} with id '${resourceId}' not found`
        : "Resource not found");
      this.name = "Not Found";
    }
  },
}));

import {
  getSession,
  requireSession,
  requireAccountAdmin,
  requireAccountOwner,
  checkGuestConstraints,
} from "./middleware.js";
import { permissionService } from "./service.js";
import type { SessionData } from "../auth/types.js";

// Helper to create mock Hono context
function createMockContext(overrides: Partial<{
  session: SessionData | undefined;
  param: Record<string, string>;
}> = {}): Context {
  const store: Record<string, unknown> = {
    session: overrides.session,
  };

  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
    req: {
      param: (name: string) => overrides.param?.[name],
    },
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

describe("Permission Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSession", () => {
    it("should return session from context", () => {
      const session = createMockSession();
      const c = createMockContext({ session });

      const result = getSession(c);

      expect(result).toEqual(session);
    });

    it("should return undefined when no session", () => {
      const c = createMockContext({ session: undefined });

      const result = getSession(c);

      expect(result).toBeUndefined();
    });
  });

  describe("requireSession", () => {
    it("should return session when authenticated", () => {
      const session = createMockSession();
      const c = createMockContext({ session });

      const result = requireSession(c);

      expect(result).toEqual(session);
    });

    it("should throw AuthorizationError when not authenticated", () => {
      const c = createMockContext({ session: undefined });

      expect(() => requireSession(c)).toThrow("Authentication required");
    });
  });

  describe("requireAccountAdmin", () => {
    it("should allow owner role", async () => {
      const session = createMockSession({ accountRole: "owner" });
      const c = createMockContext({ session });
      const next = vi.fn();

      await requireAccountAdmin(c, next);

      expect(next).toHaveBeenCalled();
    });

    it("should allow content_admin role", async () => {
      const session = createMockSession({ accountRole: "content_admin" });
      const c = createMockContext({ session });
      const next = vi.fn();

      await requireAccountAdmin(c, next);

      expect(next).toHaveBeenCalled();
    });

    it("should reject member role", async () => {
      const session = createMockSession({ accountRole: "member" });
      const c = createMockContext({ session });
      const next = vi.fn();

      try {
        await requireAccountAdmin(c, next);
        // Should have thrown
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          "Only account owners and content admins can perform this action"
        );
      }
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject guest role", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });
      const next = vi.fn();

      try {
        await requireAccountAdmin(c, next);
        // Should have thrown
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireAccountOwner", () => {
    it("should allow owner role", async () => {
      const session = createMockSession({ accountRole: "owner" });
      const c = createMockContext({ session });
      const next = vi.fn();

      await requireAccountOwner(c, next);

      expect(next).toHaveBeenCalled();
    });

    it("should reject content_admin role", async () => {
      const session = createMockSession({ accountRole: "content_admin" });
      const c = createMockContext({ session });
      const next = vi.fn();

      try {
        await requireAccountOwner(c, next);
        // Should have thrown
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          "Only account owners can perform this action"
        );
      }
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("checkGuestConstraints", () => {
    it("should allow non-guest users for all operations", async () => {
      const session = createMockSession({ accountRole: "member" });
      const c = createMockContext({ session });

      // These should not throw
      await expect(checkGuestConstraints(c, "delete")).resolves.toBeUndefined();
      await expect(checkGuestConstraints(c, "invite")).resolves.toBeUndefined();
      await expect(checkGuestConstraints(c, "create_project")).resolves.toBeUndefined();
    });

    it("should block guest from delete operation", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });

      await expect(checkGuestConstraints(c, "delete")).rejects.toThrow(
        "Guests cannot delete content"
      );
    });

    it("should block guest from invite operation", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });

      await expect(checkGuestConstraints(c, "invite")).rejects.toThrow(
        "Guests cannot invite other users"
      );
    });

    it("should check project limit for guest creating project", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });

      vi.mocked(permissionService.hasGuestReachedProjectLimit).mockResolvedValue(true);

      await expect(checkGuestConstraints(c, "create_project")).rejects.toThrow(
        "Guests can only access 1 project(s)"
      );
    });

    it("should allow guest to create project when under limit", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });

      vi.mocked(permissionService.hasGuestReachedProjectLimit).mockResolvedValue(false);

      await expect(checkGuestConstraints(c, "create_project")).resolves.toBeUndefined();
    });
  });
});
