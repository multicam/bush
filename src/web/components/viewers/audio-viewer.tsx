/**
 * Bush Platform - Audio Viewer Component
 *
 * Full-featured audio player with waveform visualization.
 * Reference: specs/00-atomic-features.md Section 9, specs/15-media-processing.md Section 5
 */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { CaptionOverlay, type TranscriptWord } from "../transcript";
import styles from "./audio-viewer.module.css";

/** Waveform data format from server */
export interface WaveformData {
  version: number;
  sampleRate: number;
  channels: number;
  duration: number;
  peaks: number[];
}

/** Comment marker for waveform */
export interface CommentMarker {
  id: string;
  timestamp: number; // seconds
  color?: string;
}

export interface AudioViewerProps {
  /** Audio URL to play */
  src: string;
  /** Waveform data URL (JSON) or pre-loaded data */
  waveform?: string | WaveformData;
  /** File name for display */
  name?: string;
  /** Duration in seconds (optional, from metadata) */
  duration?: number;
  /** Additional file metadata for display */
  meta?: {
    format?: string;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
  };
  /** Comment markers to display on waveform */
  commentMarkers?: CommentMarker[];
  /** Transcript words for caption display */
  transcriptWords?: TranscriptWord[];
  /** Speaker names for caption display */
  speakerNames?: Record<string, string>;
  /** Whether captions are enabled */
  showCaptions?: boolean;
  /** Callback when time changes */
  onTimeUpdate?: (currentTime: number) => void;
  /** Callback when comment marker is clicked */
  onCommentClick?: (markerId: string) => void;
  /** Auto-play on mount (default: false) */
  autoPlay?: boolean;
  /** Additional CSS class */
  className?: string;
}

/** Format seconds to MM:SS or HH:MM:SS */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** Format bitrate for display */
function formatBitrate(bitrate?: number): string {
  if (!bitrate) return "";
  if (bitrate >= 1_000_000) {
    return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
  }
  return `${(bitrate / 1000).toFixed(0)} kbps`;
}

