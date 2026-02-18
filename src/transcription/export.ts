/**
 * Bush Platform - Caption Export
 *
 * Export transcriptions to SRT, VTT, and TXT formats.
 * Reference: specs/06-transcription-and-captions.md
 */
import type { CaptionFormat, CaptionSegment } from "./types.js";
import type { SpeakerNames } from "../db/schema.js";

/**
 * Word grouping configuration
 */
const WORDS_PER_SEGMENT = 7; // Target ~7 words per caption segment
const MAX_SEGMENT_DURATION_MS = 5000; // Max 5 seconds per segment
const MIN_SEGMENT_DURATION_MS = 1000; // Min 1 second per segment

/**
 * Group words into caption segments
 */
export function groupWordsIntoSegments(
  words: Array<{
    word: string;
    startMs: number;
    endMs: number;
    speaker?: number;
  }>,
  speakerNames?: SpeakerNames
): CaptionSegment[] {
  if (words.length === 0) {
    return [];
  }

  const segments: CaptionSegment[] = [];
  let currentSegment: CaptionSegment = {
    index: 0,
    startMs: words[0].startMs,
    endMs: words[0].endMs,
    text: words[0].word,
    speaker: words[0].speaker !== undefined ? getSpeakerName(words[0].speaker, speakerNames) : undefined,
  };

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const prevWord = words[i - 1];
    const speakerChanged = word.speaker !== prevWord.speaker;
    const duration = word.endMs - currentSegment.startMs;
    const wordCount = currentSegment.text.split(/\s+/).length;

    // Check if we should start a new segment
    const shouldBreak =
      speakerChanged ||
      wordCount >= WORDS_PER_SEGMENT ||
      duration >= MAX_SEGMENT_DURATION_MS;

    if (shouldBreak) {
      // Ensure minimum duration
      if (currentSegment.endMs - currentSegment.startMs < MIN_SEGMENT_DURATION_MS) {
        currentSegment.endMs = currentSegment.startMs + MIN_SEGMENT_DURATION_MS;
      }

      segments.push(currentSegment);

      // Start new segment
      currentSegment = {
        index: segments.length,
        startMs: word.startMs,
        endMs: word.endMs,
        text: word.word,
        speaker: word.speaker !== undefined ? getSpeakerName(word.speaker, speakerNames) : undefined,
      };
    } else {
      // Extend current segment
      currentSegment.text += " " + word.word;
      currentSegment.endMs = word.endMs;
    }
  }

  // Push final segment
  segments.push(currentSegment);

  // Update indices
  for (let i = 0; i < segments.length; i++) {
    segments[i].index = i + 1;
  }

  return segments;
}

/**
 * Get speaker display name
 */
function getSpeakerName(speakerIndex: number, speakerNames?: SpeakerNames): string {
  if (speakerNames && speakerNames[String(speakerIndex)]) {
    return speakerNames[String(speakerIndex)];
  }
  return `Speaker ${speakerIndex + 1}`;
}

/**
 * Format timestamp for SRT format (HH:MM:SS,mmm)
 */
function formatSrtTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

/**
 * Format timestamp for VTT format (HH:MM:SS.mmm)
 */
function formatVttTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

/**
 * Export to SRT format
 */
export function exportToSrt(segments: CaptionSegment[]): string {
  const lines: string[] = [];

  for (const segment of segments) {
    const startTime = formatSrtTimestamp(segment.startMs);
    const endTime = formatSrtTimestamp(segment.endMs);

    lines.push(segment.index.toString());
    lines.push(`${startTime} --> ${endTime}`);

    // Add speaker prefix if available
    if (segment.speaker) {
      lines.push(`[${segment.speaker}] ${segment.text}`);
    } else {
      lines.push(segment.text);
    }

    lines.push(""); // Empty line between entries
  }

  return lines.join("\n");
}

/**
 * Export to WebVTT format
 */
