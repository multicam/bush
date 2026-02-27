/**
 * Bush Platform - Skeleton Loading Components
 *
 * Skeleton components for loading states with shimmer animation.
 * Reference: specs/21-design-components.md - Loading States (Skeletons)
 */
"use client";

import React from "react";
import { cn } from "@/web/lib/utils";

/** Base skeleton props */
export interface SkeletonProps {
  /** Additional CSS class */
  className?: string;
  /** Width (CSS value) */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Border radius variant */
  radius?: "none" | "sm" | "md" | "lg" | "full";
  /** Enable shimmer animation */
  shimmer?: boolean;
}

const radiusClasses = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

/**
 * Base Skeleton Component
 *
 * A rectangular placeholder with shimmer animation for loading states.
 */
export function Skeleton({
  className,
  width,
  height,
  radius = "md",
  shimmer = true,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        "bg-surface-3",
        radiusClasses[radius],
        shimmer && "animate-shimmer bg-[length:200%_100%]",
        className
      )}
      style={style}
      role="presentation"
      aria-hidden="true"
    />
  );
}

/** Text skeleton props */
export interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Line height in pixels */
  lineHeight?: number;
  /** Gap between lines */
  gap?: number;
  /** Last line width percentage (0-100) */
  lastLineWidth?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Text Component
 *
 * Displays placeholder text lines with shimmer animation.
 */
export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = 60,
  className,
}: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col", className)} style={{ gap: `${gap}px` }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          radius="sm"
          width={
            index === lines - 1 && lastLineWidth < 100
              ? `${lastLineWidth}%`
              : "100%"
          }
        />
      ))}
    </div>
  );
}

/** Avatar skeleton props */
export interface SkeletonAvatarProps {
  /** Avatar size */
  size?: "sm" | "md" | "lg" | "xl";
  /** Additional CSS class */
  className?: string;
}

const avatarSizes = {
  sm: 28,
  md: 36,
  lg: 44,
  xl: 56,
};

/**
 * Skeleton Avatar Component
 *
 * Displays a placeholder avatar with shimmer animation.
 */
export function SkeletonAvatar({ size = "md", className }: SkeletonAvatarProps) {
  const dimension = avatarSizes[size];
  return (
    <Skeleton
      width={dimension}
      height={dimension}
      radius="md"
      className={className}
    />
  );
}

/** Card skeleton props */
export interface SkeletonCardProps {
  /** Card width */
  width?: number | string;
  /** Card height */
  height?: number | string;
  /** Show image placeholder */
  showImage?: boolean;
  /** Image height ratio (percentage of card height) */
  imageRatio?: number;
  /** Show title placeholder */
  showTitle?: boolean;
  /** Show description placeholder */
  showDescription?: boolean;
  /** Description lines */
  descriptionLines?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Card Component
 *
 * Displays a placeholder card with optional image, title, and description.
 */
export function SkeletonCard({
  width = 220,
  height,
  showImage = true,
  imageRatio = 60,
  showTitle = true,
  showDescription = false,
  descriptionLines = 2,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={cn("flex flex-col bg-surface-2 rounded-md overflow-hidden", className)}
      style={{ width: typeof width === "number" ? `${width}px` : width, height: typeof height === "number" ? `${height}px` : height }}
    >
      {showImage && (
        <Skeleton
          className="flex-shrink-0"
          height={`${imageRatio}%`}
          radius="none"
        />
      )}
      <div className="flex flex-col gap-2 p-3">
        {showTitle && <Skeleton height={14} width="70%" radius="sm" />}
        {showDescription && (
          <SkeletonText lines={descriptionLines} lineHeight={12} gap={4} lastLineWidth={50} />
        )}
      </div>
    </div>
  );
}

/** Asset card skeleton props */
export interface SkeletonAssetCardProps {
  /** Card width */
  width?: number;
  /** Thumbnail aspect ratio (width/height) */
  aspectRatio?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Asset Card Component
 *
 * Displays a placeholder asset card with thumbnail, filename, and metadata.
 * Matches the layout of asset-card.tsx
 */
export function SkeletonAssetCard({
  width = 220,
  aspectRatio = 1.5,
  className,
}: SkeletonAssetCardProps) {
  const thumbnailHeight = width / aspectRatio;

  return (
    <div
      className={cn(
        "flex flex-col bg-surface-2 rounded-md border border-border-default overflow-hidden",
        "transition-opacity",
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Thumbnail */}
      <Skeleton
        width="100%"
        height={thumbnailHeight}
        radius="none"
      />

      {/* Content */}
      <div className="flex flex-col gap-2 p-3">
        {/* Filename */}
        <Skeleton height={14} width="85%" radius="sm" />

        {/* Metadata row */}
        <div className="flex items-center gap-2">
          <Skeleton height={12} width={40} radius="sm" />
          <Skeleton height={12} width={60} radius="sm" />
        </div>
      </div>
    </div>
  );
}

/** Table row skeleton props */
export interface SkeletonTableRowProps {
  /** Number of columns */
  columns?: number;
  /** Column widths (percentages) */
  columnWidths?: number[];
  /** Row height */
  height?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Table Row Component
 *
 * Displays a placeholder table row with shimmer animation.
 */
export function SkeletonTableRow({
  columns = 4,
  columnWidths,
  height = 40,
  className,
}: SkeletonTableRowProps) {
  const widths = columnWidths || Array(columns).fill(100 / columns);

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4",
        "border-b border-border-default",
        className
      )}
      style={{ height: `${height}px` }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton
          key={index}
          height={14}
          width={`${widths[index % widths.length]}%`}
          radius="sm"
        />
      ))}
    </div>
  );
}

