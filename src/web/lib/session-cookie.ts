/**
 * Bush Platform - Session Cookie Utilities
 *
 * Shared encode/decode for the Bush session cookie.
 */
import type { SessionData } from "../../auth/types.js";

export const BUSH_SESSION_COOKIE = "bush_session";

/**
 * Encode session data for cookie storage (base64 JSON)
 */
export function encodeSessionCookie(data: SessionData | Partial<SessionData>): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

/**
 * Decode session data from cookie value (base64 JSON)
 * Returns null if decoding fails.
 */
export function decodeSessionCookie(encoded: string): SessionData | null {
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString()) as SessionData;
  } catch {
    return null;
  }
}
