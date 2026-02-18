/**
 * Bush Platform - Transcript Component Types
 *
 * Types for transcript panel, word display, and caption components.
 * Reference: specs/06-transcription-and-captions.md Section 7
 */

import type {
  TranscriptionAttributes,
} from "../../lib/api";

/**
 * Transcription status
 */
export type TranscriptionStatus = TranscriptionAttributes["status"];

/**
 * Transcription provider
 */
export type TranscriptionProvider = TranscriptionAttributes["provider"];

/**
 * Transcript word with ID
 */
export interface TranscriptWord {
  id: string;
  word: string;
  startMs: number;
  endMs: number;
  speaker: string | null;
  confidence: number | null;
  position: number;
  originalWord: string | null;
}

/**
 * Transcript data with metadata
 */
export interface Transcript {
  id: string;
  fileId: string;
  status: TranscriptionStatus;
  provider: TranscriptionProvider;
  language: string | null;
  languageConfidence: number | null;
  fullText: string | null;
  speakerCount: number | null;
  speakerNames: Record<string, string>;
  durationSeconds: number | null;
  isEdited: boolean;
  editedAt: string | null;
  editedByUserId: string | null;
  editedByUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Caption track
 */
export interface Caption {
  id: string;
  fileId: string;
  language: string;
  format: "srt" | "vtt";
  label: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Props for TranscriptPanel component
 */
export interface TranscriptPanelProps {
  /** File ID to load transcript for */
  fileId: string;
  /** Current playback time in seconds */
  currentTime?: number;
  /** Callback when user clicks a word to seek */
  onSeek?: (timeSeconds: number) => void;
  /** Callback when transcript status changes */
  onStatusChange?: (status: TranscriptionStatus) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Props for TranscriptWord component
 */
export interface TranscriptWordProps {
  /** Word data */
  word: TranscriptWord;
  /** Whether this word is currently being played */
  isActive?: boolean;
  /** Speaker display name (if known) */
  speakerName?: string;
  /** Speaker color index for styling */
  speakerColorIndex?: number;
  /** Whether the word can be edited */
  canEdit?: boolean;
  /** Callback when word is clicked */
  onClick?: () => void;
  /** Callback when word is edited */
  onEdit?: (newWord: string) => void;
}

/**
 * Props for TranscriptSegment component (group of words by speaker)
 */
export interface TranscriptSegmentProps {
  /** Words in this segment */
  words: TranscriptWord[];
  /** Speaker ID */
  speaker: string | null;
  /** Speaker display name */
  speakerName?: string;
  /** Speaker color index */
  speakerColorIndex: number;
  /** Current playback time in seconds */
  currentTime?: number;
  /** Whether words can be edited */
  canEdit?: boolean;
  /** Callback to seek to time */
  onSeek?: (timeSeconds: number) => void;
  /** Callback when a word is edited */
  onWordEdit?: (wordId: string, newWord: string) => void;
}

/**
 * Props for CaptionOverlay component
 */
export interface CaptionOverlayProps {
  /** Words to display */
  words: TranscriptWord[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Speaker names map */
  speakerNames?: Record<string, string>;
  /** Whether captions are enabled */
  enabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Props for SpeakerLabel component
 */
export interface SpeakerLabelProps {
  /** Speaker ID (e.g., "speaker_0") */
  speakerId: string;
  /** Current display name */
  name: string;
  /** Whether the label can be edited */
  canEdit?: boolean;
  /** Color index for speaker styling */
  colorIndex: number;
  /** Callback when name is changed */
  onRename?: (newName: string) => void;
}

/**
 * Speaker color palette (10 distinct colors)
 */
export const SPEAKER_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
] as const;

/**
 * Get speaker color index
 */
export function getSpeakerColorIndex(speaker: string | null): number {
  if (!speaker) return 0;
  const match = speaker.match(/(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) % SPEAKER_COLORS.length;
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Check if a word is active at the given time
 */
export function isWordActive(word: TranscriptWord, currentTimeSeconds: number): boolean {
  const startSeconds = msToSeconds(word.startMs);
  const endSeconds = msToSeconds(word.endMs);
  return currentTimeSeconds >= startSeconds && currentTimeSeconds < endSeconds;
}

/**
 * Group words into segments by speaker
 */
export function groupWordsBySpeaker(words: TranscriptWord[]): TranscriptWord[][] {
  const segments: TranscriptWord[][] = [];
  let currentSegment: TranscriptWord[] = [];
  let currentSpeaker: string | null = null;

  for (const word of words) {
    if (word.speaker !== currentSpeaker && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
    currentSpeaker = word.speaker;
    currentSegment.push(word);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}
