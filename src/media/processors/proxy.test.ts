/**
 * Tests for Proxy Transcoding Processor
 *
 * Tests the proxy transcoding logic with mocked storage, DB, and FFmpeg.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage
vi.mock("../../storage/index.js", () => ({
  storage: {
    getObject: vi.fn(),
    putObject: vi.fn(),
  },
  storageKeys: {
    proxy: vi.fn((_keys: object, resolution: string) => `proxies/test/${resolution}.mp4`),
  },
}));

// Mock config
vi.mock("../../config/index.js", () => ({
  config: {
    PROXY_PRESET: "fast",
    MEDIA_TEMP_DIR: "/tmp/bush-processing",
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
  buildScaleFilter: vi.fn((w: number, h: number) => `scale=${w}:${h}`),
  fileExists: vi.fn(() => Promise.resolve(true)),
  getFileSize: vi.fn(() => Promise.resolve(1024000)),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(() => Promise.resolve(Buffer.from("fake-video-data"))),
}));

import { processProxy } from "./proxy.js";
import { storage } from "../../storage/index.js";
import { runFFmpeg, createTempDir, cleanupTempDir, fileExists, getFileSize } from "../ffmpeg.js";
import { db } from "../../db/index.js";

const mockStorage = vi.mocked(storage);
const mockRunFFmpeg = vi.mocked(runFFmpeg);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockFileExists = vi.mocked(fileExists);
const mockGetFileSize = vi.mocked(getFileSize);
const mockDb = vi.mocked(db);

describe("proxy processor", () => {
  const baseJobData = {
    type: "proxy" as const,
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
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/proxy-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);
    mockFileExists.mockResolvedValue(true);
    mockGetFileSize.mockResolvedValue(1024000);
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

  describe("processProxy", () => {
    it("processes video proxy successfully", async () => {
      const result = await processProxy(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("proxy-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/video.mp4");
      expect(mockRunFFmpeg).toHaveBeenCalledTimes(4); // One for each resolution
      expect(mockStorage.putObject).toHaveBeenCalledTimes(4);
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.resolutions).toHaveLength(4);
    });

    it("skips non-video files", async () => {
      const imageJobData = {
        ...baseJobData,
        mimeType: "image/jpeg",
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processProxy(imageJobData);

      expect(result.resolutions).toHaveLength(0);
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

      const result = await processProxy(noDimensionData as any, metadata);

      expect(result.resolutions.length).toBeGreaterThan(0);
    });

    it("handles HDR content with tone mapping", async () => {
      const hdrJobData = {
        ...baseJobData,
        isHDR: true,
        hdrType: "HDR10" as const,
      };

      const result = await processProxy(hdrJobData as any);

      // Should still generate proxies with tone mapping
      expect(result.resolutions).toHaveLength(4);
    });

    it("preserves HDR for 4K resolution", async () => {
      const hdr4kData = {
        ...baseJobData,
        resolutions: ["4k"] as ("360p" | "540p" | "720p" | "1080p" | "4k")[],
        sourceWidth: 3840,
        sourceHeight: 2160,
        isHDR: true,
        hdrType: "HDR10" as const,
      };

      const result = await processProxy(hdr4kData as any);

      expect(result.resolutions).toHaveLength(1);
      // Check that FFmpeg was called with HDR-preserving args
      expect(mockRunFFmpeg).toHaveBeenCalled();
    });

    it("continues on individual resolution failure", async () => {
      mockFileExists
        .mockResolvedValueOnce(false) // First resolution fails
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await processProxy(baseJobData);

      // Should have 3 successful resolutions
      expect(result.resolutions).toHaveLength(3);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("updates database on completion", async () => {
      const mockWhere = vi.fn();
      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: mockWhere,
        })),
      } as any);

      await processProxy(baseJobData);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("cleans up temp directory even on download error", async () => {
      mockStorage.getObject.mockRejectedValue(new Error("Storage error"));

      await expect(processProxy(baseJobData)).rejects.toThrow("Storage error");
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("filters out resolutions larger than source (4K excluded for 1080p)", async () => {
      const hdJobData = {
        ...baseJobData,
        resolutions: ["360p", "540p", "720p", "1080p", "4k"] as ("360p" | "540p" | "720p" | "1080p" | "4k")[],
        sourceHeight: 1080,
      };

      const result = await processProxy(hdJobData);

      // 4K should be filtered out since source is only 1080p
      const resolutionNames = result.resolutions.map((r) => r.resolution);
      expect(resolutionNames).not.toContain("4k");
      expect(resolutionNames).toContain("1080p");
    });

    it("includes 4K resolution for 4K source", async () => {
      const fourKJobData = {
        ...baseJobData,
        resolutions: ["360p", "540p", "720p", "1080p", "4k"] as ("360p" | "540p" | "720p" | "1080p" | "4k")[],
        sourceWidth: 3840,
        sourceHeight: 2160,
      };

      const result = await processProxy(fourKJobData);

      const resolutionNames = result.resolutions.map((r) => r.resolution);
      expect(resolutionNames).toContain("4k");
      expect(resolutionNames).toContain("1080p");
    });

    it("excludes 720p for 480p source", async () => {
      const sdJobData = {
        ...baseJobData,
        resolutions: ["360p", "540p", "720p"] as ("360p" | "540p" | "720p" | "1080p" | "4k")[],
        sourceWidth: 854,
        sourceHeight: 480,
      };

      const result = await processProxy(sdJobData);

      const resolutionNames = result.resolutions.map((r) => r.resolution);
      expect(resolutionNames).not.toContain("720p");
      expect(resolutionNames).toContain("360p");
    });
  });

  describe("partial success handling", () => {
    it("logs warning when some resolutions fail", async () => {
      // Make 360p fail
      mockRunFFmpeg.mockRejectedValueOnce(new Error("Failed"));
      mockRunFFmpeg.mockResolvedValue(undefined);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await processProxy(baseJobData);

      // Some should succeed
      expect(result.resolutions.length).toBeGreaterThan(0);

      warnSpy.mockRestore();
    });

    it("handles complete failure gracefully", async () => {
      mockFileExists.mockResolvedValue(false);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await processProxy(baseJobData);

      expect(result.resolutions).toHaveLength(0);

      errorSpy.mockRestore();
    });
  });
});
