/**
 * Bush Platform - Bulk Operations Routes
 *
 * API routes for bulk file and folder operations.
 * Reference: specs/17-api-complete.md Section 7
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { files, folders, accounts } from "../../db/schema.js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { generateId } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyProjectAccess } from "../access-control.js";
import { storage, storageKeys } from "../../storage/index.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/** Maximum items per bulk request */
const MAX_BULK_ITEMS = 100;

/**
 * POST /v4/bulk/files/move - Move multiple files to a folder
 */
app.post("/files/move", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const fileIds = body.file_ids as string[] | undefined;
  const destination = body.destination as { type: string; id?: string; project_id?: string } | undefined;

  // Validate input
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ValidationError("file_ids must be a non-empty array", { pointer: "/data/file_ids" });
  }

  if (fileIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/file_ids" });
  }

  if (!destination || !destination.type) {
    throw new ValidationError("destination is required", { pointer: "/data/destination" });
  }

  // Determine destination folder and project
  let destFolderId: string | null = null;
  let destProjectId: string | undefined;

  if (destination.type === "folder" && destination.id) {
    const [folder] = await db.select().from(folders).where(eq(folders.id, destination.id)).limit(1);
    if (!folder) {
      throw new NotFoundError("folder", destination.id);
    }
    destFolderId = folder.id;
    destProjectId = folder.projectId;
  } else if (destination.type === "project" && destination.project_id) {
    destProjectId = destination.project_id;
    destFolderId = null;
  } else if (destination.type === "root" && destination.project_id) {
    destProjectId = destination.project_id;
    destFolderId = null;
  } else {
    throw new ValidationError("Invalid destination type. Use 'folder', 'project', or 'root'", {
      pointer: "/data/destination/type",
    });
  }

  // Verify destination project access
  const destAccess = await verifyProjectAccess(destProjectId!, session.currentAccountId);
  if (!destAccess) {
    throw new NotFoundError("project", destProjectId!);
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  // Process each file
  for (const fileId of fileIds) {
    try {
      // Get file
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            isNull(files.deletedAt)
          )
        )
        .limit(1);

      if (!file) {
        failed.push({ id: fileId, error: "File not found" });
        continue;
      }

      // Verify source project access
      const srcAccess = await verifyProjectAccess(file.projectId, session.currentAccountId);
      if (!srcAccess) {
        failed.push({ id: fileId, error: "Access denied to source project" });
        continue;
      }

      // Move file
      await db
        .update(files)
        .set({
          projectId: destProjectId,
          folderId: destFolderId,
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));

      succeeded.push(fileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ id: fileId, error: message });
    }
  }

  return c.json({
    data: {
      succeeded,
      failed,
    },
  });
});

/**
 * POST /v4/bulk/files/copy - Copy multiple files
 */
