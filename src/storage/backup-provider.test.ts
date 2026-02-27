/**
 * Tests for Backup Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackupConfig } from "./backup-types.js";

// Mock AWS SDK
const mockS3Client = {
  send: vi.fn(),
};

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => mockS3Client),
  PutObjectCommand: vi.fn((params) => ({ type: "PutObject", ...params })),
  GetObjectCommand: vi.fn((params) => ({ type: "GetObject", ...params })),
  DeleteObjectsCommand: vi.fn((params) => ({ type: "DeleteObjects", ...params })),
  HeadObjectCommand: vi.fn((params) => ({ type: "HeadObject", ...params })),
  ListObjectsV2Command: vi.fn((params) => ({ type: "ListObjectsV2", ...params })),
}));

describe("BackupProvider", () => {
  let S3BackupProvider: any;
  let NoBackupProvider: any;
  let tempDir: string;

  const defaultConfig: BackupConfig = {
    enabled: true,
    bucket: "test-backup-bucket",
    retentionDays: 30,
    snapshotIntervalHours: 24,
    storageProvider: "minio",
    endpoint: "http://localhost:9000",
    region: "us-east-1",
    accessKey: "test-access-key",
    secretKey: "test-secret-key",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create temp directory for test files
    tempDir = await mkdtemp(join(tmpdir(), "backup-test-"));

    // Re-import to get fresh instance
    const module = await import("./backup-provider.js");
    S3BackupProvider = module.S3BackupProvider;
    NoBackupProvider = module.NoBackupProvider;
  });

  afterEach(async () => {
    // Cleanup temp directory
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("S3BackupProvider", () => {
    describe("constructor", () => {
      it("creates S3 client with provided config", () => {
        const provider = new S3BackupProvider(defaultConfig);
        expect(provider).toBeDefined();
      });

      it("handles disabled state", () => {
        const provider = new S3BackupProvider({ ...defaultConfig, enabled: false });
        expect(provider).toBeDefined();
      });
    });

    describe("healthCheck", () => {
      it("returns true when list operation succeeds", async () => {
        mockS3Client.send.mockResolvedValueOnce({ Contents: [] });

        const provider = new S3BackupProvider(defaultConfig);
        const result = await provider.healthCheck();

        expect(result).toBe(true);
      });

      it("returns false when list operation fails", async () => {
        mockS3Client.send.mockRejectedValueOnce(new Error("Connection failed"));

        const provider = new S3BackupProvider(defaultConfig);
        const result = await provider.healthCheck();

        expect(result).toBe(false);
      });

      it("returns false when backups are disabled", async () => {
        const provider = new S3BackupProvider({ ...defaultConfig, enabled: false });
        const result = await provider.healthCheck();

        expect(result).toBe(false);
      });
    });

    describe("writeSnapshot", () => {
      it("writes snapshot to backup storage", async () => {
        // Mock the PutObject for snapshot
        mockS3Client.send.mockResolvedValueOnce({});
        // Mock the ListObjectsV2 for pruneSnapshots (called after write)
        mockS3Client.send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

        // Create a test database file
        const dbPath = join(tempDir, "test.db");
        await writeFile(dbPath, Buffer.from("test database content"));

        const provider = new S3BackupProvider(defaultConfig);
        const snapshot = await provider.writeSnapshot(dbPath, "2024-01-01/snapshot.db");

        expect(snapshot.id).toBeDefined();
        expect(snapshot.key).toContain("snapshots/2024-01-01/snapshot.db");
        expect(snapshot.type).toBe("snapshot");
        expect(snapshot.size).toBe(21); // "test database content".length
        expect(snapshot.isLatest).toBe(true);
      });

      it("throws error when source database does not exist", async () => {
        const provider = new S3BackupProvider(defaultConfig);

        await expect(
          provider.writeSnapshot("/nonexistent/path.db", "snapshot.db")
        ).rejects.toThrow("Source database not found");
      });

      it("throws error when backups are disabled", async () => {
        const provider = new S3BackupProvider({ ...defaultConfig, enabled: false });

        await expect(
          provider.writeSnapshot("/some/path.db", "snapshot.db")
        ).rejects.toThrow("Backups are disabled");
      });
    });

    describe("listSnapshots", () => {
      it("lists snapshots sorted by date", async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        mockS3Client.send.mockResolvedValueOnce({
          Contents: [
            { Key: "backups/snapshots/2024-01-02.db", LastModified: now, Size: 1024 },
            { Key: "backups/snapshots/2024-01-01.db", LastModified: yesterday, Size: 2048 },
          ],
          IsTruncated: false,
        });

        mockS3Client.send.mockResolvedValue({
          Metadata: { "snapshot-id": "test-id" },
          ContentLength: 1024,
        });

        const provider = new S3BackupProvider(defaultConfig);
        const snapshots = await provider.listSnapshots();

        expect(snapshots).toHaveLength(2);
        expect(snapshots[0].key).toContain("2024-01-02.db");
        expect(snapshots[0].isLatest).toBe(true);
        expect(snapshots[1].isLatest).toBe(false);
      });

      it("returns empty array when no snapshots exist", async () => {
        mockS3Client.send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

        const provider = new S3BackupProvider(defaultConfig);
        const snapshots = await provider.listSnapshots();

        expect(snapshots).toEqual([]);
      });

      it("returns empty array when backups are disabled", async () => {
        const provider = new S3BackupProvider({ ...defaultConfig, enabled: false });
        const snapshots = await provider.listSnapshots();

        expect(snapshots).toEqual([]);
      });
    });

    describe("pruneSnapshots", () => {
      it("deletes old snapshots beyond retention period", async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 40); // Older than 30 day retention

        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 10); // Within retention

        mockS3Client.send.mockResolvedValueOnce({
          Contents: [
            { Key: "backups/snapshots/old.db", LastModified: oldDate, Size: 1024 },
            { Key: "backups/snapshots/recent.db", LastModified: recentDate, Size: 1024 },
          ],
          IsTruncated: false,
        });

        mockS3Client.send.mockResolvedValue({
          Metadata: { "snapshot-id": "test-id" },
          ContentLength: 1024,
        });

        mockS3Client.send.mockResolvedValueOnce({ Deleted: [{ Key: "backups/snapshots/old.db" }] });

        const provider = new S3BackupProvider(defaultConfig);
        const deleted = await provider.pruneSnapshots();

        expect(deleted).toBe(1);
      });

      it("returns 0 when no snapshots to delete", async () => {
        mockS3Client.send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

        const provider = new S3BackupProvider(defaultConfig);
        const deleted = await provider.pruneSnapshots();

        expect(deleted).toBe(0);
      });
    });

    describe("restore", () => {
      it("restores snapshot to target path", async () => {
        // Mock the download stream
        const mockStream = {
          async *[Symbol.asyncIterator]() {
            yield new Uint8Array([1, 2, 3, 4, 5]);
          },
        };

        mockS3Client.send.mockResolvedValueOnce({ Body: mockStream });

        const provider = new S3BackupProvider(defaultConfig);
        const targetPath = join(tempDir, "restored.db");
        await provider.restore("backups/snapshots/test.db", null, targetPath);

        expect(existsSync(targetPath)).toBe(true);
      });

      it("throws error when snapshot not found", async () => {
        mockS3Client.send.mockResolvedValueOnce({ Body: null });

        const provider = new S3BackupProvider(defaultConfig);

        await expect(
          provider.restore("nonexistent.db", null, join(tempDir, "restored.db"))
        ).rejects.toThrow("Snapshot not found");
      });

      it("throws error when backups are disabled", async () => {
        const provider = new S3BackupProvider({ ...defaultConfig, enabled: false });

        await expect(
          provider.restore("test.db", null, "/tmp/restored.db")
        ).rejects.toThrow("Backups are disabled");
      });
    });

    describe("streamWAL", () => {
      it("uploads WAL file when it exists", async () => {
        mockS3Client.send.mockResolvedValueOnce({});

        // Create test database and WAL files
        const dbPath = join(tempDir, "test.db");
        const walPath = join(tempDir, "test.db-wal");
        await writeFile(dbPath, Buffer.from("database"));
        await writeFile(walPath, Buffer.from("wal data"));

        const provider = new S3BackupProvider(defaultConfig);
        await provider.streamWAL(dbPath, "2024-01-01/wal-001");

        expect(mockS3Client.send).toHaveBeenCalled();
      });

      it("does nothing when WAL file does not exist", async () => {
        // Create only database, no WAL
        const dbPath = join(tempDir, "test.db");
        await writeFile(dbPath, Buffer.from("database"));

        const provider = new S3BackupProvider(defaultConfig);
        await provider.streamWAL(dbPath, "2024-01-01/wal-001");

        // Should not upload anything
        expect(mockS3Client.send).not.toHaveBeenCalled();
      });

      it("throws error when source database does not exist", async () => {
        const provider = new S3BackupProvider(defaultConfig);

        await expect(
          provider.streamWAL("/nonexistent/path.db", "wal.db")
        ).rejects.toThrow("Source database not found");
      });

      it("skips when backups are disabled", async () => {
        const provider = new S3BackupProvider({ ...defaultConfig, enabled: false });

        // Should not throw, just log and return
        await provider.streamWAL("/some/path.db", "wal.db");
      });
    });

    describe("getLatestSnapshot", () => {
      it("returns the most recent snapshot", async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        mockS3Client.send.mockResolvedValueOnce({
          Contents: [
            { Key: "backups/snapshots/latest.db", LastModified: now, Size: 1024 },
            { Key: "backups/snapshots/older.db", LastModified: yesterday, Size: 2048 },
          ],
          IsTruncated: false,
        });

        mockS3Client.send.mockResolvedValue({
          Metadata: { "snapshot-id": "test-id" },
          ContentLength: 1024,
        });

        const provider = new S3BackupProvider(defaultConfig);
        const latest = await provider.getLatestSnapshot();

        expect(latest).not.toBeNull();
        expect(latest?.key).toContain("latest.db");
      });

      it("returns null when no snapshots exist", async () => {
        mockS3Client.send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

        const provider = new S3BackupProvider(defaultConfig);
        const latest = await provider.getLatestSnapshot();

        expect(latest).toBeNull();
      });
    });
  });

  describe("NoBackupProvider", () => {
    it("healthCheck returns false", async () => {
      const provider = new NoBackupProvider();
      expect(await provider.healthCheck()).toBe(false);
    });

    it("streamWAL is no-op", async () => {
      const provider = new NoBackupProvider();
      await provider.streamWAL("/path/to/db", "key");
      // Should not throw
    });

    it("writeSnapshot throws error", async () => {
      const provider = new NoBackupProvider();
      await expect(provider.writeSnapshot("/path", "key")).rejects.toThrow("Backups are disabled");
    });

    it("restore throws error", async () => {
      const provider = new NoBackupProvider();
      await expect(provider.restore("key", null, "/target")).rejects.toThrow("Backups are disabled");
    });

    it("listSnapshots returns empty array", async () => {
      const provider = new NoBackupProvider();
      expect(await provider.listSnapshots()).toEqual([]);
    });

    it("pruneSnapshots returns 0", async () => {
      const provider = new NoBackupProvider();
      expect(await provider.pruneSnapshots()).toBe(0);
    });

    it("getLatestSnapshot returns null", async () => {
      const provider = new NoBackupProvider();
      expect(await provider.getLatestSnapshot()).toBeNull();
    });
  });
});
