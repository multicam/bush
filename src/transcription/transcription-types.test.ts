/**
 * Tests for transcription types and constants
 */
import { describe, it, expect } from "vitest";
import {
  QUEUE_NAME,
  JOB_TIMEOUT,
  RETRY_CONFIG,
  MAX_DURATION_SECONDS,
} from "./types.js";
import type {
  TranscriptionJobData,
  TranscriptionJobResult,
  TranscriptionRequest,
  TranscriptionWord,
  TranscriptionResult,
  ProviderCallbackPayload,
  CaptionFormat,
  CaptionSegment,
  TranscriptionConfig,
  TranscriptionResponse,
  CaptionResponse,
} from "./types.js";

describe("transcription types", () => {
  describe("QUEUE_NAME", () => {
    it("has correct queue name", () => {
      expect(QUEUE_NAME).toBe("media:transcription");
    });
  });

  describe("JOB_TIMEOUT", () => {
    it("has timeout of 30 minutes", () => {
      expect(JOB_TIMEOUT).toBe(30 * 60 * 1000);
    });
  });

  describe("RETRY_CONFIG", () => {
    it("has max attempts of 3", () => {
      expect(RETRY_CONFIG.maxAttempts).toBe(3);
    });

    it("has exponential backoff type", () => {
      expect(RETRY_CONFIG.backoff.type).toBe("exponential");
    });

    it("has initial delay of 1 minute", () => {
      expect(RETRY_CONFIG.backoff.delay).toBe(60000);
    });
  });

  describe("MAX_DURATION_SECONDS", () => {
    it("has max duration of 2 hours", () => {
      expect(MAX_DURATION_SECONDS).toBe(7200);
    });

    it("is 2 hours in seconds", () => {
      expect(MAX_DURATION_SECONDS).toBe(2 * 60 * 60);
    });
  });

  describe("Type definitions compile correctly", () => {
    it("TranscriptionJobData interface is valid", () => {
      const data: TranscriptionJobData = {
        type: "transcription",
        fileId: "file-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/audio.mp3",
        mimeType: "audio/mp3",
        durationSeconds: 180,
        language: "en",
        speakerIdentification: true,
        priority: 5,
      };
      expect(data.type).toBe("transcription");
      expect(data.fileId).toBe("file-123");
    });

    it("TranscriptionJobData with minimal fields", () => {
      const data: TranscriptionJobData = {
        type: "transcription",
        fileId: "file-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/audio.mp3",
        mimeType: "audio/mp3",
        durationSeconds: 60,
      };
      expect(data.language).toBeUndefined();
      expect(data.speakerIdentification).toBeUndefined();
      expect(data.priority).toBeUndefined();
    });

    it("TranscriptionJobResult interface is valid", () => {
      const result: TranscriptionJobResult = {
        transcriptId: "transcript-123",
        wordCount: 500,
        language: "en",
        durationSeconds: 180,
      };
      expect(result.wordCount).toBe(500);
    });

    it("TranscriptionRequest with audioUrl", () => {
      const request: TranscriptionRequest = {
        audioUrl: "https://example.com/audio.mp3",
        language: "en",
        speakerIdentification: true,
        callbackUrl: "https://example.com/callback",
      };
      expect(request.audioUrl).toBe("https://example.com/audio.mp3");
    });

    it("TranscriptionRequest with audioBuffer", () => {
      const request: TranscriptionRequest = {
        audioBuffer: Buffer.from("fake audio data"),
        language: "es",
      };
      expect(request.audioBuffer).toBeInstanceOf(Buffer);
    });

    it("TranscriptionWord interface is valid", () => {
      const word: TranscriptionWord = {
        word: "hello",
        startMs: 1000,
        endMs: 1500,
        speaker: 1,
        confidence: 0.95,
      };
      expect(word.word).toBe("hello");
      expect(word.startMs).toBe(1000);
      expect(word.endMs).toBe(1500);
    });

    it("TranscriptionWord with minimal fields", () => {
      const word: TranscriptionWord = {
        word: "world",
        startMs: 1600,
        endMs: 2000,
      };
      expect(word.speaker).toBeUndefined();
      expect(word.confidence).toBeUndefined();
    });

    it("TranscriptionResult interface is valid", () => {
      const result: TranscriptionResult = {
        success: true,
        providerTranscriptId: "provider-123",
        language: "en",
        languageConfidence: 0.98,
        durationSeconds: 120,
        speakerCount: 2,
        words: [
          { word: "hello", startMs: 0, endMs: 500 },
          { word: "world", startMs: 600, endMs: 1000 },
        ],
        fullText: "hello world",
      };
      expect(result.success).toBe(true);
      expect(result.words).toHaveLength(2);
    });

    it("TranscriptionResult with error", () => {
      const result: TranscriptionResult = {
        success: false,
        words: [],
        fullText: "",
        error: "Transcription failed",
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe("Transcription failed");
    });

    it("ProviderCallbackPayload interface is valid", () => {
      const payload: ProviderCallbackPayload = {
        provider: "deepgram",
        providerTranscriptId: "provider-123",
        status: "completed",
        result: {
          success: true,
          words: [],
          fullText: "test",
        },
      };
      expect(payload.status).toBe("completed");
    });

    it("ProviderCallbackPayload with error", () => {
      const payload: ProviderCallbackPayload = {
        provider: "faster-whisper",
        providerTranscriptId: "provider-456",
        status: "failed",
        error: "Processing failed",
      };
      expect(payload.status).toBe("failed");
      expect(payload.error).toBe("Processing failed");
    });

    it("CaptionFormat allows valid formats", () => {
      const formats: CaptionFormat[] = ["srt", "vtt", "txt"];
      expect(formats).toHaveLength(3);
    });

    it("CaptionSegment interface is valid", () => {
      const segment: CaptionSegment = {
        index: 1,
        startMs: 0,
        endMs: 5000,
        text: "Hello and welcome",
        speaker: "Speaker 1",
      };
      expect(segment.index).toBe(1);
    });

    it("CaptionSegment without speaker", () => {
      const segment: CaptionSegment = {
        index: 2,
        startMs: 5000,
        endMs: 10000,
        text: "This is the second segment",
      };
      expect(segment.speaker).toBeUndefined();
    });

    it("TranscriptionConfig interface is valid", () => {
      const config: TranscriptionConfig = {
        provider: "deepgram",
        deepgramApiKey: "api-key-123",
        maxDurationSeconds: 3600,
        callbackBaseUrl: "https://example.com/callbacks",
      };
      expect(config.provider).toBe("deepgram");
    });

    it("TranscriptionConfig with faster-whisper", () => {
      const config: TranscriptionConfig = {
        provider: "faster-whisper",
        fasterWhisperUrl: "http://localhost:8000",
        maxDurationSeconds: 7200,
      };
      expect(config.provider).toBe("faster-whisper");
    });

    it("TranscriptionResponse interface is valid", () => {
      const response: TranscriptionResponse = {
        id: "transcript-123",
        type: "transcription",
        attributes: {
          file_id: "file-123",
          status: "completed",
          provider: "deepgram",
          language: "en",
          language_confidence: 0.95,
          full_text: "Hello world",
          speaker_count: 2,
          speaker_names: {},
          duration_seconds: 120,
          is_edited: false,
          edited_at: null,
          edited_by_user_id: null,
          error_message: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:01:00Z",
        },
      };
      expect(response.id).toBe("transcript-123");
      expect(response.attributes.status).toBe("completed");
    });

    it("CaptionResponse interface is valid", () => {
      const response: CaptionResponse = {
        id: "caption-123",
        type: "caption",
        attributes: {
          file_id: "file-123",
          language: "en",
          format: "srt",
          label: "English",
          is_default: true,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      expect(response.type).toBe("caption");
      expect(response.attributes.format).toBe("srt");
    });
  });
});
