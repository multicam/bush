/**
 * Bush Platform - Comment Panel Component
 *
 * Sidebar panel for displaying and managing comments on files/assets.
 * Reference: specs/04-review-and-approval.md
 * Reference: specs/17-api-complete.md Section 6.8
 */
"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { CommentThread } from "./comment-thread";
import { CommentForm } from "./comment-form";
import { commentsApi } from "../../lib/api";
import type {
  CommentPanelProps,
  Comment,
  CommentThread as CommentThreadType,
  CommentFilters,
  CommentSortBy,
  CommentExportFormat,
} from "./types";

/** Filter icon */
function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

/** Export icon */
function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Comments icon */
function CommentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** Group comments into threads (parent + replies) */
function groupCommentsIntoThreads(comments: Comment[]): CommentThreadType[] {
  const parentComments = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);

  return parentComments.map((parent) => ({
    parent,
    replies: replies.filter((r) => r.parentId === parent.id),
    hasMoreReplies: false,
  }));
}

/** Filter comments based on filter options */
function filterComments(threads: CommentThreadType[], filters: CommentFilters): CommentThreadType[] {
  return threads
    .map((thread) => {
      // Filter parent
      let parentMatch = true;

      if (filters.status === "completed" && !thread.parent.completedAt) {
        parentMatch = false;
      }
      if (filters.status === "open" && thread.parent.completedAt) {
        parentMatch = false;
      }
      if (filters.userId && thread.parent.userId !== filters.userId) {
        parentMatch = false;
      }
      if (filters.type === "timestamped" && thread.parent.timestamp === null) {
        parentMatch = false;
      }
      if (filters.type === "annotated" && !thread.parent.annotation) {
        parentMatch = false;
      }
      if (filters.type === "internal" && !thread.parent.isInternal) {
        parentMatch = false;
      }

      // Filter replies
      const filteredReplies = thread.replies.filter((reply) => {
        if (filters.userId && reply.userId !== filters.userId) {
          return false;
        }
        return true;
      });

      if (!parentMatch) {
        return null;
      }

      return {
        ...thread,
        replies: filteredReplies,
      };
    })
    .filter((t): t is CommentThreadType => t !== null);
}

/** Sort threads based on sort option */
function sortThreads(threads: CommentThreadType[], sortBy: CommentSortBy): CommentThreadType[] {
  return [...threads].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.parent.createdAt).getTime() - new Date(a.parent.createdAt).getTime();
      case "oldest":
        return new Date(a.parent.createdAt).getTime() - new Date(b.parent.createdAt).getTime();
      case "timestamp": {
        // Sort by timestamp (nulls go last)
        const aTime = a.parent.timestamp ?? Infinity;
        const bTime = b.parent.timestamp ?? Infinity;
        return aTime - bTime;
      }
      default:
        return 0;
    }
  });
}

/** Export comments to text */
function exportComments(threads: CommentThreadType[], format: CommentExportFormat): string {
  const lines: string[] = [];

  switch (format) {
    case "csv":
      lines.push("Author,Date,Text,Timestamp,Status");
      threads.forEach((thread) => {
        const user = thread.parent.user;
        const name = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email;
        const time = thread.parent.timestamp !== null
          ? formatTimecodeForExport(thread.parent.timestamp)
          : "";
        const status = thread.parent.completedAt ? "Completed" : "Open";
        lines.push(`"${name}","${thread.parent.createdAt}","${thread.parent.text.replace(/"/g, '""')}","${time}","${status}"`);

        thread.replies.forEach((reply) => {
          const replyUser = reply.user;
          const replyName = replyUser.firstName && replyUser.lastName
            ? `${replyUser.firstName} ${replyUser.lastName}`
            : replyUser.email;
          lines.push(`"${replyName}","${reply.createdAt}","${reply.text.replace(/"/g, '""')}","",""`);
        });
      });
      break;

    case "edl":
      // EDL format for video editing
      lines.push("TITLE: Bush Comments Export");
      lines.push("");
      threads.forEach((thread, index) => {
        if (thread.parent.timestamp !== null) {
          const inTime = formatTimecodeForEDL(thread.parent.timestamp);
          const outTime = thread.parent.duration
            ? formatTimecodeForEDL(thread.parent.timestamp + thread.parent.duration)
            : inTime;
          lines.push(`${String(index + 1).padStart(3, "0")}  AX       V     C        ${inTime} ${outTime} ${inTime} ${outTime}`);
          lines.push(`* FROM: ${thread.parent.user.email}`);
          lines.push(`* COMMENT: ${thread.parent.text}`);
          lines.push("");
        }
      });
      break;

    case "text":
    default:
      threads.forEach((thread) => {
        const user = thread.parent.user;
        const name = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email;
        const time = thread.parent.timestamp !== null
          ? ` [${formatTimecodeForExport(thread.parent.timestamp)}]`
          : "";
        const status = thread.parent.completedAt ? " ✓" : "";

        lines.push(`${name}${time}${status}`);
        lines.push(thread.parent.text);
        lines.push(new Date(thread.parent.createdAt).toLocaleString());
        lines.push("");

        if (thread.replies.length > 0) {
          lines.push(`  ${thread.replies.length} ${thread.replies.length === 1 ? "reply" : "replies"}`);
          thread.replies.forEach((reply) => {
            const replyUser = reply.user;
            const replyName = replyUser.firstName && replyUser.lastName
              ? `${replyUser.firstName} ${replyUser.lastName}`
              : replyUser.email;
            lines.push(`  → ${replyName}: ${reply.text}`);
          });
          lines.push("");
        }

        lines.push("---");
        lines.push("");
      });
      break;
  }

  return lines.join("\n");
}

