/**
 * Bush Platform - Version Stack Routes Tests
 *
 * Comprehensive unit tests for version stack API routes.
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
  files: {
    id: "id",
    projectId: "projectId",
    versionStackId: "versionStackId",
    deletedAt: "deletedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    name: "name",
  },
  versionStacks: {
    id: "id",
    projectId: "projectId",
    name: "name",
    currentFileId: "currentFileId",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("vstack_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  lt: vi.fn((field, val) => ({ type: "lt", field, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  isNull: vi.fn((field) => ({ type: "isNull", field })),
  inArray: vi.fn((field, vals) => ({ type: "inArray", field, vals })),
}));

vi.mock("./comments.js", () => ({
  getVersionStackComments: vi.fn(async (c: { json: (v: unknown) => unknown }) =>
    c.json({ data: [] })
  ),
  createVersionStackComment: vi.fn(async (c: { json: (v: unknown) => unknown }) =>
    c.json({ data: { id: "cmt_001", type: "comment" } })
  ),
}));

vi.mock("../response.js", () => ({
  sendSingle: vi.fn((c, data, type) =>
    c.json({ data: { id: data.id, type, attributes: data } })
  ),
  sendCollection: vi.fn((c, items, type, opts) =>
    c.json({
      data: items.map((item: Record<string, unknown>) => ({ id: item.id, type, attributes: item })),
      meta: {
        total_count: opts?.totalCount ?? items.length,
        page_size: opts?.limit ?? 50,
        has_more: (opts?.totalCount ?? items.length) > (opts?.limit ?? 50),
      },
      links: { self: opts?.basePath ?? "/" },
    })
  ),
  sendNoContent: vi.fn((c) => c.body(null, 204)),
  RESOURCE_TYPES: {
    VERSION_STACK: "version_stack",
    FILE: "file",
  },
  formatDates: vi.fn((obj) => {
    const result: Record<string, unknown> = { ...obj };
    for (const key of Object.keys(result)) {
      if (result[key] instanceof Date) {
        result[key] = (result[key] as Date).toISOString();
      }
    }
    return result;
  }),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./version-stacks.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";
import { getVersionStackComments, createVersionStackComment } from "./comments.js";
import { sendSingle, sendCollection, sendNoContent, formatDates } from "../response.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner",
  sessionId: "ses_111",
};

const STACK_ROW = {
  id: "vstack_001",
  name: "Design Versions",
  projectId: "proj_001",
  currentFileId: null as string | null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const STACK_ROW_WITH_CURRENT = {
  ...STACK_ROW,
  currentFileId: "file_001",
};

const FILE_ROW = {
  id: "file_001",
  projectId: "proj_001",
  versionStackId: "vstack_001",
  name: "design.png",
  deletedAt: null,
  createdAt: new Date("2024-01-15T09:00:00.000Z"),
  updatedAt: new Date("2024-01-15T09:00:00.000Z"),
};

const FILE_ROW_2 = {
  id: "file_002",
  projectId: "proj_001",
  versionStackId: "vstack_001",
  name: "design-v2.png",
  deletedAt: null,
  createdAt: new Date("2024-01-16T09:00:00.000Z"),
  updatedAt: new Date("2024-01-16T09:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Creates a select mock that cycles through multiple return values.
 * Each element in `calls` corresponds to one db.select() call in order.
 */
function mockSelectSequence(calls: unknown[][]) {
  let callIndex = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const result = calls[callIndex] ?? [];
    callIndex++;
    return {
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(result),
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    } as never;
  });
}

/**
 * Creates a select mock that returns the same value for every call.
 */
function mockSelectAlways(rows: unknown[]) {
  vi.mocked(db.select).mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
      orderBy: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never));
}

/**
 * Creates a select mock for the GET /:id route which needs:
 * 1st call: stack lookup
 * 2nd call: files in stack
 */
