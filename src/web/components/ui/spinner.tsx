import { SpinnerIcon } from "@/web/lib/icons";

export { SpinnerIcon };

interface SpinnerProps {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "size-3",
  md: "size-4",
  lg: "size-6",
};

export function Spinner({ className, label = "Loading...", size = "md" }: SpinnerProps) {
  return (
    <div role="status" className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <SpinnerIcon className={sizeClasses[size]} />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
