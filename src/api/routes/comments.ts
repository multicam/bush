/**
 * Bush Platform - Comments Routes
 *
 * API routes for comment management on files and version stacks.
 * Reference: specs/17-api-complete.md Section 6.8
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { comments, files, users, versionStacks } from "../../db/schema.js";
import { eq, and, desc, isNull, lt } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import {
  sendSingle,
  sendCollection,
  sendNoContent,
  RESOURCE_TYPES,
  formatDates,
  decodeCursor,
} from "../response.js";
import { generateId, parseLimit } from "../router.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { verifyProjectAccess } from "../access-control.js";
import { emitCommentEvent } from "../../realtime/index.js";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/** Maximum number of replies to include when include_replies=true */
const MAX_REPLIES_PER_COMMENT = 50;

/**
 * GET /v4/files/:fileId/comments - List comments on a file
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");
  const includeReplies = c.req.query("include_replies") !== "false";

  // Get file and verify access via project
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Verify project access
  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  // Build query for top-level comments (no parent)
  const conditions = [eq(comments.fileId, fileId)];

  if (!includeReplies) {
    conditions.push(isNull(comments.parentId));
  }

  // Apply cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(comments.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  // Get comments with user info
  // Note: When include_replies=true, replies are bounded by the limit parameter
  // Clients should paginate or fetch replies separately for large comment threads
  const results = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((r) => ({
    ...formatDates(r.comment),
    user: formatDates(r.user),
    // Indicate if more replies exist (for client to fetch if needed)
    _meta: includeReplies ? { maxRepliesPerComment: MAX_REPLIES_PER_COMMENT } : undefined,
  }));

  return sendCollection(c, items, RESOURCE_TYPES.COMMENT, {
    basePath: `/v4/files/${fileId}/comments`,
    limit,
    totalCount: results.length,
  });
});

/**
 * POST /v4/files/:fileId/comments - Create comment on file
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const body = await c.req.json();

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  // Verify project access
  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  // Validate input
  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    throw new ValidationError("Comment text is required", { pointer: "/data/attributes/text" });
  }

  if (body.text.length > 10000) {
    throw new ValidationError("Comment text must be 10000 characters or less", {
      pointer: "/data/attributes/text",
    });
  }

  // Validate timestamp for video/audio
  if (body.timestamp !== undefined) {
    if (typeof body.timestamp !== "number" || body.timestamp < 0) {
      throw new ValidationError("Timestamp must be a non-negative number", {
        pointer: "/data/attributes/timestamp",
      });
    }
  }

  // Validate duration for range annotations
  if (body.duration !== undefined) {
    if (typeof body.duration !== "number" || body.duration < 0) {
      throw new ValidationError("Duration must be a non-negative number", {
        pointer: "/data/attributes/duration",
      });
    }
  }

  // Validate page for PDFs
  if (body.page !== undefined) {
    if (typeof body.page !== "number" || body.page < 1 || !Number.isInteger(body.page)) {
      throw new ValidationError("Page must be a positive integer", {
        pointer: "/data/attributes/page",
      });
    }
  }

  // Validate parent comment if replying
  if (body.parent_id) {
    const [parentComment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, body.parent_id))
      .limit(1);

    if (!parentComment) {
      throw new NotFoundError("comment", body.parent_id);
    }

    // Parent must be on the same file
    if (parentComment.fileId !== fileId) {
      throw new ValidationError("Parent comment must be on the same file", {
        pointer: "/data/relationships/parent",
      });
    }
  }

  // Create comment
  const commentId = generateId("comment");
  const now = new Date();

  await db.insert(comments).values({
    id: commentId,
    fileId,
    versionStackId: null,
    userId: session.userId,
    parentId: body.parent_id || null,
    text: body.text.trim(),
    timestamp: body.timestamp !== undefined ? body.timestamp : null,
    duration: body.duration !== undefined ? body.duration : null,
    page: body.page !== undefined ? body.page : null,
    annotation: body.annotation || null,
    isInternal: body.is_internal === true,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch created comment with user
  const [createdComment] = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  // Emit real-time event for comment creation
  emitCommentEvent("comment.created", {
    actorId: session.userId,
    projectId: access.project.id,
    fileId,
    commentId,
    data: {
      text: createdComment.comment.text,
      parentId: createdComment.comment.parentId || undefined,
      timestamp: createdComment.comment.timestamp || undefined,
      isInternal: createdComment.comment.isInternal,
    },
  });

  return sendSingle(
    c,
    {
      ...formatDates(createdComment.comment),
      user: formatDates(createdComment.user),
    },
    RESOURCE_TYPES.COMMENT
  );
});
app.get("/:id", async (c) => {
  const session = requireAuth(c);
  const commentId = c.req.param("id");

  // Get comment with file info
  const [result] = await db
    .select({
      comment: comments,
      user: users,
      file: files,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .leftJoin(files, eq(comments.fileId, files.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!result) {
    throw new NotFoundError("comment", commentId);
  }

  // Verify access through file or version stack
  if (result.file) {
    const access = await verifyProjectAccess(result.file.projectId, session.currentAccountId);
    if (!access) {
      throw new NotFoundError("comment", commentId);
    }
  } else if (result.comment.versionStackId) {
    // Verify access through version stack
    const [stack] = await db
      .select()
      .from(versionStacks)
      .where(eq(versionStacks.id, result.comment.versionStackId))
      .limit(1);

    if (stack) {
      const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
      if (!access) {
        throw new NotFoundError("comment", commentId);
      }
    }
  }

  return sendSingle(
    c,
    {
      ...formatDates(result.comment),
      user: formatDates(result.user),
    },
    RESOURCE_TYPES.COMMENT
  );
});

/**
 * PUT /v4/comments/:id - Update comment (own only)
 */
