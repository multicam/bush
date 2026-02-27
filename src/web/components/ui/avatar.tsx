/**
 * Bush Platform - Avatar Component
 *
 * User avatar with fallback to initials.
 * Reference: specs/21-design-components.md
 */

import { cn } from "@/web/lib/utils";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  /** Image URL */
  src?: string | null;
  /** Alt text for image */
  alt?: string;
  /** User name for fallback initials */
  name?: string | null;
  /** Size variant */
  size?: AvatarSize;
  /** Additional CSS class */
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-7 text-[12px]", // 28px
  md: "size-9 text-[14px]", // 36px
  lg: "size-11 text-[16px]", // 44px
  xl: "size-14 text-[20px]", // 56px
};

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  className,
}: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-surface-2 text-text-secondary font-medium overflow-hidden shrink-0",
        sizeClasses[size],
        className
      )}
      role={alt ? "img" : undefined}
      aria-label={alt}
    >
      {src ? (
        <img
          src={src}
          alt={alt || ""}
          className="w-full h-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}

/**
 * Get initials from name
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

export default Avatar;
