/**
 * Bush Platform - Permission Service Unit Tests
 *
 * Unit tests for permission service with mocked database.
 * Tests all methods: getWorkspacePermission, getProjectPermission, getFolderPermission,
 * canPerformAction, grant/revoke permissions, guest constraints, and validation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mutable state for tests
let selectResults: unknown[][] = [];
let selectCallCount = 0;
let roleResults: (string | null)[] = [];
let roleCallCount = 0;

vi.mock("../db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const whereChain = {
          limit: vi.fn(async () => {
            const result = selectResults[selectCallCount] ?? [];
            selectCallCount++;
            return result;
          }),
        };
        // Return a thenable for .where() that also has .limit()
        const whereFn = vi.fn(() => whereChain);
        // Make where() directly returnable as a promise-like
        Object.assign(whereFn, {
          // When awaited directly without calling .limit()
          then: (resolve: (value: unknown) => void) => {
            const result = selectResults[selectCallCount] ?? [];
            selectCallCount++;
            return Promise.resolve(resolve(result));
          },
        });
        return { where: whereFn };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  },
}));

vi.mock("../db/schema.js", () => ({
  workspaces: { id: "workspaces.id", accountId: "workspaces.accountId" },
  projects: { id: "projects.id", workspaceId: "projects.workspaceId", isRestricted: "projects.isRestricted" },
  folders: { id: "folders.id", projectId: "folders.projectId", isRestricted: "folders.isRestricted" },
  workspacePermissions: { workspaceId: "wp.workspaceId", userId: "wp.userId", permission: "wp.permission" },
  projectPermissions: { projectId: "pp.projectId", userId: "pp.userId", permission: "pp.permission" },
  folderPermissions: { folderId: "fp.folderId", userId: "fp.userId", permission: "fp.permission" },
  accountMemberships: { accountId: "mem.accountId", userId: "mem.userId", role: "mem.role" },
}));

vi.mock("../auth/service.js", () => ({
  authService: {
    getUserRole: vi.fn(async () => {
      const result = roleResults[roleCallCount] ?? null;
      roleCallCount++;
      return result;
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field: unknown, value: string) => ({ field, value, type: "eq" })),
  and: vi.fn((...conditions: unknown[]) => ({ conditions, type: "and" })),
}));

// Import after mocks are set up
import { permissionService } from "./service.js";
import { db } from "../db/index.js";

describe("Permission Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallCount = 0;
    roleResults = [];
    roleCallCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getWorkspacePermission", () => {
    it("returns null when workspace does not exist", async () => {
      selectResults = [[]]; // No workspace found

      const result = await permissionService.getWorkspacePermission("usr_1", "ws_nonexistent");

      expect(result).toBeNull();
    });

    it("returns admin_override for owner role", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
      ];
      roleResults = ["owner"];

      const result = await permissionService.getWorkspacePermission("usr_owner", "ws_1");

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("admin_override");
      expect(result?.allowed).toBe(true);
    });

    it("returns admin_override for content_admin role", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
      ];
      roleResults = ["content_admin"];

      const result = await permissionService.getWorkspacePermission("usr_admin", "ws_1");

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("admin_override");
    });

    it("returns direct permission when user has workspace access", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "edit" }], // Direct workspace permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getWorkspacePermission("usr_member", "ws_1");

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });

    it("returns null when non-admin user has no direct permission", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getWorkspacePermission("usr_member", "ws_1");

      expect(result).toBeNull();
    });

    it("returns null when user has no account membership", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct permission
      ];
      roleResults = [null];

      const result = await permissionService.getWorkspacePermission("usr_1", "ws_1");

      expect(result).toBeNull();
    });

    it("returns full_access permission when user has full_access", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "full_access" }], // Direct workspace permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getWorkspacePermission("usr_member", "ws_1");

      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("direct");
    });
  });

  describe("getProjectPermission", () => {
    it("returns null when project does not exist", async () => {
      selectResults = [[]]; // No project found

      const result = await permissionService.getProjectPermission("usr_1", "prj_nonexistent");

      expect(result).toBeNull();
    });

    it("returns null when workspace does not exist for project", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [], // No workspace found
      ];

      const result = await permissionService.getProjectPermission("usr_1", "prj_1");

      expect(result).toBeNull();
    });

    it("returns admin_override for owner role", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
      ];
      roleResults = ["owner"];

      const result = await permissionService.getProjectPermission("usr_owner", "prj_1");

      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("admin_override");
    });

    it("returns direct permission for restricted project", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: true }], // Restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "edit" }], // Direct project permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getProjectPermission("usr_member", "prj_1");

      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });

    it("returns null for restricted project without direct permission", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: true }], // Restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getProjectPermission("usr_member", "prj_1");

      expect(result).toBeNull();
    });

    it("returns inherited permission from workspace for non-restricted project", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct project permission
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace for inheritance check
        [{ permission: "view_only" }], // Workspace permission
      ];
      roleResults = ["member", "member"]; // For both admin checks

      const result = await permissionService.getProjectPermission("usr_member", "prj_1");

      expect(result?.permission).toBe("view_only");
      expect(result?.source).toBe("inherited");
    });

    it("returns direct permission even when workspace permission exists", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "full_access" }], // Direct project permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getProjectPermission("usr_member", "prj_1");

      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("direct");
    });
  });

  describe("getFolderPermission", () => {
    it("returns null when folder does not exist", async () => {
      selectResults = [[]]; // No folder found

      const result = await permissionService.getFolderPermission("usr_1", "fld_nonexistent");

      expect(result).toBeNull();
    });

    it("returns null when project does not exist for folder", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1" }], // Folder exists
        [], // No project found
      ];

      const result = await permissionService.getFolderPermission("usr_1", "fld_1");

      expect(result).toBeNull();
    });

    it("returns null when workspace does not exist for folder", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1" }], // Folder exists
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [], // No workspace found
      ];

      const result = await permissionService.getFolderPermission("usr_1", "fld_1");

      expect(result).toBeNull();
    });

    it("returns admin_override for owner role", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: false }], // Folder exists
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
      ];
      roleResults = ["owner"];

      const result = await permissionService.getFolderPermission("usr_owner", "fld_1");

      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("admin_override");
    });

    it("returns direct permission for restricted folder", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: true }], // Restricted folder
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "comment_only" }], // Direct folder permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getFolderPermission("usr_member", "fld_1");

      expect(result?.permission).toBe("comment_only");
      expect(result?.source).toBe("direct");
    });

    it("returns null for restricted folder without direct permission", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: true }], // Restricted folder
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getFolderPermission("usr_member", "fld_1");

      expect(result).toBeNull();
    });

    it("returns direct permission for non-restricted folder", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: false }], // Non-restricted folder
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "edit" }], // Direct folder permission
      ];
      roleResults = ["member"];

      const result = await permissionService.getFolderPermission("usr_member", "fld_1");

      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });

    it("returns inherited from project for non-restricted folder without direct permission", async () => {
      // This test exercises the fallback to getProjectPermission
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: false }], // Non-restricted folder
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct folder permission
        // getProjectPermission path:
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "edit_and_share" }], // Direct project permission
      ];
      roleResults = ["member", "member"];

      const result = await permissionService.getFolderPermission("usr_member", "fld_1");

      expect(result?.permission).toBe("edit_and_share");
      expect(result?.source).toBe("direct"); // From project direct permission
    });
  });

  describe("canPerformAction", () => {
    it("returns false when workspace permission is null", async () => {
      selectResults = [[]]; // No workspace found

      const canView = await permissionService.canPerformAction("usr_1", "workspace", "ws_1", "view");

      expect(canView).toBe(false);
    });

    it("returns true for view action with view_only permission on workspace", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "view_only" }], // Workspace permission
      ];
      roleResults = ["member"];

      const canView = await permissionService.canPerformAction("usr_1", "workspace", "ws_1", "view");

      expect(canView).toBe(true);
    });

    it("returns false for edit action with view_only permission on workspace", async () => {
      selectResults = [
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "view_only" }], // Workspace permission
      ];
      roleResults = ["member"];

      const canEdit = await permissionService.canPerformAction("usr_1", "workspace", "ws_1", "edit");

      expect(canEdit).toBe(false);
    });

    it("returns true for delete action with full_access permission on project", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "full_access" }], // Project permission
      ];
      roleResults = ["member"];

      const canDelete = await permissionService.canPerformAction("usr_1", "project", "prj_1", "delete");

      expect(canDelete).toBe(true);
    });

    it("returns true for view action on folder with inherited permission", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: false }], // Folder exists
        [{ id: "prj_1", workspaceId: "ws_1" }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No direct folder permission
        // getProjectPermission fallback:
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Project exists
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "edit" }], // Project permission
      ];
      roleResults = ["member", "member"];

      const canView = await permissionService.canPerformAction("usr_1", "folder", "fld_1", "view");

      expect(canView).toBe(true);
    });

    it("returns false for unknown resource type", async () => {
      const canView = await permissionService.canPerformAction(
        "usr_1",
        "unknown" as "workspace",
        "res_1",
        "view"
      );

      expect(canView).toBe(false);
    });
  });

  describe("getAccountRole", () => {
    it("returns user role when membership exists", async () => {
      roleResults = ["owner"];

      const role = await permissionService.getAccountRole("usr_1", "acc_1");

      expect(role).toBe("owner");
    });

    it("returns null when membership does not exist", async () => {
      roleResults = [null];

      const role = await permissionService.getAccountRole("usr_1", "acc_1");

      expect(role).toBeNull();
    });
  });

  describe("isAccountAdmin", () => {
    it("returns true for owner role", async () => {
      roleResults = ["owner"];

      const isAdmin = await permissionService.isAccountAdmin("usr_1", "acc_1");

      expect(isAdmin).toBe(true);
    });

    it("returns true for content_admin role", async () => {
      roleResults = ["content_admin"];

      const isAdmin = await permissionService.isAccountAdmin("usr_1", "acc_1");

      expect(isAdmin).toBe(true);
    });

    it("returns false for member role", async () => {
      roleResults = ["member"];

      const isAdmin = await permissionService.isAccountAdmin("usr_1", "acc_1");

      expect(isAdmin).toBe(false);
    });

    it("returns false for guest role", async () => {
      roleResults = ["guest"];

      const isAdmin = await permissionService.isAccountAdmin("usr_1", "acc_1");

      expect(isAdmin).toBe(false);
    });

    it("returns false for reviewer role", async () => {
      roleResults = ["reviewer"];

      const isAdmin = await permissionService.isAccountAdmin("usr_1", "acc_1");

      expect(isAdmin).toBe(false);
    });

    it("returns false when user has no membership", async () => {
      roleResults = [null];

      const isAdmin = await permissionService.isAccountAdmin("usr_1", "acc_1");

      expect(isAdmin).toBe(false);
    });
  });

  // Note: getUserProjectCount tests require a different mock pattern
  // The integration tests cover these scenarios with real database queries

  // Note: hasGuestReachedProjectLimit tests require mocking getUserProjectCount
  // The integration tests cover these scenarios with real database queries

  describe("grantWorkspacePermission", () => {
    it("inserts workspace permission with generated ID", async () => {
      await permissionService.grantWorkspacePermission("ws_1", "usr_1", "edit");

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("grantProjectPermission", () => {
    it("inserts project permission", async () => {
      await permissionService.grantProjectPermission("prj_1", "usr_1", "view_only");

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("grantFolderPermission", () => {
    it("inserts folder permission", async () => {
      await permissionService.grantFolderPermission("fld_1", "usr_1", "comment_only");

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("revokeWorkspacePermission", () => {
    it("deletes workspace permission", async () => {
      await permissionService.revokeWorkspacePermission("ws_1", "usr_1");

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("revokeProjectPermission", () => {
    it("deletes project permission", async () => {
      await permissionService.revokeProjectPermission("prj_1", "usr_1");

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("revokeFolderPermission", () => {
    it("deletes folder permission", async () => {
      await permissionService.revokeFolderPermission("fld_1", "usr_1");

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("validatePermissionChange", () => {
    it("returns valid for workspace resource type", async () => {
      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "workspace",
        "ws_1",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid when project does not exist", async () => {
      selectResults = [[]]; // No project found

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "project",
        "prj_nonexistent",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid when folder does not exist", async () => {
      selectResults = [[]]; // No folder found

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "folder",
        "fld_nonexistent",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid for restricted project (no inheritance check)", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: true }], // Restricted project
      ];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "project",
        "prj_1",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid for restricted folder (no inheritance check)", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: true }], // Restricted folder
      ];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "folder",
        "fld_1",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid when no inherited permission exists for project", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [], // No workspace permission
      ];
      roleResults = [null];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "project",
        "prj_1",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid when no inherited permission exists for folder", async () => {
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: false }], // Non-restricted folder
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [], // No project permission
      ];
      roleResults = [null];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "folder",
        "fld_1",
        "edit"
      );

      expect(result.valid).toBe(true);
    });

    it("returns invalid when trying to lower inherited project permission", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "full_access" }], // Workspace permission
      ];
      roleResults = ["member"];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "project",
        "prj_1",
        "view_only" // Lower than full_access
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Cannot lower inherited permission");
    });

    it("returns invalid when trying to lower inherited folder permission", async () => {
      // validatePermissionChange for folder calls getProjectPermission which needs:
      // 1. Project query -> 2. Workspace query -> 3. Direct project permission query
      selectResults = [
        [{ id: "fld_1", projectId: "prj_1", isRestricted: false }], // Folder query
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Project query (for getProjectPermission)
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace query
        [{ permission: "edit" }], // Direct project permission
      ];
      roleResults = ["member"];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "folder",
        "fld_1",
        "view_only" // Lower than edit
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Cannot lower inherited permission");
    });

    it("returns valid when raising inherited project permission", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "view_only" }], // Workspace permission
      ];
      roleResults = ["member"];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "project",
        "prj_1",
        "full_access" // Higher than view_only
      );

      expect(result.valid).toBe(true);
    });

    it("returns valid when setting equal to inherited permission", async () => {
      selectResults = [
        [{ id: "prj_1", workspaceId: "ws_1", isRestricted: false }], // Non-restricted project
        [{ id: "ws_1", accountId: "acc_1" }], // Workspace exists
        [{ permission: "edit" }], // Workspace permission
      ];
      roleResults = ["member"];

      const result = await permissionService.validatePermissionChange(
        "usr_1",
        "project",
        "prj_1",
        "edit" // Equal to inherited
      );

      expect(result.valid).toBe(true);
    });
  });
});
