/**
 * Bush Platform - Breadcrumbs Component
 *
 * Breadcrumb navigation for folder hierarchy.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 [P1] Folder Navigation
 */
"use client";

import { useCallback } from "react";
import styles from "./folder-navigation.module.css";

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface BreadcrumbsProps {
  /** Breadcrumb items from root to current */
  items: BreadcrumbItem[];
  /** Called when a breadcrumb is clicked */
  onNavigate?: (folderId: string | null) => void;
  /** Maximum items to show before truncating */
  maxItems?: number;
}

export function Breadcrumbs({
  items,
  onNavigate,
  maxItems = 5,
}: BreadcrumbsProps) {
  const handleClick = useCallback(
    (folderId: string | null) => {
      onNavigate?.(folderId);
    },
    [onNavigate]
  );

  // Determine if we need to truncate
  const shouldTruncate = items.length > maxItems;
  const visibleItems = shouldTruncate
    ? [items[0], ...items.slice(-(maxItems - 1))]
    : items;

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb navigation">
      <ol className={styles.breadcrumbList}>
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const showEllipsis = shouldTruncate && index === 1;

          return (
            <li key={item.id ?? "root"} className={styles.breadcrumbItem}>
              {showEllipsis && (
                <span className={styles.ellipsis} aria-label="More folders">
                  …
                </span>
              )}
              {isLast ? (
                <span className={styles.breadcrumbCurrent} aria-current="page">
                  {item.name}
                </span>
              ) : (
                <button
                  className={styles.breadcrumbLink}
                  onClick={() => handleClick(item.id)}
                  type="button"
                >
                  {index === 0 ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  ) : (
                    item.name
                  )}
                </button>
              )}
              {!isLast && (
                <svg
                  className={styles.separator}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
