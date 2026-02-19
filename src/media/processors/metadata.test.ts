/**
 * Tests for Metadata Extraction Processor
 *
 * Tests the metadata extraction logic.
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
  },
}));

// Mock ffmpeg utilities
vi.mock("../ffmpeg.js", () => ({
  runFFprobe: vi.fn(),
  extractMetadata: vi.fn(),
  createTempDir: vi.fn((id: string) => Promise.resolve(`/tmp/bush-processing/${id}`)),
  cleanupTempDir: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
}));

import { processMetadata } from "./metadata.js";
import { storage } from "../../storage/index.js";
import { runFFprobe, extractMetadata, createTempDir, cleanupTempDir } from "../ffmpeg.js";
import { db } from "../../db/index.js";

const mockStorage = vi.mocked(storage);
const mockRunFFprobe = vi.mocked(runFFprobe);
const mockExtractMetadata = vi.mocked(extractMetadata);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockDb = vi.mocked(db);

describe("metadata processor", () => {
  const baseJobData = {
    type: "metadata" as const,
    assetId: "asset-123",
    accountId: "account-1",
    projectId: "project-1",
    storageKey: "uploads/video.mp4",
    mimeType: "video/mp4",
    sourceFilename: "video.mp4",
  };

  const mockMetadata = {
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
    audioBitDepth: null,
    format: "MP4",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getObject.mockResolvedValue(Buffer.from("fake-video-data"));
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/metadata-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);
    mockRunFFprobe.mockResolvedValue({
      format: { duration: "120", format_long_name: "MP4" },
      streams: [],
    } as any);
    mockExtractMetadata.mockReturnValue(mockMetadata);

    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    } as any);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processMetadata", () => {
    it("extracts metadata from video file", async () => {
      const result = await processMetadata(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("metadata-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/video.mp4");
      expect(mockRunFFprobe).toHaveBeenCalled();
      expect(mockExtractMetadata).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.duration).toBe(120);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it("handles audio files", async () => {
      const audioJobData = {
        ...baseJobData,
        mimeType: "audio/mp3",
        storageKey: "uploads/audio.mp3",
      };

      const audioMetadata = {
        duration: 180,
        width: null,
        height: null,
        frameRate: null,
        videoCodec: null,
        audioCodec: "mp3",
        bitRate: 128000,
        sampleRate: 44100,
        channels: 2,
        isHDR: false,
        hdrType: null,
        colorSpace: null,
        audioBitDepth: null,
        format: "MP3",
      };

      mockExtractMetadata.mockReturnValue(audioMetadata);

      const result = await processMetadata(audioJobData);

      expect(result.duration).toBe(180);
      expect(result.audioCodec).toBe("mp3");
    });

    it("handles HDR content", async () => {
      const hdrMetadata = {
        ...mockMetadata,
        isHDR: true,
        hdrType: "HDR10" as const,
      };

      mockExtractMetadata.mockReturnValue(hdrMetadata);

      const result = await processMetadata(baseJobData);

      expect(result.isHDR).toBe(true);
      expect(result.hdrType).toBe("HDR10");
    });

    it("handles Dolby Vision content", async () => {
      const dvMetadata = {
        ...mockMetadata,
        isHDR: true,
        hdrType: "Dolby Vision" as const,
      };

      mockExtractMetadata.mockReturnValue(dvMetadata);

      const result = await processMetadata(baseJobData);

      expect(result.isHDR).toBe(true);
      expect(result.hdrType).toBe("Dolby Vision");
    });

    it("updates database with technical metadata", async () => {
      const mockSet = vi.fn(() => ({ where: vi.fn() }));
      mockDb.update.mockReturnValue({
        set: mockSet,
      } as any);

      await processMetadata(baseJobData);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          technicalMetadata: expect.any(Object),
          updatedAt: expect.any(Date),
        })
      );
    });

    it("cleans up temp directory even on error", async () => {
      mockRunFFprobe.mockRejectedValue(new Error("FFprobe failed"));

      await expect(processMetadata(baseJobData)).rejects.toThrow();
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("logs extracted metadata on success", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await processMetadata(baseJobData);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[metadata]"),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it("handles MOV files", async () => {
      const movJobData = {
        ...baseJobData,
        mimeType: "video/quicktime",
        storageKey: "uploads/video.mov",
      };

      const result = await processMetadata(movJobData);

      expect(result.duration).toBe(120);
    });

    it("handles image files", async () => {
      const imageJobData = {
        ...baseJobData,
        mimeType: "image/jpeg",
        storageKey: "uploads/photo.jpg",
      };

      const imageMetadata = {
        duration: null,
        width: 1920,
        height: 1080,
        frameRate: null,
        videoCodec: null,
        audioCodec: null,
        bitRate: null,
        sampleRate: null,
        channels: null,
        isHDR: false,
        hdrType: null,
        colorSpace: "bt709",
        audioBitDepth: null,
        format: "JPEG",
      };

      mockExtractMetadata.mockReturnValue(imageMetadata);

      const result = await processMetadata(imageJobData);

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });
  });
});
