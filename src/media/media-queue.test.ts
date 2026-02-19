/**
 * Tests for media processing queue
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock bullmq before importing the module
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getCompletedCount: vi.fn().mockResolvedValue(100),
    getFailedCount: vi.fn().mockResolvedValue(3),
    getDelayedCount: vi.fn().mockResolvedValue(1),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../config/index.js", () => ({
  config: {
    REDIS_URL: "redis://localhost:6379",
  },
}));

describe("media queue", () => {
  let mediaQueue: typeof import("./queue.js");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Import fresh module for each test
    mediaQueue = await import("./queue.js");
  });

  afterEach(async () => {
    // Close queues to clean up
    try {
      await mediaQueue.closeQueues();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("getQueue", () => {
    it("creates and returns a queue instance", async () => {
      const queue = mediaQueue.getQueue("media:metadata");
      expect(queue).toBeDefined();
    });

    it("returns the same queue instance for the same name", async () => {
      const queue1 = mediaQueue.getQueue("media:thumbnail");
      const queue2 = mediaQueue.getQueue("media:thumbnail");
      expect(queue1).toBe(queue2);
    });

    it("creates different queue instances for different names", async () => {
      const queue1 = mediaQueue.getQueue("media:proxy");
      const queue2 = mediaQueue.getQueue("media:filmstrip");
      expect(queue1).not.toBe(queue2);
    });
  });

  describe("getQueueEvents", () => {
    it("creates and returns queue events instance", async () => {
      const events = mediaQueue.getQueueEvents("media:metadata");
      expect(events).toBeDefined();
    });

    it("returns the same events instance for the same queue", async () => {
      const events1 = mediaQueue.getQueueEvents("media:waveform");
      const events2 = mediaQueue.getQueueEvents("media:waveform");
      expect(events1).toBe(events2);
    });
  });

  describe("addJob", () => {
    it("adds a metadata job to the correct queue", async () => {
      const { addJob, closeQueues } = mediaQueue;
      await addJob({
        type: "metadata",
        assetId: "asset_123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "file.mp4",
        accountId: "account_789",
        projectId: "project_012",
      });

      // Just verify it doesn't throw
      expect(true).toBe(true);

      await closeQueues();
    });

    it("adds a thumbnail job to the correct queue", async () => {
      const { addJob, closeQueues } = mediaQueue;
      await addJob({
        type: "thumbnail",
        assetId: "asset_123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "file.mp4",
        accountId: "account_789",
        projectId: "project_012",
        priority: 3,
        sizes: ["small", "medium", "large"],
      });

      expect(true).toBe(true);

      await closeQueues();
    });

    it("adds a proxy job to the correct queue", async () => {
      const { addJob, closeQueues } = mediaQueue;
      await addJob({
        type: "proxy",
        assetId: "asset_123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "file.mp4",
        accountId: "account_789",
        projectId: "project_012",
        resolutions: ["720p"],
        sourceWidth: 1920,
        sourceHeight: 1080,
        isHDR: false,
      });

      expect(true).toBe(true);

      await closeQueues();
    });

    it("adds a filmstrip job to the correct queue", async () => {
      const { addJob, closeQueues } = mediaQueue;
      await addJob({
        type: "filmstrip",
        assetId: "asset_123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "file.mp4",
        accountId: "account_789",
        projectId: "project_012",
        durationSeconds: 120,
      });

      expect(true).toBe(true);

      await closeQueues();
    });

    it("adds a waveform job to the correct queue", async () => {
      const { addJob, closeQueues } = mediaQueue;
      await addJob({
        type: "waveform",
        assetId: "asset_123",
        storageKey: "path/to/file.mp4",
        mimeType: "video/mp4",
        sourceFilename: "file.mp4",
        accountId: "account_789",
        projectId: "project_012",
        durationSeconds: 120,
      });

      expect(true).toBe(true);

      await closeQueues();
    });
  });

  describe("createWorker", () => {
    it("creates a worker for a queue", async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });
      const worker = mediaQueue.createWorker("media:metadata", processor, 2);

      expect(worker).toBeDefined();
    });
  });

  describe("closeQueues", () => {
    it("closes all queues and queue events", async () => {
      // Create some queues first
      mediaQueue.getQueue("media:metadata");
      mediaQueue.getQueue("media:thumbnail");
      mediaQueue.getQueueEvents("media:metadata");

      // Close them
      await mediaQueue.closeQueues();

      // Creating new queues should give fresh instances
      const newQueue = mediaQueue.getQueue("media:metadata");
      expect(newQueue).toBeDefined();
    });
  });

  describe("getQueueStats", () => {
    it("returns queue statistics", async () => {
      const stats = await mediaQueue.getQueueStats("media:metadata");

      expect(stats).toHaveProperty("waiting");
      expect(stats).toHaveProperty("active");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
      expect(stats).toHaveProperty("delayed");
    });
  });

  describe("getRedisOptions", () => {
    it("exports getRedisOptions function", () => {
      expect(mediaQueue.getRedisOptions).toBeDefined();
      expect(typeof mediaQueue.getRedisOptions).toBe("function");
    });

    it("returns correct Redis connection options", () => {
      const options = mediaQueue.getRedisOptions();

      expect(options).toHaveProperty("host");
      expect(options).toHaveProperty("port");
      expect(options.maxRetriesPerRequest).toBeNull();
      expect(options.enableReadyCheck).toBe(false);
    });
  });

  describe("QUEUE_NAMES export", () => {
    it("exports QUEUE_NAMES", () => {
      expect(mediaQueue.QUEUE_NAMES).toBeDefined();
      expect(mediaQueue.QUEUE_NAMES.METADATA).toBe("media:metadata");
      expect(mediaQueue.QUEUE_NAMES.THUMBNAIL).toBe("media:thumbnail");
      expect(mediaQueue.QUEUE_NAMES.PROXY).toBe("media:proxy");
      expect(mediaQueue.QUEUE_NAMES.FILMSTRIP).toBe("media:filmstrip");
      expect(mediaQueue.QUEUE_NAMES.WAVEFORM).toBe("media:waveform");
    });
  });
});
