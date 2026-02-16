/**
 * Bush Platform - Media Processing Service
 *
 * High-level API for media processing operations.
 * Coordinates job enqueueing and status tracking.
 */
import { db } from "../db/index.js";
import { files } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  getQueue,
  addJob,
  closeQueues,
  QUEUE_NAMES,
} from "./queue.js";
import type {
  MediaJobData,
  MetadataJobData,
  ThumbnailJobData,
  FilmstripJobData,
  ProxyJobData,
  WaveformJobData,
  ThumbnailSize,
  ProxyResolution,
} from "./types.js";
import { JOB_PRIORITY as Priority } from "./types.js";

// Re-export types
export * from "./types.js";
export { QUEUE_NAMES, getQueue, closeQueues };

/**
 * Enqueue processing jobs for a newly uploaded file
 */
export async function enqueueProcessingJobs(
  assetId: string,
  accountId: string,
  projectId: string,
  storageKey: string,
  mimeType: string,
  sourceFilename: string,
  options?: {
    priority?: number;
    isBulkUpload?: boolean;
  }
): Promise<void> {
  const priority = options?.isBulkUpload
    ? Priority.BULK_UPLOAD
    : (options?.priority ?? Priority.STANDARD);

  const baseData = {
    assetId,
    accountId,
    projectId,
    storageKey,
    mimeType,
    sourceFilename,
    priority,
  };

  // Always enqueue metadata first - other jobs may depend on it
  const metadataJob: MetadataJobData = {
    ...baseData,
    type: "metadata",
  };
  await addJob(metadataJob);

  // Determine file type and enqueue appropriate jobs
  const fileType = getFileType(mimeType);

  if (fileType === "video") {
    // Video: thumbnail, filmstrip, proxy, waveform
    await enqueueVideoJobs(baseData);
  } else if (fileType === "audio") {
    // Audio: waveform only
    await enqueueAudioJobs(baseData);
  } else if (fileType === "image") {
    // Image: thumbnail only
    await enqueueImageJobs(baseData);
  }
  // Documents: skip for now - would need additional processing
}

/**
 * Enqueue video processing jobs
 */
async function enqueueVideoJobs(
  baseData: Omit<MediaJobData, "type">
): Promise<void> {
  // Thumbnail (all sizes)
  const thumbnailJob: ThumbnailJobData = {
    ...baseData,
    type: "thumbnail",
    sizes: ["small", "medium", "large"] as ThumbnailSize[],
  };
  await addJob(thumbnailJob);

  // Filmstrip (video only)
  // Duration will be determined from metadata - for now use placeholder
  const filmstripJob: FilmstripJobData = {
    ...baseData,
    type: "filmstrip",
    durationSeconds: 0, // Will be updated by metadata job
  };
  await addJob(filmstripJob);

  // Proxy transcoding (all resolutions)
  // Resolution and HDR info will be determined from metadata
  const proxyJob: ProxyJobData = {
    ...baseData,
    type: "proxy",
    resolutions: ["360p", "540p", "720p"] as ProxyResolution[], // Start with basic resolutions
    sourceWidth: 0, // Will be updated
    sourceHeight: 0, // Will be updated
    isHDR: false,
  };
  await addJob(proxyJob);

  // Waveform (video with audio)
  const waveformJob: WaveformJobData = {
    ...baseData,
    type: "waveform",
    durationSeconds: 0, // Will be updated
  };
  await addJob(waveformJob);
}

/**
 * Enqueue audio processing jobs
 */
async function enqueueAudioJobs(
  baseData: Omit<MediaJobData, "type">
): Promise<void> {
  // Waveform only for audio
  const waveformJob: WaveformJobData = {
    ...baseData,
    type: "waveform",
    durationSeconds: 0,
  };
  await addJob(waveformJob);
}

/**
 * Enqueue image processing jobs
 */
async function enqueueImageJobs(
  baseData: Omit<MediaJobData, "type">
): Promise<void> {
  // Thumbnail only for images
  const thumbnailJob: ThumbnailJobData = {
    ...baseData,
    type: "thumbnail",
    sizes: ["small", "medium", "large"] as ThumbnailSize[],
  };
  await addJob(thumbnailJob);
}

/**
 * Get file type from MIME type
 */
function getFileType(mimeType: string): "video" | "audio" | "image" | "document" | "other" {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation")
  ) {
    return "document";
  }
  return "other";
}

/**
 * Re-process an asset (user-initiated)
 */
export async function reprocessAsset(assetId: string): Promise<void> {
  // Get file details from database
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, assetId))
    .limit(1);

  if (!file) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  // Reset status to processing
  await db
    .update(files)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(files.id, assetId));

  // Build storage key
  const storageKey = `accounts/${file.projectId}/assets/${assetId}/original/${file.name}`;

  // Enqueue with high priority
  await enqueueProcessingJobs(
    assetId,
    file.projectId, // Would need to look up account from project
    file.projectId,
    storageKey,
    file.mimeType,
    file.originalName,
    { priority: Priority.USER_REPROCESS }
  );
}
