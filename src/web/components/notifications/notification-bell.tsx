/**
 * Bush Platform - Notification Bell Component
 *
 * Bell icon with unread badge for the header.
 * Reference: specs/00-product-reference.md Section 13
 */
"use client";

import { BellIcon } from "@/web/lib/icons";
import { Badge } from "@/web/components/ui";
import type { NotificationBellProps } from "./types";

export function NotificationBell({
  unreadCount,
  isOpen,
  onClick: _onClick,
  isLoading,
}: NotificationBellProps) {
  const showBadge = unreadCount > 0;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div
      className={`
        relative flex items-center justify-center
        w-10 h-10 p-0
        bg-transparent border-none rounded-sm
        transition-colors
        ${isOpen ? "bg-surface-3" : ""}
        ${isLoading ? "opacity-50" : ""}
      `
        .replace(/\s+/g, " ")
        .trim()}
      aria-hidden="true"
    >
      <BellIcon
        className="w-5 h-5 text-secondary transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
      {showBadge && (
        <Badge
          color="red"
          className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] text-[0.625rem] px-1"
        >
          {displayCount}
        </Badge>
      )}
    </div>
  );
}
