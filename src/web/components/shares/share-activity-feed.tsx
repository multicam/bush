/**
 * Bush Platform - Share Activity Feed Component
 *
 * Displays recent activity on a share (views, comments, downloads).
 */
"use client";

import { useState, useEffect } from "react";
import {
  sharesApi,
  getErrorMessage,
  extractCollectionAttributes,
  type ShareActivityType,
} from "@/web/lib/api";
import type { ShareActivityEntry } from "./types";
import {
  EyeIcon,
  ChatBubbleLeftIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  SpinnerIcon,
} from "@/web/lib/icons";

interface ShareActivityFeedProps {
  shareId: string;
  limit?: number;
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type: ShareActivityType): React.ReactNode {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "view":
      return <EyeIcon className={iconClass} />;
    case "comment":
      return <ChatBubbleLeftIcon className={iconClass} />;
    case "download":
      return <ArrowDownTrayIcon className={iconClass} />;
    default:
      return <DocumentTextIcon className={iconClass} />;
  }
}

/**
 * Get description for activity
 */
function getActivityDescription(activity: ShareActivityEntry): string {
  const viewer = activity.viewerEmail || "Anonymous";
  switch (activity.type) {
    case "view":
      return `${viewer} viewed this share`;
    case "comment":
      return `${viewer} left a comment`;
    case "download":
      return `${viewer} downloaded an asset`;
    default:
      return `${viewer} interacted with this share`;
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Share activity feed component
 */
export function ShareActivityFeed({ shareId, limit = 20 }: ShareActivityFeedProps) {
  const [activities, setActivities] = useState<ShareActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivity() {
      try {
        setLoading(true);
        setError(null);

        const response = await sharesApi.getActivity(shareId, { limit });
        const items = extractCollectionAttributes(response) as ShareActivityEntry[];
        setActivities(items);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [shareId, limit]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col items-center justify-center p-16">
          <SpinnerIcon className="w-10 h-10 text-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="p-6 text-center text-secondary">
          <p>Failed to load activity: {error}</p>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="p-6 text-center text-secondary">
          <p>No activity yet. Share this link to start tracking views!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => (
        <div key={activity.id} className="flex gap-3 p-3 bg-surface-2 rounded-md">
          <div className="w-8 h-8 flex items-center justify-center text-base bg-surface-1 rounded-full">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[13px] text-primary">{getActivityDescription(activity)}</span>
            <span className="text-[11px] text-secondary/80">
              {formatRelativeTime(activity.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
