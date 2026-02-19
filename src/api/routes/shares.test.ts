/**
 * Bush Platform - Shares Routes Tests
 *
 * Comprehensive unit tests for share API routes.
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
  verifyAccountAccess: vi.fn(),
  verifyProjectAccess: vi.fn(),
}));

vi.mock("../../db/schema.js", () => ({
  shares: {
    id: "id",
    accountId: "accountId",
    projectId: "projectId",
    createdByUserId: "createdByUserId",
    name: "name",
    slug: "slug",
    passphrase: "passphrase",
    expiresAt: "expiresAt",
    layout: "layout",
    allowComments: "allowComments",
    allowDownloads: "allowDownloads",
    showAllVersions: "showAllVersions",
    showTranscription: "showTranscription",
    featuredField: "featuredField",
    branding: "branding",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  shareAssets: {
    id: "id",
    shareId: "shareId",
    fileId: "fileId",
    sortOrder: "sortOrder",
    createdAt: "createdAt",
  },
  shareActivity: {
    id: "id",
    shareId: "shareId",
    type: "type",
    createdAt: "createdAt",
  },
  files: {
    id: "id",
    projectId: "projectId",
    folderId: "folderId",
    name: "name",
    mimeType: "mimeType",
    status: "status",
    deletedAt: "deletedAt",
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
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("share_test123"),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app, { getShareBySlug } from "./shares.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyAccountAccess, verifyProjectAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";

// ---------------------------------------------------------------------------
// Test app factory - mount shares sub-app under the parent route
// so :accountId param is available
// ---------------------------------------------------------------------------
function makeTestApp() {
  const testApp = new Hono();
  testApp.route("/accounts/:accountId/shares", app);
  return testApp;
}

// Base paths for convenience
const ACCOUNT_SHARES = "/accounts/acc_xyz/shares";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner" as const,
  sessionId: "ses_111",
};

const USER_ROW = {
  id: "usr_abc",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const SHARE_ROW = {
  id: "share_001",
  accountId: "acc_xyz",
  projectId: "prj_001",
  createdByUserId: "usr_abc",
  name: "My Share",
  slug: "abc123xyz0",
  passphrase: null,
  expiresAt: null,
  layout: "grid",
  allowComments: true,
  allowDownloads: false,
  showAllVersions: false,
  showTranscription: false,
  featuredField: null,
  branding: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const FILE_ROW = {
  id: "file_001",
  projectId: "prj_001",
  folderId: null,
  name: "test.mp4",
  mimeType: "video/mp4",
  status: "active",
  deletedAt: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const SHARE_ASSET_ROW = {
  id: "sasset_001",
  shareId: "share_001",
  fileId: "file_001",
  sortOrder: 0,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
};

const SHARE_ACTIVITY_ROW = {
  id: "sact_001",
  shareId: "share_001",
  type: "view",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// DB chain helpers (all use mockReturnValueOnce to stack sequential calls)
// ---------------------------------------------------------------------------

/** Mock a join select: .from().innerJoin().where().orderBy().limit() */
function mockSelectJoinList(items: Array<{ share: unknown; user: unknown }>) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue(items),
          }),
        }),
      }),
    }),
  } as never);
}

/** Mock a join select: .from().innerJoin().where().limit() (single result) */
function mockSelectJoinSingle(shareRow: unknown, userRow: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(
            shareRow ? [{ share: shareRow, user: userRow }] : []
          ),
        }),
      }),
    }),
  } as never);
}

/** Mock select count: .from().where() returning [{ count: N }] */
function mockSelectCount(count: number) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  } as never);
}

/** Mock share select (no join): .from().where().limit() */
function mockSelectShareSingle(row: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
  } as never);
}

/** Mock share list without limit: .from().where() */
function mockSelectList(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never);
}

/** Mock asset join list: .from().innerJoin().where().orderBy().limit() */
function mockSelectAssetJoinList(items: Array<{ shareAsset: unknown; file: unknown }>) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue(items),
          }),
        }),
      }),
    }),
  } as never);
}