/** Comment skeleton props */
export interface SkeletonCommentProps {
  /** Show reply indicator */
  isReply?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Comment Component
 *
 * Displays a placeholder comment with avatar, name, and text.
 * Matches the layout of comment components.
 */
export function SkeletonComment({ isReply = false, className }: SkeletonCommentProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        isReply && "ml-10",
        className
      )}
    >
      {/* Avatar */}
      <SkeletonAvatar size="md" className="flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Skeleton height={14} width={80} radius="sm" />
          <Skeleton height={12} width={50} radius="sm" />
        </div>

        {/* Text */}
        <SkeletonText lines={2} lineHeight={14} gap={4} lastLineWidth={70} />
      </div>
    </div>
  );
}

/** Grid skeleton props */
export interface SkeletonGridProps {
  /** Number of items */
  count?: number;
  /** Card width */
  cardWidth?: number;
  /** Gap between cards */
  gap?: number;
  /** Show as asset cards */
  assetCards?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Grid Component
 *
 * Displays a grid of placeholder cards for the asset browser.
 */
export function SkeletonGrid({
  count = 12,
  cardWidth = 220,
  gap = 16,
  assetCards = true,
  className,
}: SkeletonGridProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        assetCards ? (
          <SkeletonAssetCard key={index} width={cardWidth} />
        ) : (
          <SkeletonCard key={index} width={cardWidth} />
        )
      ))}
    </div>
  );
}

/** Table skeleton props */
export interface SkeletonTableProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Column widths (percentages) */
  columnWidths?: number[];
  /** Show header */
  showHeader?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Table Component
 *
 * Displays a placeholder table with header and rows.
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  columnWidths,
  showHeader = true,
  className,
}: SkeletonTableProps) {
  const widths = columnWidths || Array(columns).fill(100 / columns);

  return (
    <div className={cn("flex flex-col border border-border-default rounded-md overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-4 px-4 py-3 bg-surface-3 border-b border-border-default">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton
              key={index}
              height={11}
              width={`${widths[index % widths.length]}%`}
              radius="sm"
            />
          ))}
        </div>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonTableRow
          key={index}
          columns={columns}
          columnWidths={columnWidths}
        />
      ))}
    </div>
  );
}

/** Comment list skeleton props */
export interface SkeletonCommentListProps {
  /** Number of comments */
  count?: number;
  /** Number of replies per comment */
  repliesPerComment?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Skeleton Comment List Component
 *
 * Displays a placeholder comment list with optional replies.
 */
export function SkeletonCommentList({
  count = 3,
  repliesPerComment = 0,
  className,
}: SkeletonCommentListProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {Array.from({ length: count }).map((_, commentIndex) => (
        <div key={commentIndex} className="flex flex-col gap-4">
          <SkeletonComment />
          {repliesPerComment > 0 && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: repliesPerComment }).map((_, replyIndex) => (
                <SkeletonComment key={replyIndex} isReply />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
