/**
 * Bush Platform - Scheduled Jobs Worker
 *
 * Worker process for scheduled maintenance jobs.
 * Run with: bun src/scheduled/worker.ts
 *
 * This worker handles:
 * - Daily purge of expired soft-deleted files (30-day retention)
 * - Storage usage recalculation
 */
import { Worker, Job } from "bullmq";
import {
  getRedisOptions,
  SCHEDULED_QUEUE_NAMES,
  schedulePurgeExpiredFiles,
} from "./queue.js";
import { purgeExpiredFiles, recalculateStorageUsage } from "./processor.js";

// Active workers
const workers: Worker[] = [];

// Graceful shutdown flag
let isShuttingDown = false;

/**
 * Scheduled job data
 */
interface ScheduledJobData {
  type: string;
}

/**
 * Process a scheduled job
 */
async function processJob(job: Job<ScheduledJobData>): Promise<unknown> {
  const { data } = job;
  console.log(`[scheduled-worker] Processing job ${job.id}: ${data.type}`);

  switch (data.type) {
    case "purge-expired-files":
      return purgeExpiredFiles();

    case "recalculate-storage":
      return recalculateStorageUsage();

    default:
      throw new Error(`Unknown scheduled job type: ${data.type}`);
  }
}

/**
 * Create and start the maintenance worker
 */
function createWorker(): Worker<ScheduledJobData> {
  const worker = new Worker<ScheduledJobData>(
    SCHEDULED_QUEUE_NAMES.MAINTENANCE,
    async (job: Job<ScheduledJobData>) => {
      if (isShuttingDown) {
        throw new Error("Worker is shutting down");
      }

      try {
        const result = await processJob(job);
        console.log(`[scheduled-worker] Completed job ${job.id}`, result);
        return result;
      } catch (error) {
        console.error(`[scheduled-worker] Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: getRedisOptions(),
      concurrency: 1, // Only one maintenance job at a time
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`[scheduled-worker] Job ${job?.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[scheduled-worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[scheduled-worker] Worker error:`, err);
  });

  return worker;
}

/**
 * Start the scheduled jobs worker
 */
async function startWorker(): Promise<void> {
  console.log("[scheduled-worker] Starting scheduled jobs worker...");

  // Create and start the worker
  const worker = createWorker();
  workers.push(worker);

  // Schedule the recurring jobs
  console.log("[scheduled-worker] Scheduling recurring jobs...");
  await schedulePurgeExpiredFiles();

  console.log("[scheduled-worker] Worker started successfully");
  console.log("[scheduled-worker] Scheduled jobs:");
  console.log("  - purge-expired-files: daily at midnight UTC");
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`[scheduled-worker] Received ${signal}, starting graceful shutdown...`);
  isShuttingDown = true;

  // Close all workers
  for (const worker of workers) {
    try {
      await worker.close();
    } catch (err) {
      console.error("[scheduled-worker] Error closing worker:", err);
    }
  }

  console.log("[scheduled-worker] Worker closed, exiting");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start worker
startWorker().catch((err) => {
  console.error("[scheduled-worker] Failed to start:", err);
  process.exit(1);
});
