/**
 * Bush Platform - Video Viewer Component
 *
 * Full-featured video player with professional controls.
 * Reference: specs/00-product-reference.md Section 9.1-9.3
 * Reference: IMPLEMENTATION_PLAN.md Section 2.6
 */
"use client";

import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  ClosedCaption,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { CaptionOverlay, type TranscriptWord } from "../transcript";

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
      video.play().catch((error) => {
        // Autoplay blocked by browser - this is expected behavior
        // User needs to interact with the page first
        if (error instanceof Error && error.name === "NotAllowedError") {
          console.warn("Autoplay blocked by browser - user interaction required");
        } else {
          console.error("Video playback error:", error);
        }
      });
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

  // Expose imperative methods for linked playback (ComparisonViewer)
  useImperativeHandle(
    forwardedRef,
    () => ({
      seekTo: (time: number) => seek(time),
      play: () => {
        const video = videoRef.current;
        if (video) {
          video.play().catch((error) => {
            if (error instanceof Error && error.name === "NotAllowedError") {
              console.warn("Autoplay blocked by browser - user interaction required");
            } else {
              console.error("Video playback error:", error);
            }
          });
        }
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

  // Store transcriptWords in a ref to avoid re-binding keyboard events on every change
  const transcriptWordsRef = useRef(transcriptWords);
  useEffect(() => {
    transcriptWordsRef.current = transcriptWords;
  }, [transcriptWords]);

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
          if (transcriptWordsRef.current.length > 0) {
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
    return parts.join(" \u00B7 ");
  }, [meta, resolutionLabel]);

  if (error) {
    return (
      <div className={`relative w-full h-full flex flex-col bg-black select-none overflow-hidden ${className || ""}`}>
        <div className="flex flex-col items-center justify-center h-full gap-3 text-secondary">
          <AlertCircle className="w-12 h-12 text-red-600" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col bg-black select-none overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999]" : ""} ${className || ""}`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={hlsSrc ? undefined : src}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        preload="metadata"
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 text-secondary text-sm z-10">
          <Loader2 className="w-12 h-12 animate-spin text-accent" />
          <span>Loading video...</span>
        </div>
      )}

      {/* Buffering indicator */}
      {isBuffering && !isLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
        </div>
      )}

      {/* Play/Pause overlay */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 bottom-20 flex items-center justify-center cursor-pointer z-5" onClick={togglePlay}>
          <div className="w-20 h-20 bg-black/60 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-black/80 hover:scale-110">
            <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
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
      <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 z-10 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Top bar */}
        <div className={`${isFullscreen ? "px-8 pt-6 pb-2" : "px-6 pt-4 pb-1"} flex flex-col gap-1`}>
          {name && (
            <h2 className={`text-white font-semibold m-0 max-w-[600px] overflow-hidden text-ellipsis whitespace-nowrap ${isFullscreen ? "text-lg" : "text-base"}`}>
              {name}
            </h2>
          )}
          {metaDataDisplay && <span className="text-secondary text-xs">{metaDataDisplay}</span>}
        </div>

        {/* Timeline / Seekbar */}
        <div className={`${isFullscreen ? "px-8 py-2 pb-3" : "px-6 py-2 pb-3"}`}>
          {/* Filmstrip preview */}
          {hoveredTime !== null && filmstripFrame && filmstripUrl && (
            <div
              className="absolute bottom-full mb-2 bg-black bg-no-repeat rounded overflow-hidden shadow-lg -translate-x-1/2 z-20"
              style={{
                left: `${filmstripPreviewLeft}px`,
                backgroundImage: `url(${filmstripUrl})`,
                backgroundPosition: filmstripFrame.backgroundPosition,
                width: `${filmstrip?.width || 160}px`,
                height: `${filmstrip?.height || 90}px`,
              }}
            >
              <span className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-black/70 text-white text-[10px] text-center">
                {formatTime(hoveredTime)}
              </span>
            </div>
          )}

          {/* Timeline */}
          <div
            ref={timelineRef}
            className="relative w-full h-2 bg-surface-3 rounded cursor-pointer overflow-visible hover:h-2.5 transition-all"
            onMouseMove={handleTimelineHover}
            onMouseLeave={handleTimelineLeave}
            onClick={handleTimelineClick}
          >
            {/* In/Out range indicator */}
            {inPointPercent !== null && outPointPercent !== null && (
              <div
                className="absolute top-0 h-full bg-accent/30 pointer-events-none"
                style={{
                  left: `${inPointPercent}%`,
                  width: `${outPointPercent - inPointPercent}%`,
                }}
              />
            )}

            {/* Progress bar */}
            <div className="absolute top-0 left-0 h-full bg-accent rounded-l pointer-events-none" style={{ width: `${progressPercent}%` }} />

            {/* Buffer indicator */}
            {bufferedPercent > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-surface-2 rounded-l pointer-events-none"
                style={{ width: `${bufferedPercent}%` }}
              />
            )}

            {/* Comment markers */}
            {markerPositions.map((marker) => (
              <div
                key={marker.id}
                className="absolute top-0 w-0.5 h-full cursor-pointer z-5 transition-colors duration-150 before:content-[''] before:absolute before:top-[-4px] before:left-[-2px] before:w-[7px] before:h-[7px] before:rounded-full"
                style={{ left: marker.left, backgroundColor: marker.color || "#fbbf24" }}
                onClick={(e) => handleCommentClick(marker, e)}
                title={`Comment at ${formatTime(marker.timestamp)}`}
              />
            ))}

            {/* In point marker */}
            {inPointPercent !== null && (
              <div
                className="absolute -top-2 -translate-x-1/2 w-4 h-6 bg-accent rounded flex items-center justify-center cursor-pointer z-6"
                style={{ left: `${inPointPercent}%` }}
                title="In point (I)"
              >
                <span className="text-white text-[10px] font-bold">I</span>
              </div>
            )}

            {/* Out point marker */}
            {outPointPercent !== null && (
              <div
                className="absolute -top-2 -translate-x-1/2 w-4 h-6 bg-accent rounded flex items-center justify-center cursor-pointer z-6"
                style={{ left: `${outPointPercent}%` }}
                title="Out point (O)"
              >
                <span className="text-white text-[10px] font-bold">O</span>
              </div>
            )}

            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-accent rounded-full pointer-events-none shadow-md transition-transform duration-50"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Time display */}
          <div className="flex justify-between items-center mt-2 text-xs text-white tabular-nums">
            <span>{formatTime(currentTime)}</span>
            {inPoint !== null && outPoint !== null && (
              <span className="text-accent text-[11px]">
                [{formatTime(inPoint)} - {formatTime(outPoint)}]
              </span>
            )}
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control bar */}
        <div className={`${isFullscreen ? "px-8 py-3 pb-6" : "px-6 py-2 pb-4"} bg-black/30`}>
          <div className="flex items-center justify-center gap-3 flex-wrap max-md:gap-2">
            {/* Main playback controls */}
            <div className="flex items-center gap-1.5">
              {/* Skip back */}
              <button
                className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
                onClick={() => seekRelative(-10)}
                title="Skip back 10s"
                aria-label="Skip back 10 seconds"
              >
                <SkipBack className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
              </button>

              {/* Frame back */}
              <button
                className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
                onClick={() => frameStep("backward")}
                title="Previous frame"
                aria-label="Previous frame"
              >
                <StepBack className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
              </button>

              {/* Play/Pause */}
              <button
                className="flex items-center justify-center w-11 h-11 bg-accent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-blue-600 active:scale-95 max-md:w-10 max-md:h-10"
                onClick={togglePlay}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 max-md:w-5 max-md:h-5" fill="currentColor" />
                ) : (
                  <Play className="w-6 h-6 max-md:w-5 max-md:h-5" fill="currentColor" />
                )}
              </button>

              {/* Frame forward */}
              <button
                className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
                onClick={() => frameStep("forward")}
                title="Next frame"
                aria-label="Next frame"
              >
                <StepForward className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
              </button>

              {/* Skip forward */}
              <button
                className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
                onClick={() => seekRelative(10)}
                title="Skip forward 10s"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
              </button>
            </div>

            <div className="w-px h-6 bg-border-default max-md:hidden" />

            {/* Volume control */}
            <div className="flex items-center gap-2 min-w-[100px] max-md:min-w-[80px]">
              <button
                className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
                onClick={toggleMute}
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
                ) : (
                  <Volume2 className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
                )}
              </button>
              <input
                type="range"
                className="w-15 h-1 bg-surface-3 rounded appearance-none cursor-pointer max-md:w-12.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume"
              />
            </div>

            <div className="w-px h-6 bg-border-default max-md:hidden" />

            {/* Speed control */}
            <div className="flex items-center">
              <select
                className="px-3 py-1.5 bg-transparent border border-border-default rounded text-white text-xs cursor-pointer appearance-none min-w-[60px] hover:border-text-secondary focus:outline-none focus:border-accent"
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

            <div className="w-px h-6 bg-border-default max-md:hidden" />

            {/* Resolution control */}
            {resolutions.length > 0 && (
              <>
                <div className="flex items-center">
                  <select
                    className="px-3 py-1.5 bg-transparent border border-border-default rounded text-white text-xs cursor-pointer appearance-none min-w-[70px] hover:border-text-secondary focus:outline-none focus:border-accent"
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
                <div className="w-px h-6 bg-border-default max-md:hidden" />
              </>
            )}

            {/* In/Out point controls */}
            <div className="flex items-center gap-1">
              <button
                className={`flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8 ${inPoint !== null ? "bg-accent/30 text-accent" : ""}`}
                onClick={setInPointAtCurrentTime}
                title="Set in point (I)"
                aria-label="Set in point"
              >
                <span className="text-xs font-bold">I</span>
              </button>
              <button
                className={`flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8 ${outPoint !== null ? "bg-accent/30 text-accent" : ""}`}
                onClick={setOutPointAtCurrentTime}
                title="Set out point (O)"
                aria-label="Set out point"
              >
                <span className="text-xs font-bold">O</span>
              </button>
              {(inPoint !== null || outPoint !== null) && (
                <button
                  className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
                  onClick={clearInOutPoints}
                  title="Clear in/out points (Esc)"
                  aria-label="Clear in/out points"
                >
                  <X className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
                </button>
              )}
            </div>

            <div className="w-px h-6 bg-border-default max-md:hidden" />

            {/* Caption toggle */}
            {transcriptWords.length > 0 && (
              <>
                <button
                  className={`flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8 ${captionsEnabled ? "bg-accent/30 text-accent" : ""}`}
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                  title={captionsEnabled ? "Hide captions (C)" : "Show captions (C)"}
                  aria-label={captionsEnabled ? "Hide captions" : "Show captions"}
                  aria-pressed={captionsEnabled}
                >
                  <ClosedCaption className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
                </button>
                <div className="w-px h-6 bg-border-default max-md:hidden" />
              </>
            )}

            {/* Fullscreen */}
            <button
              className="flex items-center justify-center w-9 h-9 bg-transparent border-none rounded-full text-white cursor-pointer transition-all duration-150 hover:bg-white/10 active:scale-95 max-md:w-8 max-md:h-8"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
              ) : (
                <Maximize2 className="w-5 h-5 max-md:w-4.5 max-md:h-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="absolute bottom-2 right-4 text-[10px] text-secondary/50 opacity-0 transition-opacity duration-300 hover-parent:opacity-100 max-md:hidden">
        Space/K: play/pause | J/L: shuttle | Arrow keys: frame | M: mute | C: captions | F: fullscreen | I/O: in/out points
      </div>
    </div>
  );
});

export default VideoViewer;
