/**
 * Bush Platform - Project Routes
 *
 * API routes for project management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { projects, projectPermissions, folders } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyWorkspaceAccess, verifyProjectAccess } from "../access-control.js";

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

export default app;
