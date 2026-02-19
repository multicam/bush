/**
 * Bush Platform - Notifications Routes Tests
 *
 * Comprehensive unit tests for notification API routes and helper functions.
 * Reference: specs/17-api-complete.md Section 6.15
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
  notifications: {
    id: "id",
    userId: "userId",
    type: "type",
    title: "title",
    body: "body",
    data: "data",
    readAt: "readAt",
    createdAt: "createdAt",
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../../realtime/index.js", () => ({
  emitNotificationEvent: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("ntf_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// Mock drizzle-orm operators as identity functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  isNull: vi.fn((field) => ({ type: "isNull", field })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import app, { createNotification, createNotifications, NOTIFICATION_TYPES } from "./notifications.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { emitNotificationEvent } from "../../realtime/index.js";
import { generateId } from "../router.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner",
};

const mockNotification = {
  id: "ntf_123",
  userId: "usr_123",
  type: "mention",
  title: "Test notification",
  body: "Test body",
  data: null,
  readAt: null,
  createdAt: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

/**
 * Sets up the two-call select pattern used by GET /:
 * - First call: count query (.from().where()) -> [{ count, unreadCount }]
 * - Second call: items query (.from().where().orderBy().limit()) -> items[]
 */
function mockSelectForList(
  items: typeof mockNotification[],
  counts: { count: number; unreadCount: number }
) {
  let callIndex = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) {
      // Count query: select({ count, unreadCount }).from().where()
      return {
        from: () => ({
          where: vi.fn().mockResolvedValue([counts]),
        }),
      } as never;
    }
    // Items query: select().from().where().orderBy().limit()
    return {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue(items),
          }),
        }),
      }),
    } as never;
  });
}

/**
 * Sets up a single-call select for unread-count and read-all routes.
 * Pattern: select({ count }).from().where() -> [{ count: N }]
 */
function mockSelectForCount(count: number) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  } as never);
}

/**
 * Sets up a select that returns a single notification row.
 * Pattern: select().from().where().limit(1) -> [notification]
 */
function mockSelectForSingle(row: typeof mockNotification | null) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
  } as never);
}

/**
 * Sets up read-all flow: first call = count query, second call = (unused but chained).
 * The update is mocked separately.
 */
