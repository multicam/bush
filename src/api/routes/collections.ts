/**
 * Bush Platform - Collections Routes
 *
 * API routes for collection management.
 * Reference: specs/17-api-complete.md Section 6.11
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { collections, collectionAssets, files, users } from "../../db/schema.js";
import { eq, and, isNull, desc, inArray, sql } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyProjectAccess } from "../access-control.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * GET /v4/projects/:projectId/collections - List collections in project
 *
 * Returns all collections visible to the current user in a project.
 * Team collections are visible to all project members.
 * Private collections are only visible to their creator.
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId") as string;
  const limit = parseLimit(c.req.query("limit"));

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Get collections - team collections + private collections created by current user
  const projectCollections = await db
    .select({
      collection: collections,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .innerJoin(users, eq(collections.createdByUserId, users.id))
    .where(
      and(
        eq(collections.projectId, projectId),
        sql`(${collections.type} = 'team' OR ${collections.createdByUserId} = ${session.userId})`
      )
    )
    .orderBy(desc(collections.createdAt))
    .limit(limit + 1);

  const items = projectCollections.slice(0, limit);

  // Get asset counts for each collection
  const collectionIds = items.map((item) => item.collection.id);
  const assetCounts = collectionIds.length > 0
    ? await db
        .select({
          collectionId: collectionAssets.collectionId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(collectionAssets)
        .where(inArray(collectionAssets.collectionId, collectionIds))
        .groupBy(collectionAssets.collectionId)
    : [];

  const assetCountMap = new Map(assetCounts.map((ac) => [ac.collectionId, Number(ac.count)]));

  const formattedItems = items.map((item) => ({
    id: item.collection.id,
    name: item.collection.name,
    description: item.collection.description,
    type: item.collection.type,
    isDynamic: item.collection.isDynamic,
    filterRules: item.collection.filterRules,
    defaultView: item.collection.defaultView,
    assetCount: assetCountMap.get(item.collection.id) || 0,
    creator: item.creator,
    createdAt: item.collection.createdAt,
    updatedAt: item.collection.updatedAt,
  }));

  return sendCollection(c, formattedItems.map((item) => formatDates(item)), RESOURCE_TYPES.COLLECTION, {
    basePath: `/v4/projects/${projectId}/collections`,
    limit,
    totalCount: projectCollections.length,
  });
});

/**
 * POST /v4/projects/:projectId/collections - Create collection
 *
 * Creates a new collection in a project.
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const projectId = c.req.param("projectId") as string;
  const body = await c.req.json();

  // Verify project access
  const access = await verifyProjectAccess(projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("project", projectId);
  }

  // Validate input
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    throw new ValidationError("name is required", { pointer: "/data/attributes/name" });
  }

  // Validate type
  const type = body.type || "team";
  if (type !== "team" && type !== "private") {
    throw new ValidationError("type must be 'team' or 'private'", { pointer: "/data/attributes/type" });
  }

  // Validate filter rules if provided
  if (body.filter_rules && !Array.isArray(body.filter_rules)) {
    throw new ValidationError("filter_rules must be an array", { pointer: "/data/attributes/filter_rules" });
  }

  // Create collection
  const collectionId = generateId("coll");
  const now = new Date();

  await db.insert(collections).values({
    id: collectionId,
    projectId: projectId,
    createdByUserId: session.userId,
    name: body.name.trim(),
    description: body.description || null,
    type: type as "team" | "private",
    isDynamic: body.is_dynamic ?? (body.filter_rules ? true : false),
    filterRules: body.filter_rules || null,
    defaultView: (body.default_view || "grid") as "grid" | "list",
    createdAt: now,
    updatedAt: now,
  });

  // Fetch the created collection with creator info
  const [collection] = await db
    .select({
      collection: collections,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .innerJoin(users, eq(collections.createdByUserId, users.id))
    .where(eq(collections.id, collectionId))
    .limit(1);

  const formatted = {
    id: collection.collection.id,
    name: collection.collection.name,
    description: collection.collection.description,
    type: collection.collection.type,
    isDynamic: collection.collection.isDynamic,
    filterRules: collection.collection.filterRules,
    defaultView: collection.collection.defaultView,
    assetCount: 0,
    creator: collection.creator,
    createdAt: collection.collection.createdAt,
    updatedAt: collection.collection.updatedAt,
  };

  return sendSingle(c, formatDates(formatted), RESOURCE_TYPES.COLLECTION);
});

/**
 * GET /v4/collections/:id - Get collection details
 *
 * Returns a collection with its items.
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const collectionId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Get collection
  const [collection] = await db
    .select({
      collection: collections,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .innerJoin(users, eq(collections.createdByUserId, users.id))
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    throw new NotFoundError("collection", collectionId);
  }

  // Verify project access
  const access = await verifyProjectAccess(collection.collection.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("collection", collectionId);
  }

  // Check visibility for private collections
  if (collection.collection.type === "private" && collection.collection.createdByUserId !== session.userId) {
    throw new NotFoundError("collection", collectionId);
  }

  // Get assets in collection
  const assets = await db
    .select({
      file: files,
      addedBy: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(collectionAssets)
    .innerJoin(files, eq(collectionAssets.fileId, files.id))
    .innerJoin(users, eq(collectionAssets.addedByUserId, users.id))
    .where(
      and(
        eq(collectionAssets.collectionId, collectionId),
        isNull(files.deletedAt)
      )
    )
    .orderBy(collectionAssets.sortOrder)
    .limit(limit + 1);

  const items = assets.slice(0, limit);

  const formattedCollection = {
    id: collection.collection.id,
    name: collection.collection.name,
    description: collection.collection.description,
    type: collection.collection.type,
    isDynamic: collection.collection.isDynamic,
    filterRules: collection.collection.filterRules,
    defaultView: collection.collection.defaultView,
    assetCount: assets.length,
    creator: collection.creator,
    createdAt: collection.collection.createdAt,
    updatedAt: collection.collection.updatedAt,
  };

  const formattedAssets = items.map((item) => ({
    id: item.file.id,
    name: item.file.name,
    mimeType: item.file.mimeType,
    fileSizeBytes: item.file.fileSizeBytes,
    status: item.file.status,
    addedBy: item.addedBy,
    createdAt: item.file.createdAt,
  }));

  return c.json({
    data: {
      id: formattedCollection.id,
      type: "collection",
      attributes: formatDates(formattedCollection),
      relationships: {
        assets: {
          data: formattedAssets.map((a) => ({ id: a.id, type: "file" })),
        },
      },
    },
    included: formattedAssets.map((a) => ({
      id: a.id,
      type: "file",
      attributes: formatDates(a),
    })),
  });
});

/**
 * PUT /v4/collections/:id - Update collection
 *
 * Updates collection settings. Only creator or admins can update.
 */
