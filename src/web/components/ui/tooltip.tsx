/**
 * Bush Platform - Tooltip Component
 *
 * Accessible tooltip component with positioning.
 * Reference: QW3 Component Library Foundation
 */
"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode, type MouseEvent, type FocusEvent } from "react";
import { createPortal } from "react-dom";

export type TooltipPosition = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  /** Tooltip content */
  content: ReactNode;
  /** Preferred position */
  position?: TooltipPosition;
  /** Delay before showing (ms) */
  showDelay?: number;
  /** Delay before hiding (ms) */
  hideDelay?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Portal target */
  portalContainer?: Element | null;
  /** Trigger element - must accept a ref and event handlers */
  children: ReactNode;
}

export function Tooltip({
  content,
  position = "top",
  showDelay = 300,
  hideDelay = 100,
  disabled = false,
  portalContainer,
  children,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [arrowCoords, setArrowCoords] = useState({ x: 0, y: 0 });

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hideTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Calculate tooltip position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 8;
    const arrowSize = 6;

    let x: number = 0;
    let y: number = 0;
    let arrowX: number = 0;
    let arrowY: number = 0;
    let finalPosition = position;

    // Check if preferred position fits in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const calculateForPosition = (pos: TooltipPosition) => {
      switch (pos) {
        case "top":
          x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          y = triggerRect.top - tooltipRect.height - padding;
          arrowX = tooltipRect.width / 2 - arrowSize;
          arrowY = tooltipRect.height - arrowSize / 2;
          break;
        case "bottom":
          x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          y = triggerRect.bottom + padding;
          arrowX = tooltipRect.width / 2 - arrowSize;
          arrowY = -arrowSize / 2;
          break;
        case "left":
          x = triggerRect.left - tooltipRect.width - padding;
          y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          arrowX = tooltipRect.width - arrowSize / 2;
          arrowY = tooltipRect.height / 2 - arrowSize;
          break;
        case "right":
          x = triggerRect.right + padding;
          y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          arrowX = -arrowSize / 2;
          arrowY = tooltipRect.height / 2 - arrowSize;
          break;
      }
    };

    // Try preferred position first, then fallback to alternatives
    const fallbackOrder: TooltipPosition[] = ["top", "bottom", "right", "left"];
    const orderedPositions = [
      position,
      ...fallbackOrder.filter((p) => p !== position),
    ];

    for (const pos of orderedPositions) {
      calculateForPosition(pos);

      // Check if fits in viewport
      const fits =
        x >= 0 &&
        x + tooltipRect.width <= viewportWidth &&
        y >= 0 &&
        y + tooltipRect.height <= viewportHeight;

      if (fits) {
        finalPosition = pos;
        break;
      }
    }

    // Apply the final position calculation
    calculateForPosition(finalPosition);

    // Clamp to viewport
    x = Math.max(8, Math.min(x, viewportWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewportHeight - tooltipRect.height - 8));

    setCoords({ x, y });
    setArrowCoords({ x: arrowX, y: arrowY });
  }, [position]);

  const showTooltip = useCallback(() => {
    if (disabled) return;

    clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, showDelay);
  }, [disabled, showDelay]);

  const hideTooltip = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, hideDelay);
  }, [hideDelay]);

  // Recalculate position when visible
  useEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const container = portalContainer ?? (typeof document !== "undefined" ? document.body : null);

  const handleMouseEnter = (_e: MouseEvent) => {
    showTooltip();
  };

  const handleMouseLeave = (_e: MouseEvent) => {
    hideTooltip();
  };

  const handleFocus = (_e: FocusEvent) => {
    showTooltip();
  };

  const handleBlur = (_e: FocusEvent) => {
    hideTooltip();
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={isVisible ? "tooltip" : undefined}
        style={{ display: "inline-flex" }}
      >
        {children}
      </span>
      {isVisible &&
        container &&
        createPortal(
          <div
            ref={tooltipRef}
            id="tooltip"
            className="tooltip"
            role="tooltip"
            style={{
              left: coords.x,
              top: coords.y,
            }}
          >
            {content}
            <div
              className="tooltip-arrow"
              style={{
                left: arrowCoords.x,
                top: arrowCoords.y,
              }}
            />
          </div>,
          container
        )}
    </>
  );
}

export default Tooltip;
