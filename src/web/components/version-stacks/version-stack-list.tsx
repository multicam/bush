/**
 * Bush Platform - Version Stack List Component
 *
 * Displays a list of versions within a stack with thumbnails.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge, Button } from "@/web/components/ui";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import { versionStacksApi, extractAttributes, getErrorMessage } from "@/web/lib/api";
import type { AssetFile } from "@/web/components/asset-browser";
import type { VersionStackListProps, VersionStackWithFiles } from "./types";
import styles from "./version-stack.module.css";

export function VersionStackList({
  stackId,
  currentFileId,
  onVersionSelect,
  onVersionRemove,
  onSetCurrent,
  showActions = true,
  isLoading: externalLoading,
}: VersionStackListProps) {
  const [stack, setStack] = useState<VersionStackWithFiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load stack data
  const loadStack = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await versionStacksApi.get(stackId);
      const stackData = extractAttributes(response) as VersionStackWithFiles;

      // Extract included files
      const files: AssetFile[] = response.included.map((file) => ({
        id: file.id,
        name: file.attributes.name,
        mimeType: file.attributes.mimeType,
        fileSizeBytes: file.attributes.fileSizeBytes,
        status: file.attributes.status,
        thumbnailUrl: null, // Would come from relationships in full implementation
        createdAt: file.attributes.createdAt,
        updatedAt: file.attributes.updatedAt,
      }));

      // Find current file
      const currentFile = files.find((f) => f.id === stackData.currentFileId) || null;

      setStack({
        ...stackData,
        files,
        currentFile,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [stackId]);

  useEffect(() => {
    loadStack();
  }, [loadStack]);

  const handleSetCurrent = useCallback(
    async (fileId: string) => {
      try {
        await versionStacksApi.setCurrent(stackId, fileId);
        onSetCurrent?.(fileId);
        await loadStack(); // Refresh
      } catch (err) {
        console.error("Failed to set current version:", err);
      }
    },
    [stackId, onSetCurrent, loadStack]
  );

  const handleRemove = useCallback(
    async (fileId: string) => {
      try {
        await versionStacksApi.removeFile(stackId, fileId);
        onVersionRemove?.(fileId);
        await loadStack(); // Refresh
      } catch (err) {
        console.error("Failed to remove version:", err);
      }
    },
    [stackId, onVersionRemove, loadStack]
  );

  // Loading state
  if (isLoading || externalLoading) {
    return (
      <div className={styles.listLoading}>
        <div className={styles.spinner} />
        <p>Loading versions...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.listError}>
        <p>{error}</p>
        <Button variant="secondary" size="sm" onClick={loadStack}>
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (!stack || stack.files.length === 0) {
    return (
      <div className={styles.listEmpty}>
        <p>No versions in this stack</p>
      </div>
    );
  }

  // Sort files by creation date (newest first)
  const sortedFiles = [...stack.files].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className={styles.versionList}>
      {/* Header */}
      <div className={styles.listHeader}>
        <h3 className={styles.stackName}>{stack.name}</h3>
        <Badge variant="default" size="sm">
          {stack.files.length} version{stack.files.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Version items */}
      <ul className={styles.versionItems} role="listbox">
        {sortedFiles.map((file, index) => {
          const isCurrent = file.id === (currentFileId || stack.currentFileId);
          const category = getFileCategory(file.mimeType);
          const versionNumber = sortedFiles.length - index; // Newest = highest version

          return (
            <li
              key={file.id}
              className={`${styles.versionItem} ${isCurrent ? styles.current : ""}`}
              role="option"
              aria-selected={isCurrent}
              onClick={() => onVersionSelect?.(file.id)}
            >
              {/* Thumbnail */}
              <div className={styles.versionThumbnail} data-category={category}>
                {file.thumbnailUrl ? (
                  <img src={file.thumbnailUrl} alt={file.name} loading="lazy" />
                ) : (
                  <span className={styles.versionIcon}>{getFileIcon(file.mimeType)}</span>
                )}
              </div>

              {/* Info */}
              <div className={styles.versionInfo}>
                <span className={styles.versionName} title={file.name}>
                  {file.name}
                </span>
                <span className={styles.versionMeta}>
                  v{versionNumber} &middot; {formatFileSize(file.fileSizeBytes)} &middot;{" "}
                  {new Date(file.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Current badge */}
              {isCurrent && (
                <Badge variant="success" size="sm">
                  Current
                </Badge>
              )}

              {/* Actions */}
              {showActions && (
                <div className={styles.versionActions}>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCurrent(file.id);
                      }}
                      title="Set as current version"
                    >
                      Set Current
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(file.id);
                    }}
                    title="Remove from stack"
                  >
                    Remove
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
