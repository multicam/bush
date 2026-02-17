/**
 * Bush Platform - Annotation Types
 *
 * Type definitions for annotation tools and canvas overlays.
 * Reference: specs/04-review-and-approval.md
 */

import type { CommentAnnotation } from "../../lib/api";

/**
 * Tool types for drawing annotations
 */
export type AnnotationTool = "select" | "rectangle" | "ellipse" | "arrow" | "line" | "freehand" | "text";

/**
 * Point in canvas coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Drawing state for a stroke in progress
 */
export interface DrawingState {
  tool: AnnotationTool;
  startPoint: Point;
  currentPoint: Point;
  points?: Point[]; // For freehand drawing
  color: string;
  strokeWidth: number;
}

/**
 * Complete annotation shape (extends CommentAnnotation with metadata)
 */
export interface AnnotationShape extends CommentAnnotation {
  id: string;
  /** Normalized coordinates (0-1) relative to canvas size */
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** For freehand: array of points */
  points?: Point[];
  /** For text: the text content */
  text?: string;
  /** Color in hex format */
  color: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Creation timestamp */
  createdAt: string;
  /** Author user ID */
  userId?: string;
  /** Associated comment ID */
  commentId?: string;
}

/**
 * Props for AnnotationCanvas component
 */
export interface AnnotationCanvasProps {
  /** Width of the canvas */
  width: number;
  /** Height of the canvas */
  height: number;
  /** Existing annotations to display */
  annotations?: AnnotationShape[];
  /** Currently selected tool */
  tool?: AnnotationTool;
  /** Current drawing color */
  color?: string;
  /** Stroke width for drawing tools */
  strokeWidth?: number;
  /** Whether annotation mode is active */
  isActive?: boolean;
  /** Whether the canvas is read-only (display only) */
  readOnly?: boolean;
  /** Callback when a new annotation is created */
  onAnnotationCreate?: (annotation: Omit<AnnotationShape, "id" | "createdAt">) => void;
  /** Callback when an annotation is selected */
  onAnnotationSelect?: (annotationId: string) => void;
  /** Callback when an annotation is updated */
  onAnnotationUpdate?: (annotationId: string, updates: Partial<AnnotationShape>) => void;
  /** Callback when an annotation is deleted */
  onAnnotationDelete?: (annotationId: string) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Props for AnnotationToolbar component
 */
export interface AnnotationToolbarProps {
  /** Currently selected tool */
  tool: AnnotationTool;
  /** Current color */
  color: string;
  /** Current stroke width */
  strokeWidth: number;
  /** Whether toolbar is disabled */
  disabled?: boolean;
  /** Whether there's history to undo */
  canUndo?: boolean;
  /** Whether there's history to redo */
  canRedo?: boolean;
  /** Callback when tool changes */
  onToolChange: (tool: AnnotationTool) => void;
  /** Callback when color changes */
  onColorChange: (color: string) => void;
  /** Callback when stroke width changes */
  onStrokeWidthChange: (width: number) => void;
  /** Callback when undo is clicked */
  onUndo?: () => void;
  /** Callback when redo is clicked */
  onRedo?: () => void;
  /** Callback when delete is clicked */
  onDelete?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Convert AnnotationShape to CommentAnnotation format for API
 */
export function toCommentAnnotation(shape: Omit<AnnotationShape, "id" | "createdAt">): CommentAnnotation {
  const base: CommentAnnotation = {
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    color: shape.color,
  };

  if (shape.type === "freehand" && shape.points) {
    base.points = shape.points;
  }

  if (shape.type === "text") {
    base.text = shape.text;
  }

  return base;
}

/**
 * Convert CommentAnnotation from API to AnnotationShape for display
 */
export function fromCommentAnnotation(
  annotation: CommentAnnotation,
  id: string,
  options?: { userId?: string; commentId?: string; createdAt?: string }
): AnnotationShape {
  const shape: AnnotationShape = {
    id,
    type: annotation.type,
    x: annotation.x ?? 0,
    y: annotation.y ?? 0,
    width: annotation.width,
    height: annotation.height,
    color: annotation.color ?? "#ff0000",
    strokeWidth: annotation.strokeWidth ?? 2,
    createdAt: options?.createdAt ?? new Date().toISOString(),
    userId: options?.userId,
    commentId: options?.commentId,
  };

  if (annotation.points) {
    shape.points = annotation.points;
  }

  if (annotation.text) {
    shape.text = annotation.text;
  }

  return shape;
}

/**
 * Default colors for annotation tools
 */
export const DEFAULT_COLORS = [
  "#ff0000", // Red
  "#ff9500", // Orange
  "#ffcc00", // Yellow
  "#34c759", // Green
  "#007aff", // Blue
  "#af52de", // Purple
  "#ff2d55", // Pink
  "#ffffff", // White
  "#000000", // Black
];

/**
 * Stroke width options
 */
export const STROKE_WIDTHS = [2, 3, 4, 6, 8];

/**
 * Tool configuration for UI display
 */
export const TOOL_CONFIG: Record<AnnotationTool, { label: string; icon: string }> = {
  select: { label: "Select", icon: "↖" },
  rectangle: { label: "Rectangle", icon: "▢" },
  ellipse: { label: "Circle", icon: "○" },
  arrow: { label: "Arrow", icon: "→" },
  line: { label: "Line", icon: "╱" },
  freehand: { label: "Draw", icon: "✎" },
  text: { label: "Text", icon: "T" },
};
