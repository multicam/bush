/**
 * Bush Platform - Account Routes Tests
 *
 * Comprehensive unit tests for account API routes.
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
  verifyAccountMembership: vi.fn(),
  verifyWorkspaceAccess: vi.fn(),
}));

vi.mock("../../db/schema.js", () => ({
  accounts: {
    id: "id",
    name: "name",
    slug: "slug",
    plan: "plan",
    storageQuotaBytes: "storageQuotaBytes",
    storageUsedBytes: "storageUsedBytes",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  accountMemberships: {
    id: "id",
    accountId: "accountId",
    userId: "userId",
    role: "role",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  users: {
    id: "id",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    avatarUrl: "avatarUrl",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("acc_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// drizzle-orm operators used in route handlers - mock as identity functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  lt: vi.fn((field, val) => ({ type: "lt", field, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  isNull: vi.fn((field) => ({ type: "isNull", field })),
  inArray: vi.fn((field, val) => ({ type: "inArray", field, val })),
}));

vi.mock("../../lib/email/index.js", () => ({
  getEmailService: vi.fn().mockReturnValue({
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../auth/session-cache.js", () => ({
  sessionCache: {
    invalidateOnRoleChange: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock authService for the switch account route
vi.mock("../../auth/service.js", () => ({
  authService: {
    switchAccount: vi.fn().mockResolvedValue({ sessionId: "ses_new" }),
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app from "./accounts.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyAccountMembership } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";
import { getEmailService } from "../../lib/email/index.js";
import { sessionCache } from "../../auth/session-cache.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner",
  sessionId: "ses_111",
  email: "owner@example.com",
  displayName: "Owner User",
};

const ACCOUNT_ROW = {
  id: "acc_001",
  name: "Test Account",
  slug: "test-account",
  plan: "free",
  storageQuotaBytes: 2147483648,
  storageUsedBytes: 0,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const MEMBERSHIP_ROW = {
  id: "acc_001",
  name: "Test Account",
  slug: "test-account",
  plan: "free",
  storageQuotaBytes: 2147483648,
  storageUsedBytes: 0,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
  role: "owner",
};

const MEMBER_DETAIL_ROW = {
  id: "am_001",
  role: "member",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  userId: "usr_xyz",
  userEmail: "member@example.com",
  userFirstName: "John",
  userLastName: "Doe",
  userAvatarUrl: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Account Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("acc_test123");
    vi.mocked(sessionCache.invalidateOnRoleChange).mockResolvedValue(undefined);
    vi.mocked(getEmailService).mockReturnValue({
      sendTemplate: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  // -------------------------------------------------------------------------
  // GET / - List accounts
  // -------------------------------------------------------------------------
  describe("GET / - list accounts", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.id).toBe("acc_001");
      expect(item.type).toBe("account");
      expect(item.attributes.name).toBe("Test Account");
    });

    it("returns meta with total_count and page_size", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
    });

    it("returns empty data array when user has no accounts", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
    });

    it("calls requireAuth to authenticate the request", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      await app.request("/", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("returns account with role attribute from membership", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(body.data[0].attributes.role).toBe("owner");
    });

    it("formats date fields as ISO strings in response", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(body.data[0].attributes.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(body.data[0].attributes.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    });

    it("uses parseLimit to determine the query limit", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      await app.request("/?limit=25", { method: "GET" });

      expect(vi.mocked(parseLimit)).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id - Get account by ID
  // -------------------------------------------------------------------------
  describe("GET /:id - get account by ID", () => {
    it("returns 200 with JSON:API single resource on success", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("acc_001");
      expect(body.data.type).toBe("account");
      expect(body.data.attributes.name).toBe("Test Account");
    });

    it("returns 500 when account is not found or user is not a member", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_missing", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("includes slug in account attributes", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.slug).toBe("test-account");
    });

    it("formats date fields as ISO strings", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([MEMBERSHIP_ROW]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.createdAt).toBe("2024-01-15T10:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create account
  // -------------------------------------------------------------------------
  describe("POST / - create account", () => {
    function setupCreateAccountMocks(slugExists = false) {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Check if slug is taken
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue(slugExists ? [{ id: "acc_existing" }] : []),
              }),
            }),
          } as never;
        }
        // Fetch created account
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
            }),
          }),
        } as never;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);
    }

    it("returns 200 with newly created account on success", async () => {
      setupCreateAccountMocks(false);

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Account", slug: "new-account" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("acc_001");
      expect(body.data.type).toBe("account");
    });

    it("returns 500 when name is missing", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "some-slug" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when slug is missing", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Some Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is not a string", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 42, slug: "some-slug" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when slug is not a string", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Some Name", slug: 99 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when slug is already taken", async () => {
      setupCreateAccountMocks(true);

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Account", slug: "taken-slug" }),
      });

      expect(res.status).toBe(500);
    });

    it("inserts account with free plan and 2GB storage quota", async () => {
      setupCreateAccountMocks(false);

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Account", slug: "new-account" }),
      });

      const insertMock = vi.mocked(db.insert);
      expect(insertMock).toHaveBeenCalledTimes(2); // account + membership

      const valuesspy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const accountArg = valuesspy.mock.calls[0][0] as Record<string, unknown>;
      expect(accountArg.plan).toBe("free");
      expect(accountArg.storageQuotaBytes).toBe(2147483648);
      expect(accountArg.storageUsedBytes).toBe(0);
    });

    it("adds creator as owner member", async () => {
      setupCreateAccountMocks(false);

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Account", slug: "new-account" }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesspy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const membershipArg = valuesspy.mock.calls[1][0] as Record<string, unknown>;
      expect(membershipArg.role).toBe("owner");
      expect(membershipArg.userId).toBe(SESSION.userId);
    });

    it("uses generateId to create account and membership IDs", async () => {
      setupCreateAccountMocks(false);

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Account", slug: "new-account" }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("acc");
      expect(vi.mocked(generateId)).toHaveBeenCalledWith("am");
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /:id - Update account
  // -------------------------------------------------------------------------
  describe("PATCH /:id - update account", () => {
    const UPDATED_ROW = {
      ...ACCOUNT_ROW,
      name: "Updated Account Name",
      updatedAt: new Date("2024-02-01T12:00:00.000Z"),
    };

    beforeEach(() => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([UPDATED_ROW]),
          }),
        }),
      } as never);
    });

    it("returns 200 with updated account on success", async () => {
      const res = await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Account Name" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("acc_001");
      expect(body.data.type).toBe("account");
    });

    it("returns 500 when user is not authorized (not owner or content_admin)", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Won't matter" }),
      });

      expect(res.status).toBe(500);
    });

    it("calls verifyAccountMembership with content_admin minimum role", async () => {
      await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        SESSION.userId,
        "acc_001",
        "content_admin"
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

      await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Changed" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
      expect(updates.name).toBe("Changed");
    });

    it("does not add name to updates when not in body", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates).not.toHaveProperty("name");
    });

    it("allows owner to update slug when not taken", async () => {
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // slug check - not taken
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as never;
        }
        // Refetch after update
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...UPDATED_ROW, slug: "new-slug" }]),
            }),
          }),
        } as never;
      });

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      const res = await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "new-slug" }),
      });

      expect(res.status).toBe(200);
      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.slug).toBe("new-slug");
    });

    it("returns 500 when owner tries to set already-taken slug", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: "acc_other" }]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "taken-slug" }),
      });

      expect(res.status).toBe(500);
    });

    it("does not allow content_admin to update slug", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await app.request("/acc_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "new-slug" }),
      });

      // content_admin cannot change slug - it should not appear in updates
      if (setCalled.mock.calls.length > 0) {
        const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
        expect(updates).not.toHaveProperty("slug");
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/storage - Get storage usage
  // -------------------------------------------------------------------------
  describe("GET /:id/storage - get storage usage", () => {
    it("returns 200 with storage data", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([
                { storageUsedBytes: 1073741824, storageQuotaBytes: 2147483648 },
              ]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/storage", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.type).toBe("storage");
      expect(body.data.id).toBe("acc_001");
      expect(body.data.attributes.used_bytes).toBe(1073741824);
      expect(body.data.attributes.quota_bytes).toBe(2147483648);
    });

    it("calculates available_bytes correctly", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([
                { storageUsedBytes: 500000000, storageQuotaBytes: 2000000000 },
              ]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/storage", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.available_bytes).toBe(1500000000);
    });

    it("calculates usage_percent correctly", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([
                { storageUsedBytes: 1073741824, storageQuotaBytes: 2147483648 },
              ]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/storage", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.usage_percent).toBe(50);
    });

    it("returns usage_percent of 0 when quota is 0", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([
                { storageUsedBytes: 0, storageQuotaBytes: 0 },
              ]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/storage", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.usage_percent).toBe(0);
    });

    it("returns 500 when account is not found or user not a member", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_missing/storage", { method: "GET" });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/switch - Switch to account
  // -------------------------------------------------------------------------
  describe("POST /:id/switch - switch to account", () => {
    it("returns 200 with account switch data on success", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ role: "owner" }]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/switch", { method: "POST" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.type).toBe("account");
      expect(body.data.id).toBe("acc_001");
      expect(body.data.attributes.current).toBe(true);
      expect(body.data.attributes.role).toBe("owner");
    });

    it("returns 500 when user is not a member of the account", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_missing/switch", { method: "POST" });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/members - List account members
  // -------------------------------------------------------------------------
  describe("GET /:id/members - list account members", () => {
    it("returns 200 with member list on success", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([MEMBER_DETAIL_ROW]),
              }),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("returns member attributes including user info", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([MEMBER_DETAIL_ROW]),
              }),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members", { method: "GET" });
      const body = await res.json();

      const member = body.data[0];
      expect(member.attributes.role).toBe("member");
      expect(member.attributes.user.email).toBe("member@example.com");
      expect(member.attributes.user.first_name).toBe("John");
      expect(member.attributes.user.last_name).toBe("Doe");
    });

    it("returns 500 when user is not a member of the account", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/acc_missing/members", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("calls verifyAccountMembership with userId and accountId", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("member" as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as never);

      await app.request("/acc_001/members", { method: "GET" });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        SESSION.userId,
        "acc_001"
      );
    });

    it("returns empty data array when account has no members", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members", { method: "GET" });
      const body = await res.json();

      expect(body.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/members - Invite member
  // -------------------------------------------------------------------------
  describe("POST /:id/members - invite member", () => {
    it("returns 200 and adds existing user as member", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Find existing user
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ id: "usr_xyz" }]),
              }),
            }),
          } as never;
        }
        if (selectCallCount === 2) {
          // Check existing membership - not a member
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as never;
        }
        if (selectCallCount === 3) {
          // Fetch newly created membership
          return {
            from: () => ({
              innerJoin: () => ({
                where: () => ({
                  limit: vi.fn().mockResolvedValue([MEMBER_DETAIL_ROW]),
                }),
              }),
            }),
          } as never;
        }
        // Account name for email
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ name: "Test Account" }]),
            }),
          }),
        } as never;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com", role: "member" } },
        }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when user is not authorized to invite", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when email is missing", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: {} },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when role is invalid", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com", role: "superadmin" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when content_admin tries to assign owner role", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com", role: "owner" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user is already a member", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Find existing user
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ id: "usr_xyz" }]),
              }),
            }),
          } as never;
        }
        // Check existing membership - already a member
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ id: "am_existing" }]),
            }),
          }),
        } as never;
      });

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user does not exist in the system", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "nonexistent@example.com" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("defaults role to 'member' when not specified", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ id: "usr_xyz" }]),
              }),
            }),
          } as never;
        }
        if (selectCallCount === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as never;
        }
        if (selectCallCount === 3) {
          return {
            from: () => ({
              innerJoin: () => ({
                where: () => ({
                  limit: vi.fn().mockResolvedValue([MEMBER_DETAIL_ROW]),
                }),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ name: "Test Account" }]),
            }),
          }),
        } as never;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com" } },
        }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesspy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const membershipArg = valuesspy.mock.calls[0][0] as Record<string, unknown>;
      expect(membershipArg.role).toBe("member");
    });

    it("sends invitation email after adding existing user", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

      const sendTemplateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getEmailService).mockReturnValue({
        sendTemplate: sendTemplateMock,
      } as never);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{ id: "usr_xyz" }]),
              }),
            }),
          } as never;
        }
        if (selectCallCount === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as never;
        }
        if (selectCallCount === 3) {
          return {
            from: () => ({
              innerJoin: () => ({
                where: () => ({
                  limit: vi.fn().mockResolvedValue([MEMBER_DETAIL_ROW]),
                }),
              }),
            }),
          } as never;
        }
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ name: "Test Account" }]),
            }),
          }),
        } as never;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      await app.request("/acc_001/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { email: "member@example.com", role: "member" } },
        }),
      });

      // Wait for async email send (it uses .catch() not await)
      await new Promise((r) => setTimeout(r, 10));

      expect(sendTemplateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "member-invitation",
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /:id/members/:memberId - Update member role
  // -------------------------------------------------------------------------
  describe("PATCH /:id/members/:memberId - update member role", () => {
    const TARGET_MEMBERSHIP = {
      id: "am_001",
      role: "member",
      userId: "usr_target",
    };

    const UPDATED_MEMBER = {
      ...MEMBER_DETAIL_ROW,
      role: "content_admin",
    };

    beforeEach(() => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(sessionCache.invalidateOnRoleChange).mockResolvedValue(undefined);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Get target membership
          return {
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([TARGET_MEMBERSHIP]),
              }),
            }),
          } as never;
        }
        // Fetch updated membership with user info
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([UPDATED_MEMBER]),
              }),
            }),
          }),
        } as never;
      });
    });

    it("returns 200 with updated member on success", async () => {
      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "content_admin" } },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.attributes.role).toBe("content_admin");
    });

    it("returns 500 when user is not authorized", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "member" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when role is missing from body", async () => {
      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: {} },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when role is invalid", async () => {
      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "badRole" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when membership is not found", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "member" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user tries to change their own role", async () => {
      // Make target membership be the same user as session
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...TARGET_MEMBERSHIP, userId: SESSION.userId }]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "member" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when content_admin tries to assign owner role", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "owner" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when content_admin tries to modify an owner's role", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...TARGET_MEMBERSHIP, role: "owner" }]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "member" } },
        }),
      });

      expect(res.status).toBe(500);
    });

    it("invalidates session cache for the affected user after role change", async () => {
      await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "content_admin" } },
        }),
      });

      expect(vi.mocked(sessionCache.invalidateOnRoleChange)).toHaveBeenCalledWith(
        TARGET_MEMBERSHIP.userId,
        "acc_001"
      );
    });

    it("calls db.update with the new role and updatedAt", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      } as never);

      await app.request("/acc_001/members/am_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { attributes: { role: "content_admin" } },
        }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "content_admin",
          updatedAt: expect.any(Date),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id/members/:memberId - Remove member
  // -------------------------------------------------------------------------
  describe("DELETE /:id/members/:memberId - remove member", () => {
    const TARGET_MEMBERSHIP = {
      id: "am_001",
      role: "member",
      userId: "usr_target",
    };

    beforeEach(() => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
      vi.mocked(sessionCache.invalidateOnRoleChange).mockResolvedValue(undefined);

      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([TARGET_MEMBERSHIP]),
          }),
        }),
      } as never);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful removal", async () => {
      const res = await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("calls db.delete for the membership", async () => {
      await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when user is not authorized", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when membership is not found", async () => {
      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user tries to remove themselves", async () => {
      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { ...TARGET_MEMBERSHIP, userId: SESSION.userId },
            ]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when content_admin tries to remove an owner", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { ...TARGET_MEMBERSHIP, role: "owner" },
            ]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when content_admin tries to remove another content_admin", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      vi.mocked(db.select).mockReset();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { ...TARGET_MEMBERSHIP, role: "content_admin" },
            ]),
          }),
        }),
      } as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("allows content_admin to remove a regular member", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue("content_admin" as never);

      const res = await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("invalidates session cache for the affected user", async () => {
      await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(vi.mocked(sessionCache.invalidateOnRoleChange)).toHaveBeenCalledWith(
        TARGET_MEMBERSHIP.userId,
        "acc_001"
      );
    });

    it("calls verifyAccountMembership with content_admin minimum role", async () => {
      await app.request("/acc_001/members/am_001", {
        method: "DELETE",
      });

      expect(vi.mocked(verifyAccountMembership)).toHaveBeenCalledWith(
        SESSION.userId,
        "acc_001",
        "content_admin"
      );
    });
  });
});
