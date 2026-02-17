/**
 * Bush Platform - Viewers Components
 *
 * Export all viewer components for assets.
 */
export { ImageViewer } from "./image-viewer.js";
export type { ImageViewerProps } from "./image-viewer.js";

export { VideoViewer } from "./video-viewer.js";
export type { VideoViewerProps, CommentMarker as VideoCommentMarker, FilmstripData } from "./video-viewer.js";

export { AudioViewer } from "./audio-viewer.js";
export type { AudioViewerProps, CommentMarker as AudioCommentMarker, WaveformData } from "./audio-viewer.js";

export { PdfViewer } from "./pdf-viewer.js";
export type { PdfViewerProps, CommentMarker as PdfCommentMarker } from "./pdf-viewer.js";

// Re-export annotation components for convenience
export {
  AnnotationCanvas,
  AnnotationToolbar,
  AnnotationOverlay,
  toCommentAnnotation,
  fromCommentAnnotation,
  DEFAULT_COLORS,
  STROKE_WIDTHS,
  TOOL_CONFIG,
} from "../annotations/index.js";
export type {
  AnnotationTool,
  Point,
  DrawingState,
  AnnotationShape,
  AnnotationCanvasProps,
  AnnotationToolbarProps,
  AnnotationOverlayProps,
} from "../annotations/index.js";
