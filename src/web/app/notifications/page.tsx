/**
 * Bush Platform - Notifications Page
 *
 * Full page for viewing and managing all notifications.
 * Reference: specs/00-atomic-features.md Section 13
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { notificationsApi, type NotificationType } from "@/web/lib/api";
import { useUserEvents } from "@/web/hooks/use-realtime";
import { useAuth } from "@/web/context";
import { Spinner, Badge } from "@/web/components/ui";
import {
  NOTIFICATION_ICONS,
  formatRelativeTime,
  toNotification,
  type Notification,
} from "@/web/components/notifications";
import styles from "@/web/components/notifications/notifications.module.css";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "mention", label: "Mentions" },
  { value: "comment_reply", label: "Replies" },
  { value: "upload", label: "Uploads" },
  { value: "share_invite", label: "Shares" },
  { value: "assignment", label: "Assignments" },
];

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all");

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filterRead = filter === "unread" ? false : undefined;
      const filterType = FILTER_OPTIONS.find((o) => o.value === filter)?.value as
        | NotificationType
        | undefined;

      const response = await notificationsApi.list({
        limit: 100,
        filter_read: filterRead,
        filter_type: filterType && filterType !== "all" ? filterType : undefined,
      });

      const items = response.data.map((item) =>
        toNotification(item.id, item.attributes)
      );
      setNotifications(items);
      setUnreadCount(response.meta.unread_count);
    } catch (err) {
      setError("Failed to load notifications");
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to real-time notification events
  useUserEvents(user?.id, {
    eventFilter: "notification.created",
    onEvent: () => {
      // Refresh notifications when new one arrives
      fetchNotifications();
    },
  });

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      await handleMarkRead(notification);
    }

    // Navigate to relevant context
    if (notification.data.file_id) {
      window.location.href = `/files/${notification.data.file_id}`;
    } else if (notification.data.project_id) {
      window.location.href = `/projects/${notification.data.project_id}`;
    } else if (notification.data.share_id) {
      window.location.href = `/shares/${notification.data.share_id}`;
    }
  };

  const handleMarkRead = async (notification: Notification) => {
    try {
      await notificationsApi.markRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: true, readAt: new Date() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleDelete = async (notification: Notification) => {
    try {
      await notificationsApi.delete(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      if (!notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <div className={styles.notificationsPage}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          Notifications
          {unreadCount > 0 && (
            <Badge variant="primary" size="sm" style={{ marginLeft: "0.5rem" }}>
              {unreadCount} unread
            </Badge>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            className={styles.markAllButton}
            onClick={handleMarkAllRead}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
            }}
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="filter">
            Show:
          </label>
          <select
            id="filter"
            className={styles.filterSelect}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "rgba(220, 38, 38, 0.1)",
            borderRadius: "var(--border-radius)",
            marginBottom: "1rem",
            color: "var(--color-error)",
          }}
        >
          {error}
          <button
            onClick={fetchNotifications}
            style={{
              marginLeft: "1rem",
              padding: "0.25rem 0.75rem",
              fontSize: "0.75rem",
              background: "transparent",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
              color: "var(--color-error)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem",
            gap: "1rem",
          }}
        >
          <Spinner size="lg" />
          <span style={{ color: "var(--text-secondary)" }}>
            Loading notifications...
          </span>
        </div>
      ) : notifications.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem",
            gap: "1rem",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius-lg)",
          }}
        >
          <div style={{ fontSize: "3rem" }}>🔔</div>
          <div
            style={{
              fontSize: "1.125rem",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            No notifications
          </div>
          <div style={{ color: "var(--text-tertiary)" }}>
            {filter === "unread"
              ? "You've read all your notifications!"
              : "You're all caught up!"}
          </div>
        </div>
      ) : (
        <div className={styles.pageList}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${styles.pageNotificationItem} ${
                !notification.read ? styles.unread : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && handleNotificationClick(notification)
              }
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "var(--border-radius-full)",
                  fontSize: "1.125rem",
                }}
              >
                {NOTIFICATION_ICONS[notification.type] || "🔔"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {notification.title}
                </div>
                {notification.body && (
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      marginTop: "0.25rem",
                    }}
                  >
                    {notification.body}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-tertiary)",
                    marginTop: "0.375rem",
                  }}
                >
                  {formatRelativeTime(notification.createdAt)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(notification);
                    }}
                    title="Mark as read"
                    aria-label="Mark as read"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      padding: 0,
                      background: "transparent",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--border-radius)",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ width: "16px", height: "16px" }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(notification);
                  }}
                  title="Delete"
                  aria-label="Delete notification"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    padding: 0,
                    background: "transparent",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--border-radius)",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ width: "16px", height: "16px" }}
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
