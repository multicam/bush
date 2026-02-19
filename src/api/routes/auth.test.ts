/**
 * Bush Platform - Auth Routes Tests
 *
 * Integration-style tests for authentication API routes.
 * Tests POST /token, POST /revoke, and GET /me endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "../router.js";

// ---- Hoisted mutable state for middleware session injection ----
const { mockSessionRef } = vi.hoisted(() => ({
  mockSessionRef: { current: undefined as any },
}));

// ---- Mocks ----

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
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
  accounts: {
    id: "id",
    name: "name",
    slug: "slug",
    plan: "plan",
    storageUsedBytes: "storageUsedBytes",
    storageQuotaBytes: "storageQuotaBytes",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  accountMemberships: { accountId: "accountId", userId: "userId", role: "role" },
  workspaces: { id: "id", name: "name", accountId: "accountId" },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (c: any, next: any) => {
    if (mockSessionRef.current) {
      c.set("session", mockSessionRef.current);
    }
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../../auth/session-cache.js", () => ({
  sessionCache: {
    get: vi.fn(),
    touch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn(),
  parseLimit: vi.fn().mockReturnValue(50),
  errorHandler: vi.fn((error: Error, c: any) => {
    // Minimal error handler replicating the real one's shape
    const status =
      (error as any).status ??
      ((error as any).code === "validation_error" ? 422 : 500);
    return c.json(
      { errors: [{ title: error.name, detail: error.message, status }] },
      status
    );
  }),
}));

// ---- Import after mocks ----
import { db } from "../../db/index.js";
import { sessionCache } from "../../auth/session-cache.js";
import { requireAuth } from "../auth-middleware.js";
import authRoutes from "./auth.js";

// ---- Helpers ----

function buildApp() {
  const app = new Hono();
  app.route("/", authRoutes);
  // Attach the (mocked) error handler so thrown errors become JSON responses
  app.onError((err, c) => {
    const status = (err as any).status ?? 500;
    return c.json(
      { errors: [{ title: err.name, detail: err.message, status }] },
      status
    );
  });
  return app;
}

function jsonBody(obj: unknown) {
  return JSON.stringify(obj);
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "sess_456",
    userId: "usr_123",
    email: "test@example.com",
    displayName: "Test User",
    currentAccountId: "acc_789",
    accountRole: "member",
    workosOrganizationId: "org_abc",
    workosUserId: "wusr_abc",
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

// ---- Tests ----

describe("Auth Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionRef.current = undefined;
    app = buildApp();
  });

  // =========================================================
  // POST /token
  // =========================================================
  describe("POST /token", () => {
    it("returns a new access token and refresh token for a valid refresh token", async () => {
      const session = makeSession();
      vi.mocked(sessionCache.get).mockResolvedValueOnce(session as any);
      vi.mocked(sessionCache.touch).mockResolvedValueOnce(undefined);

      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({
          grant_type: "refresh_token",
          refresh_token: "bush_rt_usr_123:sess_456",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.type).toBe("token");
      expect(body.data.id).toBe("sess_456");
      expect(body.data.attributes.token_type).toBe("Bearer");
      expect(body.data.attributes.expires_in).toBe(300);
      expect(body.data.attributes.access_token).toBe("bush_tok_usr_123:sess_456");
      expect(body.data.attributes.refresh_token).toBe("bush_rt_usr_123:sess_456");

      expect(sessionCache.get).toHaveBeenCalledWith("usr_123", "sess_456");
      expect(sessionCache.touch).toHaveBeenCalledWith("usr_123", "sess_456");
    });

    it("returns 422 when grant_type is not refresh_token", async () => {
      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ grant_type: "authorization_code" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Unsupported grant_type/i);
    });

    it("returns 422 when grant_type is missing", async () => {
      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({}),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Unsupported grant_type/i);
    });

    it("returns 422 when refresh_token is missing", async () => {
      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ grant_type: "refresh_token" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/refresh_token is required/i);
    });

    it("returns 401 when refresh_token does not start with bush_rt_", async () => {
      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({
          grant_type: "refresh_token",
          refresh_token: "invalid_token_format",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Invalid refresh token format/i);
    });

    it("returns 401 when refresh_token has wrong part count after prefix", async () => {
      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({
          grant_type: "refresh_token",
          refresh_token: "bush_rt_nocolon",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Invalid refresh token format/i);
    });

    it("returns 401 when session is not found in cache", async () => {
      vi.mocked(sessionCache.get).mockResolvedValueOnce(null);

      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({
          grant_type: "refresh_token",
          refresh_token: "bush_rt_usr_123:sess_456",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Invalid or expired refresh token/i);
    });

    it("handles non-JSON body gracefully and returns 422 for missing grant_type", async () => {
      const res = await app.request("/token", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });

      // Body parse fails → empty object → grant_type missing → ValidationError (422)
      expect(res.status).toBe(422);
    });
  });

  // =========================================================
  // POST /revoke
  // =========================================================
  describe("POST /revoke", () => {
    it("revokes the active session found in context", async () => {
      const session = makeSession();
      mockSessionRef.current = session;
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("sess_456");
      expect(body.data.type).toBe("token");
      expect(body.data.attributes.revoked).toBe(true);
      expect(sessionCache.delete).toHaveBeenCalledWith("usr_123", "sess_456");
    });

    it("revokes token passed as bush_rt_ format when no session in context", async () => {
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "bush_rt_usr_123:sess_456" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("sess_456");
      expect(body.data.attributes.revoked).toBe(true);
      expect(sessionCache.delete).toHaveBeenCalledWith("usr_123", "sess_456");
    });

    it("revokes token passed as bush_tok_ format when no session in context", async () => {
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "bush_tok_usr_123:sess_456" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("sess_456");
      expect(body.data.attributes.revoked).toBe(true);
      expect(sessionCache.delete).toHaveBeenCalledWith("usr_123", "sess_456");
    });

    it("revokes token passed as raw userId:sessionId format", async () => {
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "usr_123:sess_456" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("sess_456");
      expect(body.data.attributes.revoked).toBe(true);
      expect(sessionCache.delete).toHaveBeenCalledWith("usr_123", "sess_456");
    });

    it("returns 422 when no session in context and no token in body", async () => {
      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({}),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/token is required/i);
    });

    it("returns 401 when bush_rt_ token has invalid part count", async () => {
      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "bush_rt_nocolon" }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Invalid token format/i);
    });

    it("returns 401 when bush_tok_ token has invalid part count", async () => {
      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "bush_tok_nocolon" }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Invalid token format/i);
    });

    it("returns 401 when raw token has no colon separator", async () => {
      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "totallyinvalidtoken" }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/Invalid token format/i);
    });

    it("prefers active context session over body token when both present", async () => {
      const session = makeSession();
      mockSessionRef.current = session;
      vi.mocked(sessionCache.delete).mockResolvedValueOnce(undefined);

      // Body token would target different IDs if it were parsed
      const res = await app.request("/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ token: "bush_rt_other_usr:other_sess" }),
      });

      expect(res.status).toBe(200);
      // Should have used the context session, not the body token
      expect(sessionCache.delete).toHaveBeenCalledWith("usr_123", "sess_456");
      expect(sessionCache.delete).not.toHaveBeenCalledWith("other_usr", "other_sess");
    });
  });

  // =========================================================
  // GET /me
  // =========================================================
  describe("GET /me", () => {
    function mockDbChain(resolvedValue: any) {
      const chainObj: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(resolvedValue),
        innerJoin: vi.fn().mockReturnThis(),
      };
      // Allow the chain to also resolve directly (for queries without .limit())
      chainObj.innerJoin.mockImplementation(() => ({
        where: vi.fn().mockResolvedValue(resolvedValue),
      }));
      return chainObj;
    }

    function setupRequireAuth(sessionOverrides: Record<string, unknown> = {}) {
      const session = makeSession(sessionOverrides);
      vi.mocked(requireAuth).mockReturnValue(session as any);
      return session;
    }

    it("returns full user data with accounts and workspaces", async () => {
      const session = setupRequireAuth();

      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: "Jane",
        lastName: "Doe",
        avatarUrl: "https://example.com/avatar.png",
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-06-01T00:00:00Z"),
      };

      const mockAccount = {
        id: "acc_789",
        name: "Acme Corp",
        slug: "acme-corp",
        plan: "pro",
        storageUsedBytes: 1000,
        storageQuotaBytes: 100000,
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-06-01T00:00:00Z"),
      };

      const mockAllAccounts = [
        { id: "acc_789", name: "Acme Corp", slug: "acme-corp", plan: "pro", role: "owner" },
      ];

      const mockWorkspaces = [
        { id: "ws_001", name: "Main Workspace" },
      ];

      // The handler calls db.select() 4 times sequentially:
      // 1. Get user
      // 2. Get current account
      // 3. Get all accounts via join
      // 4. Get workspaces
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAccount]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockAllAccounts),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockWorkspaces),
          }),
        } as any);

      const res = await app.request("/me", {
        method: "GET",
        headers: { Authorization: "Bearer usr_123:sess_456" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // Verify top-level structure
      expect(body.data.id).toBe("usr_123");
      expect(body.data.type).toBe("user");

      // Verify user attributes
      expect(body.data.attributes.email).toBe("test@example.com");
      expect(body.data.attributes.first_name).toBe("Jane");
      expect(body.data.attributes.last_name).toBe("Doe");
      expect(body.data.attributes.display_name).toBe("Jane Doe");
      expect(body.data.attributes.avatar_url).toBe("https://example.com/avatar.png");

      // Verify relationships
      expect(body.data.relationships.current_account.data).toEqual({
        id: "acc_789",
        type: "account",
      });
      expect(body.data.relationships.accounts.data).toEqual([
        { id: "acc_789", type: "account" },
      ]);
      expect(body.data.relationships.workspaces.data).toEqual([
        { id: "ws_001", type: "workspace" },
      ]);

      // Verify included resources contain account
      const includedAccount = body.included.find(
        (r: any) => r.type === "account" && r.id === "acc_789"
      );
      expect(includedAccount).toBeDefined();
      expect(includedAccount.attributes.name).toBe("Acme Corp");
      expect(includedAccount.attributes.slug).toBe("acme-corp");
      expect(includedAccount.attributes.plan).toBe("pro");

      // Verify included resources contain workspace
      const includedWorkspace = body.included.find(
        (r: any) => r.type === "workspace" && r.id === "ws_001"
      );
      expect(includedWorkspace).toBeDefined();
      expect(includedWorkspace.attributes.name).toBe("Main Workspace");

      expect(requireAuth).toHaveBeenCalled();
    });

    it("returns null for current_account when account is not found", async () => {
      setupRequireAuth();

      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: "Jane",
        lastName: null,
        avatarUrl: null,
        createdAt: null,
        updatedAt: null,
      };

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        } as any)
        // Account not found
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

      const res = await app.request("/me", { method: "GET" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.relationships.current_account.data).toBeNull();
    });

    it("returns 401 when user is not found in database", async () => {
      setupRequireAuth();

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.request("/me", { method: "GET" });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.errors[0].detail).toMatch(/User not found/i);
    });

    it("computes display_name from first and last name", async () => {
      setupRequireAuth();

      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: "Alice",
        lastName: "Smith",
        avatarUrl: null,
        createdAt: null,
        updatedAt: null,
      };

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

      const res = await app.request("/me", { method: "GET" });
      const body = await res.json();
      expect(body.data.attributes.display_name).toBe("Alice Smith");
    });

    it("returns null display_name when both firstName and lastName are null", async () => {
      setupRequireAuth();

      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: null,
        lastName: null,
        avatarUrl: null,
        createdAt: null,
        updatedAt: null,
      };

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

      const res = await app.request("/me", { method: "GET" });
      const body = await res.json();
      expect(body.data.attributes.display_name).toBeNull();
    });

    it("includes multiple accounts and workspaces correctly", async () => {
      setupRequireAuth();

      const mockUser = {
        id: "usr_123",
        email: "test@example.com",
        firstName: "Jane",
        lastName: "Doe",
        avatarUrl: null,
        createdAt: null,
        updatedAt: null,
      };

      const mockAccount = {
        id: "acc_789",
        name: "Primary Account",
        slug: "primary",
        plan: "enterprise",
        storageUsedBytes: 0,
        storageQuotaBytes: 999999,
        createdAt: null,
        updatedAt: null,
      };

      const mockAllAccounts = [
        { id: "acc_789", name: "Primary Account", slug: "primary", plan: "enterprise", role: "owner" },
        { id: "acc_002", name: "Secondary Account", slug: "secondary", plan: "free", role: "member" },
      ];

      const mockWorkspaces = [
        { id: "ws_001", name: "Design" },
        { id: "ws_002", name: "Engineering" },
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAccount]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockAllAccounts),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockWorkspaces),
          }),
        } as any);

      const res = await app.request("/me", { method: "GET" });
      expect(res.status).toBe(200);
      const body = await res.json();

      // Both accounts should be in relationships.accounts
      expect(body.data.relationships.accounts.data).toHaveLength(2);

      // Both workspaces should be in relationships.workspaces
      expect(body.data.relationships.workspaces.data).toHaveLength(2);

      // Non-current account appears in included without storageUsedBytes
      const secondaryIncluded = body.included.find(
        (r: any) => r.type === "account" && r.id === "acc_002"
      );
      expect(secondaryIncluded).toBeDefined();
      expect(secondaryIncluded.attributes.name).toBe("Secondary Account");
      expect(secondaryIncluded.attributes.role).toBe("member");

      // Both workspaces appear in included
      const ws1 = body.included.find((r: any) => r.type === "workspace" && r.id === "ws_001");
      const ws2 = body.included.find((r: any) => r.type === "workspace" && r.id === "ws_002");
      expect(ws1).toBeDefined();
      expect(ws2).toBeDefined();
    });

    it("calls requireAuth to enforce authentication", async () => {
      // Make requireAuth throw (simulates unauthenticated request)
      vi.mocked(requireAuth).mockImplementationOnce(() => {
        throw Object.assign(new Error("Authentication required"), {
          name: "Unauthorized",
          status: 401,
        });
      });

      const res = await app.request("/me", { method: "GET" });

      expect(res.status).toBe(401);
      expect(requireAuth).toHaveBeenCalled();
    });
  });
});
