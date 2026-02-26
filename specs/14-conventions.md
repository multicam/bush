# Cross-Cutting Conventions

**Status**: Active reference
**Audience**: All contributors. Read this before touching any module.

---

## Overview

This spec defines the patterns that every other spec and every module in the Bush codebase depends on. It is the single source of truth for how errors are structured, how IDs are generated, how access is controlled, and how the codebase is organized. When a pattern is described here, it is mandatory — not a suggestion. Deviations from these conventions require an explicit reason documented at the deviation site.

---

## Specification

### Error Handling

#### AppError Hierarchy

All application errors extend the abstract `AppError` base class defined in `src/errors/index.ts`. Never throw raw `Error` objects from route handlers or service functions. The full hierarchy:

| Class | HTTP Status | Code | When to Use |
|-------|-------------|------|-------------|
| `ValidationError` | 422 | `validation_error` | Input fails schema validation; supports `source.pointer` / `source.parameter` |
| `BadRequestError` | 400 | `bad_request` | Malformed request that is not a schema violation |
| `AuthenticationError` | 401 | `unauthorized` | No valid session or token present |
| `AuthorizationError` | 403 | `forbidden` | Authenticated but lacks permission |
| `NotFoundError` | 404 | `not_found` | Resource does not exist or is not visible to caller |
| `ConflictError` | 409 | `conflict` | Duplicate, version mismatch, or state transition violation |
| `RateLimitError` | 429 | `rate_limit_exceeded` | Request exceeds rate limit; carries `retryAfter` seconds |
| `ServiceUnavailableError` | 503 | `service_unavailable` | Downstream dependency is down |
| `InternalServerError` | 500 | `internal_error` | Unexpected failure not mapped to a specific class |

#### Error Response Format

All API error responses use the JSON:API errors envelope:

```json
{
  "errors": [
    {
      "title": "Not Found",
      "detail": "File with id 'fil_abc123' not found",
      "status": 404,
      "code": "not_found"
    }
  ]
}
```

For validation errors that target a specific field, `source` is included:

```json
{
  "errors": [
    {
      "title": "Validation Error",
      "detail": "must be a valid email address",
      "status": 422,
      "code": "validation_error",
      "source": { "pointer": "/data/attributes/email" }
    }
  ]
}
```

Multiple validation failures can be returned in a single response using `toMultiErrorResponse(errors)`.

#### HTTP Status Code Mapping

| Situation | Status |
|-----------|--------|
| Input schema invalid | 422 |
| Request malformed (not schema) | 400 |
| No session / token missing | 401 |
| Insufficient permissions | 403 |
| Resource not found | 404 |
| Duplicate / state conflict | 409 |
| Too many requests | 429 |
| Upstream service unavailable | 503 |
| Unexpected server failure | 500 |

#### Error Propagation

```
Backend service throws AppError subclass
  → Route handler catches, calls toErrorResponse(err)
    → Hono sends JSON response with correct status
      → Next.js frontend receives non-2xx response
        → Toast shown for transient errors (upload failed, network error)
        → Inline field error shown for validation errors (form context)
        → Full-page error state for page-load failures
```

#### Error Logging

`toAppError(unknown)` converts any caught value to an `AppError`. It **always logs the original error first** before wrapping, preserving debugging context that would otherwise be lost:

```typescript
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  // Log original before converting — never lose the stack trace
  if (error instanceof Error) {
    console.error("[toAppError] Unexpected error:", error.message, error.stack);
  } else {
    console.error("[toAppError] Unexpected non-Error thrown:", error);
  }

  return new InternalServerError("An unexpected error occurred");
}
```

Use `errorLogger` (also in `src/errors/index.ts`) for structured JSON log output in route handlers. It includes `request_id`, `user_id`, `account_id`, and `timestamp` automatically.

Internal error details are never leaked to API consumers — `InternalServerError` always returns a generic message.

---

### ID Generation

#### Format

All entity IDs follow the pattern `{prefix}_{24-hex-chars}`, generated via `generateId(prefix)` in `src/shared/id.ts`:

```typescript
generateId("usr")  // => "usr_a1b2c3d4e5f6a1b2c3d4e5f6"
generateId("acc")  // => "acc_f6e5d4c3b2a1f6e5d4c3b2a1"
```

The implementation uses `crypto.randomBytes(16)` — cryptographically secure, no external dependency.

#### Prefix Registry

| Prefix | Entity |
|--------|--------|
| `usr_` | User |
| `acc_` | Account |
| `wks_` | Workspace |
| `prj_` | Project |
| `fld_` | Folder |
| `fil_` | File |
| `ver_` | Version |
| `cmt_` | Comment |
| `shr_` | Share |
| `col_` | Collection |
| `ntf_` | Notification |
| `req_` | Request (for `generateRequestId()`) |

