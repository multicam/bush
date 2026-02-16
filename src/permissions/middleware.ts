/**
 * Bush Platform - Permission Middleware
 *
 * Hono middleware for checking permissions on API routes.
 * Integrates with the permission service for resource-level access control.
 * Reference: specs/00-complete-support-documentation.md Section 2
 */
import type { Context, Next } from "hono";
import { permissionService } from "./service.js";
import { AuthorizationError, NotFoundError } from "../errors/index.js";
import type { PermissionLevel, ResourceAction, PermissionResourceType } from "./types.js";
import { canPerformAction, isPermissionAtLeast, GUEST_CONSTRAINTS } from "./types.js";
import type { SessionData } from "../auth/types.js";

/**
 * Session context variable name in Hono context
 */
export const SESSION_KEY = "session";

/**
 * Request context variable name in Hono context
 */
export const REQUEST_CONTEXT_KEY = "requestContext";

/**
 * Extend Hono context types
 */
declare module "hono" {
  interface ContextVariableMap {
    session?: SessionData;
    requestContext: {
      requestId: string;
      userId?: string;
      accountId?: string;
    };
  }
}

/**
 * Extract session from Hono context
 */
export function getSession(c: Context): SessionData | undefined {
  return c.get(SESSION_KEY);
}

/**
 * Require an authenticated session
 * Throws AuthenticationError if not authenticated
 */
export function requireSession(c: Context): SessionData {
  const session = getSession(c);
  if (!session) {
    throw new AuthorizationError("Authentication required");
  }
  return session;
}

/**
 * Get request context from Hono context
 */
export function getRequestContext(c: Context): {
  requestId: string;
  userId?: string;
  accountId?: string;
} {
  return c.get(REQUEST_CONTEXT_KEY) || { requestId: "unknown" };
}

/**
 * Permission check options
 */
export interface PermissionCheckOptions {
  /** Resource type being accessed */
  resourceType: PermissionResourceType;
  /** How to extract resource ID from request (param name or function) */
  resourceIdSource: string | ((c: Context) => string | undefined);
  /** Required action to perform */
  action: ResourceAction;
  /** Account ID source (defaults to session's current account) */
  accountIdSource?: string | ((c: Context) => string | undefined);
}

/**
 * Create a permission middleware for a specific resource and action
 *
 * @example
 * // Protect a route that requires edit permission on a project
 * app.put('/projects/:projectId', requirePermission({
 *   resourceType: 'project',
 *   resourceIdSource: 'projectId',
 *   action: 'edit'
 * }), handler);
 */
export function requirePermission(options: PermissionCheckOptions) {
  return async (c: Context, next: Next) => {
    const session = requireSession(c);

    // Get resource ID
    const resourceId =
      typeof options.resourceIdSource === "function"
        ? options.resourceIdSource(c)
        : c.req.param(options.resourceIdSource);

    if (!resourceId) {
      throw new NotFoundError(options.resourceType);
    }

    // Check permission
    const hasPermission = await permissionService.canPerformAction(
      session.userId,
      options.resourceType,
      resourceId,
      options.action
    );

    if (!hasPermission) {
      throw new AuthorizationError(
        `You do not have permission to ${options.action} this ${options.resourceType}`
      );
    }

    // Store permission info in context for later use
    c.set("permissionChecked" as never, {
      resourceType: options.resourceType,
      resourceId,
      action: options.action,
    } as never);

    await next();
  };
}

/**
 * Check if user has specific permission level on a resource
 *
 * @example
 * // Check for full_access on a workspace
 * app.delete('/workspaces/:workspaceId',
 *   requirePermissionLevel('workspace', 'workspaceId', 'full_access'),
 *   handler
 * );
 */
