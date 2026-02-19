/**
 * Tests for scheduled module index exports
 */
import { describe, it, expect } from "vitest";

describe("scheduled index exports", () => {
  describe("queue exports", () => {
    it("exports SCHEDULED_QUEUE_NAMES", async () => {
      const { SCHEDULED_QUEUE_NAMES } = await import("./index.js");
      expect(SCHEDULED_QUEUE_NAMES).toBeDefined();
      expect(SCHEDULED_QUEUE_NAMES.MAINTENANCE).toBe("scheduled:maintenance");
    });

    it("exports getMaintenanceQueue", async () => {
      const { getMaintenanceQueue } = await import("./index.js");
      expect(typeof getMaintenanceQueue).toBe("function");
    });

    it("exports getMaintenanceQueueEvents", async () => {
      const { getMaintenanceQueueEvents } = await import("./index.js");
      expect(typeof getMaintenanceQueueEvents).toBe("function");
    });

    it("exports schedulePurgeExpiredFiles", async () => {
      const { schedulePurgeExpiredFiles } = await import("./index.js");
      expect(typeof schedulePurgeExpiredFiles).toBe("function");
    });

    it("exports closeScheduledQueues", async () => {
      const { closeScheduledQueues } = await import("./index.js");
      expect(typeof closeScheduledQueues).toBe("function");
    });

    it("exports getRedisOptions", async () => {
      const { getRedisOptions } = await import("./index.js");
      expect(typeof getRedisOptions).toBe("function");
    });
  });

  describe("processor exports", () => {
    it("exports purgeExpiredFiles", async () => {
      const { purgeExpiredFiles } = await import("./index.js");
      expect(typeof purgeExpiredFiles).toBe("function");
    });

    it("exports recalculateStorageUsage", async () => {
      const { recalculateStorageUsage } = await import("./index.js");
      expect(typeof recalculateStorageUsage).toBe("function");
    });
  });
});
