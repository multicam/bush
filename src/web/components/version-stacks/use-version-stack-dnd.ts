/**
 * Bush Platform - Version Stack Drag and Drop Hook
 *
 * Provides drag-and-drop functionality for creating version stacks.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useState, useCallback, useRef } from "react";
import { versionStacksApi, getErrorMessage } from "@/web/lib/api";
import type { AssetFile } from "@/web/components/asset-browser";

export interface DragState {
  /** File being dragged */
  draggedFile: AssetFile | null;
  /** File being hovered over (drop target) */
  targetFile: AssetFile | null;
  /** Whether we're in an active drag operation */
  isDragging: boolean;
  /** Whether the current drop target is valid */
  isValidDrop: boolean;
}

export interface UseVersionStackDndOptions {
  /** Project ID for API calls */
  projectId: string;
  /** Callback when a stack is created successfully */
  onStackCreated?: (stackId: string) => void;
  /** Callback when a file is added to an existing stack */
  onFileAdded?: (stackId: string, fileId: string) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Whether to enable drag and drop */
  enabled?: boolean;
}

export interface UseVersionStackDndReturn {
  /** Current drag state */
  dragState: DragState;
  /** Start dragging a file */
  handleDragStart: (file: AssetFile) => void;
  /** Handle dragging over a file */
  handleDragOver: (targetFile: AssetFile, event: React.DragEvent) => void;
  /** Handle leaving a file drop target */
  handleDragLeave: () => void;
  /** Handle dropping on a file */
  handleDrop: (targetFile: AssetFile) => Promise<void>;
  /** Cancel the current drag operation */
  handleDragEnd: () => void;
  /** Create a new stack from two files */
  createStack: (file1: AssetFile, file2: AssetFile, name?: string) => Promise<string | null>;
  /** Add a file to an existing stack */
  addToStack: (stackId: string, fileId: string) => Promise<boolean>;
}

export function useVersionStackDnd({
  projectId,
  onStackCreated,
  onFileAdded,
  onError,
  enabled = true,
}: UseVersionStackDndOptions): UseVersionStackDndReturn {
  const [dragState, setDragState] = useState<DragState>({
    draggedFile: null,
    targetFile: null,
    isDragging: false,
    isValidDrop: false,
  });

  const isProcessingRef = useRef(false);

  /**
   * Check if a drop is valid (can't drop on self, must be same project)
   */
  const isValidDropTarget = useCallback(
    (draggedFile: AssetFile | null, targetFile: AssetFile | null): boolean => {
      if (!draggedFile || !targetFile) return false;
      if (draggedFile.id === targetFile.id) return false;
      // Both files should be in the same project
      return true;
    },
    []
  );

  const handleDragStart = useCallback(
    (file: AssetFile) => {
      if (!enabled) return;
      setDragState({
        draggedFile: file,
        targetFile: null,
        isDragging: true,
        isValidDrop: false,
      });
    },
    [enabled]
  );

  const handleDragOver = useCallback(
    (targetFile: AssetFile, event: React.DragEvent) => {
      if (!enabled || !dragState.isDragging) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "link"; // Show "link" cursor for stacking

      const isValid = isValidDropTarget(dragState.draggedFile, targetFile);
      setDragState((prev) => ({
        ...prev,
        targetFile,
        isValidDrop: isValid,
      }));
    },
    [enabled, dragState.isDragging, dragState.draggedFile, isValidDropTarget]
  );

  const handleDragLeave = useCallback(() => {
    setDragState((prev) => ({
      ...prev,
      targetFile: null,
      isValidDrop: false,
    }));
  }, []);

  const handleDrop = useCallback(
    async (targetFile: AssetFile) => {
      if (!enabled || !dragState.draggedFile || isProcessingRef.current) {
        setDragState({
          draggedFile: null,
          targetFile: null,
          isDragging: false,
          isValidDrop: false,
        });
        return;
      }

      const isValid = isValidDropTarget(dragState.draggedFile, targetFile);
      if (!isValid) {
        setDragState({
          draggedFile: null,
          targetFile: null,
          isDragging: false,
          isValidDrop: false,
        });
        return;
      }

      isProcessingRef.current = true;

      const file1 = dragState.draggedFile;
      const file2 = targetFile;

      try {
        // Create a new stack from both files - inline to avoid dep cycle
        const stackName = generateStackName(file1.name, file2.name);
        const response = await versionStacksApi.stackFiles({
          project_id: projectId,
          name: stackName,
          file_ids: [file1.id, file2.id],
        });
        onStackCreated?.(response.data.id);
      } catch (err) {
        onError?.(getErrorMessage(err));
      } finally {
        isProcessingRef.current = false;
        setDragState({
          draggedFile: null,
          targetFile: null,
          isDragging: false,
          isValidDrop: false,
        });
      }
    },
    [enabled, dragState.draggedFile, isValidDropTarget, projectId, onStackCreated, onError]
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      draggedFile: null,
      targetFile: null,
      isDragging: false,
      isValidDrop: false,
    });
  }, []);

  const createStack = useCallback(
    async (file1: AssetFile, file2: AssetFile, name?: string): Promise<string | null> => {
      try {
        // Generate a name from the files if not provided
        const stackName =
          name || generateStackName(file1.name, file2.name);

        const response = await versionStacksApi.stackFiles({
          project_id: projectId,
          name: stackName,
          file_ids: [file1.id, file2.id],
        });

        const stackId = response.data.id;
        onStackCreated?.(stackId);
        return stackId;
      } catch (err) {
        const message = getErrorMessage(err);
        onError?.(message);
        return null;
      }
    },
    [projectId, onStackCreated, onError]
  );

  const addToStack = useCallback(
    async (stackId: string, fileId: string): Promise<boolean> => {
      try {
        await versionStacksApi.addFile(stackId, fileId);
        onFileAdded?.(stackId, fileId);
        return true;
      } catch (err) {
        const message = getErrorMessage(err);
        onError?.(message);
        return false;
      }
    },
    [onFileAdded, onError]
  );

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    createStack,
    addToStack,
  };
}

/**
 * Generate a stack name from two file names
 */
function generateStackName(name1: string, name2: string): string {
  // Remove extensions
  const base1 = name1.replace(/\.[^.]+$/, "");
  const base2 = name2.replace(/\.[^.]+$/, "");

  // Find common prefix
  let commonPrefix = "";
  const minLength = Math.min(base1.length, base2.length);
  for (let i = 0; i < minLength; i++) {
    if (base1[i] === base2[i]) {
      commonPrefix += base1[i];
    } else {
      break;
    }
  }

  // Clean up the prefix (remove trailing underscores, dashes, spaces)
  commonPrefix = commonPrefix.replace(/[-_\s]+$/, "");

  if (commonPrefix.length >= 3) {
    return `${commonPrefix} Stack`;
  }

  // If no common prefix, use the first file's name
  return `${base1} Stack`;
}
