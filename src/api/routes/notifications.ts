/**
 * Bush Platform - Notifications Routes
 *
 * API routes for user notifications management.
 * Reference: specs/17-api-complete.md Section 6.15
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { notifications, notificationSettings } from "../../db/schema.js";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import { RESOURCE_TYPES } from "../response.js";
import { parseLimit, generateId } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { emitNotificationEvent } from "../../realtime/index.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * GET /v4/users/me/notifications - List notifications for current user
 *
 * Returns paginated list of notifications with optional filtering.
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const limit = parseLimit(c.req.query("limit"));
  const filterRead = c.req.query("filter[read]");
  const filterType = c.req.query("filter[type]");

  // Build query conditions
  const conditions = [eq(notifications.userId, session.userId)];

  // Apply read filter
  if (filterRead === "true") {
    conditions.push(sql`${notifications.readAt} IS NOT NULL`);
  } else if (filterRead === "false") {
    conditions.push(isNull(notifications.readAt));
  }

  // Apply type filter
  if (filterType && typeof filterType === "string") {
    conditions.push(eq(notifications.type, filterType));
  }

  // Get total and unread counts in single query
  const [counts] = await db
    .select({
      count: sql<number>`count(*)`,
      unreadCount: sql<number>`sum(case when ${notifications.readAt} is null then 1 else 0 end)`,
    })
    .from(notifications)
    .where(and(...conditions));

  const count = counts?.count ?? 0;
  const unreadCount = counts?.unreadCount ?? 0;

  // Get notifications
  const items = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  const formattedItems = items.map((n) => ({
    id: n.id,
    notification_type: n.type,
    title: n.title,
    body: n.body,
    read: n.readAt !== null,
    read_at: n.readAt instanceof Date ? n.readAt.toISOString() : n.readAt ? new Date(n.readAt as number).toISOString() : null,
    created_at: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date(n.createdAt as number).toISOString(),
    data: n.data,
  }));

  return c.json({
    data: formattedItems.map((item) => ({
      id: item.id,
      type: RESOURCE_TYPES.NOTIFICATION,
      attributes: item,
    })),
    links: {
      self: "/v4/users/me/notifications",
    },
    meta: {
      total_count: count,
      unread_count: unreadCount,
      page_size: limit,
      has_more: items.length > limit,
    },
  });
});

/**
 * GET /v4/users/me/notifications/unread-count - Get unread notification count
 */
app.get("/unread-count", async (c) => {
  const session = requireAuth(c);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.userId),
        isNull(notifications.readAt)
      )
    );

  return c.json({
    data: {
      id: "unread-count",
      type: "notification-count",
      attributes: {
        unread_count: count,
      },
    },
  });
});

/**
 * PUT /v4/users/me/notifications/read-all - Mark all notifications as read
 */
app.put("/read-all", async (c) => {
  const session = requireAuth(c);

  // Get the count of unread before update
  const [{ count: unreadBefore }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.userId),
        isNull(notifications.readAt)
      )
    );

  // Mark all as read
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.userId),
        isNull(notifications.readAt)
      )
    );

  return c.json({
    data: {
      id: "read-all",
      type: "notification-bulk-update",
      attributes: {
        updated_count: unreadBefore || 0,
      },
    },
  });
});

/**
 * GET /v4/users/me/notifications/settings - Get notification preferences
 *
 * Returns the user's notification preferences for email, in-app, and digest settings.
 */
