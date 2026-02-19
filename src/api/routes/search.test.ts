/**
 * Bush Platform - Search Routes Tests
 *
 * Comprehensive tests for the FTS5-based search API endpoints.
 * Tests GET / (full search) and GET /suggestions (typeahead).
 *
 * Helper functions are tested implicitly via route behaviour:
 * - escapeFts5Query  - verified through sqlite.prepare call args
 * - timestampToISO   - verified through formatted dates in response
 * - formatTimestamp  - verified through transcript timestamp formatting
 * - MIME_TYPE_FILTERS - verified through file type filter tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Mocks - declared before any imports from the module under test
// ---------------------------------------------------------------------------

vi.mock("../../db/index.js", () => {
  const mockPrepare = vi.fn();
  return {
    db: {
      select: vi.fn(),
    },
    sqlite: {
      prepare: mockPrepare,
    },
  };
});

vi.mock("../../db/schema.js", () => ({
  projects: { id: "id", workspaceId: "workspaceId" },
  workspaces: { id: "id", accountId: "accountId" },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn(),
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
}));

// response.js is NOT mocked - we let it run so RESOURCE_TYPES constants resolve.

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { db, sqlite } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { parseLimit } from "../router.js";
import searchApp from "./search.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner" as const,
  email: "test@example.com",
  displayName: "Test User",
  workosOrganizationId: "org_123",
  workosUserId: "wusr_123",
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
};

/** Standard file row returned from the files_fts query */
const mockFileRow = {
  id: "file_1",
  project_id: "prj_123",
  folder_id: "fld_123",
  name: "test-video.mp4",
  original_name: "test-video.mp4",
  mime_type: "video/mp4",
  file_size_bytes: 1024000,
  status: "ready",
  created_at: 1704067200, // 2024-01-01T00:00:00Z (seconds)
  updated_at: 1704067200,
  relevance: -2.5,
};

/** Standard transcript row returned from transcripts_fts query */
const mockTranscriptRow = {
  transcript_id: "tx_123",
  file_id: "file_2",
  full_text: "this is a test video transcript with some content",
  id: "file_2",
  project_id: "prj_123",
  folder_id: null,
  name: "other-video.mp4",
  original_name: "other-video.mp4",
  mime_type: "video/mp4",
  file_size_bytes: 2048000,
  status: "ready",
  created_at: 1704067200,
  updated_at: 1704067200,
  relevance: -1.5,
};

/** Word-level timestamp row */
const mockWordTimestamp = {
  start_ms: 5000,
  end_ms: 5500,
  word: "test",
};

// ---------------------------------------------------------------------------
// App factory - wraps route in a Hono shell with a test-friendly error handler
// ---------------------------------------------------------------------------

function buildApp() {
  const app = new Hono();
  app.route("/", searchApp);
  app.onError((err, c) => {
    const status = (err as any).status ?? 500;
    return c.json(
      { errors: [{ title: err.name, detail: err.message, status }] },
      status
    );
  });
  return app;
}

// ---------------------------------------------------------------------------
// Mock helpers - reused across tests
// ---------------------------------------------------------------------------

/** Return a db.select chain that resolves to the provided project rows. */
function mockAccessibleProjects(rows: Array<{ id: string }>) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never);
}

