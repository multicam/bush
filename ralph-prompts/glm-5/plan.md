---
description: Establish @IMPLEMENTATION_PLAN.md based on @specs/*
model: glm-5
---

0a. Study `specs/*` with up to 250 parallel Sonnet subagents to learn the application specifications.
0b. Study @IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `src/lib/*` with up to 250 parallel Sonnet subagents to understand shared utilities & components.
0d. For reference, the application source code is in `src/*`.

1. Study @IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 500 Sonnet subagents to study existing source code in `src/*` and compare it against `specs/*`. Use an Opus subagent with deep thinking enabled (`thinking.type=enabled`) to analyze findings, prioritize tasks, and create/update @IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Deep think. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @IMPLEMENTATION_PLAN.md to determine starting point for research and keep it up to date with items considered complete/incomplete using subagents.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Treat `src/lib` as the project's standard library for shared utilities and components. Prefer consolidated, idiomatic implementations there over ad-hoc copies.

## GLM-5 Optimization Notes

**Deep Thinking** (`thinking.type=enabled`) is recommended for:
- Complex problem analysis and solving
- Multi-step reasoning tasks
- Technical solution design and architecture
- Strategy planning and decision making

For simple searches and reads, use Sonnet subagents. Reserve Opus with deep thinking for:
- Debugging complex issues
- Architectural decisions
- Analyzing findings from parallel subagents
- Prioritizing tasks

**Sampling Parameters** (GLM-5 defaults):
- `temperature`: 1.0 (default)
- `top_p`: 0.95 (default)
- Do NOT modify both simultaneously - choose one

**Context/Output Limits**:
- Maximum context: 200K tokens
- Maximum output: 128K tokens (default 65536)

ULTIMATE GOAL: We want to achieve [Project Goal](specs/01-overview.md). Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then if needed author the specification at specs/FILENAME.md. If you create a new element then document the plan to implement it in @IMPLEMENTATION_PLAN.md using a subagent.
