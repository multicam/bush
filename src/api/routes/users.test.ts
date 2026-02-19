/**
 * Bush Platform - User Routes Tests
 *
 * Comprehensive unit tests for the /users API route handlers.
 * Tests GET /me, GET /:id, and PATCH /:id endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// --- Mocks must be declared before imports ---

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../db/schema.js", () => ({
  users: {
    id: "id",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    avatarUrl: "avatarUrl",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  accountMemberships: {
    id: "id",
    accountId: "accountId",
    userId: "userId",
    role: "role",
  },
  accounts: {
    id: "id",
    name: "name",
    slug: "slug",
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("usr_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// Import after mocks are set up
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import usersRouter from "./users.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner" as const,
};

const mockUser = {
  id: "usr_123",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  avatarUrl: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockUpdatedUser = {
  ...mockUser,
  firstName: "Updated",
  lastName: "Name",
  updatedAt: new Date("2024-06-01"),
};

const mockMemberships = [
  { id: "acc_123", name: "Test Account", slug: "test", role: "owner" },
];

// ---------------------------------------------------------------------------
// App factory
//
// We mount the router under a fresh Hono app for each test so that the mock
// session is wired in through the `requireAuth` stub before the route handler
// runs. The sub-app has no error handler registered, so thrown errors surface
// as HTTP 500 responses (Hono default behaviour).
// ---------------------------------------------------------------------------

function buildApp() {
  const app = new Hono();
  app.route("/", usersRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up requireAuth to return the given session for every call. */
function mockAuthSession(session = mockSession) {
  vi.mocked(requireAuth).mockReturnValue(session as any);
}