The prefix registry is the single source of truth. If a new entity type is added, its prefix is added here and only generated via `generateId()`. Never generate IDs inline with `nanoid()`, `uuid()`, or any other call.

#### Rule

```
No duplicate ID generators.
Always import generateId from src/shared/id.ts.
```

---

### Code Patterns

#### Role and Permission Comparisons

Role hierarchy is defined once in `src/auth/types.ts` as `ROLE_HIERARCHY`. Permission hierarchy is defined once in `src/permissions/types.ts` as `PERMISSION_HIERARCHY`. All comparisons go through their respective helper:

```typescript
isRoleAtLeast(userRole, "content_admin")      // true if userRole >= content_admin
isPermissionAtLeast(userPerm, "edit")          // true if userPerm >= edit
```

Never inline role comparisons like `role === "owner" || role === "content_admin"`. The hierarchy must be expressed in one place.

#### API Access Control

Resource ownership verification is centralized in `src/api/access-control.ts`:

| Function | Verifies |
|----------|---------|
| `verifyProjectAccess(projectId, accountId)` | Project belongs to account (joins projects + workspaces) |
| `verifyFolderAccess(folderId, accountId)` | Folder belongs to account (joins folders + projects + workspaces) |
| `verifyWorkspaceAccess(workspaceId, accountId)` | Workspace belongs to account |
| `verifyAccountMembership(userId, accountId, requiredRole?)` | User is account member with optional minimum role |

Every route handler that touches a resource owned by an account calls the appropriate function from this module. No per-route ownership SQL queries.

#### Session Cookie Logic

Session cookie encoding/decoding is centralized in `src/web/lib/session-cookie.ts`. Use `encodeSessionCookie()`, `decodeSessionCookie()`, and the `BUSH_SESSION_COOKIE` constant. Never write cookie parsing or serialization inline in a route or page.

#### Route Handler Design

Route handlers intentionally vary. File status transitions, folder hierarchy operations, and project archival each have distinct business rules. Do **not** create generic CRUD helpers that paper over these differences. A small amount of duplication in route handlers is preferable to an abstraction that obscures the rules.

The extraction threshold: **2+ locations duplicating the same logic**. Three similar lines of code in different routes is better than a premature shared helper. When duplication does reach threshold, place the extracted module in:

- Cross-cutting utilities → `src/shared/`
- Auth/role logic → `src/auth/types.ts`
- API access patterns → `src/api/access-control.ts`
- Web utilities → `src/web/lib/`

---

### API Conventions

#### Versioning and Base Path

All API endpoints are served at `/v4/*`. The Hono API server runs on port 3001. Caddy routes `/v4/*` to the API; all other paths go to Next.js on port 3000. No CORS is needed — single domain, path-based routing.

#### Response Format

Successful responses use the JSON:API-style data envelope:

```json
{
  "data": { ... }
}
```

or for lists:

```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "fil_abc123",
    "has_more": true
  }
}
```

Error responses use the errors envelope described above.

#### Pagination

Cursor-based pagination throughout. The cursor is an opaque string (typically the last item's ID). Clients pass `?cursor=fil_abc123&limit=50`. The response includes `pagination.cursor` (next page cursor) and `pagination.has_more` (boolean). Offset-based pagination is not used.

#### Timestamps

All timestamps are ISO 8601 UTC strings: `"2026-02-27T14:30:00.000Z"`. Never return Unix epoch integers.

#### IDs in Responses

All resource IDs are prefixed nanoid strings (e.g., `"fil_a1b2c3..."`). Never return bare integers or UUIDs as resource identifiers.

---

### Testing Conventions

#### Test Runner and Coverage

Vitest with the v8 coverage provider. Run all tests with `bun run test`. Coverage report with `bun run test:coverage`.

#### Coverage Scope

Backend `src/` only. The web frontend (`src/web/`) is excluded from coverage metrics. Also excluded: `src/db/migrate.ts`, `src/db/seed.ts`, and all test files themselves.

#### Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | > 60% |
| Branches | > 75% |
| Functions | > 60% |

#### Quality Gate

Before merging any feature or fix, all three must pass:

```bash
bun run test && bun run typecheck && bun run lint
```

Failing tests block the merge. Failing typecheck or lint block the merge. There are no exceptions.

#### Test Organization

- Unit tests for pure utilities and service functions
- Integration tests for route handlers (mock the database, not HTTP)
- Edge cases and error paths are first-class — happy path coverage alone is insufficient

---

## Cross-References

- `04-api-reference.md` — Full API endpoint catalog, request/response schemas, authentication flow
- `02-authentication.md` — Session management, WorkOS AuthKit integration, cookie patterns
- `03-permissions.md` — Role hierarchy, permission levels, workspace/project access rules
- `04-api-reference.md` — Complete V4 API reference including error format specification (Section 3.4–3.5)
