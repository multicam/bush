/**
 * Bush Platform - Workspace Routes
 *
 * API routes for workspace management.
 * Reference: specs/04-api-reference.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { workspaces, workspacePermissions, users, accountMemberships } from "../../db/schema.js";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates, decodeCursor } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, AuthorizationError, ValidationError } from "../../errors/index.js";
import { verifyWorkspaceAccess, verifyAccountMembership } from "../access-control.js";
import { permissionService } from "../../permissions/service.js";
import type { PermissionLevel } from "../../permissions/types.js";
import { isPermissionAtLeast } from "../../permissions/types.js";
import { emitWebhookEvent } from "./index.js";

const app = new Hono();

// Apply authentication to all routes (rate limiting applied at v4 router level)
app.use("*", authMiddleware());

/**
 * GET /v4/workspaces - List workspaces for current account
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");

  // Build conditions
  const conditions = [eq(workspaces.accountId, session.currentAccountId)];

  // Apply cursor pagination via SQL WHERE
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(workspaces.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  const results = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      accountId: workspaces.accountId,
    })
    .from(workspaces)
    .where(and(...conditions))
    .orderBy(desc(workspaces.createdAt))
    .limit(limit + 1);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workspaces)
    .where(eq(workspaces.accountId, session.currentAccountId));

  const items = results.slice(0, limit).map((w) => formatDates(w));

  return sendCollection(c, items, RESOURCE_TYPES.WORKSPACE, {
    basePath: "/v4/workspaces",
    limit,
    totalCount: count,
  });
});

/**
 * GET /v4/workspaces/:id - Get workspace by ID
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");

  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  return sendSingle(c, formatDates(workspace), RESOURCE_TYPES.WORKSPACE);
});

/**
 * POST /v4/workspaces - Create a new workspace
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("Workspace name is required", { pointer: "/data/attributes/name" });
  }

  // Create workspace
  const workspaceId = generateId("ws");
  const now = new Date();

  await db.insert(workspaces).values({
    id: workspaceId,
    accountId: session.currentAccountId,
    name: body.name,
    description: body.description || null,
    createdAt: now,
    updatedAt: now,
  });

  // Grant creator full_access permission
  const permissionId = generateId("wp");
  await db.insert(workspacePermissions).values({
    id: permissionId,
    workspaceId,
    userId: session.userId,
    permission: "full_access",
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return sendSingle(c, formatDates(workspace), RESOURCE_TYPES.WORKSPACE);
});

/**
 * PATCH /v4/workspaces/:id - Update workspace
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");
  const body = await c.req.json();

  // Check workspace exists and belongs to current account
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }

  // Update workspace
  await db.update(workspaces).set(updates).where(eq(workspaces.id, workspaceId));

  // Fetch and return updated workspace
  const [updatedWorkspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return sendSingle(c, formatDates(updatedWorkspace), RESOURCE_TYPES.WORKSPACE);
});

/**
 * DELETE /v4/workspaces/:id - Delete workspace
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");

  // Verify user is owner or content_admin
  const role = await verifyAccountMembership(session.userId, session.currentAccountId, "content_admin");
  if (!role) {
    throw new AuthorizationError("Only account owners and content admins can delete workspaces");
  }

  // Check workspace exists and belongs to current account
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Delete workspace (cascade will delete projects, folders, files)
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

  return sendNoContent(c);
});

// ============================================================================
// MEMBER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /v4/workspaces/:id/members - List workspace members
 *
 * Returns all users with workspace-level permissions.
 * Permission: Workspace Member (any permission level)
 */
