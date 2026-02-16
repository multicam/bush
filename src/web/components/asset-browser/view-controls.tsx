/**
 * Bush Platform - View Controls Component
 *
 * Controls for switching between view modes and card sizes.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */
"use client";

import type { ViewMode, CardSize } from "./types";
import styles from "./view-controls.module.css";

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
    <div className={styles.container}>
      {/* View mode toggle */}
      <div className={styles.group} role="group" aria-label="View mode">
        <button
          className={`${styles.button} ${viewMode === "grid" ? styles.active : ""}`}
          onClick={() => onViewModeChange("grid")}
          aria-pressed={viewMode === "grid"}
          title="Grid view"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className={styles.buttonLabel}>Grid</span>
        </button>
        <button
          className={`${styles.button} ${viewMode === "list" ? styles.active : ""}`}
          onClick={() => onViewModeChange("list")}
          aria-pressed={viewMode === "list"}
          title="List view"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span className={styles.buttonLabel}>List</span>
        </button>
      </div>

      {/* Card size toggle (only in grid mode) */}
      {viewMode === "grid" && (
        <div className={styles.group} role="group" aria-label="Card size">
          <button
            className={`${styles.button} ${cardSize === "small" ? styles.active : ""}`}
            onClick={() => onCardSizeChange("small")}
            aria-pressed={cardSize === "small"}
            title="Small cards"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            <span className={styles.buttonLabel}>S</span>
          </button>
          <button
            className={`${styles.button} ${cardSize === "medium" ? styles.active : ""}`}
            onClick={() => onCardSizeChange("medium")}
            aria-pressed={cardSize === "medium"}
            title="Medium cards"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            <span className={styles.buttonLabel}>M</span>
          </button>
          <button
            className={`${styles.button} ${cardSize === "large" ? styles.active : ""}`}
            onClick={() => onCardSizeChange("large")}
            aria-pressed={cardSize === "large"}
            title="Large cards"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            <span className={styles.buttonLabel}>L</span>
          </button>
        </div>
      )}
    </div>
  );
}
