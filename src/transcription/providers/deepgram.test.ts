/**
 * Tests for Deepgram transcription provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeepgramProvider, createDeepgramProvider } from "./deepgram.js";
import type { TranscriptionRequest } from "../types.js";

// Mock fetch globally
const originalFetch = global.fetch;

describe("DeepgramProvider", () => {
  let provider: DeepgramProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = mockFetch;
    provider = new DeepgramProvider("test-api-key");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided API key", () => {
      const p = new DeepgramProvider("my-key");
      expect(p.isAvailable()).toBe(true);
    });

    it("uses environment variable if no key provided", () => {
      const originalEnv = process.env.DEEPGRAM_API_KEY;
      process.env.DEEPGRAM_API_KEY = "env-key";
      const p = new DeepgramProvider();
      expect(p.isAvailable()).toBe(true);
      process.env.DEEPGRAM_API_KEY = originalEnv;
    });

    it("warns if no API key configured", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalEnv = process.env.DEEPGRAM_API_KEY;
      delete process.env.DEEPGRAM_API_KEY;
      const p = new DeepgramProvider();
      expect(p.isAvailable()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith("DeepgramProvider: DEEPGRAM_API_KEY not configured");
      process.env.DEEPGRAM_API_KEY = originalEnv;
      warnSpy.mockRestore();
    });

    it("has correct name", () => {
      expect(provider.name).toBe("deepgram");
    });
  });

  describe("isAvailable", () => {
    it("returns true when API key is set", () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it("returns false when no API key", () => {
      const originalEnv = process.env.DEEPGRAM_API_KEY;
      delete process.env.DEEPGRAM_API_KEY;
      const p = new DeepgramProvider("");
      expect(p.isAvailable()).toBe(false);
      process.env.DEEPGRAM_API_KEY = originalEnv;
    });
  });

  describe("submit", () => {
    it("throws error if not available", async () => {
      const originalEnv = process.env.DEEPGRAM_API_KEY;
      delete process.env.DEEPGRAM_API_KEY;
      const p = new DeepgramProvider("");
      expect(p.isAvailable()).toBe(false);
      await expect(p.submit({} as TranscriptionRequest)).rejects.toThrow(
        "Deepgram API key not configured"
      );
      process.env.DEEPGRAM_API_KEY = originalEnv;
    });

    it("throws error if neither audioUrl nor audioBuffer provided", async () => {
      await expect(
        provider.submit({ language: "en" } as TranscriptionRequest)
      ).rejects.toThrow("Either audioUrl or audioBuffer must be provided");
    });

    it("submits with audio URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-123" }),
      });

      const result = await provider.submit({
        audioUrl: "https://example.com/audio.mp3",
      });

      expect(result).toBe("req-123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.deepgram.com/v1/listen"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Token test-api-key",
          }),
        })
      );
    });

    it("submits with audio buffer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-456" }),
      });

      const buffer = Buffer.from("audio data");
      const result = await provider.submit({
        audioBuffer: buffer,
      });

      expect(result).toBe("req-456");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: buffer,
        })
      );
    });

    it("includes language parameter when specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-123" }),
      });

      await provider.submit({
        audioUrl: "https://example.com/audio.mp3",
        language: "en",
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("language=en");
    });

    it("uses auto-detect when language is auto", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-123" }),
      });

      await provider.submit({
        audioUrl: "https://example.com/audio.mp3",
        language: "auto",
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("language=auto");
    });

    it("includes diarize when speaker identification enabled", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-123" }),
      });

      await provider.submit({
        audioUrl: "https://example.com/audio.mp3",
        speakerIdentification: true,
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("diarize=true");
    });

    it("includes callback URL when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-123" }),
      });

      await provider.submit({
        audioUrl: "https://example.com/audio.mp3",
        callbackUrl: "https://example.com/callback",
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("callback=https%3A%2F%2Fexample.com%2Fcallback");
    });

    it("throws error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(
        provider.submit({ audioUrl: "https://example.com/audio.mp3" })
      ).rejects.toThrow("Deepgram API error: 401 - Unauthorized");
    });

    it("includes standard parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: "req-123" }),
      });

      await provider.submit({
        audioUrl: "https://example.com/audio.mp3",
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("model=nova-2");
      expect(url).toContain("punctuate=true");
      expect(url).toContain("smart_format=true");
      expect(url).toContain("utterances=true");
    });
  });

  describe("getResult", () => {
    it("throws error if not available", async () => {
      const originalEnv = process.env.DEEPGRAM_API_KEY;
      delete process.env.DEEPGRAM_API_KEY;
      const p = new DeepgramProvider("");
      expect(p.isAvailable()).toBe(false);
      await expect(p.getResult("req-123")).rejects.toThrow(
        "Deepgram API key not configured"
      );
      process.env.DEEPGRAM_API_KEY = originalEnv;
    });

    it("returns null on 404 (still processing)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await provider.getResult("req-123");
      expect(result).toBeNull();
    });

    it("throws error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server error",
      });

      await expect(provider.getResult("req-123")).rejects.toThrow(
        "Deepgram API error: 500 - Server error"
      );
    });

    it("returns parsed result on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request_id: "req-123",
          result: {
            utterances: [
              {
                transcript: "Hello world",
                start: 0,
                end: 2,
                words: [
                  { word: "Hello", start: 0, end: 0.5, confidence: 0.99, speaker: 0 },
                  { word: "world", start: 0.6, end: 1, confidence: 0.95, speaker: 0 },
                ],
              },
            ],
            summary: { duration: 2, channels: 1 },
          },
        }),
      });

      const result = await provider.getResult("req-123");

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.fullText).toBe("Hello world");
      expect(result?.words).toHaveLength(2);
      expect(result?.words[0].word).toBe("Hello");
      expect(result?.words[0].startMs).toBe(0);
      expect(result?.words[0].endMs).toBe(500);
      expect(result?.durationSeconds).toBe(2);
    });

    it("handles channel-based result when no utterances", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request_id: "req-123",
          result: {
            channels: [
              {
                alternatives: [
                  {
                    transcript: "Test transcript",
                    words: [
                      { word: "Test", start: 0, end: 0.5, confidence: 0.9 },
                      { word: "transcript", start: 0.6, end: 1.2, confidence: 0.85 },
                    ],
                  },
                ],
              },
            ],
            summary: { duration: 1.2, channels: 1 },
          },
        }),
      });

      const result = await provider.getResult("req-123");

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.fullText).toBe("Test transcript");
      expect(result?.words).toHaveLength(2);
    });

    it("returns failure result when no result in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request_id: "req-123",
        }),
      });

      const result = await provider.getResult("req-123");

      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result?.error).toBe("No result in response");
    });
  });

  describe("parseCallback", () => {
    it("handles failed status", () => {
      const result = provider.parseCallback({
        request_id: "req-123",
        status: "failed",
        error: "Processing failed",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Processing failed");
    });

    it("handles error in payload", () => {
      const result = provider.parseCallback({
        request_id: "req-123",
        status: "completed",
        error: "Something went wrong",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Something went wrong");
    });

    it("handles missing result", () => {
      const result = provider.parseCallback({
        request_id: "req-123",
        status: "completed",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No result in callback");
    });

    it("handles successful callback with utterances", () => {
      const result = provider.parseCallback({
        request_id: "req-123",
        status: "completed",
        result: {
          utterances: [
            {
              transcript: "Hello",
              start: 0,
              end: 1,
              words: [{ word: "Hello", start: 0, end: 0.5 }],
            },
          ],
          summary: { duration: 1, channels: 1 },
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
          request_id: "req-123",
          status: "completed",
        })
      ).toBe(true);
    });

    it("returns false for failed status", () => {
      expect(
        provider.isCallbackSuccess({
          request_id: "req-123",
          status: "failed",
        })
      ).toBe(false);
    });

    it("returns false when error is present", () => {
      expect(
        provider.isCallbackSuccess({
          request_id: "req-123",
          status: "completed",
          error: "Something failed",
        })
      ).toBe(false);
    });

    it("returns false for processing status", () => {
      expect(
        provider.isCallbackSuccess({
          request_id: "req-123",
          status: "processing",
        })
      ).toBe(false);
    });
  });

  describe("createDeepgramProvider", () => {
    it("creates a DeepgramProvider instance", () => {
      const p = createDeepgramProvider();
      expect(p).toBeInstanceOf(DeepgramProvider);
    });
  });
});
