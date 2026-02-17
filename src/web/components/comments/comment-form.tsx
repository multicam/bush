/**
 * Bush Platform - Comment Form Component
 *
 * Form for creating and editing comments with internal toggle.
 * Reference: specs/04-review-and-approval.md
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import type { CommentFormProps } from "./types";

/** Format timestamp to timecode */
function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CommentForm({
  initialText = "",
  initialInternal = false,
  placeholder = "Add a comment...",
  submitLabel = "Comment",
  isSubmitting = false,
  showInternalToggle = true,
  timestamp,
  page,
  onSubmit,
  onCancel,
  autoFocus = false,
}: CommentFormProps) {
  const [text, setText] = useState(initialText);
  const [isInternal, setIsInternal] = useState(initialInternal);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (text.trim() && !isSubmitting) {
        onSubmit(text.trim(), { isInternal });
        setText("");
        setIsInternal(false);
      }
    },
    [text, isInternal, isSubmitting, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e);
      }
      // Cancel on Escape
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  const isDisabled = !text.trim() || isSubmitting;

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      {/* Context indicators */}
      {(timestamp !== undefined || page !== undefined) && (
        <div className="comment-form__context">
          {timestamp !== undefined && (
            <span className="comment-form__timestamp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatTimecode(timestamp)}
            </span>
          )}
          {page !== undefined && (
            <span className="comment-form__page">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Page {page}
            </span>
          )}
        </div>
      )}

      {/* Textarea */}
      <div className="comment-form__input-wrapper">
        <textarea
          ref={textareaRef}
          className="comment-form__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isSubmitting}
        />
      </div>

      {/* Actions */}
      <div className="comment-form__actions">
        {/* Internal toggle */}
        {showInternalToggle && (
          <label className="comment-form__internal-toggle">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              disabled={isSubmitting}
            />
            <span className="comment-form__internal-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Internal
            </span>
          </label>
        )}

        {/* Buttons */}
        <div className="comment-form__buttons">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isDisabled}
            loading={isSubmitting}
          >
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="comment-form__hint">
        <span>⌘ + Enter to submit</span>
      </div>
    </form>
  );
}

export default CommentForm;
