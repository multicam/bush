/**
 * Bush Platform - Storage Service
 *
 * High-level storage operations for the Bush platform.
 * Uses the storage provider abstraction for S3-compatible storage.
 * Includes CDN provider for optimized content delivery.
 */
import { config } from "../config/index.js";
import { S3StorageProvider } from "./s3-provider.js";
import { BunnyCDNProvider, NoCDNProvider } from "./cdn-provider.js";
import { S3BackupProvider, NoBackupProvider } from "./backup-provider.js";
import type {
  IStorageProvider,
  StorageKey,
  PresignedUrlResult,
  MultipartUploadInit,
  MultipartPartUrl,
  MultipartPart,
  StorageObject,
  ListObjectsResult,
} from "./types.js";
import { buildStorageKey, parseStorageKey } from "./types.js";
import type {
  ICDNProvider,
  CDNProviderType,
} from "./cdn-types.js";
import type { IBackupProvider } from "./backup-types.js";

// Singleton storage provider instance
let _storageProvider: IStorageProvider | null = null;

// Lock for thread-safe initialization
let _initializationPromise: Promise<IStorageProvider> | null = null;

// Singleton CDN provider instance
let _cdnProvider: ICDNProvider | null = null;

// Singleton backup provider instance
let _backupProvider: IBackupProvider | null = null;

/**
 * Get the configured storage provider instance (thread-safe lazy initialization)
 */
export function getStorageProvider(): IStorageProvider {
  if (_storageProvider) {
    return _storageProvider;
  }

  // If initialization is in progress, return the same promise
  // This prevents race conditions in concurrent access scenarios
  if (!_initializationPromise) {
    _initializationPromise = initializeStorageProvider();
  }

  // Since we're in sync context, we need to handle this differently
  // The promise will be resolved immediately for the first caller
  if (!_storageProvider) {
    // Determine if we need path-style URLs (MinIO, B2 need this)
    const needsPathStyle =
      config.STORAGE_PROVIDER === "minio" ||
      config.STORAGE_PROVIDER === "b2" ||
      (config.STORAGE_ENDPOINT?.includes("localhost") ?? false);

    _storageProvider = new S3StorageProvider({
      provider: config.STORAGE_PROVIDER as "s3" | "r2" | "minio" | "b2",
      endpoint: config.STORAGE_ENDPOINT,
      region: config.STORAGE_REGION,
      accessKey: config.STORAGE_ACCESS_KEY,
      secretKey: config.STORAGE_SECRET_KEY,
      bucket: config.STORAGE_BUCKET,
      derivativesBucket: config.STORAGE_BUCKET_DERIVATIVES,
      forcePathStyle: needsPathStyle,
    });
    _initializationPromise = null;
  }

  return _storageProvider;
}

/**
 * Initialize storage provider (internal helper)
 */
async function initializeStorageProvider(): Promise<IStorageProvider> {
  const needsPathStyle =
    config.STORAGE_PROVIDER === "minio" ||
    config.STORAGE_PROVIDER === "b2" ||
    (config.STORAGE_ENDPOINT?.includes("localhost") ?? false);

  return new S3StorageProvider({
    provider: config.STORAGE_PROVIDER as "s3" | "r2" | "minio" | "b2",
    endpoint: config.STORAGE_ENDPOINT,
    region: config.STORAGE_REGION,
    accessKey: config.STORAGE_ACCESS_KEY,
    secretKey: config.STORAGE_SECRET_KEY,
    bucket: config.STORAGE_BUCKET,
    derivativesBucket: config.STORAGE_BUCKET_DERIVATIVES,
    forcePathStyle: needsPathStyle,
  });
}

/**
 * Dispose of the storage provider (for graceful shutdown)
 */
export async function disposeStorageProvider(): Promise<void> {
  if (_storageProvider) {
    // S3 client doesn't have a explicit dispose, but we can clear the reference
    _storageProvider = null;
    _initializationPromise = null;
    console.log("[Storage] Provider disposed");
  }
}

/**
 * Get the configured CDN provider instance (lazy initialization)
 */
