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
import { X, FileText } from "lucide-react";
import type { AddToStackModalProps } from "./types";

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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-stack-title"
    >
      <div className="bg-surface-1 rounded-md w-full max-w-[480px] max-h-[90vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 id="add-to-stack-title" className="m-0 text-lg font-semibold text-primary">
            Add to Version Stack
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
          {/* File info */}
          <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-sm mb-4">
            <FileText className="w-4 h-4 text-secondary" />
            <span className="text-sm text-secondary">Adding:</span>
            <span className="text-sm font-medium truncate" title={file.name}>
              {file.name}
            </span>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-0 mb-4 border border-border-default rounded-sm overflow-hidden">
            <button
              className={`
                flex-1 px-3 py-3 border-none text-sm font-medium cursor-pointer transition-colors
                ${mode === "select"
                  ? "bg-accent text-white"
                  : "bg-surface-1 text-secondary hover:bg-surface-2"
                }
              `}
              onClick={() => setMode("select")}
            >
              Add to Existing
            </button>
            <button
              className={`
                flex-1 px-3 py-3 border-l border-border-default border-none text-sm font-medium cursor-pointer transition-colors
                ${mode === "create"
                  ? "bg-accent text-white"
                  : "bg-surface-1 text-secondary hover:bg-surface-2"
                }
              `}
              onClick={() => setMode("create")}
            >
              Create New Stack
            </button>
          </div>

          {/* Select existing stack */}
          {mode === "select" && (
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
              {stacks.length === 0 ? (
                <p className="text-center text-secondary p-4 text-sm">
                  No existing stacks. Create a new stack instead.
                </p>
              ) : (
                stacks.map((stack) => (
                  <button
                    key={stack.id}
                    className={`
                      flex items-center p-3 bg-surface-1 border rounded-sm cursor-pointer transition-colors text-left
                      ${selectedStackId === stack.id
                        ? "border-accent bg-blue-50"
                        : "border-border-default hover:border-accent hover:bg-blue-50"
                      }
                    `}
                    onClick={() => setSelectedStackId(stack.id)}
                  >
                    <span className="text-sm font-medium">{stack.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Create new stack */}
          {mode === "create" && (
            <div className="flex flex-col gap-2 mb-4">
              <label htmlFor="new-stack-name" className="text-sm font-medium text-primary">
                Stack Name
              </label>
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
            <div className="p-3 bg-red-50 border border-red-300 rounded-sm text-red-600 text-sm mb-4">
              <p className="m-0">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-default">
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
