/**
 * Bush Platform - Create Version Stack Modal Component
 *
 * Modal for creating a new version stack from selected files.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useState, useCallback } from "react";
import { Button, Input } from "@/web/components/ui";
import { formatFileSize } from "@/shared/file-types";
import { versionStacksApi, getErrorMessage } from "@/web/lib/api";
import type { CreateVersionStackModalProps } from "./types";
import styles from "./version-stack.module.css";

export function CreateVersionStackModal({
  isOpen,
  files,
  projectId,
  onClose,
  onSuccess,
}: CreateVersionStackModalProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate default name from files
  const generateDefaultName = useCallback(() => {
    if (files.length === 0) return "";
    // Use common prefix from file names
    const names = files.map((f) => f.name.replace(/\.[^.]+$/, ""));
    if (names.length === 1) return `${names[0]} Stack`;

    // Find common prefix
    let prefix = names[0];
    for (const name of names.slice(1)) {
      while (!name.startsWith(prefix) && prefix.length > 0) {
        prefix = prefix.slice(0, -1);
      }
    }
    prefix = prefix.trim();
    return prefix ? `${prefix} Stack` : "New Version Stack";
  }, [files]);

  // Initialize name when modal opens
  useState(() => {
    if (isOpen && !name) {
      setName(generateDefaultName());
    }
  });

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError("Please enter a name for the stack");
      return;
    }

    if (files.length < 2) {
      setError("At least 2 files are required to create a stack");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const response = await versionStacksApi.stackFiles({
        project_id: projectId,
        name: name.trim(),
        file_ids: files.map((f) => f.id),
      });

      const stackId = response.data.id;
      onSuccess?.(stackId);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  }, [name, files, projectId, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    setName("");
    setError(null);
    onClose();
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter" && !isCreating) {
        handleCreate();
      }
    },
    [handleClose, handleCreate, isCreating]
  );

  if (!isOpen) return null;

  return (
    <div
      className={styles.modalBackdrop}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="modal-title">Create Version Stack</h2>
          <button
            className={styles.modalClose}
            onClick={handleClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Name input */}
          <div className={styles.formGroup}>
            <label htmlFor="stack-name">Stack Name</label>
            <Input
              id="stack-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter stack name"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Files list */}
          <div className={styles.filesSection}>
            <label>
              Files to Stack ({files.length})
            </label>
            <ul className={styles.filesList}>
              {files.map((file, index) => (
                <li key={file.id} className={styles.filesListItem}>
                  <span className={styles.filesListIndex}>{index + 1}</span>
                  <span className={styles.filesListName} title={file.name}>
                    {file.name}
                  </span>
                  <span className={styles.filesListSize}>
                    {formatFileSize(file.fileSizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Error message */}
          {error && (
            <div className={styles.modalError}>
              <p>{error}</p>
            </div>
          )}

          {/* Info message */}
          <p className={styles.modalInfo}>
            The newest file will be set as the current version. You can change this later.
          </p>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || files.length < 2}
          >
            {isCreating ? "Creating..." : "Create Stack"}
          </Button>
        </div>
      </div>
    </div>
  );
}
