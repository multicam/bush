/**
 * Bush Platform - Shares Routes
 *
 * API routes for share link management.
 * Reference: specs/17-api-complete.md, specs/05-sharing-and-presentations.md
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { shares, shareAssets, shareActivity, files, users } from "../../db/schema.js";
import { eq, and, desc, lt, sql, isNull } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import {
  sendSingle,
  sendCollection,
  sendNoContent,
  sendAccepted,
  RESOURCE_TYPES,
  formatDates,
  decodeCursor,
} from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyProjectAccess, verifyAccountAccess } from "../access-control.js";

// Use Bun's built-in password hashing (bcrypt)
async function hashPassphrase(passphrase: string): Promise<string> {
  return await Bun.password.hash(passphrase, {
    algorithm: "bcrypt",
    cost: 12,
  });
}

async function verifyPassphrase(passphrase: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(passphrase, hash);
}

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * Generate a unique slug for a share
 */
function generateShareSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

/**
 * GET /v4/accounts/:accountId/shares - List shares for an account
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId")!;
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");
  const projectId = c.req.query("project_id");

  // Verify account access
  const hasAccess = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("account", accountId);
  }

  // Build query conditions
  const conditions = [eq(shares.accountId, accountId)];

  if (projectId) {
    conditions.push(eq(shares.projectId, projectId));
  }

  // Apply cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(shares.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  // Get shares with creator info
  const results = await db
    .select({
      share: shares,
      user: users,
    })
    .from(shares)
    .innerJoin(users, eq(shares.createdByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(shares.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((r) => ({
    ...formatDates(r.share),
    created_by: formatDates(r.user),
    asset_count: 0, // Will be populated separately if needed
  }));

  return sendCollection(c, items, RESOURCE_TYPES.SHARE, {
    basePath: `/v4/accounts/${accountId}/shares`,
    limit,
    totalCount: results.length,
  });
});

/**
 * POST /v4/accounts/:accountId/shares - Create a new share
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId")!;
  const body = await c.req.json();

  // Verify account access
  const hasAccess = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("account", accountId);
  }

  // Validate input
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    throw new ValidationError("Share name is required", { pointer: "/data/attributes/name" });
  }

  if (body.name.length > 255) {
    throw new ValidationError("Share name must be 255 characters or less", {
      pointer: "/data/attributes/name",
    });
  }

  // Validate project access if specified
  if (body.project_id) {
    const projectAccess = await verifyProjectAccess(body.project_id, session.currentAccountId);
    if (!projectAccess) {
      throw new NotFoundError("project", body.project_id);
    }
  }

  // Validate layout
  const layout = body.layout || "grid";
  if (!["grid", "reel", "viewer"].includes(layout)) {
    throw new ValidationError("Layout must be one of: grid, reel, viewer", {
      pointer: "/data/attributes/layout",
    });
  }

  // Generate unique slug
  let slug = generateShareSlug();
  let attempts = 0;
  while (attempts < 10) {
    const [existing] = await db
      .select()
      .from(shares)
      .where(eq(shares.slug, slug))
      .limit(1);

    if (!existing) break;
    slug = generateShareSlug();
    attempts++;
  }

  // Create share
  const shareId = generateId("share");
  const now = new Date();

  // Hash passphrase if provided (bcrypt)
  const hashedPassphrase = body.passphrase ? await hashPassphrase(body.passphrase) : null;

  await db.insert(shares).values({
    id: shareId,
    accountId,
    projectId: body.project_id || null,
    createdByUserId: session.userId,
    name: body.name.trim(),
    slug,
    passphrase: hashedPassphrase,
    expiresAt: body.expires_at ? new Date(body.expires_at) : null,
    layout,
    allowComments: body.allow_comments !== false,
    allowDownloads: body.allow_downloads === true,
    showAllVersions: body.show_all_versions === true,
    showTranscription: body.show_transcription === true,
    featuredField: body.featured_field || null,
    branding: body.branding || null,
    createdAt: now,
    updatedAt: now,
  });

  // Add assets if specified
  if (body.file_ids && Array.isArray(body.file_ids) && body.file_ids.length > 0) {
    const assetValues = body.file_ids.map((fileId: string, index: number) => ({
      id: generateId("share_asset"),
      shareId,
      fileId,
      sortOrder: index,
      createdAt: now,
    }));

    await db.insert(shareAssets).values(assetValues);
  }

  // Fetch created share with creator info
  const [createdShare] = await db
    .select({
      share: shares,
      user: users,
    })
    .from(shares)
    .innerJoin(users, eq(shares.createdByUserId, users.id))
    .where(eq(shares.id, shareId))
    .limit(1);

  // Get asset count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(shareAssets)
    .where(eq(shareAssets.shareId, shareId));

  return sendSingle(
    c,
    {
      ...formatDates(createdShare.share),
      created_by: formatDates(createdShare.user),
      asset_count: Number(count),
    },
    RESOURCE_TYPES.SHARE
  );
});

/**
 * GET /v4/shares/:id - Get a share by ID
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");

  // Get share with creator info
  const [result] = await db
    .select({
      share: shares,
      user: users,
    })
    .from(shares)
    .innerJoin(users, eq(shares.createdByUserId, users.id))
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!result) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(result.share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Get asset count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(shareAssets)
    .where(eq(shareAssets.shareId, shareId));

  return sendSingle(
    c,
    {
      ...formatDates(result.share),
      created_by: formatDates(result.user),
      asset_count: Number(count),
    },
    RESOURCE_TYPES.SHARE
  );
});

/**
 * PATCH /v4/shares/:id - Update a share
 */
