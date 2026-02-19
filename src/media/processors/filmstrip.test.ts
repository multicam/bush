/**
 * Tests for Filmstrip Generation Processor
 *
 * Tests the filmstrip sprite sheet generation logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage
vi.mock("../../storage/index.js", () => ({
  storage: {
    getObject: vi.fn(),
    putObject: vi.fn(),
  },
  storageKeys: {
    filmstrip: vi.fn((_keys: object) => "filmstrips/test.jpg"),
  },
}));

// Mock config
vi.mock("../../config/index.js", () => ({
  config: {
    MEDIA_TEMP_DIR: "/tmp/bush-processing",
  },
}));

// Mock ffmpeg utilities
vi.mock("../ffmpeg.js", () => ({
  runFFmpeg: vi.fn(),
  createTempDir: vi.fn((id: string) => Promise.resolve(`/tmp/bush-processing/${id}`)),
  cleanupTempDir: vi.fn(),
  fileExists: vi.fn(() => Promise.resolve(true)),
  getFileSize: vi.fn(() => Promise.resolve(512000)),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(() => Promise.resolve(Buffer.from("fake-filmstrip-data"))),
}));

import { processFilmstrip } from "./filmstrip.js";
import { storage } from "../../storage/index.js";
import { runFFmpeg, createTempDir, cleanupTempDir, fileExists, getFileSize } from "../ffmpeg.js";

const mockStorage = vi.mocked(storage);
const mockRunFFmpeg = vi.mocked(runFFmpeg);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockFileExists = vi.mocked(fileExists);
const mockGetFileSize = vi.mocked(getFileSize);

describe("filmstrip processor", () => {
  const baseJobData = {
    type: "filmstrip" as const,
    assetId: "asset-123",
    accountId: "account-1",
    projectId: "project-1",
    storageKey: "uploads/video.mp4",
    mimeType: "video/mp4",
    sourceFilename: "video.mp4",
    durationSeconds: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getObject.mockResolvedValue(Buffer.from("fake-video-data"));
    mockStorage.putObject.mockResolvedValue(undefined);
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/filmstrip-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);
    mockFileExists.mockResolvedValue(true);
    mockGetFileSize.mockResolvedValue(512000);
    mockRunFFmpeg.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processFilmstrip", () => {
    it("generates filmstrip for video successfully", async () => {
      const result = await processFilmstrip(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("filmstrip-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/video.mp4");
      expect(mockRunFFmpeg).toHaveBeenCalled();
      expect(mockStorage.putObject).toHaveBeenCalledTimes(2); // Image + manifest
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.storageKey).toContain("filmstrip");
      expect(result.manifestKey).toContain(".json");
      expect(result.totalFrames).toBeGreaterThan(0);
      expect(result.columns).toBeGreaterThan(0);
      expect(result.rows).toBeGreaterThan(0);
    });

    it("skips non-video files", async () => {
      const imageJobData = {
        ...baseJobData,
        mimeType: "image/jpeg",
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processFilmstrip(imageJobData);

      expect(result.storageKey).toBe("");
      expect(result.manifestKey).toBe("");
      expect(result.totalFrames).toBe(0);
      expect(mockRunFFmpeg).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("uses metadata duration when provided", async () => {
      const metadata = {
        duration: 120,
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

      const jobWithoutDuration = {
        ...baseJobData,
        durationSeconds: 0, // 0 indicates no duration in job data
      };

      const result = await processFilmstrip(jobWithoutDuration, metadata);

      // At 1 fps for 120 seconds, should have 120 frames
      expect(result.totalFrames).toBe(120);
    });

    it("skips when no duration available", async () => {
      const noDurationData = {
        ...baseJobData,
        durationSeconds: 0, // 0 indicates no duration
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processFilmstrip(noDurationData);

      expect(result.storageKey).toBe("");
      expect(result.totalFrames).toBe(0);

      consoleSpy.mockRestore();
    });

    it("skips when duration is zero", async () => {
      const zeroDurationData = {
        ...baseJobData,
        durationSeconds: 0,
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processFilmstrip(zeroDurationData);

      expect(result.storageKey).toBe("");

      consoleSpy.mockRestore();
    });

    it("returns empty result when filmstrip generation fails", async () => {
      mockFileExists.mockResolvedValue(false);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await processFilmstrip(baseJobData);

      expect(result.storageKey).toBe("");
      expect(result.totalFrames).toBe(0);

      consoleSpy.mockRestore();
    });

    it("cleans up temp directory even on error", async () => {
      mockRunFFmpeg.mockRejectedValue(new Error("FFmpeg failed"));

      await expect(processFilmstrip(baseJobData)).rejects.toThrow();
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("calculates correct frame count based on duration", async () => {
      const longVideoData = {
        ...baseJobData,
        durationSeconds: 120, // 2 minutes
      };

      const result = await processFilmstrip(longVideoData);

      // At 1 fps, should have ~120 frames
      expect(result.totalFrames).toBeCloseTo(120, 0);
    });

    it("uploads manifest JSON alongside image", async () => {
      await processFilmstrip(baseJobData);

      // Should upload both the image and the manifest
      const putObjectCalls = mockStorage.putObject.mock.calls;
      const manifestCall = putObjectCalls.find(
        (call) => call[2] === "application/json"
      );

      expect(manifestCall).toBeDefined();
    });

    it("manifest contains correct structure", async () => {
      await processFilmstrip(baseJobData);

      // Get the manifest that was uploaded
      const manifestCall = mockStorage.putObject.mock.calls.find(
        (call) => call[2] === "application/json"
      );
      const manifestBuffer = manifestCall?.[1] as Buffer;
      const manifest = JSON.parse(manifestBuffer.toString());

      expect(manifest).toHaveProperty("width");
      expect(manifest).toHaveProperty("height");
      expect(manifest).toHaveProperty("columns");
      expect(manifest).toHaveProperty("rows");
      expect(manifest).toHaveProperty("totalFrames");
      expect(manifest).toHaveProperty("intervalSeconds");
    });
  });

  describe("filmstrip configuration", () => {
    it("uses configured tile dimensions", async () => {
      const result = await processFilmstrip(baseJobData);

      // Default config uses 160x90 tiles
      expect(result.width).toBe(160);
      expect(result.height).toBe(90);
    });
  });
});
