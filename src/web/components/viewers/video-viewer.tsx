/**
 * Bush Platform - Video Viewer Component
 *
 * Full-featured video player with professional controls.
 * Reference: specs/00-atomic-features.md Section 9.1-9.3
 * Reference: IMPLEMENTATION_PLAN.md Section 2.6
 */
"use client";

import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { CaptionOverlay, type TranscriptWord } from "../transcript";
import styles from "./video-viewer.module.css";

/** Comment marker for timeline */
export interface CommentMarker {
  id: string;
  timestamp: number; // seconds
  color?: string;
}

/** Filmstrip data format from server */
export interface FilmstripData {
  width: number;
  height: number;
  columns: number;
  rows: number;
  totalFrames: number;
  intervalSeconds: number;
}

export interface VideoViewerProps {
  /** Video URL to play (proxy or original) */
  src: string;
  /** HLS master playlist URL for adaptive streaming */
  hlsSrc?: string;
  /** Poster image URL */
  poster?: string;
  /** File name for display */
  name?: string;
  /** Duration in seconds (from metadata) */
  duration?: number;
  /** Additional file metadata for display */
  meta?: {
    width?: number;
    height?: number;
    frameRate?: number;
    codec?: string;
    bitrate?: number;
  };
  /** Available resolutions */
  resolutions?: Array<{ label: string; width: number; height: number; src?: string }>;
  /** Filmstrip sprite URL for hover preview */
  filmstripUrl?: string;
  /** Filmstrip manifest data */
  filmstrip?: FilmstripData;
  /** Comment markers to display on timeline */
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

/** Playback speed options */
const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** JKL shuttle speeds */
const SHUTTLE_SPEEDS = [1, 2, 4, 8];

/**
 * Imperative methods exposed by VideoViewer for linked playback.
 * Used by ComparisonViewer to synchronize playback between two videos.
 */
export interface VideoViewerHandle {
  /** Seek to specific time in seconds */
  seekTo: (time: number) => void;
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  togglePlay: () => void;
  /** Get current playback time in seconds */
  getCurrentTime: () => number;
  /** Get video duration in seconds */
  getDuration: () => number;
  /** Check if currently playing */
  isPlaying: () => boolean;
  /** Set playback rate */
  setPlaybackRate: (rate: number) => void;
  /** Get current playback rate */
  getPlaybackRate: () => number;
}

export const VideoViewer = forwardRef<VideoViewerHandle, VideoViewerProps>(function VideoViewer(
  {
    src,
    hlsSrc,
    poster,
    name,
    duration: propDuration,
    meta,
    resolutions = [],
    filmstripUrl,
    filmstrip,
    commentMarkers = [],
    transcriptWords = [],
    speakerNames = {},
    showCaptions = false,
    onTimeUpdate,
    onCommentClick,
    autoPlay = false,
    className,
  }: VideoViewerProps,
  forwardedRef: React.ForwardedRef<VideoViewerHandle>
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const shuttleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(propDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [bufferedPercent, setBufferedPercent] = useState(0);

  // In/Out points for loop playback
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);

  // Current resolution
  const [currentResolution, setCurrentResolution] = useState<string>("auto");

  // Caption visibility
  const [captionsEnabled, setCaptionsEnabled] = useState(showCaptions);

  // Shuttle direction (no speed state needed - derived from interval)
  const [shuttleDirection, setShuttleDirection] = useState<"forward" | "backward" | null>(null);

  const duration = videoDuration || propDuration || 0;

  // Expose imperative methods for linked playback (ComparisonViewer)
  useImperativeHandle(
    forwardedRef,
    () => ({
      seekTo: (time: number) => seek(time),
      play: () => {
        const video = videoRef.current;
        if (video) video.play().catch(console.error);
      },
      pause: () => {
        const video = videoRef.current;
        if (video) video.pause();
      },
      togglePlay,
      getCurrentTime: () => currentTime,
      getDuration: () => duration,
      isPlaying: () => isPlaying,
      setPlaybackRate: handleSpeedChange,
      getPlaybackRate: () => playbackRate,
    }),
    [seek, togglePlay, currentTime, duration, isPlaying, handleSpeedChange, playbackRate]
  );

  // Track container width for filmstrip positioning
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Hide controls after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", () => {
        if (isPlaying) setShowControls(false);
      });
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, [isPlaying]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Update buffered amount
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBufferedPercent((bufferedEnd / duration) * 100);
      }

      // Handle loop in/out points
      if (outPoint !== null && video.currentTime >= outPoint) {
        video.currentTime = inPoint ?? 0;
      }

      onTimeUpdate?.(video.currentTime);
    };

    const handleDurationChange = () => {
      if (!propDuration) {
        setVideoDuration(video.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      // Reset to in point if looping
      if (inPoint !== null) {
        video.currentTime = inPoint;
      }
    };

    const handleError = () => {
      setError("Failed to load video");
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setIsBuffering(false);
      setError(null);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("volumechange", handleVolumeChange);

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("volumechange", handleVolumeChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [propDuration, onTimeUpdate, inPoint, outPoint, duration]);

  // Playback controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const seekRelative = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, duration));
  }, [duration]);

  // Frame-by-frame seek (assuming 24fps default)
  const frameStep = useCallback((direction: "forward" | "backward") => {
    const video = videoRef.current;
    if (!video) return;

    const frameDuration = 1 / (meta?.frameRate || 24);
    const delta = direction === "forward" ? frameDuration : -frameDuration;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, duration));
  }, [duration, meta?.frameRate]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
    }
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 1;
      video.muted = false;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
    }
    setPlaybackRate(speed);
  }, []);

  // JKL shuttle controls
  const startShuttle = useCallback((direction: "forward" | "backward") => {
    if (shuttleIntervalRef.current) {
      clearInterval(shuttleIntervalRef.current);
    }

    setShuttleDirection(direction);

    let speedIndex = 0;
    shuttleIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      speedIndex = Math.min(speedIndex + 1, SHUTTLE_SPEEDS.length - 1);
      const speed = SHUTTLE_SPEEDS[speedIndex];

      const delta = (direction === "forward" ? 1 : -1) * speed * 0.1;
      video.currentTime = Math.max(0, Math.min(video.currentTime + delta, duration));
    }, 500);
  }, [duration]);

  const stopShuttle = useCallback(() => {
    if (shuttleIntervalRef.current) {
      clearInterval(shuttleIntervalRef.current);
      shuttleIntervalRef.current = null;
    }
    setShuttleDirection(null);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  // In/Out point controls
  const setInPointAtCurrentTime = useCallback(() => {
    setInPoint(currentTime);
    if (outPoint !== null && currentTime >= outPoint) {
      setOutPoint(null);
    }
  }, [currentTime, outPoint]);

  const setOutPointAtCurrentTime = useCallback(() => {
    setOutPoint(currentTime);
    if (inPoint !== null && currentTime <= inPoint) {
      setInPoint(null);
    }
  }, [currentTime, inPoint]);

  const clearInOutPoints = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
  }, []);

  // Timeline hover for filmstrip preview
  const handleTimelineHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    if (!timeline || !duration) return;

    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const time = ratio * duration;

    setHoveredTime(time);
    setHoverPosition(x);
  }, [duration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    if (!timeline || !duration) return;

    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const time = ratio * duration;

    seek(time);
  }, [duration, seek]);

  const handleTimelineLeave = useCallback(() => {
    setHoveredTime(null);
  }, []);

  // Filmstrip frame calculation
  const filmstripFrame = useMemo(() => {
    if (!hoveredTime || !filmstrip || !filmstripUrl) return null;

    const frameIndex = Math.floor(hoveredTime / filmstrip.intervalSeconds);
    const column = frameIndex % filmstrip.columns;
    const row = Math.floor(frameIndex / filmstrip.columns);

    return {
      backgroundPosition: `-${column * filmstrip.width}px -${row * filmstrip.height}px`,
      frameIndex,
    };
  }, [hoveredTime, filmstrip, filmstripUrl]);

  // Filmstrip preview position
  const filmstripPreviewLeft = useMemo(() => {
    return Math.min(Math.max(hoverPosition, 80), containerWidth - 80);
  }, [hoverPosition, containerWidth]);

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

      const video = videoRef.current;
      if (!video) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
          e.preventDefault();
          if (e.repeat) {
            if (!shuttleDirection) startShuttle("backward");
          } else {
            seekRelative(-5);
          }
          break;
        case "l":
          e.preventDefault();
          if (e.repeat) {
            if (!shuttleDirection) startShuttle("forward");
          } else {
            seekRelative(5);
          }
          break;
        case "arrowleft":
          e.preventDefault();
          frameStep("backward");
          break;
        case "arrowright":
          e.preventDefault();
          frameStep("forward");
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case "m":
          toggleMute();
          break;
        case "c":
          if (transcriptWords.length > 0) {
            setCaptionsEnabled((prev) => !prev);
          }
          break;
        case "f":
          toggleFullscreen();
          break;
        case "i":
          setInPointAtCurrentTime();
          break;
        case "o":
          setOutPointAtCurrentTime();
          break;
        case "escape":
          if (inPoint !== null || outPoint !== null) {
            clearInOutPoints();
          }
          break;
        default:
          // Number keys 0-9 for percentage jumps
          if (/^[0-9]$/.test(key)) {
            const percent = parseInt(key) * 10;
            seek((percent / 100) * duration);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" || e.key.toLowerCase() === "l") {
        stopShuttle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    togglePlay,
    seekRelative,
    frameStep,
    handleVolumeChange,
    volume,
    toggleMute,
    toggleFullscreen,
    setInPointAtCurrentTime,
    setOutPointAtCurrentTime,
    clearInOutPoints,
    inPoint,
    outPoint,
    seek,
    duration,
    startShuttle,
    stopShuttle,
    shuttleDirection,
  ]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!duration) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // Calculate in/out point positions
  const inPointPercent = useMemo(() => {
    if (inPoint === null || !duration) return null;
    return (inPoint / duration) * 100;
  }, [inPoint, duration]);

  const outPointPercent = useMemo(() => {
    if (outPoint === null || !duration) return null;
    return (outPoint / duration) * 100;
  }, [outPoint, duration]);

  // Calculate comment marker positions
  const markerPositions = useMemo(() => {
    if (!duration) return [];
    return commentMarkers.map((marker) => ({
      ...marker,
      left: `${(marker.timestamp / duration) * 100}%`,
    }));
  }, [commentMarkers, duration]);

  // Resolution label
  const resolutionLabel = useMemo(() => {
    if (meta?.width && meta?.height) {
      if (meta.width >= 3840) return "4K";
      if (meta.width >= 1920) return "1080p";
      if (meta.width >= 1280) return "720p";
      if (meta.width >= 960) return "540p";
      return "360p";
    }
    return "";
  }, [meta]);

  // File metadata display
  const metaDataDisplay = useMemo(() => {
    const parts: string[] = [];
    if (resolutionLabel) parts.push(resolutionLabel);
    if (meta?.frameRate) parts.push(`${meta.frameRate.toFixed(2)} fps`);
    if (meta?.codec) parts.push(meta.codec);
    if (meta?.bitrate) parts.push(formatBitrate(meta.bitrate));
    return parts.join(" · ");
  }, [meta, resolutionLabel]);

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
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ""} ${isFullscreen ? styles.fullscreen : ""}`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={hlsSrc ? undefined : src}
        poster={poster}
        className={styles.video}
        preload="metadata"
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Loading state */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading video...</span>
        </div>
      )}

      {/* Buffering indicator */}
      {isBuffering && !isLoading && (
        <div className={styles.buffering}>
          <div className={styles.spinner} />
        </div>
      )}

      {/* Play/Pause overlay */}
      {!isPlaying && !isLoading && (
        <div className={styles.playOverlay} onClick={togglePlay}>
          <div className={styles.playButtonLarge}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Caption overlay */}
      {transcriptWords.length > 0 && (
        <CaptionOverlay
          words={transcriptWords}
          currentTime={currentTime}
          speakerNames={speakerNames}
          enabled={captionsEnabled}
        />
      )}

      {/* Controls overlay */}
      <div className={`${styles.controlsOverlay} ${showControls ? styles.visible : ""}`}>
        {/* Top bar */}
        <div className={styles.topBar}>
          {name && <h2 className={styles.fileName}>{name}</h2>}
          {metaDataDisplay && <span className={styles.fileMeta}>{metaDataDisplay}</span>}
        </div>

        {/* Timeline / Seekbar */}
        <div className={styles.timelineContainer}>
          {/* Filmstrip preview */}
          {hoveredTime !== null && filmstripFrame && filmstripUrl && (
            <div
              className={styles.filmstripPreview}
              style={{
                left: `${filmstripPreviewLeft}px`,
                backgroundImage: `url(${filmstripUrl})`,
                backgroundPosition: filmstripFrame.backgroundPosition,
                width: `${filmstrip?.width || 160}px`,
                height: `${filmstrip?.height || 90}px`,
              }}
            >
              <span className={styles.filmstripTime}>{formatTime(hoveredTime)}</span>
            </div>
          )}

          {/* Timeline */}
          <div
            ref={timelineRef}
            className={styles.timeline}
            onMouseMove={handleTimelineHover}
            onMouseLeave={handleTimelineLeave}
            onClick={handleTimelineClick}
          >
            {/* In/Out range indicator */}
            {inPointPercent !== null && outPointPercent !== null && (
              <div
                className={styles.inOutRange}
                style={{
                  left: `${inPointPercent}%`,
                  width: `${outPointPercent - inPointPercent}%`,
                }}
              />
            )}

            {/* Progress bar */}
            <div className={styles.timelineProgress} style={{ width: `${progressPercent}%` }} />

            {/* Buffer indicator */}
            {bufferedPercent > 0 && (
              <div
                className={styles.timelineBuffer}
                style={{ width: `${bufferedPercent}%` }}
              />
            )}

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

            {/* In point marker */}
            {inPointPercent !== null && (
              <div
                className={styles.inOutMarker}
                style={{ left: `${inPointPercent}%` }}
                title="In point (I)"
              >
                <span>I</span>
              </div>
            )}

            {/* Out point marker */}
            {outPointPercent !== null && (
              <div
                className={styles.inOutMarker}
                style={{ left: `${outPointPercent}%` }}
                title="Out point (O)"
              >
                <span>O</span>
              </div>
            )}

            {/* Playhead */}
            <div className={styles.playhead} style={{ left: `${progressPercent}%` }} />
          </div>

          {/* Time display */}
          <div className={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            {inPoint !== null && outPoint !== null && (
              <span className={styles.inOutTime}>
                [{formatTime(inPoint)} - {formatTime(outPoint)}]
              </span>
            )}
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control bar */}
        <div className={styles.controlsBar}>
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

              {/* Frame back */}
              <button
                className={styles.controlButton}
                onClick={() => frameStep("backward")}
                title="Previous frame (←)"
                aria-label="Previous frame"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
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

              {/* Frame forward */}
              <button
                className={styles.controlButton}
                onClick={() => frameStep("forward")}
                title="Next frame (→)"
                aria-label="Next frame"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
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
                {PLAYBACK_SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.divider} />

            {/* Resolution control */}
            {resolutions.length > 0 && (
              <>
                <div className={styles.resolutionControl}>
                  <select
                    className={styles.resolutionSelect}
                    value={currentResolution}
                    onChange={(e) => setCurrentResolution(e.target.value)}
                    aria-label="Playback resolution"
                  >
                    <option value="auto">Auto</option>
                    {resolutions.map((res) => (
                      <option key={res.label} value={res.label}>
                        {res.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.divider} />
              </>
            )}

            {/* In/Out point controls */}
            <div className={styles.inOutControls}>
              <button
                className={`${styles.controlButton} ${inPoint !== null ? styles.active : ""}`}
                onClick={setInPointAtCurrentTime}
                title="Set in point (I)"
                aria-label="Set in point"
              >
                <span className={styles.inOutLabel}>I</span>
              </button>
              <button
                className={`${styles.controlButton} ${outPoint !== null ? styles.active : ""}`}
                onClick={setOutPointAtCurrentTime}
                title="Set out point (O)"
                aria-label="Set out point"
              >
                <span className={styles.inOutLabel}>O</span>
              </button>
              {(inPoint !== null || outPoint !== null) && (
                <button
                  className={styles.controlButton}
                  onClick={clearInOutPoints}
                  title="Clear in/out points (Esc)"
                  aria-label="Clear in/out points"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              )}
            </div>

            <div className={styles.divider} />

            {/* Caption toggle */}
            {transcriptWords.length > 0 && (
              <>
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
                <div className={styles.divider} />
              </>
            )}

            {/* Fullscreen */}
            <button
              className={styles.controlButton}
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div className={styles.shortcutHint}>
        Space/K: play/pause · J/L: shuttle · ←→: frame · M: mute · C: captions · F: fullscreen · I/O: in/out points
      </div>
    </div>
  );
});

export default VideoViewer;