app.patch("/:id", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");
  const body = await c.req.json();

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new ValidationError("Share name is required", { pointer: "/data/attributes/name" });
    }
    if (body.name.length > 255) {
      throw new ValidationError("Share name must be 255 characters or less", {
        pointer: "/data/attributes/name",
      });
    }
    updates.name = body.name.trim();
  }

  if (body.passphrase !== undefined) {
    // Hash passphrase if provided (bcrypt)
    updates.passphrase = body.passphrase ? await hashPassphrase(body.passphrase) : null;
  }

  if (body.expires_at !== undefined) {
    updates.expiresAt = body.expires_at ? new Date(body.expires_at) : null;
  }

  if (body.layout !== undefined) {
    if (!["grid", "reel", "viewer"].includes(body.layout)) {
      throw new ValidationError("Layout must be one of: grid, reel, viewer", {
        pointer: "/data/attributes/layout",
      });
    }
    updates.layout = body.layout;
  }

  if (body.allow_comments !== undefined) {
    updates.allowComments = body.allow_comments === true;
  }

  if (body.allow_downloads !== undefined) {
    updates.allowDownloads = body.allow_downloads === true;
  }

  if (body.show_all_versions !== undefined) {
    updates.showAllVersions = body.show_all_versions === true;
  }

  if (body.show_transcription !== undefined) {
    updates.showTranscription = body.show_transcription === true;
  }

  if (body.featured_field !== undefined) {
    updates.featuredField = body.featured_field || null;
  }

  if (body.branding !== undefined) {
    updates.branding = body.branding;
  }

  // Update share
  await db.update(shares).set(updates).where(eq(shares.id, shareId));

  // Fetch updated share with creator info
  const [updatedShare] = await db
    .select({
      share: shares,
      user: users,
    })
    .from(shares)
    .innerJoin(users, eq(shares.createdByUserId, users.id))
    .where(eq(shares.id, shareId))
    .limit(1);

  // Get asset count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(shareAssets)
    .where(eq(shareAssets.shareId, shareId));

  return sendSingle(
    c,
    {
      ...formatDates(updatedShare.share),
      created_by: formatDates(updatedShare.user),
      asset_count: Number(count),
    },
    RESOURCE_TYPES.SHARE
  );
});

/**
 * DELETE /v4/shares/:id - Delete a share
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Delete share (cascade will handle shareAssets and shareActivity)
  await db.delete(shares).where(eq(shares.id, shareId));

  return sendNoContent(c);
});

/**
 * GET /v4/shares/:id/assets - List assets in a share
 */
