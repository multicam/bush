# Bush - Permission Model

## Overview

Bush operates a two-axis permission model: every authenticated user carries an **account role** that determines their account-wide capabilities, and every resource (workspace, project, folder) carries a **permission level** that determines what actions the user may perform on that specific resource. These two axes compose: account roles can grant automatic full access (Owner, Content Admin) or constrain what permission levels can be granted (Guest), while resource permission levels control the fine-grained action set. A third axis covers **share-link access** for external reviewers who have no account membership at all. This document is the single source of truth for the entire permission model; all code, API middleware, and UI logic must derive from the definitions here.

---

## Specification

### 1. Account Roles

Account roles are stored in `account_memberships.role` and cached in the Redis session under `accountRole`. They are per-account — a user can be Owner on one account and Member on another. Role assignment and hierarchy are managed by Bush, not WorkOS.

**Role hierarchy (most to least permissive):**
```
owner > content_admin > member > guest > reviewer
```

Implemented as `ROLE_HIERARCHY` in `src/auth/types.ts`. Use `isRoleAtLeast(roleA, roleB)` for all comparisons; never compare role strings directly.

---

#### 1.1 Account Owner

**Phase: MVP**

The founding member of an account. Exactly one per account (transferable).

**Capabilities:**
- All `content_admin` capabilities
- Billing management: read and write plan/subscription
- Plan management: upgrade, downgrade, cancel
- Security settings: MFA enforcement, session timeout policies, IP allowlisting, allowed auth methods
- Assign or remove `content_admin` role
- Transfer ownership to another member
- Delete the account

**System behavior:** Owner always receives `full_access` on every workspace, project, and folder via `admin_override` in the permission service. No permission record is needed in `workspace_permissions` / `project_permissions` / `folder_permissions`. Restricted projects and restricted folders do not block Owner access.

**Role capabilities (from `src/auth/types.ts`):**
```
billing:read, billing:write, plan:read, plan:write,
users:read, users:write, users:delete,
security:read, security:write,
content:read, content:write, content:delete,
shares:read, shares:write, shares:delete,
settings:read, settings:write
```

---

#### 1.2 Content Admin

**Phase: MVP**

A power user who manages all content and members but has no billing access.

**Capabilities:**
- All content operations: upload, edit, move, delete any file in any project/workspace
- User management: invite members, assign Member and Guest roles, remove users
- Create and delete workspaces and projects (including restricted ones)
- Create and revoke share links
- Read account settings (no write)
- Cannot access billing or change plan
- Cannot assign Content Admin or Owner role

**System behavior:** Content Admin receives `full_access` on every workspace, project, and folder via `admin_override`. Restricted projects and restricted folders do not block Content Admin access.

**Role capabilities:**
```
users:read, users:write,
content:read, content:write, content:delete,
shares:read, shares:write, shares:delete,
settings:read
```

---

#### 1.3 Member

**Phase: MVP**

A standard collaborator whose access is determined by their resource-level permission grants.

**Capabilities:**
- Access only workspaces and projects where they have been explicitly granted a permission level
- Actions within those resources are gated by their permission level (see Section 2)
- Can create shares (if permission level allows)
- Cannot manage users or account settings
- Cannot access billing

**System behavior:** No admin override. Permission lookup follows the full inheritance chain (workspace → project → folder). If a Member has no permission record for a resource, access is denied.

**Role capabilities:**
```
content:read, content:write,
shares:read, shares:write
```

---

#### 1.4 Guest

**Phase: MVP**

A limited external collaborator with a hard project ceiling.

**Capabilities:**
- Access to at most 1 project (enforced by `GUEST_CONSTRAINTS.MAX_PROJECTS = 1`)
- Actions within the project gated by their permission level
- Cannot invite other users (`GUEST_CONSTRAINTS.CAN_INVITE = false`)
- Cannot delete content (`GUEST_CONSTRAINTS.CAN_DELETE = false`)
- No workspace-level access (even if granted a workspace permission, the guest constraint still applies)

**System behavior:** Guest constraints are checked by `checkGuestConstraints()` in `src/permissions/middleware.ts` before guest-blocked operations. The middleware checks `session.accountRole === "guest"` and enforces the relevant constraint. Permission inheritance still applies within the one allowed project.

**Role capabilities:**
```
content:read
```

**Promotion path:** A Guest can be promoted to Member by a Content Admin or Owner. The promotion is immediate; Redis session cache is invalidated.

**Edge case — Guest with workspace permission:** If a Guest is accidentally granted a workspace-level permission, the guest constraint (1-project limit, no delete, no invite) still applies. The guest constraint check runs independently of the permission check.

