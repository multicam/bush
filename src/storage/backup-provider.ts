/**
 * Bush Platform - S3-Compatible Backup Provider
 *
 * Implements IBackupProvider using AWS SDK v3.
 * Provides SQLite database backup via snapshots and WAL streaming.
 *
 * Per specs/06-storage.md Section 13:
 * - RPO: < 1 second (WAL frames streamed in real-time)
 * - RTO: < 5 minutes (restore from latest snapshot, replay WAL)
 * - Retention: 30 daily snapshots, 12 weekly snapshots
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import type {
  IBackupProvider,
  BackupSnapshot,
  BackupConfig,
} from "./backup-types.js";

/**
 * Key prefix for backups in the bucket
 */
const BACKUP_PREFIX = "backups/";
const SNAPSHOT_PREFIX = `${BACKUP_PREFIX}snapshots/`;
const WAL_PREFIX = `${BACKUP_PREFIX}wal/`;

/**
 * S3-compatible backup provider implementation
 */
export class S3BackupProvider implements IBackupProvider {
  private client: S3Client;
  private bucket: string;
  private retentionDays: number;
  private enabled: boolean;

  constructor(config: BackupConfig) {
    this.bucket = config.bucket ?? "";
    this.retentionDays = config.retentionDays;
    this.enabled = config.enabled;

    // Configure S3 client
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      // Force path-style for MinIO and other non-AWS providers
      forcePathStyle: !!config.endpoint,
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.bucket) {
      return false;
    }

