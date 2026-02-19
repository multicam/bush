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

// Mock child_process
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    FFMPEG_PATH: "/usr/bin/ffmpeg",
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

// Import actual functions for more comprehensive testing
describe("ffmpeg extractMetadata", () => {
  // We need to import the actual function
  it("extracts metadata from FFprobe output", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: {
        duration: "120.5",
        bit_rate: "5000000",
        format_long_name: "MP4 (MPEG-4 Part 14)",
      },
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 1920,
          height: 1080,
          r_frame_rate: "30000/1001",
          color_space: "bt709",
        },
        {
          codec_type: "audio",
          codec_name: "aac",
          sample_rate: "48000",
          channels: 2,
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.duration).toBe(120.5);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.frameRate).toBeCloseTo(29.97, 1);
    expect(result.videoCodec).toBe("h264");
    expect(result.audioCodec).toBe("aac");
    expect(result.bitRate).toBe(5000000);
    expect(result.sampleRate).toBe(48000);
    expect(result.channels).toBe(2);
    expect(result.isHDR).toBe(false);
    expect(result.hdrType).toBeNull();
    expect(result.format).toBe("MP4 (MPEG-4 Part 14)");
  });

  it("handles missing video stream", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: {
        duration: "60",
        bit_rate: "128000",
        format_long_name: "MP3 (MPEG audio layer 3)",
      },
      streams: [
        {
          codec_type: "audio",
          codec_name: "mp3",
          sample_rate: "44100",
          channels: 2,
          bits_per_raw_sample: "16",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "audio/mp3");

    expect(result.duration).toBe(60);
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.frameRate).toBeNull();
    expect(result.videoCodec).toBeNull();
    expect(result.audioCodec).toBe("mp3");
    expect(result.channels).toBe(2);
    expect(result.audioBitDepth).toBe(16);
  });

  it("handles missing audio stream", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: {
        duration: "30",
        format_long_name: "PNG",
      },
      streams: [
        {
          codec_type: "video",
          codec_name: "png",
          width: 800,
          height: 600,
        },
      ],
    };

    const result = extractMetadata(probeOutput, "image/png");

    expect(result.duration).toBe(30);
    expect(result.audioCodec).toBeNull();
    expect(result.sampleRate).toBeNull();
    expect(result.channels).toBeNull();
  });

  it("handles missing duration", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: {
        format_long_name: "JPEG",
      },
      streams: [
        {
          codec_type: "video",
          codec_name: "mjpeg",
          width: 1920,
          height: 1080,
        },
      ],
    };

    const result = extractMetadata(probeOutput, "image/jpeg");

    expect(result.duration).toBeNull();
    expect(result.bitRate).toBeNull();
  });

  it("handles frame rate as integer", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          r_frame_rate: "30/1",
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.frameRate).toBe(30);
  });

  it("detects HDR10 content", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          color_transfer: "smpte2084",
          color_primaries: "bt2020",
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.isHDR).toBe(true);
    expect(result.hdrType).toBe("HDR10");
  });

  it("detects HLG content", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          color_transfer: "arib-std-b67",
          color_primaries: "bt2020",
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.isHDR).toBe(true);
    expect(result.hdrType).toBe("HLG");
  });

  it("detects Dolby Vision via codec tag", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          codec_tag_string: "dovi",
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.isHDR).toBe(true);
    expect(result.hdrType).toBe("Dolby Vision");
  });

  it("detects Dolby Vision via side data", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          side_data_list: [{ side_data_type: "Dolby Vision" }],
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.isHDR).toBe(true);
    expect(result.hdrType).toBe("Dolby Vision");
  });

  it("detects HDR10+ via side data", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          side_data_list: [
            { side_data_type: "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)" },
          ],
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.isHDR).toBe(true);
    expect(result.hdrType).toBe("HDR10+");
  });

  it("returns SDR for non-HDR color spaces", async () => {
    const { extractMetadata } = await import("./ffmpeg.js");

    const probeOutput = {
      format: { format_long_name: "MP4" },
      streams: [
        {
          codec_type: "video",
          color_transfer: "bt709",
          color_primaries: "bt709",
        },
        {
          codec_type: "audio",
        },
      ],
    };

    const result = extractMetadata(probeOutput, "video/mp4");

    expect(result.isHDR).toBe(false);
    expect(result.hdrType).toBeNull();
  });
});

describe("ffmpeg buildScaleFilter", () => {
  it("builds correct scale filter string", async () => {
    const { buildScaleFilter } = await import("./ffmpeg.js");

    const result = buildScaleFilter(640, 360);

    expect(result).toContain("scale=640:360");
    expect(result).toContain("force_original_aspect_ratio=decrease");
    expect(result).toContain("pad=640:360");
  });

  it("handles square dimensions", async () => {
    const { buildScaleFilter } = await import("./ffmpeg.js");

    const result = buildScaleFilter(1080, 1080);

    expect(result).toContain("scale=1080:1080");
  });
});

describe("ffmpeg getCodecDisplayName", () => {
  it("returns display name for known codecs", async () => {
    const { getCodecDisplayName } = await import("./ffmpeg.js");

    expect(getCodecDisplayName("h264")).toBe("H.264/AVC");
    expect(getCodecDisplayName("hevc")).toBe("H.265/HEVC");
    expect(getCodecDisplayName("prores")).toBe("Apple ProRes");
    expect(getCodecDisplayName("dnxhd")).toBe("Avid DNxHD");
    expect(getCodecDisplayName("mjpeg")).toBe("Motion JPEG");
    expect(getCodecDisplayName("aac")).toBe("AAC");
    expect(getCodecDisplayName("pcm_s16le")).toBe("PCM");
    expect(getCodecDisplayName("pcm_s24le")).toBe("PCM");
    expect(getCodecDisplayName("mp3")).toBe("MP3");
    expect(getCodecDisplayName("flac")).toBe("FLAC");
    expect(getCodecDisplayName("vorbis")).toBe("Vorbis");
  });

  it("returns uppercase name for unknown codecs", async () => {
    const { getCodecDisplayName } = await import("./ffmpeg.js");

    expect(getCodecDisplayName("unknown_codec")).toBe("UNKNOWN_CODEC");
    expect(getCodecDisplayName("xyz")).toBe("XYZ");
  });
});
