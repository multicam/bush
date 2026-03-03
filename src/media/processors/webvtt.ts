/**
 * Bush Platform - WebVTT Caption Processor
 *
 * Generates WebVTT caption files from transcription data and uploads to storage.
 * Called after transcription completes for files that have HLS output.
 *
 * Reference: specs/07-media-processing.md, specs/08-transcription.md
 */
import { db } from "../../db/index.js";
import { transcripts, transcriptWords } from "../../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { storage, storageKeys } from "../../storage/index.js";
import { groupWordsIntoSegments, exportToVtt } from "../../transcription/export.js";
import type { SpeakerNames } from "../../db/schema.js";

export interface WebVTTJobData {
  fileId: string;
  accountId: string;
  projectId: string;
  language?: string;
}

export interface WebVTTJobResult {
  captionKey: string;
  language: string;
  segmentCount: number;
}

/**
 * Generate a WebVTT caption file from transcription data and upload to storage.
 * Returns null if the file has no completed transcription.
 */
export async function processWebVTT(
  jobData: WebVTTJobData
): Promise<WebVTTJobResult | null> {
  const { fileId, accountId, projectId, language = "en" } = jobData;

  console.log(`[webvtt] Generating captions for file ${fileId}`);

  // Get transcript for this file
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (!transcript || transcript.status !== "completed") {
    console.log(`[webvtt] No completed transcript for file ${fileId}, skipping`);
    return null;
  }

  // Get all words ordered by position
  const words = await db
    .select()
    .from(transcriptWords)
    .where(eq(transcriptWords.transcriptId, transcript.id))
    .orderBy(asc(transcriptWords.position));

  if (words.length === 0) {
    console.log(`[webvtt] No transcript words for file ${fileId}, skipping`);
    return null;
  }

  // Convert to the format expected by groupWordsIntoSegments
  const wordData = words.map((w) => ({
    word: w.word,
    startMs: w.startMs,
    endMs: w.endMs,
    speaker: w.speaker ?? undefined,
  }));

  // Group into segments and export as WebVTT
  const speakerNames = (transcript.speakerNames || {}) as SpeakerNames;
  const segments = groupWordsIntoSegments(wordData, speakerNames);
  const vttContent = exportToVtt(segments);

  // Upload to storage
  const captionKey = storageKeys.caption(
    { accountId, projectId, assetId: fileId },
    language
  );

  await storage.putObject(
    captionKey,
    Buffer.from(vttContent, "utf-8"),
    "text/vtt"
  );

  console.log(
    `[webvtt] Generated ${segments.length} caption segments for file ${fileId}, stored at ${captionKey}`
  );

  return {
    captionKey,
    language,
    segmentCount: segments.length,
  };
}
