/**
 * Bush Platform - File Routes
 *
 * API routes for file management.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { files, folders, accounts } from "../../db/schema.js";
import { eq, and, desc, isNull, lt } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates, decodeCursor } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { config } from "../../config/index.js";
import { verifyProjectAccess } from "../access-control.js";
import { storage, storageKeys } from "../../storage/index.js";
import { enqueueProcessingJobs } from "../../media/index.js";

/** Valid file statuses */
const VALID_FILE_STATUSES = ["uploading", "processing", "ready", "processing_failed", "deleted"] as const;
type FileStatus = typeof VALID_FILE_STATUSES[number];

/** Allowed status transitions (from → to[]) */
const ALLOWED_STATUS_TRANSITIONS: Record<FileStatus, FileStatus[]> = {
  uploading: ["processing", "ready", "deleted"],
  processing: ["ready", "processing_failed", "deleted"],
  ready: ["processing", "deleted"],
  processing_failed: ["processing", "deleted"],
  deleted: [],
};

/**
 * Get thumbnail URL for a file
 * Returns null if file doesn't have thumbnails (not ready, non-media type)
 */
async function getThumbnailUrl(
  file: { id: string; projectId: string; status: string; mimeType: string; customThumbnailKey?: string | null },
  accountId: string
): Promise<string | null> {
  // Only ready files with image/video MIME types have thumbnails
  if (file.status !== "ready") {
    return null;
  }

  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");

  if (!isImage && !isVideo) {
    return null;
  }

  try {
    // If custom thumbnail exists, use it
    if (file.customThumbnailKey) {
      const result = await storage.getDownloadUrl(file.customThumbnailKey, 3600);
      return result.url;
    }

    // Generate pre-signed URL for medium thumbnail (640px)
    const key = storageKeys.thumbnail(
      { accountId, projectId: file.projectId, assetId: file.id },
      "640"
    );

    const result = await storage.getDownloadUrl(key, 3600); // 1 hour expiry
    return result.url;
  } catch {
    // Thumbnail doesn't exist yet - return null
    return null;
  }
}

/**
 * Format file with additional computed fields like thumbnailUrl
 */
async function formatFileWithExtras(
  file: typeof files.$inferSelect,
  accountId: string
): Promise<typeof files.$inferSelect & { thumbnailUrl: string | null }> {
  const thumbnailUrl = await getThumbnailUrl(file, accountId);
  return {
    ...formatDates(file),
    thumbnailUrl,
  };
}

const app = new Hono();

// Apply authentication to all routes (rate limiting applied at v4 router level)
app.use("*", authMiddleware());

