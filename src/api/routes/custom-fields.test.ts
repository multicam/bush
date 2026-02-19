/**
 * Bush Platform - Custom Fields Routes Tests
 *
 * Comprehensive unit tests for custom field API routes.
 * Reference: specs/17-api-complete.md Section 6.10
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

vi.mock("../../db/schema.js", () => ({
  customFields: {
    id: "id",
    accountId: "accountId",
    name: "name",
    slug: "slug",
    type: "type",
    description: "description",
    options: "options",
    isVisibleByDefault: "isVisibleByDefault",
    editableBy: "editableBy",
    sortOrder: "sortOrder",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  customFieldVisibility: {
    id: "id",
    customFieldId: "customFieldId",
    projectId: "projectId",
    isVisible: "isVisible",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  accountMemberships: {
    id: "id",
    userId: "userId",
    accountId: "accountId",
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyAccountMembership: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("cf_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// drizzle-orm operators used in the route handlers - mock them as identity functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./custom-fields.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyAccountMembership } from "../access-control.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner",
};

const mockField = {
  id: "cf_123",
  accountId: "acc_123",
  name: "Priority",
  slug: "priority",
  type: "single_select",
  description: "Priority level",
  options: ["low", "medium", "high"],
  isVisibleByDefault: true,
  editableBy: "full_access",
  sortOrder: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// Mock chain helpers
// ---------------------------------------------------------------------------

/**
 * Creates a select chain mock that resolves with `rows`.
 * Supports chains like: .from().where().limit() and
 * .from().where().orderBy().limit()
 */
function makeSelectChain(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const orderByFn = vi.fn(() => ({ limit: limitFn }));
  const whereFn = vi.fn(() => ({ limit: limitFn, orderBy: orderByFn }));
  const fromFn = vi.fn(() => ({ where: whereFn }));
  return { from: fromFn } as never;
}

/**
 * Creates an insert chain mock.
 */
function makeInsertChain() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  } as never;
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

/**
 * Creates a delete chain mock.
 */
