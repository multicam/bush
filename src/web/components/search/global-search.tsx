/**
 * Bush Platform - Global Search Component
 *
 * Global search bar with Cmd+K shortcut for searching across all accessible files.
 * Reference: specs/00-atomic-features.md Section 12
 */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { searchApi, SearchResultAttributes, SearchSuggestionAttributes, JsonApiResource } from "../../lib/api";
import styles from "./global-search.module.css";

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

  // Open search modal
  const openSearch = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onOpen]);

  // Close search modal
  const closeSearch = useCallback(() => {
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

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch both search results and suggestions
      const [searchResponse, suggestionsResponse] = await Promise.all([
        searchApi.search({ query: searchQuery, projectId, limit: 20 }),
        searchApi.suggestions(searchQuery, 5),
      ]);

      setResults(searchResponse.data);
      setSuggestions(suggestionsResponse.data);
      setShowSuggestions(true);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

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
    <div ref={containerRef} className={`${styles.container} ${className || ""}`}>
      {/* Search trigger button */}
      <button
        className={styles.trigger}
        onClick={openSearch}
        aria-label="Open search"
      >
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span className={styles.triggerText}>{placeholder}</span>
        <kbd className={styles.shortcut}>⌘K</kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            {/* Search input */}
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                placeholder="Search files..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {isLoading && <div className={styles.spinner} />}
              {query.length >= 2 && (
                <button
                  className={styles.clearButton}
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results */}
            {showSuggestions && (suggestions.length > 0 || results.length > 0) && (
              <div className={styles.results}>
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Suggestions</div>
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`suggestion-${index}`}
                        className={`${styles.suggestionItem} ${selectedIndex === index ? styles.selected : ""}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className={styles.suggestionType}>{FILE_TYPE_ICONS[suggestion.type] || "📄"}</span>
                        <span className={styles.suggestionName}>{suggestion.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search results */}
                {results.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Files</div>
                    {results.map((result, index) => (
                      <button
                        key={result.id}
                        className={`${styles.resultItem} ${selectedIndex === suggestions.length + index ? styles.selected : ""}`}
                        onClick={() => handleResultClick(result)}
                        onMouseEnter={() => setSelectedIndex(suggestions.length + index)}
                      >
                        <span className={styles.resultIcon}>
                          {getFileIcon(result.attributes.mimeType)}
                        </span>
                        <div className={styles.resultInfo}>
                          <span className={styles.resultName}>{result.attributes.name}</span>
                          <span className={styles.resultMeta}>
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
              <div className={styles.noResults}>
                <span>No results found for "{query}"</span>
              </div>
            )}

            {/* Help text */}
            <div className={styles.help}>
              <span><kbd>↑↓</kbd> to navigate</span>
              <span><kbd>Enter</kbd> to select</span>
              <span><kbd>Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