app.get("/:id/assets", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Build query conditions
  const conditions = [eq(shareAssets.shareId, shareId)];

  // Apply cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.sortOrder !== undefined) {
      conditions.push(lt(shareAssets.sortOrder, cursorData.sortOrder as number));
    }
  }

  // Get assets with file info
  const results = await db
    .select({
      shareAsset: shareAssets,
      file: files,
    })
    .from(shareAssets)
    .innerJoin(files, eq(shareAssets.fileId, files.id))
    .where(and(...conditions))
    .orderBy(shareAssets.sortOrder)
    .limit(limit + 1);

  const items = results.slice(0, limit).map((r) => ({
    ...formatDates(r.shareAsset),
    file: formatDates(r.file),
  }));

  return sendCollection(c, items, "share_asset", {
    basePath: `/v4/shares/${shareId}/assets`,
    limit,
    totalCount: results.length,
  });
});

/**
 * POST /v4/shares/:id/assets - Add assets to a share
 */
app.post("/:id/assets", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");
  const body = await c.req.json();

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Validate input
  if (!body.file_ids || !Array.isArray(body.file_ids) || body.file_ids.length === 0) {
    throw new ValidationError("file_ids array is required", { pointer: "/data/attributes/file_ids" });
  }

  // Verify all files exist and are accessible via the account
  // Using verifyProjectAccess for each file's project ensures proper authorization
  const validFileIds: string[] = [];
  const invalidFileIds: string[] = [];

  for (const fileId of body.file_ids as string[]) {
    // Get the file with its project's workspace to verify access
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
      invalidFileIds.push(fileId);
      continue;
    }

    // Verify the user has access to the file's project
    const projectAccess = await verifyProjectAccess(file.projectId, session.currentAccountId);
    if (!projectAccess) {
      invalidFileIds.push(fileId);
      continue;
    }

    validFileIds.push(fileId);
  }

  if (invalidFileIds.length > 0) {
    throw new ValidationError(
      `Files not found or not accessible: ${invalidFileIds.join(", ")}`,
      { pointer: "/data/attributes/file_ids" }
    );
  }

  // Get current max sort order
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
    .from(shareAssets)
    .where(eq(shareAssets.shareId, shareId));

  // Add assets
  const now = new Date();
  const assetValues = validFileIds.map((fileId, index) => ({
    id: generateId("share_asset"),
    shareId,
    fileId,
    sortOrder: Number(maxOrder) + 1 + index,
    createdAt: now,
  }));

  // Use on conflict do nothing to skip duplicates
  await db.insert(shareAssets).values(assetValues)
    .onConflictDoNothing();

  return sendAccepted(c, "Assets added to share");
});

/**
 * DELETE /v4/shares/:id/assets/:assetId - Remove an asset from a share
 */
app.delete("/:id/assets/:assetId", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");
  const assetId = c.req.param("assetId");

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Delete share asset
  await db.delete(shareAssets)
    .where(and(eq(shareAssets.shareId, shareId), eq(shareAssets.id, assetId)));

  return sendNoContent(c);
});

/**
 * POST /v4/shares/:id/duplicate - Duplicate a share
 */
app.post("/:id/duplicate", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Generate unique slug for duplicate
  let slug = generateShareSlug();
  let attempts = 0;
  while (attempts < 10) {
    const [existing] = await db
      .select()
      .from(shares)
      .where(eq(shares.slug, slug))
      .limit(1);

    if (!existing) break;
    slug = generateShareSlug();
    attempts++;
  }

  // Create duplicate share
  const newShareId = generateId("share");
  const now = new Date();

  await db.insert(shares).values({
    id: newShareId,
    accountId: share.accountId,
    projectId: share.projectId,
    createdByUserId: session.userId,
    name: `${share.name} (Copy)`,
    slug,
    passphrase: share.passphrase,
    expiresAt: null, // Don't copy expiration
    layout: share.layout,
    allowComments: share.allowComments,
    allowDownloads: share.allowDownloads,
    showAllVersions: share.showAllVersions,
    showTranscription: share.showTranscription,
    featuredField: share.featuredField,
    branding: share.branding,
    createdAt: now,
    updatedAt: now,
  });

  // Copy share assets
  const existingAssets = await db
    .select()
    .from(shareAssets)
    .where(eq(shareAssets.shareId, shareId));

  if (existingAssets.length > 0) {
    const assetValues = existingAssets.map((asset) => ({
      id: generateId("share_asset"),
      shareId: newShareId,
      fileId: asset.fileId,
      sortOrder: asset.sortOrder,
      createdAt: now,
    }));

    await db.insert(shareAssets).values(assetValues);
  }

  // Fetch created share with creator info
  const [createdShare] = await db
    .select({
      share: shares,
      user: users,
    })
    .from(shares)
    .innerJoin(users, eq(shares.createdByUserId, users.id))
    .where(eq(shares.id, newShareId))
    .limit(1);

  return sendSingle(
    c,
    {
      ...formatDates(createdShare.share),
      created_by: formatDates(createdShare.user),
      asset_count: existingAssets.length,
    },
    RESOURCE_TYPES.SHARE
  );
});

