/**
 * Bush Platform - Faster-Whisper Transcription Provider
 *
 * Self-hosted fallback provider using faster-whisper.
 * Reference: specs/06-transcription-and-captions.md
 */
import type {
  ITranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  TranscriptionWord,
} from "../types.js";

/**
 * Faster-Whisper API response structures
 */
interface FasterWhisperSegment {
  start: number;
  end: number;
  text: string;
  words?: FasterWhisperWord[];
  speaker?: number;
}

interface FasterWhisperWord {
  start: number;
  end: number;
  word: string;
  probability: number;
}

interface FasterWhisperResponse {
  text: string;
  segments: FasterWhisperSegment[];
  language: string;
  language_probability: number;
}

interface FasterWhisperCallbackPayload {
  job_id: string;
  status: "completed" | "failed" | "processing";
  result?: FasterWhisperResponse;
  error?: string;
}

/**
 * Faster-Whisper transcription provider implementation
 * Uses a self-hosted faster-whisper server (e.g., via faster-whisper-server)
 */
export class FasterWhisperProvider implements ITranscriptionProvider {
  readonly name = "faster-whisper" as const;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.FASTER_WHISPER_URL || "http://localhost:8000";
  }

  isAvailable(): boolean {
    return !!this.baseUrl;
  }

  async submit(request: TranscriptionRequest): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("Faster-Whisper URL not configured");
    }

    // Faster-whisper-server style API
    const url = `${this.baseUrl}/v1/transcriptions`;

    const formData = new FormData();

    if (request.audioBuffer) {
      const blob = new Blob([request.audioBuffer], { type: "audio/wav" });
      formData.append("file", blob, "audio.wav");
    } else {
      throw new Error("audioBuffer must be provided for faster-whisper");
    }

    // Model selection (small for CPU efficiency)
    formData.append("model", "small");

    // Language
    if (request.language && request.language !== "auto") {
      formData.append("language", request.language);
    }

    // Word-level timestamps
    formData.append("word_timestamps", "true");

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Faster-Whisper API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as FasterWhisperResponse & { id?: string };

    // Return job ID or generate one
    return data.id || `fw-${Date.now()}`;
  }

  async getResult(providerTranscriptId: string): Promise<TranscriptionResult | null> {
    // Faster-Whisper typically returns synchronously
    // If async, poll for results
    if (!this.isAvailable()) {
      throw new Error("Faster-Whisper URL not configured");
    }

    const url = `${this.baseUrl}/v1/transcriptions/${providerTranscriptId}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Faster-Whisper API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as FasterWhisperResponse;
    return this.parseFasterWhisperResult(data);
  }

  parseCallback(payload: unknown): TranscriptionResult {
    const data = payload as FasterWhisperCallbackPayload;

    if (data.status === "failed" || data.error) {
      return {
        success: false,
        error: data.error || "Transcription failed",
        words: [],
        fullText: "",
      };
    }

    if (!data.result) {
      return {
        success: false,
        error: "No result in callback",
        words: [],
        fullText: "",
      };
    }

    return this.parseFasterWhisperResult(data.result);
  }

  isCallbackSuccess(payload: unknown): boolean {
    const data = payload as FasterWhisperCallbackPayload;
    return data.status === "completed" && !data.error;
  }

  /**
   * Parse Faster-Whisper result into our format
   */
  private parseFasterWhisperResult(data: FasterWhisperResponse): TranscriptionResult {
    const words: TranscriptionWord[] = [];
    let lastEnd = 0;

    for (const segment of data.segments) {
      // Use word-level timestamps if available
      if (segment.words && segment.words.length > 0) {
        for (const w of segment.words) {
          words.push({
            word: w.word.trim(),
            startMs: Math.round(w.start * 1000),
            endMs: Math.round(w.end * 1000),
            speaker: segment.speaker,
            confidence: Math.round(w.probability * 100),
          });
          lastEnd = Math.max(lastEnd, w.end);
        }
      } else {
        // Estimate word timestamps from segment
        const segmentWords = segment.text.trim().split(/\s+/);
        const segmentDuration = segment.end - segment.start;
        const wordDuration = segmentDuration / segmentWords.length;

        for (let i = 0; i < segmentWords.length; i++) {
          const wordStart = segment.start + i * wordDuration;
          words.push({
            word: segmentWords[i],
            startMs: Math.round(wordStart * 1000),
            endMs: Math.round((wordStart + wordDuration) * 1000),
            speaker: segment.speaker,
          });
        }
        lastEnd = Math.max(lastEnd, segment.end);
      }
    }

    return {
      success: true,
      providerTranscriptId: `fw-${Date.now()}`,
      language: data.language,
      languageConfidence: Math.round(data.language_probability * 100),
      durationSeconds: Math.round(lastEnd),
      speakerCount: 1, // Faster-Whisper doesn't do diarization by default
      words,
      fullText: data.text.trim(),
    };
  }
}

/**
 * Factory function to create Faster-Whisper provider
 */
export function createFasterWhisperProvider(): FasterWhisperProvider {
  return new FasterWhisperProvider();
}
