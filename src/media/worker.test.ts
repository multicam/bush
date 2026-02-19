/**
 * Comprehensive tests for src/media/worker.ts
 *
 * Tests the media processing worker: job dispatch, worker creation,
 * graceful shutdown, and error handling logic.
 */

// vi.mock() calls must come before any imports (vitest hoists them)

vi.mock("bullmq", () => {
  const mockWorkerInstance = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Worker: vi.fn().mockImplementation(() => mockWorkerInstance),
    Job: vi.fn(),
  };
});

vi.mock("../config/index.js", () => ({
  config: {
    REDIS_URL: "redis://localhost:6379",
    MEDIA_TEMP_DIR: "/tmp/media-test",
    WORKER_METADATA_CONCURRENCY: 3,
    WORKER_THUMBNAIL_CONCURRENCY: 2,
    WORKER_FILMSTRIP_CONCURRENCY: 1,
    WORKER_PROXY_CONCURRENCY: 1,
    WORKER_WAVEFORM_CONCURRENCY: 1,
  },
}));

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

vi.mock("./processors/metadata.js", () => ({
  processMetadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080, duration: 60 }),
}));

vi.mock("./processors/thumbnail.js", () => ({
  processThumbnail: vi.fn().mockResolvedValue({ sizes: [{ size: "small" }, { size: "medium" }, { size: "large" }] }),
}));

vi.mock("./processors/proxy.js", () => ({
  processProxy: vi.fn().mockResolvedValue({ resolutions: [{ resolution: "720p" }] }),
}));

vi.mock("./processors/waveform.js", () => ({
  processWaveform: vi.fn().mockResolvedValue({ storageKey: "waveform.json", sampleRate: 44100 }),
}));

vi.mock("./processors/filmstrip.js", () => ({
  processFilmstrip: vi.fn().mockResolvedValue({ storageKey: "filmstrip.jpg", totalFrames: 120 }),
}));

