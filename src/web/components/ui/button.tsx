/**
 * Bush Platform - Button Component
 *
 * Accessible button component with multiple variants and sizes.
 * Reference: QW3 Component Library Foundation
 */
import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Icon to display before text */
  startIcon?: React.ReactNode;
  /** Icon to display after text */
  endIcon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Button content */
  children?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  startIcon,
  endIcon,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? "btn--full-width" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <Spinner size={size} />
      ) : (
        startIcon
      )}
      {children}
      {!loading && endIcon}
    </button>
  );
}

/**
 * Loading spinner for buttons
 */
function Spinner({ size }: { size: ButtonSize }) {
  const spinnerSize = size === "sm" ? "14" : size === "lg" ? "20" : "16";
  return (
    <svg
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="spinner"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default Button;
