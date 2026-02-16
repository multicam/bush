/**
 * Bush Platform - Thumbnail Generation Processor
 *
 * Generates thumbnails for images and videos.
 * Reference: specs/15-media-processing.md Section 2
 */
import { storage, storageKeys } from "../../storage/index.js";
import { config } from "../../config/index.js";
import type {
  ThumbnailJobData,
  ThumbnailJobResult,
  MetadataJobResult,
} from "../types.js";
import {
  THUMBNAIL_DIMENSIONS,
  JOB_TIMEOUTS,
} from "../types.js";
import {
  runFFmpeg,
  createTempDir,
  cleanupTempDir,
  buildScaleFilter,
  fileExists,
} from "../ffmpeg.js";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Process a thumbnail generation job
 */
export async function processThumbnail(
  jobData: ThumbnailJobData,
  metadata?: MetadataJobResult
): Promise<ThumbnailJobResult> {
  const { assetId, accountId, projectId, storageKey, mimeType, sizes } = jobData;

  console.log(`[thumbnail] Processing asset ${assetId}`, { sizes });

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`thumb-${assetId}`);

    // Download source file from storage
    const sourceBuffer = await storage.getObject(storageKey);
    const sourcePath = join(tempDir, "source");
    await writeFile(sourcePath, sourceBuffer);

    const results: ThumbnailJobResult["sizes"] = [];

    // Determine thumbnail position (50% for videos with duration)
    const thumbnailPosition = metadata?.duration
      ? metadata.duration * config.THUMBNAIL_POSITION
      : 0;

    for (const size of sizes) {
      const dims = THUMBNAIL_DIMENSIONS[size];
      const outputPath = join(
        tempDir,
        `thumb_${size}.${config.THUMBNAIL_FORMAT}`
      );

      // Generate thumbnail based on file type
      if (mimeType.startsWith("video/")) {
        await generateVideoThumbnail(
          sourcePath,
          outputPath,
          dims.width,
          dims.height,
          thumbnailPosition
        );
      } else if (mimeType.startsWith("image/")) {
        await generateImageThumbnail(
          sourcePath,
          outputPath,
          dims.width,
          dims.height,
          mimeType
        );
      } else {
        console.log(`[thumbnail] Skipping size ${size} - unsupported mime type: ${mimeType}`);
        continue;
      }

      // Verify thumbnail was created
      if (!(await fileExists(outputPath))) {
        console.error(`[thumbnail] Failed to generate ${size} thumbnail`);
        continue;
      }

      // Upload thumbnail to storage
      const thumbnailKey = storageKeys.thumbnail(
        { accountId, projectId, assetId },
        dims.width.toString()
      );

      const thumbnailBuffer = await readFile(outputPath);
      await storage.putObject(
        thumbnailKey,
        thumbnailBuffer,
        config.THUMBNAIL_FORMAT === "webp" ? "image/webp" : "image/jpeg"
      );

      results.push({
        size,
        storageKey: thumbnailKey,
        width: dims.width,
        height: dims.height,
      });

      console.log(`[thumbnail] Generated ${size} thumbnail for ${assetId}`);
    }

    return { sizes: results };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Generate thumbnail from video file
 */
async function generateVideoThumbnail(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  positionSeconds: number
): Promise<void> {
  const scaleFilter = buildScaleFilter(width, height);
  const formatArgs =
    config.THUMBNAIL_FORMAT === "webp"
      ? ["-c:v", "libwebp", "-quality", String(config.THUMBNAIL_QUALITY)]
      : ["-c:v", "mjpeg", "-q:v", String(Math.round(config.THUMBNAIL_QUALITY / 10))];

  await runFFmpeg(
    [
      "-ss", String(positionSeconds),
      "-i", inputPath,
      "-vframes", "1",
      "-vf", scaleFilter,
      ...formatArgs,
      "-y",
      outputPath,
    ],
    JOB_TIMEOUTS.thumbnail
  );
}

/**
 * Generate thumbnail from image file
 */
async function generateImageThumbnail(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  mimeType: string
): Promise<void> {
  // Handle RAW formats (cr2, cr3, nef, etc.)
  if (isRAWImage(mimeType, inputPath)) {
    // RAW files need conversion via dcraw first
    // For now, skip - would need dcraw binary
    console.log(`[thumbnail] RAW image detected, skipping: ${inputPath}`);
    return;
  }

  // Handle Adobe formats (psd, ai, eps)
  if (isAdobeFormat(mimeType, inputPath)) {
    // Adobe files need ImageMagick
    // For now, skip - would need ImageMagick binary
    console.log(`[thumbnail] Adobe format detected, skipping: ${inputPath}`);
    return;
  }

  const scaleFilter = buildScaleFilter(width, height);
  const formatArgs =
    config.THUMBNAIL_FORMAT === "webp"
      ? ["-c:v", "libwebp", "-quality", String(config.THUMBNAIL_QUALITY)]
      : ["-c:v", "mjpeg", "-q:v", String(Math.round(config.THUMBNAIL_QUALITY / 10))];

  // For animated GIF/WebP, extract first frame only
  const animatedArgs = isAnimatedImage(mimeType)
    ? ["-vframes", "1"]
    : [];

  await runFFmpeg(
    [
      "-i", inputPath,
      ...animatedArgs,
      "-vf", scaleFilter,
      ...formatArgs,
      "-y",
      outputPath,
    ],
    JOB_TIMEOUTS.thumbnail
  );
}

/**
 * Check if file is a RAW image format
 */
function isRAWImage(_mimeType: string, filename: string): boolean {
  const rawExtensions = [
    ".cr2", ".cr3", ".crw", ".nef", ".arw", ".sr2", ".srf", ".srw",
    ".orf", ".raf", ".pef", ".mrw", ".rw2", ".3fr", ".dng",
  ];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return rawExtensions.includes(ext);
}

/**
 * Check if file is an Adobe format
 */
function isAdobeFormat(_mimeType: string, filename: string): boolean {
  const adobeExtensions = [".psd", ".ai", ".eps", ".indd"];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return adobeExtensions.includes(ext);
}

/**
 * Check if image is animated
 */
function isAnimatedImage(mimeType: string): boolean {
  return mimeType === "image/gif" || mimeType === "image/webp";
}
