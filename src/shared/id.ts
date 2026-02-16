/**
 * Bush Platform - ID Generator
 *
 * Shared utility for generating unique IDs with prefixes.
 * Used across auth, permissions, and API layers.
 */
import { randomBytes } from "crypto";

/**
 * Generate a unique ID with prefix (cryptographically secure)
 *
 * @example
 * generateId("usr") // => "usr_a1b2c3d4e5f6a1b2c3d4e5f6"
 * generateId("acc") // => "acc_f6e5d4c3b2a1f6e5d4c3b2a1"
 */
export function generateId(prefix: string): string {
  const hash = randomBytes(16).toString("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}
