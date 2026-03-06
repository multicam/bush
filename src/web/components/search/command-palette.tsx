/**
 * Bush Platform - Command Palette Component
 *
 * Enhanced command palette with search, actions, and recent items.
 * Triggered by Cmd+K / Ctrl+K.
 *
 * Reference: specs/21-design-components.md - Command Palette
 */
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  SpinnerIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  Cog6ToothIcon,
  HomeIcon,
  ShareIcon,
  BellIcon,
  Squares2X2Icon,
} from "@/web/lib/icons";
import { cn } from "@/web/lib/utils";
import { searchApi, SearchResultAttributes, JsonApiResource } from "@/web/lib/api";

/** Command item definition */
export interface CommandItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Category/group */
  category: string;
  /** Action to perform when selected */
  action: () => void;
  /** Whether this is a recent item */
  isRecent?: boolean;
}

/** Recent item stored in localStorage */
interface RecentItem {
  id: string;
  label: string;
  type: "file" | "action" | "page";
  timestamp: number;
  data?: SearchResultAttributes;
}

const RECENT_STORAGE_KEY = "bush-command-palette-recent";
const MAX_RECENT_ITEMS = 5;

/** Get file type icon */
function getFileIcon(mimeType: string): React.ReactNode {
  const type = mimeType.split("/")[0];
  switch (type) {
    case "video":
      return <span className="text-lg">🎬</span>;
    case "audio":
      return <span className="text-lg">🎵</span>;
    case "image":
      return <span className="text-lg">🖼️</span>;
    case "text":
      return <DocumentTextIcon className="w-5 h-5 text-muted" />;
    default:
      return <DocumentTextIcon className="w-5 h-5 text-muted" />;
  }
}

/** Format file size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export interface CommandPaletteProps {
  /** Whether the palette is open (controlled mode) */
  open?: boolean;
  /** Callback when open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** Callback when a file result is selected */
  onFileSelect?: (result: JsonApiResource<SearchResultAttributes>) => void;
  /** Callback when an action is selected */
  onActionSelect?: (actionId: string) => void;
  /** Filter to specific project */
  projectId?: string;
  /** Custom commands */
  commands?: CommandItem[];
  /** Additional CSS class */
  className?: string;
}

/**
 * Load recent items from localStorage
 */
