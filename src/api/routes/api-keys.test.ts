/**
 * Bush Platform - API Keys Routes Tests
 *
 * Comprehensive unit tests for API key management routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import type { SessionData } from "../../auth/types.js";

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
  verifyAccountAccess: vi.fn(),
}));

vi.mock("../api-key-service.js", () => ({
  apiKeyService: {
    listKeys: vi.fn(),
    createKey: vi.fn(),
    getKey: vi.fn(),
    updateKey: vi.fn(),
    revokeKey: vi.fn(),
    deleteKey: vi.fn(),
  },
}));

vi.mock("../router.js", () => ({
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("../validation.js", () => ({
  validateBody: vi.fn(),
}));

import { apiKeysRoutes } from "./api-keys.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyAccountAccess } from "../access-control.js";
import { apiKeyService } from "../api-key-service.js";
import { validateBody } from "../validation.js";

// Simple error handler for tests
function testErrorHandler(error: Error, c: { json: (body: unknown, status: number) => Response }): Response {
  let status = 500;
  let code = "internal_error";
  let detail = error.message;

  if (error instanceof NotFoundError) {
    status = 404;
    code = "not_found";
  } else if (error instanceof ValidationError) {
    status = 422;
    code = "validation_error";
  }

  return c.json({
    errors: [{ status, code, detail }],
  }, status as 404 | 422 | 500);
}

// Create test app with error handler
const createTestApp = () => {
  const app = new Hono();
  app.onError(testErrorHandler);
  app.route("/v4/accounts/:accountId/api-keys", apiKeysRoutes);
  return app;
};

const app = createTestApp();

// Helper to create mock session
function createMockSession(overrides?: Partial<SessionData>): SessionData {
  return {
    sessionId: "sess_test123",
    userId: "usr_test123",
    email: "test@example.com",
    displayName: "Test User",
    currentAccountId: "acc_test123",
    accountRole: "owner",
    workosOrganizationId: "org_test",
    workosUserId: "wusr_test",
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    avatarUrl: null,
    ...overrides,
  };
}

describe("API Keys Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v4/accounts/:accountId/api-keys", () => {
    it("should list API keys for authorized account", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.listKeys).mockResolvedValue([
        {
          id: "key_1",
          accountId: "acc_test123",
          userId: "usr_test123",
          userName: "Test",
          name: "Test Key 1",
          scope: "read_only",
          keyPrefix: "abc12345",
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "key_2",
          accountId: "acc_test123",
          userId: "usr_test123",
          userName: "Test",
          name: "Test Key 2",
          scope: "admin",
          keyPrefix: "def67890",
          lastUsedAt: new Date("2024-01-15"),
          expiresAt: new Date("2025-01-01"),
          revokedAt: null,
          createdAt: new Date("2024-01-02"),
        },
      ]);

      const res = await app.request("/v4/accounts/acc_test123/api-keys");
      expect(res.status).toBe(200);

      const json = await res.json() as { data: unknown[] };
      expect(json.data).toHaveLength(2);
      expect(verifyAccountAccess).toHaveBeenCalledWith("acc_test123", "acc_test123");
      expect(apiKeyService.listKeys).toHaveBeenCalledWith("acc_test123");
    });

    it("should return 404 when account not accessible", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(false);

      const res = await app.request("/v4/accounts/acc_other/api-keys");
      expect(res.status).toBe(404);

      const json = await res.json() as { errors: Array<{ detail: string }> };
      expect(json.errors[0].detail).toContain("account");
    });
  });

  describe("POST /v4/accounts/:accountId/api-keys", () => {
    it("should create an API key with default scope", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(validateBody).mockResolvedValue({
        name: "New Key",
        scope: "read_only",
        expires_at: null,
      });
      vi.mocked(apiKeyService.createKey).mockResolvedValue({
        id: "key_new",
        accountId: "acc_test123",
        userId: "usr_test123",
        name: "New Key",
        scope: "read_only",
        keyPrefix: "new12345",
        key: "bush_key_new12345678901234567890123456789012345678",
        expiresAt: null,
        createdAt: new Date(),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Key" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as { data: { attributes: { name: string; key: string } } };
      expect(json.data.attributes.name).toBe("New Key");
      expect(json.data.attributes.key).toMatch(/^bush_key_/);
    });

    it("should create an API key with custom scope and expiration", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      vi.mocked(validateBody).mockResolvedValue({
        name: "Expiring Key",
        scope: "admin",
        expires_at: expiresAt.toISOString(),
      });
      vi.mocked(apiKeyService.createKey).mockResolvedValue({
        id: "key_expiring",
        accountId: "acc_test123",
        userId: "usr_test123",
        name: "Expiring Key",
        scope: "admin",
        keyPrefix: "exp12345",
        key: "bush_key_exp12345678901234567890123456789012345678",
        expiresAt,
        createdAt: new Date(),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Expiring Key",
          scope: "admin",
          expires_at: expiresAt.toISOString(),
        }),
      });

      expect(res.status).toBe(201);
    });

    it("should return 422 for expiration date in the past", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(validateBody).mockResolvedValue({
        name: "Past Key",
        scope: "read_only",
        expires_at: pastDate.toISOString(),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Past Key",
          expires_at: pastDate.toISOString(),
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should return 404 when account not accessible", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(false);
      vi.mocked(validateBody).mockResolvedValue({
        name: "New Key",
        scope: "read_only",
      });

      const res = await app.request("/v4/accounts/acc_other/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Key" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /v4/accounts/:accountId/api-keys/:keyId", () => {
    it("should return a single API key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.getKey).mockResolvedValue({
        id: "key_test",
        accountId: "acc_test123",
        userId: "usr_test123",
        userName: "Test",
        name: "Test Key",
        scope: "read_write",
        keyPrefix: "abc12345",
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date("2024-01-01"),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_test");
      expect(res.status).toBe(200);

      const json = await res.json() as { data: { id: string; attributes: { name: string } } };
      expect(json.data.id).toBe("key_test");
      expect(json.data.attributes.name).toBe("Test Key");
    });

    it("should return 404 for non-existent key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.getKey).mockResolvedValue(null);

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_nonexistent");
      expect(res.status).toBe(404);
    });

    it("should return 404 when account not accessible", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(false);

      const res = await app.request("/v4/accounts/acc_other/api-keys/key_test");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /v4/accounts/:accountId/api-keys/:keyId", () => {
    it("should update API key name", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(validateBody).mockResolvedValue({
        name: "Updated Name",
      });
      vi.mocked(apiKeyService.getKey).mockResolvedValue({
        id: "key_test",
        accountId: "acc_test123",
        userId: "usr_test123",
        userName: "Test",
        name: "Old Name",
        scope: "read_write",
        keyPrefix: "abc12345",
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date("2024-01-01"),
      });
      vi.mocked(apiKeyService.updateKey).mockResolvedValue({
        id: "key_test",
        accountId: "acc_test123",
        userId: "usr_test123",
        userName: "Test",
        name: "Updated Name",
        scope: "read_write",
        keyPrefix: "abc12345",
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date("2024-01-01"),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { data: { attributes: { name: string } } };
      expect(json.data.attributes.name).toBe("Updated Name");
    });

    it("should update API key scope", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(validateBody).mockResolvedValue({
        scope: "admin",
      });
      vi.mocked(apiKeyService.getKey).mockResolvedValue({
        id: "key_test",
        accountId: "acc_test123",
        userId: "usr_test123",
        userName: "Test",
        name: "Test Key",
        scope: "read_write",
        keyPrefix: "abc12345",
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date("2024-01-01"),
      });
      vi.mocked(apiKeyService.updateKey).mockResolvedValue({
        id: "key_test",
        accountId: "acc_test123",
        userId: "usr_test123",
        userName: "Test",
        name: "Test Key",
        scope: "admin",
        keyPrefix: "abc12345",
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date("2024-01-01"),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "admin" }),
      });

      expect(res.status).toBe(200);
    });

    it("should return 422 when updating revoked key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(validateBody).mockResolvedValue({
        name: "Updated Name",
      });
      vi.mocked(apiKeyService.getKey).mockResolvedValue({
        id: "key_test",
        accountId: "acc_test123",
        userId: "usr_test123",
        userName: "Test",
        name: "Revoked Key",
        scope: "read_write",
        keyPrefix: "abc12345",
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: new Date(), // Revoked
        createdAt: new Date("2024-01-01"),
      });

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(422);
    });

    it("should return 404 for non-existent key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(validateBody).mockResolvedValue({
        name: "Updated Name",
      });
      vi.mocked(apiKeyService.getKey).mockResolvedValue(null);

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /v4/accounts/:accountId/api-keys/:keyId/revoke", () => {
    it("should revoke an API key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.revokeKey).mockResolvedValue(true);

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_test/revoke", {
        method: "POST",
      });

      expect(res.status).toBe(204);
      expect(apiKeyService.revokeKey).toHaveBeenCalledWith("key_test", "acc_test123");
    });

    it("should return 404 for non-existent key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.revokeKey).mockResolvedValue(false);

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_nonexistent/revoke", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("should return 404 when account not accessible", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(false);

      const res = await app.request("/v4/accounts/acc_other/api-keys/key_test/revoke", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /v4/accounts/:accountId/api-keys/:keyId", () => {
    it("should delete an API key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.deleteKey).mockResolvedValue(true);

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_test", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(apiKeyService.deleteKey).toHaveBeenCalledWith("key_test", "acc_test123");
    });

    it("should return 404 for non-existent key", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(true);
      vi.mocked(apiKeyService.deleteKey).mockResolvedValue(false);

      const res = await app.request("/v4/accounts/acc_test123/api-keys/key_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("should return 404 when account not accessible", async () => {
      const mockSession = createMockSession();
      vi.mocked(requireAuth).mockReturnValue(mockSession);
      vi.mocked(verifyAccountAccess).mockResolvedValue(false);

      const res = await app.request("/v4/accounts/acc_other/api-keys/key_test", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
