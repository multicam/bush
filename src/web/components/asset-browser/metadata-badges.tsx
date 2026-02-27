/**
 * Bush Platform - Metadata Badges Component
 *
 * Displays key metadata as small badges on asset cards.
 * Shows duration, resolution, rating, status, and keywords.
 * Reference: IMPLEMENTATION_PLAN.md [P2] Metadata Badges
 */
"use client";

import { useMemo } from "react";
import { Clock, Maximize2, Star, Tag } from "lucide-react";
import { cn } from "@/web/lib/utils";
import type { AssetFile, CardSize } from "./types";

/**
 * Format duration in seconds to a compact string
 */
export function formatDuration(seconds: number): string {
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
export function formatResolution(width: number, height: number): string {
  // Common resolution labels
  if (width >= 3840 || height >= 2160) return "4K";
  if (width >= 2560 || height >= 1440) return "QHD";
  if (width >= 1920 || height >= 1080) return "1080p";
  if (width >= 1280 || height >= 720) return "720p";
  if (width >= 854 || height >= 480) return "480p";
  return `${width}×${height}`;
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
    const result: Array<{ type: string; label: string; icon?: React.ReactNode; variant?: string }> = [];

    // 1. Duration (for video/audio)
    if (file.duration !== null && file.duration !== undefined && file.duration > 0) {
      result.push({
        type: "duration",
        label: formatDuration(file.duration),
        icon: <Clock size={10} />,
      });
    }

    // 2. Resolution (for video/images)
    if (file.width && file.height) {
      result.push({
        type: "resolution",
        label: formatResolution(file.width, file.height),
        icon: <Maximize2 size={10} />,
      });
    }

    // 3. Rating (if set)
    if (file.rating !== null && file.rating !== undefined) {
      result.push({
        type: "rating",
        label: String(file.rating),
        icon: <Star size={10} fill="currentColor" />,
        variant: "rating",
      });
    }

    // 4. Status (if set)
    if (file.assetStatus) {
      result.push({
        type: "status",
        label: file.assetStatus,
        variant: "status",
      });
    }

    // 5. First keyword (if any)
    if (file.keywords && file.keywords.length > 0) {
      result.push({
        type: "keyword",
        label: file.keywords[0],
        icon: <Tag size={10} />,
        variant: "keyword",
      });
    }

    return result.slice(0, limit);
  }, [file, limit]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 px-2 pb-1">
      {badges.map((badge) => (
        <span
          key={badge.type}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5",
            "text-[10px] font-medium rounded",
            "whitespace-nowrap overflow-hidden text-ellipsis max-w-full",
            badge.variant === "rating" && "text-amber-500 bg-amber-500/10",
            badge.variant === "status" && "text-info bg-info/10",
            badge.variant === "keyword" && "text-violet-400 bg-violet-400/10",
            !badge.variant && "text-text-secondary bg-surface-3"
          )}
          title={badge.label}
        >
          {badge.icon && <span className="flex-shrink-0 opacity-70">{badge.icon}</span>}
          <span className="overflow-hidden text-ellipsis">{badge.label}</span>
        </span>
      ))}
    </div>
  );
}

export default MetadataBadges;
