/**
 * Bush Platform - Notification Dropdown Component
 *
 * Dropdown panel for displaying notifications from the header bell icon.
 * Reference: specs/00-atomic-features.md Section 13
 */
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { notificationsApi } from "@/web/lib/api";
import { useUserEvents } from "@/web/hooks/use-realtime";
import { useAuth } from "@/web/context";
import { NotificationList } from "./notification-list";
import { toNotification, type Notification } from "./types";
import type { NotificationDropdownProps } from "./types";
import styles from "./notifications.module.css";

export function NotificationDropdown({
  isOpen,
  onClose,
  unreadCount,
  onMarkAllRead,
}: NotificationDropdownProps) {
  const { user } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchNotifications = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await notificationsApi.list({ limit: 20 });
        // Check if still mounted before updating state
        if (!isMountedRef.current) return;
        const items = response.data.map((item) =>
          toNotification(item.id, item.attributes)
        );
        setNotifications(items);
      } catch (err) {
        if (!isMountedRef.current) return;
        setError("Failed to load notifications");
        console.error("Failed to fetch notifications:", err);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchNotifications();
  }, [isOpen]);

  // Subscribe to real-time notification events
  useUserEvents(user?.id, {
    eventFilter: "notification.created",
    onEvent: (event) => {
      // Add new notification to the list
      if (event.data?.notification) {
        const newNotification = event.data.notification as Notification;
        setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
      } else if (event.data?.notificationId && event.data?.title) {
        // Construct notification from event data
        const newNotification: Notification = {
          id: event.data.notificationId as string,
          type: event.data.notificationType as Notification["type"],
          title: event.data.title as string,
          body: (event.data.body as string) || null,
          read: false,
          readAt: null,
          createdAt: new Date(event.timestamp),
          data: (event.data as Notification["data"]) || {},
        };
        setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
      }
    },
  });

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read if not already
      if (!notification.read) {
        // Call API directly here to avoid dependency issue
        notificationsApi.markRead(notification.id).catch((err) => {
          console.error("Failed to mark notification as read:", err);
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true, readAt: new Date() } : n
          )
        );
      }

      // Navigate to relevant context
      if (notification.data.file_id) {
        window.location.href = `/files/${notification.data.file_id}`;
      } else if (notification.data.project_id) {
        window.location.href = `/projects/${notification.data.project_id}`;
      } else if (notification.data.share_id) {
        window.location.href = `/shares/${notification.data.share_id}`;
      }

      onClose();
    },
    [onClose]
  );

  const handleMarkRead = useCallback(async (notification: Notification) => {
    try {
      await notificationsApi.markRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: true, readAt: new Date() } : n
        )
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const handleDelete = useCallback(async (notification: Notification) => {
    try {
      await notificationsApi.delete(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
      );
      onMarkAllRead();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className={styles.dropdown}>
      <div className={styles.dropdownHeader}>
        <span className={styles.dropdownTitle}>Notifications</span>
        {unreadCount > 0 && (
          <button
            className={styles.markAllButton}
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className={styles.errorState}>
          <span>{error}</span>
          <button
            disabled={isLoading}
            onClick={async () => {
              setIsLoading(true);
              setError(null);
              try {
                const response = await notificationsApi.list({ limit: 20 });
                if (!isMountedRef.current) return;
                const items = response.data.map((item) =>
                  toNotification(item.id, item.attributes)
                );
                setNotifications(items);
              } catch (err) {
                if (!isMountedRef.current) return;
                setError("Failed to load notifications");
                console.error("Failed to fetch notifications:", err);
              } finally {
                if (isMountedRef.current) {
                  setIsLoading(false);
                }
              }
            }}
          >
            {isLoading ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      <NotificationList
        notifications={notifications}
        isLoading={isLoading && notifications.length === 0}
        onNotificationClick={handleNotificationClick}
        onMarkRead={handleMarkRead}
        onDelete={handleDelete}
      />

      <div className={styles.dropdownFooter}>
        <a href="/notifications" className={styles.viewAllLink}>
          View all notifications
        </a>
      </div>
    </div>
  );
}
