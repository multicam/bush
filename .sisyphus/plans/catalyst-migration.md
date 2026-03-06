# Catalyst UI Kit Migration

## TL;DR

> **Quick Summary**: Replace Bush's custom 17-component design system with Catalyst UI Kit (Tailwind Plus). Switch dark mode from `[data-theme]` to Tailwind `dark:` class. Replace Lucide icons with Heroicons. Rebuild app layout with Catalyst's SidebarLayout. Big-bang migration touching ~50 frontend files.
>
> **Deliverables**:
>
> - 27 Catalyst components installed in `src/web/components/ui/`
> - App layout rebuilt with Catalyst SidebarLayout + Sidebar
> - Auth pages rebuilt with Catalyst AuthLayout
> - Dark mode switched to class-based (`dark:` prefix)
> - All Lucide icons replaced with Heroicons
> - 6+ inline dialogs converted to Catalyst Dialog
> - Token layer bridged (semantic names retained, selectors updated)
> - Custom accent color (#ff4017) integrated
> - Design specs updated
> - Component tests rewritten
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 8 → Task 12 → Task 18 → F1-F4

---

## Context

### Original Request

Replace Bush's failing custom design system with Catalyst UI Kit from Tailwind CSS Plus (https://tailwindcss.com/plus/ui-kit). User has active subscription and ZIP downloaded at `/home/jean-marc/Downloads/catalyst-ui-kit.zip`.

### Interview Summary

**Key Discussions**:

- **Motivation**: Visual quality, missing components, maintenance burden — all compounding
- **Dark mode**: Switch from `[data-theme]` attribute to Tailwind `dark:` class variant
- **Sidebar**: Adopt Catalyst's fixed 256px sidebar (replacing hover-expand 64→240px rail)
- **Colors**: Use Catalyst defaults (zinc palette) + add custom accent (#ff4017 orange)
- **Non-Catalyst components**: Keep Toast, Tooltip, Skeleton, Spinner, Command Palette, Keyboard Legend — restyle to match Catalyst if they have actual consumers
- **Icons**: Switch from Lucide React to Heroicons
- **Migration**: Big-bang replacement (no coexistence period)
- **Tests**: Rewrite 4 existing UI test files for new APIs
- **Specs**: Update 20-design-foundations.md and 21-design-components.md

**Research Findings**:

- Catalyst: 27 TypeScript components + 3 layouts built on Headless UI v2 + React 19 + Tailwind v4
- Catalyst is NOT an npm package — it's source files copied into your project (you own them)
- Catalyst uses `dark:` prefix with hardcoded zinc/white colors (no token abstraction)
- Catalyst Button API: `color`/`outline`/`plain` (no `size`, no `loading` prop)
- Catalyst Dialog: composable sub-components (DialogTitle, DialogBody, DialogActions)
- Catalyst Input: bare input, uses Fieldset/Field for label/error composition
- Catalyst Sidebar: fixed width with mobile drawer via Dialog
- Dependencies needed: `@headlessui/react`, `motion`, `@heroicons/react`

### Metis Review

**Identified Gaps** (addressed):

- **Token bridge architecture**: Bush tokens ARE zinc values (`surface-2: #18181b` = `zinc-900`). Keep `tokens.css` with semantic names, switch selectors from `[data-theme]` to `.dark`. Feature code keeps `bg-surface-0` etc. without 500+ file rewrite. Catalyst components use native zinc classes. Both look identical.
- **Modal has 0 feature consumers**: Real dialogs are 6+ inline implementations with `fixed inset-0` overlays. Migration target is these inline dialogs, not the Modal component.
- **Toast/Tooltip/Skeleton/KeyboardLegend have 0 consumers**: Don't restyle unused components. Copy into project for future use only.
- **Heroicons has no Loader2 equivalent**: Keep Spinner component with inline SVG animation (no Lucide dependency needed).
- **Catalyst Button missing size/loading**: Extend Catalyst Button source to add loading state pattern (we own the source).
- **Anti-FOUC script logic reverses**: Dark = default with `.dark` class on `<html>`. Script removes class for light mode.
- **`@custom-variant dark` needed**: Required for Tailwind v4 class-based dark mode.
- **Custom CSS utilities must survive**: Corner brackets, drag handle, stagger animations, shimmer, typography classes — all preserved.
- **NavItem uses `<a>` not Next.js Link**: Switching to Catalyst SidebarItem gives client-side navigation as bonus.

---

## Work Objectives

### Core Objective

Replace Bush's custom design system with Catalyst UI Kit to gain production-quality, accessible, maintainable UI components while preserving the application's dark-first aesthetic and custom accent color.

### Concrete Deliverables

- 27 Catalyst component files in `src/web/components/ui/`
- Rebuilt `app-layout.tsx` using SidebarLayout + Sidebar
- Auth layout for login/signup pages
- Class-based dark mode with ThemeContext rewrite
- Heroicons replacing all Lucide icon imports across ~50 files
- Custom accent color (#ff4017) via `@theme`
- Updated design specs (20 + 21)
- Rewritten component tests

### Definition of Done

- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run build` succeeds (Next.js production build)
- [ ] `bun run lint` passes
- [ ] `bun run test` passes (all test suites)
- [ ] Dev server starts without console errors
- [ ] Dark mode toggle works (persists across refresh)
- [ ] All navigation uses client-side routing (no full page reloads)
- [ ] All pages render correctly in both dark and light themes

### Must Have

- Dark mode works via `.dark` class toggle
- Custom accent orange (#ff4017) visible on primary buttons and links
- Sidebar navigation with all current nav items
- Account switcher in sidebar footer
- Theme toggle in sidebar
- Notification bell with unread count (real-time WebSocket)
- All existing pages render and function
- Keyboard shortcuts continue working (Command Palette, Keyboard Legend)

### Must NOT Have (Guardrails)

- DO NOT restructure forms that currently work — only change component API calls
- DO NOT adopt Catalyst components that have no current usage in feature code
- DO NOT restyle components with zero feature consumers (Toast, Tooltip, Skeleton, KeyboardLegend)
- DO NOT remove `@tanstack/react-virtual` usage in asset browser
- DO NOT modify command palette behavior — only restyle to match Catalyst aesthetic
- DO NOT touch API backend, database, auth logic, storage, or media processing code
- DO NOT add functionality — this is purely a UI layer replacement
- DO NOT use `tailwind-merge` in new Catalyst code (Catalyst uses plain `clsx`)
- DO NOT remove custom CSS utilities (corner-brackets, drag-handle, stagger, shimmer, typography classes)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (Vitest + Testing Library + Playwright)
- **Automated tests**: YES (Tests-after — rewrite 4 UI tests for new APIs)
- **Framework**: Vitest (component) + Playwright (E2E)

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Build verification**: Use Bash — `bun run typecheck && bun run build`
- **Test verification**: Use Bash — `bun run test`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — infrastructure + dependencies + Catalyst files):
├── Task 1: Install dependencies + extract Catalyst components [quick]
├── Task 2: Create icon mapping module (Lucide → Heroicons) [quick]
├── Task 3: Dark mode infrastructure (ThemeContext + anti-FOUC + CSS) [unspecified-high]
└── Task 4: Token bridge (rewrite tokens.css selectors + add accent) [unspecified-high]

Wave 2 (Core components — adapt Catalyst for Bush):
├── Task 5: Adapt Catalyst components for Bush (Link, Button loading, Spinner) [deep]
├── Task 6: Create barrel export + component compatibility layer [quick]
└── Task 7: Rebuild app-layout.tsx with Catalyst SidebarLayout [deep]

Wave 3 (Feature propagation — update all consumer files):
├── Task 8: Migrate pages/routes group A (dashboard, projects, workspaces) [unspecified-high]
├── Task 9: Migrate pages/routes group B (shares, settings, notifications, auth) [unspecified-high]
├── Task 10: Migrate feature components group A (asset-browser, folder-nav, upload) [unspecified-high]
├── Task 11: Migrate feature components group B (viewers, comments, annotations) [unspecified-high]
├── Task 12: Migrate feature components group C (search, version-stacks, transcript, metadata, thumbnails, shares, notifications) [unspecified-high]
└── Task 13: Convert 6+ inline dialogs to Catalyst Dialog [unspecified-high]

Wave 4 (Cleanup + Tests + Specs):
├── Task 14: Delete old components + clean up CSS [quick]
├── Task 15: Remove lucide-react dependency + verify no remaining imports [quick]
├── Task 16: Rewrite component tests for Catalyst APIs [unspecified-high]
├── Task 17: Update design specs (20-design-foundations.md + 21-design-components.md) [writing]
└── Task 18: Full build verification + typecheck + lint [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3 → Task 5 → Task 7 → Task 8 → Task 13 → Task 18 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 5 (Wave 3)
```

### Dependency Matrix

| Task  | Depends On | Blocks     | Wave  |
| ----- | ---------- | ---------- | ----- |
| 1     | —          | 2-7        | 1     |
| 2     | —          | 8-13       | 1     |
| 3     | 1          | 5, 7, 8-13 | 1     |
| 4     | 1, 3       | 5, 7, 8-13 | 1     |
| 5     | 1, 3, 4    | 6, 7, 8-13 | 2     |
| 6     | 5          | 8-13       | 2     |
| 7     | 3, 4, 5    | 8, 9       | 2     |
| 8     | 2, 6, 7    | 14, 18     | 3     |
| 9     | 2, 6, 7    | 14, 18     | 3     |
| 10    | 2, 6       | 14, 18     | 3     |
| 11    | 2, 6       | 14, 18     | 3     |
| 12    | 2, 6       | 14, 18     | 3     |
| 13    | 5, 6       | 14, 18     | 3     |
| 14    | 8-13       | 15, 18     | 4     |
| 15    | 14         | 18         | 4     |
| 16    | 5, 6       | 18         | 4     |
| 17    | all        | 18         | 4     |
| 18    | 14-17      | F1-F4      | 4     |
| F1-F4 | 18         | —          | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **4 tasks** — T1 → `quick`, T2 → `quick`, T3 → `unspecified-high`, T4 → `unspecified-high`
- **Wave 2**: **3 tasks** — T5 → `deep`, T6 → `quick`, T7 → `deep`
- **Wave 3**: **6 tasks** — T8-T12 → `unspecified-high`, T13 → `unspecified-high`
- **Wave 4**: **5 tasks** — T14 → `quick`, T15 → `quick`, T16 → `unspecified-high`, T17 → `writing`, T18 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

### Wave 1: Foundation

- [ ] 1. Install Dependencies + Extract Catalyst Components

  **What to do**:
  - Install new dependencies: `bun add @headlessui/react motion @heroicons/react`
  - Verify Tailwind v4 is current: `bun add tailwindcss@latest @tailwindcss/postcss@latest`
  - Extract TypeScript components from `/home/jean-marc/Downloads/catalyst-ui-kit.zip` → `catalyst-ui-kit/typescript/*.tsx`
  - Copy ALL 27 Catalyst `.tsx` files into `src/web/components/ui/` (overwriting where names clash: button.tsx, input.tsx, select.tsx, badge.tsx, avatar.tsx, dropdown.tsx, table.tsx)
  - BEFORE overwriting, rename old files with `.old.tsx` suffix so they're available for reference during migration
  - Copy Catalyst's `link.tsx` and immediately adapt it for Next.js (use `NextLink` from `next/link`)
  - Verify all Catalyst files compile: `bun run typecheck` (will have import errors from old barrel — that's expected, fixed in Task 6)

  **Must NOT do**:
  - Do NOT delete any old component files yet (renamed to .old.tsx)
  - Do NOT modify any feature components
  - Do NOT change the barrel export (`index.ts`) yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Straightforward file extraction and dependency installation

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 3, 4, 5, 6, 7
  - **Blocked By**: None

  **References**:
  - **Pattern References**:
    - `src/web/components/ui/index.ts` — Current barrel export pattern to understand what gets overwritten
  - **External References**:
    - Catalyst getting started: `https://catalyst.tailwindui.com/docs` — Dependency list and Next.js Link integration
  - **Source**: `/home/jean-marc/Downloads/catalyst-ui-kit.zip` — `catalyst-ui-kit/typescript/` directory contains all 27 components
  - **Demo reference**: The ZIP also contains `catalyst-ui-kit/demo/typescript/` which shows how components are composed in a real Next.js app. The `application-layout.tsx` demo is the pattern for Task 7.

  **Acceptance Criteria**:
  - [ ] `@headlessui/react`, `motion`, `@heroicons/react` appear in `package.json` dependencies
  - [ ] All 27 Catalyst `.tsx` files exist in `src/web/components/ui/`
  - [ ] Old component files preserved as `.old.tsx` (button.old.tsx, input.old.tsx, etc.)
  - [ ] `link.tsx` uses `NextLink` from `next/link` (not plain `<a>`)
  - [ ] `bun install` completes without errors

  **QA Scenarios**:

  ```
  Scenario: Dependencies install correctly
    Tool: Bash
    Preconditions: Project at /home/jean-marc/Code/bush
    Steps:
      1. Run `bun install`
      2. Run `node -e "require.resolve('@headlessui/react')"`
      3. Run `node -e "require.resolve('motion')"`
      4. Run `node -e "require.resolve('@heroicons/react')"`
    Expected Result: All resolve commands exit 0
    Evidence: .sisyphus/evidence/task-1-deps-installed.txt

  Scenario: Catalyst files extracted
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `ls src/web/components/ui/button.tsx src/web/components/ui/dialog.tsx src/web/components/ui/sidebar.tsx src/web/components/ui/sidebar-layout.tsx`
      2. Run `ls src/web/components/ui/button.old.tsx`
      3. Run `wc -l src/web/components/ui/link.tsx` and verify it contains NextLink import
    Expected Result: All files exist, link.tsx uses NextLink
    Evidence: .sisyphus/evidence/task-1-files-extracted.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): install Catalyst dependencies and extract components`
  - Files: `package.json`, `bun.lock`, `src/web/components/ui/*.tsx`, `src/web/components/ui/*.old.tsx`

- [ ] 2. Create Icon Mapping Module (Lucide → Heroicons)

  **What to do**:
  - Create `src/web/lib/icons.ts` — a mapping/re-export module from Heroicons
  - Map all Lucide icons currently used in the codebase to their Heroicons equivalents
  - Include TWO export sets:
    - `@heroicons/react/20/solid` for sidebar/navbar items (20px)
    - `@heroicons/react/16/solid` for buttons, dropdowns, inline usage (16px)
    - `@heroicons/react/24/outline` for large/empty-state icons (24px)
  - Create a custom `SpinnerIcon` component (inline SVG with `animate-spin`) to replace Lucide's `Loader2` (which has no Heroicons equivalent)
  - Document the mapping in comments for reference during propagation tasks

  **Icon mapping** (discovered via grep — these are the Lucide icons used in the codebase):
  - `LayoutDashboard` → `HomeIcon` (20/solid)
  - `Briefcase` → `BriefcaseIcon` (20/solid)
  - `FolderOpen` → `FolderOpenIcon` (20/solid)
  - `FileText` → `DocumentTextIcon` (20/solid)
  - `Layers` → `Square2StackIcon` (20/solid)
  - `Share2` → `ShareIcon` (20/solid)
  - `Settings` → `Cog6ToothIcon` (20/solid)
  - `Sun` / `Moon` → `SunIcon` / `MoonIcon` (20/solid)
  - `LogOut` → `ArrowRightStartOnRectangleIcon` (16/solid)
  - `User` → `UserCircleIcon` (16/solid)
  - `ChevronDown` → `ChevronDownIcon` (16/solid)
  - `X` → `XMarkIcon` (16/solid)
  - `Check` → `CheckIcon` (16/solid)
  - `Plus` → `PlusIcon` (16/solid)
  - `Trash2` → `TrashIcon` (16/solid)
  - `Pencil` / `Edit` → `PencilIcon` (16/solid)
  - `Download` → `ArrowDownTrayIcon` (16/solid)
  - `Search` → `MagnifyingGlassIcon` (16/solid)
  - `MoreHorizontal` → `EllipsisHorizontalIcon` (16/solid)
  - `Info` → `InformationCircleIcon` (16/solid)
  - `AlertTriangle` → `ExclamationTriangleIcon` (16/solid)
  - `AlertCircle` → `ExclamationCircleIcon` (16/solid)
  - `CheckCircle2` → `CheckCircleIcon` (16/solid)
  - `XCircle` → `XCircleIcon` (16/solid)
  - `Film` / `Video` → `FilmIcon` (16/solid)
  - `Music` / `AudioLines` → `MusicalNoteIcon` (16/solid)
  - `Image` → `PhotoIcon` (16/solid)
  - `Folder` → `FolderIcon` (16/solid)
  - `GripVertical` → `Bars3Icon` (16/solid) or custom grip SVG
  - `Loader2` → Custom `SpinnerIcon` (inline SVG with animate-spin)
  - `ChevronUp` → `ChevronUpIcon` (16/solid)
  - `Bell` → `BellIcon` (20/solid)
  - `Play` / `Pause` → `PlayIcon` / `PauseIcon` (16/solid)
  - `Volume2` / `VolumeX` → `SpeakerWaveIcon` / `SpeakerXMarkIcon` (16/solid)
  - `Maximize` → `ArrowsPointingOutIcon` (16/solid)
  - `Send` → `PaperAirplaneIcon` (16/solid)
  - `Reply` → `ArrowUturnLeftIcon` (16/solid)
  - `Upload` / `UploadCloud` → `ArrowUpTrayIcon` (16/solid)
  - `Clock` → `ClockIcon` (16/solid)
  - `Eye` / `EyeOff` → `EyeIcon` / `EyeSlashIcon` (16/solid)
  - `Copy` → `ClipboardDocumentIcon` (16/solid)
  - `ExternalLink` → `ArrowTopRightOnSquareIcon` (16/solid)
  - `Link` → `LinkIcon` (16/solid)

  **Must NOT do**:
  - Do NOT replace any imports in feature files yet (that's Tasks 8-13)
  - Do NOT remove lucide-react dependency yet (that's Task 15)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Creating a reference mapping file — straightforward

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 8-13 (propagation tasks reference this mapping)
  - **Blocked By**: None

  **References**:
  - **Pattern References**:
    - Run `grep -rn "from.*lucide-react" src/web --include="*.tsx"` — All current Lucide imports
  - **External References**:
    - Heroicons reference: `https://heroicons.com` — Searchable icon catalog
    - Heroicons API: Import from `@heroicons/react/16/solid`, `@heroicons/react/20/solid`, `@heroicons/react/24/outline`

  **Acceptance Criteria**:
  - [ ] `src/web/lib/icons.ts` exists with all icon re-exports
  - [ ] Custom `SpinnerIcon` component exists with `animate-spin` animation
  - [ ] Every Lucide icon currently imported has a documented Heroicons equivalent
  - [ ] File compiles: `bun run typecheck` (or at least the icons file itself has no TS errors)

  **QA Scenarios**:

  ```
  Scenario: Icon mapping file compiles
    Tool: Bash
    Preconditions: @heroicons/react installed
    Steps:
      1. Run `bun run typecheck` and check src/web/lib/icons.ts has no errors
      2. Verify SpinnerIcon renders (create a temp test if needed)
    Expected Result: Zero TypeScript errors in icons.ts
    Evidence: .sisyphus/evidence/task-2-icons-compile.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `refactor(ui): create Heroicons mapping module`
  - Files: `src/web/lib/icons.ts`

- [ ] 3. Dark Mode Infrastructure (ThemeContext + Anti-FOUC + CSS)

  **What to do**:
  - **CSS**: Add `@custom-variant dark (&:where(.dark, .dark *));` to `theme.css` — this makes all `dark:` utilities respond to `.dark` class instead of `prefers-color-scheme` media query
  - **ThemeContext**: Rewrite `src/web/context/theme-context.tsx`:
    - Default theme = dark (add `.dark` class to `<html>`)
    - Toggle adds/removes `.dark` class from `document.documentElement.classList`
    - Keep localStorage persistence (key: `bush_theme`)
    - Light mode = remove `.dark` class
    - Dark mode = add `.dark` class
  - **Anti-FOUC script**: Rewrite in `src/web/app/layout.tsx`:
    - Script now: Read `bush_theme` from localStorage. If `"light"`, don't add `.dark`. Otherwise, add `.dark` class.
    - Current approach: `data-theme="light"` attribute → New approach: presence/absence of `dark` class
  - **Root layout HTML**: Add `className="dark"` as default to `<html>` element (alongside font variables)
  - **Remove** all `[data-theme="light"]` references from CSS files

  **Must NOT do**:
  - Do NOT modify tokens.css selectors yet (that's Task 4)
  - Do NOT change any component files
  - Do NOT change feature component dark/light references

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Dark mode is infrastructure — touches CSS, context, layout. Needs careful handling.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2, 4 — but 3 depends on 1 for @headlessui)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 5, 7, 8-13
  - **Blocked By**: Task 1 (needs Tailwind v4 updated)

  **References**:
  - **Pattern References**:
    - `src/web/context/theme-context.tsx` — Current ThemeContext to rewrite
    - `src/web/app/layout.tsx:43-59` — Current anti-FOUC script to rewrite
    - `src/web/styles/theme.css:14` — Where to add `@custom-variant dark`
  - **External References**:
    - Tailwind v4 dark mode: https://tailwindcss.com/docs/dark-mode — Class-based dark mode setup
  - **WHY**: The `@custom-variant dark` line is the KEY — without it, none of Catalyst's `dark:` prefixed classes will respond to the `.dark` class toggle.

  **Acceptance Criteria**:
  - [ ] `@custom-variant dark` present in theme.css
  - [ ] ThemeContext toggles `.dark` class on `<html>` (not `data-theme` attribute)
  - [ ] Anti-FOUC script adds `.dark` class by default, removes for light
  - [ ] localStorage `bush_theme` persists preference
  - [ ] `<html>` element has `dark` in className by default
  - [ ] Zero `[data-theme]` CSS selectors remain

  **QA Scenarios**:

  ```
  Scenario: Dark mode class toggle works
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running at localhost:3000
    Steps:
      1. Navigate to http://localhost:3000
      2. Assert `document.documentElement.classList.contains('dark')` is true (default dark)
      3. Find and click theme toggle button
      4. Assert `document.documentElement.classList.contains('dark')` is false
      5. Refresh page
      6. Assert dark class is still absent (localStorage persisted light mode)
      7. Click theme toggle again
      8. Assert dark class is back
    Expected Result: Dark class toggles correctly and persists across refresh
    Failure Indicators: `data-theme` attribute appears instead of class, or dark: styles don't activate
    Evidence: .sisyphus/evidence/task-3-dark-mode-toggle.png

  Scenario: No data-theme references remain
    Tool: Bash
    Steps:
      1. Run `grep -rn "data-theme" src/web/styles/ src/web/context/ src/web/app/layout.tsx`
    Expected Result: Zero results
    Evidence: .sisyphus/evidence/task-3-no-data-theme.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): switch dark mode from data-theme to dark class`
  - Files: `src/web/styles/theme.css`, `src/web/context/theme-context.tsx`, `src/web/app/layout.tsx`

- [ ] 4. Token Bridge (Rewrite tokens.css Selectors + Add Accent)

  **What to do**:
  - **Rewrite `tokens.css`** selectors:
    - CURRENT: `:root { dark tokens }` + `[data-theme="light"] { light tokens }`
    - NEW: `:root { light tokens }` + `.dark { dark tokens }` (matches Tailwind convention)
    - This means: in `:root`, set `--surface-0: #ffffff` (light values). In `.dark`, set `--surface-0: #09090b` (dark values)
    - The `[data-viewer]` context stays as-is — it forces dark values regardless of theme
  - **Add custom accent color** to `@theme` in `theme.css`:
    - `--color-bush-500: #ff4017` (primary accent)
    - `--color-bush-600: #e63a14` (hover)
    - `--color-bush-700: #cc3311` (active)
    - This lets Catalyst Button use `color="bush"` for the primary accent
  - **Add `bush` to Catalyst Button styles** — add a `bush` entry to the colors object in `button.tsx`:
    ```
    bush: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-bush-500)] [--btn-border:var(--color-bush-600)]/90',
      '[--btn-icon:var(--color-white)]/60 data-active:[--btn-icon:var(--color-white)]/80 data-hover:[--btn-icon:var(--color-white)]/80',
    ],
    ```
  - **Keep all `@theme` mappings** for custom tokens (surface, text, border, etc.) — feature code still uses `bg-surface-0`, `text-primary` etc.
  - **Preserve** the `[data-viewer]` block as-is
  - **Preserve** the `@media (prefers-reduced-motion)` block

  **Must NOT do**:
  - Do NOT change feature component Tailwind classes (they keep using `bg-surface-0` etc.)
  - Do NOT remove any `@theme` mappings — feature code depends on them
  - Do NOT remove custom CSS animations or utilities

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Token system is the bridge between old and new — needs careful handling

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2 — but after Task 3 for dark mode consistency)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 5, 7, 8-13
  - **Blocked By**: Tasks 1, 3

  **References**:
  - **Pattern References**:
    - `src/web/styles/tokens.css` — Current token definitions to restructure
    - `src/web/styles/theme.css:20-173` — Current @theme mappings (KEEP ALL)
    - Catalyst `button.tsx:59-158` — Color configuration object to extend with `bush` color
  - **WHY**: This is the "bridge" — Bush tokens keep working for feature code (`bg-surface-0` etc.), while Catalyst components work with their native zinc classes. Both use `.dark` class, so both theme correctly. No 500+ file rewrite needed.

  **Acceptance Criteria**:
  - [ ] `tokens.css` uses `:root { light values }` and `.dark { dark values }`
  - [ ] `[data-viewer]` context preserved
  - [ ] `@theme` section includes `--color-bush-500`, `--color-bush-600`, `--color-bush-700`
  - [ ] Catalyst `button.tsx` has `bush` color entry
  - [ ] All existing `@theme` mappings preserved (surface, text, border, accent, spacing, radius, etc.)
  - [ ] `bg-surface-0` class produces correct color in both dark and light modes

  **QA Scenarios**:

  ```
  Scenario: Token bridge works in both themes
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, Tasks 1+3 complete
    Steps:
      1. Navigate to http://localhost:3000
      2. In dark mode: verify `bg-surface-1` computes to approximately #111113 (dark page background)
      3. Toggle to light mode
      4. Verify `bg-surface-1` computes to approximately #fafafa (light page background)
    Expected Result: Semantic token classes produce correct colors in both themes
    Evidence: .sisyphus/evidence/task-4-token-bridge.png

  Scenario: Bush accent color available
    Tool: Bash
    Steps:
      1. Run `grep -n "bush-500" src/web/styles/theme.css`
      2. Run `grep -n "bush" src/web/components/ui/button.tsx`
    Expected Result: Both files contain bush color references
    Evidence: .sisyphus/evidence/task-4-accent-color.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): bridge token system for class-based dark mode + add accent`
  - Files: `src/web/styles/tokens.css`, `src/web/styles/theme.css`, `src/web/components/ui/button.tsx`

### Wave 2: Core Components

- [ ] 5. Adapt Catalyst Components for Bush (Link, Button Loading, Spinner)

  **What to do**:
  - **Link**: Verify `link.tsx` from Task 1 correctly wraps `NextLink`. Ensure `DataInteractive` from Headless UI wraps it. Test with a simple navigation.
  - **Button**: Extend Catalyst's `button.tsx` to support Bush-specific needs:
    - Add `loading` prop: When true, show `SpinnerIcon` (from Task 2), disable button, set `aria-busy="true"`
    - Ensure `bush` color works as primary CTA (from Task 4)
    - Note: Catalyst Button has no `size` prop — it uses responsive sizing (`sm:` prefix). This is fine. Don't add custom sizes.
  - **Spinner**: Create/update `src/web/components/ui/spinner.tsx` — custom SVG component with `animate-spin`, NOT dependent on Lucide. Export as both `Spinner` (component) and `SpinnerIcon` (raw icon with `data-slot="icon"` for Catalyst compatibility).
  - **Alert**: Catalyst's Alert component exists but is separate from Bush's Toast pattern. Keep Alert as-is for future use.
  - Verify ALL 27 Catalyst components compile without TypeScript errors.

  **Must NOT do**:
  - Do NOT add Catalyst's `size` prop pattern to Button — use Catalyst's responsive sizing
  - Do NOT restructure Catalyst component internals beyond the loading/accent additions
  - Do NOT change Catalyst's `clsx` imports to `cn`

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Modifying Catalyst source requires understanding Headless UI patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after Tasks 1, 3, 4)
  - **Parallel Group**: Wave 2 (with Task 6, 7)
  - **Blocks**: Tasks 6, 8-13
  - **Blocked By**: Tasks 1, 3, 4

  **References**:
  - **Pattern References**:
    - `src/web/components/ui/button.tsx` (NEW Catalyst version) — Color config + props to extend
    - `src/web/components/ui/button.old.tsx` — Old loading implementation for reference
    - Catalyst demo `application-layout.tsx` — How Button is used with icons
  - **External References**:
    - Headless UI Button: https://headlessui.com/react/button — `data-disabled`, `data-hover` attributes

  **Acceptance Criteria**:
  - [ ] `<Button loading>Loading...</Button>` renders with spinner and disabled state
  - [ ] `<Button color="bush">Primary</Button>` renders with #ff4017 background
  - [ ] `SpinnerIcon` renders as animated spinning SVG
  - [ ] `bun run typecheck` passes for all files in `src/web/components/ui/`
  - [ ] Link navigates using client-side routing (no full page reload)

  **QA Scenarios**:

  ```
  Scenario: Button loading state works
    Tool: Bash
    Steps:
      1. Run `bun run typecheck` — verify zero errors in button.tsx
      2. Grep for `loading` prop in button.tsx — verify it's handled
      3. Grep for `aria-busy` in button.tsx — verify accessibility
    Expected Result: Loading prop accepted, spinner shown, aria-busy set
    Evidence: .sisyphus/evidence/task-5-button-loading.txt

  Scenario: All Catalyst components compile
    Tool: Bash
    Steps:
      1. Run `bun run typecheck 2>&1 | grep -c "error TS"`
    Expected Result: Zero TypeScript errors
    Evidence: .sisyphus/evidence/task-5-typecheck.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `refactor(ui): adapt Catalyst components for Bush (Link, Button, Spinner)`
  - Files: `src/web/components/ui/button.tsx`, `src/web/components/ui/link.tsx`, `src/web/components/ui/spinner.tsx`

- [ ] 6. Create Barrel Export + Component Compatibility Layer

  **What to do**:
  - **Rewrite `src/web/components/ui/index.ts`** to export all Catalyst components:
    - All 27 Catalyst components with their sub-components
    - Custom Spinner/SpinnerIcon
    - Bush-specific kept components (toast.tsx, tooltip.tsx, skeleton.tsx, keyboard-legend.tsx, command-palette is in search/)
  - **Create type compatibility exports** — ensure TypeScript consumers get correct types:
    - `ButtonProps` should include the `loading` extension
    - Export all Headless UI component prop types that consumers need
  - **Document the API migration** in comments:
    ```
    // Migration: <Button variant="primary"> → <Button color="bush">
    // Migration: <Modal open onClose title> → <Dialog open onClose><DialogTitle>...</DialogTitle></Dialog>
    // Migration: <Input label="..." error="..."> → <Field><Label>...</Label><Input /><ErrorMessage>...</ErrorMessage></Field>
    ```

  **Must NOT do**:
  - Do NOT create wrapper components that hide Catalyst's API — consumers should learn the new patterns

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (after Task 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 8-13
  - **Blocked By**: Task 5

  **References**:
  - **Pattern References**:
    - `src/web/components/ui/index.ts` (current) — Current export structure
    - All Catalyst component files — for export names

  **Acceptance Criteria**:
  - [ ] `import { Button, Dialog, DialogTitle, Input, Sidebar, SidebarItem } from '@/web/components/ui'` works
  - [ ] `import { Spinner } from '@/web/components/ui'` works
  - [ ] All Catalyst sub-components exported (DialogBody, DialogActions, DropdownItem, SidebarBody, etc.)
  - [ ] `bun run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Barrel export compiles
    Tool: Bash
    Steps:
      1. Run `bun run typecheck 2>&1 | grep "index.ts"`
    Expected Result: Zero errors from barrel export file
    Evidence: .sisyphus/evidence/task-6-barrel.txt
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `refactor(ui): create barrel export for Catalyst components`
  - Files: `src/web/components/ui/index.ts`

- [ ] 7. Rebuild app-layout.tsx with Catalyst SidebarLayout

  **What to do**:
  - **Complete rewrite** of `src/web/components/layout/app-layout.tsx` using Catalyst's pattern:
    - Use `SidebarLayout` as the root (provides fixed sidebar on desktop, drawer on mobile)
    - Use `Sidebar` + `SidebarHeader` + `SidebarBody` + `SidebarFooter` + `SidebarItem` for navigation
    - Use `Navbar` for mobile top bar
  - **Port all existing functionality**:
    - **Navigation items**: Dashboard, Workspaces, Projects, Files, Collections, Shares → `SidebarItem` with Heroicons (from Task 2 mapping)
    - **Logo**: "Bush" / "B" in `SidebarHeader` — use `SidebarItem` with avatar/logo
    - **Theme toggle**: `SidebarItem` button with Sun/Moon Heroicons in `SidebarFooter`
    - **Account switcher**: `Dropdown` + `DropdownButton` as `SidebarItem` in `SidebarHeader` (follow Catalyst demo pattern for team switcher)
    - **Notifications**: Custom `SidebarItem` button with notification bell + badge count. Keep `useUserEvents` WebSocket subscription for real-time unread count. The `NotificationDropdown` becomes a Catalyst `Dropdown` with `anchor="top start"`.
    - **User menu**: `Dropdown` + `DropdownButton` as `SidebarItem` in `SidebarFooter` (follow Catalyst demo user menu pattern)
    - **Settings link**: Conditional on `isOwner || isContentAdmin`
    - **Current route highlighting**: Use `SidebarItem current={pathname === '/...'}`
  - **Follow Catalyst demo** `application-layout.tsx` as the structural template
  - **Mobile navbar**: Show hamburger menu + minimal navbar content on `lg:hidden`

  **Must NOT do**:
  - Do NOT implement hover-expand behavior (adopted fixed sidebar)
  - Do NOT change auth context or workspace context logic
  - Do NOT modify notification API calls or WebSocket subscriptions

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`frontend-ui-ux`]
  - Reason: Layout rebuild is the single most complex task — involves composing multiple Catalyst components, porting interactive state (notifications, account switcher, theme toggle), and handling responsive behavior. Needs visual design sensibility.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6 if started after 3+4)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Tasks 3, 4, 5

  **References**:
  - **Pattern References**:
    - `src/web/components/layout/app-layout.tsx` — Current layout (364 lines) — FULL READ REQUIRED to port all functionality
    - Catalyst demo: `/tmp/catalyst-inspect/catalyst-ui-kit/demo/typescript/src/app/(app)/application-layout.tsx` — THE template. Shows Sidebar + Dropdown composition, user menu, team switcher.
  - **API/Type References**:
    - `src/web/context/auth-context.tsx` — `useAuth()` hook: user, currentAccount, accounts, switchAccount, logout
    - `src/web/context/theme-context.tsx` — `useTheme()` hook: theme, toggleTheme
    - `src/web/hooks/use-realtime.ts` — `useUserEvents()` for notification count
    - `src/web/lib/api.ts` — `notificationsApi.getUnreadCount()`
  - **Component References**:
    - `src/web/components/ui/sidebar.tsx` — Catalyst Sidebar, SidebarItem, SidebarLabel etc.
    - `src/web/components/ui/sidebar-layout.tsx` — Catalyst SidebarLayout
    - `src/web/components/ui/dropdown.tsx` — Catalyst Dropdown, DropdownButton, DropdownItem etc.
    - `src/web/components/ui/navbar.tsx` — Catalyst Navbar, NavbarItem
    - `src/web/components/notifications/notification-bell.tsx` — Current notification bell component
    - `src/web/components/notifications/notification-dropdown.tsx` — Current notification dropdown

  **Acceptance Criteria**:
  - [ ] SidebarLayout renders with fixed sidebar on desktop viewport
  - [ ] Mobile viewport shows hamburger menu with slide-out sidebar drawer
  - [ ] All 6 nav items present with correct Heroicons
  - [ ] Theme toggle works (Sun/Moon icon switches, dark class toggles)
  - [ ] Account switcher dropdown works (shows all accounts, switches on click)
  - [ ] Notification bell shows unread count badge
  - [ ] User menu dropdown shows profile, settings, logout
  - [ ] Current page highlighted in sidebar
  - [ ] Settings link only visible to owner/content_admin

  **QA Scenarios**:

  ```
  Scenario: Desktop sidebar renders correctly
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in
    Steps:
      1. Navigate to http://localhost:3000/dashboard
      2. Assert sidebar is visible with `nav` element
      3. Assert sidebar contains text "Dashboard", "Projects", "Shares"
      4. Assert current route "Dashboard" has `data-current="true"` attribute
      5. Screenshot the full page
    Expected Result: Fixed sidebar with all nav items, Dashboard highlighted
    Evidence: .sisyphus/evidence/task-7-sidebar-desktop.png

  Scenario: Mobile sidebar drawer works
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Set viewport to 375x812 (iPhone)
      2. Navigate to http://localhost:3000/dashboard
      3. Assert sidebar is NOT visible (hidden on mobile)
      4. Click hamburger menu button
      5. Assert sidebar drawer slides in
      6. Click a nav item
      7. Assert drawer closes and page navigates
    Expected Result: Drawer opens/closes correctly on mobile
    Evidence: .sisyphus/evidence/task-7-sidebar-mobile.png

  Scenario: Theme toggle works in sidebar
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to dashboard
      2. Find theme toggle button in sidebar footer
      3. Assert page is in dark mode (html has .dark class)
      4. Click toggle
      5. Assert dark class removed
    Expected Result: Theme toggles between dark and light
    Evidence: .sisyphus/evidence/task-7-theme-toggle.png
  ```

  **Commit**: YES
  - Message: `refactor(ui): rebuild app layout with Catalyst SidebarLayout`
  - Files: `src/web/components/layout/app-layout.tsx`

### Wave 3: Feature Propagation

- [ ] 8. Migrate Pages Group A (Dashboard, Projects, Workspaces)

  **What to do**:
  - **Files to migrate** (5 files):
    - `src/web/app/dashboard/page.tsx` — imports Button, Badge, Loader2, Upload, Share2, Users, FolderPlus
    - `src/web/app/projects/page.tsx` — imports Button, Badge, Loader2, Grid3X3, List, ChevronDown
    - `src/web/app/projects/[id]/page.tsx` — imports Loader2, Button + HAS INLINE DIALOG (`fixed inset-0`)
    - `src/web/app/projects/[id]/collections/page.tsx` — imports Button, Input, Badge, Loader2 + HAS INLINE DIALOG
    - `src/web/app/projects/[id]/collections/[collectionId]/page.tsx` — imports Button, Input, Badge, Loader2 + HAS INLINE DIALOG
  - **For each file**:
    1. Replace `from "lucide-react"` imports with Heroicons from `src/web/lib/icons.ts` (use the mapping from Task 2)
    2. Replace `from "@/web/components/ui"` imports with Catalyst equivalents
    3. Update component API calls:
       - `<Button variant="primary">` → `<Button color="bush">`
       - `<Button variant="ghost">` → `<Button plain>`
       - `<Button variant="outline">` → `<Button outline>`
       - `<Button loading>` → `<Button loading>` (works via Task 5 extension)
       - `<Badge variant="...">` → `<Badge color="...">`
       - `<Input label="..." error="...">` → `<Field><Label>...</Label><Input />{error && <ErrorMessage>...</ErrorMessage>}</Field>`
    4. Convert the 3 inline dialogs (`fixed inset-0` pattern) in project/collection pages to Catalyst `<Dialog>`:
       - `<Dialog open={isOpen} onClose={setIsOpen}>`
       - `<DialogTitle>...</DialogTitle>`
       - `<DialogBody>...</DialogBody>`
       - `<DialogActions>...</DialogActions>`
       - Remove the manual overlay divs, click-outside handlers, and escape-key listeners (Catalyst Dialog handles all of this)
  - **Loader2 → SpinnerIcon**: Replace `<Loader2 className="animate-spin" />` with `<SpinnerIcon />` from icons.ts (already has animate-spin)

  **Must NOT do**:
  - Do NOT restructure page layout or data fetching logic
  - Do NOT change API calls, state management, or business logic
  - Do NOT add new UI features or reorganize page structure
  - Do NOT touch `@tanstack/react-virtual` usage

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed because inline dialog → Catalyst Dialog conversion requires composing sub-components correctly with proper visual structure

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10, 11, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 18
  - **Blocked By**: Tasks 2, 6, 7

  **References**:

  **Pattern References**:
  - `src/web/app/dashboard/page.tsx` — FULL READ REQUIRED. Understand all imports and component usage before changing.
  - `src/web/app/projects/[id]/page.tsx:83` — Inline dialog pattern: `fixed inset-0 bg-black/50` with click-outside handling
  - `src/web/app/projects/[id]/collections/page.tsx:182` — Another inline dialog
  - `src/web/app/projects/[id]/collections/[collectionId]/page.tsx:266` — Another inline dialog
  - `src/web/components/ui/button.tsx` (new Catalyst) — New Button API reference (`color`, `outline`, `plain`)
  - `src/web/components/ui/dialog.tsx` (Catalyst) — Dialog, DialogTitle, DialogBody, DialogActions API

  **API/Type References**:
  - `src/web/lib/icons.ts` (from Task 2) — Icon name mapping (Lucide name → Heroicons export)

  **External References**:
  - Catalyst Dialog docs: `https://catalyst.tailwindui.com/docs/dialog`
  - Catalyst Button docs: `https://catalyst.tailwindui.com/docs/button`

  **Acceptance Criteria**:
  - [ ] Zero `lucide-react` imports in any of the 5 files
  - [ ] Zero `from "@/web/components/ui"` imports that reference old components (Modal, old Button API)
  - [ ] 3 inline dialogs converted to Catalyst Dialog (projects/[id], collections, collections/[collectionId])
  - [ ] All pages render without TypeScript errors: `bun run typecheck`
  - [ ] Button/Badge/Input use Catalyst API patterns

  **QA Scenarios**:

  ```
  Scenario: Dashboard page renders with Catalyst components
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in
    Steps:
      1. Navigate to http://localhost:3000/dashboard
      2. Assert page loads without console errors (capture console.error)
      3. Find all buttons on page — assert none have `variant` attribute (old API)
      4. Screenshot the page in dark mode
      5. Toggle to light mode, screenshot again
    Expected Result: Page renders correctly in both themes with Catalyst buttons
    Failure Indicators: Console errors, unstyled buttons, missing icons
    Evidence: .sisyphus/evidence/task-8-dashboard-dark.png, .sisyphus/evidence/task-8-dashboard-light.png

  Scenario: Project page dialog works with Catalyst Dialog
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in, at least one project exists
    Steps:
      1. Navigate to http://localhost:3000/projects
      2. Click on a project to open project page
      3. Trigger the action that opens the inline dialog (e.g., delete/edit action)
      4. Assert Dialog component renders (look for `[data-headlessui-state]` attribute on dialog)
      5. Press Escape key
      6. Assert dialog closes
    Expected Result: Dialog opens with Catalyst styling, closes on Escape
    Failure Indicators: Dialog doesn't open, `fixed inset-0` raw div still present, no accessibility attributes
    Evidence: .sisyphus/evidence/task-8-project-dialog.png
  ```

  **Commit**: YES (groups with Tasks 9-13 into one Wave 3 commit)
  - Message: `refactor(ui): migrate dashboard, projects, workspaces pages to Catalyst`
  - Files: `src/web/app/dashboard/page.tsx`, `src/web/app/projects/**/*.tsx`, `src/web/app/workspaces/page.tsx`

- [ ] 9. Migrate Pages Group B (Shares, Settings, Notifications, Auth, Landing)

  **What to do**:
  - **Files to migrate** (9 files):
    - `src/web/app/shares/page.tsx` — imports Button, Loader2, Link
    - `src/web/app/shares/new/page.tsx` — imports Loader2
    - `src/web/app/shares/[id]/page.tsx` — imports Button, Loader2, Copy, ExternalLink
    - `src/web/app/s/[slug]/page.tsx` — imports various Lucide icons (public share view)
    - `src/web/app/settings/page.tsx` — imports Button, Input, Badge, X + HAS INLINE DIALOG (`fixed inset-0` at line 634)
    - `src/web/app/notifications/page.tsx` — imports Spinner, Badge
    - `src/web/app/login/page.tsx` — imports Button, Spinner
    - `src/web/app/signup/page.tsx` — imports Button, FolderOpen, Users, Link2
    - `src/web/app/page.tsx` — imports Button, Video, FolderOpen, Share2, Zap, Shield, MessageCircle, Loader2 (landing page)
  - **For each file**: Same migration pattern as Task 8:
    1. Replace Lucide imports → Heroicons from `src/web/lib/icons.ts`
    2. Replace old UI imports → Catalyst equivalents
    3. Update component API calls (Button variant→color, Badge variant→color, Input→Field composition)
  - **Settings page**: Convert the 1 inline dialog (`fixed inset-0` at line 634) to Catalyst Dialog
  - **Auth pages** (login, signup): Consider using Catalyst's `AuthLayout` component for consistent auth page structure. If current layout is simple enough, just swap components without wrapping in AuthLayout.
  - **Landing page** (`page.tsx`): This is the marketing/landing page — update icons and buttons but preserve the page layout and marketing copy

  **Must NOT do**:
  - Do NOT change form submission logic or API calls
  - Do NOT alter the public share view behavior (`/s/[slug]`)
  - Do NOT modify settings save/delete logic
  - Do NOT add new routes or pages

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Auth pages benefit from visual design polish; settings dialog conversion needs layout awareness

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 10, 11, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 18
  - **Blocked By**: Tasks 2, 6, 7

  **References**:

  **Pattern References**:
  - `src/web/app/settings/page.tsx:634` — Inline dialog: `fixed inset-0 bg-black/50`
  - `src/web/app/login/page.tsx` — Auth page pattern to update
  - `src/web/app/page.tsx` — Landing page with marketing content
  - Catalyst `auth-layout.tsx` at `src/web/components/ui/auth-layout.tsx` — Optional auth wrapper

  **API/Type References**:
  - `src/web/lib/icons.ts` (from Task 2) — Icon name mapping

  **External References**:
  - Catalyst AuthLayout docs: `https://catalyst.tailwindui.com/docs/auth-layout`

  **Acceptance Criteria**:
  - [ ] Zero `lucide-react` imports in all 9 files
  - [ ] Settings inline dialog converted to Catalyst Dialog
  - [ ] Auth pages use Catalyst Button (and optionally AuthLayout)
  - [ ] Landing page buttons and icons use Catalyst/Heroicons
  - [ ] All pages render: `bun run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Settings page dialog works
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, logged in as owner
    Steps:
      1. Navigate to http://localhost:3000/settings
      2. Trigger the dialog action (e.g., danger zone or invite member)
      3. Assert Catalyst Dialog renders with `[data-headlessui-state]`
      4. Close dialog
    Expected Result: Dialog opens/closes correctly with Catalyst
    Evidence: .sisyphus/evidence/task-9-settings-dialog.png

  Scenario: Login page renders with Catalyst
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to http://localhost:3000/login (logged out state)
      2. Assert page has Catalyst-styled buttons (check for `data-headlessui-state` or Catalyst class patterns)
      3. Screenshot both dark and light modes
    Expected Result: Login page renders cleanly in both themes
    Evidence: .sisyphus/evidence/task-9-login.png

  Scenario: No Lucide imports remain in page files
    Tool: Bash
    Steps:
      1. Run `grep -rn "lucide-react" src/web/app/`
    Expected Result: Zero results
    Evidence: .sisyphus/evidence/task-9-no-lucide-pages.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(ui): migrate shares, settings, notifications, auth pages to Catalyst`
  - Files: `src/web/app/shares/**/*.tsx`, `src/web/app/settings/page.tsx`, `src/web/app/notifications/page.tsx`, `src/web/app/login/page.tsx`, `src/web/app/signup/page.tsx`, `src/web/app/page.tsx`, `src/web/app/s/[slug]/page.tsx`

- [ ] 10. Migrate Feature Components Group A (Asset Browser, Folder Navigation, Upload)

  **What to do**:
  - **Asset Browser** (6 files):
    - `asset-browser.tsx` — imports Spinner
    - `asset-card.tsx` — imports Badge, GripVertical
    - `asset-grid.tsx` — imports FolderOpen, Loader2
    - `asset-list.tsx` — imports Badge, Loader2
    - `metadata-badges.tsx` — imports Clock, Maximize2, Star, Tag
    - `view-controls.tsx` — imports Grid3X3, List, Square
    - `folder-card.tsx` — imports Folder
  - **Folder Navigation** (2 files):
    - `breadcrumbs.tsx` — imports ChevronRight, Home
    - `folder-tree.tsx` — imports ChevronRight, Folder, Home
  - **Upload** (3 files):
    - `dropzone.tsx` — imports Upload, XCircle
    - `upload-drawer.tsx` — imports Button, Badge, ChevronUp, ChevronDown, X, Upload, GripHorizontal
    - `upload-queue.tsx` — imports Button, Badge, Pause, Play, RotateCcw, X
  - **For each file**:
    1. Replace `from "lucide-react"` → Heroicons from `src/web/lib/icons.ts`
    2. Replace `from "@/web/components/ui"` → Catalyst imports
    3. Update component APIs (Badge variant→color, Button variant→color/outline/plain, Spinner→SpinnerIcon)
  - **Special: `asset-card.tsx`** — GripVertical (drag handle) may not have exact Heroicons equivalent. Use `Bars2Icon` or the existing custom `drag-handle` CSS class. Check which pattern is better.
  - **Special: `upload-drawer.tsx`** — This has Button and Badge imports plus complex drawer UI. Only change the imports and component APIs, NOT the drawer animation or layout logic.

  **Must NOT do**:
  - Do NOT modify `@tanstack/react-virtual` usage in asset-browser.tsx
  - Do NOT change drag-and-drop logic in asset-card.tsx
  - Do NOT alter upload state management or file handling
  - Do NOT restructure the upload drawer open/close animation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Straightforward import/API swaps across multiple files; no complex UI composition needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 9, 11, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 18
  - **Blocked By**: Tasks 2, 6

  **References**:

  **Pattern References**:
  - `src/web/components/asset-browser/asset-browser.tsx` — FULL READ: Understand virtual scroll + Spinner usage
  - `src/web/components/upload/upload-drawer.tsx` — FULL READ: Complex drawer with Button/Badge, preserve layout
  - `src/web/components/upload/upload-queue.tsx` — Upload queue with pause/play/retry buttons

  **API/Type References**:
  - `src/web/lib/icons.ts` (from Task 2) — Heroicons mapping
  - `src/web/components/ui/badge.tsx` (Catalyst) — Badge color API
  - `src/web/components/ui/button.tsx` (Catalyst) — Button color/outline/plain API

  **Acceptance Criteria**:
  - [ ] Zero `lucide-react` imports in all 11 files
  - [ ] Zero old UI component API patterns (`variant=` on Button/Badge)
  - [ ] Virtual scroll still works in asset browser
  - [ ] Upload drawer opens/closes correctly
  - [ ] `bun run typecheck` passes for all files

  **QA Scenarios**:

  ```
  Scenario: Asset browser renders with Catalyst badges
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, logged in, project with files exists
    Steps:
      1. Navigate to a project file browser page
      2. Assert file cards render with badges (look for Badge component output)
      3. Scroll through the virtual list — assert no rendering glitches
      4. Screenshot
    Expected Result: Asset browser renders correctly with Catalyst badges and Heroicons
    Failure Indicators: Missing icons, broken badges, virtual scroll crashes
    Evidence: .sisyphus/evidence/task-10-asset-browser.png

  Scenario: Upload drawer works with Catalyst buttons
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to a project page
      2. Trigger file upload (drag or click upload button)
      3. Assert upload drawer appears with Catalyst-styled buttons
      4. Assert pause/resume/cancel buttons render with Heroicons
    Expected Result: Upload UI works with Catalyst components
    Evidence: .sisyphus/evidence/task-10-upload-drawer.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(ui): migrate asset-browser, folder-nav, upload to Catalyst`
  - Files: `src/web/components/asset-browser/*.tsx`, `src/web/components/folder-navigation/*.tsx`, `src/web/components/upload/*.tsx`

- [ ] 11. Migrate Feature Components Group B (Viewers, Comments, Annotations)

  **What to do**:
  - **Viewers** (4 files):
    - `video-viewer.tsx` — imports Play, Pause, Volume2, VolumeX, Maximize2, Settings, Loader2, SkipBack, SkipForward, PictureInPicture2 (heavy icon usage)
    - `image-viewer.tsx` — imports Minus, Plus, Loader2
    - `audio-viewer.tsx` — check for Lucide/UI imports
    - `pdf-viewer.tsx` / `pdf-viewer-lazy.tsx` — check for Lucide/UI imports
  - **Comments** (3 files):
    - `comment-panel.tsx` — check for Lucide/UI imports
    - `comment-form.tsx` — check for Lucide/UI imports
    - `comment-item.tsx` — check for Lucide/UI imports
    - `comment-thread.tsx` — check for Lucide/UI imports
  - **Annotations** (3 files):
    - `annotation-overlay.tsx` — imports Pencil, X
    - `annotation-toolbar.tsx` — imports multiple Lucide icons for drawing tools
    - `annotation-canvas.tsx` — check for Lucide/UI imports
  - **For each file**: Same migration pattern:
    1. Replace Lucide → Heroicons from icons.ts
    2. Replace old UI imports → Catalyst
    3. Update component APIs
  - **Special: `video-viewer.tsx`** — This is the most icon-heavy component (~10+ icons for playback controls). ALL icons are Lucide. Replace with Heroicons equivalents. Do NOT change the video player logic, keyboard shortcuts, or fullscreen handling.
  - **Special: `annotation-toolbar.tsx`** — Drawing tool icons (pen, rectangle, circle, line, text, arrow). Some may need `@heroicons/react/24/outline` variants. If exact icons don't exist in Heroicons, use closest match or keep as inline SVG.

  **Must NOT do**:
  - Do NOT modify video playback logic, timeline, or keyboard shortcuts
  - Do NOT change annotation drawing mechanics
  - Do NOT alter comment submission or threading logic
  - Do NOT modify PDF viewer rendering engine

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Icon-heavy file swaps but no complex UI composition

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 9, 10, 12, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 18
  - **Blocked By**: Tasks 2, 6

  **References**:

  **Pattern References**:
  - `src/web/components/viewers/video-viewer.tsx` — FULL READ REQUIRED: 800+ line file with ~10 Lucide imports. Understand icon context before swapping.
  - `src/web/components/annotations/annotation-toolbar.tsx` — FULL READ: Drawing tool icons, many specialized shapes

  **API/Type References**:
  - `src/web/lib/icons.ts` (from Task 2) — Icon name mapping
  - Heroicons search: `https://heroicons.com` — Find equivalents for video/drawing icons

  **External References**:
  - Heroicons: `https://heroicons.com` — Verify drawing tool icon availability (pen, shapes, etc.)

  **Acceptance Criteria**:
  - [ ] Zero `lucide-react` imports in all viewer, comment, and annotation files
  - [ ] Video player renders with correct playback icons (play, pause, volume, fullscreen)
  - [ ] Annotation toolbar renders with drawing tool icons
  - [ ] `bun run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Video player controls render with Heroicons
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, logged in, file with video exists
    Steps:
      1. Navigate to a video file detail page
      2. Assert video player renders
      3. Hover over video to show controls
      4. Assert play/pause button contains SVG (Heroicons render as SVG)
      5. Assert volume control icon renders
      6. Screenshot the player controls
    Expected Result: All video player icons render correctly
    Failure Indicators: Missing icons, broken controls, player doesn't respond to clicks
    Evidence: .sisyphus/evidence/task-11-video-player.png

  Scenario: Annotation toolbar renders
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to a file that supports annotations
      2. Open annotation mode
      3. Assert toolbar renders with tool icons
      4. Screenshot toolbar
    Expected Result: Annotation tools visible with icons
    Evidence: .sisyphus/evidence/task-11-annotation-toolbar.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(ui): migrate viewers, comments, annotations to Catalyst`
  - Files: `src/web/components/viewers/*.tsx`, `src/web/components/comments/*.tsx`, `src/web/components/annotations/*.tsx`

- [ ] 12. Migrate Feature Components Group C (Search, Version Stacks, Transcript, Metadata, Thumbnails, Shares, Notifications)

  **What to do**:
  - **Search** (2 files):
    - `command-palette.tsx` — imports multiple Lucide icons (Search, File, Folder, Settings, etc.)
    - `global-search.tsx` — imports Search, X, Loader2
  - **Version Stacks** (4 files):
    - `version-stack-list.tsx` — imports Badge, Button, Loader2
    - `version-stack-card.tsx` — imports Badge, Layers
    - `version-stack-compare.tsx` — imports Button, Badge, Loader2, Link, ArrowLeftRight, X
    - (Note: `add-to-stack-modal.tsx` and `create-version-stack-modal.tsx` have inline dialogs — handled in Task 13)
  - **Transcript** (3 files):
    - `transcript-panel.tsx` — check for Lucide/UI imports
    - `transcript-segment.tsx` — check for Lucide/UI imports
    - `caption-overlay.tsx` — check for Lucide/UI imports
  - **Metadata** (1 file):
    - `metadata-inspector.tsx` — imports Info, ChevronDown, Star, X
  - **Thumbnail** (1 file):
    - `thumbnail-control.tsx` — imports X, Play, ImagePlus, Trash2, Loader2
  - **Shares** (3 files):
    - `share-builder.tsx` — imports Button
    - `share-card.tsx` — imports Badge + 13 Lucide icons (Grid3X3, LayoutPanelTop, Eye, MessageSquare, Download, Lock, Clock, Copy, Pencil, MoreVertical, Files, ExternalLink, Trash2)
    - `share-activity-feed.tsx` — imports Eye, MessageSquare, Download, FileText, Loader2
  - **Notifications** (3 files):
    - `notification-bell.tsx` — imports Bell, Badge
    - `notification-list.tsx` — imports Bell, Loader2
    - `notification-item.tsx` — imports Check, X
  - **UI kept components** (2 files that still import Lucide):
    - `keyboard-legend.tsx` — imports Keyboard, X → replace with Heroicons
    - `toast.tsx` — imports CheckCircle2, XCircle, AlertTriangle, Info, X → replace with Heroicons
  - **For each file**: Same migration pattern as previous tasks
  - **Special: `command-palette.tsx`** — Has complex keyboard-driven UI. Only change icons and any UI component imports. Do NOT modify the keyboard navigation, fuzzy search, or command execution logic.
  - **Special: `share-card.tsx`** — Has 13 Lucide icon imports. Map each to Heroicons equivalent carefully.

  **Must NOT do**:
  - Do NOT modify command palette behavior, keyboard shortcuts, or search logic
  - Do NOT change notification WebSocket subscription or real-time behavior
  - Do NOT alter version stack comparison logic
  - Do NOT modify transcript parsing or segment display logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Many files but each is straightforward import/API swaps

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 9, 10, 11, 13)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 18
  - **Blocked By**: Tasks 2, 6

  **References**:

  **Pattern References**:
  - `src/web/components/search/command-palette.tsx` — FULL READ REQUIRED: Complex component with many icons. Understand icon context.
  - `src/web/components/shares/share-card.tsx` — FULL READ: 13 Lucide icons in one file
  - `src/web/components/ui/toast.tsx` — Kept component, just swap icons
  - `src/web/components/ui/keyboard-legend.tsx` — Kept component, just swap icons

  **API/Type References**:
  - `src/web/lib/icons.ts` (from Task 2) — Icon name mapping

  **Acceptance Criteria**:
  - [ ] Zero `lucide-react` imports in all files listed above
  - [ ] Command palette still opens with Cmd+K and navigates correctly
  - [ ] Share cards display all action icons
  - [ ] Notification bell still shows unread count
  - [ ] Toast notifications display correct status icons
  - [ ] `bun run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Command palette works with Heroicons
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, logged in
    Steps:
      1. Navigate to http://localhost:3000/dashboard
      2. Press Cmd+K (or Ctrl+K)
      3. Assert command palette opens
      4. Type "dash" in the search field
      5. Assert results appear with icons (SVG elements present)
      6. Press Escape
      7. Assert palette closes
    Expected Result: Command palette opens, shows results with icons, closes on Escape
    Failure Indicators: No icons in results, keyboard navigation broken, palette doesn't close
    Evidence: .sisyphus/evidence/task-12-command-palette.png

  Scenario: Share card renders all icons
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, logged in, at least one share exists
    Steps:
      1. Navigate to http://localhost:3000/shares
      2. Assert at least one share card renders
      3. Assert card contains SVG icon elements (Heroicons)
      4. Assert card action buttons render (copy, edit, delete etc.)
    Expected Result: Share cards display with all action icons
    Evidence: .sisyphus/evidence/task-12-share-card.png

  Scenario: No Lucide imports remain in any component
    Tool: Bash
    Steps:
      1. Run `grep -rn "lucide-react" src/web/components/`
    Expected Result: Zero results (only .old.tsx files may still reference it)
    Evidence: .sisyphus/evidence/task-12-no-lucide-components.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(ui): migrate search, version-stacks, transcript, metadata, shares, notifications to Catalyst`
  - Files: `src/web/components/search/*.tsx`, `src/web/components/version-stacks/version-stack-*.tsx`, `src/web/components/transcript/*.tsx`, `src/web/components/metadata/*.tsx`, `src/web/components/thumbnail/*.tsx`, `src/web/components/shares/*.tsx`, `src/web/components/notifications/*.tsx`, `src/web/components/ui/toast.tsx`, `src/web/components/ui/keyboard-legend.tsx`

