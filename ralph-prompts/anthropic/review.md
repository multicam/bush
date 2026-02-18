---
description: Deep code review — triage, fix, refactor, test. Track in @REVIEW_PLAN.md.
model: opus
---

0a. Study `specs/*` with up to 250 parallel Sonnet subagents to learn the application specifications.
0b. Study @REVIEW_PLAN.md (if present) to understand review progress so far.
0c. Study `src/*` with up to 250 parallel Sonnet subagents to understand the codebase.

1. If @REVIEW_PLAN.md does not exist, this is the first iteration. Run `bun test` and `bun run typecheck` to establish baseline. Then spawn 4 parallel Opus subagents to triage the codebase:
   - **Agent 1 — Backend**: Route handlers (auth checks, input validation, error handling, SQL injection, unbounded queries, N+1, missing indexes, race conditions, resource cleanup).
   - **Agent 2 — Frontend**: React components (error boundaries, memory leaks, stale closures, dependency arrays, cleanup functions), hooks, API client (error handling, retry logic), state management.
   - **Agent 3 — Tests**: Run `bun test:coverage`, identify files below 80% statement coverage, untested error paths, modules with zero tests, brittle/unclear tests.
   - **Agent 4 — Security & Smells**: OWASP top 10 patterns, dead code, unused imports, orphaned files, inconsistent patterns, type safety gaps (`any`, assertions, missing null checks).
   Compile findings into @REVIEW_PLAN.md using the template below. Ultrathink.

2. If @REVIEW_PLAN.md exists, read it and resume. Find the highest-severity `pending` issues and fix them. Work critical → high → medium → low. For each issue:
   - Read the file fully. Understand context.
   - Fix the issue. Refactor aggressively: rename, extract, delete dead code, restructure, rewrite brittle tests, eliminate `any`, fix inconsistencies.
   - Write or update tests for every fix. Test behavior, not implementation. Cover happy path AND error paths. Descriptive names: `"returns 403 when user lacks permission"`.
   - Run `bun test` after each batch. Never leave tests red.
   - Update @REVIEW_PLAN.md: mark issues `fixed`, note what changed.
   Fix related issues together (e.g., all auth gaps in one route file). Aim to fix 5-15 issues per iteration depending on complexity.

3. After fixing, run full verification: `bun test && bun run typecheck && bun run lint`. Run `bun test:coverage` and update coverage numbers in @REVIEW_PLAN.md. Log the iteration with: issues fixed, coverage change, new issues discovered.

4. Update @REVIEW_PLAN.md with iteration results using a subagent. Add any new issues discovered during fixing. Clean out completed items when the file gets large.

99999. Refactoring authority: rename variables/functions, extract shared utilities, delete dead code/unused imports/orphaned files, restructure files that mix concerns, split large files, consolidate tiny ones, rewrite tests that test implementation details. Respect existing patterns (`generateId()` from `src/shared/id.ts`, `isRoleAtLeast()`, etc.).
999999. Test rules: mock external dependencies (Redis, S3, WorkOS), not internal modules. Group with `describe`. Frontend: test user interactions and rendered output. Target 80% statement coverage but prioritize meaningful tests over line-count chasing.
9999999. Single sources of truth. If you find duplicate logic, consolidate. If 8 routes validate input and 2 don't, fix the 2.
99999999. When you discover bugs unrelated to current work, document them in @REVIEW_PLAN.md using a subagent.
999999999. Keep @REVIEW_PLAN.md current — future iterations depend on it.

REVIEW_PLAN.md template (create if absent):
```markdown
# Code Review Plan

**Last updated**: YYYY-MM-DD
**Iteration**: N
**Coverage**: XX% statements (target: 80%)
**Tests**: N passing, N failing

## Issue Tracker

### Critical (bugs, security)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|

### High (code smells, missing validation)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|

### Medium (refactoring, test gaps)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|

### Low (style, naming, minor cleanup)
| # | File | Line | Issue | Status |
|---|------|------|-------|--------|

## Coverage Gaps (files below 80%)
| File | Statements | Branches | Functions | Priority |
|------|-----------|----------|-----------|----------|

## Iteration Log
### Iteration 1 — YYYY-MM-DD
- Triaged: N issues (N critical, N high, N medium, N low)
- Fixed: ...
- Coverage: XX% → XX%
```