/**
 * GET /v4/projects/:projectId/files - List files in a project
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // Apply cursor pagination via SQL WHERE
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(files.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  // Get files
  const results = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit);
  // Add thumbnail URLs to each file
  const formattedItems = await Promise.all(
    items.map((f) => formatFileWithExtras(f, session.currentAccountId))
  );

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
  const projectId = c.req.param("projectId")!;
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

  return sendSingle(c, await formatFileWithExtras(file, session.currentAccountId), RESOURCE_TYPES.FILE);
});

/**
 * POST /v4/projects/:projectId/files - Create file record (for upload)
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

  // Create file record with atomic quota check using transaction
  // This prevents race conditions where multiple uploads could exceed quota
  const fileId = generateId("file");
  const now = new Date();

  await db.transaction(async (tx) => {
    // Get account with lock using FOR UPDATE equivalent (SQLite uses BEGIN IMMEDIATE)
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, session.currentAccountId))
      .limit(1);

    if (!account) {
      throw new NotFoundError("account", session.currentAccountId);
    }

    // Check storage quota atomically
    if (account.storageUsedBytes + body.file_size_bytes > account.storageQuotaBytes) {
      throw new ValidationError(
        `Insufficient storage quota. Available: ${account.storageQuotaBytes - account.storageUsedBytes} bytes, Requested: ${body.file_size_bytes} bytes`,
        { pointer: "/data/attributes/file_size_bytes" }
      );
    }

    // Reserve quota by updating storage used immediately
    // This will be adjusted later when upload completes (confirm endpoint)
    await tx
      .update(accounts)
      .set({
        storageUsedBytes: account.storageUsedBytes + body.file_size_bytes,
        updatedAt: now,
      })
      .where(eq(accounts.id, session.currentAccountId));

    // Create file record
    await tx.insert(files).values({
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
  });

  // Fetch the created file
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  // Generate actual pre-signed upload URL from storage module
  const storageKey = {
    accountId: session.currentAccountId,
    projectId,
    assetId: fileId,
    type: "original" as const,
    filename: body.name,
  };

  const uploadResult = await storage.getUploadUrl(storageKey);

  return c.json({
    data: {
      id: file.id,
      type: "file",
      attributes: formatDates(file),
    },
    meta: {
      upload_url: uploadResult.url,
      upload_method: "presigned_url",
      upload_expires_at: uploadResult.expiresAt.toISOString(),
      storage_key: uploadResult.key,
      chunk_size: config.UPLOAD_MULTIPART_CHUNK_SIZE,
    },
  });
});

/**
 * PATCH /v4/projects/:projectId/files/:id - Update file metadata
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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
    if (!VALID_FILE_STATUSES.includes(body.status)) {
      throw new ValidationError(`Invalid status '${body.status}'. Must be one of: ${VALID_FILE_STATUSES.join(", ")}`, { pointer: "/data/attributes/status" });
    }
    const currentStatus = file.status as FileStatus;
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
    if (!allowed?.includes(body.status as FileStatus)) {
      throw new ValidationError(`Cannot transition from '${currentStatus}' to '${body.status}'`, { pointer: "/data/attributes/status" });
    }
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
  const projectId = c.req.param("projectId")!;
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
 * POST /v4/projects/:projectId/files/:id/copy - Copy file to folder
 */
app.post("/:id/copy", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
  const fileId = c.req.param("id");
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get source file
  const [sourceFile] = await db
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

  if (!sourceFile) {
    throw new NotFoundError("file", fileId);
  }

  // Determine destination project/folder
  const destProjectId = body.project_id || projectId;
  const destFolderId = body.folder_id !== undefined ? body.folder_id : sourceFile.folderId;

  // Verify destination project access if different
  if (destProjectId !== projectId) {
    const destAccess = await verifyProjectAccess(destProjectId, session.currentAccountId);
    if (!destAccess) {
      throw new NotFoundError("project", destProjectId);
    }
  }

  // Verify destination folder if specified
  if (destFolderId) {
    const [destFolder] = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.id, destFolderId),
          eq(folders.projectId, destProjectId)
        )
      )
      .limit(1);

    if (!destFolder) {
      throw new NotFoundError("folder", destFolderId);
    }
  }

  // Create file copy with atomic quota check
  const newFileId = generateId("file");
  const now = new Date();
  const copyName = body.name || `Copy of ${sourceFile.name}`;

  await db.transaction(async (tx) => {
    // Get account with lock
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, session.currentAccountId))
      .limit(1);

    if (!account) {
      throw new NotFoundError("account", session.currentAccountId);
    }

    // Check storage quota atomically
    if (account.storageUsedBytes + sourceFile.fileSizeBytes > account.storageQuotaBytes) {
      throw new ValidationError(
        `Insufficient storage quota to copy file. Available: ${account.storageQuotaBytes - account.storageUsedBytes} bytes, Required: ${sourceFile.fileSizeBytes} bytes`,
        { pointer: "/data/attributes/file_size_bytes" }
      );
    }

    // Create new file record
    await tx.insert(files).values({
      id: newFileId,
      projectId: destProjectId,
      folderId: destFolderId,
      versionStackId: null, // Don't copy version stack membership
      name: copyName,
      originalName: sourceFile.originalName,
      mimeType: sourceFile.mimeType,
      fileSizeBytes: sourceFile.fileSizeBytes,
      checksum: sourceFile.checksum,
      status: sourceFile.status,
      deletedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Update storage usage atomically
    await tx
      .update(accounts)
      .set({
        storageUsedBytes: account.storageUsedBytes + sourceFile.fileSizeBytes,
        updatedAt: now,
      })
      .where(eq(accounts.id, session.currentAccountId));
  });

  // Copy file in storage (outside transaction - best effort)
  if (sourceFile.status === "ready") {
    const sourceKey = storageKeys.original(
      { accountId: session.currentAccountId, projectId, assetId: fileId },
      sourceFile.name
    );
    const destKey = storageKeys.original(
      { accountId: session.currentAccountId, projectId: destProjectId, assetId: newFileId },
      copyName
    );

    try {
      await storage.copyObject(sourceKey, destKey);
    } catch (error) {
      console.error(`Failed to copy file ${fileId} to ${newFileId}:`, error);
      // Don't fail - the file record exists, storage can be fixed later
    }
  }

  // Fetch and return the new file
  const [newFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, newFileId))
    .limit(1);

  return sendSingle(c, formatDates(newFile), RESOURCE_TYPES.FILE);
});

