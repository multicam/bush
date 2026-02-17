/**
 * Bush Platform - Image Viewer Component
 *
 * Full-featured image viewer with zoom, pan, and mini-map navigation.
 * Reference: specs/00-atomic-features.md Section 9.4
 *
 * Note: This component uses setState in effects to initialize zoom level
 * when the image and container dimensions become available. This is a
 * legitimate pattern for synchronization with external state (image load,
 * container resize) but triggers a strict ESLint rule.
 */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import styles from "./image-viewer.module.css";

export interface ImageViewerProps {
  /** Image URL to display */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Initial zoom level (default: fit) */
  initialZoom?: "fit" | "1:1" | number;
  /** Maximum zoom level (default: 4 = 400%) */
  maxZoom?: number;
  /** Minimum zoom level (default: 0.25 = 25%) */
  minZoom?: number;
  /** Show mini-map for large images (default: auto - shows for images > 2000px) */
  showMiniMap?: boolean | "auto";
  /** Callback when zoom level changes */
  onZoomChange?: (zoom: number) => void;
  /** Additional CSS class */
  className?: string;
}

/** Get default zoom level based on initialZoom setting and available dimensions */
function getDefaultZoom(
  initialZoom: "fit" | "1:1" | number,
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): number {
  if (initialZoom === "fit" && containerWidth > 0 && imageWidth > 0) {
    const padding = 40;
    const scaleX = (containerWidth - padding * 2) / imageWidth;
    const scaleY = (containerHeight - padding * 2) / imageHeight;
    return Math.min(scaleX, scaleY, 1);
  } else if (initialZoom === "1:1") {
    return 1;
  } else if (typeof initialZoom === "number") {
    return initialZoom;
  }
  return 1;
}

