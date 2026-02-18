/**
 * Bush Platform - Share Card Component
 *
 * Displays a single share in a card format for the shares list page.
 */
"use client";

import { useState } from "react";
import { Badge } from "@/web/components/ui";
import type { ShareWithRelationships, ShareLayout } from "./types";
import styles from "./shares.module.css";

interface ShareCardProps {
  share: ShareWithRelationships;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
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
 * Get layout icon
 */
function getLayoutIcon(layout: ShareLayout): string {
  switch (layout) {
    case "grid":
      return "▦";
    case "reel":
      return "▤";
    case "viewer":
      return "▣";
    default:
      return "▦";
  }
}

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(share: ShareWithRelationships): "success" | "warning" | "error" | "default" {
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return "error";
  }
  if (share.passphrase) {
    return "warning";
  }
  return "success";
}

/**
 * Get status label
 */
function getStatusLabel(share: ShareWithRelationships): string {
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return "expired";
  }
  if (share.passphrase) {
    return "protected";
  }
  return "active";
}

/**
 * Share card component
 */
export function ShareCard({ share, onEdit: _onEdit, onDuplicate, onDelete }: ShareCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/s/${share.slug}`;
    navigator.clipboard.writeText(url);
    // Could add a toast notification here
  };

  return (
    <div className={styles.shareCard}>
      <div className={styles.shareCardHeader}>
        <div className={styles.shareLayout}>
          <span className={styles.layoutIcon}>{getLayoutIcon(share.layout)}</span>
          <span className={styles.layoutLabel}>{share.layout}</span>
        </div>
        <Badge variant={getStatusBadgeVariant(share)} size="sm">
          {getStatusLabel(share)}
        </Badge>
      </div>

      <h3 className={styles.shareCardTitle}>{share.name}</h3>

      <div className={styles.shareCardMeta}>
        {share.asset_count !== undefined && (
          <span className={styles.assetCount}>
            {share.asset_count} asset{share.asset_count !== 1 ? "s" : ""}
          </span>
        )}
        {share.created_by && (
          <span className={styles.creator}>
            by {share.created_by.firstName || share.created_by.email.split("@")[0]}
          </span>
        )}
      </div>

      <div className={styles.shareCardSettings}>
        {share.allowComments && (
          <span className={styles.setting} title="Comments enabled">💬</span>
        )}
        {share.allowDownloads && (
          <span className={styles.setting} title="Downloads enabled">⬇️</span>
        )}
        {share.passphrase && (
          <span className={styles.setting} title="Password protected">🔒</span>
        )}
        {share.expiresAt && (
          <span className={styles.setting} title={`Expires ${new Date(share.expiresAt).toLocaleDateString()}`}>
            ⏱️
          </span>
        )}
      </div>

      <div className={styles.shareCardFooter}>
        <span className={styles.shareSlug}>/{share.slug}</span>
        <span className={styles.lastUpdated}>
          Updated {formatRelativeTime(share.updatedAt)}
        </span>
      </div>

      <div className={styles.shareCardActions}>
        <button
          className={styles.actionBtn}
          onClick={handleCopyLink}
          title="Copy link"
        >
          📋 Copy Link
        </button>
        <a
          href={`/shares/${share.id}`}
          className={styles.actionBtn}
          title="Edit share"
        >
          ✏️ Edit
        </a>
        <div className={styles.menuContainer}>
          <button
            className={styles.menuBtn}
            onClick={() => setShowMenu(!showMenu)}
            title="More options"
          >
            ⋮
          </button>
          {showMenu && (
            <div className={styles.menu}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setShowMenu(false);
                  onDuplicate?.(share.id);
                }}
              >
                📋 Duplicate
              </button>
              <a
                href={`/s/${share.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.menuItem}
                onClick={() => setShowMenu(false)}
              >
                👁️ Preview
              </a>
              <button
                className={`${styles.menuItem} ${styles.danger}`}
                onClick={() => {
                  setShowMenu(false);
                  onDelete?.(share.id);
                }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
