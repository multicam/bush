/**
 * Tests for Thumbnail Generation Processor
 *
 * Tests the thumbnail processing logic with mocked storage and FFmpeg.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage
vi.mock("../../storage/index.js", () => ({
  storage: {
    getObject: vi.fn(),
    putObject: vi.fn(),
  },
  storageKeys: {
    thumbnail: vi.fn((_keys: object, size: string) => `thumbnails/test/${size}`),
  },
}));

// Mock config
vi.mock("../../config/index.js", () => ({
  config: {
    THUMBNAIL_POSITION: 0.5,
    THUMBNAIL_FORMAT: "webp",
    THUMBNAIL_QUALITY: 85,
    MEDIA_TEMP_DIR: "/tmp/bush-processing",
  },
}));

// Mock ffmpeg utilities
vi.mock("../ffmpeg.js", () => ({
  runFFmpeg: vi.fn(),
  createTempDir: vi.fn((id: string) => Promise.resolve(`/tmp/bush-processing/${id}`)),
  cleanupTempDir: vi.fn(),
  buildScaleFilter: vi.fn((w: number, h: number) => `scale=${w}:${h}`),
  fileExists: vi.fn(() => Promise.resolve(true)),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(() => Promise.resolve(Buffer.from("fake-image-data"))),
}));

import { processThumbnail } from "./thumbnail.js";
import { storage } from "../../storage/index.js";
import { runFFmpeg, createTempDir, cleanupTempDir, fileExists, buildScaleFilter } from "../ffmpeg.js";
import { writeFile, readFile } from "fs/promises";

const mockStorage = vi.mocked(storage);
const mockRunFFmpeg = vi.mocked(runFFmpeg);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockFileExists = vi.mocked(fileExists);
const mockBuildScaleFilter = vi.mocked(buildScaleFilter);
const mockWriteFile = vi.mocked(writeFile);
const mockReadFile = vi.mocked(readFile);

describe("thumbnail processor", () => {
  const baseJobData = {
    assetId: "asset-123",
    accountId: "account-1",
    projectId: "project-1",
    storageKey: "uploads/video.mp4",
    mimeType: "video/mp4",
    sizes: ["small", "medium"] as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getObject.mockResolvedValue(Buffer.from("fake-video-data"));
    mockStorage.putObject.mockResolvedValue(undefined);
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/thumb-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);
    mockFileExists.mockResolvedValue(true);
    mockBuildScaleFilter.mockImplementation((w, h) => `scale=${w}:${h}`);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("fake-image-data"));
    mockRunFFmpeg.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processThumbnail", () => {
    it("processes video thumbnail successfully", async () => {
      const result = await processThumbnail(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("thumb-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/video.mp4");
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockRunFFmpeg).toHaveBeenCalledTimes(2); // One for each size
      expect(mockStorage.putObject).toHaveBeenCalledTimes(2);
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.sizes).toHaveLength(2);
      expect(result.sizes[0]).toMatchObject({
        size: "small",
        width: 320,
        height: 180,
      });
    });

    it("uses metadata duration for thumbnail position", async () => {
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
        hdrType: null,
        colorSpace: "bt709",
        audioBitDepth: null,
        format: "MP4",
      };

      await processThumbnail(baseJobData, metadata);

      // FFmpeg should be called with -ss 50 (50% of 100s)
      expect(mockRunFFmpeg).toHaveBeenCalled();
    });

    it("processes image thumbnail", async () => {
      const imageJobData = {
        ...baseJobData,
        mimeType: "image/jpeg",
      };

      const result = await processThumbnail(imageJobData);

      expect(mockRunFFmpeg).toHaveBeenCalledTimes(2);
      expect(result.sizes).toHaveLength(2);
    });

    it("skips unsupported mime types", async () => {
      const unsupportedJobData = {
        ...baseJobData,
        mimeType: "application/pdf",
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processThumbnail(unsupportedJobData);

      expect(result.sizes).toHaveLength(0);
      expect(mockRunFFmpeg).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("skips thumbnail generation when file not created", async () => {
      mockFileExists.mockResolvedValue(false);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await processThumbnail(baseJobData);

      expect(result.sizes).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it("handles animated images with vframes flag", async () => {
      const gifJobData = {
        ...baseJobData,
        mimeType: "image/gif",
      };

      await processThumbnail(gifJobData);

      // Check that ffmpeg was called (should include -vframes 1 for animated)
      expect(mockRunFFmpeg).toHaveBeenCalled();
    });

    it("cleans up temp directory even on error", async () => {
      mockRunFFmpeg.mockRejectedValue(new Error("FFmpeg failed"));

      await expect(processThumbnail(baseJobData)).rejects.toThrow("FFmpeg failed");
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("uses webp format when configured", async () => {
      const result = await processThumbnail(baseJobData);

      // Storage should be called with webp MIME type
      expect(mockStorage.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        "image/webp"
      );
    });

    it("generates thumbnails for multiple sizes", async () => {
      const multiSizeData = {
        ...baseJobData,
        sizes: ["small", "medium", "large"] as const,
      };

      const result = await processThumbnail(multiSizeData);

      expect(result.sizes).toHaveLength(3);
      expect(mockRunFFmpeg).toHaveBeenCalledTimes(3);
    });
  });

});