- [ ] 13. Convert Inline Dialogs in Version Stack Modals to Catalyst Dialog

  **What to do**:
  - **Files** (2 files):
    - `src/web/components/version-stacks/create-version-stack-modal.tsx` — Has `fixed inset-0 bg-black/50` inline dialog at line 115
    - `src/web/components/version-stacks/add-to-stack-modal.tsx` — Has `fixed inset-0 bg-black/50` inline dialog at line 87
  - **For each file**:
    1. Replace `from "lucide-react"` → Heroicons from icons.ts (X, FileText → XMarkIcon, DocumentTextIcon)
    2. Replace `from "@/web/components/ui"` → Catalyst imports (Button, Input → Catalyst equivalents)
    3. Convert the inline dialog pattern to Catalyst Dialog:
       - Wrap content in `<Dialog open={isOpen} onClose={onClose}>`
       - Use `<DialogTitle>` for the header
       - Use `<DialogBody>` for the form content
       - Use `<DialogActions>` for the Cancel/Submit buttons
       - Remove manual overlay div (`fixed inset-0 bg-black/50`)
       - Remove manual click-outside handlers (Catalyst Dialog handles this)
       - Remove manual Escape key handlers (Catalyst Dialog handles this)
    4. Update Input usage to Field/Label/Input composition if it uses the old `label` prop

  **Must NOT do**:
  - Do NOT modify version stack creation/selection logic
  - Do NOT change the form fields or validation
  - Do NOT alter the onSubmit handlers

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 2 focused files with clear pattern — inline dialog → Catalyst Dialog

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 9, 10, 11, 12)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 14, 18
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src/web/components/version-stacks/create-version-stack-modal.tsx:115` — Inline dialog to convert
  - `src/web/components/version-stacks/add-to-stack-modal.tsx:87` — Inline dialog to convert
  - `src/web/components/ui/dialog.tsx` (Catalyst) — Target Dialog API: Dialog, DialogTitle, DialogBody, DialogActions

  **External References**:
  - Catalyst Dialog docs: `https://catalyst.tailwindui.com/docs/dialog`

  **Acceptance Criteria**:
  - [ ] Zero `fixed inset-0` overlay patterns in either file
  - [ ] Both use Catalyst `<Dialog>` with proper sub-components
  - [ ] Zero `lucide-react` imports
  - [ ] Dialog opens/closes correctly (Escape, click-outside, close button)
  - [ ] Form submission still works
  - [ ] `bun run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Create Version Stack dialog works
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, logged in, project with files exists
    Steps:
      1. Navigate to a project that has files
      2. Trigger "Create Version Stack" action
      3. Assert Catalyst Dialog renders (check for `[data-headlessui-state]` attribute)
      4. Type a name in the input field
      5. Click Create/Submit button
      6. Assert dialog closes and version stack is created
    Expected Result: Dialog opens with Catalyst styling, form works, dialog closes on submit
    Failure Indicators: Raw overlay div present, no accessibility attributes, form doesn't submit
    Evidence: .sisyphus/evidence/task-13-create-stack-dialog.png

  Scenario: Add to Stack dialog Escape behavior
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to a file detail page
      2. Trigger "Add to Stack" action
      3. Assert dialog opens
      4. Press Escape key
      5. Assert dialog closes without submitting
    Expected Result: Dialog closes on Escape key
    Evidence: .sisyphus/evidence/task-13-add-stack-escape.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `refactor(ui): convert version-stack modals to Catalyst Dialog`
  - Files: `src/web/components/version-stacks/create-version-stack-modal.tsx`, `src/web/components/version-stacks/add-to-stack-modal.tsx`

### Wave 4: Cleanup + Tests + Specs

- [ ] 14. Delete Old Components + Clean Up CSS

  **What to do**:
  - **Delete old component files** (renamed to `.old.tsx` in Task 1):
    - `button.old.tsx`, `input.old.tsx`, `select.old.tsx`, `badge.old.tsx`, `avatar.old.tsx`, `dropdown.old.tsx`, `modal.old.tsx`
    - Also delete `table.old.tsx` if it was renamed
  - **Delete the old `modal.tsx`** (Catalyst Dialog replaces it entirely)
  - **Delete the old `dropdown.tsx`** (Catalyst Dropdown replaces it)
  - **Clean up CSS**:
    - Verify no remaining `[data-theme]` selectors in any CSS file
    - Remove any CSS rules that were specific to old components (if any exist in globals.css)
    - Keep ALL custom utilities: corner-brackets, drag-handle, stagger, shimmer, typography
    - Keep ALL `@theme` mappings in theme.css
  - **Verify no imports reference `.old.tsx` files**: Run grep to confirm

  **Must NOT do**:
  - Do NOT delete toast.tsx, tooltip.tsx, skeleton.tsx, keyboard-legend.tsx, spinner.tsx (kept components)
  - Do NOT remove custom CSS utilities or animations
  - Do NOT modify `@theme` mappings

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: File deletion and grep verification — straightforward

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 16, 17 — after Wave 3 completes)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 15, 18
  - **Blocked By**: Tasks 8-13

  **References**:
  - `src/web/components/ui/` — Check directory listing for .old.tsx files
  - `src/web/styles/` — All CSS files to audit

  **Acceptance Criteria**:
  - [ ] Zero `.old.tsx` files in `src/web/components/ui/`
  - [ ] `modal.tsx` deleted (Dialog replaces it)
  - [ ] Zero `[data-theme]` selectors in any CSS file
  - [ ] Zero imports reference deleted files: `grep -rn "\.old" src/web/` returns nothing
  - [ ] Custom CSS utilities still present in globals.css
  - [ ] `bun run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: No old files remain
    Tool: Bash
    Steps:
      1. Run `ls src/web/components/ui/*.old.tsx 2>/dev/null | wc -l`
      2. Run `ls src/web/components/ui/modal.tsx 2>/dev/null`
      3. Run `grep -rn "\.old" src/web/ --include="*.tsx" --include="*.ts"`
    Expected Result: Zero .old.tsx files, no modal.tsx, no imports referencing .old
    Evidence: .sisyphus/evidence/task-14-cleanup.txt

  Scenario: Custom CSS utilities preserved
    Tool: Bash
    Steps:
      1. Run `grep "corner-brackets\|drag-handle\|stagger\|shimmer" src/web/styles/globals.css`
    Expected Result: All custom utilities still present
    Evidence: .sisyphus/evidence/task-14-css-preserved.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): remove old component files and clean up CSS`
  - Files: `src/web/components/ui/*.old.tsx` (deleted), `src/web/styles/*.css`

- [ ] 15. Remove lucide-react Dependency + Verify No Remaining Imports

  **What to do**:
  - **Final verification**: Run `grep -rn "lucide-react" src/` — must return ZERO results
  - If any remain, fix them (should be caught by Tasks 8-13, but this is the safety net)
  - **Remove dependency**: `bun remove lucide-react`
  - **Remove tailwind-merge** if no longer used: `grep -rn "tailwind-merge\|twMerge\|from.*cn" src/web/` — if zero results, run `bun remove tailwind-merge`
  - **Verify build**: `bun run typecheck && bun run build`

  **Must NOT do**:
  - Do NOT remove `clsx` (Catalyst uses it)
  - Do NOT remove any other dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (must run after Task 14)
  - **Parallel Group**: Wave 4 (sequential after 14)
  - **Blocks**: Task 18
  - **Blocked By**: Task 14

  **References**:
  - `package.json` — Dependencies list

  **Acceptance Criteria**:
  - [ ] `lucide-react` NOT in `package.json`
  - [ ] `tailwind-merge` removed if unused
  - [ ] Zero grep results for `lucide-react` across `src/`
  - [ ] `bun run typecheck && bun run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: No Lucide dependency anywhere
    Tool: Bash
    Steps:
      1. Run `grep -rn "lucide-react" src/`
      2. Run `grep "lucide-react" package.json`
      3. Run `bun run typecheck`
      4. Run `bun run build`
    Expected Result: Zero lucide references, typecheck passes, build succeeds
    Failure Indicators: Any file still imports lucide, build fails on missing module
    Evidence: .sisyphus/evidence/task-15-no-lucide.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): remove lucide-react and tailwind-merge dependencies`
  - Files: `package.json`, `bun.lock`

- [ ] 16. Rewrite Component Tests for Catalyst APIs

  **What to do**:
  - **Delete old test files** (4 files):
    - `src/web/components/ui/button.test.tsx` — Tests old Button API
    - `src/web/components/ui/input.test.tsx` — Tests old Input API
    - `src/web/components/ui/modal.test.tsx` — Tests old Modal API (component deleted)
    - `src/web/components/ui/toast.test.tsx` — Tests old Toast API
  - **Write new test files**:
    - `button.test.tsx` — Test Catalyst Button: color prop, outline, plain, loading state, bush accent, disabled state, icon slot
    - `dialog.test.tsx` — Test Catalyst Dialog: open/close, title rendering, body/actions composition, escape to close
    - `input.test.tsx` — Test Catalyst Input: field composition with Label, ErrorMessage, disabled state
    - `toast.test.tsx` — Test kept Toast: Heroicons render correctly (CheckCircleIcon, XCircleIcon etc.)
  - **Keep existing test** `metadata-badges.test.tsx` — Update if it references Lucide icons
  - **Test pattern**: Use Vitest + @testing-library/react. Follow existing test file patterns for imports and setup.

  **Must NOT do**:
  - Do NOT test Catalyst's internal Headless UI behavior (that's Headless UI's job)
  - Do NOT create integration tests (that's F3's job)
  - Do NOT test every Catalyst component — only the ones Bush customized or that have non-obvious API

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Test writing requires understanding both old and new APIs

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14, 17 — independent of cleanup)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src/web/components/ui/button.test.tsx` (old) — Existing test pattern for setup, imports, structure
  - `src/web/components/ui/button.tsx` (Catalyst) — New API to test against
  - `src/web/components/ui/dialog.tsx` (Catalyst) — Dialog API
  - `src/web/components/asset-browser/metadata-badges.test.tsx` — Another test file for pattern reference

  **External References**:
  - Vitest docs: `https://vitest.dev/guide/` — Test runner reference
  - Testing Library React: `https://testing-library.com/docs/react-testing-library/intro/` — Component testing patterns

  **Acceptance Criteria**:
  - [ ] 4 new test files created (button, dialog, input, toast)
  - [ ] `bun run test` passes — all tests green
  - [ ] Tests cover: rendering, props, loading state (button), open/close (dialog), field composition (input)
  - [ ] No tests reference old component APIs

  **QA Scenarios**:

  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run `bun run test`
    Expected Result: All test suites pass, zero failures
    Failure Indicators: Import errors, missing components, assertion failures
    Evidence: .sisyphus/evidence/task-16-tests.txt

  Scenario: Test coverage for custom extensions
    Tool: Bash
    Steps:
      1. Run `bun run test -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|describe|it\("`
    Expected Result: Button loading test present, Dialog open/close test present
    Evidence: .sisyphus/evidence/task-16-test-coverage.txt
  ```

  **Commit**: YES
  - Message: `test(ui): rewrite component tests for Catalyst APIs`
  - Files: `src/web/components/ui/button.test.tsx`, `src/web/components/ui/dialog.test.tsx`, `src/web/components/ui/input.test.tsx`, `src/web/components/ui/toast.test.tsx`

- [ ] 17. Update Design Specs (20-design-foundations.md + 21-design-components.md)

  **What to do**:
  - **`specs/20-design-foundations.md`** — Update:
    - Dark mode section: `[data-theme]` → `.dark` class toggle explanation
    - Token system: Explain the bridge (semantic tokens + Catalyst zinc classes)
    - Color palette: Add bush accent (#ff4017) documentation
    - Icon system: Lucide React → Heroicons
    - Typography: Keep as-is (typography classes preserved)
    - CSS architecture: Update to reflect Tailwind v4 `@custom-variant dark` + `@theme` approach
  - **`specs/21-design-components.md`** — Update:
    - Replace all 17 old component docs with Catalyst component equivalents
    - Document the API patterns (Button color, Dialog composition, Field composition)
    - Document which Catalyst components Bush uses vs which are available-but-unused
    - Document kept components (Toast, Tooltip, Skeleton, KeyboardLegend, Spinner) and their styling
    - Add import examples showing new barrel export
    - Remove old API examples (variant prop, Modal, old Dropdown)
  - **Preserve spec structure** — Keep the same heading hierarchy, just update content

  **Must NOT do**:
  - Do NOT change other spec files (only 20 and 21)
  - Do NOT remove the spec file structure
  - Do NOT add implementation details that belong in code comments

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []
  - Reason: Documentation update — needs clear technical writing

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14, 15, 16 — independent)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 18
  - **Blocked By**: All previous tasks (needs complete picture)

  **References**:

  **Pattern References**:
  - `specs/20-design-foundations.md` — FULL READ: Current spec to update
  - `specs/21-design-components.md` — FULL READ: Current spec to update
  - `src/web/components/ui/` — Actual component files for accurate documentation

  **External References**:
  - Catalyst docs: `https://catalyst.tailwindui.com/docs` — Canonical API reference

  **Acceptance Criteria**:
  - [ ] `specs/20-design-foundations.md` documents `.dark` class toggle, Heroicons, bush accent color
  - [ ] `specs/21-design-components.md` documents Catalyst component APIs (Button, Dialog, Input/Field, Sidebar, etc.)
  - [ ] No references to old components (Modal, old Button API, Lucide)
  - [ ] Spec structure preserved (heading hierarchy)

  **QA Scenarios**:

  ```
  Scenario: Specs don't reference old system
    Tool: Bash
    Steps:
      1. Run `grep -in "lucide\|data-theme\|variant.*primary\|variant.*ghost\|<Modal" specs/20-design-foundations.md specs/21-design-components.md`
    Expected Result: Zero results
    Evidence: .sisyphus/evidence/task-17-specs-clean.txt

  Scenario: Specs reference new system
    Tool: Bash
    Steps:
      1. Run `grep -in "Catalyst\|heroicons\|dark.*class\|bush.*accent\|Dialog\|SidebarLayout" specs/20-design-foundations.md specs/21-design-components.md`
    Expected Result: Multiple matches confirming new system documented
    Evidence: .sisyphus/evidence/task-17-specs-new.txt
  ```

  **Commit**: YES
  - Message: `docs(specs): update design system specs for Catalyst migration`
  - Files: `specs/20-design-foundations.md`, `specs/21-design-components.md`

- [ ] 18. Full Build Verification + Typecheck + Lint

  **What to do**:
  - Run the COMPLETE verification suite:
    1. `bun run typecheck` — Zero TypeScript errors
    2. `bun run lint` — Zero lint errors
    3. `bun run build` — Next.js production build succeeds
    4. `bun run test` — All test suites pass
    5. `bun run dev:web` — Dev server starts, verify it responds on port 3000
  - **Fix any failures** — This task is the "catch-all" for anything missed
  - **Verify final state**:
    - `grep -rn "lucide-react" src/` — ZERO results
    - `grep -rn "data-theme" src/web/styles/ src/web/context/ src/web/app/layout.tsx` — ZERO results
    - `grep -rn "\.old\.tsx" src/` — ZERO results
    - `ls src/web/components/ui/*.old.tsx` — ZERO files

  **Must NOT do**:
  - Do NOT introduce new features to fix build issues
  - Do NOT suppress TypeScript errors with `@ts-ignore` or `as any`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Running verification commands and fixing minor issues

  **Parallelization**:
  - **Can Run In Parallel**: NO (must run last in Wave 4, after 14-17)
  - **Parallel Group**: Wave 4 (sequential — final)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 14, 15, 16, 17

  **References**:
  - `package.json` — Script commands

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` — exit code 0
  - [ ] `bun run lint` — exit code 0
  - [ ] `bun run build` — exit code 0
  - [ ] `bun run test` — all suites pass
  - [ ] Dev server starts and responds on port 3000
  - [ ] ZERO lucide-react, data-theme, .old.tsx references

  **QA Scenarios**:

  ```
  Scenario: Full build pipeline passes
    Tool: Bash
    Steps:
      1. Run `bun run typecheck`
      2. Run `bun run lint`
      3. Run `bun run build`
      4. Run `bun run test`
    Expected Result: ALL four commands exit 0
    Failure Indicators: TypeScript errors, lint warnings, build failures, test failures
    Evidence: .sisyphus/evidence/task-18-build-pipeline.txt

  Scenario: Dev server starts and responds
    Tool: Bash
    Steps:
      1. Start dev server in background: `bun run dev:web &`
      2. Wait 10 seconds
      3. Run `curl -s http://localhost:3000 -o /dev/null -w '%{http_code}'`
      4. Kill dev server
    Expected Result: HTTP 200 response
    Evidence: .sisyphus/evidence/task-18-dev-server.txt

  Scenario: No migration artifacts remain
    Tool: Bash
    Steps:
      1. Run `grep -rn "lucide-react" src/`
      2. Run `grep -rn "data-theme" src/web/styles/ src/web/context/ src/web/app/layout.tsx`
      3. Run `ls src/web/components/ui/*.old.tsx 2>/dev/null`
    Expected Result: All three commands produce ZERO output
    Evidence: .sisyphus/evidence/task-18-clean-state.txt
  ```

  **Commit**: YES (if any fixes were needed)
  - Message: `refactor(ui): final build verification and cleanup`
  - Files: Any files fixed during verification

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `bun run typecheck` + `bun run lint` + `bun run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check for remaining Lucide imports. Verify no `[data-theme]` selectors remain in CSS. Verify `dark:` class is used consistently.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
      Start from clean state (`bun run dev:web`). Navigate EVERY route. Verify: sidebar renders with all nav items, dark/light toggle works and persists, account switcher works, notification bell shows, all pages render without console errors. Toggle dark/light on every page. Test mobile viewport (sidebar becomes drawer). Screenshot evidence for each page in both themes.
      Output: `Pages [N/N pass] | Dark Mode [PASS/FAIL] | Mobile [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect: remaining Lucide imports, remaining `[data-theme]` references, remaining old component imports. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `refactor(ui): install Catalyst dependencies and extract components`
- **Wave 1**: `refactor(ui): switch dark mode from data-theme to dark class`
- **Wave 1**: `refactor(ui): bridge token system for class-based dark mode`
- **Wave 2**: `refactor(ui): adapt Catalyst components for Bush (Link, Button, Spinner)`
- **Wave 2**: `refactor(ui): rebuild app layout with Catalyst SidebarLayout`
- **Wave 3**: `refactor(ui): migrate all pages and feature components to Catalyst`
- **Wave 3**: `refactor(ui): convert inline dialogs to Catalyst Dialog`
- **Wave 4**: `refactor(ui): remove old components and Lucide dependency`
- **Wave 4**: `test(ui): rewrite component tests for Catalyst APIs`
- **Wave 4**: `docs(specs): update design system specs for Catalyst`

---

## Success Criteria

### Verification Commands

```bash
bun run typecheck           # Expected: no errors
bun run build               # Expected: Next.js build succeeds
bun run lint                # Expected: no lint errors
bun run test                # Expected: all tests pass
bun run dev:web             # Expected: starts on port 3000
curl -s http://localhost:3000/dashboard -o /dev/null -w '%{http_code}'  # Expected: 200
```

### Final Checklist

- [ ] All "Must Have" features present and functional
- [ ] All "Must NOT Have" guardrails respected
- [ ] Zero Lucide React imports remaining
- [ ] Zero `[data-theme]` CSS selectors remaining
- [ ] Zero imports from old component files
- [ ] All tests pass
- [ ] Both dark and light themes render correctly on all pages
- [ ] TypeScript compiles with zero errors
- [ ] Production build succeeds
