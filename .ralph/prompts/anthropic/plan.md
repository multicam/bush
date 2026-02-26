---
description: Establish @IMPLEMENTATION_PLAN.md based on @specs/*
model: opus
---

## Phase 0: Spec-to-Implementation Gap Analysis

Before planning, run this 4-step verification to detect drift between specs and code:

**0a. Specs Analysis** — Use up to 250 parallel Sonnet subagents to extract all requirements from `specs/*`. Catalog each spec file, its requirements, and cross-references. Note any specs that have been added/modified since last plan run.

**0b. Source Inventory** — Use up to 250 parallel Sonnet subagents to catalog everything actually implemented in `src/*`. Map: modules → functions/classes → features.

**0c. Gap Finder** — Use Sonnet subagents to search for:
- TODO/FIXME comments
- Placeholder implementations (stub functions, `throw new Error('not implemented')`)
- Skipped tests (`.skip`, `xit`)
- Hardcoded values that should be configurable
- Missing error handling

**0d. Reference Checker** — Detect stale spec references in:
- IMPLEMENTATION_PLAN.md (references to renamed/deleted specs)
- Source code comments referencing old spec sections
- Doc strings with outdated spec links

**0e. Deep Analysis (conditional)** — If specs/ have changed since last plan run, use an Opus subagent with Ultrathink to analyze impact:
- Which implemented features are now orphaned or conflict with new specs?
- Which code needs deletion vs rewriting?
- Draft concrete deletion/rewrite tasks for IMPLEMENTATION_PLAN.md

**0f. Update IMPLEMENTATION_PLAN.md** — Add a "Spec Gaps & Analysis" section at the top containing:
- List of gaps found (TODOs, placeholders, skipped tests)
- Stale reference fix tasks (with file:line details)
- Deletion tasks for code that no longer matches specs
- Rewrite tasks for code that partially matches new specs

---

## Phase 1: Implementation Planning

1. Study @IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 500 Sonnet subagents to study existing source code in `src/*` and compare it against `specs/*`. Use an Opus subagent to analyze findings, prioritize tasks, and create/update @IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Ultrathink. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @IMPLEMENTATION_PLAN.md to determine starting point for research and keep it up to date with items considered complete/incomplete using subagents.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Treat `src/lib` as the project's standard library for shared utilities and components. Prefer consolidated, idiomatic implementations there over ad-hoc copies.

ULTIMATE GOAL: We want to achieve [Project Goal](specs/00-product-reference.md). Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then if needed author the specification at specs/FILENAME.md. If you create a new element then document the plan to implement it in @IMPLEMENTATION_PLAN.md using a subagent.