function loadRecentItems(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save recent items to localStorage
 */
function saveRecentItems(items: RecentItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Kbd component for keyboard shortcuts
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[24px] px-1.5 py-0.5",
        "bg-surface-3 border border-border-default rounded-xs",
        "text-[11px] font-mono text-muted",
        "whitespace-nowrap"
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Command Palette Component
 */
export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
  onFileSelect,
  onActionSelect,
  projectId,
  commands: customCommands,
  className,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JsonApiResource<SearchResultAttributes>[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);

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

  // Default commands
  const defaultCommands = useMemo<CommandItem[]>(
    () => [
      {
        id: "go-dashboard",
        label: "Go to Dashboard",
        icon: <HomeIcon className="w-4 h-4 text-muted" />,
        shortcut: "G D",
        category: "Navigation",
        action: () => {
          window.location.href = "/dashboard";
        },
      },
      {
        id: "go-projects",
        label: "Go to Projects",
        icon: <FolderOpenIcon className="w-4 h-4 text-muted" />,
        shortcut: "G P",
        category: "Navigation",
        action: () => {
          window.location.href = "/projects";
        },
      },
      {
        id: "go-shares",
        label: "Go to Shares",
        icon: <ShareIcon className="w-4 h-4 text-muted" />,
        shortcut: "G S",
        category: "Navigation",
        action: () => {
          window.location.href = "/shares";
        },
      },
      {
        id: "go-notifications",
        label: "Go to Notifications",
        icon: <BellIcon className="w-4 h-4 text-muted" />,
        shortcut: "G N",
        category: "Navigation",
        action: () => {
          window.location.href = "/notifications";
        },
      },
      {
        id: "upload-files",
        label: "Upload Files",
        icon: <ArrowUpTrayIcon className="w-4 h-4 text-muted" />,
        shortcut: "U",
        category: "Actions",
        action: () => {
          onActionSelect?.("upload-files");
        },
      },
      {
        id: "new-folder",
        label: "Create New Folder",
        icon: <PlusIcon className="w-4 h-4 text-muted" />,
        shortcut: "N",
        category: "Actions",
        action: () => {
          onActionSelect?.("new-folder");
        },
      },
      {
        id: "keyboard-shortcuts",
        label: "Keyboard Shortcuts",
        icon: <Squares2X2Icon className="w-4 h-4 text-muted" />,
        shortcut: "?",
        category: "Help",
        action: () => {
          onActionSelect?.("keyboard-shortcuts");
        },
      },
      {
        id: "settings",
        label: "Settings",
        icon: <Cog6ToothIcon className="w-4 h-4 text-muted" />,
        category: "Help",
        action: () => {
          window.location.href = "/settings";
        },
      },
    ],
    [onActionSelect]
  );

  const commands = customCommands || defaultCommands;

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Load recent items on mount
  useEffect(() => {
    setRecentItems(loadRecentItems());
  }, []);

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          setOpen(true);
        }
      }

      // Close on Escape
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSearchResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      // Cancel previous search
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      searchAbortControllerRef.current = new AbortController();

      setIsLoading(true);
      try {
        const response = await searchApi.search({
          query,
          projectId,
          limit: 10,
        });
        setSearchResults(response.data);
        setSelectedIndex(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Search failed:", error);
          setSearchResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, [query, projectId]);

  // Calculate all visible items for keyboard navigation
  const visibleItems = useMemo(() => {
    const items: Array<
      | { type: "command"; item: CommandItem }
      | { type: "file"; item: JsonApiResource<SearchResultAttributes> }
      | { type: "recent"; item: RecentItem }
    > = [];

    if (query) {
      // Show filtered commands first
      if (filteredCommands.length > 0) {
        filteredCommands.forEach((cmd) => {
          items.push({ type: "command", item: cmd });
        });
      }
      // Then show search results
      searchResults.forEach((file) => {
        items.push({ type: "file", item: file });
      });
    } else {
      // Show recent items when query is empty
      if (recentItems.length > 0) {
        recentItems.forEach((recent) => {
          items.push({ type: "recent", item: recent });
        });
      }
      // Show all commands
      commands.forEach((cmd) => {
        items.push({ type: "command", item: cmd });
      });
    }

    return items;
  }, [query, filteredCommands, searchResults, recentItems, commands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % visibleItems.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + visibleItems.length) % visibleItems.length);
          break;
        case "Enter":
          e.preventDefault();
          if (visibleItems[selectedIndex]) {
            const selected = visibleItems[selectedIndex];
            if (selected.type === "command") {
              selected.item.action();
              setOpen(false);
            } else if (selected.type === "file") {
              // Add to recent items
              const newRecent: RecentItem = {
                id: selected.item.id,
                label: selected.item.attributes.name,
                type: "file",
                timestamp: Date.now(),
                data: selected.item.attributes,
              };
              const updated = [
                newRecent,
                ...recentItems.filter((r) => r.id !== selected.item.id),
              ].slice(0, MAX_RECENT_ITEMS);
              setRecentItems(updated);
              saveRecentItems(updated);
              onFileSelect?.(selected.item);
              setOpen(false);
            } else if (selected.type === "recent" && selected.item.data) {
              onFileSelect?.({
                id: selected.item.id,
                type: "files",
                attributes: selected.item.data,
              });
              setOpen(false);
            }
          }
          break;
      }
    },
    [visibleItems, selectedIndex, recentItems, onFileSelect, setOpen]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  if (!open) return null;

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-command-palette",
        "bg-surface-0/60 backdrop-blur-sm",
        "flex items-start justify-center pt-[15vh]",
        "animate-fade-in"
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className={cn(
          "w-full max-w-[560px] bg-surface-2 rounded-lg shadow-xl",
          "overflow-hidden",
          "animate-modal-in",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border-default">
          <MagnifyingGlassIcon className="w-5 h-5 text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className={cn(
              "flex-1 border-none outline-none",
              "text-base text-primary bg-transparent",
              "placeholder:text-muted"
            )}
            placeholder="Search files and commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isLoading && <SpinnerIcon className="w-5 h-5 text-muted" />}
          {query && (
            <button
              className={cn(
                "flex items-center justify-center w-6 h-6",
                "text-muted hover:text-primary transition-colors"
              )}
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {/* Recent items (when query is empty) */}
          {!query && recentItems.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Recent
              </div>
              {recentItems.map((recent, index) => (
                <button
                  key={`recent-${recent.id}`}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-2.5",
                    "bg-transparent border-none text-left cursor-pointer",
                    "transition-colors hover:bg-surface-3",
                    selectedIndex === index && "bg-surface-3"
                  )}
                  onClick={() => {
                    if (recent.data) {
                      onFileSelect?.({
                        id: recent.id,
                        type: "files",
                        attributes: recent.data,
                      });
                      setOpen(false);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {getFileIcon(recent.data?.mimeType || "application/octet-stream")}
                  <span className="text-sm text-primary">{recent.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Commands */}
          {(!query ? commands : filteredCommands).length > 0 && (
            <div className="py-2">
              {query && filteredCommands.length > 0 && (
                <div className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                  Commands
                </div>
              )}
              {(!query ? commands : filteredCommands).map((cmd, index) => {
                const itemIndex = query
                  ? filteredCommands.indexOf(cmd)
                  : recentItems.length + index;
                return (
                  <button
                    key={cmd.id}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2.5",
                      "bg-transparent border-none text-left cursor-pointer",
                      "transition-colors hover:bg-surface-3",
                      selectedIndex === itemIndex && "bg-surface-3"
                    )}
                    onClick={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                  >
                    {cmd.icon && <span className="flex-shrink-0">{cmd.icon}</span>}
                    <span className="flex-1 text-sm text-primary">{cmd.label}</span>
                    {cmd.shortcut && <Kbd>{cmd.shortcut}</Kbd>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search results */}
          {query && searchResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Files
              </div>
              {searchResults.map((result, index) => {
                const itemIndex = filteredCommands.length + index;
                return (
                  <button
                    key={result.id}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2.5",
                      "bg-transparent border-none text-left cursor-pointer",
                      "transition-colors hover:bg-surface-3",
                      selectedIndex === itemIndex && "bg-surface-3"
                    )}
                    onClick={() => {
                      // Add to recent
                      const newRecent: RecentItem = {
                        id: result.id,
                        label: result.attributes.name,
                        type: "file",
                        timestamp: Date.now(),
                        data: result.attributes,
                      };
                      const updated = [
                        newRecent,
                        ...recentItems.filter((r) => r.id !== result.id),
                      ].slice(0, MAX_RECENT_ITEMS);
                      setRecentItems(updated);
                      saveRecentItems(updated);
                      onFileSelect?.(result);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                  >
                    {getFileIcon(result.attributes.mimeType)}
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                        {result.attributes.name}
                      </span>
                      <span className="text-xs text-muted">
                        {formatFileSize(result.attributes.fileSizeBytes)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query && !isLoading && filteredCommands.length === 0 && searchResults.length === 0 && (
            <div className="py-8 px-4 text-center text-muted">No results found for "{query}"</div>
          )}
        </div>

        {/* Help text */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border-default bg-surface-3 text-xs text-muted">
          <span>
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span>
            <Kbd>Enter</Kbd> select
          </span>
          <span>
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );

  // Render in portal
  const container = typeof document !== "undefined" ? document.body : null;
  return container ? createPortal(content, container) : null;
}

export default CommandPalette;
