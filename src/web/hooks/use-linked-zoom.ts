/**
 * Bush Platform - Linked Zoom Hook
 *
 * Synchronizes zoom and pan between two ImageViewer components.
 * Used by ComparisonViewer for side-by-side image comparison.
 *
 * Reference: specs/00-atomic-features.md Section 9.7 Comparison Viewer
 */
"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { ImageViewerHandle } from "@/web/components/viewers/image-viewer";

export interface LinkedZoomOptions {
  /** Whether sync is enabled (default: true) */
  enabled?: boolean;
}

export interface LinkedZoomControl {
  /** Ref for the primary (master) image viewer */
  primaryRef: React.RefObject<ImageViewerHandle | null>;
  /** Ref for the secondary (slave) image viewer */
  secondaryRef: React.RefObject<ImageViewerHandle | null>;
  /** Whether zoom/pan is currently synced */
  isSynced: boolean;
  /** Toggle synced mode */
  toggleSync: () => void;
  /** Set synced mode */
  setSynced: (synced: boolean) => void;
  /** Sync secondary to primary's zoom and pan */
  syncToPrimary: () => void;
  /** Set zoom on both viewers */
  setZoomBoth: (level: number) => void;
  /** Set pan on both viewers */
  setPanBoth: (x: number, y: number) => void;
  /** Zoom both to fit */
  zoomBothToFit: () => void;
  /** Zoom both to 1:1 */
  zoomBothTo1to1: () => void;
}

/**
 * Hook for synchronized image zoom and pan.
 *
 * @example
 * ```tsx
 * const linkedZoom = useLinkedZoom();
 *
 * <ImageViewer ref={linkedZoom.primaryRef} src={image1} alt="Image 1" />
 * <ImageViewer ref={linkedZoom.secondaryRef} src={image2} alt="Image 2" />
 * <button onClick={linkedZoom.toggleSync}>
 *   {linkedZoom.isSynced ? 'Unsync' : 'Sync'}
 * </button>
 * ```
 */
export function useLinkedZoom(options: LinkedZoomOptions = {}): LinkedZoomControl {
  const { enabled = true } = options;

  const primaryRef = useRef<ImageViewerHandle | null>(null);
  const secondaryRef = useRef<ImageViewerHandle | null>(null);
  const [isSynced, setIsSynced] = useState(enabled);

  // Track previous values to detect changes
  const prevZoomRef = useRef<number | null>(null);
  const prevPanRef = useRef<{ x: number; y: number } | null>(null);

  // Track timeout IDs for cleanup
  const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }
    };
  }, []);

  // Sync secondary to primary's zoom and pan
  const syncToPrimary = useCallback(() => {
    if (!isSynced || !primaryRef.current || !secondaryRef.current) {
      return;
    }

    const primaryZoom = primaryRef.current.getZoom();
    const primaryPan = primaryRef.current.getPan();

    secondaryRef.current.setZoom(primaryZoom);
    secondaryRef.current.setPan(primaryPan.x, primaryPan.y);
  }, [isSynced]);

  // Set zoom on both viewers
  const setZoomBoth = useCallback(
    (level: number) => {
      if (!isSynced) {
        primaryRef.current?.setZoom(level);
        secondaryRef.current?.setZoom(level);
        return;
      }

      primaryRef.current?.setZoom(level);
      secondaryRef.current?.setZoom(level);
    },
    [isSynced]
  );

  // Set pan on both viewers
  const setPanBoth = useCallback(
    (x: number, y: number) => {
      if (!isSynced) {
        primaryRef.current?.setPan(x, y);
        secondaryRef.current?.setPan(x, y);
        return;
      }

      primaryRef.current?.setPan(x, y);
      secondaryRef.current?.setPan(x, y);
    },
    [isSynced]
  );

  // Zoom both to fit
  const zoomBothToFit = useCallback(() => {
    primaryRef.current?.zoomToFit();
    if (isSynced) {
      // Clear any pending timeout before setting new one
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }
      // Delay sync to allow fit calculation
      fitTimeoutRef.current = setTimeout(() => {
        if (primaryRef.current && secondaryRef.current) {
          secondaryRef.current.zoomToFit();
        }
      }, 50);
    }
  }, [isSynced]);

  // Zoom both to 1:1
  const zoomBothTo1to1 = useCallback(() => {
    primaryRef.current?.zoomTo1to1();
    if (isSynced) {
      secondaryRef.current?.zoomTo1to1();
    }
  }, [isSynced]);

  // Toggle synced mode
  const toggleSync = useCallback(() => {
    setIsSynced((prev) => !prev);
  }, []);

  // Set synced mode
  const setSynced = useCallback((synced: boolean) => {
    setIsSynced(synced);
  }, []);

  // Monitor primary viewer for changes and sync to secondary
  useEffect(() => {
    if (!isSynced) {
      prevZoomRef.current = null;
      prevPanRef.current = null;
      return;
    }

    const checkAndSync = () => {
      if (!primaryRef.current || !secondaryRef.current) {
        return;
      }

      const currentZoom = primaryRef.current.getZoom();
      const currentPan = primaryRef.current.getPan();

      // Check if zoom changed
      if (prevZoomRef.current !== null && Math.abs(currentZoom - prevZoomRef.current) > 0.001) {
        secondaryRef.current.setZoom(currentZoom);
      }
      prevZoomRef.current = currentZoom;

      // Check if pan changed
      if (
        prevPanRef.current !== null &&
        (Math.abs(currentPan.x - prevPanRef.current.x) > 1 ||
          Math.abs(currentPan.y - prevPanRef.current.y) > 1)
      ) {
        secondaryRef.current.setPan(currentPan.x, currentPan.y);
      }
      prevPanRef.current = currentPan;
    };

    // Poll for changes (simple approach - could be improved with callbacks from ImageViewer)
    const interval = setInterval(checkAndSync, 100);

    return () => clearInterval(interval);
  }, [isSynced]);

  return {
    primaryRef,
    secondaryRef,
    isSynced,
    toggleSync,
    setSynced,
    syncToPrimary,
    setZoomBoth,
    setPanBoth,
    zoomBothToFit,
    zoomBothTo1to1,
  };
}

export default useLinkedZoom;
