/**
 * Bush Platform - Metadata Routes
 *
 * API routes for file metadata management (built-in and custom fields).
 * Reference: specs/17-api-complete.md Section 6.10
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { files, users, customFields, customFieldVisibility } from "../../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, RESOURCE_TYPES, formatDates } from "../response.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyProjectAccess, verifyAccountMembership } from "../access-control.js";
import type { TechnicalMetadata, CustomFieldValue } from "../../db/schema.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * GET /v4/files/:fileId/metadata - Get all metadata for a file
 *
 * Returns built-in metadata (technical + editable) and custom field values
 */
app.get("/files/:fileId/metadata", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId");

  // Get the file with its project/account info
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Verify project access
  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  // Get assignee info if set
  let assignee = null;
  if (file.assigneeId) {
    const [user] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, file.assigneeId))
      .limit(1);
    if (user) {
      assignee = user;
    }
  }

  // Get all custom fields for the account
  const allCustomFields = await db
    .select()
    .from(customFields)
    .where(eq(customFields.accountId, session.currentAccountId));

  // Get visibility overrides for this project
  const visibilityOverrides = await db
    .select()
    .from(customFieldVisibility)
    .where(eq(customFieldVisibility.projectId, file.projectId));

  // Build visibility map
  const visibilityMap = new Map(
    visibilityOverrides.map((v) => [v.customFieldId, v.isVisible])
  );

  // Filter visible fields
  const visibleFields = allCustomFields.filter((field) => {
    // Use override if exists, otherwise use default
    if (visibilityMap.has(field.id)) {
      return visibilityMap.get(field.id);
    }
    return field.isVisibleByDefault;
  });

  // Build custom field values response
  const customFieldValues: Record<string, { field: typeof customFields.$inferSelect; value: CustomFieldValue }> = {};
  for (const field of visibleFields) {
    const value = file.customMetadata?.[field.id] ?? null;
    customFieldValues[field.id] = { field, value };
  }

  // Build response
  const metadata = {
    // Technical metadata (read-only)
    technical: file.technicalMetadata as TechnicalMetadata | null,

    // Built-in editable metadata
    builtin: {
      rating: file.rating,
      status: file.assetStatus,
      keywords: file.keywords ?? [],
      notes: file.notes,
      assignee: assignee ? {
        id: assignee.id,
        first_name: assignee.firstName,
        last_name: assignee.lastName,
        email: assignee.email,
      } : null,
    },

    // Custom field values
    custom: customFieldValues,

    // File info
    file: {
      id: file.id,
      name: file.name,
      original_name: file.originalName,
      mime_type: file.mimeType,
      file_size_bytes: file.fileSizeBytes,
      created_at: file.createdAt?.toISOString(),
      updated_at: file.updatedAt?.toISOString(),
    },
  };

  return c.json({
    data: {
      id: fileId,
      type: "metadata",
      attributes: metadata,
    },
  });
});

/**
 * PUT /v4/files/:fileId/metadata - Update all metadata for a file
 *
 * Updates built-in metadata and custom field values
 */