/**
 * POST /v4/projects/:projectId/files/:id/restore - Restore soft-deleted file
 */
app.post("/:id/restore", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
  const fileId = c.req.param("id");

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get soft-deleted file
  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.projectId, projectId)
      )
    )
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  if (!file.deletedAt) {
    throw new ValidationError("File is not deleted and cannot be restored", {
      pointer: "/data/attributes/deleted_at",
    });
  }

  // Check 30-day recovery period
  const deletedAt = new Date(file.deletedAt);
  const recoveryDeadline = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (new Date() > recoveryDeadline) {
    throw new ValidationError("File recovery period (30 days) has expired", {
      pointer: "/data/attributes/deleted_at",
    });
  }

  // Restore file
  await db
    .update(files)
    .set({
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  // Fetch and return restored file
  const [restoredFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return sendSingle(c, formatDates(restoredFile), RESOURCE_TYPES.FILE);
});

/**
 * POST /v4/projects/:projectId/files/:id/move - Move file to folder
 */
app.post("/:id/move", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

/**
 * GET /v4/projects/:projectId/files/:id/download - Get download URL for file
 */
app.get("/:id/download", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // Only ready files can be downloaded
  if (file.status !== "ready") {
    throw new ValidationError(
      `File is not ready for download. Current status: ${file.status}`,
      { pointer: "/data/attributes/status" }
    );
  }

  // Build storage key for original file
  const storageKey = storageKeys.original(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    file.name
  );

  // Generate pre-signed download URL
  const downloadResult = await storage.getDownloadUrl(storageKey, 3600);

  return c.json({
    data: {
      id: file.id,
      type: "file",
      attributes: formatDates(file),
    },
    meta: {
      download_url: downloadResult.url,
      download_expires_at: downloadResult.expiresAt.toISOString(),
    },
  });
});

/**
 * POST /v4/projects/:projectId/files/:id/multipart - Initialize multipart upload
 */
app.post("/:id/multipart", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // Validate chunk count
  const chunkCount = body.chunk_count;
  if (!chunkCount || typeof chunkCount !== "number" || chunkCount < 1 || chunkCount > 10000) {
    throw new ValidationError("chunk_count must be a number between 1 and 10000", {
      pointer: "/data/attributes/chunk_count",
    });
  }

  // Validate chunk size is reasonable (at least 5MB per chunk for files > 5MB)
  // This prevents abuse with thousands of tiny chunks
  const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.fileSizeBytes > MIN_CHUNK_SIZE) {
    const expectedMaxChunks = Math.ceil(file.fileSizeBytes / MIN_CHUNK_SIZE);
    if (chunkCount > expectedMaxChunks * 2) {
      throw new ValidationError(
        `chunk_count (${chunkCount}) is excessive for file size (${file.fileSizeBytes} bytes). Maximum recommended: ${expectedMaxChunks * 2}`,
        { pointer: "/data/attributes/chunk_count" }
      );
    }
  }

  // Build storage key
  const storageKey = {
    accountId: session.currentAccountId,
    projectId,
    assetId: fileId,
    type: "original" as const,
    filename: file.name,
  };

  // Initialize multipart upload
  const multipartInit = await storage.initChunkedUpload(storageKey);

  return c.json({
    data: {
      id: file.id,
      type: "file",
      attributes: formatDates(file),
    },
    meta: {
      upload_id: multipartInit.uploadId,
      storage_key: multipartInit.key,
    },
  });
});

