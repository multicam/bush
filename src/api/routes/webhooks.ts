/**
 * Bush Platform - Webhooks Routes
 *
 * API routes for webhook management.
 * Reference: specs/04-api-reference.md Section 6.12
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { webhooks, webhookDeliveries, users } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { sendSingle, sendCollection, sendNoContent, RESOURCE_TYPES, formatDates } from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyAccountAccess } from "../access-control.js";
import crypto from "crypto";
import { validateBody, parseBody, createWebhookSchema, updateWebhookSchema, normalizeWebhookEvents } from "../validation.js";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

const app = new Hono();

/**
 * Check if a URL points to a private or internal IP address (SSRF protection)
 * Blocks requests to:
 * - Loopback addresses (127.0.0.0/8, ::1)
 * - Link-local addresses (169.254.0.0/16, fe80::/10)
 * - Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Private IPv6 ranges (fc00::/7)
 * - Localhost hostname
 * - Hostnames that resolve to private IPs
 */
async function isPrivateUrl(url: string): Promise<boolean> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return true; // Invalid URL, treat as private to be safe
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block localhost hostname
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  // Block hostnames that look like IP addresses directly
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv6Regex = /^([0-9a-fA-F:]+)$/;

  // Check if hostname is already an IP
  if (ipv4Regex.test(hostname)) {
    return isPrivateIPv4(hostname);
  }

  if (ipv6Regex.test(hostname) && hostname.includes(":")) {
    return isPrivateIPv6(hostname);
  }

  // Resolve hostname to IP and check
  try {
    const { address, family } = await dnsLookup(hostname);
    if (family === 4) {
      return isPrivateIPv4(address);
    } else {
      return isPrivateIPv6(address);
    }
  } catch {
    // DNS resolution failed - could be internal network, block it
    return true;
  }
}

