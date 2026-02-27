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
import { X } from "lucide-react";
import type { CreateVersionStackModalProps } from "./types";

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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-surface-1 rounded-md w-full max-w-[480px] max-h-[90vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 id="modal-title" className="m-0 text-lg font-semibold text-primary">
            Create Version Stack
          </h2>
          <button
            className="bg-none border-none text-2xl text-secondary cursor-pointer p-1 leading-none hover:text-primary transition-colors"
            onClick={handleClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Name input */}
          <div className="flex flex-col gap-2 mb-4">
            <label htmlFor="stack-name" className="text-sm font-medium text-primary">
              Stack Name
            </label>
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Files to Stack ({files.length})
            </label>
            <ul className="list-none m-0 p-0 border border-border-default rounded-sm max-h-[200px] overflow-y-auto">
              {files.map((file, index) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 px-3 py-2 border-b border-border-default last:border-b-0"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-surface-2 rounded-full text-xs font-medium text-secondary">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-xs text-secondary">
                    {formatFileSize(file.fileSizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-sm text-red-600 text-sm mb-4">
              <p className="m-0">{error}</p>
            </div>
          )}

          {/* Info message */}
          <p className="text-sm text-secondary m-0">
            The newest file will be set as the current version. You can change this later.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-default">
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
