/**
 * Bush Platform - Bulk Operations Routes
 *
 * API routes for bulk file and folder operations.
 * Reference: specs/04-api-reference.md Section 7
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { files, folders, accounts, customFields } from "../../db/schema.js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { generateId } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyProjectAccess, verifyAccountMembership } from "../access-control.js";
import { storage, storageKeys } from "../../storage/index.js";
import type { CustomFieldValue } from "../../db/schema.js";

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

/**
 * POST /v4/bulk/files/metadata - Update metadata on multiple files
 *
 * Applies the same metadata updates to multiple files at once.
 * Supports both built-in fields (rating, status, keywords, notes, assignee_id)
 * and custom field values.
 */
app.post("/files/metadata", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();

  const fileIds = body.file_ids as string[] | undefined;
  const metadata = body.metadata as Record<string, unknown> | undefined;

  // Validate input
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ValidationError("file_ids must be a non-empty array", { pointer: "/data/file_ids" });
  }

  if (fileIds.length > MAX_BULK_ITEMS) {
    throw new ValidationError(`Maximum ${MAX_BULK_ITEMS} items per bulk request`, { pointer: "/data/file_ids" });
  }

  if (!metadata || typeof metadata !== "object") {
    throw new ValidationError("metadata object is required", { pointer: "/data/metadata" });
  }

  // Pre-validate all metadata fields before making any changes
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // Handle built-in editable fields
  if (metadata.rating !== undefined) {
    if (typeof metadata.rating !== "number" || metadata.rating < 1 || metadata.rating > 5) {
      throw new ValidationError("Rating must be between 1 and 5", { pointer: "/data/metadata/rating" });
    }
    updates.rating = metadata.rating;
  }

  if (metadata.status !== undefined) {
    if (typeof metadata.status !== "string") {
      throw new ValidationError("Status must be a string", { pointer: "/data/metadata/status" });
    }
    updates.assetStatus = metadata.status;
  }

  if (metadata.keywords !== undefined) {
    if (!Array.isArray(metadata.keywords) || !metadata.keywords.every((k: unknown) => typeof k === "string")) {
      throw new ValidationError("Keywords must be an array of strings", { pointer: "/data/metadata/keywords" });
    }
    updates.keywords = metadata.keywords;
  }

  if (metadata.notes !== undefined) {
    if (typeof metadata.notes !== "string") {
      throw new ValidationError("Notes must be a string", { pointer: "/data/metadata/notes" });
    }
    updates.notes = metadata.notes;
  }

  if (metadata.assignee_id !== undefined) {
    if (metadata.assignee_id !== null) {
      // Verify user exists and is a member of the account
      const isMember = await verifyAccountMembership(metadata.assignee_id as string, session.currentAccountId);
      if (!isMember) {
        throw new ValidationError("Assignee must be a member of the account", { pointer: "/data/metadata/assignee_id" });
      }
    }
    updates.assigneeId = metadata.assignee_id;
  }

  // Handle custom field values - pre-validate all custom fields
  let customMetadataUpdates: Record<string, CustomFieldValue> | null = null;
  if (metadata.custom !== undefined && typeof metadata.custom === "object") {
    // Get all custom fields for validation
    const allCustomFields = await db
      .select()
      .from(customFields)
      .where(eq(customFields.accountId, session.currentAccountId));

    const fieldMap = new Map(allCustomFields.map((f) => [f.id, f]));

    // Validate each custom field value
    for (const [fieldId, value] of Object.entries(metadata.custom as Record<string, CustomFieldValue>)) {
      const field = fieldMap.get(fieldId);
      if (!field) {
        throw new ValidationError(`Unknown custom field: ${fieldId}`, { pointer: `/data/metadata/custom/${fieldId}` });
      }

      // Validate value based on field type
      const validationError = validateCustomFieldValue(field, value);
      if (validationError) {
        throw new ValidationError(validationError, { pointer: `/data/metadata/custom/${fieldId}` });
      }
    }

    // Store the custom metadata to merge (we'll merge with existing per-file)
    customMetadataUpdates = metadata.custom as Record<string, CustomFieldValue>;
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

      // Verify project access
      const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
      if (!access) {
        failed.push({ id: fileId, error: "Access denied" });
        continue;
      }

      // Build final updates for this file
      const fileUpdates: Record<string, unknown> = { ...updates };

      // Handle custom metadata merging
      if (customMetadataUpdates) {
        const mergedCustomMetadata: Record<string, CustomFieldValue> = {
          ...(file.customMetadata ?? {}),
        };

        for (const [fieldId, value] of Object.entries(customMetadataUpdates)) {
          if (value === null || value === undefined || value === "") {
            // Remove field if value is null/empty
            delete mergedCustomMetadata[fieldId];
          } else {
            mergedCustomMetadata[fieldId] = value;
          }
        }

        fileUpdates.customMetadata = mergedCustomMetadata;
      }

      // Update file
      await db
        .update(files)
        .set(fileUpdates)
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
 * Validate a custom field value against its type
 */
function validateCustomFieldValue(
  field: typeof customFields.$inferSelect,
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") {
    return null; // Null is always valid (clears the field)
  }

  switch (field.type) {
    case "text":
    case "textarea":
    case "url":
      if (typeof value !== "string") {
        return "Value must be a string";
      }
      if (field.type === "url") {
        try {
          new URL(value);
        } catch {
          return "Value must be a valid URL";
        }
      }
      break;

    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        return "Value must be a number";
      }
      break;

    case "date":
      if (typeof value !== "string" || isNaN(Date.parse(value))) {
        return "Value must be a valid ISO 8601 date string";
      }
      break;

    case "single_select":
      if (typeof value !== "string") {
        return "Value must be a string";
      }
      if (field.options && !field.options.includes(value)) {
        return `Value must be one of: ${field.options.join(", ")}`;
      }
      break;

    case "multi_select":
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        return "Value must be an array of strings";
      }
      if (field.options) {
        for (const v of value) {
          if (!field.options.includes(v)) {
            return `Value "${v}" is not a valid option. Must be one of: ${field.options.join(", ")}`;
          }
        }
      }
      break;

    case "checkbox":
      if (typeof value !== "boolean") {
        return "Value must be a boolean";
      }
      break;

    case "user":
      if (typeof value !== "string") {
        return "Value must be a user ID string";
      }
      break;

    case "rating":
      if (typeof value !== "number" || value < 1 || value > 5 || !Number.isInteger(value)) {
        return "Value must be an integer between 1 and 5";
      }
      break;
  }

  return null;
}

export default app;
