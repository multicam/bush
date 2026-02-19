/**
 * Bush Platform - Comments Routes Tests
 *
 * Comprehensive unit tests for comment API routes.
 * Covers file comments, version stack comments, replies, update, delete, complete.
 */

// ---------------------------------------------------------------------------
// vi.mock() calls MUST come before any imports (vitest hoists them)
// ---------------------------------------------------------------------------

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyProjectAccess: vi.fn(),
}));

vi.mock("../../db/schema.js", () => ({
  comments: {
    id: "id",
    fileId: "fileId",
    versionStackId: "versionStackId",
    userId: "userId",
    parentId: "parentId",
    text: "text",
    timestamp: "timestamp",
    duration: "duration",
    page: "page",
    annotation: "annotation",
    isInternal: "isInternal",
    completedAt: "completedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  files: {
    id: "id",
    projectId: "projectId",
    folderId: "folderId",
    name: "name",
    mimeType: "mimeType",
    status: "status",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  users: {
    id: "id",
    email: "email",
    name: "name",
    avatarUrl: "avatarUrl",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  versionStacks: {
    id: "id",
    projectId: "projectId",
    name: "name",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("cmt_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field: unknown, val: unknown) => ({ type: "eq", field, val })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((field: unknown) => ({ type: "desc", field })),
  lt: vi.fn((field: unknown, val: unknown) => ({ type: "lt", field, val })),
  sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ type: "sql", strings, values })),
  isNull: vi.fn((field: unknown) => ({ type: "isNull", field })),
  inArray: vi.fn((field: unknown, vals: unknown) => ({ type: "inArray", field, vals })),
}));

vi.mock("../../realtime/index.js", () => ({
  emitCommentEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app, { getVersionStackComments, createVersionStackComment } from "./comments.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";
import { emitCommentEvent } from "../../realtime/index.js";

// ---------------------------------------------------------------------------
// Mount the sub-app under a parent with :fileId param so c.req.param("fileId")
// works correctly for GET / and POST / routes.
// ---------------------------------------------------------------------------
const testApp = new Hono();
testApp.route("/files/:fileId/comments", app);

const req = (path: string, init?: RequestInit) => {
  const suffix = path === "/" ? "" : path;
  return testApp.request(`/files/file_001/comments${suffix}`, init);
};

// Direct app requests for routes that don't need the fileId param (/:id routes)
const reqDirect = (path: string, init?: RequestInit) =>
  testApp.request(`/files/file_001/comments${path}`, init);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner" as const,
  sessionId: "ses_111",
};

const FILE_ROW = {
  id: "file_001",
  projectId: "prj_001",
  folderId: "fld_001",
  name: "test.mp4",
  mimeType: "video/mp4",
  status: "active",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const USER_ROW = {
  id: "usr_abc",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const COMMENT_ROW = {
  id: "cmt_001",
  fileId: "file_001",
  versionStackId: null,
  userId: "usr_abc",
  parentId: null,
  text: "Great work on this!",
  timestamp: null,
  duration: null,
  page: null,
  annotation: null,
  isInternal: false,
  completedAt: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const ACCESS_ROW = {
  project: { id: "prj_001" },
  permission: "full_access",
};

const VERSION_STACK_ROW = {
  id: "stack_001",
  projectId: "prj_001",
  name: "Version 1",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// DB chain helpers
// ---------------------------------------------------------------------------

/** Mock a single db.select() call that goes through .from().where().limit() */
function mockSelectSingle(row: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
  } as never);
}

/** Mock a single db.select() call that goes through .from().innerJoin().where().limit() */
function mockSelectJoinSingle(row: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    }),
  } as never);
}

/** Mock a single db.select() call that goes through .from().innerJoin().leftJoin().where().limit() */
function mockSelectJoinLeftJoinSingle(row: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(row ? [row] : []),
          }),
        }),
      }),
    }),
  } as never);
}

