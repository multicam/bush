/**
 * Bush Platform - Waveform Generation Processor
 *
 * Extracts audio waveform data for visualization.
 * Reference: specs/15-media-processing.md Section 5
 */
import { storage, storageKeys } from "../../storage/index.js";
import { config } from "../../config/index.js";
import type {
  WaveformJobData,
  WaveformJobResult,
  MetadataJobResult,
} from "../types.js";
import { WAVEFORM_CONFIG, JOB_TIMEOUTS } from "../types.js";
import {
  createTempDir,
  cleanupTempDir,
} from "../ffmpeg.js";
import { writeFile } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Waveform data structure stored as JSON
 */
interface WaveformData {
  version: number;
  sampleRate: number;
  channels: number;
  duration: number;
  peaks: number[];
}

/**
 * Process a waveform extraction job
 */
export async function processWaveform(
  jobData: WaveformJobData,
  metadata?: MetadataJobResult
): Promise<WaveformJobResult> {
  const {
    assetId,
    accountId,
    projectId,
    storageKey,
    mimeType,
  } = jobData;

  console.log(`[waveform] Processing asset ${assetId}`);

  // Skip if not audio or video
  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
    console.log(`[waveform] Skipping non-audio/video file: ${mimeType}`);
    return {
      storageKey: "",
      sampleRate: 0,
      channels: 0,
      duration: 0,
      peaksCount: 0,
    };
  }

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await createTempDir(`waveform-${assetId}`);

    // Download source file from storage
    const sourceBuffer = await storage.getObject(storageKey);
    const sourcePath = join(tempDir, "source");
    await writeFile(sourcePath, sourceBuffer);

    // Get duration from metadata or probe
    const duration = metadata?.duration || await getAudioDuration(sourcePath);

    if (!duration || duration <= 0) {
      console.log(`[waveform] No duration found, skipping`);
      return {
        storageKey: "",
        sampleRate: 0,
        channels: 0,
        duration: 0,
        peaksCount: 0,
      };
    }

    // Calculate number of samples (1 peak per 100ms)
    const samplesPerSecond = WAVEFORM_CONFIG.samplesPerSecond;
    const totalSamples = Math.ceil(duration * samplesPerSecond);

    console.log(`[waveform] Extracting ${totalSamples} peaks for ${duration}s audio`);

    // Extract waveform peaks
    const peaks = await extractWaveformPeaks(sourcePath, totalSamples);

    // Build waveform data structure
    const waveformData: WaveformData = {
      version: 1,
      sampleRate: samplesPerSecond,
      channels: 1, // We average to mono
      duration,
      peaks,
    };

    // Upload waveform JSON to storage
    const waveformKey = storageKeys.waveform(
      { accountId, projectId, assetId },
      "json"
    );

    const waveformBuffer = Buffer.from(JSON.stringify(waveformData), "utf-8");
    await storage.putObject(waveformKey, waveformBuffer, "application/json");

    console.log(`[waveform] Generated waveform for ${assetId} (${peaks.length} peaks)`);

    return {
      storageKey: waveformKey,
      sampleRate: samplesPerSecond,
      channels: 1,
      duration,
      peaksCount: peaks.length,
    };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

/**
 * Get audio duration using FFprobe
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      config.FFPROBE_PATH,
      [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        filePath,
      ],
      { maxBuffer: 1024 * 1024 }
    );

    const data = JSON.parse(stdout);
    return parseFloat(data.format?.duration || "0");
  } catch {
    return 0;
  }
}

/**
 * Extract waveform peaks from audio file
 *
 * Uses FFmpeg to extract raw PCM audio, then computes peaks in Node.js
 */
async function extractWaveformPeaks(
  inputPath: string,
  totalSamples: number
): Promise<number[]> {
  // Extract raw mono PCM audio at a low sample rate for efficiency
  // We sample at 10x our target rate, then compute peaks in windows
  const sampleRate = WAVEFORM_CONFIG.samplesPerSecond * 100; // 1000 Hz

  const { stdout } = await execFileAsync(
    config.FFMPEG_PATH,
    [
      "-i", inputPath,
      "-ac", "1", // Mono
      "-f", "f32le", // 32-bit float little-endian
      "-ar", String(sampleRate),
      "-acodec", "pcm_f32le",
      "pipe:1",
    ],
    {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: JOB_TIMEOUTS.waveform,
    }
  );

  // Convert buffer to float array
  const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const samples = buffer.length / 4; // 4 bytes per float
  const floatArray = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    floatArray[i] = buffer.readFloatLE(i * 4);
  }

  // Compute peaks in windows
  const windowSize = Math.floor(samples / totalSamples);
  const peaks: number[] = [];

  for (let i = 0; i < totalSamples; i++) {
    const start = i * windowSize;
    const end = Math.min(start + windowSize, samples);

    if (start >= samples) {
      peaks.push(0);
      continue;
    }

    // Find max absolute value in window (normalized to 0.0 - 1.0)
    let maxAbs = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(floatArray[j]);
      if (abs > maxAbs) {
        maxAbs = abs;
      }
    }

    // Clamp to 0.0 - 1.0
    peaks.push(Math.min(1.0, Math.max(0.0, maxAbs)));
  }

  return peaks;
}
