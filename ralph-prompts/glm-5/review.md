0a. Study `specs/*` with up to 250 parallel Sonnet subagents to learn the application specifications.
0b. Study @REVIEW_PLAN.md (if present) to understand review progress so far.
0c. Study `src/*` with up to 250 parallel Sonnet subagents to understand the codebase.

1. If @REVIEW_PLAN.md does not exist, this is the first iteration. Run `bun test` and `bun run typecheck` to establish baseline. Then spawn 4 parallel Opus subagents with deep thinking enabled (`thinking.type=enabled`) to triage the codebase:
   - **Agent 1 -- Backend**: Route handlers (auth checks, input validation, error handling, SQL injection, unbounded queries, N+1, missing indexes, race conditions, resource cleanup).
   - **Agent 2 -- Frontend**: React components (error boundaries, memory leaks, stale closures, dependency arrays, cleanup functions), hooks, API client (error handling, retry logic), state management.
   - **Agent 3 -- Tests**: Run `bun test:coverage`, identify files below 80% statement coverage, untested error paths, modules with zero tests, brittle/unclear tests.
   - **Agent 4 -- Security & Smells**: OWASP top 10 patterns, dead code, unused imports, orphaned files, inconsistent patterns, type safety gaps (`any`, assertions, missing null checks).
   Compile findings into @REVIEW_PLAN.md using the template below. Deep think.

2. If @REVIEW_PLAN.md exists, read it and resume. Find the highest-severity `pending` issues and fix them. Work critical -> high -> medium -> low. For each issue:
   - Read the file fully. Understand context.
   - Fix the issue. Refactor aggressively: rename, extract, delete dead code, restructure, rewrite brittle tests, eliminate `any`, fix inconsistencies.
   - Write or update tests for every fix. Test behavior, not implementation. Cover happy path AND error paths. Descriptive names: `"returns 403 when user lacks permission"`.
   - Run `bun test` after each batch. Never leave tests red.
   - Update @REVIEW_PLAN.md: mark issues `fixed`, note what changed.
   Fix related issues together (e.g., all auth gaps in one route file). Aim to fix 5-15 issues per iteration depending on complexity.

3. After fixing, run full verification: `bun test && bun run typecheck && bun run lint`. Run `bun test:coverage` and update coverage numbers in @REVIEW_PLAN.md. Log the iteration with: issues fixed, coverage change, new issues discovered.

4. Update @REVIEW_PLAN.md with iteration results using a subagent. Add any new issues discovered during fixing. Clean out completed items when the file gets large. Then `git add -A` then `git commit` with a message describing the changes. After the commit, `git push`.

## GLM-5 Optimization Notes

**Deep Thinking** (`thinking.type=enabled`) is recommended for:
- Triage analysis (understanding root causes, not just symptoms)
- Security vulnerability assessment
- Refactoring decisions (when to extract, when to inline)
- Test strategy for complex modules

For simple searches and reads, use Sonnet subagents. Reserve Opus with deep thinking for:
- Analyzing findings from parallel triage agents
- Debugging complex issues found during review
- Architectural refactoring decisions

**Sampling Parameters** (GLM-5 defaults):
- `temperature`: 1.0 (default)
- `top_p`: 0.95 (default)
- Do NOT modify both simultaneously - choose one

**Context/Output Limits**:
- Maximum context: 200K tokens
- Maximum output: 128K tokens (default 65536)

**Model Selection**:
- Use `glm-5` (Opus equivalent) for triage analysis and complex refactoring
- Use `glm-4.6-FlashX` (Haiku equivalent) for quick searches/reads

99999. Refactoring authority: rename variables/functions, extract shared utilities, delete dead code/unused imports/orphaned files, restructure files that mix concerns, split large files, consolidate tiny ones, rewrite tests that test implementation details. Respect existing patterns (`generateId()` from `src/shared/id.ts`, `isRoleAtLeast()`, etc.).
999999. Test rules: mock external dependencies (Redis, S3, WorkOS), not internal modules. Group with `describe`. Frontend: test user interactions and rendered output. Target 80% statement coverage but prioritize meaningful tests over line-count chasing.
9999999. Single sources of truth. If you find duplicate logic, consolidate. If 8 routes validate input and 2 don't, fix the 2.
99999999. When you discover bugs unrelated to current work, document them in @REVIEW_PLAN.md using a subagent.
999999999. Keep @REVIEW_PLAN.md current -- future iterations depend on it.
9999999999. As soon as there are no build or test errors create a git tag. If there are no git tags start at 0.0.0 and increment patch by 1.
99999999999. IMPORTANT: Keep @AGENTS.md operational only -- review progress belongs in `REVIEW_PLAN.md`.

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
### Iteration 1 -- YYYY-MM-DD
- Triaged: N issues (N critical, N high, N medium, N low)
- Fixed: ...
- Coverage: XX% -> XX%
```
