/**
 * Tests for Bush Platform - Class Name Utility
 */
import { describe, it, expect } from "vitest";
import { cn } from "./cn.js";

describe("cn utility", () => {
  describe("basic string handling", () => {
    it("should return empty string when called with no arguments", () => {
      expect(cn()).toBe("");
    });

    it("should return a single class name unchanged", () => {
      expect(cn("px-4")).toBe("px-4");
    });

    it("should concatenate multiple class names", () => {
      expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });

    it("should handle many class names", () => {
      const result = cn("flex", "items-center", "justify-between", "p-4", "bg-white");
      expect(result).toBe("flex items-center justify-between p-4 bg-white");
    });
  });

  describe("conditional classes", () => {
    it("should include class when condition is true", () => {
      expect(cn("base", true && "conditional")).toBe("base conditional");
    });

    it("should exclude class when condition is false", () => {
      expect(cn("base", false && "conditional")).toBe("base");
    });

    it("should handle mixed conditions", () => {
      const isPrimary = true;
      const isLarge = false;
      const isDisabled = true;

      expect(cn(
        "btn",
        isPrimary && "btn-primary",
        isLarge && "btn-lg",
        isDisabled && "opacity-50"
      )).toBe("btn btn-primary opacity-50");
    });

    it("should handle undefined values", () => {
      expect(cn("base", undefined)).toBe("base");
    });

    it("should handle null values", () => {
      expect(cn("base", null)).toBe("base");
    });
  });

  describe("object syntax", () => {
    it("should include classes from object with true values", () => {
      expect(cn({ "active": true, "disabled": false })).toBe("active");
    });

    it("should handle mixed object values", () => {
      // Note: flex and block are conflicting display utilities, so tailwind-merge dedupes them
      // Use non-conflicting classes to test object syntax
      expect(cn({ "text-bold": true, "text-italic": false, "underline": true })).toBe("text-bold underline");
    });
  });

  describe("array syntax", () => {
    it("should flatten arrays of class names", () => {
      expect(cn(["flex", "items-center"])).toBe("flex items-center");
    });

    it("should handle nested arrays", () => {
      expect(cn(["base", ["nested", "classes"]])).toBe("base nested classes");
    });
  });

  describe("Tailwind class deduplication", () => {
    it("should dedupe conflicting Tailwind classes (last wins)", () => {
      // p-4 should override p-2
      expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("should dedupe margin classes", () => {
      expect(cn("m-2", "m-4")).toBe("m-4");
    });

    it("should dedupe text color classes", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should dedupe background color classes", () => {
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    });

    it("should preserve non-conflicting classes", () => {
      // Different padding axes should not conflict
      expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });

    it("should handle complex deduplication", () => {
      const result = cn(
        "px-4 py-2 bg-gray-100",
        "px-6 bg-blue-500",
        "text-sm"
      );
      expect(result).toBe("py-2 px-6 bg-blue-500 text-sm");
    });
  });

  describe("mixed input types", () => {
    it("should handle strings, conditionals, objects, and arrays together", () => {
      const isActive = true;
      const isDisabled = false;

      const result = cn(
        "btn",
        "base-class",
        isActive && "active",
        isDisabled && "disabled",
        { "loading": true, "error": false },
        ["extra", "classes"]
      );

      expect(result).toContain("btn");
      expect(result).toContain("base-class");
      expect(result).toContain("active");
      expect(result).toContain("loading");
      expect(result).toContain("extra");
      expect(result).toContain("classes");
      expect(result).not.toContain("disabled");
      expect(result).not.toContain("error");
    });
  });

  describe("edge cases", () => {
    it("should handle empty strings", () => {
      expect(cn("", "valid")).toBe("valid");
    });

    it("should handle whitespace-only strings", () => {
      expect(cn("   ", "valid")).toBe("valid");
    });

    it("should trim whitespace from class names", () => {
      expect(cn("  spaced  ")).toBe("spaced");
    });

    it("should handle numbers in class names", () => {
      expect(cn("p-4", "text-2xl")).toBe("p-4 text-2xl");
    });

    it("should handle CSS custom properties", () => {
      expect(cn("[color:var(--my-color)]")).toBe("[color:var(--my-color)]");
    });
  });
});