export function getCDNProvider(): ICDNProvider {
  if (_cdnProvider) {
    return _cdnProvider;
  }

  const cdnConfig = {
    provider: config.CDN_PROVIDER as CDNProviderType,
    baseUrl: config.CDN_BASE_URL || "",
    signingKey: config.CDN_SIGNING_KEY,
    apiKey: config.CDN_API_KEY,
    storageBucket: config.STORAGE_BUCKET_DERIVATIVES || config.STORAGE_BUCKET,
  };

  switch (cdnConfig.provider) {
    case "bunny":
      _cdnProvider = new BunnyCDNProvider(cdnConfig);
      break;
    case "cloudfront":
    case "fastly":
      // Placeholder - fall through to no CDN for now
      console.warn(
        `[Storage] CDN provider '${cdnConfig.provider}' not yet implemented, using no CDN`
      );
      _cdnProvider = new NoCDNProvider();
      break;
    case "none":
    default:
      _cdnProvider = new NoCDNProvider();
      break;
  }

  return _cdnProvider;
}

/**
 * Dispose of the CDN provider (for graceful shutdown)
 */
export async function disposeCDNProvider(): Promise<void> {
  if (_cdnProvider) {
    _cdnProvider = null;
    console.log("[Storage] CDN provider disposed");
  }
}

/**
 * Get the configured backup provider instance (lazy initialization)
 */
export function getBackupProvider(): IBackupProvider {
  if (_backupProvider) {
    return _backupProvider;
  }

  // Check if backups are enabled
  if (!config.BACKUP_ENABLED || !config.BACKUP_STORAGE_BUCKET) {
    _backupProvider = new NoBackupProvider();
    return _backupProvider;
  }

  // Determine if we need path-style URLs (MinIO, B2 need this)
  const needsPathStyle =
    config.STORAGE_PROVIDER === "minio" ||
    config.STORAGE_PROVIDER === "b2" ||
    (config.STORAGE_ENDPOINT?.includes("localhost") ?? false);

  _backupProvider = new S3BackupProvider({
    enabled: config.BACKUP_ENABLED,
    bucket: config.BACKUP_STORAGE_BUCKET,
    retentionDays: config.BACKUP_RETENTION_DAYS,
    snapshotIntervalHours: config.BACKUP_SNAPSHOT_INTERVAL_HOURS,
    storageProvider: config.STORAGE_PROVIDER as "s3" | "r2" | "minio" | "b2",
    endpoint: config.STORAGE_ENDPOINT,
    region: config.STORAGE_REGION,
    accessKey: config.STORAGE_ACCESS_KEY,
    secretKey: config.STORAGE_SECRET_KEY,
  });

  return _backupProvider;
}

/**
 * Dispose of the backup provider (for graceful shutdown)
 */
export async function disposeBackupProvider(): Promise<void> {
  if (_backupProvider) {
    _backupProvider = null;
    console.log("[Storage] Backup provider disposed");
  }
}

/**
 * Base key parts (without type and filename - those are added by specific helpers)
 */
type BaseKeyParts = Pick<StorageKey, "accountId" | "projectId" | "assetId">;

/**
 * Storage key builder helpers
 */
export const storageKeys = {
  /**
   * Build key for original file
   */
  original: (parts: BaseKeyParts, filename: string): string =>
    buildStorageKey({ ...parts, type: "original", filename }),

  /**
   * Build key for proxy video
   */
  proxy: (parts: BaseKeyParts, resolution: string): string =>
    buildStorageKey({ ...parts, type: "proxy", filename: `${resolution}.mp4` }),

  /**
   * Build key for thumbnail
   */
  thumbnail: (parts: BaseKeyParts, size = "320"): string =>
    buildStorageKey({ ...parts, type: "thumbnail", filename: `thumb_${size}.jpg` }),

  /**
   * Build key for custom thumbnail (user-uploaded or frame-captured)
   */
  customThumbnail: (parts: BaseKeyParts, size = "320"): string =>
    buildStorageKey({ ...parts, type: "thumbnail", filename: `custom_${size}.jpg` }),

  /**
   * Build key for filmstrip
   */
  filmstrip: (parts: BaseKeyParts): string =>
    buildStorageKey({ ...parts, type: "filmstrip", filename: "strip.jpg" }),

  /**
   * Build key for waveform data
   */
  waveform: (parts: BaseKeyParts, format: "json" | "png"): string =>
    buildStorageKey({ ...parts, type: "waveform", filename: `waveform.${format}` }),

  /**
   * Build key for HLS manifest
   */
  hlsMaster: (parts: BaseKeyParts): string =>
    buildStorageKey({ ...parts, type: "hls", filename: "master.m3u8" }),

  /**
   * Build key for HLS variant playlist
   */
  hlsVariant: (
    parts: BaseKeyParts,
    resolution: string
  ): string =>
    buildStorageKey({ ...parts, type: "hls", filename: `${resolution}/playlist.m3u8` }),

  /**
   * Build key for HLS segment
   */
  hlsSegment: (
    parts: BaseKeyParts,
    resolution: string,
    segment: number
  ): string =>
    buildStorageKey({
      ...parts,
      type: "hls",
      filename: `${resolution}/segment_${String(segment).padStart(4, "0")}.ts`,
    }),
};

