/**
 * Bush Platform - Theme Hook
 *
 * Re-exports useTheme from theme-context for convenient access.
 *
 * Usage:
 *   const { theme, setTheme, toggleTheme, isDark } = useTheme();
 *
 * Reference: specs/20-design-foundations.md - Theme Implementation
 */
export { useTheme, type Theme } from "@/web/context/theme-context";
