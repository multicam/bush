/**
 * Bush Platform - Caption Overlay Component
 *
 * Displays captions overlaid on video/audio players.
 * Reference: specs/06-transcription-and-captions.md Section 7
 */
"use client";

import { useMemo } from "react";
import type { TranscriptWord } from "./types";
import { SPEAKER_COLORS, getSpeakerColorIndex } from "./types";
import styles from "./transcript.module.css";

export interface CaptionOverlayProps {
  /** Words to display */
  words: TranscriptWord[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Speaker names map */
  speakerNames?: Record<string, string>;
  /** Whether captions are enabled */
  enabled?: boolean;
  /** Show speaker labels */
  showSpeakers?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Group words into caption cues (typically 5-8 words per cue)
 */
function groupWordsIntoCues(words: TranscriptWord[]): TranscriptWord[][] {
  if (words.length === 0) return [];

  const cues: TranscriptWord[][] = [];
  let currentCue: TranscriptWord[] = [];
  let currentSpeaker: string | null = null;

  for (const word of words) {
    // Start new cue on speaker change
    if (word.speaker !== currentSpeaker && currentCue.length > 0) {
      cues.push(currentCue);
      currentCue = [];
    }

    currentSpeaker = word.speaker;
    currentCue.push(word);

    // Create new cue after 7 words or on significant pause
    if (currentCue.length >= 7) {
      cues.push(currentCue);
      currentCue = [];
    }
  }

  if (currentCue.length > 0) {
    cues.push(currentCue);
  }

  return cues;
}

export function CaptionOverlay({
  words,
  currentTime,
  speakerNames = {},
  enabled = true,
  showSpeakers = true,
  className = "",
}: CaptionOverlayProps) {
  // Group words into cues
  const cues = useMemo(() => groupWordsIntoCues(words), [words]);

  // Find active cue(s) at current time
  const activeCues = useMemo(() => {
    if (!enabled || currentTime === 0) return [];

    const currentMs = currentTime * 1000;

    return cues.filter((cue) => {
      if (cue.length === 0) return false;
      const startMs = cue[0].startMs;
      const endMs = cue[cue.length - 1].endMs;
      return currentMs >= startMs && currentMs < endMs;
    });
  }, [cues, currentTime, enabled]);

  if (!enabled || activeCues.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.captionOverlay} ${className}`}>
      {activeCues.map((cue, idx) => {
        const speakerId = cue[0]?.speaker;
        const speakerName = speakerId ? (speakerNames[speakerId] || speakerId) : null;
        const colorIndex = getSpeakerColorIndex(speakerId);
        const speakerColor = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
        const text = cue.map((w) => w.word).join(" ");

        return (
          <div key={`${speakerId}-${idx}`}>
            {showSpeakers && speakerName && (
              <div
                className={styles.captionOverlay__speaker}
                style={{ color: speakerColor }}
              >
                {speakerName}
              </div>
            )}
            <div className={styles.captionOverlay__cue}>
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CaptionOverlay;
