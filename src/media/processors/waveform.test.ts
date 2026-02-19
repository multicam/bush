/**
 * Tests for Waveform Generation Processor
 *
 * Tests the waveform extraction logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage
vi.mock("../../storage/index.js", () => ({
  storage: {
    getObject: vi.fn(),
    putObject: vi.fn(),
  },
  storageKeys: {
    waveform: vi.fn((_keys: object, format: string) => `waveforms/test.${format}`),
  },
}));

// Mock config
vi.mock("../../config/index.js", () => ({
  config: {
    FFMPEG_PATH: "/usr/bin/ffmpeg",
    FFPROBE_PATH: "/usr/bin/ffprobe",
    MEDIA_TEMP_DIR: "/tmp/bush-processing",
  },
}));

// Mock ffmpeg utilities (without execFile)
vi.mock("../ffmpeg.js", () => ({
  runFFmpeg: vi.fn(),
  createTempDir: vi.fn((id: string) => Promise.resolve(`/tmp/bush-processing/${id}`)),
  cleanupTempDir: vi.fn(),
  fileExists: vi.fn(() => Promise.resolve(true)),
  getFileSize: vi.fn(() => Promise.resolve(1024)),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(() => Promise.resolve(Buffer.from("fake-audio-data"))),
}));

// Mock child_process
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import { processWaveform } from "./waveform.js";
import { storage } from "../../storage/index.js";
import { createTempDir, cleanupTempDir } from "../ffmpeg.js";
import { execFile } from "child_process";

const mockStorage = vi.mocked(storage);
const mockCreateTempDir = vi.mocked(createTempDir);
const mockCleanupTempDir = vi.mocked(cleanupTempDir);
const mockExecFile = vi.mocked(execFile);

describe("waveform processor", () => {
  const baseJobData = {
    assetId: "asset-123",
    accountId: "account-1",
    projectId: "project-1",
    storageKey: "uploads/audio.mp3",
    mimeType: "audio/mp3",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getObject.mockResolvedValue(Buffer.from("fake-audio-data"));
    mockStorage.putObject.mockResolvedValue(undefined);
    mockCreateTempDir.mockResolvedValue("/tmp/bush-processing/waveform-asset-123");
    mockCleanupTempDir.mockResolvedValue(undefined);

    // Mock FFprobe for duration
    mockExecFile.mockImplementation((_cmd: string, args: string[], _options: any, callback: any) => {
      if (args.includes("-show_format")) {
        // FFprobe call
        callback(null, {
          stdout: JSON.stringify({ format: { duration: "60" } }),
          stderr: "",
        });
      } else {
        // FFmpeg call for PCM extraction
        // Create a fake PCM buffer (4 bytes per sample, 1000 samples)
        const buffer = Buffer.alloc(4000);
        for (let i = 0; i < 1000; i++) {
          buffer.writeFloatLE(Math.sin(i / 100) * 0.5, i * 4);
        }
        callback(null, { stdout: buffer, stderr: "" });
      }
      return {} as any;
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processWaveform", () => {
    it("extracts waveform from audio file", async () => {
      const result = await processWaveform(baseJobData);

      expect(mockCreateTempDir).toHaveBeenCalledWith("waveform-asset-123");
      expect(mockStorage.getObject).toHaveBeenCalledWith("uploads/audio.mp3");
      expect(mockStorage.putObject).toHaveBeenCalled();
      expect(mockCleanupTempDir).toHaveBeenCalled();

      expect(result.storageKey).toContain("waveform");
      expect(result.sampleRate).toBeGreaterThan(0);
      expect(result.channels).toBe(1); // Mono
      expect(result.duration).toBe(60);
      expect(result.peaksCount).toBeGreaterThan(0);
    });

    it("processes video files (extracts audio)", async () => {
      const videoJobData = {
        ...baseJobData,
        mimeType: "video/mp4",
        storageKey: "uploads/video.mp4",
      };

      const result = await processWaveform(videoJobData);

      expect(result.storageKey).toContain("waveform");
      expect(result.duration).toBe(60);
    });

    it("skips non-audio/video files", async () => {
      const imageJobData = {
        ...baseJobData,
        mimeType: "image/jpeg",
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processWaveform(imageJobData);

      expect(result.storageKey).toBe("");
      expect(result.peaksCount).toBe(0);

      consoleSpy.mockRestore();
    });

    it("uses metadata duration when available", async () => {
      const metadata = {
        duration: 120,
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

      const result = await processWaveform(baseJobData, metadata);

      expect(result.duration).toBe(120);
    });

    it("skips when no duration found", async () => {
      mockExecFile.mockImplementation((_cmd: string, args: string[], _options: any, callback: any) => {
        if (args.includes("-show_format")) {
          callback(null, { stdout: JSON.stringify({ format: {} }), stderr: "" });
        } else {
          callback(null, { stdout: Buffer.alloc(0), stderr: "" });
        }
        return {} as any;
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await processWaveform(baseJobData);

      expect(result.storageKey).toBe("");
      expect(result.duration).toBe(0);

      consoleSpy.mockRestore();
    });

    it("cleans up temp directory even on error", async () => {
      mockStorage.getObject.mockRejectedValue(new Error("Storage error"));

      await expect(processWaveform(baseJobData)).rejects.toThrow();
      expect(mockCleanupTempDir).toHaveBeenCalled();
    });

    it("uploads waveform as JSON", async () => {
      await processWaveform(baseJobData);

      const putObjectCalls = mockStorage.putObject.mock.calls;
      const jsonCall = putObjectCalls.find(
        (call) => call[2] === "application/json"
      );

      expect(jsonCall).toBeDefined();
    });

    it("waveform JSON has correct structure", async () => {
      await processWaveform(baseJobData);

      const jsonCall = mockStorage.putObject.mock.calls.find(
        (call) => call[2] === "application/json"
      );
      const buffer = jsonCall?.[1] as Buffer;
      const waveformData = JSON.parse(buffer.toString());

      expect(waveformData).toHaveProperty("version");
      expect(waveformData).toHaveProperty("sampleRate");
      expect(waveformData).toHaveProperty("channels");
      expect(waveformData).toHaveProperty("duration");
      expect(waveformData).toHaveProperty("peaks");
      expect(Array.isArray(waveformData.peaks)).toBe(true);
    });
  });

  describe("peak extraction", () => {
    it("normalizes peaks to 0.0-1.0 range", async () => {
      await processWaveform(baseJobData);

      const jsonCall = mockStorage.putObject.mock.calls.find(
        (call) => call[2] === "application/json"
      );
      const buffer = jsonCall?.[1] as Buffer;
      const waveformData = JSON.parse(buffer.toString());

      for (const peak of waveformData.peaks) {
        expect(peak).toBeGreaterThanOrEqual(0);
        expect(peak).toBeLessThanOrEqual(1);
      }
    });
  });
});
