/**
 * Bush Platform - Version Stack Compare Component
 *
 * Side-by-side comparison view for two versions in a stack.
 * Supports linked playback for videos and linked zoom/pan for images.
 *
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 * Reference: specs/00-atomic-features.md Section 9.7 Comparison Viewer
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Badge } from "@/web/components/ui";
import { ImageViewer, VideoViewer } from "@/web/components/viewers";
import type { VideoViewerHandle } from "@/web/components/viewers/video-viewer";
import type { ImageViewerHandle } from "@/web/components/viewers/image-viewer";
import { getFileCategory, formatFileSize } from "@/shared/file-types";
import { filesApi, extractAttributes, getErrorMessage } from "@/web/lib/api";
import { useLinkedPlayback } from "@/web/hooks/use-linked-playback";
import { useLinkedZoom } from "@/web/hooks/use-linked-zoom";
import type { AssetFile } from "@/web/components/asset-browser";
import type { VersionStackCompareProps } from "./types";
import type { FileAttributes } from "@/web/lib/api";
import styles from "./version-stack.module.css";

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
      string | null
    ];
  }, [files]);

  // Check if both files are the same category for syncing
  const canSyncPlayback = categories[0] === "video" && categories[1] === "video";
  const canSyncZoom = categories[0] === "image" && categories[1] === "image";

  // Determine if sync is currently active
  const isSyncActive = (canSyncPlayback && linkedPlayback.isSynced) || (canSyncZoom && linkedZoom.isSynced);

  // Load file data
  useEffect(() => {
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
            } catch (err) {
              console.error(`Failed to load file ${fileId}:`, err);
            }
          })
        );

        setFiles(loadedFiles);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }

    loadFiles();
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
      <div className={styles.compareLoading}>
        <div className={styles.spinner} />
        <p>Loading comparison...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.compareError}>
        <p>{error}</p>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  // Render viewer based on file type
  const renderViewer = (file: FileWithUrl | null, side: "left" | "right") => {
    if (!file) {
      return (
        <div className={styles.comparePlaceholder}>
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
          className={styles.compareViewer}
        />
      );
    }

    if (category === "video") {
      return (
        <VideoViewer
          ref={side === "left" ? linkedPlayback.primaryRef : linkedPlayback.secondaryRef}
          src={src}
          className={styles.compareViewer}
        />
      );
    }

    // Fallback for other types
    return (
      <div className={styles.compareFallback}>
        <p>{file.name}</p>
        <p className={styles.compareMeta}>
          {formatFileSize(file.fileSizeBytes)} &middot; {file.mimeType}
        </p>
        <p className={styles.compareNote}>Preview not available for this file type</p>
      </div>
    );
  };

  const leftFile = files[0];
  const rightFile = files[1];

  return (
    <div className={styles.compareContainer}>
      {/* Header */}
      <div className={styles.compareHeader}>
        <h3>Compare Versions</h3>
        <div className={styles.compareActions}>
          {/* Sync toggle - only show for same-type comparisons */}
          {(canSyncPlayback || canSyncZoom) && (
            <Button
              variant={isSyncActive ? "primary" : "secondary"}
              size="sm"
              onClick={handleToggleSync}
              title={isSyncActive ? "Unsync controls (Y)" : "Sync controls (Y)"}
            >
              {isSyncActive ? "🔗 Synced" : "Sync"}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onSwap}>
            Swap (S)
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close (Esc)
          </Button>
        </div>
      </div>

      {/* Sync indicator bar */}
      {isSyncActive && (
        <div className={styles.syncIndicator}>
          <span className={styles.syncIcon}>🔗</span>
          <span>
            {canSyncPlayback
              ? "Linked playback: Play, pause, and seek are synchronized"
              : "Linked zoom: Zoom and pan are synchronized"}
          </span>
        </div>
      )}

      {/* Comparison panels */}
      <div className={styles.comparePanels}>
        {/* Left panel */}
        <div className={styles.comparePanel}>
          <div className={styles.comparePanelHeader}>
            <Badge variant="default">Version A</Badge>
            {leftFile && (
              <span className={styles.compareFileName} title={leftFile.name}>
                {leftFile.name}
              </span>
            )}
          </div>
          <div className={styles.comparePanelContent}>{renderViewer(leftFile, "left")}</div>
          {leftFile && (
            <div className={styles.comparePanelFooter}>
              <span>{formatFileSize(leftFile.fileSizeBytes)}</span>
              <span>{new Date(leftFile.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.compareDivider}>
          <div className={styles.compareDividerLine} />
        </div>

        {/* Right panel */}
        <div className={styles.comparePanel}>
          <div className={styles.comparePanelHeader}>
            <Badge variant="default">Version B</Badge>
            {rightFile && (
              <span className={styles.compareFileName} title={rightFile.name}>
                {rightFile.name}
              </span>
            )}
          </div>
          <div className={styles.comparePanelContent}>{renderViewer(rightFile, "right")}</div>
          {rightFile && (
            <div className={styles.comparePanelFooter}>
              <span>{formatFileSize(rightFile.fileSizeBytes)}</span>
              <span>{new Date(rightFile.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className={styles.compareHint}>
        S: swap versions
        {(canSyncPlayback || canSyncZoom) && " · Y: toggle sync"} · Esc: close
      </div>
    </div>
  );
}
