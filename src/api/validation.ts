/**
 * Bush Platform - Zod Validation Utilities
 *
 * Provides Zod-based request validation for API routes.
 * Converts Zod validation errors to JSON:API-compliant error format.
 * Reference: specs/04-api-reference.md Section 3.4 (Error Response)
 */
import { z } from "zod";
import type { Context } from "hono";
import { ValidationError, BadRequestError } from "../errors/index.js";

/**
 * Convert a Zod error path to a JSON:API source pointer
 *
 * @param path - Array of path segments from Zod error
 * @returns JSON:API source pointer (e.g., "/data/attributes/name")
 */
function pathToPointer(path: (string | number)[]): string {
  if (path.length === 0) {
    return "/data";
  }

  // Map common field names to JSON:API structure
  const pathStr = path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .join("/");

  // Determine if this is a relationship or attribute
  const firstSegment = path[0];
  if (typeof firstSegment === "string") {
    // Common relationship fields
    const relationshipFields = [
      "parent_id",
      "file_id",
      "project_id",
      "workspace_id",
      "account_id",
      "user_id",
      "folder_id",
      "share_id",
      "collection_id",
      "webhook_id",
      "version_id",
      "stack_id",
      "parent",
    ];

    if (relationshipFields.includes(firstSegment)) {
      return `/data/relationships/${firstSegment.replace(/_id$/, "")}`;
    }
  }

  return `/data/attributes/${pathStr}`;
}

/**
 * Validate request body against a Zod schema
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated and typed data
 * @throws ValidationError if validation fails
 * @throws BadRequestError if JSON parsing fails
 */
export async function validateBody<T>(
  c: Context,
  schema: z.ZodSchema<T>
): Promise<T> {
  let body: unknown;

  try {
    const text = await c.req.text();

    if (!text || text.trim() === "") {
      throw new BadRequestError("Request body is required");
    }

    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new BadRequestError(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    // Get the first error for single-error response (current pattern)
    const firstIssue = result.error.issues[0];
    const pointer = pathToPointer(firstIssue.path);

    throw new ValidationError(firstIssue.message, { pointer });
  }

  return result.data;
}

/**
 * Parse and validate JSON body, returning undefined for empty bodies
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated data or undefined if body is empty
 * @throws ValidationError if validation fails
 */
export async function parseBody<T>(
  c: Context,
  schema: z.ZodSchema<T>
): Promise<T | undefined> {
  const text = await c.req.text();

  if (!text || text.trim() === "") {
    return undefined;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new BadRequestError(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const pointer = pathToPointer(firstIssue.path);

    throw new ValidationError(firstIssue.message, { pointer });
  }

  return result.data;
}

/**
 * Validate query parameters against a Zod schema
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated query parameters
 * @throws ValidationError if validation fails
 */
export function validateQuery<T>(
  c: Context,
  schema: z.ZodSchema<T>
): T {
  const query = c.req.query();
  const result = schema.safeParse(query);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ValidationError(firstIssue.message, {
      parameter: firstIssue.path.join("."),
    });
  }

  return result.data;
}

/**
 * Validate path parameters against a Zod schema
 *
 * @param c - Hono context
 * @param schema - Zod schema to validate against
 * @returns Validated path parameters
 * @throws ValidationError if validation fails
 */
export function validateParams<T>(
  c: Context,
  schema: z.ZodSchema<T>
): T {
  const params = c.req.param();
  const result = schema.safeParse(params);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ValidationError(firstIssue.message, {
      parameter: firstIssue.path.join("."),
    });
  }

  return result.data;
}

// Re-export AppError for the local import above
import { AppError } from "../errors/index.js";

// ============================================================================
// COMMON SCHEMAS - Reusable Zod schemas for API validation
// ============================================================================

/**
 * Pagination parameters schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50).optional(),
  cursor: z.string().optional(),
});

/**
 * ID parameter schema (validates non-empty string)
 */
export const idSchema = z.string().min(1, "ID is required");

/**
 * Email schema with basic validation
 */
export const emailSchema = z.string().email("Invalid email address");

