/**
 * Bush Platform - Asset List Component
 *
 * List view for displaying assets with sortable columns.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */
"use client";

import { useCallback } from "react";
import { Badge } from "@/web/components/ui";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import type { AssetListProps, AssetFile, AssetFolder } from "./types";
import styles from "./asset-list.module.css";

type SortField = "name" | "fileSizeBytes" | "createdAt" | "updatedAt" | "status";

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
}: AssetListProps) {
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

  const getStatusBadgeVariant = (status: AssetFile["status"]): "default" | "success" | "warning" | "danger" => {
    switch (status) {
      case "ready":
        return "success";
      case "processing":
        return "warning";
      case "uploading":
        return "default";
      case "processing_failed":
        return "danger";
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

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className={`${styles.sortHeader} ${sortField === field ? styles.active : ""}`}
      onClick={() => handleSort(field)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortField === field && (
        <span className={styles.sortIndicator}>
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
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
          <SortHeader field="name" label="Name" />
        </div>
        <div className={styles.sizeCell}>
          <SortHeader field="fileSizeBytes" label="Size" />
        </div>
        <div className={styles.statusCell}>
          <SortHeader field="status" label="Status" />
        </div>
        <div className={styles.dateCell}>
          <SortHeader field="createdAt" label="Created" />
        </div>
      </div>

      {/* Rows */}
      <div className={styles.body}>
        {/* Folders first */}
        {folders.map((folder) => (
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
        ))}

        {/* Files */}
        {files.map((file) => {
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
        })}
      </div>
    </div>
  );
}
