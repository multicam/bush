/**
 * Bush Platform - View Controls Component
 *
 * Controls for switching between view modes and card sizes.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */
"use client";

import { Grid3X3, List, Square } from "lucide-react";
import { cn } from "@/web/lib/utils";
import type { ViewMode, CardSize } from "./types";

interface ViewControlsProps {
  viewMode: ViewMode;
  cardSize: CardSize;
  onViewModeChange: (mode: ViewMode) => void;
  onCardSizeChange: (size: CardSize) => void;
}

export function ViewControls({
  viewMode,
  cardSize,
  onViewModeChange,
  onCardSizeChange,
}: ViewControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* View mode toggle */}
      <div className="flex items-center bg-surface-3 rounded-sm p-0.5" role="group" aria-label="View mode">
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-none border-none rounded-[4px] cursor-pointer",
            "text-text-secondary transition-all duration-100",
            "hover:text-text-primary hover:bg-surface-2",
            "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
            viewMode === "grid" && "text-accent bg-surface-2"
          )}
          onClick={() => onViewModeChange("grid")}
          aria-pressed={viewMode === "grid"}
          title="Grid view"
        >
          <Grid3X3 size={16} />
          <span className="text-xs font-medium hidden @sm:inline">Grid</span>
        </button>
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-none border-none rounded-[4px] cursor-pointer",
            "text-text-secondary transition-all duration-100",
            "hover:text-text-primary hover:bg-surface-2",
            "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
            viewMode === "list" && "text-accent bg-surface-2"
          )}
          onClick={() => onViewModeChange("list")}
          aria-pressed={viewMode === "list"}
          title="List view"
        >
          <List size={16} />
          <span className="text-xs font-medium hidden @sm:inline">List</span>
        </button>
      </div>

      {/* Card size toggle (only in grid mode) */}
      {viewMode === "grid" && (
        <div className="flex items-center bg-surface-3 rounded-sm p-0.5" role="group" aria-label="Card size">
          <button
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-none border-none rounded-[4px] cursor-pointer",
              "text-text-secondary transition-all duration-100",
              "hover:text-text-primary hover:bg-surface-2",
              "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
              cardSize === "small" && "text-accent bg-surface-2"
            )}
            onClick={() => onCardSizeChange("small")}
            aria-pressed={cardSize === "small"}
            title="Small cards"
          >
            <Square size={12} fill="currentColor" />
            <span className="text-xs font-medium">S</span>
          </button>
          <button
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-none border-none rounded-[4px] cursor-pointer",
              "text-text-secondary transition-all duration-100",
              "hover:text-text-primary hover:bg-surface-2",
              "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
              cardSize === "medium" && "text-accent bg-surface-2"
            )}
            onClick={() => onCardSizeChange("medium")}
            aria-pressed={cardSize === "medium"}
            title="Medium cards"
          >
            <Square size={14} fill="currentColor" />
            <span className="text-xs font-medium">M</span>
          </button>
          <button
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-none border-none rounded-[4px] cursor-pointer",
              "text-text-secondary transition-all duration-100",
              "hover:text-text-primary hover:bg-surface-2",
              "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
              cardSize === "large" && "text-accent bg-surface-2"
            )}
            onClick={() => onCardSizeChange("large")}
            aria-pressed={cardSize === "large"}
            title="Large cards"
          >
            <Square size={16} fill="currentColor" />
            <span className="text-xs font-medium">L</span>
          </button>
        </div>
      )}
    </div>
  );
}
