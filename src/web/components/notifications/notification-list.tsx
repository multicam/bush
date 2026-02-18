/**
 * Bush Platform - Notification List Component
 *
 * Scrollable list of notifications with loading state.
 * Reference: specs/00-atomic-features.md Section 13
 */
"use client";

import { Spinner } from "@/web/components/ui";
import { NotificationItem } from "./notification-item";
import type { NotificationListProps } from "./types";
import styles from "./notifications.module.css";

export function NotificationList({
  notifications,
  isLoading,
  onNotificationClick,
  onMarkRead,
  onDelete,
}: NotificationListProps) {
  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="md" />
        <span>Loading notifications...</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🔔</div>
        <div className={styles.emptyText}>No notifications</div>
        <div className={styles.emptySubtext}>
          You&apos;re all caught up!
        </div>
      </div>
    );
  }

  return (
    <div className={styles.notificationList}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClick={onNotificationClick}
          onMarkRead={onMarkRead}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
