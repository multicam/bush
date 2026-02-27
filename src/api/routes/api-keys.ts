/**
 * Bush Platform - API Keys Routes
 *
 * API routes for API key management (service-to-service authentication).
 * Reference: specs/04-api-reference.md Section 2.1 (API Keys)
 */
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyAccountAccess } from "../access-control.js";
import {
  apiKeyService,
  type ApiKeyScope,
  type ApiKeyData,
  type ApiKeyWithSecret,
} from "../api-key-service.js";
import { validateBody } from "../validation.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * Zod schema for creating an API key
 */
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100, "Name must be at most 100 characters"),
  scope: z.enum(["read_only", "read_write", "admin"]).default("read_only"),
  expires_at: z.string().datetime({ message: "expires_at must be an ISO 8601 datetime" }).optional().nullable(),
});

/**
 * Zod schema for updating an API key
 */
const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100, "Name must be at most 100 characters").optional(),
  scope: z.enum(["read_only", "read_write", "admin"]).optional(),
});

/**
 * Format an API key for JSON:API response (without secret)
 */
function formatApiKey(key: ApiKeyData): Record<string, unknown> {
  return {
    id: key.id,
    name: key.name,
    scope: key.scope,
    key_prefix: key.keyPrefix,
    user_id: key.userId,
    user_name: key.userName,
    last_used_at: key.lastUsedAt,
    expires_at: key.expiresAt,
    revoked_at: key.revokedAt,
    created_at: key.createdAt,
  };
}

/**
 * Format an API key with secret for creation response
 */
function formatApiKeyWithSecret(key: ApiKeyWithSecret): Record<string, unknown> {
  return {
    id: key.id,
    name: key.name,
    scope: key.scope,
    key: key.key, // Only shown once on creation
    key_prefix: key.keyPrefix,
    expires_at: key.expiresAt,
    created_at: key.createdAt,
  };
}

/**
 * GET /v4/accounts/:accountId/api-keys - List API keys for account
 *
 * Returns all API keys configured for an account.
 * Requires owner or content_admin role.
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;
  const limit = parseLimit(c.req.query("limit"));

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Get API keys
  const keys = await apiKeyService.listKeys(accountId);

  const formattedItems = keys.map((key) => formatApiKey(formatDates(key)));

  return sendCollection(c, formattedItems, RESOURCE_TYPES.API_KEY, {
    basePath: `/v4/accounts/${accountId}/api-keys`,
    limit,
    totalCount: keys.length,
  });
});

/**
 * POST /v4/accounts/:accountId/api-keys - Create API key
 *
 * Creates a new API key for the account.
 * The key is returned once - it cannot be retrieved again.
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;

  // Validate input
  const body = await validateBody(c, createApiKeySchema);

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Parse expiration date if provided
  let expiresAt: Date | null = null;
  if (body.expires_at) {
    expiresAt = new Date(body.expires_at);
    if (expiresAt <= new Date()) {
      throw new ValidationError("expires_at must be in the future");
    }
  }

  // Create the API key
  const key = await apiKeyService.createKey({
    accountId,
    userId: session.userId,
    name: body.name.trim(),
    scope: body.scope as ApiKeyScope,
    expiresAt,
  });

  return sendSingle(c, formatApiKeyWithSecret(formatDates(key)), RESOURCE_TYPES.API_KEY, 201);
});

/**
 * GET /v4/accounts/:accountId/api-keys/:keyId - Get single API key
 *
 * Returns details for a specific API key (without the secret).
 */
app.get("/:keyId", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;
  const keyId = c.req.param("keyId") as string;

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Get the key
  const key = await apiKeyService.getKey(keyId, accountId);
  if (!key) {
    throw new NotFoundError("api_key", keyId);
  }

  return sendSingle(c, formatApiKey(formatDates(key)), RESOURCE_TYPES.API_KEY);
});

/**
 * PATCH /v4/accounts/:accountId/api-keys/:keyId - Update API key
 *
 * Updates an API key's name or scope.
 */
app.patch("/:keyId", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;
  const keyId = c.req.param("keyId") as string;

  // Validate input
  const body = await validateBody(c, updateApiKeySchema);

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Check key exists
  const existingKey = await apiKeyService.getKey(keyId, accountId);
  if (!existingKey) {
    throw new NotFoundError("api_key", keyId);
  }

  // Check if revoked
  if (existingKey.revokedAt) {
    throw new ValidationError("Cannot update a revoked API key");
  }

  // Update the key
  const updatedKey = await apiKeyService.updateKey(keyId, accountId, {
    name: body.name?.trim(),
    scope: body.scope as ApiKeyScope | undefined,
  });

  if (!updatedKey) {
    throw new NotFoundError("api_key", keyId);
  }

  return sendSingle(c, formatApiKey(formatDates(updatedKey)), RESOURCE_TYPES.API_KEY);
});

/**
 * POST /v4/accounts/:accountId/api-keys/:keyId/revoke - Revoke API key
 *
 * Revokes an API key (soft delete). The key will no longer work for authentication.
 */
app.post("/:keyId/revoke", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;
  const keyId = c.req.param("keyId") as string;

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Revoke the key
  const success = await apiKeyService.revokeKey(keyId, accountId);
  if (!success) {
    throw new NotFoundError("api_key", keyId);
  }

  return sendNoContent(c);
});

/**
 * DELETE /v4/accounts/:accountId/api-keys/:keyId - Delete API key
 *
 * Permanently deletes an API key.
 */
app.delete("/:keyId", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;
  const keyId = c.req.param("keyId") as string;

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Delete the key
  const success = await apiKeyService.deleteKey(keyId, accountId);
  if (!success) {
    throw new NotFoundError("api_key", keyId);
  }

  return sendNoContent(c);
});

export { app as apiKeysRoutes };