app.get("/settings", async (c) => {
  const session = requireAuth(c);

  // Try to get existing settings
  let [settings] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, session.userId))
    .limit(1);

  // Create default settings if none exist
  if (!settings) {
    const settingsId = generateId("nset");
    const now = new Date();
    await db.insert(notificationSettings).values({
      id: settingsId,
      userId: session.userId,
      // Email defaults
      emailMentions: true,
      emailCommentReplies: true,
      emailComments: true,
      emailUploads: false,
      emailStatusChanges: true,
      emailShareInvites: true,
      emailShareViews: false,
      emailShareDownloads: false,
      emailAssignments: true,
      emailFileProcessed: true,
      // In-app defaults
      inAppMentions: true,
      inAppCommentReplies: true,
      inAppComments: true,
      inAppUploads: true,
      inAppStatusChanges: true,
      inAppShareInvites: true,
      inAppShareViews: true,
      inAppShareDownloads: true,
      inAppAssignments: true,
      inAppFileProcessed: true,
      // Digest defaults
      digestEnabled: false,
      digestFrequency: "daily",
      createdAt: now,
      updatedAt: now,
    });

    [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.id, settingsId))
      .limit(1);
  }

  return c.json({
    data: {
      id: settings!.id,
      type: "notification-settings",
      attributes: {
        // Email notification preferences
        email: {
          mentions: settings!.emailMentions,
          comment_replies: settings!.emailCommentReplies,
          comments: settings!.emailComments,
          uploads: settings!.emailUploads,
          status_changes: settings!.emailStatusChanges,
          share_invites: settings!.emailShareInvites,
          share_views: settings!.emailShareViews,
          share_downloads: settings!.emailShareDownloads,
          assignments: settings!.emailAssignments,
          file_processed: settings!.emailFileProcessed,
        },
        // In-app notification preferences
        in_app: {
          mentions: settings!.inAppMentions,
          comment_replies: settings!.inAppCommentReplies,
          comments: settings!.inAppComments,
          uploads: settings!.inAppUploads,
          status_changes: settings!.inAppStatusChanges,
          share_invites: settings!.inAppShareInvites,
          share_views: settings!.inAppShareViews,
          share_downloads: settings!.inAppShareDownloads,
          assignments: settings!.inAppAssignments,
          file_processed: settings!.inAppFileProcessed,
        },
        // Digest preferences
        digest: {
          enabled: settings!.digestEnabled,
          frequency: settings!.digestFrequency,
        },
        updated_at: settings!.updatedAt instanceof Date
          ? settings!.updatedAt.toISOString()
          : new Date(settings!.updatedAt as number).toISOString(),
      },
    },
  });
});

/**
 * PUT /v4/users/me/notifications/settings - Update notification preferences
 *
 * Updates the user's notification preferences for email, in-app, and digest settings.
 */
