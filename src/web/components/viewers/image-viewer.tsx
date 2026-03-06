/**
 * Bush Platform - Image Viewer Component
 *
 * Full-featured image viewer with zoom, pan, and mini-map navigation.
 * Reference: specs/00-product-reference.md Section 9.4
 *
 * Note: This component uses setState in effects to initialize zoom level
 * when the image and container dimensions become available. This is a
 * legitimate pattern for synchronization with external state (image load,
 * container resize) but triggers a strict ESLint rule.
 */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { MinusIcon, PlusIcon, SpinnerIcon } from "@/web/lib/icons";

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

/**
 * Imperative methods exposed by ImageViewer for linked zoom/pan.
 * Used by ComparisonViewer to synchronize zoom between two images.
 */
export interface ImageViewerHandle {
  /** Set zoom level (0.25 to 4) */
  setZoom: (level: number) => void;
  /** Get current zoom level */
  getZoom: () => number;
  /** Set pan offset */
  setPan: (x: number, y: number) => void;
  /** Get current pan offset */
  getPan: () => { x: number; y: number };
  /** Zoom to fit container */
  zoomToFit: () => void;
  /** Zoom to 1:1 pixel view */
  zoomTo1to1: () => void;
  /** Check if image is loaded */
  isLoaded: () => boolean;
}

export const ImageViewer = forwardRef<ImageViewerHandle, ImageViewerProps>(function ImageViewer(
  {
    src,
    alt,
    initialZoom = "fit",
    maxZoom = 4,
    minZoom = 0.25,
    showMiniMap = "auto",
    onZoomChange,
    className,
  }: ImageViewerProps,
  forwardedRef: React.ForwardedRef<ImageViewerHandle>
) {
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

  // Expose imperative methods for linked zoom/pan (ComparisonViewer)
  const setZoomExternal = useCallback(
    (level: number) => {
      const clampedLevel = Math.max(minZoom, Math.min(maxZoom, level));
      setZoomLevel(clampedLevel);
      onZoomChange?.(clampedLevel);
    },
    [minZoom, maxZoom, onZoomChange]
  );

  const setPanExternal = useCallback((x: number, y: number) => {
    setPanOffset({ x, y });
  }, []);

  // Mini-map visibility
  const shouldShowMiniMap = useMemo(
    () =>
      showMiniMap === true ||
      (showMiniMap === "auto" &&
        imageSize.loaded &&
        (imageSize.width > 2000 || imageSize.height > 2000)),
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

  // Expose imperative methods for linked zoom/pan (ComparisonViewer)
  useImperativeHandle(
    forwardedRef,
    () => ({
      setZoom: setZoomExternal,
      getZoom: () => zoomLevel,
      setPan: setPanExternal,
      getPan: () => panOffset,
      zoomToFit,
      zoomTo1to1,
      isLoaded: () => imageSize.loaded,
    }),
    [setZoomExternal, zoomLevel, setPanExternal, panOffset, zoomToFit, zoomTo1to1, imageSize.loaded]
  );

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
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    },
    [panOffset]
  );

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
  const handleMiniMapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
    },
    [imageSize, zoomLevel]
  );

  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#1a1a1a] ${isPanning ? "cursor-grabbing" : "cursor-grab"} select-none ${className || ""}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {!imageSize.loaded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 text-muted text-sm">
          <SpinnerIcon className="w-8 h-8" />
          <span>Loading image...</span>
        </div>
      )}

      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none max-h-none transition-opacity duration-200 pointer-events-none"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          opacity: imageSize.loaded ? 1 : 0,
        }}
        onLoad={handleImageLoad}
        draggable={false}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-2 bg-black/80 rounded-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={zoomLevel <= minZoom}
            className="flex items-center justify-center w-7 h-7 bg-transparent border border-[#444] rounded-sm text-white text-lg cursor-pointer transition-colors hover:bg-[#333] hover:border-[#666] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom out (-)"
            aria-label="Zoom out"
          >
            <MinusIcon className="w-4 h-4" />
          </button>
          <span className="min-w-[48px] text-center text-white text-[13px] font-medium">
            {zoomPercent}%
          </span>
          <button
            onClick={zoomIn}
            disabled={zoomLevel >= maxZoom}
            className="flex items-center justify-center w-7 h-7 bg-transparent border border-[#444] rounded-sm text-white text-lg cursor-pointer transition-colors hover:bg-[#333] hover:border-[#666] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 ml-2 pl-2 border-l border-[#444]">
          <button
            onClick={zoomToFit}
            className="px-2.5 py-1 bg-transparent border border-[#444] rounded-sm text-[#ccc] text-xs cursor-pointer transition-colors hover:bg-[#333] hover:border-[#666] hover:text-white"
            title="Fit to screen (0)"
            aria-label="Fit to screen"
          >
            Fit
          </button>
          <button
            onClick={zoomTo1to1}
            className="px-2.5 py-1 bg-transparent border border-[#444] rounded-sm text-[#ccc] text-xs cursor-pointer transition-colors hover:bg-[#333] hover:border-[#666] hover:text-white"
            title="1:1 pixel view (1)"
            aria-label="1:1 pixel view"
          >
            1:1
          </button>
        </div>
      </div>

      {shouldShowMiniMap && imageSize.loaded && containerSize.width > 0 && (
        <div
          className="absolute bottom-20 right-4 w-[120px] h-20 bg-black/80 border border-[#444] rounded-sm overflow-hidden cursor-pointer"
          onClick={handleMiniMapClick}
        >
          <img
            src={src}
            alt="Mini-map navigation"
            className="w-full h-full object-contain opacity-70"
          />
          <div
            className="absolute border-2 border-white bg-white/10 pointer-events-none"
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
});

export default ImageViewer;
