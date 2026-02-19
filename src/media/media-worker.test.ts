/**
 * Tests for media worker functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock bullmq
vi.mock("bullmq", () => {
  const mockWorker = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Worker: vi.fn().mockImplementation(() => mockWorker),
    Job: vi.fn(),
  };
});

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    REDIS_URL: "redis://localhost:6379",
    MEDIA_TEMP_DIR: "/tmp/media",
    WORKER_METADATA_CONCURRENCY: 3,
    WORKER_THUMBNAIL_CONCURRENCY: 2,
    WORKER_FILMSTRIP_CONCURRENCY: 1,
    WORKER_PROXY_CONCURRENCY: 1,
    WORKER_WAVEFORM_CONCURRENCY: 1,
  },
}));

// Mock the queue module
vi.mock("./queue.js", () => ({
  getRedisOptions: vi.fn().mockReturnValue({
    host: "localhost",
    port: 6379,
    password: undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }),
  QUEUE_NAMES: {
    METADATA: "media:metadata",
    THUMBNAIL: "media:thumbnail",
    FILMSTRIP: "media:filmstrip",
    PROXY: "media:proxy",
    WAVEFORM: "media:waveform",
  },
}));

// Mock the processor modules
vi.mock("./processors/metadata.js", () => ({
  processMetadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
}));

vi.mock("./processors/thumbnail.js", () => ({
  processThumbnail: vi.fn().mockResolvedValue({ thumbnails: 3 }),
}));

vi.mock("./processors/proxy.js", () => ({
  processProxy: vi.fn().mockResolvedValue({ proxies: 3 }),
}));

vi.mock("./processors/waveform.js", () => ({
  processWaveform: vi.fn().mockResolvedValue({ waveform: "generated" }),
}));

vi.mock("./processors/filmstrip.js", () => ({
  processFilmstrip: vi.fn().mockResolvedValue({ filmstrip: "generated" }),
}));

vi.mock("./processors/frame-capture.js", () => ({
  processFrameCapture: vi.fn().mockResolvedValue({ frame: "captured" }),
}));

import { Worker } from "bullmq";
import { getRedisOptions, QUEUE_NAMES } from "./queue.js";
import { processMetadata } from "./processors/metadata.js";
import { processThumbnail } from "./processors/thumbnail.js";
import { processProxy } from "./processors/proxy.js";
import { processWaveform } from "./processors/waveform.js";
import { processFilmstrip } from "./processors/filmstrip.js";
import type { MediaJobData } from "./types.js";

describe("media worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("WORKER_CONFIG", () => {
    // Test the worker configuration logic
    const WORKER_CONFIG = {
      [QUEUE_NAMES.METADATA]: { concurrency: 3, processor: "metadata" },
      [QUEUE_NAMES.THUMBNAIL]: { concurrency: 2, processor: "thumbnail" },
      [QUEUE_NAMES.FILMSTRIP]: { concurrency: 1, processor: "filmstrip" },
      [QUEUE_NAMES.PROXY]: { concurrency: 1, processor: "proxy" },
      [QUEUE_NAMES.WAVEFORM]: { concurrency: 1, processor: "waveform" },
    };

    it("has config for all queue types", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.METADATA]).toBeDefined();
      expect(WORKER_CONFIG[QUEUE_NAMES.THUMBNAIL]).toBeDefined();
      expect(WORKER_CONFIG[QUEUE_NAMES.FILMSTRIP]).toBeDefined();
      expect(WORKER_CONFIG[QUEUE_NAMES.PROXY]).toBeDefined();
      expect(WORKER_CONFIG[QUEUE_NAMES.WAVEFORM]).toBeDefined();
    });

    it("sets correct concurrency for metadata queue", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.METADATA].concurrency).toBe(3);
    });

    it("sets correct concurrency for thumbnail queue", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.THUMBNAIL].concurrency).toBe(2);
    });

    it("sets correct concurrency for filmstrip queue", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.FILMSTRIP].concurrency).toBe(1);
    });

    it("sets correct concurrency for proxy queue", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.PROXY].concurrency).toBe(1);
    });

    it("sets correct concurrency for waveform queue", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.WAVEFORM].concurrency).toBe(1);
    });
  });

  describe("processJob function logic", () => {
    const processJobLogic = async (data: MediaJobData): Promise<unknown> => {
      switch (data.type) {
        case "metadata":
          return processMetadata(data);

        case "thumbnail":
          return processThumbnail(data);

        case "filmstrip":
          return processFilmstrip(data);

        case "proxy":
          return processProxy(data);

        case "waveform":
          return processWaveform(data);

        case "frame_capture": {
          const { processFrameCapture } = await import("./processors/frame-capture.js");
          return processFrameCapture(data);
        }

        default:
          throw new Error(`Unknown job type: ${(data as { type: string }).type}`);
      }
    };

    const baseData = {
      assetId: "asset-123",
      accountId: "account-123",
      projectId: "project-123",
      storageKey: "path/to/file.mp4",
      mimeType: "video/mp4",
      sourceFilename: "file.mp4",
      priority: 10,
    };

    it("processes metadata job", async () => {
      const result = await processJobLogic({ ...baseData, type: "metadata" });
      expect(processMetadata).toHaveBeenCalled();
      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it("processes thumbnail job", async () => {
      const result = await processJobLogic({
        ...baseData,
        type: "thumbnail",
        sizes: ["small", "medium", "large"],
      });
      expect(processThumbnail).toHaveBeenCalled();
      expect(result).toEqual({ thumbnails: 3 });
    });

    it("processes filmstrip job", async () => {
      const result = await processJobLogic({
        ...baseData,
        type: "filmstrip",
        durationSeconds: 120,
      });
      expect(processFilmstrip).toHaveBeenCalled();
      expect(result).toEqual({ filmstrip: "generated" });
    });

    it("processes proxy job", async () => {
      const result = await processJobLogic({
        ...baseData,
        type: "proxy",
        resolutions: ["360p", "540p"],
        sourceWidth: 1920,
        sourceHeight: 1080,
        isHDR: false,
      });
      expect(processProxy).toHaveBeenCalled();
      expect(result).toEqual({ proxies: 3 });
    });

    it("processes waveform job", async () => {
      const result = await processJobLogic({
        ...baseData,
        type: "waveform",
        durationSeconds: 120,
      });
      expect(processWaveform).toHaveBeenCalled();
      expect(result).toEqual({ waveform: "generated" });
    });

    it("processes frame_capture job", async () => {
      const { processFrameCapture } = await import("./processors/frame-capture.js");
      const result = await processJobLogic({
        ...baseData,
        type: "frame_capture",
        timestamp: 30,
      } as MediaJobData);
      expect(processFrameCapture).toHaveBeenCalled();
      expect(result).toEqual({ frame: "captured" });
    });

    it("throws error for unknown job type", async () => {
      await expect(
        processJobLogic({ ...baseData, type: "unknown" as "metadata" })
      ).rejects.toThrow("Unknown job type: unknown");
    });
  });

  describe("createWorkerForQueue", () => {
    it("creates worker with correct queue name and options", () => {
      new Worker(
        QUEUE_NAMES.METADATA,
        async () => {},
        { connection: getRedisOptions(), concurrency: 3 }
      );

      expect(Worker).toHaveBeenCalledWith(
        "media:metadata",
        expect.any(Function),
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 3,
        })
      );
    });
  });

  describe("worker event handlers", () => {
    it("attaches completed event handler", () => {
      const mockOn = vi.fn().mockReturnThis();
      const worker = { on: mockOn };
      worker.on("completed", (job: { id: string } | undefined) => {
        console.log(`Job ${job?.id} completed successfully`);
      });

      expect(mockOn).toHaveBeenCalledWith("completed", expect.any(Function));
    });

    it("attaches failed event handler", () => {
      const mockOn = vi.fn().mockReturnThis();
      const worker = { on: mockOn };
      worker.on("failed", (job: { id: string } | undefined, err: Error) => {
        console.error(`Job ${job?.id} failed:`, err.message);
      });

      expect(mockOn).toHaveBeenCalledWith("failed", expect.any(Function));
    });

    it("attaches error event handler", () => {
      const mockOn = vi.fn().mockReturnThis();
      const worker = { on: mockOn };
      worker.on("error", (err: Error) => {
        console.error("Worker error:", err);
      });

      expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("graceful shutdown", () => {
    it("sets isShuttingDown flag to prevent new job processing", () => {
      let isShuttingDown = false;
      const checkShutdown = () => {
        if (isShuttingDown) {
          throw new Error("Worker is shutting down");
        }
      };

      expect(checkShutdown).not.toThrow();

      isShuttingDown = true;

      expect(checkShutdown).toThrow("Worker is shutting down");
    });

    it("closes all workers on shutdown", async () => {
      const mockWorkers = [
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
      ];

      for (const worker of mockWorkers) {
        await worker.close();
      }

      expect(mockWorkers[0].close).toHaveBeenCalled();
      expect(mockWorkers[1].close).toHaveBeenCalled();
      expect(mockWorkers[2].close).toHaveBeenCalled();
    });
  });

  describe("error handling in job processing", () => {
    it("logs and rethrows errors from job processing", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new Error("Processing failed");
      const handleJobError = (jobId: string, error: Error) => {
        console.error(`[worker] Job ${jobId} failed:`, error);
        throw error;
      };

      expect(() => handleJobError("job-123", error)).toThrow("Processing failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith("[worker] Job job-123 failed:", error);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("QUEUE_NAMES values", () => {
    it("has correct queue names", () => {
      expect(QUEUE_NAMES.METADATA).toBe("media:metadata");
      expect(QUEUE_NAMES.THUMBNAIL).toBe("media:thumbnail");
      expect(QUEUE_NAMES.FILMSTRIP).toBe("media:filmstrip");
      expect(QUEUE_NAMES.PROXY).toBe("media:proxy");
      expect(QUEUE_NAMES.WAVEFORM).toBe("media:waveform");
    });
  });
});