/**
 * GET /v4/shares/:id/activity - Get share activity
 */
app.get("/:id/activity", async (c) => {
  const session = requireAuth(c);
  const shareId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");
  const type = c.req.query("type");

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", shareId);
  }

  // Verify account access
  const hasAccess = await verifyAccountAccess(share.accountId, session.currentAccountId);
  if (!hasAccess) {
    throw new NotFoundError("share", shareId);
  }

  // Build query conditions
  const conditions = [eq(shareActivity.shareId, shareId)];

  if (type && ["view", "comment", "download"].includes(type)) {
    conditions.push(eq(shareActivity.type, type as "view" | "comment" | "download"));
  }

  // Apply cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(shareActivity.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  // Get activity
  const results = await db
    .select()
    .from(shareActivity)
    .where(and(...conditions))
    .orderBy(desc(shareActivity.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((r) => formatDates(r));

  return sendCollection(c, items, "share_activity", {
    basePath: `/v4/shares/${shareId}/activity`,
    limit,
    totalCount: results.length,
  });
});

/**
 * GET /v4/shares/slug/:slug - Get a share by slug (public access)
 * This endpoint is for viewing shared content without authentication
 *
 * Query parameters:
 * - passphrase: Required if share has passphrase protection
 *
 * Security: The passphrase is never returned in the response. If the share
 * has passphrase protection, the response includes `passphrase_required: true`
 * and the client must submit the passphrase to access the content.
 */
export async function getShareBySlug(c: any) {
  const slug = c.req.param("slug");
  const providedPassphrase = c.req.query("passphrase");

  // Get share
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.slug, slug))
    .limit(1);

  if (!share) {
    throw new NotFoundError("share", slug);
  }

  // Check expiration
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new ValidationError("This share has expired", { pointer: "/data/attributes/expires_at" });
  }

  // Check passphrase protection
  const requiresPassphrase = !!share.passphrase;

  if (requiresPassphrase) {
    // Verify passphrase if provided
    if (!providedPassphrase) {
      // Return minimal info indicating passphrase is required
      return sendSingle(
        c,
        {
          id: share.id,
          slug: share.slug,
          name: share.name,
          passphrase_required: true,
          branding: share.branding || {},
        },
        RESOURCE_TYPES.SHARE
      );
    }

    // Verify passphrase using bcrypt (constant-time by design)
    // We already checked that share.passphrase is truthy above
    const passphraseMatch = await verifyPassphrase(providedPassphrase, share.passphrase || "");
    if (!passphraseMatch) {
      throw new ValidationError("Incorrect passphrase", { pointer: "/data/attributes/passphrase" });
    }
  }

  // Get assets with file info
  const assets = await db
    .select({
      shareAsset: shareAssets,
      file: files,
    })
    .from(shareAssets)
    .innerJoin(files, eq(shareAssets.fileId, files.id))
    .where(eq(shareAssets.shareId, share.id))
    .orderBy(shareAssets.sortOrder);

  // Build response without exposing the passphrase
  const { passphrase: _omitPassphrase, ...shareWithoutPassphrase } = share;

  return sendSingle(
    c,
    {
      ...formatDates(shareWithoutPassphrase),
      passphrase_required: false,
      assets: assets.map((a) => formatDates(a.file)),
    },
    RESOURCE_TYPES.SHARE
  );
}

export default app;
