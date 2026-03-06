/**
 * Bush Platform - Create Version Stack Modal Component
 *
 * Modal for creating a new version stack from selected files.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useState, useCallback } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
  Field,
  Label,
  Input,
  ErrorMessage,
} from "@/web/components/ui";
import { formatFileSize } from "@/shared/file-types";
import { versionStacksApi, getErrorMessage } from "@/web/lib/api";
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

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>Create Version Stack</DialogTitle>
      <DialogBody>
        {/* Name input */}
        <Field>
          <Label>Stack Name</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter stack name"
            disabled={isCreating}
            autoFocus
          />
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </Field>

        {/* Files list */}
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-950 dark:text-white mb-2">
            Files to Stack ({files.length})
          </p>
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
                <span className="text-xs text-secondary">{formatFileSize(file.fileSizeBytes)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Info message */}
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          The newest file will be set as the current version. You can change this later.
        </p>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={handleClose} disabled={isCreating}>
          Cancel
        </Button>
        <Button
          color="bush"
          onClick={handleCreate}
          disabled={isCreating || !name.trim() || files.length < 2}
        >
          {isCreating ? "Creating..." : "Create Stack"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
