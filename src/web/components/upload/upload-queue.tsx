/**
 * Bush Platform - Upload Queue Component
 *
 * Displays upload progress with individual file progress bars,
 * pause/resume/cancel controls, and retry functionality.
 *
 * Reference: IMPLEMENTATION_PLAN.md 2.1 [P1] Upload Queue UI
 * Reference: specs/03-file-management.md Bulk Uploads
 */
"use client";

import { useCallback, useMemo } from "react";
import {
  UploadClient,
  UploadProgress,
  UploadStatus,
  getUploadClient,
  formatSpeed,
} from "@/web/lib/upload-client";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import { Button, Badge } from "@/web/components/ui";
import styles from "./upload.module.css";

export interface QueuedFile {
  /** Unique ID for this queued upload */
  id: string;
  /** Original file reference */
  file: File;
  /** Upload progress info */
  progress?: UploadProgress;
  /** Upload error if failed */
  error?: string;
}

export interface UploadQueueProps {
  /** Files in the upload queue */
  files: QueuedFile[];
  /** Upload client instance */
  client?: UploadClient;
  /** Project ID for uploads */
  projectId: string;
  /** Optional folder ID for uploads */
  folderId?: string;
  /** Callback when upload starts */
  onUploadStart?: (fileId: string) => void;
  /** Callback on progress update */
  onProgress?: (fileId: string, progress: UploadProgress) => void;
  /** Callback when upload completes */
  onUploadComplete?: (fileId: string, result: { fileId: string }) => void;
  /** Callback when upload fails */
  onUploadError?: (fileId: string, error: Error) => void;
  /** Callback to remove file from queue */
  onRemove?: (fileId: string) => void;
  /** Callback to retry failed upload */
  onRetry?: (fileId: string) => void;
  /** Callback to pause upload */
  onPause?: (fileId: string) => void;
  /** Callback to resume upload */
  onResume?: (fileId: string) => void;
  /** Callback to cancel upload */
  onCancel?: (fileId: string) => void;
  /** Callback to retry all failed uploads */
  onRetryAll?: () => void;
  /** Callback to cancel all uploads */
  onCancelAll?: () => void;
  /** Callback to clear completed/failed uploads */
  onClearCompleted?: () => void;
  /** Whether the queue is collapsible */
  collapsible?: boolean;
  /** Whether the queue starts collapsed */
  defaultCollapsed?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: string;
}

/**
 * Get status badge variant based on upload status
 */
function getStatusVariant(status: UploadStatus): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "paused":
      return "warning";
    default:
      return "default";
  }
}

/**
 * Get status label for display
 */