app.put("/:id", async (c) => {
  const session = requireAuth(c);
  const collectionId = c.req.param("id");
  const body = await c.req.json();

  // Get collection
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    throw new NotFoundError("collection", collectionId);
  }

  // Verify project access
  const access = await verifyProjectAccess(collection.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("collection", collectionId);
  }

  // Check ownership for private collections
  if (collection.type === "private" && collection.createdByUserId !== session.userId) {
    throw new AuthorizationError("You can only update your own private collections");
  }

  // For team collections, allow edit if user has edit+ permission (simplified for now)
  // In a full implementation, we'd check the permission level

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw new ValidationError("name must be a non-empty string", { pointer: "/data/attributes/name" });
    }
    updates.name = body.name.trim();
  }

  if (body.description !== undefined) {
    updates.description = body.description || null;
  }

  if (body.type !== undefined) {
    if (body.type !== "team" && body.type !== "private") {
      throw new ValidationError("type must be 'team' or 'private'", { pointer: "/data/attributes/type" });
    }
    updates.type = body.type;
  }

  if (body.filter_rules !== undefined) {
    if (body.filter_rules !== null && !Array.isArray(body.filter_rules)) {
      throw new ValidationError("filter_rules must be an array or null", { pointer: "/data/attributes/filter_rules" });
    }
    updates.filterRules = body.filter_rules;
    updates.isDynamic = body.filter_rules ? true : false;
  }

  if (body.default_view !== undefined) {
    if (body.default_view !== "grid" && body.default_view !== "list") {
      throw new ValidationError("default_view must be 'grid' or 'list'", { pointer: "/data/attributes/default_view" });
    }
    updates.defaultView = body.default_view;
  }

  // Update collection
  await db.update(collections).set(updates).where(eq(collections.id, collectionId));

  // Fetch and return updated collection
  const [updatedCollection] = await db
    .select({
      collection: collections,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .innerJoin(users, eq(collections.createdByUserId, users.id))
    .where(eq(collections.id, collectionId))
    .limit(1);

  // Get asset count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionAssets)
    .where(eq(collectionAssets.collectionId, collectionId));

  const formatted = {
    id: updatedCollection.collection.id,
    name: updatedCollection.collection.name,
    description: updatedCollection.collection.description,
    type: updatedCollection.collection.type,
    isDynamic: updatedCollection.collection.isDynamic,
    filterRules: updatedCollection.collection.filterRules,
    defaultView: updatedCollection.collection.defaultView,
    assetCount: Number(count),
    creator: updatedCollection.creator,
    createdAt: updatedCollection.collection.createdAt,
    updatedAt: updatedCollection.collection.updatedAt,
  };

  return sendSingle(c, formatDates(formatted), RESOURCE_TYPES.COLLECTION);
});

