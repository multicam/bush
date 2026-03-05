/**
 * Bush Platform - Theme Context
 *
 * React Context for theme state management (dark/light).
 * Dark theme is the default. Persists choice in localStorage.
 *
 * Reference: specs/20-design-foundations.md - Theme Implementation
 */
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = "bush_theme";

/**
 * Get initial theme from localStorage or default to dark
 * This runs on the client only
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  // Default to dark theme on first visit (dark-first design)
  return "dark";
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme - used by anti-FOUC script during SSR */
  initialTheme?: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  // Start with initialTheme or default to dark for SSR consistency
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? "dark");
  const [mounted, setMounted] = useState(false);

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const storedTheme = getInitialTheme();
    setThemeState(storedTheme);
    applyTheme(storedTheme);
    setMounted(true);
  }, [applyTheme]);

  // Set theme and persist to localStorage
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      applyTheme(newTheme);
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    },
    [applyTheme]
  );

  // Toggle between dark and light
  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
