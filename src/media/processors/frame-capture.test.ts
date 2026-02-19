/**
 * Tests for Frame Capture Processor
 *
 * Tests the frame capture logic for custom thumbnails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// Mock storage
vi.mock("../../storage/index.js", () => ({
  storage: {
    getObject: vi.fn(),
    putObject: vi.fn(),
  },
  storageKeys: {
    customThumbnail: vi.fn((_keys: object, size: string) => `custom-thumbnails/test-${size}.jpg`),
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
  readFile: vi.fn(() => Promise.resolve(Buffer.from("fake-frame-data"))),
}));

import { processFrameCapture } from "./frame-capture.js";
import { storage } from "../../storage/index.js";
import { runFFmpeg, createTempDir, cleanupTempDir, fileExists } from "../ffmpeg.js";
import { db } from "../../db/index.js";

const mockStorage = vi.mocked(storage);
const mockRunFFmpeg = vi.mocked(runFFmpeg);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockFileExists = vi.mocked(fileExists);
const mockDb = vi.mocked(db);

describe("frame-capture processor", () => {
  const baseJobData = {
    assetId: "asset-123",
    accountId: "account-1",
    projectId: "project-1",
    storageKey: "uploads/video.mp4",
    timestamp: 30, // 30 seconds
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getObject.mockResolvedValue(Buffer.from("fake-video-data"));
    mockStorage.putObject.mockResolvedValue(undefined);
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/frame-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);
    mockFileExists.mockResolvedValue(true);
    mockRunFFmpeg.mockResolvedValue(undefined);

    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    } as any);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processFrameCapture", () => {
    it("captures frame at specified timestamp", async () => {
      const result = await processFrameCapture(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("frame-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/video.mp4");
      expect(mockRunFFmpeg).toHaveBeenCalled();
      expect(mockStorage.putObject).toHaveBeenCalled();
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.storageKey).toContain("custom-thumbnails");
    });

    it("uses correct timestamp in FFmpeg command", async () => {
      await processFrameCapture({ ...baseJobData, timestamp: 45.5 });

      // FFmpeg should be called with -ss 45.5
      expect(mockRunFFmpeg).toHaveBeenCalledWith(
        expect.arrayContaining(["-ss", "45.5"]),
        expect.any(Number)
      );
    });

    it("captures single frame only", async () => {
      await processFrameCapture(baseJobData);

      // Should use -vframes 1
      expect(mockRunFFmpeg).toHaveBeenCalledWith(
        expect.arrayContaining(["-vframes", "1"]),
        expect.any(Number)
      );
    });

    it("uses high quality JPEG settings", async () => {
      await processFrameCapture(baseJobData);

      // Should use quality 2 (high quality)
      expect(mockRunFFmpeg).toHaveBeenCalledWith(
        expect.arrayContaining(["-q:v", "2"]),
        expect.any(Number)
      );
    });

    it("throws when frame capture fails", async () => {
      mockFileExists.mockResolvedValue(false);

      await expect(processFrameCapture(baseJobData)).rejects.toThrow(
        "Failed to capture frame at 30s"
      );
    });

    it("updates database with custom thumbnail key", async () => {
      const mockSet = vi.fn(() => ({ where: vi.fn() }));
      mockDb.update.mockReturnValue({
        set: mockSet,
      } as any);

      await processFrameCapture(baseJobData);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          customThumbnailKey: expect.any(String),
          updatedAt: expect.any(Date),
        })
      );
    });

    it("cleans up temp directory even on error", async () => {
      mockRunFFmpeg.mockRejectedValue(new Error("FFmpeg failed"));

      await expect(processFrameCapture(baseJobData)).rejects.toThrow();
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("handles zero timestamp", async () => {
      const result = await processFrameCapture({ ...baseJobData, timestamp: 0 });

      expect(result.storageKey).toContain("custom-thumbnails");
    });

    it("handles fractional timestamps", async () => {
      const result = await processFrameCapture({ ...baseJobData, timestamp: 12.75 });

      expect(result.storageKey).toContain("custom-thumbnails");
    });

    it("logs capture progress", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await processFrameCapture(baseJobData);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[frame-capture]")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("frame capture dimensions", () => {
    it("uses medium thumbnail dimensions (640x360)", async () => {
      await processFrameCapture(baseJobData);

      // Should use medium size dimensions
      expect(mockRunFFmpeg).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining("640"),
        ]),
        expect.any(Number)
      );
    });
  });
});