app.get("/:id/members", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Verify workspace access
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Get all users with workspace permissions
  const members = await db
    .select({
      id: workspacePermissions.id,
      permission: workspacePermissions.permission,
      createdAt: workspacePermissions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(workspacePermissions)
    .innerJoin(users, eq(workspacePermissions.userId, users.id))
    .where(eq(workspacePermissions.workspaceId, workspaceId))
    .orderBy(desc(workspacePermissions.createdAt))
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

  return sendCollection(c, items, "workspace_member", {
    basePath: `/v4/workspaces/${workspaceId}/members`,
    limit,
    totalCount: items.length,
  });
});

/**
 * POST /v4/workspaces/:id/members - Add member to workspace
 *
 * Grants workspace-level permission to a user.
 * Permission: Full Access+ required
 */
app.post("/:id/members", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");
  const body = await c.req.json();

  // Verify workspace access
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Check caller has full_access permission
  const callerPermission = await permissionService.getWorkspacePermission(session.userId, workspaceId);
  if (!callerPermission || !isPermissionAtLeast(callerPermission.permission, "full_access" as PermissionLevel)) {
    throw new AuthorizationError("Only users with full_access permission can add workspace members");
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
  await permissionService.grantWorkspacePermission(workspaceId, userId, permission);

  // Get the created/updated permission with user info
  const [newMember] = await db
    .select({
      id: workspacePermissions.id,
      permission: workspacePermissions.permission,
      createdAt: workspacePermissions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(workspacePermissions)
    .innerJoin(users, eq(workspacePermissions.userId, users.id))
    .where(
      and(
        eq(workspacePermissions.workspaceId, workspaceId),
        eq(workspacePermissions.userId, userId)
      )
    )
    .limit(1);

  // Emit webhook event for member addition
  await emitWebhookEvent(session.currentAccountId, "member.added", {
    workspace_id: workspaceId,
    user_id: userId,
    permission: permission,
    added_by_user_id: session.userId,
  });

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
  }, "workspace_member", { selfLink: `/v4/workspaces/${workspaceId}/members` });
});

/**
 * PUT /v4/workspaces/:id/members/:user_id - Update member permission
 *
 * Permission: Full Access+ required
 */
app.put("/:id/members/:user_id", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");
  const targetUserId = c.req.param("user_id");
  const body = await c.req.json();

  // Verify workspace access
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Check caller has full_access permission
  const callerPermission = await permissionService.getWorkspacePermission(session.userId, workspaceId);
  if (!callerPermission || !isPermissionAtLeast(callerPermission.permission, "full_access" as PermissionLevel)) {
    throw new AuthorizationError("Only users with full_access permission can update workspace members");
  }

  // Validate input
  const permission = body.data?.attributes?.permission as PermissionLevel | undefined;

  const validPermissions: PermissionLevel[] = ["full_access", "edit_and_share", "edit", "comment_only", "view_only"];
  if (!permission || !validPermissions.includes(permission)) {
    throw new ValidationError(`permission must be one of: ${validPermissions.join(", ")}`, {
      pointer: "/data/attributes/permission",
    });
  }

  // Check if target user has workspace permission
  const [existingPermission] = await db
    .select()
    .from(workspacePermissions)
    .where(
      and(
        eq(workspacePermissions.workspaceId, workspaceId),
        eq(workspacePermissions.userId, targetUserId)
      )
    )
    .limit(1);

  if (!existingPermission) {
    throw new NotFoundError("workspace member", targetUserId);
  }

  // Update permission using permission service
  await permissionService.grantWorkspacePermission(workspaceId, targetUserId, permission);

  // Get updated permission with user info
  const [updatedMember] = await db
    .select({
      id: workspacePermissions.id,
      permission: workspacePermissions.permission,
      createdAt: workspacePermissions.createdAt,
      userId: users.id,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarUrl: users.avatarUrl,
    })
    .from(workspacePermissions)
    .innerJoin(users, eq(workspacePermissions.userId, users.id))
    .where(
      and(
        eq(workspacePermissions.workspaceId, workspaceId),
        eq(workspacePermissions.userId, targetUserId)
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
  }, "workspace_member");
});

/**
 * DELETE /v4/workspaces/:id/members/:user_id - Remove member from workspace
 *
 * Permission: Full Access+ required
 */
app.delete("/:id/members/:user_id", async (c) => {
  const session = requireAuth(c);
  const workspaceId = c.req.param("id");
  const targetUserId = c.req.param("user_id");

  // Verify workspace access
  const workspace = await verifyWorkspaceAccess(workspaceId, session.currentAccountId);
  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Check caller has full_access permission
  const callerPermission = await permissionService.getWorkspacePermission(session.userId, workspaceId);
  if (!callerPermission || !isPermissionAtLeast(callerPermission.permission, "full_access" as PermissionLevel)) {
    throw new AuthorizationError("Only users with full_access permission can remove workspace members");
  }

  // Prevent removing self
  if (targetUserId === session.userId) {
    throw new ValidationError("You cannot remove yourself from the workspace", {
      pointer: "/data/attributes/user_id",
    });
  }

  // Check if target user has workspace permission
  const [existingPermission] = await db
    .select()
    .from(workspacePermissions)
    .where(
      and(
        eq(workspacePermissions.workspaceId, workspaceId),
        eq(workspacePermissions.userId, targetUserId)
      )
    )
    .limit(1);

  if (!existingPermission) {
    throw new NotFoundError("workspace member", targetUserId);
  }

  // Revoke permission using permission service
  await permissionService.revokeWorkspacePermission(workspaceId, targetUserId);

  // Emit webhook event for member removal
  await emitWebhookEvent(session.currentAccountId, "member.removed", {
    workspace_id: workspaceId,
    user_id: targetUserId,
    removed_by_user_id: session.userId,
  });

  return sendNoContent(c);
});

export default app;