export function exportToVtt(segments: CaptionSegment[]): string {
  const lines: string[] = [];

  // WebVTT header
  lines.push("WEBVTT");
  lines.push("");

  for (const segment of segments) {
    const startTime = formatVttTimestamp(segment.startMs);
    const endTime = formatVttTimestamp(segment.endMs);

    lines.push(`${startTime} --> ${endTime}`);

    // Use <v> tag for speaker identification in VTT
    if (segment.speaker) {
      lines.push(`<v ${segment.speaker}>${segment.text}`);
    } else {
      lines.push(segment.text);
    }

    lines.push(""); // Empty line between entries
  }

  return lines.join("\n");
}

/**
 * Export to plain text format
 */
export function exportToTxt(segments: CaptionSegment[]): string {
  const lines: string[] = [];

  for (const segment of segments) {
    if (segment.speaker) {
      lines.push(`[${segment.speaker}] ${segment.text}`);
    } else {
      lines.push(segment.text);
    }
  }

  return lines.join("\n");
}

/**
 * Export transcription to the specified format
 */
export function exportTranscription(
  words: Array<{
    word: string;
    startMs: number;
    endMs: number;
    speaker?: number;
  }>,
  format: CaptionFormat,
  speakerNames?: SpeakerNames
): string {
  const segments = groupWordsIntoSegments(words, speakerNames);

  switch (format) {
    case "srt":
      return exportToSrt(segments);
    case "vtt":
      return exportToVtt(segments);
    case "txt":
      return exportToTxt(segments);
    default:
      throw new Error(`Unsupported caption format: ${format}`);
  }
}

/**
 * Parse SRT content into segments
 */
export function parseSrt(content: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timestampLine = lines[1];
    const text = lines.slice(2).join(" ");

    // Parse timestamps: 00:00:00,000 --> 00:00:00,000
    const timestampMatch = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );

    if (!timestampMatch) continue;

    const startMs =
      parseInt(timestampMatch[1]) * 3600000 +
      parseInt(timestampMatch[2]) * 60000 +
      parseInt(timestampMatch[3]) * 1000 +
      parseInt(timestampMatch[4]);

    const endMs =
      parseInt(timestampMatch[5]) * 3600000 +
      parseInt(timestampMatch[6]) * 60000 +
      parseInt(timestampMatch[7]) * 1000 +
      parseInt(timestampMatch[8]);

    // Check for speaker prefix [Speaker Name]
    const speakerMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);
    const speaker = speakerMatch ? speakerMatch[1] : undefined;
    const textContent = speakerMatch ? speakerMatch[2] : text;

    segments.push({
      index,
      startMs,
      endMs,
      text: textContent,
      speaker,
    });
  }

  return segments;
}

/**
 * Parse VTT content into segments
 */
export function parseVtt(content: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  // Remove WEBVTT header and any metadata
  const body = content.replace(/^WEBVTT.*\n(?:.*\n)*/, "").trim();
  const blocks = body.split(/\n\n+/);

  let index = 1;

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // Find timestamp line
    let timestampLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timestampLineIndex = i;
        break;
      }
    }

    const timestampLine = lines[timestampLineIndex];
    const textLines = lines.slice(timestampLineIndex + 1);
    const text = textLines.join(" ");

    // Parse timestamps: 00:00:00.000 --> 00:00:00.000
    const timestampMatch = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );

    if (!timestampMatch) continue;

    const startMs =
      parseInt(timestampMatch[1]) * 3600000 +
      parseInt(timestampMatch[2]) * 60000 +
      parseInt(timestampMatch[3]) * 1000 +
      parseInt(timestampMatch[4]);

    const endMs =
      parseInt(timestampMatch[5]) * 3600000 +
      parseInt(timestampMatch[6]) * 60000 +
      parseInt(timestampMatch[7]) * 1000 +
      parseInt(timestampMatch[8]);

    // Check for <v> speaker tag
    const speakerMatch = text.match(/<v\s+([^>]+)>(.*)$/);
    const speaker = speakerMatch ? speakerMatch[1] : undefined;
    const textContent = speakerMatch ? speakerMatch[2] : text;

    segments.push({
      index: index++,
      startMs,
      endMs,
      text: textContent,
      speaker,
    });
  }

  return segments;
}
