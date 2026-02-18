/**
 * Bush Platform - Transcript Panel Component
 *
 * Sidebar panel for displaying and interacting with transcripts.
 * Reference: specs/06-transcription-and-captions.md Section 7
 */
"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { TranscriptSegment } from "./transcript-segment";
import {
  transcriptionApi,
  TranscriptionAttributes,
  TranscriptWordAttributes,
} from "../../lib/api";
import type {
  TranscriptPanelProps,
  Transcript,
  TranscriptWord,
  TranscriptionStatus,
} from "./types";
import {
  groupWordsBySpeaker,
  getSpeakerColorIndex,
  formatTime,
} from "./types";
import styles from "./transcript.module.css";

/** Transcript icon */
function TranscriptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

/** Export icon */
function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Refresh icon */
function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

/** Search icon */
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/** Empty state icon */
function EmptyIcon() {
  return (
    <svg className={styles.transcriptPanel__emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

/** Map API attributes to local Transcript type */
function mapTranscript(id: string, attrs: TranscriptionAttributes): Transcript {
  return {
    id,
    fileId: attrs.file_id,
    status: attrs.status,
    provider: attrs.provider,
    language: attrs.language,
    languageConfidence: attrs.language_confidence,
    fullText: attrs.full_text,
    speakerCount: attrs.speaker_count,
    speakerNames: attrs.speaker_names,
    durationSeconds: attrs.duration_seconds,
    isEdited: attrs.is_edited,
    editedAt: attrs.edited_at,
    editedByUserId: attrs.edited_by_user_id,
    editedByUser: attrs.edited_by_user,
    errorMessage: attrs.error_message,
    createdAt: attrs.created_at,
    updatedAt: attrs.updated_at,
  };
}

/** Map API word attributes to local type */
function mapWord(id: string, attrs: TranscriptWordAttributes): TranscriptWord {
  return {
    id,
    word: attrs.word,
    startMs: attrs.start_ms,
    endMs: attrs.end_ms,
    speaker: attrs.speaker,
    confidence: attrs.confidence,
    position: attrs.position,
    originalWord: attrs.original_word,
  };
}

export function TranscriptPanel({
  fileId,
  currentTime = 0,
  onSeek,
  onStatusChange,
  className = "",
}: TranscriptPanelProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Ref for auto-scrolling to active word
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load transcript and words
  useEffect(() => {
    const loadTranscript = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load transcript
        const transcriptResponse = await transcriptionApi.get(fileId);
        const mappedTranscript = mapTranscript(
          transcriptResponse.data.id,
          transcriptResponse.data.attributes
        );
        setTranscript(mappedTranscript);
        onStatusChange?.(mappedTranscript.status);

        // Load words if completed
        if (mappedTranscript.status === "completed") {
          const wordsResponse = await transcriptionApi.getWords(fileId);
          const mappedWords = wordsResponse.data.map((w) => mapWord(w.id, w.attributes));
          // Sort by position
          mappedWords.sort((a, b) => a.position - b.position);
          setWords(mappedWords);
        }
      } catch (err) {
        // Check if it's a 404 (no transcript yet)
        if (err instanceof Error && err.message.includes("not found")) {
          setTranscript(null);
          setWords([]);
        } else {
          console.error("Failed to load transcript:", err);
          setError("Failed to load transcript");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTranscript();
  }, [fileId, onStatusChange]);

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current && contentRef.current) {
      const container = contentRef.current;
      const wordEl = activeWordRef.current;

      // Check if word is in view
      const containerRect = container.getBoundingClientRect();
      const wordRect = wordEl.getBoundingClientRect();

      const isOutOfView =
        wordRect.top < containerRect.top + 100 ||
        wordRect.bottom > containerRect.bottom - 100;

      if (isOutOfView) {
        wordEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTime]);

  // Regenerate transcript
  const handleRegenerate = useCallback(async () => {
    if (!fileId) return;

    setIsRegenerating(true);
    setError(null);

    try {
      const response = await transcriptionApi.create(fileId, {
        language: "auto",
        speaker_identification: true,
      });

      const mappedTranscript = mapTranscript(
        response.data.id,
        response.data.attributes
      );
      setTranscript(mappedTranscript);
      setWords([]);
      onStatusChange?.(mappedTranscript.status);
    } catch (err) {
      console.error("Failed to regenerate transcript:", err);
      setError("Failed to start transcription");
    } finally {
      setIsRegenerating(false);
    }
  }, [fileId, onStatusChange]);

  // Handle word edit
  const handleWordEdit = useCallback(
    async (wordId: string, newWord: string) => {
      if (!transcript) return;

      try {
        // Optimistically update local state
        setWords((prev) =>
          prev.map((w) =>
            w.id === wordId
              ? { ...w, word: newWord, originalWord: w.originalWord || w.word }
              : w
          )
        );

        // Update via API
        await transcriptionApi.update(fileId, {
          words: [{ id: wordId, word: newWord }],
        });
      } catch (err) {
        console.error("Failed to update word:", err);
        setError("Failed to save edit");
      }
    },
    [fileId, transcript]
  );

  // Handle speaker rename
  const handleSpeakerRename = useCallback(
    async (speakerId: string, newName: string) => {
      if (!transcript) return;

      try {
        // Optimistically update
        setTranscript((prev) =>
          prev
            ? {
                ...prev,
                speakerNames: { ...prev.speakerNames, [speakerId]: newName },
              }
            : null
        );

        // Update via API
        await transcriptionApi.update(fileId, {
          speaker_names: { ...transcript.speakerNames, [speakerId]: newName },
        });
      } catch (err) {
        console.error("Failed to rename speaker:", err);
        setError("Failed to save speaker name");
      }
    },
    [fileId, transcript]
  );

  // Export transcript
  const handleExport = useCallback(
    async (format: "vtt" | "srt" | "txt") => {
      if (!transcript) return;

      try {
        const content = await transcriptionApi.export(fileId, format);

        // Download
        const blob = new Blob([content], {
          type: format === "vtt" ? "text/vtt" : format === "srt" ? "application/x-subrip" : "text/plain",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setShowExport(false);
      } catch (err) {
        console.error("Failed to export transcript:", err);
        setError("Failed to export transcript");
      }
    },
    [fileId, transcript]
  );

  // Filter words by search query
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return words;
    const query = searchQuery.toLowerCase();
    return words.filter((w) => w.word.toLowerCase().includes(query));
  }, [words, searchQuery]);

  // Group words by speaker
  const segments = useMemo(() => {
    if (searchQuery.trim()) {
      // When searching, don't group - just show matching words
      return [];
    }
    return groupWordsBySpeaker(words);
  }, [words, searchQuery]);

  // Get current active word ID
  const activeWordId = useMemo(() => {
    if (!currentTime) return null;
    const currentMs = currentTime * 1000;
    return words.find((w) => w.startMs <= currentMs && w.endMs > currentMs)?.id;
  }, [words, currentTime]);

  // Render status badge
  const renderStatus = (status: TranscriptionStatus) => {
    const statusLabels: Record<TranscriptionStatus, string> = {
      pending: "Pending",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
    };

    return (
      <span className={`${styles.transcriptPanel__status} ${styles[`transcriptPanel__status--${status}`]}`}>
        {status === "processing" && <Spinner size="sm" />}
        {statusLabels[status]}
      </span>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`${styles["transcript-panel"]} ${className}`}>
        <div className={styles.transcriptPanel__header}>
          <h3 className={styles.transcriptPanel__title}>
            <TranscriptIcon />
            Transcript
          </h3>
        </div>
        <div className={styles.transcriptPanel__loading}>
          <Spinner size="lg" />
          <span className={styles.transcriptPanel__loadingText}>Loading transcript...</span>
        </div>
      </div>
    );
  }

  // No transcript state
  if (!transcript) {
    return (
      <div className={`${styles["transcript-panel"]} ${className}`}>
        <div className={styles.transcriptPanel__header}>
          <h3 className={styles.transcriptPanel__title}>
            <TranscriptIcon />
            Transcript
          </h3>
        </div>
        <div className={styles.transcriptPanel__empty}>
          <EmptyIcon />
          <p>No transcript available</p>
          <p className={styles["transcriptPanel__empty-hint"]}>
            Generate a transcript for this file
          </p>
          <Button onClick={handleRegenerate} disabled={isRegenerating}>
            {isRegenerating ? (
              <>
                <Spinner size="sm" /> Starting...
              </>
            ) : (
              <>
                <RefreshIcon /> Generate Transcript
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Processing/Pending state
  if (transcript.status === "pending" || transcript.status === "processing") {
    return (
      <div className={`${styles["transcript-panel"]} ${className}`}>
        <div className={styles.transcriptPanel__header}>
          <h3 className={styles.transcriptPanel__title}>
            <TranscriptIcon />
            Transcript
          </h3>
          {renderStatus(transcript.status)}
        </div>
        <div className={styles.transcriptPanel__loading}>
          <Spinner size="lg" />
          <span className={styles.transcriptPanel__loadingText}>
            {transcript.status === "pending"
              ? "Waiting to process..."
              : "Transcribing audio..."}
          </span>
        </div>
      </div>
    );
  }

  // Failed state
  if (transcript.status === "failed") {
    return (
      <div className={`${styles["transcript-panel"]} ${className}`}>
        <div className={styles.transcriptPanel__header}>
          <h3 className={styles.transcriptPanel__title}>
            <TranscriptIcon />
            Transcript
          </h3>
          {renderStatus(transcript.status)}
        </div>
        <div className={styles.transcriptPanel__error}>
          <span className={styles.transcriptPanel__error_message}>
            {transcript.errorMessage || "Transcription failed"}
          </span>
          <Button size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
            {isRegenerating ? (
              <>
                <Spinner size="sm" /> Retrying...
              </>
            ) : (
              <>
                <RefreshIcon /> Try Again
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Completed state - show transcript
  return (
    <div className={`${styles["transcript-panel"]} ${className}`}>
      {/* Header */}
      <div className={styles.transcriptPanel__header}>
        <h3 className={styles.transcriptPanel__title}>
          <TranscriptIcon />
          Transcript
        </h3>
        <div className={styles.transcriptPanel__actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExport(!showExport)}
            title="Export transcript"
          >
            <ExportIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            title="Regenerate transcript"
          >
            <RefreshIcon />
          </Button>
        </div>
      </div>

      {/* Info bar */}
      <div className={styles.transcriptPanel__info}>
        {transcript.language && (
          <span className={styles.transcriptPanel__infoItem}>
            {transcript.language.toUpperCase()}
          </span>
        )}
        {transcript.durationSeconds && (
          <span className={styles.transcriptPanel__infoItem}>
            {formatTime(transcript.durationSeconds)}
          </span>
        )}
        {transcript.speakerCount && transcript.speakerCount > 0 && (
          <span className={styles.transcriptPanel__infoItem}>
            {transcript.speakerCount} {transcript.speakerCount === 1 ? "speaker" : "speakers"}
          </span>
        )}
        {transcript.isEdited && (
          <span className={styles.transcriptPanel__infoItem} title="Edited">
            Edited
          </span>
        )}
      </div>

      {/* Export options */}
      {showExport && (
        <div className={styles.transcriptExport}>
          <span className={styles.transcriptExport__label}>Export as:</span>
          <Button variant="ghost" size="sm" onClick={() => handleExport("vtt")}>
            VTT
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleExport("srt")}>
            SRT
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleExport("txt")}>
            TXT
          </Button>
        </div>
      )}

      {/* Search */}
      <div className={styles.transcriptPanel__search}>
        <SearchIcon />
        <input
          type="text"
          className={styles.transcriptPanel__searchInput}
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <span className={styles.transcriptPanel__searchCount}>
            {filteredWords.length} {filteredWords.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={styles.transcriptPanel__error}>
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Content */}
      <div className={styles.transcriptPanel__content} ref={contentRef}>
        {words.length === 0 ? (
          <div className={styles.transcriptPanel__empty}>
            <p>No words found</p>
          </div>
        ) : searchQuery.trim() ? (
          // Search results view
          <div className={styles.transcriptSegment}>
            <div className={styles.transcriptSegment__words}>
              {filteredWords.map((word) => (
                <span
                  key={word.id}
                  className={`${styles.transcriptWord} ${
                    word.id === activeWordId ? styles.transcriptWordActive : ""
                  } ${word.originalWord ? styles.transcriptWordEdited : ""}`}
                  onClick={() => onSeek?.(word.startMs / 1000)}
                  ref={word.id === activeWordId ? activeWordRef : undefined}
                >
                  {word.word}
                </span>
              ))}{" "}
            </div>
          </div>
        ) : (
          // Segmented view by speaker
          segments.map((segment, idx) => {
            const speakerId = segment[0]?.speaker || "speaker_0";
            const speakerName = transcript.speakerNames[speakerId] || speakerId;
            const colorIndex = getSpeakerColorIndex(speakerId);

            return (
              <TranscriptSegment
                key={`${speakerId}-${idx}`}
                words={segment}
                speaker={speakerId}
                speakerName={speakerName}
                speakerColorIndex={colorIndex}
                onSeek={onSeek}
                onWordEdit={handleWordEdit}
                onSpeakerRename={handleSpeakerRename}
                activeWordId={activeWordId}
                activeWordRef={activeWordRef}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default TranscriptPanel;
