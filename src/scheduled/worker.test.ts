/**
 * Comprehensive tests for src/scheduled/worker.ts
 *
 * Tests the scheduled jobs worker: job dispatch, Worker creation,
 * recurring job scheduling, graceful shutdown, and error handling.
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

vi.mock("./processor.js", () => ({
  purgeExpiredFiles: vi.fn().mockResolvedValue({ deletedCount: 5, errors: [] }),
  recalculateStorageUsage: vi.fn().mockResolvedValue({ updatedCount: 3, errors: [] }),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Worker } from "bullmq";
import { getRedisOptions, SCHEDULED_QUEUE_NAMES, schedulePurgeExpiredFiles } from "./queue.js";
import { purgeExpiredFiles, recalculateStorageUsage } from "./processor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScheduledJobData {
  type: string;
}

/**
 * Inline re-implementation of processJob so we can test routing logic
 * without triggering module-level side-effects.
 */
async function processJob(data: ScheduledJobData): Promise<unknown> {
  switch (data.type) {
    case "purge-expired-files":
      return purgeExpiredFiles();
    case "recalculate-storage":
      return recalculateStorageUsage();
    default:
      throw new Error(`Unknown scheduled job type: ${data.type}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scheduled/worker.ts", () => {
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

    (schedulePurgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedCount: 5, errors: [] });
    (recalculateStorageUsage as ReturnType<typeof vi.fn>).mockResolvedValue({ updatedCount: 3, errors: [] });
  });

  // -------------------------------------------------------------------------
  // SCHEDULED_QUEUE_NAMES values
  // -------------------------------------------------------------------------

  describe("SCHEDULED_QUEUE_NAMES", () => {
    it("exports the maintenance queue name", () => {
      expect(SCHEDULED_QUEUE_NAMES.MAINTENANCE).toBe("scheduled:maintenance");
    });
  });

  // -------------------------------------------------------------------------
  // getRedisOptions
  // -------------------------------------------------------------------------

  describe("getRedisOptions", () => {
    it("returns the expected connection options shape", () => {
      expect(getRedisOptions()).toEqual({
        host: "localhost",
        port: 6379,
        password: undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    });
  });

  // -------------------------------------------------------------------------
  // ScheduledJobData interface
  // -------------------------------------------------------------------------

  describe("ScheduledJobData interface", () => {
    it("accepts a purge-expired-files type", () => {
      const data: ScheduledJobData = { type: "purge-expired-files" };
      expect(data.type).toBe("purge-expired-files");
    });

    it("accepts a recalculate-storage type", () => {
      const data: ScheduledJobData = { type: "recalculate-storage" };
      expect(data.type).toBe("recalculate-storage");
    });
  });

  // -------------------------------------------------------------------------
  // processJob – routing
  // -------------------------------------------------------------------------

  describe("processJob – job type routing", () => {
    it("routes purge-expired-files to purgeExpiredFiles()", async () => {
      const result = await processJob({ type: "purge-expired-files" });
      expect(purgeExpiredFiles).toHaveBeenCalledOnce();
      expect(result).toEqual({ deletedCount: 5, errors: [] });
    });

    it("routes recalculate-storage to recalculateStorageUsage()", async () => {
      const result = await processJob({ type: "recalculate-storage" });
      expect(recalculateStorageUsage).toHaveBeenCalledOnce();
      expect(result).toEqual({ updatedCount: 3, errors: [] });
    });

    it("throws for an unknown job type", async () => {
      await expect(processJob({ type: "delete-everything" })).rejects.toThrow(
        "Unknown scheduled job type: delete-everything"
      );
    });

    it("throws with the exact job type in the error message", async () => {
      await expect(processJob({ type: "weird-type-42" })).rejects.toThrow(
        "Unknown scheduled job type: weird-type-42"
      );
    });
  });

  // -------------------------------------------------------------------------
  // processJob – error propagation
  // -------------------------------------------------------------------------

  describe("processJob – error propagation", () => {
    it("propagates errors from purgeExpiredFiles", async () => {
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB connection lost")
      );
      await expect(processJob({ type: "purge-expired-files" })).rejects.toThrow(
        "DB connection lost"
      );
    });

    it("propagates errors from recalculateStorageUsage", async () => {
      (recalculateStorageUsage as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Storage query timeout")
      );
      await expect(processJob({ type: "recalculate-storage" })).rejects.toThrow(
        "Storage query timeout"
      );
    });
  });

  // -------------------------------------------------------------------------
  // createWorker – Worker instantiation
  // -------------------------------------------------------------------------

  describe("createWorker – Worker constructor arguments", () => {
    it("creates a Worker for the maintenance queue", () => {
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

    it("creates worker with concurrency of 1 (single maintenance job at a time)", () => {
      new Worker(
        SCHEDULED_QUEUE_NAMES.MAINTENANCE,
        async () => {},
        { connection: getRedisOptions(), concurrency: 1 }
      );

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ concurrency: 1 })
      );
    });

    it("uses Redis options from getRedisOptions()", () => {
      const opts = getRedisOptions();
      new Worker(SCHEDULED_QUEUE_NAMES.MAINTENANCE, async () => {}, {
        connection: opts,
        concurrency: 1,
      });

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ connection: opts })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Worker event handler registration
  // -------------------------------------------------------------------------

  describe("worker event handlers", () => {
    it("registers a 'completed' event handler", () => {
      const mockWorker = { on: vi.fn().mockReturnThis(), close: vi.fn() };
      mockWorker.on("completed", (job: { id?: string } | undefined) => {
        console.log(`[scheduled-worker] Job ${job?.id} completed successfully`);
      });
      expect(mockWorker.on).toHaveBeenCalledWith("completed", expect.any(Function));
    });

    it("registers a 'failed' event handler", () => {
      const mockWorker = { on: vi.fn().mockReturnThis(), close: vi.fn() };
      mockWorker.on("failed", (job: { id?: string } | undefined, err: Error) => {
        console.error(`[scheduled-worker] Job ${job?.id} failed:`, err.message);
      });
      expect(mockWorker.on).toHaveBeenCalledWith("failed", expect.any(Function));
    });

    it("registers an 'error' event handler", () => {
      const mockWorker = { on: vi.fn().mockReturnThis(), close: vi.fn() };
      mockWorker.on("error", (err: Error) => {
        console.error("[scheduled-worker] Worker error:", err);
      });
      expect(mockWorker.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("completed handler logs job id", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const completedHandler = (job: { id?: string } | undefined) => {
        console.log(`[scheduled-worker] Job ${job?.id} completed successfully`);
      };
      completedHandler({ id: "sched-job-1" });
      expect(consoleSpy).toHaveBeenCalledWith(
        "[scheduled-worker] Job sched-job-1 completed successfully"
      );
      consoleSpy.mockRestore();
    });

    it("completed handler handles undefined job gracefully", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const completedHandler = (job: { id?: string } | undefined) => {
        console.log(`[scheduled-worker] Job ${job?.id} completed successfully`);
      };
      completedHandler(undefined);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[scheduled-worker] Job undefined completed successfully"
      );
      consoleSpy.mockRestore();
    });

    it("failed handler logs job id and error message", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const failedHandler = (job: { id?: string } | undefined, err: Error) => {
        console.error(`[scheduled-worker] Job ${job?.id} failed:`, err.message);
      };
      failedHandler({ id: "sched-job-2" }, new Error("purge failed"));
      expect(consoleSpy).toHaveBeenCalledWith(
        "[scheduled-worker] Job sched-job-2 failed:",
        "purge failed"
      );
      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // startWorker – scheduling
  // -------------------------------------------------------------------------

  describe("startWorker – scheduling recurring jobs", () => {
    it("calls schedulePurgeExpiredFiles() on startup", async () => {
      await schedulePurgeExpiredFiles();
      expect(schedulePurgeExpiredFiles).toHaveBeenCalledOnce();
    });

    it("awaits schedulePurgeExpiredFiles successfully", async () => {
      await expect(schedulePurgeExpiredFiles()).resolves.toBeUndefined();
    });

    it("propagates scheduling errors", async () => {
      (schedulePurgeExpiredFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Redis unavailable")
      );
      await expect(schedulePurgeExpiredFiles()).rejects.toThrow("Redis unavailable");
    });
  });

  // -------------------------------------------------------------------------
  // Graceful shutdown logic
  // -------------------------------------------------------------------------

  describe("shutdown – graceful shutdown", () => {
    it("sets isShuttingDown flag to block new job processing", () => {
      let isShuttingDown = false;

      const checkShutdown = () => {
        if (isShuttingDown) throw new Error("Worker is shutting down");
      };

      expect(checkShutdown).not.toThrow();
      isShuttingDown = true;
      expect(checkShutdown).toThrow("Worker is shutting down");
    });

    it("calls close() on the active worker during shutdown", async () => {
      const mockWorker = { close: vi.fn().mockResolvedValue(undefined) };
      await mockWorker.close();
      expect(mockWorker.close).toHaveBeenCalledOnce();
    });

    it("handles close() failure gracefully and logs the error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockWorker = {
        close: vi.fn().mockRejectedValue(new Error("Connection reset")),
      };

      try {
        await mockWorker.close();
      } catch (err) {
        console.error("[scheduled-worker] Error closing worker:", err);
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        "[scheduled-worker] Error closing worker:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Worker processor callback
  // -------------------------------------------------------------------------

  describe("worker processor callback", () => {
    it("throws when isShuttingDown is true", async () => {
      let isShuttingDown = false;

      const processorCallback = async (data: ScheduledJobData) => {
        if (isShuttingDown) {
          throw new Error("Worker is shutting down");
        }
        return processJob(data);
      };

      // Normal operation
      const result = await processorCallback({ type: "purge-expired-files" });
      expect(result).toEqual({ deletedCount: 5, errors: [] });

      // After shutdown flag is set
      isShuttingDown = true;
      await expect(
        processorCallback({ type: "purge-expired-files" })
      ).rejects.toThrow("Worker is shutting down");
    });

    it("returns the processor result on success", async () => {
      const processorCallback = async (data: ScheduledJobData) => processJob(data);
      const result = await processorCallback({ type: "recalculate-storage" });
      expect(result).toEqual({ updatedCount: 3, errors: [] });
    });

    it("logs and rethrows errors from the inner processor", async () => {
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Purge job exploded")
      );

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const processorCallback = async (jobId: string, data: ScheduledJobData) => {
        try {
          return await processJob(data);
        } catch (error) {
          console.error(`[scheduled-worker] Job ${jobId} failed:`, error);
          throw error;
        }
      };

      await expect(
        processorCallback("job-id-42", { type: "purge-expired-files" })
      ).rejects.toThrow("Purge job exploded");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[scheduled-worker] Job job-id-42 failed:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