app.put("/settings", async (c) => {
  const session = requireAuth(c);
  const body = await c.req.json();
  const data = body.data?.attributes || body;

  // Validate digest frequency if provided
  if (data.digest?.frequency && !["daily", "weekly"].includes(data.digest.frequency)) {
    throw new ValidationError("digest.frequency must be 'daily' or 'weekly'", {
      pointer: "/data/attributes/digest/frequency",
    });
  }

  // Try to get existing settings
  let [settings] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, session.userId))
    .limit(1);

  // Create default settings if none exist
  if (!settings) {
    const settingsId = generateId("nset");
    const now = new Date();
    await db.insert(notificationSettings).values({
      id: settingsId,
      userId: session.userId,
      emailMentions: true,
      emailCommentReplies: true,
      emailComments: true,
      emailUploads: false,
      emailStatusChanges: true,
      emailShareInvites: true,
      emailShareViews: false,
      emailShareDownloads: false,
      emailAssignments: true,
      emailFileProcessed: true,
      inAppMentions: true,
      inAppCommentReplies: true,
      inAppComments: true,
      inAppUploads: true,
      inAppStatusChanges: true,
      inAppShareInvites: true,
      inAppShareViews: true,
      inAppShareDownloads: true,
      inAppAssignments: true,
      inAppFileProcessed: true,
      digestEnabled: false,
      digestFrequency: "daily",
      createdAt: now,
      updatedAt: now,
    });

    [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.id, settingsId))
      .limit(1);
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  // Update email preferences if provided
  if (data.email) {
    if (typeof data.email.mentions === "boolean") updateData.emailMentions = data.email.mentions;
    if (typeof data.email.comment_replies === "boolean") updateData.emailCommentReplies = data.email.comment_replies;
    if (typeof data.email.comments === "boolean") updateData.emailComments = data.email.comments;
    if (typeof data.email.uploads === "boolean") updateData.emailUploads = data.email.uploads;
    if (typeof data.email.status_changes === "boolean") updateData.emailStatusChanges = data.email.status_changes;
    if (typeof data.email.share_invites === "boolean") updateData.emailShareInvites = data.email.share_invites;
    if (typeof data.email.share_views === "boolean") updateData.emailShareViews = data.email.share_views;
    if (typeof data.email.share_downloads === "boolean") updateData.emailShareDownloads = data.email.share_downloads;
    if (typeof data.email.assignments === "boolean") updateData.emailAssignments = data.email.assignments;
    if (typeof data.email.file_processed === "boolean") updateData.emailFileProcessed = data.email.file_processed;
  }

  // Update in-app preferences if provided
  if (data.in_app) {
    if (typeof data.in_app.mentions === "boolean") updateData.inAppMentions = data.in_app.mentions;
    if (typeof data.in_app.comment_replies === "boolean") updateData.inAppCommentReplies = data.in_app.comment_replies;
    if (typeof data.in_app.comments === "boolean") updateData.inAppComments = data.in_app.comments;
    if (typeof data.in_app.uploads === "boolean") updateData.inAppUploads = data.in_app.uploads;
    if (typeof data.in_app.status_changes === "boolean") updateData.inAppStatusChanges = data.in_app.status_changes;
    if (typeof data.in_app.share_invites === "boolean") updateData.inAppShareInvites = data.in_app.share_invites;
    if (typeof data.in_app.share_views === "boolean") updateData.inAppShareViews = data.in_app.share_views;
    if (typeof data.in_app.share_downloads === "boolean") updateData.inAppShareDownloads = data.in_app.share_downloads;
    if (typeof data.in_app.assignments === "boolean") updateData.inAppAssignments = data.in_app.assignments;
    if (typeof data.in_app.file_processed === "boolean") updateData.inAppFileProcessed = data.in_app.file_processed;
  }

  // Update digest preferences if provided
  if (data.digest) {
    if (typeof data.digest.enabled === "boolean") updateData.digestEnabled = data.digest.enabled;
    if (data.digest.frequency) updateData.digestFrequency = data.digest.frequency;
  }

  // Update the settings
  await db
    .update(notificationSettings)
    .set(updateData)
    .where(eq(notificationSettings.id, settings!.id));

  // Fetch updated settings
  const [updatedSettings] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.id, settings!.id))
    .limit(1);

  return c.json({
    data: {
      id: updatedSettings!.id,
      type: "notification-settings",
      attributes: {
        // Email notification preferences
        email: {
          mentions: updatedSettings!.emailMentions,
          comment_replies: updatedSettings!.emailCommentReplies,
          comments: updatedSettings!.emailComments,
          uploads: updatedSettings!.emailUploads,
          status_changes: updatedSettings!.emailStatusChanges,
          share_invites: updatedSettings!.emailShareInvites,
          share_views: updatedSettings!.emailShareViews,
          share_downloads: updatedSettings!.emailShareDownloads,
          assignments: updatedSettings!.emailAssignments,
          file_processed: updatedSettings!.emailFileProcessed,
        },
        // In-app notification preferences
        in_app: {
          mentions: updatedSettings!.inAppMentions,
          comment_replies: updatedSettings!.inAppCommentReplies,
          comments: updatedSettings!.inAppComments,
          uploads: updatedSettings!.inAppUploads,
          status_changes: updatedSettings!.inAppStatusChanges,
          share_invites: updatedSettings!.inAppShareInvites,
          share_views: updatedSettings!.inAppShareViews,
          share_downloads: updatedSettings!.inAppShareDownloads,
          assignments: updatedSettings!.inAppAssignments,
          file_processed: updatedSettings!.inAppFileProcessed,
        },
        // Digest preferences
        digest: {
          enabled: updatedSettings!.digestEnabled,
          frequency: updatedSettings!.digestFrequency,
        },
        updated_at: updatedSettings!.updatedAt instanceof Date
          ? updatedSettings!.updatedAt.toISOString()
          : new Date(updatedSettings!.updatedAt as number).toISOString(),
      },
    },
  });
});

