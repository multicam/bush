/**
 * Bush Platform - Permission Service
 *
 * Handles permission checks, inheritance, and access control.
 * Reference: specs/00-complete-support-documentation.md Section 2
 */
import { db } from "../db/index.js";
import {
  workspaces,
  projects,
  folders,
  workspacePermissions,
  projectPermissions,
  folderPermissions,
  accountMemberships,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AccountRole } from "../auth/types.js";
import { authService } from "../auth/service.js";
import type {
  PermissionLevel,
  PermissionCheckResult,
  PermissionResourceType,
  ResourceAction,
} from "./types.js";
import {
  isPermissionAtLeast,
  canPerformAction,
  GUEST_CONSTRAINTS,
} from "./types.js";
import { generateId } from "../shared/id.js";

/**
 * Account roles that bypass permission checks
 */
const ADMIN_ROLES: AccountRole[] = ["owner", "content_admin"];

/**
 * Permission service operations
 */
export const permissionService = {
  /**
   * Check if a user has access to a workspace
   */
  async getWorkspacePermission(
    userId: string,
    workspaceId: string
  ): Promise<PermissionCheckResult | null> {
    // Get workspace to find account
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspaceResults.length === 0) {
      return null;
    }

    const workspace = workspaceResults[0];

    // Check account role for admin override
    const accountRole = await this.getAccountRole(userId, workspace.accountId);
    if (accountRole && ADMIN_ROLES.includes(accountRole)) {
      return {
        allowed: true,
        permission: "full_access",
        source: "admin_override",
      };
    }

    // Check direct workspace permission
    const permissionResults = await db
      .select()
      .from(workspacePermissions)
      .where(
        and(
          eq(workspacePermissions.workspaceId, workspaceId),
          eq(workspacePermissions.userId, userId)
        )
      )
      .limit(1);

    if (permissionResults.length > 0) {
      return {
        allowed: true,
        permission: permissionResults[0].permission as PermissionLevel,
        source: "direct",
      };
    }

    // No access
    return null;
  },

  /**
   * Check if a user has access to a project
   * Takes into account workspace inheritance and restricted project logic
   */
  async getProjectPermission(
    userId: string,
    projectId: string
  ): Promise<PermissionCheckResult | null> {
    // Get project to find workspace
    const projectResults = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (projectResults.length === 0) {
      return null;
    }

    const project = projectResults[0];

    // Get workspace for account check
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, project.workspaceId))
      .limit(1);

    if (workspaceResults.length === 0) {
      return null;
    }

    const workspace = workspaceResults[0];

    // Check account role for admin override
    const accountRole = await this.getAccountRole(userId, workspace.accountId);
    if (accountRole && ADMIN_ROLES.includes(accountRole)) {
      return {
        allowed: true,
        permission: "full_access",
        source: "admin_override",
      };
    }

    // For restricted projects, only direct permissions matter
    if (project.isRestricted) {
      const permissionResults = await db
        .select()
        .from(projectPermissions)
        .where(
          and(
            eq(projectPermissions.projectId, projectId),
            eq(projectPermissions.userId, userId)
          )
        )
        .limit(1);

      if (permissionResults.length > 0) {
        return {
          allowed: true,
          permission: permissionResults[0].permission as PermissionLevel,
          source: "direct",
        };
      }

      // No access to restricted project
      return null;
    }

    // Check direct project permission first
    const directPermission = await db
      .select()
      .from(projectPermissions)
      .where(
        and(
          eq(projectPermissions.projectId, projectId),
          eq(projectPermissions.userId, userId)
        )
      )
      .limit(1);

    if (directPermission.length > 0) {
      return {
        allowed: true,
        permission: directPermission[0].permission as PermissionLevel,
        source: "direct",
      };
    }

    // Fall back to workspace permission (inheritance)
    const workspacePermission = await this.getWorkspacePermission(
      userId,
      project.workspaceId
    );

    if (workspacePermission) {
      return {
        allowed: true,
        permission: workspacePermission.permission,
        source: "inherited",
      };
    }

    // No access
    return null;
  },

  /**
   * Check if a user has access to a folder
   * Takes into account project inheritance and restricted folder logic
   */
  async getFolderPermission(
    userId: string,
    folderId: string
  ): Promise<PermissionCheckResult | null> {
    // Get folder to find project
    const folderResults = await db
      .select()
      .from(folders)
      .where(eq(folders.id, folderId))
      .limit(1);

    if (folderResults.length === 0) {
      return null;
    }

    const folder = folderResults[0];

    // Get project for account/workspace lookup
    const projectResults = await db
      .select()
      .from(projects)
      .where(eq(projects.id, folder.projectId))
      .limit(1);

    if (projectResults.length === 0) {
      return null;
    }

    const project = projectResults[0];

    // Get workspace for account check
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, project.workspaceId))
      .limit(1);

    if (workspaceResults.length === 0) {
      return null;
    }

    const workspace = workspaceResults[0];

    // Check account role for admin override
    const accountRole = await this.getAccountRole(userId, workspace.accountId);
    if (accountRole && ADMIN_ROLES.includes(accountRole)) {
      return {
        allowed: true,
        permission: "full_access",
        source: "admin_override",
      };
    }

    // For restricted folders, check direct folder permission first
    if (folder.isRestricted) {
      const folderPermissionResults = await db
        .select()
        .from(folderPermissions)
        .where(
          and(
            eq(folderPermissions.folderId, folderId),
            eq(folderPermissions.userId, userId)
          )
        )
        .limit(1);

      if (folderPermissionResults.length > 0) {
        return {
          allowed: true,
          permission: folderPermissionResults[0].permission as PermissionLevel,
          source: "direct",
        };
      }

      // No direct access to restricted folder
      return null;
    }

    // Check direct folder permission
    const directFolderPermission = await db
      .select()
      .from(folderPermissions)
      .where(
        and(
          eq(folderPermissions.folderId, folderId),
          eq(folderPermissions.userId, userId)
        )
      )
      .limit(1);

    if (directFolderPermission.length > 0) {
      return {
        allowed: true,
        permission: directFolderPermission[0].permission as PermissionLevel,
        source: "direct",
      };
    }

    // Fall back to project permission (inheritance)
    // Note: Restricted projects break inheritance, so this handles that too
    return this.getProjectPermission(userId, folder.projectId);
  },

  /**
   * Check if a user can perform an action on a resource
   */
  async canPerformAction(
    userId: string,
    resourceType: PermissionResourceType,
    resourceId: string,
    action: ResourceAction
  ): Promise<boolean> {
    let permissionResult: PermissionCheckResult | null;

    switch (resourceType) {
      case "workspace":
        permissionResult = await this.getWorkspacePermission(userId, resourceId);
        break;
      case "project":
        permissionResult = await this.getProjectPermission(userId, resourceId);
        break;
      case "folder":
        permissionResult = await this.getFolderPermission(userId, resourceId);
        break;
      default:
        return false;
    }

    if (!permissionResult) {
      return false;
    }

    return canPerformAction(permissionResult.permission, action);
  },

  /**
   * Get user's account role for an account
   * Delegates to authService to avoid duplicate DB query logic
   */
  async getAccountRole(userId: string, accountId: string): Promise<AccountRole | null> {
    return authService.getUserRole(userId, accountId);
  },

  /**
   * Check if user is an admin (owner or content_admin) for an account
   */
  async isAccountAdmin(userId: string, accountId: string): Promise<boolean> {
    const role = await this.getAccountRole(userId, accountId);
    return role !== null && ADMIN_ROLES.includes(role);
  },

  /**
   * Grant permission to a user for a workspace
   */
  async grantWorkspacePermission(
    workspaceId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<void> {
    const id = generateId("wp");
    const now = new Date();

    await db
      .insert(workspacePermissions)
      .values({
        id,
        workspaceId,
        userId,
        permission,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [workspacePermissions.workspaceId, workspacePermissions.userId],
        set: {
          permission,
          updatedAt: now,
        },
      });
  },

  /**
   * Grant permission to a user for a project
   */
  async grantProjectPermission(
    projectId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<void> {
    const id = generateId("pp");
    const now = new Date();

    await db
      .insert(projectPermissions)
      .values({
        id,
        projectId,
        userId,
        permission,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [projectPermissions.projectId, projectPermissions.userId],
        set: {
          permission,
          updatedAt: now,
        },
      });
  },

  /**
   * Grant permission to a user for a folder
   */
  async grantFolderPermission(
    folderId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<void> {
    const id = generateId("fp");
    const now = new Date();

    await db
      .insert(folderPermissions)
      .values({
        id,
        folderId,
        userId,
        permission,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [folderPermissions.folderId, folderPermissions.userId],
        set: {
          permission,
          updatedAt: now,
        },
      });
  },

  /**
   * Revoke permission from a user for a workspace
   */
  async revokeWorkspacePermission(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    await db
      .delete(workspacePermissions)
      .where(
        and(
          eq(workspacePermissions.workspaceId, workspaceId),
          eq(workspacePermissions.userId, userId)
        )
      );
  },

  /**
   * Revoke permission from a user for a project
   */
  async revokeProjectPermission(
    projectId: string,
    userId: string
  ): Promise<void> {
    await db
      .delete(projectPermissions)
      .where(
        and(
          eq(projectPermissions.projectId, projectId),
          eq(projectPermissions.userId, userId)
        )
      );
  },

  /**
   * Revoke permission from a user for a folder
   */
  async revokeFolderPermission(
    folderId: string,
    userId: string
  ): Promise<void> {
    await db
      .delete(folderPermissions)
      .where(
        and(
          eq(folderPermissions.folderId, folderId),
          eq(folderPermissions.userId, userId)
        )
      );
  },

  /**
   * Check if a guest user has reached their project limit
   */
  async hasGuestReachedProjectLimit(userId: string): Promise<boolean> {
    // Get user's account memberships where they are a guest
    const guestMemberships = await db
      .select()
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.userId, userId),
          eq(accountMemberships.role, "guest")
        )
      );

    if (guestMemberships.length === 0) {
      return false;
    }

    // Check project count for guest
    const projectCount = await this.getUserProjectCount(userId);
    return projectCount >= GUEST_CONSTRAINTS.MAX_PROJECTS;
  },

  /**
   * Get count of projects a user has access to
   */
  async getUserProjectCount(userId: string): Promise<number> {
    // Count direct project permissions
    const directProjects = await db
      .select()
      .from(projectPermissions)
      .where(eq(projectPermissions.userId, userId));

    // This is a simplified count - in reality we'd need to count unique projects
    // For the guest limit check, direct permissions are the main concern
    return directProjects.length;
  },

  /**
   * Validate that a permission change doesn't violate inheritance rules
   * Cannot lower inherited permissions
   */
  async validatePermissionChange(
    userId: string,
    resourceType: PermissionResourceType,
    resourceId: string,
    newPermission: PermissionLevel
  ): Promise<{ valid: boolean; reason?: string }> {
    // Get inherited permission from parent
    let inheritedPermission: PermissionCheckResult | null = null;

    if (resourceType === "project") {
      // Get project to find workspace
      const projectResults = await db
        .select()
        .from(projects)
        .where(eq(projects.id, resourceId))
        .limit(1);

      if (projectResults.length > 0 && !projectResults[0].isRestricted) {
        inheritedPermission = await this.getWorkspacePermission(
          userId,
          projectResults[0].workspaceId
        );
      }
    } else if (resourceType === "folder") {
      // Get folder to find project
      const folderResults = await db
        .select()
        .from(folders)
        .where(eq(folders.id, resourceId))
        .limit(1);

      if (folderResults.length > 0 && !folderResults[0].isRestricted) {
        inheritedPermission = await this.getProjectPermission(
          userId,
          folderResults[0].projectId
        );
      }
    }

    // Check if new permission is less than inherited (not allowed)
    if (
      inheritedPermission &&
      !isPermissionAtLeast(newPermission, inheritedPermission.permission)
    ) {
      return {
        valid: false,
        reason: `Cannot lower inherited permission (${inheritedPermission.permission})`,
      };
    }

    return { valid: true };
  },
};