function mockSelectForGetStack(stack: typeof STACK_ROW | null, stackFiles: typeof FILE_ROW[]) {
  let callIndex = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) {
      // Stack lookup - returns single item
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(stack ? [stack] : []),
          }),
        }),
      } as never;
    }
    // Files lookup - no limit, uses orderBy
    return {
      from: () => ({
        where: () => ({
          orderBy: vi.fn().mockResolvedValue(stackFiles),
          limit: vi.fn().mockResolvedValue(stackFiles),
        }),
      }),
    } as never;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Version Stack Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("vstack_test123");
    vi.mocked(parseLimit).mockReturnValue(50);

    // Re-set response mocks since resetAllMocks wipes them
    vi.mocked(sendSingle).mockImplementation((c, data, type) =>
      (c as { json: (v: unknown) => unknown }).json({ data: { id: (data as Record<string, unknown>).id, type, attributes: data } })
    );
    vi.mocked(sendCollection).mockImplementation((c, items, type, opts) =>
      (c as { json: (v: unknown) => unknown }).json({
        data: (items as Record<string, unknown>[]).map((item) => ({ id: item.id, type, attributes: item })),
        meta: {
          total_count: (opts as { totalCount?: number })?.totalCount ?? (items as unknown[]).length,
          page_size: (opts as { limit?: number })?.limit ?? 50,
          has_more:
            ((opts as { totalCount?: number })?.totalCount ?? (items as unknown[]).length) >
            ((opts as { limit?: number })?.limit ?? 50),
        },
        links: { self: (opts as { basePath?: string })?.basePath ?? "/" },
      })
    );
    vi.mocked(sendNoContent).mockImplementation((c) =>
      (c as { body: (b: null, s: number) => unknown }).body(null, 204)
    );
    vi.mocked(formatDates).mockImplementation((obj) => {
      const result: Record<string, unknown> = { ...(obj as object) };
      for (const key of Object.keys(result)) {
        if (result[key] instanceof Date) {
          result[key] = (result[key] as Date).toISOString();
        }
      }
      return result;
    });

    // Re-set comments mocks
    vi.mocked(getVersionStackComments).mockImplementation(async (c) =>
      (c as { json: (v: unknown) => unknown }).json({ data: [] })
    );
    vi.mocked(createVersionStackComment).mockImplementation(async (c) =>
      (c as { json: (v: unknown) => unknown }).json({ data: { id: "cmt_001", type: "comment" } })
    );
  });

  // -------------------------------------------------------------------------
  // GET /:id - Get version stack details
  // -------------------------------------------------------------------------
  describe("GET /:id - get version stack by ID", () => {
    it("returns 200 with stack data and included files", async () => {
      mockSelectForGetStack(STACK_ROW, [FILE_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("vstack_001");
      expect(body.data.type).toBe("version_stack");
    });

    it("includes relationships with files array", async () => {
      mockSelectForGetStack(STACK_ROW, [FILE_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.relationships.files.data).toHaveLength(1);
      expect(body.data.relationships.files.data[0].id).toBe("file_001");
      expect(body.data.relationships.files.data[0].type).toBe("file");
    });

    it("includes current_file relationship when currentFileId is set", async () => {
      mockSelectForGetStack(STACK_ROW_WITH_CURRENT, [FILE_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.relationships.current_file.data).not.toBeNull();
      expect(body.data.relationships.current_file.data.id).toBe("file_001");
      expect(body.data.relationships.current_file.data.type).toBe("file");
    });

    it("returns null current_file relationship when currentFileId is null", async () => {
      mockSelectForGetStack(STACK_ROW, []);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.relationships.current_file.data).toBeNull();
    });

    it("includes stack files in the included array", async () => {
      mockSelectForGetStack(STACK_ROW, [FILE_ROW, FILE_ROW_2]);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001", { method: "GET" });
      const body = await res.json();

      expect(body.included).toHaveLength(2);
      expect(body.included[0].type).toBe("file");
      expect(body.included[1].type).toBe("file");
    });

    it("returns 500 when stack is not found", async () => {
      mockSelectForGetStack(null, []);

      const res = await app.request("/vstack_missing", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      mockSelectForGetStack(STACK_ROW, []);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("calls verifyProjectAccess with stack projectId and accountId", async () => {
      mockSelectForGetStack(STACK_ROW, []);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      await app.request("/vstack_001", { method: "GET" });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        "proj_001",
        SESSION.currentAccountId
      );
    });

    it("calls requireAuth", async () => {
      mockSelectForGetStack(STACK_ROW, []);
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      await app.request("/vstack_001", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create version stack
  // -------------------------------------------------------------------------
  describe("POST / - create version stack", () => {
    beforeEach(() => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      mockSelectAlways([STACK_ROW]);
    });

    it("returns 200 with newly created stack on success", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_001", name: "My Stack" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toBeDefined();
      expect(body.data.type).toBe("version_stack");
    });

    it("calls db.insert with correct values", async () => {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_001", name: "My Stack" }),
      });

      const insertMock = vi.mocked(db.insert);
      expect(insertMock).toHaveBeenCalled();
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const callArg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.projectId).toBe("proj_001");
      expect(callArg.name).toBe("My Stack");
      expect(callArg.currentFileId).toBeNull();
    });

    it("uses generateId to generate a stack ID", async () => {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_001", name: "My Stack" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("vstack");
    });

    it("returns 500 when project_id is missing (ValidationError)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Stack" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project_id is not a string (ValidationError)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: 42, name: "My Stack" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is missing (ValidationError)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_001" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is not a string (ValidationError)", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_001", name: 123 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError)", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_missing", name: "My Stack" }),
      });

      expect(res.status).toBe(500);
    });

    it("calls verifyProjectAccess with project_id and accountId", async () => {
      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "proj_001", name: "My Stack" }),
      });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        "proj_001",
        SESSION.currentAccountId
      );
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /:id - Update version stack
  // -------------------------------------------------------------------------
  describe("PATCH /:id - update version stack", () => {
    const UPDATED_STACK = {
      ...STACK_ROW,
      name: "Updated Name",
      updatedAt: new Date("2024-02-01T12:00:00.000Z"),
    };

    beforeEach(() => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 200 with updated stack on success", async () => {
      // First call: stack lookup, second call: refetch updated stack
      mockSelectSequence([[STACK_ROW], [UPDATED_STACK]]);

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toBeDefined();
      expect(body.data.type).toBe("version_stack");
    });

    it("calls db.update once for the stack", async () => {
      mockSelectSequence([[STACK_ROW], [UPDATED_STACK]]);

      await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("includes name in updates when provided", async () => {
      mockSelectSequence([[STACK_ROW], [UPDATED_STACK]]);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Name" })
      );
    });

    it("includes updatedAt in updates", async () => {
      mockSelectSequence([[STACK_ROW], [UPDATED_STACK]]);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Changed" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
    });

    it("updates current_file_id when provided as a valid file in stack", async () => {
      // Sequence: 1st = stack lookup, 2nd = file verification, 3rd = refetch
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW_WITH_CURRENT]),
              }),
            }),
          } as never;
        }
        if (callIdx === 2) {
          // File verification - file exists in stack
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([FILE_ROW]),
              }),
            }),
          } as never;
        }
        // Refetch updated stack
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...STACK_ROW_WITH_CURRENT, currentFileId: "file_002" }]),
            }),
          }),
        } as never;
      });

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_file_id: "file_001" }),
      });

      expect(res.status).toBe(200);
      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ currentFileId: "file_001" })
      );
    });

    it("sets current_file_id to null when passed as null", async () => {
      mockSelectSequence([[STACK_ROW_WITH_CURRENT], [STACK_ROW]]);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_file_id: null }),
      });

      expect(res.status).toBe(200);
      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ currentFileId: null })
      );
    });

    it("returns 500 when stack is not found (NotFoundError)", async () => {
      mockSelectSequence([[]]);

      const res = await app.request("/vstack_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Won't matter" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError)", async () => {
      mockSelectSequence([[STACK_ROW]]);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string (ValidationError)", async () => {
      mockSelectSequence([[STACK_ROW]]);

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is not a string (ValidationError)", async () => {
      mockSelectSequence([[STACK_ROW]]);

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when current_file_id is not in the stack (ValidationError)", async () => {
      // Stack lookup returns stack, file verification returns empty
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        // File not found
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never;
      });

      const res = await app.request("/vstack_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_file_id: "file_999" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id - Delete version stack
  // -------------------------------------------------------------------------
  describe("DELETE /:id - delete version stack", () => {
    beforeEach(() => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful deletion", async () => {
      mockSelectAlways([STACK_ROW]);

      const res = await app.request("/vstack_001", { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("calls db.update to unstack all files before deleting", async () => {
      mockSelectAlways([STACK_ROW]);

      await app.request("/vstack_001", { method: "DELETE" });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("calls db.delete once for the stack", async () => {
      mockSelectAlways([STACK_ROW]);

      await app.request("/vstack_001", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when stack is not found (NotFoundError)", async () => {
      mockSelectAlways([]);

      const res = await app.request("/vstack_missing", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError)", async () => {
      mockSelectAlways([STACK_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when stack is not found", async () => {
      mockSelectAlways([]);

      await app.request("/vstack_missing", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("calls verifyProjectAccess with projectId and accountId", async () => {
      mockSelectAlways([STACK_ROW]);

      await app.request("/vstack_001", { method: "DELETE" });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        "proj_001",
        SESSION.currentAccountId
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/files - List files in version stack
  // -------------------------------------------------------------------------
  describe("GET /:id/files - list files in version stack", () => {
    it("returns 200 with collection of files", async () => {
      // 1st call: stack lookup, 2nd call: files list
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([FILE_ROW, FILE_ROW_2]),
              }),
            }),
          }),
        } as never;
      });
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001/files", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns empty data when no files in stack", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never;
      });
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001/files", { method: "GET" });
      const body = await res.json();

      expect(body.data).toHaveLength(0);
    });

    it("returns 500 when stack is not found", async () => {
      mockSelectAlways([]);

      const res = await app.request("/vstack_missing/files", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      mockSelectAlways([STACK_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001/files", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("calls parseLimit to get pagination limit", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never;
      });
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      await app.request("/vstack_001/files?limit=10", { method: "GET" });

      expect(vi.mocked(parseLimit)).toHaveBeenCalled();
    });

    it("includes basePath in collection response links", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([FILE_ROW]),
              }),
            }),
          }),
        } as never;
      });
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      const res = await app.request("/vstack_001/files", { method: "GET" });
      const body = await res.json();

      expect(body.links.self).toBe("/v4/version-stacks/vstack_001/files");
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/files - Add file to version stack
  // -------------------------------------------------------------------------
  describe("POST /:id/files - add file to version stack", () => {
    beforeEach(() => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 200 with updated file on success", async () => {
      // Sequence: 1st = stack, 2nd = file lookup, 3rd = updated file refetch
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        if (callIdx === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ ...FILE_ROW, versionStackId: null }]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([FILE_ROW]),
            }),
          }),
        } as never;
      });

      const res = await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.type).toBe("file");
    });

    it("sets file as current when stack has no current file", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]), // no currentFileId
              }),
            }),
          } as never;
        }
        if (callIdx === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ ...FILE_ROW, versionStackId: null }]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([FILE_ROW]),
            }),
          }),
        } as never;
      });

      await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      // db.update should be called twice: once for file, once for stack currentFileId
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(2);
    });

    it("does not update currentFileId when stack already has one", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW_WITH_CURRENT]),
              }),
            }),
          } as never;
        }
        if (callIdx === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ ...FILE_ROW_2, versionStackId: null }]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([FILE_ROW_2]),
            }),
          }),
        } as never;
      });

      await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_002" }),
      });

      // Only one update for the file (not for stack currentFileId)
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when file_id is missing (ValidationError)", async () => {
      const res = await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_id is not a string (ValidationError)", async () => {
      const res = await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: 123 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when stack is not found (NotFoundError)", async () => {
      mockSelectAlways([]);

      const res = await app.request("/vstack_missing/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError)", async () => {
      mockSelectAlways([STACK_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found (NotFoundError)", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never;
      });

      const res = await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_missing" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is already in a different stack (ValidationError)", async () => {
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([STACK_ROW]),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...FILE_ROW, versionStackId: "vstack_other" }]),
            }),
          }),
        } as never;
      });

      const res = await app.request("/vstack_001/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id/files/:fileId - Remove file from version stack
  // -------------------------------------------------------------------------
  describe("DELETE /:id/files/:fileId - remove file from version stack", () => {
    beforeEach(() => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 204 No Content on successful removal", async () => {
      // Stack lookup, file lookup
      mockSelectSequence([[STACK_ROW], [FILE_ROW]]);

      const res = await app.request("/vstack_001/files/file_001", { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("calls db.update to unstack the file", async () => {
      mockSelectSequence([[STACK_ROW], [FILE_ROW]]);

      await app.request("/vstack_001/files/file_001", { method: "DELETE" });

      expect(vi.mocked(db.update)).toHaveBeenCalled();
    });

    it("updates stack currentFileId when removed file was the current file", async () => {
      // Stack has currentFileId = file_001, and we remove file_001
      const stackWithCurrent = { ...STACK_ROW, currentFileId: "file_001" };
      const fileBeingRemoved = { ...FILE_ROW, id: "file_001" };

      // Sequence: 1st = stack, 2nd = file, 3rd = next current candidate
      let callIdx = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([stackWithCurrent]),
              }),
            }),
          } as never;
        }
        if (callIdx === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([fileBeingRemoved]),
              }),
            }),
          } as never;
        }
        // Next current candidate
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([FILE_ROW_2]),
              }),
            }),
          }),
        } as never;
      });

      await app.request("/vstack_001/files/file_001", { method: "DELETE" });

      // update called twice: once for file unstack, once for stack currentFileId
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(2);
    });

    it("does not update currentFileId when removed file is not current", async () => {
      const stackWithDifferentCurrent = { ...STACK_ROW, currentFileId: "file_002" };

      mockSelectSequence([[stackWithDifferentCurrent], [FILE_ROW]]);

      await app.request("/vstack_001/files/file_001", { method: "DELETE" });

      // Only one update for the file
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when stack is not found (NotFoundError)", async () => {
      mockSelectAlways([]);

      const res = await app.request("/vstack_missing/files/file_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError)", async () => {
      mockSelectAlways([STACK_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001/files/file_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found in the stack (NotFoundError)", async () => {
      mockSelectSequence([[STACK_ROW], []]);

      const res = await app.request("/vstack_001/files/file_missing", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not call db.update when file is not found", async () => {
      mockSelectSequence([[STACK_ROW], []]);

      await app.request("/vstack_001/files/file_missing", { method: "DELETE" });

      expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/set-current - Set current version
  // -------------------------------------------------------------------------
  describe("POST /:id/set-current - set current version", () => {
    beforeEach(() => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({ role: "member" } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 200 with updated stack on success", async () => {
      // Stack lookup, file verification, refetch
      mockSelectSequence([[STACK_ROW], [FILE_ROW], [STACK_ROW_WITH_CURRENT]]);

      const res = await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.type).toBe("version_stack");
    });

    it("calls db.update to set currentFileId", async () => {
      mockSelectSequence([[STACK_ROW], [FILE_ROW], [STACK_ROW_WITH_CURRENT]]);

      await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("includes file_id as currentFileId in the update", async () => {
      mockSelectSequence([[STACK_ROW], [FILE_ROW], [STACK_ROW_WITH_CURRENT]]);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ currentFileId: "file_001" })
      );
    });

    it("returns 500 when file_id is missing (ValidationError)", async () => {
      const res = await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_id is not a string (ValidationError)", async () => {
      const res = await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: 42 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when stack is not found (NotFoundError)", async () => {
      mockSelectAlways([]);

      const res = await app.request("/vstack_missing/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied (NotFoundError)", async () => {
      mockSelectAlways([STACK_ROW]);
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const res = await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not in the stack (ValidationError)", async () => {
      // Stack lookup returns stack, file lookup returns empty
      mockSelectSequence([[STACK_ROW], []]);

      const res = await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_not_in_stack" }),
      });

      expect(res.status).toBe(500);
    });

    it("calls verifyProjectAccess with projectId and accountId", async () => {
      mockSelectSequence([[STACK_ROW], [FILE_ROW], [STACK_ROW_WITH_CURRENT]]);

      await app.request("/vstack_001/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: "file_001" }),
      });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith(
        "proj_001",
        SESSION.currentAccountId
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/comments - List comments on version stack
  // -------------------------------------------------------------------------
  describe("GET /:id/comments - list comments", () => {
    it("returns 200 and delegates to getVersionStackComments handler", async () => {
      const res = await app.request("/vstack_001/comments", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toEqual([]);
      expect(vi.mocked(getVersionStackComments)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/comments - Create comment on version stack
  // -------------------------------------------------------------------------
  describe("POST /:id/comments - create comment", () => {
    it("returns 200 and delegates to createVersionStackComment handler", async () => {
      const res = await app.request("/vstack_001/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Nice version!" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.type).toBe("comment");
      expect(vi.mocked(createVersionStackComment)).toHaveBeenCalledTimes(1);
    });
  });
});
