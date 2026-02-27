# Code Review Plan

**Last updated**: 2026-02-27
**Iteration**: 13
**Coverage**: 84.14% statements (target: 80%)
**Tests**: 2934 passing, 41 skipped

## Issue Tracker

### Critical (bugs, security)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| C1 | src/api/routes/bulk.ts | 383-384 | SQL injection risk with raw SQL in bulk delete - use inArray() | **fixed** |
| C2 | src/transcription/processor.ts | 49-54 | AssemblyAI provider throws at runtime - use validated config | **fixed** |
| C3 | src/web/app/layout.tsx | 49 | Empty catch block swallows theme initialization errors | **fixed** |
| C4 | src/web/context/auth-context.tsx | 68-85 | refresh() lacks cancellation - state update after unmount | **fixed** |
| C5 | src/web/lib/ws-client.ts | 468-470 | WebSocket lifecycle listeners never removed | **fixed** |

### High (code smells, missing validation)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| H1 | src/api/routes/auth.ts | 251-260 | Missing pagination on /auth/me - unbounded queries | **fixed** |
| H2 | src/api/routes/bulk.ts | 204-229 | N+1 query problem in bulk file copy | **fixed** |
| H3 | src/api/routes/bulk.ts | 293-301 | Race condition in storage usage updates - non-atomic | **fixed** |
| H4 | src/api/routes/accounts.ts | 105-106 | Manual validation instead of Zod schema | **fixed** |
| H5 | src/api/routes/metadata.ts | 145 | Missing Zod validation on PUT endpoint | **fixed** |
| H6 | src/web/components/viewers/video-viewer.tsx | 453-463 | Stale closure with duration variable in shuttle controls | **fixed** |
| H7 | src/web/components/notifications/notification-dropdown.tsx | 144-150 | window.location.href causes full page reload - use router.push | **fixed** |
| H8 | src/web/hooks/use-realtime.ts | 106-127 | Socket not disconnected on unmount - confusing behavior | **fixed** |
| H9 | src/web/lib/api.ts | 196 | Retry logic incomplete for 429 responses | **fixed** |
| H10 | src/auth/session-cache.ts | 403-436 | Legacy cookie format support - security risk | **fixed** |
| H11 | src/api/routes/webhooks.ts | 445-463 | SSRF risk - webhook test allows arbitrary URLs | **fixed** |

### Medium (refactoring, test gaps)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| M1 | src/db/schema.ts | 274-294 | Missing index on comments.created_at for ordering | **fixed** |
| M2 | src/api/router.ts | 29-38 | Stack traces leaked in production error responses | **fixed** |
| M3 | src/api/routes/comments.ts | 114 | Unbounded comment text length - no DB constraint | **fixed** |
| M4 | src/api/routes/search.ts | 87-105 | LIKE wildcards not escaped in FTS5 query | **fixed** |
| M5 | src/api/routes/bulk.ts | - | No rate limiting on expensive bulk operations | **fixed** |
| M6 | src/config/env.ts | 187-205 | BackupProvider env var defined but class not implemented | **fixed** (false positive - class exists in src/storage/backup-provider.ts, env vars used in src/storage/index.ts) |
| M7 | src/web/app/projects/[id]/files/[fileId]/page.tsx | 84-111 | No AbortController for file fetch | **fixed** |
| M8 | src/web/components/annotations/annotation-canvas.tsx | 569-577 | Callback chain creates unnecessary re-renders | **fixed** |
| M9 | src/web/components/annotations/annotation-overlay.tsx | 88-94 | Excessive history pushes on external annotation change | **fixed** |
| M10 | src/web/components/ui/dropdown.tsx | 160-183 | Missing aria-label for icon triggers | **fixed** |
| M11 | src/web/components/ui/modal.tsx | 89-140 | Focus restore to removed element | **fixed** |
| M12 | Multiple | - | Extensive console.log usage - secrets exposure risk | **fixed** |
| M13 | Multiple | - | No CSRF protection for cookie-based requests | **fixed** |
| M14 | src/transcription/processor.ts | 80 | FFmpeg spawn with configurable path - command injection risk | **fixed** |
| M15 | src/api/auth-middleware.ts | - | Failed authentication not logged | **fixed** |

### Low (style, naming, minor cleanup)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| L1 | src/web/components/shares/share-builder.tsx | 73-77 | Missing null checks on share attributes | **fixed** |
| L2 | src/web/components/version-stacks/version-stack-compare.tsx | 58-108 | No cancellation on fileIds change | **fixed** |
| L3 | Multiple | - | Type assertions (as any) in test files | pending |
| L4 | Multiple | - | Hardcoded localhost URLs in tests | pending |
| L5 | Multiple | - | Magic numbers for dimensions/timeouts | pending |
| L6 | src/realtime/ws-manager.ts | 103-113 | Hardcoded rate limit constants | **fixed** (now configurable via WS_* env vars in config) |
| L7 | src/api/routes/bulk.ts | 24 | Hardcoded MAX_BULK_ITEMS = 100 | **fixed** (now configurable via BULK_MAX_ITEMS env var) |
| L8 | src/config/env.ts | 109-114 | Default SMTP settings could be used in production | **fixed** (production validation prevents default SMTP values) |

