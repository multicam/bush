/**
 * Bush Platform - Storage Provider Types
 *
 * Provider-agnostic types for object storage operations.
 * Supports S3, Cloudflare R2, MinIO, and Backblaze B2.
 */

/**
 * Supported storage providers
 */
export type StorageProviderType = "s3" | "r2" | "minio" | "b2";

/**
 * Derivative types for storage keys
 */
export type DerivativeType =
  | "original"
  | "proxy"
  | "thumbnail"
  | "filmstrip"
  | "waveform"
  | "hls";

/**
 * Storage key components
 */
export interface StorageKey {
  accountId: string;
  projectId: string;
  assetId: string;
  type: DerivativeType;
  filename: string;
}

/**
 * Pre-signed URL types
 */
export type PresignedUrlOperation = "get" | "put";

/**
 * Pre-signed URL result
 */
export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
  key: string;
}

/**
 * Multipart upload part
 */
export interface MultipartPart {
  partNumber: number;
  etag: string;
}

/**
 * Multipart upload initialization result
 */
export interface MultipartUploadInit {
  uploadId: string;
  key: string;
}

/**
 * Multipart upload part URL
 */
export interface MultipartPartUrl {
  partNumber: number;
  url: string;
}

/**
 * Object metadata from storage
 */
export interface StorageObject {
  key: string;
  size: number;
  etag: string;
  lastModified: Date;
  contentType: string;
}

/**
 * List objects result
 */
export interface ListObjectsResult {
  objects: StorageObject[];
  nextCursor?: string;
  isTruncated: boolean;
}

/**
 * Storage provider interface
 * All storage operations go through this abstraction.
 */
export interface IStorageProvider {
  /**
   * Provider type identifier
   */
  readonly providerType: StorageProviderType;

  /**
   * Check if the provider is healthy and reachable
   */
  healthCheck(): Promise<boolean>;

  /**
   * Generate a pre-signed URL for direct upload/download
   */
  getPresignedUrl(
    key: string,
    operation: PresignedUrlOperation,
    expiresIn?: number
  ): Promise<PresignedUrlResult>;

  /**
   * Initialize a multipart upload
   */
  initMultipartUpload(key: string): Promise<MultipartUploadInit>;

  /**
   * Get pre-signed URLs for upload parts
   */
  getMultipartPartUrls(
    key: string,
    uploadId: string,
    partCount: number
  ): Promise<MultipartPartUrl[]>;

  /**
   * Complete a multipart upload
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<void>;

  /**
   * Abort a multipart upload
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  /**
   * Get object metadata
   */
  headObject(key: string): Promise<StorageObject | null>;

  /**
   * Delete an object
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Delete multiple objects
   */
  deleteObjects(keys: string[]): Promise<void>;

  /**
   * Copy an object within the same bucket
   */
  copyObject(sourceKey: string, destKey: string): Promise<void>;

  /**
   * List objects with a prefix
   */
  listObjects(prefix: string, maxKeys?: number): Promise<ListObjectsResult>;

  /**
   * Get object content as buffer
   */
  getObject(key: string): Promise<Buffer>;

  /**
   * Put object content
   */
  putObject(
    key: string,
    body: Buffer | ReadableStream,
    contentType?: string
  ): Promise<void>;
}

/**
 * Storage service configuration
 */
export interface StorageConfig {
  provider: StorageProviderType;
  endpoint?: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  derivativesBucket?: string;
  forcePathStyle?: boolean;
}

/**
 * Build a storage key from components
 */
export function buildStorageKey(parts: StorageKey): string {
  return `${parts.accountId}/${parts.projectId}/${parts.assetId}/${parts.type}/${parts.filename}`;
}

/**
 * Parse a storage key into components
 */
export function parseStorageKey(key: string): StorageKey | null {
  const parts = key.split("/");
  if (parts.length !== 5) return null;

  const [accountId, projectId, assetId, type, filename] = parts;
  if (
    !accountId ||
    !projectId ||
    !assetId ||
    !type ||
    !filename
  ) {
    return null;
  }

  if (
    ![
      "original",
      "proxy",
      "thumbnail",
      "filmstrip",
      "waveform",
      "hls",
    ].includes(type)
  ) {
    return null;
  }

  return {
    accountId,
    projectId,
    assetId,
    type: type as DerivativeType,
    filename,
  };
}
