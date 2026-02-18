/**
 * Bush Platform - Thumbnail Control Component
 *
 * UI for setting custom thumbnails on video/image assets.
 * Supports frame capture from videos and image upload.
 */
"use client";

import { useState, useRef } from "react";
import { filesApi } from "../../lib/api";
import styles from "./thumbnail-control.module.css";

export interface ThumbnailControlProps {
  /** Project ID */
  projectId: string;
  /** File ID */
  fileId: string;
  /** File MIME type */
  mimeType: string;
  /** Current video time (for frame capture) */
  currentTime?: number;
  /** Video duration (for validation) */
  duration?: number;
  /** Whether a custom thumbnail is set */
  hasCustomThumbnail?: boolean;
  /** Callback when thumbnail is updated */
  onThumbnailUpdate?: () => void;
  /** Callback when modal should close */
  onClose?: () => void;
}

export function ThumbnailControl({
  projectId,
  fileId,
  mimeType,
  currentTime = 0,
  duration = 0,
  hasCustomThumbnail = false,
  onThumbnailUpdate,
  onClose,
}: ThumbnailControlProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideo = mimeType.startsWith("video/");
  const isImage = mimeType.startsWith("image/");

  const handleCaptureFrame = async () => {
    if (!isVideo) {
      setError("Frame capture is only available for video files");
      return;
    }

    setIsCapturing(true);
    setError(null);
    setSuccess(null);

    try {
      await filesApi.captureFrameAsThumbnail(projectId, fileId, currentTime);
      setSuccess(`Frame captured at ${formatTime(currentTime)}`);
      onThumbnailUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture frame");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image file must be smaller than 10MB");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          setError("Failed to read file");
          setIsUploading(false);
          return;
        }

        try {
          await filesApi.uploadThumbnail(projectId, fileId, dataUrl);
          setSuccess("Custom thumbnail uploaded");
          onThumbnailUpdate?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to upload thumbnail");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
      setIsUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveThumbnail = async () => {
    if (!hasCustomThumbnail) return;

    setIsRemoving(true);
    setError(null);
    setSuccess(null);

    try {
      await filesApi.removeThumbnail(projectId, fileId);
      setSuccess("Custom thumbnail removed");
      onThumbnailUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove thumbnail");
    } finally {
      setIsRemoving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Set Thumbnail</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.options}>
        {isVideo && (
          <div className={styles.option}>
            <button
              className={styles.actionButton}
              onClick={handleCaptureFrame}
              disabled={isCapturing || isUploading || isRemoving}
            >
              {isCapturing ? (
                <>
                  <span className={styles.spinner} />
                  Capturing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                  Capture Current Frame
                </>
              )}
            </button>
            <p className={styles.hint}>
              Capture frame at {formatTime(currentTime)}
            </p>
          </div>
        )}

        <div className={styles.option}>
          <button
            className={styles.actionButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={isCapturing || isUploading || isRemoving}
          >
            {isUploading ? (
              <>
                <span className={styles.spinner} />
                Uploading...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
                Upload Image
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className={styles.fileInput}
          />
          <p className={styles.hint}>JPG, PNG, or WebP (max 10MB)</p>
        </div>

        {hasCustomThumbnail && (
          <div className={styles.option}>
            <button
              className={`${styles.actionButton} ${styles.danger}`}
              onClick={handleRemoveThumbnail}
              disabled={isCapturing || isUploading || isRemoving}
            >
              {isRemoving ? (
                <>
                  <span className={styles.spinner} />
                  Removing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                  Remove Custom Thumbnail
                </>
              )}
            </button>
            <p className={styles.hint}>Revert to auto-generated thumbnail</p>
          </div>
        )}
      </div>
    </div>
  );
}