export function requirePermissionLevel(
  resourceType: PermissionResourceType,
  resourceIdParam: string,
  requiredLevel: PermissionLevel
) {
  return async (c: Context, next: Next) => {
    const session = requireSession(c);
    const resourceId = c.req.param(resourceIdParam);

    if (!resourceId) {
      throw new NotFoundError(resourceType);
    }

    let permissionResult;
    switch (resourceType) {
      case "workspace":
        permissionResult = await permissionService.getWorkspacePermission(
          session.userId,
          resourceId
        );
        break;
      case "project":
        permissionResult = await permissionService.getProjectPermission(
          session.userId,
          resourceId
        );
        break;
      case "folder":
        permissionResult = await permissionService.getFolderPermission(
          session.userId,
          resourceId
        );
        break;
    }

    if (!permissionResult) {
      throw new AuthorizationError(
        `You do not have access to this ${resourceType}`
      );
    }

    if (!canPerformAction(permissionResult.permission, "view" as ResourceAction)) {
      throw new AuthorizationError(
        `You do not have permission to access this ${resourceType}`
      );
    }

    // Check if permission level is sufficient
    if (!isPermissionAtLeast(permissionResult.permission, requiredLevel)) {
      throw new AuthorizationError(
        `You need ${requiredLevel} permission to perform this action`
      );
    }

    await next();
  };
}

/**
 * Require account admin (owner or content_admin) role
 */
export function requireAccountAdmin(c: Context, next: Next): Promise<void> {
  const session = requireSession(c);

  if (session.accountRole !== "owner" && session.accountRole !== "content_admin") {
    throw new AuthorizationError(
      "Only account owners and content admins can perform this action"
    );
  }

  return next();
}

/**
 * Require account owner role
 */
export function requireAccountOwner(c: Context, next: Next): Promise<void> {
  const session = requireSession(c);

  if (session.accountRole !== "owner") {
    throw new AuthorizationError("Only account owners can perform this action");
  }

  return next();
}

/**
 * Check guest constraints middleware
 * Use before operations that guests are restricted from
 */
export async function checkGuestConstraints(
  c: Context,
  operation: "delete" | "invite" | "create_project"
): Promise<void> {
  const session = requireSession(c);

  if (session.accountRole === "guest") {
    switch (operation) {
      case "delete":
        if (!GUEST_CONSTRAINTS.CAN_DELETE) {
          throw new AuthorizationError("Guests cannot delete content");
        }
        break;
      case "invite":
        if (!GUEST_CONSTRAINTS.CAN_INVITE) {
          throw new AuthorizationError("Guests cannot invite other users");
        }
        break;
      case "create_project": {
        const reachedLimit = await permissionService.hasGuestReachedProjectLimit(
          session.userId
        );
        if (reachedLimit) {
          throw new AuthorizationError(
            `Guests can only access ${GUEST_CONSTRAINTS.MAX_PROJECTS} project(s)`
          );
        }
        break;
      }
    }
  }
}

/**
 * Create a middleware that checks guest constraints for a specific operation
 */
export function requireNotGuest(operation: "delete" | "invite" | "create_project") {
  return async (c: Context, next: Next) => {
    await checkGuestConstraints(c, operation);
    await next();
  };
}

/**
 * Combined middleware factory for common permission patterns
 */
export const permissions = {
  /** Require view access to a workspace */
  viewWorkspace: (workspaceIdParam: string = "workspaceId") =>
    requirePermission({
      resourceType: "workspace",
      resourceIdSource: workspaceIdParam,
      action: "view",
    }),

  /** Require edit access to a project */
  editProject: (projectIdParam: string = "projectId") =>
    requirePermission({
      resourceType: "project",
      resourceIdSource: projectIdParam,
      action: "edit",
    }),

  /** Require delete access to a project */
  deleteProject: (projectIdParam: string = "projectId") =>
    requirePermission({
      resourceType: "project",
      resourceIdSource: projectIdParam,
      action: "delete",
    }),

  /** Require share access to a folder */
  shareFolder: (folderIdParam: string = "folderId") =>
    requirePermission({
      resourceType: "folder",
      resourceIdSource: folderIdParam,
      action: "share",
    }),
};
