/**
 * Bush Platform - Avatar Component
 *
 * User avatar with fallback to initials.
 * Reference: QW3 Component Library Foundation
 */

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

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  className = "",
}: AvatarProps) {
  const initials = getInitials(name);

  const classes = [
    "avatar",
    `avatar--${size}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      role={alt ? "img" : undefined}
      aria-label={alt}
    >
      {src ? (
        <img
          src={src}
          alt={alt || ""}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
