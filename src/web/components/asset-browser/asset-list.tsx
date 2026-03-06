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
import { SpinnerIcon } from "@/web/lib/icons";
import { Badge } from "@/web/components/ui";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import type { AssetListProps, AssetFile, AssetFolder } from "./types";

type SortField = "name" | "fileSizeBytes" | "createdAt" | "updatedAt" | "status";

// Estimate row height
const ROW_HEIGHT = 52;
const _HEADER_HEIGHT = 44;

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
  const isActive = currentField === field;
  return (
    <button
      className={`
        flex items-center gap-1 bg-none border-0 p-0
        font-inherit text-inherit cursor-pointer transition-colors
        hover:text-primary ${isActive ? "text-accent" : "text-secondary"}
      `.trim()}
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {isActive && <span className="text-[0.625rem]">{direction === "asc" ? "↑" : "↓"}</span>}
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

  const getStatusBadgeColor = (status: AssetFile["status"]): "green" | "amber" | "zinc" | "red" => {
    switch (status) {
      case "ready":
        return "green";
      case "processing":
        return "amber";
      case "uploading":
        return "zinc";
      case "processing_failed":
        return "red";
      default:
        return "zinc";
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

  // Virtualization setup - hooks must be called unconditionally BEFORE any early returns
  const itemCount = allItems.length + (hasMore ? 1 : 0);
  const useVirtualization = allItems.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: Math.max(1, itemCount), // Ensure count is at least 1 to avoid issues
    getScrollElement: () => containerRef.current,
    estimateSize: (index: number) => {
      if (index === allItems.length) return 48; // Loading row
      return ROW_HEIGHT;
    },
    overscan: 10,
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
      lastVirtualItem.index >= allItems.length - 5
    ) {
      onLoadMore();
    }
  }, [useVirtualization, hasMore, isLoadingMore, onLoadMore, lastVirtualItem, allItems.length]);

  // Empty state
  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="text-4xl mb-4 opacity-50">📂</div>
        <p className="text-base font-medium text-secondary m-0 mb-2">No files or folders</p>
        <p className="text-sm text-muted m-0">Upload files or create folders to get started</p>
      </div>
    );
  }

  // Row renderer
  const renderRow = (item: AssetFile | AssetFolder, _index: number) => {
    // Check if it's a folder
    if ("parentId" in item) {
      const folder = item as AssetFolder;
      return (
        <div
          key={folder.id}
          className="flex items-center py-3 px-4 border-b border-border-default cursor-pointer transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px] md:py-2 md:px-3"
          onClick={() => handleFolderClick(folder)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleFolderClick(folder);
            }
          }}
        >
          <div className="flex items-center w-10 shrink-0">{/* Folders aren't selectable */}</div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-3 md:gap-2">
              <span className="text-xl shrink-0">📁</span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis text-sm font-medium text-primary md:text-[0.8125rem]">
                {folder.name}
              </span>
            </div>
          </div>
          <div className="w-[100px] shrink-0 text-right hidden md:block">—</div>
          <div className="w-[120px] shrink-0 flex justify-center hidden md:block">—</div>
          <div className="w-[100px] shrink-0 text-right text-muted text-[0.8125rem]">
            {formatRelativeTime(folder.createdAt)}
          </div>
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
        className={`flex items-center py-3 px-4 border-b border-border-default cursor-pointer transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px] md:py-2 md:px-3 ${isSelected ? "bg-blue-500/5" : ""}`}
        onClick={() => handleFileClick(file)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleFileClick(file);
          }
        }}
      >
        <div className="flex items-center w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleSelect(file.id, e.target.checked)}
            className="w-4 h-4 cursor-pointer accent"
            aria-label={`Select ${file.name}`}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 md:gap-2">
            <span className="text-xl shrink-0" data-category={category}>
              {getFileIcon(file.mimeType)}
            </span>
            <span className="whitespace-nowrap overflow-hidden text-ellipsis text-sm font-medium text-primary md:text-[0.8125rem]">
              {file.name}
            </span>
          </div>
        </div>
        <div className="w-[100px] shrink-0 text-right hidden md:block">
          {formatFileSize(file.fileSizeBytes)}
        </div>
        <div className="w-[120px] shrink-0 flex justify-center hidden md:flex">
          <Badge color={getStatusBadgeColor(file.status)}>
            {file.status === "processing_failed" ? "failed" : file.status}
          </Badge>
        </div>
        <div className="w-[100px] shrink-0 text-right text-muted text-[0.8125rem]">
          {formatRelativeTime(file.createdAt)}
        </div>
      </div>
    );
  };

  // Non-virtualized rendering for small lists
  if (!useVirtualization) {
    return (
      <div className="w-full overflow-x-auto">
        {/* Header */}
        <div className="flex items-center py-3 px-4 bg-surface-3 border-b border-border-default text-xs font-semibold text-secondary uppercase tracking-wide md:py-2 md:px-3">
          <div className="flex items-center w-10 shrink-0">
            <input
              type="checkbox"
              checked={selectedIds.length === files.length && files.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 cursor-pointer accent"
              aria-label="Select all files"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <SortHeader
              field="name"
              label="Name"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          </div>
          <div className="w-[100px] shrink-0 text-right hidden md:block">
            <SortHeader
              field="fileSizeBytes"
              label="Size"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          </div>
          <div className="w-[120px] shrink-0 flex justify-center hidden md:flex">
            <SortHeader
              field="status"
              label="Status"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          </div>
          <div className="w-[100px] shrink-0 text-right">
            <SortHeader
              field="createdAt"
              label="Created"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          </div>
        </div>

        {/* Rows */}
        <div className="flex flex-col">{allItems.map((item, index) => renderRow(item, index))}</div>
      </div>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col"
      style={{ height: "100%", overflow: "auto" }}
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center py-3 px-4 bg-surface-3 border-b border-border-default text-xs font-semibold text-secondary uppercase tracking-wide md:py-2 md:px-3">
        <div className="flex items-center w-10 shrink-0">
          <input
            type="checkbox"
            checked={selectedIds.length === files.length && files.length > 0}
            onChange={handleSelectAll}
            className="w-4 h-4 cursor-pointer accent"
            aria-label="Select all files"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <SortHeader
            field="name"
            label="Name"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        </div>
        <div className="w-[100px] shrink-0 text-right hidden md:block">
          <SortHeader
            field="fileSizeBytes"
            label="Size"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        </div>
        <div className="w-[120px] shrink-0 flex justify-center hidden md:flex">
          <SortHeader
            field="status"
            label="Status"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        </div>
        <div className="w-[100px] shrink-0 text-right">
          <SortHeader
            field="createdAt"
            label="Created"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
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
                className="flex items-center justify-center p-4"
              >
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-secondary text-sm">
                    <SpinnerIcon className="size-4" />
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
