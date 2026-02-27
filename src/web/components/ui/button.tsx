/**
 * Bush Platform - Button Component
 *
 * Accessible button component with multiple variants and sizes.
 * Reference: specs/21-design-components.md
 */
import React from "react";
import { cn } from "@/web/lib/utils";
import { Spinner } from "./spinner";

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

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text-inverse hover:bg-accent-hover shadow-accent focus-visible:shadow-accent",
  secondary: "bg-transparent text-text-primary border border-border-default hover:bg-surface-3",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-2",
  danger: "bg-transparent text-error border border-error hover:bg-[rgba(239,68,68,0.1)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 gap-1.5 text-body-sm", // 32px
  md: "h-9 px-4 gap-2 text-body", // 36px
  lg: "h-10 px-5 gap-2 text-body", // 40px
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  startIcon,
  endIcon,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-sm cursor-pointer",
        "transition-all duration-fast",
        "whitespace-nowrap border border-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <Spinner size={size === "lg" ? "md" : "sm"} />
      ) : (
        startIcon
      )}
      {children}
      {!loading && endIcon}
    </button>
  );
}

export default Button;