**Edge case — Guest at project limit invited to a second project:** The invitation can be created by an admin, but the Guest will be blocked from accessing the second project until promoted to Member or the first project access is revoked.

---

#### 1.5 Reviewer

**Phase: MVP**

An external reviewer who accesses content exclusively through share links. Has no dashboard access and no account membership in the traditional sense.

**Capabilities:**
- View assets in the share (always)
- Comment on assets (if `shares.allow_comments = true`)
- Download assets (if `shares.allow_downloads = true`)
- No access to any project, workspace, or account resources outside the share

**System behavior:** Reviewers authenticate via the share link flow (see Section 4). Their `account_memberships.role` is `reviewer` if they have a Bush account that was used to access a share, but this role alone grants no resource access. All access is gated by share link validity.

**Role capabilities:**
```
content:read
```

---

### 2. Permission Levels

Permission levels are stored in `workspace_permissions.permission`, `project_permissions.permission`, and `folder_permissions.permission`. The type is `PermissionLevel` defined in `src/permissions/types.ts`.

**Permission hierarchy (most to least permissive):**
```
full_access > edit_and_share > edit > comment_only > view_only
```

Implemented as `PERMISSION_HIERARCHY` in `src/permissions/types.ts`. Use `isPermissionAtLeast(a, b)` for all comparisons; never compare strings directly.

---

#### 2.1 Full Access

**Phase: MVP**

Complete control over the resource and its contents, including membership management.

**Allowed actions:**
- view, comment, download, edit, delete
- share (create and revoke share links)
- manage_permissions (grant/revoke permissions for other users)
- create_project, create_restricted_project (at workspace level)
- add_members (invite users to workspace/project)
- delete_workspace

**Excludes:** Billing, plan management, account security settings — those are role-level capabilities of Owner only.

---

#### 2.2 Edit & Share

**Phase: MVP**

Full editorial control with sharing capability but no member management.

**Allowed actions:**
- view, comment, download, edit
- share (create and revoke share links)
- create_project (at workspace level)

**Blocked actions:**
- manage_permissions, add_members, delete (of the resource itself), delete_workspace, create_restricted_project

---

#### 2.3 Edit

**Phase: MVP**

Upload, organize, and modify assets but no sharing or downloading.

**Allowed actions:**
- view, comment, edit
- create_project (at workspace level)

**Blocked actions:**
- download, share, manage_permissions, add_members, delete, delete_workspace, create_restricted_project

---

#### 2.4 Comment Only

**Phase: MVP**

Read and annotate but no modifications.

**Allowed actions:**
- view, comment

**Blocked actions:**
- download, share, edit, delete, manage_permissions, add_members, create_project, delete_workspace

---

#### 2.5 View Only

**Phase: MVP**

Minimum access — read-only, no annotations.

**Allowed actions:**
- view

**Blocked actions:**
- comment, download, share, edit, delete, manage_permissions, add_members, create_project, delete_workspace

---

### 3. Action-to-Permission Mapping

The canonical mapping from action to minimum required permission level. Defined as `ACTION_PERMISSIONS` in `src/permissions/types.ts`.

| Action | Minimum Permission Required |
|--------|-----------------------------|
| `view` | `view_only` |
| `comment` | `comment_only` |
| `download` | `edit_and_share` |
| `share` | `edit_and_share` |
| `edit` | `edit` |
| `delete` | `full_access` |
| `manage_permissions` | `full_access` |
| `create_project` | `edit` |
| `create_restricted_project` | `full_access` |
| `add_members` | `full_access` |
| `delete_workspace` | `full_access` |

Use `canPerformAction(permission, action)` from `src/permissions/types.ts` to evaluate. This function calls `isPermissionAtLeast(permission, ACTION_PERMISSIONS[action])`.

---

### 4. Permission Matrices

#### 4.1 Role × Account Capability

| Capability | Owner | Content Admin | Member | Guest | Reviewer |
|------------|:-----:|:-------------:|:------:|:-----:|:--------:|
| Billing read/write | Y | N | N | N | N |
| Plan read/write | Y | N | N | N | N |
| Security settings | Y | N | N | N | N |
| Assign Owner/Content Admin role | Y | N | N | N | N |
| Assign Member/Guest role | Y | Y | N | N | N |
| Remove users | Y | Y | N | N | N |
| Create workspaces | Y | Y | N | N | N |
| Delete workspaces | Y | Y | N | N | N |
| Create restricted projects | Y | Y | N | N | N |
| Full access to all content | Y | Y | N | N | N |
| Upload/edit content | Y | Y | Depends on permission level | Depends on permission level | N |
| View content | Y | Y | Depends on permission level | Depends on permission level | Share only |
| Create share links | Y | Y | Depends on permission level | N | N |
| Account settings read | Y | Y | N | N | N |
| Invite users | Y | Y | N | N | N |

