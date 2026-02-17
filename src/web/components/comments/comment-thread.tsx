/**
 * Bush Platform - Comment Thread Component
 *
 * Thread view with parent comment and expandable replies.
 * Reference: specs/04-review-and-approval.md
 */
"use client";

import { useState, useCallback } from "react";
import { CommentItem } from "./comment-item";
import { CommentForm } from "./comment-form";
import { Button } from "../ui/button";
import type { CommentThreadProps, Comment } from "./types";

export function CommentThread({
  thread,
  currentUserId,
  isLoadingReplies = false,
  onLoadMoreReplies,
  onReply,
  onEdit,
  onDelete,
  onComplete,
  onTimestampClick,
}: CommentThreadProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleReplyClick = useCallback((commentId: string) => {
    setReplyingToId(commentId);
    setIsReplying(true);
  }, []);

  const handleReplySubmit = useCallback(
    (text: string, options?: { isInternal?: boolean }) => {
      if (replyingToId && onReply) {
        onReply(replyingToId, text, options?.isInternal);
        setIsReplying(false);
        setReplyingToId(null);
      }
    },
    [replyingToId, onReply]
  );

  const handleReplyCancel = useCallback(() => {
    setIsReplying(false);
    setReplyingToId(null);
  }, []);

  const handleEdit = useCallback(
    (comment: Comment) => {
      if (onEdit) {
        onEdit(comment.id, comment.text);
      }
    },
    [onEdit]
  );

  const handleLoadMoreReplies = useCallback(() => {
    if (onLoadMoreReplies) {
      onLoadMoreReplies(thread.parent.id);
    }
  }, [thread.parent.id, onLoadMoreReplies]);

  const replyCount = thread.replies.length + (thread.hasMoreReplies ? 1 : 0);

  return (
    <div className="comment-thread">
      {/* Parent comment */}
      <CommentItem
        comment={thread.parent}
        currentUserId={currentUserId}
        isExpanded={isExpanded}
        replyCount={replyCount}
        onToggleReplies={toggleExpanded}
        onReply={handleReplyClick}
        onEdit={handleEdit}
        onDelete={onDelete}
        onComplete={onComplete}
        onTimestampClick={onTimestampClick}
      />

      {/* Replies */}
      {isExpanded && (
        <div className="comment-thread__replies">
          {thread.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              currentUserId={currentUserId}
              onReply={handleReplyClick}
              onEdit={handleEdit}
              onDelete={onDelete}
              onTimestampClick={onTimestampClick}
            />
          ))}

          {/* Load more replies */}
          {thread.hasMoreReplies && (
            <div className="comment-thread__load-more">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMoreReplies}
                loading={isLoadingReplies}
              >
                Load more replies
              </Button>
            </div>
          )}

          {/* Reply form */}
          {isReplying && replyingToId === thread.parent.id && (
            <div className="comment-thread__reply-form">
              <CommentForm
                placeholder="Write a reply..."
                submitLabel="Reply"
                showInternalToggle
                onSubmit={handleReplySubmit}
                onCancel={handleReplyCancel}
                autoFocus
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CommentThread;