/**
 * URL schema with optional protocol requirements
 */
export const urlSchema = z.string().url("Invalid URL");

/**
 * Webhook URL schema - validates HTTPS in production
 */
export const webhookUrlSchema = z.string().url("Invalid webhook URL").refine((url) => {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS in production, allow HTTP for localhost testing
    if (process.env.NODE_ENV === "production") {
      return parsed.protocol === "https:";
    }
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}, "Webhook URL must use HTTPS in production");

/**
 * Non-empty string schema
 */
export const nonEmptyStringSchema = z.string().min(1, "This field is required");

/**
 * Positive integer schema
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Non-negative number schema
 */
export const nonNegativeNumberSchema = z.number().nonnegative();

/**
 * Annotation schema for comments
 */
export const annotationSchema = z.object({
  type: z.enum(["rectangle", "ellipse", "polygon", "line", "arrow", "text"]),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1).optional(),
  height: z.number().min(0).max(1).optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
  text: z.string().optional(),
  color: z.string().optional(),
});

/**
 * Branding configuration schema for shares
 */
export const brandingSchema = z
  .object({
    icon: z.string().url().optional(),
    header: z.string().optional(),
    background: z.string().optional(),
    description: z.string().max(500).optional(),
    theme: z.enum(["light", "dark", "auto"]).optional(),
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
  .optional();

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

/**
 * Create comment request body schema
 */
export const createCommentSchema = z.object({
  text: z.string().min(1, "Comment text is required").max(10000, "Comment text must be 10000 characters or less"),
  timestamp: nonNegativeNumberSchema.optional(),
  duration: nonNegativeNumberSchema.optional(),
  page: positiveIntSchema.optional(),
  annotation: annotationSchema.optional(),
  parent_id: z.string().optional(),
  is_internal: z.boolean().optional(),
  client_id: z.string().optional(),
});

/**
 * Update comment request body schema
 */
export const updateCommentSchema = z.object({
  text: z.string().min(1, "Comment text is required").max(10000, "Comment text must be 10000 characters or less").optional(),
  timestamp: nonNegativeNumberSchema.optional(),
  duration: nonNegativeNumberSchema.optional(),
  page: positiveIntSchema.optional(),
  annotation: annotationSchema.nullable().optional(),
  is_internal: z.boolean().optional(),
});

/**
 * Mark comment complete request body schema
 */
export const markCommentCompleteSchema = z.object({
  complete: z.boolean().optional(),
});

// ============================================================================
// SHARE SCHEMAS
// ============================================================================

/**
 * Layout type for shares
 */
export const layoutSchema = z.enum(["grid", "reel", "viewer"]);

/**
 * Create share request body schema
 */
export const createShareSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  project_id: z.string().min(1).optional(),
  layout: layoutSchema.optional(),
  allow_comments: z.boolean().optional(),
  allow_downloads: z.boolean().optional(),
  show_all_versions: z.boolean().optional(),
  show_transcriptions: z.boolean().optional(),
  passphrase: z.string().min(4).max(100).optional(),
  expires_at: z.string().datetime().optional(),
  branding: brandingSchema,
  file_ids: z.array(z.string().min(1)).max(100).optional(),
  featured_field: z.string().optional(),
});

/**
 * Update share request body schema
 */
export const updateShareSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  layout: layoutSchema.optional(),
  allow_comments: z.boolean().optional(),
  allow_downloads: z.boolean().optional(),
  show_all_versions: z.boolean().optional(),
  show_transcriptions: z.boolean().optional(),
  passphrase: z.string().min(4).max(100).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  branding: brandingSchema,
  featured_field: z.string().nullable().optional(),
});

/**
 * Add items to share request body schema
 */
export const addShareItemsSchema = z.object({
  file_ids: z.array(z.string().min(1)).min(1, "At least one file ID is required").max(100, "Cannot add more than 100 files at once"),
});

/**
 * Share invite request body schema
 */
export const shareInviteSchema = z.object({
  recipients: z.array(emailSchema).min(1, "At least one recipient is required").max(50, "Maximum 50 recipients per invite request"),
  message: z.string().max(1000).optional(),
});

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

