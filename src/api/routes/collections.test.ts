/**
 * Bush Platform - Collections Routes Tests
 *
 * Comprehensive unit tests for collection API routes.
 */

// Mock all dependencies BEFORE any imports (vitest hoists vi.mock calls)
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
  collections: {
    id: "id",
    projectId: "projectId",
    createdByUserId: "createdByUserId",
    name: "name",
    description: "description",
    type: "type",
    isDynamic: "isDynamic",
    filterRules: "filterRules",
    defaultView: "defaultView",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  collectionAssets: {
    id: "id",
    collectionId: "collectionId",
    fileId: "fileId",
    sortOrder: "sortOrder",
    addedByUserId: "addedByUserId",
    createdAt: "createdAt",
  },
  files: {
    id: "id",
    name: "name",
    projectId: "projectId",
    mimeType: "mimeType",
    fileSizeBytes: "fileSizeBytes",
    status: "status",
    deletedAt: "deletedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  users: {
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    avatarUrl: "avatarUrl",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("coll_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// drizzle-orm operators used in route handlers - mock as identity functions
vi.mock("drizzle-orm", () => {
  function makeSqlObj() {
    const obj: Record<string, unknown> = { type: "sql" };
    obj.as = () => obj;
    return obj;
  }
  return {
    eq: vi.fn((field: unknown, val: unknown) => ({ type: "eq", field, val })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((field: unknown) => ({ type: "desc", field })),
    lt: vi.fn((field: unknown, val: unknown) => ({ type: "lt", field, val })),
    sql: vi.fn(() => makeSqlObj()),
    isNull: vi.fn((field: unknown) => ({ type: "isNull", field })),
    inArray: vi.fn((field: unknown, vals: unknown) => ({ type: "inArray", field, vals })),
  };
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app from "./collections.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Mount on parent router so :projectId param is available
// ---------------------------------------------------------------------------
const testApp = new Hono();
testApp.route("/projects/:projectId/collections", app);

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner",
  sessionId: "ses_111",
};

const COLLECTION_ROW = {
  id: "coll_001",
  projectId: "proj_001",
  createdByUserId: "usr_abc",
  name: "My Collection",
  description: "A test collection",
  type: "team" as const,
  isDynamic: false,
  filterRules: null,
  defaultView: "grid" as const,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const CREATOR_ROW = {
  id: "usr_abc",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  avatarUrl: null,
};

const COLLECTION_WITH_CREATOR = {
  collection: COLLECTION_ROW,
  creator: CREATOR_ROW,
};

const FILE_ROW = {
  id: "file_001",
  name: "photo.jpg",
  mimeType: "image/jpeg",
  fileSizeBytes: 1024,
  status: "ready",
  projectId: "proj_001",
  deletedAt: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// DB mock chain helpers
// ---------------------------------------------------------------------------

/**
 * Mock a select chain that ends with .limit() returning rows.
 * Chain: .from().innerJoin().where().orderBy().limit()
 */

/**
 * Mock a select chain that ends with .where().groupBy() for asset counts.
 * Chain: .from().where().groupBy()
 */
function mockSelectForGroupBy(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        groupBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/**
 * Mock a select chain that ends with .where().limit() (no join, no orderBy).
 * Chain: .from().where().limit()
 */
function mockSelectSimpleWhere(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/**
 * Mock a select chain ending with .where() (no limit).
 */
function mockSelectEndingWithWhere(rows: unknown[]) {
  return {
    from: () => ({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never;
}

/**
 * Mock a select chain for collectionAssets with innerJoin then where then orderBy then limit.
 * Chain: .from().innerJoin().innerJoin().where().orderBy().limit()
 */

/**
 * Mock multiple sequential db.select() calls using mockReturnValueOnce.
 */
function mockSelectSequence(...implementations: Array<ReturnType<typeof mockSelectSimpleWhere>>) {
  let mock = vi.mocked(db.select);
  for (const impl of implementations) {
    mock = mock.mockReturnValueOnce(impl) as typeof mock;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Collections Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("coll_test123");
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    // Re-set sql mock: it's used as a tagged template literal so needs to return
    // an object with .as() for column aliasing
    vi.mocked(sql).mockImplementation((..._args: unknown[]) => {
      const obj: Record<string, unknown> = { type: "sql" };
      obj.as = () => obj;
      return obj as never;
    });
  });

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/collections - List collections
  // -------------------------------------------------------------------------
  describe("GET /projects/:projectId/collections - list collections", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      // First select: collections with creator (limit+1 query)
      // Second select: asset counts per collection
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
                }),
              }),
            }),
          }),
        } as never,
        mockSelectForGroupBy([{ collectionId: "coll_001", count: 3 }])
      );

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.id).toBe("coll_001");
      expect(item.type).toBe("collection");
      expect(item.attributes.name).toBe("My Collection");
    });

    it("includes assetCount in collection attributes", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
                }),
              }),
            }),
          }),
        } as never,
        mockSelectForGroupBy([{ collectionId: "coll_001", count: 5 }])
      );

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data[0].attributes.assetCount).toBe(5);
    });

    it("uses 0 as assetCount when no count entry exists for a collection", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
                }),
              }),
            }),
          }),
        } as never,
        mockSelectForGroupBy([]) // No asset counts
      );

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data[0].attributes.assetCount).toBe(0);
    });

    it("skips asset count query when there are no collections", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      // db.select should be called only once (no asset count query)
      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    });

    it("returns meta with total_count, page_size, and has_more", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
                }),
              }),
            }),
          }),
        } as never,
        mockSelectForGroupBy([])
      );

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
      expect(body.meta.has_more).toBe(false);
    });

    it("calls verifyProjectAccess with correct projectId and accountId", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        } as never
      );

      await testApp.request("/projects/proj_001/collections", { method: "GET" });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        "proj_001",
        SESSION.currentAccountId
      );
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("formats date fields as ISO strings in response", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
                }),
              }),
            }),
          }),
        } as never,
        mockSelectForGroupBy([])
      );

      const res = await testApp.request("/projects/proj_001/collections", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data[0].attributes.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(body.data[0].attributes.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        } as never
      );

      await testApp.request("/projects/proj_001/collections", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/collections - Create collection
  // -------------------------------------------------------------------------
  describe("POST /projects/:projectId/collections - create collection", () => {
    beforeEach(() => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      // After insert, fetch the created collection
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
            }),
          }),
        }),
      } as never);
    });

    it("returns 200 with created collection on success", async () => {
      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Collection" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data.id).toBe("coll_001");
      expect(body.data.type).toBe("collection");
      expect(body.data.attributes.name).toBe("My Collection");
    });

    it("calls db.insert with correct collection values", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Collection", description: "A description" }),
      });

      const insertMock = vi.mocked(db.insert);
      expect(insertMock).toHaveBeenCalledTimes(1);

      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.projectId).toBe("proj_001");
      expect(callArg.name).toBe("Test Collection");
      expect(callArg.description).toBe("A description");
      expect(callArg.type).toBe("team");
      expect(callArg.isDynamic).toBe(false);
    });

    it("trims whitespace from name", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  Padded Name  " }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.name).toBe("Padded Name");
    });

    it("defaults type to 'team' when not provided", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Type" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.type).toBe("team");
    });

    it("sets type to 'private' when specified", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Private Coll", type: "private" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.type).toBe("private");
    });

    it("sets isDynamic to true when filter_rules are provided", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dynamic Coll", filter_rules: [{ field: "type", value: "image" }] }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.isDynamic).toBe(true);
      expect(callArg.filterRules).toEqual([{ field: "type", value: "image" }]);
    });

    it("defaults defaultView to 'grid'", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Grid Collection" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.defaultView).toBe("grid");
    });

    it("uses custom defaultView when 'list' is specified", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "List View", default_view: "list" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.defaultView).toBe("list");
    });

    it("sets description to null when not provided", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Description" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.description).toBeNull();
    });

    it("uses session.userId as createdByUserId", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Owned Collection" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.createdByUserId).toBe(SESSION.userId);
    });

    it("uses generateId to create collection ID", async () => {
      await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Collection" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("coll");
    });

    it("returns 500 when name is missing (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "No name" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is whitespace-only (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when type is invalid (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name", type: "public" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when filter_rules is not an array (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name", filter_rules: "not-an-array" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError thrown)", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/projects/proj_001/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Collection" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/collections/:id - Get collection details
  // -------------------------------------------------------------------------
  describe("GET /projects/:projectId/collections/:id - get collection", () => {
    it("returns collection with assets on success", async () => {
      const assetRow = {
        file: FILE_ROW,
        addedBy: { id: "usr_abc", firstName: "Jane", lastName: "Doe" },
      };

      mockSelectSequence(
        // First: get collection with creator
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
              }),
            }),
          }),
        } as never,
        // Second: get assets
        {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: vi.fn().mockResolvedValue([assetRow]),
                  }),
                }),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_001", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data).toBeDefined();
      expect(body.data.id).toBe("coll_001");
      expect(body.data.type).toBe("collection");
      expect(body.data.attributes.name).toBe("My Collection");
      expect(body.included).toBeDefined();
      expect(Array.isArray(body.included)).toBe(true);
    });

    it("includes assets in relationships and included", async () => {
      const assetRow = {
        file: FILE_ROW,
        addedBy: { id: "usr_abc", firstName: "Jane", lastName: "Doe" },
      };

      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
              }),
            }),
          }),
        } as never,
        {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: vi.fn().mockResolvedValue([assetRow]),
                  }),
                }),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_001", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.relationships.assets.data).toHaveLength(1);
      expect(body.data.relationships.assets.data[0].id).toBe("file_001");
      expect(body.data.relationships.assets.data[0].type).toBe("file");
      expect(body.included[0].id).toBe("file_001");
      expect(body.included[0].type).toBe("file");
    });

    it("returns assetCount equal to number of assets fetched", async () => {
      const assetRows = [
        { file: FILE_ROW, addedBy: { id: "usr_abc", firstName: "Jane", lastName: "Doe" } },
        { file: { ...FILE_ROW, id: "file_002" }, addedBy: { id: "usr_abc", firstName: "Jane", lastName: "Doe" } },
      ];

      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
              }),
            }),
          }),
        } as never,
        {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: vi.fn().mockResolvedValue(assetRows),
                  }),
                }),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_001", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.assetCount).toBe(2);
    });

    it("returns 500 when collection is not found (NotFoundError thrown)", async () => {
      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_missing", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_001", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when accessing another user's private collection", async () => {
      const privateCollection = {
        collection: { ...COLLECTION_ROW, type: "private" as const, createdByUserId: "usr_other" },
        creator: CREATOR_ROW,
      };

      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([privateCollection]),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_001", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("allows creator to view their own private collection", async () => {
      const privateCollection = {
        collection: { ...COLLECTION_ROW, type: "private" as const, createdByUserId: SESSION.userId },
        creator: CREATOR_ROW,
      };

      mockSelectSequence(
        {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([privateCollection]),
              }),
            }),
          }),
        } as never,
        {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        } as never
      );

      const res = await testApp.request("/projects/proj_001/collections/coll_001", { method: "GET" });

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /projects/:projectId/collections/:id - Update collection
  // -------------------------------------------------------------------------
  describe("PUT /projects/:projectId/collections/:id - update collection", () => {
    beforeEach(() => {
      // First select: get existing collection (simple, no join)
      vi.mocked(db.select)
        .mockReturnValueOnce(mockSelectSimpleWhere([COLLECTION_ROW]))
        // Third select: updated collection with creator
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([COLLECTION_WITH_CREATOR]),
              }),
            }),
          }),
        } as never)
        // Fourth select: asset count
        .mockReturnValueOnce({
          from: () => ({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 200 with updated collection on success", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Collection" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data.id).toBe("coll_001");
      expect(body.data.type).toBe("collection");
    });

    it("calls db.update with updatedAt timestamp", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
      expect(updates.name).toBe("Updated Name");
    });

    it("updates description when provided", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "New description" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.description).toBe("New description");
    });

    it("sets description to null when empty string provided", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.description).toBeNull();
    });

    it("updates type when valid value provided", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "private" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.type).toBe("private");
    });

    it("updates defaultView when 'list' provided", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_view: "list" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.defaultView).toBe("list");
    });

    it("sets isDynamic to true when filter_rules array provided", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_rules: [{ field: "type", value: "video" }] }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.isDynamic).toBe(true);
      expect(updates.filterRules).toEqual([{ field: "type", value: "video" }]);
    });

    it("sets isDynamic to false when filter_rules is null", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_rules: null }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.isDynamic).toBe(false);
      expect(updates.filterRules).toBeNull();
    });

    it("returns 500 when collection not found (NotFoundError thrown)", async () => {
      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce(mockSelectSimpleWhere([]));

      const res = await testApp.request("/projects/proj_001/collections/coll_missing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access denied (NotFoundError thrown)", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when non-owner tries to update private collection (AuthorizationError)", async () => {
      const privateCollection = { ...COLLECTION_ROW, type: "private" as const, createdByUserId: "usr_other" };

      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce(mockSelectSimpleWhere([privateCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when type is invalid (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "shared" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when default_view is invalid (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_view: "table" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when filter_rules is not array and not null (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_rules: "bad-value" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns assetCount from the count query", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      const body = (await res.json()) as any;
      expect(body.data.attributes.assetCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/collections/:id - Delete collection
  // -------------------------------------------------------------------------
  describe("DELETE /projects/:projectId/collections/:id - delete collection", () => {
    beforeEach(() => {
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([COLLECTION_ROW]));

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful deletion", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls db.delete twice (collectionAssets then collections)", async () => {
      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(2);
    });

    it("calls verifyProjectAccess before deleting", async () => {
      await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "DELETE",
      });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        COLLECTION_ROW.projectId,
        SESSION.currentAccountId
      );
    });

    it("returns 500 when collection is not found (NotFoundError thrown)", async () => {
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([]));

      const res = await testApp.request("/projects/proj_001/collections/coll_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access denied (NotFoundError thrown)", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when non-owner tries to delete private collection (AuthorizationError)", async () => {
      const privateCollection = { ...COLLECTION_ROW, type: "private" as const, createdByUserId: "usr_other" };
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([privateCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when collection is not found", async () => {
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([]));

      await testApp.request("/projects/proj_001/collections/coll_missing", {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("allows owner to delete their own private collection", async () => {
      const privateCollection = { ...COLLECTION_ROW, type: "private" as const, createdByUserId: SESSION.userId };
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([privateCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/collections/:id/items - Add items to collection
  // -------------------------------------------------------------------------
  describe("POST /projects/:projectId/collections/:id/items - add items", () => {
    beforeEach(() => {
      // First select: get collection
      vi.mocked(db.select)
        .mockReturnValueOnce(mockSelectSimpleWhere([COLLECTION_ROW]))
        // Second select: verify files exist
        .mockReturnValueOnce(mockSelectEndingWithWhere([{ id: "file_001" }, { id: "file_002" }]))
        // Third select: get max sort order
        .mockReturnValueOnce({
          from: () => ({
            where: vi.fn().mockResolvedValue([{ maxSort: 0 }]),
          }),
        } as never);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 200 with added and failed arrays on success", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001", "file_002"] }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.added)).toBe(true);
      expect(Array.isArray(body.data.failed)).toBe(true);
    });

    it("reports files not found in project as failed", async () => {
      // Only file_001 exists, file_999 doesn't
      vi.mocked(db.select).mockReset();
      vi.mocked(db.select)
        .mockReturnValueOnce(mockSelectSimpleWhere([COLLECTION_ROW]))
        .mockReturnValueOnce(mockSelectEndingWithWhere([{ id: "file_001" }]))
        .mockReturnValueOnce({
          from: () => ({
            where: vi.fn().mockResolvedValue([{ maxSort: 0 }]),
          }),
        } as never);

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001", "file_999"] }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data.added).toContain("file_001");
      const failedIds = body.data.failed.map((f: { id: string }) => f.id);
      expect(failedIds).toContain("file_999");
    });

    it("uses generateId with 'collitem' prefix for each asset", async () => {
      await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("collitem");
    });

    it("returns 500 when collection not found (NotFoundError thrown)", async () => {
      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce(mockSelectSimpleWhere([]));

      const res = await testApp.request("/projects/proj_001/collections/coll_missing/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access denied (NotFoundError thrown)", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when non-owner adds to private collection (AuthorizationError)", async () => {
      const privateCollection = { ...COLLECTION_ROW, type: "private" as const, createdByUserId: "usr_other" };

      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce(mockSelectSimpleWhere([privateCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when collection is dynamic (ValidationError thrown)", async () => {
      const dynamicCollection = { ...COLLECTION_ROW, isDynamic: true };

      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce(mockSelectSimpleWhere([dynamicCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_ids is not an array (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: "not-an-array" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_ids is empty array (ValidationError thrown)", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: [] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_ids exceeds 100 items (ValidationError thrown)", async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => `file_${i}`);

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: tooManyIds }),
      });

      expect(res.status).toBe(500);
    });

    it("increments sortOrder for each file added", async () => {
      // Two files, both existing
      vi.mocked(db.select).mockReset();
      vi.mocked(db.select)
        .mockReturnValueOnce(mockSelectSimpleWhere([COLLECTION_ROW]))
        .mockReturnValueOnce(mockSelectEndingWithWhere([{ id: "file_001" }, { id: "file_002" }]))
        .mockReturnValueOnce({
          from: () => ({
            where: vi.fn().mockResolvedValue([{ maxSort: 5 }]),
          }),
        } as never);

      const insertValues: unknown[] = [];
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((v) => {
          insertValues.push(v);
          return Promise.resolve(undefined);
        }),
      } as never);

      await testApp.request("/projects/proj_001/collections/coll_001/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ["file_001", "file_002"] }),
      });

      // sortOrder should start at maxSort + 1 = 6 and increment
      expect((insertValues[0] as Record<string, unknown>).sortOrder).toBe(6);
      expect((insertValues[1] as Record<string, unknown>).sortOrder).toBe(7);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/collections/:id/items/:itemId - Remove item
  // -------------------------------------------------------------------------
  describe("DELETE /projects/:projectId/collections/:id/items/:itemId - remove item", () => {
    beforeEach(() => {
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([COLLECTION_ROW]));

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful removal", async () => {
      const res = await testApp.request("/projects/proj_001/collections/coll_001/items/item_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls db.delete once for the collection asset", async () => {
      await testApp.request("/projects/proj_001/collections/coll_001/items/item_001", {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("calls verifyProjectAccess before deleting", async () => {
      await testApp.request("/projects/proj_001/collections/coll_001/items/item_001", {
        method: "DELETE",
      });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        COLLECTION_ROW.projectId,
        SESSION.currentAccountId
      );
    });

    it("returns 500 when collection not found (NotFoundError thrown)", async () => {
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([]));

      const res = await testApp.request("/projects/proj_001/collections/coll_missing/items/item_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access denied (NotFoundError thrown)", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items/item_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when non-owner tries to remove from private collection (AuthorizationError)", async () => {
      const privateCollection = { ...COLLECTION_ROW, type: "private" as const, createdByUserId: "usr_other" };
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([privateCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items/item_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when collection is not found", async () => {
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([]));

      await testApp.request("/projects/proj_001/collections/coll_missing/items/item_001", {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("allows owner to remove item from their own private collection", async () => {
      const privateCollection = { ...COLLECTION_ROW, type: "private" as const, createdByUserId: SESSION.userId };
      vi.mocked(db.select).mockReturnValue(mockSelectSimpleWhere([privateCollection]));

      const res = await testApp.request("/projects/proj_001/collections/coll_001/items/item_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });
  });
});
