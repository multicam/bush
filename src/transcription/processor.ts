/**
 * Bush Platform - Transcription Job Processor
 *
 * BullMQ job processor for transcription jobs.
 * Reference: specs/06-transcription-and-captions.md
 */
import { db } from "../db/index.js";
import { transcripts, transcriptWords, files } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config/index.js";
import {
  type TranscriptionJobData,
  type TranscriptionJobResult,
  QUEUE_NAME,
  JOB_TIMEOUT,
  RETRY_CONFIG,
  MAX_DURATION_SECONDS,
} from "./types.js";
import { DeepgramProvider } from "./providers/deepgram.js";
import { FasterWhisperProvider } from "./providers/faster-whisper.js";
import type { ITranscriptionProvider } from "./types.js";
import { getStorageProvider } from "../storage/index.js";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Get the configured transcription provider
 */
function getProvider(): ITranscriptionProvider {
  const providerName = process.env.TRANSCRIPTION_PROVIDER || "deepgram";

  switch (providerName) {
    case "deepgram":
      return new DeepgramProvider(process.env.DEEPGRAM_API_KEY);
    case "faster-whisper":
      return new FasterWhisperProvider(process.env.FASTER_WHISPER_URL);
    default:
      throw new Error(`Unknown transcription provider: ${providerName}`);
  }
}

/**
 * Extract audio from video/audio file for transcription
 * Converts to mono 16kHz WAV for optimal transcription quality
 */
async function extractAudioForTranscription(
  storageKey: string,
  outputDir: string
): Promise<string> {
  // Download the file from storage
  const storage = getStorageProvider();
  const fileBuffer = await storage.getObject(storageKey);

  // Write to temp file
  const inputPath = join(outputDir, `input-${randomUUID()}`);
  const outputPath = join(outputDir, `audio-${randomUUID()}.wav`);

  await writeFile(inputPath, fileBuffer);

  // Extract audio using FFmpeg
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(config.FFMPEG_PATH, [
      "-i", inputPath,
      "-vn",                    // No video
      "-acodec", "pcm_s16le",   // 16-bit PCM
      "-ar", "16000",           // 16kHz sample rate
      "-ac", "1",               // Mono
      "-y",                     // Overwrite output
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });

  // Clean up input file
  await unlink(inputPath).catch(() => {});

  return outputPath;
}

/**
 * Get presigned URL for audio file (for cloud providers)
 */
async function getAudioPresignedUrl(storageKey: string): Promise<string> {
  const storage = getStorageProvider();
  const result = await storage.getPresignedUrl(storageKey, "get", 3600); // 1 hour expiry
  return result.url;
}

/**
 * Process a transcription job
 */
