/**
 * Bush Platform - Notifications Page
 *
 * Full page for viewing and managing all notifications.
 * Reference: specs/00-product-reference.md Section 13
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { notificationsApi, type NotificationType } from "@/web/lib/api";
import { useUserEvents } from "@/web/hooks/use-realtime";
import { useAuth } from "@/web/context";
import { AppLayout } from "@/web/components/layout";
import { Spinner, Badge } from "@/web/components/ui";
import {
  NOTIFICATION_ICONS,
  formatRelativeTime,
  toNotification,
  type Notification,
} from "@/web/components/notifications";

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
      // Check if filter is a valid notification type (not "all" or "unread")
      const isValidNotificationType = (val: string): val is NotificationType => {
        return ["mention", "comment_reply", "upload", "share_invite", "assignment"].includes(val);
      };
      const filterType = isValidNotificationType(filter) ? filter : undefined;

      const response = await notificationsApi.list({
        limit: 100,
        filter_read: filterRead,
        filter_type: filterType,
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
    <AppLayout>
      <div className="p-8 max-w-[800px] mx-auto max-[480px]:p-4">
      <div className="flex items-center justify-between mb-6 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-4">
        <h1 className="text-2xl font-semibold text-text-primary">
          Notifications
          {unreadCount > 0 && (
            <Badge variant="primary" size="sm" className="ml-2">
              {unreadCount} unread
            </Badge>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            className="text-xs text-accent bg-transparent border-none cursor-pointer px-2 py-1 rounded-sm transition-colors hover:bg-surface-2"
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4 px-4 py-3 bg-surface-2 rounded-md">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary" htmlFor="filter">
            Show:
          </label>
          <select
            id="filter"
            className="px-3 py-1.5 text-sm bg-surface-1 border border-border-default rounded text-text-primary cursor-pointer focus:outline-none focus:border-accent"
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
        <div className="p-4 bg-error/10 rounded-md mb-4 text-error">
          {error}
          <button
            onClick={fetchNotifications}
            className="ml-4 px-3 py-1 text-xs bg-transparent border border-error rounded cursor-pointer text-error"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-4">
          <Spinner size="lg" />
          <span className="text-text-secondary">Loading notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 gap-4 bg-surface-1 border border-border-default rounded-lg">
          <div className="text-5xl">🔔</div>
          <div className="text-lg font-medium text-text-primary">
            No notifications
          </div>
          <div className="text-text-muted">
            {filter === "unread"
              ? "You've read all your notifications!"
              : "You're all caught up!"}
          </div>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border-default rounded-lg overflow-hidden">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-4 px-5 py-4 border-b border-border-default last:border-b-0 transition-colors cursor-pointer hover:bg-surface-2 ${
                !notification.read ? "bg-accent/5 hover:bg-accent/10" : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && handleNotificationClick(notification)
              }
            >
              <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-surface-2 rounded-full text-lg">
                {NOTIFICATION_ICONS[notification.type] || "🔔"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[0.9375rem] font-medium text-text-primary leading-snug">
                  {notification.title}
                </div>
                {notification.body && (
                  <div className="text-sm text-text-secondary leading-relaxed mt-1">
                    {notification.body}
                  </div>
                )}
                <div className="text-xs text-text-muted mt-1.5">
                  {formatRelativeTime(notification.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(notification);
                    }}
                    title="Mark as read"
                    aria-label="Mark as read"
                    className="flex items-center justify-center w-8 h-8 p-0 bg-transparent border border-border-default rounded cursor-pointer text-text-secondary hover:bg-surface-3 transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="w-4 h-4"
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
                  className="flex items-center justify-center w-8 h-8 p-0 bg-transparent border border-border-default rounded cursor-pointer text-text-secondary hover:bg-surface-3 transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="w-4 h-4"
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
    </AppLayout>
  );
}
