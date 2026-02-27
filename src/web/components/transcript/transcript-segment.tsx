/**
 * Bush Platform - Transcript Segment Component
 *
 * Displays a group of words from the same speaker with speaker label.
 * Reference: specs/08-transcription.md Section 7
 */
"use client";

import { useState, useCallback, useRef, RefObject } from "react";
import type { TranscriptWord } from "./types";
import { formatTime, SPEAKER_COLORS } from "./types";
import { cn } from "@/web/lib/utils";

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
    <div className="mb-4">
      {/* Speaker header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="inline-flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: speakerColor }}
          />
          {isRenamingSpeaker ? (
            <input
              ref={speakerInputRef}
              type="text"
              className="w-auto min-w-[4rem] max-w-[10rem] px-1 py-0.5 text-xs font-inherit text-text bg-surface--1 border border-primary rounded outline-none"
              value={speakerRenameValue}
              onChange={(e) => setSpeakerRenameValue(e.target.value)}
              onBlur={handleSpeakerRenameSubmit}
              onKeyDown={handleSpeakerRenameKeydown}
            />
          ) : (
            <>
              <span className="text-xs font-medium text-text-secondary">{speakerName}</span>
              {canEdit && onSpeakerRename && (
                <button
                  className="inline-flex items-center px-1 py-0.5 text-[11px] font-medium text-text-tertiary bg-none border-none rounded opacity-0 transition-all hover:bg-surface-1 hover:text-text-secondary group-hover:opacity-100"
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
          className="text-[11px] font-mono text-text-tertiary bg-transparent border-none cursor-pointer"
          onClick={() => onSeek?.(startTime)}
          title={`Seek to ${formatTime(startTime)}`}
        >
          {formatTime(startTime)}
        </button>
      </div>

      {/* Words */}
      <div className="leading-relaxed">
        {words.map((word) => {
          const isActive = word.id === activeWordId;
          const isEditing = word.id === editingWordId;
          const isEdited = !!word.originalWord;

          return (
            <span key={word.id}>
              {isEditing ? (
                <span className="inline p-0 bg-transparent">
                  <input
                    ref={inputRef}
                    type="text"
                    className="min-w-[2rem] max-w-[10rem] px-1 py-0.5 text-sm font-inherit text-text bg-surface--1 border border-primary rounded-sm outline-none"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => handleWordSubmit(word)}
                    onKeyDown={(e) => handleWordKeydown(e, word)}
                  />
                </span>
              ) : (
                <span
                  className={cn(
                    "inline px-0.5 text-sm text-text cursor-pointer rounded-sm transition-colors hover:bg-surface-1",
                    isActive && "bg-primary/20 text-primary hover:bg-primary/30",
                    isEdited && "underline decoration-dotted decoration-text-tertiary"
                  )}
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
