/**
 * Bush Platform - Project Routes
 *
 * API routes for project management.
 * Reference: specs/04-api-reference.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { projects, projectPermissions, folders, users, accountMemberships, files, accounts } from "../../db/schema.js";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyWorkspaceAccess, verifyProjectAccess } from "../access-control.js";
import { permissionService } from "../../permissions/service.js";
import type { PermissionLevel } from "../../permissions/types.js";
import { isPermissionAtLeast } from "../../permissions/types.js";

const app = new Hono();

// Apply authentication to all routes (rate limiting applied at v4 router level)
app.use("*", authMiddleware());

/**
 * GET /v4/projects - List projects for a workspace
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.query("workspace_id");
  const limit = parseLimit(c.req.query("limit"));

  if (!workspaceId) {
    throw new ValidationError("workspace_id is required", { parameter: "workspace_id" });
  }

  // Verify workspace belongs to current account
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Get projects
  const results = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((p) => formatDates(p));

  return sendCollection(c, items, RESOURCE_TYPES.PROJECT, {
    basePath: "/v4/projects",
    limit,
    queryParams: { workspace_id: workspaceId },
    totalCount: results.length,
  });
});

/**
 * GET /v4/projects/:id - Get project by ID
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");

  // Verify project belongs to current account
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  return sendSingle(c, formatDates(access.project), RESOURCE_TYPES.PROJECT);
});

/**
 * POST /v4/projects - Create a new project
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("Project name is required", { pointer: "/data/attributes/name" });
  }

  if (!body.workspace_id || typeof body.workspace_id !== "string") {
    throw new ValidationError("Workspace ID is required", { pointer: "/data/relationships/workspace/id" });
  }

  // Verify workspace belongs to current account
  const workspace = await verifyWorkspaceAccess(body.workspace_id, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", body.workspace_id);
  }

  // Create project
  const projectId = generateId("prj");
  const now = new Date();

  await db.insert(projects).values({
    id: projectId,
    workspaceId: body.workspace_id,
    name: body.name,
    description: body.description || null,
    isRestricted: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Create root folder
  const rootFolderId = generateId("fld");
  await db.insert(folders).values({
    id: rootFolderId,
    projectId,
    parentId: null,
    name: "Root",
    path: "/",
    depth: 0,
    isRestricted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Grant creator full_access permission
  const permissionId = generateId("pp");
  await db.insert(projectPermissions).values({
    id: permissionId,
    projectId,
    userId: session.userId,
    permission: "full_access",
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return sendSingle(c, formatDates(project), RESOURCE_TYPES.PROJECT);
});

/**
 * PATCH /v4/projects/:id - Update project
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");
  const body = await c.req.json();

  // Verify project belongs to current account
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.is_restricted !== undefined) {
    updates.isRestricted = body.is_restricted;
  }
  if (body.archived === true) {
    updates.archivedAt = new Date();
  } else if (body.archived === false) {
    updates.archivedAt = null;
  }

  // Update project
  await db.update(projects).set(updates).where(eq(projects.id, projectId));

  // Fetch and return updated project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return sendSingle(c, formatDates(project), RESOURCE_TYPES.PROJECT);
});

/**
 * DELETE /v4/projects/:id - Archive project (soft delete)
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");

  // Verify project belongs to current account
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Archive project (soft delete)
  await db
    .update(projects)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return sendNoContent(c);
});

/**
 * POST /v4/projects/:id/duplicate - Duplicate a project
 *
 * Creates a copy of a project with:
 * - Same workspace
 * - Same folder structure (new IDs)
 * - Same files (new IDs, same storage)
 * - Same project-level permissions
 *
 * Storage is counted again for the duplicated files.
 */