/**
 * GET /v4/projects/:projectId/files/:id/multipart/parts - Get URLs for upload parts
 */
app.get("/:id/multipart/parts", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
  const fileId = c.req.param("id");
  const uploadId = c.req.query("upload_id");
  const chunkCount = parseInt(c.req.query("chunk_count") || "0", 10);

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

  if (!uploadId) {
    throw new ValidationError("upload_id is required", { pointer: "/query/upload_id" });
  }

  if (!chunkCount || chunkCount < 1 || chunkCount > 10000) {
    throw new ValidationError("chunk_count must be between 1 and 10000", {
      pointer: "/query/chunk_count",
    });
  }

  // Validate chunk size is reasonable (at least 5MB per chunk for files > 5MB)
  const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.fileSizeBytes > MIN_CHUNK_SIZE) {
    const expectedMaxChunks = Math.ceil(file.fileSizeBytes / MIN_CHUNK_SIZE);
    if (chunkCount > expectedMaxChunks * 2) {
      throw new ValidationError(
        `chunk_count (${chunkCount}) is excessive for file size (${file.fileSizeBytes} bytes). Maximum recommended: ${expectedMaxChunks * 2}`,
        { pointer: "/query/chunk_count" }
      );
    }
  }

  // Build storage key
  const storageKey = storageKeys.original(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    file.name
  );

  // Get part upload URLs
  const partUrls = await storage.getChunkUrls(storageKey, uploadId, chunkCount);

  return c.json({
    data: {
      id: file.id,
      type: "file",
      attributes: formatDates(file),
    },
    meta: {
      parts: partUrls.map((p) => ({
        part_number: p.partNumber,
        upload_url: p.url,
      })),
    },
  });
});

/**
 * POST /v4/projects/:projectId/files/:id/multipart/complete - Complete multipart upload
 */
app.post("/:id/multipart/complete", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  const uploadId = body.upload_id;
  const parts = body.parts;

  if (!uploadId || typeof uploadId !== "string") {
    throw new ValidationError("upload_id is required", { pointer: "/data/attributes/upload_id" });
  }

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new ValidationError("parts array is required", { pointer: "/data/attributes/parts" });
  }

  // Validate parts format
  for (const part of parts) {
    if (typeof part.part_number !== "number" || typeof part.etag !== "string") {
      throw new ValidationError("Each part must have part_number and etag", {
        pointer: "/data/attributes/parts",
      });
    }
  }

  // Build storage key
  const storageKey = storageKeys.original(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    file.name
  );

  // Complete multipart upload
  await storage.completeChunkedUpload(storageKey, uploadId, parts);

  // Update file status to processing (media pipeline will set to ready)
  // Note: Storage quota was already reserved when file was created, so no need to update here
  await db
    .update(files)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  // Enqueue media processing jobs
  try {
    await enqueueProcessingJobs(
      fileId,
      session.currentAccountId,
      projectId,
      storageKey,
      file.mimeType,
      file.originalName
    );
  } catch (error) {
    // Log error but don't fail the request - processing can be retried
    console.error(`Failed to enqueue processing jobs for file ${fileId}:`, error);
  }

  // Fetch updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return c.json({
    data: {
      id: updatedFile.id,
      type: "file",
      attributes: formatDates(updatedFile),
    },
    meta: {
      message: "Upload completed successfully",
    },
  });
});

