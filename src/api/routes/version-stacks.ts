/**
 * Bush Platform - Version Stack Routes
 *
 * API routes for version stack management.
 * Reference: specs/17-api-complete.md Section 6.6
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { files, versionStacks } from "../../db/schema.js";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyProjectAccess } from "../access-control.js";
import {
  getVersionStackComments,
  createVersionStackComment,
} from "./comments.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * GET /v4/version-stacks/:id - Get version stack details
 *
 * Returns the stack with all version files in the stack.
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Get all files in the stack
  const stackFiles = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.versionStackId, stackId),
        isNull(files.deletedAt)
      )
    )
    .orderBy(desc(files.createdAt));

  return c.json({
    data: {
      id: stack.id,
      type: "version_stack",
      attributes: formatDates(stack),
      relationships: {
        files: {
          data: stackFiles.map((f) => ({ id: f.id, type: "file" })),
        },
        current_file: stack.currentFileId
          ? { data: { id: stack.currentFileId, type: "file" } }
          : { data: null },
      },
    },
    included: stackFiles.map((f) => ({
      id: f.id,
      type: "file",
      attributes: formatDates(f),
    })),
  });
});

/**
 * POST /v4/version-stacks - Create a new version stack
 *
 * Creates an empty version stack. Files can be added via POST /v4/files/:id/versions
 * or by updating the file's version_stack_id.
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  // Validate input
  if (!body.project_id || typeof body.project_id !== "string") {
    throw new ValidationError("project_id is required", { pointer: "/data/attributes/project_id" });
  }

  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("name is required", { pointer: "/data/attributes/name" });
  }

  // Verify project access
  const access = await verifyProjectAccess(body.project_id, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", body.project_id);
  }

  // Create version stack
  const stackId = generateId("vstack");
  const now = new Date();

  await db.insert(versionStacks).values({
    id: stackId,
    projectId: body.project_id,
    name: body.name,
    currentFileId: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  return sendSingle(c, formatDates(stack), RESOURCE_TYPES.VERSION_STACK);
});

/**
 * PATCH /v4/version-stacks/:id - Update version stack
 *
 * Updates stack metadata (name, current file).
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");
  const body = await c.req.json();

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw new ValidationError("name must be a non-empty string", { pointer: "/data/attributes/name" });
    }
    updates.name = body.name;
  }

  if (body.current_file_id !== undefined) {
    if (body.current_file_id !== null) {
      // Verify the file exists and is in this stack
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, body.current_file_id),
            eq(files.versionStackId, stackId),
            isNull(files.deletedAt)
          )
        )
        .limit(1);

      if (!file) {
        throw new ValidationError("current_file_id must be a file in this version stack", {
          pointer: "/data/attributes/current_file_id",
        });
      }
    }
    updates.currentFileId = body.current_file_id;
  }

  // Update stack
  await db.update(versionStacks).set(updates).where(eq(versionStacks.id, stackId));

  // Fetch and return updated stack
  const [updatedStack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  return sendSingle(c, formatDates(updatedStack), RESOURCE_TYPES.VERSION_STACK);
});

/**
 * DELETE /v4/version-stacks/:id - Delete version stack
 *
 * Deletes the stack but keeps all files (they become unstacked).
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Unstack all files first (set version_stack_id to null)
  await db
    .update(files)
    .set({ versionStackId: null, updatedAt: new Date() })
    .where(eq(files.versionStackId, stackId));

  // Delete the stack
  await db.delete(versionStacks).where(eq(versionStacks.id, stackId));

  return sendNoContent(c);
});

/**
 * GET /v4/version-stacks/:id/files - List all files in a version stack
 */
app.get("/:id/files", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Get files in the stack
  const stackFiles = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.versionStackId, stackId),
        isNull(files.deletedAt)
      )
    )
    .orderBy(desc(files.createdAt))
    .limit(limit + 1);

  const items = stackFiles.slice(0, limit);
  const formattedItems = items.map((f) => formatDates(f));

  return sendCollection(c, formattedItems, RESOURCE_TYPES.FILE, {
    basePath: `/v4/version-stacks/${stackId}/files`,
    limit,
    totalCount: stackFiles.length,
  });
});

/**
 * POST /v4/version-stacks/:id/files - Add a file to the version stack
 *
 * Adds an existing file to this version stack.
 */
app.post("/:id/files", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");
  const body = await c.req.json();

  // Validate input
  if (!body.file_id || typeof body.file_id !== "string") {
    throw new ValidationError("file_id is required", { pointer: "/data/attributes/file_id" });
  }

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Get file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, body.file_id),
        eq(files.projectId, stack.projectId),
        isNull(files.deletedAt)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", body.file_id);
  }

  // Check if file is already in a different stack
  if (file.versionStackId && file.versionStackId !== stackId) {
    throw new ValidationError("File is already in a different version stack. Remove it from that stack first.", {
      pointer: "/data/attributes/file_id",
    });
  }

  // Add file to stack
  await db
    .update(files)
    .set({ versionStackId: stackId, updatedAt: new Date() })
    .where(eq(files.id, body.file_id));

  // If this is the first file in the stack, make it the current file
  if (!stack.currentFileId) {
    await db
      .update(versionStacks)
      .set({ currentFileId: body.file_id, updatedAt: new Date() })
      .where(eq(versionStacks.id, stackId));
  }

  // Fetch and return the updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, body.file_id))
    .limit(1);

  return sendSingle(c, formatDates(updatedFile), RESOURCE_TYPES.FILE);
});

