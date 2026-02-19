/**
 * Bush Platform - Metadata Routes Tests
 *
 * Comprehensive unit tests for metadata API routes.
 * Reference: specs/17-api-complete.md Section 6.10
 */

// Mock all dependencies BEFORE any imports
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../db/schema.js", () => ({
  files: {
    id: "id",
    projectId: "projectId",
    name: "name",
    originalName: "originalName",
    mimeType: "mimeType",
    fileSizeBytes: "fileSizeBytes",
    technicalMetadata: "technicalMetadata",
    rating: "rating",
    assetStatus: "assetStatus",
    keywords: "keywords",
    notes: "notes",
    assigneeId: "assigneeId",
    customMetadata: "customMetadata",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
  },
  users: {
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
  },
  customFields: {
    id: "id",
    accountId: "accountId",
    type: "type",
    name: "name",
    options: "options",
    isVisibleByDefault: "isVisibleByDefault",
  },
  customFieldVisibility: {
    customFieldId: "customFieldId",
    projectId: "projectId",
    isVisible: "isVisible",
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyProjectAccess: vi.fn(),
  verifyAccountMembership: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn(),
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  isNull: vi.fn((col: any) => col),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./metadata.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess, verifyAccountMembership } from "../access-control.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner",
};

const mockFile = {
  id: "file_123",
  projectId: "prj_123",
  name: "test-video.mp4",
  originalName: "test-video.mp4",
  mimeType: "video/mp4",
  fileSizeBytes: 1024000,
  technicalMetadata: { width: 1920, height: 1080, duration: 120 },
  rating: 3,
  assetStatus: "approved",
  keywords: ["test", "video"],
  notes: "Test notes",
  assigneeId: "usr_456",
  customMetadata: { cf_1: "value1" },
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockAssignee = {
  id: "usr_456",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
};

const mockCustomField = {
  id: "cf_1",
  accountId: "acc_123",
  type: "text",
  name: "Description",
  options: null,
  isVisibleByDefault: true,
};

const mockCustomFieldSelect = {
  id: "cf_2",
  accountId: "acc_123",
  type: "single_select",
  name: "Priority",
  options: ["low", "medium", "high"],
  isVisibleByDefault: true,
};

// ---------------------------------------------------------------------------
// Mock chain helpers
// ---------------------------------------------------------------------------

/**
 * Creates a select chain mock that resolves with `rows`.
 *
 * Supports all chaining patterns used in metadata.ts:
 *   - .from().where().limit(1)          → destructured single row [row]
 *   - .from().where()                   → awaited as full array (no .limit)
 *   - .select({...}).from().where().limit(1)
 *
 * The .where() thenable (Promise-like) allows the route to await
 * .from().where() without chaining .limit(), returning the full rows array.
 */
function makeSelectChain(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const orderByFn = vi.fn(() => ({ limit: limitFn }));

  // whereFn must be both callable (returning chain) AND thenable (awaitable directly)
  const whereFn = vi.fn(() => {
    const chain = {
      limit: limitFn,
      orderBy: orderByFn,
      then: (resolve: (v: unknown) => void) => resolve(rows),
      catch: (_reject: (e: unknown) => void) => chain,
    };
    return chain;
  });

  const fromFn = vi.fn(() => ({ where: whereFn, limit: limitFn }));
  return { from: fromFn } as never;
}

/**
 * Creates an update chain mock.
 */
function makeUpdateChain() {
  return {
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Metadata Routes", () => {
  beforeEach(() => {
    // vi.resetAllMocks() is required (not clearAllMocks) because clearAllMocks does NOT
    // flush the mockReturnValueOnce queue, which causes stale queued return values to
    // bleed into subsequent tests via the shared db.select mock.
    vi.resetAllMocks();
    // Re-establish required mock defaults after reset clears all implementations.
    vi.mocked(requireAuth).mockReturnValue(mockSession as never);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ project: {} as never, workspace: {} as never });
    vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
  });

  // -------------------------------------------------------------------------
  // GET /files/:fileId/metadata - Get all metadata
  // -------------------------------------------------------------------------
  describe("GET /files/:fileId/metadata - get all metadata", () => {
    it("returns 200 with full metadata (technical, builtin, custom) on success", async () => {
      // 1. Get file
      // 2. Get assignee
      // 3. Get custom fields
      // 4. Get visibility overrides
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("file_123");
      expect(body.data.type).toBe("metadata");
    });

    it("returns technical metadata fields in attributes.technical", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.technical).toEqual({ width: 1920, height: 1080, duration: 120 });
    });

    it("returns builtin editable metadata in attributes.builtin", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const builtin = body.data.attributes.builtin;

      expect(builtin.rating).toBe(3);
      expect(builtin.status).toBe("approved");
      expect(builtin.keywords).toEqual(["test", "video"]);
      expect(builtin.notes).toBe("Test notes");
    });

    it("returns assignee info in builtin.assignee when assigneeId is set", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const assignee = body.data.attributes.builtin.assignee;

      expect(assignee).not.toBeNull();
      expect(assignee.id).toBe("usr_456");
      expect(assignee.first_name).toBe("Jane");
      expect(assignee.last_name).toBe("Doe");
      expect(assignee.email).toBe("jane@example.com");
    });

    it("returns null assignee when file has no assigneeId", async () => {
      const fileWithoutAssignee = { ...mockFile, assigneeId: null };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithoutAssignee]))
        // No assignee select call because assigneeId is null
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.builtin.assignee).toBeNull();
    });

    it("skips assignee query when assigneeId is null", async () => {
      const fileWithoutAssignee = { ...mockFile, assigneeId: null };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithoutAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))   // custom fields
        .mockReturnValueOnce(makeSelectChain([]));  // visibility overrides

      await app.request("/files/file_123/metadata", { method: "GET" });

      // Should be called 3 times: file + custom fields + visibility (NOT assignee)
      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(3);
    });

    it("returns file info in attributes.file", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const fileInfo = body.data.attributes.file;

      expect(fileInfo.id).toBe("file_123");
      expect(fileInfo.name).toBe("test-video.mp4");
      expect(fileInfo.original_name).toBe("test-video.mp4");
      expect(fileInfo.mime_type).toBe("video/mp4");
      expect(fileInfo.file_size_bytes).toBe(1024000);
    });

    it("returns 500 when file is not found", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await app.request("/files/file_123/metadata", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns only visible custom fields (isVisibleByDefault: true)", async () => {
      const visibleField = { ...mockCustomField, id: "cf_visible", isVisibleByDefault: true };
      const hiddenField = { ...mockCustomField, id: "cf_hidden", isVisibleByDefault: false };
      const fileWithCustom = { ...mockFile, assigneeId: null, customMetadata: { cf_visible: "val" } };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithCustom]))
        .mockReturnValueOnce(makeSelectChain([visibleField, hiddenField]))
        .mockReturnValueOnce(makeSelectChain([])); // no overrides

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const custom = body.data.attributes.custom;

      expect(custom).toHaveProperty("cf_visible");
      expect(custom).not.toHaveProperty("cf_hidden");
    });

    it("uses visibility override to show a field that is hidden by default", async () => {
      const hiddenByDefaultField = { ...mockCustomField, id: "cf_hidden_default", isVisibleByDefault: false };
      const fileWithCustom = { ...mockFile, assigneeId: null, customMetadata: {} };
      const visibilityOverride = { customFieldId: "cf_hidden_default", projectId: "prj_123", isVisible: true };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithCustom]))
        .mockReturnValueOnce(makeSelectChain([hiddenByDefaultField]))
        .mockReturnValueOnce(makeSelectChain([visibilityOverride]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const custom = body.data.attributes.custom;

      // Field should be visible due to override
      expect(custom).toHaveProperty("cf_hidden_default");
    });

    it("uses visibility override to hide a field that is visible by default", async () => {
      const visibleByDefaultField = { ...mockCustomField, id: "cf_visible_default", isVisibleByDefault: true };
      const fileWithCustom = { ...mockFile, assigneeId: null, customMetadata: { cf_visible_default: "val" } };
      const visibilityOverride = { customFieldId: "cf_visible_default", projectId: "prj_123", isVisible: false };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithCustom]))
        .mockReturnValueOnce(makeSelectChain([visibleByDefaultField]))
        .mockReturnValueOnce(makeSelectChain([visibilityOverride]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const custom = body.data.attributes.custom;

      // Field should be hidden due to override
      expect(custom).not.toHaveProperty("cf_visible_default");
    });

    it("returns null value for custom field with no stored value", async () => {
      const fileWithNoCustom = { ...mockFile, assigneeId: null, customMetadata: {} };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithNoCustom]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const custom = body.data.attributes.custom;

      expect(custom[mockCustomField.id].value).toBeNull();
    });

    it("returns stored custom field value when it exists", async () => {
      const fileWithCustom = { ...mockFile, assigneeId: null, customMetadata: { cf_1: "stored-value" } };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithCustom]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;
      const custom = body.data.attributes.custom;

      expect(custom["cf_1"].value).toBe("stored-value");
    });

    it("calls requireAuth to authenticate the request", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      await app.request("/files/file_123/metadata", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("calls verifyProjectAccess with file's projectId", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockAssignee]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      await app.request("/files/file_123/metadata", { method: "GET" });

      expect(vi.mocked(verifyProjectAccess)).toHaveBeenCalledWith("prj_123", "acc_123");
    });

    it("returns empty keywords array when file has null keywords", async () => {
      const fileWithNoKeywords = { ...mockFile, assigneeId: null, keywords: null };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithNoKeywords]))
        .mockReturnValueOnce(makeSelectChain([]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.builtin.keywords).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /files/:fileId/metadata - Update all metadata
  // -------------------------------------------------------------------------
  describe("PUT /files/:fileId/metadata - update all metadata", () => {

    it("returns 200 with updated file after updating rating", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([{ ...mockFile, rating: 5 }]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when rating is below 1", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 0 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when rating is above 5", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 6 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when rating is not a number", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: "five" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 200 after updating status", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([{ ...mockFile, assetStatus: "in_review" }]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_review" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after updating keywords", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([{ ...mockFile, keywords: ["new", "tags"] }]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: ["new", "tags"] }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when keywords is not an array of strings", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: [1, 2, 3] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when keywords is not an array", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: "tag1,tag2" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 200 after updating notes", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([{ ...mockFile, notes: "Updated notes" }]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Updated notes" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after updating assignee_id", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: "usr_789" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after clearing assignee_id with null", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([{ ...mockFile, assigneeId: null }]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: null }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when assignee_id belongs to a non-member", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(verifyAccountMembership).mockResolvedValue(null);

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: "usr_nonmember" }),
      });

      expect(res.status).toBe(500);
    });

    it("does not call verifyAccountMembership when assignee_id is null", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: null }),
      });

      expect(vi.mocked(verifyAccountMembership)).not.toHaveBeenCalled();
    });

    it("returns 200 after updating a custom field", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom: { cf_1: "new value" } }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when custom field ID is unknown", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField])); // only cf_1 exists

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom: { cf_unknown: "value" } }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3 }),
      });

      expect(res.status).toBe(500);
    });

    it("calls db.update once with correct file ID", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));

      const setCalled = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
      vi.mocked(db.update).mockReturnValue({ set: setCalled } as never);

      await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4 }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
      const calls = setCalled.mock.calls as unknown[][][];
      const updates = (calls[0]?.[0] as unknown as Record<string, unknown>) ?? {};
      expect(updates.rating).toBe(4);
    });

    it("includes updatedAt in the update payload", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));

      const setCalled = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
      vi.mocked(db.update).mockReturnValue({ set: setCalled } as never);

      await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "test" }),
      });

      const calls = setCalled.mock.calls as unknown[][][];
      const updates = (calls[0]?.[0] as unknown as Record<string, unknown>) ?? {};
      expect(updates.updatedAt).toBeInstanceOf(Date);
    });

    it("returns the response in JSON:API format with type 'file'", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "test" }),
      });

      const body = (await res.json()) as any;
      expect(body.data.type).toBe("file");
    });
  });

  // -------------------------------------------------------------------------
  // PUT /files/:fileId/metadata/:fieldId - Update single field
  // -------------------------------------------------------------------------
  describe("PUT /files/:fileId/metadata/:fieldId - update single field", () => {
    function setupUpdateFieldMocks(updatedFile?: typeof mockFile) {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([updatedFile ?? mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());
    }

    // --- Builtin fields ---

    it("returns 200 after updating builtin rating field", async () => {
      setupUpdateFieldMocks({ ...mockFile, rating: 5 });

      const res = await app.request("/files/file_123/metadata/rating", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 5 }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after updating builtin status field", async () => {
      setupUpdateFieldMocks({ ...mockFile, assetStatus: "rejected" });

      const res = await app.request("/files/file_123/metadata/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "rejected" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after updating builtin keywords field", async () => {
      setupUpdateFieldMocks({ ...mockFile, keywords: ["tag-a", "tag-b"] });

      const res = await app.request("/files/file_123/metadata/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: ["tag-a", "tag-b"] }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after updating builtin notes field", async () => {
      setupUpdateFieldMocks({ ...mockFile, notes: "Updated notes" });

      const res = await app.request("/files/file_123/metadata/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Updated notes" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after updating builtin assignee_id field", async () => {
      setupUpdateFieldMocks({ ...mockFile, assigneeId: "usr_789" });

      const res = await app.request("/files/file_123/metadata/assignee_id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "usr_789" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 after clearing assignee_id to null", async () => {
      setupUpdateFieldMocks({ ...mockFile, assigneeId: null } as any);

      const res = await app.request("/files/file_123/metadata/assignee_id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: null }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when rating value is invalid (out of range)", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata/rating", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 10 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when keywords value contains non-strings", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));

      const res = await app.request("/files/file_123/metadata/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: [1, 2] }),
      });

      expect(res.status).toBe(500);
    });

    // --- Custom fields ---

    it("returns 200 after updating a custom field (text type)", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))  // custom field lookup
        .mockReturnValueOnce(makeSelectChain([mockFile]));         // fetch updated file
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "hello" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when custom field ID does not exist", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([])); // field not found

      const res = await app.request("/files/file_123/metadata/cf_unknown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "hello" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when custom text field receives a non-string value", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField])); // type: text

      const res = await app.request("/files/file_123/metadata/cf_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 42 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when custom number field receives a non-number value", async () => {
      const numberField = { ...mockCustomField, id: "cf_num", type: "number" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([numberField]));

      const res = await app.request("/files/file_123/metadata/cf_num", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "not-a-number" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when custom url field receives an invalid URL", async () => {
      const urlField = { ...mockCustomField, id: "cf_url", type: "url" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([urlField]));

      const res = await app.request("/files/file_123/metadata/cf_url", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "not-a-valid-url" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 200 when custom url field receives a valid URL", async () => {
      const urlField = { ...mockCustomField, id: "cf_url", type: "url" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([urlField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_url", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "https://example.com" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when single_select field receives an invalid option", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomFieldSelect]));

      const res = await app.request("/files/file_123/metadata/cf_2", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "critical" }), // not in options
      });

      expect(res.status).toBe(500);
    });

    it("returns 200 when single_select field receives a valid option", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomFieldSelect]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_2", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "high" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when checkbox field receives a non-boolean value", async () => {
      const checkboxField = { ...mockCustomField, id: "cf_check", type: "checkbox" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([checkboxField]));

      const res = await app.request("/files/file_123/metadata/cf_check", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "true" }), // string, not boolean
      });

      expect(res.status).toBe(500);
    });

    it("returns 200 when checkbox field receives a boolean value", async () => {
      const checkboxField = { ...mockCustomField, id: "cf_check", type: "checkbox" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([checkboxField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_check", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: true }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 200 when clearing custom field with null value", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: null }),
      });

      expect(res.status).toBe(200);
    });

    it("removes custom field from customMetadata when value is null", async () => {
      const fileWithCustom = { ...mockFile, customMetadata: { cf_1: "existing-value" } };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([fileWithCustom]))
        .mockReturnValueOnce(makeSelectChain([mockCustomField]))
        .mockReturnValueOnce(makeSelectChain([fileWithCustom]));

      const setCalled = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
      vi.mocked(db.update).mockReturnValue({ set: setCalled } as never);

      await app.request("/files/file_123/metadata/cf_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: null }),
      });

      const calls = setCalled.mock.calls as unknown[][][];
      const updates = (calls[0]?.[0] as unknown as Record<string, Record<string, unknown>>) ?? {};
      expect(updates.customMetadata).not.toHaveProperty("cf_1");
    });

    it("returns 500 when file is not found", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/files/file_123/metadata/rating", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 3 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no project access on single field update", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await app.request("/files/file_123/metadata/rating", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 3 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns the response in JSON:API format with type 'file'", async () => {
      setupUpdateFieldMocks();

      const res = await app.request("/files/file_123/metadata/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "some note" }),
      });

      const body = (await res.json()) as any;
      expect(body.data.type).toBe("file");
    });

    it("calls db.update once for builtin field updates", async () => {
      setupUpdateFieldMocks();

      await app.request("/files/file_123/metadata/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "a note" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when custom field belongs to a different account", async () => {
      const foreignField = { ...mockCustomField, accountId: "acc_other" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([foreignField]));

      const res = await app.request("/files/file_123/metadata/cf_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "hello" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // validateCustomFieldValue (tested via route behavior)
  // -------------------------------------------------------------------------
  describe("validateCustomFieldValue - validation rules via route", () => {
    it("accepts null value for any field type (clears the field)", async () => {
      const numberField = { ...mockCustomField, id: "cf_num", type: "number" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([numberField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_num", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: null }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when number field receives a string (non-number)", async () => {
      const numberField = { ...mockCustomField, id: "cf_num", type: "number" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([numberField]));

      const res = await app.request("/files/file_123/metadata/cf_num", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "42" }), // string, not a number
      });

      expect(res.status).toBe(500);
    });

    it("accepts valid date ISO string for date field", async () => {
      const dateField = { ...mockCustomField, id: "cf_date", type: "date" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([dateField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_date", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "2024-06-15" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when date field receives an invalid date string", async () => {
      const dateField = { ...mockCustomField, id: "cf_date", type: "date" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([dateField]));

      const res = await app.request("/files/file_123/metadata/cf_date", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "not-a-date" }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts valid multi_select value (array of valid options)", async () => {
      const multiField = {
        ...mockCustomField,
        id: "cf_multi",
        type: "multi_select",
        options: ["opt1", "opt2", "opt3"],
      };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([multiField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_multi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: ["opt1", "opt3"] }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when multi_select value contains an invalid option", async () => {
      const multiField = {
        ...mockCustomField,
        id: "cf_multi",
        type: "multi_select",
        options: ["opt1", "opt2"],
      };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([multiField]));

      const res = await app.request("/files/file_123/metadata/cf_multi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: ["opt1", "invalid_opt"] }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts valid rating field value (integer 1-5)", async () => {
      const ratingField = { ...mockCustomField, id: "cf_rating", type: "rating" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([ratingField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_rating", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 4 }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when rating custom field receives a float", async () => {
      const ratingField = { ...mockCustomField, id: "cf_rating", type: "rating" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([ratingField]));

      const res = await app.request("/files/file_123/metadata/cf_rating", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 3.5 }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts textarea field value (string)", async () => {
      const textareaField = { ...mockCustomField, id: "cf_textarea", type: "textarea" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([textareaField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_textarea", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Long text goes here..." }),
      });

      expect(res.status).toBe(200);
    });

    it("accepts user field value (string user ID)", async () => {
      const userField = { ...mockCustomField, id: "cf_user", type: "user" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockFile]))
        .mockReturnValueOnce(makeSelectChain([userField]))
        .mockReturnValueOnce(makeSelectChain([mockFile]));
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/files/file_123/metadata/cf_user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "usr_789" }),
      });

      expect(res.status).toBe(200);
    });
  });
});
