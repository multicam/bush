/**
 * Bush Platform - Comment Item Component
 *
 * Individual comment display with user info, actions, and timestamped/annotation support.
 * Reference: specs/04-review-and-approval.md
 */
"use client";

import { useState, useCallback, useMemo } from "react";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dropdown } from "../ui/dropdown";
import type { CommentItemProps, Comment } from "./types";
import type { CommentAnnotation } from "../../lib/api";

/** Format relative time */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;

  // For older dates, show the actual date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format timestamp to timecode */
function formatTimecode(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 24); // Assume 24fps

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

/** Get user display name */
function getUserDisplayName(user: Comment["user"]): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.email;
}

/** Get user initials for avatar */
function getUserInitials(user: Comment["user"]): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`;
  }
  return user.email.slice(0, 2).toUpperCase();
}

/** Get annotation type label */
function getAnnotationLabel(annotation: CommentAnnotation): string {
  const labels: Record<CommentAnnotation["type"], string> = {
    rectangle: "Rectangle",
    ellipse: "Circle",
    arrow: "Arrow",
    line: "Line",
    freehand: "Drawing",
    text: "Text",
  };
  return labels[annotation.type] || "Annotation";
}

/** Annotation icon */
function AnnotationIcon({ type }: { type: CommentAnnotation["type"] }) {
  switch (type) {
    case "rectangle":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
    case "ellipse":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case "arrow":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    case "line":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="19" x2="19" y2="5" />
        </svg>
      );
    case "freehand":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 17c2-2 4-6 6-6s4 4 6 4 4-4 6-4" />
        </svg>
      );
    case "text":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    default:
      return null;
  }
}

export function CommentItem({
  comment,
  isReply = false,
  isExpanded = true,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onComplete,
  onTimestampClick,
  onAnnotationClick,
  replyCount,
  onToggleReplies,
}: CommentItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const isOwner = currentUserId === comment.userId;
  const isCompleted = comment.completedAt !== null;

  const handleEdit = useCallback(() => {
    if (onEdit && editText.trim() !== comment.text) {
      onEdit({ ...comment, text: editText.trim() });
    }
    setIsEditing(false);
  }, [comment, editText, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditText(comment.text);
    setIsEditing(false);
  }, [comment.text]);

  const dropdownOptions = useMemo(() => {
    const options: Array<{ label: string; value: string; disabled?: boolean }> = [];

    if (isOwner) {
      options.push({
        label: "Edit",
        value: "edit",
      });
    }

    if (isOwner || !isReply) {
      options.push({
        label: "Delete",
        value: "delete",
      });
    }

    return options;
  }, [isOwner, isReply]);

  const handleDropdownChange = useCallback((value: string) => {
    if (value === "edit") {
      setIsEditing(true);
    } else if (value === "delete") {
      onDelete?.(comment.id);
    }
  }, [comment.id, onDelete]);

  const handleTimestampClick = useCallback(() => {
    if (comment.timestamp !== null && onTimestampClick) {
      onTimestampClick(comment.timestamp);
    }
  }, [comment.timestamp, onTimestampClick]);

  const handleAnnotationClick = useCallback(() => {
    if (comment.annotation && onAnnotationClick) {
      onAnnotationClick(comment.annotation);
    }
  }, [comment.annotation, onAnnotationClick]);

  return (
    <div
      className={`comment-item ${isReply ? "comment-item--reply" : ""} ${isCompleted ? "comment-item--completed" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Completion indicator */}
      {isCompleted && (
        <div className="comment-item__completed-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Avatar */}
      <div className="comment-item__avatar">
        <Avatar
          src={comment.user.avatarUrl}
          alt={getUserDisplayName(comment.user)}
          name={getUserInitials(comment.user)}
          size={isReply ? "sm" : "md"}
        />
      </div>

      {/* Content */}
      <div className="comment-item__content">
        {/* Header */}
        <div className="comment-item__header">
          <span className="comment-item__author">{getUserDisplayName(comment.user)}</span>
          <span className="comment-item__time">{formatRelativeTime(comment.createdAt)}</span>

          {/* Badges */}
          <div className="comment-item__badges">
            {comment.isInternal && (
              <Badge variant="warning" size="sm">Internal</Badge>
            )}
            {comment.timestamp !== null && (
              <button
                className="comment-item__timestamp"
                onClick={handleTimestampClick}
                title="Jump to this point"
              >
                {formatTimecode(comment.timestamp)}
                {comment.duration !== null && comment.duration > 0 && (
                  <span> - {formatTimecode(comment.timestamp + comment.duration)}</span>
                )}
              </button>
            )}
            {comment.page !== null && (
              <Badge variant="default" size="sm">Page {comment.page}</Badge>
            )}
            {comment.annotation && (
              <button
                className="comment-item__annotation-badge"
                onClick={handleAnnotationClick}
                title={getAnnotationLabel(comment.annotation)}
              >
                <AnnotationIcon type={comment.annotation.type} />
              </button>
            )}
          </div>
        </div>

        {/* Text */}
        {isEditing ? (
          <div className="comment-item__edit">
            <textarea
              className="comment-item__edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={3}
            />
            <div className="comment-item__edit-actions">
              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleEdit} disabled={!editText.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="comment-item__text">{comment.text}</div>
        )}

        {/* Actions */}
        {showActions && !isEditing && (
          <div className="comment-item__actions">
            {!isReply && onReply && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReply(comment.id)}
                startIcon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 17 4 12 9 7" />
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                  </svg>
                }
              >
                Reply
              </Button>
            )}
            {onComplete && !isReply && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onComplete(comment.id, !isCompleted)}
              >
                {isCompleted ? "Reopen" : "Complete"}
              </Button>
            )}
            {dropdownOptions.length > 0 && (
              <Dropdown
                trigger={
                  <Button size="sm" variant="ghost">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                  </Button>
                }
                options={dropdownOptions}
                onChange={handleDropdownChange}
              />
            )}
          </div>
        )}

        {/* Reply count / expand toggle */}
        {!isReply && replyCount !== undefined && replyCount > 0 && (
          <button
            className="comment-item__replies-toggle"
            onClick={onToggleReplies}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>
    </div>
  );
}

export default CommentItem;