function mockSelectAndUpdateForReadAll(unreadCount: number) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: vi.fn().mockResolvedValue([{ count: unreadCount }]),
    }),
  } as never);

  vi.mocked(db.update).mockReturnValue({
    set: () => ({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Notifications Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockReturnValue(mockSession as never);
  });

  // -------------------------------------------------------------------------
  // GET / - List notifications
  // -------------------------------------------------------------------------
  describe("GET / - list notifications", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      mockSelectForList([mockNotification], { count: 1, unreadCount: 1 });

      const res = await app.request("/", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);

      const item = body.data[0];
      expect(item.id).toBe("ntf_123");
      expect(item.type).toBe("notification");
    });

    it("returns notification attributes in correct shape", async () => {
      mockSelectForList([mockNotification], { count: 1, unreadCount: 1 });

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs.notification_type).toBe("mention");
      expect(attrs.title).toBe("Test notification");
      expect(attrs.body).toBe("Test body");
      expect(attrs.read).toBe(false);
      expect(attrs.read_at).toBeNull();
      expect(attrs.created_at).toBe("2024-01-01T00:00:00.000Z");
      expect(attrs.data).toBeNull();
    });

    it("returns meta with total_count, unread_count, and page_size", async () => {
      mockSelectForList([mockNotification], { count: 5, unreadCount: 2 });

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(5);
      expect(body.meta.unread_count).toBe(2);
      expect(body.meta.page_size).toBe(50);
    });

    it("returns links.self pointing to the notifications endpoint", async () => {
      mockSelectForList([], { count: 0, unreadCount: 0 });

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(body.links).toBeDefined();
      expect(body.links.self).toBe("/v4/users/me/notifications");
    });

    it("returns empty data array when no notifications exist", async () => {
      mockSelectForList([], { count: 0, unreadCount: 0 });

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.meta.total_count).toBe(0);
      expect(body.meta.unread_count).toBe(0);
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectForList([], { count: 0, unreadCount: 0 });

      await app.request("/", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("marks notification as read when readAt is set", async () => {
      const readNotification = {
        ...mockNotification,
        readAt: new Date("2024-01-02"),
      };
      mockSelectForList([readNotification], { count: 1, unreadCount: 0 });

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      const attrs = body.data[0].attributes;
      expect(attrs.read).toBe(true);
      expect(attrs.read_at).toBe("2024-01-02T00:00:00.000Z");
    });

    it("applies filter[read]=true query parameter", async () => {
      mockSelectForList([], { count: 0, unreadCount: 0 });

      const res = await app.request("/?filter%5Bread%5D=true", { method: "GET" });

      expect(res.status).toBe(200);
      // The mock was called, which means conditions were built and query executed
      expect(vi.mocked(db.select)).toHaveBeenCalled();
    });

    it("applies filter[read]=false query parameter", async () => {
      mockSelectForList([mockNotification], { count: 1, unreadCount: 1 });

      const res = await app.request("/?filter%5Bread%5D=false", { method: "GET" });

      expect(res.status).toBe(200);
      expect(vi.mocked(db.select)).toHaveBeenCalled();
    });

    it("applies filter[type] query parameter to filter by notification type", async () => {
      mockSelectForList([mockNotification], { count: 1, unreadCount: 1 });

      const res = await app.request("/?filter%5Btype%5D=mention", { method: "GET" });

      expect(res.status).toBe(200);
      expect(vi.mocked(db.select)).toHaveBeenCalled();
    });

    it("makes two db.select calls - one for counts and one for items", async () => {
      mockSelectForList([mockNotification], { count: 1, unreadCount: 1 });

      await app.request("/", { method: "GET" });

      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(2);
    });

    it("uses default counts of 0 when counts query returns undefined", async () => {
      // Return undefined in the counts position
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            from: () => ({
              where: vi.fn().mockResolvedValue([{}]), // no count/unreadCount properties
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

      const res = await app.request("/", { method: "GET" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.meta.total_count).toBe(0);
      expect(body.meta.unread_count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // GET /unread-count - Get unread count
  // -------------------------------------------------------------------------
  describe("GET /unread-count - get unread notification count", () => {
    it("returns 200 with unread count", async () => {
      mockSelectForCount(3);

      const res = await app.request("/unread-count", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("unread-count");
      expect(body.data.type).toBe("notification-count");
      expect(body.data.attributes.unread_count).toBe(3);
    });

    it("returns zero when there are no unread notifications", async () => {
      mockSelectForCount(0);

      const res = await app.request("/unread-count", { method: "GET" });
      const body = await res.json();

      expect(body.data.attributes.unread_count).toBe(0);
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectForCount(1);

      await app.request("/unread-count", { method: "GET" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("calls db.select once for the count query", async () => {
      mockSelectForCount(5);

      await app.request("/unread-count", { method: "GET" });

      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /read-all - Mark all as read
  // -------------------------------------------------------------------------
  describe("PUT /read-all - mark all notifications as read", () => {
    it("returns 200 with updated_count matching unread count before update", async () => {
      mockSelectAndUpdateForReadAll(4);

      const res = await app.request("/read-all", { method: "PUT" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("read-all");
      expect(body.data.type).toBe("notification-bulk-update");
      expect(body.data.attributes.updated_count).toBe(4);
    });

    it("returns updated_count of 0 when no unread notifications exist", async () => {
      mockSelectAndUpdateForReadAll(0);

      const res = await app.request("/read-all", { method: "PUT" });
      const body = await res.json();

      expect(body.data.attributes.updated_count).toBe(0);
    });

    it("calls db.update to mark all notifications as read", async () => {
      mockSelectAndUpdateForReadAll(2);

      await app.request("/read-all", { method: "PUT" });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("calls db.select once to get unread count before update", async () => {
      mockSelectAndUpdateForReadAll(2);

      await app.request("/read-all", { method: "PUT" });

      expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectAndUpdateForReadAll(1);

      await app.request("/read-all", { method: "PUT" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("passes a Date to the readAt field in the update set", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await app.request("/read-all", { method: "PUT" });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ readAt: expect.any(Date) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id/read - Mark specific notification as read
  // -------------------------------------------------------------------------
  describe("PUT /:id/read - mark specific notification as read", () => {
    it("returns 200 with read status on success", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await app.request("/ntf_123/read", { method: "PUT" });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.id).toBe("ntf_123");
      expect(body.data.type).toBe("notification");
      expect(body.data.attributes.read).toBe(true);
      expect(body.data.attributes.read_at).toBeDefined();
    });

    it("emits a notification.read realtime event on success", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      await app.request("/ntf_123/read", { method: "PUT" });

      expect(vi.mocked(emitNotificationEvent)).toHaveBeenCalledWith(
        "notification.read",
        expect.objectContaining({
          actorId: mockSession.userId,
          notificationId: "ntf_123",
          data: expect.objectContaining({ readAt: expect.any(String) }),
        })
      );
    });

    it("calls db.update to set the readAt field", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      await app.request("/ntf_123/read", { method: "PUT" });

      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when notification is not found", async () => {
      mockSelectForSingle(null);

      const res = await app.request("/ntf_missing/read", { method: "PUT" });

      expect(res.status).toBe(500);
    });

    it("does not call db.update when notification is not found", async () => {
      mockSelectForSingle(null);

      await app.request("/ntf_missing/read", { method: "PUT" });

      expect(vi.mocked(db.update)).not.toHaveBeenCalled();
    });

    it("does not emit event when notification is not found", async () => {
      mockSelectForSingle(null);

      await app.request("/ntf_missing/read", { method: "PUT" });

      expect(vi.mocked(emitNotificationEvent)).not.toHaveBeenCalled();
    });

    it("returns 500 when notification belongs to a different user", async () => {
      const otherUserNotification = {
        ...mockNotification,
        userId: "usr_other",
      };
      mockSelectForSingle(otherUserNotification);

      const res = await app.request("/ntf_123/read", { method: "PUT" });

      expect(res.status).toBe(500);
    });

    it("does not emit event when notification belongs to a different user", async () => {
      const otherUserNotification = {
        ...mockNotification,
        userId: "usr_other",
      };
      mockSelectForSingle(otherUserNotification);

      await app.request("/ntf_123/read", { method: "PUT" });

      expect(vi.mocked(emitNotificationEvent)).not.toHaveBeenCalled();
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      await app.request("/ntf_123/read", { method: "PUT" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("read_at attribute in response is a valid ISO string", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await app.request("/ntf_123/read", { method: "PUT" });
      const body = await res.json();

      const readAt = body.data.attributes.read_at;
      expect(typeof readAt).toBe("string");
      expect(() => new Date(readAt)).not.toThrow();
      expect(new Date(readAt).toISOString()).toBe(readAt);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id - Delete notification
  // -------------------------------------------------------------------------
  describe("DELETE /:id - delete notification", () => {
    it("returns 204 No Content on successful deletion", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await app.request("/ntf_123", { method: "DELETE" });

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls db.delete once with the notification id", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await app.request("/ntf_123", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when notification is not found", async () => {
      mockSelectForSingle(null);

      const res = await app.request("/ntf_missing", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when notification is not found", async () => {
      mockSelectForSingle(null);

      await app.request("/ntf_missing", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("returns 500 when notification belongs to a different user", async () => {
      const otherUserNotification = {
        ...mockNotification,
        userId: "usr_other",
      };
      mockSelectForSingle(otherUserNotification);

      const res = await app.request("/ntf_123", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("does not call db.delete when notification belongs to a different user", async () => {
      const otherUserNotification = {
        ...mockNotification,
        userId: "usr_other",
      };
      mockSelectForSingle(otherUserNotification);

      await app.request("/ntf_123", { method: "DELETE" });

      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("calls requireAuth to authenticate the request", async () => {
      mockSelectForSingle(mockNotification);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await app.request("/ntf_123", { method: "DELETE" });

      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Exported Helper Functions
// ---------------------------------------------------------------------------

describe("createNotification helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateId).mockReturnValue("ntf_test123");

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("inserts a notification row into the database", async () => {
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "You were mentioned",
      body: "In a comment",
    });

    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    const insertValues = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ntf_test123",
        userId: "usr_123",
        type: "mention",
        title: "You were mentioned",
        body: "In a comment",
        readAt: null,
      })
    );
  });

  it("returns the generated notification ID", async () => {
    const result = await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "You were mentioned",
    });

    expect(result).toBe("ntf_test123");
  });

  it("emits a notification.created realtime event", async () => {
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "You were mentioned",
      body: "In a comment",
      projectId: "prj_456",
    });

    expect(vi.mocked(emitNotificationEvent)).toHaveBeenCalledWith(
      "notification.created",
      expect.objectContaining({
        actorId: "usr_123",
        notificationId: "ntf_test123",
        projectId: "prj_456",
        data: expect.objectContaining({
          notificationType: "mention",
          title: "You were mentioned",
          body: "In a comment",
        }),
      })
    );
  });

  it("emits event with actorId matching the userId", async () => {
    await createNotification({
      userId: "usr_abc",
      type: "upload",
      title: "Upload complete",
    });

    expect(vi.mocked(emitNotificationEvent)).toHaveBeenCalledWith(
      "notification.created",
      expect.objectContaining({
        actorId: "usr_abc",
      })
    );
  });

  it("stores null for body when not provided", async () => {
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "Notification without body",
    });

    const insertValues = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ body: null })
    );
  });

  it("stores null for data when not provided", async () => {
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "Notification without data",
    });

    const insertValues = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ data: null })
    );
  });

  it("stores provided data in the notification row", async () => {
    const extraData = { fileId: "file_789", commentId: "cmt_001" };
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "With data",
      data: extraData,
    });

    const insertValues = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ data: extraData })
    );
  });

  it("merges extra data fields into the event data payload", async () => {
    const extraData = { fileId: "file_789" };
    await createNotification({
      userId: "usr_123",
      type: "upload",
      title: "File uploaded",
      data: extraData,
    });

    expect(vi.mocked(emitNotificationEvent)).toHaveBeenCalledWith(
      "notification.created",
      expect.objectContaining({
        data: expect.objectContaining({
          fileId: "file_789",
          notificationType: "upload",
        }),
      })
    );
  });

  it("calls generateId with ntf prefix", async () => {
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "Test",
    });

    expect(vi.mocked(generateId)).toHaveBeenCalledWith("ntf");
  });

  it("sets createdAt to a Date instance", async () => {
    await createNotification({
      userId: "usr_123",
      type: "mention",
      title: "Test",
    });

    const insertValues = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
    const callArg = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.createdAt).toBeInstanceOf(Date);
  });
});

describe("createNotifications helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateId).mockReturnValue("ntf_test123");

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("returns empty array when given an empty items array", async () => {
    const result = await createNotifications([]);

    expect(result).toEqual([]);
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    expect(vi.mocked(emitNotificationEvent)).not.toHaveBeenCalled();
  });

  it("inserts all notifications in a single db.insert call", async () => {
    const items = [
      { userId: "usr_001", type: "mention", title: "Mention 1" },
      { userId: "usr_002", type: "upload", title: "Upload done" },
    ];

    await createNotifications(items);

    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
  });

  it("returns an array of generated notification IDs", async () => {
    vi.mocked(generateId)
      .mockReturnValueOnce("ntf_aaa")
      .mockReturnValueOnce("ntf_bbb");

    const result = await createNotifications([
      { userId: "usr_001", type: "mention", title: "First" },
      { userId: "usr_002", type: "upload", title: "Second" },
    ]);

    expect(result).toEqual(["ntf_aaa", "ntf_bbb"]);
  });

  it("emits notification.created event for each item", async () => {
    vi.mocked(generateId)
      .mockReturnValueOnce("ntf_aaa")
      .mockReturnValueOnce("ntf_bbb");

    await createNotifications([
      { userId: "usr_001", type: "mention", title: "First", projectId: "prj_1" },
      { userId: "usr_002", type: "upload", title: "Second", projectId: "prj_2" },
    ]);

    expect(vi.mocked(emitNotificationEvent)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(emitNotificationEvent)).toHaveBeenNthCalledWith(
      1,
      "notification.created",
      expect.objectContaining({
        actorId: "usr_001",
        notificationId: "ntf_aaa",
        projectId: "prj_1",
      })
    );
    expect(vi.mocked(emitNotificationEvent)).toHaveBeenNthCalledWith(
      2,
      "notification.created",
      expect.objectContaining({
        actorId: "usr_002",
        notificationId: "ntf_bbb",
        projectId: "prj_2",
      })
    );
  });

  it("inserts values array with the correct row shapes", async () => {
    vi.mocked(generateId)
      .mockReturnValueOnce("ntf_aaa")
      .mockReturnValueOnce("ntf_bbb");

    await createNotifications([
      { userId: "usr_001", type: "mention", title: "First", body: "Body 1" },
      { userId: "usr_002", type: "upload", title: "Second" },
    ]);

    const insertValues = (vi.mocked(db.insert).mock.results[0].value as { values: ReturnType<typeof vi.fn> }).values;
    const callArg = insertValues.mock.calls[0][0] as Array<Record<string, unknown>>;

    expect(callArg).toHaveLength(2);
    expect(callArg[0]).toMatchObject({
      id: "ntf_aaa",
      userId: "usr_001",
      type: "mention",
      title: "First",
      body: "Body 1",
      readAt: null,
    });
    expect(callArg[1]).toMatchObject({
      id: "ntf_bbb",
      userId: "usr_002",
      type: "upload",
      title: "Second",
      body: null,
      readAt: null,
    });
  });

  it("handles a single notification item correctly", async () => {
    vi.mocked(generateId).mockReturnValueOnce("ntf_single");

    const result = await createNotifications([
      { userId: "usr_001", type: "mention", title: "Solo notification" },
    ]);

    expect(result).toEqual(["ntf_single"]);
    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emitNotificationEvent)).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// NOTIFICATION_TYPES constant
// ---------------------------------------------------------------------------

describe("NOTIFICATION_TYPES constant", () => {
  it("has a MENTION type with value 'mention'", () => {
    expect(NOTIFICATION_TYPES.MENTION).toBe("mention");
  });

  it("has a COMMENT_REPLY type with value 'comment_reply'", () => {
    expect(NOTIFICATION_TYPES.COMMENT_REPLY).toBe("comment_reply");
  });

  it("has a COMMENT_CREATED type with value 'comment_created'", () => {
    expect(NOTIFICATION_TYPES.COMMENT_CREATED).toBe("comment_created");
  });

  it("has an UPLOAD type with value 'upload'", () => {
    expect(NOTIFICATION_TYPES.UPLOAD).toBe("upload");
  });

  it("has a STATUS_CHANGE type with value 'status_change'", () => {
    expect(NOTIFICATION_TYPES.STATUS_CHANGE).toBe("status_change");
  });

  it("has a SHARE_INVITE type with value 'share_invite'", () => {
    expect(NOTIFICATION_TYPES.SHARE_INVITE).toBe("share_invite");
  });

  it("has a SHARE_VIEWED type with value 'share_viewed'", () => {
    expect(NOTIFICATION_TYPES.SHARE_VIEWED).toBe("share_viewed");
  });

  it("has a SHARE_DOWNLOADED type with value 'share_downloaded'", () => {
    expect(NOTIFICATION_TYPES.SHARE_DOWNLOADED).toBe("share_downloaded");
  });

  it("has an ASSIGNMENT type with value 'assignment'", () => {
    expect(NOTIFICATION_TYPES.ASSIGNMENT).toBe("assignment");
  });

  it("has a FILE_PROCESSED type with value 'file_processed'", () => {
    expect(NOTIFICATION_TYPES.FILE_PROCESSED).toBe("file_processed");
  });

  it("contains exactly 10 notification types", () => {
    expect(Object.keys(NOTIFICATION_TYPES)).toHaveLength(10);
  });
});
