/**
 * Bush Platform - Project Routes
 *
 * API routes for project management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { projects, workspaces, projectPermissions, folders } from "../../db/schema.js";
import { eq, and, desc, isNull } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { standardRateLimit } from "../rate-limit.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { requirePermission, permissions } from "../../permissions/middleware.js";

const app = new Hono();

// Apply authentication and rate limiting to all routes
app.use("*", authMiddleware());
app.use("*", standardRateLimit);

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

  // Get project with workspace info for account check
  const [project] = await db
    .select()
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError("project", projectId);
  }

  // Verify project belongs to current account
  if (project.workspaces.accountId !== session.currentAccountId) {
    throw new NotFoundError("project", projectId);
  }

  return sendSingle(c, formatDates(project.projects), RESOURCE_TYPES.PROJECT);
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
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, body.workspace_id),
        eq(workspaces.accountId, session.currentAccountId)
      )
    )
    .limit(1);

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

  // Get project with workspace info
  const [projectWithWorkspace] = await db
    .select()
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!projectWithWorkspace) {
    throw new NotFoundError("project", projectId);
  }

  // Verify project belongs to current account
  if (projectWithWorkspace.workspaces.accountId !== session.currentAccountId) {
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
  if (body.archived !== true) {
    updates.archivedAt = null;
  } else if (body.archived === true) {
    updates.archivedAt = new Date();
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

  // Get project with workspace info
  const [projectWithWorkspace] = await db
    .select()
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!projectWithWorkspace) {
    throw new NotFoundError("project", projectId);
  }

  // Verify project belongs to current account
  if (projectWithWorkspace.workspaces.accountId !== session.currentAccountId) {
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
