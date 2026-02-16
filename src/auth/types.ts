/**
 * Bush Platform - Authentication Types
 *
 * Type definitions for authentication, sessions, and roles.
 * Reference: specs/12-authentication.md
 */

/**
 * Account roles managed by Bush (not WorkOS)
 */
export type AccountRole = "owner" | "content_admin" | "member" | "guest" | "reviewer";

/**
 * Permission levels for resources
 */
export type PermissionLevel =
  | "full_access"     // Full control including delete and manage permissions
  | "edit_and_share"  // Can edit and share with others
  | "edit"            // Can edit but not share
  | "comment_only"    // Can view and comment
  | "view_only";      // Read-only access

/**
 * Reviewer access tiers for share-link-based access
 */
export type ReviewerTier =
  | "authenticated"   // Logged-in Bush user
  | "identified"      // Email-verified via code
  | "unidentified";   // Anonymous

/**
 * Session data cached in Redis
 */
export interface SessionData {
  /** Unique session ID */
  sessionId: string;
  /** Bush user ID */
  userId: string;
  /** User email */
  email: string;
  /** User display name */
  displayName: string | null;
  /** Current account ID (for account switcher) */
  currentAccountId: string;
  /** Account role for current account */
  accountRole: AccountRole;
  /** WorkOS organization ID */
  workosOrganizationId: string;
  /** WorkOS user ID */
  workosUserId: string;
  /** Session creation timestamp (ms since epoch) */
  createdAt: number;
  /** Last activity timestamp (ms since epoch) */
  lastActivityAt: number;
  /** Avatar URL (optional) */
  avatarUrl?: string | null;
}

/**
 * Session cache key format
 */
export function getSessionCacheKey(userId: string, sessionId: string): string {
  return `session:${userId}:${sessionId}`;
}

/**
 * User info from WorkOS JWT claims
 */
export interface WorkOSClaims {
  sub: string;           // WorkOS user ID
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  org_id: string;        // WorkOS organization ID
  org_name?: string;
  exp: number;           // Token expiration timestamp
  iat: number;           // Token issued at timestamp
}

/**
 * Auth state for frontend
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  currentAccount: {
    id: string;
    name: string;
    slug: string;
    role: AccountRole;
  } | null;
  accounts: Array<{
    id: string;
    name: string;
    slug: string;
    role: AccountRole;
  }>;
}

/**
 * Role capabilities map
 */
export const ROLE_CAPABILITIES: Record<AccountRole, string[]> = {
  owner: [
    "billing:read",
    "billing:write",
    "plan:read",
    "plan:write",
    "users:read",
    "users:write",
    "users:delete",
    "security:read",
    "security:write",
    "content:read",
    "content:write",
    "content:delete",
    "shares:read",
    "shares:write",
    "shares:delete",
    "settings:read",
    "settings:write",
  ],
  content_admin: [
    "users:read",
    "users:write",
    "content:read",
    "content:write",
    "content:delete",
    "shares:read",
    "shares:write",
    "shares:delete",
    "settings:read",
  ],
  member: [
    "content:read",
    "content:write",
    "shares:read",
    "shares:write",
  ],
  guest: [
    "content:read",
  ],
  reviewer: [
    "content:read",
  ],
};

/**
 * Check if a role has a specific capability
 */
export function hasCapability(role: AccountRole, capability: string): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

/**
 * Role hierarchy - higher index = more permissive
 */
export const ROLE_HIERARCHY: AccountRole[] = [
  "reviewer",
  "guest",
  "member",
  "content_admin",
  "owner",
];

/**
 * Check if role A has equal or higher privileges than role B
 */
export function isRoleAtLeast(roleA: AccountRole, roleB: AccountRole): boolean {
  return ROLE_HIERARCHY.indexOf(roleA) >= ROLE_HIERARCHY.indexOf(roleB);
}
