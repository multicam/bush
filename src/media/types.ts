/**
 * Bush Platform - Media Processing Types
 *
 * Type definitions for the media processing pipeline.
 * Reference: specs/15-media-processing.md
 */

/**
 * Job types in the media processing pipeline
 */
export type MediaJobType =
  | "metadata"
  | "thumbnail"
  | "filmstrip"
  | "proxy"
  | "waveform"
  | "hls";

/**
 * Queue names for BullMQ
 */
export const QUEUE_NAMES = {
  METADATA: "media:metadata",
  THUMBNAIL: "media:thumbnail",
  FILMSTRIP: "media:filmstrip",
  PROXY: "media:proxy",
  WAVEFORM: "media:waveform",
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

/**
 * Job priority levels (lower = higher priority)
 */
export const JOB_PRIORITY = {
  USER_REPROCESS: 1,
  STANDARD: 5,
  BULK_UPLOAD: 10,
} as const;

/**
 * Base job data shared by all media jobs
 */
export interface BaseJobData {
  assetId: string;
  accountId: string;
  projectId: string;
  storageKey: string;
  mimeType: string;
  sourceFilename: string;
  priority?: number;
}

/**
 * Metadata extraction job data
 */
export interface MetadataJobData extends BaseJobData {
  type: "metadata";
}

/**
 * Thumbnail generation job data
 */
export interface ThumbnailJobData extends BaseJobData {
  type: "thumbnail";
  sizes: ThumbnailSize[];
}

export type ThumbnailSize = "small" | "medium" | "large";

/**
 * Filmstrip generation job data (video only)
 */
export interface FilmstripJobData extends BaseJobData {
  type: "filmstrip";
  durationSeconds: number;
}

/**
 * Proxy transcoding job data (video only)
 */
export interface ProxyJobData extends BaseJobData {
  type: "proxy";
  resolutions: ProxyResolution[];
  sourceWidth: number;
  sourceHeight: number;
  isHDR: boolean;
  hdrType?: HDRType;
}

export type ProxyResolution = "360p" | "540p" | "720p" | "1080p" | "4k";

export type HDRType = "HDR10" | "HDR10+" | "HLG" | "Dolby Vision";

/**
 * Waveform generation job data (audio/video)
 */
export interface WaveformJobData extends BaseJobData {
  type: "waveform";
  durationSeconds: number;
}

/**
 * Union of all job data types
 */
export type MediaJobData =
  | MetadataJobData
  | ThumbnailJobData
  | FilmstripJobData
  | ProxyJobData
  | WaveformJobData;

/**
 * Job result types
 */
export interface MetadataJobResult {
  duration: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitRate: number | null;
  sampleRate: number | null;
  channels: number | null;
  isHDR: boolean;
  hdrType: HDRType | null;
  colorSpace: string | null;
  audioBitDepth: number | null;
  format: string | null;
}

export interface ThumbnailJobResult {
  sizes: {
    size: ThumbnailSize;
    storageKey: string;
    width: number;
    height: number;
  }[];
}

export interface FilmstripJobResult {
  storageKey: string;
  manifestKey: string;
  width: number;
  height: number;
  columns: number;
  rows: number;
  totalFrames: number;
}

export interface ProxyJobResult {
  resolutions: {
    resolution: ProxyResolution;
    storageKey: string;
    fileSize: number;
  }[];
}

export interface WaveformJobResult {
  storageKey: string;
  sampleRate: number;
  channels: number;
  duration: number;
  peaksCount: number;
}

/**
 * Processing status for an asset
 */
export interface ProcessingStatus {
  metadata: JobStatus;
  thumbnail: JobStatus;
  filmstrip: JobStatus;
  proxy: JobStatus;
  waveform: JobStatus;
}

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

/**
 * Job timeout configuration (in milliseconds)
 */
export const JOB_TIMEOUTS = {
  metadata: 30 * 1000, // 30 seconds
  thumbnail: 60 * 1000, // 1 minute
  filmstrip: 5 * 60 * 1000, // 5 minutes
  proxy: 30 * 60 * 1000, // 30 minutes (per resolution)
  waveform: 2 * 60 * 1000, // 2 minutes
} as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000, // 5 seconds initial
  },
} as const;

/**
 * Thumbnail size dimensions
 */
export const THUMBNAIL_DIMENSIONS = {
  small: { width: 320, height: 180 },
  medium: { width: 640, height: 360 },
  large: { width: 1280, height: 720 },
} as const;

/**
 * Proxy resolution configurations
 */
export const PROXY_CONFIGS = {
  "360p": { width: 640, height: 360, videoBitrate: 800_000, audioBitrate: 128_000 },
  "540p": { width: 960, height: 540, videoBitrate: 1_500_000, audioBitrate: 128_000 },
  "720p": { width: 1280, height: 720, videoBitrate: 2_500_000, audioBitrate: 128_000 },
  "1080p": { width: 1920, height: 1080, videoBitrate: 5_000_000, audioBitrate: 128_000 },
  "4k": { width: 3840, height: 2160, videoBitrate: 15_000_000, audioBitrate: 128_000 },
} as const;

/**
 * Filmstrip configuration
 */
export const FILMSTRIP_CONFIG = {
  tileWidth: 160,
  tileHeight: 90,
  columns: 10,
  fps: 1,
} as const;

/**
 * Waveform configuration
 */
export const WAVEFORM_CONFIG = {
  samplesPerSecond: 10, // 1 peak per 100ms
} as const;
