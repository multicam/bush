/**
 * Bush Platform - Badge Component
 *
 * Small status indicator or label badge.
 * Reference: QW3 Component Library Foundation
 */
import React from "react";

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "error";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Additional CSS class */
  className?: string;
}

export function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
  const classes = [
    "badge",
    `badge--${variant}`,
    size !== "md" ? `badge--${size}` : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {children}
    </span>
  );
}

export default Badge;