app.put("/files/:fileId/metadata", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId");
  const body = await c.req.json();

  // Get the file
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Verify project access with edit permission
  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new AuthorizationError("You don't have permission to edit this file's metadata");
  }

  // Build updates for built-in fields
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  // Handle built-in editable fields
  if (body.rating !== undefined) {
    if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
      throw new ValidationError("Rating must be between 1 and 5", { pointer: "/data/attributes/rating" });
    }
    updates.rating = body.rating;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string") {
      throw new ValidationError("Status must be a string", { pointer: "/data/attributes/status" });
    }
    updates.assetStatus = body.status;
  }

  if (body.keywords !== undefined) {
    if (!Array.isArray(body.keywords) || !body.keywords.every((k: unknown) => typeof k === "string")) {
      throw new ValidationError("Keywords must be an array of strings", { pointer: "/data/attributes/keywords" });
    }
    updates.keywords = body.keywords;
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      throw new ValidationError("Notes must be a string", { pointer: "/data/attributes/notes" });
    }
    updates.notes = body.notes;
  }

  if (body.assignee_id !== undefined) {
    if (body.assignee_id !== null) {
      // Verify user exists and is a member of the account
      const isMember = await verifyAccountMembership(body.assignee_id, session.currentAccountId);
      if (!isMember) {
        throw new ValidationError("Assignee must be a member of the account", { pointer: "/data/attributes/assignee_id" });
      }
    }
    updates.assigneeId = body.assignee_id;
  }

  // Handle custom field values
  if (body.custom !== undefined && typeof body.custom === "object") {
    // Get all custom fields for validation
    const allCustomFields = await db
      .select()
      .from(customFields)
      .where(eq(customFields.accountId, session.currentAccountId));

    const fieldMap = new Map(allCustomFields.map((f) => [f.id, f]));

    // Start with existing custom metadata or empty object
    const customMetadata: Record<string, CustomFieldValue> = {
      ...(file.customMetadata ?? {}),
    };

    // Validate and update each field
    for (const [fieldId, value] of Object.entries(body.custom as Record<string, CustomFieldValue>)) {
      const field = fieldMap.get(fieldId);
      if (!field) {
        throw new ValidationError(`Unknown custom field: ${fieldId}`, { pointer: `/data/attributes/custom/${fieldId}` });
      }

      // Validate value based on field type
      const validationError = validateCustomFieldValue(field, value);
      if (validationError) {
        throw new ValidationError(validationError, { pointer: `/data/attributes/custom/${fieldId}` });
      }

      // Update value
      if (value === null || value === undefined || value === "") {
        // Remove field if value is null/empty
        delete customMetadata[fieldId];
      } else {
        customMetadata[fieldId] = value;
      }
    }

    updates.customMetadata = customMetadata;
  }

  // Update file
  await db.update(files).set(updates).where(eq(files.id, fileId));

  // Fetch updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return sendSingle(c, formatDates(updatedFile!), RESOURCE_TYPES.FILE);
});

/**
 * PUT /v4/files/:fileId/metadata/:fieldId - Update single metadata field
 */
app.put("/files/:fileId/metadata/:fieldId", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId");
  const fieldId = c.req.param("fieldId");
  const body = await c.req.json();

  // Get the file
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Verify project access with edit permission
  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new AuthorizationError("You don't have permission to edit this file's metadata");
  }

  // Check if fieldId is a built-in field
  const builtinFields = ["rating", "status", "keywords", "notes", "assignee_id"];
  if (builtinFields.includes(fieldId)) {
    // Handle built-in field update
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const value = body.value;

    switch (fieldId) {
      case "rating":
        if (typeof value !== "number" || value < 1 || value > 5) {
          throw new ValidationError("Rating must be between 1 and 5", { pointer: "/data/attributes/value" });
        }
        updates.rating = value;
        break;

      case "status":
        if (typeof value !== "string") {
          throw new ValidationError("Status must be a string", { pointer: "/data/attributes/value" });
        }
        updates.assetStatus = value;
        break;

      case "keywords":
        if (!Array.isArray(value) || !value.every((k: unknown) => typeof k === "string")) {
          throw new ValidationError("Keywords must be an array of strings", { pointer: "/data/attributes/value" });
        }
        updates.keywords = value;
        break;

      case "notes":
        if (typeof value !== "string") {
          throw new ValidationError("Notes must be a string", { pointer: "/data/attributes/value" });
        }
        updates.notes = value;
        break;

      case "assignee_id":
        if (value !== null) {
          const isMember = await verifyAccountMembership(value, session.currentAccountId);
          if (!isMember) {
            throw new ValidationError("Assignee must be a member of the account", { pointer: "/data/attributes/value" });
          }
        }
        updates.assigneeId = value;
        break;
    }

    await db.update(files).set(updates).where(eq(files.id, fileId));
  } else {
    // Handle custom field update
    const [field] = await db
      .select()
      .from(customFields)
      .where(eq(customFields.id, fieldId))
      .limit(1);

    if (!field || field.accountId !== session.currentAccountId) {
      throw new NotFoundError("custom_field", fieldId);
    }

    // Validate value
    const validationError = validateCustomFieldValue(field, body.value);
    if (validationError) {
      throw new ValidationError(validationError, { pointer: "/data/attributes/value" });
    }

    // Update custom metadata
    const customMetadata: Record<string, CustomFieldValue> = {
      ...(file.customMetadata ?? {}),
    };

    if (body.value === null || body.value === undefined || body.value === "") {
      delete customMetadata[fieldId];
    } else {
      customMetadata[fieldId] = body.value;
    }

    await db
      .update(files)
      .set({ customMetadata, updatedAt: new Date() })
      .where(eq(files.id, fileId));
  }

  // Fetch updated file
  const [updatedFile] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return sendSingle(c, formatDates(updatedFile!), RESOURCE_TYPES.FILE);
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
      // User validation happens in the route handler
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
