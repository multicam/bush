/**
 * Bush Platform - Media Processing Worker
 *
 * Worker process for processing media jobs from BullMQ queues.
 * Run with: tsx src/media/worker.ts
 *
 * Reference: specs/15-media-processing.md
 */
import { Worker, Job } from "bullmq";
import { config } from "../config/index.js";
import { getRedisOptions, QUEUE_NAMES } from "./queue.js";
import { processMetadata } from "./processors/metadata.js";
import { processThumbnail } from "./processors/thumbnail.js";
import type { MediaJobData, QueueName } from "./types.js";

// Worker configuration
const WORKER_CONFIG: Record<QueueName, { concurrency: number; processor: string }> = {
  [QUEUE_NAMES.METADATA]: {
    concurrency: config.WORKER_METADATA_CONCURRENCY,
    processor: "metadata",
  },
  [QUEUE_NAMES.THUMBNAIL]: {
    concurrency: config.WORKER_THUMBNAIL_CONCURRENCY,
    processor: "thumbnail",
  },
  [QUEUE_NAMES.FILMSTRIP]: {
    concurrency: config.WORKER_FILMSTRIP_CONCURRENCY,
    processor: "filmstrip",
  },
  [QUEUE_NAMES.PROXY]: {
    concurrency: config.WORKER_PROXY_CONCURRENCY,
    processor: "proxy",
  },
  [QUEUE_NAMES.WAVEFORM]: {
    concurrency: config.WORKER_WAVEFORM_CONCURRENCY,
    processor: "waveform",
  },
};

// Active workers
const workers: Worker[] = [];

// Graceful shutdown flag
let isShuttingDown = false;

/**
 * Process a job based on its type
 */
async function processJob(job: Job<MediaJobData>): Promise<unknown> {
  const { data } = job;
  console.log(`[worker] Processing job ${job.id}: ${data.type} for asset ${data.assetId}`);

  switch (data.type) {
    case "metadata":
      return processMetadata(data);

    case "thumbnail":
      return processThumbnail(data);

    case "filmstrip":
      // TODO: Implement filmstrip processor
      console.log(`[worker] Filmstrip processing not yet implemented`);
      return { skipped: true, reason: "not_implemented" };

    case "proxy":
      // TODO: Implement proxy processor
      console.log(`[worker] Proxy processing not yet implemented`);
      return { skipped: true, reason: "not_implemented" };

    case "waveform":
      // TODO: Implement waveform processor
      console.log(`[worker] Waveform processing not yet implemented`);
      return { skipped: true, reason: "not_implemented" };

    default:
      throw new Error(`Unknown job type: ${(data as { type: string }).type}`);
  }
}

/**
 * Create and start a worker for a queue
 */
function createWorkerForQueue(queueName: QueueName): Worker<MediaJobData> {
  const { concurrency } = WORKER_CONFIG[queueName];

  const worker = new Worker<MediaJobData>(
    queueName,
    async (job: Job<MediaJobData>) => {
      if (isShuttingDown) {
        // Don't start new jobs during shutdown
        throw new Error("Worker is shutting down");
      }

      try {
        const result = await processJob(job);
        console.log(`[worker] Completed job ${job.id}`);
        return result;
      } catch (error) {
        console.error(`[worker] Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: getRedisOptions(),
      concurrency,
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`[worker] Job ${job?.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[worker] Worker error for ${queueName}:`, err);
  });

  return worker;
}

/**
 * Start all workers
 */
async function startWorkers(): Promise<void> {
  console.log("[worker] Starting media processing workers...");

  // Ensure temp directory exists
  const { mkdir } = await import("fs/promises");
  try {
    await mkdir(config.MEDIA_TEMP_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Create workers for each queue
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const worker = createWorkerForQueue(queueName);
    workers.push(worker);
    console.log(
      `[worker] Started worker for ${queueName} with concurrency ${WORKER_CONFIG[queueName].concurrency}`
    );
  }

  console.log(`[worker] All ${workers.length} workers started`);
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, starting graceful shutdown...`);
  isShuttingDown = true;

  // Close all workers
  for (const worker of workers) {
    try {
      await worker.close();
    } catch (err) {
      console.error("[worker] Error closing worker:", err);
    }
  }

  console.log("[worker] All workers closed, exiting");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start workers
startWorkers().catch((err) => {
  console.error("[worker] Failed to start workers:", err);
  process.exit(1);
});
