/**
 * Bush Platform - Transcript Segment Component
 *
 * Displays a group of words from the same speaker with speaker label.
 * Reference: specs/06-transcription-and-captions.md Section 7
 */
"use client";

import { useState, useCallback, useRef, RefObject } from "react";
import type { TranscriptWord } from "./types";
import { formatTime, SPEAKER_COLORS } from "./types";
import styles from "./transcript.module.css";

export interface TranscriptSegmentProps {
  /** Words in this segment */
  words: TranscriptWord[];
  /** Speaker ID */
  speaker: string | null;
  /** Speaker display name */
  speakerName: string;
  /** Speaker color index */
  speakerColorIndex: number;
  /** Whether words can be edited */
  canEdit?: boolean;
  /** Callback to seek to time */
  onSeek?: (timeSeconds: number) => void;
  /** Callback when a word is edited */
  onWordEdit?: (wordId: string, newWord: string) => void;
  /** Callback when speaker is renamed */
  onSpeakerRename?: (speakerId: string, newName: string) => void;
  /** ID of currently active word */
  activeWordId?: string | null;
  /** Ref to active word element for auto-scroll */
  activeWordRef?: RefObject<HTMLSpanElement | null>;
}

export function TranscriptSegment({
  words,
  speaker,
  speakerName,
  speakerColorIndex,
  canEdit = true,
  onSeek,
  onWordEdit,
  onSpeakerRename,
  activeWordId,
  activeWordRef,
}: TranscriptSegmentProps) {
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isRenamingSpeaker, setIsRenamingSpeaker] = useState(false);
  const [speakerRenameValue, setSpeakerRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const speakerInputRef = useRef<HTMLInputElement>(null);

  // Get speaker color
  const speakerColor = SPEAKER_COLORS[speakerColorIndex % SPEAKER_COLORS.length];

  // Get start time of segment
  const startTime = words[0]?.startMs ? words[0].startMs / 1000 : 0;

  // Handle word click - start editing or seek
  const handleWordClick = useCallback(
    (word: TranscriptWord) => {
      if (editingWordId) return; // Already editing

      if (canEdit && onWordEdit) {
        // Start editing
        setEditingWordId(word.id);
        setEditingValue(word.word);
        // Focus input after render
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (onSeek) {
        // Seek to word
        onSeek(word.startMs / 1000);
      }
    },
    [canEdit, editingWordId, onSeek, onWordEdit]
  );

  // Handle word edit submission
  const handleWordSubmit = useCallback(
    (word: TranscriptWord) => {
      const trimmedValue = editingValue.trim();
      if (trimmedValue && trimmedValue !== word.word && onWordEdit) {
        onWordEdit(word.id, trimmedValue);
      }
      setEditingWordId(null);
      setEditingValue("");
    },
    [editingValue, onWordEdit]
  );

  // Handle keydown in edit input
  const handleWordKeydown = useCallback(
    (e: React.KeyboardEvent, word: TranscriptWord) => {
      if (e.key === "Enter") {
        handleWordSubmit(word);
      } else if (e.key === "Escape") {
        setEditingWordId(null);
        setEditingValue("");
      }
    },
    [handleWordSubmit]
  );

  // Handle speaker rename click
  const handleRenameClick = useCallback(() => {
    setIsRenamingSpeaker(true);
    setSpeakerRenameValue(speakerName);
    setTimeout(() => speakerInputRef.current?.focus(), 0);
  }, [speakerName]);

  // Handle speaker rename submit
  const handleSpeakerRenameSubmit = useCallback(() => {
    const trimmedValue = speakerRenameValue.trim();
    if (trimmedValue && trimmedValue !== speakerName && onSpeakerRename && speaker) {
      onSpeakerRename(speaker, trimmedValue);
    }
    setIsRenamingSpeaker(false);
    setSpeakerRenameValue("");
  }, [speakerRenameValue, speakerName, onSpeakerRename, speaker]);

  // Handle speaker rename keydown
  const handleSpeakerRenameKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSpeakerRenameSubmit();
      } else if (e.key === "Escape") {
        setIsRenamingSpeaker(false);
        setSpeakerRenameValue("");
      }
    },
    [handleSpeakerRenameSubmit]
  );

  return (
    <div className={styles.transcriptSegment}>
      {/* Speaker header */}
      <div className={styles.transcriptSegment__header}>
        <div className={styles.speakerLabel}>
          <span
            className={styles.speakerLabel__dot}
            style={{ backgroundColor: speakerColor }}
          />
          {isRenamingSpeaker ? (
            <input
              ref={speakerInputRef}
              type="text"
              className={styles.speakerLabel__input}
              value={speakerRenameValue}
              onChange={(e) => setSpeakerRenameValue(e.target.value)}
              onBlur={handleSpeakerRenameSubmit}
              onKeyDown={handleSpeakerRenameKeydown}
            />
          ) : (
            <>
              <span className={styles.speakerLabel__name}>{speakerName}</span>
              {canEdit && onSpeakerRename && (
                <button
                  className={styles.speakerLabel__edit}
                  onClick={handleRenameClick}
                  title="Rename speaker"
                >
                  edit
                </button>
              )}
            </>
          )}
        </div>
        <button
          className={styles.transcriptSegment__time}
          onClick={() => onSeek?.(startTime)}
          title={`Seek to ${formatTime(startTime)}`}
        >
          {formatTime(startTime)}
        </button>
      </div>

      {/* Words */}
      <div className={styles.transcriptSegment__words}>
        {words.map((word) => {
          const isActive = word.id === activeWordId;
          const isEditing = word.id === editingWordId;
          const isEdited = !!word.originalWord;

          return (
            <span key={word.id}>
              {isEditing ? (
                <span className={styles.transcriptWordEditing}>
                  <input
                    ref={inputRef}
                    type="text"
                    className={styles.transcriptWord__input}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => handleWordSubmit(word)}
                    onKeyDown={(e) => handleWordKeydown(e, word)}
                  />
                </span>
              ) : (
                <span
                  className={`${styles.transcriptWord} ${
                    isActive ? styles.transcriptWordActive : ""
                  } ${isEdited ? styles.transcriptWordEdited : ""}`}
                  onClick={() => handleWordClick(word)}
                  ref={isActive ? activeWordRef : undefined}
                  style={isActive ? { color: speakerColor } : undefined}
                  title={
                    isEdited
                      ? `Original: ${word.originalWord}`
                      : `${formatTime(word.startMs / 1000)}`
                  }
                >
                  {word.word}
                </span>
              )}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default TranscriptSegment;
