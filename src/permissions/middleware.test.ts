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
  getRequestContext,
  requirePermission,
  requirePermissionLevel,
  requireNotGuest,
  permissions,
  SESSION_KEY,
  REQUEST_CONTEXT_KEY,
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

  describe("SESSION_KEY and REQUEST_CONTEXT_KEY", () => {
    it("should export correct session key", () => {
      expect(SESSION_KEY).toBe("session");
    });

    it("should export correct request context key", () => {
      expect(REQUEST_CONTEXT_KEY).toBe("requestContext");
    });
  });

  describe("getRequestContext", () => {
    it("should return request context from context", () => {
      const requestContext = { requestId: "req_123", userId: "usr_123", accountId: "acc_123" };
      const c = {
        get: vi.fn().mockReturnValue(requestContext),
      } as unknown as Context;

      const result = getRequestContext(c);

      expect(result).toEqual(requestContext);
    });

    it("should return default context when not set", () => {
      const c = {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Context;

      const result = getRequestContext(c);

      expect(result).toEqual({ requestId: "unknown" });
    });
  });

  describe("requirePermission", () => {
    it("should throw NotFoundError when resource ID is missing", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: {} });
      const next = vi.fn();

      const middleware = requirePermission({
        resourceType: "project",
        resourceIdSource: "projectId",
        action: "edit",
      });

      await expect(middleware(c, next)).rejects.toThrow("Resource not found");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw NotFoundError when resource ID from function is undefined", async () => {
      const session = createMockSession();
      const c = createMockContext({ session });
      const next = vi.fn();

      const middleware = requirePermission({
        resourceType: "folder",
        resourceIdSource: () => undefined,
        action: "delete",
      });

      await expect(middleware(c, next)).rejects.toThrow("Resource not found");
    });

    it("should call next when permission is granted", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { projectId: "proj_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      const middleware = requirePermission({
        resourceType: "project",
        resourceIdSource: "projectId",
        action: "edit",
      });

      await middleware(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "project",
        "proj_123",
        "edit"
      );
      expect(next).toHaveBeenCalled();
    });

    it("should throw AuthorizationError when permission denied", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { folderId: "fld_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(false);

      const middleware = requirePermission({
        resourceType: "folder",
        resourceIdSource: "folderId",
        action: "delete",
      });

      await expect(middleware(c, next)).rejects.toThrow("do not have permission");
      expect(next).not.toHaveBeenCalled();
    });

    it("should use function to get resource ID", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { customId: "ws_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      const middleware = requirePermission({
        resourceType: "workspace",
        resourceIdSource: (ctx) => ctx.req.param("customId"),
        action: "view",
      });

      await middleware(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "workspace",
        "ws_123",
        "view"
      );
    });
  });

  describe("requirePermissionLevel", () => {
    it("should throw NotFoundError when resource ID is missing", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: {} });
      const next = vi.fn();

      const middleware = requirePermissionLevel("workspace", "workspaceId", "full_access");

      await expect(middleware(c, next)).rejects.toThrow("Resource not found");
    });

    it("should throw AuthorizationError when no permission result", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { workspaceId: "ws_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.getWorkspacePermission).mockResolvedValue(null);

      const middleware = requirePermissionLevel("workspace", "workspaceId", "full_access");

      await expect(middleware(c, next)).rejects.toThrow("do not have access");
    });

    it("should call next when permission level is sufficient for workspace", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { workspaceId: "ws_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.getWorkspacePermission).mockResolvedValue({
        permission: "full_access",
        allowed: true,
        source: "direct",
      });

      const middleware = requirePermissionLevel("workspace", "workspaceId", "edit");

      await middleware(c, next);

      expect(permissionService.getWorkspacePermission).toHaveBeenCalledWith(
        session.userId,
        "ws_123"
      );
      expect(next).toHaveBeenCalled();
    });

    it("should call next when permission level is sufficient for project", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { projectId: "proj_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.getProjectPermission).mockResolvedValue({
        permission: "full_access",
        allowed: true,
        source: "direct",
      });

      const middleware = requirePermissionLevel("project", "projectId", "edit");

      await middleware(c, next);

      expect(permissionService.getProjectPermission).toHaveBeenCalledWith(
        session.userId,
        "proj_123"
      );
      expect(next).toHaveBeenCalled();
    });

    it("should call next when permission level is sufficient for folder", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { folderId: "fld_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.getFolderPermission).mockResolvedValue({
        permission: "full_access",
        allowed: true,
        source: "direct",
      });

      const middleware = requirePermissionLevel("folder", "folderId", "view_only");

      await middleware(c, next);

      expect(permissionService.getFolderPermission).toHaveBeenCalledWith(
        session.userId,
        "fld_123"
      );
      expect(next).toHaveBeenCalled();
    });

    it("should throw AuthorizationError when permission level is insufficient", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { workspaceId: "ws_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.getWorkspacePermission).mockResolvedValue({
        permission: "view_only",
        allowed: true,
        source: "direct",
      });

      const middleware = requirePermissionLevel("workspace", "workspaceId", "full_access");

      await expect(middleware(c, next)).rejects.toThrow("need full_access permission");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireNotGuest", () => {
    it("should call next for non-guest user on delete", async () => {
      const session = createMockSession({ accountRole: "member" });
      const c = createMockContext({ session });
      const next = vi.fn();

      const middleware = requireNotGuest("delete");
      await middleware(c, next);

      expect(next).toHaveBeenCalled();
    });

    it("should throw for guest user on delete", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });
      const next = vi.fn();

      const middleware = requireNotGuest("delete");

      await expect(middleware(c, next)).rejects.toThrow("Guests cannot delete content");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw for guest user on invite", async () => {
      const session = createMockSession({ accountRole: "guest" });
      const c = createMockContext({ session });
      const next = vi.fn();

      const middleware = requireNotGuest("invite");

      await expect(middleware(c, next)).rejects.toThrow("Guests cannot invite other users");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("permissions helpers", () => {
    it("should create viewWorkspace middleware", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { workspaceId: "ws_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      await permissions.viewWorkspace()(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "workspace",
        "ws_123",
        "view"
      );
    });

    it("should create editProject middleware with default param", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { projectId: "proj_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      await permissions.editProject()(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "project",
        "proj_123",
        "edit"
      );
    });

    it("should create editProject middleware with custom param", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { customProjectId: "proj_456" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      await permissions.editProject("customProjectId")(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "project",
        "proj_456",
        "edit"
      );
    });

    it("should create deleteProject middleware", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { projectId: "proj_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      await permissions.deleteProject()(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "project",
        "proj_123",
        "delete"
      );
    });

    it("should create shareFolder middleware", async () => {
      const session = createMockSession();
      const c = createMockContext({ session, param: { folderId: "fld_123" } });
      const next = vi.fn();

      vi.mocked(permissionService.canPerformAction).mockResolvedValue(true);

      await permissions.shareFolder()(c, next);

      expect(permissionService.canPerformAction).toHaveBeenCalledWith(
        session.userId,
        "folder",
        "fld_123",
        "share"
      );
    });
  });
});
