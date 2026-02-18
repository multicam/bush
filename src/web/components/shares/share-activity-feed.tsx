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
import styles from "./shares.module.css";

interface ShareActivityFeedProps {
  shareId: string;
  limit?: number;
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type: ShareActivityType): string {
  switch (type) {
    case "view":
      return "👁️";
    case "comment":
      return "💬";
    case "download":
      return "⬇️";
    default:
      return "📄";
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
      <div className={styles.activityFeed}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.activityFeed}>
        <div className={styles.activityEmpty}>
          <p>Failed to load activity: {error}</p>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={styles.activityFeed}>
        <div className={styles.activityEmpty}>
          <p>No activity yet. Share this link to start tracking views!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.activityFeed}>
      {activities.map((activity) => (
        <div key={activity.id} className={styles.activityItem}>
          <div className={styles.activityIcon}>
            {getActivityIcon(activity.type)}
          </div>
          <div className={styles.activityContent}>
            <span className={styles.activityText}>
              {getActivityDescription(activity)}
            </span>
            <span className={styles.activityTime}>
              {formatRelativeTime(activity.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
