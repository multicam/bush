/**
 * Bush Platform - Badge Component
 *
 * Small status indicator or label badge.
 * Reference: QW3 Component Library Foundation
 */
import React from "react";

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "error";

export interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Additional CSS class */
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const classes = [
    "badge",
    `badge--${variant}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {children}
    </span>
  );
}

export default Badge;
