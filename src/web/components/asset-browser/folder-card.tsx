/**
 * Bush Platform - Folder Card Component
 *
 * Card component for displaying a folder in grid view.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */
"use client";

import { useCallback } from "react";
import { Folder } from "lucide-react";
import type { AssetFolder, CardSize } from "./types";
import { CARD_SIZE_DIMENSIONS } from "./types";
import { cn } from "@/web/lib/utils";

interface FolderCardProps {
  folder: AssetFolder;
  cardSize: CardSize;
  onClick?: (folder: AssetFolder) => void;
}

export function FolderCard({ folder, cardSize, onClick }: FolderCardProps) {
  const dimensions = CARD_SIZE_DIMENSIONS[cardSize];

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onClick?.(folder);
      }
    },
    [folder, onClick]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(folder);
      }
    },
    [folder, onClick]
  );

  return (
    <div
      className={cn(
        "flex flex-col bg-surface-2 border-2 border-transparent rounded-lg",
        "cursor-pointer overflow-hidden",
        "transition-all duration-100",
        "hover:bg-surface-3 hover:border-border-default",
        "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      )}
      style={{ width: dimensions.width }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Open folder ${folder.name}`}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center bg-amber-500/10"
        style={{ height: dimensions.thumbnailHeight }}
      >
        <Folder
          size={48}
          className="text-amber-500/80 transition-transform duration-100 group-hover:opacity-100 group-hover:scale-105"
          strokeWidth={1.5}
        />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3 min-h-0">
        <span
          className="text-[13px] font-medium text-text-primary whitespace-nowrap overflow-hidden text-ellipsis"
          title={folder.name}
        >
          {folder.name}
        </span>
      </div>
    </div>
  );
}
