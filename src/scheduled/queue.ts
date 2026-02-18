/**
 * Bush Platform - Scheduled Jobs Queue
 *
 * BullMQ queue setup for scheduled/recurring jobs.
 * Used for maintenance tasks like purging expired soft-deleted files.
 */
import { Queue, QueueEvents } from "bullmq";
import { config } from "../config/index.js";

/**
 * Scheduled queue names
 */
export const SCHEDULED_QUEUE_NAMES = {
  MAINTENANCE: "scheduled:maintenance",
} as const;

export type ScheduledQueueName = typeof SCHEDULED_QUEUE_NAMES[keyof typeof SCHEDULED_QUEUE_NAMES];

/**
 * Scheduled job types
 */
export type ScheduledJobType = "purge-expired-files";

/**
 * Redis connection options for BullMQ
 */
function getRedisOptions() {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname || "localhost",
    port: parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * Queue instance (lazy initialization)
 */
let maintenanceQueue: Queue | null = null;
let maintenanceQueueEvents: QueueEvents | null = null;

/**
 * Get or create the maintenance queue
 */
export function getMaintenanceQueue(): Queue {
  if (!maintenanceQueue) {
    maintenanceQueue = new Queue(SCHEDULED_QUEUE_NAMES.MAINTENANCE, {
      connection: getRedisOptions(),
      defaultJobOptions: {
        removeOnComplete: {
          count: 30, // Keep last 30 completed jobs
          age: 30 * 24 * 3600, // For 30 days
        },
        removeOnFail: {
          count: 100, // Keep last 100 failed jobs
          age: 30 * 24 * 3600, // For 30 days
        },
      },
    });
  }
  return maintenanceQueue;
}

/**
 * Get or create queue events listener
 */
export function getMaintenanceQueueEvents(): QueueEvents {
  if (!maintenanceQueueEvents) {
    maintenanceQueueEvents = new QueueEvents(SCHEDULED_QUEUE_NAMES.MAINTENANCE, {
      connection: getRedisOptions(),
    });
  }
  return maintenanceQueueEvents;
}

/**
 * Schedule the daily purge job
 * Runs at midnight UTC every day
 */
export async function schedulePurgeExpiredFiles(): Promise<void> {
  const queue = getMaintenanceQueue();

  // Add repeating job - runs daily at midnight UTC
  await queue.add(
    "purge-expired-files",
    { type: "purge-expired-files" },
    {
      repeat: {
        pattern: "0 0 * * *", // Daily at midnight UTC
      },
      jobId: "purge-expired-files-daily",
    }
  );
}

/**
 * Close all scheduled queues (for graceful shutdown)
 */
export async function closeScheduledQueues(): Promise<void> {
  if (maintenanceQueueEvents) {
    await maintenanceQueueEvents.close();
    maintenanceQueueEvents = null;
  }

  if (maintenanceQueue) {
    await maintenanceQueue.close();
    maintenanceQueue = null;
  }
}

/**
 * Get Redis connection options (for worker)
 */
export { getRedisOptions };
