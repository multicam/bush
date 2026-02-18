/**
 * Bush Platform - Deepgram Transcription Provider
 *
 * Implementation of transcription using Deepgram Nova-2.
 * Reference: specs/06-transcription-and-captions.md
 */
import type {
  ITranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  TranscriptionWord,
} from "../types.js";

/**
 * Deepgram API response structures
 */
interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: number;
}

interface DeepgramAlternative {
  transcript: string;
  words: DeepgramWord[];
  confidence?: number;
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramUtterance {
  start: number;
  end: number;
  transcript: string;
  words: DeepgramWord[];
  speaker?: number;
  confidence?: number;
}

interface DeepgramResult {
  channels?: DeepgramChannel[];
  utterances?: DeepgramUtterance[];
  summary?: {
    duration: number;
    channels: number;
  };
}

interface DeepgramResponse {
  request_id: string;
  result?: DeepgramResult;
  message?: string;
  error?: string;
}

interface DeepgramCallbackPayload {
  request_id: string;
  status: "completed" | "failed" | "processing";
  result?: DeepgramResult;
  error?: string;
  message?: string;
}

/**
 * Deepgram transcription provider implementation
 */
export class DeepgramProvider implements ITranscriptionProvider {
  readonly name = "deepgram" as const;
  private apiKey: string;
  private baseUrl = "https://api.deepgram.com/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPGRAM_API_KEY || "";
    if (!this.apiKey) {
      console.warn("DeepgramProvider: DEEPGRAM_API_KEY not configured");
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async submit(request: TranscriptionRequest): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("Deepgram API key not configured");
    }

    // Build the API URL with options
    const params = new URLSearchParams({
      model: "nova-2",
      punctuate: "true",
      smart_format: "true",
      utterances: "true",
    });

    // Add language if specified (or auto-detect)
    if (request.language && request.language !== "auto") {
      params.set("language", request.language);
    } else {
      params.set("language", "auto");
    }

    // Add speaker diarization if requested
    if (request.speakerIdentification) {
      params.set("diarize", "true");
    }

    // Add callback URL if provided
    if (request.callbackUrl) {
      params.set("callback", request.callbackUrl);
    }

    const url = `${this.baseUrl}/listen?${params.toString()}`;

    // Make the request
    let response: Response;

    if (request.audioUrl) {
      // Use URL-based submission
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: request.audioUrl }),
      });
    } else if (request.audioBuffer) {
      // Use buffer-based submission
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "audio/wav",
        },
        body: request.audioBuffer,
      });
    } else {
      throw new Error("Either audioUrl or audioBuffer must be provided");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as DeepgramResponse;

    // Deepgram returns results synchronously for short audio or request_id for async
    return data.request_id;
  }

  async getResult(providerTranscriptId: string): Promise<TranscriptionResult | null> {
    // Deepgram returns results synchronously or via callback
    // For async jobs, we need to poll the results endpoint
    if (!this.isAvailable()) {
      throw new Error("Deepgram API key not configured");
    }

    const url = `${this.baseUrl}/listen/${providerTranscriptId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null; // Still processing
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as DeepgramResponse;
    return this.parseDeepgramResult(data);
  }

  parseCallback(payload: unknown): TranscriptionResult {
    const data = payload as DeepgramCallbackPayload;

    if (data.status === "failed" || data.error) {
      return {
        success: false,
        error: data.error || data.message || "Transcription failed",
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

    return this.parseDeepgramResult({ request_id: data.request_id, result: data.result });
  }

  isCallbackSuccess(payload: unknown): boolean {
    const data = payload as DeepgramCallbackPayload;
    return data.status === "completed" && !data.error;
  }

  /**
   * Parse Deepgram result into our format
   */
  private parseDeepgramResult(data: DeepgramResponse): TranscriptionResult {
    if (!data.result) {
      return {
        success: false,
        error: "No result in response",
        words: [],
        fullText: "",
      };
    }

    const result = data.result;
    const words: TranscriptionWord[] = [];
    let fullText = "";
    let speakerCount = 0;
    const speakerSet = new Set<number>();

    // Prefer utterances if available (better for speaker diarization)
    if (result.utterances && result.utterances.length > 0) {
      let _position = 0;
      for (const utterance of result.utterances) {
        fullText += (fullText ? " " : "") + utterance.transcript;

        for (const w of utterance.words) {
          const speaker = w.speaker ?? 0;
          speakerSet.add(speaker);
          words.push({
            word: w.word,
            startMs: Math.round(w.start * 1000),
            endMs: Math.round(w.end * 1000),
            speaker,
            confidence: w.confidence ? Math.round(w.confidence * 100) : undefined,
          });
          _position++;
        }
      }
      speakerCount = speakerSet.size;
    }
    // Fall back to channel-based result
    else if (result.channels && result.channels.length > 0) {
      const channel = result.channels[0];
      const alternative = channel.alternatives[0];

      if (alternative) {
        fullText = alternative.transcript;
        let _position = 0;

        for (const w of alternative.words) {
          const speaker = w.speaker ?? 0;
          speakerSet.add(speaker);
          words.push({
            word: w.word,
            startMs: Math.round(w.start * 1000),
            endMs: Math.round(w.end * 1000),
            speaker,
            confidence: w.confidence ? Math.round(w.confidence * 100) : undefined,
          });
          _position++;
        }
        speakerCount = speakerSet.size;
      }
    }

    const durationSeconds = result.summary?.duration ?? 0;

    return {
      success: true,
      providerTranscriptId: data.request_id,
      language: undefined, // Deepgram doesn't return detected language in callback
      languageConfidence: undefined,
      durationSeconds: Math.round(durationSeconds),
      speakerCount: speakerCount || 1,
      words,
      fullText,
    };
  }
}

/**
 * Factory function to create Deepgram provider
 */
export function createDeepgramProvider(): DeepgramProvider {
  return new DeepgramProvider();
}