app.post("/:id/duplicate", async (c) => {
  const session = requireAuth(c);
  const sourceProjectId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  // Verify source project access
  const access = await verifyProjectAccess(sourceProjectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", sourceProjectId);
  }

  const sourceProject = access.project;

  // Check storage quota before duplicating
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, session.currentAccountId))
    .limit(1);

  if (!account) {
    throw new NotFoundError("account", session.currentAccountId);
  }

  // Calculate total size of files in source project
  const [{ totalSize }] = await db
    .select({ totalSize: sql<number>`coalesce(sum(file_size_bytes), 0)` })
    .from(files)
    .where(
      and(
        eq(files.projectId, sourceProjectId),
        isNull(files.deletedAt)
      )
    );

  const totalFileSize = Number(totalSize);

  // Check quota
  if (account.storageUsedBytes + totalFileSize > account.storageQuotaBytes) {
    throw new ValidationError("Insufficient storage quota to duplicate project", {
      pointer: "/data/attributes/storage",
    });
  }

  const now = new Date();
  const newProjectId = generateId("prj");
  const projectName = body.name || `${sourceProject.name} (Copy)`;

  // Create ID mappings for folders (old -> new)
  const folderIdMap = new Map<string, string>();

  // Create ID mappings for files (old -> new)
  const fileIdMap = new Map<string, string>();

  // Start transaction for atomic duplication
  await db.transaction(async (tx) => {
    // 1. Create new project
    await tx.insert(projects).values({
      id: newProjectId,
      workspaceId: sourceProject.workspaceId,
      name: projectName,
      description: sourceProject.description,
      isRestricted: sourceProject.isRestricted,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Get all folders in source project
    const sourceFolders = await tx
      .select()
      .from(folders)
      .where(eq(folders.projectId, sourceProjectId));

    // Sort folders by depth to ensure parents are created before children
    sourceFolders.sort((a, b) => a.depth - b.depth);

    // 3. Create new folders with mapped parent IDs
    for (const folder of sourceFolders) {
      const newFolderId = generateId("fld");
      folderIdMap.set(folder.id, newFolderId);

      // Map parent ID if exists
      let newParentId: string | null = null;
      if (folder.parentId) {
        newParentId = folderIdMap.get(folder.parentId) || null;
      }

      await tx.insert(folders).values({
        id: newFolderId,
        projectId: newProjectId,
        parentId: newParentId,
        name: folder.name,
        path: folder.path, // Path may need updating, but keeping structure same
        depth: folder.depth,
        isRestricted: folder.isRestricted,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. Get all files in source project
    const sourceFiles = await tx
      .select()
      .from(files)
      .where(
        and(
          eq(files.projectId, sourceProjectId),
          isNull(files.deletedAt)
        )
      );

    // 5. Create new files with mapped folder IDs
    for (const file of sourceFiles) {
      const newFileId = generateId("file");
      fileIdMap.set(file.id, newFileId);

      // Map folder ID if exists
      const newFolderId = file.folderId ? folderIdMap.get(file.folderId) || null : null;

      // Map version stack ID if exists (will update later)
      let newVersionStackId = file.versionStackId;
      // For now, don't copy version stack membership - files start unstacked
      newVersionStackId = null;

      await tx.insert(files).values({
        id: newFileId,
        projectId: newProjectId,
        folderId: newFolderId,
        versionStackId: newVersionStackId,
        name: file.name,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        checksum: file.checksum,
        status: file.status,
        technicalMetadata: file.technicalMetadata,
        rating: file.rating,
        assetStatus: file.assetStatus,
        keywords: file.keywords,
        notes: file.notes,
        assigneeId: file.assigneeId,
        customMetadata: file.customMetadata,
        customThumbnailKey: file.customThumbnailKey,
        deletedAt: null,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 6. Copy project permissions
    const sourcePermissions = await tx
      .select()
      .from(projectPermissions)
      .where(eq(projectPermissions.projectId, sourceProjectId));

    for (const perm of sourcePermissions) {
      await tx.insert(projectPermissions).values({
        id: generateId("pp"),
        projectId: newProjectId,
        userId: perm.userId,
        permission: perm.permission,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 7. Update storage usage
    if (totalFileSize > 0) {
      await tx
        .update(accounts)
        .set({
          storageUsedBytes: account.storageUsedBytes + totalFileSize,
          updatedAt: now,
        })
        .where(eq(accounts.id, session.currentAccountId));
    }
  });

  // Fetch and return the created project
  const [newProject] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, newProjectId))
    .limit(1);

  return sendSingle(c, {
    ...formatDates(newProject!),
    duplicated_from: sourceProjectId,
    files_copied: fileIdMap.size,
    folders_copied: folderIdMap.size,
  }, RESOURCE_TYPES.PROJECT);
});

// ============================================================================
// MEMBER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /v4/projects/:id/members - List project members
 *
 * Returns all users with project-level permissions.
 * Permission: Project Member (any permission level)
 */
app.get("/:id/members", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get all users with project permissions
  const members = await db
    .select({
      id: projectPermissions.id,
      permission: projectPermissions.permission,
      createdAt: projectPermissions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(projectPermissions)
    .innerJoin(users, eq(projectPermissions.userId, users.id))
    .where(eq(projectPermissions.projectId, projectId))
    .orderBy(desc(projectPermissions.createdAt))
    .limit(limit);

  const items = members.map((m) => ({
    id: m.id,
    permission: m.permission,
    created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt as number).toISOString(),
    user: {
      id: m.userId,
      email: m.userEmail,
      first_name: m.userFirstName,
      last_name: m.userLastName,
      avatar_url: m.userAvatarUrl,
    },
  }));

  return sendCollection(c, items, "project_member", {
    basePath: `/v4/projects/${projectId}/members`,
    limit,
    totalCount: items.length,
  });
});

/**
 * POST /v4/projects/:id/members - Add member to project
 *
 * Grants project-level permission to a user.
 * Permission: Full Access+ required
 */
app.post("/:id/members", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Check caller has full_access permission
  const callerPermission = await permissionService.getProjectPermission(session.userId, projectId);
  if (!callerPermission || !isPermissionAtLeast(callerPermission.permission, "full_access" as PermissionLevel)) {
    throw new AuthorizationError("Only users with full_access permission can add project members");
  }

  // Validate input
  const userId = body.data?.attributes?.user_id;
  const permission = body.data?.attributes?.permission as PermissionLevel | undefined;

  if (!userId || typeof userId !== "string") {
    throw new ValidationError("user_id is required", { pointer: "/data/attributes/user_id" });
  }

  const validPermissions: PermissionLevel[] = ["full_access", "edit_and_share", "edit", "comment_only", "view_only"];
  if (!permission || !validPermissions.includes(permission)) {
    throw new ValidationError(`permission must be one of: ${validPermissions.join(", ")}`, {
      pointer: "/data/attributes/permission",
    });
  }

  // Verify target user is a member of the account
  const [targetMembership] = await db
    .select()
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, userId),
        eq(accountMemberships.accountId, session.currentAccountId)
      )
    )
    .limit(1);

  if (!targetMembership) {
    throw new ValidationError("User is not a member of this account", {
      pointer: "/data/attributes/user_id",
    });
  }

  // Grant permission using permission service
  await permissionService.grantProjectPermission(projectId, userId, permission);

  // Get the created/updated permission with user info
  const [newMember] = await db
    .select({
      id: projectPermissions.id,
      permission: projectPermissions.permission,
      createdAt: projectPermissions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(projectPermissions)
    .innerJoin(users, eq(projectPermissions.userId, users.id))
    .where(
      and(
        eq(projectPermissions.projectId, projectId),
        eq(projectPermissions.userId, userId)
      )
    )
    .limit(1);

  return sendSingle(c, {
    id: newMember!.id,
    permission: newMember!.permission,
    created_at: newMember!.createdAt instanceof Date ? newMember!.createdAt.toISOString() : new Date(newMember!.createdAt as number).toISOString(),
    user: {
      id: newMember!.userId,
      email: newMember!.userEmail,
      first_name: newMember!.userFirstName,
      last_name: newMember!.userLastName,
      avatar_url: newMember!.userAvatarUrl,
    },
  }, "project_member", { selfLink: `/v4/projects/${projectId}/members` });
});

/**
 * PUT /v4/projects/:id/members/:user_id - Update member permission
 *
 * Permission: Full Access+ required
 */
app.put("/:id/members/:user_id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");
  const targetUserId = c.req.param("user_id");
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Check caller has full_access permission
  const callerPermission = await permissionService.getProjectPermission(session.userId, projectId);
  if (!callerPermission || !isPermissionAtLeast(callerPermission.permission, "full_access" as PermissionLevel)) {
    throw new AuthorizationError("Only users with full_access permission can update project members");
  }

  // Validate input
  const permission = body.data?.attributes?.permission as PermissionLevel | undefined;

  const validPermissions: PermissionLevel[] = ["full_access", "edit_and_share", "edit", "comment_only", "view_only"];
  if (!permission || !validPermissions.includes(permission)) {
    throw new ValidationError(`permission must be one of: ${validPermissions.join(", ")}`, {
      pointer: "/data/attributes/permission",
    });
  }

  // Check if target user has project permission
  const [existingPermission] = await db
    .select()
    .from(projectPermissions)
    .where(
      and(
        eq(projectPermissions.projectId, projectId),
        eq(projectPermissions.userId, targetUserId)
      )
    )
    .limit(1);

  if (!existingPermission) {
    throw new NotFoundError("project member", targetUserId);
  }

  // Update permission using permission service
  await permissionService.grantProjectPermission(projectId, targetUserId, permission);

  // Get updated permission with user info
  const [updatedMember] = await db
    .select({
      id: projectPermissions.id,
      permission: projectPermissions.permission,
      createdAt: projectPermissions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(projectPermissions)
    .innerJoin(users, eq(projectPermissions.userId, users.id))
    .where(
      and(
        eq(projectPermissions.projectId, projectId),
        eq(projectPermissions.userId, targetUserId)
      )
    )
    .limit(1);

  return sendSingle(c, {
    id: updatedMember!.id,
    permission: updatedMember!.permission,
    created_at: updatedMember!.createdAt instanceof Date ? updatedMember!.createdAt.toISOString() : new Date(updatedMember!.createdAt as number).toISOString(),
    user: {
      id: updatedMember!.userId,
      email: updatedMember!.userEmail,
      first_name: updatedMember!.userFirstName,
      last_name: updatedMember!.userLastName,
      avatar_url: updatedMember!.userAvatarUrl,
    },
  }, "project_member");
});

/**
 * DELETE /v4/projects/:id/members/:user_id - Remove member from project
 *
 * Permission: Full Access+ required
 */
app.delete("/:id/members/:user_id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("id");
  const targetUserId = c.req.param("user_id");

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Check caller has full_access permission
  const callerPermission = await permissionService.getProjectPermission(session.userId, projectId);
  if (!callerPermission || !isPermissionAtLeast(callerPermission.permission, "full_access" as PermissionLevel)) {
    throw new AuthorizationError("Only users with full_access permission can remove project members");
  }

  // Prevent removing self
  if (targetUserId === session.userId) {
    throw new ValidationError("You cannot remove yourself from the project", {
      pointer: "/data/attributes/user_id",
    });
  }

  // Check if target user has project permission
  const [existingPermission] = await db
    .select()
    .from(projectPermissions)
    .where(
      and(
        eq(projectPermissions.projectId, projectId),
        eq(projectPermissions.userId, targetUserId)
      )
    )
    .limit(1);

  if (!existingPermission) {
    throw new NotFoundError("project member", targetUserId);
  }

  // Revoke permission using permission service
  await permissionService.revokeProjectPermission(projectId, targetUserId);

  return sendNoContent(c);
});

export default app;