/** Mock asset join without limit: .from().innerJoin().where().orderBy() */
function mockSelectAssetJoinNoLimit(items: Array<{ shareAsset: unknown; file: unknown }>) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          orderBy: vi.fn().mockResolvedValue(items),
        }),
      }),
    }),
  } as never);
}

/** Mock activity list: .from().where().orderBy().limit() */
function mockSelectActivityList(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never);
}

/** Mock maxOrder query: .from().where() returning [{ maxOrder: N }] */
function mockSelectMaxOrder(maxOrder: number) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: vi.fn().mockResolvedValue([{ maxOrder }]),
    }),
  } as never);
}

/** Mock slug check: .from().where().limit() */
function mockSelectSlugCheck(existing: unknown) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(existing ? [existing] : []),
      }),
    }),
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Shares Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish defaults after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("share_test123");
    vi.mocked(verifyAccountAccess).mockResolvedValue(true as never);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "prj_001" } as never);

    // Mock Bun.password globally
    vi.stubGlobal("Bun", {
      password: {
        hash: vi.fn().mockResolvedValue("hashed_passphrase"),
        verify: vi.fn().mockResolvedValue(true),
      },
    });
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/shares - List shares
  // -------------------------------------------------------------------------
  describe("GET /accounts/:accountId/shares - list shares for account", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([{ share: SHARE_ROW, user: USER_ROW }]);

      const res = await testApp.request(ACCOUNT_SHARES, { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.id).toBe("share_001");
      expect(item.type).toBe("share");
      expect(item.attributes.name).toBe("My Share");
    });

    it("returns meta with total_count and page_size", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([{ share: SHARE_ROW, user: USER_ROW }]);

      const res = await testApp.request(ACCOUNT_SHARES, { method: "GET" });
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
    });

    it("returns empty data array when no shares exist", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([]);

      const res = await testApp.request(ACCOUNT_SHARES, { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
    });

    it("calls requireAuth to authenticate the request", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([]);

      await testApp.request(ACCOUNT_SHARES, { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);

      const res = await testApp.request(ACCOUNT_SHARES, { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("verifies account access with correct accountId", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([{ share: SHARE_ROW, user: USER_ROW }]);

      await testApp.request(ACCOUNT_SHARES, { method: "GET" });

      expect(vi.mocked(verifyAccountAccess)).toHaveBeenCalledWith(
        "acc_xyz",
        SESSION.currentAccountId
      );
    });

    it("supports cursor pagination parameter", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([{ share: SHARE_ROW, user: USER_ROW }]);

      const cursor = Buffer.from(
        JSON.stringify({ createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await testApp.request(`${ACCOUNT_SHARES}?cursor=${cursor}`, {
        method: "GET",
      });

      expect(res.status).toBe(200);
    });

    it("supports project_id filter parameter", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([{ share: SHARE_ROW, user: USER_ROW }]);

      const res = await testApp.request(`${ACCOUNT_SHARES}?project_id=prj_001`, {
        method: "GET",
      });

      expect(res.status).toBe(200);
    });

    it("includes created_by info in response attributes", async () => {
      const testApp = makeTestApp();
      mockSelectJoinList([{ share: SHARE_ROW, user: USER_ROW }]);

      const res = await testApp.request(ACCOUNT_SHARES, { method: "GET" });
      const body = await res.json();

      expect(body.data[0].attributes.created_by).toBeDefined();
      expect(body.data[0].attributes.created_by.id).toBe("usr_abc");
    });
  });

  // -------------------------------------------------------------------------
  // POST /accounts/:accountId/shares - Create share
  // -------------------------------------------------------------------------
  describe("POST /accounts/:accountId/shares - create share", () => {
    it("returns 200 with newly created share on success", async () => {
      const testApp = makeTestApp();

      // Slug uniqueness check - no existing share
      mockSelectSlugCheck(null);

      // Insert share
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      // Fetch created share with creator
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);

      // Count assets
      mockSelectCount(0);

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("share_001");
      expect(body.data.type).toBe("share");
    });

    it("returns 500 when name is missing (ValidationError thrown)", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: "grid" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string (ValidationError thrown)", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name exceeds 255 characters (ValidationError thrown)", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "a".repeat(256) }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when layout is invalid (ValidationError thrown)", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name", layout: "invalid_layout" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project_id is not accessible (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share", project_id: "prj_invalid" }),
      });

      expect(res.status).toBe(500);
    });

    it("calls db.insert for share record", async () => {
      const testApp = makeTestApp();

      mockSelectSlugCheck(null);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share" }),
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });

    it("hashes passphrase using bcrypt when provided", async () => {
      const testApp = makeTestApp();

      mockSelectSlugCheck(null);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Protected Share", passphrase: "secret123" }),
      });

      expect(res.status).toBe(200);
      expect(Bun.password.hash).toHaveBeenCalledWith("secret123", {
        algorithm: "bcrypt",
        cost: 12,
      });
    });

    it("inserts share assets when file_ids are provided", async () => {
      const testApp = makeTestApp();

      mockSelectSlugCheck(null);

      const valuesInsert = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: valuesInsert,
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(1);

      const res = await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share", file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(200);
      // Two insert calls: shares + shareAssets
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(2);
    });

    it("accepts all valid layout values", async () => {
      for (const layout of ["grid", "reel", "viewer"]) {
        const testApp = makeTestApp();

        mockSelectSlugCheck(null);

        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        } as never);

        mockSelectJoinSingle(SHARE_ROW, USER_ROW);
        mockSelectCount(0);

        const res = await testApp.request(ACCOUNT_SHARES, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Share", layout }),
        });

        expect(res.status).toBe(200);
      }
    });

    it("defaults layout to grid when not provided", async () => {
      const testApp = makeTestApp();

      mockSelectSlugCheck(null);

      const valuesInsert = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: valuesInsert,
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share" }),
      });

      const insertArg = valuesInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.layout).toBe("grid");
    });

    it("uses generateId with 'share' prefix", async () => {
      const testApp = makeTestApp();

      mockSelectSlugCheck(null);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(ACCOUNT_SHARES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Share" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("share");
    });
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/shares/:id - Get single share
  // -------------------------------------------------------------------------
  describe("GET /:id - get share by ID", () => {
    it("returns 200 with JSON:API single resource on success", async () => {
      const testApp = makeTestApp();
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(2);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("share_001");
      expect(body.data.type).toBe("share");
      expect(body.data.attributes.name).toBe("My Share");
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectJoinSingle(null, null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing`);

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`);

      expect(res.status).toBe(500);
    });

    it("includes asset_count in response attributes", async () => {
      const testApp = makeTestApp();
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(3);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`);
      const body = await res.json();

      expect(body.data.attributes.asset_count).toBe(3);
    });

    it("includes created_by info in response attributes", async () => {
      const testApp = makeTestApp();
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`);
      const body = await res.json();

      expect(body.data.attributes.created_by).toBeDefined();
      expect(body.data.attributes.created_by.id).toBe("usr_abc");
    });

    it("formats date fields as ISO strings", async () => {
      const testApp = makeTestApp();
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`);
      const body = await res.json();

      expect(body.data.attributes.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(body.data.attributes.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /accounts/:accountId/shares/:id - Update share
  // -------------------------------------------------------------------------
  describe("PATCH /:id - update share", () => {
    it("returns 200 with updated share on success", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("share_001");
      expect(body.data.type).toBe("share");
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string (ValidationError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name exceeds 255 characters (ValidationError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "a".repeat(256) }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when layout is invalid (ValidationError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: "bad_layout" }),
      });

      expect(res.status).toBe(500);
    });

    it("hashes passphrase using bcrypt when provided in update", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "newpassword" }),
      });

      expect(res.status).toBe(200);
      expect(Bun.password.hash).toHaveBeenCalledWith("newpassword", {
        algorithm: "bcrypt",
        cost: 12,
      });
    });

    it("sets passphrase to null when passphrase is empty string", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: "" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.passphrase).toBeNull();
    });

    it("includes updatedAt in the update set", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Changed" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
      expect(updates.name).toBe("Changed");
    });

    it("updates allowComments when provided", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow_comments: false }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.allowComments).toBe(false);
    });

    it("updates layout when valid layout is provided", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: "reel" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.layout).toBe("reel");
    });

    it("calls db.update once for the share", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);
      mockSelectCount(0);

      await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /accounts/:accountId/shares/:id - Delete share
  // -------------------------------------------------------------------------
  describe("DELETE /:id - delete share", () => {
    it("returns 204 No Content on successful deletion", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("calls db.delete once for the share", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await testApp.request(`${ACCOUNT_SHARES}/share_001`, { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing`, {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001`, {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when share is not found", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      await testApp.request(`${ACCOUNT_SHARES}/share_missing`, {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/shares/:id/assets - List assets in a share
  // -------------------------------------------------------------------------
  describe("GET /:id/assets - list share assets", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectAssetJoinList([{ shareAsset: SHARE_ASSET_ROW, file: FILE_ROW }]);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("returns empty data array when no assets exist", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectAssetJoinList([]);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toEqual([]);
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing/assets`);

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`);

      expect(res.status).toBe(500);
    });

    it("supports cursor pagination parameter", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectAssetJoinList([{ shareAsset: SHARE_ASSET_ROW, file: FILE_ROW }]);

      const cursor = Buffer.from(
        JSON.stringify({ sortOrder: 5 })
      ).toString("base64url");

      const res = await testApp.request(
        `${ACCOUNT_SHARES}/share_001/assets?cursor=${cursor}`
      );

      expect(res.status).toBe(200);
    });

    it("returns meta with total_count", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectAssetJoinList([{ shareAsset: SHARE_ASSET_ROW, file: FILE_ROW }]);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`);
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /accounts/:accountId/shares/:id/assets - Add assets to share
  // -------------------------------------------------------------------------
  describe("POST /:id/assets - add assets to share", () => {
    it("returns 202 Accepted on success", async () => {
      const testApp = makeTestApp();

      // Share lookup
      mockSelectShareSingle(SHARE_ROW);
      // File lookup
      mockSelectShareSingle(FILE_ROW);
      // Max order lookup
      mockSelectMaxOrder(-1);

      vi.mocked(db.insert).mockReturnValue({
        values: () => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(202);
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_ids is missing (ValidationError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_ids is empty array (ValidationError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: [] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found (ValidationError thrown)", async () => {
      const testApp = makeTestApp();

      // Share found
      mockSelectShareSingle(SHARE_ROW);
      // File not found
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_missing"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access denied for file (ValidationError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      // Share found
      mockSelectShareSingle(SHARE_ROW);
      // File found
      mockSelectShareSingle(FILE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /accounts/:accountId/shares/:id/assets/:assetId - Remove asset
  // -------------------------------------------------------------------------
  describe("DELETE /:id/assets/:assetId - remove asset from share", () => {
    it("returns 204 No Content on successful removal", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await testApp.request(
        `${ACCOUNT_SHARES}/share_001/assets/sasset_001`,
        { method: "DELETE" }
      );

      expect(res.status).toBe(204);
    });

    it("calls db.delete for the share asset", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await testApp.request(`${ACCOUNT_SHARES}/share_001/assets/sasset_001`, {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(
        `${ACCOUNT_SHARES}/share_missing/assets/sasset_001`,
        { method: "DELETE" }
      );

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(
        `${ACCOUNT_SHARES}/share_001/assets/sasset_001`,
        { method: "DELETE" }
      );

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // POST /accounts/:accountId/shares/:id/duplicate - Duplicate share
  // -------------------------------------------------------------------------
  describe("POST /:id/duplicate - duplicate share", () => {
    it("returns 200 with duplicated share on success", async () => {
      const testApp = makeTestApp();

      // Share lookup
      mockSelectShareSingle(SHARE_ROW);
      // Slug check - no existing
      mockSelectSlugCheck(null);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      // Get existing assets (none)
      mockSelectList([]);

      // Fetch new share
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("share_001");
      expect(body.data.type).toBe("share");
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(500);
    });

    it("inserts the duplicate share record", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectSlugCheck(null);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      mockSelectList([]);
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);

      await testApp.request(`${ACCOUNT_SHARES}/share_001/duplicate`, {
        method: "POST",
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });

    it("copies share assets when source share has assets", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectSlugCheck(null);

      const valuesInsert = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: valuesInsert,
      } as never);

      // Existing assets
      mockSelectList([SHARE_ASSET_ROW]);

      mockSelectJoinSingle(SHARE_ROW, USER_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(200);
      // Two inserts: share + asset copies
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(2);
    });

    it("uses generateId for new share and asset IDs", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectSlugCheck(null);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      mockSelectList([SHARE_ASSET_ROW]);
      mockSelectJoinSingle(SHARE_ROW, USER_ROW);

      await testApp.request(`${ACCOUNT_SHARES}/share_001/duplicate`, {
        method: "POST",
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("share");
      expect(vi.mocked(generateId)).toHaveBeenCalledWith("share_asset");
    });
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/shares/:id/activity - Get share activity
  // -------------------------------------------------------------------------
  describe("GET /:id/activity - get share activity", () => {
    it("returns 200 with activity collection on success", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectActivityList([SHARE_ACTIVITY_ROW]);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/activity`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns empty data array when no activity exists", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectActivityList([]);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/activity`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toEqual([]);
    });

    it("returns 500 when share is not found (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      mockSelectShareSingle(null);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_missing/activity`);

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied (NotFoundError thrown)", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(false as never);
      mockSelectShareSingle(SHARE_ROW);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/activity`);

      expect(res.status).toBe(500);
    });

    it("supports type filter parameter (valid types: view, comment, download)", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectActivityList([SHARE_ACTIVITY_ROW]);

      const res = await testApp.request(
        `${ACCOUNT_SHARES}/share_001/activity?type=view`
      );

      expect(res.status).toBe(200);
    });

    it("supports cursor pagination parameter", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectActivityList([SHARE_ACTIVITY_ROW]);

      const cursor = Buffer.from(
        JSON.stringify({ createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await testApp.request(
        `${ACCOUNT_SHARES}/share_001/activity?cursor=${cursor}`
      );

      expect(res.status).toBe(200);
    });

    it("returns meta with total_count", async () => {
      const testApp = makeTestApp();

      mockSelectShareSingle(SHARE_ROW);
      mockSelectActivityList([SHARE_ACTIVITY_ROW]);

      const res = await testApp.request(`${ACCOUNT_SHARES}/share_001/activity`);
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getShareBySlug - Public share access (exported function)
  // -------------------------------------------------------------------------
  describe("getShareBySlug - get share by slug (public access)", () => {
    // Mount the exported handler directly
    const slugApp = new Hono();
    slugApp.get("/shares/slug/:slug", getShareBySlug);

    it("returns 200 with share data when share has no passphrase protection", async () => {
      mockSelectShareSingle(SHARE_ROW);

      // Assets query
      mockSelectAssetJoinNoLimit([]);

      const res = await slugApp.request("/shares/slug/abc123xyz0");

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("share_001");
      expect(body.data.attributes.passphrase_required).toBe(false);
    });

    it("returns minimal info with passphrase_required when passphrase protected and no passphrase given", async () => {
      const protectedShare = { ...SHARE_ROW, passphrase: "hashed_value" };
      mockSelectShareSingle(protectedShare);

      const res = await slugApp.request("/shares/slug/abc123xyz0");

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.attributes.passphrase_required).toBe(true);
    });

    it("does not expose passphrase hash in minimal passphrase-required response", async () => {
      const protectedShare = { ...SHARE_ROW, passphrase: "hashed_value" };
      mockSelectShareSingle(protectedShare);

      const res = await slugApp.request("/shares/slug/abc123xyz0");
      const body = await res.json();

      expect(body.data.attributes.passphrase).toBeUndefined();
    });

    it("returns 500 when share is not found by slug (NotFoundError thrown)", async () => {
      mockSelectShareSingle(null);

      const res = await slugApp.request("/shares/slug/nonexistent");

      expect(res.status).toBe(500);
    });

    it("returns 500 when share has expired (ValidationError thrown)", async () => {
      const expiredShare = {
        ...SHARE_ROW,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      };
      mockSelectShareSingle(expiredShare);

      const res = await slugApp.request("/shares/slug/abc123xyz0");

      expect(res.status).toBe(500);
    });

    it("returns 500 when passphrase is incorrect (ValidationError thrown)", async () => {
      const protectedShare = { ...SHARE_ROW, passphrase: "hashed_value" };
      mockSelectShareSingle(protectedShare);

      // verifyPassphrase returns false
      vi.mocked(Bun.password.verify).mockResolvedValue(false);

      // Use query param since GET requests cannot have a body
      const res = await slugApp.request(
        "/shares/slug/abc123xyz0?passphrase=wrongpassword"
      );

      expect(res.status).toBe(500);
    });

    it("returns full share data when correct passphrase provided via query param", async () => {
      const protectedShare = { ...SHARE_ROW, passphrase: "hashed_value" };
      mockSelectShareSingle(protectedShare);

      // Assets query
      mockSelectAssetJoinNoLimit([]);

      vi.mocked(Bun.password.verify).mockResolvedValue(true);

      // Use query param since GET requests cannot have a body
      const res = await slugApp.request(
        "/shares/slug/abc123xyz0?passphrase=correctpassword"
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.attributes.passphrase_required).toBe(false);
    });

    it("accepts passphrase via query param (deprecated fallback)", async () => {
      const protectedShare = { ...SHARE_ROW, passphrase: "hashed_value" };
      mockSelectShareSingle(protectedShare);

      // Assets query
      mockSelectAssetJoinNoLimit([]);

      vi.mocked(Bun.password.verify).mockResolvedValue(true);

      const res = await slugApp.request(
        "/shares/slug/abc123xyz0?passphrase=correctpassword"
      );

      expect(res.status).toBe(200);
    });

    it("does not expose passphrase field in full response", async () => {
      mockSelectShareSingle(SHARE_ROW);
      mockSelectAssetJoinNoLimit([]);

      const res = await slugApp.request("/shares/slug/abc123xyz0");
      const body = await res.json();

      expect(body.data.attributes.passphrase).toBeUndefined();
    });

    it("includes assets array in response", async () => {
      mockSelectShareSingle(SHARE_ROW);
      mockSelectAssetJoinNoLimit([{ shareAsset: SHARE_ASSET_ROW, file: FILE_ROW }]);

      const res = await slugApp.request("/shares/slug/abc123xyz0");
      const body = await res.json();

      expect(Array.isArray(body.data.attributes.assets)).toBe(true);
      expect(body.data.attributes.assets).toHaveLength(1);
    });

    it("returns share when expiresAt is in the future (not expired)", async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const validShare = { ...SHARE_ROW, expiresAt: futureDate };

      mockSelectShareSingle(validShare);
      mockSelectAssetJoinNoLimit([]);

      const res = await slugApp.request("/shares/slug/abc123xyz0");

      expect(res.status).toBe(200);
    });

    it("calls Bun.password.verify with provided passphrase and stored hash", async () => {
      const protectedShare = { ...SHARE_ROW, passphrase: "stored_hash" };
      mockSelectShareSingle(protectedShare);

      mockSelectAssetJoinNoLimit([]);

      vi.mocked(Bun.password.verify).mockResolvedValue(true);

      // Use query param since GET requests cannot have a body
      await slugApp.request("/shares/slug/abc123xyz0?passphrase=mypassword");

      expect(Bun.password.verify).toHaveBeenCalledWith("mypassword", "stored_hash");
    });
  });
});
