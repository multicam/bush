/**
 * Bush Platform - FFmpeg Utilities
 *
 * Helper functions for running FFmpeg/FFprobe commands.
 * Reference: specs/15-media-processing.md
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { access, mkdir, rm, stat } from "fs/promises";
import { join } from "path";
import { config } from "../config/index.js";
import type { HDRType, MetadataJobResult } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Ensure a directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // Directory already exists
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(path: string): Promise<number> {
  const stats = await stat(path);
  return stats.size;
}

/**
 * Create a temporary working directory
 */
export async function createTempDir(assetId: string): Promise<string> {
  const tempDir = join(config.MEDIA_TEMP_DIR, assetId);
  await ensureDir(tempDir);
  return tempDir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup temp dir ${dir}:`, error);
  }
}

/**
 * FFprobe output structure
 */
interface FFprobeOutput {
  format: {
    duration?: string;
    bit_rate?: string;
    size?: string;
    format_long_name?: string;
    start_time?: string;
  };
  streams: Array<{
    codec_type: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    bit_rate?: string;
    bits_per_raw_sample?: string;
    sample_rate?: string;
    channels?: number;
    pix_fmt?: string;
    color_space?: string;
    color_transfer?: string;
    color_primaries?: string;
    codec_tag_string?: string;
    side_data_list?: Array<{ side_data_type: string }>;
  }>;
}

/**
 * Run FFprobe and get media metadata
 */
export async function runFFprobe(inputPath: string): Promise<FFprobeOutput> {
  const { stdout } = await execFileAsync(
    config.FFPROBE_PATH,
    [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ],
    {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    }
  );

  return JSON.parse(stdout);
}

/**
 * Run FFmpeg command
 */
export async function runFFmpeg(
  args: string[],
  timeout?: number
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = timeout
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  try {
    await execFileAsync(config.FFMPEG_PATH, args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      signal: controller.signal,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Extract metadata from FFprobe output
 */
export function extractMetadata(
  probeOutput: FFprobeOutput,
  _mimeType: string
): MetadataJobResult {
  const videoStream = probeOutput.streams.find(
    (s) => s.codec_type === "video"
  );
  const audioStream = probeOutput.streams.find(
    (s) => s.codec_type === "audio"
  );

  // Parse duration
  const duration = probeOutput.format.duration
    ? parseFloat(probeOutput.format.duration)
    : null;

  // Parse frame rate (e.g., "30000/1001" -> 29.97)
  let frameRate: number | null = null;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split("/");
    if (num && den) {
      frameRate = parseInt(num, 10) / parseInt(den, 10);
    }
  }

  // Detect HDR
  const hdrInfo = detectHDR(videoStream);

  return {
    duration,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    frameRate,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    bitRate: probeOutput.format.bit_rate
      ? parseInt(probeOutput.format.bit_rate, 10)
      : null,
    sampleRate: audioStream?.sample_rate
      ? parseInt(audioStream.sample_rate, 10)
      : null,
    channels: audioStream?.channels ?? null,
    isHDR: hdrInfo.isHDR,
    hdrType: hdrInfo.hdrType,
    colorSpace: videoStream?.color_space ?? null,
    audioBitDepth: audioStream?.bits_per_raw_sample
      ? parseInt(audioStream.bits_per_raw_sample, 10)
      : null,
    format: probeOutput.format.format_long_name ?? null,
  };
}

/**
 * Detect HDR type from video stream properties
 */
function detectHDR(
  videoStream: FFprobeOutput["streams"][0] | undefined
): { isHDR: boolean; hdrType: HDRType | null } {
  if (!videoStream) {
    return { isHDR: false, hdrType: null };
  }

  const { color_transfer, color_primaries, codec_tag_string, side_data_list } =
    videoStream;

  // Check for Dolby Vision
  if (codec_tag_string?.includes("dovi")) {
    return { isHDR: true, hdrType: "Dolby Vision" };
  }

  // Check side data for Dolby Vision or HDR10+
  if (side_data_list?.some((sd) => sd.side_data_type === "Dolby Vision")) {
    return { isHDR: true, hdrType: "Dolby Vision" };
  }
  if (
    side_data_list?.some(
      (sd) =>
        sd.side_data_type === "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)"
    )
  ) {
    return { isHDR: true, hdrType: "HDR10+" };
  }

  // Check for HLG
  if (
    color_transfer === "arib-std-b67" &&
    color_primaries === "bt2020"
  ) {
    return { isHDR: true, hdrType: "HLG" };
  }

  // Check for HDR10
  if (
    color_transfer === "smpte2084" &&
    color_primaries === "bt2020"
  ) {
    return { isHDR: true, hdrType: "HDR10" };
  }

  return { isHDR: false, hdrType: null };
}

/**
 * Build FFmpeg scale filter with letterboxing
 */
export function buildScaleFilter(
  targetWidth: number,
  targetHeight: number
): string {
  return `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`;
}

/**
 * Map codec name to display name
 */
export function getCodecDisplayName(codecName: string): string {
  const codecMap: Record<string, string> = {
    h264: "H.264/AVC",
    hevc: "H.265/HEVC",
    prores: "Apple ProRes",
    dnxhd: "Avid DNxHD",
    mjpeg: "Motion JPEG",
    aac: "AAC",
    pcm_s16le: "PCM",
    pcm_s24le: "PCM",
    mp3: "MP3",
    flac: "FLAC",
    vorbis: "Vorbis",
  };
  return codecMap[codecName] ?? codecName.toUpperCase();
}
