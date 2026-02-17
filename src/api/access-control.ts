/**
 * Bush Platform - Access Control Helpers
 *
 * Shared access verification for API routes.
 * Centralizes the common patterns of verifying resource ownership via account.
 */
import { db } from "../db/index.js";
import { projects, workspaces, folders, accountMemberships } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AccountRole } from "../auth/types.js";
import { isRoleAtLeast } from "../auth/types.js";

/**
 * Verify a project belongs to the given account.
 * Returns project and workspace data, or null if not accessible.
 */
export async function verifyProjectAccess(
  projectId: string,
  accountId: string
): Promise<{
  project: typeof projects.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
} | null> {
  const [result] = await db
    .select()
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(workspaces.accountId, accountId)
      )
    )
    .limit(1);

  if (!result) return null;

  return {
    project: result.projects,
    workspace: result.workspaces,
  };
}

/**
 * Verify a folder belongs to a project within the given account.
 * Returns folder, project, and workspace data, or null if not accessible.
 */
export async function verifyFolderAccess(
  folderId: string,
  accountId: string
): Promise<{
  folder: typeof folders.$inferSelect;
  project: typeof projects.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
} | null> {
  const [result] = await db
    .select()
    .from(folders)
    .innerJoin(projects, eq(folders.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(
      and(
        eq(folders.id, folderId),
        eq(workspaces.accountId, accountId)
      )
    )
    .limit(1);

  if (!result) return null;

  return {
    folder: result.folders,
    project: result.projects,
    workspace: result.workspaces,
  };
}

/**
 * Verify a workspace belongs to the given account.
 * Returns the workspace, or null if not accessible.
 */
export async function verifyWorkspaceAccess(
  workspaceId: string,
  accountId: string
): Promise<typeof workspaces.$inferSelect | null> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.accountId, accountId)
      )
    )
    .limit(1);

  return workspace ?? null;
}

/**
 * Verify a user is a member of an account with at least the required role.
 * Returns the user's role, or null if not a member / insufficient role.
 */
export async function verifyAccountMembership(
  userId: string,
  accountId: string,
  requiredRole?: AccountRole
): Promise<AccountRole | null> {
  const [membership] = await db
    .select({ role: accountMemberships.role })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, userId),
        eq(accountMemberships.accountId, accountId)
      )
    )
    .limit(1);

  if (!membership) return null;

  const role = membership.role as AccountRole;

  if (requiredRole && !isRoleAtLeast(role, requiredRole)) {
    return null;
  }

  return role;
}

/**
 * Verify that the current account ID has access to a specific account.
 * This checks that the user's current session account matches the requested account.
 * For more granular role checks, use verifyAccountMembership.
 */
export async function verifyAccountAccess(
  targetAccountId: string,
  currentAccountId: string
): Promise<boolean> {
  return targetAccountId === currentAccountId;
}
