/**
 * Bush Platform - Linked Playback Hook
 *
 * Synchronizes playback between two VideoViewer components.
 * Used by ComparisonViewer for side-by-side video comparison.
 *
 * Reference: specs/00-atomic-features.md Section 9.7 Comparison Viewer
 */
"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { VideoViewerHandle } from "@/web/components/viewers/video-viewer";

export interface LinkedPlaybackOptions {
  /** Sync tolerance in seconds (default: 0.1) */
  syncTolerance?: number;
  /** Whether sync is enabled (default: true) */
  enabled?: boolean;
}

export interface LinkedPlaybackControl {
  /** Ref for the primary (master) video viewer */
  primaryRef: React.RefObject<VideoViewerHandle | null>;
  /** Ref for the secondary (slave) video viewer */
  secondaryRef: React.RefObject<VideoViewerHandle | null>;
  /** Whether playback is currently synced */
  isSynced: boolean;
  /** Toggle synced mode */
  toggleSync: () => void;
  /** Set synced mode */
  setSynced: (synced: boolean) => void;
  /** Sync secondary to primary's current time */
  syncToPrimary: () => void;
  /** Play both videos */
  playBoth: () => void;
  /** Pause both videos */
  pauseBoth: () => void;
  /** Seek both videos to same time */
  seekBoth: (time: number) => void;
}

/**
 * Hook for synchronized video playback.
 *
 * @example
 * ```tsx
 * const linkedPlayback = useLinkedPlayback();
 *
 * <VideoViewer ref={linkedPlayback.primaryRef} src={video1} />
 * <VideoViewer ref={linkedPlayback.secondaryRef} src={video2} />
 * <button onClick={linkedPlayback.toggleSync}>
 *   {linkedPlayback.isSynced ? 'Unsync' : 'Sync'}
 * </button>
 * ```
 */
export function useLinkedPlayback(
  options: LinkedPlaybackOptions = {}
): LinkedPlaybackControl {
  const { syncTolerance = 0.1, enabled = true } = options;

  const primaryRef = useRef<VideoViewerHandle | null>(null);
  const secondaryRef = useRef<VideoViewerHandle | null>(null);
  const [isSynced, setIsSynced] = useState(enabled);

  // Track if we're currently syncing to prevent loops
  const isSyncingRef = useRef(false);

  // Track timeout IDs for cleanup
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Sync secondary to primary's current time
  const syncToPrimary = useCallback(() => {
    if (!isSynced || !primaryRef.current || !secondaryRef.current || isSyncingRef.current) {
      return;
    }

    const primaryTime = primaryRef.current.getCurrentTime();
    const secondaryTime = secondaryRef.current.getCurrentTime();

    if (Math.abs(primaryTime - secondaryTime) > syncTolerance) {
      isSyncingRef.current = true;
      secondaryRef.current.seekTo(primaryTime);
      // Reset sync flag after a short delay
      syncTimeoutRef.current = setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    }
  }, [isSynced, syncTolerance]);

  // Play both videos
  const playBoth = useCallback(() => {
    if (!isSynced) {
      primaryRef.current?.play();
      secondaryRef.current?.play();
      return;
    }

    // Sync before playing
    syncToPrimary();

    // Start both videos
    primaryRef.current?.play();
    secondaryRef.current?.play();
  }, [isSynced, syncToPrimary]);

  // Pause both videos
  const pauseBoth = useCallback(() => {
    primaryRef.current?.pause();
    secondaryRef.current?.pause();
  }, []);

  // Seek both videos to same time
  const seekBoth = useCallback((time: number) => {
    if (!isSynced) {
      primaryRef.current?.seekTo(time);
      secondaryRef.current?.seekTo(time);
      return;
    }

    isSyncingRef.current = true;
    primaryRef.current?.seekTo(time);
    secondaryRef.current?.seekTo(time);

    // Reset sync flag after a short delay
    syncTimeoutRef.current = setTimeout(() => {
      isSyncingRef.current = false;
    }, 100);
  }, [isSynced]);

  // Toggle synced mode
  const toggleSync = useCallback(() => {
    setIsSynced((prev) => !prev);
  }, []);

  // Set synced mode
  const setSynced = useCallback((synced: boolean) => {
    setIsSynced(synced);
  }, []);

  // Auto-sync on time changes when synced
  useEffect(() => {
    if (!isSynced) return;

    // Track interval timeout for cleanup
    let intervalTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // Periodically check for drift and correct
    const interval = setInterval(() => {
      if (!primaryRef.current || !secondaryRef.current || isSyncingRef.current) {
        return;
      }

      const primaryTime = primaryRef.current.getCurrentTime();
      const secondaryTime = secondaryRef.current.getCurrentTime();
      const primaryPlaying = primaryRef.current.isPlaying();
      const secondaryPlaying = secondaryRef.current.isPlaying();

      // If primary is playing but secondary isn't, start secondary
      if (primaryPlaying && !secondaryPlaying) {
        secondaryRef.current.play();
      }

      // If primary paused but secondary playing, pause secondary
      if (!primaryPlaying && secondaryPlaying) {
        secondaryRef.current.pause();
      }

      // Correct time drift
      if (primaryPlaying && Math.abs(primaryTime - secondaryTime) > syncTolerance) {
        isSyncingRef.current = true;
        secondaryRef.current.seekTo(primaryTime);
        // Clear any pending timeout before setting new one
        if (intervalTimeoutId) {
          clearTimeout(intervalTimeoutId);
        }
        intervalTimeoutId = setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (intervalTimeoutId) {
        clearTimeout(intervalTimeoutId);
      }
    };
  }, [isSynced, syncTolerance]);

  return {
    primaryRef,
    secondaryRef,
    isSynced,
    toggleSync,
    setSynced,
    syncToPrimary,
    playBoth,
    pauseBoth,
    seekBoth,
  };
}

export default useLinkedPlayback;