/** Mock a single db.select() call through .from().leftJoin().where().limit() */
function mockSelectLeftJoinSingle(row: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    }),
  } as never);
}

/** Mock a list select: .from().innerJoin().where().orderBy().limit() */
function mockSelectJoinList(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  } as never);
}

/** Mock insert chain: .values() */
function mockInsert() {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

/** Mock update chain: .set().where() */
function mockUpdate() {
  vi.mocked(db.update).mockReturnValue({
    set: () => ({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

/** Mock delete chain: .where() */
function mockDelete() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Comments Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("cmt_test123");
  });

  // -------------------------------------------------------------------------
  // GET / - List comments on a file
  // -------------------------------------------------------------------------
  describe("GET / - list file comments", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      // Select 1: file lookup
      mockSelectSingle(FILE_ROW);
      // verifyProjectAccess
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      // Select 2: comments list with inner join
      const commentResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinList([commentResult]);

      const res = await req("/");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/");

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await req("/");

      expect(res.status).toBe(500);
    });

    it("calls requireAuth", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      const commentResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinList([commentResult]);

      await req("/");

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("calls verifyProjectAccess with file projectId and accountId", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      await req("/");

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        FILE_ROW.projectId,
        SESSION.currentAccountId
      );
    });

    it("returns empty collection when no comments exist", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      const res = await req("/");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("accepts cursor query param without error", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      const cursor = Buffer.from(
        JSON.stringify({ createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await testApp.request(`/files/file_001/comments?cursor=${cursor}`, {
        method: "GET",
      });

      expect(res.status).toBe(200);
    });

    it("accepts include_replies=false query param", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      const res = await testApp.request(
        "/files/file_001/comments?include_replies=false",
        { method: "GET" }
      );

      expect(res.status).toBe(200);
    });

    it("returns meta with has_more false when items equal limit", async () => {
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      const commentResult = { comment: COMMENT_ROW, user: USER_ROW };
      // Return exactly limit items (50), so has_more should be false
      const rows = Array.from({ length: 50 }, (_, i) => ({
        comment: { ...COMMENT_ROW, id: `cmt_${i}` },
        user: USER_ROW,
      }));
      mockSelectJoinList(rows);

      const res = await req("/");
      const body = await res.json();

      expect(body.meta.has_more).toBe(false);
      expect(body.meta.page_size).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create comment on file
  // -------------------------------------------------------------------------
  describe("POST / - create file comment", () => {
    beforeEach(() => {
      // Default happy path setup
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      // Fetch created comment
      const commentResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(commentResult);
    });

    it("returns 200 with newly created comment on success", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Great shot!" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("comment");
    });

    it("calls db.insert with correct values", async () => {
      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Great shot!" }),
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
      const valuesSpy = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.text).toBe("Great shot!");
      expect(callArg.userId).toBe(SESSION.userId);
      expect(callArg.fileId).toBe("file_001");
    });

    it("uses generateId to create comment ID", async () => {
      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A comment" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("comment");
    });

    it("emits comment.created realtime event", async () => {
      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A comment" }),
      });

      expect(vi.mocked(emitCommentEvent)).toHaveBeenCalledWith(
        "comment.created",
        expect.objectContaining({
          actorId: SESSION.userId,
          fileId: "file_001",
        })
      );
    });

    it("returns 500 when text is missing (ValidationError)", async () => {
      // Reset insert mock - it shouldn't be called
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text is empty string (ValidationError)", async () => {
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text exceeds 10000 characters (ValidationError)", async () => {
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(10001) }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when timestamp is negative (ValidationError)", async () => {
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Valid text", timestamp: -1 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when duration is negative (ValidationError)", async () => {
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Valid text", duration: -5 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when page is not a positive integer (ValidationError)", async () => {
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Valid text", page: 0 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when page is a float (ValidationError)", async () => {
      vi.mocked(db.insert).mockReset();

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Valid text", page: 1.5 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      // Reset and set file not found
      vi.mocked(db.select).mockReset();
      mockSelectSingle(null);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A comment" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      vi.mocked(db.select).mockReset();
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A comment" }),
      });

      expect(res.status).toBe(500);
    });

    it("validates parent_id comment when provided and parent not found", async () => {
      // Reset selects to set up: file found, then parent comment not found
      vi.mocked(db.select).mockReset();
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      // Parent comment lookup - not found
      mockSelectSingle(null);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply", parent_id: "cmt_nonexistent" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when parent comment is on different file", async () => {
      vi.mocked(db.select).mockReset();
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      // Parent comment on different file
      mockSelectSingle({ ...COMMENT_ROW, fileId: "file_OTHER" });

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply", parent_id: "cmt_001" }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts valid timestamp, duration, and page", async () => {
      vi.mocked(db.select).mockReset();
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const commentResult = { comment: { ...COMMENT_ROW, timestamp: 30, duration: 5, page: 2 }, user: USER_ROW };
      mockSelectJoinSingle(commentResult);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Annotated comment", timestamp: 30, duration: 5, page: 2 }),
      });

      expect(res.status).toBe(200);
    });

    it("sets is_internal flag when provided", async () => {
      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Internal note", is_internal: true }),
      });

      const valuesSpy = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.isInternal).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id - Get single comment
  // -------------------------------------------------------------------------
  describe("GET /:id - get comment by ID", () => {
    it("returns 200 with comment data on success", async () => {
      const result = { comment: COMMENT_ROW, user: USER_ROW, file: FILE_ROW };
      mockSelectJoinLeftJoinSingle(result);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const res = await reqDirect("/cmt_001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("comment");
    });

    it("returns 500 when comment is not found", async () => {
      mockSelectJoinLeftJoinSingle(null);

      const res = await reqDirect("/cmt_nonexistent");

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no access to the file's project", async () => {
      const result = { comment: COMMENT_ROW, user: USER_ROW, file: FILE_ROW };
      mockSelectJoinLeftJoinSingle(result);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await reqDirect("/cmt_001");

      expect(res.status).toBe(500);
    });

    it("verifies access through version stack when file is null", async () => {
      const commentWithoutFile = { ...COMMENT_ROW, fileId: null, versionStackId: "stack_001" };
      const result = { comment: commentWithoutFile, user: USER_ROW, file: null };
      mockSelectJoinLeftJoinSingle(result);
      // Version stack lookup
      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const res = await reqDirect("/cmt_001");

      expect(res.status).toBe(200);
    });

    it("returns 500 when comment has no file and version stack access denied", async () => {
      const commentWithoutFile = { ...COMMENT_ROW, fileId: null, versionStackId: "stack_001" };
      const result = { comment: commentWithoutFile, user: USER_ROW, file: null };
      mockSelectJoinLeftJoinSingle(result);
      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await reqDirect("/cmt_001");

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id - Update comment
  // -------------------------------------------------------------------------
  describe("PUT /:id - update comment", () => {
    it("returns 200 with updated comment on success", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      mockUpdate();
      const updatedResult = { comment: { ...COMMENT_ROW, text: "Updated text" }, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);
      vi.mocked(emitCommentEvent).mockImplementation(() => undefined as never);

      const res = await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated text" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("comment");
    });

    it("returns 500 when comment is not found", async () => {
      mockSelectLeftJoinSingle(null);

      const res = await reqDirect("/cmt_nonexistent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Won't matter" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user is not the comment owner", async () => {
      const otherUserComment = { ...COMMENT_ROW, userId: "usr_OTHER" };
      const commentResult = { comment: otherUserComment, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);

      const res = await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Trying to edit" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text is empty string", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);

      const res = await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text exceeds 10000 characters", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);

      const res = await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(10001) }),
      });

      expect(res.status).toBe(500);
    });

    it("calls db.update with correct commentId", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      mockUpdate();
      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("emits comment.updated event when file is present", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      mockUpdate();
      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated" }),
      });

      expect(vi.mocked(emitCommentEvent)).toHaveBeenCalledWith(
        "comment.updated",
        expect.objectContaining({
          actorId: SESSION.userId,
          commentId: "cmt_001",
        })
      );
    });

    it("does not emit event when file is null", async () => {
      const commentResult = { comment: { ...COMMENT_ROW, fileId: null }, file: null };
      mockSelectLeftJoinSingle(commentResult);
      mockUpdate();
      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated" }),
      });

      expect(vi.mocked(emitCommentEvent)).not.toHaveBeenCalled();
    });

    it("allows updating annotation, timestamp, duration, page, is_internal", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation: { x: 10, y: 20 },
          timestamp: 15,
          duration: 3,
          page: 2,
          is_internal: true,
        }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.annotation).toEqual({ x: 10, y: 20 });
      expect(updates.timestamp).toBe(15);
      expect(updates.duration).toBe(3);
      expect(updates.page).toBe(2);
      expect(updates.isInternal).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id - Delete comment
  // -------------------------------------------------------------------------
  describe("DELETE /:id - delete comment", () => {
    it("returns 204 No Content on successful deletion", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      mockDelete();

      const res = await reqDirect("/cmt_001", { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("returns 500 when comment is not found", async () => {
      mockSelectLeftJoinSingle(null);

      const res = await reqDirect("/cmt_nonexistent", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user is not the comment owner", async () => {
      const otherUserComment = { ...COMMENT_ROW, userId: "usr_OTHER" };
      const commentResult = { comment: otherUserComment, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);

      const res = await reqDirect("/cmt_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("calls db.delete with correct commentId", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      mockDelete();

      await reqDirect("/cmt_001", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("emits comment.deleted event when fileId and projectId are present", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      mockDelete();

      await reqDirect("/cmt_001", { method: "DELETE" });

      expect(vi.mocked(emitCommentEvent)).toHaveBeenCalledWith(
        "comment.deleted",
        expect.objectContaining({
          actorId: SESSION.userId,
          fileId: "file_001",
          commentId: "cmt_001",
        })
      );
    });

    it("does not emit event when fileId or projectId is missing", async () => {
      const commentWithoutFile = { ...COMMENT_ROW, fileId: null };
      const commentResult = { comment: commentWithoutFile, file: null };
      mockSelectLeftJoinSingle(commentResult);
      mockDelete();

      await reqDirect("/cmt_001", { method: "DELETE" });

      expect(vi.mocked(emitCommentEvent)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/replies - Reply to comment
  // -------------------------------------------------------------------------
  describe("POST /:id/replies - create reply", () => {
    it("returns 200 with reply on success", async () => {
      // Parent comment lookup
      mockSelectSingle(COMMENT_ROW);
      // File lookup for access check
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const replyResult = {
        comment: { ...COMMENT_ROW, id: "cmt_reply001", parentId: "cmt_001" },
        user: USER_ROW,
      };
      mockSelectJoinSingle(replyResult);

      const res = await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Great point!" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("comment");
    });

    it("returns 500 when parent comment is not found", async () => {
      mockSelectSingle(null);

      const res = await reqDirect("/cmt_nonexistent/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text is missing", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const res = await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text exceeds 10000 characters", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const res = await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(10001) }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found for parent comment", async () => {
      mockSelectSingle(COMMENT_ROW);
      // File lookup returns nothing
      mockSelectSingle(null);

      const res = await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access for parent comment's file", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply" }),
      });

      expect(res.status).toBe(500);
    });

    it("uses generateId to create reply ID", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const replyResult = {
        comment: { ...COMMENT_ROW, id: "cmt_test123", parentId: "cmt_001" },
        user: USER_ROW,
      };
      mockSelectJoinSingle(replyResult);

      await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("comment");
    });

    it("sets parentId in insert values", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const replyResult = {
        comment: { ...COMMENT_ROW, id: "cmt_test123", parentId: "cmt_001" },
        user: USER_ROW,
      };
      mockSelectJoinSingle(replyResult);

      await reqDirect("/cmt_001/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A reply" }),
      });

      const valuesSpy = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.parentId).toBe("cmt_001");
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id/complete - Mark comment as complete
  // -------------------------------------------------------------------------
  describe("PUT /:id/complete - mark comment complete", () => {
    it("returns 200 with updated comment when marking complete", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockUpdate();
      const updatedResult = {
        comment: { ...COMMENT_ROW, completedAt: new Date("2024-02-01T00:00:00.000Z") },
        user: USER_ROW,
      };
      mockSelectJoinSingle(updatedResult);

      const res = await reqDirect("/cmt_001/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("comment");
    });

    it("returns 200 when marking incomplete (complete: false)", async () => {
      const commentResult = {
        comment: { ...COMMENT_ROW, completedAt: new Date("2024-01-20T00:00:00.000Z") },
        file: FILE_ROW,
      };
      mockSelectLeftJoinSingle(commentResult);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockUpdate();
      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      const res = await reqDirect("/cmt_001/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: false }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when comment is not found", async () => {
      mockSelectLeftJoinSingle(null);

      const res = await reqDirect("/cmt_nonexistent/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await reqDirect("/cmt_001/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      expect(res.status).toBe(500);
    });

    it("emits comment.completed event with correct data", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockUpdate();
      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      expect(vi.mocked(emitCommentEvent)).toHaveBeenCalledWith(
        "comment.completed",
        expect.objectContaining({
          actorId: SESSION.userId,
          fileId: COMMENT_ROW.fileId,
          commentId: "cmt_001",
        })
      );
    });

    it("does not emit event when fileId is missing", async () => {
      const commentWithoutFile = { ...COMMENT_ROW, fileId: null };
      const commentResult = { comment: commentWithoutFile, file: null };
      mockSelectLeftJoinSingle(commentResult);
      // No verifyProjectAccess needed since file is null
      mockUpdate();
      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      expect(vi.mocked(emitCommentEvent)).not.toHaveBeenCalled();
    });

    it("defaults to complete=true when body has no complete field", async () => {
      const commentResult = { comment: COMMENT_ROW, file: FILE_ROW };
      mockSelectLeftJoinSingle(commentResult);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      const updatedResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(updatedResult);

      await reqDirect("/cmt_001/complete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      // When body.complete is undefined (not false), isComplete = true
      expect(updates.completedAt).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/replies - List replies to a comment
  // -------------------------------------------------------------------------
  describe("GET /:id/replies - list replies", () => {
    it("returns 200 with collection of replies on success", async () => {
      // Parent comment lookup
      mockSelectSingle(COMMENT_ROW);
      // File lookup
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      // Replies list
      const replyResult = {
        comment: { ...COMMENT_ROW, id: "cmt_reply001", parentId: "cmt_001" },
        user: USER_ROW,
      };
      mockSelectJoinList([replyResult]);

      const res = await reqDirect("/cmt_001/replies");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns 500 when parent comment is not found", async () => {
      mockSelectSingle(null);

      const res = await reqDirect("/cmt_nonexistent/replies");

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found for parent comment", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(null);

      const res = await reqDirect("/cmt_001/replies");

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await reqDirect("/cmt_001/replies");

      expect(res.status).toBe(500);
    });

    it("returns empty collection when no replies exist", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      const res = await reqDirect("/cmt_001/replies");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("accepts cursor query param", async () => {
      mockSelectSingle(COMMENT_ROW);
      mockSelectSingle(FILE_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      const cursor = Buffer.from(
        JSON.stringify({ createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await testApp.request(
        `/files/file_001/comments/cmt_001/replies?cursor=${cursor}`,
        { method: "GET" }
      );

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // getVersionStackComments (exported function)
  // -------------------------------------------------------------------------
  describe("getVersionStackComments - exported function", () => {
    it("returns 200 with collection on success", async () => {
      // Set up a minimal Hono context to test the exported function
      const stackApp = new Hono();
      stackApp.get("/version-stacks/:stackId/comments", async (c) => {
        return getVersionStackComments(c);
      });

      // Version stack lookup
      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      // Comments list
      const commentResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinList([commentResult]);

      const res = await stackApp.request("/version-stacks/stack_001/comments");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns 500 when version stack is not found", async () => {
      const stackApp = new Hono();
      stackApp.get("/version-stacks/:stackId/comments", async (c) => {
        return getVersionStackComments(c);
      });

      mockSelectSingle(null);

      const res = await stackApp.request("/version-stacks/stack_nonexistent/comments");

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      const stackApp = new Hono();
      stackApp.get("/version-stacks/:stackId/comments", async (c) => {
        return getVersionStackComments(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await stackApp.request("/version-stacks/stack_001/comments");

      expect(res.status).toBe(500);
    });

    it("calls verifyProjectAccess with stack projectId and accountId", async () => {
      const stackApp = new Hono();
      stackApp.get("/version-stacks/:stackId/comments", async (c) => {
        return getVersionStackComments(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      await stackApp.request("/version-stacks/stack_001/comments");

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        VERSION_STACK_ROW.projectId,
        SESSION.currentAccountId
      );
    });

    it("accepts cursor query param", async () => {
      const stackApp = new Hono();
      stackApp.get("/version-stacks/:stackId/comments", async (c) => {
        return getVersionStackComments(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockSelectJoinList([]);

      const cursor = Buffer.from(
        JSON.stringify({ createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await stackApp.request(
        `/version-stacks/stack_001/comments?cursor=${cursor}`
      );

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // createVersionStackComment (exported function)
  // -------------------------------------------------------------------------
  describe("createVersionStackComment - exported function", () => {
    it("returns 200 with newly created comment on success", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const commentResult = { comment: { ...COMMENT_ROW, fileId: null, versionStackId: "stack_001" }, user: USER_ROW };
      mockSelectJoinSingle(commentResult);

      const res = await stackApp.request("/version-stacks/stack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Stack comment" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("comment");
    });

    it("returns 500 when version stack is not found", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(null);

      const res = await stackApp.request("/version-stacks/stack_nonexistent/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Stack comment" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await stackApp.request("/version-stacks/stack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Stack comment" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text is missing (ValidationError)", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const res = await stackApp.request("/version-stacks/stack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when text exceeds 10000 characters", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);

      const res = await stackApp.request("/version-stacks/stack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(10001) }),
      });

      expect(res.status).toBe(500);
    });

    it("calls db.insert with correct versionStackId", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const commentResult = {
        comment: { ...COMMENT_ROW, fileId: null, versionStackId: "stack_001" },
        user: USER_ROW,
      };
      mockSelectJoinSingle(commentResult);

      await stackApp.request("/version-stacks/stack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Stack comment" }),
      });

      const valuesSpy = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.versionStackId).toBe("stack_001");
      expect(callArg.fileId).toBeNull();
    });

    it("uses generateId for comment creation", async () => {
      const stackApp = new Hono();
      stackApp.post("/version-stacks/:stackId/comments", async (c) => {
        return createVersionStackComment(c);
      });

      mockSelectSingle(VERSION_STACK_ROW);
      vi.mocked(verifyProjectAccess).mockResolvedValue(ACCESS_ROW as never);
      mockInsert();
      const commentResult = { comment: COMMENT_ROW, user: USER_ROW };
      mockSelectJoinSingle(commentResult);

      await stackApp.request("/version-stacks/stack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Stack comment" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("comment");
    });
  });
});
