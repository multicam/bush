/**
 * Bush Platform - Permission Types
 *
 * Type definitions for the permission system.
 * Reference: specs/00-complete-support-documentation.md Section 2
 */

/**
 * Permission levels for resources
 * Ordered from least to most restrictive for hierarchy calculations
 */
export type PermissionLevel =
  | "full_access"    // Full control including delete and manage permissions
  | "edit_and_share" // Can edit and share with others
  | "edit"           // Can edit but not share
  | "comment_only"   // Can view and comment
  | "view_only";     // Read-only access

/**
 * Permission hierarchy index - higher is more permissive
 * Used for inheritance calculations
 */
export const PERMISSION_HIERARCHY: PermissionLevel[] = [
  "view_only",
  "comment_only",
  "edit",
  "edit_and_share",
  "full_access",
];

/**
 * Get the numeric index of a permission level
 * Higher index = more permissive
 */
export function getPermissionIndex(level: PermissionLevel): number {
  return PERMISSION_HIERARCHY.indexOf(level);
}

/**
 * Compare two permission levels
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
export function comparePermissions(a: PermissionLevel, b: PermissionLevel): number {
  return getPermissionIndex(a) - getPermissionIndex(b);
}

/**
 * Check if permission A is at least as permissive as permission B
 */
export function isPermissionAtLeast(a: PermissionLevel, b: PermissionLevel): boolean {
  return getPermissionIndex(a) >= getPermissionIndex(b);
}

/**
 * Get the more permissive of two permission levels
 */
export function maxPermission(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return getPermissionIndex(a) >= getPermissionIndex(b) ? a : b;
}

/**
 * Get the less permissive of two permission levels
 */
export function minPermission(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return getPermissionIndex(a) <= getPermissionIndex(b) ? a : b;
}

/**
 * Resource types that can have permissions
 */
export type PermissionResourceType = "workspace" | "project" | "folder";

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** The effective permission level */
  permission: PermissionLevel;
  /** Source of the permission (direct, inherited, admin_override) */
  source: "direct" | "inherited" | "admin_override";
}

/**
 * Actions that can be performed on resources
 */
export type ResourceAction =
  | "view"
  | "comment"
  | "download"
  | "share"
  | "edit"
  | "delete"
  | "manage_permissions"
  | "create_project"
  | "create_restricted_project"
  | "add_members"
  | "delete_workspace";

/**
 * Permission requirements for each action
 */
export const ACTION_PERMISSIONS: Record<ResourceAction, PermissionLevel> = {
  view: "view_only",
  comment: "comment_only",
  download: "edit_and_share",
  share: "edit_and_share",
  edit: "edit",
  delete: "full_access",
  manage_permissions: "full_access",
  create_project: "edit",
  create_restricted_project: "full_access",
  add_members: "full_access",
  delete_workspace: "full_access",
};

/**
 * Check if a permission level allows a specific action
 */
export function canPerformAction(permission: PermissionLevel, action: ResourceAction): boolean {
  const requiredPermission = ACTION_PERMISSIONS[action];
  return isPermissionAtLeast(permission, requiredPermission);
}

/**
 * Guest role constraints
 */
export const GUEST_CONSTRAINTS = {
  /** Maximum number of projects a guest can access */
  MAX_PROJECTS: 1,
  /** Whether guests can invite others */
  CAN_INVITE: false,
  /** Whether guests can delete content */
  CAN_DELETE: false,
} as const;