function getStatusLabel(status: UploadStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "uploading":
      return "Uploading";
    case "paused":
      return "Paused";
    case "completed":
      return "Complete";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/**
 * Format ETA seconds to human readable
 */
function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "";

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Individual file upload item in the queue
 */
interface UploadItemProps {
  item: QueuedFile;
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  onRemove?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
}

function UploadItem({
  item,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onRetry,
}: UploadItemProps) {
  const { id, file, progress, error } = item;
  const status = progress?.status ?? "pending";
  const percent = progress?.progress ?? 0;
  const uploadSpeed = progress?.uploadSpeed ?? 0;
  const eta = progress?.estimatedTimeRemaining ?? 0;
  const uploadedBytes = progress?.uploadedBytes ?? 0;

  const category = getFileCategory(file.type || "application/octet-stream");

  const handlePause = useCallback(() => {
    onPause?.(id);
  }, [id, onPause]);

  const handleResume = useCallback(() => {
    onResume?.(id);
  }, [id, onResume]);

  const handleCancel = useCallback(() => {
    onCancel?.(id);
  }, [id, onCancel]);

  const handleRemove = useCallback(() => {
    onRemove?.(id);
  }, [id, onRemove]);

  const handleRetry = useCallback(() => {
    onRetry?.(id);
  }, [id, onRetry]);

  const isInProgress = status === "uploading" || status === "pending";
  const isPaused = status === "paused";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";
  const canPause = isInProgress && !isPaused;
  const canResume = isPaused;
  const canCancel = isInProgress || isPaused;
  const canRemove = isCompleted || isFailed || isCancelled;
  const canRetry = isFailed || isCancelled;

  return (
    <div className={styles.queueItem} data-status={status}>
      {/* File info */}
      <div className={styles.itemInfo}>
        <div className={styles.itemIcon} data-category={category}>
          {getFileIcon(file.type)}
        </div>
        <div className={styles.itemDetails}>
          <span className={styles.itemName} title={file.name}>
            {file.name}
          </span>
          <div className={styles.itemMeta}>
            <span className={styles.itemSize}>{formatFileSize(file.size)}</span>
            {isInProgress && uploadSpeed > 0 && (
              <>
                <span className={styles.separator}>•</span>
                <span className={styles.speed}>{formatSpeed(uploadSpeed)}</span>
              </>
            )}
            {isInProgress && eta > 0 && (
              <>
                <span className={styles.separator}>•</span>
                <span className={styles.eta}>{formatETA(eta)} left</span>
              </>
            )}
          </div>
          {error && <div className={styles.itemError}>{error}</div>}
        </div>
        <Badge variant={getStatusVariant(status)} size="sm">
          {getStatusLabel(status)}
        </Badge>
      </div>

      {/* Progress bar */}
      {(isInProgress || isPaused) && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span className={styles.progressText}>
            {percent.toFixed(1)}%
            {uploadedBytes > 0 && ` (${formatFileSize(uploadedBytes)} / ${formatFileSize(file.size)})`}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className={styles.itemActions}>
        {canPause && (
          <Button variant="ghost" size="sm" onClick={handlePause} aria-label="Pause upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </Button>
        )}
        {canResume && (
          <Button variant="ghost" size="sm" onClick={handleResume} aria-label="Resume upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </Button>
        )}
        {canRetry && (
          <Button variant="ghost" size="sm" onClick={handleRetry} aria-label="Retry upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23,4 23,10 17,10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" size="sm" onClick={handleCancel} aria-label="Cancel upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        )}
        {canRemove && (
          <Button variant="ghost" size="sm" onClick={handleRemove} aria-label="Remove from queue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Upload Queue Component
 */
export function UploadQueue({
  files,
  projectId,
  folderId,
  onUploadStart: _onUploadStart,
  onProgress,
  onUploadComplete,
  onUploadError,
  onRemove,
  onRetry,
  onPause,
  onResume,
  onCancel,
  onRetryAll,
  onCancelAll,
  onClearCompleted,
  maxHeight = "400px",
}: UploadQueueProps) {
  // Calculate queue statistics
  const stats = useMemo(() => {
    let pending = 0;
    let uploading = 0;
    let paused = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    let totalBytes = 0;
    let uploadedBytes = 0;
    let totalSpeed = 0;

    for (const file of files) {
      const status = file.progress?.status ?? "pending";
      switch (status) {
        case "pending":
          pending++;
          break;
        case "uploading":
          uploading++;
          totalSpeed += file.progress?.uploadSpeed ?? 0;
          break;
        case "paused":
          paused++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "cancelled":
          cancelled++;
          break;
      }
      totalBytes += file.file.size;
      uploadedBytes += file.progress?.uploadedBytes ?? 0;
    }

    const overallProgress = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
    const activeCount = pending + uploading + paused;

    return {
      pending,
      uploading,
      paused,
      completed,
      failed,
      cancelled,
      total: files.length,
      activeCount,
      totalBytes,
      uploadedBytes,
      overallProgress,
      totalSpeed,
    };
  }, [files]);

  // Handle pause for a single upload
  const handlePause = useCallback(
    async (fileId: string) => {
      const client = getUploadClient();
      await client.pause(fileId);
      onPause?.(fileId);
    },
    [onPause]
  );

  // Handle resume for a single upload
  const handleResume = useCallback(
    async (fileId: string) => {
      const client = getUploadClient();
      const queuedFile = files.find((f) => f.id === fileId);
      if (!queuedFile) return;

      onResume?.(fileId);
      await client.resume(fileId, queuedFile.file, {
        projectId,
        folderId,
        onProgress: (progress) => onProgress?.(fileId, progress),
        onComplete: (result) => onUploadComplete?.(fileId, { fileId: result.fileId }),
        onError: (error) => onUploadError?.(fileId, error),
      });
    },
    [files, projectId, folderId, onResume, onProgress, onUploadComplete, onUploadError]
  );

  // Handle cancel for a single upload
  const handleCancel = useCallback(
    async (fileId: string) => {
      const client = getUploadClient();
      await client.cancel(fileId);
      onCancel?.(fileId);
    },
    [onCancel]
  );

  // Handle retry for a single upload
  const handleRetry = useCallback(
    async (fileId: string) => {
      const queuedFile = files.find((f) => f.id === fileId);
      if (!queuedFile) return;

      onRetry?.(fileId);
      const client = getUploadClient();
      await client.upload(queuedFile.file, {
        projectId,
        folderId,
        onProgress: (progress) => onProgress?.(fileId, progress),
        onComplete: (result) => onUploadComplete?.(fileId, { fileId: result.fileId }),
        onError: (error) => onUploadError?.(fileId, error),
      });
    },
    [files, projectId, folderId, onRetry, onProgress, onUploadComplete, onUploadError]
  );

  // Handle retry all failed
  const handleRetryAll = useCallback(() => {
    onRetryAll?.();
  }, [onRetryAll]);

  // Handle cancel all
  const handleCancelAll = useCallback(() => {
    onCancelAll?.();
  }, [onCancelAll]);

  // Handle clear completed
  const handleClearCompleted = useCallback(() => {
    onClearCompleted?.();
  }, [onClearCompleted]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={styles.queue}>
      {/* Queue header */}
      <div className={styles.queueHeader}>
        <div className={styles.queueTitle}>
          <h3>Upload Queue</h3>
          <Badge variant="default" size="sm">
            {stats.activeCount} of {stats.total}
          </Badge>
        </div>

        {/* Overall progress */}
        {stats.activeCount > 0 && (
          <div className={styles.overallProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {stats.overallProgress.toFixed(0)}%
              {stats.totalSpeed > 0 && ` • ${formatSpeed(stats.totalSpeed)}`}
            </span>
          </div>
        )}

        {/* Queue actions */}
        <div className={styles.queueActions}>
          {stats.failed > 0 && (
            <Button variant="secondary" size="sm" onClick={handleRetryAll}>
              Retry All ({stats.failed})
            </Button>
          )}
          {stats.activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleCancelAll}>
              Cancel All
            </Button>
          )}
          {stats.completed + stats.failed + stats.cancelled > 0 && stats.activeCount === 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
              Clear Completed
            </Button>
          )}
        </div>
      </div>

      {/* Queue items */}
      <div className={styles.queueItems} style={{ maxHeight }}>
        {files.map((file) => (
          <UploadItem
            key={file.id}
            item={file}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onRemove={onRemove}
            onRetry={handleRetry}
          />
        ))}
      </div>
    </div>
  );
}

export default UploadQueue;
