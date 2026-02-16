/**
 * Bush Platform - Metadata Extraction Processor
 *
 * Extracts metadata from media files using FFprobe.
 * Reference: specs/15-media-processing.md Section 6
 */
import { db } from "../../db/index.js";
import { files } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { storage } from "../../storage/index.js";
import type { MetadataJobData, MetadataJobResult } from "../types.js";
import {
  runFFprobe,
  extractMetadata,
  createTempDir,
  cleanupTempDir,
} from "../ffmpeg.js";

/**
 * Process a metadata extraction job
 */
export async function processMetadata(
  jobData: MetadataJobData
): Promise<MetadataJobResult> {
  const { assetId, storageKey, mimeType } = jobData;

  console.log(`[metadata] Processing asset ${assetId}`);

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`metadata-${assetId}`);

    // Download file from storage to temp location
    const objectBuffer = await storage.getObject(storageKey);

    // Run FFprobe on the storage key directly (S3 supports HTTP range requests)
    // For now, we'll use a different approach - stream the minimal needed data

    // Alternative: Use FFprobe with the file size from storage
    const probeOutput = await runFFprobeFromBuffer(
      objectBuffer,
      mimeType,
      tempDir
    );

    // Extract metadata
    const metadata = extractMetadata(probeOutput, mimeType);

    // Update file record in database with extracted metadata
    await updateFileMetadata(assetId, metadata);

    console.log(`[metadata] Completed for asset ${assetId}`, {
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      isHDR: metadata.isHDR,
    });

    return metadata;
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Run FFprobe on a buffer by writing to temp file
 */
async function runFFprobeFromBuffer(
  buffer: Buffer,
  mimeType: string,
  tempDir: string
): Promise<ReturnType<typeof runFFprobe>> {
  const { writeFile } = await import("fs/promises");
  const { join } = await import("path");

  // Write buffer to temp file
  const extension = getExtensionFromMimeType(mimeType);
  const tempFile = join(tempDir, `source${extension}`);
  await writeFile(tempFile, buffer);

  // Run FFprobe
  return runFFprobe(tempFile);
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
    "video/x-flv": ".flv",
    "video/3gpp": ".3gp",
    "video/x-ms-wmv": ".wmv",
    "application/mxf": ".mxf",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-aiff": ".aiff",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/x-ms-wma": ".wma",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/tiff": ".tiff",
    "image/bmp": ".bmp",
    "image/x-tga": ".tga",
    "image/x-exr": ".exr",
    "image/heic": ".heic",
  };

  return mimeToExt[mimeType] ?? "";
}

/**
 * Update file record with extracted metadata
 */
async function updateFileMetadata(
  assetId: string,
  _metadata: MetadataJobResult
): Promise<void> {
  // Store metadata as JSON in a separate column or update individual columns
  // For now, we'll update the status and store technical metadata
  await db
    .update(files)
    .set({
      // Store metadata in a JSON format - we may need to add this column
      // For now, just update the status
      updatedAt: new Date(),
    })
    .where(eq(files.id, assetId));
}
