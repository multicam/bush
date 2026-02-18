/**
 * Bush Platform - Notification Bell Component
 *
 * Bell icon with unread badge for the header.
 * Reference: specs/00-atomic-features.md Section 13
 */
"use client";

import { Badge } from "@/web/components/ui";
import type { NotificationBellProps } from "./types";
import styles from "./notifications.module.css";

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
      className={`${styles.bellButton} ${isOpen ? styles.active : ""}`}
      onClick={onClick}
      aria-label={`Notifications${showBadge ? ` (${unreadCount} unread)` : ""}`}
      disabled={isLoading}
    >
      <svg
        className={styles.bellIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {showBadge && (
        <Badge variant="error" size="sm" className={styles.badge}>
          {displayCount}
        </Badge>
      )}
    </button>
  );
}
