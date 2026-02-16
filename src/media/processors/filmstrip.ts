/**
 * Bush Platform - Filmstrip Generation Processor
 *
 * Generates hover-scrub filmstrip sprite sheets for video files.
 * Reference: specs/15-media-processing.md Section 3
 */
import { storage, storageKeys } from "../../storage/index.js";
import type {
  FilmstripJobData,
  FilmstripJobResult,
  MetadataJobResult,
} from "../types.js";
import { FILMSTRIP_CONFIG, JOB_TIMEOUTS } from "../types.js";
import {
  runFFmpeg,
  createTempDir,
  cleanupTempDir,
  fileExists,
  getFileSize,
} from "../ffmpeg.js";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Filmstrip manifest JSON structure
 */
interface FilmstripManifest {
  width: number;
  height: number;
  columns: number;
  rows: number;
  totalFrames: number;
  intervalSeconds: number;
}

/**
 * Process a filmstrip generation job
 */
export async function processFilmstrip(
  jobData: FilmstripJobData,
  metadata?: MetadataJobResult
): Promise<FilmstripJobResult> {
  const {
    assetId,
    accountId,
    projectId,
    storageKey,
    mimeType,
    durationSeconds,
  } = jobData;

  console.log(`[filmstrip] Processing asset ${assetId}`);

  // Skip non-video files
  if (!mimeType.startsWith("video/")) {
    console.log(`[filmstrip] Skipping non-video file: ${mimeType}`);
    return {
      storageKey: "",
      manifestKey: "",
      width: 0,
      height: 0,
      columns: 0,
      rows: 0,
      totalFrames: 0,
    };
  }

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`filmstrip-${assetId}`);

    // Download source file from storage
    const sourceBuffer = await storage.getObject(storageKey);
    const sourcePath = join(tempDir, "source");
    await writeFile(sourcePath, sourceBuffer);

    // Get duration from metadata or job data
    const duration = durationSeconds || metadata?.duration || 0;

    if (!duration || duration <= 0) {
      console.log(`[filmstrip] No duration found, skipping`);
      return {
        storageKey: "",
        manifestKey: "",
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        totalFrames: 0,
      };
    }

    // Calculate frames
    const fps = FILMSTRIP_CONFIG.fps;
    const totalFrames = Math.ceil(duration * fps);
    const columns = FILMSTRIP_CONFIG.columns;
    const rows = Math.ceil(totalFrames / columns);

    console.log(`[filmstrip] Generating ${totalFrames} frames in ${rows}x${columns} grid`);

    // Generate filmstrip
    const outputPath = join(tempDir, "filmstrip.jpg");

    await generateFilmstrip(
      sourcePath,
      outputPath,
      FILMSTRIP_CONFIG.tileWidth,
      FILMSTRIP_CONFIG.tileHeight,
      columns,
      fps
    );

    // Verify filmstrip was created
    if (!(await fileExists(outputPath))) {
      console.error(`[filmstrip] Failed to generate filmstrip`);
      return {
        storageKey: "",
        manifestKey: "",
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        totalFrames: 0,
      };
    }

    // Upload filmstrip image to storage
    const filmstripKey = storageKeys.filmstrip({ accountId, projectId, assetId });
    const filmstripBuffer = await readFile(outputPath);
    await storage.putObject(filmstripKey, filmstripBuffer, "image/jpeg");

    // Create and upload manifest
    const manifest: FilmstripManifest = {
      width: FILMSTRIP_CONFIG.tileWidth,
      height: FILMSTRIP_CONFIG.tileHeight,
      columns,
      rows,
      totalFrames,
      intervalSeconds: 1 / fps,
    };

    const manifestKey = filmstripKey.replace(".jpg", ".json");
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8");
    await storage.putObject(manifestKey, manifestBuffer, "application/json");

    console.log(`[filmstrip] Generated filmstrip for ${assetId} (${await getFileSize(outputPath)} bytes)`);

    return {
      storageKey: filmstripKey,
      manifestKey,
      width: FILMSTRIP_CONFIG.tileWidth,
      height: FILMSTRIP_CONFIG.tileHeight,
      columns,
      rows,
      totalFrames,
    };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Generate a filmstrip sprite sheet from video
 *
 * Extracts frames at 1fps, scales to tile size, and arranges in a grid
 */
async function generateFilmstrip(
  inputPath: string,
  outputPath: string,
  tileWidth: number,
  tileHeight: number,
  columns: number,
  fps: number
): Promise<void> {
  // Build FFmpeg filter chain:
  // 1. Extract frames at specified fps
  // 2. Scale each frame to tile size
  // 3. Arrange in a tile grid
  const scaleFilter = `scale=${tileWidth}:${tileHeight}:force_original_aspect_ratio=decrease,pad=${tileWidth}:${tileHeight}:(ow-iw)/2:(oh-ih)/2:black`;
  const tileFilter = `tile=${columns}x0`; // 0 = auto rows

  const filterComplex = `fps=${fps},${scaleFilter},${tileFilter}`;

  await runFFmpeg(
    [
      "-i", inputPath,
      "-vf", filterComplex,
      "-c:v", "mjpeg",
      "-q:v", "3", // Quality 3 (1-31, lower = better)
      "-y",
      outputPath,
    ],
    JOB_TIMEOUTS.filmstrip
  );
}