/** Build a sequential chain mock for db.select() that resolves to `rows`. */
function selectReturning(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/** db.select() chain with an innerJoin step (memberships query). */
function selectWithInnerJoinReturning(rows: unknown[]) {
  return {
    from: () => ({
      innerJoin: () => ({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/** db.select() chain with an and/where step (membership existence check). */
function selectMembershipCheckReturning(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/** db.select() chain that uses a projection object ({...}) before from(). */

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("User Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  // -------------------------------------------------------------------------
  // GET /me
  // -------------------------------------------------------------------------

  describe("GET /me", () => {
    it("returns 200 with user and accounts on success", async () => {
      mockAuthSession();

      // First select: fetch user by id
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      // Second select: fetch memberships via innerJoin
      vi.mocked(db.select).mockReturnValueOnce(
        selectWithInnerJoinReturning(mockMemberships)
      );

      const res = await app.request("/me", { method: "GET" });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);

      // Top-level shape
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("relationships");
      expect(body).toHaveProperty("included");

      // data object
      expect(body.data.id).toBe(mockUser.id);
      expect(body.data.type).toBe("user");
      expect(body.data.attributes.email).toBe(mockUser.email);
      expect(body.data.attributes.first_name).toBe(mockUser.firstName);
      expect(body.data.attributes.last_name).toBe(mockUser.lastName);
      expect(body.data.attributes.display_name).toBe("Test User");
      expect(body.data.attributes.avatar_url).toBeNull();
      expect(body.data.attributes.created_at).toBeDefined();
      expect(body.data.attributes.updated_at).toBeDefined();

      // relationships
      expect(body.relationships.current_account.data.id).toBe(
        mockSession.currentAccountId
      );
      expect(body.relationships.current_account.data.type).toBe("account");
      expect(body.relationships.accounts.data).toHaveLength(1);
      expect(body.relationships.accounts.data[0].id).toBe("acc_123");
      expect(body.relationships.accounts.data[0].type).toBe("account");

      // included
      expect(body.included).toHaveLength(1);
      expect(body.included[0].id).toBe(mockSession.currentAccountId);
      expect(body.included[0].type).toBe("account");
      expect(body.included[0].attributes.name).toBe("Test Account");
      expect(body.included[0].attributes.slug).toBe("test");
      expect(body.included[0].attributes.role).toBe("owner");
    });

    it("returns 200 with empty accounts array when user has no memberships", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      vi.mocked(db.select).mockReturnValueOnce(
        selectWithInnerJoinReturning([])
      );

      const res = await app.request("/me", { method: "GET" });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.relationships.accounts.data).toHaveLength(0);
      // Current account included entry will have undefined name/slug
      expect(body.included[0].attributes.name).toBeUndefined();
      expect(body.included[0].attributes.slug).toBeUndefined();
    });

    it("returns 200 with correct display_name when only firstName is set", async () => {
      mockAuthSession();

      const userNoLastName = { ...mockUser, lastName: null };
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([userNoLastName])
      );
      vi.mocked(db.select).mockReturnValueOnce(
        selectWithInnerJoinReturning(mockMemberships)
      );

      const res = await app.request("/me", { method: "GET" });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.data.attributes.display_name).toBe("Test");
    });

    it("returns 200 with null display_name when both first and last name are null", async () => {
      mockAuthSession();

      const userNoName = { ...mockUser, firstName: null, lastName: null };
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([userNoName]));
      vi.mocked(db.select).mockReturnValueOnce(
        selectWithInnerJoinReturning(mockMemberships)
      );

      const res = await app.request("/me", { method: "GET" });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.data.attributes.display_name).toBeNull();
    });

    it("returns 500 when user is not found in the database", async () => {
      mockAuthSession();

      // Empty array causes the handler to throw NotFoundError
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([]));

      const res = await app.request("/me", { method: "GET" });

      // Sub-app without error handler returns 500 for unhandled thrown errors
      expect(res.status).toBe(500);
    });

    it("calls db.select twice (user + memberships)", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      vi.mocked(db.select).mockReturnValueOnce(
        selectWithInnerJoinReturning(mockMemberships)
      );

      await app.request("/me", { method: "GET" });

      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id
  // -------------------------------------------------------------------------

  describe("GET /:id", () => {
    it("returns 200 with own profile including email", async () => {
      mockAuthSession();

      // Fetching own profile skips the membership check
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      const res = await app.request(`/${mockSession.userId}`, {
        method: "GET",
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.data.id).toBe(mockUser.id);
      expect(body.data.type).toBe("user");
      expect(body.data.attributes.email).toBe(mockUser.email);
      expect(body.data.attributes.first_name).toBe(mockUser.firstName);
      expect(body.data.attributes.last_name).toBe(mockUser.lastName);
    });

    it("returns 200 for another user in the same account (email omitted)", async () => {
      mockAuthSession();

      const otherUserId = "usr_other";
      const otherUser = { ...mockUser, id: otherUserId, email: "other@example.com" };

      // First select: membership existence check
      vi.mocked(db.select).mockReturnValueOnce(
        selectMembershipCheckReturning([{ id: "mem_1", accountId: "acc_123", userId: otherUserId }])
      );
      // Second select: fetch the target user
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([otherUser]));

      const res = await app.request(`/${otherUserId}`, { method: "GET" });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.data.id).toBe(otherUserId);
      expect(body.data.type).toBe("user");
      // Email is omitted for other users (undefined attributes key)
      expect(body.data.attributes.email).toBeUndefined();
    });

    it("returns 500 when other user is not in the same account", async () => {
      mockAuthSession();

      const strangerUserId = "usr_stranger";

      // Membership check returns empty (user not in same account)
      vi.mocked(db.select).mockReturnValueOnce(
        selectMembershipCheckReturning([])
      );

      const res = await app.request(`/${strangerUserId}`, { method: "GET" });

      // NotFoundError is thrown and bubbles up as 500 without error handler
      expect(res.status).toBe(500);
    });

    it("returns 500 when user record is not found after membership check passes", async () => {
      mockAuthSession();

      const otherUserId = "usr_ghost";

      // Membership exists
      vi.mocked(db.select).mockReturnValueOnce(
        selectMembershipCheckReturning([{ id: "mem_1", accountId: "acc_123", userId: otherUserId }])
      );
      // But user row is missing
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([]));

      const res = await app.request(`/${otherUserId}`, { method: "GET" });

      expect(res.status).toBe(500);
    });

    it("skips membership check when fetching own profile", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      await app.request(`/${mockSession.userId}`, { method: "GET" });

      // Only one db.select call (no membership check)
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it("performs membership check when fetching another user", async () => {
      mockAuthSession();

      const otherUserId = "usr_other";
      const otherUser = { ...mockUser, id: otherUserId };

      vi.mocked(db.select).mockReturnValueOnce(
        selectMembershipCheckReturning([{ id: "mem_1" }])
      );
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([otherUser]));

      await app.request(`/${otherUserId}`, { method: "GET" });

      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it("returns correct display_name for the retrieved user", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      const res = await app.request(`/${mockSession.userId}`, {
        method: "GET",
      });
      const body = (await res.json()) as any;

      expect(body.data.attributes.display_name).toBe("Test User");
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /:id
  // -------------------------------------------------------------------------

  describe("PATCH /:id", () => {
    const patchBody = {
      first_name: "Updated",
      last_name: "Name",
    };

    it("returns 200 with updated user when updating own profile", async () => {
      mockAuthSession();

      // First select: verify user exists
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      // db.update chain
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
      // Second select: fetch updated user
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([mockUpdatedUser])
      );

      const res = await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const body = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(body.data.id).toBe(mockUpdatedUser.id);
      expect(body.data.type).toBe("user");
      expect(body.data.attributes.first_name).toBe(mockUpdatedUser.firstName);
      expect(body.data.attributes.last_name).toBe(mockUpdatedUser.lastName);
      expect(body.data.attributes.email).toBe(mockUpdatedUser.email);
    });

    it("returns 500 when trying to update another user's profile", async () => {
      mockAuthSession();

      // AuthorizationError is thrown immediately without any db calls
      const res = await app.request("/usr_other", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      expect(res.status).toBe(500);
      // No db calls should have been made
      expect(db.select).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });

    it("returns 500 when user record is not found", async () => {
      mockAuthSession();

      // Select returns empty array - user does not exist
      vi.mocked(db.select).mockReturnValueOnce(selectReturning([]));

      const res = await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      expect(res.status).toBe(500);
      expect(db.update).not.toHaveBeenCalled();
    });

    it("updates only first_name when only first_name is provided", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([{ ...mockUser, firstName: "NewFirst" }])
      );

      const res = await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "NewFirst" }),
      });

      expect(res.status).toBe(200);
      // The set payload should contain firstName but not lastName
      const setPayload = mockSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setPayload).toHaveProperty("firstName", "NewFirst");
      expect(setPayload).not.toHaveProperty("lastName");
      expect(setPayload).toHaveProperty("updatedAt");
    });

    it("updates only last_name when only last_name is provided", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([{ ...mockUser, lastName: "NewLast" }])
      );

      const res = await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_name: "NewLast" }),
      });

      expect(res.status).toBe(200);
      const setPayload = mockSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setPayload).toHaveProperty("lastName", "NewLast");
      expect(setPayload).not.toHaveProperty("firstName");
    });

    it("updates avatar_url when avatar_url is provided", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const updatedWithAvatar = {
        ...mockUser,
        avatarUrl: "https://example.com/avatar.png",
      };
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([updatedWithAvatar])
      );

      const res = await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: "https://example.com/avatar.png" }),
      });

      expect(res.status).toBe(200);
      const setPayload = mockSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setPayload).toHaveProperty(
        "avatarUrl",
        "https://example.com/avatar.png"
      );
    });

    it("always includes updatedAt in the update payload", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([mockUpdatedUser])
      );

      await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "X" }),
      });

      const setPayload = mockSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setPayload.updatedAt).toBeInstanceOf(Date);
    });

    it("calls db.update exactly once when update is successful", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([mockUpdatedUser])
      );

      await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("fetches updated user after performing the update", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([mockUpdatedUser])
      );

      await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      // Two selects: pre-update existence check + post-update fetch
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it("returns correct display_name in the PATCH response", async () => {
      mockAuthSession();

      vi.mocked(db.select).mockReturnValueOnce(selectReturning([mockUser]));
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
      vi.mocked(db.select).mockReturnValueOnce(
        selectReturning([mockUpdatedUser])
      );

      const res = await app.request(`/${mockSession.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const body = (await res.json()) as any;

      expect(body.data.attributes.display_name).toBe("Updated Name");
    });
  });
});
