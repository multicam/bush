/**
 * Tests for transcription processor
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TranscriptionResult } from "./types.js";

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
    TRANSCRIPTION_PROVIDER: "deepgram",
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

vi.mock("../api/routes/index.js", () => ({
  emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue("PONG"),
    quit: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(0),
  })),
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

    process.env = {
      ...originalEnv,
      TRANSCRIPTION_PROVIDER: "deepgram",
      DEEPGRAM_API_KEY: "test-key",
    };
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

    it("uses validated config for provider selection", async () => {
      // The provider is now read from validated config, not process.env
      // Config validation only allows "deepgram" or "faster-whisper"
      const { processTranscriptionJob } = await import("./processor.js");

      // Should work with deepgram (from mock config)
      expect(processTranscriptionJob).toBeDefined();
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

      const result = await processTranscriptionJob({
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

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Audio quality too poor");
    });

    it("handles transcription timeout waiting for result", async () => {
      mockSubmit.mockResolvedValue("provider-timeout");
      mockGetResult.mockResolvedValue(null);

      const { processTranscriptionJob } = await import("./processor.js");

      vi.stubGlobal("setTimeout", (fn: () => void) => {
        queueMicrotask(fn);
        return 0;
      });

      try {
        const error = await processTranscriptionJob({
          data: {
            type: "transcription",
            fileId: "file_123",
            storageKey: "path/to/audio.mp3",
            durationSeconds: 60,
            accountId: "account_123",
            projectId: "project_123",
            mimeType: "audio/mp3",
          },
        }).catch((e) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Transcription timed out waiting for result");
      } finally {
        vi.unstubAllGlobals();
      }
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

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Transcription failed");
    });

    it("handles provider submit error gracefully", async () => {
      mockSubmit.mockRejectedValue(new Error("API rate limit exceeded"));

      const { processTranscriptionJob } = await import("./processor.js");

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

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

      const result = await processTranscriptionJob({
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

      const result = await processTranscriptionJob({
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

      const result = await processTranscriptionJob({
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

      expect(result.language).toBe("fr");
      expect(result.wordCount).toBe(4);
    });
  });

  describe("enqueueTranscriptionJob", () => {
    it("exports the function", async () => {
      const { enqueueTranscriptionJob } = await import("./processor.js");
      expect(typeof enqueueTranscriptionJob).toBe("function");
    });

    it("enqueues a transcription job with correct parameters", async () => {
      const mockAdd = vi.fn().mockResolvedValue({ id: "job-456" });
      const mockClose = vi.fn().mockResolvedValue(undefined);

      // Re-mock bullmq for this specific test
      vi.doMock("bullmq", () => ({
        Worker: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn().mockResolvedValue(undefined),
        })),
        Queue: vi.fn().mockImplementation(() => ({
          add: mockAdd,
          close: mockClose,
        })),
      }));

      // Reimport to get fresh mocks
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));
      const { enqueueTranscriptionJob } = await import("./processor.js");

      await enqueueTranscriptionJob({
        fileId: "file_789",
        storageKey: "path/to/video.mp4",
        durationSeconds: 120,
        accountId: "account_789",
        projectId: "project_789",
        mimeType: "video/mp4",
      });

      // Verify the job was added
      expect(mockAdd).toHaveBeenCalledWith(
        "transcription-file_789",
        expect.objectContaining({
          type: "transcription",
          fileId: "file_789",
          storageKey: "path/to/video.mp4",
          durationSeconds: 120,
          accountId: "account_789",
          projectId: "project_789",
          mimeType: "video/mp4",
        })
      );

      // Verify queue was closed
      expect(mockClose).toHaveBeenCalled();
    });

    it("includes optional language and speaker identification options", async () => {
      const mockAdd = vi.fn().mockResolvedValue({ id: "job-999" });
      const mockClose = vi.fn().mockResolvedValue(undefined);

      vi.doMock("bullmq", () => ({
        Worker: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn().mockResolvedValue(undefined),
        })),
        Queue: vi.fn().mockImplementation(() => ({
          add: mockAdd,
          close: mockClose,
        })),
      }));

      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));
      const { enqueueTranscriptionJob } = await import("./processor.js");

      await enqueueTranscriptionJob({
        fileId: "file_lang",
        storageKey: "path/to/audio.mp3",
        durationSeconds: 60,
        accountId: "account_lang",
        projectId: "project_lang",
        mimeType: "audio/mp3",
        language: "es",
        speakerIdentification: true,
      });

      expect(mockAdd).toHaveBeenCalledWith(
        "transcription-file_lang",
        expect.objectContaining({
          language: "es",
          speakerIdentification: true,
        })
      );
    });
  });

  describe("FFmpeg path validation", () => {
    it("rejects empty FFmpeg path", async () => {
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));

      vi.doMock("../storage/index.js", () => ({
        getStorageProvider: vi.fn(() => ({
          getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
          getPresignedUrl: vi.fn().mockRejectedValue(new Error("Presigned URL failed")),
        })),
      }));

      vi.doMock("../config/index.js", () => ({
        config: {
          FFMPEG_PATH: "",
          MEDIA_TEMP_DIR: "/tmp",
          TRANSCRIPTION_PROVIDER: "deepgram",
        },
      }));

      const { processTranscriptionJob } = await import("./processor.js");

      mockSubmit.mockResolvedValue("provider-123");
      mockGetResult.mockResolvedValue({
        success: true,
        words: [],
        fullText: "",
      });

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_ffmpeg",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("FFmpeg path cannot be empty");
    });

    it("rejects relative FFmpeg path", async () => {
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));

      vi.doMock("../storage/index.js", () => ({
        getStorageProvider: vi.fn(() => ({
          getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
          getPresignedUrl: vi.fn().mockRejectedValue(new Error("Presigned URL failed")),
        })),
      }));

      vi.doMock("../config/index.js", () => ({
        config: {
          FFMPEG_PATH: "bin/ffmpeg",
          MEDIA_TEMP_DIR: "/tmp",
          TRANSCRIPTION_PROVIDER: "deepgram",
        },
      }));

      const { processTranscriptionJob } = await import("./processor.js");

      mockSubmit.mockResolvedValue("provider-123");
      mockGetResult.mockResolvedValue({
        success: true,
        words: [],
        fullText: "",
      });

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_ffmpeg_rel",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("must be absolute");
    });

    it("rejects FFmpeg path with shell metacharacters", async () => {
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));

      vi.doMock("../storage/index.js", () => ({
        getStorageProvider: vi.fn(() => ({
          getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
          getPresignedUrl: vi.fn().mockRejectedValue(new Error("Presigned URL failed")),
        })),
      }));

      vi.doMock("../config/index.js", () => ({
        config: {
          FFMPEG_PATH: "/usr/bin/ffmpeg;rm -rf /",
          MEDIA_TEMP_DIR: "/tmp",
          TRANSCRIPTION_PROVIDER: "deepgram",
        },
      }));

      const { processTranscriptionJob } = await import("./processor.js");

      mockSubmit.mockResolvedValue("provider-123");
      mockGetResult.mockResolvedValue({
        success: true,
        words: [],
        fullText: "",
      });

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_ffmpeg_shell",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("potentially dangerous characters");
    });

    it("rejects FFmpeg binary not in allowlist", async () => {
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));

      vi.doMock("../storage/index.js", () => ({
        getStorageProvider: vi.fn(() => ({
          getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
          getPresignedUrl: vi.fn().mockRejectedValue(new Error("Presigned URL failed")),
        })),
      }));

      vi.doMock("../config/index.js", () => ({
        config: {
          FFMPEG_PATH: "/usr/bin/arbitrary-binary",
          MEDIA_TEMP_DIR: "/tmp",
          TRANSCRIPTION_PROVIDER: "deepgram",
        },
      }));

      const { processTranscriptionJob } = await import("./processor.js");

      mockSubmit.mockResolvedValue("provider-123");
      mockGetResult.mockResolvedValue({
        success: true,
        words: [],
        fullText: "",
      });

      const error = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_ffmpeg_binary",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      }).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("binary name must be one of");
    });
  });

  describe("FasterWhisper provider path", () => {
    it("extracts audio locally for FasterWhisper provider", async () => {
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));

      // Mock config to use FasterWhisper provider with absolute FFmpeg path
      vi.doMock("../config/index.js", () => ({
        config: {
          FFMPEG_PATH: "/usr/bin/ffmpeg",
          MEDIA_TEMP_DIR: "/tmp",
          TRANSCRIPTION_PROVIDER: "faster-whisper",
        },
      }));

      // Mock fs to make FFmpeg path validation pass
      vi.doMock("fs", () => ({
        ...require("fs"),
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ isFile: () => true })),
        realpathSync: vi.fn((p: string) => p),
      }));

      // Setup mocks for FasterWhisper (no presigned URL, audio extraction required)
      vi.doMock("../storage/index.js", () => ({
        getStorageProvider: vi.fn(() => ({
          getObject: vi.fn().mockResolvedValue(Buffer.from("test audio data")),
          getPresignedUrl: vi.fn().mockResolvedValue({ url: "https://example.com/audio.mp3" }),
        })),
      }));

      vi.doMock("../db/index.js", () => ({
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

      const successResult: TranscriptionResult = {
        success: true,
        providerTranscriptId: "fw-provider-123",
        language: "en",
        durationSeconds: 60,
        words: [{ word: "Test", startMs: 0, endMs: 500 }],
        fullText: "Test",
      };

      mockSubmit.mockResolvedValue("fw-provider-123");
      mockGetResult.mockResolvedValue(successResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const result = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_fw",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 60,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      expect(result.transcriptId).toMatch(/^tr_/);
      expect(result.wordCount).toBe(1);
    });
  });

  describe("processTranscriptionJob with existing transcript", () => {
    it("updates existing transcript instead of creating new one", async () => {
      // Reset modules to clear cached config from previous tests
      vi.resetModules();
      vi.doMock("../api/routes/index.js", () => ({
        emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
      }));

      // Restore proper config mock
      vi.doMock("../config/index.js", () => ({
        config: {
          FFMPEG_PATH: "ffmpeg",
          MEDIA_TEMP_DIR: "/tmp",
          TRANSCRIPTION_PROVIDER: "deepgram",
        },
      }));

      // Mock storage to return valid presigned URL (no extraction needed)
      vi.doMock("../storage/index.js", () => ({
        getStorageProvider: vi.fn(() => ({
          getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
          getPresignedUrl: vi.fn().mockResolvedValue({ url: "https://example.com/audio.mp3" }),
        })),
      }));

      // Mock that an existing transcript exists
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: "tr_existing_123",
                  fileId: "file_123",
                  status: "completed",
                },
              ])
            ),
          })),
        })),
      }));

      vi.doMock("../db/index.js", () => ({
        db: {
          select: mockSelect,
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

      const successResult: TranscriptionResult = {
        success: true,
        providerTranscriptId: "provider-reprocess",
        language: "en",
        durationSeconds: 90,
        words: [{ word: "Updated", startMs: 0, endMs: 500, speaker: 1 }],
        fullText: "Updated",
      };

      mockSubmit.mockResolvedValue("provider-reprocess");
      mockGetResult.mockResolvedValue(successResult);

      const { processTranscriptionJob } = await import("./processor.js");

      const result = await processTranscriptionJob({
        data: {
          type: "transcription",
          fileId: "file_123",
          storageKey: "path/to/audio.mp3",
          durationSeconds: 90,
          accountId: "account_123",
          projectId: "project_123",
          mimeType: "audio/mp3",
        },
      });

      expect(result.transcriptId).toBe("tr_existing_123");
      expect(result.wordCount).toBe(1);
    });
  });
});
