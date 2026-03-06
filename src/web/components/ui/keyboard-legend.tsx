/**
 * Bush Platform - Keyboard Legend Component
 *
 * Modal overlay that displays keyboard shortcuts grouped by context.
 * Triggered by pressing `?` when no input is focused.
 *
 * Reference: specs/21-design-components.md - Keyboard Legend
 */
"use client";

import React, { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Squares2X2Icon, XMarkIcon } from "@/web/lib/icons";
import { cn } from "@/web/lib/utils";

/** Keyboard shortcut definition */
export interface KeyboardShortcut {
  /** Description of what the shortcut does */
  description: string;
  /** Key combination (e.g., "Cmd+K", "G then P", "?") */
  keys: string;
  /** Optional context hint */
  hint?: string;
}

/** Shortcut group definition */
export interface ShortcutGroup {
  /** Group name (e.g., "Global", "Navigation") */
  name: string;
  /** List of shortcuts in this group */
  shortcuts: KeyboardShortcut[];
}

/** Default shortcut groups per spec */
const DEFAULT_SHORTCUTS: ShortcutGroup[] = [
  {
    name: "Global",
    shortcuts: [
      { description: "Command palette", keys: "Cmd+K" },
      { description: "Keyboard legend", keys: "?" },
      { description: "Toggle sidebar", keys: "Cmd+/" },
      { description: "Toggle upload drawer", keys: "Cmd+Shift+U" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { description: "Go to Dashboard", keys: "G then D" },
      { description: "Go to Projects", keys: "G then P" },
      { description: "Go to Shares", keys: "G then S" },
      { description: "Go to Notifications", keys: "G then N" },
    ],
  },
  {
    name: "Asset Grid",
    shortcuts: [
      { description: "Next / previous item", keys: "J / K" },
      { description: "Open selected item", keys: "Enter" },
      { description: "Quick preview", keys: "Space" },
      { description: "Select all", keys: "Cmd+A" },
      { description: "Delete selected", keys: "Delete" },
      { description: "New folder", keys: "N" },
      { description: "Upload files", keys: "U" },
      { description: "Density: compact / default / expanded", keys: "1 / 2 / 3" },
    ],
  },
  {
    name: "Viewer",
    shortcuts: [
      { description: "Play / pause", keys: "Space" },
      { description: "Seek -5s / +5s", keys: "← / →" },
      { description: "Seek -1 frame / +1 frame", keys: "Shift+← / →" },
      { description: "Volume up / down", keys: "↑ / ↓" },
      { description: "Mute / unmute", keys: "M" },
      { description: "Fullscreen", keys: "F" },
      { description: "Toggle comment panel", keys: "C" },
      { description: "Close viewer", keys: "Escape" },
      { description: "Previous / next file", keys: "[ / ]" },
    ],
  },
  {
    name: "Comments",
    shortcuts: [
      { description: "Submit comment", keys: "Cmd+Enter" },
      { description: "Cancel reply / discard draft", keys: "Escape" },
    ],
  },
];

export interface KeyboardLegendProps {
  /** Custom shortcut groups (overrides defaults) */
  shortcutGroups?: ShortcutGroup[];
  /** Whether the legend is open (controlled mode) */
  open?: boolean;
  /** Callback when open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Kbd component for displaying keyboard key badges
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[24px] px-1.5 py-0.5",
        "bg-surface-3 border border-border-default rounded-xs",
        "text-caption font-mono text-primary",
        "whitespace-nowrap"
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Parse key string into individual keys for display
 */
function parseKeys(keys: string): string[] {
  // Handle "then" combinations (e.g., "G then D")
  if (keys.includes(" then ")) {
    return keys.split(" then ").map((k) => k.trim());
  }
  // Handle "/" separators (e.g., "J / K")
  if (keys.includes(" / ")) {
    return keys.split(" / ").map((k) => k.trim());
  }
  // Handle "+" combinations (e.g., "Cmd+K")
  return keys.split("+").map((k) => k.trim());
}

/**
 * Display a keyboard shortcut row
 */
function ShortcutRow({ shortcut }: { shortcut: KeyboardShortcut }) {
  const keyParts = parseKeys(shortcut.keys);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-secondary">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {keyParts.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && shortcut.keys.includes(" then ") && (
              <span className="text-xs text-muted mx-0.5">then</span>
            )}
            {index > 0 && shortcut.keys.includes(" / ") && (
              <span className="text-xs text-muted mx-0.5">/</span>
            )}
            {index > 0 && !shortcut.keys.includes(" then ") && !shortcut.keys.includes(" / ") && (
              <span className="text-xs text-muted mx-0.5">+</span>
            )}
            <Kbd>{key}</Kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Display a group of shortcuts
 */
function ShortcutGroupSection({ group }: { group: ShortcutGroup }) {
  return (
    <div className="py-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted mb-2">
        {group.name}
      </h3>
      <div className="space-y-0.5">
        {group.shortcuts.map((shortcut, index) => (
          <ShortcutRow key={index} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

/**
 * Check if an element is an input-like element
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  // Check for contenteditable (HTMLElement property)
  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }

  // Check for specific input types
  if (element.getAttribute("role") === "textbox") {
    return true;
  }

  return false;
}

/**
 * Keyboard Legend Component
 *
 * Displays a modal overlay with keyboard shortcuts when `?` is pressed.
 */
export function KeyboardLegend({
  shortcutGroups = DEFAULT_SHORTCUTS,
  open: controlledOpen,
  onOpenChange,
  className,
}: KeyboardLegendProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const setOpen = useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange]
  );

  // Handle keyboard shortcut (? key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if ? key is pressed (Shift + /)
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        // Only open if no input is focused
        const activeElement = document.activeElement;
        if (isInputElement(activeElement)) {
          return;
        }

        e.preventDefault();
        setOpen(!open);
      }

      // Close on Escape
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-command-palette",
        "bg-surface-0/60 backdrop-blur-sm",
        "flex items-center justify-center p-4",
        "animate-fade-in"
      )}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className={cn(
          "bg-surface-2 rounded-lg shadow-xl",
          "w-full max-w-[560px] max-h-[80vh]",
          "flex flex-col",
          "animate-modal-in",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-3">
            <Squares2X2Icon className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-primary m-0">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center",
              "size-8 p-0",
              "bg-transparent border-none rounded-sm",
              "text-secondary cursor-pointer",
              "transition-colors duration-fast",
              "hover:bg-surface-3 hover:text-primary"
            )}
            onClick={() => setOpen(false)}
            aria-label="Close keyboard legend"
          >
            <XMarkIcon className="size-5" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {shortcutGroups.map((group, index) => (
            <React.Fragment key={group.name}>
              {index > 0 && <div className="border-t border-border-default" />}
              <ShortcutGroupSection group={group} />
            </React.Fragment>
          ))}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-border-default bg-surface-3 rounded-b-lg">
          <p className="text-xs text-muted text-center">
            Press <Kbd>?</Kbd> at any time to view shortcuts
          </p>
        </footer>
      </div>
    </div>
  );

  // Render in portal
  const container = typeof document !== "undefined" ? document.body : null;
  return container ? createPortal(content, container) : null;
}

export default KeyboardLegend;
