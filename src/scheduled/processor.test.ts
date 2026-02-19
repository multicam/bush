/**
 * Tests for Scheduled Jobs Processor
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  })),
};

vi.mock("../db/index.js", () => ({
  db: mockDb,
}));

vi.mock("../db/schema.js", () => ({
  files: { id: "files.id", projectId: "files.projectId", deletedAt: "files.deletedAt" },
  accounts: { id: "accounts.id" },
  projects: { id: "projects.id", workspaceId: "projects.workspaceId" },
  workspaces: { id: "workspaces.id", accountId: "workspaces.accountId" },
}));

const mockStorage = {
  deleteObject: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../storage/index.js", () => ({
  storage: mockStorage,
  storageKeys: {
    original: vi.fn((params: any, name: string) => `original/${params.accountId}/${params.projectId}/${params.assetId}/${name}`),
    thumbnail: vi.fn((params: any) => `thumbnail/${params.accountId}/${params.projectId}/${params.assetId}`),
    proxy: vi.fn((params: any, quality: string) => `proxy/${params.accountId}/${params.projectId}/${params.assetId}/${quality}`),
    filmstrip: vi.fn((params: any) => `filmstrip/${params.accountId}/${params.projectId}/${params.assetId}`),
    waveform: vi.fn((params: any, format: string) => `waveform/${params.accountId}/${params.projectId}/${params.assetId}.${format}`),
  },
}));

describe("Scheduled Processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("purgeExpiredFiles", () => {
    it("returns empty result when no expired files", async () => {
      const { purgeExpiredFiles } = await import("./processor.js");

      const result = await purgeExpiredFiles();

      expect(result.deletedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it("purges expired files successfully", async () => {
      const mockExpiredFiles = [
        {
          id: "file-1",
          projectId: "project-1",
          accountId: "account-1",
          name: "test.mp4",
          fileSizeBytes: 1024,
          deletedAt: new Date("2024-01-01"),
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockExpiredFiles),
            }),
          }),
        }),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { purgeExpiredFiles } = await import("./processor.js");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await purgeExpiredFiles();

      expect(result.deletedCount).toBe(1);
      expect(result.errors).toEqual([]);

      consoleSpy.mockRestore();
    });

    it("handles storage deletion errors gracefully", async () => {
      const mockExpiredFiles = [
        {
          id: "file-1",
          projectId: "project-1",
          accountId: "account-1",
          name: "test.mp4",
          fileSizeBytes: 1024,
          deletedAt: new Date("2024-01-01"),
        },
      ];

      mockStorage.deleteObject.mockRejectedValueOnce(new Error("Storage error"));

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockExpiredFiles),
            }),
          }),
        }),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { purgeExpiredFiles } = await import("./processor.js");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await purgeExpiredFiles();

      // Should still succeed with storage error logged as warning
      expect(result.deletedCount).toBe(1);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("continues processing when individual file fails", async () => {
      const mockExpiredFiles = [
        {
          id: "file-1",
          projectId: "project-1",
          accountId: "account-1",
          name: "test1.mp4",
          fileSizeBytes: 1024,
          deletedAt: new Date("2024-01-01"),
        },
        {
          id: "file-2",
          projectId: "project-2",
          accountId: "account-1",
          name: "test2.mp4",
          fileSizeBytes: 2048,
          deletedAt: new Date("2024-01-01"),
        },
      ];

      // First file succeeds
      mockStorage.deleteObject.mockResolvedValueOnce(undefined);
      // DB delete fails for first file
      mockDb.delete = vi.fn().mockReturnValueOnce({
        where: vi.fn().mockRejectedValueOnce(new Error("DB error")),
      }).mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockExpiredFiles),
            }),
          }),
        }),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { purgeExpiredFiles } = await import("./processor.js");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await purgeExpiredFiles();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("file-1");

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles query errors", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(new Error("Query failed")),
            }),
          }),
        }),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { purgeExpiredFiles } = await import("./processor.js");

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await purgeExpiredFiles();

      expect(result.deletedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain("Failed to query expired files");

      errorSpy.mockRestore();
    });
  });

  describe("recalculateStorageUsage", () => {
    it("returns result for accounts", async () => {
      const mockAccounts = [{ id: "account-1" }, { id: "account-2" }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue(mockAccounts),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { recalculateStorageUsage } = await import("./processor.js");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await recalculateStorageUsage();

      expect(result.updatedCount).toBe(2);
      expect(result.errors).toEqual([]);

      consoleSpy.mockRestore();
    });

    it("handles empty accounts list", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { recalculateStorageUsage } = await import("./processor.js");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await recalculateStorageUsage();

      expect(result.updatedCount).toBe(0);
      expect(result.errors).toEqual([]);

      consoleSpy.mockRestore();
    });

    it("handles query errors", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error("Query failed")),
      });

      mockDb.select = mockSelect;

      vi.resetModules();
      const { recalculateStorageUsage } = await import("./processor.js");

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await recalculateStorageUsage();

      expect(result.updatedCount).toBe(0);
      expect(result.errors.length).toBe(1);

      errorSpy.mockRestore();
    });
  });
});
