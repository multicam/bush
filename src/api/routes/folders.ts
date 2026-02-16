/**
 * Bush Platform - Folder Routes
 *
 * API routes for folder management.
 * Reference: specs/17-api-complete.md Section 6.4
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { folders, files } from "../../db/schema.js";
import { eq, and, desc, isNull } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyProjectAccess, verifyFolderAccess } from "../access-control.js";

const app = new Hono();

// Apply authentication to all routes (rate limiting applied at v4 router level)
app.use("*", authMiddleware());

/**
 * Helper to build folder path
 */
function buildFolderPath(parentPath: string, folderName: string): string {
  if (parentPath === "/") {
    return `/${folderName}`;
  }
  return `${parentPath}/${folderName}`;
}

/**
 * GET /v4/projects/:projectId/folders - List root-level folders in a project
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
  const limit = parseLimit(c.req.query("limit"));

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get root-level folders (no parent)
  const results = await db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.projectId, projectId),
        isNull(folders.parentId)
      )
    )
    .orderBy(desc(folders.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((f) => formatDates(f));

  return sendCollection(c, items, RESOURCE_TYPES.FOLDER, {
    basePath: `/v4/projects/${projectId}/folders`,
    limit,
    totalCount: results.length,
  });
});

/**
 * GET /v4/folders/:id - Get folder details
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const folderId = c.req.param("id");

  // Verify folder access
  const access = await verifyFolderAccess(folderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", folderId);
  }

  return sendSingle(c, formatDates(access.folder), RESOURCE_TYPES.FOLDER);
});

/**
 * GET /v4/folders/:id/children - List folder contents (files and subfolders)
 */
app.get("/:id/children", async (c) => {
  const session = requireAuth(c);
  const folderId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Verify folder access
  const access = await verifyFolderAccess(folderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", folderId);
  }

  // Get subfolders
  const subfolders = await db
    .select()
    .from(folders)
    .where(eq(folders.parentId, folderId))
    .orderBy(desc(folders.createdAt))
    .limit(limit);

  // Get files in this folder
  const filesInFolder = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.folderId, folderId),
        isNull(files.deletedAt)
      )
    )
    .orderBy(desc(files.createdAt))
    .limit(limit);

  // Format as mixed collection
  const folderItems = subfolders.map((f) => ({
    ...formatDates(f),
    type: RESOURCE_TYPES.FOLDER,
  }));

  const fileItems = filesInFolder.map((f) => ({
    ...formatDates(f),
    type: RESOURCE_TYPES.FILE,
  }));

  const allItems = [...folderItems, ...fileItems].slice(0, limit);

  return c.json({
    data: allItems.map((item) => ({
      id: item.id,
      type: item.type,
      attributes: item,
    })),
    meta: {
      folders_count: folderItems.length,
      files_count: fileItems.length,
      total_count: allItems.length,
      page_size: limit,
    },
  });
});

/**
 * POST /v4/projects/:projectId/folders - Create folder at project root
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("Folder name is required", { pointer: "/data/attributes/name" });
  }

  // Check for duplicate folder name in root
  const existing = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.projectId, projectId),
        isNull(folders.parentId),
        eq(folders.name, body.name)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ValidationError("A folder with this name already exists in this location", { pointer: "/data/attributes/name" });
  }

  // Create folder
  const folderId = generateId("fld");
  const now = new Date();
  const path = `/${body.name}`;

  await db.insert(folders).values({
    id: folderId,
    projectId,
    parentId: null,
    name: body.name,
    path,
    depth: 0,
    isRestricted: body.is_restricted === true,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created folder
  const [folder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  return sendSingle(c, formatDates(folder), RESOURCE_TYPES.FOLDER);
});

/**
 * POST /v4/folders/:id/folders - Create subfolder
 */
