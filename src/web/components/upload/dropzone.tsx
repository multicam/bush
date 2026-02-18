/**
 * Bush Platform - Dropzone Component
 *
 * Drag-and-drop zone for file uploads with MIME validation.
 * Reference: IMPLEMENTATION_PLAN.md 2.1 [P1] Drag-and-Drop UI
 * Reference: specs/03-file-management.md
 */
"use client";

import { useCallback, useState, useRef, type DragEvent, type ChangeEvent } from "react";
import {
  isSupportedMimeType,
  isSupportedExtension,
  detectMimeType,
  formatFileSize,
  getFileCategory,
  type FileCategory,
} from "@/shared/file-types";
import styles from "./upload.module.css";

export interface DroppedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  category: FileCategory;
  isValid: boolean;
  validationError?: string;
  /** Relative path from folder drop (webkitRelativePath), undefined for single file drops */
  relativePath?: string;
}

export interface DropzoneProps {
  /** Callback when files are dropped or selected */
  onFiles: (files: DroppedFile[]) => void;
  /** Optional folder ID to upload to */
  folderId?: string;
  /** Whether multiple files can be selected */
  multiple?: boolean;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Maximum file size in bytes (default: 5TB = 5 * 1024^4) */
  maxFileSize?: number;
  /** Maximum number of files per drop */
  maxFiles?: number;
  /** Accepted MIME types (default: all supported) */
  accept?: string[];
  /** Custom class name */
  className?: string;
  /** Custom instructions text */
  instructions?: string;
  /** Whether to allow folder drops (enables webkitdirectory) */
  allowFolders?: boolean;
}

const DEFAULT_MAX_FILE_SIZE = 5 * Math.pow(1024, 4); // 5TB

/**
 * Generate unique ID for dropped file
 */
function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate a single file
 */
function validateFile(
  file: File,
  maxFileSize: number
): { valid: boolean; error?: string; mimeType: string } {
  // Try to detect MIME type from extension if not provided
  const mimeType = file.type || detectMimeType(file.name) || "application/octet-stream";

  // Check file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${formatFileSize(maxFileSize)}`,
      mimeType,
    };
  }

  // Check if empty file
  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty",
      mimeType,
    };
  }

  // Check MIME type support (allow unknown types but flag them)
  const isKnownType = isSupportedMimeType(mimeType);
  if (!isKnownType) {
    // Try extension check as fallback
    const ext = file.name.substring(file.name.lastIndexOf("."));
    if (!isSupportedExtension(ext)) {
      return {
        valid: false,
        error: `Unsupported file type: ${mimeType}`,
        mimeType,
      };
    }
  }

  return { valid: true, mimeType };
}

/**
 * Process dropped/selected files
 */
function processFiles(
  files: FileList | File[],
  maxFileSize: number,
  maxFiles: number
): DroppedFile[] {
  const fileArray = Array.from(files);

  // Limit to max files
  const limitedFiles = fileArray.slice(0, maxFiles);

  return limitedFiles.map((file) => {
    const validation = validateFile(file, maxFileSize);
    // Extract webkitRelativePath if available (from folder drops)
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return {
      id: generateFileId(),
      file,
      name: file.name,
      size: file.size,
      mimeType: validation.mimeType,
      category: getFileCategory(validation.mimeType),
      isValid: validation.valid,
      validationError: validation.error,
      relativePath: relativePath || undefined,
    };
  });
}

export function Dropzone({
  onFiles,
  folderId: _folderId,
  multiple = true,
  disabled = false,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = 200,
  accept,
  className = "",
  instructions = "Drag files here or click to browse",
  allowFolders = false,
}: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const dragCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle drag enter
  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Track drag count to handle child element enter/leave
      dragCountRef.current++;
      const _currentCount = dragCountRef.current; // Keep for debugging

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragActive(true);

        // Check if any items are files (not text/HTML being dragged)
        const hasFiles = Array.from(e.dataTransfer.items).some(
          (item) => item.kind === "file"
        );

        // Check for rejected types if accept is specified
        if (accept && hasFiles) {
          const allAccepted = Array.from(e.dataTransfer.items).every((item) => {
            if (item.kind !== "file") return true;
            // We can't fully validate until drop, so just check basic types
            return accept.some((type) => item.type.startsWith(type.split("/")[0]));
          });
          setIsDragReject(!allAccepted);
        } else {
          setIsDragReject(false);
        }
      }
    },
    [disabled, accept]
  );

  // Handle drag leave
  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Decrement and clamp to 0 to prevent negative values from rapid mouse movements
      dragCountRef.current = Math.max(0, dragCountRef.current - 1);

      if (dragCountRef.current === 0) {
        setIsDragActive(false);
        setIsDragReject(false);
      }
    },
    []
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) {
        e.dataTransfer.dropEffect = "none";
      } else {
        e.dataTransfer.dropEffect = isDragReject ? "none" : "copy";
      }
    },
    [disabled, isDragReject]
  );

  // Handle drop
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset drag counter
      dragCountRef.current = 0;
      setIsDragActive(false);
      setIsDragReject(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const processedFiles = processFiles(files, maxFileSize, multiple ? maxFiles : 1);
        onFiles(processedFiles);
      }
    },
    [disabled, maxFileSize, maxFiles, multiple, onFiles]
  );

  // Handle file input change
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;

      const files = e.target.files;
      if (files && files.length > 0) {
        const processedFiles = processFiles(files, maxFileSize, multiple ? maxFiles : 1);
        onFiles(processedFiles);
      }

      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [disabled, maxFileSize, maxFiles, multiple, onFiles]
  );

  // Handle click to open file browser
  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  // Handle keyboard activation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const dropzoneClasses = [
    styles.dropzone,
    isDragActive && styles.active,
    isDragReject && styles.reject,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Build accept string for input
  const inputAccept = accept ? accept.join(",") : undefined;

  return (
    <div
      className={dropzoneClasses}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload files"
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={inputAccept}
        onChange={handleInputChange}
        disabled={disabled}
        className={styles.input}
        aria-hidden="true"
        {...(allowFolders ? { webkitdirectory: "", directory: "" } : {})}
      />

      <div className={styles.content}>
        <div className={styles.icon}>
          {isDragReject ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>

        <p className={styles.instructions}>
          {isDragActive
            ? isDragReject
              ? "Some files are not supported"
              : "Drop to upload"
            : instructions}
        </p>

        {!disabled && (
          <p className={styles.hint}>
            {allowFolders
              ? `Folders supported • Up to ${maxFiles} files, max ${formatFileSize(maxFileSize)} each`
              : multiple
                ? `Up to ${maxFiles} files, max ${formatFileSize(maxFileSize)} each`
                : `Max ${formatFileSize(maxFileSize)}`}
          </p>
        )}
      </div>
    </div>
  );
}

export default Dropzone;
