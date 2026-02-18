/**
 * Bush Platform - Metadata Badges Component
 *
 * Displays key metadata as small badges on asset cards.
 * Shows duration, resolution, rating, status, and keywords.
 * Reference: IMPLEMENTATION_PLAN.md [P2] Metadata Badges
 */
"use client";

import { useMemo } from "react";
import type { AssetFile, CardSize } from "./types";
import styles from "./metadata-badges.module.css";

/**
 * Format duration in seconds to a compact string
 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format resolution to compact string
 */
function formatResolution(width: number, height: number): string {
  // Common resolution labels
  if (width >= 3840 || height >= 2160) return "4K";
  if (width >= 2560 || height >= 1440) return "QHD";
  if (width >= 1920 || height >= 1080) return "1080p";
  if (width >= 1280 || height >= 720) return "720p";
  if (width >= 854 || height >= 480) return "480p";
  return `${width}×${height}`;
}

/** Star icon for rating */
function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/** Clock icon for duration */
function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/** Maximize icon for resolution */
function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/** Tag icon for keywords */
function TagIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

interface MetadataBadgesProps {
  file: AssetFile;
  cardSize: CardSize;
  /** Maximum number of badges to show (default based on card size) */
  maxBadges?: number;
}

export function MetadataBadges({ file, cardSize, maxBadges }: MetadataBadgesProps) {
  // Calculate max badges based on card size if not specified
  const limit = maxBadges ?? (cardSize === "large" ? 4 : cardSize === "medium" ? 3 : 2);

  // Build badge list with priority ordering
  const badges = useMemo(() => {
    const result: Array<{ type: string; label: string; icon?: React.ReactNode; className?: string }> = [];

    // 1. Duration (for video/audio)
    if (file.duration !== null && file.duration !== undefined && file.duration > 0) {
      result.push({
        type: "duration",
        label: formatDuration(file.duration),
        icon: <ClockIcon />,
      });
    }

    // 2. Resolution (for video/images)
    if (file.width && file.height) {
      result.push({
        type: "resolution",
        label: formatResolution(file.width, file.height),
        icon: <MaximizeIcon />,
      });
    }

    // 3. Rating (if set)
    if (file.rating !== null && file.rating !== undefined) {
      result.push({
        type: "rating",
        label: String(file.rating),
        icon: <StarIcon />,
        className: styles.ratingBadge,
      });
    }

    // 4. Status (if set)
    if (file.assetStatus) {
      result.push({
        type: "status",
        label: file.assetStatus,
        className: styles.statusBadge,
      });
    }

    // 5. First keyword (if any)
    if (file.keywords && file.keywords.length > 0) {
      result.push({
        type: "keyword",
        label: file.keywords[0],
        icon: <TagIcon />,
        className: styles.keywordBadge,
      });
    }

    return result.slice(0, limit);
  }, [file, limit]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={styles.badges}>
      {badges.map((badge) => (
        <span
          key={badge.type}
          className={`${styles.badge} ${badge.className || ""}`}
          title={badge.label}
        >
          {badge.icon}
          <span className={styles.badgeLabel}>{badge.label}</span>
        </span>
      ))}
    </div>
  );
}

export default MetadataBadges;
