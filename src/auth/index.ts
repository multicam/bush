/**
 * Bush Platform - Authentication Module
 *
 * Central authentication module providing session management,
 * role-based access control, and WorkOS integration utilities.
 * Reference: specs/12-authentication.md
 */
export * from "./types.js";
export { sessionCache, generateSessionId } from "./session-cache.js";
export { authService } from "./service.js";