app.put("/:id", async (c) => {
  const session = requireAuth(c);
  const commentId = c.req.param("id");
  const body = await c.req.json();

  // Get comment with file info for project ID
  const [commentResult] = await db
    .select({
      comment: comments,
      file: files,
    })
    .from(comments)
    .leftJoin(files, eq(comments.fileId, files.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!commentResult) {
    throw new NotFoundError("comment", commentId);
  }

  const comment = commentResult.comment;

  // Only comment owner can edit
  if (comment.userId !== session.userId) {
    throw new ValidationError("You can only edit your own comments", {
      pointer: "/data/relationships/user",
    });
  }

  // Validate text
  if (body.text !== undefined) {
    if (typeof body.text !== "string" || body.text.trim().length === 0) {
      throw new ValidationError("Comment text is required", { pointer: "/data/attributes/text" });
    }

    if (body.text.length > 10000) {
      throw new ValidationError("Comment text must be 10000 characters or less", {
        pointer: "/data/attributes/text",
      });
    }
  }

  // Build updates
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.text !== undefined) {
    updates.text = body.text.trim();
  }
  if (body.annotation !== undefined) {
    updates.annotation = body.annotation;
  }
  if (body.timestamp !== undefined) {
    updates.timestamp = body.timestamp;
  }
  if (body.duration !== undefined) {
    updates.duration = body.duration;
  }
  if (body.page !== undefined) {
    updates.page = body.page;
  }
  if (body.is_internal !== undefined) {
    updates.isInternal = body.is_internal;
  }

  // Update comment
  await db.update(comments).set(updates).where(eq(comments.id, commentId));

  // Fetch updated comment with user
  const [updatedComment] = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  // Emit real-time event for comment update
  if (commentResult.file) {
    emitCommentEvent("comment.updated", {
      actorId: session.userId,
      projectId: commentResult.file.projectId,
      fileId: comment.fileId!,
      commentId,
      data: {
        text: updatedComment.comment.text,
        isInternal: updatedComment.comment.isInternal,
      },
    });
  }

  return sendSingle(
    c,
    {
      ...formatDates(updatedComment.comment),
      user: formatDates(updatedComment.user),
    },
    RESOURCE_TYPES.COMMENT
  );
});

/**
 * DELETE /v4/comments/:id - Delete comment (own or admin)
 */