/**
 * DELETE /v4/projects/:projectId/files/:id/multipart - Abort multipart upload
 */
app.delete("/:id/multipart", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
  const fileId = c.req.param("id");
  const uploadId = c.req.query("upload_id");

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

  if (!uploadId) {
    throw new ValidationError("upload_id is required", { pointer: "/query/upload_id" });
  }

  // Build storage key
  const storageKey = storageKeys.original(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    file.name
  );

  // Abort multipart upload
  await storage.abortChunkedUpload(storageKey, uploadId);

  return sendNoContent(c);
});

/**
 * POST /v4/projects/:projectId/files/:id/confirm - Confirm simple upload completion
 */
app.post("/:id/confirm", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // Verify file is in uploading status
  if (file.status !== "uploading") {
    throw new ValidationError(
      `File is not in uploading status. Current status: ${file.status}`,
      { pointer: "/data/attributes/status" }
    );
  }

  // Build storage key
  const storageKey = storageKeys.original(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    file.name
  );

  // Verify file exists in storage
  const storageObject = await storage.headObject(storageKey);
  if (!storageObject) {
    throw new ValidationError("File has not been uploaded to storage yet", {
      pointer: "/data/attributes/status",
    });
  }

  // Update file status to processing
  // Note: Storage quota was already reserved when file was created, so no need to update here
  await db
    .update(files)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  // Enqueue media processing jobs
  try {
    await enqueueProcessingJobs(
      fileId,
      session.currentAccountId,
      projectId,
      storageKey,
      file.mimeType,
      file.originalName
    );
  } catch (error) {
    console.error(`Failed to enqueue processing jobs for file ${fileId}:`, error);
  }

  // Fetch updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return c.json({
    data: {
      id: updatedFile.id,
      type: "file",
      attributes: formatDates(updatedFile),
    },
    meta: {
      message: "Upload confirmed, processing started",
    },
  });
});

/**
 * POST /v4/projects/:projectId/files/:id/thumbnail - Upload custom thumbnail
 *
 * Sets a custom thumbnail for a file. The thumbnail image should be uploaded
 * as a base64-encoded data URL or via a pre-signed URL flow.
 */
app.post("/:id/thumbnail", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // Validate input - either base64 image or request for upload URL
  const mode = body.mode || "upload"; // "upload" or "url"

  if (mode === "url") {
    // Return pre-signed URL for direct upload
    const thumbnailKey = storageKeys.customThumbnail(
      { accountId: session.currentAccountId, projectId, assetId: fileId },
      "640"
    );

    const uploadResult = await storage.getUploadUrl({
      accountId: session.currentAccountId,
      projectId,
      assetId: fileId,
      type: "thumbnail",
      filename: "custom_640.jpg",
    });

    return c.json({
      data: {
        id: file.id,
        type: "file",
        attributes: formatDates(file),
      },
      meta: {
        upload_url: uploadResult.url,
        upload_expires_at: uploadResult.expiresAt.toISOString(),
        storage_key: thumbnailKey,
      },
    });
  }

  // Handle base64 image upload
  if (!body.image_data || typeof body.image_data !== "string") {
    throw new ValidationError("image_data (base64 data URL) is required for upload mode", {
      pointer: "/data/attributes/image_data",
    });
  }

  // Parse base64 data URL
  const dataUrlMatch = body.image_data.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!dataUrlMatch) {
    throw new ValidationError("Invalid image data URL. Expected format: data:image/(jpeg|png|webp);base64,<data>", {
      pointer: "/data/attributes/image_data",
    });
  }

  const imageFormat = dataUrlMatch[1];
  const base64Data = dataUrlMatch[2];

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Validate image size (max 10MB)
  if (imageBuffer.length > 10 * 1024 * 1024) {
    throw new ValidationError("Image size exceeds maximum allowed (10MB)", {
      pointer: "/data/attributes/image_data",
    });
  }

  // Store custom thumbnail (we use the 640 size for display)
  const thumbnailKey = storageKeys.customThumbnail(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    "640"
  );

  const contentType = imageFormat === "png" ? "image/png" :
                      imageFormat === "webp" ? "image/webp" : "image/jpeg";

  await storage.putObject(thumbnailKey, imageBuffer, contentType);

  // Update file with custom thumbnail key
  await db
    .update(files)
    .set({
      customThumbnailKey: thumbnailKey,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  // Fetch and return updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return sendSingle(c, await formatFileWithExtras(updatedFile, session.currentAccountId), RESOURCE_TYPES.FILE);
});

