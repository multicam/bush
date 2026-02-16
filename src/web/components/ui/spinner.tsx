/**
 * Bush Platform - Spinner Component
 *
 * Loading spinner with multiple sizes.
 * Reference: QW3 Component Library Foundation
 */

export type SpinnerSize = "sm" | "md" | "lg" | "xl";

export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Additional CSS class */
  className?: string;
  /** Accessible label */
  label?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: "1rem",
  md: "1.5rem",
  lg: "2rem",
  xl: "3rem",
};

export function Spinner({ size = "md", className = "", label = "Loading" }: SpinnerProps) {
  const dimension = sizeMap[size];

  const classes = ["spinner", className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="status"
      aria-label={label}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default Spinner;
