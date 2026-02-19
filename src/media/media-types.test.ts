/**
 * Tests for media processing types and constants
 */
import { describe, it, expect } from "vitest";
import {
  QUEUE_NAMES,
  JOB_PRIORITY,
  JOB_TIMEOUTS,
  RETRY_CONFIG,
  THUMBNAIL_DIMENSIONS,
  PROXY_CONFIGS,
  FILMSTRIP_CONFIG,
  WAVEFORM_CONFIG,
} from "./types.js";
import type {
  MediaJobType,
  QueueName,
  ThumbnailSize,
  ProxyResolution,
  HDRType,
  JobStatus,
  BaseJobData,
  MetadataJobData,
  ThumbnailJobData,
  FilmstripJobData,
  ProxyJobData,
  WaveformJobData,
  FrameCaptureJobData,
  MediaJobData,
  MetadataJobResult,
  ThumbnailJobResult,
  FilmstripJobResult,
  ProxyJobResult,
  WaveformJobResult,
  ProcessingStatus,
} from "./types.js";

describe("media types", () => {
  describe("QUEUE_NAMES", () => {
    it("has METADATA queue name", () => {
      expect(QUEUE_NAMES.METADATA).toBe("media:metadata");
    });

    it("has THUMBNAIL queue name", () => {
      expect(QUEUE_NAMES.THUMBNAIL).toBe("media:thumbnail");
    });

    it("has FILMSTRIP queue name", () => {
      expect(QUEUE_NAMES.FILMSTRIP).toBe("media:filmstrip");
    });

    it("has PROXY queue name", () => {
      expect(QUEUE_NAMES.PROXY).toBe("media:proxy");
    });

    it("has WAVEFORM queue name", () => {
      expect(QUEUE_NAMES.WAVEFORM).toBe("media:waveform");
    });

    it("has exactly 5 queue names", () => {
      expect(Object.keys(QUEUE_NAMES)).toHaveLength(5);
    });
  });

  describe("JOB_PRIORITY", () => {
    it("has USER_REPROCESS as highest priority (1)", () => {
      expect(JOB_PRIORITY.USER_REPROCESS).toBe(1);
    });

    it("has STANDARD priority (5)", () => {
      expect(JOB_PRIORITY.STANDARD).toBe(5);
    });

    it("has BULK_UPLOAD as lowest priority (10)", () => {
      expect(JOB_PRIORITY.BULK_UPLOAD).toBe(10);
    });

    it("priorities are in ascending order", () => {
      expect(JOB_PRIORITY.USER_REPROCESS).toBeLessThan(JOB_PRIORITY.STANDARD);
      expect(JOB_PRIORITY.STANDARD).toBeLessThan(JOB_PRIORITY.BULK_UPLOAD);
    });
  });

  describe("JOB_TIMEOUTS", () => {
    it("has metadata timeout of 30 seconds", () => {
      expect(JOB_TIMEOUTS.metadata).toBe(30 * 1000);
    });

    it("has thumbnail timeout of 1 minute", () => {
      expect(JOB_TIMEOUTS.thumbnail).toBe(60 * 1000);
    });

    it("has filmstrip timeout of 5 minutes", () => {
      expect(JOB_TIMEOUTS.filmstrip).toBe(5 * 60 * 1000);
    });

    it("has proxy timeout of 30 minutes", () => {
      expect(JOB_TIMEOUTS.proxy).toBe(30 * 60 * 1000);
    });

    it("has waveform timeout of 2 minutes", () => {
      expect(JOB_TIMEOUTS.waveform).toBe(2 * 60 * 1000);
    });

    it("has frame_capture timeout of 1 minute", () => {
      expect(JOB_TIMEOUTS.frame_capture).toBe(60 * 1000);
    });

    it("proxy has longest timeout", () => {
      expect(JOB_TIMEOUTS.proxy).toBeGreaterThan(JOB_TIMEOUTS.filmstrip);
    });
  });

  describe("RETRY_CONFIG", () => {
    it("has max attempts of 3", () => {
      expect(RETRY_CONFIG.maxAttempts).toBe(3);
    });

    it("has exponential backoff type", () => {
      expect(RETRY_CONFIG.backoff.type).toBe("exponential");
    });

    it("has initial delay of 5 seconds", () => {
      expect(RETRY_CONFIG.backoff.delay).toBe(5000);
    });
  });

  describe("THUMBNAIL_DIMENSIONS", () => {
    it("has small dimensions (320x180)", () => {
      expect(THUMBNAIL_DIMENSIONS.small).toEqual({ width: 320, height: 180 });
    });

    it("has medium dimensions (640x360)", () => {
      expect(THUMBNAIL_DIMENSIONS.medium).toEqual({ width: 640, height: 360 });
    });

    it("has large dimensions (1280x720)", () => {
      expect(THUMBNAIL_DIMENSIONS.large).toEqual({ width: 1280, height: 720 });
    });

    it("dimensions have 16:9 aspect ratio", () => {
      for (const size of Object.values(THUMBNAIL_DIMENSIONS)) {
        expect(size.width / size.height).toBeCloseTo(16 / 9, 1);
      }
    });
  });

  describe("PROXY_CONFIGS", () => {
    it("has 360p config", () => {
      expect(PROXY_CONFIGS["360p"]).toEqual({
        width: 640,
        height: 360,
        videoBitrate: 800_000,
        audioBitrate: 128_000,
      });
    });

    it("has 540p config", () => {
      expect(PROXY_CONFIGS["540p"]).toEqual({
        width: 960,
        height: 540,
        videoBitrate: 1_500_000,
        audioBitrate: 128_000,
      });
    });

    it("has 720p config", () => {
      expect(PROXY_CONFIGS["720p"]).toEqual({
        width: 1280,
        height: 720,
        videoBitrate: 2_500_000,
        audioBitrate: 128_000,
      });
    });

    it("has 1080p config", () => {
      expect(PROXY_CONFIGS["1080p"]).toEqual({
        width: 1920,
        height: 1080,
        videoBitrate: 5_000_000,
        audioBitrate: 128_000,
      });
    });

    it("has 4k config", () => {
      expect(PROXY_CONFIGS["4k"]).toEqual({
        width: 3840,
        height: 2160,
        videoBitrate: 15_000_000,
        audioBitrate: 128_000,
      });
    });

    it("audio bitrate is consistent across all resolutions", () => {
      const audioBitrates = Object.values(PROXY_CONFIGS).map((c) => c.audioBitrate);
      expect(new Set(audioBitrates).size).toBe(1);
    });

    it("higher resolutions have higher video bitrates", () => {
      const resolutions = ["360p", "540p", "720p", "1080p", "4k"] as const;
      for (let i = 1; i < resolutions.length; i++) {
        expect(PROXY_CONFIGS[resolutions[i]].videoBitrate).toBeGreaterThan(
          PROXY_CONFIGS[resolutions[i - 1]].videoBitrate
        );
      }
    });
  });

  describe("FILMSTRIP_CONFIG", () => {
    it("has tile width of 160", () => {
      expect(FILMSTRIP_CONFIG.tileWidth).toBe(160);
    });

    it("has tile height of 90", () => {
      expect(FILMSTRIP_CONFIG.tileHeight).toBe(90);
    });

    it("has 10 columns", () => {
      expect(FILMSTRIP_CONFIG.columns).toBe(10);
    });

    it("has 1 fps for capture", () => {
      expect(FILMSTRIP_CONFIG.fps).toBe(1);
    });

    it("tile dimensions have 16:9 aspect ratio", () => {
      expect(FILMSTRIP_CONFIG.tileWidth / FILMSTRIP_CONFIG.tileHeight).toBeCloseTo(16 / 9, 1);
    });
  });

  describe("WAVEFORM_CONFIG", () => {
    it("has 10 samples per second", () => {
      expect(WAVEFORM_CONFIG.samplesPerSecond).toBe(10);
    });
  });

  describe("Type definitions compile correctly", () => {
    it("MediaJobType allows valid types", () => {
      const types: MediaJobType[] = [
        "metadata",
        "thumbnail",
        "filmstrip",
        "proxy",
        "waveform",
        "hls",
        "frame_capture",
      ];
      expect(types).toHaveLength(7);
    });

    it("QueueName allows valid queue names", () => {
      const names: QueueName[] = [
        QUEUE_NAMES.METADATA,
        QUEUE_NAMES.THUMBNAIL,
        QUEUE_NAMES.FILMSTRIP,
        QUEUE_NAMES.PROXY,
        QUEUE_NAMES.WAVEFORM,
      ];
      expect(names).toHaveLength(5);
    });

    it("ThumbnailSize allows valid sizes", () => {
      const sizes: ThumbnailSize[] = ["small", "medium", "large"];
      expect(sizes).toHaveLength(3);
    });

    it("ProxyResolution allows valid resolutions", () => {
      const resolutions: ProxyResolution[] = ["360p", "540p", "720p", "1080p", "4k"];
      expect(resolutions).toHaveLength(5);
    });

    it("HDRType allows valid HDR types", () => {
      const types: HDRType[] = ["HDR10", "HDR10+", "HLG", "Dolby Vision"];
      expect(types).toHaveLength(4);
    });

    it("JobStatus allows valid statuses", () => {
      const statuses: JobStatus[] = ["pending", "processing", "completed", "failed", "skipped"];
      expect(statuses).toHaveLength(5);
    });

    it("BaseJobData interface is valid", () => {
      const data: BaseJobData = {
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        priority: 5,
      };
      expect(data.assetId).toBe("asset-123");
    });

    it("MetadataJobData interface is valid", () => {
      const data: MetadataJobData = {
        type: "metadata",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
      };
      expect(data.type).toBe("metadata");
    });

    it("ThumbnailJobData interface is valid", () => {
      const data: ThumbnailJobData = {
        type: "thumbnail",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        sizes: ["small", "medium", "large"],
      };
      expect(data.sizes).toHaveLength(3);
    });

    it("FilmstripJobData interface is valid", () => {
      const data: FilmstripJobData = {
        type: "filmstrip",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        durationSeconds: 120,
      };
      expect(data.durationSeconds).toBe(120);
    });

    it("ProxyJobData interface is valid", () => {
      const data: ProxyJobData = {
        type: "proxy",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        resolutions: ["720p", "1080p"],
        sourceWidth: 1920,
        sourceHeight: 1080,
        isHDR: true,
        hdrType: "HDR10",
      };
      expect(data.isHDR).toBe(true);
    });

    it("WaveformJobData interface is valid", () => {
      const data: WaveformJobData = {
        type: "waveform",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        durationSeconds: 180,
      };
      expect(data.durationSeconds).toBe(180);
    });

    it("FrameCaptureJobData interface is valid", () => {
      const data: FrameCaptureJobData = {
        type: "frame_capture",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        timestamp: 30.5,
      };
      expect(data.timestamp).toBe(30.5);
    });

    it("MediaJobData union type works", () => {
      const metadataJob: MediaJobData = {
        type: "metadata",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
      };
      const thumbnailJob: MediaJobData = {
        type: "thumbnail",
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        sizes: ["small"],
      };
      expect(metadataJob.type).toBe("metadata");
      expect(thumbnailJob.type).toBe("thumbnail");
    });

    it("MetadataJobResult interface is valid", () => {
      const result: MetadataJobResult = {
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
        hdrType: null,
        colorSpace: "bt709",
        audioBitDepth: 24,
        format: "mp4",
      };
      expect(result.duration).toBe(120);
    });

    it("ThumbnailJobResult interface is valid", () => {
      const result: ThumbnailJobResult = {
        sizes: [
          { size: "small", storageKey: "thumb-small.jpg", width: 320, height: 180 },
          { size: "medium", storageKey: "thumb-medium.jpg", width: 640, height: 360 },
        ],
      };
      expect(result.sizes).toHaveLength(2);
    });

    it("FilmstripJobResult interface is valid", () => {
      const result: FilmstripJobResult = {
        storageKey: "filmstrip.jpg",
        manifestKey: "filmstrip.json",
        width: 1600,
        height: 90,
        columns: 10,
        rows: 1,
        totalFrames: 10,
      };
      expect(result.columns).toBe(10);
    });

    it("ProxyJobResult interface is valid", () => {
      const result: ProxyJobResult = {
        resolutions: [
          { resolution: "720p", storageKey: "proxy-720p.mp4", fileSize: 5000000 },
          { resolution: "1080p", storageKey: "proxy-1080p.mp4", fileSize: 10000000 },
        ],
      };
      expect(result.resolutions).toHaveLength(2);
    });

    it("WaveformJobResult interface is valid", () => {
      const result: WaveformJobResult = {
        storageKey: "waveform.json",
        sampleRate: 48000,
        channels: 2,
        duration: 120,
        peaksCount: 1200,
      };
      expect(result.peaksCount).toBe(1200);
    });

    it("ProcessingStatus interface is valid", () => {
      const status: ProcessingStatus = {
        metadata: "completed",
        thumbnail: "processing",
        filmstrip: "pending",
        proxy: "failed",
        waveform: "skipped",
      };
      expect(status.metadata).toBe("completed");
    });
  });
});