export function AudioViewer({
  src,
  waveform: waveformInput,
  name,
  duration: propDuration,
  meta,
  commentMarkers = [],
  transcriptWords = [],
  speakerNames = {},
  showCaptions = false,
  onTimeUpdate,
  onCommentClick,
  autoPlay = false,
  className,
}: AudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(propDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(
    typeof waveformInput === "object" ? waveformInput : null
  );
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(typeof waveformInput === "string");
  const [isAudioLoading, setIsAudioLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(showCaptions);

  const duration = audioDuration || propDuration || 0;

  // Load waveform data if URL provided
  useEffect(() => {
    let isMounted = true;

    if (typeof waveformInput === "string") {
      fetch(waveformInput)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load waveform");
          return res.json();
        })
        .then((data: WaveformData) => {
          if (isMounted) {
            setWaveformData(data);
            if (!propDuration && data.duration) {
              setAudioDuration(data.duration);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load waveform:", err);
          // Don't set error - audio can still play without waveform
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingWaveform(false);
          }
        });
    } else if (waveformInput) {
      setWaveformData(waveformInput);
      setIsLoadingWaveform(false);
    } else {
      setIsLoadingWaveform(false);
    }

    return () => {
      isMounted = false;
    };
  }, [waveformInput, propDuration]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !waveformData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match container
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw waveform
    const peaks = waveformData.peaks;
    const barWidth = rect.width / peaks.length;
    const centerY = rect.height / 2;
    const maxHeight = rect.height * 0.8;

    ctx.fillStyle = "#3b82f6";

    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barHeight = peak * maxHeight;
      const x = i * barWidth;
      const y = centerY - barHeight / 2;

      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
    }
  }, [waveformData]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleDurationChange = () => {
      if (!propDuration) {
        setAudioDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    const handleError = () => {
      setError("Failed to load audio");
      setIsAudioLoading(false);
    };

    const handleCanPlay = () => {
      setIsAudioLoading(false);
      setError(null);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [propDuration, onTimeUpdate]);

  // Playback controls
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const seekRelative = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, duration));
  }, [duration]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVolume;
    }
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleSpeedChange = useCallback((speed: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = speed;
    }
    setPlaybackRate(speed);
  }, []);

  // Waveform click to seek
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !duration) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;
    const newTime = ratio * duration;

    seek(newTime);
  }, [duration, seek]);

  // Comment marker click
  const handleCommentClick = useCallback((marker: CommentMarker, e: React.MouseEvent) => {
    e.stopPropagation();
    seek(marker.timestamp);
    onCommentClick?.(marker.id);
  }, [seek, onCommentClick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekRelative(e.shiftKey ? -10 : -5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekRelative(e.shiftKey ? 10 : 5);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "c":
        case "C":
          if (transcriptWords.length > 0) {
            setCaptionsEnabled((prev) => !prev);
          }
          break;
        case "j":
        case "J":
          handleSpeedChange(Math.max(0.25, playbackRate - 0.25));
          break;
        case "k":
        case "K":
          if (isPlaying) {
            audioRef.current?.pause();
          }
          break;
        case "l":
        case "L":
          handleSpeedChange(Math.min(2, playbackRate + 0.25));
          break;
        case "Home":
          e.preventDefault();
          seek(0);
          break;
        case "End":
          e.preventDefault();
          seek(duration);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlay, seekRelative, toggleMute, handleSpeedChange, playbackRate, isPlaying, seek, duration]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!duration) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // Calculate playhead position
  const playheadLeft = useMemo(() => {
    if (!duration) return 0;
    return `${(currentTime / duration) * 100}%`;
  }, [currentTime, duration]);

  // Calculate comment marker positions
  const markerPositions = useMemo(() => {
    if (!duration) return [];
    return commentMarkers.map((marker) => ({
      ...marker,
      left: `${(marker.timestamp / duration) * 100}%`,
    }));
  }, [commentMarkers, duration]);

  // File metadata display
  const metaDataDisplay = useMemo(() => {
    const parts: string[] = [];
    if (meta?.format) parts.push(meta.format);
    if (meta?.bitrate) parts.push(formatBitrate(meta.bitrate));
    if (meta?.sampleRate) parts.push(`${(meta.sampleRate / 1000).toFixed(1)} kHz`);
    if (meta?.channels) parts.push(meta.channels === 2 ? "Stereo" : `${meta.channels}ch`);
    return parts.join(" · ");
  }, [meta]);

  if (error) {
    return (
      <div className={`${styles.container} ${className || ""}`}>
        <div className={styles.error}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className={styles.errorMessage}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        className={styles.hiddenAudio}
        preload="metadata"
        autoPlay={autoPlay}
      />

      {/* Loading state */}
      {(isLoadingWaveform || isAudioLoading) && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading audio...</span>
        </div>
      )}

      {/* Main content */}
      <div className={styles.mainContent}>
        {/* Album art placeholder */}
        <div className={styles.artwork}>
          <svg className={styles.artworkIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>

        {/* File info */}
        <div className={styles.fileInfo}>
          {name && <h2 className={styles.fileName}>{name}</h2>}
          {metaDataDisplay && <p className={styles.fileMeta}>{metaDataDisplay}</p>}
        </div>

        {/* Caption overlay */}
        {transcriptWords.length > 0 && (
          <div className={styles.captionContainer}>
            <CaptionOverlay
              words={transcriptWords}
              currentTime={currentTime}
              speakerNames={speakerNames}
              enabled={captionsEnabled}
            />
          </div>
        )}

        {/* Waveform */}
        <div className={styles.waveformSection}>
          <div
            ref={containerRef}
            className={styles.waveformContainer}
            onClick={handleWaveformClick}
          >
            {/* Waveform canvas */}
            <canvas ref={canvasRef} className={styles.waveformCanvas} />

            {/* Progress overlay */}
            <div
              className={styles.waveformProgress}
              style={{ width: `${progressPercent}%` }}
            />

            {/* Comment markers */}
            {markerPositions.map((marker) => (
              <div
                key={marker.id}
                className={styles.commentMarker}
                style={{ left: marker.left, backgroundColor: marker.color }}
                onClick={(e) => handleCommentClick(marker, e)}
                title={`Comment at ${formatTime(marker.timestamp)}`}
              />
            ))}

            {/* Playhead */}
            <div className={styles.playhead} style={{ left: playheadLeft }} />
          </div>

          {/* Time display */}
          <div className={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controlsSection}>
        <div className={styles.controlsRow}>
          {/* Main playback controls */}
          <div className={styles.mainControls}>
            {/* Skip back */}
            <button
              className={styles.controlButton}
              onClick={() => seekRelative(-10)}
              title="Skip back 10s"
              aria-label="Skip back 10 seconds"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                <text x="12" y="15" fontSize="6" textAnchor="middle" fill="currentColor">10</text>
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              className={`${styles.controlButton} ${styles.playButton}`}
              onClick={togglePlay}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip forward */}
            <button
              className={styles.controlButton}
              onClick={() => seekRelative(10)}
              title="Skip forward 10s"
              aria-label="Skip forward 10 seconds"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                <text x="12" y="15" fontSize="6" textAnchor="middle" fill="currentColor">10</text>
              </svg>
            </button>
          </div>

          <div className={styles.divider} />

          {/* Volume control */}
          <div className={styles.volumeControl}>
            <button
              className={styles.controlButton}
              onClick={toggleMute}
              title={isMuted ? "Unmute (M)" : "Mute (M)"}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              className={styles.volumeSlider}
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <div className={styles.divider} />

          {/* Speed control */}
          <div className={styles.speedControl}>
            <select
              className={styles.speedSelect}
              value={playbackRate}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              aria-label="Playback speed"
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
            </select>
          </div>

          {/* Caption toggle */}
          {transcriptWords.length > 0 && (
            <>
              <div className={styles.divider} />
              <button
                className={`${styles.controlButton} ${captionsEnabled ? styles.active : ""}`}
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                title={captionsEnabled ? "Hide captions (C)" : "Show captions (C)"}
                aria-label={captionsEnabled ? "Hide captions" : "Show captions"}
                aria-pressed={captionsEnabled}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div className={styles.shortcutHint}>
        Space: play/pause · ←→: seek · M: mute · C: captions · J/K/L: speed
      </div>
    </div>
  );
}

export default AudioViewer;