app.post("/:id/folders", async (c) => {
  const session = requireAuth(c);
  const parentFolderId = c.req.param("id");
  const body = await c.req.json();

  // Verify parent folder access
  const access = await verifyFolderAccess(parentFolderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", parentFolderId);
  }

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("Folder name is required", { pointer: "/data/attributes/name" });
  }

  // Check for duplicate folder name
  const existing = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.parentId, parentFolderId),
        eq(folders.name, body.name)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ValidationError("A folder with this name already exists in this location", { pointer: "/data/attributes/name" });
  }

  // Create subfolder
  const folderId = generateId("fld");
  const now = new Date();
  const newPath = buildFolderPath(access.folder.path, body.name);
  const newDepth = access.folder.depth + 1;

  await db.insert(folders).values({
    id: folderId,
    projectId: access.folder.projectId,
    parentId: parentFolderId,
    name: body.name,
    path: newPath,
    depth: newDepth,
    isRestricted: body.is_restricted === true,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created folder
  const [folder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  return sendSingle(c, formatDates(folder), RESOURCE_TYPES.FOLDER);
});

/**
 * PATCH /v4/folders/:id - Update folder
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const folderId = c.req.param("id");
  const body = await c.req.json();

  // Verify folder access
  const access = await verifyFolderAccess(folderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", folderId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    // Check for duplicate name in same location
    const existing = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.projectId, access.folder.projectId),
          access.folder.parentId
            ? eq(folders.parentId, access.folder.parentId)
            : isNull(folders.parentId),
          eq(folders.name, body.name)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].id !== folderId) {
      throw new ValidationError("A folder with this name already exists in this location", { pointer: "/data/attributes/name" });
    }

    updates.name = body.name;

    // Update path based on new name
    const parentPath = access.folder.path.substring(0, access.folder.path.lastIndexOf("/"));
    updates.path = parentPath ? `${parentPath}/${body.name}` : `/${body.name}`;
  }

  if (body.is_restricted !== undefined) {
    updates.isRestricted = body.is_restricted;
  }

  // Update folder
  await db.update(folders).set(updates).where(eq(folders.id, folderId));

  // Fetch and return updated folder
  const [folder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  return sendSingle(c, formatDates(folder), RESOURCE_TYPES.FOLDER);
});

/**
 * DELETE /v4/folders/:id - Delete folder and contents
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const folderId = c.req.param("id");

  // Verify folder access
  const access = await verifyFolderAccess(folderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", folderId);
  }

  // Don't allow deleting root folder (path = "/")
  if (access.folder.path === "/") {
    throw new ValidationError("Cannot delete the project root folder");
  }

  // Delete folder (cascade will delete subfolders and update files)
  await db.delete(folders).where(eq(folders.id, folderId));

  return sendNoContent(c);
});

/**
 * POST /v4/folders/:id/move - Move folder to new parent
 */
app.post("/:id/move", async (c) => {
  const session = requireAuth(c);
  const folderId = c.req.param("id");
  const body = await c.req.json();

  // Verify folder access
  const access = await verifyFolderAccess(folderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", folderId);
  }

  // Don't allow moving root folder
  if (access.folder.path === "/") {
    throw new ValidationError("Cannot move the project root folder");
  }

  let newParentId: string | null = null;
  let newParentPath = "/";
  let newDepth = 0;

  if (body.parent_id) {
    // Verify new parent folder
    const parentAccess = await verifyFolderAccess(body.parent_id, session.currentAccountId);
    if (!parentAccess) {
      throw new NotFoundError("folder", body.parent_id);
    }

    // Can't move folder into itself or its descendants
    if (body.parent_id === folderId || parentAccess.folder.path.startsWith(access.folder.path + "/")) {
      throw new ValidationError("Cannot move folder into itself or one of its descendants");
    }

    // Must be same project
    if (parentAccess.folder.projectId !== access.folder.projectId) {
      throw new ValidationError("Cannot move folder to a different project");
    }

    newParentId = body.parent_id;
    newParentPath = parentAccess.folder.path;
    newDepth = parentAccess.folder.depth + 1;
  }

  // Check for duplicate name in new location
  const existing = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.projectId, access.folder.projectId),
        newParentId ? eq(folders.parentId, newParentId) : isNull(folders.parentId),
        eq(folders.name, access.folder.name)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0].id !== folderId) {
    throw new ValidationError("A folder with this name already exists in the destination");
  }

  // Calculate new path
  const newPath = buildFolderPath(newParentPath, access.folder.name);

  // Update folder
  await db
    .update(folders)
    .set({
      parentId: newParentId,
      path: newPath,
      depth: newDepth,
      updatedAt: new Date(),
    })
    .where(eq(folders.id, folderId));

  // Fetch and return updated folder
  const [folder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  return sendSingle(c, formatDates(folder), RESOURCE_TYPES.FOLDER);
});

/**
 * GET /v4/folders/:id/files - List files in folder
 */
app.get("/:id/files", async (c) => {
  const session = requireAuth(c);
  const folderId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));
  const status = c.req.query("status");

  // Verify folder access
  const access = await verifyFolderAccess(folderId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("folder", folderId);
  }

  // Build query conditions
  const conditions = [eq(files.folderId, folderId), isNull(files.deletedAt)];

  if (status) {
    conditions.push(eq(files.status, status as typeof files.$inferSelect.status));
  }

  // Get files
  const results = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((f) => formatDates(f));

  return sendCollection(c, items, RESOURCE_TYPES.FILE, {
    basePath: `/v4/folders/${folderId}/files`,
    limit,
    totalCount: results.length,
  });
});

export default app;
