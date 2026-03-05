/**
 * Bush Platform - Badge Component
 *
 * Small status indicator or label badge.
 * Reference: specs/21-design-components.md
 */
import { cn } from "@/web/lib/utils";

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

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-3 text-text-secondary",
  primary: "bg-accent-muted text-accent",
  success: "bg-[rgba(34,197,94,0.15)] text-success",
  warning: "bg-[rgba(245,158,11,0.15)] text-warning",
  error: "bg-[rgba(239,68,68,0.15)] text-error",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-caption",
  lg: "px-3 py-1 text-body-sm",
};

export function Badge({ children, variant = "default", size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium leading-none rounded-full whitespace-nowrap capitalize",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