---

#### 4.2 Permission Level × Action

| Action | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|:-----------:|:------------:|:----:|:------------:|:---------:|
| View | Y | Y | Y | Y | Y |
| Comment | Y | Y | Y | Y | N |
| Download | Y | Y | N | N | N |
| Edit (upload, rename, move, update metadata) | Y | Y | Y | N | N |
| Share (create/revoke share links) | Y | Y | N | N | N |
| Delete (files, folders) | Y | N | N | N | N |
| Manage permissions | Y | N | N | N | N |
| Add members | Y | N | N | N | N |
| Create project | Y | Y | Y | N | N |
| Create restricted project | Y | N | N | N | N |
| Delete workspace | Y | N | N | N | N |

---

#### 4.3 Reviewer Tier × Share Action

| Action | Authenticated Reviewer | Identified Reviewer | Unidentified Reviewer |
|--------|:----------------------:|:-------------------:|:---------------------:|
| View assets in share | Y | Y | Y |
| Comment (if allowed_comments = true) | Y | Y | Y (anonymous) |
| Download (if allow_downloads = true) | Y | Y | Y |
| Access other projects | N | N | N |
| Access account dashboard | N | N | N |
| View internal comments (is_internal = true) | N | N | N |

---

### 5. Permission Inheritance

Permissions flow down the resource hierarchy from workspace to project to folder. The rule: **effective permission is the most permissive of all applicable grants, but can never be lowered below an inherited grant at a higher level.**

#### 5.1 Standard Inheritance Chain

```
Workspace Permission
    └── cascades to all non-restricted Projects in the workspace
            └── cascades to all non-restricted Folders in the project
                    └── applies to all Files in the folder
```

**Resolution algorithm (implemented in `permissionService`, `src/permissions/service.ts`):**

For a project access check:
1. If user is Owner or Content Admin → return `full_access` (admin_override)
2. If project is restricted → check `project_permissions` only; deny if absent
3. Check `project_permissions` for a direct grant → return if found
4. Fall back to `workspace_permissions` → return inherited permission if found
5. No access

For a folder access check:
1. If user is Owner or Content Admin → return `full_access` (admin_override)
2. If folder is restricted → check `folder_permissions` only; deny if absent
3. Check `folder_permissions` for a direct grant → return if found
4. Fall back to `getProjectPermission(userId, folder.projectId)` (which itself applies restriction + inheritance logic)
5. No access

#### 5.2 Permission Elevation Rule

When a direct permission is set on a project or folder, it must be **at least as permissive** as the inherited permission from the parent. This is enforced by `validatePermissionChange()` in the permission service.

Example: If a user has `edit_and_share` via workspace inheritance, a direct project permission of `view_only` is invalid and rejected. The minimum valid direct permission would be `edit_and_share`.

**This rule does not apply when a resource is restricted.** Restricted resources break the inheritance chain entirely, so the direct permission on a restricted resource is the sole authority (no inherited floor).

#### 5.3 Restricted Projects

**Phase: MVP**

A project with `is_restricted = true` breaks workspace-level inheritance.

- Workspace permission is **ignored** for restricted projects
- Only `project_permissions` records grant access
- Account Owner and Content Admin always retain access (admin_override bypasses restriction)
- Only users with `full_access` (or Owner/Admin) can create restricted projects (`create_restricted_project` action)
- Guest limit still applies

**Creating a restricted project from a non-restricted workspace:**
When a project is made restricted, all existing inherited access (from workspace permissions) is immediately severed. Users who only had workspace-level access lose project access until explicitly added to `project_permissions`.

#### 5.4 Restricted Folders

**Phase: Phase 2**

A folder with `is_restricted = true` breaks project-level inheritance.

- Project permission is **ignored** for restricted folders
- Only `folder_permissions` records grant access
- Account Owner and Content Admin always retain access
- Only users with `full_access` at the project level (or Owner/Admin) can mark a folder as restricted

---

### 6. Share Link Access

Share links provide access to a curated set of files for external collaborators without requiring a Bush account.

#### 6.1 Share Structure

A share (`shares` table) contains:
- A cryptographically random slug (min 32 bytes, URL-safe base64)
- Optional bcrypt-hashed passphrase
- Optional expiration date
- Per-share toggles: `allow_comments`, `allow_downloads`, `show_all_versions`, `show_transcription`
- A list of included files via `share_assets`
- Optional branding configuration

