/**
 * Bush Platform - Notification Types
 *
 * Type definitions for the notifications system.
 * Reference: specs/17-api-complete.md Section 6.15
 */

import type { NotificationType, NotificationAttributes } from "@/web/lib/api";

/**
 * Notification item with ID
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  data: NotificationAttributes["data"];
}

/**
 * Props for notification bell component
 */
export interface NotificationBellProps {
  /** Current unread count */
  unreadCount: number;
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Callback when bell is clicked */
  onClick: () => void;
  /** Whether notifications are loading */
  isLoading?: boolean;
}

/**
 * Props for notification dropdown component
 */
export interface NotificationDropdownProps {
  /** Whether the dropdown is visible */
  isOpen: boolean;
  /** Callback to close dropdown */
  onClose: () => void;
  /** Current unread count */
  unreadCount: number;
  /** Callback when mark all as read is clicked */
  onMarkAllRead: () => void;
}

/**
 * Props for notification item component
 */
export interface NotificationItemProps {
  /** Notification data */
  notification: Notification;
  /** Callback when notification is clicked */
  onClick: (notification: Notification) => void;
  /** Callback when mark as read is clicked */
  onMarkRead: (notification: Notification) => void;
  /** Callback when delete is clicked */
  onDelete: (notification: Notification) => void;
}

/**
 * Props for notification list component
 */
export interface NotificationListProps {
  /** Array of notifications */
  notifications: Notification[];
  /** Whether notifications are loading */
  isLoading: boolean;
  /** Callback when a notification is clicked */
  onNotificationClick: (notification: Notification) => void;
  /** Callback to mark a notification as read */
  onMarkRead: (notification: Notification) => void;
  /** Callback to delete a notification */
  onDelete: (notification: Notification) => void;
}

/**
 * Icon mapping for notification types
 */
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  mention: "@",
  comment_reply: "💬",
  comment_created: "💬",
  upload: "📤",
  status_change: "🔄",
  share_invite: "🔗",
  share_viewed: "👁",
  share_downloaded: "⬇️",
  assignment: "👤",
  file_processed: "✅",
};

/**
 * Convert API notification to local notification type
 */
export function toNotification(
  id: string,
  attributes: NotificationAttributes
): Notification {
  return {
    id,
    type: attributes.notification_type,
    title: attributes.title,
    body: attributes.body,
    read: attributes.read,
    readAt: attributes.read_at ? new Date(attributes.read_at) : null,
    createdAt: new Date(attributes.created_at),
    data: attributes.data,
  };
}

/**
 * Format relative time for notification timestamps
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) {
    return "just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else if (diffWeek < 4) {
    return `${diffWeek}w ago`;
  } else {
    return date.toLocaleDateString();
  }
}
