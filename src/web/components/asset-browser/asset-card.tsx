/**
 * Bush Platform - Asset Card Component
 *
 * Card component for displaying a single asset in grid view.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 * Reference: IMPLEMENTATION_PLAN.md [P2] Metadata Badges
 */
"use client";

import { useCallback } from "react";
import { Badge } from "@/web/components/ui";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import type { AssetFile, CardSize } from "./types";
import { CARD_SIZE_DIMENSIONS } from "./types";
import { MetadataBadges } from "./metadata-badges";
import styles from "./asset-card.module.css";

interface AssetCardProps {
  file: AssetFile;
  cardSize: CardSize;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onClick?: (file: AssetFile) => void;
}

export function AssetCard({ file, cardSize, isSelected, onSelect, onClick }: AssetCardProps) {
  const dimensions = CARD_SIZE_DIMENSIONS[cardSize];
  const category = getFileCategory(file.mimeType);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection with ctrl/cmd click
        onSelect?.(file.id, !isSelected);
      } else if (e.shiftKey) {
        // Range select with shift click - handled by parent
        e.preventDefault();
      } else {
        // Normal click
        onClick?.(file);
      }
    },
    [file, isSelected, onSelect, onClick]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect?.(file.id, e.target.checked);
    },
    [file.id, onSelect]
  );

  const getStatusBadgeVariant = (): "default" | "success" | "warning" | "error" => {
    switch (file.status) {
      case "ready":
        return "success";
      case "processing":
        return "warning";
      case "uploading":
        return "default";
      case "processing_failed":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      style={{ width: dimensions.width }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(file);
        }
      }}
      aria-selected={isSelected}
    >
      {/* Thumbnail */}
      <div
        className={styles.thumbnail}
        style={{ height: dimensions.thumbnailHeight }}
        data-category={category}
      >
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className={styles.thumbnailImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbnailPlaceholder}>
            <span className={styles.thumbnailIcon}>{getFileIcon(file.mimeType)}</span>
          </div>
        )}

        {/* Selection checkbox */}
        <div className={styles.checkboxContainer}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className={styles.checkbox}
            aria-label={`Select ${file.name}`}
          />
        </div>

        {/* Status badge */}
        {file.status !== "ready" && (
          <div className={styles.statusBadge}>
            <Badge variant={getStatusBadgeVariant()} size="sm">
              {file.status === "processing_failed" ? "failed" : file.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <span className={styles.name} title={file.name}>
          {file.name}
        </span>
        <span className={styles.meta}>
          {formatFileSize(file.fileSizeBytes)}
        </span>
      </div>

      {/* Metadata badges */}
      <MetadataBadges file={file} cardSize={cardSize} />
    </div>
  );
}