function formatTimecodeForExport(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimecodeForEDL(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 24); // 24fps

  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

/** Download text as file */
function downloadExport(content: string, format: CommentExportFormat, fileName: string) {
  const mimeTypes: Record<CommentExportFormat, string> = {
    csv: "text/csv",
    text: "text/plain",
    edl: "text/plain",
  };

  const extensions: Record<CommentExportFormat, string> = {
    csv: "csv",
    text: "txt",
    edl: "edl",
  };

  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-comments.${extensions[format]}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CommentPanel({
  fileId,
  versionStackId,
  currentUserId,
  initialFilters = { status: "all", type: "all" },
  initialSort = "newest",
  onCreateComment,
  onTimestampClick,
  onCommentClick: _onCommentClick,
  className = "",
}: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CommentFilters>(initialFilters);
  const [sortBy, setSortBy] = useState<CommentSortBy>(initialSort);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Track mounted state and abort controller for cleanup
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      if (!fileId && !versionStackId) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const response = fileId
          ? await commentsApi.listByFile(fileId, { include_replies: true, limit: 100 }, { signal: abortControllerRef.current.signal })
          : await commentsApi.listByVersionStack(versionStackId!, { limit: 100 }, { signal: abortControllerRef.current.signal });

        // Check if component is still mounted
        if (!isMountedRef.current) return;

        const mappedComments = response.data.map((item) => ({
          ...item.attributes,
          id: item.id,
        }));

        setComments(mappedComments);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;
        if (!isMountedRef.current) return;

        console.error("Failed to load comments:", err);
        setError("Failed to load comments");
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadComments();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [fileId, versionStackId]);

  // Group, filter, and sort comments
  const threads = useMemo(() => {
    const grouped = groupCommentsIntoThreads(comments);
    const filtered = filterComments(grouped, filters);
    const sorted = sortThreads(filtered, sortBy);
    return sorted;
  }, [comments, filters, sortBy]);

  // Get unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, { id: string; name: string }>();
    comments.forEach((comment) => {
      if (!users.has(comment.userId)) {
        const name = comment.user.firstName && comment.user.lastName
          ? `${comment.user.firstName} ${comment.user.lastName}`
          : comment.user.email;
        users.set(comment.userId, { id: comment.userId, name });
      }
    });
    return Array.from(users.values());
  }, [comments]);

  // Stats
  const stats = useMemo(() => {
    const total = comments.filter((c) => !c.parentId).length;
    const open = comments.filter((c) => !c.parentId && !c.completedAt).length;
    const completed = comments.filter((c) => !c.parentId && c.completedAt).length;
    return { total, open, completed };
  }, [comments]);

  // Handlers
  const handleCreateComment = useCallback(
    async (text: string, options?: { isInternal?: boolean }) => {
      if (!fileId && !versionStackId) return;

      setIsCreating(true);

      try {
        if (onCreateComment) {
          // Use callback if provided
          onCreateComment(text, options);
        } else {
          // Direct API call
          const response = fileId
            ? await commentsApi.createOnFile(fileId, {
                text,
                is_internal: options?.isInternal,
              })
            : await commentsApi.createOnVersionStack(versionStackId!, {
                text,
                is_internal: options?.isInternal,
              });

          const newComment: Comment = {
            ...response.data.attributes,
            id: response.data.id,
          };

          setComments((prev) => [newComment, ...prev]);
        }
      } catch (err) {
        console.error("Failed to create comment:", err);
        setError("Failed to create comment");
      } finally {
        setIsCreating(false);
      }
    },
    [fileId, versionStackId, onCreateComment]
  );

  const handleReply = useCallback(
    async (parentCommentId: string, text: string, isInternal?: boolean) => {
      try {
        const response = await commentsApi.reply(parentCommentId, {
          text,
          is_internal: isInternal,
        });

        const newReply: Comment = {
          ...response.data.attributes,
          id: response.data.id,
        };

        setComments((prev) => [...prev, newReply]);
      } catch (err) {
        console.error("Failed to reply:", err);
        setError("Failed to add reply");
      }
    },
    []
  );

  const handleEdit = useCallback(async (commentId: string, text: string) => {
    try {
      const response = await commentsApi.update(commentId, { text });

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, text: response.data.attributes.text, updatedAt: response.data.attributes.updatedAt }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to edit comment:", err);
      setError("Failed to edit comment");
    }
  }, []);

  const handleDelete = useCallback(async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
      setError("Failed to delete comment");
    }
  }, []);

  const handleComplete = useCallback(async (commentId: string, complete: boolean) => {
    try {
      const response = await commentsApi.setComplete(commentId, complete);

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, completedAt: response.data.attributes.completedAt }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to update comment status:", err);
      setError("Failed to update comment status");
    }
  }, []);

  const handleExport = useCallback(
    (format: CommentExportFormat) => {
      const content = exportComments(threads, format);
      const fileName = fileId || versionStackId || "comments";
      downloadExport(content, format, fileName);
      setShowExport(false);
    },
    [threads, fileId, versionStackId]
  );

  return (
    <div className={`comment-panel ${className}`}>
      {/* Header */}
      <div className="comment-panel__header">
        <h3 className="comment-panel__title">
          <CommentsIcon />
          Comments
          {stats.total > 0 && (
            <span className="comment-panel__count">{stats.total}</span>
          )}
        </h3>

        <div className="comment-panel__actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            title="Filter comments"
          >
            <FilterIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExport(!showExport)}
            title="Export comments"
          >
            <ExportIcon />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="comment-panel__stats">
        <span className="comment-panel__stat">
          {stats.open} open
        </span>
        <span className="comment-panel__stat">
          {stats.completed} completed
        </span>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="comment-panel__filters">
          <div className="comment-panel__filter-group">
            <label>Status</label>
            <select
              value={filters.status || "all"}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as CommentFilters["status"],
                }))
              }
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="comment-panel__filter-group">
            <label>Type</label>
            <select
              value={filters.type || "all"}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value as CommentFilters["type"],
                }))
              }
            >
              <option value="all">All</option>
              <option value="timestamped">Timestamped</option>
              <option value="annotated">Annotated</option>
              <option value="internal">Internal</option>
            </select>
          </div>

          {uniqueUsers.length > 1 && (
            <div className="comment-panel__filter-group">
              <label>Author</label>
              <select
                value={filters.userId || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    userId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">All</option>
                {uniqueUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="comment-panel__filter-group">
            <label>Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CommentSortBy)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="timestamp">By timestamp</option>
            </select>
          </div>
        </div>
      )}

      {/* Export options */}
      {showExport && (
        <div className="comment-panel__export">
          <span>Export as:</span>
          <Button variant="ghost" size="sm" onClick={() => handleExport("text")}>
            Text
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleExport("csv")}>
            CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleExport("edl")}>
            EDL
          </Button>
        </div>
      )}

      {/* Create comment form */}
      <div className="comment-panel__create">
        <CommentForm
          placeholder="Add a comment..."
          submitLabel="Comment"
          showInternalToggle
          isSubmitting={isCreating}
          onSubmit={handleCreateComment}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="comment-panel__error">
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="comment-panel__loading">
          <Spinner size="lg" />
        </div>
      )}

      {/* Comments list - only show content when not loading */}
      <div className="comment-panel__list">
        {!isLoading && threads.length === 0 ? (
          <div className="comment-panel__empty">
            <p>No comments yet</p>
            <p className="comment-panel__empty-hint">
              Be the first to add feedback
            </p>
          </div>
        ) : isLoading ? null : (
          threads.map((thread) => (
            <CommentThread
              key={thread.parent.id}
              thread={thread}
              currentUserId={currentUserId}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onComplete={handleComplete}
              onTimestampClick={onTimestampClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default CommentPanel;
