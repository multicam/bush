/**
 * Bush Platform - Workspace Routes Tests
 *
 * Comprehensive unit tests for workspace API routes.
 */

// Mock all dependencies BEFORE any imports
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
  verifyWorkspaceAccess: vi.fn(),
  verifyAccountMembership: vi.fn(),
}));

vi.mock("../../db/schema.js", () => ({
  workspaces: {
    id: "id",
    name: "name",
    accountId: "accountId",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    description: "description",
  },
  workspacePermissions: {
    id: "id",
    workspaceId: "workspaceId",
    userId: "userId",
    permission: "permission",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("ws_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// drizzle-orm operators used in the route handlers - mock them as identity functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  lt: vi.fn((field, val) => ({ type: "lt", field, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./workspaces.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyWorkspaceAccess, verifyAccountMembership } from "../access-control.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner",
  sessionId: "ses_111",
};

const WORKSPACE_ROW = {
  id: "ws_001",
  name: "Design Team",
  description: "Our design workspace",
  accountId: "acc_xyz",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

// Formatted version (dates as ISO strings, as formatDates produces)
const WORKSPACE_FORMATTED = {
  id: "ws_001",
  name: "Design Team",
  description: "Our design workspace",
  accountId: "acc_xyz",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Helper: set up a two-call select mock chain.
// First call returns list results, second call returns count.
// ---------------------------------------------------------------------------
function mockSelectForList(rows: typeof WORKSPACE_ROW[], count: number) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // Main query chain: .from().where().orderBy().limit()
      return {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      } as never;
    }
    // Count query chain: .from().where()
    return {
      from: () => ({
        where: vi.fn().mockResolvedValue([{ count }]),
      }),
    } as never;
  });
}

// ---------------------------------------------------------------------------
// Helper: single-result select mock (used after insert/update to refetch)
// ---------------------------------------------------------------------------
function mockSelectForSingle(row: typeof WORKSPACE_ROW) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue([row]),
      }),
    }),
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Workspace Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: requireAuth returns a valid session
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
  });

  // -------------------------------------------------------------------------
  // GET / - List workspaces
  // -------------------------------------------------------------------------
  describe("GET / - list workspaces", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      mockSelectForList([WORKSPACE_ROW], 1);

      const res = await app.request("/", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.id).toBe("ws_001");
      expect(item.type).toBe("workspace");
      expect(item.attributes.name).toBe("Design Team");
      expect(item.attributes.description).toBe("Our design workspace");
    });

    it("returns meta with total_count and page_size", async () => {
      mockSelectForList([WORKSPACE_ROW], 1);

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
      expect(body.meta.has_more).toBe(false);
    });

    it("returns empty data array when no workspaces exist", async () => {
      mockSelectForList([], 0);

      const res = await app.request("/", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectForList([], 0);

      await app.request("/", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("reports has_more false even when totalCount exceeds limit (items already sliced by route)", async () => {
      // The route slices results to `limit` before calling sendCollection,
      // so collectionResponse never sees the extra item. has_more is derived
      // from items.length > limit which will be false.
      const rows = Array.from({ length: 50 }, (_, i) => ({
        ...WORKSPACE_ROW,
        id: `ws_${String(i).padStart(3, "0")}`,
        name: `Workspace ${i}`,
      }));
      mockSelectForList(rows, 60);

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      // Route slices to limit before sendCollection, so has_more is always false
      expect(body.meta.has_more).toBe(false);
      expect(body.meta.total_count).toBe(60);
      expect(body.data).toHaveLength(50);
      expect(body.links).toBeDefined();
      expect(body.links.self).toBeDefined();
    });

    it("includes cursor parameter in query when provided", async () => {
      mockSelectForList([WORKSPACE_ROW], 1);

      // Encode a valid cursor (base64url of JSON)
      const cursor = Buffer.from(
        JSON.stringify({ id: "ws_prev", createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await app.request(`/?cursor=${cursor}`, { method: "GET" });

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id - Get single workspace
  // -------------------------------------------------------------------------
  describe("GET /:id - get workspace by ID", () => {
    it("returns 200 with JSON:API single resource on success", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(WORKSPACE_ROW as never);

      const res = await app.request("/ws_001", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("ws_001");
      expect(body.data.type).toBe("workspace");
      expect(body.data.attributes.name).toBe("Design Team");
    });

    it("propagates error (500) when workspace is not found", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null as never);

      const res = await app.request("/ws_missing", { method: "GET" });

      // Hono catches thrown errors and returns 500 in sub-app context
      expect(res.status).toBe(500);
    });

    it("calls verifyWorkspaceAccess with correct workspaceId and accountId", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(WORKSPACE_ROW as never);

      await app.request("/ws_001", { method: "GET" });

      expect(vi.mocked(verifyWorkspaceAccess)).toHaveBeenCalledWith(
        "ws_001",
        SESSION.currentAccountId
      );
    });

    it("formats date fields as ISO strings in response", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(WORKSPACE_ROW as never);

      const res = await app.request("/ws_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(body.data.attributes.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create workspace
  // -------------------------------------------------------------------------
  describe("POST / - create workspace", () => {
    beforeEach(() => {
      // insert for workspaces table
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      // select to refetch the newly created workspace
      mockSelectForSingle(WORKSPACE_ROW);
    });

    it("returns 200 with newly created workspace on success", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workspace" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("ws_001");
      expect(body.data.type).toBe("workspace");
      expect(body.data.attributes.name).toBe("Design Team");
    });

    it("inserts workspace with generated ID and session accountId", async () => {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workspace", description: "A description" }),
      });

      const insertMock = vi.mocked(db.insert);
      expect(insertMock).toHaveBeenCalledTimes(2); // once for workspace, once for permission

      // mockReturnValue returns the SAME object; both .values() calls go to the same spy.
      // Call index 0 = workspace, call index 1 = permission.
      const valuesspy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesspy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.accountId).toBe(SESSION.currentAccountId);
      expect(callArg.name).toBe("New Workspace");
      expect(callArg.description).toBe("A description");
    });

    it("grants full_access permission to the creator", async () => {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workspace" }),
      });

      const insertMock = vi.mocked(db.insert);
      // mockReturnValue returns the SAME object for all calls, so both
      // db.insert(...).values(...) calls go to the same `values` spy.
      // Call index 0 = workspace insert, call index 1 = permission insert.
      const valuesspy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      expect(valuesspy.mock.calls).toHaveLength(2);
      const permArg = valuesspy.mock.calls[1][0] as Record<string, unknown>;
      expect(permArg.userId).toBe(SESSION.userId);
      expect(permArg.permission).toBe("full_access");
    });

    it("sets description to null when not provided", async () => {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Description Workspace" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesspy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesspy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.description).toBeNull();
    });

    it("returns 500 when name is missing (ValidationError thrown)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "No name provided" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is not a string (ValidationError thrown)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 42 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string (ValidationError thrown)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      // Empty string is falsy, so the check `!body.name` triggers
      expect(res.status).toBe(500);
    });

    it("uses generateId to create workspace and permission IDs", async () => {
      const { generateId } = await import("../router.js");

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workspace" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(generateId)).toHaveBeenCalledWith("ws");
      expect(vi.mocked(generateId)).toHaveBeenCalledWith("wp");
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /:id - Update workspace
  // -------------------------------------------------------------------------
  describe("PATCH /:id - update workspace", () => {
    const UPDATED_ROW = {
      ...WORKSPACE_ROW,
      name: "Updated Name",
      updatedAt: new Date("2024-02-01T12:00:00.000Z"),
    };

    beforeEach(() => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(WORKSPACE_ROW as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      mockSelectForSingle(UPDATED_ROW);
    });

    it("returns 200 with updated workspace on success", async () => {
      const res = await app.request("/ws_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("ws_001");
      expect(body.data.type).toBe("workspace");
    });

    it("calls db.update with provided name", async () => {
      await app.request("/ws_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("updates description when provided", async () => {
      // Capture set arguments by wrapping the mock
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await app.request("/ws_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "New description" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ description: "New description" })
      );
    });

    it("includes updatedAt in the update set", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await app.request("/ws_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Changed" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
      expect(updates.name).toBe("Changed");
    });

    it("returns 500 when workspace is not found (NotFoundError thrown)", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null as never);

      const res = await app.request("/ws_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Won't matter" }),
      });

      expect(res.status).toBe(500);
    });

    it("calls verifyWorkspaceAccess with correct workspaceId and accountId", async () => {
      await app.request("/ws_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      });

      expect(vi.mocked(verifyWorkspaceAccess)).toHaveBeenCalledWith(
        "ws_001",
        SESSION.currentAccountId
      );
    });

    it("does not add name to updates when name is not in body", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await app.request("/ws_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Only description" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates).not.toHaveProperty("name");
      expect(updates.description).toBe("Only description");
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id - Delete workspace
  // -------------------------------------------------------------------------
  describe("DELETE /:id - delete workspace", () => {
    beforeEach(() => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(WORKSPACE_ROW as never);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful deletion", async () => {
      const res = await app.request("/ws_001", { method: "DELETE" });

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls db.delete once for the workspace", async () => {
      await app.request("/ws_001", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("calls verifyAccountMembership with userId, accountId, and content_admin role", async () => {
      await app.request("/ws_001", { method: "DELETE" });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        SESSION.userId,
        SESSION.currentAccountId,
        "content_admin"
      );
    });

    it("calls verifyWorkspaceAccess with correct workspaceId and accountId", async () => {
      await app.request("/ws_001", { method: "DELETE" });

      expect(vi.mocked(verifyWorkspaceAccess)).toHaveBeenCalledWith(
        "ws_001",
        SESSION.currentAccountId
      );
    });

    it("returns 500 when user is not authorized (AuthorizationError thrown)", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/ws_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not check workspace access when authorization fails", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      await app.request("/ws_001", { method: "DELETE" });

      // verifyWorkspaceAccess should NOT have been called since we fail early
      expect(vi.mocked(verifyWorkspaceAccess)).not.toHaveBeenCalled();
    });

    it("returns 500 when workspace is not found (NotFoundError thrown)", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null as never);

      const res = await app.request("/ws_missing", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when workspace is not found", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null as never);

      await app.request("/ws_missing", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("allows content_admin role to delete workspace", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      const res = await app.request("/ws_001", { method: "DELETE" });

      expect(res.status).toBe(204);
    });
  });
});
