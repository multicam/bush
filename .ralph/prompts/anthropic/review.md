---
description: Deep code review — triage, fix, refactor, test. Track in @REVIEW_PLAN.md.
model: opus
---

## Phase 0: Spec-to-Implementation Gap Analysis

Before reviewing, run this 4-step verification to detect drift between specs and code:

**0a. Specs Analysis** — Use up to 250 parallel Sonnet subagents to extract all requirements from `specs/*`. Note any specs that have been added/modified since last review run.

**0b. Source Inventory** — Use up to 250 parallel Sonnet subagents to catalog everything actually implemented in `src/*`. Map: modules → functions/classes → features.

**0c. Gap Finder** — Use Sonnet subagents to search for:
- TODO/FIXME comments
- Placeholder implementations (stub functions, `throw new Error('not implemented')`)
- Skipped tests (`.skip`, `xit`)
- Hardcoded values that should be configurable
- Missing error handling

**0d. Reference Checker** — Detect stale spec references in:
- REVIEW_PLAN.md (references to renamed/deleted specs)
- Source code comments referencing old spec sections
- Doc strings with outdated spec links

**0e. Deep Analysis (conditional)** — If specs/ have changed since last review run, use an Opus subagent with Ultrathink to analyze impact:
- Which implemented features are now orphaned or conflict with new specs?
- Which code needs deletion vs rewriting?
- Draft concrete deletion/rewrite tasks for REVIEW_PLAN.md

**0f. Update REVIEW_PLAN.md** — Add a "Spec Gaps & Analysis" section containing:
- List of gaps found (TODOs, placeholders, skipped tests)
- Stale reference fix tasks (with file:line details)
- Deletion tasks for code that no longer matches specs
- Rewrite tasks for code that partially matches new specs

---

## Phase 1: Triage & Fix

1. If @REVIEW_PLAN.md does not exist, this is the first iteration. Run `bun test` and `bun run typecheck` to establish baseline. Then spawn 4 parallel Opus subagents to triage the codebase:
   - **Agent 1 — Backend**: Route handlers (auth checks, input validation, error handling, SQL injection, unbounded queries, N+1, missing indexes, race conditions, resource cleanup) -- Deep code reviw and code smells.
   - **Agent 2 — Frontend**: React components (error boundaries, memory leaks, stale closures, dependency arrays, cleanup functions), hooks, API client (error handling, retry logic), state management -- Deep code reviw and code smells.
   - **Agent 3 — Tests**: Run `bun test:coverage`, identify files below 80% statement coverage, untested error paths, modules with zero tests, brittle/unclear tests -- Run the full test suite, validate all test pass.
   - **Agent 4 — Security & Smells**: OWASP top 10 patterns, dead code, unused imports, orphaned files, inconsistent patterns, type safety gaps (`any`, assertions, missing null checks).
   - **Agent 5 - Refactor**: Analyse the codebase for refactor oportunities, accross all the layers. Rank the refactors from trivial to complex. 
   Compile findings into @REVIEW_PLAN.md using the template below. Ultrathink.
   Compile refactor opportunities into @REFACTOR_PLAN.md using the template below. Ultrathink.

## Phase 2: Fix Issues & Improve Coverage

2. If @REVIEW_PLAN.md exists, read it and resume. **Two modes of work — fix issues AND improve coverage. Every iteration must do both.** Find the highest-severity `pending` issues and fix them. Work critical → high → medium → low. For each issue:
   - Read the file fully. Understand context.
   - Fix the issue. Refactor aggressively: rename, extract, delete dead code, restructure, rewrite brittle tests, eliminate `any`, fix inconsistencies.
   - **MANDATORY: Write or update tests for every fix.** Test behavior, not implementation. Cover happy path AND error paths. Descriptive names: `"returns 403 when user lacks permission"`.
   - Run `bun run test` after each batch. Never leave tests red.
   - Update @REVIEW_PLAN.md: mark issues `fixed`, note what changed.
   Fix related issues together (e.g., all auth gaps in one route file). Aim to fix 5-15 issues per iteration depending on complexity.

## Phase 3: Coverage Gate

3. **MANDATORY COVERAGE GATE**: After fixing issues, spend the remainder of the iteration writing tests for uncovered code. Use the Coverage Gaps table in @REVIEW_PLAN.md to prioritize.
   - Run `bun run test:coverage` at the start and end of every iteration.
   - **Each iteration MUST increase statement coverage by at least 3 percentage points** (e.g., 16% → 19%). If you cannot hit +3pp, write tests until you do — do not move to step 4 until coverage increases.
   - Prioritize: CRITICAL coverage gaps first (auth, permissions, file routes), then HIGH, then MEDIUM.
   - Write integration-style tests for API routes: create test helpers that set up a Hono app instance with mocked dependencies, then test actual HTTP request/response cycles.
   - For modules that need external services (Redis, S3, FFmpeg), mock at the boundary — mock the service client, not the module internals.
   - If a module is genuinely untestable without infrastructure (e.g., WebSocket manager needing a real server), document why in @REVIEW_PLAN.md and move on.
   - Use `bun run test` (which runs `vitest run`), NOT `bun test` (Bun's native runner has compatibility issues).

## Phase 4: Verification

4. Run full verification: `bun run test && bun run typecheck`. Update coverage numbers in @REVIEW_PLAN.md. Log the iteration with: issues fixed, coverage before → after, tests added, new issues discovered.

## Phase 5: Log & Commit

5. Update @REVIEW_PLAN.md with iteration results using a subagent. Add any new issues discovered during fixing. Clean out completed items when the file gets large.

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