Share access does not derive from resource-level permission levels. It is entirely self-contained — the share record itself defines what is allowed.

#### 6.2 Reviewer Tiers

Three tiers of reviewer identity, in increasing trust order:

**Unidentified Reviewer (Anonymous)**
- Accesses a public share link without any identity verification
- Comments attributed to "Anonymous"
- Session scoped to the share; no access outside it
- No session stored server-side beyond rate limiting context

**Identified Reviewer**
- Invited by share creator via email
- Must verify email via a one-time code
- Receives a limited session cookie scoped to that specific share
- Comments attributed to their verified email address
- Session TTL matches share expiration
- Can be promoted to Guest or Member by accepting an account invitation

**Authenticated Reviewer**
- A logged-in Bush user who clicks a share link
- Identified by their full session; Bush user ID recorded in activity
- Can view internal comments if they have a resource-level permission (not just via share)

#### 6.3 Share Access Flow

1. Visitor requests `GET /s/{slug}`
2. If share has `passphrase`:
   a. Check `share_auth_attempts` for brute-force lockout (per share + IP)
   b. If locked, return **429 Too Many Requests** with `Retry-After` header
   c. Require passphrase entry (rate-limited at 30 req/min per IP as global safety net)
   d. On failure: increment attempt counter, log `auth_failed` to `share_activity`
   e. Lockout thresholds: **5 failures → 10 min**, **10 → 30 min**, **20+ → 2 hours**
   f. On success: reset attempt counter
3. If share has `expires_at < now()`, return 410 Gone
4. Check reviewer tier (authenticated user vs. identified session vs. anonymous)
5. Serve only the files listed in `share_assets`
6. Log activity to `share_activity` with `type = "view"`, `viewer_email` (if identified/authenticated), `viewer_ip`, `user_agent`

#### 6.4 Share Access Control

Reviewers via share links **cannot**:
- Access any resource not explicitly included in the share's `share_assets`
- Access the account dashboard, project browser, or folder structure
- See `is_internal = true` comments (unless they have direct project access as an authenticated user)
- Access a share from a different account, project, or user than the one that created it

The share is validated to belong to the current account before serving. A reviewer attempting to access project APIs is denied — the share session is not a project permission.

#### 6.5 Share Revocation

A share creator (or any user with `edit_and_share` or above on the project) can revoke a share at any time by deleting the share record. All active sessions that were created via that share become invalid on next request (session check fails because the share no longer exists).

---

### 7. Resource-Level Access Control Functions

These functions in `src/api/access-control.ts` are the canonical gate for verifying resource ownership. All API route handlers must use these instead of ad-hoc DB queries.

#### `verifyProjectAccess(projectId, accountId)`

Verifies a project belongs to the given account by joining `projects` → `workspaces` on `workspace_id`. Returns `{ project, workspace }` or `null` if the project does not exist or belongs to a different account.

**Use when:** Any route handler that receives a `projectId` path parameter. Call before any permission check to ensure the project is in scope for the authenticated account.

```typescript
const access = await verifyProjectAccess(projectId, session.currentAccountId);
if (!access) throw new NotFoundError("project");
```

#### `verifyFolderAccess(folderId, accountId)`

Verifies a folder belongs to the account by joining `folders` → `projects` → `workspaces`. Returns `{ folder, project, workspace }` or `null`.

#### `verifyWorkspaceAccess(workspaceId, accountId)`

Verifies a workspace belongs to the account (`WHERE workspaces.account_id = accountId`). Returns the workspace or `null`.

#### `verifyAccountMembership(userId, accountId, requiredRole?)`

Verifies a user is a member of the account. If `requiredRole` is provided, also checks `isRoleAtLeast(actualRole, requiredRole)`. Returns the user's actual `AccountRole` or `null`.

**Use when:** Routes that need to confirm the acting user is a member (and optionally has a minimum role) independently of the resource hierarchy — for example, when inviting a user to a project or managing webhooks.

#### `verifyAccountAccess(targetAccountId, currentAccountId)`

Confirms the session's current account matches the target account (simple equality check). Returns `boolean`. Used for cross-account guard before any account-scoped operation.

---

### 8. Permission Middleware

Hono middleware in `src/permissions/middleware.ts` provides declarative permission enforcement for API routes.

#### `requirePermission(options)`

Creates a Hono middleware that:
1. Requires an authenticated session
2. Extracts resource ID from the request (path param or function)
3. Calls `permissionService.canPerformAction(userId, resourceType, resourceId, action)`
4. Throws `AuthorizationError` if denied

```typescript
// Example: protect an upload route
app.post('/projects/:projectId/files',
  requirePermission({
    resourceType: 'project',
    resourceIdSource: 'projectId',
    action: 'edit',
  }),
  uploadHandler
);
```

