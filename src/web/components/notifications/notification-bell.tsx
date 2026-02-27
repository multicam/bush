/**
 * Bush Platform - Notification Bell Component
 *
 * Bell icon with unread badge for the header.
 * Reference: specs/00-product-reference.md Section 13
 */
"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/web/components/ui";
import type { NotificationBellProps } from "./types";

export function NotificationBell({
  unreadCount,
  isOpen,
  onClick,
  isLoading,
}: NotificationBellProps) {
  const showBadge = unreadCount > 0;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      className={`
        relative flex items-center justify-center
        w-10 h-10 p-0
        bg-transparent border-none rounded-sm
        cursor-pointer transition-colors
        hover:bg-surface-2
        ${isOpen ? "bg-surface-3" : ""}
        disabled:opacity-50 disabled:cursor-not-allowed
      `.replace(/\s+/g, " ").trim()}
      onClick={onClick}
      aria-label={`Notifications${showBadge ? ` (${unreadCount} unread)` : ""}`}
      disabled={isLoading}
    >
      <Bell
        className="w-5 h-5 text-secondary transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
      {showBadge && (
        <Badge
          variant="error"
          size="sm"
          className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] text-[0.625rem] px-1"
        >
          {displayCount}
        </Badge>
      )}
    </button>
  );
}
