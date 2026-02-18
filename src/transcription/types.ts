/**
 * Bush Platform - Transcription Types
 *
 * Type definitions for the transcription service.
 * Reference: specs/06-transcription-and-captions.md
 */

import type { TranscriptionProvider, TranscriptionStatus, SpeakerNames } from "../db/schema.js";

/**
 * Queue name for transcription jobs
 */
export const QUEUE_NAME = "media:transcription" as const;

/**
 * Job timeout for transcription (30 minutes max)
 */
export const JOB_TIMEOUT = 30 * 60 * 1000;

/**
 * Retry configuration for transcription jobs
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 60000, // 1 minute initial
  },
} as const;

/**
 * Maximum duration for transcription (2 hours)
 */
export const MAX_DURATION_SECONDS = 7200;

/**
 * Transcription job data for BullMQ
 */
export interface TranscriptionJobData {
  type: "transcription";
  fileId: string;
  accountId: string;
  projectId: string;
  storageKey: string;
  mimeType: string;
  durationSeconds: number;
  language?: string;
  speakerIdentification?: boolean;
  priority?: number;
}

/**
 * Transcription job result
 */
export interface TranscriptionJobResult {
  transcriptId: string;
  wordCount: number;
  language: string;
  durationSeconds: number;
}

/**
 * Request to submit transcription to provider
 */
export interface TranscriptionRequest {
  audioUrl?: string;
  audioBuffer?: Buffer;
  language?: string;
  speakerIdentification?: boolean;
  callbackUrl?: string;
}

/**
 * Word from transcription result
 */
export interface TranscriptionWord {
  word: string;
  startMs: number;
  endMs: number;
  speaker?: number;
  confidence?: number;
}

/**
 * Result from transcription provider
 */
export interface TranscriptionResult {
  success: boolean;
  providerTranscriptId?: string;
  language?: string;
  languageConfidence?: number;
  durationSeconds?: number;
  speakerCount?: number;
  words: TranscriptionWord[];
  fullText: string;
  error?: string;
}

/**
 * Provider callback payload (generic)
 */
export interface ProviderCallbackPayload {
  provider: TranscriptionProvider;
  providerTranscriptId: string;
  status: "completed" | "failed" | "processing";
  result?: TranscriptionResult;
  error?: string;
}

/**
 * Transcription provider interface
 * All providers must implement this interface
 */
export interface ITranscriptionProvider {
  readonly name: TranscriptionProvider;

  /**
   * Submit a transcription job to the provider
   * Returns the provider's job/transcript ID
   */
  submit(request: TranscriptionRequest): Promise<string>;

  /**
   * Get the result of a transcription job (for polling)
   * Returns null if still processing
   */
  getResult(providerTranscriptId: string): Promise<TranscriptionResult | null>;

  /**
   * Parse callback payload from provider
   * Used when provider uses webhooks for completion
   */
  parseCallback(payload: unknown): TranscriptionResult;

  /**
   * Check if callback indicates success
   */
  isCallbackSuccess(payload: unknown): boolean;

  /**
   * Check if this provider is configured and available
   */
  isAvailable(): boolean;
}

/**
 * Caption export format
 */
export type CaptionFormat = "srt" | "vtt" | "txt";

/**
 * Caption segment for export
 */
export interface CaptionSegment {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

/**
 * Configuration for transcription
 */
export interface TranscriptionConfig {
  provider: TranscriptionProvider;
  deepgramApiKey?: string;
  assemblyaiApiKey?: string;
  fasterWhisperUrl?: string;
  maxDurationSeconds: number;
  callbackBaseUrl?: string;
}

/**
 * API response types
 */
export interface TranscriptionResponse {
  id: string;
  type: "transcription";
  attributes: {
    file_id: string;
    status: TranscriptionStatus;
    provider: TranscriptionProvider;
    language: string | null;
    language_confidence: number | null;
    full_text: string | null;
    speaker_count: number | null;
    speaker_names: SpeakerNames;
    duration_seconds: number | null;
    is_edited: boolean;
    edited_at: string | null;
    edited_by_user_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  };
}

export interface CaptionResponse {
  id: string;
  type: "caption";
  attributes: {
    file_id: string;
    language: string;
    format: "srt" | "vtt";
    label: string | null;
    is_default: boolean;
    created_at: string;
  };
}