/**
 * PUT /v4/notifications/:id/read - Mark a specific notification as read
 */
app.put("/:id/read", async (c) => {
  const session = requireAuth(c);
  const notificationId = c.req.param("id");

  // Get the notification
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification) {
    throw new NotFoundError("notification", notificationId);
  }

  // Verify ownership
  if (notification.userId !== session.userId) {
    throw new NotFoundError("notification", notificationId);
  }

  // Update read status
  const now = new Date();
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(eq(notifications.id, notificationId));

  // Emit real-time event
  emitNotificationEvent("notification.read", {
    actorId: session.userId,
    notificationId,
    data: {
      readAt: now.toISOString(),
    },
  });

  return c.json({
    data: {
      id: notificationId,
      type: RESOURCE_TYPES.NOTIFICATION,
      attributes: {
        read: true,
        read_at: now.toISOString(),
      },
    },
  });
});

/**
 * DELETE /v4/notifications/:id - Delete a notification
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const notificationId = c.req.param("id");

  // Get the notification
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification) {
    throw new NotFoundError("notification", notificationId);
  }

  // Verify ownership
  if (notification.userId !== session.userId) {
    throw new NotFoundError("notification", notificationId);
  }

  // Delete the notification
  await db.delete(notifications).where(eq(notifications.id, notificationId));

  return c.body(null, 204);
});

/**
 * Helper function to create a notification
 *
 * This is used by other services to create notifications.
 * Not exposed as an API endpoint.
 */
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  projectId?: string;
}): Promise<string> {
  const notificationId = generateId("ntf");
  const now = new Date();

  await db.insert(notifications).values({
    id: notificationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    data: params.data || null,
    readAt: null,
    createdAt: now,
  });

  // Emit real-time event for push notification
  emitNotificationEvent("notification.created", {
    actorId: params.userId, // For notifications, the actor is the recipient
    projectId: params.projectId,
    notificationId,
    data: {
      notificationType: params.type,
      title: params.title,
      body: params.body,
      ...params.data,
    },
  });

  return notificationId;
}

/**
 * Helper function to create multiple notifications in batch
 *
 * This is more efficient than calling createNotification multiple times
 * as it performs a single database insert.
 */
export async function createNotifications(
  items: Array<{
    userId: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    projectId?: string;
  }>
): Promise<string[]> {
  if (items.length === 0) {
    return [];
  }

  const now = new Date();
  const notificationIds = items.map(() => generateId("ntf"));

  // Batch insert all notifications
  await db.insert(notifications).values(
    items.map((params, index) => ({
      id: notificationIds[index],
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      data: params.data || null,
      readAt: null,
      createdAt: now,
    }))
  );

  // Emit real-time events for each notification
  for (let i = 0; i < items.length; i++) {
    const params = items[i];
    const notificationId = notificationIds[i];
    emitNotificationEvent("notification.created", {
      actorId: params.userId,
      projectId: params.projectId,
      notificationId,
      data: {
        notificationType: params.type,
        title: params.title,
        body: params.body,
        ...params.data,
      },
    });
  }

  return notificationIds;
}

/**
 * Notification types enum
 */
export const NOTIFICATION_TYPES = {
  MENTION: "mention",
  COMMENT_REPLY: "comment_reply",
  COMMENT_CREATED: "comment_created",
  UPLOAD: "upload",
  STATUS_CHANGE: "status_change",
  SHARE_INVITE: "share_invite",
  SHARE_VIEWED: "share_viewed",
  SHARE_DOWNLOADED: "share_downloaded",
  ASSIGNMENT: "assignment",
  FILE_PROCESSED: "file_processed",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export default app;