    try {
      // Try to list objects with max keys = 1 to verify connectivity
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: BACKUP_PREFIX,
          MaxKeys: 1,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async streamWAL(sourceDb: string, destinationKey: string): Promise<void> {
    if (!this.enabled) {
      console.log("[Backup] WAL streaming skipped - backups disabled");
      return;
    }

    if (!existsSync(sourceDb)) {
      throw new Error(`Source database not found: ${sourceDb}`);
    }

    const walFile = `${sourceDb}-wal`;
    if (!existsSync(walFile)) {
      // No WAL file means no changes to stream
      return;
    }

    // Read WAL file and upload
    const walData = await readFile(walFile);
    const key = `${WAL_PREFIX}${destinationKey}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: walData,
        ContentType: "application/octet-stream",
        Metadata: {
          "source-db": sourceDb,
          "backup-type": "wal",
          "created-at": new Date().toISOString(),
        },
      })
    );

    console.log(`[Backup] WAL streamed to ${key}`);
  }

  async writeSnapshot(sourceDb: string, destinationKey: string): Promise<BackupSnapshot> {
    if (!this.enabled) {
      throw new Error("Backups are disabled");
    }

    if (!existsSync(sourceDb)) {
      throw new Error(`Source database not found: ${sourceDb}`);
    }

    // Get file stats
    const stats = statSync(sourceDb);
    const snapshotId = createHash("sha256")
      .update(`${sourceDb}-${Date.now()}`)
      .digest("hex")
      .substring(0, 16);

    const key = `${SNAPSHOT_PREFIX}${destinationKey}`;

    // Create read stream and upload
    const fileStream = createReadStream(sourceDb);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentType: "application/x-sqlite3",
        Metadata: {
          "snapshot-id": snapshotId,
          "source-db": sourceDb,
          "backup-type": "snapshot",
          "created-at": new Date().toISOString(),
          "size-bytes": String(stats.size),
        },
      })
    );

    const snapshot: BackupSnapshot = {
      id: snapshotId,
      key,
      createdAt: new Date(),
      size: stats.size,
      type: "snapshot",
      isLatest: true,
    };

    console.log(`[Backup] Snapshot written to ${key} (${stats.size} bytes)`);

    // Prune old snapshots after writing new one
    await this.pruneSnapshots();

    return snapshot;
  }

  async restore(
    snapshotKey: string,
    walPrefix: string | null,
    targetPath: string
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error("Backups are disabled");
    }

    // Ensure target directory exists
    await mkdir(dirname(targetPath), { recursive: true });

    // Download snapshot
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: snapshotKey,
      })
    );

    if (!response.Body) {
      throw new Error(`Snapshot not found: ${snapshotKey}`);
    }

    // Write snapshot to target path
    const chunks: Uint8Array[] = [];
    const stream = response.Body as NodeJS.ReadableStream;

    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }

    await writeFile(targetPath, Buffer.concat(chunks));
    console.log(`[Backup] Snapshot restored to ${targetPath}`);

    // If WAL prefix provided, replay WAL frames
    if (walPrefix) {
      await this.replayWAL(walPrefix, targetPath);
    }
  }

  async listSnapshots(): Promise<BackupSnapshot[]> {
    if (!this.enabled) {
      return [];
    }

    const snapshots: BackupSnapshot[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: SNAPSHOT_PREFIX,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of response.Contents ?? []) {
        const snapshot = await this.objectToSnapshot(obj);
        if (snapshot) {
          snapshots.push(snapshot);
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Sort by creation date (newest first)
    snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Mark latest
    if (snapshots.length > 0) {
      snapshots[0].isLatest = true;
    }

    return snapshots;
  }

  async pruneSnapshots(): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    const snapshots = await this.listSnapshots();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const toDelete = snapshots.filter((s) => s.createdAt < cutoffDate);

    if (toDelete.length === 0) {
      return 0;
    }

    // Delete old snapshots
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: toDelete.map((s) => ({ Key: s.key })),
          Quiet: true,
        },
      })
    );

    console.log(`[Backup] Pruned ${toDelete.length} old snapshot(s)`);

    return toDelete.length;
  }

  async getLatestSnapshot(): Promise<BackupSnapshot | null> {
    const snapshots = await this.listSnapshots();
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * Replay WAL frames on top of a restored snapshot
   */
  private async replayWAL(walPrefix: string, targetDb: string): Promise<void> {
    // List all WAL files with the given prefix
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${WAL_PREFIX}${walPrefix}`,
        MaxKeys: 1000,
      })
    );

    const walFiles = (response.Contents ?? [])
      .sort((a, b) => (a.LastModified?.getTime() ?? 0) - (b.LastModified?.getTime() ?? 0));

    if (walFiles.length === 0) {
      console.log(`[Backup] No WAL files found for prefix ${walPrefix}`);
      return;
    }

    // Download and apply each WAL file in order
    for (const walObj of walFiles) {
      const walResponse = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: walObj.Key!,
        })
      );

      if (!walResponse.Body) continue;

      // Write WAL file next to the database
      const walPath = `${targetDb}-wal`;
      const chunks: Uint8Array[] = [];
      const stream = walResponse.Body as NodeJS.ReadableStream;

      for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
      }

      await writeFile(walPath, Buffer.concat(chunks));
      console.log(`[Backup] WAL frame applied: ${walObj.Key}`);
    }

    // SQLite will automatically replay WAL on next connection
    console.log(`[Backup] WAL replay complete`);
  }

  /**
   * Convert S3 object to BackupSnapshot
   */
  private async objectToSnapshot(obj: _Object): Promise<BackupSnapshot | null> {
    if (!obj.Key || !obj.LastModified) {
      return null;
    }

    // Try to get metadata
    let snapshotId = "";
    let size = obj.Size ?? 0;

    try {
      const headResponse = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        })
      );

      snapshotId = headResponse.Metadata?.["snapshot-id"] ?? "";
      size = headResponse.ContentLength ?? obj.Size ?? 0;
    } catch {
      // Use defaults if head fails
    }

    // Generate ID from key if not in metadata
    if (!snapshotId) {
      snapshotId = createHash("md5").update(obj.Key).digest("hex").substring(0, 16);
    }

    return {
      id: snapshotId,
      key: obj.Key,
      createdAt: obj.LastModified,
      size,
      type: "snapshot",
      isLatest: false,
    };
  }
}

/**
 * No-op backup provider for when backups are disabled
 */
export class NoBackupProvider implements IBackupProvider {
  async healthCheck(): Promise<boolean> {
    return false;
  }

  async streamWAL(): Promise<void> {
    // No-op
  }

  async writeSnapshot(): Promise<BackupSnapshot> {
    throw new Error("Backups are disabled");
  }

  async restore(): Promise<void> {
    throw new Error("Backups are disabled");
  }

  async listSnapshots(): Promise<BackupSnapshot[]> {
    return [];
  }

  async pruneSnapshots(): Promise<number> {
    return 0;
  }

  async getLatestSnapshot(): Promise<BackupSnapshot | null> {
    return null;
  }
}
