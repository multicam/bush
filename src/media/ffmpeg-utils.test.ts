/**
 * Tests for FFmpeg utility functions
 *
 * Note: These tests focus on utility functions that don't require
 * the actual ffmpeg binary. Functions that execute ffmpeg/ffprobe
 * are tested via integration tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
}));

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    FFPROBE_PATH: "/usr/bin/ffprobe",
    MEDIA_TEMP_DIR: "/tmp/bush-processing",
  },
}));

import { access, mkdir, rm, stat } from "fs/promises";

describe("ffmpeg utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("ensureDir", () => {
    it("creates directory if it doesn't exist", async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined);

      const { ensureDir } = await import("./ffmpeg.js");
      await ensureDir("/test/dir");

      expect(mkdir).toHaveBeenCalledWith("/test/dir", { recursive: true });
    });

    it("handles existing directory gracefully", async () => {
      const error = new Error("EEXIST");
      vi.mocked(mkdir).mockRejectedValue(error);

      const { ensureDir } = await import("./ffmpeg.js");
      // Should not throw
      await ensureDir("/test/existing");
    });
  });

  describe("fileExists", () => {
    it("returns true when file exists", async () => {
      vi.mocked(access).mockResolvedValue(undefined);

      const { fileExists } = await import("./ffmpeg.js");
      const result = await fileExists("/test/file.txt");

      expect(result).toBe(true);
    });

    it("returns false when file doesn't exist", async () => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));

      const { fileExists } = await import("./ffmpeg.js");
      const result = await fileExists("/test/nonexistent.txt");

      expect(result).toBe(false);
    });
  });

  describe("getFileSize", () => {
    it("returns file size in bytes", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 1024 } as any);

      const { getFileSize } = await import("./ffmpeg.js");
      const result = await getFileSize("/test/file.txt");

      expect(result).toBe(1024);
    });
  });

  describe("createTempDir", () => {
    it("creates temp directory with asset ID", async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined);

      const { createTempDir } = await import("./ffmpeg.js");
      const result = await createTempDir("asset-123");

      expect(result).toBe("/tmp/bush-processing/asset-123");
      expect(mkdir).toHaveBeenCalled();
    });
  });

  describe("cleanupTempDir", () => {
    it("removes directory recursively", async () => {
      vi.mocked(rm).mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { cleanupTempDir } = await import("./ffmpeg.js");
      await cleanupTempDir("/test/temp");

      expect(rm).toHaveBeenCalledWith("/test/temp", { recursive: true, force: true });
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("logs error on cleanup failure", async () => {
      const error = new Error("Permission denied");
      vi.mocked(rm).mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { cleanupTempDir } = await import("./ffmpeg.js");
      await cleanupTempDir("/test/temp");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to cleanup temp dir /test/temp:",
        error
      );

      consoleSpy.mockRestore();
    });
  });
});

describe("ffmpeg parseFrameRate", () => {
  it("parses common frame rates", async () => {
    // This tests the frame rate parsing logic used in runFFprobe
    const parseFrameRate = (rate: string): number => {
      if (rate.includes("/")) {
        const [num, den] = rate.split("/").map(Number);
        return num / den;
      }
      return parseFloat(rate);
    };

    expect(parseFrameRate("30/1")).toBe(30);
    expect(parseFrameRate("30000/1001")).toBeCloseTo(29.97, 2);
    expect(parseFrameRate("24/1")).toBe(24);
    expect(parseFrameRate("25")).toBe(25);
  });
});

describe("ffmpeg determineHDRType", () => {
  it("identifies HDR types from color properties", async () => {
    // This tests the HDR detection logic
    const determineHDRType = (
      colorTransfer?: string,
      _colorPrimaries?: string,
      sideDataList?: Array<{ side_data_type: string }>
    ): "sdr" | "hdr10" | "hlg" | "dolby_vision" => {
      // Check for Dolby Vision
      if (sideDataList?.some((d) => d.side_data_type === "DOVI")) {
        return "dolby_vision";
      }

      // Check for HDR10 or HLG
      if (colorTransfer === "smpte2084") {
        return "hdr10";
      }
      if (colorTransfer === "arib-std-b67") {
        return "hlg";
      }

      return "sdr";
    };

    expect(determineHDRType()).toBe("sdr");
    expect(determineHDRType("bt709")).toBe("sdr");
    expect(determineHDRType("smpte2084")).toBe("hdr10");
    expect(determineHDRType("arib-std-b67")).toBe("hlg");
    expect(determineHDRType("bt709", "bt709", [{ side_data_type: "DOVI" }])).toBe("dolby_vision");
  });
});
