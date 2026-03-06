/**
 * Bush Platform - Version Stack Compare Component
 *
 * Side-by-side comparison view for two versions in a stack.
 * Supports linked playback for videos and linked zoom/pan for images.
 *
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 * Reference: specs/00-product-reference.md Section 9.7 Comparison Viewer
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Badge } from "@/web/components/ui";
import { ImageViewer, VideoViewer } from "@/web/components/viewers";
import { getFileCategory, formatFileSize } from "@/shared/file-types";
import { filesApi, extractAttributes, getErrorMessage } from "@/web/lib/api";
import { useLinkedPlayback } from "@/web/hooks/use-linked-playback";
import { useLinkedZoom } from "@/web/hooks/use-linked-zoom";
import { SpinnerIcon, LinkIcon, ArrowsRightLeftIcon, XMarkIcon } from "@/web/lib/icons";
import type { AssetFile } from "@/web/components/asset-browser";
import type { VersionStackCompareProps } from "./types";
import type { FileAttributes } from "@/web/lib/api";

interface FileWithUrl extends AssetFile {
  downloadUrl?: string;
}

export function VersionStackCompare({
  projectId,
  fileIds,
  onClose,
  onSwap,
}: VersionStackCompareProps) {
  const [files, setFiles] = useState<[FileWithUrl | null, FileWithUrl | null]>([null, null]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Linked controls hooks
  const linkedPlayback = useLinkedPlayback({ enabled: true });
  const linkedZoom = useLinkedZoom({ enabled: true });

  // Determine file categories
  const categories = useMemo(() => {
    return files.map((file) => (file ? getFileCategory(file.mimeType) : null)) as [
      string | null,
      string | null,
    ];
  }, [files]);

  // Check if both files are the same category for syncing
  const canSyncPlayback = categories[0] === "video" && categories[1] === "video";
  const canSyncZoom = categories[0] === "image" && categories[1] === "image";

  // Determine if sync is currently active
  const isSyncActive =
    (canSyncPlayback && linkedPlayback.isSynced) || (canSyncZoom && linkedZoom.isSynced);

  // Load file data
  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        setIsLoading(true);
        setError(null);

        const loadedFiles: [FileWithUrl | null, FileWithUrl | null] = [null, null];

        await Promise.all(
          fileIds.map(async (fileId, index) => {
            try {
              // Get file details
              const response = await filesApi.get(projectId, fileId);
              const fileData = extractAttributes(response) as FileAttributes & { id: string };

              // Get download URL
              let downloadUrl: string | undefined;
              try {
                const downloadResponse = await filesApi.getDownloadUrl(projectId, fileId);
                downloadUrl = downloadResponse.meta.download_url;
              } catch {
                // Download URL might not be available yet
              }

              if (!cancelled) {
                loadedFiles[index] = {
                  id: fileData.id,
                  name: fileData.name,
                  mimeType: fileData.mimeType,
                  fileSizeBytes: fileData.fileSizeBytes,
                  status: fileData.status,
                  thumbnailUrl: null,
                  createdAt: fileData.createdAt,
                  updatedAt: fileData.updatedAt,
                  downloadUrl,
                };
              }
            } catch (err) {
              console.error(`Failed to load file ${fileId}:`, err);
            }
          })
        );

        if (!cancelled) {
          setFiles(loadedFiles);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [projectId, fileIds]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "s" || e.key === "S") {
        onSwap?.();
      } else if (e.key === "y" || e.key === "Y") {
        // Toggle sync
        if (canSyncPlayback) {
          linkedPlayback.toggleSync();
        } else if (canSyncZoom) {
          linkedZoom.toggleSync();
        }
      }
    },
    [onClose, onSwap, canSyncPlayback, canSyncZoom, linkedPlayback, linkedZoom]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Toggle sync based on file type
  const handleToggleSync = useCallback(() => {
    if (canSyncPlayback) {
      linkedPlayback.toggleSync();
    } else if (canSyncZoom) {
      linkedZoom.toggleSync();
    }
  }, [canSyncPlayback, canSyncZoom, linkedPlayback, linkedZoom]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full p-8">
        <SpinnerIcon className="w-6 h-6 text-accent" />
        <p>Loading comparison...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full p-8">
        <p className="text-red-500">{error}</p>
        <Button outline onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  // Render viewer based on file type
  const renderViewer = (file: FileWithUrl | null, side: "left" | "right") => {
    if (!file) {
      return (
        <div className="flex items-center justify-center text-secondary">
          <p>No file selected</p>
        </div>
      );
    }

    const category = getFileCategory(file.mimeType);
    const src = file.downloadUrl || "";

    if (category === "image") {
      return (
        <ImageViewer
          ref={side === "left" ? linkedZoom.primaryRef : linkedZoom.secondaryRef}
          src={src}
          alt={file.name}
          className="max-w-full max-h-full"
        />
      );
    }

    if (category === "video") {
      return (
        <VideoViewer
          ref={side === "left" ? linkedPlayback.primaryRef : linkedPlayback.secondaryRef}
          src={src}
          className="max-w-full max-h-full"
        />
      );
    }

    // Fallback for other types
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-secondary">
        <p className="text-primary">{file.name}</p>
        <p className="text-sm">
          {formatFileSize(file.fileSizeBytes)} &middot; {file.mimeType}
        </p>
        <p className="text-xs opacity-75">Preview not available for this file type</p>
      </div>
    );
  };

  const leftFile = files[0];
  const rightFile = files[1];

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <h3 className="m-0 text-lg font-semibold text-primary">Compare Versions</h3>
        <div className="flex items-center gap-2">
          {/* Sync toggle - only show for same-type comparisons */}
          {(canSyncPlayback || canSyncZoom) &&
            (isSyncActive ? (
              <Button color="bush" onClick={handleToggleSync} title="Unsync controls (Y)">
                <LinkIcon className="w-4 h-4 mr-1" /> Synced
              </Button>
            ) : (
              <Button outline onClick={handleToggleSync} title="Sync controls (Y)">
                Sync
              </Button>
            ))}
          <Button outline onClick={onSwap}>
            <ArrowsRightLeftIcon className="w-4 h-4 mr-1" />
            Swap (S)
          </Button>
          <Button plain onClick={onClose}>
            <XMarkIcon className="w-4 h-4 mr-1" />
            Close (Esc)
          </Button>
        </div>
      </div>

      {/* Sync indicator bar */}
      {isSyncActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-border-default text-sm text-accent">
          <LinkIcon className="w-4 h-4" />
          <span>
            {canSyncPlayback
              ? "Linked playback: Play, pause, and seek are synchronized"
              : "Linked zoom: Zoom and pan are synchronized"}
          </span>
        </div>
      )}

      {/* Comparison panels */}
      <div className="flex-1 flex gap-0 min-h-0">
        {/* Left panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-2 border-b border-border-default">
            <Badge color="zinc">Version A</Badge>
            {leftFile && (
              <span className="flex-1 text-sm truncate" title={leftFile.name}>
                {leftFile.name}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-900 min-h-0">
            {renderViewer(leftFile, "left")}
          </div>
          {leftFile && (
            <div className="flex justify-between px-4 py-2 text-xs text-secondary bg-surface-2 border-t border-border-default">
              <span>{formatFileSize(leftFile.fileSizeBytes)}</span>
              <span>{new Date(leftFile.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-0.5 bg-border-default relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-surface-1 border-2 border-border-default rounded-full" />
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-2 border-b border-border-default">
            <Badge color="zinc">Version B</Badge>
            {rightFile && (
              <span className="flex-1 text-sm truncate" title={rightFile.name}>
                {rightFile.name}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-900 min-h-0">
            {renderViewer(rightFile, "right")}
          </div>
          {rightFile && (
            <div className="flex justify-between px-4 py-2 text-xs text-secondary bg-surface-2 border-t border-border-default">
              <span>{formatFileSize(rightFile.fileSizeBytes)}</span>
              <span>{new Date(rightFile.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="px-4 py-2 bg-surface-2 border-t border-border-default text-xs text-secondary text-center">
        S: swap versions
        {(canSyncPlayback || canSyncZoom) && " · Y: toggle sync"} · Esc: close
      </div>
    </div>
  );
}