#### `requirePermissionLevel(resourceType, resourceIdParam, requiredLevel)`

Checks that the user's effective permission on the resource is at least `requiredLevel`. Throws if not. Useful when you need to gate on a specific permission threshold rather than a named action.

#### `requireAccountAdmin(c, next)`

Allows only `owner` or `content_admin` session roles. Throws `AuthorizationError` for all other roles.

#### `requireAccountOwner(c, next)`

Allows only `owner` session role.

#### `requireNotGuest(operation)`

Creates a middleware that enforces guest constraints for `delete`, `invite`, or `create_project` operations. Checks `session.accountRole === "guest"` and applies the relevant `GUEST_CONSTRAINTS` rule.

---

### 9. Edge Cases

#### 9.1 Guest Promoted to Member

- Promotion executed by Content Admin or Owner changing `account_memberships.role`
- Redis session cache invalidated for that user immediately
- Guest constraint checks (`checkGuestConstraints`) will no longer block on next request
- The user retains all permission records they had as a Guest; no permission records are modified
- The 1-project limit no longer applies; user can now be granted access to additional projects

#### 9.2 Member Demoted to Guest

- Change `account_memberships.role` to `guest`
- Redis session cache invalidated
- On next request, guest constraints apply
- If the user already has permissions on more than 1 project, the constraint check blocks the additional projects at request time — the permission records are not automatically cleaned up
- Admin should manually revoke excess project permissions to restore consistency

#### 9.3 Reviewer Accessing Resources Outside Their Share

- Share session cookies are scoped to a specific share
- Any attempt to call project or workspace API endpoints with a share session returns `403 Forbidden`
- `verifyProjectAccess` does not use share context; it checks account membership only
- No bypass mechanism exists

#### 9.4 Reviewer Session After Share Revocation

- Share is deleted → `shares` row removed
- Reviewer's session still exists in Redis but the share slug no longer resolves
- On the next share page load, `GET /s/{slug}` returns 404
- Session remains in Redis until TTL expires; it simply cannot resolve any share content

#### 9.5 User with Both Direct and Inherited Permissions

- Resolution always uses the `maxPermission` of all applicable grants (admin override, direct, inherited)
- Example: workspace grants `comment_only`, project has a direct `edit` grant → effective permission is `edit`
- The inheritance rule (cannot lower below inherited) is enforced on write; on read, the most permissive valid grant wins

#### 9.6 Workspace Permission Granted After Restricted Project Exists

- New workspace permission does not cascade into existing restricted projects
- Users who gain workspace access still cannot access restricted projects unless explicitly added to `project_permissions`

#### 9.7 Custom Field `editable_by` vs. Permission Level

- Custom field definitions have an `editable_by` setting: `admin` or `full_access`
- `admin` means only Owner or Content Admin can change that field's values on any file
- `full_access` means any user with `full_access` permission on the project can change values
- This is a field-level restriction layered on top of resource permissions — both must be satisfied

#### 9.8 Internal Comments Visibility

- Comments with `is_internal = true` are hidden from Reviewers accessing via share links
- Authenticated users with at least `view_only` on the project see internal comments regardless of share context
- API routes filter `is_internal` based on whether the request is a share session or an authenticated project session

---

### 10. Phase Summary

| Feature | Phase |
|---------|-------|
| Account roles (Owner, Content Admin, Member, Guest, Reviewer) | MVP |
| Five permission levels | MVP |
| Workspace and project permission inheritance | MVP |
| Restricted Projects | MVP |
| Guest constraints (1-project limit, no delete, no invite) | MVP |
| Share link access (all 3 reviewer tiers) | MVP |
| Permission middleware (requirePermission, requireAccountAdmin) | MVP |
| Resource access control helpers (verifyProjectAccess, etc.) | MVP |
| Folder permissions | Phase 2 |
| Restricted Folders | Phase 2 |
| Access Groups (bulk permission management) | Phase 2 |
| API keys (service-to-service, `bush_key_` token type) | Phase 2 |

---

## Cross-References

- `02-authentication.md` — Account roles, session data (`SessionData.accountRole`), reviewer access tiers and share link session flow, Guest upgrade path, role assignment rules
- `04-api-reference.md` (see `04-api-reference.md`) — Per-endpoint permission requirements, how `requirePermission` middleware is applied to each route
- `12-security.md` (see `12-security.md`) — Restricted Projects and Folders (Section 2.3), Access Groups (Section 2.4), Share link security and passphrase/expiration (Section 2.5), audit logging of permission events (Section 4.1)
