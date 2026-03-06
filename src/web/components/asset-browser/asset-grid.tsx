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
import { FolderOpenLargeIcon, SpinnerIcon } from "@/web/lib/icons";
import { AssetCard } from "./asset-card";
import { FolderCard } from "./folder-card";
import type { AssetGridProps, AssetFile, AssetFolder, CardSize } from "./types";
import { CARD_SIZE_DIMENSIONS } from "./types";
import { cn } from "@/web/lib/utils";

// Estimate rows based on card size - enables virtualization for lists > 50 items
const VIRTUALIZATION_THRESHOLD = 50;

// Column counts for different sizes at typical viewport widths
function getColumnCount(containerWidth: number, cardSize: CardSize): number {
  const minColumnWidth = CARD_SIZE_DIMENSIONS[cardSize].width;
  return Math.max(1, Math.floor(containerWidth / (minColumnWidth + 16))); // 16 = gap
}

// Group items into rows for virtualized rendering
function groupItemsIntoRows<T>(items: T[], columnCount: number): T[][] {
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
  const rows = useMemo(() => groupItemsIntoRows(allItems, columnCount), [allItems, columnCount]);

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
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <FolderOpenLargeIcon className="size-16 text-text-muted mb-4" />
        <p className="text-base font-medium text-text-secondary mb-2">No files or folders</p>
        <p className="text-sm text-text-muted m-0">Upload files or create folders to get started</p>
      </div>
    );
  }

  // Non-virtualized rendering for small lists (faster for few items)
  if (!useVirtualization) {
    return (
      <div
        className={cn(
          "grid gap-4 p-4",
          cardSize === "small" && "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]",
          cardSize === "medium" && "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]",
          cardSize === "large" && "grid-cols-[repeat(auto-fill,minmax(300px,1fr))]",
          "max-sm:gap-3 max-sm:p-3 max-sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
        )}
      >
        {/* Folders first */}
        {folders.map((folder, index) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            cardSize={cardSize}
            onClick={handleFolderClick}
            staggerIndex={index}
          />
        ))}

        {/* Files */}
        {files.map((file, index) => (
          <AssetCard
            key={file.id}
            file={file}
            cardSize={cardSize}
            isSelected={selectedIds.includes(file.id)}
            onSelect={handleSelect}
            onClick={handleFileClick}
            staggerIndex={folders.length + index}
          />
        ))}
      </div>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div
      ref={containerRef}
      className="w-full p-4 box-border"
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
                className="flex items-center justify-center p-4"
              >
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <SpinnerIcon className="size-4" />
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
              <div
                className={cn(
                  "flex gap-4 py-2",
                  cardSize === "small" && "[&>*]:max-w-[200px]",
                  cardSize === "medium" && "[&>*]:max-w-[280px]",
                  cardSize === "large" && "[&>*]:max-w-[380px]",
                  "[&>*]:flex-1 [&>*]:min-w-0"
                )}
              >
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
                        staggerIndex={0}
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
                      staggerIndex={0}
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
