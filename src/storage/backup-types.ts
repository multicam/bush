/**
 * Bush Platform - Backup Provider Types
 *
 * Provider-agnostic types for database backup operations.
 * Supports streaming WAL frames, snapshots, and recovery.
 */

/**
 * Backup snapshot metadata
 */
export interface BackupSnapshot {
  /** Unique identifier for the snapshot */
  id: string;
  /** Storage key where the snapshot is stored */
  key: string;
  /** Timestamp when the snapshot was created */
  createdAt: Date;
  /** Size in bytes */
  size: number;
  /** Type of backup */
  type: "snapshot" | "wal";
  /** Whether this is the latest backup */
  isLatest: boolean;
}

/**
 * Backup provider configuration
 */
export interface BackupConfig {
  /** Whether backups are enabled */
  enabled: boolean;
  /** Storage bucket for backups */
  bucket?: string;
  /** Retention period in days */
  retentionDays: number;
  /** Interval between snapshots in hours */
  snapshotIntervalHours: number;
  /** Storage provider type for backup destination */
  storageProvider?: "s3" | "r2" | "minio" | "b2";
  /** Endpoint URL for storage provider */
  endpoint?: string;
  /** Region for storage provider */
  region: string;
  /** Access key for storage provider */
  accessKey: string;
  /** Secret key for storage provider */
  secretKey: string;
}

/**
 * Backup provider interface
 *
 * Per specs/06-storage.md Section 3:
 * - streamWAL: Stream WAL frames or snapshot to backup destination
 * - writeSnapshot: Write a full snapshot to backup storage
 * - restore: Restore from a snapshot key + optional WAL replay
 * - listSnapshots: List available snapshots
 */
export interface IBackupProvider {
  /**
   * Check if the backup provider is healthy and reachable
   */
  healthCheck(): Promise<boolean>;

  /**
   * Stream WAL frames to backup destination
   * Used for continuous replication (Litestream-style)
   */
  streamWAL(sourceDb: string, destinationKey: string): Promise<void>;

  /**
   * Write a full database snapshot to backup storage
   * Creates a complete copy of the database at a point in time
   */
  writeSnapshot(sourceDb: string, destinationKey: string): Promise<BackupSnapshot>;

  /**
   * Restore database from a snapshot
   * Optionally replay WAL frames on top of the snapshot
   */
  restore(
    snapshotKey: string,
    walPrefix: string | null,
    targetPath: string
  ): Promise<void>;

  /**
   * List available snapshots
   * Returns snapshots sorted by creation date (newest first)
   */
  listSnapshots(): Promise<BackupSnapshot[]>;

  /**
   * Delete old snapshots beyond retention period
   */
  pruneSnapshots(): Promise<number>;

  /**
   * Get the latest snapshot
   */
  getLatestSnapshot(): Promise<BackupSnapshot | null>;
}
