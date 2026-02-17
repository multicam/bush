/**
 * Bush Platform - Annotation Components Tests
 *
 * Tests for annotation types and utility functions.
 */
import { describe, it, expect } from "vitest";
import {
  toCommentAnnotation,
  fromCommentAnnotation,
  DEFAULT_COLORS,
  STROKE_WIDTHS,
  TOOL_CONFIG,
} from "./index";
import type { AnnotationShape } from "./types";

describe("Annotation Types and Utilities", () => {
  describe("toCommentAnnotation", () => {
    it("should convert rectangle shape to comment annotation", () => {
      const shape: Omit<AnnotationShape, "id" | "createdAt"> = {
        type: "rectangle",
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        color: "#ff0000",
        strokeWidth: 2,
      };

      const result = toCommentAnnotation(shape);

      expect(result.type).toBe("rectangle");
      expect(result.x).toBe(0.1);
      expect(result.y).toBe(0.2);
      expect(result.width).toBe(0.3);
      expect(result.height).toBe(0.4);
      expect(result.color).toBe("#ff0000");
    });

    it("should convert freehand shape with points", () => {
      const shape: Omit<AnnotationShape, "id" | "createdAt"> = {
        type: "freehand",
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        points: [
          { x: 0, y: 0 },
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.15 },
        ],
        color: "#00ff00",
        strokeWidth: 3,
      };

      const result = toCommentAnnotation(shape);

      expect(result.type).toBe("freehand");
      expect(result.points).toHaveLength(3);
      expect(result.points?.[0]).toEqual({ x: 0, y: 0 });
    });

    it("should convert text shape with text content", () => {
      const shape: Omit<AnnotationShape, "id" | "createdAt"> = {
        type: "text",
        x: 0.2,
        y: 0.3,
        color: "#0000ff",
        text: "Hello world",
        strokeWidth: 1,
      };

      const result = toCommentAnnotation(shape);

      expect(result.type).toBe("text");
      expect(result.text).toBe("Hello world");
    });
  });

  describe("fromCommentAnnotation", () => {
    it("should convert comment annotation to shape", () => {
      const annotation = {
        type: "rectangle" as const,
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        color: "#ff0000",
      };

      const result = fromCommentAnnotation(annotation, "test-id", {
        userId: "user-1",
        commentId: "comment-1",
        createdAt: "2026-02-17T00:00:00Z",
      });

      expect(result.id).toBe("test-id");
      expect(result.type).toBe("rectangle");
      expect(result.x).toBe(0.1);
      expect(result.y).toBe(0.2);
      expect(result.userId).toBe("user-1");
      expect(result.commentId).toBe("comment-1");
      expect(result.createdAt).toBe("2026-02-17T00:00:00Z");
    });

    it("should handle missing optional fields with defaults", () => {
      const annotation = {
        type: "line" as const,
        x: 0,
        y: 0,
      };

      const result = fromCommentAnnotation(annotation, "test-id");

      expect(result.color).toBe("#ff0000"); // Default color
      expect(result.strokeWidth).toBe(2); // Default stroke width
    });

    it("should preserve points from freehand annotation", () => {
      const annotation = {
        type: "freehand" as const,
        x: 0,
        y: 0,
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
        ],
      };

      const result = fromCommentAnnotation(annotation, "test-id");

      expect(result.points).toHaveLength(2);
    });
  });

  describe("Constants", () => {
    it("should have valid default colors", () => {
      expect(DEFAULT_COLORS).toHaveLength(9);
      expect(DEFAULT_COLORS).toContain("#ff0000"); // Red
      expect(DEFAULT_COLORS).toContain("#ffffff"); // White
      expect(DEFAULT_COLORS).toContain("#000000"); // Black
    });

    it("should have valid stroke widths", () => {
      expect(STROKE_WIDTHS).toHaveLength(5);
      expect(STROKE_WIDTHS[0]).toBe(2);
      expect(STROKE_WIDTHS[4]).toBe(8);
    });

    it("should have all tool configurations", () => {
      const tools = ["select", "rectangle", "ellipse", "arrow", "line", "freehand", "text"];
      tools.forEach((tool) => {
        expect(TOOL_CONFIG[tool as keyof typeof TOOL_CONFIG]).toBeDefined();
        expect(TOOL_CONFIG[tool as keyof typeof TOOL_CONFIG].label).toBeDefined();
        expect(TOOL_CONFIG[tool as keyof typeof TOOL_CONFIG].icon).toBeDefined();
      });
    });
  });
});
