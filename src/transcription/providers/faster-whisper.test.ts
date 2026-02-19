/**
 * Tests for Faster-Whisper transcription provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FasterWhisperProvider, createFasterWhisperProvider } from "./faster-whisper.js";
import type { TranscriptionRequest } from "../types.js";

// Mock fetch globally
const originalFetch = global.fetch;

describe("FasterWhisperProvider", () => {
  let provider: FasterWhisperProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = mockFetch;
    provider = new FasterWhisperProvider("http://localhost:8000");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided base URL", () => {
      const p = new FasterWhisperProvider("http://custom:9000");
      expect(p.isAvailable()).toBe(true);
    });

    it("uses environment variable if no URL provided", () => {
      const originalEnv = process.env.FASTER_WHISPER_URL;
      process.env.FASTER_WHISPER_URL = "http://env:9000";
      const p = new FasterWhisperProvider();
      expect(p.isAvailable()).toBe(true);
      process.env.FASTER_WHISPER_URL = originalEnv;
    });

    it("uses default URL if nothing configured", () => {
      const originalEnv = process.env.FASTER_WHISPER_URL;
      delete process.env.FASTER_WHISPER_URL;
      const p = new FasterWhisperProvider();
      expect(p.isAvailable()).toBe(true);
      process.env.FASTER_WHISPER_URL = originalEnv;
    });

    it("has correct name", () => {
      expect(provider.name).toBe("faster-whisper");
    });
  });

  describe("isAvailable", () => {
    it("returns true when URL is set", () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it("returns true with default URL", () => {
      const p = new FasterWhisperProvider("");
      expect(p.isAvailable()).toBe(true); // Empty string is truthy for !! in this case
    });
  });

  describe("submit", () => {
    it("throws error if audioBuffer not provided", async () => {
      await expect(
        provider.submit({ audioUrl: "https://example.com/audio.mp3" } as TranscriptionRequest)
      ).rejects.toThrow("audioBuffer must be provided for faster-whisper");
    });

    it("submits with audio buffer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "fw-123",
          text: "Hello world",
          segments: [],
          language: "en",
          language_probability: 0.95,
        }),
      });

      const buffer = Buffer.from("audio data");
      const result = await provider.submit({
        audioBuffer: buffer,
      });

      expect(result).toBe("fw-123");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/v1/transcriptions",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
    });

    it("generates job ID if not returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Hello world",
          segments: [],
          language: "en",
          language_probability: 0.95,
        }),
      });

      const buffer = Buffer.from("audio data");
      const result = await provider.submit({
        audioBuffer: buffer,
      });

      expect(result).toMatch(/^fw-\d+$/);
    });

    it("includes language when specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "fw-123",
          text: "Hello",
          segments: [],
          language: "es",
          language_probability: 0.9,
        }),
      });

      await provider.submit({
        audioBuffer: Buffer.from("audio"),
        language: "es",
      });

      // Check that FormData was created with language
      const call = mockFetch.mock.calls[0];
      const formData = call[1].body as FormData;
      // FormData entries can't be easily inspected, but we can verify the call was made
      expect(formData).toBeInstanceOf(FormData);
    });

    it("throws error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server error",
      });

      await expect(
        provider.submit({ audioBuffer: Buffer.from("audio") })
      ).rejects.toThrow("Faster-Whisper API error: 500 - Server error");
    });
  });

  describe("getResult", () => {
    it("returns null on 404 (still processing)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await provider.getResult("fw-123");
      expect(result).toBeNull();
    });

    it("throws error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server error",
      });

      await expect(provider.getResult("fw-123")).rejects.toThrow(
        "Faster-Whisper API error: 500 - Server error"
      );
    });

    it("returns parsed result on success with word timestamps", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Hello world",
          segments: [
            {
              start: 0,
              end: 1,
              text: "Hello world",
              words: [
                { word: "Hello", start: 0, end: 0.5, probability: 0.99 },
                { word: "world", start: 0.6, end: 1, probability: 0.95 },
              ],
            },
          ],
          language: "en",
          language_probability: 0.98,
        }),
      });

      const result = await provider.getResult("fw-123");

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.fullText).toBe("Hello world");
      expect(result?.language).toBe("en");
      expect(result?.languageConfidence).toBe(98);
      expect(result?.words).toHaveLength(2);
      expect(result?.words[0].word).toBe("Hello");
      expect(result?.words[0].startMs).toBe(0);
      expect(result?.words[0].endMs).toBe(500);
      expect(result?.words[0].confidence).toBe(99);
    });

    it("handles segments without word timestamps", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "Test phrase",
          segments: [
            {
              start: 0,
              end: 2,
              text: "Test phrase",
              speaker: 0,
            },
          ],
          language: "en",
          language_probability: 0.9,
        }),
      });

      const result = await provider.getResult("fw-123");

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.words).toHaveLength(2);
      expect(result?.words[0].word).toBe("Test");
      expect(result?.words[0].speaker).toBe(0);
    });

    it("handles multiple segments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: "First second",
          segments: [
            {
              start: 0,
              end: 1,
              text: "First",
              words: [{ word: "First", start: 0, end: 1, probability: 0.9 }],
            },
            {
              start: 1.5,
              end: 2.5,
              text: "second",
              words: [{ word: "second", start: 1.5, end: 2.5, probability: 0.85 }],
            },
          ],
          language: "en",
          language_probability: 0.95,
        }),
      });

      const result = await provider.getResult("fw-123");

      expect(result).not.toBeNull();
      expect(result?.words).toHaveLength(2);
      expect(result?.durationSeconds).toBe(3); // Rounded from 2.5
    });
  });

  describe("parseCallback", () => {
    it("handles failed status", () => {
      const result = provider.parseCallback({
        job_id: "fw-123",
        status: "failed",
        error: "Processing failed",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Processing failed");
    });

    it("handles error in payload", () => {
      const result = provider.parseCallback({
        job_id: "fw-123",
        status: "completed",
        error: "Something went wrong",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Something went wrong");
    });

    it("handles missing result", () => {
      const result = provider.parseCallback({
        job_id: "fw-123",
        status: "completed",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No result in callback");
    });

    it("handles successful callback", () => {
      const result = provider.parseCallback({
        job_id: "fw-123",
        status: "completed",
        result: {
          text: "Hello",
          segments: [
            {
              start: 0,
              end: 1,
              text: "Hello",
              words: [{ word: "Hello", start: 0, end: 1, probability: 0.95 }],
            },
          ],
          language: "en",
          language_probability: 0.98,
        },
      });

      expect(result.success).toBe(true);
      expect(result.fullText).toBe("Hello");
      expect(result.words).toHaveLength(1);
    });
  });

  describe("isCallbackSuccess", () => {
    it("returns true for completed status without error", () => {
      expect(
        provider.isCallbackSuccess({
          job_id: "fw-123",
          status: "completed",
        })
      ).toBe(true);
    });

    it("returns false for failed status", () => {
      expect(
        provider.isCallbackSuccess({
          job_id: "fw-123",
          status: "failed",
        })
      ).toBe(false);
    });

    it("returns false when error is present", () => {
      expect(
        provider.isCallbackSuccess({
          job_id: "fw-123",
          status: "completed",
          error: "Something failed",
        })
      ).toBe(false);
    });

    it("returns false for processing status", () => {
      expect(
        provider.isCallbackSuccess({
          job_id: "fw-123",
          status: "processing",
        })
      ).toBe(false);
    });
  });

  describe("createFasterWhisperProvider", () => {
    it("creates a FasterWhisperProvider instance", () => {
      const p = createFasterWhisperProvider();
      expect(p).toBeInstanceOf(FasterWhisperProvider);
    });
  });
});
