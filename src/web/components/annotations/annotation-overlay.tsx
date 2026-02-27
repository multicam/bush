/**
 * Bush Platform - Annotation Overlay Component
 *
 * Complete annotation system with canvas and toolbar.
 * Reference: specs/04-api-reference.md
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Pencil, X } from "lucide-react";
import { AnnotationCanvas } from "./annotation-canvas";
import { AnnotationToolbar } from "./annotation-toolbar";
import type {
  AnnotationShape,
  AnnotationTool,
} from "./types";
import { generateId } from "../../lib/utils";

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

  // Ref to track previous external annotations and prevent excessive history pushes
  const prevExternalAnnotationsRef = useRef<AnnotationShape[]>([]);
  const pendingHistoryPushRef = useRef<AnnotationShape[] | null>(null);
  const historyPushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Sync with external annotations - debounced and deduplicated
  useEffect(() => {
    const prevAnnotations = prevExternalAnnotationsRef.current;

    // Check if annotations have meaningfully changed (by id and content)
    const hasChanged =
      prevAnnotations.length !== externalAnnotations.length ||
      prevAnnotations.some((prev, i) => {
        const curr = externalAnnotations[i];
        return (
          !curr ||
          prev.id !== curr.id ||
          JSON.stringify(prev) !== JSON.stringify(curr)
        );
      });

    // Always update local annotations to stay in sync
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalAnnotations(externalAnnotations);
    prevExternalAnnotationsRef.current = externalAnnotations;

    // Only schedule history push if annotations have actually changed
    if (hasChanged) {
      // Batch history pushes with a small debounce to prevent rapid successive pushes
      pendingHistoryPushRef.current = externalAnnotations;

      if (historyPushTimeoutRef.current) {
        clearTimeout(historyPushTimeoutRef.current);
      }

      historyPushTimeoutRef.current = setTimeout(() => {
        if (pendingHistoryPushRef.current !== null) {
          pushHistory(pendingHistoryPushRef.current);
          pendingHistoryPushRef.current = null;
        }
        historyPushTimeoutRef.current = null;
      }, 100); // 100ms debounce
    }

    // Cleanup timeout on unmount or before next effect run
    return () => {
      if (historyPushTimeoutRef.current) {
        clearTimeout(historyPushTimeoutRef.current);
        historyPushTimeoutRef.current = null;
      }
    };
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
    <div
      className={`absolute top-0 left-0 [&>*]:pointer-events-auto pointer-events-none ${className ?? ""}`}
      style={{ width, height }}
    >
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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
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
          className={`
            absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2
            border-none rounded-md bg-surface-1/90 text-primary
            text-sm cursor-pointer transition-all shadow-md
            hover:bg-surface-2/95 hover:-translate-y-0.5 hover:shadow-lg
          `}
          onClick={toggleActive}
          title="Enable annotation mode"
          aria-label="Enable annotation mode"
        >
          <Pencil className="w-5 h-5 opacity-80" />
          <span>Annotate</span>
        </button>
      )}

      {/* Close button (when active) */}
      {isActive && !readOnly && (
        <button
          type="button"
          className={`
            absolute top-3 right-3 flex items-center justify-center
            w-8 h-8 border-none rounded-md bg-surface-1/90 text-primary
            cursor-pointer transition-colors shadow-md
            hover:bg-red-500/80 hover:text-white
          `}
          onClick={toggleActive}
          title="Exit annotation mode"
          aria-label="Exit annotation mode"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
