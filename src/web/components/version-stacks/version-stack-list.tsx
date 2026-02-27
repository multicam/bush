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
import { Loader2 } from "lucide-react";
import type { AssetFile } from "@/web/components/asset-browser";
import type { VersionStackListProps, VersionStackWithFiles } from "./types";

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
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-secondary">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <p>Loading versions...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-secondary">
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
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-secondary">
        <p>No versions in this stack</p>
      </div>
    );
  }

  // Sort files by creation date (newest first)
  const sortedFiles = [...stack.files].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-col gap-2 bg-surface-1 rounded-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-default">
        <h3 className="text-base font-semibold m-0 text-primary truncate">{stack.name}</h3>
        <Badge variant="default" size="sm">
          {stack.files.length} version{stack.files.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Version items */}
      <ul className="list-none m-0 p-0 flex flex-col gap-1" role="listbox">
        {sortedFiles.map((file, index) => {
          const isCurrent = file.id === (currentFileId || stack.currentFileId);
          const category = getFileCategory(file.mimeType);
          const versionNumber = sortedFiles.length - index; // Newest = highest version

          return (
            <li
              key={file.id}
              className={`
                flex items-center gap-3 p-2 rounded-sm cursor-pointer transition-colors
                ${isCurrent
                  ? "bg-surface-3 border border-green-500"
                  : "hover:bg-surface-2"
                }
              `}
              role="option"
              aria-selected={isCurrent}
              onClick={() => onVersionSelect?.(file.id)}
            >
              {/* Thumbnail */}
              <div
                className={`
                  w-12 h-12 rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0 bg-surface-2
                  ${category === "video" ? "bg-amber-100" : ""}
                  ${category === "audio" ? "bg-blue-100" : ""}
                  ${category === "image" ? "bg-pink-100" : ""}
                  ${category === "document" ? "bg-indigo-100" : ""}
                `}
              >
                {file.thumbnailUrl ? (
                  <img src={file.thumbnailUrl} alt={file.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">{getFileIcon(file.mimeType)}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-primary truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-xs text-secondary">
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
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity [.list-none>li:hover_&]:opacity-100">
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