/**
 * POST /v4/projects/:projectId/files/:id/thumbnail/frame - Capture video frame as thumbnail
 *
 * Captures a frame from a video file at the specified timestamp and sets it as the custom thumbnail.
 */
app.post("/:id/thumbnail/frame", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // Only video files support frame capture
  if (!file.mimeType.startsWith("video/")) {
    throw new ValidationError("Frame capture is only supported for video files", {
      pointer: "/data/attributes/mime_type",
    });
  }

  // File must be ready
  if (file.status !== "ready") {
    throw new ValidationError(`File is not ready. Current status: ${file.status}`, {
      pointer: "/data/attributes/status",
    });
  }

  // Validate timestamp
  const timestamp = body.timestamp; // in seconds
  if (typeof timestamp !== "number" || timestamp < 0) {
    throw new ValidationError("timestamp (in seconds) is required and must be a non-negative number", {
      pointer: "/data/attributes/timestamp",
    });
  }

  // Get video duration from technical metadata
  const metadata = file.technicalMetadata as { duration?: number } | null;
  const duration = metadata?.duration;

  if (duration && timestamp > duration) {
    throw new ValidationError(`timestamp (${timestamp}s) exceeds video duration (${duration}s)`, {
      pointer: "/data/attributes/timestamp",
    });
  }

  // We need to enqueue a job to capture the frame
  // For now, we'll do a simple implementation that returns a job ID
  // The actual frame capture will be done by the media worker

  // Import the frame capture job queue
  const { enqueueFrameCapture } = await import("../../media/index.js");
  const storageKey = storageKeys.original(
    { accountId: session.currentAccountId, projectId, assetId: fileId },
    file.name
  );
  const jobId = await enqueueFrameCapture({
    assetId: fileId,
    accountId: session.currentAccountId,
    projectId,
    timestamp,
    storageKey,
    mimeType: file.mimeType,
    sourceFilename: file.originalName,
  });

  return c.json({
    data: {
      id: file.id,
      type: "file",
      attributes: formatDates(file),
    },
    meta: {
      job_id: jobId,
      message: "Frame capture job enqueued",
      timestamp,
    },
  });
});

/**
 * DELETE /v4/projects/:projectId/files/:id/thumbnail - Remove custom thumbnail
 *
 * Removes the custom thumbnail and reverts to auto-generated thumbnail.
 */
app.delete("/:id/thumbnail", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId")!;
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

  // If no custom thumbnail, nothing to do
  if (!file.customThumbnailKey) {
    return sendNoContent(c);
  }

  // Delete custom thumbnail from storage
  try {
    await storage.deleteObject(file.customThumbnailKey);
  } catch (error) {
    console.error(`Failed to delete custom thumbnail for file ${fileId}:`, error);
    // Continue - we still want to clear the DB reference
  }

  // Clear custom thumbnail key
  await db
    .update(files)
    .set({
      customThumbnailKey: null,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  return sendNoContent(c);
});

export default app;
