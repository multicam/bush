/**
 * Bush Platform - Spinner Component
 *
 * Loading spinner with multiple sizes.
 * Reference: specs/21-design-components.md
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/web/lib/utils";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";

export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Additional CSS class */
  className?: string;
  /** Accessible label */
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "size-4", // 16px
  md: "size-6", // 24px
  lg: "size-8", // 32px
  xl: "size-12", // 48px
};

export function Spinner({ size = "md", className = "", label = "Loading" }: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        "animate-spin text-current",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={label}
    />
  );
}

export default Spinner;
