/**
 * Bush Platform - Global Search Component
 *
 * Global search bar with Cmd+K shortcut for searching across all accessible files.
 * Reference: specs/00_product-reference.md Section 12
 */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { searchApi, SearchResultAttributes, SearchSuggestionAttributes, JsonApiResource } from "../../lib/api";

/** File type icons */
const FILE_TYPE_ICONS: Record<string, string> = {
  video: "🎬",
  audio: "🎵",
  image: "🖼️",
  application: "📄",
  text: "📝",
};

/** Get icon for file type */
function getFileIcon(mimeType: string): string {
  const type = mimeType.split("/")[0];
  return FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.application;
}

/** Format file size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export interface GlobalSearchProps {
  /** Placeholder text */
  placeholder?: string;
  /** Called when a result is selected */
  onSelect?: (result: JsonApiResource<SearchResultAttributes>) => void;
  /** Called when search opens */
  onOpen?: () => void;
  /** Called when search closes */
  onClose?: () => void;
  /** Filter to specific project */
  projectId?: string;
  /** Additional CSS class */
  className?: string;
}

export function GlobalSearch({
  placeholder = "Search files... (⌘K)",
  onSelect,
  onOpen,
  onClose,
  projectId,
  className,
}: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JsonApiResource<SearchResultAttributes>[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestionAttributes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const currentSearchIdRef = useRef<number>(0);

  // Open search modal
  const openSearch = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onOpen]);

  // Close search modal
  const closeSearch = useCallback(() => {
    // Cancel any pending search
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(0);
    onClose?.();
  }, [onClose]);

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }

      // Handle Escape to close
      if (e.key === "Escape" && isOpen) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openSearch, closeSearch]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeSearch]);

  // Debounced search with race condition protection
  const performSearch = useCallback(async (searchQuery: string, searchId: number) => {
    if (searchQuery.length < 2) {
      // Only update if this is still the current search
      if (searchId === currentSearchIdRef.current) {
        setResults([]);
        setSuggestions([]);
        setShowSuggestions(false);
      }
      return;
    }

    // Cancel previous search
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    searchAbortControllerRef.current = new AbortController();
    const signal = searchAbortControllerRef.current.signal;

    setIsLoading(true);
    try {
      // Fetch both search results and suggestions
      const [searchResponse, suggestionsResponse] = await Promise.all([
        searchApi.search({ query: searchQuery, projectId, limit: 20 }),
        searchApi.suggestions(searchQuery, 5),
      ]);

      // Only update state if this search is still current and not aborted
      if (searchId === currentSearchIdRef.current && !signal.aborted) {
        setResults(searchResponse.data);
        setSuggestions(suggestionsResponse.data);
        setShowSuggestions(true);
        setSelectedIndex(0);
      }
    } catch (error) {
      // Ignore abort errors
      if ((error as Error).name === "AbortError") return;
      console.error("Search failed:", error);
      // Only clear results if this is still the current search
      if (searchId === currentSearchIdRef.current) {
        setResults([]);
        setSuggestions([]);
      }
    } finally {
      if (searchId === currentSearchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [projectId]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const searchId = ++currentSearchIdRef.current;

    debounceRef.current = setTimeout(() => {
      performSearch(query, searchId);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle keyboard navigation in results
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = results.length + suggestions.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex < suggestions.length && suggestions[selectedIndex]) {
          // Select suggestion - fill input with suggestion
          setQuery(suggestions[selectedIndex].name);
          setShowSuggestions(false);
        } else if (results[selectedIndex - suggestions.length]) {
          // Select result
          onSelect?.(results[selectedIndex - suggestions.length]);
          closeSearch();
        }
        break;
    }
  }, [results, suggestions, selectedIndex, onSelect, closeSearch]);

  // Handle result click
  const handleResultClick = useCallback((result: JsonApiResource<SearchResultAttributes>) => {
    onSelect?.(result);
    closeSearch();
  }, [onSelect, closeSearch]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestionAttributes) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {/* Search trigger button */}
      <button
        className="flex items-center gap-2 px-3 py-2 bg-surface-1 border border-border-default rounded-md text-secondary cursor-pointer transition-colors hover:bg-surface-2 hover:border-border-default focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
        onClick={openSearch}
        aria-label="Open search"
      >
        <Search className="w-[18px] h-[18px] text-secondary" />
        <span className="flex-1 text-left text-sm hidden sm:block">{placeholder}</span>
        <kbd className="px-1.5 py-0.5 bg-surface-2 border border-border-default rounded-sm text-[11px] font-mono text-secondary hidden sm:block">
          ⌘K
        </kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[100px] bg-black/50 animate-in fade-in duration-150 sm:items-start sm:pt-[100px] max-sm:pt-0 max-sm:items-stretch">
          <div className="w-full max-w-[560px] bg-surface-1 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-top-5 duration-200 max-sm:max-w-none max-sm:rounded-none max-sm:min-h-screen">
            {/* Search input */}
            <div className="flex items-center gap-3 p-4 border-b border-border-default">
              <Search className="w-5 h-5 text-secondary flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                className="flex-1 border-none outline-none text-base text-primary bg-transparent placeholder:text-secondary"
                placeholder="Search files..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {isLoading && <Loader2 className="w-5 h-5 text-secondary animate-spin" />}
              {query.length >= 2 && (
                <button
                  className="flex items-center justify-center w-6 h-6 bg-surface-2 border-none rounded-sm cursor-pointer text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results */}
            {showSuggestions && (suggestions.length > 0 || results.length > 0) && (
              <div className="max-h-[400px] overflow-y-auto">
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="py-2 border-b border-border-default last:border-b-0">
                    <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                      Suggestions
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`suggestion-${index}`}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 border-none bg-transparent text-left cursor-pointer transition-colors hover:bg-surface-2 ${
                          selectedIndex === index ? "bg-surface-2" : ""
                        }`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="text-base">{FILE_TYPE_ICONS[suggestion.type] || "📄"}</span>
                        <span className="text-sm text-primary">{suggestion.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search results */}
                {results.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                      Files
                    </div>
                    {results.map((result, index) => (
                      <button
                        key={result.id}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 border-none bg-transparent text-left cursor-pointer transition-colors hover:bg-surface-2 ${
                          selectedIndex === suggestions.length + index ? "bg-surface-2" : ""
                        }`}
                        onClick={() => handleResultClick(result)}
                        onMouseEnter={() => setSelectedIndex(suggestions.length + index)}
                      >
                        <span className="text-xl flex-shrink-0">
                          {getFileIcon(result.attributes.mimeType)}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                            {result.attributes.name}
                          </span>
                          <span className="text-xs text-secondary">
                            {formatFileSize(result.attributes.fileSizeBytes)} · {result.attributes.mimeType}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {showSuggestions && query.length >= 2 && !isLoading && suggestions.length === 0 && results.length === 0 && (
              <div className="py-8 px-4 text-center text-secondary">
                <span>No results found for "{query}"</span>
              </div>
            )}

            {/* Help text */}
            <div className="flex items-center gap-4 px-4 py-3 border-t border-border-default bg-surface-2 text-xs text-secondary">
              <span>
                <kbd className="px-1.5 py-0.5 bg-surface-1 border border-border-default rounded text-[11px] font-mono">
                  ↑↓
                </kbd>{" "}
                to navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-surface-1 border border-border-default rounded text-[11px] font-mono">
                  Enter
                </kbd>{" "}
                to select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-surface-1 border border-border-default rounded text-[11px] font-mono">
                  Esc
                </kbd>{" "}
                to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
