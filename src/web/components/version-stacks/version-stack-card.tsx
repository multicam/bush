/**
 * Bush Platform - Version Stack Card Component
 *
 * Card component for displaying a version stack in the asset browser.
 * Shows stacked thumbnail effect with version count.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 [P1] Version Stack UI
 */
"use client";

import { useCallback } from "react";
import { Badge } from "@/web/components/ui";
import { getFileCategory, getFileIcon } from "@/shared/file-types";
import { Square2StackIcon } from "@/web/lib/icons";
import type { VersionStackCardProps } from "./types";

const CARD_SIZE_DIMENSIONS = {
  small: { width: 160, height: 160, thumbnailHeight: 100 },
  medium: { width: 220, height: 200, thumbnailHeight: 140 },
  large: { width: 300, height: 260, thumbnailHeight: 180 },
};

export function VersionStackCard({
  stack,
  cardSize = "medium",
  isSelected,
  onClick,
  onSelect,
}: VersionStackCardProps) {
  const dimensions = CARD_SIZE_DIMENSIONS[cardSize];
  const currentFile = stack.currentFile || stack.files[0];
  const category = currentFile ? getFileCategory(currentFile.mimeType) : "document";
  const versionCount = stack.files.length;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        onSelect?.(stack.id, !isSelected);
      } else {
        onClick?.(stack);
      }
    },
    [stack, isSelected, onSelect, onClick]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect?.(stack.id, e.target.checked);
    },
    [stack.id, onSelect]
  );

  // Get thumbnails for stack effect (up to 3) - used for potential future enhancements
  const _stackThumbnails = stack.files
    .filter((f) => f.thumbnailUrl)
    .slice(0, 3)
    .map((f) => f.thumbnailUrl);

  // Category-based background colors
  const categoryBgClasses: Record<string, string> = {
    video: "bg-amber-100",
    audio: "bg-blue-100",
    image: "bg-pink-100",
    document: "bg-indigo-100",
  };

  return (
    <div
      className={`
        relative flex flex-col rounded-md border bg-surface-1 cursor-pointer transition-all overflow-hidden
        ${
          isSelected
            ? "border-accent bg-blue-50"
            : "border-border-default hover:border-accent hover:shadow-lg"
        }
        focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
      `}
      style={{ width: dimensions.width }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(stack);
        }
      }}
      aria-selected={isSelected}
      aria-label={`Version stack: ${stack.name}, ${versionCount} versions`}
    >
      {/* Thumbnail with stack effect */}
      <div
        className={`
          relative w-full overflow-hidden flex items-center justify-center bg-surface-2
          ${categoryBgClasses[category] || ""}
        `}
        style={{ height: dimensions.thumbnailHeight }}
      >
        {/* Stacked background cards (visual effect) */}
        {versionCount > 1 && (
          <>
            <div
              className="absolute bg-surface-1 rounded-sm border border-border-default z-[1]"
              style={{ bottom: 12, left: 8, right: 8, height: "calc(100% - 16px)" }}
            />
            <div
              className="absolute bg-surface-1 rounded-sm border border-border-default z-[2]"
              style={{ bottom: 6, left: 4, right: 4, height: "calc(100% - 8px)" }}
            />
          </>
        )}

        {/* Main thumbnail */}
        {currentFile?.thumbnailUrl ? (
          <img
            src={currentFile.thumbnailUrl}
            alt={stack.name}
            className="relative w-full h-full object-cover z-[3] rounded-sm"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center relative z-[3]">
            <span className="text-3xl">{getFileIcon(currentFile?.mimeType || "")}</span>
          </div>
        )}

        {/* Selection checkbox */}
        <div
          className={`
            absolute top-2 left-2 z-10 bg-surface-1 rounded-sm p-1 transition-opacity
            ${isSelected ? "opacity-100" : "opacity-0"}
            group-hover:opacity-100 [.group:hover_&]:opacity-100
            [.relative:hover_&]:opacity-100
          `}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            aria-label={`Select ${stack.name}`}
            className="w-4 h-4 cursor-pointer"
          />
        </div>

        {/* Version count badge */}
        <div className="absolute bottom-2 right-2 z-10">
          <Badge color="zinc">
            {versionCount} v{versionCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Stack indicator icon */}
        <div
          className="absolute top-2 right-2 z-10 bg-surface-1 rounded-sm p-1 text-secondary"
          title="Version Stack"
        >
          <Square2StackIcon className="w-4 h-4" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-0.5">
        <span className="text-sm font-medium truncate" title={stack.name}>
          {stack.name}
        </span>
        <span className="text-xs text-secondary">
          {versionCount} version{versionCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
