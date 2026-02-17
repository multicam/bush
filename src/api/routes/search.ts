/**
 * Bush Platform - Search Routes
 *
 * API routes for file search using FTS5.
 * Reference: specs/00-atomic-features.md Section 12
 */
import { Hono } from "hono";
import { db, sqlite } from "../../db/index.js";
import { projects, workspaces } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { RESOURCE_TYPES } from "../response.js";
import { parseLimit } from "../router.js";
import { ValidationError } from "../../errors/index.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * Minimum query length for search
 */
const MIN_QUERY_LENGTH = 2;

/**
 * Maximum results to return
 */
const MAX_RESULTS = 100;

/**
 * MIME type mappings for file type filters
 */
const MIME_TYPE_FILTERS: Record<string, string[]> = {
  video: ["video/%"],
  audio: ["audio/%"],
  image: ["image/%"],
  document: ["application/pdf", "application/msword", "application/vnd.%"],
};

/**
 * Convert Unix timestamp to ISO string
 */
function timestampToISO(timestamp: number | null): string | null {
  if (!timestamp) return null;
  // SQLite stores as seconds or milliseconds
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(ms).toISOString();
}

/**
 * GET /v4/search - Search files across accessible projects
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 * - project_id: Filter to specific project (optional)
 * - type: Filter by file type (video, audio, image, document) (optional)
 * - limit: Max results (default 50, max 100)
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const query = c.req.query("q")?.trim();
  const projectId = c.req.query("project_id");
  const fileType = c.req.query("type");
  const limit = Math.min(parseLimit(c.req.query("limit")), MAX_RESULTS);

  // Validate query
  if (!query || query.length < MIN_QUERY_LENGTH) {
    throw new ValidationError(
      `Query must be at least ${MIN_QUERY_LENGTH} characters`,
      { pointer: "/query" }
    );
  }

  // Get all projects the user has access to via their account
  const accessibleProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(eq(workspaces.accountId, session.currentAccountId));

  if (accessibleProjects.length === 0) {
    return c.json({
      data: [],
      meta: { total: 0, query, has_more: false },
    });
  }

  const projectIds = accessibleProjects.map((p) => p.id);

  // If filtering by project, verify access
  if (projectId && !projectIds.includes(projectId)) {
    return c.json({
      data: [],
      meta: { total: 0, query, has_more: false },
    });
  }

  // Build MIME type filter if specified
  let mimeFilter = "";
  const mimeTypeValues: string[] = [];

  if (fileType && fileType in MIME_TYPE_FILTERS) {
    const types = MIME_TYPE_FILTERS[fileType];
    const conditions = types.map(() => "f.mime_type LIKE ?").join(" OR ");
    mimeFilter = `AND (${conditions})`;
    mimeTypeValues.push(...types);
  }

  // Build project filter
  const projectFilter = projectId
    ? "f.project_id = ?"
    : `f.project_id IN (${projectIds.map(() => "?").join(",")})`;

  // Escape special FTS5 characters in query
  const escapedQuery = query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word) => `${word}*`)
    .join(" ");

  // Build params array
  const params: (string | number)[] = [escapedQuery];
  if (projectId) {
    params.push(projectId);
  } else {
    params.push(...projectIds);
  }
  params.push(...mimeTypeValues);
  params.push(limit);

  // Execute FTS5 search with BM25 ranking
  const results = sqlite
    .prepare(
      `
      SELECT
        f.id,
        f.project_id,
        f.folder_id,
        f.name,
        f.original_name,
        f.mime_type,
        f.file_size_bytes,
        f.status,
        f.created_at,
        f.updated_at,
        bm25(files_fts) as relevance
      FROM files_fts
      JOIN files f ON files_fts.id = f.id
      WHERE files_fts MATCH ?
        AND ${projectFilter}
        AND f.deleted_at IS NULL
        ${mimeFilter}
      ORDER BY relevance
      LIMIT ?
    `
    )
    .all(...params) as Array<{
      id: string;
      project_id: string;
      folder_id: string | null;
      name: string;
      original_name: string;
      mime_type: string;
      file_size_bytes: number;
      status: string;
      created_at: number;
      updated_at: number;
      relevance: number;
    }>;

  // Format results
  const data = results.map((row) => ({
    type: RESOURCE_TYPES.FILE,
    id: row.id,
    attributes: {
      name: row.name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      status: row.status,
      createdAt: timestampToISO(row.created_at),
      updatedAt: timestampToISO(row.updated_at),
    },
    relationships: {
      project: {
        type: RESOURCE_TYPES.PROJECT,
        id: row.project_id,
      },
      folder: row.folder_id
        ? {
            type: RESOURCE_TYPES.FOLDER,
            id: row.folder_id,
          }
        : null,
    },
    meta: {
      relevance: row.relevance,
    },
  }));

  return c.json({
    data,
    meta: {
      total: results.length,
      query,
      has_more: results.length === limit,
    },
  });
});

/**
 * GET /v4/search/suggestions - Get search suggestions (typeahead)
 *
 * Query params:
 * - q: Partial query (min 2 chars)
 * - limit: Max suggestions (default 10)
 */
app.get("/suggestions", async (c) => {
  const session = requireAuth(c);
  const query = c.req.query("q")?.trim();
  const limit = Math.min(parseLimit(c.req.query("limit") || "10"), 20);

  // Validate query
  if (!query || query.length < MIN_QUERY_LENGTH) {
    return c.json({ data: [] });
  }

  // Get all projects the user has access to
  const accessibleProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(eq(workspaces.accountId, session.currentAccountId));

  if (accessibleProjects.length === 0) {
    return c.json({ data: [] });
  }

  const projectIds = accessibleProjects.map((p) => p.id);

  // Escape query for FTS5 prefix search
  const escapedQuery = query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word) => `${word}*`)
    .join(" ");

  // Get distinct file name suggestions
  const results = sqlite
    .prepare(
      `
      SELECT DISTINCT f.name, f.mime_type
      FROM files_fts
      JOIN files f ON files_fts.id = f.id
      WHERE files_fts MATCH ?
        AND f.project_id IN (${projectIds.map(() => "?").join(",")})
        AND f.deleted_at IS NULL
      ORDER BY bm25(files_fts)
      LIMIT ?
    `
    )
    .all(escapedQuery, ...projectIds, limit) as Array<{
      name: string;
      mime_type: string;
    }>;

  const suggestions = results.map((row) => ({
    name: row.name,
    type: row.mime_type.split("/")[0] || "file",
  }));

  return c.json({ data: suggestions });
});

export default app;
