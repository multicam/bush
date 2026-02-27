/**
 * Bush Platform - Notification List Component
 *
 * Scrollable list of notifications with loading state.
 * Reference: specs/00-product-reference.md Section 13
 */
"use client";

import { Bell, Loader2 } from "lucide-react";
import { NotificationItem } from "./notification-item";
import type { NotificationListProps } from "./types";

export function NotificationList({
  notifications,
  isLoading,
  onNotificationClick,
  onMarkRead,
  onDelete,
}: NotificationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2 text-secondary">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        <span>Loading notifications...</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2 text-secondary">
        <Bell className="text-2xl mb-2" aria-hidden="true" />
        <div className="text-sm font-medium text-primary">No notifications</div>
        <div className="text-[0.8125rem] text-muted">
          You&apos;re all caught up!
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto max-h-[360px]">
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