/**
 * High-level storage operations
 */
export const storage = {
  /**
   * Check storage health
   */
  async healthCheck(): Promise<boolean> {
    return getStorageProvider().healthCheck();
  },

  /**
   * Generate upload URL for original file
   */
  async getUploadUrl(
    key: StorageKey,
    expiresIn = config.UPLOAD_PRESIGNED_URL_EXPIRY
  ): Promise<PresignedUrlResult> {
    const storageKey = buildStorageKey(key);
    return getStorageProvider().getPresignedUrl(storageKey, "put", expiresIn);
  },

  /**
   * Generate download URL
   */
  async getDownloadUrl(
    key: string,
    expiresIn = 3600
  ): Promise<PresignedUrlResult> {
    return getStorageProvider().getPresignedUrl(key, "get", expiresIn);
  },

  /**
   * Initialize chunked upload
   */
  async initChunkedUpload(key: StorageKey): Promise<MultipartUploadInit> {
    const storageKey = buildStorageKey(key);
    return getStorageProvider().initMultipartUpload(storageKey);
  },

  /**
   * Get URLs for upload parts
   */
  async getChunkUrls(
    key: string,
    uploadId: string,
    chunkCount: number
  ): Promise<MultipartPartUrl[]> {
    return getStorageProvider().getMultipartPartUrls(key, uploadId, chunkCount);
  },

  /**
   * Complete chunked upload
   */
  async completeChunkedUpload(
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<void> {
    return getStorageProvider().completeMultipartUpload(key, uploadId, parts);
  },

  /**
   * Abort chunked upload
   */
  async abortChunkedUpload(key: string, uploadId: string): Promise<void> {
    return getStorageProvider().abortMultipartUpload(key, uploadId);
  },

  /**
   * Get file metadata
   */
  async headObject(key: string): Promise<StorageObject | null> {
    return getStorageProvider().headObject(key);
  },

  /**
   * Delete a file
   */
  async deleteObject(key: string): Promise<void> {
    return getStorageProvider().deleteObject(key);
  },

  /**
   * Delete multiple files
   */
  async deleteObjects(keys: string[]): Promise<void> {
    return getStorageProvider().deleteObjects(keys);
  },

  /**
   * Copy a file
   */
  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    return getStorageProvider().copyObject(sourceKey, destKey);
  },

  /**
   * List files with prefix
   */
  async listObjects(prefix: string, maxKeys?: number): Promise<ListObjectsResult> {
    return getStorageProvider().listObjects(prefix, maxKeys);
  },

  /**
   * Get object content
   */
  async getObject(key: string): Promise<Buffer> {
    return getStorageProvider().getObject(key);
  },

  /**
   * Put object content
   */
  async putObject(
    key: string,
    body: Buffer | ReadableStream,
    contentType?: string
  ): Promise<void> {
    return getStorageProvider().putObject(key, body, contentType);
  },
};

// Re-export types
export { buildStorageKey, parseStorageKey };
export type {
  IStorageProvider,
  StorageKey,
  DerivativeType,
  PresignedUrlOperation,
  PresignedUrlResult,
  MultipartUploadInit,
  MultipartPartUrl,
  MultipartPart,
  StorageObject,
  ListObjectsResult,
  StorageConfig,
} from "./types.js";
export { S3StorageProvider } from "./s3-provider.js";

// CDN exports
export type {
  ICDNProvider,
  CDNProviderType,
  CDNConfig,
  CDNContentType,
  CDNDeliveryOptions,
  CDNDeliveryResult,
  CDNInvalidationResult,
} from "./cdn-types.js";
export { DEFAULT_CACHE_TTL, SIGNED_CONTENT_TYPES } from "./cdn-types.js";
export { BunnyCDNProvider, NoCDNProvider } from "./cdn-provider.js";

// Backup exports
export type {
  IBackupProvider,
  BackupSnapshot,
  BackupConfig,
} from "./backup-types.js";
export { S3BackupProvider, NoBackupProvider } from "./backup-provider.js";
