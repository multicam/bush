/**
 * Tests for HLS Generation Processor
 *
 * Tests the HLS segmentation logic with mocked storage, DB, and FFmpeg.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage
vi.mock("../../storage/index.js", () => ({
  storage: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn().mockResolvedValue(null),
  },
  storageKeys: {
    hlsMaster: vi.fn((_keys: object) => "hls/test/master.m3u8"),
    hlsVariant: vi.fn(
      (_keys: object, resolution: string) => `hls/test/${resolution}/playlist.m3u8`
    ),
    hlsSegment: vi.fn(
      (_keys: object, resolution: string, num: number) =>
        `hls/test/${resolution}/segment_${String(num).padStart(4, "0")}.ts`
    ),
    caption: vi.fn((_keys: object, language = "en") => `captions/${language}.vtt`),
  },
}));

// Mock config
vi.mock("../../config/index.js", () => ({
  config: {
    PROXY_PRESET: "fast",
    MEDIA_TEMP_DIR: "/tmp/bush-processing",
    HLS_SEGMENT_DURATION: 6,
  },
}));

// Mock db
vi.mock("../../db/index.js", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

// Mock ffmpeg utilities
vi.mock("../ffmpeg.js", () => ({
  runFFmpeg: vi.fn(),
  createTempDir: vi.fn((id: string) => Promise.resolve(`/tmp/bush-processing/${id}`)),
  cleanupTempDir: vi.fn(),
  fileExists: vi.fn(() => Promise.resolve(true)),
  ensureDir: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(() => Promise.resolve(Buffer.from("fake-hls-data"))),
  readdir: vi.fn(() => Promise.resolve(["segment_0001.ts", "segment_0002.ts", "playlist.m3u8"])),
}));

import { processHLS } from "./hls.js";
import { storage } from "../../storage/index.js";
import { runFFmpeg, createTempDir, cleanupTempDir, fileExists, ensureDir } from "../ffmpeg.js";
import { db } from "../../db/index.js";

const mockStorage = vi.mocked(storage);
const mockRunFFmpeg = vi.mocked(runFFmpeg);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockFileExists = vi.mocked(fileExists);
const mockEnsureDir = vi.mocked(ensureDir);
const mockDb = vi.mocked(db);

describe("hls processor", () => {
  const baseJobData = {
    type: "hls" as const,
    assetId: "asset-123",
    accountId: "account-1",
    projectId: "project-1",
    storageKey: "uploads/video.mp4",
    mimeType: "video/mp4",
    sourceFilename: "video.mp4",
    resolutions: ["360p", "540p", "720p", "1080p"] as ("360p" | "540p" | "720p" | "1080p" | "4k")[],
    sourceWidth: 1920,
    sourceHeight: 1080,
    isHDR: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getObject.mockResolvedValue(Buffer.from("fake-video-data"));
    mockStorage.putObject.mockResolvedValue(undefined);
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/hls-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);
    mockFileExists.mockResolvedValue(true);
    mockEnsureDir.mockResolvedValue(undefined);
    mockRunFFmpeg.mockResolvedValue(undefined);

    // Reset db mock chain
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    } as any);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processHLS", () => {
    it("processes video HLS successfully", async () => {
      const result = await processHLS(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("hls-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/video.mp4");
      expect(mockRunFFmpeg).toHaveBeenCalledTimes(4); // One for each resolution
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.resolutions).toHaveLength(4);
      expect(result.masterPlaylistKey).toBe("hls/test/master.m3u8");
    });

    it("skips non-video files", async () => {
      const imageJobData = {
        ...baseJobData,
        mimeType: "image/jpeg",
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processHLS(imageJobData);

      expect(result.resolutions).toHaveLength(0);
      expect(result.masterPlaylistKey).toBe("");
      expect(mockRunFFmpeg).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("uses metadata when source dimensions not provided", async () => {
      const noDimensionData = {
        ...baseJobData,
        sourceWidth: 0,
        sourceHeight: 0,
      };

      const metadata = {
        duration: 100,
        width: 1920,
        height: 1080,
        frameRate: 30,
        videoCodec: "h264",
        audioCodec: "aac",
        bitRate: 5000000,
        sampleRate: 48000,
        channels: 2,
        isHDR: false,
        hdrType: null as ("HDR10" | "HDR10+" | "HLG" | "Dolby Vision") | null,
        colorSpace: "bt709",
        audioBitDepth: null as number | null,
        format: "MP4",
      };

      const result = await processHLS(noDimensionData as any, metadata);

      expect(result.resolutions.length).toBeGreaterThan(0);
    });

    it("continues on individual resolution failure", async () => {
      mockFileExists
        .mockResolvedValueOnce(false) // First resolution fails
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await processHLS(baseJobData);

      // Should have 3 successful resolutions
      expect(result.resolutions).toHaveLength(3);

      consoleSpy.mockRestore();
    });

    it("updates database on completion", async () => {
      const mockWhere = vi.fn();
      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: mockWhere,
        })),
      } as any);

      await processHLS(baseJobData);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("cleans up temp directory even on download error", async () => {
      mockStorage.getObject.mockRejectedValue(new Error("Storage error"));

      await expect(processHLS(baseJobData)).rejects.toThrow("Storage error");
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("filters out resolutions larger than source (4K excluded for 1080p)", async () => {
      const hdJobData = {
        ...baseJobData,
        resolutions: ["360p", "540p", "720p", "1080p", "4k"] as (
          | "360p"
          | "540p"
          | "720p"
          | "1080p"
          | "4k"
        )[],
        sourceHeight: 1080,
      };

      const result = await processHLS(hdJobData);

      // 4K should be filtered out since source is only 1080p
      const resolutionNames = result.resolutions.map((r) => r.resolution);
      expect(resolutionNames).not.toContain("4k");
      expect(resolutionNames).toContain("1080p");
    });

    it("includes 4K resolution for 4K source", async () => {
      const fourKJobData = {
        ...baseJobData,
        resolutions: ["360p", "540p", "720p", "1080p", "4k"] as (
          | "360p"
          | "540p"
          | "720p"
          | "1080p"
          | "4k"
        )[],
        sourceWidth: 3840,
        sourceHeight: 2160,
      };

      const result = await processHLS(fourKJobData);

      const resolutionNames = result.resolutions.map((r) => r.resolution);
      expect(resolutionNames).toContain("4k");
      expect(resolutionNames).toContain("1080p");
    });

    it("uploads segments and playlist for each resolution", async () => {
      await processHLS(baseJobData);

      // 4 resolutions * (1 playlist + 2 segments) = 12 + 1 master playlist = 13 uploads
      // Plus the master playlist
      expect(mockStorage.putObject).toHaveBeenCalled();
      const putObjectCalls = mockStorage.putObject.mock.calls.length;
      expect(putObjectCalls).toBeGreaterThan(4); // At least playlists
    });

    it("generates master playlist", async () => {
      const result = await processHLS(baseJobData);

      expect(result.masterPlaylistKey).toBeTruthy();
      expect(result.masterPlaylistKey).toContain("master.m3u8");
    });
  });

  describe("partial success handling", () => {
    it("handles complete failure gracefully", async () => {
      mockFileExists.mockResolvedValue(false);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await processHLS(baseJobData);

      expect(result.resolutions).toHaveLength(0);
      expect(result.masterPlaylistKey).toBe("");

      errorSpy.mockRestore();
    });

    it("continues when some resolutions fail FFmpeg", async () => {
      // Make first FFmpeg call fail
      mockRunFFmpeg.mockRejectedValueOnce(new Error("FFmpeg failed"));
      mockRunFFmpeg.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await processHLS(baseJobData);

      // Should still have some resolutions
      expect(result.resolutions.length).toBeGreaterThan(0);
      expect(result.resolutions.length).toBeLessThan(4);

      errorSpy.mockRestore();
    });
  });

  describe("HLS format validation", () => {
    it("calls FFmpeg with correct HLS arguments", async () => {
      await processHLS(baseJobData);

      const firstCall = mockRunFFmpeg.mock.calls[0];
      const args = firstCall[0];

      // Verify HLS-specific arguments
      expect(args).toContain("-f");
      expect(args).toContain("hls");
      expect(args).toContain("-hls_time");
      expect(args).toContain("6"); // HLS_SEGMENT_DURATION
      expect(args).toContain("-hls_list_size");
      expect(args).toContain("0");
      expect(args).toContain("-hls_playlist_type");
      expect(args).toContain("vod");
    });

    it("uses configured segment duration", async () => {
      await processHLS(baseJobData);

      const firstCall = mockRunFFmpeg.mock.calls[0];
      const args = firstCall[0];
      const hlsTimeIndex = args.indexOf("-hls_time");

      expect(args[hlsTimeIndex + 1]).toBe("6");
    });
  });
});
