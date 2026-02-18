/**
 * Bush Platform - Metadata Badges Tests
 *
 * Tests for the metadata badges utility functions.
 * Reference: IMPLEMENTATION_PLAN.md [P2] Metadata Badges
 */
import { describe, it, expect } from "vitest";
import { formatDuration, formatResolution } from "./metadata-badges";

describe("formatDuration", () => {
  it("should format seconds to M:SS format", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(59)).toBe("0:59");
  });

  it("should format durations with hours as H:MM:SS", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(7325)).toBe("2:02:05");
  });

  it("should handle zero duration", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("should pad seconds with leading zero", () => {
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(60)).toBe("1:00");
  });

  it("should pad minutes with leading zero when hours present", () => {
    expect(formatDuration(3605)).toBe("1:00:05");
    expect(formatDuration(3665)).toBe("1:01:05");
  });
});

describe("formatResolution", () => {
  it("should identify 4K resolution", () => {
    expect(formatResolution(3840, 2160)).toBe("4K");
    expect(formatResolution(4096, 2160)).toBe("4K");
  });

  it("should identify QHD resolution", () => {
    expect(formatResolution(2560, 1440)).toBe("QHD");
  });

  it("should identify 1080p resolution", () => {
    expect(formatResolution(1920, 1080)).toBe("1080p");
    expect(formatResolution(1920, 1200)).toBe("1080p"); // Based on height
  });

  it("should identify 720p resolution", () => {
    expect(formatResolution(1280, 720)).toBe("720p");
  });

  it("should identify 480p resolution", () => {
    expect(formatResolution(854, 480)).toBe("480p");
  });

  it("should show raw dimensions for non-standard resolutions", () => {
    // 640x360 - neither meets thresholds (min 854 width or 480 height for 480p)
    expect(formatResolution(640, 360)).toBe("640×360");
    // 500x400 - below all thresholds
    expect(formatResolution(500, 400)).toBe("500×400");
  });

  it("should detect resolution by height when width is smaller", () => {
    // Vertical video that's 1920 tall (exceeds 1440 threshold for QHD)
    expect(formatResolution(1080, 1920)).toBe("QHD");
    // Vertical video that's 1280 tall (exceeds 1080 threshold for 1080p)
    expect(formatResolution(720, 1280)).toBe("1080p");
  });
});
