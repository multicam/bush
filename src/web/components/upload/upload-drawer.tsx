/**
 * Bush Platform - Upload Drawer Component
 *
 * A bottom-positioned drawer that displays upload progress with auto-show/hide behavior.
 * Wraps the upload queue with drawer positioning and collapsed state support.
 *
 * Reference: specs/21-design-components.md - Upload Drawer
 */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown, X, Upload, GripHorizontal } from "lucide-react";
import { cn } from "@/web/lib/utils";
import { Button, Badge } from "@/web/components/ui";
import { UploadQueue, QueuedFile } from "./upload-queue";
import { UploadProgress } from "@/web/lib/upload-client";

export interface UploadDrawerProps {
  /** Files in the upload queue */
  files: QueuedFile[];
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
  /** Delay before auto-dismissing after completion (ms) */
  autoDismissDelay?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Calculate upload statistics from files
 */
function useUploadStats(files: QueuedFile[]) {
  return useMemo(() => {
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
}

/**
 * Format upload speed to human readable
 */
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  if (bytesPerSecond < 1024 * 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
}

/**
 * Get a unique generation ID from files array
 */
function getFilesGeneration(files: QueuedFile[]): string {
  return files.map((f) => f.id).sort().join(",");
}

/**
 * Upload Drawer Component
 *
 * A bottom-positioned drawer with collapsed/expanded states for upload progress.
 */
export function UploadDrawer({
  files,
  projectId,
  folderId,
  onUploadStart,
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
  autoDismissDelay = 3000,
  className,
}: UploadDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissedGeneration, setDismissedGeneration] = useState<string | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasActiveRef = useRef(false);

  const stats = useUploadStats(files);
  const hasFiles = files.length > 0;
  const isActive = stats.activeCount > 0;
  const isComplete = hasFiles && stats.activeCount === 0;
  const currentGeneration = useMemo(() => getFilesGeneration(files), [files]);

  // Derive visibility - show if we have files and they're not the dismissed generation
  const isVisible = hasFiles && currentGeneration !== dismissedGeneration;

  // Track active state for clearing timers
  useEffect(() => {
    if (isActive) {
      wasActiveRef.current = true;
      // Clear any pending auto-dismiss timer
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    }
  }, [isActive]);

  // Auto-dismiss after all uploads complete
  useEffect(() => {
    if (wasActiveRef.current && isComplete && !isActive && !autoDismissTimerRef.current) {
      autoDismissTimerRef.current = setTimeout(() => {
        setIsAnimatingOut(true);
        setTimeout(() => {
          setDismissedGeneration(currentGeneration);
          setIsAnimatingOut(false);
          wasActiveRef.current = false;
        }, 200); // Match fadeOut duration
      }, autoDismissDelay);
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }, [isComplete, isActive, autoDismissDelay, currentGeneration]);

  // Handle keyboard shortcut (Cmd+Shift+U)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        if (isVisible) {
          setIsExpanded((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setDismissedGeneration(currentGeneration);
      setIsAnimatingOut(false);
    }, 200);
  }, [currentGeneration]);

  if (!isVisible && !isAnimatingOut) return null;

  const content = (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-upload-drawer",
        "bg-surface-2 border-t border-border-default",
        "transition-all duration-normal",
        isAnimatingOut ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        className
      )}
      role="region"
      aria-label="Upload progress"
    >
      {/* Collapsed bar - always visible */}
      <div
        className={cn(
          "flex items-center gap-4 px-4 py-2 cursor-pointer select-none",
          "border-b border-border-default transition-colors",
          "hover:bg-surface-3"
        )}
        onClick={handleToggle}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center w-6 h-6 text-muted">
          <GripHorizontal className="w-5 h-5" />
        </div>

        {/* Icon and title */}
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-muted" />
          <span className="text-sm font-medium text-primary">
            {isActive ? "Uploading" : "Uploads"}
          </span>
        </div>

        {/* Status badge */}
        <Badge variant={isActive ? "primary" : stats.failed > 0 ? "error" : "success"} size="sm">
          {stats.activeCount > 0
            ? `${stats.activeCount} active`
            : stats.failed > 0
              ? `${stats.failed} failed`
              : `${stats.total} complete`}
        </Badge>

        {/* Overall progress bar (when active) */}
        {isActive && (
          <div className="flex-1 flex items-center gap-3 max-w-md">
            <div className="flex-1 h-[2px] bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-200"
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
            <span className="text-xs text-muted whitespace-nowrap min-w-[80px]">
              {stats.overallProgress.toFixed(0)}%
              {stats.totalSpeed > 0 && ` • ${formatSpeed(stats.totalSpeed)}`}
            </span>
          </div>
        )}

        {/* Spacer */}
        {!isActive && <div className="flex-1" />}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isComplete && onClearCompleted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClearCompleted();
              }}
            >
              Clear
            </Button>
          )}
          <button
            className={cn(
              "flex items-center justify-center w-6 h-6",
              "text-muted hover:text-primary transition-colors"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            aria-label="Dismiss upload drawer"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            className={cn(
              "flex items-center justify-center w-6 h-6",
              "text-muted hover:text-primary transition-colors"
            )}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="max-h-[40vh] overflow-hidden">
          <UploadQueue
            files={files}
            projectId={projectId}
            folderId={folderId}
            onUploadStart={onUploadStart}
            onProgress={onProgress}
            onUploadComplete={onUploadComplete}
            onUploadError={onUploadError}
            onRemove={onRemove}
            onRetry={onRetry}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
            onRetryAll={onRetryAll}
            onCancelAll={onCancelAll}
            onClearCompleted={onClearCompleted}
            maxHeight="calc(40vh - 48px)"
          />
        </div>
      )}
    </div>
  );

  // Render in portal
  const container = typeof document !== "undefined" ? document.body : null;
  return container ? createPortal(content, container) : null;
}

export default UploadDrawer;