export function ImageViewer({
  src,
  alt,
  initialZoom = "fit",
  maxZoom = 4,
  minZoom = 0.25,
  showMiniMap = "auto",
  onZoomChange,
  className,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const prevFitZoomRef = useRef<number | null>(null);

  // Track natural image dimensions
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, loaded: false });

  // Track container dimensions for mini-map viewport calculation
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Track if initialized
  const [isZoomInitialized, setIsZoomInitialized] = useState(false);

  // Mini-map visibility
  const shouldShowMiniMap = useMemo(() =>
    showMiniMap === true ||
    (showMiniMap === "auto" && imageSize.loaded && (imageSize.width > 2000 || imageSize.height > 2000)),
    [showMiniMap, imageSize]
  );

  // Calculate fit-to-screen zoom level
  const fitZoom = useMemo(() => {
    if (!containerSize.width || !imageSize.loaded) return 1;

    const padding = 40;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    const scaleX = availableWidth / imageSize.width;
    const scaleY = availableHeight / imageSize.height;

    return Math.min(scaleX, scaleY, 1);
  }, [containerSize, imageSize]);

  // Handle image load
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({
      width: img.naturalWidth,
      height: img.naturalHeight,
      loaded: true,
    });
  }, []);

  // Update container size on resize
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateContainerSize();

    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Initialize zoom when ready
  useEffect(() => {
    if (!isZoomInitialized && imageSize.loaded && containerSize.width > 0) {
      const defaultZoom = getDefaultZoom(
        initialZoom,
        containerSize.width,
        containerSize.height,
        imageSize.width,
        imageSize.height
      );
      setZoomLevel(defaultZoom);
      setIsZoomInitialized(true);
      prevFitZoomRef.current = defaultZoom;
      onZoomChange?.(defaultZoom);
    }
  }, [isZoomInitialized, imageSize, containerSize, initialZoom, onZoomChange]);

  // Update zoom when fit changes (only if tracking fit zoom)
  useEffect(() => {
    if (!isZoomInitialized || initialZoom !== "fit" || !imageSize.loaded) return;

    // Check if fit zoom actually changed significantly
    if (prevFitZoomRef.current !== null && Math.abs(fitZoom - prevFitZoomRef.current) > 0.001) {
      setZoomLevel(fitZoom);
      prevFitZoomRef.current = fitZoom;
      onZoomChange?.(fitZoom);
    }
  }, [fitZoom, initialZoom, imageSize.loaded, isZoomInitialized, onZoomChange]);

  // Zoom to specific level
  const setZoom = useCallback(
    (newLevel: number, centerX?: number, centerY?: number) => {
      const clampedLevel = Math.max(minZoom, Math.min(maxZoom, newLevel));

      let newX = panOffset.x;
      let newY = panOffset.y;

      if (centerX !== undefined && centerY !== undefined && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerCenterX = containerRect.width / 2;
        const containerCenterY = containerRect.height / 2;

        const offsetX = centerX - containerCenterX;
        const offsetY = centerY - containerCenterY;

        const scale = clampedLevel / zoomLevel;
        newX = panOffset.x - offsetX * (scale - 1);
        newY = panOffset.y - offsetY * (scale - 1);
      }

      setZoomLevel(clampedLevel);
      setPanOffset({ x: newX, y: newY });
      onZoomChange?.(clampedLevel);
    },
    [zoomLevel, panOffset, minZoom, maxZoom, onZoomChange]
  );

  // Zoom controls
  const zoomIn = useCallback(() => setZoom(zoomLevel * 1.25), [setZoom, zoomLevel]);
  const zoomOut = useCallback(() => setZoom(zoomLevel / 1.25), [setZoom, zoomLevel]);
  const zoomToFit = useCallback(() => setZoom(fitZoom), [setZoom, fitZoom]);
  const zoomTo1to1 = useCallback(() => setZoom(1), [setZoom]);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoomLevel * delta, e.clientX, e.clientY);
    },
    [setZoom, zoomLevel]
  );

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }, [panOffset]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "+":
        case "=":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
        case "0":
          zoomToFit();
          break;
        case "1":
          zoomTo1to1();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, zoomToFit, zoomTo1to1]);

  // Mini-map click handler
  const handleMiniMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const ratioX = clickX / rect.width;
    const ratioY = clickY / rect.height;

    if (!containerRef.current || !imageSize.loaded) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    const newX = containerRect.width / 2 - ratioX * imageSize.width * zoomLevel;
    const newY = containerRect.height / 2 - ratioY * imageSize.height * zoomLevel;

    setPanOffset({ x: newX, y: newY });
  }, [imageSize, zoomLevel]);

  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ""} ${isPanning ? styles.panning : ""}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {!imageSize.loaded && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading image...</span>
        </div>
      )}

      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={styles.image}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          opacity: imageSize.loaded ? 1 : 0,
        }}
        onLoad={handleImageLoad}
        draggable={false}
      />

      <div className={styles.controls}>
        <div className={styles.zoomControls}>
          <button
            onClick={zoomOut}
            disabled={zoomLevel <= minZoom}
            className={styles.zoomButton}
            title="Zoom out (-)"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className={styles.zoomLevel}>{zoomPercent}%</span>
          <button
            onClick={zoomIn}
            disabled={zoomLevel >= maxZoom}
            className={styles.zoomButton}
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <div className={styles.viewModes}>
          <button
            onClick={zoomToFit}
            className={styles.viewButton}
            title="Fit to screen (0)"
            aria-label="Fit to screen"
          >
            Fit
          </button>
          <button
            onClick={zoomTo1to1}
            className={styles.viewButton}
            title="1:1 pixel view (1)"
            aria-label="1:1 pixel view"
          >
            1:1
          </button>
        </div>
      </div>

      {shouldShowMiniMap && imageSize.loaded && containerSize.width > 0 && (
        <div className={styles.miniMap} onClick={handleMiniMapClick}>
          <img
            src={src}
            alt="Mini-map navigation"
            className={styles.miniMapImage}
          />
          <div
            className={styles.miniMapViewport}
            style={{
              left: `${Math.max(0, Math.min(100, 50 - (panOffset.x / (imageSize.width * zoomLevel)) * 100))}%`,
              top: `${Math.max(0, Math.min(100, 50 - (panOffset.y / (imageSize.height * zoomLevel)) * 100))}%`,
              width: `${Math.min(100, (containerSize.width / (imageSize.width * zoomLevel)) * 100)}%`,
              height: `${Math.min(100, (containerSize.height / (imageSize.height * zoomLevel)) * 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ImageViewer;
