/**
 * Bush Platform - Workspace Routes
 *
 * API routes for workspace management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { workspaces, accounts, accountMemberships, workspacePermissions } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireAuth, getCurrentAccountId } from "../auth-middleware.js";
import { standardRateLimit } from "../rate-limit.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates, encodeCursor, decodeCursor } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";

const app = new Hono();

// Apply authentication and rate limiting to all routes
app.use("*", authMiddleware());
app.use("*", standardRateLimit);

/**
 * GET /v4/workspaces - List workspaces for current account
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");

  // Build query - only show workspaces for current account
  let query = db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      accountId: workspaces.accountId,
    })
    .from(workspaces)
    .where(eq(workspaces.accountId, session.currentAccountId))
    .orderBy(desc(workspaces.createdAt))
    .limit(limit + 1); // +1 to check for hasMore

  // Apply cursor if provided
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.id) {
      query = db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          description: workspaces.description,
          createdAt: workspaces.createdAt,
          updatedAt: workspaces.updatedAt,
          accountId: workspaces.accountId,
        })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.accountId, session.currentAccountId)
          )
        )
        .orderBy(desc(workspaces.createdAt))
        .limit(limit + 1);
    }
  }

  const results = await query;

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

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.accountId, session.currentAccountId)
      )
    )
    .limit(1);

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
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.accountId, session.currentAccountId)
      )
    )
    .limit(1);

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

  // Check workspace exists and belongs to current account
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.accountId, session.currentAccountId)
      )
    )
    .limit(1);

  if (!workspace) {
    throw new NotFoundError("workspace", workspaceId);
  }

  // Delete workspace (cascade will delete projects, folders, files)
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

  return sendNoContent(c);
});

export default app;
