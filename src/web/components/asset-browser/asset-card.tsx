/**
 * Bush Platform - Asset Card Component
 *
 * Card component for displaying a single asset in grid view.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 * Reference: IMPLEMENTATION_PLAN.md [P2] Metadata Badges
 */
"use client";

import { useCallback } from "react";
import { Badge } from "@/web/components/ui";
import { formatFileSize, getFileIcon, getFileCategory } from "@/shared/file-types";
import type { AssetFile, CardSize } from "./types";
import { CARD_SIZE_DIMENSIONS } from "./types";
import { MetadataBadges } from "./metadata-badges";
import { cn } from "@/web/lib/utils";

interface AssetCardProps {
  file: AssetFile;
  cardSize: CardSize;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onClick?: (file: AssetFile) => void;
}

export function AssetCard({ file, cardSize, isSelected, onSelect, onClick }: AssetCardProps) {
  const dimensions = CARD_SIZE_DIMENSIONS[cardSize];
  const category = getFileCategory(file.mimeType);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection with ctrl/cmd click
        onSelect?.(file.id, !isSelected);
      } else if (e.shiftKey) {
        // Range select with shift click - handled by parent
        e.preventDefault();
      } else {
        // Normal click
        onClick?.(file);
      }
    },
    [file, isSelected, onSelect, onClick]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect?.(file.id, e.target.checked);
    },
    [file.id, onSelect]
  );

  const getStatusBadgeVariant = (): "default" | "success" | "warning" | "error" => {
    switch (file.status) {
      case "ready":
        return "success";
      case "processing":
        return "warning";
      case "uploading":
        return "default";
      case "processing_failed":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <div
      className={cn(
        "group flex flex-col bg-surface-2 border-2 border-transparent rounded-lg",
        "cursor-pointer overflow-hidden",
        "transition-all duration-100",
        "hover:bg-surface-3 hover:border-border-default",
        "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
        isSelected && "border-accent bg-accent/5"
      )}
      style={{ width: dimensions.width }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(file);
        }
      }}
      aria-selected={isSelected}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "relative flex items-center justify-center bg-surface-1 overflow-hidden",
          category === "video" && "bg-violet-500/5",
          category === "audio" && "bg-pink-500/5",
          category === "image" && "bg-emerald-500/5",
          category === "document" && "bg-info/5"
        )}
        style={{ height: dimensions.thumbnailHeight }}
      >
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-[2rem] opacity-50 group-hover:opacity-70 transition-opacity duration-100">
              {getFileIcon(file.mimeType)}
            </span>
          </div>
        )}

        {/* Selection checkbox */}
        <div
          className={cn(
            "absolute top-2 left-2 transition-opacity duration-100",
            "opacity-0 group-hover:opacity-100",
            isSelected && "opacity-100"
          )}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="w-[1.125rem] h-[1.125rem] cursor-pointer accent-accent"
            aria-label={`Select ${file.name}`}
          />
        </div>

        {/* Status badge */}
        {file.status !== "ready" && (
          <div className="absolute top-2 right-2">
            <Badge variant={getStatusBadgeVariant()} size="sm">
              {file.status === "processing_failed" ? "failed" : file.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3 min-h-0">
        <span
          className="text-[13px] font-medium text-text-primary whitespace-nowrap overflow-hidden text-ellipsis"
          title={file.name}
        >
          {file.name}
        </span>
        <span className="text-xs text-text-muted">
          {formatFileSize(file.fileSizeBytes)}
        </span>
      </div>

      {/* Metadata badges */}
      <MetadataBadges file={file} cardSize={cardSize} />
    </div>
  );
}
