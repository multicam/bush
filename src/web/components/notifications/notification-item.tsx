/**
 * Bush Platform - Notification Item Component
 *
 * Single notification item for display in dropdown or page.
 * Reference: specs/00-product-reference.md Section 13
 */
"use client";

import { Check, X } from "lucide-react";
import { NOTIFICATION_ICONS, formatRelativeTime, type NotificationItemProps } from "./types";

export function NotificationItem({
  notification,
  onClick,
  onMarkRead,
  onDelete,
}: NotificationItemProps) {
  const icon = NOTIFICATION_ICONS[notification.type] || "🔔";

  const handleClick = () => {
    onClick(notification);
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead(notification);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification);
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border-default last:border-b-0
        hover:bg-surface-2
        ${!notification.read ? "bg-[rgba(0,102,255,0.05)] hover:bg-[rgba(0,102,255,0.1)]" : ""}
      `.replace(/\s+/g, " ").trim()}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="shrink-0 w-9 h-9 flex items-center justify-center bg-surface-2 rounded-full text-base">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary leading-snug truncate">
          {notification.title}
        </div>
        {notification.body && (
          <div className="text-[0.8125rem] text-secondary leading-snug mt-0.5 overflow-hidden text-ellipsis line-clamp-2">
            {notification.body}
          </div>
        )}
        <div className="text-xs text-muted mt-1">
          {formatRelativeTime(notification.createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <button
            className="flex items-center justify-center w-7 h-7 p-0 bg-transparent border-none rounded-sm cursor-pointer text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
            onClick={handleMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          className="flex items-center justify-center w-7 h-7 p-0 bg-transparent border-none rounded-sm cursor-pointer text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
          onClick={handleDelete}
          title="Delete"
          aria-label="Delete notification"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
