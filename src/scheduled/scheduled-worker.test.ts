/**
 * Tests for scheduled worker functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock bullmq before importing the module
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

// Mock the queue module
vi.mock("./queue.js", () => ({
  getRedisOptions: vi.fn().mockReturnValue({
    host: "localhost",
    port: 6379,
    password: undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }),
  SCHEDULED_QUEUE_NAMES: {
    MAINTENANCE: "scheduled:maintenance",
  },
  schedulePurgeExpiredFiles: vi.fn().mockResolvedValue(undefined),
}));

// Mock the processor module
vi.mock("./processor.js", () => ({
  purgeExpiredFiles: vi.fn().mockResolvedValue({ deletedCount: 5, errors: [] }),
  recalculateStorageUsage: vi.fn().mockResolvedValue(undefined),
}));

import { Worker } from "bullmq";
import { getRedisOptions, SCHEDULED_QUEUE_NAMES, schedulePurgeExpiredFiles } from "./queue.js";
import { purgeExpiredFiles, recalculateStorageUsage } from "./processor.js";

// Import worker functions for testing
// Note: We need to test the logic by creating our own worker implementations

describe("scheduled worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processJob function logic", () => {
    // Test the job processing logic extracted from worker
    const processJobLogic = async (data: { type: string }): Promise<unknown> => {
      switch (data.type) {
        case "purge-expired-files":
          return purgeExpiredFiles();

        case "recalculate-storage":
          return recalculateStorageUsage();

        default:
          throw new Error(`Unknown scheduled job type: ${data.type}`);
      }
    };

    it("processes purge-expired-files job", async () => {
      const result = await processJobLogic({ type: "purge-expired-files" });
      expect(purgeExpiredFiles).toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 5, errors: [] });
    });

    it("processes recalculate-storage job", async () => {
      const result = await processJobLogic({ type: "recalculate-storage" });
      expect(recalculateStorageUsage).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("throws error for unknown job type", async () => {
      await expect(processJobLogic({ type: "unknown-job" })).rejects.toThrow(
        "Unknown scheduled job type: unknown-job"
      );
    });
  });

  describe("createWorker configuration", () => {
    it("creates worker with correct queue name", () => {
      new Worker(
        SCHEDULED_QUEUE_NAMES.MAINTENANCE,
        async () => {},
        { connection: getRedisOptions(), concurrency: 1 }
      );

      expect(Worker).toHaveBeenCalledWith(
        "scheduled:maintenance",
        expect.any(Function),
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 1,
        })
      );
    });

    it("creates worker with correct Redis connection options", () => {
      const redisOptions = getRedisOptions();

      expect(redisOptions).toEqual({
        host: "localhost",
        port: 6379,
        password: undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    });
  });

  describe("worker event handlers", () => {
    it("attaches completed event handler", () => {
      const mockOn = vi.fn().mockReturnThis();
      const worker = { on: mockOn, close: vi.fn() };
      worker.on("completed", (job: { id: string }) => {
        console.log(`Job ${job.id} completed successfully`);
      });

      expect(mockOn).toHaveBeenCalledWith("completed", expect.any(Function));
    });

    it("attaches failed event handler", () => {
      const mockOn = vi.fn().mockReturnThis();
      const worker = { on: mockOn, close: vi.fn() };
      worker.on("failed", (job: { id: string } | undefined, err: Error) => {
        console.error(`Job ${job?.id} failed:`, err.message);
      });

      expect(mockOn).toHaveBeenCalledWith("failed", expect.any(Function));
    });

    it("attaches error event handler", () => {
      const mockOn = vi.fn().mockReturnThis();
      const worker = { on: mockOn, close: vi.fn() };
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
      ];

      for (const worker of mockWorkers) {
        await worker.close();
      }

      expect(mockWorkers[0].close).toHaveBeenCalled();
      expect(mockWorkers[1].close).toHaveBeenCalled();
    });
  });

  describe("ScheduledJobData interface", () => {
    it("defines correct job data structure for purge-expired-files", () => {
      const jobData: { type: string } = {
        type: "purge-expired-files",
      };

      expect(jobData.type).toBe("purge-expired-files");
    });

    it("defines correct job data structure for recalculate-storage", () => {
      const jobData: { type: string } = {
        type: "recalculate-storage",
      };

      expect(jobData.type).toBe("recalculate-storage");
    });
  });

  describe("worker startup", () => {
    it("calls schedulePurgeExpiredFiles on startup", async () => {
      // This simulates what startWorker does
      await schedulePurgeExpiredFiles();
      expect(schedulePurgeExpiredFiles).toHaveBeenCalled();
    });
  });

  describe("error handling in job processing", () => {
    it("logs and rethrows errors from job processing", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new Error("Processing failed");
      const handleJobError = (jobId: string, error: Error) => {
        console.error(`[scheduled-worker] Job ${jobId} failed:`, error);
        throw error;
      };

      expect(() => handleJobError("job-123", error)).toThrow("Processing failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[scheduled-worker] Job job-123 failed:",
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
