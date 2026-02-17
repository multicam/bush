/**
 * Bush Platform - Annotation Canvas Component
 *
 * Canvas overlay for drawing annotations on viewers.
 * Reference: specs/04-review-and-approval.md
 */
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type {
  AnnotationCanvasProps,
  AnnotationShape,
  Point,
  AnnotationTool,
} from "./types";
import { generateId } from "../../lib/utils";
import styles from "./annotations.module.css";

/**
 * Normalize point coordinates relative to canvas size
 */
function normalizePoint(point: Point, width: number, height: number): Point {
  return {
    x: point.x / width,
    y: point.y / height,
  };
}

/**
 * Denormalize point coordinates from relative to absolute
 */
function denormalizePoint(point: Point, width: number, height: number): Point {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}

/**
 * Calculate shape bounds from points (for freehand)
 */
function getBoundsFromPoints(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function AnnotationCanvas({
  width,
  height,
  annotations = [],
  tool = "select",
  color = "#ff0000",
  strokeWidth = 2,
  isActive = false,
  readOnly = false,
  onAnnotationCreate,
  onAnnotationSelect,
  className,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Get canvas context
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  // Draw all annotations on the canvas
  const drawAnnotations = useCallback(
    (ctx: CanvasRenderingContext2D, currentShape?: Partial<AnnotationShape>) => {
      ctx.clearRect(0, 0, width, height);

      // Draw existing annotations
      annotations.forEach((annotation) => {
        drawShape(ctx, annotation, annotation.id === selectedId);
      });

      // Draw current shape being drawn
      if (currentShape) {
        drawShape(ctx, currentShape as AnnotationShape, false, true);
      }
    },
    [annotations, selectedId, width, height]
  );

  // Draw a single shape
  const drawShape = (
    ctx: CanvasRenderingContext2D,
    shape: Partial<AnnotationShape>,
    isSelected: boolean,
    isDrawing = false
  ) => {
    ctx.save();
    ctx.strokeStyle = shape.color ?? "#ff0000";
    ctx.fillStyle = "transparent";
    ctx.lineWidth = shape.strokeWidth ?? 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (isDrawing) {
      ctx.globalAlpha = 0.7;
    }

    const x = (shape.x ?? 0) * width;
    const y = (shape.y ?? 0) * height;
    const w = (shape.width ?? 0) * width;
    const h = (shape.height ?? 0) * height;

    switch (shape.type) {
      case "rectangle":
        ctx.strokeRect(x, y, w, h);
        if (isSelected) {
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        }
        break;

      case "ellipse":
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        if (isSelected) {
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        }
        break;

      case "line":
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        break;

      case "arrow":
        // Draw line
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        // Draw arrowhead
        const angle = Math.atan2(h, w);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(x + w, y + h);
        ctx.lineTo(
          x + w - headLength * Math.cos(angle - Math.PI / 6),
          y + h - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(x + w, y + h);
        ctx.lineTo(
          x + w - headLength * Math.cos(angle + Math.PI / 6),
          y + h - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;

      case "freehand":
        if (shape.points && shape.points.length > 1) {
          ctx.beginPath();
          const pts = shape.points.map((p) => denormalizePoint(p, width, height));
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
        break;

      case "text":
        if (shape.text) {
          ctx.font = `${16 + (shape.strokeWidth ?? 0) * 2}px sans-serif`;
          ctx.fillStyle = shape.color ?? "#ff0000";
          ctx.fillText(shape.text, x, y + 20);
        }
        break;
    }

    ctx.restore();
  };

  // Redraw on annotations change
  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;
    drawAnnotations(ctx);
  }, [annotations, selectedId, getContext, drawAnnotations]);

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly || !isActive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const point: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (tool === "select") {
        // Check if clicking on an annotation
        const clicked = findAnnotationAtPoint(point, annotations, width, height);
        if (clicked) {
          setSelectedId(clicked.id);
          onAnnotationSelect?.(clicked.id);
        } else {
          setSelectedId(null);
        }
        return;
      }

      setIsDrawing(true);
      setStartPoint(point);
      setCurrentPoint(point);

      if (tool === "freehand") {
        setFreehandPoints([normalizePoint(point, width, height)]);
      }
    },
    [readOnly, isActive, tool, annotations, width, height, onAnnotationSelect]
  );

  // Handle mouse move - continue drawing
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !startPoint || readOnly || !isActive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const point: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      setCurrentPoint(point);

      if (tool === "freehand") {
        setFreehandPoints((prev) => [...prev, normalizePoint(point, width, height)]);
      }

      // Calculate shape for preview
      let previewShape: Partial<AnnotationShape> | undefined;

      if (tool !== "freehand" && startPoint) {
        const normalizedStart = normalizePoint(startPoint, width, height);
        const normalizedCurrent = normalizePoint(point, width, height);

        previewShape = {
          type: tool as AnnotationShape["type"],
          x: Math.min(normalizedStart.x, normalizedCurrent.x),
          y: Math.min(normalizedStart.y, normalizedCurrent.y),
          width: Math.abs(normalizedCurrent.x - normalizedStart.x),
          height: Math.abs(normalizedCurrent.y - normalizedStart.y),
          color,
          strokeWidth,
        };
      } else if (tool === "freehand" && freehandPoints.length > 0) {
        previewShape = {
          type: "freehand",
          points: freehandPoints,
          color,
          strokeWidth,
        };
      }

      // Redraw with preview
      const ctx = getContext();
      if (ctx && previewShape) {
        drawAnnotations(ctx, previewShape);
      }
    },
    [
      isDrawing,
      startPoint,
      readOnly,
      isActive,
      tool,
      freehandPoints,
      color,
      strokeWidth,
      width,
      height,
      getContext,
      drawAnnotations,
    ]
  );

  // Handle mouse up - finish drawing
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !startPoint || !currentPoint || readOnly || !isActive) return;

    const normalizedStart = normalizePoint(startPoint, width, height);
    const normalizedEnd = normalizePoint(currentPoint, width, height);

    let shape: Omit<AnnotationShape, "id" | "createdAt"> | undefined;

    if (tool === "freehand" && freehandPoints.length > 1) {
      const bounds = getBoundsFromPoints(freehandPoints);
      shape = {
        type: "freehand",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        points: freehandPoints,
        color,
        strokeWidth,
      };
    } else if (tool !== "freehand" && tool !== "select" && tool !== "text") {
      // Only create shape if it has some size
      const w = Math.abs(normalizedEnd.x - normalizedStart.x);
      const h = Math.abs(normalizedEnd.y - normalizedStart.y);
      if (w > 0.005 || h > 0.005) {
        shape = {
          type: tool as AnnotationShape["type"],
          x: Math.min(normalizedStart.x, normalizedEnd.x),
          y: Math.min(normalizedStart.y, normalizedEnd.y),
          width: w,
          height: h,
          color,
          strokeWidth,
        };
      }
    }

    if (shape) {
      onAnnotationCreate?.(shape);
    }

    // Reset state
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setFreehandPoints([]);

    // Redraw without preview
    const ctx = getContext();
    if (ctx) {
      drawAnnotations(ctx);
    }
  }, [
    isDrawing,
    startPoint,
    currentPoint,
    readOnly,
    isActive,
    tool,
    freehandPoints,
    color,
    strokeWidth,
    width,
    height,
    onAnnotationCreate,
    getContext,
    drawAnnotations,
  ]);

  // Find annotation at a point
  const findAnnotationAtPoint = (
    point: Point,
    shapes: AnnotationShape[],
    canvasWidth: number,
    canvasHeight: number
  ): AnnotationShape | null => {
    const normalizedPoint = normalizePoint(point, canvasWidth, canvasHeight);

    // Check in reverse order (top-most first)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (isPointInShape(normalizedPoint, shape)) {
        return shape;
      }
    }
    return null;
  };

  // Check if a point is inside a shape
  const isPointInShape = (point: Point, shape: AnnotationShape): boolean => {
    const { x, y } = point;
    const { x: sx, y: sy, width: sw, height: sh } = shape;

    switch (shape.type) {
      case "rectangle":
      case "ellipse":
      case "text":
        return x >= sx && x <= sx + (sw ?? 0) && y >= sy && y <= sy + (sh ?? 0);

      case "line":
      case "arrow":
        // Simplified: check if point is near the line
        if (!sw || !sh) return false;
        const lineThreshold = 0.02;
        const dist = pointToLineDistance(point, { x: sx, y: sy }, { x: sx + sw, y: sy + sh });
        return dist < lineThreshold;

      case "freehand":
        if (!shape.points || shape.points.length < 2) return false;
        // Check if point is near any segment
        for (let i = 0; i < shape.points.length - 1; i++) {
          const dist = pointToLineDistance(point, shape.points[i], shape.points[i + 1]);
          if (dist < 0.02) return true;
        }
        return false;

      default:
        return false;
    }
  };

  // Calculate distance from point to line segment
  const pointToLineDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const nearestX = lineStart.x + t * dx;
    const nearestY = lineStart.y + t * dy;

    return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
  };

  if (!isActive && annotations.length === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`${styles.canvas} ${isActive ? styles.active : ""} ${className ?? ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
