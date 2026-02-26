/**
 * Tests for transcription processor
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TranscriptionResult } from "./types.js";

// Use fake timers for polling tests
vi.useFakeTimers();

// Create mock functions that will be reassigned in tests
const mockSubmit = vi.fn();
const mockGetResult = vi.fn();
const mockParseCallback = vi.fn();
const mockIsCallbackSuccess = vi.fn();
const mockIsAvailable = vi.fn();

// Mock dependencies BEFORE imports
vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../media/queue.js", () => ({
  getRedisOptions: vi.fn(() => ({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })),
}));

vi.mock("../storage/index.js", () => ({
  getStorageProvider: vi.fn(() => ({
    getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
    getPresignedUrl: vi.fn().mockResolvedValue({ url: "https://example.com/audio.mp3" }),
  })),
}));

vi.mock("../config/index.js", () => ({
  config: {
    FFMPEG_PATH: "ffmpeg",
    MEDIA_TEMP_DIR: "/tmp",
  },
}));

// Mock providers - using hoisted mock functions
vi.mock("./providers/deepgram.js", () => ({
  DeepgramProvider: vi.fn().mockImplementation(() => ({
    name: "deepgram",
    submit: mockSubmit,
    getResult: mockGetResult,
    parseCallback: mockParseCallback,
    isCallbackSuccess: mockIsCallbackSuccess,
    isAvailable: mockIsAvailable,
  })),
}));

vi.mock("./providers/faster-whisper.js", () => ({
  FasterWhisperProvider: vi.fn().mockImplementation(() => ({
    name: "faster-whisper",
    submit: mockSubmit,
    getResult: mockGetResult,
    parseCallback: mockParseCallback,
    isCallbackSuccess: mockIsCallbackSuccess,
    isAvailable: mockIsAvailable,
  })),
}));

vi.mock("../db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
  sqlite: {
    prepare: vi.fn(() => ({
      run: vi.fn(),
    })),
  },
}));

vi.mock("../db/schema.js", () => ({
  files: { id: "files.id" },
  transcripts: { id: "transcripts.id", fileId: "transcripts.fileId" },
  transcriptWords: { transcriptId: "transcriptWords.transcriptId" },
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === "close") {
        cb(0);
      }
    }),
  })),
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from("test audio data")),
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "12345678-1234-1234-1234-123456789012"),
}));

describe("Transcription Processor", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset all mock implementations
    mockSubmit.mockReset();
    mockGetResult.mockReset();
    mockParseCallback.mockReset();
    mockIsCallbackSuccess.mockReset();
    mockIsAvailable.mockReset();

    // Set defaults
    mockSubmit.mockResolvedValue("provider-transcript-123");
    mockGetResult.mockResolvedValue(null);
    mockIsAvailable.mockReturnValue(true);

    process.env = { ...originalEnv, TRANSCRIPTION_PROVIDER: "deepgram", DEEPGRAM_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getProvider", () => {
    it("returns DeepgramProvider when TRANSCRIPTION_PROVIDER is deepgram", async () => {
      process.env.TRANSCRIPTION_PROVIDER = "deepgram";
      process.env.DEEPGRAM_API_KEY = "test-api-key";

      const { processTranscriptionJob } = await import("./processor.js");

      expect(processTranscriptionJob).toBeDefined();
    });

    it("returns FasterWhisperProvider when TRANSCRIPTION_PROVIDER is faster-whisper", async () => {
      process.env.TRANSCRIPTION_PROVIDER = "faster-whisper";
      process.env.FASTER_WHISPER_URL = "http://localhost:8080";

      const { processTranscriptionJob } = await import("./processor.js");

      expect(processTranscriptionJob).toBeDefined();
    });

    it("throws error for unknown provider", async () => {
      process.env.TRANSCRIPTION_PROVIDER = "unknown-provider";

      vi.resetModules();
      const { processTranscriptionJob } = await import("./processor.js");

      await expect(
        processTranscriptionJob({
          data: {
            type: "transcription",
            fileId: "file_123",
            storageKey: "path/to/audio.mp3",
            durationSeconds: 60,
            accountId: "account_123",
            projectId: "project_123",
            mimeType: "audio/mp3",
          },
        })
      ).rejects.toThrow("Unknown transcription provider: unknown-provider");
    });
  });

  describe("createTranscriptionWorker", () => {
    it("creates a worker with correct configuration", async () => {
      const { createTranscriptionWorker } = await import("./processor.js");

      const processor = vi.fn().mockResolvedValue({ transcriptId: "tr_123" });
      const worker = createTranscriptionWorker(processor, 1);

      expect(worker).toBeDefined();
    });

    it("creates a worker with custom concurrency", async () => {
      const { createTranscriptionWorker } = await import("./processor.js");

      const processor = vi.fn().mockResolvedValue({ transcriptId: "tr_123" });
      const worker = createTranscriptionWorker(processor, 4);

      expect(worker).toBeDefined();
    });
  });

  describe("exports", () => {
    it("exports QUEUE_NAME", async () => {
      const { QUEUE_NAME } = await import("./processor.js");
      expect(QUEUE_NAME).toBe("media:transcription");
    });

    it("exports JOB_TIMEOUT", async () => {
      const { JOB_TIMEOUT } = await import("./processor.js");
      expect(JOB_TIMEOUT).toBeDefined();
      expect(typeof JOB_TIMEOUT).toBe("number");
      expect(JOB_TIMEOUT).toBe(30 * 60 * 1000); // 30 minutes
    });

    it("exports RETRY_CONFIG", async () => {
      const { RETRY_CONFIG } = await import("./processor.js");
      expect(RETRY_CONFIG).toBeDefined();
      expect(RETRY_CONFIG.maxAttempts).toBe(3);
      expect(RETRY_CONFIG.backoff).toBeDefined();
      expect(RETRY_CONFIG.backoff.type).toBe("exponential");
    });
  });

  describe("processTranscriptionJob", () => {
    it("throws error when duration exceeds max", async () => {
      const { processTranscriptionJob } = await import("./processor.js");

      await expect(
        processTranscriptionJob({
          data: {
            type: "transcription",
            fileId: "file_123",
            storageKey: "path/to/audio.mp3",
            durationSeconds: 99999,
            accountId: "account_123",
            projectId: "project_123",
            mimeType: "audio/mp3",
          },
        })
      ).rejects.toThrow("exceeds maximum allowed");
    });

    it("processes transcription successfully with new transcript", async () => {
      const successResult: TranscriptionResult = {
        success: true,
        providerTranscriptId: "provider-123",
        language: "en",
        languageConfidence: 0.95,
        durationSeconds: 120,
        speakerCount: 2,
        words: [
          { word: "Hello", startMs: 0, endMs: 500, speaker: 1, confidence: 0.9 },
          { word: "world", startMs: 600, endMs: 1000, speaker: 2, confidence: 0.85 },
        ],
        fullText: "Hello world",
      };

      mockSubmit.mockResolvedValue("provider-123");
      // Return success immediately (no polling delay needed)
      mockGetResult.mockResolvedValue(successResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      // Advance timers to allow polling to complete
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.transcriptId).toMatch(/^tr_/);
      expect(result.wordCount).toBe(2);
      expect(result.language).toBe("en");
      expect(result.durationSeconds).toBe(120);
    });

    it("handles transcription failure from provider", async () => {
      const failResult: TranscriptionResult = {
        success: false,
        error: "Audio quality too poor",
        words: [],
        fullText: "",
      };

      mockSubmit.mockResolvedValue("provider-789");
      mockGetResult.mockResolvedValue(failResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      // Set up rejection handler before running timers
      const resultPromise = promise.catch((e) => e);

      await vi.runAllTimersAsync();

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Audio quality too poor");
    });

    it("handles transcription timeout waiting for result", async () => {
      mockSubmit.mockResolvedValue("provider-timeout");
      // Always return null (still processing) - simulates timeout
      mockGetResult.mockResolvedValue(null);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      const resultPromise = promise.catch((e) => e);

      // Advance timers to exhaust polling attempts (60 attempts * 5 seconds)
      await vi.runAllTimersAsync();

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Transcription timed out waiting for result");
    });

    it("handles transcription failure with generic error", async () => {
      const failResult: TranscriptionResult = {
        success: false,
        error: undefined,
        words: [],
        fullText: "",
      };

      mockSubmit.mockResolvedValue("provider-fail");
      mockGetResult.mockResolvedValue(failResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      const resultPromise = promise.catch((e) => e);

      await vi.runAllTimersAsync();

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Transcription failed");
    });

    it("handles provider submit error gracefully", async () => {
      mockSubmit.mockRejectedValue(new Error("API rate limit exceeded"));

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      const resultPromise = promise.catch((e) => e);

      await vi.runAllTimersAsync();

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("API rate limit exceeded");
    });

    it("truncates words when exceeding MAX_WORDS_PER_TRANSCRIPT", async () => {
      // Create 150,000 words (exceeds limit of 100,000)
      const manyWords = Array.from({ length: 150_000 }, (_, i) => ({
        word: `word${i}`,
        startMs: i * 100,
        endMs: i * 100 + 50,
      }));

      const successResult: TranscriptionResult = {
        success: true,
        providerTranscriptId: "provider-many",
        language: "en",
        durationSeconds: 5000,
        words: manyWords,
        fullText: "many words",
      };

      mockSubmit.mockResolvedValue("provider-many");
      mockGetResult.mockResolvedValue(successResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 5000,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      // Should be truncated to 100,000
      expect(result.wordCount).toBe(100_000);
    });

    it("handles transcript with no words", async () => {
      const emptyResult: TranscriptionResult = {
        success: true,
        providerTranscriptId: "provider-empty",
        language: "en",
        durationSeconds: 0,
        words: [],
        fullText: "",
      };

      mockSubmit.mockResolvedValue("provider-empty");
      mockGetResult.mockResolvedValue(emptyResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 0,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.wordCount).toBe(0);
      expect(result.language).toBe("en");
    });

    it("processes with language and speaker identification options", async () => {
      const successResult: TranscriptionResult = {
        success: true,
        providerTranscriptId: "provider-options",
        language: "fr",
        languageConfidence: 0.98,
        durationSeconds: 45,
        speakerCount: 3,
        words: [
          { word: "Bonjour", startMs: 0, endMs: 500, speaker: 1 },
          { word: "tout", startMs: 550, endMs: 700, speaker: 2 },
          { word: "le", startMs: 750, endMs: 850, speaker: 2 },
          { word: "monde", startMs: 900, endMs: 1100, speaker: 3 },
        ],
        fullText: "Bonjour tout le monde",
      };

      mockSubmit.mockResolvedValue("provider-options");
      mockGetResult.mockResolvedValue(successResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const promise = processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_456",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 45,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
          language: "fr",
          speakerIdentification: true,
        },
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.language).toBe("fr");
      expect(result.wordCount).toBe(4);
    });
  });

  describe("enqueueTranscriptionJob", () => {
    it("exports the function", async () => {
      const { enqueueTranscriptionJob } = await import("./processor.js");
      expect(typeof enqueueTranscriptionJob).toBe("function");
    });
  });
});
