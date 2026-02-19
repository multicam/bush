/**
 * Bush Platform - Webhooks Routes Tests
 *
 * Comprehensive unit tests for webhook API routes.
 */

// Mock all dependencies BEFORE any imports (vitest hoists vi.mock)
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
}));

vi.mock("../../db/schema.js", () => ({
  webhooks: {
    id: "id",
    accountId: "accountId",
    createdByUserId: "createdByUserId",
    name: "name",
    url: "url",
    secret: "secret",
    events: "events",
    isActive: "isActive",
    lastTriggeredAt: "lastTriggeredAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  webhookDeliveries: {
    id: "id",
    webhookId: "webhookId",
    eventType: "eventType",
    payload: "payload",
    status: "status",
    statusCode: "statusCode",
    response: "response",
    attemptCount: "attemptCount",
    deliveredAt: "deliveredAt",
    createdAt: "createdAt",
  },
  users: {
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("wh_test123"),
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

// We intentionally do NOT mock crypto - we let it use real crypto functions.
// generateWebhookSecret and createHmac are tested indirectly via route behavior.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app from "./webhooks.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyAccountAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner",
  sessionId: "ses_111",
};

const CREATOR = {
  id: "usr_abc",
  firstName: "Alice",
  lastName: "Smith",
  email: "alice@example.com",
};

const WEBHOOK_ROW = {
  id: "wh_001",
  accountId: "acc_xyz",
  createdByUserId: "usr_abc",
  name: "My Webhook",
  url: "https://example.com/hook",
  secret: "whsec_abc123",
  events: ["file.created", "file.deleted"],
  isActive: true,
  lastTriggeredAt: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const WEBHOOK_WITH_CREATOR = {
  webhook: WEBHOOK_ROW,
  creator: CREATOR,
};

const DELIVERY_ROW = {
  id: "whdel_001",
  webhookId: "wh_001",
  eventType: "file.created",
  payload: {},
  status: "success",
  statusCode: 200,
  response: "OK",
  attemptCount: 1,
  deliveredAt: new Date("2024-01-15T11:00:00.000Z"),
  createdAt: new Date("2024-01-15T11:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Helpers: mount with parent route for accountId param
// ---------------------------------------------------------------------------

function makeTestApp() {
  const testApp = new Hono();
  testApp.route("/accounts/:accountId/webhooks", app);
  return testApp;
}

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

/** Mock a select chain: .from().innerJoin().where().orderBy().limit() */
function mockSelectJoinChain(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
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

/** Mock a select chain: .from().where().orderBy().limit() */
function mockSelectWhereOrderLimit(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never);
}

/** Mock a select chain: .from().innerJoin().where().limit() */
function mockSelectJoinWhereLimit(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never);
}

/** Mock a select chain: .from().where().limit() */
function mockSelectWhereLimit(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never);
}

/** Mock insert chain: .values() resolves */
function mockInsert() {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

/** Mock update chain: .set().where() resolves */
function mockUpdate() {
  vi.mocked(db.update).mockReturnValue({
    set: () => ({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

/** Mock delete chain: .where() resolves */
function mockDelete() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Webhooks Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("wh_test123");
    vi.mocked(verifyAccountAccess).mockResolvedValue(true as never);
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/webhooks - List webhooks
  // -------------------------------------------------------------------------
  describe("GET /accounts/:accountId/webhooks - list webhooks", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("wh_001");
      expect(body.data[0].type).toBe("webhook");
    });

    it("returns webhook attributes in response", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs.name).toBe("My Webhook");
      expect(attrs.url).toBe("https://example.com/hook");
      expect(attrs.isActive).toBe(true);
    });

    it("does not expose secret in list view", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs).not.toHaveProperty("secret");
    });

    it("returns meta with total_count and page_size", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
    });

    it("returns empty collection when no webhooks exist", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
    });

    it("throws NotFoundError when account access is denied", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("calls requireAuth to authenticate the request", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([]);

      await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("calls verifyAccountAccess with accountId from params and session currentAccountId", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([]);

      await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });

      expect(vi.mocked(verifyAccountAccess)).toHaveBeenCalledWith("acc_xyz", SESSION.currentAccountId);
    });

    it("calls parseLimit with the limit query param", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([]);

      await testApp.request("/accounts/acc_xyz/webhooks?limit=25", { method: "GET" });

      expect(vi.mocked(parseLimit)).toHaveBeenCalled();
    });

    it("slices items to limit and reports has_more false when at limit", async () => {
      const testApp = makeTestApp();
      // Return exactly 50 items (limit), so has_more is false
      const rows = Array.from({ length: 50 }, (_, i) => ({
        webhook: { ...WEBHOOK_ROW, id: `wh_${i}` },
        creator: CREATOR,
      }));
      mockSelectJoinChain(rows);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });
      const body = await res.json();

      expect(body.data).toHaveLength(50);
      expect(body.meta.has_more).toBe(false);
    });

    it("formats date fields as ISO strings", async () => {
      const testApp = makeTestApp();
      mockSelectJoinChain([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(attrs.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // POST /accounts/:accountId/webhooks - Create webhook
  // -------------------------------------------------------------------------
  describe("POST /accounts/:accountId/webhooks - create webhook", () => {
    beforeEach(() => {
      mockInsert();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);
    });

    it("returns 200 with newly created webhook on success", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Webhook",
          url: "https://example.com/hook",
          events: ["file.created"],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("wh_001");
      expect(body.data.type).toBe("webhook");
    });

    it("exposes secret in creation response", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Webhook",
          url: "https://example.com/hook",
          events: ["file.created"],
        }),
      });

      const body = await res.json();
      // The WEBHOOK_ROW fixture has secret "whsec_abc123" which gets returned via select
      expect(body.data.attributes).toHaveProperty("secret");
    });

    it("calls db.insert with correct values", async () => {
      const testApp = makeTestApp();

      await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Hook",
          url: "https://example.com/hook",
          events: ["file.created"],
        }),
      });

      const insertMock = vi.mocked(db.insert);
      expect(insertMock).toHaveBeenCalledTimes(1);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const arg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.accountId).toBe("acc_xyz");
      expect(arg.name).toBe("My Hook");
      expect(arg.url).toBe("https://example.com/hook");
      expect(arg.createdByUserId).toBe(SESSION.userId);
    });

    it("uses provided secret when supplied in body", async () => {
      const testApp = makeTestApp();

      await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Hook",
          url: "https://example.com/hook",
          events: ["file.created"],
          secret: "my_custom_secret",
        }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const arg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.secret).toBe("my_custom_secret");
    });

    it("defaults is_active to true when not provided", async () => {
      const testApp = makeTestApp();

      await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Hook",
          url: "https://example.com/hook",
          events: ["file.created"],
        }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const arg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.isActive).toBe(true);
    });

    it("respects is_active false when provided", async () => {
      const testApp = makeTestApp();

      await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Hook",
          url: "https://example.com/hook",
          events: ["file.created"],
          is_active: false,
        }),
      });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const arg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.isActive).toBe(false);
    });

    it("uses generateId with 'wh' prefix", async () => {
      const testApp = makeTestApp();

      await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Hook",
          url: "https://example.com/hook",
          events: ["file.created"],
        }),
      });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("wh");
    });

    it("returns 500 when name is missing", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hook", events: ["file.created"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  ", url: "https://example.com/hook", events: ["file.created"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when url is missing", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hook", events: ["file.created"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when url is invalid", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hook", url: "not-a-url", events: ["file.created"] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when events is missing", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hook", url: "https://example.com/hook" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when events is empty array", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hook", url: "https://example.com/hook", events: [] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when events contains invalid event type string", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: ["invalid.event"],
        }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts events as array of objects with type property", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: [{ type: "file.created" }],
        }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when event object type is invalid", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: [{ type: "invalid.event" }],
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when event is neither string nor object with type", async () => {
      const testApp = makeTestApp();

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: [42],
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied", async () => {
      const testApp = makeTestApp();
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: ["file.created"],
        }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts all valid event types", async () => {
      const testApp = makeTestApp();
      const validEvents = [
        "file.created", "file.updated", "file.deleted", "file.status_changed",
        "file.downloaded", "version.created", "comment.created", "comment.updated",
        "comment.deleted", "comment.completed", "share.created", "share.viewed",
        "project.created", "project.updated", "project.deleted",
        "member.added", "member.removed", "transcription.completed",
      ];

      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Hook",
          url: "https://example.com/hook",
          events: validEvents,
        }),
      });

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/webhooks/:id - Get webhook by ID
  // -------------------------------------------------------------------------
  describe("GET /accounts/:accountId/webhooks/:id - get webhook by ID", () => {
    it("returns 200 with webhook data on success", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("wh_001");
      expect(body.data.type).toBe("webhook");
      expect(body.data.attributes.name).toBe("My Webhook");
    });

    it("does not expose secret in get response", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes).not.toHaveProperty("secret");
    });

    it("returns 500 when webhook is not found", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_missing", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("formats date fields as ISO strings", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(body.data.attributes.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    });

    it("verifies access using the webhook's accountId", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "GET" });

      expect(vi.mocked(verifyAccountAccess)).toHaveBeenCalledWith(
        WEBHOOK_ROW.accountId,
        SESSION.currentAccountId
      );
    });

    it("includes creator in response attributes", async () => {
      const testApp = makeTestApp();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.creator).toBeDefined();
      expect(body.data.attributes.creator.id).toBe("usr_abc");
    });
  });

  // -------------------------------------------------------------------------
  // PUT /accounts/:accountId/webhooks/:id - Update webhook
  // -------------------------------------------------------------------------
  describe("PUT /accounts/:accountId/webhooks/:id - update webhook", () => {
    beforeEach(() => {
      mockUpdate();
    });

    it("returns 200 with updated webhook on success", async () => {
      const testApp = makeTestApp();
      // First select: get webhook for verification
      // Second select: fetch updated webhook with creator
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Hook" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("webhook");
    });

    it("calls db.update when updating name", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Hook" }),
      });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("trims name in update", async () => {
      const testApp = makeTestApp();
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  Trimmed Hook  " }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.name).toBe("Trimmed Hook");
    });

    it("includes updatedAt in update set", async () => {
      const testApp = makeTestApp();
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hook" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.updatedAt).toBeInstanceOf(Date);
    });

    it("updates url when valid", async () => {
      const testApp = makeTestApp();
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://new-url.example.com/hook" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.url).toBe("https://new-url.example.com/hook");
    });

    it("returns 500 when url is invalid in update", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
          }),
        }),
      } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is empty string in update", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
          }),
        }),
      } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when events is empty array in update", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
          }),
        }),
      } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: [] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when events contains invalid type in update", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
          }),
        }),
      } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: ["bogus.event"] }),
      });

      expect(res.status).toBe(500);
    });

    it("updates is_active field when provided", async () => {
      const testApp = makeTestApp();
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.isActive).toBe(false);
    });

    it("returns 500 when webhook is not found", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_missing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Won't matter" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
          }),
        }),
      } as never);
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New name" }),
      });

      expect(res.status).toBe(500);
    });

    it("accepts valid event types in update", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([WEBHOOK_WITH_CREATOR]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: ["comment.created", "version.created"] }),
      });

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /accounts/:accountId/webhooks/:id - Delete webhook
  // -------------------------------------------------------------------------
  describe("DELETE /accounts/:accountId/webhooks/:id - delete webhook", () => {
    beforeEach(() => {
      mockDelete();
    });

    it("returns 204 No Content on successful deletion", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("calls db.delete twice (deliveries then webhook)", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(2);
    });

    it("returns 500 when webhook is not found", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_missing", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when webhook is not found", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_missing", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("calls requireAuth", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001", { method: "DELETE" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /accounts/:accountId/webhooks/:id/deliveries - List deliveries
  // -------------------------------------------------------------------------
  describe("GET /accounts/:accountId/webhooks/:id/deliveries - list deliveries", () => {
    it("returns 200 with delivery collection on success", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([DELIVERY_ROW]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/deliveries", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns delivery attributes", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([DELIVERY_ROW]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/deliveries", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs.eventType).toBe("file.created");
      expect(attrs.status).toBe("success");
      expect(attrs.statusCode).toBe(200);
      expect(attrs.attemptCount).toBe(1);
    });

    it("does not expose payload in list view", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([DELIVERY_ROW]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/deliveries", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs).not.toHaveProperty("payload");
    });

    it("returns 500 when webhook is not found", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_missing/deliveries", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/deliveries", { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("returns empty collection when no deliveries", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/deliveries", { method: "GET" });
      const body = await res.json();

      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
    });

    it("uses 'webhook_delivery' as resource type", async () => {
      const testApp = makeTestApp();
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([WEBHOOK_ROW]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([DELIVERY_ROW]),
              }),
            }),
          }),
        } as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/deliveries", { method: "GET" });
      const body = await res.json();

      expect(body.data[0].type).toBe("webhook_delivery");
    });
  });

  // -------------------------------------------------------------------------
  // POST /accounts/:accountId/webhooks/:id/test - Send test event
  // -------------------------------------------------------------------------
  describe("POST /accounts/:accountId/webhooks/:id/test - send test event", () => {
    beforeEach(() => {
      // Mock global fetch for the webhook delivery
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      }));
      mockInsert();
      mockUpdate();
    });

    it("returns 200 with test result on success", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("success");
    });

    it("returns success true when fetch returns 200", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });
      const body = await res.json();

      expect(body.data.success).toBe(true);
      expect(body.data.status_code).toBe(200);
    });

    it("returns success false when fetch returns 4xx", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request"),
      }));

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });
      const body = await res.json();

      expect(body.data.success).toBe(false);
      expect(body.data.status_code).toBe(400);
    });

    it("returns success false when fetch throws", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });
      const body = await res.json();

      expect(body.data.success).toBe(false);
      expect(body.data.response).toBe("Connection refused");
    });

    it("creates a delivery record before sending", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });

    it("updates the delivery record after sending", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      // db.update should be called at least once (to update delivery)
      expect(vi.mocked(db.update)).toHaveBeenCalled();
    });

    it("updates webhook's lastTriggeredAt on success", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      // Two updates: one for delivery record, one for lastTriggeredAt
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(2);
    });

    it("does not update lastTriggeredAt on failed delivery", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      // Only one update for delivery record (no lastTriggeredAt update)
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("sends request to the webhook url with correct headers", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      expect(fetchMock).toHaveBeenCalledWith(
        WEBHOOK_ROW.url,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-bush-event": "test",
          }),
        })
      );
    });

    it("returns delivery_id in response", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.mocked(generateId).mockReturnValue("whdel_test456");

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });
      const body = await res.json();

      expect(body.data.delivery_id).toBeDefined();
    });

    it("returns 500 when webhook is not found", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([]);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_missing/test", { method: "POST" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when account access is denied", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);
      vi.mocked(verifyAccountAccess).mockResolvedValue(null as never);

      const res = await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      expect(res.status).toBe(500);
    });

    it("uses generateId with 'whdel' prefix for delivery", async () => {
      const testApp = makeTestApp();
      mockSelectWhereLimit([WEBHOOK_ROW]);

      await testApp.request("/accounts/acc_xyz/webhooks/wh_001/test", { method: "POST" });

      expect(vi.mocked(generateId)).toHaveBeenCalledWith("whdel");
    });
  });

  // -------------------------------------------------------------------------
  // Helper functions - generateWebhookSecret, isValidWebhookUrl, validateEventTypes
  // -------------------------------------------------------------------------
  describe("isValidWebhookUrl - URL validation (via create webhook endpoint)", () => {
    const baseBody = { name: "Hook", events: ["file.created"] };

    beforeEach(() => {
      mockInsert();
      mockSelectJoinWhereLimit([WEBHOOK_WITH_CREATOR]);
    });

    it("accepts https URLs", async () => {
      const testApp = makeTestApp();
      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, url: "https://example.com/hook" }),
      });
      expect(res.status).toBe(200);
    });

    it("accepts http URLs (non-production env)", async () => {
      const testApp = makeTestApp();
      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, url: "http://localhost:3000/hook" }),
      });
      expect(res.status).toBe(200);
    });

    it("rejects ftp URLs", async () => {
      const testApp = makeTestApp();
      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, url: "ftp://example.com/hook" }),
      });
      expect(res.status).toBe(500);
    });

    it("rejects malformed URLs", async () => {
      const testApp = makeTestApp();
      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, url: "not a url at all" }),
      });
      expect(res.status).toBe(500);
    });

    it("rejects empty string url", async () => {
      const testApp = makeTestApp();
      const res = await testApp.request("/accounts/acc_xyz/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, url: "" }),
      });
      // Empty string fails the `!body.url` check before URL validation
      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // emitWebhookEvent - exported helper
  // -------------------------------------------------------------------------
  describe("emitWebhookEvent - exported helper function", () => {
    it("queries for active webhooks matching event type", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      await emitWebhookEvent("acc_xyz", "file.created", { id: "file_001" });

      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    });

    it("inserts delivery records for matching webhooks", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      const matchingWebhook = {
        ...WEBHOOK_ROW,
        events: ["file.created"],
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([matchingWebhook]),
        }),
      } as never);
      mockInsert();

      await emitWebhookEvent("acc_xyz", "file.created", { id: "file_001" });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });

    it("does not insert when no webhooks match event type", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      const nonMatchingWebhook = {
        ...WEBHOOK_ROW,
        events: ["file.deleted"],
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([nonMatchingWebhook]),
        }),
      } as never);

      await emitWebhookEvent("acc_xyz", "file.created", { id: "file_001" });

      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });

    it("does not insert when no active webhooks", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      await emitWebhookEvent("acc_xyz", "file.created", { id: "file_001" });

      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });

    it("handles events as objects with type property", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      const matchingWebhook = {
        ...WEBHOOK_ROW,
        events: [{ type: "file.created" }],
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([matchingWebhook]),
        }),
      } as never);
      mockInsert();

      await emitWebhookEvent("acc_xyz", "file.created", { id: "file_001" });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });

    it("inserts pending delivery with correct eventType", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      const matchingWebhook = {
        ...WEBHOOK_ROW,
        events: ["comment.created"],
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([matchingWebhook]),
        }),
      } as never);
      mockInsert();

      await emitWebhookEvent("acc_xyz", "comment.created", { id: "comment_001" });

      const insertMock = vi.mocked(db.insert);
      const valuesSpy = (insertMock.mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
      const arg = valuesSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.eventType).toBe("comment.created");
      expect(arg.status).toBe("pending");
      expect(arg.attemptCount).toBe(0);
    });

    it("inserts delivery for each matching webhook when multiple exist", async () => {
      const { emitWebhookEvent } = await import("./webhooks.js");
      const webhook1 = { ...WEBHOOK_ROW, id: "wh_001", events: ["file.created"] };
      const webhook2 = { ...WEBHOOK_ROW, id: "wh_002", events: ["file.created"] };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([webhook1, webhook2]),
        }),
      } as never);
      mockInsert();

      await emitWebhookEvent("acc_xyz", "file.created", { id: "file_001" });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(2);
    });
  });
});