app.post("/files/copy", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const fileIds = body.file_ids as string[] | undefined;
  const destination = body.destination as { type: string; id?: string; project_id?: string } | undefined;

  // Validate input
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ValidationError("file_ids must be a non-empty array", { pointer: "/data/file_ids" });
  }

  if (fileIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/file_ids" });
  }

  if (!destination || !destination.type) {
    throw new ValidationError("destination is required", { pointer: "/data/destination" });
  }

  // Determine destination folder and project
  let destFolderId: string | null = null;
  let destProjectId: string | undefined;

  if (destination.type === "folder" && destination.id) {
    const [folder] = await db.select().from(folders).where(eq(folders.id, destination.id)).limit(1);
    if (!folder) {
      throw new NotFoundError("folder", destination.id);
    }
    destFolderId = folder.id;
    destProjectId = folder.projectId;
  } else if (destination.type === "project" && destination.project_id) {
    destProjectId = destination.project_id;
    destFolderId = null;
  } else if (destination.type === "root" && destination.project_id) {
    destProjectId = destination.project_id;
    destFolderId = null;
  } else {
    throw new ValidationError("Invalid destination type. Use 'folder', 'project', or 'root'", {
      pointer: "/data/destination/type",
    });
  }

  // Verify destination project access
  const destAccess = await verifyProjectAccess(destProjectId!, session.currentAccountId);
  if (!destAccess) {
    throw new NotFoundError("project", destProjectId!);
  }

  // Check storage quota
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, session.currentAccountId))
    .limit(1);

  if (!account) {
    throw new NotFoundError("account", session.currentAccountId);
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const copiedIds: { original: string; copy: string }[] = [];

  // First pass: validate all files and calculate total size
  const filesToCopy: { id: string; file: typeof files.$inferSelect }[] = [];
  let totalSize = 0;

  for (const fileId of fileIds) {
    const [file] = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, fileId),
          isNull(files.deletedAt)
        )
      )
      .limit(1);

    if (!file) {
      failed.push({ id: fileId, error: "File not found" });
      continue;
    }

    // Verify source project access
    const srcAccess = await verifyProjectAccess(file.projectId, session.currentAccountId);
    if (!srcAccess) {
      failed.push({ id: fileId, error: "Access denied to source project" });
      continue;
    }

    filesToCopy.push({ id: fileId, file });
    totalSize += file.fileSizeBytes;
  }

  // Check if we have enough quota
  if (totalSize > 0 && account.storageUsedBytes + totalSize > account.storageQuotaBytes) {
    // Not enough quota - fail all
    for (const { id } of filesToCopy) {
      failed.push({ id, error: "Insufficient storage quota" });
    }
    return c.json({ data: { succeeded, failed } });
  }

  // Second pass: copy files
  const now = new Date();

  for (const { id: fileId, file } of filesToCopy) {
    try {
      const newFileId = generateId("file");

      await db.insert(files).values({
        id: newFileId,
        projectId: destProjectId!,
        folderId: destFolderId,
        versionStackId: null,
        name: `Copy of ${file.name}`,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        checksum: file.checksum,
        status: file.status,
        deletedAt: null,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Copy in storage if ready
      if (file.status === "ready") {
        const sourceKey = storageKeys.original(
          { accountId: session.currentAccountId, projectId: file.projectId, assetId: fileId },
          file.name
        );
        const destKey = storageKeys.original(
          { accountId: session.currentAccountId, projectId: destProjectId!, assetId: newFileId },
          `Copy of ${file.name}`
        );

        try {
          await storage.copyObject(sourceKey, destKey);
        } catch (error) {
          console.error(`Failed to copy file ${fileId} to ${newFileId}:`, error);
          // Don't fail - the file record exists, storage can be fixed later
        }
      }

      succeeded.push(fileId);
      copiedIds.push({ original: fileId, copy: newFileId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ id: fileId, error: message });
    }
  }

  // Update storage usage if any copies succeeded
  if (copiedIds.length > 0) {
    await db
      .update(accounts)
      .set({
        storageUsedBytes: account.storageUsedBytes + totalSize,
        updatedAt: now,
      })
      .where(eq(accounts.id, session.currentAccountId));
  }

  return c.json({
    data: {
      succeeded,
      failed,
      copies: copiedIds,
    },
  });
});

/**
 * POST /v4/bulk/files/delete - Delete multiple files (soft delete)
 */
app.post("/files/delete", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const fileIds = body.file_ids as string[] | undefined;

  // Validate input
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ValidationError("file_ids must be a non-empty array", { pointer: "/data/file_ids" });
  }

  if (fileIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/file_ids" });
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const now = new Date();

  // Pre-validate all files for access before making any changes
  const filesToDelete: string[] = [];

  for (const fileId of fileIds) {
    try {
      // Get file
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            isNull(files.deletedAt)
          )
        )
        .limit(1);

      if (!file) {
        failed.push({ id: fileId, error: "File not found or already deleted" });
        continue;
      }

      // Verify project access
      const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
      if (!access) {
        failed.push({ id: fileId, error: "Access denied" });
        continue;
      }

      filesToDelete.push(fileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ id: fileId, error: message });
    }
  }

  // If there are files to delete, wrap in transaction for atomicity
  if (filesToDelete.length > 0) {
    try {
      await db.transaction(async (tx) => {
        // Soft delete all validated files atomically
        await tx
          .update(files)
          .set({
            deletedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              sql`${files.id} IN (${sql.raw(filesToDelete.map(() => "?").join(","))})`,
              isNull(files.deletedAt)
            )
          );

        // All succeeded
        succeeded.push(...filesToDelete);
      });
    } catch (error) {
      // If transaction fails, mark all as failed
      const message = error instanceof Error ? error.message : "Transaction failed";
      for (const fileId of filesToDelete) {
        failed.push({ id: fileId, error: message });
      }
    }
  }

  return c.json({
    data: {
      succeeded,
      failed,
    },
  });
});

/**
 * POST /v4/bulk/files/download - Get download URLs for multiple files
 */
