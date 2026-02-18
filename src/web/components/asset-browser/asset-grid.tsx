/**
 * Bush Platform - Asset Grid Component
 *
 * Grid view for displaying assets with adjustable card sizes.
 * Uses virtualization for large file lists via @tanstack/react-virtual.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 * Reference: IMPLEMENTATION_PLAN.md [P2] Virtualized Lists
 */
"use client";

import { useCallback, useRef, useMemo, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AssetCard } from "./asset-card";
import { FolderCard } from "./folder-card";
import type { AssetGridProps, AssetFile, AssetFolder, CardSize } from "./types";
import { CARD_SIZE_DIMENSIONS } from "./types";
import styles from "./asset-grid.module.css";

// Estimate rows based on card size - enables virtualization for lists > 50 items
const VIRTUALIZATION_THRESHOLD = 50;

// Column counts for different sizes at typical viewport widths
function getColumnCount(containerWidth: number, cardSize: CardSize): number {
  const minColumnWidth = CARD_SIZE_DIMENSIONS[cardSize].width;
  return Math.max(1, Math.floor(containerWidth / (minColumnWidth + 16))); // 16 = gap
}

// Group items into rows for virtualized rendering
function groupItemsIntoRows<T>(
  items: T[],
  columnCount: number
): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount));
  }
  return rows;
}

export function AssetGrid({
  files,
  folders = [],
  cardSize,
  selectedIds = [],
  onSelectionChange,
  onFileClick,
  onFolderClick,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: AssetGridProps & {
  /** Callback to load more items (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether more items are available */
  hasMore?: boolean;
  /** Whether currently loading more items */
  isLoadingMore?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Update container width on resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate column count based on container width
  const columnCount = useMemo(
    () => getColumnCount(containerWidth, cardSize),
    [containerWidth, cardSize]
  );

  // Row height based on card size
  const rowHeight = useMemo(() => {
    return CARD_SIZE_DIMENSIONS[cardSize].height + 16; // 16 = gap
  }, [cardSize]);

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

  // Combine folders (first) and files
  const allItems = useMemo(() => [...folders, ...files], [folders, files]);

  // Group items into rows
  const rows = useMemo(
    () => groupItemsIntoRows(allItems, columnCount),
    [allItems, columnCount]
  );

  // Decide whether to use virtualization
  const useVirtualization = allItems.length > VIRTUALIZATION_THRESHOLD;

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: rows.length + (hasMore ? 1 : 0), // +1 for loading trigger
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 3, // Render 3 extra rows above/below viewport
  });

  // Infinite scroll: load more when near bottom
  const lastVirtualItem = virtualizer.getVirtualItems().at(-1);
  useEffect(() => {
    if (
      useVirtualization &&
      hasMore &&
      !isLoadingMore &&
      onLoadMore &&
      lastVirtualItem &&
      lastVirtualItem.index >= rows.length - 2
    ) {
      onLoadMore();
    }
  }, [useVirtualization, hasMore, isLoadingMore, onLoadMore, lastVirtualItem, rows.length]);

  // Empty state
  if (allItems.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📂</div>
        <p className={styles.emptyText}>No files or folders</p>
        <p className={styles.emptyHint}>Upload files or create folders to get started</p>
      </div>
    );
  }

  // Non-virtualized rendering for small lists (faster for few items)
  if (!useVirtualization) {
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

  // Virtualized rendering for large lists
  return (
    <div
      ref={containerRef}
      className={styles.virtualizedContainer}
      style={{ height: "100%", overflow: "auto" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          // Loading trigger row
          if (virtualRow.index === rows.length) {
            return (
              <div
                key="loading-trigger"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={styles.loadingTrigger}
              >
                {isLoadingMore && (
                  <div className={styles.loadingMore}>
                    <div className={styles.spinner} />
                    <span>Loading more...</span>
                  </div>
                )}
              </div>
            );
          }

          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className={styles.virtualizedRow} data-size={cardSize}>
                {row.map((item) => {
                  // Check if it's a folder (has parentId)
                  if ("parentId" in item) {
                    const folder = item as AssetFolder;
                    return (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        cardSize={cardSize}
                        onClick={handleFolderClick}
                      />
                    );
                  }

                  // It's a file
                  const file = item as AssetFile;
                  return (
                    <AssetCard
                      key={file.id}
                      file={file}
                      cardSize={cardSize}
                      isSelected={selectedIds.includes(file.id)}
                      onSelect={handleSelect}
                      onClick={handleFileClick}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
