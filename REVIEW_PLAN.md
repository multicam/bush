# Code Review Plan

**Last updated**: 2026-02-27
**Iteration**: 3
**Coverage**: 86.09% statements (target: 80%)
**Tests**: 2808 passing, 41 skipped

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
| H10 | src/auth/session-cache.ts | 403-436 | Legacy cookie format support - security risk | pending |
| H11 | src/api/routes/webhooks.ts | 445-463 | SSRF risk - webhook test allows arbitrary URLs | pending |

### Medium (refactoring, test gaps)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| M1 | src/db/schema.ts | 274-294 | Missing index on comments.created_at for ordering | pending |
| M2 | src/api/router.ts | 29-38 | Stack traces leaked in production error responses | pending |
| M3 | src/api/routes/comments.ts | 114 | Unbounded comment text length - no DB constraint | pending |
| M4 | src/api/routes/search.ts | 87-105 | LIKE wildcards not escaped in FTS5 query | pending |
| M5 | src/api/routes/bulk.ts | - | No rate limiting on expensive bulk operations | pending |
| M6 | src/config/env.ts | 187-205 | BackupProvider env var defined but class not implemented | pending |
| M7 | src/web/app/projects/[id]/files/[fileId]/page.tsx | 84-111 | No AbortController for file fetch | pending |
| M8 | src/web/components/annotations/annotation-canvas.tsx | 569-577 | Callback chain creates unnecessary re-renders | pending |
| M9 | src/web/components/annotations/annotation-overlay.tsx | 88-94 | Excessive history pushes on external annotation change | pending |
| M10 | src/web/components/ui/dropdown.tsx | 160-183 | Missing aria-label for icon triggers | pending |
| M11 | src/web/components/ui/modal.tsx | 89-140 | Focus restore to removed element | pending |
| M12 | Multiple | - | Extensive console.log usage - secrets exposure risk | pending |
| M13 | Multiple | - | No CSRF protection for cookie-based requests | pending |
| M14 | src/transcription/processor.ts | 80 | FFmpeg spawn with configurable path - command injection risk | pending |
| M15 | src/api/auth-middleware.ts | - | Failed authentication not logged | pending |

### Low (style, naming, minor cleanup)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| L1 | src/web/components/shares/share-builder.tsx | 73-77 | Missing null checks on share attributes | pending |
| L2 | src/web/components/version-stacks/version-stack-compare.tsx | 58-108 | No cancellation on fileIds change | pending |
| L3 | Multiple | - | Type assertions (as any) in test files | pending |
| L4 | Multiple | - | Hardcoded localhost URLs in tests | pending |
| L5 | Multiple | - | Magic numbers for dimensions/timeouts | pending |
| L6 | src/realtime/ws-manager.ts | 103-113 | Hardcoded rate limit constants | pending |
| L7 | src/api/routes/bulk.ts | 24 | Hardcoded MAX_BULK_ITEMS = 100 | pending |
| L8 | src/config/env.ts | 109-114 | Default SMTP settings could be used in production | pending |

## Coverage Gaps (files below 80%)
| File | Statements | Branches | Functions | Priority |
|------|-----------|----------|-----------|----------|
| src/media/worker.ts | 0% | 0% | 0% | HIGH |
| src/scheduled/worker.ts | 0% | 0% | 0% | HIGH |
| src/shared/cn.ts | 0% | 0% | 0% | LOW |
| src/api/routes/workspaces.ts | 36.33% | 100% | 100% | CRITICAL |
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
