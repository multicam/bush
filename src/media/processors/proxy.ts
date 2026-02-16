/**
 * Bush Platform - Proxy Transcoding Processor
 *
 * Generates proxy videos for streaming at multiple resolutions.
 * Reference: specs/15-media-processing.md Section 4
 */
import { storage, storageKeys } from "../../storage/index.js";
import { config } from "../../config/index.js";
import { db } from "../../db/index.js";
import { files } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type {
  ProxyJobData,
  ProxyJobResult,
  MetadataJobResult,
  ProxyResolution,
} from "../types.js";
import {
  PROXY_CONFIGS,
  JOB_TIMEOUTS,
} from "../types.js";
import {
  runFFmpeg,
  createTempDir,
  cleanupTempDir,
  buildScaleFilter,
  fileExists,
  getFileSize,
} from "../ffmpeg.js";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Process a proxy transcoding job
 */
export async function processProxy(
  jobData: ProxyJobData,
  metadata?: MetadataJobResult
): Promise<ProxyJobResult> {
  const {
    assetId,
    accountId,
    projectId,
    storageKey,
    mimeType,
    resolutions,
    sourceWidth,
    sourceHeight,
    isHDR,
    hdrType,
  } = jobData;

  console.log(`[proxy] Processing asset ${assetId}`, {
    resolutions,
    sourceWidth: sourceWidth || metadata?.width,
    sourceHeight: sourceHeight || metadata?.height,
    isHDR: isHDR || metadata?.isHDR,
  });

  // Skip non-video files
  if (!mimeType.startsWith("video/")) {
    console.log(`[proxy] Skipping non-video file: ${mimeType}`);
    return { resolutions: [] };
  }

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`proxy-${assetId}`);

    // Download source file from storage
    const sourceBuffer = await storage.getObject(storageKey);
    const sourcePath = join(tempDir, "source");
    await writeFile(sourcePath, sourceBuffer);

    const results: ProxyJobResult["resolutions"] = [];

    // Get actual source dimensions (prefer job data, fallback to metadata)
    const actualWidth = sourceWidth || metadata?.width || 1920;
    const actualHeight = sourceHeight || metadata?.height || 1080;
    const actualIsHDR = isHDR || metadata?.isHDR || false;
    const actualHDRType = hdrType || metadata?.hdrType || null;

    // Determine which resolutions to generate (never upscale)
    const resolutionsToGenerate = filterResolutionsBySource(
      resolutions,
      actualWidth,
      actualHeight
    );

    console.log(`[proxy] Generating ${resolutionsToGenerate.length} resolutions for ${actualWidth}x${actualHeight} source`);

    for (const resolution of resolutionsToGenerate) {
      const proxyConfig = PROXY_CONFIGS[resolution];
      const outputPath = join(tempDir, `proxy_${resolution}.mp4`);

      try {
        // Generate proxy with optional HDR tone mapping
        await generateProxy(
          sourcePath,
          outputPath,
          proxyConfig.width,
          proxyConfig.height,
          proxyConfig.videoBitrate,
          proxyConfig.audioBitrate,
          actualIsHDR,
          actualHDRType,
          resolution === "4k" // preserve HDR for 4K
        );

        // Verify proxy was created
        if (!(await fileExists(outputPath))) {
          console.error(`[proxy] Failed to generate ${resolution} proxy`);
          continue;
        }

        // Upload proxy to storage
        const proxyKey = storageKeys.proxy(
          { accountId, projectId, assetId },
          resolution
        );

        const proxyBuffer = await readFile(outputPath);
        await storage.putObject(proxyKey, proxyBuffer, "video/mp4");

        const fileSize = await getFileSize(outputPath);

        results.push({
          resolution,
          storageKey: proxyKey,
          fileSize,
        });

        console.log(`[proxy] Generated ${resolution} proxy for ${assetId} (${fileSize} bytes)`);
      } catch (error) {
        console.error(`[proxy] Error generating ${resolution} proxy:`, error);
        // Continue with other resolutions
      }
    }

    // Update file status if we have at least one successful proxy
    if (results.length > 0) {
      await updateFileProcessingStatus(assetId, "proxy", "completed");
    } else {
      await updateFileProcessingStatus(assetId, "proxy", "failed");
    }

    return { resolutions: results };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Filter resolutions to only those smaller than source
 */
