/**
 * Bush Platform - Asset Browser Component
 *
 * Main component for browsing assets with grid/list views.
 * Supports virtualization for large lists via @tanstack/react-virtual.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 * Reference: IMPLEMENTATION_PLAN.md [P2] Virtualized Lists
 */
"use client";

import { useState, useCallback, useMemo } from "react";
import { AssetGrid } from "./asset-grid";
import { AssetList } from "./asset-list";
import { ViewControls } from "./view-controls";
import { Spinner } from "@/web/components/ui";
import type { AssetBrowserProps, AssetFile, ViewMode, CardSize, AssetFolder } from "./types";

export function AssetBrowser({
  projectId: _projectId,
  folderId: _folderId = null,
  files,
  folders = [],
  selectedIds = [],
  onSelectionChange,
  onFileClick,
  onFolderClick,
  defaultViewMode = "grid",
  defaultCardSize = "medium",
  isLoading = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: AssetBrowserProps & {
  /** Callback to load more items (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether more items are available */
  hasMore?: boolean;
  /** Whether currently loading more items */
  isLoadingMore?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [cardSize, setCardSize] = useState<CardSize>(defaultCardSize);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Sort files based on current sort settings
  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "fileSizeBytes":
          comparison = a.fileSizeBytes - b.fileSizeBytes;
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [files, sortField, sortDirection]);

  // Sort folders (always by name, folders first)
  const sortedFolders = useMemo(() => {
    const sorted = [...folders];
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [folders]);

  // Handle sort toggle
  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  // Handle file click
  const handleFileClick = useCallback(
    (file: AssetFile) => {
      onFileClick?.(file);
    },
    [onFileClick]
  );

  // Handle folder click
  const handleFolderClick = useCallback(
    (folder: AssetFolder) => {
      onFolderClick?.(folder);
    },
    [onFolderClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center p-16 text-center text-text-secondary">
          <Spinner size="lg" />
          <p className="mt-4 m-0">Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border-default">
        <div className="text-sm text-text-secondary">
          {files.length + folders.length} items
          {selectedIds.length > 0 && (
            <span className="text-accent font-medium ml-1">
              • {selectedIds.length} selected
            </span>
          )}
        </div>
        <ViewControls
          viewMode={viewMode}
          cardSize={cardSize}
          onViewModeChange={setViewMode}
          onCardSizeChange={setCardSize}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-surface-1">
        {viewMode === "grid" ? (
          <AssetGrid
            files={sortedFiles}
            folders={sortedFolders}
            cardSize={cardSize}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            onFileClick={handleFileClick}
            onFolderClick={handleFolderClick}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
          />
        ) : (
          <AssetList
            files={sortedFiles}
            folders={sortedFolders}
            selectedIds={selectedIds}
            sortField={sortField}
            sortDirection={sortDirection}
            onSelectionChange={onSelectionChange}
            onSort={handleSort}
            onFileClick={handleFileClick}
            onFolderClick={handleFolderClick}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
          />
        )}
      </div>
    </div>
  );
}
