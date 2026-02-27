/**
 * Bush Platform - Thumbnail Control Component
 *
 * UI for setting custom thumbnails on video/image assets.
 * Supports frame capture from videos and image upload.
 */
"use client";

import { useState, useRef } from "react";
import { X, Play, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { filesApi } from "../../lib/api";

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
  duration: _duration = 0,
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
  const _isImage = mimeType.startsWith("image/");

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
    <div className="bg-surface-2 rounded-md p-4 min-w-[280px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-base font-semibold text-primary">Set Thumbnail</h3>
        {onClose && (
          <button
            className="bg-transparent border-none text-secondary cursor-pointer p-1 flex items-center justify-center rounded-sm transition-colors hover:bg-surface-3 hover:text-primary"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-[rgba(239,68,68,0.2)] text-[#ef4444] px-3 py-2 rounded-sm text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-[rgba(34,197,94,0.2)] text-[#22c55e] px-3 py-2 rounded-sm text-sm mb-4">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {isVideo && (
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-3 border border-border-default rounded-sm text-primary text-sm font-medium cursor-pointer transition-colors hover:bg-surface-4 hover:border-border-hover disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleCaptureFrame}
              disabled={isCapturing || isUploading || isRemoving}
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-[18px] h-[18px] animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Play className="w-[18px] h-[18px]" />
                  Capture Current Frame
                </>
              )}
            </button>
            <p className="m-0 text-xs text-secondary text-center">
              Capture frame at {formatTime(currentTime)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <button
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-3 border border-border-default rounded-sm text-primary text-sm font-medium cursor-pointer transition-colors hover:bg-surface-4 hover:border-border-hover disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCapturing || isUploading || isRemoving}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-[18px] h-[18px] animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <ImagePlus className="w-[18px] h-[18px]" />
                Upload Image
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="m-0 text-xs text-secondary text-center">JPG, PNG, or WebP (max 10MB)</p>
        </div>

        {hasCustomThumbnail && (
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-3 border border-[rgba(239,68,68,0.3)] rounded-sm text-[#ef4444] text-sm font-medium cursor-pointer transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:border-[#ef4444] disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleRemoveThumbnail}
              disabled={isCapturing || isUploading || isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-[18px] h-[18px] animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="w-[18px] h-[18px]" />
                  Remove Custom Thumbnail
                </>
              )}
            </button>
            <p className="m-0 text-xs text-secondary text-center">Revert to auto-generated thumbnail</p>
          </div>
        )}
      </div>
    </div>
  );
}