function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Custom Fields Routes", () => {
  beforeEach(() => {
    // vi.resetAllMocks() is required (not clearAllMocks) because clearAllMocks does NOT
    // flush the mockReturnValueOnce queue, which causes stale queued return values to
    // bleed into subsequent tests via the shared db.select mock.
    vi.resetAllMocks();
    // Re-establish the default requireAuth mock after reset clears all implementations.
    vi.mocked(requireAuth).mockReturnValue(mockSession as never);
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/custom_fields - List custom fields
  // -------------------------------------------------------------------------
  describe("GET /accounts/:accountId/custom_fields - list custom fields", () => {
    it("returns 200 with JSON:API collection when user is a member", async () => {
      // First select: membership check returns a membership
      // Second select: list of fields
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]))
        .mockReturnValueOnce(makeSelectChain([mockField]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.id).toBe("cf_123");
      expect(item.type).toBe("custom_field");
      expect(item.attributes.name).toBe("Priority");
      expect(item.attributes.slug).toBe("priority");
    });

    it("returns meta with total_count and page_size", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]))
        .mockReturnValueOnce(makeSelectChain([mockField]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "GET",
      });

      const body = await res.json();
      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
      expect(body.meta.has_more).toBe(false);
    });

    it("returns empty data array when account has no custom fields", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
    });

    it("returns 500 (NotFoundError) when user is not a member of the account", async () => {
      // Membership check returns empty array - user is not a member
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "GET",
      });

      expect(res.status).toBe(500);
    });

    it("calls requireAuth to authenticate the request", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]))
        .mockReturnValueOnce(makeSelectChain([]));

      await app.request("/accounts/acc_123/custom_fields", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("formats date fields as ISO strings in response", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]))
        .mockReturnValueOnce(makeSelectChain([mockField]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "GET",
      });
      const body = await res.json();

      expect(body.data[0].attributes.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(body.data[0].attributes.updatedAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // POST /accounts/:accountId/custom_fields - Create custom field
  // -------------------------------------------------------------------------
  describe("POST /accounts/:accountId/custom_fields - create custom field", () => {
    const validBody = {
      name: "Priority",
      type: "single_select",
      options: ["low", "medium", "high"],
    };

    function setupCreateMocks(overrides?: {
      memberRole?: string | null;
      existingSlug?: boolean;
      maxSort?: number | null;
    }) {
      const { memberRole = "owner", existingSlug = false, maxSort = null } =
        overrides ?? {};

      vi.mocked(verifyAccountMembership).mockResolvedValue(memberRole as never);

      // db.select calls in order for the POST handler:
      // 1. Duplicate slug check
      // 2. Max sort order
      // 3. Fetch created field
      vi.mocked(db.select)
        .mockReturnValueOnce(
          makeSelectChain(existingSlug ? [{ id: "cf_existing" }] : [])
        )
        .mockReturnValueOnce(
          makeSelectChain(
            maxSort !== null ? [{ sortOrder: maxSort }] : []
          )
        )
        .mockReturnValueOnce(makeSelectChain([mockField]));

      vi.mocked(db.insert).mockReturnValue(makeInsertChain());
    }

    it("returns 200 with newly created custom field on success", async () => {
      setupCreateMocks();

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("cf_123");
      expect(body.data.type).toBe("custom_field");
      expect(body.data.attributes.name).toBe("Priority");
    });

    it("calls db.insert with correct field values", async () => {
      setupCreateMocks();

      await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Priority",
          type: "single_select",
          options: ["low", "medium", "high"],
          description: "A priority field",
          is_visible_by_default: false,
          editable_by: "content_admin",
        }),
      });

      const insertMock = vi.mocked(db.insert);
      expect(insertMock).toHaveBeenCalledTimes(1);
      const valuesMock = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const insertedValues = valuesMock.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.accountId).toBe("acc_123");
      expect(insertedValues.name).toBe("Priority");
      expect(insertedValues.type).toBe("single_select");
      expect(insertedValues.description).toBe("A priority field");
      expect(insertedValues.isVisibleByDefault).toBe(false);
      expect(insertedValues.editableBy).toBe("content_admin");
    });

    it("generates slug from name when no slug is provided", async () => {
      setupCreateMocks();

      await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Custom Field",
          type: "text",
        }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesMock = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const insertedValues = valuesMock.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.slug).toBe("my_custom_field");
    });

    it("uses provided slug when given", async () => {
      setupCreateMocks();

      await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Priority",
          type: "text",
          slug: "custom_slug",
        }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesMock = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const insertedValues = valuesMock.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.slug).toBe("custom_slug");
    });

    it("calculates sortOrder as maxSort + 1 when fields already exist", async () => {
      setupCreateMocks({ maxSort: 4 });

      await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesMock = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const insertedValues = valuesMock.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.sortOrder).toBe(5);
    });

    it("sets sortOrder to 0 when no existing fields", async () => {
      setupCreateMocks({ maxSort: null });

      await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesMock = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const insertedValues = valuesMock.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.sortOrder).toBe(0);
    });

    it("returns 500 (ValidationError) when name is missing", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) when name is not a string", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123, type: "text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) when type is missing", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Priority" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) when type is invalid", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Priority", type: "invalid_type" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) when slug already exists", async () => {
      setupCreateMocks({ existingSlug: true });

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Priority", type: "text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (AuthorizationError) when user is not admin", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) for single_select field without options", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      // Duplicate slug check returns empty (no existing)
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Priority", type: "single_select" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) for multi_select field without options", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      // Duplicate slug check returns empty (no existing)
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tags", type: "multi_select" }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts all valid field types without throwing", async () => {
      const validTypes = [
        "text", "textarea", "number", "date",
        "checkbox", "user", "url", "rating",
      ];

      for (const type of validTypes) {
        vi.resetAllMocks();
        vi.mocked(requireAuth).mockReturnValue(mockSession as never);
        setupCreateMocks();

        const res = await app.request("/accounts/acc_123/custom_fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Field", type }),
        });

        expect(res.status).toBe(200);
      }
    });

    it("calls verifyAccountMembership with content_admin role", async () => {
      setupCreateMocks();

      await app.request("/accounts/acc_123/custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        mockSession.userId,
        "acc_123",
        "content_admin"
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /custom_fields/:id - Get custom field definition
  // -------------------------------------------------------------------------
  describe("GET /custom_fields/:id - get custom field by ID", () => {
    it("returns 200 with JSON:API single resource on success", async () => {
      // First select: get the field
      // Second select: membership check
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockField]))
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]));

      const res = await app.request("/custom_fields/cf_123", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("cf_123");
      expect(body.data.type).toBe("custom_field");
      expect(body.data.attributes.name).toBe("Priority");
      expect(body.data.attributes.slug).toBe("priority");
    });

    it("formats date fields as ISO strings in response", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockField]))
        .mockReturnValueOnce(makeSelectChain([{ id: "mem_123" }]));

      const res = await app.request("/custom_fields/cf_123", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(body.data.attributes.updatedAt).toBe("2024-01-01T00:00:00.000Z");
    });

    it("returns 500 (NotFoundError) when field does not exist", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/custom_fields/cf_missing", {
        method: "GET",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (NotFoundError) when user is not a member of the account", async () => {
      // Field exists, but membership check fails
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockField]))
        .mockReturnValueOnce(makeSelectChain([]));

      const res = await app.request("/custom_fields/cf_123", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("does not check membership when field is not found", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));

      await app.request("/custom_fields/cf_missing", { method: "GET" });

      // Only one select call (for the field lookup); membership is never queried
      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /custom_fields/:id - Update custom field definition
  // -------------------------------------------------------------------------
  describe("PUT /custom_fields/:id - update custom field", () => {
    const updatedField = {
      ...mockField,
      name: "Updated Priority",
      updatedAt: new Date("2024-06-01"),
    };

    function setupUpdateMocks(overrides?: {
      fieldExists?: boolean;
      memberRole?: string | null;
      updatedRow?: typeof mockField;
    }) {
      const {
        fieldExists = true,
        memberRole = "owner",
        updatedRow = updatedField,
      } = overrides ?? {};

      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain(fieldExists ? [mockField] : []))
        .mockReturnValueOnce(makeSelectChain([updatedRow]));

      vi.mocked(verifyAccountMembership).mockResolvedValue(memberRole as never);
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());
    }

    it("returns 200 with updated field on success", async () => {
      setupUpdateMocks();

      const res = await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Priority" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("cf_123");
      expect(body.data.type).toBe("custom_field");
    });

    it("calls db.update with provided name", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockField]))
        .mockReturnValueOnce(makeSelectChain([updatedField]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Priority" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Priority" })
      );
    });

    it("includes updatedAt in the update set", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockField]))
        .mockReturnValueOnce(makeSelectChain([updatedField]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Priority" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
    });

    it("returns 500 (NotFoundError) when field does not exist", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/custom_fields/cf_missing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Won't matter" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (AuthorizationError) when user is not admin", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([mockField]));
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 (ValidationError) when setting options on a non-select field", async () => {
      const textField = { ...mockField, type: "text" };
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([textField]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: ["a", "b"] }),
      });

      expect(res.status).toBe(500);
    });

    it("allows setting options on a single_select field", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([mockField]))
        .mockReturnValueOnce(makeSelectChain([updatedField]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: ["low", "medium", "high", "critical"] }),
      });

      expect(res.status).toBe(200);
    });

    it("allows setting options on a multi_select field", async () => {
      const multiField = { ...mockField, type: "multi_select" };
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain([multiField]))
        .mockReturnValueOnce(makeSelectChain([updatedField]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());

      const res = await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: ["tag1", "tag2"] }),
      });

      expect(res.status).toBe(200);
    });

    it("calls verifyAccountMembership with content_admin role", async () => {
      setupUpdateMocks();

      await app.request("/custom_fields/cf_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        mockSession.userId,
        mockField.accountId,
        "content_admin"
      );
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /custom_fields/:id - Delete custom field definition
  // -------------------------------------------------------------------------
  describe("DELETE /custom_fields/:id - delete custom field", () => {
    function setupDeleteMocks(overrides?: {
      fieldExists?: boolean;
      memberRole?: string | null;
    }) {
      const { fieldExists = true, memberRole = "owner" } = overrides ?? {};

      vi.mocked(db.select).mockReturnValueOnce(
        makeSelectChain(fieldExists ? [mockField] : [])
      );
      vi.mocked(verifyAccountMembership).mockResolvedValue(memberRole as never);
      vi.mocked(db.delete).mockReturnValue(makeDeleteChain());
    }

    it("returns 204 No Content on successful deletion", async () => {
      setupDeleteMocks();

      const res = await app.request("/custom_fields/cf_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls db.delete once for the field", async () => {
      setupDeleteMocks();

      await app.request("/custom_fields/cf_123", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 (NotFoundError) when field does not exist", async () => {
      setupDeleteMocks({ fieldExists: false });

      const res = await app.request("/custom_fields/cf_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when field is not found", async () => {
      setupDeleteMocks({ fieldExists: false });

      await app.request("/custom_fields/cf_missing", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("returns 500 (AuthorizationError) when user is not owner", async () => {
      setupDeleteMocks({ memberRole: null });

      const res = await app.request("/custom_fields/cf_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("calls verifyAccountMembership with owner role", async () => {
      setupDeleteMocks();

      await app.request("/custom_fields/cf_123", { method: "DELETE" });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        mockSession.userId,
        mockField.accountId,
        "owner"
      );
    });

    it("does not call db.delete when authorization fails", async () => {
      setupDeleteMocks({ memberRole: null });

      await app.request("/custom_fields/cf_123", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // PUT /custom_fields/:id/visibility/:projectId - Set field visibility
  // -------------------------------------------------------------------------
  describe("PUT /custom_fields/:id/visibility/:projectId - set field visibility", () => {
    function setupVisibilityMocks(overrides?: {
      fieldExists?: boolean;
      memberRole?: string | null;
      existingVisibility?: { id: string } | null;
    }) {
      const {
        fieldExists = true,
        memberRole = "owner",
        existingVisibility = null,
      } = overrides ?? {};

      // First select: get the field
      // Second select: check existing visibility
      vi.mocked(db.select)
        .mockReturnValueOnce(makeSelectChain(fieldExists ? [mockField] : []))
        .mockReturnValueOnce(
          makeSelectChain(existingVisibility ? [existingVisibility] : [])
        );

      vi.mocked(verifyAccountMembership).mockResolvedValue(memberRole as never);
      vi.mocked(db.insert).mockReturnValue(makeInsertChain());
      vi.mocked(db.update).mockReturnValue(makeUpdateChain());
    }

    it("returns 200 with visibility data on success (new visibility record)", async () => {
      setupVisibilityMocks({ existingVisibility: null });

      const res = await app.request(
        "/custom_fields/cf_123/visibility/prj_123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_visible: true }),
        }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("cf_123");
      expect(body.data.type).toBe("custom_field_visibility");
      expect(body.data.attributes.project_id).toBe("prj_123");
      expect(body.data.attributes.is_visible).toBe(true);
    });

    it("calls db.insert when no existing visibility record", async () => {
      setupVisibilityMocks({ existingVisibility: null });

      await app.request("/custom_fields/cf_123/visibility/prj_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: false }),
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    });

    it("calls db.update when existing visibility record exists", async () => {
      setupVisibilityMocks({ existingVisibility: { id: "cfv_existing" } });

      await app.request("/custom_fields/cf_123/visibility/prj_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: false }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });

    it("returns 200 with updated visibility data when record already exists", async () => {
      setupVisibilityMocks({ existingVisibility: { id: "cfv_existing" } });

      const res = await app.request(
        "/custom_fields/cf_123/visibility/prj_123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_visible: false }),
        }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.attributes.is_visible).toBe(false);
    });

    it("defaults is_visible to true when not provided in body", async () => {
      setupVisibilityMocks({ existingVisibility: null });

      const res = await app.request(
        "/custom_fields/cf_123/visibility/prj_123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.attributes.is_visible).toBe(true);
    });

    it("returns 500 (NotFoundError) when field does not exist", async () => {
      setupVisibilityMocks({ fieldExists: false });

      const res = await app.request(
        "/custom_fields/cf_missing/visibility/prj_123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_visible: true }),
        }
      );

      expect(res.status).toBe(500);
    });

    it("returns 500 (AuthorizationError) when user is not admin", async () => {
      setupVisibilityMocks({ memberRole: null });

      const res = await app.request(
        "/custom_fields/cf_123/visibility/prj_123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_visible: true }),
        }
      );

      expect(res.status).toBe(500);
    });

    it("calls verifyAccountMembership with content_admin role", async () => {
      setupVisibilityMocks();

      await app.request("/custom_fields/cf_123/visibility/prj_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: true }),
      });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        mockSession.userId,
        mockField.accountId,
        "content_admin"
      );
    });

    it("does not attempt visibility upsert when field is not found", async () => {
      vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      await app.request("/custom_fields/cf_missing/visibility/prj_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: true }),
      });

      // db.select only called once (for field lookup - authorization check never runs)
      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
      expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    });

    it("inserts new visibility record with correct values", async () => {
      setupVisibilityMocks({ existingVisibility: null });

      await app.request("/custom_fields/cf_123/visibility/prj_123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: false }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesMock = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const insertedValues = valuesMock.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.customFieldId).toBe("cf_123");
      expect(insertedValues.projectId).toBe("prj_123");
      expect(insertedValues.isVisible).toBe(false);
    });
  });
});