app.delete("/:id", async (c) => {
  const session = requireAuth(c);
  const commentId = c.req.param("id");

  // Get comment with file for access check
  const [commentResult] = await db
    .select({
      comment: comments,
      file: files,
    })
    .from(comments)
    .leftJoin(files, eq(comments.fileId, files.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!commentResult) {
    throw new NotFoundError("comment", commentId);
  }

  const comment = commentResult.comment;

  // Check if user can delete (own comment or full_access+ permission)
  const isOwner = comment.userId === session.userId;

  // For non-owners, check if they have full_access permission
  if (!isOwner) {
    // For now, only allow owner to delete
    // TODO: Check full_access+ permission when permission system is more complete
    throw new ValidationError("You can only delete your own comments", {
      pointer: "/data/relationships/user",
    });
  }

  // Store info for event emission before deletion
  const fileId = comment.fileId;
  const projectId = commentResult.file?.projectId;

  // Delete comment (cascade will handle replies if configured)
  await db.delete(comments).where(eq(comments.id, commentId));

  // Emit real-time event for comment deletion
  if (fileId && projectId) {
    emitCommentEvent("comment.deleted", {
      actorId: session.userId,
      projectId,
      fileId,
      commentId,
      data: {},
    });
  }

  return sendNoContent(c);
});

/**
 * POST /v4/comments/:id/replies - Reply to comment
 */
app.post("/:id/replies", async (c) => {
  const session = requireAuth(c);
  const parentCommentId = c.req.param("id");
  const body = await c.req.json();

  // Get parent comment
  const [parentComment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, parentCommentId))
    .limit(1);

  if (!parentComment) {
    throw new NotFoundError("comment", parentCommentId);
  }

  // Verify access through file
  if (parentComment.fileId) {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, parentComment.fileId))
      .limit(1);

    if (!file) {
      throw new NotFoundError("comment", parentCommentId);
    }

    const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
    if (!access) {
      throw new NotFoundError("comment", parentCommentId);
    }
  }

  // Validate input
  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    throw new ValidationError("Comment text is required", { pointer: "/data/attributes/text" });
  }

  if (body.text.length > 10000) {
    throw new ValidationError("Comment text must be 10000 characters or less", {
      pointer: "/data/attributes/text",
    });
  }

  // Create reply
  const commentId = generateId("comment");
  const now = new Date();

  await db.insert(comments).values({
    id: commentId,
    fileId: parentComment.fileId,
    versionStackId: parentComment.versionStackId,
    userId: session.userId,
    parentId: parentCommentId,
    text: body.text.trim(),
    timestamp: null,
    duration: null,
    page: null,
    annotation: null,
    isInternal: body.is_internal === true,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch created reply with user
  const [createdReply] = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  return sendSingle(
    c,
    {
      ...formatDates(createdReply.comment),
      user: formatDates(createdReply.user),
    },
    RESOURCE_TYPES.COMMENT
  );
});

/**
 * PUT /v4/comments/:id/complete - Mark comment as complete
 */