## Coverage Gaps (files below 80%)
| File | Statements | Branches | Functions | Priority |
|------|-----------|----------|-----------|----------|
| src/media/worker.ts | 0% | 0% | 0% | HIGH |
| src/scheduled/worker.ts | 0% | 0% | 0% | HIGH |
| src/shared/cn.ts | 0% | 0% | 0% | LOW |
| src/config/env.ts | 90.32% | 55.55% | 66.66% | MEDIUM |
| src/lib/email/index.ts | 60.81% | 71.42% | 100% | MEDIUM |
| src/lib/email/postmark.ts | 72.72% | 63.15% | 77.77% | LOW |
| src/lib/email/resend.ts | 66.03% | 40% | 75% | LOW |
| src/lib/email/sendgrid.ts | 73.03% | 67.5% | 80% | LOW |
| src/media/ffmpeg.ts | 75.7% | 98.33% | 81.81% | MEDIUM |
| src/scheduled/run-purge.ts | 58.82% | 50% | 100% | LOW |
| src/transcription/processor.ts | 64.98% | 76.08% | 66.66% | HIGH |
| src/storage/index.ts | 79% | 87.87% | 92.85% | MEDIUM |

## Skipped Tests
| File | Line | Description |
|------|------|-------------|
| src/permissions/permissions-integration.test.ts | 86 | Skipped when better-sqlite3 not available |
| src/web/__tests__/dashboard.spec.ts | 13 | Skipped - requires credentials not in CI |

## Iteration Log
### Iteration 13 -- 2026-02-27
- Fixed: L1, L2, L6, L7, L8 (low priority issues)
- Coverage: 82.99% → 84.14% (+1.15pp)
- Changes:
  - L1: Added null checks on share attributes in share-builder.tsx using optional chaining
  - L2: Added cancellation support in version-stack-compare.tsx with `cancelled` flag pattern
  - L6: Already fixed - WS rate limits configurable via WS_* env vars (WS_MAX_SUBSCRIPTIONS, WS_RATE_LIMIT_MESSAGES, etc.)
  - L7: Made MAX_BULK_ITEMS configurable via BULK_MAX_ITEMS env var (default: 100)
  - L8: Already fixed - production validation prevents default SMTP settings
- Coverage improvements:
  - Added 22 tests for workspace member management routes (GET/POST/PUT/DELETE /:id/members)
  - Tests cover: list members, add member, update permission, remove member, error cases
  - Removed workspaces.ts from coverage gaps (was 36.33%, now above 80%)
- Tests: 2934 passing, 41 skipped (22 new tests)
- Status: 5 low issues resolved, coverage above 80% target

### Iteration 12 -- 2026-02-27
- Fixed: M13 (No CSRF protection for cookie-based requests)
- Security: Implemented Double Submit Cookie pattern with Origin header validation
- Changes:
  - Created src/api/csrf.ts with CSRF token generation, validation, and middleware
  - Added CsrfError to src/errors/index.ts for proper error handling
  - Updated src/api/index.ts to apply csrfMiddleware globally
  - Updated src/api/routes/auth.ts to include CSRF token in /auth/me response
  - Added GET /v4/auth/csrf-token endpoint for fetching tokens
  - Updated src/web/lib/api.ts to include X-CSRF-Token header in state-changing requests
  - Updated src/web/context/auth-context.tsx to fetch and manage CSRF tokens
- CSRF protection features:
  - Double Submit Cookie: Token stored in HttpOnly cookie + sent in response body
  - Timing-safe comparison to prevent timing attacks
  - Origin header validation for additional protection
  - Skipped for bearer token requests (inherently CSRF-safe)
  - Skipped for requests without cookies (no session = no CSRF risk)
- Tests: 18 CSRF tests passing in src/api/csrf.test.ts
- Status: M13 resolved with comprehensive CSRF protection

### Iteration 11 -- 2026-02-27
- Fixed: M9 (Excessive history pushes on external annotation change)
- Performance: Debounced and deduplicated history pushes in annotation-overlay.tsx
- Changes:
  - Added useRef import to track previous external annotations
  - Added prevExternalAnnotationsRef to track previous annotation state
  - Added pendingHistoryPushRef and historyPushTimeoutRef for debouncing
  - Implemented change detection: only push history when annotations have meaningfully changed
  - Added 100ms debounce timeout to batch rapid successive external updates
  - Added proper cleanup of timeout on unmount/effect re-run
- Tests: 18 annotation tests passing (9 frontend + 9 backend)
- Status: M9 resolved with debounced, deduplicated history management

