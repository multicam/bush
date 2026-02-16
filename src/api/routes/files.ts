/**
 * Bush Platform - File Routes
 *
 * API routes for file management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { files, projects, workspaces, folders } from "../../db/schema.js";
import { eq, and, desc, isNull, isNotNull, inArray } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { standardRateLimit, searchRateLimit } from "../rate-limit.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates, encodeCursor, decodeCursor } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { config } from "../../config/index.js";

const app = new Hono();

// Apply authentication and rate limiting to all routes
app.use("*", authMiddleware());
app.use("*", standardRateLimit);

/**
 * Helper to verify project belongs to current account
 */
async function verifyProjectAccess(
  projectId: string,
  accountId: string
): Promise<{ project: typeof projects.$inferSelect; workspace: typeof workspaces.$inferSelect } | null> {
  const [result] = await db
    .select()
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(workspaces.accountId, accountId)
      )
    )
    .limit(1);

  if (!result) return null;

  return {
    project: result.projects,
    workspace: result.workspaces,
  };
}

/**
 * GET /v4/projects/:projectId/files - List files in a project
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId");
  const limit = parseLimit(c.req.query("limit"));
  const folderId = c.req.query("folder_id");
  const status = c.req.query("status");
  const cursor = c.req.query("cursor");

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Build query
  const conditions = [eq(files.projectId, projectId)];

  if (folderId) {
    conditions.push(eq(files.folderId, folderId));
  } else {
    // Root folder files
    conditions.push(isNull(files.folderId));
  }

  if (status) {
    conditions.push(eq(files.status, status as typeof files.$inferSelect.status));
  }

  // Exclude deleted files by default
  conditions.push(isNull(files.deletedAt));

  // Get files
  const results = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .limit(limit + 1);

  // Apply cursor pagination
  let items = results.slice(0, limit);
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.id) {
      // Find cursor position and slice
      const cursorIndex = results.findIndex((r) => r.id === cursorData.id);
      if (cursorIndex >= 0) {
        items = results.slice(cursorIndex + 1, cursorIndex + 1 + limit);
      }
    }
  }

  const formattedItems = items.map((f) => formatDates(f));

  return sendCollection(c, formattedItems, RESOURCE_TYPES.FILE, {
    basePath: `/v4/projects/${projectId}/files`,
    limit,
    totalCount: results.length,
  });
});

/**
 * GET /v4/projects/:projectId/files/:id - Get file by ID
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId");
  const fileId = c.req.param("id");

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.projectId, projectId),
        isNull(files.deletedAt)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  return sendSingle(c, formatDates(file), RESOURCE_TYPES.FILE);
});

/**
 * POST /v4/projects/:projectId/files - Create file record (for upload)
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId");
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("File name is required", { pointer: "/data/attributes/name" });
  }

  if (!body.mime_type || typeof body.mime_type !== "string") {
    throw new ValidationError("MIME type is required", { pointer: "/data/attributes/mime_type" });
  }

  if (!body.file_size_bytes || typeof body.file_size_bytes !== "number") {
    throw new ValidationError("File size is required", { pointer: "/data/attributes/file_size_bytes" });
  }

  // Validate file size
  if (body.file_size_bytes > config.UPLOAD_MAX_FILE_SIZE) {
    throw new ValidationError(
      `File size exceeds maximum allowed (${config.UPLOAD_MAX_FILE_SIZE} bytes)`,
      { pointer: "/data/attributes/file_size_bytes" }
    );
  }

  // Verify folder if specified
  if (body.folder_id) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.id, body.folder_id),
          eq(folders.projectId, projectId)
        )
      )
      .limit(1);

    if (!folder) {
      throw new NotFoundError("folder", body.folder_id);
    }
  }

  // Create file record
  const fileId = generateId("file");
  const now = new Date();

  await db.insert(files).values({
    id: fileId,
    projectId,
    folderId: body.folder_id || null,
    versionStackId: body.version_stack_id || null,
    name: body.name,
    originalName: body.original_name || body.name,
    mimeType: body.mime_type,
    fileSizeBytes: body.file_size_bytes,
    checksum: body.checksum || null,
    status: "uploading",
    deletedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created file
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  // Generate upload URL (would integrate with storage module)
  const uploadUrl = `${config.API_URL}/v4/projects/${projectId}/files/${fileId}/upload`;

  return c.json({
    data: {
      id: file.id,
      type: "file",
      attributes: formatDates(file),
    },
    meta: {
      upload_url: uploadUrl,
      upload_method: "presigned_url",
      chunk_size: config.UPLOAD_MULTIPART_CHUNK_SIZE,
    },
  });
});

/**
 * PATCH /v4/projects/:projectId/files/:id - Update file metadata
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId");
  const fileId = c.req.param("id");
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.projectId, projectId),
        isNull(files.deletedAt)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.folder_id !== undefined) {
    // Verify folder
    if (body.folder_id) {
      const [folder] = await db
        .select()
        .from(folders)
        .where(eq(folders.id, body.folder_id))
        .limit(1);

      if (!folder || folder.projectId !== projectId) {
        throw new NotFoundError("folder", body.folder_id);
      }
    }
    updates.folderId = body.folder_id;
  }
  if (body.status !== undefined) {
    updates.status = body.status;
  }

  // Update file
  await db.update(files).set(updates).where(eq(files.id, fileId));

  // Fetch and return updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return sendSingle(c, formatDates(updatedFile), RESOURCE_TYPES.FILE);
});

/**
 * DELETE /v4/projects/:projectId/files/:id - Soft delete file
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId");
  const fileId = c.req.param("id");

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.projectId, projectId),
        isNull(files.deletedAt)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Soft delete
  await db
    .update(files)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  return sendNoContent(c);
});

/**
 * POST /v4/projects/:projectId/files/:id/move - Move file to folder
 */
app.post("/:id/move", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId");
  const fileId = c.req.param("id");
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.projectId, projectId),
        isNull(files.deletedAt)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Verify target folder (null = root)
  if (body.folder_id) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.id, body.folder_id),
          eq(folders.projectId, projectId)
        )
      )
      .limit(1);

    if (!folder) {
      throw new NotFoundError("folder", body.folder_id);
    }
  }

  // Update file
  await db
    .update(files)
    .set({
      folderId: body.folder_id || null,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  // Fetch and return updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return sendSingle(c, formatDates(updatedFile), RESOURCE_TYPES.FILE);
});

export default app;
