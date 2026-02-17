/**
 * Bush Platform - Annotation Components
 *
 * Export all annotation components for drawing on viewers.
 * Reference: specs/04-review-and-approval.md
 */

// Types
export type {
  AnnotationTool,
  Point,
  DrawingState,
  AnnotationShape,
  AnnotationCanvasProps,
  AnnotationToolbarProps,
} from "./types";

export {
  toCommentAnnotation,
  fromCommentAnnotation,
  DEFAULT_COLORS,
  STROKE_WIDTHS,
  TOOL_CONFIG,
} from "./types";

// Components
export { AnnotationCanvas } from "./annotation-canvas";
export { AnnotationToolbar } from "./annotation-toolbar";
export { AnnotationOverlay } from "./annotation-overlay";
export type { AnnotationOverlayProps } from "./annotation-overlay";
