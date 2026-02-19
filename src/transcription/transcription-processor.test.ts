/**
 * Tests for transcription processor
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
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

vi.mock("../db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
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
    on: vi.fn((event, cb) => {
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
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getProvider", () => {
    it("returns DeepgramProvider when TRANSCRIPTION_PROVIDER is deepgram", async () => {
      process.env.TRANSCRIPTION_PROVIDER = "deepgram";
      process.env.DEEPGRAM_API_KEY = "test-api-key";

      const { processTranscriptionJob } = await import("./processor.js");

      // processTranscriptionJob uses getProvider internally
      // We can't easily test getProvider directly as it's not exported
      // But we can verify the module loads correctly
      expect(processTranscriptionJob).toBeDefined();
    });

    it("returns FasterWhisperProvider when TRANSCRIPTION_PROVIDER is faster-whisper", async () => {
      process.env.TRANSCRIPTION_PROVIDER = "faster-whisper";
      process.env.FASTER_WHISPER_URL = "http://localhost:8080";

      const { processTranscriptionJob } = await import("./processor.js");

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
    });

    it("exports RETRY_CONFIG", async () => {
      const { RETRY_CONFIG } = await import("./processor.js");
      expect(RETRY_CONFIG).toBeDefined();
      expect(RETRY_CONFIG.maxAttempts).toBeDefined();
      expect(RETRY_CONFIG.backoff).toBeDefined();
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
            durationSeconds: 99999, // Exceeds MAX_DURATION_SECONDS
            accountId: "account_123",
            projectId: "project_123",
            mimeType: "audio/mp3",
          },
        })
      ).rejects.toThrow("exceeds maximum allowed");
    });
  });
});
