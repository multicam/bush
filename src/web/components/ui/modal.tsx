/**
 * Bush Platform - Modal Component
 *
 * Accessible modal dialog component with focus trap and escape key support.
 * Reference: specs/21-design-components.md
 */
"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/web/lib/utils";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description for accessibility */
  description?: string;
  /** Size variant */
  size?: ModalSize;
  /** Show close button */
  showCloseButton?: boolean;
  /** Close when clicking overlay */
  closeOnOverlayClick?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Portal target element */
  portalContainer?: Element | null;
  /** Additional modal class */
  className?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md", // 400px
  md: "max-w-[520px]",
  lg: "max-w-[680px]",
  xl: "max-w-[860px]",
  full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
};

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(elements);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  portalContainer,
  className,
  children,
  footer,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle focus trap
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;

      // Focus the modal
      modalRef.current?.focus();

      // Add escape key listener
      document.addEventListener("keydown", handleKeyDown);

      // Prevent body scroll
      document.body.style.overflow = "hidden";

      // Focus trap handler
      const handleFocusTrap = (event: KeyboardEvent) => {
        if (event.key !== "Tab" || !modalRef.current) return;

        const focusableElements = getFocusableElements(modalRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift+Tab: if on first element, move to last
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, move to first
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      };

      document.addEventListener("keydown", handleFocusTrap);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keydown", handleFocusTrap);
        document.body.style.overflow = "";

        // Restore focus
        if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [open, handleKeyDown]);

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-modal",
        "bg-surface-0/60 backdrop-blur-sm",
        "flex items-center justify-center p-4",
        "animate-fade-in"
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div
        ref={modalRef}
        className={cn(
          "bg-surface-1 rounded-lg shadow-xl",
          "w-full max-h-[calc(100vh-2rem)]",
          "flex flex-col",
          "animate-modal-in",
          sizeClasses[size],
          className
        )}
        tabIndex={-1}
      >
        {(title || showCloseButton) && (
          <header className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-text-primary m-0">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center",
                  "size-8 p-0",
                  "bg-transparent border-none rounded-sm",
                  "text-text-secondary cursor-pointer",
                  "transition-colors duration-fast",
                  "hover:bg-surface-2 hover:text-text-primary"
                )}
                onClick={onClose}
                aria-label="Close modal"
              >
                <X className="size-5" />
              </button>
            )}
          </header>
        )}
        {description && (
          <p id="modal-description" className="sr-only">
            {description}
          </p>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  // Render in portal
  const container = portalContainer ?? (typeof document !== "undefined" ? document.body : null);
  return container ? createPortal(modalContent, container) : null;
}

export default Modal;
