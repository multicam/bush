/**
 * Bush Platform - Annotation Overlay Component
 *
 * Complete annotation system with canvas and toolbar.
 * Reference: specs/04-review-and-approval.md
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { AnnotationCanvas } from "./annotation-canvas";
import { AnnotationToolbar } from "./annotation-toolbar";
import type {
  AnnotationShape,
  AnnotationTool,
} from "./types";
import { generateId } from "../../lib/utils";
import styles from "./annotations.module.css";

export interface AnnotationOverlayProps {
  /** Width of the container */
  width: number;
  /** Height of the container */
  height: number;
  /** Existing annotations to display */
  annotations?: AnnotationShape[];
  /** Whether annotation mode is active */
  isActive?: boolean;
  /** Whether the overlay is read-only (display only) */
  readOnly?: boolean;
  /** Callback when annotation mode is toggled */
  onActiveChange?: (active: boolean) => void;
  /** Callback when a new annotation is created (with shape data, ready for comment) */
  onAnnotationCreate?: (annotation: AnnotationShape) => void;
  /** Callback when an annotation is selected */
  onAnnotationSelect?: (annotationId: string) => void;
  /** Callback when an annotation is deleted */
  onAnnotationDelete?: (annotationId: string) => void;
  /** Additional CSS class */
  className?: string;
}

interface HistoryState {
  annotations: AnnotationShape[];
}

export function AnnotationOverlay({
  width,
  height,
  annotations: externalAnnotations = [],
  isActive = false,
  readOnly = false,
  onActiveChange,
  onAnnotationCreate,
  onAnnotationSelect,
  onAnnotationDelete,
  className,
}: AnnotationOverlayProps) {
  // Tool state
  const [tool, setTool] = useState<AnnotationTool>("rectangle");
  const [color, setColor] = useState("#ff0000");
  const [strokeWidth, setStrokeWidth] = useState(2);

  // Local annotations (for undo/redo)
  const [localAnnotations, setLocalAnnotations] = useState<AnnotationShape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([{ annotations: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Push state to history - declared before useEffect that uses it
  const pushHistory = useCallback((newAnnotations: AnnotationShape[]) => {
    setHistory((prev) => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push({ annotations: newAnnotations });
      // Limit history size
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Sync with external annotations
  useEffect(() => {
    // Intentional setState to sync with external annotations
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalAnnotations(externalAnnotations);
    void pushHistory(externalAnnotations);
  }, [externalAnnotations, pushHistory]);

  // Combined annotations for display
  const displayAnnotations = localAnnotations.length > 0 ? localAnnotations : externalAnnotations;

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLocalAnnotations(history[newIndex].annotations);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLocalAnnotations(history[newIndex].annotations);
    }
  }, [history, historyIndex]);

  // Handle new annotation creation
  const handleAnnotationCreate = useCallback(
    (shapeData: Omit<AnnotationShape, "id" | "createdAt">) => {
      const newAnnotation: AnnotationShape = {
        ...shapeData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };

      const newAnnotations = [...localAnnotations, newAnnotation];
      setLocalAnnotations(newAnnotations);
      pushHistory(newAnnotations);
      onAnnotationCreate?.(newAnnotation);
    },
    [localAnnotations, pushHistory, onAnnotationCreate]
  );

  // Handle annotation selection
  const handleAnnotationSelect = useCallback(
    (annotationId: string) => {
      setSelectedId(annotationId);
      onAnnotationSelect?.(annotationId);
    },
    [onAnnotationSelect]
  );

  // Handle annotation deletion
  const handleDelete = useCallback(() => {
    if (!selectedId) return;

    const newAnnotations = localAnnotations.filter((a) => a.id !== selectedId);
    setLocalAnnotations(newAnnotations);
    pushHistory(newAnnotations);
    onAnnotationDelete?.(selectedId);
    setSelectedId(null);
  }, [selectedId, localAnnotations, pushHistory, onAnnotationDelete]);

  // Toggle annotation mode
  const toggleActive = useCallback(() => {
    onActiveChange?.(!isActive);
  }, [isActive, onActiveChange]);

  // Check if we can undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className={`${styles.overlay} ${className ?? ""}`} style={{ width, height }}>
      {/* Canvas layer */}
      <AnnotationCanvas
        width={width}
        height={height}
        annotations={displayAnnotations}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        isActive={isActive}
        readOnly={readOnly}
        onAnnotationCreate={handleAnnotationCreate}
        onAnnotationSelect={handleAnnotationSelect}
      />

      {/* Toolbar */}
      {isActive && !readOnly && (
        <div className={styles.toolbarContainer}>
          <AnnotationToolbar
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            disabled={false}
            canUndo={canUndo}
            canRedo={canRedo}
            onToolChange={setTool}
            onColorChange={setColor}
            onStrokeWidthChange={setStrokeWidth}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDelete={selectedId ? handleDelete : undefined}
          />
        </div>
      )}

      {/* Toggle button (when inactive) */}
      {!isActive && !readOnly && (
        <button
          type="button"
          className={styles.toggleButton}
          onClick={toggleActive}
          title="Enable annotation mode"
          aria-label="Enable annotation mode"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <span>Annotate</span>
        </button>
      )}

      {/* Close button (when active) */}
      {isActive && !readOnly && (
        <button
          type="button"
          className={styles.closeButton}
          onClick={toggleActive}
          title="Exit annotation mode"
          aria-label="Exit annotation mode"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
