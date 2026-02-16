/**
 * Bush Platform - Folder Card Component
 *
 * Card component for displaying a folder in grid view.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */
"use client";

import { useCallback } from "react";
import type { AssetFolder, CardSize } from "./types";
import { CARD_SIZE_DIMENSIONS } from "./types";
import styles from "./folder-card.module.css";

interface FolderCardProps {
  folder: AssetFolder;
  cardSize: CardSize;
  onClick?: (folder: AssetFolder) => void;
}

export function FolderCard({ folder, cardSize, onClick }: FolderCardProps) {
  const dimensions = CARD_SIZE_DIMENSIONS[cardSize];

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onClick?.(folder);
      }
    },
    [folder, onClick]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(folder);
      }
    },
    [folder, onClick]
  );

  return (
    <div
      className={styles.card}
      style={{ width: dimensions.width }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Open folder ${folder.name}`}
    >
      {/* Icon */}
      <div
        className={styles.iconContainer}
        style={{ height: dimensions.thumbnailHeight }}
      >
        <span className={styles.folderIcon}>📁</span>
      </div>

      {/* Info */}
      <div className={styles.info}>
        <span className={styles.name} title={folder.name}>
          {folder.name}
        </span>
      </div>
    </div>
  );
}