app.post("/files/download", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const fileIds = body.file_ids as string[] | undefined;

  // Validate input
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ValidationError("file_ids must be a non-empty array", { pointer: "/data/file_ids" });
  }

  if (fileIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/file_ids" });
  }

  const succeeded: { id: string; download_url: string; expires_at: string }[] = [];
  const failed: { id: string; error: string }[] = [];

  // Process each file
  for (const fileId of fileIds) {
    try {
      // Get file
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            isNull(files.deletedAt)
          )
        )
        .limit(1);

      if (!file) {
        failed.push({ id: fileId, error: "File not found" });
        continue;
      }

      // Verify project access
      const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
      if (!access) {
        failed.push({ id: fileId, error: "Access denied" });
        continue;
      }

      // Only ready files can be downloaded
      if (file.status !== "ready") {
        failed.push({ id: fileId, error: `File not ready (status: ${file.status})` });
        continue;
      }

      // Build storage key for original file
      const storageKey = storageKeys.original(
        { accountId: session.currentAccountId, projectId: file.projectId, assetId: fileId },
        file.name
      );

      // Generate pre-signed download URL
      const downloadResult = await storage.getDownloadUrl(storageKey, 3600);

      succeeded.push({
        id: fileId,
        download_url: downloadResult.url,
        expires_at: downloadResult.expiresAt.toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ id: fileId, error: message });
    }
  }

  return c.json({
    data: {
      succeeded,
      failed,
    },
  });
});

/**
 * POST /v4/bulk/folders/move - Move multiple folders to another parent
 */
app.post("/folders/move", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const folderIds = body.folder_ids as string[] | undefined;
  const destination = body.destination as { type: string; id?: string; project_id?: string } | undefined;

  // Validate input
  if (!Array.isArray(folderIds) || folderIds.length === 0) {
    throw new ValidationError("folder_ids must be a non-empty array", { pointer: "/data/folder_ids" });
  }

  if (folderIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/folder_ids" });
  }

  if (!destination || !destination.type) {
    throw new ValidationError("destination is required", { pointer: "/data/destination" });
  }

  // Determine destination folder and project
  let destParentId: string | null = null;
  let destProjectId: string | undefined;

  if (destination.type === "folder" && destination.id) {
    const [folder] = await db.select().from(folders).where(eq(folders.id, destination.id)).limit(1);
    if (!folder) {
      throw new NotFoundError("folder", destination.id);
    }
    destParentId = folder.id;
    destProjectId = folder.projectId;
  } else if (destination.type === "root" && destination.project_id) {
    destProjectId = destination.project_id;
    destParentId = null;
  } else {
    throw new ValidationError("Invalid destination type. Use 'folder' or 'root'", {
      pointer: "/data/destination/type",
    });
  }

  // Verify destination project access
  const destAccess = await verifyProjectAccess(destProjectId!, session.currentAccountId);
  if (!destAccess) {
    throw new NotFoundError("project", destProjectId!);
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const now = new Date();

  // Process each folder
  for (const folderId of folderIds) {
    try {
      // Get folder
      const [folder] = await db
        .select()
        .from(folders)
        .where(eq(folders.id, folderId))
        .limit(1);

      if (!folder) {
        failed.push({ id: folderId, error: "Folder not found" });
        continue;
      }

      // Verify source project access
      const srcAccess = await verifyProjectAccess(folder.projectId, session.currentAccountId);
      if (!srcAccess) {
        failed.push({ id: folderId, error: "Access denied to source project" });
        continue;
      }

      // Prevent circular moves
      if (destParentId === folderId) {
        failed.push({ id: folderId, error: "Cannot move folder into itself" });
        continue;
      }

      // Update folder
      await db
        .update(folders)
        .set({
          parentId: destParentId,
          updatedAt: now,
        })
        .where(eq(folders.id, folderId));

      succeeded.push(folderId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ id: folderId, error: message });
    }
  }

  return c.json({
    data: {
      succeeded,
      failed,
    },
  });
});

/**
 * POST /v4/bulk/folders/delete - Delete multiple folders (soft delete via file deletion)
 */
app.post("/folders/delete", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const folderIds = body.folder_ids as string[] | undefined;

  // Validate input
  if (!Array.isArray(folderIds) || folderIds.length === 0) {
    throw new ValidationError("folder_ids must be a non-empty array", { pointer: "/data/folder_ids" });
  }

  if (folderIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/folder_ids" });
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const now = new Date();

  // Process each folder
  for (const folderId of folderIds) {
    try {
      // Get folder
      const [folder] = await db
        .select()
        .from(folders)
        .where(eq(folders.id, folderId))
        .limit(1);

      if (!folder) {
        failed.push({ id: folderId, error: "Folder not found" });
        continue;
      }

      // Verify project access
      const access = await verifyProjectAccess(folder.projectId, session.currentAccountId);
      if (!access) {
        failed.push({ id: folderId, error: "Access denied" });
        continue;
      }

      // Soft delete all files in this folder
      await db
        .update(files)
        .set({
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(files.folderId, folderId));

      // Delete the folder
      await db.delete(folders).where(eq(folders.id, folderId));

      succeeded.push(folderId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed.push({ id: folderId, error: message });
    }
  }

  return c.json({
    data: {
      succeeded,
      failed,
    },
  });
});

export default app;
