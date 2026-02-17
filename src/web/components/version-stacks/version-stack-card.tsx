/**
 * Bush Platform - Version Stack Card Component
 *
 * Card component for displaying a version stack in the asset browser.
 * Shows stacked thumbnail effect with version count.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useCallback } from "react";
import { Badge } from "@/web/components/ui";
import { getFileCategory, getFileIcon } from "@/shared/file-types";
import type { VersionStackCardProps } from "./types";
import styles from "./version-stack.module.css";

const CARD_SIZE_DIMENSIONS = {
  small: { width: 160, height: 160, thumbnailHeight: 100 },
  medium: { width: 220, height: 200, thumbnailHeight: 140 },
  large: { width: 300, height: 260, thumbnailHeight: 180 },
};

export function VersionStackCard({
  stack,
  cardSize = "medium",
  isSelected,
  onClick,
  onSelect,
}: VersionStackCardProps) {
  const dimensions = CARD_SIZE_DIMENSIONS[cardSize];
  const currentFile = stack.currentFile || stack.files[0];
  const category = currentFile ? getFileCategory(currentFile.mimeType) : "document";
  const versionCount = stack.files.length;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        onSelect?.(stack.id, !isSelected);
      } else {
        onClick?.(stack);
      }
    },
    [stack, isSelected, onSelect, onClick]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect?.(stack.id, e.target.checked);
    },
    [stack.id, onSelect]
  );

  // Get thumbnails for stack effect (up to 3) - used for potential future enhancements
  const _stackThumbnails = stack.files
    .filter((f) => f.thumbnailUrl)
    .slice(0, 3)
    .map((f) => f.thumbnailUrl);

  return (
    <div
      className={`${styles.stackCard} ${isSelected ? styles.selected : ""}`}
      style={{ width: dimensions.width }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(stack);
        }
      }}
      aria-selected={isSelected}
      aria-label={`Version stack: ${stack.name}, ${versionCount} versions`}
    >
      {/* Thumbnail with stack effect */}
      <div
        className={styles.stackThumbnail}
        style={{ height: dimensions.thumbnailHeight }}
        data-category={category}
      >
        {/* Stacked background cards (visual effect) */}
        {versionCount > 1 && (
          <>
            <div className={styles.stackLayer3} />
            <div className={styles.stackLayer2} />
          </>
        )}

        {/* Main thumbnail */}
        {currentFile?.thumbnailUrl ? (
          <img
            src={currentFile.thumbnailUrl}
            alt={stack.name}
            className={styles.stackMainImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.stackPlaceholder}>
            <span className={styles.stackIcon}>{getFileIcon(currentFile?.mimeType || "")}</span>
          </div>
        )}

        {/* Selection checkbox */}
        <div className={styles.stackCheckbox}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            aria-label={`Select ${stack.name}`}
          />
        </div>

        {/* Version count badge */}
        <div className={styles.stackCount}>
          <Badge variant="default" size="sm">
            {versionCount} v{versionCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Stack indicator icon */}
        <div className={styles.stackIndicator} title="Version Stack">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="2" y="10" width="8" height="2" rx="0.5" opacity="0.5" />
            <rect x="4" y="7" width="8" height="2" rx="0.5" opacity="0.75" />
            <rect x="6" y="4" width="8" height="2" rx="0.5" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div className={styles.stackInfo}>
        <span className={styles.stackName} title={stack.name}>
          {stack.name}
        </span>
        <span className={styles.stackMeta}>
          {versionCount} version{versionCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
