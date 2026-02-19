/**
 * Bush Platform - Permission Service Integration Tests
 *
 * Integration tests for the permission service with database.
 * Uses an in-memory SQLite database for isolation.
 * Environment variables are set in vitest.setup.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as crypto from "crypto";

// Create in-memory database for testing
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

// Import schema
import {
  accounts,
  users,
  accountMemberships,
  workspaces,
  projects,
  folders,
  workspacePermissions,
  projectPermissions,
  folderPermissions,
} from "../db/schema.js";

// Helper to generate IDs
function generateId(prefix: string, seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

// Test data IDs
const TEST_IDS = {
  account: generateId("acc", "test-account"),
  user: {
    owner: generateId("usr", "test-owner"),
    contentAdmin: generateId("usr", "test-content-admin"),
    member: generateId("usr", "test-member"),
    guest: generateId("usr", "test-guest"),
    otherAccount: generateId("usr", "test-other"),
  },
  workspace: generateId("ws", "test-workspace"),
  project: {
    regular: generateId("prj", "test-project-regular"),
    restricted: generateId("prj", "test-project-restricted"),
  },
  folder: {
    regular: generateId("fld", "test-folder-regular"),
    restricted: generateId("fld", "test-folder-restricted"),
  },
};

// Mock the db import in permission service
vi.mock("../db/index.js", () => ({
  get db() {
    return db;
  },
}));

import { permissionService } from "./service.js";

describe("Permission Service Integration Tests", () => {
  beforeAll(async () => {
    // Create in-memory database
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema: {
      accounts,
      users,
      accountMemberships,
      workspaces,
      projects,
      folders,
      workspacePermissions,
      projectPermissions,
      folderPermissions,
    }});

    // Create tables
    sqlite.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        plan TEXT NOT NULL DEFAULT 'free',
        storage_quota_bytes INTEGER NOT NULL DEFAULT 2147483648,
        storage_used_bytes INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        workos_user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        avatar_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE account_memberships (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(account_id, user_id)
      );

      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_restricted INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 0,
        is_restricted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE workspace_permissions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL DEFAULT 'view_only',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(workspace_id, user_id)
      );

      CREATE TABLE project_permissions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL DEFAULT 'view_only',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id)
      );

      CREATE TABLE folder_permissions (
        id TEXT PRIMARY KEY,
        folder_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL DEFAULT 'view_only',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(folder_id, user_id)
      );

      CREATE INDEX workspaces_account_id_idx ON workspaces(account_id);
      CREATE INDEX projects_workspace_id_idx ON projects(workspace_id);
      CREATE INDEX folders_project_id_idx ON folders(project_id);
    `);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(async () => {
    // Clear all tables
    sqlite.exec(`
      DELETE FROM folder_permissions;
      DELETE FROM project_permissions;
      DELETE FROM workspace_permissions;
      DELETE FROM folders;
      DELETE FROM projects;
      DELETE FROM workspaces;
      DELETE FROM account_memberships;
      DELETE FROM users;
      DELETE FROM accounts;
    `);

    const now = Date.now();

    // Insert test account
    await db.insert(accounts).values({
      id: TEST_IDS.account,
      name: "Test Account",
      slug: "test-account",
      plan: "team",
      storageQuotaBytes: 3221225472,
      storageUsedBytes: 0,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    // Insert test users
    for (const [role, userId] of Object.entries(TEST_IDS.user)) {
      await db.insert(users).values({
        id: userId,
        workosUserId: `workos_${role}`,
        email: `${role}@test.com`,
        firstName: role.charAt(0).toUpperCase() + role.slice(1),
        lastName: "User",
        avatarUrl: null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }

    // Insert account memberships
    const membershipRoles: Record<string, "owner" | "content_admin" | "member" | "guest"> = {
      owner: "owner",
      contentAdmin: "content_admin",
      member: "member",
      guest: "guest",
    };

    for (const [key, role] of Object.entries(membershipRoles)) {
      const userId = TEST_IDS.user[key as keyof typeof TEST_IDS.user];
      await db.insert(accountMemberships).values({
        id: generateId("mem", `membership-${key}`),
        accountId: TEST_IDS.account,
        userId,
        role,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }

    // Insert workspace
    await db.insert(workspaces).values({
      id: TEST_IDS.workspace,
      accountId: TEST_IDS.account,
      name: "Test Workspace",
      description: "A test workspace",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    // Insert projects
    await db.insert(projects).values([
      {
        id: TEST_IDS.project.regular,
        workspaceId: TEST_IDS.workspace,
        name: "Regular Project",
        description: "A regular project",
        isRestricted: false,
        archivedAt: null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      {
        id: TEST_IDS.project.restricted,
        workspaceId: TEST_IDS.workspace,
        name: "Restricted Project",
        description: "A restricted project",
        isRestricted: true,
        archivedAt: null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    ]);

    // Insert folders
    await db.insert(folders).values([
      {
        id: TEST_IDS.folder.regular,
        projectId: TEST_IDS.project.regular,
        parentId: null,
        name: "Regular Folder",
        path: "/Regular Folder",
        depth: 0,
        isRestricted: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      {
        id: TEST_IDS.folder.restricted,
        projectId: TEST_IDS.project.regular,
        parentId: null,
        name: "Restricted Folder",
        path: "/Restricted Folder",
        depth: 0,
        isRestricted: true,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    ]);
  });

  describe("Admin Override", () => {
    it("should give owner full access to any workspace", async () => {
      const result = await permissionService.getWorkspacePermission(
        TEST_IDS.user.owner,
        TEST_IDS.workspace
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("admin_override");
    });

    it("should give content_admin full access to any project", async () => {
      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.contentAdmin,
        TEST_IDS.project.regular
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("full_access");
      expect(result?.source).toBe("admin_override");
    });
  });

  describe("Workspace Permissions", () => {
    it("should return null for user without workspace access", async () => {
      const result = await permissionService.getWorkspacePermission(
        TEST_IDS.user.member,
        TEST_IDS.workspace
      );

      expect(result).toBeNull();
    });

    it("should return direct permission when user has workspace access", async () => {
      // Grant member edit permission on workspace
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getWorkspacePermission(
        TEST_IDS.user.member,
        TEST_IDS.workspace
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });

    it("should allow revoking workspace permission", async () => {
      // Grant then revoke
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "edit"
      );
      await permissionService.revokeWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member
      );

      const result = await permissionService.getWorkspacePermission(
        TEST_IDS.user.member,
        TEST_IDS.workspace
      );

      expect(result).toBeNull();
    });
  });

  describe("Project Permission Inheritance", () => {
    it("should inherit permission from workspace", async () => {
      // Grant member view_only on workspace
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "view_only"
      );

      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        TEST_IDS.project.regular
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("view_only");
      expect(result?.source).toBe("inherited");
    });

    it("should not inherit for restricted projects", async () => {
      // Grant member view_only on workspace
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "view_only"
      );

      // Member should NOT have access to restricted project via inheritance
      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        TEST_IDS.project.restricted
      );

      expect(result).toBeNull();
    });

    it("should allow direct permission on restricted project", async () => {
      // Grant member direct permission on restricted project
      await permissionService.grantProjectPermission(
        TEST_IDS.project.restricted,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        TEST_IDS.project.restricted
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });
  });

  describe("Folder Permission Inheritance", () => {
    it("should inherit from project", async () => {
      // Grant member edit on project
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        TEST_IDS.folder.regular
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("edit");
      // Source is "direct" because the user has direct permission on the project,
      // which is then inherited by the folder
      expect(result?.source).toBe("direct");
    });

    it("should inherit from workspace through project to folder", async () => {
      // Grant member view_only on workspace (no direct project permission)
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "view_only"
      );

      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        TEST_IDS.folder.regular
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("view_only");
      // Source is "inherited" because it comes from workspace -> project -> folder
      expect(result?.source).toBe("inherited");
    });

    it("should not inherit for restricted folders", async () => {
      // Grant member edit on project
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );

      // Member should NOT have access to restricted folder via inheritance
      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        TEST_IDS.folder.restricted
      );

      expect(result).toBeNull();
    });
  });

  describe("canPerformAction", () => {
    it("should allow view action for view_only permission", async () => {
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "view_only"
      );

      const canView = await permissionService.canPerformAction(
        TEST_IDS.user.member,
        "workspace",
        TEST_IDS.workspace,
        "view"
      );

      expect(canView).toBe(true);
    });

    it("should deny edit action for view_only permission", async () => {
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "view_only"
      );

      const canEdit = await permissionService.canPerformAction(
        TEST_IDS.user.member,
        "workspace",
        TEST_IDS.workspace,
        "edit"
      );

      expect(canEdit).toBe(false);
    });

    it("should allow delete action for full_access permission", async () => {
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "full_access"
      );

      const canDelete = await permissionService.canPerformAction(
        TEST_IDS.user.member,
        "workspace",
        TEST_IDS.workspace,
        "delete"
      );

      expect(canDelete).toBe(true);
    });
  });

  describe("Guest Constraints", () => {
    it("should detect when guest has reached project limit", async () => {
      // Grant guest access to one project
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.guest,
        "view_only"
      );

      const reachedLimit = await permissionService.hasGuestReachedProjectLimit(
        TEST_IDS.user.guest
      );

      expect(reachedLimit).toBe(true);
    });

    it("should not limit guest with zero projects", async () => {
      const reachedLimit = await permissionService.hasGuestReachedProjectLimit(
        TEST_IDS.user.guest
      );

      expect(reachedLimit).toBe(false);
    });
  });

  describe("Permission Validation", () => {
    it("should prevent lowering inherited permissions", async () => {
      // Grant workspace full_access
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "full_access"
      );

      // Try to validate lowering project permission
      const validation = await permissionService.validatePermissionChange(
        TEST_IDS.user.member,
        "project",
        TEST_IDS.project.regular,
        "view_only"
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Cannot lower inherited permission");
    });

    it("should allow raising inherited permissions", async () => {
      // Grant workspace view_only
      await permissionService.grantWorkspacePermission(
        TEST_IDS.workspace,
        TEST_IDS.user.member,
        "view_only"
      );

      // Validate raising project permission
      const validation = await permissionService.validatePermissionChange(
        TEST_IDS.user.member,
        "project",
        TEST_IDS.project.regular,
        "edit"
      );

      expect(validation.valid).toBe(true);
    });

    it("should prevent lowering inherited permissions for folders", async () => {
      // Grant project full_access
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "full_access"
      );

      // Try to validate lowering folder permission
      const validation = await permissionService.validatePermissionChange(
        TEST_IDS.user.member,
        "folder",
        TEST_IDS.folder.regular,
        "view_only"
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Cannot lower inherited permission");
    });

    it("should allow raising inherited permissions for folders", async () => {
      // Grant project view_only
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "view_only"
      );

      // Validate raising folder permission
      const validation = await permissionService.validatePermissionChange(
        TEST_IDS.user.member,
        "folder",
        TEST_IDS.folder.regular,
        "edit"
      );

      expect(validation.valid).toBe(true);
    });

    it("should return valid for workspace resource type (no inheritance check)", async () => {
      const validation = await permissionService.validatePermissionChange(
        TEST_IDS.user.member,
        "workspace",
        TEST_IDS.workspace,
        "edit"
      );

      expect(validation.valid).toBe(true);
    });

    it("should return valid when no inherited permission exists", async () => {
      // No permissions granted - validate should pass
      const validation = await permissionService.validatePermissionChange(
        TEST_IDS.user.member,
        "project",
        TEST_IDS.project.regular,
        "edit"
      );

      expect(validation.valid).toBe(true);
    });
  });

  describe("Grant and Revoke Permissions", () => {
    it("should grant project permission", async () => {
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        TEST_IDS.project.regular
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });

    it("should update project permission on conflict", async () => {
      // Grant initial permission
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "view_only"
      );

      // Update to higher permission
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        TEST_IDS.project.regular
      );

      expect(result?.permission).toBe("edit");
    });

    it("should revoke project permission", async () => {
      // Grant then revoke
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );

      await permissionService.revokeProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member
      );

      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        TEST_IDS.project.regular
      );

      expect(result).toBeNull();
    });

    it("should grant folder permission", async () => {
      await permissionService.grantFolderPermission(
        TEST_IDS.folder.regular,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        TEST_IDS.folder.regular
      );

      expect(result).not.toBeNull();
      expect(result?.permission).toBe("edit");
      expect(result?.source).toBe("direct");
    });

    it("should update folder permission on conflict", async () => {
      // Grant initial permission
      await permissionService.grantFolderPermission(
        TEST_IDS.folder.regular,
        TEST_IDS.user.member,
        "view_only"
      );

      // Update to higher permission
      await permissionService.grantFolderPermission(
        TEST_IDS.folder.regular,
        TEST_IDS.user.member,
        "edit"
      );

      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        TEST_IDS.folder.regular
      );

      expect(result?.permission).toBe("edit");
    });

    it("should revoke folder permission", async () => {
      // Grant then revoke
      await permissionService.grantFolderPermission(
        TEST_IDS.folder.regular,
        TEST_IDS.user.member,
        "edit"
      );

      await permissionService.revokeFolderPermission(
        TEST_IDS.folder.regular,
        TEST_IDS.user.member
      );

      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        TEST_IDS.folder.regular
      );

      expect(result).toBeNull();
    });
  });

  describe("Resource Not Found Cases", () => {
    it("should return null for non-existent workspace", async () => {
      const result = await permissionService.getWorkspacePermission(
        TEST_IDS.user.member,
        "ws_nonexistent"
      );

      expect(result).toBeNull();
    });

    it("should return null for non-existent project", async () => {
      const result = await permissionService.getProjectPermission(
        TEST_IDS.user.member,
        "prj_nonexistent"
      );

      expect(result).toBeNull();
    });

    it("should return null for non-existent folder", async () => {
      const result = await permissionService.getFolderPermission(
        TEST_IDS.user.member,
        "fld_nonexistent"
      );

      expect(result).toBeNull();
    });

    it("should return false for canPerformAction on non-existent workspace", async () => {
      const canView = await permissionService.canPerformAction(
        TEST_IDS.user.member,
        "workspace",
        "ws_nonexistent",
        "view"
      );

      expect(canView).toBe(false);
    });

    it("should return false for canPerformAction on non-existent project", async () => {
      const canView = await permissionService.canPerformAction(
        TEST_IDS.user.member,
        "project",
        "prj_nonexistent",
        "view"
      );

      expect(canView).toBe(false);
    });

    it("should return false for canPerformAction on non-existent folder", async () => {
      const canView = await permissionService.canPerformAction(
        TEST_IDS.user.member,
        "folder",
        "fld_nonexistent",
        "view"
      );

      expect(canView).toBe(false);
    });
  });

  describe("Account Admin Check", () => {
    it("should identify owner as account admin", async () => {
      const isAdmin = await permissionService.isAccountAdmin(
        TEST_IDS.user.owner,
        TEST_IDS.account
      );

      expect(isAdmin).toBe(true);
    });

    it("should identify content_admin as account admin", async () => {
      const isAdmin = await permissionService.isAccountAdmin(
        TEST_IDS.user.contentAdmin,
        TEST_IDS.account
      );

      expect(isAdmin).toBe(true);
    });

    it("should not identify member as account admin", async () => {
      const isAdmin = await permissionService.isAccountAdmin(
        TEST_IDS.user.member,
        TEST_IDS.account
      );

      expect(isAdmin).toBe(false);
    });

    it("should not identify guest as account admin", async () => {
      const isAdmin = await permissionService.isAccountAdmin(
        TEST_IDS.user.guest,
        TEST_IDS.account
      );

      expect(isAdmin).toBe(false);
    });
  });

  describe("User Project Count", () => {
    it("should return 0 when user has no project permissions", async () => {
      const count = await permissionService.getUserProjectCount(TEST_IDS.user.member);
      expect(count).toBe(0);
    });

    it("should count direct project permissions", async () => {
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );

      const count = await permissionService.getUserProjectCount(TEST_IDS.user.member);
      expect(count).toBe(1);
    });

    it("should count multiple project permissions", async () => {
      await permissionService.grantProjectPermission(
        TEST_IDS.project.regular,
        TEST_IDS.user.member,
        "edit"
      );
      await permissionService.grantProjectPermission(
        TEST_IDS.project.restricted,
        TEST_IDS.user.member,
        "view_only"
      );

      const count = await permissionService.getUserProjectCount(TEST_IDS.user.member);
      expect(count).toBe(2);
    });
  });
});
