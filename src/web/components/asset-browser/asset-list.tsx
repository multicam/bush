/**
 * Bush Platform - Asset List Component
 *
 * List view for displaying assets with sortable columns.
 * Uses virtualization for large file lists via @tanstack/react-virtual.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 * Reference: IMPLEMENTATION_PLAN.md [P2] Virtualized Lists
 */
"use client";

import { useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/web/components/ui";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import type { AssetListProps, AssetFile, AssetFolder } from "./types";
import styles from "./asset-list.module.css";

type SortField = "name" | "fileSizeBytes" | "createdAt" | "updatedAt" | "status";

// Estimate row height
const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 44;

// Virtualization threshold
const VIRTUALIZATION_THRESHOLD = 50;

// SortHeader defined outside component to avoid React ESLint error
interface SortHeaderProps {
  field: SortField;
  label: string;
  currentField: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
}

function SortHeader({ field, label, currentField, direction, onSort }: SortHeaderProps) {
  return (
    <button
      className={`${styles.sortHeader} ${currentField === field ? styles.active : ""}`}
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {currentField === field && (
        <span className={styles.sortIndicator}>
          {direction === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}

export function AssetList({
  files,
  folders = [],
  selectedIds = [],
  sortField = "createdAt",
  sortDirection = "desc",
  onSelectionChange,
  onSort,
  onFileClick,
  onFolderClick,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: AssetListProps & {
  /** Callback to load more items (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether more items are available */
  hasMore?: boolean;
  /** Whether currently loading more items */
  isLoadingMore?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSelectAll = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        onSelectionChange?.(files.map((f) => f.id));
      } else {
        onSelectionChange?.([]);
      }
    },
    [files, onSelectionChange]
  );

  const handleSort = useCallback(
    (field: string) => {
      onSort?.(field);
    },
    [onSort]
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

  const getStatusBadgeVariant = (status: AssetFile["status"]): "default" | "success" | "warning" | "error" => {
    switch (status) {
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const allItems = [...folders, ...files];

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

  // Decide whether to use virtualization
  const useVirtualization = allItems.length > VIRTUALIZATION_THRESHOLD;

  // Row renderer
  const renderRow = (item: AssetFile | AssetFolder, index: number) => {
    // Check if it's a folder
    if ("parentId" in item) {
      const folder = item as AssetFolder;
      return (
        <div
          key={folder.id}
          className={styles.row}
          onClick={() => handleFolderClick(folder)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleFolderClick(folder);
            }
          }}
        >
          <div className={styles.checkboxCell}>
            {/* Folders aren't selectable */}
          </div>
          <div className={styles.nameCell}>
            <div className={styles.nameContent}>
              <span className={styles.folderIcon}>📁</span>
              <span className={styles.name}>{folder.name}</span>
            </div>
          </div>
          <div className={styles.sizeCell}>—</div>
          <div className={styles.statusCell}>—</div>
          <div className={styles.dateCell}>{formatRelativeTime(folder.createdAt)}</div>
        </div>
      );
    }

    // It's a file
    const file = item as AssetFile;
    const isSelected = selectedIds.includes(file.id);
    const category = getFileCategory(file.mimeType);

    return (
      <div
        key={file.id}
        className={`${styles.row} ${isSelected ? styles.selected : ""}`}
        onClick={() => handleFileClick(file)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleFileClick(file);
          }
        }}
      >
        <div className={styles.checkboxCell} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleSelect(file.id, e.target.checked)}
            className={styles.checkbox}
            aria-label={`Select ${file.name}`}
          />
        </div>
        <div className={styles.nameCell}>
          <div className={styles.nameContent}>
            <span className={styles.fileIcon} data-category={category}>
              {getFileIcon(file.mimeType)}
            </span>
            <span className={styles.name}>{file.name}</span>
          </div>
        </div>
        <div className={styles.sizeCell}>{formatFileSize(file.fileSizeBytes)}</div>
        <div className={styles.statusCell}>
          <Badge variant={getStatusBadgeVariant(file.status)} size="sm">
            {file.status === "processing_failed" ? "failed" : file.status}
          </Badge>
        </div>
        <div className={styles.dateCell}>{formatRelativeTime(file.createdAt)}</div>
      </div>
    );
  };

  // Non-virtualized rendering for small lists
  if (!useVirtualization) {
    return (
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.checkboxCell}>
            <input
              type="checkbox"
              checked={selectedIds.length === files.length && files.length > 0}
              onChange={handleSelectAll}
              className={styles.checkbox}
              aria-label="Select all files"
            />
          </div>
          <div className={styles.nameCell}>
            <SortHeader field="name" label="Name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          </div>
          <div className={styles.sizeCell}>
            <SortHeader field="fileSizeBytes" label="Size" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          </div>
          <div className={styles.statusCell}>
            <SortHeader field="status" label="Status" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          </div>
          <div className={styles.dateCell}>
            <SortHeader field="createdAt" label="Created" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          </div>
        </div>

        {/* Rows */}
        <div className={styles.body}>
          {allItems.map((item, index) => renderRow(item, index))}
        </div>
      </div>
    );
  }

  // Virtualized rendering for large lists
  const itemCount = allItems.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      if (index === allItems.length) return 48; // Loading row
      return ROW_HEIGHT;
    },
    overscan: 10,
  });

  // Infinite scroll: load more when near bottom
  const lastVirtualItem = virtualizer.getVirtualItems().at(-1);
  useEffect(() => {
    if (
      hasMore &&
      !isLoadingMore &&
      onLoadMore &&
      lastVirtualItem &&
      lastVirtualItem.index >= allItems.length - 5
    ) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore, lastVirtualItem, allItems.length]);

  return (
    <div
      ref={containerRef}
      className={styles.virtualizedContainer}
      style={{ height: "100%", overflow: "auto" }}
    >
      {/* Sticky Header */}
      <div className={styles.header}>
        <div className={styles.checkboxCell}>
          <input
            type="checkbox"
            checked={selectedIds.length === files.length && files.length > 0}
            onChange={handleSelectAll}
            className={styles.checkbox}
            aria-label="Select all files"
          />
        </div>
        <div className={styles.nameCell}>
          <SortHeader field="name" label="Name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className={styles.sizeCell}>
          <SortHeader field="fileSizeBytes" label="Size" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className={styles.statusCell}>
          <SortHeader field="status" label="Status" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className={styles.dateCell}>
          <SortHeader field="createdAt" label="Created" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
      </div>

      {/* Virtualized Body */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          // Loading trigger row
          if (virtualRow.index === allItems.length) {
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

          const item = allItems[virtualRow.index];
          if (!item) return null;

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
              {renderRow(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