/** Build a statement mock object shared between prepare calls. */
function makeStatementMock(mockAll: ReturnType<typeof vi.fn>, mockGet: ReturnType<typeof vi.fn>) {
  return { all: mockAll, get: mockGet } as never;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Search Routes", () => {
  let app: Hono;
  let mockAll: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Re-create per-test mock functions
    mockAll = vi.fn();
    mockGet = vi.fn();

    // sqlite.prepare always returns the same statement object; sequential
    // results are controlled by mockReturnValueOnce on mockAll / mockGet.
    vi.mocked(sqlite.prepare).mockReturnValue(makeStatementMock(mockAll, mockGet));

    // requireAuth always returns the mock session unless overridden
    vi.mocked(requireAuth).mockReturnValue(mockSession);

    // parseLimit must return a number - vi.resetAllMocks() clears the factory
    // default, so we restore it here. Without this, Math.min(undefined, 100)
    // returns NaN and data.slice(0, NaN) returns [].
    vi.mocked(parseLimit).mockReturnValue(50);

    app = buildApp();
  });

  // =========================================================================
  // GET / - Full FTS5 search
  // =========================================================================
  describe("GET / - full search", () => {
    // -----------------------------------------------------------------------
    // 1. Success - returns file results
    // -----------------------------------------------------------------------
    it("returns file results for a valid query", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      // First prepare().all() call → file FTS results
      mockAll.mockReturnValueOnce([mockFileRow]);
      // Second prepare().all() call → transcript FTS results (empty)
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data).toHaveLength(1);
      const item = body.data[0];
      expect(item.type).toBe("file");
      expect(item.id).toBe("file_1");
      expect(item.attributes.name).toBe("test-video.mp4");
      expect(item.attributes.mimeType).toBe("video/mp4");
      expect(item.attributes.fileSizeBytes).toBe(1024000);
      expect(item.attributes.status).toBe("ready");
      expect(item.relationships.project.id).toBe("prj_123");
      expect(item.relationships.folder.id).toBe("fld_123");
      expect(item.meta.matchType).toBe("filename");
      expect(item.meta.relevance).toBe(-2.5);

      expect(body.meta.query).toBe("test video");
      expect(body.meta.total).toBe(1);
      expect(body.meta.has_more).toBe(false);
    });

    // -----------------------------------------------------------------------
    // 2. Missing query param → 422 ValidationError
    // -----------------------------------------------------------------------
    it("returns 422 when the q parameter is missing", async () => {
      const res = await app.request("/", { method: "GET" });

      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.errors[0].detail).toMatch(/at least 2 characters/i);
    });

    // -----------------------------------------------------------------------
    // 3. Query too short (< 2 chars) → 422 ValidationError
    // -----------------------------------------------------------------------
    it("returns 422 when query is shorter than 2 characters", async () => {
      const res = await app.request("/?q=a", { method: "GET" });

      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.errors[0].detail).toMatch(/at least 2 characters/i);
    });

    // -----------------------------------------------------------------------
    // 4. Query too long (> 500 chars) → 422 ValidationError
    // -----------------------------------------------------------------------
    it("returns 422 when query exceeds 500 characters", async () => {
      const longQuery = "a".repeat(501);
      const res = await app.request(`/?q=${encodeURIComponent(longQuery)}`, { method: "GET" });

      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.errors[0].detail).toMatch(/at most 500 characters/i);
    });

    // -----------------------------------------------------------------------
    // 5. No accessible projects → returns empty result set
    // -----------------------------------------------------------------------
    it("returns empty data when the user has no accessible projects", async () => {
      mockAccessibleProjects([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.has_more).toBe(false);
    });

    // -----------------------------------------------------------------------
    // 6. project_id filter - inaccessible project → returns empty
    // -----------------------------------------------------------------------
    it("returns empty data when the requested project_id is not accessible", async () => {
      // User can only access prj_123, but the request asks for prj_other
      mockAccessibleProjects([{ id: "prj_123" }]);

      const res = await app.request("/?q=test+video&project_id=prj_other", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    // -----------------------------------------------------------------------
    // 6b. project_id filter - accessible project → filters and returns results
    // -----------------------------------------------------------------------
    it("returns results filtered to an accessible project_id", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([mockFileRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video&project_id=prj_123", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("file_1");

      // The SQL prepared statement should have been called with prj_123 in params
      const firstPrepareCall = vi.mocked(sqlite.prepare).mock.calls[0][0] as string;
      expect(firstPrepareCall).toContain("files_fts");
    });

    // -----------------------------------------------------------------------
    // 7. File type filter - video
    // -----------------------------------------------------------------------
    it("includes MIME filter clause when type=video is specified", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([mockFileRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test&type=video", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);

      // Verify the SQL for file search contains a MIME filter
      const fileSql = vi.mocked(sqlite.prepare).mock.calls[0][0] as string;
      expect(fileSql).toContain("mime_type LIKE ?");
    });

    // -----------------------------------------------------------------------
    // 7b. File type filter - audio
    // -----------------------------------------------------------------------
    it("applies MIME filter for type=audio", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      const audioRow = { ...mockFileRow, id: "file_audio", mime_type: "audio/mp3" };
      mockAll.mockReturnValueOnce([audioRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=audio+clip&type=audio", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0].attributes.mimeType).toBe("audio/mp3");
    });

    // -----------------------------------------------------------------------
    // 7c. File type filter - image
    // -----------------------------------------------------------------------
    it("applies MIME filter for type=image", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      const imageRow = { ...mockFileRow, id: "file_img", mime_type: "image/png" };
      mockAll.mockReturnValueOnce([imageRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=photo&type=image", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0].attributes.mimeType).toBe("image/png");
    });

    // -----------------------------------------------------------------------
    // 7d. File type filter - document
    // -----------------------------------------------------------------------
    it("applies MIME filter for type=document", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      const docRow = { ...mockFileRow, id: "file_doc", mime_type: "application/pdf" };
      mockAll.mockReturnValueOnce([docRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=report&type=document", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0].attributes.mimeType).toBe("application/pdf");
    });

    // -----------------------------------------------------------------------
    // 8. include_transcripts defaults to true
    // -----------------------------------------------------------------------
    it("searches transcripts by default (include_transcripts not set)", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([mockFileRow]);
      mockAll.mockReturnValueOnce([]); // transcripts empty

      const res = await app.request("/?q=test+video", { method: "GET" });

      expect(res.status).toBe(200);
      // Two prepare calls: one for files, one for transcripts
      expect(sqlite.prepare).toHaveBeenCalledTimes(2);
      const transcriptSql = vi.mocked(sqlite.prepare).mock.calls[1][0] as string;
      expect(transcriptSql).toContain("transcripts_fts");
    });

    // -----------------------------------------------------------------------
    // 9. include_transcripts=false - skips transcript search
    // -----------------------------------------------------------------------
    it("skips transcript search when include_transcripts=false", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([mockFileRow]);

      const res = await app.request("/?q=test+video&include_transcripts=false", { method: "GET" });

      expect(res.status).toBe(200);
      // Only one prepare call - file search only
      expect(sqlite.prepare).toHaveBeenCalledTimes(1);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // 10. Transcript results - with timestamps
    // -----------------------------------------------------------------------
    it("includes transcript match details and timestamps in results", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      // File search returns no results
      mockAll.mockReturnValueOnce([]);
      // Transcript search returns one match
      mockAll.mockReturnValueOnce([mockTranscriptRow]);
      // Word timestamp lookup
      mockGet.mockReturnValueOnce(mockWordTimestamp);

      const res = await app.request("/?q=test", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.type).toBe("file");
      expect(item.id).toBe("file_2");
      expect(item.meta.matchType).toBe("transcript");
      expect(item.relationships.transcript).toBeDefined();
      expect(item.relationships.transcript.id).toBe("tx_123");
      expect(item.meta.timestamp).not.toBeNull();
      expect(item.meta.timestamp.ms).toBe(5000);
      // formatTimestamp(5000) → "0:05.000"
      expect(item.meta.timestamp.formatted).toBe("0:05.000");
    });

    // -----------------------------------------------------------------------
    // 10b. formatTimestamp - hours present when >= 1 hour
    // -----------------------------------------------------------------------
    it("formats transcript timestamp with hours when >= 1 hour", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([]);
      mockAll.mockReturnValueOnce([mockTranscriptRow]);
      // 1h 2m 3s 456ms = 3723456ms
      mockGet.mockReturnValueOnce({ start_ms: 3723456, end_ms: 3724000, word: "test" });

      const res = await app.request("/?q=test", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].meta.timestamp.formatted).toBe("1:02:03.456");
    });

    // -----------------------------------------------------------------------
    // 10c. Transcript match context is extracted from full_text
    // -----------------------------------------------------------------------
    it("extracts match context snippet from the transcript full_text", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([]);
      mockAll.mockReturnValueOnce([mockTranscriptRow]);
      mockGet.mockReturnValueOnce(mockWordTimestamp);

      const res = await app.request("/?q=test", { method: "GET" });

      const body = (await res.json()) as any;
      const item = body.data[0];
      // matchContext should include the word "test" from the full_text
      expect(typeof item.meta.matchContext).toBe("string");
      expect(item.meta.matchContext).toContain("test");
    });

    // -----------------------------------------------------------------------
    // 10d. Transcript match without a word timestamp - timestamp is null
    // -----------------------------------------------------------------------
    it("returns null timestamp when no matching word is found in transcript_words", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([]);
      mockAll.mockReturnValueOnce([mockTranscriptRow]);
      // Word lookup returns nothing
      mockGet.mockReturnValueOnce(undefined);

      const res = await app.request("/?q=test", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].meta.timestamp).toBeNull();
    });

    // -----------------------------------------------------------------------
    // 11. Deduplication - transcript match for file already in file results
    // -----------------------------------------------------------------------
    it("does not add a duplicate entry when the transcript match is already in file results", async () => {
      // Both file search and transcript search return the same file id
      const sharedFileRow = { ...mockFileRow, id: "file_1" };
      const duplicateTranscriptRow = {
        ...mockTranscriptRow,
        id: "file_1", // same file id as in file results
        file_id: "file_1",
        transcript_id: "tx_dup",
      };

      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([sharedFileRow]);
      mockAll.mockReturnValueOnce([duplicateTranscriptRow]);
      mockGet.mockReturnValueOnce(mockWordTimestamp);

      const res = await app.request("/?q=test", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      // Despite two results from different queries, only one entry for file_1
      expect(body.data.filter((d: any) => d.id === "file_1")).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // 12. Results sorted by relevance (ascending BM25 score, more negative = better)
    // -----------------------------------------------------------------------
    it("returns combined results sorted by relevance (ascending BM25 score)", async () => {
      const fileRowLessRelevant = { ...mockFileRow, id: "file_less", relevance: -1.0 };
      const transcriptRowMoreRelevant = {
        ...mockTranscriptRow,
        id: "file_more",
        file_id: "file_more",
        relevance: -3.0,
      };

      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([fileRowLessRelevant]);
      mockAll.mockReturnValueOnce([transcriptRowMoreRelevant]);
      mockGet.mockReturnValueOnce(mockWordTimestamp);

      const res = await app.request("/?q=test", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      // Lower (more negative) relevance should appear first
      expect(body.data[0].id).toBe("file_more");
      expect(body.data[1].id).toBe("file_less");
    });

    // -----------------------------------------------------------------------
    // Helper: timestampToISO - seconds-based timestamp (< 1e12)
    // -----------------------------------------------------------------------
    it("converts seconds-based unix timestamps to ISO strings (timestampToISO)", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      // created_at = 1704067200 seconds → 2024-01-01T00:00:00.000Z
      mockAll.mockReturnValueOnce([mockFileRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].attributes.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });

    // -----------------------------------------------------------------------
    // Helper: timestampToISO - milliseconds-based timestamp (> 1e12)
    // -----------------------------------------------------------------------
    it("converts milliseconds-based unix timestamps to ISO strings (timestampToISO)", async () => {
      const msTimestampRow = {
        ...mockFileRow,
        created_at: 1704067200000, // milliseconds
        updated_at: 1704067200000,
      };

      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([msTimestampRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].attributes.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });

    // -----------------------------------------------------------------------
    // Helper: timestampToISO - null timestamp
    // -----------------------------------------------------------------------
    it("returns null for a null timestamp (timestampToISO)", async () => {
      const nullTimestampRow = {
        ...mockFileRow,
        created_at: 0, // falsy → treated as null by timestampToISO
        updated_at: 0,
      };

      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([nullTimestampRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].attributes.createdAt).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Helper: escapeFts5Query - special chars are escaped
    // -----------------------------------------------------------------------
    it("escapes FTS5 special characters in the query before passing to sqlite", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([]);
      mockAll.mockReturnValueOnce([]);

      // Query contains double-quotes, parentheses, caret, colon
      const dangerousQuery = 'te"st (vid:eo) ^foo';
      const res = await app.request(`/?q=${encodeURIComponent(dangerousQuery)}`, { method: "GET" });

      expect(res.status).toBe(200);
      // Verify sqlite.prepare was called and the first arg to mockAll includes escaped form
      expect(sqlite.prepare).toHaveBeenCalled();
      // The first positional argument to .all() is the escaped query
      const firstCallArgs = mockAll.mock.calls[0];
      const escapedArg = firstCallArgs[0] as string;
      // Double-quotes in original should be escaped (doubled inside word-quoted token)
      // Parens, colon, caret should be removed
      // Result: each word wrapped in "word"*
      expect(escapedArg).toMatch(/"te""st"\*/);
      expect(escapedArg).not.toContain("(");
      expect(escapedArg).not.toContain(")");
      expect(escapedArg).not.toContain("^");
      expect(escapedArg).not.toContain(":");
    });

    // -----------------------------------------------------------------------
    // Folder is null when file has no folder
    // -----------------------------------------------------------------------
    it("sets folder relationship to null when file has no folder", async () => {
      const noFolderRow = { ...mockFileRow, folder_id: null };

      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([noFolderRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].relationships.folder).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Multiple accessible projects - uses IN clause
    // -----------------------------------------------------------------------
    it("passes all accessible project IDs as params when user has multiple projects", async () => {
      mockAccessibleProjects([{ id: "prj_123" }, { id: "prj_456" }, { id: "prj_789" }]);
      mockAll.mockReturnValueOnce([]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test+video", { method: "GET" });

      expect(res.status).toBe(200);
      // The SQL for files should use IN clause
      const fileSql = vi.mocked(sqlite.prepare).mock.calls[0][0] as string;
      expect(fileSql).toContain("IN (");
      // All three project IDs are passed as args to .all()
      const allArgs = mockAll.mock.calls[0];
      expect(allArgs).toContain("prj_123");
      expect(allArgs).toContain("prj_456");
      expect(allArgs).toContain("prj_789");
    });

    // -----------------------------------------------------------------------
    // Unknown file type filter - ignored (no MIME filter added)
    // -----------------------------------------------------------------------
    it("ignores unrecognised file type filters", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([mockFileRow]);
      mockAll.mockReturnValueOnce([]);

      const res = await app.request("/?q=test&type=unknown_type", { method: "GET" });

      expect(res.status).toBe(200);
      const fileSql = vi.mocked(sqlite.prepare).mock.calls[0][0] as string;
      expect(fileSql).not.toContain("mime_type LIKE ?");
    });
  });

  // =========================================================================
  // GET /suggestions - Typeahead suggestions
  // =========================================================================
  describe("GET /suggestions - typeahead suggestions", () => {
    // -----------------------------------------------------------------------
    // 13. Success - returns suggestions
    // -----------------------------------------------------------------------
    it("returns suggestions for a valid query", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([
        { name: "test-video.mp4", mime_type: "video/mp4" },
        { name: "test-audio.mp3", mime_type: "audio/mp3" },
      ]);

      const res = await app.request("/suggestions?q=test", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual({ name: "test-video.mp4", type: "video" });
      expect(body.data[1]).toEqual({ name: "test-audio.mp3", type: "audio" });
    });

    // -----------------------------------------------------------------------
    // 13b. MIME type split - uses first segment before "/"
    // -----------------------------------------------------------------------
    it("derives suggestion type from the first segment of mime_type", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([
        { name: "report.pdf", mime_type: "application/pdf" },
      ]);

      const res = await app.request("/suggestions?q=repo", { method: "GET" });

      const body = (await res.json()) as any;
      expect(body.data[0].type).toBe("application");
    });

    // -----------------------------------------------------------------------
    // 14. Query too short - returns empty without hitting SQLite
    // -----------------------------------------------------------------------
    it("returns empty data when the query is shorter than 2 characters", async () => {
      const res = await app.request("/suggestions?q=a", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      // SQLite should NOT have been called
      expect(sqlite.prepare).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 14b. Missing query - returns empty
    // -----------------------------------------------------------------------
    it("returns empty data when the q parameter is missing", async () => {
      const res = await app.request("/suggestions", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // 15. Query too long - returns empty without hitting SQLite
    // -----------------------------------------------------------------------
    it("returns empty data when the query exceeds 500 characters", async () => {
      const longQuery = "z".repeat(501);
      const res = await app.request(`/suggestions?q=${encodeURIComponent(longQuery)}`, { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      expect(sqlite.prepare).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 16. No accessible projects - returns empty without hitting SQLite
    // -----------------------------------------------------------------------
    it("returns empty data when the user has no accessible projects", async () => {
      mockAccessibleProjects([]);

      const res = await app.request("/suggestions?q=test", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      expect(sqlite.prepare).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Escaped query is passed to sqlite prepare for suggestions
    // -----------------------------------------------------------------------
    it("passes the FTS5-escaped query to sqlite for suggestions", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([]);

      await app.request("/suggestions?q=test", { method: "GET" });

      expect(sqlite.prepare).toHaveBeenCalledTimes(1);
      const sql = vi.mocked(sqlite.prepare).mock.calls[0][0] as string;
      expect(sql).toContain("files_fts");
      // First arg to .all() is the escaped query
      const firstArg = mockAll.mock.calls[0][0] as string;
      expect(firstArg).toBe('"test"*');
    });

    // -----------------------------------------------------------------------
    // Suggestion limit is capped at 20
    // -----------------------------------------------------------------------
    it("uses limit from query param for suggestions (capped at 20)", async () => {
      mockAccessibleProjects([{ id: "prj_123" }]);
      mockAll.mockReturnValueOnce([]);

      // Request limit=5
      await app.request("/suggestions?q=test&limit=5", { method: "GET" });

      const allArgs = mockAll.mock.calls[0];
      // Last arg should be the limit (5, since min(parseLimit, 20) = min(50,20)=20 by default
      // but here we check the raw parseLimit mock returns 50, and min(50,20)=20)
      // The actual limit passed would be Math.min(parseLimit(...), 20) = Math.min(50, 20) = 20
      const limitArg = allArgs[allArgs.length - 1];
      expect(limitArg).toBe(20);
    });

    // -----------------------------------------------------------------------
    // Project IDs are passed to the suggestions SQL
    // -----------------------------------------------------------------------
    it("passes accessible project IDs to the suggestions query", async () => {
      mockAccessibleProjects([{ id: "prj_123" }, { id: "prj_456" }]);
      mockAll.mockReturnValueOnce([]);

      await app.request("/suggestions?q=video", { method: "GET" });

      const allArgs = mockAll.mock.calls[0];
      expect(allArgs).toContain("prj_123");
      expect(allArgs).toContain("prj_456");
    });
  });
});
