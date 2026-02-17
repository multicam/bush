/**
 * Bush Platform - Custom Fields Routes
 *
 * API routes for custom metadata field management.
 * Reference: specs/17-api-complete.md Section 6.10
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { customFields, customFieldVisibility, accountMemberships } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyAccountMembership } from "../access-control.js";
import type { CustomFieldType } from "../../db/schema.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * GET /v4/accounts/:accountId/custom_fields - List custom field definitions
 */
app.get("/accounts/:accountId/custom_fields", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId");
  const limit = parseLimit(c.req.query("limit"));

  // Verify user is a member of this account
  const [membership] = await db
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, session.userId),
        eq(accountMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new NotFoundError("account", accountId);
  }

  // Get all custom fields for the account
  const fields = await db
    .select()
    .from(customFields)
    .where(eq(customFields.accountId, accountId))
    .orderBy(customFields.sortOrder)
    .limit(limit);

  return sendCollection(
    c,
    fields.map((f) => formatDates(f)),
    RESOURCE_TYPES.CUSTOM_FIELD,
    { basePath: `/v4/accounts/${accountId}/custom_fields`, limit, totalCount: fields.length }
  );
});

/**
 * POST /v4/accounts/:accountId/custom_fields - Create custom field definition
 */
app.post("/accounts/:accountId/custom_fields", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId");
  const body = await c.req.json();

  // Verify user is admin or has full_access
  const memberRole = await verifyAccountMembership(session.userId, accountId, "content_admin");
  if (!memberRole) {
    throw new AuthorizationError("Only account admins can create custom fields");
  }

  // Validate input
  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("Field name is required", { pointer: "/data/attributes/name" });
  }

  if (!body.type || typeof body.type !== "string") {
    throw new ValidationError("Field type is required", { pointer: "/data/attributes/type" });
  }

  const validTypes: CustomFieldType[] = [
    "text", "textarea", "number", "date", "single_select",
    "multi_select", "checkbox", "user", "url", "rating"
  ];
  if (!validTypes.includes(body.type)) {
    throw new ValidationError(
      `Invalid field type. Must be one of: ${validTypes.join(", ")}`,
      { pointer: "/data/attributes/type" }
    );
  }

  // Generate slug from name if not provided
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  // Check for duplicate slug
  const [existing] = await db
    .select({ id: customFields.id })
    .from(customFields)
    .where(and(eq(customFields.accountId, accountId), eq(customFields.slug, slug)))
    .limit(1);

  if (existing) {
    throw new ValidationError("A field with this slug already exists", { pointer: "/data/attributes/slug" });
  }

  // Validate options for select fields
  if ((body.type === "single_select" || body.type === "multi_select") && !body.options) {
    throw new ValidationError("Options are required for select fields", { pointer: "/data/attributes/options" });
  }

  // Get max sort order
  const [maxSort] = await db
    .select({ sortOrder: customFields.sortOrder })
    .from(customFields)
    .where(eq(customFields.accountId, accountId))
    .orderBy(customFields.sortOrder)
    .limit(1);
  const nextSortOrder = (maxSort?.sortOrder ?? -1) + 1;

  // Create custom field
  const fieldId = generateId("cf");
  const now = new Date();

  await db.insert(customFields).values({
    id: fieldId,
    accountId,
    name: body.name,
    slug,
    type: body.type,
    description: body.description ?? null,
    options: body.options ?? null,
    isVisibleByDefault: body.is_visible_by_default ?? true,
    editableBy: body.editable_by ?? "full_access",
    sortOrder: nextSortOrder,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return the created field
  const [field] = await db
    .select()
    .from(customFields)
    .where(eq(customFields.id, fieldId))
    .limit(1);

  return sendSingle(c, formatDates(field!), RESOURCE_TYPES.CUSTOM_FIELD);
});

/**
 * GET /v4/custom_fields/:id - Get custom field definition
 */
app.get("/custom_fields/:id", async (c) => {
  const session = requireAuth(c);
  const fieldId = c.req.param("id");

  // Get the field
  const [field] = await db
    .select()
    .from(customFields)
    .where(eq(customFields.id, fieldId))
    .limit(1);

  if (!field) {
    throw new NotFoundError("custom_field", fieldId);
  }

  // Verify user is a member of the account
  const [membership] = await db
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, session.userId),
        eq(accountMemberships.accountId, field.accountId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new NotFoundError("custom_field", fieldId);
  }

  return sendSingle(c, formatDates(field), RESOURCE_TYPES.CUSTOM_FIELD);
});

