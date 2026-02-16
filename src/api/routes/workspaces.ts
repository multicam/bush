/**
 * Bush Platform - Workspace Routes
 *
 * API routes for workspace management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { workspaces, workspacePermissions } from "../../db/schema.js";
import { eq, and, desc, lt } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates, decodeCursor } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, AuthorizationError } from "../../errors/index.js";
import { verifyWorkspaceAccess, verifyAccountMembership } from "../access-control.js";

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
  const countResult = await db
    .select({ count: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.accountId, session.currentAccountId));

  const items = results.slice(0, limit).map((w) => formatDates(w));

  return sendCollection(c, items, RESOURCE_TYPES.WORKSPACE, {
    basePath: "/v4/workspaces",
    limit,
    totalCount: countResult.length,
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

export default app;