app.put("/:id/complete", async (c) => {
  const session = requireAuth(c);
  const commentId = c.req.param("id");
  const body = await c.req.json();

  // Get comment with file info
  const [commentResult] = await db
    .select({
      comment: comments,
      file: files,
    })
    .from(comments)
    .leftJoin(files, eq(comments.fileId, files.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!commentResult) {
    throw new NotFoundError("comment", commentId);
  }

  const comment = commentResult.comment;

  // Verify access through file
  let projectId: string | undefined;
  if (commentResult.file) {
    const access = await verifyProjectAccess(commentResult.file.projectId, session.currentAccountId);
    if (!access) {
      throw new NotFoundError("comment", commentId);
    }
    projectId = commentResult.file.projectId;
  }

  // Toggle completed status
  const isComplete = body.complete !== false;
  const completedAt = isComplete ? new Date() : null;

  await db
    .update(comments)
    .set({
      completedAt,
      updatedAt: new Date(),
    })
    .where(eq(comments.id, commentId));

  // Fetch updated comment with user
  const [updatedComment] = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  // Emit real-time event for comment completion
  if (comment.fileId && projectId) {
    emitCommentEvent("comment.completed", {
      actorId: session.userId,
      projectId,
      fileId: comment.fileId,
      commentId,
      data: {
        isComplete,
        completedAt: completedAt?.toISOString() || null,
      },
    });
  }

  return sendSingle(
    c,
    {
      ...formatDates(updatedComment.comment),
      user: formatDates(updatedComment.user),
    },
    RESOURCE_TYPES.COMMENT
  );
});

/**
 * GET /v4/comments/:id/replies - List replies to a comment
 */
app.get("/:id/replies", async (c) => {
  const session = requireAuth(c);
  const parentCommentId = c.req.param("id");
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");

  // Get parent comment
  const [parentComment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, parentCommentId))
    .limit(1);

  if (!parentComment) {
    throw new NotFoundError("comment", parentCommentId);
  }

  // Verify access through file
  if (parentComment.fileId) {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, parentComment.fileId))
      .limit(1);

    if (!file) {
      throw new NotFoundError("comment", parentCommentId);
    }

    const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
    if (!access) {
      throw new NotFoundError("comment", parentCommentId);
    }
  }

  // Build query for replies
  const conditions = [eq(comments.parentId, parentCommentId)];

  // Apply cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(comments.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  // Get replies with user info
  const results = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((r) => ({
    ...formatDates(r.comment),
    user: formatDates(r.user),
  }));

  return sendCollection(c, items, RESOURCE_TYPES.COMMENT, {
    basePath: `/v4/comments/${parentCommentId}/replies`,
    limit,
    totalCount: results.length,
  });
});

/**
 * GET /v4/version-stacks/:stackId/comments - List comments on a version stack
 */
export async function getVersionStackComments(c: any) {
  const session = requireAuth(c);
  const stackId = c.req.param("stackId")!;
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");

  // Get version stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Build query for comments on stack
  const conditions = [eq(comments.versionStackId, stackId), isNull(comments.parentId)];

  // Apply cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData?.createdAt) {
      conditions.push(lt(comments.createdAt, new Date(cursorData.createdAt as string)));
    }
  }

  // Get comments with user info
  const results = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt))
    .limit(limit + 1);

  const items = results.slice(0, limit).map((r) => ({
    ...formatDates(r.comment),
    user: formatDates(r.user),
  }));

  return sendCollection(c, items, RESOURCE_TYPES.COMMENT, {
    basePath: `/v4/version-stacks/${stackId}/comments`,
    limit,
    totalCount: results.length,
  });
}

/**
 * POST /v4/version-stacks/:stackId/comments - Create comment on version stack
 */
export async function createVersionStackComment(c: any) {
  const session = requireAuth(c);
  const stackId = c.req.param("stackId")!;
  const body = await c.req.json();

  // Get version stack
  const [stack] = await db
    .select()
    .from(versionStacks)
    .where(eq(versionStacks.id, stackId))
    .limit(1);

  if (!stack) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Verify project access
  const access = await verifyProjectAccess(stack.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("version_stack", stackId);
  }

  // Validate input
  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    throw new ValidationError("Comment text is required", { pointer: "/data/attributes/text" });
  }

  if (body.text.length > 10000) {
    throw new ValidationError("Comment text must be 10000 characters or less", {
      pointer: "/data/attributes/text",
    });
  }

  // Create comment
  const commentId = generateId("comment");
  const now = new Date();

  await db.insert(comments).values({
    id: commentId,
    fileId: null,
    versionStackId: stackId,
    userId: session.userId,
    parentId: null,
    text: body.text.trim(),
    timestamp: null,
    duration: null,
    page: null,
    annotation: body.annotation || null,
    isInternal: body.is_internal === true,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch created comment with user
  const [createdComment] = await db
    .select({
      comment: comments,
      user: users,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1);

  return sendSingle(
    c,
    {
      ...formatDates(createdComment.comment),
      user: formatDates(createdComment.user),
    },
    RESOURCE_TYPES.COMMENT
  );
}

export default app;
