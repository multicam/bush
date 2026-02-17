/**
 * Bush Platform - Comment Types
 *
 * Type definitions for comment components.
 * Reference: specs/04-review-and-approval.md
 */

import type { CommentAttributes, CommentUserAttributes, CommentAnnotation } from "../../lib/api";

/**
 * Comment with embedded user info
 */
export interface Comment extends Omit<CommentAttributes, "user"> {
  id: string;
  user: CommentUserAttributes;
}

/**
 * Comment thread with replies
 */
export interface CommentThread {
  parent: Comment;
  replies: Comment[];
  hasMoreReplies: boolean;
}

/**
 * Filter options for comments
 */
export interface CommentFilters {
  /** Filter by status */
  status?: "all" | "open" | "completed";
  /** Filter by user ID */
  userId?: string;
  /** Filter by comment type */
  type?: "all" | "timestamped" | "annotated" | "internal";
}

/**
 * Sort options for comments
 */
export type CommentSortBy = "newest" | "oldest" | "timestamp";

/**
 * Export options for comments
 */
export type CommentExportFormat = "csv" | "text" | "edl";

/**
 * Props for comment item component
 */
export interface CommentItemProps {
  /** Comment data */
  comment: Comment;
  /** Whether this is a reply */
  isReply?: boolean;
  /** Whether the thread is expanded */
  isExpanded?: boolean;
  /** Current user ID for ownership checks */
  currentUserId?: string;
  /** Callback when reply button is clicked */
  onReply?: (commentId: string) => void;
  /** Callback when edit button is clicked */
  onEdit?: (comment: Comment) => void;
  /** Callback when delete button is clicked */
  onDelete?: (commentId: string) => void;
  /** Callback when complete toggle is clicked */
  onComplete?: (commentId: string, complete: boolean) => void;
  /** Callback when timestamp is clicked (video/audio) */
  onTimestampClick?: (timestamp: number) => void;
  /** Callback when annotation is clicked */
  onAnnotationClick?: (annotation: CommentAnnotation) => void;
  /** Show reply count for parent comments */
  replyCount?: number;
  /** Callback to expand/collapse replies */
  onToggleReplies?: () => void;
}

/**
 * Props for comment form component
 */
export interface CommentFormProps {
  /** Initial text for editing */
  initialText?: string;
  /** Initial is_internal value */
  initialInternal?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Submit button text */
  submitLabel?: string;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Whether this is an internal comment form */
  showInternalToggle?: boolean;
  /** Timestamp for video/audio comments */
  timestamp?: number;
  /** Page number for PDF comments */
  page?: number;
  /** Callback when form is submitted */
  onSubmit: (text: string, options?: { isInternal?: boolean }) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** autofocus on mount */
  autoFocus?: boolean;
}

/**
 * Props for comment thread component
 */
export interface CommentThreadProps {
  /** Comment thread data */
  thread: CommentThread;
  /** Current user ID for ownership checks */
  currentUserId?: string;
  /** Whether replies are loading */
  isLoadingReplies?: boolean;
  /** Callback to load more replies */
  onLoadMoreReplies?: (commentId: string) => void;
  /** Callback when reply is submitted */
  onReply?: (parentCommentId: string, text: string, isInternal?: boolean) => void;
  /** Callback when edit is submitted */
  onEdit?: (commentId: string, text: string) => void;
  /** Callback when delete is confirmed */
  onDelete?: (commentId: string) => void;
  /** Callback when complete toggle is clicked */
  onComplete?: (commentId: string, complete: boolean) => void;
  /** Callback when timestamp is clicked */
  onTimestampClick?: (timestamp: number) => void;
}

/**
 * Props for comment panel component
 */
export interface CommentPanelProps {
  /** File ID to load comments for */
  fileId?: string;
  /** Version stack ID to load comments for */
  versionStackId?: string;
  /** Current user ID */
  currentUserId?: string;
  /** Initial filters */
  initialFilters?: CommentFilters;
  /** Initial sort order */
  initialSort?: CommentSortBy;
  /** Callback when comment is created */
  onCreateComment?: (text: string, options?: { timestamp?: number; page?: number; isInternal?: boolean }) => void;
  /** Callback when timestamp is clicked */
  onTimestampClick?: (timestamp: number) => void;
  /** Callback when comment is clicked */
  onCommentClick?: (comment: Comment) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Timecode marker for comments on timelines
 */
export interface CommentTimeMarker {
  id: string;
  timestamp: number;
  duration?: number;
  color: string;
  text: string;
}
