/**
 * Bush Platform - Notification Item Component
 *
 * Single notification item for display in dropdown or page.
 * Reference: specs/00-atomic-features.md Section 13
 */
"use client";

import { NOTIFICATION_ICONS, formatRelativeTime, type NotificationItemProps } from "./types";
import styles from "./notifications.module.css";

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
      className={`${styles.notificationItem} ${!notification.read ? styles.unread : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className={styles.notificationIcon}>{icon}</div>
      <div className={styles.notificationContent}>
        <div className={styles.notificationTitle}>{notification.title}</div>
        {notification.body && (
          <div className={styles.notificationBody}>{notification.body}</div>
        )}
        <div className={styles.notificationTime}>
          {formatRelativeTime(notification.createdAt)}
        </div>
      </div>
      <div className={styles.notificationActions}>
        {!notification.read && (
          <button
            className={styles.actionButton}
            onClick={handleMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
        <button
          className={styles.actionButton}
          onClick={handleDelete}
          title="Delete"
          aria-label="Delete notification"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
