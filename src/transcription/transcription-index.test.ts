/**
 * Tests for transcription module index exports
 */
import { describe, it, expect } from "vitest";

describe("transcription index exports", () => {
  describe("type exports", () => {
    it("exports QUEUE_NAME", async () => {
      const { QUEUE_NAME } = await import("./index.js");
      expect(QUEUE_NAME).toBe("media:transcription");
    });

    it("exports JOB_TIMEOUT", async () => {
      const { JOB_TIMEOUT } = await import("./index.js");
      expect(JOB_TIMEOUT).toBe(30 * 60 * 1000);
    });

    it("exports RETRY_CONFIG", async () => {
      const { RETRY_CONFIG } = await import("./index.js");
      expect(RETRY_CONFIG).toBeDefined();
      expect(RETRY_CONFIG.maxAttempts).toBe(3);
    });

    it("exports MAX_DURATION_SECONDS", async () => {
      const { MAX_DURATION_SECONDS } = await import("./index.js");
      expect(MAX_DURATION_SECONDS).toBe(7200);
    });
  });

  describe("provider exports", () => {
    it("exports DeepgramProvider", async () => {
      const { DeepgramProvider } = await import("./index.js");
      expect(DeepgramProvider).toBeDefined();
    });

    it("exports createDeepgramProvider", async () => {
      const { createDeepgramProvider } = await import("./index.js");
      expect(typeof createDeepgramProvider).toBe("function");
    });

    it("exports FasterWhisperProvider", async () => {
      const { FasterWhisperProvider } = await import("./index.js");
      expect(FasterWhisperProvider).toBeDefined();
    });

    it("exports createFasterWhisperProvider", async () => {
      const { createFasterWhisperProvider } = await import("./index.js");
      expect(typeof createFasterWhisperProvider).toBe("function");
    });
  });

  describe("export function exports", () => {
    it("exports groupWordsIntoSegments", async () => {
      const { groupWordsIntoSegments } = await import("./index.js");
      expect(typeof groupWordsIntoSegments).toBe("function");
    });

    it("exports exportToSrt", async () => {
      const { exportToSrt } = await import("./index.js");
      expect(typeof exportToSrt).toBe("function");
    });

    it("exports exportToVtt", async () => {
      const { exportToVtt } = await import("./index.js");
      expect(typeof exportToVtt).toBe("function");
    });

    it("exports exportToTxt", async () => {
      const { exportToTxt } = await import("./index.js");
      expect(typeof exportToTxt).toBe("function");
    });

    it("exports exportTranscription", async () => {
      const { exportTranscription } = await import("./index.js");
      expect(typeof exportTranscription).toBe("function");
    });

    it("exports parseSrt", async () => {
      const { parseSrt } = await import("./index.js");
      expect(typeof parseSrt).toBe("function");
    });

    it("exports parseVtt", async () => {
      const { parseVtt } = await import("./index.js");
      expect(typeof parseVtt).toBe("function");
    });
  });

  describe("processor exports", () => {
    it("exports processTranscriptionJob", async () => {
      const { processTranscriptionJob } = await import("./index.js");
      expect(typeof processTranscriptionJob).toBe("function");
    });

    it("exports createTranscriptionWorker", async () => {
      const { createTranscriptionWorker } = await import("./index.js");
      expect(typeof createTranscriptionWorker).toBe("function");
    });

    it("exports enqueueTranscriptionJob", async () => {
      const { enqueueTranscriptionJob } = await import("./index.js");
      expect(typeof enqueueTranscriptionJob).toBe("function");
    });
  });
});
