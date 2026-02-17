/**
 * Bush Platform - Add to Stack Modal Component
 *
 * Modal for adding a file to an existing version stack.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useState, useCallback } from "react";
import { Button, Input } from "@/web/components/ui";
import { versionStacksApi, getErrorMessage } from "@/web/lib/api";
import type { AddToStackModalProps } from "./types";
import styles from "./version-stack.module.css";

export function AddToStackModal({
  isOpen,
  file,
  stacks,
  onClose,
  onAddToStack,
  onCreateNewStack,
}: AddToStackModalProps) {
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [newStackName, setNewStackName] = useState("");
  const [mode, setMode] = useState<"select" | "create">("select");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddToStack = useCallback(async () => {
    if (!selectedStackId) {
      setError("Please select a stack");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await versionStacksApi.addFile(selectedStackId, file!.id);
      onAddToStack?.(selectedStackId);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedStackId, file, onAddToStack, onClose]);

  const handleCreateNewStack = useCallback(async () => {
    if (!newStackName.trim()) {
      setError("Please enter a name for the new stack");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      onCreateNewStack?.(newStackName.trim());
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [newStackName, onCreateNewStack, onClose]);

  const handleClose = useCallback(() => {
    setSelectedStackId(null);
    setNewStackName("");
    setMode("select");
    setError(null);
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isOpen || !file) return null;

  return (
    <div
      className={styles.modalBackdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-stack-title"
    >
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="add-to-stack-title">Add to Version Stack</h2>
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
          {/* File info */}
          <div className={styles.fileInfo}>
            <span className={styles.fileInfoLabel}>Adding:</span>
            <span className={styles.fileInfoName} title={file.name}>
              {file.name}
            </span>
          </div>

          {/* Mode tabs */}
          <div className={styles.modeTabs}>
            <button
              className={`${styles.modeTab} ${mode === "select" ? styles.active : ""}`}
              onClick={() => setMode("select")}
            >
              Add to Existing
            </button>
            <button
              className={`${styles.modeTab} ${mode === "create" ? styles.active : ""}`}
              onClick={() => setMode("create")}
            >
              Create New Stack
            </button>
          </div>

          {/* Select existing stack */}
          {mode === "select" && (
            <div className={styles.stacksList}>
              {stacks.length === 0 ? (
                <p className={styles.emptyMessage}>
                  No existing stacks. Create a new stack instead.
                </p>
              ) : (
                stacks.map((stack) => (
                  <button
                    key={stack.id}
                    className={`${styles.stackOption} ${selectedStackId === stack.id ? styles.selected : ""}`}
                    onClick={() => setSelectedStackId(stack.id)}
                  >
                    <span className={styles.stackOptionName}>{stack.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Create new stack */}
          {mode === "create" && (
            <div className={styles.formGroup}>
              <label htmlFor="new-stack-name">Stack Name</label>
              <Input
                id="new-stack-name"
                type="text"
                value={newStackName}
                onChange={(e) => setNewStackName(e.target.value)}
                placeholder="Enter stack name"
                disabled={isLoading}
                autoFocus
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className={styles.modalError}>
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          {mode === "select" ? (
            <Button
              variant="primary"
              onClick={handleAddToStack}
              disabled={isLoading || !selectedStackId}
            >
              {isLoading ? "Adding..." : "Add to Stack"}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleCreateNewStack}
              disabled={isLoading || !newStackName.trim()}
            >
              {isLoading ? "Creating..." : "Create & Add"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
