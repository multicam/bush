/**
 * Bush Platform - Webhooks Routes
 *
 * API routes for webhook management.
 * Reference: specs/17-api-complete.md Section 6.12
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

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * Generate a random secret for webhook signing
 */
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("base64url")}`;
}

/**
 * Validate webhook URL
 */
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS in production, allow HTTP for localhost testing
    if (process.env.NODE_ENV === "production") {
      return parsed.protocol === "https:";
    }
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validate event types
 */
const VALID_EVENT_TYPES = new Set([
  "file.created",
  "file.updated",
  "file.deleted",
  "file.status_changed",
  "file.downloaded",
  "version.created",
  "comment.created",
  "comment.updated",
  "comment.deleted",
  "comment.completed",
  "share.created",
  "share.viewed",
  "project.created",
  "project.updated",
  "project.deleted",
  "member.added",
  "member.removed",
  "transcription.completed",
]);

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
  const body = await c.req.json();

  // Verify account access (owner or content_admin only)
  const access = await verifyAccountAccess(accountId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("account", accountId);
  }

  // Validate input
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    throw new ValidationError("name is required", { pointer: "/data/attributes/name" });
  }

  if (!body.url || typeof body.url !== "string") {
    throw new ValidationError("url is required", { pointer: "/data/attributes/url" });
  }

  if (!isValidWebhookUrl(body.url)) {
    throw new ValidationError("url must be a valid HTTP/HTTPS URL", { pointer: "/data/attributes/url" });
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    throw new ValidationError("events must be a non-empty array", { pointer: "/data/attributes/events" });
  }

  // Validate event types
  for (const event of body.events) {
    if (typeof event === "string") {
      if (!VALID_EVENT_TYPES.has(event)) {
        throw new ValidationError(`Invalid event type: ${event}`, { pointer: "/data/attributes/events" });
      }
    } else if (typeof event === "object" && event.type) {
      if (!VALID_EVENT_TYPES.has(event.type)) {
        throw new ValidationError(`Invalid event type: ${event.type}`, { pointer: "/data/attributes/events" });
      }
    } else {
      throw new ValidationError("Each event must be a string or object with type", { pointer: "/data/attributes/events" });
    }
  }

  // Create webhook
  const webhookId = generateId("wh");
  const secret = body.secret || generateWebhookSecret();
  const now = new Date();

  await db.insert(webhooks).values({
    id: webhookId,
    accountId,
    createdByUserId: session.userId,
    name: body.name.trim(),
    url: body.url,
    secret,
    events: body.events,
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
  const body = await c.req.json();

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

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw new ValidationError("name must be a non-empty string", { pointer: "/data/attributes/name" });
    }
    updates.name = body.name.trim();
  }

  if (body.url !== undefined) {
    if (!isValidWebhookUrl(body.url)) {
      throw new ValidationError("url must be a valid HTTP/HTTPS URL", { pointer: "/data/attributes/url" });
    }
    updates.url = body.url;
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      throw new ValidationError("events must be a non-empty array", { pointer: "/data/attributes/events" });
    }
    for (const event of body.events) {
      if (typeof event === "string") {
        if (!VALID_EVENT_TYPES.has(event)) {
          throw new ValidationError(`Invalid event type: ${event}`, { pointer: "/data/attributes/events" });
        }
      } else if (typeof event === "object" && event.type) {
        if (!VALID_EVENT_TYPES.has(event.type)) {
          throw new ValidationError(`Invalid event type: ${event.type}`, { pointer: "/data/attributes/events" });
        }
      }
    }
    updates.events = body.events;
  }

  if (body.is_active !== undefined) {
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
