/**
 * Bush Platform - HLS Generation Processor
 *
 * Segments proxy MP4 files into HLS format for adaptive streaming.
 * Generates per-resolution variant playlists and a master playlist.
 *
 * Reference: specs/07-media-processing.md Section 6
 */
import { storage, storageKeys } from "../../storage/index.js";
import { config } from "../../config/index.js";
import { db } from "../../db/index.js";
import { files } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type {
  HLSJobData,
  HLSJobResult,
  MetadataJobResult,
  ProxyResolution,
} from "../types.js";
import { PROXY_CONFIGS, JOB_TIMEOUTS } from "../types.js";
import {
  runFFmpeg,
  createTempDir,
  cleanupTempDir,
  fileExists,
  ensureDir,
} from "../ffmpeg.js";
import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Process an HLS generation job
 */
export async function processHLS(
  jobData: HLSJobData,
  metadata?: MetadataJobResult
): Promise<HLSJobResult> {
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

  console.log(`[hls] Processing asset ${assetId}`, {
    resolutions,
    sourceWidth: sourceWidth || metadata?.width,
    sourceHeight: sourceHeight || metadata?.height,
  });

  // Skip non-video files
  if (!mimeType.startsWith("video/")) {
    console.log(`[hls] Skipping non-video file: ${mimeType}`);
    return { masterPlaylistKey: "", resolutions: [] };
  }

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`hls-${assetId}`);

    // Download source file from storage (use original for HLS generation)
    const sourceBuffer = await storage.getObject(storageKey);
    const sourcePath = join(tempDir, "source");
    await writeFile(sourcePath, sourceBuffer);

    // Get actual source dimensions (prefer job data, fallback to metadata)
    const actualWidth = sourceWidth || metadata?.width || 1920;
    const actualHeight = sourceHeight || metadata?.height || 1080;
    const actualIsHDR = isHDR || metadata?.isHDR || false;
    void hdrType; // Preserve for future HDR-specific HLS handling

    // Determine which resolutions to generate (never upscale)
    const resolutionsToGenerate = filterResolutionsBySource(
      resolutions,
      actualWidth,
      actualHeight
    );

    console.log(
      `[hls] Generating ${resolutionsToGenerate.length} HLS variants for ${actualWidth}x${actualHeight} source`
    );

    const results: HLSJobResult["resolutions"] = [];
    const masterPlaylistEntries: string[] = [];

    // Create HLS output directory structure
    const hlsOutputDir = join(tempDir, "hls");
    await ensureDir(hlsOutputDir);

    for (const resolution of resolutionsToGenerate) {
      const proxyConfig = PROXY_CONFIGS[resolution];
      const variantDir = join(hlsOutputDir, resolution);

      try {
        await ensureDir(variantDir);

        // Generate HLS segments and playlist for this resolution
        await generateHLSVariant(
          sourcePath,
          variantDir,
          resolution,
          proxyConfig.videoBitrate,
          proxyConfig.width,
          proxyConfig.height,
          actualIsHDR
        );

        // Read the generated playlist
        const playlistPath = join(variantDir, "playlist.m3u8");
        if (!(await fileExists(playlistPath))) {
          console.error(
            `[hls] Failed to generate ${resolution} playlist - file not created`
          );
          continue;
        }

        // Upload playlist to storage
        const playlistKey = storageKeys.hlsVariant(
          { accountId, projectId, assetId },
          resolution
        );
        const playlistBuffer = await readFile(playlistPath);
        await storage.putObject(playlistKey, playlistBuffer, "application/vnd.apple.mpegurl");

        // Upload all segment files
        const segmentFiles = (await readdir(variantDir))
          .filter((f) => f.endsWith(".ts"))
          .sort();

        for (const segmentFile of segmentFiles) {
          const segmentPath = join(variantDir, segmentFile);
          const segmentBuffer = await readFile(segmentPath);

          // Extract segment number from filename (segment_0001.ts -> 1)
          const match = segmentFile.match(/segment_(\d+)\.ts/);
          if (!match) continue;

          const segmentNum = parseInt(match[1], 10);
          const segmentKey = storageKeys.hlsSegment(
            { accountId, projectId, assetId },
            resolution,
            segmentNum
          );

          await storage.putObject(segmentKey, segmentBuffer, "video/mp2t");
        }

        results.push({
          resolution,
          playlistKey,
          segmentCount: segmentFiles.length,
        });

        // Add entry to master playlist
        const bandwidth = proxyConfig.videoBitrate + proxyConfig.audioBitrate;
        masterPlaylistEntries.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${proxyConfig.width}x${proxyConfig.height}\n` +
            `${resolution}/playlist.m3u8`
        );

        console.log(
          `[hls] Generated ${resolution} HLS variant for ${assetId} (${segmentFiles.length} segments)`
        );
      } catch (error) {
        console.error(`[hls] Error generating ${resolution} HLS:`, error);
        // Continue with other resolutions
      }
    }

    // Generate and upload master playlist
    if (results.length > 0) {
      // Check if a WebVTT caption file exists for this asset
      const captionKey = storageKeys.caption(
        { accountId, projectId, assetId },
        "en"
      );
      let captionUri: string | undefined;
      // Quick existence check — if the caption file exists, include it in the manifest
      const captionObj = await storage.headObject(captionKey);
      if (captionObj) {
        // Caption URI is relative to the master playlist location
        captionUri = "../captions/en.vtt";
      }

      const masterPlaylist = generateMasterPlaylist(masterPlaylistEntries, {
        captionUri,
        captionLanguage: "en",
      });
      const masterPlaylistKey = storageKeys.hlsMaster({
        accountId,
        projectId,
        assetId,
      });
      await storage.putObject(
        masterPlaylistKey,
        Buffer.from(masterPlaylist),
        "application/vnd.apple.mpegurl"
      );

      // Update file status
      await updateFileProcessingStatus(assetId, "hls", "completed");

      return {
        masterPlaylistKey,
        resolutions: results,
      };
    } else {
      await updateFileProcessingStatus(assetId, "hls", "failed");
      return { masterPlaylistKey: "", resolutions: [] };
    }
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
 * Generate HLS segments and playlist for a single resolution
 * Returns the number of segments generated
 */
async function generateHLSVariant(
  inputPath: string,
  outputDir: string,
  _resolution: ProxyResolution, // Kept for future resolution-specific handling
  videoBitrate: number,
  width: number,
  height: number,
  _isHDR: boolean
): Promise<number> {
  const playlistPath = join(outputDir, "playlist.m3u8");
  const segmentPattern = join(outputDir, "segment_%04d.ts");

  // Build FFmpeg arguments for HLS segmentation
  // We transcode directly from source rather than using existing proxy
  // to ensure consistent segment boundaries and quality
  const args = [
    "-i", inputPath,
    "-c:v", "libx264",
    "-profile:v", "high",
    "-b:v", `${videoBitrate}`,
    "-maxrate", `${Math.round(videoBitrate * 1.2)}`,
    "-bufsize", `${videoBitrate * 2}`,
    "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-pix_fmt", "yuv420p",
    "-f", "hls",
    "-hls_time", String(config.HLS_SEGMENT_DURATION),
    "-hls_list_size", "0", // Include all segments in playlist
    "-hls_segment_filename", segmentPattern,
    "-hls_playlist_type", "vod",
    "-movflags", "+faststart",
    "-preset", config.PROXY_PRESET,
    "-y",
    playlistPath,
  ];

  await runFFmpeg(args, JOB_TIMEOUTS.hls);

  // Count segments generated
  const files = await readdir(outputDir);
  const segments = files.filter((f) => f.endsWith(".ts"));
  return segments.length;
}

/**
 * Generate master playlist content.
 * When captionUri is provided, adds a subtitle track reference and
 * appends SUBTITLES="subs" to each variant's EXT-X-STREAM-INF.
 */
function generateMasterPlaylist(
  variantEntries: string[],
  options?: { captionUri?: string; captionLanguage?: string }
): string {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    "",
  ];

  // Add subtitle track if caption URI is provided
  if (options?.captionUri) {
    const lang = options.captionLanguage || "en";
    lines.push(
      `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${lang === "en" ? "English" : lang}",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="${lang}",URI="${options.captionUri}"`
    );
    lines.push("");
  }

  // Add variant entries — append SUBTITLES group if captions exist
  for (const entry of variantEntries) {
    if (options?.captionUri) {
      // Insert SUBTITLES="subs" into the EXT-X-STREAM-INF line
      lines.push(entry.replace("\n", `,SUBTITLES="subs"\n`) + "\n");
    } else {
      lines.push(entry + "\n");
    }
  }

  return lines.join("\n");
}

/**
 * Update file processing status in database
 */
async function updateFileProcessingStatus(
  assetId: string,
  jobType: string,
  status: "completed" | "failed"
): Promise<void> {
  console.log(`[hls] Updating ${jobType} status to ${status} for ${assetId}`);

  await db
    .update(files)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(files.id, assetId));
}
