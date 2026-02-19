/**
 * Tests for scheduled jobs queue
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock bullmq before importing the module
vi.mock("bullmq", () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockQueueEvents = {
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    QueueEvents: vi.fn().mockImplementation(() => mockQueueEvents),
  };
});

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    REDIS_URL: "redis://localhost:6379",
  },
}));

import {
  SCHEDULED_QUEUE_NAMES,
  getMaintenanceQueue,
  getMaintenanceQueueEvents,
  schedulePurgeExpiredFiles,
  closeScheduledQueues,
  getRedisOptions,
} from "./queue.js";

describe("scheduled queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Close queues to reset singletons
    await closeScheduledQueues();
  });

  describe("SCHEDULED_QUEUE_NAMES", () => {
    it("has MAINTENANCE queue name", () => {
      expect(SCHEDULED_QUEUE_NAMES.MAINTENANCE).toBe("scheduled:maintenance");
    });

    it("has exactly one queue name", () => {
      expect(Object.keys(SCHEDULED_QUEUE_NAMES)).toHaveLength(1);
    });
  });

  describe("getRedisOptions", () => {
    it("returns correct options for default Redis URL", () => {
      const options = getRedisOptions();
      expect(options).toEqual({
        host: "localhost",
        port: 6379,
        password: undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    });
  });

  describe("getMaintenanceQueue", () => {
    it("returns a queue instance", async () => {
      const queue = getMaintenanceQueue();
      expect(queue).toBeDefined();
    });

    it("returns the same queue on subsequent calls (singleton)", async () => {
      const queue1 = getMaintenanceQueue();
      const queue2 = getMaintenanceQueue();
      expect(queue1).toBe(queue2);
    });
  });

  describe("getMaintenanceQueueEvents", () => {
    it("returns a queue events instance", async () => {
      const events = getMaintenanceQueueEvents();
      expect(events).toBeDefined();
    });

    it("returns the same events on subsequent calls (singleton)", async () => {
      const events1 = getMaintenanceQueueEvents();
      const events2 = getMaintenanceQueueEvents();
      expect(events1).toBe(events2);
    });
  });

  describe("schedulePurgeExpiredFiles", () => {
    it("adds a repeating job with correct parameters", async () => {
      const queue = getMaintenanceQueue();
      await schedulePurgeExpiredFiles();

      expect(queue.add).toHaveBeenCalledWith(
        "purge-expired-files",
        { type: "purge-expired-files" },
        {
          repeat: {
            pattern: "0 0 * * *",
          },
          jobId: "purge-expired-files-daily",
        }
      );
    });
  });

  describe("closeScheduledQueues", () => {
    it("closes queue events and queue", async () => {
      // Initialize both
      getMaintenanceQueue();
      getMaintenanceQueueEvents();

      await closeScheduledQueues();

      // After close, next call should create new instances
      const newQueue = getMaintenanceQueue();
      const newEvents = getMaintenanceQueueEvents();
      expect(newQueue).toBeDefined();
      expect(newEvents).toBeDefined();
    });

    it("handles being called when queues are not initialized", async () => {
      // Call without initializing first
      await closeScheduledQueues();
      // Should not throw
    });

    it("can be called multiple times safely", async () => {
      getMaintenanceQueue();
      getMaintenanceQueueEvents();

      await closeScheduledQueues();
      await closeScheduledQueues(); // Should not throw
    });
  });
});