/**
 * DELETE /v4/version-stacks/:id/files/:fileId - Remove a file from the version stack
 *
 * Removes the file from the stack but doesn't delete the file.
 */
app.delete("/:id/files/:fileId", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");
  const fileId = c.req.param("fileId");

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Get file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.versionStackId, stackId)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Remove file from stack
  await db
    .update(files)
    .set({ versionStackId: null, updatedAt: new Date() })
    .where(eq(files.id, fileId));

  // If this was the current file, update the stack to have no current file
  // (or ideally, pick the most recent file in the stack)
  if (stack.currentFileId === fileId) {
    // Find the most recent remaining file in the stack
    const [nextCurrent] = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.versionStackId, stackId),
          isNull(files.deletedAt)
        )
      )
      .orderBy(desc(files.createdAt))
      .limit(1);

    await db
      .update(versionStacks)
      .set({
        currentFileId: nextCurrent?.id || null,
        updatedAt: new Date(),
      })
      .where(eq(versionStacks.id, stackId));
  }

  return sendNoContent(c);
});

/**
 * POST /v4/version-stacks/:id/set-current - Set the current version
 *
 * Sets a specific file as the current/active version of the stack.
 */
app.post("/:id/set-current", async (c) => {
  const session = requireAuth(c);
  const stackId = c.req.param("id");
  const body = await c.req.json();

  // Validate input
  if (!body.file_id || typeof body.file_id !== "string") {
    throw new ValidationError("file_id is required", { pointer: "/data/attributes/file_id" });
  }

  // Get stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify the file is in this stack
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, body.file_id),
        eq(files.versionStackId, stackId),
        isNull(files.deletedAt)
      )
    )
    .limit(1);

  if (!file) {
    throw new ValidationError("file_id must be a file in this version stack", {
      pointer: "/data/attributes/file_id",
    });
  }

  // Update the current file
  await db
    .update(versionStacks)
    .set({ currentFileId: body.file_id, updatedAt: new Date() })
    .where(eq(versionStacks.id, stackId));

  // Fetch and return updated stack
  const [updatedStack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  return sendSingle(c, formatDates(updatedStack), RESOURCE_TYPES.VERSION_STACK);
});

/**
 * POST /v4/files/stack - Create version stack from multiple files
 *
 * Convenience endpoint to create a new stack and add files in one operation.
 */
app.post("/", async (c) => {
  // This is handled by the POST /v4/version-stacks route above
  // But we also support this path for API spec compatibility

  // The body can include file_ids to add to the stack
  const session = requireAuth(c);
  const body = await c.req.json();

  // Validate input
  if (!body.project_id || typeof body.project_id !== "string") {
    throw new ValidationError("project_id is required", { pointer: "/data/attributes/project_id" });
  }

  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("name is required", { pointer: "/data/attributes/name" });
  }

  // Verify project access
  const access = await verifyProjectAccess(body.project_id, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", body.project_id);
  }

  // Validate file_ids if provided
  let fileIds: string[] = [];
  if (body.file_ids && Array.isArray(body.file_ids)) {
    fileIds = body.file_ids;

    if (fileIds.length > 100) {
      throw new ValidationError("Cannot add more than 100 files to a version stack at once", {
        pointer: "/data/attributes/file_ids",
      });
    }

    // Verify all files exist and belong to the project
    for (const fileId of fileIds) {
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            eq(files.projectId, body.project_id),
            isNull(files.deletedAt)
          )
        )
        .limit(1);

      if (!file) {
        throw new ValidationError(`File ${fileId} not found or not accessible`, {
          pointer: "/data/attributes/file_ids",
        });
      }
    }
  }

  // Create version stack
  const stackId = generateId("vstack");
  const now = new Date();

  await db.insert(versionStacks).values({
    id: stackId,
    projectId: body.project_id,
    name: body.name,
    currentFileId: fileIds.length > 0 ? fileIds[0] : null,
    createdAt: now,
    updatedAt: now,
  });

  // Add files to the stack if provided
  if (fileIds.length > 0) {
    for (const fileId of fileIds) {
      await db
        .update(files)
        .set({ versionStackId: stackId, updatedAt: now })
        .where(eq(files.id, fileId));
    }
  }

  // Fetch the created stack with files
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  const stackFiles = fileIds.length > 0
    ? await db
        .select()
        .from(files)
        .where(eq(files.versionStackId, stackId))
    : [];

  return c.json({
    data: {
      id: stack.id,
      type: "version_stack",
      attributes: formatDates(stack),
      relationships: {
        files: {
          data: stackFiles.map((f) => ({ id: f.id, type: "file" })),
        },
      },
    },
    included: stackFiles.map((f) => ({
      id: f.id,
      type: "file",
      attributes: formatDates(f),
    })),
  });
});

/**
 * GET /v4/version-stacks/:id/comments - List comments on a version stack
 */
app.get("/:id/comments", getVersionStackComments);

/**
 * POST /v4/version-stacks/:id/comments - Create comment on a version stack
 */
app.post("/:id/comments", createVersionStackComment);

export default app;
