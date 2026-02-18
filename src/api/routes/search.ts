/**
 * Bush Platform - Search Routes
 *
 * API routes for file search using FTS5.
 * Reference: specs/00-atomic-features.md Section 12
 * Reference: specs/06-transcription-and-captions.md Section 3.6
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
 * Maximum query string length to prevent abuse
 */
const MAX_QUERY_LENGTH = 500;

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
 * Format milliseconds to HH:MM:SS.mmm timestamp
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

/**
 * Escape user input for safe use in FTS5 queries.
 * FTS5 has special characters that need to be handled:
 * - Double quotes (") - used for phrase queries
 * - Parentheses () - used for grouping
 * - Asterisk (*) - used for prefix queries
 * - Caret (^) - used for column-specific queries
 * - Colon (:) - used for column-specific queries
 * - Hyphen (-) at start of word - NOT operator
 * - Plus (+) at start of word - AND (implicit)
 *
 * We escape by wrapping the query in double quotes and escaping
 * any internal double quotes.
 */
function escapeFts5Query(query: string): string {
  // Remove or escape dangerous characters
  const escaped = query
    // Escape double quotes by doubling them
    .replace(/"/g, '""')
    // Remove parentheses (could break query structure)
    .replace(/[()]/g, "")
    // Remove caret and colon (column-specific syntax)
    .replace(/[\^:]/g, "")
    // Trim whitespace
    .trim();

  // Split into words and handle each
  const words = escaped.split(/\s+/).filter((w) => w.length > 0);

  // Wrap each word in quotes for safe literal matching and add prefix operator
  // This ensures special FTS5 characters are treated as literals
  return words.map((word) => `"${word}"*`).join(" ");
}

/**
 * GET /v4/search - Search files and transcripts across accessible projects
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 * - project_id: Filter to specific project (optional)
 * - type: Filter by file type (video, audio, image, document) (optional)
 * - include_transcripts: Include transcript search results (default: true)
 * - limit: Max results (default 50, max 100)
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const query = c.req.query("q")?.trim();
  const projectId = c.req.query("project_id");
  const fileType = c.req.query("type");
  const includeTranscripts = c.req.query("include_transcripts") !== "false";
  const limit = Math.min(parseLimit(c.req.query("limit")), MAX_RESULTS);

  // Validate query
  if (!query || query.length < MIN_QUERY_LENGTH) {
    throw new ValidationError(
      `Query must be at least ${MIN_QUERY_LENGTH} characters`,
      { pointer: "/query" }
    );
  }

  // Limit query length to prevent abuse
  if (query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(
      `Query must be at most ${MAX_QUERY_LENGTH} characters`,
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

  // Escape special FTS5 characters in query securely
  const escapedQuery = escapeFts5Query(query);

  // Build params array for file search
  const fileParams: (string | number)[] = [escapedQuery];
  if (projectId) {
    fileParams.push(projectId);
  } else {
    fileParams.push(...projectIds);
  }
  fileParams.push(...mimeTypeValues);
  fileParams.push(limit);

  // Execute FTS5 search for files with BM25 ranking
  const fileResults = sqlite
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
    .all(...fileParams) as Array<{
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

  // Format file results
  const data: Array<{
    type: string;
    id: string;
    attributes: Record<string, unknown>;
    relationships: Record<string, unknown>;
    meta: Record<string, unknown>;
  }> = fileResults.map((row) => ({
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
      matchType: "filename",
    },
  }));

  // Search transcripts if enabled
  if (includeTranscripts) {
    const transcriptLimit = Math.max(10, Math.floor(limit / 2));

    // Build params for transcript search
    const transcriptParams: (string | number)[] = [escapedQuery];
    if (projectId) {
      transcriptParams.push(projectId);
    } else {
      transcriptParams.push(...projectIds);
    }
    if (fileType && fileType in MIME_TYPE_FILTERS) {
      transcriptParams.push(...mimeTypeValues);
    }
    transcriptParams.push(transcriptLimit);

    // Build MIME filter for transcripts
    let transcriptMimeFilter = "";
    if (fileType && fileType in MIME_TYPE_FILTERS) {
      const types = MIME_TYPE_FILTERS[fileType];
      const conditions = types.map(() => "f.mime_type LIKE ?").join(" OR ");
      transcriptMimeFilter = `AND (${conditions})`;
    }

    // Search transcripts FTS
    const transcriptResults = sqlite
      .prepare(
        `
        SELECT
          t.id as transcript_id,
          t.file_id,
          t.full_text,
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
          bm25(transcripts_fts) as relevance
        FROM transcripts_fts
        JOIN transcripts t ON transcripts_fts.id = t.id
        JOIN files f ON t.file_id = f.id
        WHERE transcripts_fts MATCH ?
          AND ${projectFilter}
          AND f.deleted_at IS NULL
          AND t.status = 'completed'
          ${transcriptMimeFilter}
        ORDER BY relevance
        LIMIT ?
      `
      )
      .all(...transcriptParams) as Array<{
        transcript_id: string;
        file_id: string;
        full_text: string;
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

    // For each transcript match, find the first matching word for timestamp
    for (const row of transcriptResults) {
      // Find the first matching word in transcript_words for timestamp
      const matchingWord = sqlite
        .prepare(
          `
          SELECT start_ms, end_ms, word
          FROM transcript_words
          WHERE transcript_id = ?
            AND word LIKE ?
          ORDER BY position
          LIMIT 1
        `
        )
        .get(row.transcript_id, `%${query.split(/\s+/)[0]}%`) as {
        start_ms: number;
        end_ms: number;
        word: string;
      } | undefined;

      // Extract context around the match
      let matchContext = "";
      if (row.full_text) {
        const lowerText = row.full_text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const matchIndex = lowerText.indexOf(lowerQuery.split(/\s+/)[0]);
        if (matchIndex !== -1) {
          const contextStart = Math.max(0, matchIndex - 50);
          const contextEnd = Math.min(row.full_text.length, matchIndex + query.length + 50);
          matchContext = (contextStart > 0 ? "..." : "") +
            row.full_text.slice(contextStart, contextEnd) +
            (contextEnd < row.full_text.length ? "..." : "");
        }
      }

      // Only add if not already in file results
      if (!data.find((r) => r.id === row.id)) {
        data.push({
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
            transcript: {
              type: "transcript",
              id: row.transcript_id,
            },
          },
          meta: {
            relevance: row.relevance,
            matchType: "transcript",
            timestamp: matchingWord ? {
              ms: matchingWord.start_ms,
              formatted: formatTimestamp(matchingWord.start_ms),
            } : null,
            matchContext,
          },
        });
      }
    }

    // Sort combined results by relevance
    data.sort((a, b) => ((a.meta.relevance as number) || 0) - ((b.meta.relevance as number) || 0));
  }

  // Limit final results
  const limitedData = data.slice(0, limit);

  return c.json({
    data: limitedData,
    meta: {
      total: data.length,
      query,
      has_more: data.length > limit,
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

  // Limit query length to prevent abuse
  if (query.length > MAX_QUERY_LENGTH) {
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

  // Escape query for FTS5 prefix search securely
  const escapedQuery = escapeFts5Query(query);

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
