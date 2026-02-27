/**
 * Bush Platform - Class Name Utility
 *
 * Utility for conditionally combining class names with Tailwind CSS.
 * Uses clsx for conditional classes and tailwind-merge to dedupe Tailwind classes.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine class names with Tailwind CSS class deduplication
 *
 * @example
 * cn("px-4 py-2", isPrimary && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
