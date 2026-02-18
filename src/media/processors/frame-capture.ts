/**
 * Bush Platform - Frame Capture Processor
 *
 * Captures a specific frame from a video file for custom thumbnail.
 */
import { db } from "../../db/index.js";
import { files } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { storage, storageKeys } from "../../storage/index.js";
import type { FrameCaptureJobData } from "../types.js";
import { JOB_TIMEOUTS, THUMBNAIL_DIMENSIONS } from "../types.js";
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
 * Process a frame capture job for custom thumbnail
 */
export async function processFrameCapture(
  jobData: FrameCaptureJobData
): Promise<{ storageKey: string }> {
  const { assetId, accountId, projectId, storageKey, timestamp } = jobData;

  console.log(`[frame-capture] Capturing frame at ${timestamp}s for asset ${assetId}`);

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`frame-${assetId}`);

    // Download source video from storage
    const sourceBuffer = await storage.getObject(storageKey);
    const sourcePath = join(tempDir, "source.mp4");
    await writeFile(sourcePath, sourceBuffer);

    // Capture frame at specified timestamp
    const outputPath = join(tempDir, "frame.jpg");
    const dims = THUMBNAIL_DIMENSIONS.medium;

    await captureFrame(
      sourcePath,
      outputPath,
      dims.width,
      dims.height,
      timestamp
    );

    // Verify frame was captured
    if (!(await fileExists(outputPath))) {
      throw new Error(`Failed to capture frame at ${timestamp}s`);
    }

    // Upload custom thumbnail to storage
    const thumbnailKey = storageKeys.customThumbnail(
      { accountId, projectId, assetId },
      "640"
    );

    const thumbnailBuffer = await readFile(outputPath);
    await storage.putObject(thumbnailKey, thumbnailBuffer, "image/jpeg");

    // Update file with custom thumbnail key
    await db
      .update(files)
      .set({
        customThumbnailKey: thumbnailKey,
        updatedAt: new Date(),
      })
      .where(eq(files.id, assetId));

    console.log(`[frame-capture] Captured frame for ${assetId} at ${timestamp}s`);

    return { storageKey: thumbnailKey };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Capture a single frame from a video file
 */
async function captureFrame(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  positionSeconds: number
): Promise<void> {
  const scaleFilter = buildScaleFilter(width, height);

  await runFFmpeg(
    [
      "-ss", String(positionSeconds),
      "-i", inputPath,
      "-vframes", "1",
      "-vf", scaleFilter,
      "-c:v", "mjpeg",
      "-q:v", "2", // High quality
      "-y",
      outputPath,
    ],
    JOB_TIMEOUTS.frame_capture
  );
}