/**
 * Check if an IPv4 address is private/internal
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b] = parts;

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;

  // Link-local: 169.254.0.0/16
  if (a === 169 && b === 254) return true;

  // Private: 10.0.0.0/8
  if (a === 10) return true;

  // Private: 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // Private: 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // Reserved: 0.0.0.0/8
  if (a === 0) return true;

  // Broadcast: 255.255.255.255
  if (a === 255 && b === 255 && parts[2] === 255 && parts[3] === 255) return true;

  return false;
}

/**
 * Check if an IPv6 address is private/internal
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback: ::1
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // Link-local: fe80::/10
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") ||
      normalized.startsWith("feb")) return true;

  // Unique local (private): fc00::/7
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Embedded IPv4 - extract and check
  const ipv4Match = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    return isPrivateIPv4(ipv4Match[1]);
  }

  return false;
}

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * Generate a random secret for webhook signing
 */
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("base64url")}`;
}

/**
 * GET /v4/accounts/:accountId/webhooks - List webhooks for account
 *
 * Returns all webhooks configured for an account.
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

  // Get webhooks
  const accountWebhooks = await db
    .select({
      webhook: webhooks,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(webhooks)
    .innerJoin(users, eq(webhooks.createdByUserId, users.id))
    .where(eq(webhooks.accountId, accountId))
    .orderBy(desc(webhooks.createdAt))
    .limit(limit + 1);

  const items = accountWebhooks.slice(0, limit);

  const formattedItems = items.map((item) => ({
    id: item.webhook.id,
    name: item.webhook.name,
    url: item.webhook.url,
    events: item.webhook.events,
    isActive: item.webhook.isActive,
    lastTriggeredAt: item.webhook.lastTriggeredAt,
    creator: item.creator,
    createdAt: item.webhook.createdAt,
    updatedAt: item.webhook.updatedAt,
    // Don't expose the secret in list view
  }));

  return sendCollection(c, formattedItems.map((item) => formatDates(item)), RESOURCE_TYPES.WEBHOOK, {
    basePath: `/v4/accounts/${accountId}/webhooks`,
    limit,
    totalCount: accountWebhooks.length,
  });
});

/**
 * POST /v4/accounts/:accountId/webhooks - Create webhook
 *
 * Creates a new webhook for the account.
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const accountId = c.req.param("accountId") as string;

  // Validate input with Zod
  const body = await validateBody(c, createWebhookSchema);

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Create webhook
  const webhookId = generateId("wh");
  const secret = body.secret || generateWebhookSecret();
  const now = new Date();

  // Normalize events to WebhookEvent[] format
  const normalizedEvents = normalizeWebhookEvents(body.events);

  await db.insert(webhooks).values({
    id: webhookId,
    accountId,
    createdByUserId: session.userId,
    name: body.name.trim(),
    url: body.url,
    secret,
    events: normalizedEvents,
    isActive: body.is_active ?? true,
    lastTriggeredAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch the created webhook with creator info
  const [webhook] = await db
    .select({
      webhook: webhooks,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(webhooks)
    .innerJoin(users, eq(webhooks.createdByUserId, users.id))
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  const formatted = {
    id: webhook.webhook.id,
    name: webhook.webhook.name,
    url: webhook.webhook.url,
    secret: webhook.webhook.secret, // Include secret only on creation
    events: webhook.webhook.events,
    isActive: webhook.webhook.isActive,
    lastTriggeredAt: webhook.webhook.lastTriggeredAt,
    creator: webhook.creator,
    createdAt: webhook.webhook.createdAt,
    updatedAt: webhook.webhook.updatedAt,
  };

  return sendSingle(c, formatDates(formatted), RESOURCE_TYPES.WEBHOOK);
});

/**
 * GET /v4/webhooks/:id - Get webhook details
 *
 * Returns a webhook's configuration and recent deliveries.
 */
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const webhookId = c.req.param("id");

  // Get webhook
  const [webhook] = await db
    .select({
      webhook: webhooks,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(webhooks)
    .innerJoin(users, eq(webhooks.createdByUserId, users.id))
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Verify account access
  const access = await verifyAccountAccess(webhook.webhook.accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("webhook", webhookId);
  }

  const formatted = {
    id: webhook.webhook.id,
    name: webhook.webhook.name,
    url: webhook.webhook.url,
    events: webhook.webhook.events,
    isActive: webhook.webhook.isActive,
    lastTriggeredAt: webhook.webhook.lastTriggeredAt,
    creator: webhook.creator,
    createdAt: webhook.webhook.createdAt,
    updatedAt: webhook.webhook.updatedAt,
    // Don't expose the secret
  };

  return sendSingle(c, formatDates(formatted), RESOURCE_TYPES.WEBHOOK);
});

/**
 * PUT /v4/webhooks/:id - Update webhook
 *
 * Updates a webhook's configuration.
 */
app.put("/:id", async (c) => {
  const session = requireAuth(c);
  const webhookId = c.req.param("id");

  // Validate input with Zod (allow partial body)
  const body = await parseBody(c, updateWebhookSchema);

  // Get webhook
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Verify account access
  const access = await verifyAccountAccess(webhook.accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body?.name !== undefined) {
    updates.name = body.name.trim();
  }

  if (body?.url !== undefined) {
    updates.url = body.url;
  }

  if (body?.events !== undefined) {
    updates.events = normalizeWebhookEvents(body.events);
  }

  if (body?.is_active !== undefined) {
    updates.isActive = body.is_active;
  }

  // Update webhook
  await db.update(webhooks).set(updates).where(eq(webhooks.id, webhookId));

  // Fetch and return updated webhook
  const [updatedWebhook] = await db
    .select({
      webhook: webhooks,
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(webhooks)
    .innerJoin(users, eq(webhooks.createdByUserId, users.id))
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  const formatted = {
    id: updatedWebhook.webhook.id,
    name: updatedWebhook.webhook.name,
    url: updatedWebhook.webhook.url,
    events: updatedWebhook.webhook.events,
    isActive: updatedWebhook.webhook.isActive,
    lastTriggeredAt: updatedWebhook.webhook.lastTriggeredAt,
    creator: updatedWebhook.creator,
    createdAt: updatedWebhook.webhook.createdAt,
    updatedAt: updatedWebhook.webhook.updatedAt,
  };

  return sendSingle(c, formatDates(formatted), RESOURCE_TYPES.WEBHOOK);
});

/**
 * DELETE /v4/webhooks/:id - Delete webhook
 *
 * Deletes a webhook.
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const webhookId = c.req.param("id");

  // Get webhook
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Verify account access
  const access = await verifyAccountAccess(webhook.accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Delete deliveries first
  await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, webhookId));

  // Delete webhook
  await db.delete(webhooks).where(eq(webhooks.id, webhookId));

  return sendNoContent(c);
});

/**
 * GET /v4/webhooks/:id/deliveries - List webhook deliveries
 *
 * Returns recent delivery attempts for a webhook.
 */
app.get("/:id/deliveries", async (c) => {
  const session = requireAuth(c);
  const webhookId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));

  // Get webhook to verify access
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Verify account access
  const access = await verifyAccountAccess(webhook.accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Get deliveries
  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit + 1);

  const items = deliveries.slice(0, limit);
  const formattedItems = items.map((d) => ({
    id: d.id,
    eventType: d.eventType,
    status: d.status,
    statusCode: d.statusCode,
    attemptCount: d.attemptCount,
    deliveredAt: d.deliveredAt,
    createdAt: d.createdAt,
    // Don't expose full payload/response in list view for security
  }));

  return sendCollection(c, formattedItems.map((item) => formatDates(item)), "webhook_delivery", {
    basePath: `/v4/webhooks/${webhookId}/deliveries`,
    limit,
    totalCount: deliveries.length,
  });
});

/**
 * POST /v4/webhooks/:id/test - Send test event
 *
 * Sends a test event to the webhook endpoint.
 */
app.post("/:id/test", async (c) => {
  const session = requireAuth(c);
  const webhookId = c.req.param("id");

  // Get webhook
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    throw new NotFoundError("webhook", webhookId);
  }

  // Verify account access
  const access = await verifyAccountAccess(webhook.accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("webhook", webhookId);
  }

  // SSRF protection: Block requests to private/internal IP addresses
  const isPrivate = await isPrivateUrl(webhook.url);
  if (isPrivate) {
    throw new ValidationError(
      "Webhook URL must point to a public address. Private/internal URLs are not allowed."
    );
  }

  // Create test payload
  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      id: "test_" + crypto.randomBytes(8).toString("hex"),
      type: "test",
      attributes: {
        message: "This is a test webhook event from Bush",
        triggered_by: session.userId,
      },
    },
    account_id: webhook.accountId,
    webhook_id: webhookId,
  };

  // Create delivery record
  const deliveryId = generateId("whdel");
  await db.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookId,
    eventType: "test",
    payload: testPayload,
    status: "pending",
    attemptCount: 0,
    createdAt: new Date(),
  });

  // Generate HMAC signature
  const signature = crypto
    .createHmac("sha256", webhook.secret)
    .update(JSON.stringify(testPayload))
    .digest("hex");

  // Attempt to send the webhook (async - don't wait)
  let statusCode: number | null = null;
  let responseText: string | null = null;
  let deliveryStatus: "success" | "failed" = "failed";

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bush-signature": `sha256=${signature}`,
        "x-bush-event": "test",
        "x-bush-delivery": deliveryId,
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    statusCode = response.status;
    responseText = await response.text().then(t => t.substring(0, 1000)); // Limit response size
    deliveryStatus = response.status >= 200 && response.status < 300 ? "success" : "failed";
  } catch (err) {
    responseText = err instanceof Error ? err.message : "Unknown error";
  }

  // Update delivery record
  await db
    .update(webhookDeliveries)
    .set({
      status: deliveryStatus,
      statusCode,
      response: responseText,
      attemptCount: 1,
      deliveredAt: new Date(),
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  // Update webhook's last triggered time if successful
  if (deliveryStatus === "success") {
    await db
      .update(webhooks)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhooks.id, webhookId));
  }

  return c.json({
    data: {
      success: deliveryStatus === "success",
      status_code: statusCode,
      response: responseText,
      delivery_id: deliveryId,
    },
  });
});

/**
 * Helper function to emit a webhook event (used by other services)
 */
export async function emitWebhookEvent(
  accountId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  // Get all active webhooks for this account that subscribe to this event
  const accountWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.accountId, accountId),
        eq(webhooks.isActive, true)
      )
    );

  // Filter webhooks that subscribe to this event type
  const matchingWebhooks = accountWebhooks.filter((wh) => {
    const events = wh.events as Array<string | { type: string }>;
    return events.some((e) => {
      const eventTypeStr = typeof e === "string" ? e : e.type;
      return eventTypeStr === eventType;
    });
  });

  if (matchingWebhooks.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();

  // Queue webhook deliveries
  for (const webhook of matchingWebhooks) {
    const payload = {
      event: eventType,
      timestamp,
      data,
      account_id: accountId,
      webhook_id: webhook.id,
    };

    // Signature will be computed when delivery is attempted
    const deliveryId = generateId("whdel");

    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: webhook.id,
      eventType,
      payload,
      status: "pending",
      attemptCount: 0,
      createdAt: new Date(),
    });

    // In production, this would be queued to BullMQ for delivery
    // For now, we just create the pending delivery record
  }
}

export default app;