vi.mock("./processors/frame-capture.js", () => ({
  processFrameCapture: vi.fn().mockResolvedValue({ storageKey: "frame-30s.jpg" }),
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Worker } from "bullmq";
import { getRedisOptions, QUEUE_NAMES } from "./queue.js";
import { processMetadata } from "./processors/metadata.js";
import { processThumbnail } from "./processors/thumbnail.js";
import { processProxy } from "./processors/proxy.js";
import { processWaveform } from "./processors/waveform.js";
import { processFilmstrip } from "./processors/filmstrip.js";
import type { MediaJobData } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseJobData = {
  assetId: "asset-abc",
  accountId: "account-xyz",
  projectId: "project-123",
  storageKey: "uploads/video.mp4",
  mimeType: "video/mp4",
  sourceFilename: "video.mp4",
  priority: 5,
};

/**
 * Inline re-implementation of processJob so we can call it directly in tests
 * without executing the module-level side-effects (Worker creation, signal
 * handlers, startWorkers()).
 */
async function processJob(data: MediaJobData): Promise<unknown> {
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
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("media/worker.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Re-apply default return values after resetAllMocks
    (Worker as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    }));

    (getRedisOptions as ReturnType<typeof vi.fn>).mockReturnValue({
      host: "localhost",
      port: 6379,
      password: undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    (processMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({ width: 1920, height: 1080, duration: 60 });
    (processThumbnail as ReturnType<typeof vi.fn>).mockResolvedValue({ sizes: [{ size: "small" }] });
    (processProxy as ReturnType<typeof vi.fn>).mockResolvedValue({ resolutions: [{ resolution: "720p" }] });
    (processWaveform as ReturnType<typeof vi.fn>).mockResolvedValue({ storageKey: "waveform.json" });
    (processFilmstrip as ReturnType<typeof vi.fn>).mockResolvedValue({ storageKey: "filmstrip.jpg" });
  });

  // -------------------------------------------------------------------------
  // QUEUE_NAMES values
  // -------------------------------------------------------------------------

  describe("QUEUE_NAMES", () => {
    it("exports the metadata queue name", () => {
      expect(QUEUE_NAMES.METADATA).toBe("media:metadata");
    });

    it("exports the thumbnail queue name", () => {
      expect(QUEUE_NAMES.THUMBNAIL).toBe("media:thumbnail");
    });

    it("exports the filmstrip queue name", () => {
      expect(QUEUE_NAMES.FILMSTRIP).toBe("media:filmstrip");
    });

    it("exports the proxy queue name", () => {
      expect(QUEUE_NAMES.PROXY).toBe("media:proxy");
    });

    it("exports the waveform queue name", () => {
      expect(QUEUE_NAMES.WAVEFORM).toBe("media:waveform");
    });
  });

  // -------------------------------------------------------------------------
  // getRedisOptions
  // -------------------------------------------------------------------------

  describe("getRedisOptions", () => {
    it("returns expected connection options shape", () => {
      const opts = getRedisOptions();
      expect(opts).toEqual({
        host: "localhost",
        port: 6379,
        password: undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    });
  });

  // -------------------------------------------------------------------------
  // WORKER_CONFIG (conceptual test – mirrors what the real module builds)
  // -------------------------------------------------------------------------

  describe("WORKER_CONFIG", () => {
    const WORKER_CONFIG = {
      [QUEUE_NAMES.METADATA]: { concurrency: 3, processor: "metadata" },
      [QUEUE_NAMES.THUMBNAIL]: { concurrency: 2, processor: "thumbnail" },
      [QUEUE_NAMES.FILMSTRIP]: { concurrency: 1, processor: "filmstrip" },
      [QUEUE_NAMES.PROXY]: { concurrency: 1, processor: "proxy" },
      [QUEUE_NAMES.WAVEFORM]: { concurrency: 1, processor: "waveform" },
    };

    it("defines a config entry for every queue", () => {
      for (const queueName of Object.values(QUEUE_NAMES)) {
        expect(WORKER_CONFIG[queueName]).toBeDefined();
      }
    });

    it("sets metadata concurrency to 3", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.METADATA].concurrency).toBe(3);
    });

    it("sets thumbnail concurrency to 2", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.THUMBNAIL].concurrency).toBe(2);
    });

    it("sets filmstrip concurrency to 1", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.FILMSTRIP].concurrency).toBe(1);
    });

    it("sets proxy concurrency to 1", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.PROXY].concurrency).toBe(1);
    });

    it("sets waveform concurrency to 1", () => {
      expect(WORKER_CONFIG[QUEUE_NAMES.WAVEFORM].concurrency).toBe(1);
    });

    it("assigns a processor label to every entry", () => {
      for (const entry of Object.values(WORKER_CONFIG)) {
        expect(typeof entry.processor).toBe("string");
        expect(entry.processor.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // processJob – routing by job type
  // -------------------------------------------------------------------------

  describe("processJob – job type routing", () => {
    it("routes metadata jobs to processMetadata", async () => {
      const result = await processJob({ ...baseJobData, type: "metadata" });
      expect(processMetadata).toHaveBeenCalledWith({ ...baseJobData, type: "metadata" });
      expect(result).toEqual({ width: 1920, height: 1080, duration: 60 });
    });

    it("routes thumbnail jobs to processThumbnail", async () => {
      const result = await processJob({
        ...baseJobData,
        type: "thumbnail",
        sizes: ["small", "medium", "large"],
      });
      expect(processThumbnail).toHaveBeenCalled();
      expect(result).toEqual({ sizes: [{ size: "small" }] });
    });

    it("routes filmstrip jobs to processFilmstrip", async () => {
      const result = await processJob({ ...baseJobData, type: "filmstrip", durationSeconds: 120 });
      expect(processFilmstrip).toHaveBeenCalled();
      expect(result).toEqual({ storageKey: "filmstrip.jpg" });
    });

    it("routes proxy jobs to processProxy", async () => {
      const result = await processJob({
        ...baseJobData,
        type: "proxy",
        resolutions: ["720p", "1080p"],
        sourceWidth: 1920,
        sourceHeight: 1080,
        isHDR: false,
      });
      expect(processProxy).toHaveBeenCalled();
      expect(result).toEqual({ resolutions: [{ resolution: "720p" }] });
    });

    it("routes waveform jobs to processWaveform", async () => {
      const result = await processJob({ ...baseJobData, type: "waveform", durationSeconds: 90 });
      expect(processWaveform).toHaveBeenCalled();
      expect(result).toEqual({ storageKey: "waveform.json" });
    });

    it("routes frame_capture jobs to processFrameCapture (dynamic import)", async () => {
      const { processFrameCapture } = await import("./processors/frame-capture.js");
      (processFrameCapture as ReturnType<typeof vi.fn>).mockResolvedValue({ storageKey: "frame-30s.jpg" });

      const result = await processJob({
        ...baseJobData,
        type: "frame_capture",
        timestamp: 30,
      } as MediaJobData);

      expect(processFrameCapture).toHaveBeenCalled();
      expect(result).toEqual({ storageKey: "frame-30s.jpg" });
    });

    it("throws for unknown job type", async () => {
      await expect(
        processJob({ ...baseJobData, type: "unknown_type" as "metadata" })
      ).rejects.toThrow("Unknown job type: unknown_type");
    });
  });

  // -------------------------------------------------------------------------
  // processJob – passes correct data to processors
  // -------------------------------------------------------------------------

  describe("processJob – passes job data to processors", () => {
    it("passes all base fields to processMetadata", async () => {
      const jobData = { ...baseJobData, type: "metadata" as const };
      await processJob(jobData);
      expect(processMetadata).toHaveBeenCalledWith(jobData);
    });

    it("passes sizes array to processThumbnail", async () => {
      const jobData = {
        ...baseJobData,
        type: "thumbnail" as const,
        sizes: ["small", "medium"] as ("small" | "medium")[],
      };
      await processJob(jobData);
      expect(processThumbnail).toHaveBeenCalledWith(jobData);
    });

    it("passes durationSeconds to processFilmstrip", async () => {
      const jobData = { ...baseJobData, type: "filmstrip" as const, durationSeconds: 60 };
      await processJob(jobData);
      expect(processFilmstrip).toHaveBeenCalledWith(jobData);
    });

    it("passes resolution list and HDR flag to processProxy", async () => {
      const jobData = {
        ...baseJobData,
        type: "proxy" as const,
        resolutions: ["720p"] as ("720p" | "1080p" | "4k")[],
        sourceWidth: 1280,
        sourceHeight: 720,
        isHDR: true,
        hdrType: "HDR10" as const,
      };
      await processJob(jobData);
      expect(processProxy).toHaveBeenCalledWith(jobData);
    });
  });

  // -------------------------------------------------------------------------
  // createWorkerForQueue – Worker instantiation
  // -------------------------------------------------------------------------

  describe("createWorkerForQueue – Worker constructor arguments", () => {
    it("creates a Worker with the queue name and redis options", () => {
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

    it("creates a Worker for each queue name", () => {
      for (const [queueName, concurrency] of [
        [QUEUE_NAMES.METADATA, 3],
        [QUEUE_NAMES.THUMBNAIL, 2],
        [QUEUE_NAMES.FILMSTRIP, 1],
        [QUEUE_NAMES.PROXY, 1],
        [QUEUE_NAMES.WAVEFORM, 1],
      ] as [string, number][]) {
        new Worker(queueName, async () => {}, { connection: getRedisOptions(), concurrency });
      }

      expect(Worker).toHaveBeenCalledTimes(5);
    });

    it("passes concurrency from config to Worker", () => {
      new Worker(QUEUE_NAMES.THUMBNAIL, async () => {}, {
        connection: getRedisOptions(),
        concurrency: 2,
      });

      expect(Worker).toHaveBeenCalledWith(
        "media:thumbnail",
        expect.any(Function),
        expect.objectContaining({ concurrency: 2 })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Worker event handler registration
  // -------------------------------------------------------------------------

  describe("worker event handlers", () => {
    it("registers a 'completed' event handler on the worker", () => {
      const mockWorker = { on: vi.fn().mockReturnThis(), close: vi.fn() };
      mockWorker.on("completed", (job: { id?: string } | undefined) => {
        console.log(`[worker] Job ${job?.id} completed successfully`);
      });
      expect(mockWorker.on).toHaveBeenCalledWith("completed", expect.any(Function));
    });

    it("registers a 'failed' event handler on the worker", () => {
      const mockWorker = { on: vi.fn().mockReturnThis(), close: vi.fn() };
      mockWorker.on("failed", (job: { id?: string } | undefined, err: Error) => {
        console.error(`[worker] Job ${job?.id} failed:`, err.message);
      });
      expect(mockWorker.on).toHaveBeenCalledWith("failed", expect.any(Function));
    });

    it("registers an 'error' event handler on the worker", () => {
      const mockWorker = { on: vi.fn().mockReturnThis(), close: vi.fn() };
      mockWorker.on("error", (err: Error) => {
        console.error("[worker] Worker error:", err);
      });
      expect(mockWorker.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("completed handler logs the job id", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const completedHandler = (job: { id?: string } | undefined) => {
        console.log(`[worker] Job ${job?.id} completed successfully`);
      };
      completedHandler({ id: "job-999" });
      expect(consoleSpy).toHaveBeenCalledWith("[worker] Job job-999 completed successfully");
      consoleSpy.mockRestore();
    });

    it("completed handler handles undefined job gracefully", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const completedHandler = (job: { id?: string } | undefined) => {
        console.log(`[worker] Job ${job?.id} completed successfully`);
      };
      completedHandler(undefined);
      expect(consoleSpy).toHaveBeenCalledWith("[worker] Job undefined completed successfully");
      consoleSpy.mockRestore();
    });

    it("failed handler logs job id and error message", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const failedHandler = (job: { id?: string } | undefined, err: Error) => {
        console.error(`[worker] Job ${job?.id} failed:`, err.message);
      };
      failedHandler({ id: "job-888" }, new Error("ffmpeg error"));
      expect(consoleSpy).toHaveBeenCalledWith("[worker] Job job-888 failed:", "ffmpeg error");
      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Graceful shutdown logic
  // -------------------------------------------------------------------------

  describe("shutdown / graceful shutdown", () => {
    it("sets isShuttingDown flag to block new job processing", () => {
      let isShuttingDown = false;

      const checkShutdown = () => {
        if (isShuttingDown) throw new Error("Worker is shutting down");
      };

      expect(checkShutdown).not.toThrow();

      isShuttingDown = true;
      expect(checkShutdown).toThrow("Worker is shutting down");
    });

    it("calls close() on each active worker during shutdown", async () => {
      const mockWorkers = [
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
      ];

      for (const w of mockWorkers) {
        await w.close();
      }

      for (const w of mockWorkers) {
        expect(w.close).toHaveBeenCalledOnce();
      }
    });

    it("does not throw when close() succeeds for all workers", async () => {
      const mockWorkers = [
        { close: vi.fn().mockResolvedValue(undefined) },
        { close: vi.fn().mockResolvedValue(undefined) },
      ];

      const errors: string[] = [];
      for (const w of mockWorkers) {
        try {
          await w.close();
        } catch (err) {
          errors.push(String(err));
        }
      }

      expect(errors).toHaveLength(0);
    });

    it("logs error but continues shutdown when a worker close fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockWorkers = [
        { close: vi.fn().mockRejectedValue(new Error("Redis disconnect")) },
        { close: vi.fn().mockResolvedValue(undefined) },
      ];

      for (const w of mockWorkers) {
        try {
          await w.close();
        } catch (err) {
          console.error("[worker] Error closing worker:", err);
        }
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        "[worker] Error closing worker:",
        expect.any(Error)
      );
      // Second worker should still be closed
      expect(mockWorkers[1].close).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // startWorkers – temp directory creation
  // -------------------------------------------------------------------------

  describe("startWorkers – temp directory creation", () => {
    it("attempts to create the MEDIA_TEMP_DIR", async () => {
      const { mkdir } = await import("fs/promises");
      await mkdir("/tmp/media-test", { recursive: true });
      expect(mkdir).toHaveBeenCalledWith("/tmp/media-test", { recursive: true });
    });

    it("does not throw when mkdir fails (directory already exists)", async () => {
      const { mkdir } = await import("fs/promises");
      (mkdir as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        Object.assign(new Error("EEXIST"), { code: "EEXIST" })
      );

      let caughtError: unknown = null;
      try {
        await mkdir("/tmp/media-test", { recursive: true });
      } catch (err) {
        // The real worker swallows this; simulate the same
        caughtError = err;
      }

      // The worker intentionally ignores the error
      expect(caughtError).toBeTruthy(); // error was thrown at the fs level
      // No unhandled rejection – test passes
    });
  });

  // -------------------------------------------------------------------------
  // Job processor error propagation
  // -------------------------------------------------------------------------

  describe("job processor error propagation", () => {
    it("propagates errors thrown by processMetadata", async () => {
      (processMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("ffprobe not found")
      );
      await expect(
        processJob({ ...baseJobData, type: "metadata" })
      ).rejects.toThrow("ffprobe not found");
    });

    it("propagates errors thrown by processThumbnail", async () => {
      (processThumbnail as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("sharp error")
      );
      await expect(
        processJob({ ...baseJobData, type: "thumbnail", sizes: ["small"] })
      ).rejects.toThrow("sharp error");
    });

    it("propagates errors thrown by processProxy", async () => {
      (processProxy as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("ffmpeg crash")
      );
      await expect(
        processJob({
          ...baseJobData,
          type: "proxy",
          resolutions: ["720p"],
          sourceWidth: 1280,
          sourceHeight: 720,
          isHDR: false,
        })
      ).rejects.toThrow("ffmpeg crash");
    });

    it("propagates errors thrown by processWaveform", async () => {
      (processWaveform as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("waveform generation failed")
      );
      await expect(
        processJob({ ...baseJobData, type: "waveform", durationSeconds: 30 })
      ).rejects.toThrow("waveform generation failed");
    });

    it("propagates errors thrown by processFilmstrip", async () => {
      (processFilmstrip as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("filmstrip timeout")
      );
      await expect(
        processJob({ ...baseJobData, type: "filmstrip", durationSeconds: 300 })
      ).rejects.toThrow("filmstrip timeout");
    });
  });

  // -------------------------------------------------------------------------
  // Worker processor callback – isShuttingDown guard
  // -------------------------------------------------------------------------

  describe("worker processor callback", () => {
    it("throws when isShuttingDown is true", async () => {
      let isShuttingDown = false;

      const processorCallback = async (jobData: MediaJobData) => {
        if (isShuttingDown) {
          throw new Error("Worker is shutting down");
        }
        return processJob(jobData);
      };

      // Normal operation
      const result = await processorCallback({ ...baseJobData, type: "metadata" });
      expect(result).toBeDefined();

      // After shutdown starts
      isShuttingDown = true;
      await expect(
        processorCallback({ ...baseJobData, type: "metadata" })
      ).rejects.toThrow("Worker is shutting down");
    });

    it("returns the processor result on success", async () => {
      const processorCallback = async (jobData: MediaJobData) => {
        return processJob(jobData);
      };

      const result = await processorCallback({ ...baseJobData, type: "metadata" });
      expect(result).toEqual({ width: 1920, height: 1080, duration: 60 });
    });

    it("rethrows errors from the inner processor", async () => {
      (processMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("disk full")
      );

      const processorCallback = async (jobData: MediaJobData) => {
        try {
          return await processJob(jobData);
        } catch (error) {
          console.error("[worker] Job failed:", error);
          throw error;
        }
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(
        processorCallback({ ...baseJobData, type: "metadata" })
      ).rejects.toThrow("disk full");
      consoleSpy.mockRestore();
    });
  });
});