function filterResolutionsBySource(
  resolutions: ProxyResolution[],
  _sourceWidth: number,
  sourceHeight: number
): ProxyResolution[] {
  const resolutionHeights: Record<ProxyResolution, number> = {
    "360p": 360,
    "540p": 540,
    "720p": 720,
    "1080p": 1080,
    "4k": 2160,
  };

  return resolutions.filter((res) => {
    const targetHeight = resolutionHeights[res];
    return targetHeight <= sourceHeight;
  });
}

/**
 * Generate a proxy video file
 */
async function generateProxy(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  videoBitrate: number,
  audioBitrate: number,
  isHDR: boolean,
  hdrType: string | null,
  preserveHDR: boolean
): Promise<void> {
  const scaleFilter = buildScaleFilter(width, height);

  // Build video filter chain
  let videoFilter = scaleFilter;

  // Apply HDR tone mapping for SDR proxies (all except 4K)
  if (isHDR && !preserveHDR) {
    videoFilter = buildToneMappingFilter(width, height, hdrType);
  }

  // Build FFmpeg arguments
  const args = [
    "-i", inputPath,
    "-c:v", "libx264",
    "-profile:v", preserveHDR ? "high10" : "high",
    "-b:v", `${videoBitrate}`,
    "-maxrate", `${Math.round(videoBitrate * 1.2)}`,
    "-bufsize", `${videoBitrate * 2}`,
    "-vf", videoFilter,
    "-c:a", "aac",
    "-b:a", `${audioBitrate}`,
    "-ac", "2",
    "-movflags", "+faststart",
    "-preset", config.PROXY_PRESET,
    "-y",
    outputPath,
  ];

  // Add HDR color metadata for 4K HDR proxies
  if (preserveHDR && isHDR) {
    args.splice(args.indexOf("-vf"), 0,
      "-pix_fmt", "yuv420p10le",
      "-color_primaries", "bt2020",
      "-color_trc", "smpte2084",
      "-colorspace", "bt2020nc"
    );
  } else {
    args.splice(args.indexOf("-vf"), 0, "-pix_fmt", "yuv420p");
  }

  // Calculate timeout based on resolution (higher resolution = more time)
  const timeoutMultiplier = height >= 1080 ? 2 : 1;
  const timeout = JOB_TIMEOUTS.proxy * timeoutMultiplier;

  await runFFmpeg(args, timeout);
}

/**
 * Build HDR tone mapping filter chain
 * Converts HDR to SDR using hable algorithm
 */
function buildToneMappingFilter(
  width: number,
  height: number,
  _hdrType: string | null
): string {
  // Hable tone mapping with proper color space conversion
  // Reference: specs/15-media-processing.md Section 7
  const toneMapFilter =
    `zscale=t=linear:npl=100,format=gbrpf32le,` +
    `zscale=p=bt709,tonemap=hable:desat=0,` +
    `zscale=t=bt709:m=bt709:r=tv,format=yuv420p`;

  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;

  return `${toneMapFilter},${scaleFilter}`;
}

/**
 * Update file processing status in database
 */
async function updateFileProcessingStatus(
  assetId: string,
  jobType: string,
  status: "completed" | "failed"
): Promise<void> {
  // For now, we don't have a separate processing_status column
  // We'll update the file's updatedAt timestamp
  // The main status will be set to "ready" when all jobs complete
  console.log(`[proxy] Updating ${jobType} status to ${status} for ${assetId}`);

  await db
    .update(files)
    .set({
      updatedAt: new Date(),
      // If proxy completed and status is processing, mark as ready
      // (In a full implementation, we'd check all job statuses)
      ...(status === "completed" ? { status: "ready" } : {}),
    })
    .where(eq(files.id, assetId));
}