### Iteration 10 -- 2026-02-27
- Fixed: M8 (Callback chain creates unnecessary re-renders)
- Performance: Stabilized callback references in annotation-canvas.tsx
- Changes:
  - Added useRef tracking for frequently changing state (isDrawing, startPoint, currentPoint, freehandPoints)
  - Added useEffect hooks to keep refs in sync with state
  - Refactored handleMouseUp to read from refs instead of state dependencies
  - Refactored handleMouseMove to read from refs instead of state dependencies
  - Refactored handleTouchMove to read from refs instead of state dependencies
  - Refactored handleTouchEnd to read from refs, removing unstable state dependencies
- Result: Callbacks maintain stable references during drawing operations, preventing cascade re-renders
- Tests: 9 passing in annotations directory
- Status: M8 resolved with stable callback references using ref pattern

### Iteration 9 -- 2026-02-27
- Fixed: M10 (Missing aria-label for icon triggers)
- Accessibility: Added ariaLabel prop to Dropdown component for screen reader support
- Changes:
  - Added ariaLabel?: string prop to DropdownProps interface with documentation
  - Added ariaLabel?: string prop to DropdownTriggerProps interface
  - Added aria-label={ariaLabel} attribute to the button element
  - Documented that ariaLabel is REQUIRED when trigger is an icon-only element
- Tests: 2894 passing, 41 skipped
- Status: M10 resolved with accessible aria-label support for icon triggers

### Iteration 8 -- 2026-02-27
- Fixed: M5 (No rate limiting on expensive bulk operations)
- Security: Added 'bulk' rate limit preset (10 req/min) to src/api/rate-limit.ts
- Applied bulkRateLimit middleware to all bulk operation routes in src/api/routes/bulk.ts
- Rate limit documentation added to bulk.ts header comments
- Bulk operations affected: files/move, files/copy, files/delete, files/download, files/metadata, folders/move, folders/delete
- Rationale: Bulk ops are resource-intensive (up to 100 items/request, may involve storage copies)
- Tests: 2894 passing, 41 skipped
- Status: M5 resolved with 10 req/min rate limit on all bulk endpoints

### Iteration 7 -- 2026-02-27
- Fixed: M6 (BackupProvider env var defined but class not implemented)
- Analysis: The issue was a false positive
- Evidence: S3BackupProvider and NoBackupProvider classes exist in src/storage/backup-provider.ts (415 lines)
- The env vars (BACKUP_ENABLED, BACKUP_STORAGE_BUCKET, BACKUP_RETENTION_DAYS, BACKUP_SNAPSHOT_INTERVAL_HOURS) are used in src/storage/index.ts getBackupProvider() function
- Comprehensive tests exist in src/storage/backup-provider.test.ts
- Status: M6 resolved as false positive - backup feature is fully implemented

### Iteration 6 -- 2026-02-27
- Fixed: M12 (console.log usage - secrets exposure risk)
- Security: Created structured logging utility (src/lib/logger.ts) with automatic secret scrubbing
- Updated auth-middleware.ts, router.ts, errors/index.ts, ws-manager.ts, redis-pubsub.ts to use new logger
- Logger features: LOG_LEVEL filtering, automatic scrubSecrets(), dev/prod formatting, no stack traces in prod
- Tests: 2894 passing, 41 skipped
- Status: M12 resolved with production-safe structured logging

### Iteration 5 -- 2026-02-27
- Fixed: M14 (FFmpeg path validation to prevent command injection)
- Security: Added comprehensive FFmpeg path validation with allowlist, shell metacharacter detection, and symlink resolution
- Tests: 2892 passing, 41 skipped
- Status: M14 resolved with spawn-safe path validation

### Iteration 4 -- 2026-02-27
- Fixed: H10 (legacy cookie config option), H11 (SSRF protection in webhooks), M1 (comments.created_at index), M3 (already had max length in validation), M15 (failed auth logging)
- Tests: 2893 passing, 41 skipped
- Coverage: 83.43% statements
- Status: All 11 high issues resolved, 4 medium issues fixed, tests green

### Iteration 3 -- 2026-02-27
- Fixed: H1 (query limits), H2 (N+1 fix), H4 (Zod validation), H5 (Zod validation), H8 (socket cleanup), H9 (429 retry)
- Tests: 2808 passing, 41 skipped
- Coverage: 86.09% statements
- Status: 6 high issues fixed, tests green, typecheck passes

### Iteration 2 -- 2026-02-27
- Fixed: C2 (validated config for provider), C3 (theme error logging), C5 (WebSocket cleanup)
- Tests: 2808 passing, 41 skipped
- Status: All 5 critical issues resolved, tests green, typecheck passes

### Iteration 1 -- 2026-02-27
- Triaged: 37 issues (5 critical, 11 high, 15 medium, 6 low)
- Fixed: C1 (SQL injection), C4 (refresh cancellation), H3 (race condition), H6 (stale closure), H7 (navigation)
- Tests: 2808 passing, 41 skipped
- Status: 4 issues fixed, tests green, typecheck passes
