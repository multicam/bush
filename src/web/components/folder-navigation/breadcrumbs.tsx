/**
 * Bush Platform - Breadcrumbs Component
 *
 * Breadcrumb navigation for folder hierarchy.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 [P1] Folder Navigation
 */
"use client";

import { useCallback } from "react";
import { ChevronRightIcon, HomeSmallIcon } from "@/web/lib/icons";

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

export function Breadcrumbs({ items, onNavigate, maxItems = 5 }: BreadcrumbsProps) {
  const handleClick = useCallback(
    (folderId: string | null) => {
      onNavigate?.(folderId);
    },
    [onNavigate]
  );

  // Determine if we need to truncate
  const shouldTruncate = items.length > maxItems;
  const visibleItems = shouldTruncate ? [items[0], ...items.slice(-(maxItems - 1))] : items;

  return (
    <nav className="flex items-center min-h-8" aria-label="Breadcrumb navigation">
      <ol className="flex items-center list-none m-0 p-0 gap-1">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const showEllipsis = shouldTruncate && index === 1;

          return (
            <li key={item.id ?? "root"} className="flex items-center gap-1">
              {showEllipsis && (
                <span className="px-2 py-1 text-muted text-sm" aria-label="More folders">
                  …
                </span>
              )}
              {isLast ? (
                <span className="px-2 py-1 text-primary text-sm font-medium" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <button
                  className="flex items-center gap-1 px-2 py-1 bg-none border-none rounded-sm text-secondary text-sm cursor-pointer transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                  onClick={() => handleClick(item.id)}
                  type="button"
                >
                  {index === 0 ? <HomeSmallIcon className="size-4" /> : item.name}
                </button>
              )}
              {!isLast && <ChevronRightIcon className="text-muted flex-shrink-0 size-4" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
