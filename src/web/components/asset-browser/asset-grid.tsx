/**
 * Bush Platform - Asset Grid Component
 *
 * Grid view for displaying assets with adjustable card sizes.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */
"use client";

import { useCallback } from "react";
import { AssetCard } from "./asset-card";
import { FolderCard } from "./folder-card";
import type { AssetGridProps, AssetFile, AssetFolder } from "./types";
import styles from "./asset-grid.module.css";

export function AssetGrid({
  files,
  folders = [],
  cardSize,
  selectedIds = [],
  onSelectionChange,
  onFileClick,
  onFolderClick,
}: AssetGridProps) {
  const handleSelect = useCallback(
    (id: string, selected: boolean) => {
      let newSelectedIds: string[];

      if (selected) {
        newSelectedIds = [...selectedIds, id];
      } else {
        newSelectedIds = selectedIds.filter((sid) => sid !== id);
      }

      onSelectionChange?.(newSelectedIds);
    },
    [selectedIds, onSelectionChange]
  );

  const handleFileClick = useCallback(
    (file: AssetFile) => {
      onFileClick?.(file);
    },
    [onFileClick]
  );

  const handleFolderClick = useCallback(
    (folder: AssetFolder) => {
      onFolderClick?.(folder);
    },
    [onFolderClick]
  );

  const allItems = [...folders, ...files];

  if (allItems.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📂</div>
        <p className={styles.emptyText}>No files or folders</p>
        <p className={styles.emptyHint}>Upload files or create folders to get started</p>
      </div>
    );
  }

  return (
    <div className={styles.grid} data-size={cardSize}>
      {/* Folders first */}
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          cardSize={cardSize}
          onClick={handleFolderClick}
        />
      ))}

      {/* Files */}
      {files.map((file) => (
        <AssetCard
          key={file.id}
          file={file}
          cardSize={cardSize}
          isSelected={selectedIds.includes(file.id)}
          onSelect={handleSelect}
          onClick={handleFileClick}
        />
      ))}
    </div>
  );
}