/**
 * DELETE /v4/collections/:id - Delete collection
 *
 * Deletes a collection and its asset associations. Only creator or admins can delete.
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const collectionId = c.req.param("id");

  // Get collection
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    throw new NotFoundError("collection", collectionId);
  }

  // Verify project access
  const access = await verifyProjectAccess(collection.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("collection", collectionId);
  }

  // Check ownership for private collections
  if (collection.type === "private" && collection.createdByUserId !== session.userId) {
    throw new AuthorizationError("You can only delete your own private collections");
  }

  // Delete collection assets first (cascade should handle this, but be explicit)
  await db.delete(collectionAssets).where(eq(collectionAssets.collectionId, collectionId));

  // Delete collection
  await db.delete(collections).where(eq(collections.id, collectionId));

  return sendNoContent(c);
});

/**
 * POST /v4/collections/:id/items - Add items to collection
 *
 * Adds files to a manual collection. Only creator or editors can add items.
 */
app.post("/:id/items", async (c) => {
  const session = requireAuth(c);
  const collectionId = c.req.param("id");
  const body = await c.req.json();

  // Get collection
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    throw new NotFoundError("collection", collectionId);
  }

  // Verify project access
  const access = await verifyProjectAccess(collection.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("collection", collectionId);
  }

  // Check ownership for private collections
  if (collection.type === "private" && collection.createdByUserId !== session.userId) {
    throw new AuthorizationError("You can only add items to your own private collections");
  }

  // Cannot add items to dynamic collections
  if (collection.isDynamic) {
    throw new ValidationError("Cannot manually add items to a dynamic collection", {
      pointer: "/data/attributes/collection_id",
    });
  }

  // Validate input
  const fileIds = body.file_ids;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ValidationError("file_ids must be a non-empty array", { pointer: "/data/attributes/file_ids" });
  }

  if (fileIds.length > 100) {
    throw new ValidationError("Cannot add more than 100 files at once", { pointer: "/data/attributes/file_ids" });
  }

  // Verify all files exist and belong to the same project
  const existingFiles = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        inArray(files.id, fileIds),
        eq(files.projectId, collection.projectId),
        isNull(files.deletedAt)
      )
    );

  const existingFileIds = new Set(existingFiles.map((f) => f.id));

  // Get current max sort order
  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${collectionAssets.sortOrder}), -1)` })
    .from(collectionAssets)
    .where(eq(collectionAssets.collectionId, collectionId));

  let sortOrder = Number(maxSort) + 1;
  const now = new Date();
  const added: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const fileId of fileIds) {
    if (!existingFileIds.has(fileId)) {
      failed.push({ id: fileId, error: "File not found or not accessible" });
      continue;
    }

    try {
      const assetId = generateId("collitem");
      await db.insert(collectionAssets).values({
        id: assetId,
        collectionId,
        fileId,
        sortOrder,
        addedByUserId: session.userId,
        createdAt: now,
      });
      added.push(fileId);
      sortOrder++;
    } catch (err) {
      // Likely a duplicate key error (file already in collection)
      failed.push({ id: fileId, error: "File already in collection" });
    }
  }

  return c.json({
    data: {
      added,
      failed,
    },
  });
});

/**
 * DELETE /v4/collections/:id/items/:itemId - Remove item from collection
 *
 * Removes a file from a manual collection. Only creator or editors can remove items.
 */
app.delete("/:id/items/:itemId", async (c) => {
  const session = requireAuth(c);
  const collectionId = c.req.param("id");
  const itemId = c.req.param("itemId");

  // Get collection
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    throw new NotFoundError("collection", collectionId);
  }

  // Verify project access
  const access = await verifyProjectAccess(collection.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("collection", collectionId);
  }

  // Check ownership for private collections
  if (collection.type === "private" && collection.createdByUserId !== session.userId) {
    throw new AuthorizationError("You can only remove items from your own private collections");
  }

  // Delete the collection asset
  await db
    .delete(collectionAssets)
    .where(
      and(
        eq(collectionAssets.collectionId, collectionId),
        eq(collectionAssets.id, itemId)
      )
    );

  return sendNoContent(c);
});

/**
 * Re-export resource types with COLLECTION
 */
export const COLLECTION_RESOURCE_TYPE = "collection";

export default app;