/**
 * Valid webhook event types
 */
export const webhookEventTypes = [
  "file.created",
  "file.updated",
  "file.deleted",
  "file.status_changed",
  "file.downloaded",
  "version.created",
  "comment.created",
  "comment.updated",
  "comment.deleted",
  "comment.completed",
  "share.created",
  "share.viewed",
  "project.created",
  "project.updated",
  "project.deleted",
  "member.added",
  "member.removed",
  "transcription.completed",
] as const;

/**
 * Webhook event type schema
 */
export const webhookEventTypeSchema = z.enum(webhookEventTypes);

/**
 * Webhook event object schema (with optional filters)
 */
export const webhookEventObjectSchema = z.object({
  type: webhookEventTypeSchema,
  filters: z.object({
    projectId: z.string().optional(),
    workspaceId: z.string().optional(),
  }).optional(),
});

/**
 * Webhook event input schema - accepts string or object, will be normalized to object
 */
export const webhookEventInputSchema = z.union([
  webhookEventTypeSchema,
  webhookEventObjectSchema,
]);

/**
 * Normalized webhook events array
 */
export const normalizedWebhookEventsSchema = z.array(webhookEventObjectSchema);

/**
 * Create webhook request body schema
 */
export const createWebhookSchema = z.object({
  name: z.string().trim().min(1, "Webhook name is required").max(255),
  url: webhookUrlSchema,
  events: z.array(webhookEventInputSchema).min(1, "At least one event type is required"),
  secret: z.string().min(16, "Secret must be at least 16 characters").optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Update webhook request body schema
 */
export const updateWebhookSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  url: webhookUrlSchema.optional(),
  events: z.array(webhookEventInputSchema).min(1, "At least one event type is required").optional(),
  secret: z.string().min(16, "Secret must be at least 16 characters").optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Normalize webhook events input to WebhookEvent[] format
 */
export function normalizeWebhookEvents(
  events: z.infer<typeof webhookEventInputSchema>[]
): Array<{ type: typeof webhookEventTypes[number]; filters?: { projectId?: string; workspaceId?: string } }> {
  return events.map((event) => {
    if (typeof event === "string") {
      return { type: event as typeof webhookEventTypes[number] };
    }
    return { type: event.type, filters: event.filters };
  });
}

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

/**
 * Create project request body schema
 */
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255, "Project name must be 255 characters or less"),
  workspace_id: z.string().min(1, "Workspace ID is required"),
  description: z.string().max(2000).optional(),
});

/**
 * Update project request body schema
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  is_restricted: z.boolean().optional(),
  archived: z.boolean().optional(),
});

// ============================================================================
// FOLDER SCHEMAS
// ============================================================================

/**
 * Create folder request body schema
 */
export const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(255, "Folder name must be 255 characters or less"),
  parent_id: z.string().optional(),
  is_restricted: z.boolean().optional(),
});

/**
 * Update folder request body schema
 */
export const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  is_restricted: z.boolean().optional(),
});

/**
 * Move folder request body schema
 */
export const moveFolderSchema = z.object({
  parent_id: z.string().nullable().optional(),
  destination_project_id: z.string().optional(),
  destination_parent_id: z.string().nullable().optional(),
});

// ============================================================================
// FILE SCHEMAS
// ============================================================================

/**
 * Create file placeholder request body schema
 */
export const createFileSchema = z.object({
  name: z.string().min(1, "File name is required").max(255),
  file_size: positiveIntSchema,
  file_type: z.string().min(1, "File type is required"),
  folder_id: z.string().optional(),
  project_id: z.string().optional(),
});

/**
 * Update file request body schema
 */
export const updateFileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

/**
 * Move file request body schema
 */
export const moveFileSchema = z.object({
  destination_folder_id: z.string().nullable().optional(),
  destination_project_id: z.string().optional(),
});

/**
 * Copy file request body schema
 */
export const copyFileSchema = z.object({
  destination_folder_id: z.string().nullable().optional(),
  destination_project_id: z.string().optional(),
});

