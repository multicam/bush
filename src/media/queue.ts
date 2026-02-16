/**
 * Bush Platform - Media Processing Queue
 *
 * BullMQ queue setup for media processing jobs.
 * Reference: specs/15-media-processing.md
 */
import { Queue, QueueEvents, Worker } from "bullmq";
import { config } from "../config/index.js";
import {
  QUEUE_NAMES,
  type QueueName,
  type MediaJobData,
  RETRY_CONFIG,
} from "./types.js";

/**
 * Redis connection options for BullMQ
 */
function getRedisOptions() {
  // Parse REDIS_URL to extract connection details
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname || "localhost",
    port: parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null, // BullMQ requires this
    enableReadyCheck: false,
  };
}

/**
 * Queue instances (lazy initialization)
 */
const queues: Map<QueueName, Queue> = new Map();
const queueEvents: Map<QueueName, QueueEvents> = new Map();

/**
 * Get or create a queue by name
 */
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedisOptions(),
      defaultJobOptions: {
        attempts: RETRY_CONFIG.maxAttempts,
        backoff: RETRY_CONFIG.backoff,
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 3600, // For 24 hours
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
          age: 7 * 24 * 3600, // For 7 days
        },
      },
    });
    queues.set(name, queue);
  }
  return queues.get(name)!;
}

/**
 * Get or create queue events listener
 */
export function getQueueEvents(name: QueueName): QueueEvents {
  if (!queueEvents.has(name)) {
    const events = new QueueEvents(name, {
      connection: getRedisOptions(),
    });
    queueEvents.set(name, events);
  }
  return queueEvents.get(name)!;
}

/**
 * Add a job to the appropriate queue
 */
export async function addJob<T extends MediaJobData>(
  jobData: T
): Promise<void> {
  const queueName = getQueueNameForJobType(jobData.type);
  const queue = getQueue(queueName);

  await queue.add(`${jobData.type}-${jobData.assetId}`, jobData, {
    priority: jobData.priority ?? 5, // Default to standard priority
  });
}

/**
 * Get the queue name for a job type
 */
function getQueueNameForJobType(type: MediaJobData["type"]): QueueName {
  switch (type) {
    case "metadata":
      return QUEUE_NAMES.METADATA;
    case "thumbnail":
      return QUEUE_NAMES.THUMBNAIL;
    case "filmstrip":
      return QUEUE_NAMES.FILMSTRIP;
    case "proxy":
      return QUEUE_NAMES.PROXY;
    case "waveform":
      return QUEUE_NAMES.WAVEFORM;
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

/**
 * Create a worker for a queue
 */
export function createWorker<T extends MediaJobData>(
  queueName: QueueName,
  processor: (job: { data: T }) => Promise<unknown>,
  concurrency: number
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: getRedisOptions(),
    concurrency,
  });
}

/**
 * Close all queues and connections (for graceful shutdown)
 */
export async function closeQueues(): Promise<void> {
  // Close all queue events first
  for (const events of queueEvents.values()) {
    await events.close();
  }
  queueEvents.clear();

  // Close all queues
  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();
}

/**
 * Get queue statistics
 */
export async function getQueueStats(
  name: QueueName
): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(name);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get Redis connection options (for worker)
 */
export { getRedisOptions };

/**
 * Re-export queue names
 */
export { QUEUE_NAMES } from "./types.js";