export async function processTranscriptionJob(
  job: { data: TranscriptionJobData }
): Promise<TranscriptionJobResult> {
  const { fileId, storageKey, durationSeconds, language, speakerIdentification } = job.data;

  // Check duration limit
  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw new Error(`Audio duration (${durationSeconds}s) exceeds maximum allowed (${MAX_DURATION_SECONDS}s)`);
  }

  // Update file status to processing
  await db
    .update(files)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(files.id, fileId));

  // Create or get transcript record
  const [existingTranscript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  let transcriptId: string;

  if (existingTranscript) {
    transcriptId = existingTranscript.id;
    // Update status to processing
    await db
      .update(transcripts)
      .set({
        status: "processing",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, transcriptId));

    // Delete existing words
    await db
      .delete(transcriptWords)
      .where(eq(transcriptWords.transcriptId, transcriptId));
  } else {
    transcriptId = `tr_${randomUUID().replace(/-/g, "")}`;
    const provider = process.env.TRANSCRIPTION_PROVIDER || "deepgram";

    await db.insert(transcripts).values({
      id: transcriptId,
      fileId,
      provider: provider as "deepgram" | "assemblyai" | "faster-whisper",
      status: "processing",
      speakerNames: {},
      isEdited: false,
    });
  }

  try {
    const provider = getProvider();
    const tempDir = config.MEDIA_TEMP_DIR;
    let audioBuffer: Buffer | undefined;
    let audioUrl: string | undefined;

    // For cloud providers, we can use presigned URLs
    // For self-hosted, we need to download and convert
    if (provider.name === "deepgram") {
      // For Deepgram, we can use presigned URL for files in cloud storage
      // Or upload audio buffer for better reliability
      try {
        audioUrl = await getAudioPresignedUrl(storageKey);
      } catch {
        // If presigned URL fails, extract and upload
        const audioPath = await extractAudioForTranscription(storageKey, tempDir);
        audioBuffer = await readFile(audioPath);
        await unlink(audioPath).catch(() => {});
      }
    } else {
      // For self-hosted, extract audio locally
      const audioPath = await extractAudioForTranscription(storageKey, tempDir);
      audioBuffer = await readFile(audioPath);
      await unlink(audioPath).catch(() => {});
    }

    // Submit transcription
    const providerTranscriptId = await provider.submit({
      audioUrl,
      audioBuffer,
      language,
      speakerIdentification,
      callbackUrl: undefined, // Synchronous for now
    });

    // Update provider transcript ID
    await db
      .update(transcripts)
      .set({ providerTranscriptId })
      .where(eq(transcripts.id, transcriptId));

    // Poll for result (for synchronous providers)
    // Deepgram typically returns synchronously for files < 3 mins
    let result;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait
    const pollInterval = 5000; // 5 seconds

    while (attempts < maxAttempts) {
      result = await provider.getResult(providerTranscriptId);

      if (result) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    if (!result) {
      throw new Error("Transcription timed out waiting for result");
    }

    if (!result.success) {
      throw new Error(result.error || "Transcription failed");
    }

    // Store words
    if (result.words.length > 0) {
      const wordRecords = result.words.map((word, index) => ({
        id: `tw_${randomUUID().replace(/-/g, "")}`,
        transcriptId,
        word: word.word,
        startMs: word.startMs,
        endMs: word.endMs,
        speaker: word.speaker,
        confidence: word.confidence,
        position: index,
      }));

      // Insert in batches of 1000 to avoid SQLite parameter limits
      const batchSize = 1000;
      for (let i = 0; i < wordRecords.length; i += batchSize) {
        const batch = wordRecords.slice(i, i + batchSize);
        await db.insert(transcriptWords).values(batch);
      }
    }

    // Update transcript with results
    await db
      .update(transcripts)
      .set({
        status: "completed",
        fullText: result.fullText,
        language: result.language,
        languageConfidence: result.languageConfidence,
        speakerCount: result.speakerCount,
        durationSeconds: result.durationSeconds,
        providerTranscriptId: result.providerTranscriptId || providerTranscriptId,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, transcriptId));

    // Update file status to ready
    await db
      .update(files)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(files.id, fileId));

    return {
      transcriptId,
      wordCount: result.words.length,
      language: result.language || "unknown",
      durationSeconds: result.durationSeconds || durationSeconds,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update transcript status to failed
    await db
      .update(transcripts)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, transcriptId));

    // Update file status back to ready (file is still usable)
    await db
      .update(files)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(files.id, fileId));

    throw error;
  }
}

/**
 * Create transcription queue worker
 */
export function createTranscriptionWorker(
  processor: (job: { data: TranscriptionJobData }) => Promise<TranscriptionJobResult>,
  concurrency: number = 1
) {
  const { Worker } = require("bullmq");
  const { getRedisOptions } = require("../media/queue.js");

  return new Worker(QUEUE_NAME, processor, {
    connection: getRedisOptions(),
    concurrency,
    limiter: {
      max: 1,
      duration: 10000, // 1 job per 10 seconds (rate limiting for API quotas)
    },
  });
}

/**
 * Enqueue a transcription job
 */
export async function enqueueTranscriptionJob(
  data: Omit<TranscriptionJobData, "type">
): Promise<void> {
  const { Queue } = require("bullmq");
  const { getRedisOptions } = require("../media/queue.js");

  const queue = new Queue(QUEUE_NAME, {
    connection: getRedisOptions(),
    defaultJobOptions: {
      attempts: RETRY_CONFIG.maxAttempts,
      backoff: RETRY_CONFIG.backoff,
      timeout: JOB_TIMEOUT,
      removeOnComplete: {
        count: 100,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 500,
        age: 7 * 24 * 3600,
      },
    },
  });

  await queue.add(`transcription-${data.fileId}`, {
    ...data,
    type: "transcription",
  });

  await queue.close();
}

export {
  QUEUE_NAME,
  JOB_TIMEOUT,
  RETRY_CONFIG,
};