// ============================================================================
// COLLECTION SCHEMAS
// ============================================================================

/**
 * Collection type
 */
export const collectionTypeSchema = z.enum(["team", "private"]);

/**
 * Create collection request body schema
 */
export const createCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").max(255),
  description: z.string().max(2000).optional(),
  type: collectionTypeSchema.optional(),
});

/**
 * Update collection request body schema
 */
export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

/**
 * Add items to collection request body schema
 */
export const addCollectionItemsSchema = z.object({
  file_ids: z.array(z.string().min(1)).min(1, "At least one file ID is required").max(100, "Cannot add more than 100 files at once"),
});

// ============================================================================
// TRANSCRIPTION SCHEMAS
// ============================================================================

/**
 * Create transcription request body schema
 */
export const createTranscriptionSchema = z.object({
  language: z.string().min(2).max(10).optional(),
  speaker_identification: z.boolean().optional(),
});

/**
 * Update transcription request body schema
 */
export const updateTranscriptionSchema = z.object({
  text: z.string().optional(),
  speaker_names: z.record(z.string()).optional(),
});

/**
 * Export transcription query schema
 */
export const exportTranscriptionSchema = z.object({
  format: z.enum(["srt", "vtt", "txt"]).default("srt"),
});

// ============================================================================
// VERSION STACK SCHEMAS
// ============================================================================

/**
 * Create version stack request body schema
 */
export const createVersionStackSchema = z.object({
  file_ids: z.array(z.string().min(1)).min(2, "At least 2 files are required to create a stack").max(50, "Cannot stack more than 50 files"),
  current_file_id: z.string().optional(),
});

// ============================================================================
// BULK OPERATION SCHEMAS
// ============================================================================

/**
 * Bulk move/copy/delete files schema
 */
export const bulkFilesOperationSchema = z.object({
  file_ids: z.array(z.string().min(1)).min(1, "At least one file ID is required").max(100, "Cannot process more than 100 files at once"),
});

/**
 * Bulk move files schema
 */
export const bulkMoveFilesSchema = bulkFilesOperationSchema.extend({
  destination_folder_id: z.string().nullable().optional(),
  destination_project_id: z.string().optional(),
});

/**
 * Bulk copy files schema
 */
export const bulkCopyFilesSchema = bulkFilesOperationSchema.extend({
  destination_folder_id: z.string().nullable().optional(),
  destination_project_id: z.string().optional(),
});

/**
 * Bulk update metadata schema
 */
export const bulkMetadataSchema = z.object({
  file_ids: z.array(z.string().min(1)).min(1, "At least one file ID is required").max(100),
  metadata: z.record(z.unknown()),
});

// ============================================================================
// ACCOUNT SCHEMAS
// ============================================================================

/**
 * Account slug validation - alphanumeric with hyphens, no leading/trailing hyphens
 */
const accountSlugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const slugErrorMessage = "Slug must be lowercase alphanumeric with hyphens, 3-63 characters, cannot start or end with hyphen";

/**
 * Create account request body schema
 */
export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(255, "Account name must be 255 characters or less"),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(63, "Slug must be 63 characters or less")
    .regex(accountSlugRegex, slugErrorMessage),
});

/**
 * Update account request body schema
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(63, "Slug must be 63 characters or less")
    .regex(accountSlugRegex, slugErrorMessage)
    .optional(),
});

// ============================================================================
// METADATA SCHEMAS
// ============================================================================

/**
 * Update file metadata request body schema
 * Validates built-in metadata fields (custom fields validated separately due to DB lookup)
 */
export const updateFileMetadataSchema = z.object({
  rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5").optional(),
  status: z.string().max(100, "Status must be 100 characters or less").optional(),
  keywords: z.array(z.string().max(100)).max(50, "Cannot have more than 50 keywords").optional(),
  notes: z.string().max(10000, "Notes must be 10000 characters or less").optional(),
  assignee_id: z.string().nullable().optional(),
  custom: z.record(z.unknown()).optional(),
});