/**
 * PUT /v4/custom_fields/:id - Update custom field definition
 */
app.put("/custom_fields/:id", async (c) => {
  const session = requireAuth(c);
  const fieldId = c.req.param("id");
  const body = await c.req.json();

  // Get the field
  const [field] = await db
    .select()
    .from(customFields)
    .where(eq(customFields.id, fieldId))
    .limit(1);

  if (!field) {
    throw new NotFoundError("custom_field", fieldId);
  }

  // Verify user is admin
  const memberRole = await verifyAccountMembership(session.userId, field.accountId, "content_admin");
  if (!memberRole) {
    throw new AuthorizationError("Only account admins can update custom fields");
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.options !== undefined) {
    if (field.type !== "single_select" && field.type !== "multi_select") {
      throw new ValidationError("Options can only be set for select fields", { pointer: "/data/attributes/options" });
    }
    updates.options = body.options;
  }
  if (body.is_visible_by_default !== undefined) {
    updates.isVisibleByDefault = body.is_visible_by_default;
  }
  if (body.editable_by !== undefined) {
    updates.editableBy = body.editable_by;
  }
  if (body.sort_order !== undefined) {
    updates.sortOrder = body.sort_order;
  }

  // Update field
  await db.update(customFields).set(updates).where(eq(customFields.id, fieldId));

  // Fetch and return updated field
  const [updatedField] = await db
    .select()
    .from(customFields)
    .where(eq(customFields.id, fieldId))
    .limit(1);

  return sendSingle(c, formatDates(updatedField!), RESOURCE_TYPES.CUSTOM_FIELD);
});

/**
 * DELETE /v4/custom_fields/:id - Delete custom field definition
 */
app.delete("/custom_fields/:id", async (c) => {
  const session = requireAuth(c);
  const fieldId = c.req.param("id");

  // Get the field
  const [field] = await db
    .select()
    .from(customFields)
    .where(eq(customFields.id, fieldId))
    .limit(1);

  if (!field) {
    throw new NotFoundError("custom_field", fieldId);
  }

  // Verify user is owner (only owner can delete fields)
  const memberRole = await verifyAccountMembership(session.userId, field.accountId, "owner");
  if (!memberRole) {
    throw new AuthorizationError("Only account owners can delete custom fields");
  }

  // Delete field (cascade will delete visibility settings)
  await db.delete(customFields).where(eq(customFields.id, fieldId));

  return c.body(null, 204);
});

/**
 * PUT /v4/custom_fields/:id/visibility/:projectId - Set field visibility for project
 */
app.put("/custom_fields/:id/visibility/:projectId", async (c) => {
  const session = requireAuth(c);
  const fieldId = c.req.param("id");
  const projectId = c.req.param("projectId");
  const body = await c.req.json();

  // Get the field
  const [field] = await db
    .select()
    .from(customFields)
    .where(eq(customFields.id, fieldId))
    .limit(1);

  if (!field) {
    throw new NotFoundError("custom_field", fieldId);
  }

  // Verify user is admin
  const memberRole = await verifyAccountMembership(session.userId, field.accountId, "content_admin");
  if (!memberRole) {
    throw new AuthorizationError("Only account admins can update field visibility");
  }

  // Upsert visibility
  const visibilityId = generateId("cfv");
  const now = new Date();
  const isVisible = body.is_visible ?? true;

  // Check if visibility exists
  const [existing] = await db
    .select({ id: customFieldVisibility.id })
    .from(customFieldVisibility)
    .where(
      and(
        eq(customFieldVisibility.customFieldId, fieldId),
        eq(customFieldVisibility.projectId, projectId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(customFieldVisibility)
      .set({ isVisible, updatedAt: now })
      .where(eq(customFieldVisibility.id, existing.id));
  } else {
    await db.insert(customFieldVisibility).values({
      id: visibilityId,
      customFieldId: fieldId,
      projectId,
      isVisible,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({
    data: {
      id: fieldId,
      type: "custom_field_visibility",
      attributes: {
        project_id: projectId,
        is_visible: isVisible,
      },
    },
  });
});

export default app;
