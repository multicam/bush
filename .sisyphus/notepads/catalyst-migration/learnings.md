# Learnings — catalyst-migration

_Append only. Never overwrite. Format: ## [TIMESTAMP] Task: {id}_

## [2026-03-06] Task: 1 — Install Dependencies + Extract Catalyst Components

- Catalyst TypeScript components extracted from ZIP to src/web/components/ui/
- Old files renamed before overwriting: button.old.tsx, input.old.tsx, select.old.tsx, badge.old.tsx, avatar.old.tsx, dropdown.old.tsx, modal.old.tsx
- link.tsx adapted to use NextLink from next/link (removed TODO comment, updated imports and component reference)
- Dependencies installed: @headlessui/react@2.2.9, motion@12.35.0, @heroicons/react@2.2.0
- Tailwind updated to latest: tailwindcss@4.2.1, @tailwindcss/postcss@4.2.1
- All 27 Catalyst components successfully extracted and copied
- /tmp/catalyst-inspect/ contains extracted ZIP for reference by Task 7
- Commit: 3bf93a1 "refactor(ui): install Catalyst dependencies and extract components"

## [2026-03-06] Task 2: Icon Mapping Module

**Created:** `src/web/lib/icons.tsx` (166 lines, 77 exported symbols)

**Exports:**

- **20/solid (11 icons):** HomeIcon, BriefcaseIcon, FolderOpenIcon, DocumentTextIcon, Square2StackIcon, ShareIcon, Cog6ToothIcon, SunIcon, MoonIcon, BellIcon, UserCircleIcon
- **16/solid (56 icons):** XMarkIcon, CheckIcon, PlusIcon, TrashIcon, PencilIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, EllipsisHorizontalIcon, EllipsisVerticalIcon, InformationCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon, CheckCircleIcon, XCircleIcon, FilmIcon, MusicalNoteIcon, FolderIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, ChevronLeftIcon, ArrowRightStartOnRectangleIcon, PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowsPointingOutIcon, PaperAirplaneIcon, ArrowUturnLeftIcon, ArrowUpTrayIcon, ClockIcon, EyeIcon, EyeSlashIcon, ClipboardDocumentIcon, ArrowTopRightOnSquareIcon, LinkIcon, Bars3Icon, Bars2Icon, ArrowsRightLeftIcon, ArrowLeftIcon, DocumentDuplicateIcon, StarIcon, LockClosedIcon, MinusIcon, ArrowPathIcon, BackwardIcon, ForwardIcon, ComputerDesktopIcon, TagIcon, UserGroupIcon, FolderPlusIcon, DocumentIcon, ShieldCheckIcon, BoltIcon, ChatBubbleLeftIcon, VideoCameraIcon, ViewColumnsIcon, Squares2X2Icon, ListBulletIcon, SquaresPlusIcon, PaintBrushIcon, RectangleGroupIcon
- **Aliases:** HomeSmallIcon (16/solid HomeIcon), ImagePlusIcon (PhotoIcon alias)
- **24/outline (3 icons):** FolderOpenLargeIcon, UserGroupLargeIcon, LinkLargeIcon
- **Custom components (2):** SpinnerIcon (inline SVG with animate-spin), GripIcon (2x3 dot pattern)

**Key decisions:**

- File is `.tsx` (not `.ts`) to support JSX for custom icon components
- HomeIcon imported twice (20/solid for nav, 16/solid as HomeSmallIcon for breadcrumbs) — resolved via import alias
- PhotoIcon aliased as ImagePlusIcon (no exact Heroicons equivalent for Lucide's ImagePlus)
- SpinnerIcon: custom inline SVG replacing Lucide's Loader2 (no Heroicons equivalent)
- GripIcon: custom 2x3 dot pattern (closer to Lucide's GripVertical than Heroicons' Bars3Icon)
- Removed KeyboardIcon (doesn't exist in Heroicons 16/solid)

**Single source of truth:** All feature components will import icons from this module, never directly from @heroicons/react or lucide-react.

## [2026-03-05] Atlas Verification — Tasks 1+2

- T1 SUCCESS: All 27 Catalyst files in src/web/components/ui/, all .old.tsx files present
- T1 SUCCESS: link.tsx correctly uses NextLink from next/link with Headless.DataInteractive wrapper
- T1 SUCCESS: 3 new deps installed (@headlessui/react 2.2.9, motion 12.35.0, @heroicons/react 2.2.0)
- T1 SUCCESS: Tailwind updated to 4.2.1, @tailwindcss/postcss 4.2.1
- T2 SUCCESS: icons.tsx created (not .ts!) — CORRECT because it uses JSX for SpinnerIcon/GripIcon
- IMPORTANT: All future tasks must import from 'src/web/lib/icons.tsx' (with .tsx extension)
  When writing import paths use: from '@/web/lib/icons' (without extension — TS resolves correctly)
- T2: KeyboardIcon doesn't exist in Heroicons 16/solid (removed from mapping by subagent)
- T2: GripIcon is a custom SVG (2x3 dots) since Heroicons doesn't have exact GripVertical match
- /tmp/catalyst-inspect/ exists and has demo app at catalyst-ui-kit/demo/typescript/ (for Task 7)

## [2026-03-06] Task 3: Dark mode — data-theme → .dark class

**@custom-variant dark placement matters:** Must come AFTER `@import "tailwindcss";` and BEFORE `@import "./tokens.css";`. This is the Tailwind v4 directive that makes `dark:` utilities respond to the `.dark` class on `<html>` instead of `prefers-color-scheme` media query.

**Anti-FOUC with class-based dark mode:** The script in `<head>` must proactively `classList.add('dark')` for the default (dark) case, not just remove for light. This is because the HTML tag now has `class="dark ..."` as SSR default — the script needs to remove it for light, or re-add it to be safe.

**SSR default class:** `<html className="dark ...">` is intentional — the anti-FOUC script in `<head>` runs synchronously before paint and will adjust if user has stored "light". Without this, SSR users would see dark momentarily (fine) but the script corrects before any paint.

**Stale JSDoc comments:** When changing the DOM manipulation approach, remember to update inline comments and JSDoc that describe the old approach — `data-theme attribute` → `.dark class`.

**tokens.css NOT touched:** `[data-theme="light"]` selectors in tokens.css remain until Task 4 (tokens.css restructure with light: custom-variant). This is intentional — Task 3 only migrates the JS/class mechanism, Task 4 migrates the CSS selectors.

**Commit:** daf29b6 "refactor(ui): switch dark mode from data-theme to dark class"

## [2026-03-06] Task 5: Button loading + Spinner adaptation

- Added `loading?: boolean` to the shared `ButtonProps` section in `src/web/components/ui/button.tsx`.
- Button now renders `SpinnerIcon` first (with `data-slot="icon"`) before `TouchTarget` content when loading.
- Added `aria-busy={loading || undefined}` to both Link and Headless button paths.
- Added disabled loading behavior to Headless button path: `disabled={loading || buttonProps.disabled}`.
- `button.tsx` imports `SpinnerIcon` directly from `@/web/lib/icons` (not from spinner.tsx).
- Rewrote `src/web/components/ui/spinner.tsx` to remove `lucide-react`; now re-exports `SpinnerIcon` from icons and provides a `Spinner` wrapper with optional sr-only label.
- Saved evidence to `.sisyphus/evidence/task-5-button-loading.txt` and `.sisyphus/evidence/task-5-typecheck.txt`.

## T6: Barrel Export Rewrite (COMPLETE)

**Commit**: d86b5ea - refactor(ui): create barrel export for all Catalyst components

### What Was Done

Rewrote `src/web/components/ui/index.ts` to export all 27 Catalyst components + 5 Bush custom components using `export *` pattern.

### Key Insights

1. **Export Pattern**: Using `export *` is safe for Catalyst components because they use named exports only (no default exports)
2. **Organization**: Grouped components by category (Layout, Core, Forms, Overlays, Data Display, Typography) for maintainability
3. **Bush Custom Components**: Kept separate section to track which components are not yet replaced by Catalyst equivalents
4. **No Type Exports Needed**: The `export *` pattern automatically re-exports all named exports AND types

### Component Count

- **27 Catalyst components** across 23 files:
  - Layout: 5 (sidebar-layout, stacked-layout, auth-layout, navbar, sidebar)
  - Core: 2 (button, link)
  - Forms: 9 (input, textarea, select, checkbox, radio, switch, listbox, combobox, fieldset)
  - Overlays: 3 (dialog, dropdown, alert)
  - Data Display: 5 (badge, avatar, table, description-list, pagination)
  - Typography: 3 (heading, text, divider)
- **5 Bush custom components**: spinner, toast, tooltip, skeleton, keyboard-legend

### Verification

✓ TypeScript typecheck: PASS (no errors)
✓ 32 export statements (27 Catalyst + 5 Bush)
✓ Sample imports verified:

- `import { Button, Dialog, DialogTitle, DialogBody, DialogActions } from '@/web/components/ui'`
- `import { Spinner, SpinnerIcon } from '@/web/components/ui'`
- `import { Toast, ToastContainer } from '@/web/components/ui'`

### Unblocks

- T8: Propagate Dialog to modals
- T9: Propagate Dropdown to dropdowns
- T10: Propagate Sidebar to sidebars
- T11: Propagate Navbar to navbars
- T12: Propagate Form components
- T13: Propagate Data Display components

## [2026-03-06] Task 7: App layout rebuilt with Catalyst SidebarLayout

- Replaced hover-expand legacy shell with Catalyst `SidebarLayout` + fixed `Sidebar` composition (`SidebarHeader`, `SidebarBody`, `SidebarFooter`).
- Migrated all primary nav routes to `SidebarItem` current-state matching: Dashboard, Workspaces, Projects, Files, Collections, Shares.
- Added conditional Settings navigation using role guards (`useHasRole('owner') || useHasRole('content_admin')`).
- Ported account switching to Catalyst dropdown in sidebar header using `switchAccount` from auth context.
- Ported theme toggle into sidebar footer using `SidebarItem` button and Sun/Moon icon swap via `useTheme().toggleTheme()`.
- Inlined notifications dropdown logic into layout (no `NotificationDropdown` component usage), retained unread count fetch + realtime increment via `useUserEvents`.
- Added mobile navbar actions (notifications + user menu) while keeping sidebar drawer behavior from `SidebarLayout`.

## [2026-03-06] Task: 8 remainder — Collections Pages

### Files migrated

- `src/web/app/projects/[id]/collections/page.tsx`
- `src/web/app/projects/[id]/collections/[collectionId]/page.tsx`

### Key findings

- Previous subagents had partially migrated these files: imports were updated but JSX still used old API (`variant`, `size`, `label` props, inline modals).
- Files had concurrent writes from multiple agents — needed to re-read before each edit due to "modified since last read" errors.
- `Badge color`: no "bush" color available in Catalyst Badge; used `"orange"` for primary (team) and `"zinc"` for default.
- `Button variant="secondary"` maps to `outline` prop (not documented in task spec — inferred from context and already-migrated files).
- `Loader2 className="animate-spin"` → `<SpinnerIcon />` with NO additional `animate-spin` (SpinnerIcon already includes it internally).
- Catalyst Dialog `onClose` receives `false` from Headless UI v2; use arrow function `onClose={() => setIsOpen(false)}` rather than passing setter directly, to avoid type mismatch.
- `<Input label="Name">` old pattern → `<Field><Label>Name</Label><Input /></Field>` Catalyst pattern — Label is from `@/web/components/ui` (via fieldset.tsx).
- Inline dialog conversion: remove `fixed inset-0 bg-black/50`, `onClick stopPropagation`, manual `onClick` close handler — Catalyst Dialog handles all these natively.
- Button `size="sm"` prop doesn't exist in Catalyst Button — drop silently.
- `bun run typecheck` passes with 0 errors after migration.
- Commit: `git add src/web/app/dashboard src/web/app/projects` captures exactly the 5 T8 files.

## [2026-03-06] Task: 8 — Pages Group A (session 2, workspaces bonus)

- `workspaces/page.tsx` was the bonus file — had `Loader2`, `Plus`, `Search` from lucide-react; migrated to `SpinnerIcon`, `PlusIcon`, `MagnifyingGlassIcon`.
- Badge for collection type `"team"` → `color="blue"` (maps to old `variant="primary"`); `"private"` → `color="zinc"` (maps to old `variant="default"`).
- Concurrent parallel session issue: previous session committed identical 5-file migration 71 seconds before this session; `git add` found only `workspaces/page.tsx` as new diff.
- LSP auto-formatter sometimes changes `() => x = y` to `() => (x = y)` on arrow function assignments, causing edit tool `oldString` mismatches — read file again before editing.
- LSP diagnostics can show stale errors after edit; calling diagnostics a second time confirms the real state.

## [2026-03-06] Task: 13 — Version Stack Modals

- Both `create-version-stack-modal.tsx` and `add-to-stack-modal.tsx` had inline `fixed inset-0` overlay pattern with manual backdrop click + Escape handlers; replaced with Catalyst `<Dialog open={isOpen} onClose={handleClose}>`.
- Remove `handleBackdropClick`, `handleKeyDown`, and `if (!isOpen) return null;` — Catalyst Dialog handles all three automatically.
- For components where a prop can be `null` (e.g., `file: AssetFile | null`): use `{file ? (<>...</>) : null}` inside Dialog body to narrow the type — cleaner than `open={isOpen && !!file}`.
- Edit tool gotcha: when the oldString matched only PART of the old code (because the file was modified in a previous edit), the remainder is left as trailing garbage. Always verify the final file state with Read after complex multi-part edits, and use a second edit to delete any orphaned trailing code.
- `Button plain` replaces `variant="ghost"`, `Button color="bush"` replaces `variant="primary"` — no other prop changes needed.
- `DocumentTextIcon` (20px solid, maps to `FileText`) used with `className="size-4"` — Heroicon size is purely CSS, so overriding with size-4 works fine.
- Typecheck passes clean (0 errors) after migration. Commit: `dfaae01`.

## [2026-03-06] Task: 10 — Feature Components Group A (asset-browser, folder-nav, upload)

- **Badge migration**: `variant="default"` → `color="zinc"`, `variant="success"` → `color="green"`, `variant="warning"` → `color="amber"`, `variant="error"` → `color="red"`, `variant="primary"` → `color="blue"`. Must also remove `size="sm"` — Badge spreads to `<span>` which doesn't have `size` as a valid HTML attr.
- **Button migration**: `variant="ghost"` → `plain`, `variant="secondary"` → `color="zinc"`, `variant="primary"` → `color="bush"`. Remove all `size="sm"` — Catalyst Button has no `size` prop.
- **`getStatusBadgeVariant` pattern**: When migrating functions that returned old variant strings, rename to `getStatusBadgeColor`/`getStatusColor` and update return type to Catalyst color strings.
- **SpinnerIcon**: Already has `animate-spin` baked in — do NOT add `animate-spin` class again when replacing `<Loader2 className="animate-spin">`.
- **FolderOpenLargeIcon**: For large empty-state icons (size 48-64px equivalent), use `FolderOpenLargeIcon` from `@heroicons/react/24/outline` (exported as `FolderOpenLargeIcon` from `@/web/lib/icons`).
- **GripIcon**: Custom 2x3 dot SVG — replaces both `GripVertical` and `GripHorizontal`. Use `className="size-3.5"` for drag handle within thumbnails.
- **SquaresPlusIcon**: Used as view-size toggle icon (small/medium/large card size selectors) — replaces Lucide `Square` with fill.
- **Concurrent session warning**: Other sessions may have already committed changes to some files. `git add` only stages actual diffs, so verify with `git show --stat HEAD` after committing to confirm all expected files are included. Only upload-queue.tsx was actually new; the rest were already migrated in commit `888aab2`.
- Typecheck passes clean (0 errors) after all 11 files migrated. Commit: `05e3e17`.

## [2026-03-06] Task: 9 — Pages Group B (shares, settings, notifications, auth, landing)

### Files migrated (net-new in this session)

- `src/web/app/login/page.tsx` — Button variant→color, removed size prop
- `src/web/app/signup/page.tsx` — Lucide FolderOpen/Users/Link2 → FolderOpenIcon/UserGroupIcon/LinkIcon; Button variant→color, removed size prop
- `src/web/app/page.tsx` (landing) — 7 Lucide icons → Heroicons; 3 Buttons variant→color/outline; removed size props

### Files already migrated by earlier sessions (no diff on commit)

- shares/page.tsx, shares/new/page.tsx, shares/[id]/page.tsx, s/[slug]/page.tsx, settings/page.tsx, notifications/page.tsx
- These appeared to have lucide imports when read via mcp_read (possible stale cache) but git diff showed no changes — HEAD already had migrated content.

### Key patterns applied

- `Lucide Link` → `LinkIcon` (from @heroicons/react/16/solid via @/web/lib/icons)
- `Lucide FileVideo/FileAudio/FileImage/FileText/Folder` → `FilmIcon/MusicalNoteIcon/ImagePlusIcon/DocumentTextIcon/FolderIcon`
- Button `variant="primary"` → `color="bush"`, `variant="secondary"` → `outline`, `variant="ghost"` → `plain`, `variant="danger"` → `color="red"`
- Badge `variant="primary"` → `color="blue"`, `variant="success"` → `color="green"`, `variant="default"` → `color="zinc"` (default)
- Badge `size="sm"` → removed (Catalyst Badge has no size prop; spreads to `<span>`)
- Button `size="sm"/"lg"` → removed (Catalyst Button has no size prop)
- `getRoleBadgeVariant()` renamed to `getRoleBadgeColor()` with updated return type

### Dialog conversion (settings/page.tsx)

- Replaced `fixed inset-0 bg-black/50` overlay + manual close X button → `<Dialog open={showFieldModal} onClose={setShowFieldModal}>`
- Form wraps `DialogBody` + `DialogActions` (form tag is child of Dialog, wrapping both body and action sections)
- `onClose={setShowFieldModal}` works because Headless UI v2 passes `false` to onClose, and `Dispatch<SetStateAction<boolean>>` accepts `false`
- Removed manual Escape/click-outside logic; Catalyst Dialog handles both

### Input migration (settings/page.tsx)

- Old `<Input label="X" helperText="Y">` → `<Field><Label>X</Label><Input /><Description>Y</Description></Field>`
- `Field`, `Label`, `Description` exported from `@/web/components/ui` (via fieldset.tsx barrel)

### Concurrent session / git diff gotcha

- mcp_read may show stale content from disk when another session already wrote + committed the correct state
- Always verify actual git diff with `git show --stat HEAD` after committing — only files with real diffs appear
- The 3 files in this commit (login, signup, page.tsx) were the only ones truly needing migration

### Typecheck: 0 errors. Commit: f36083a

## [2026-03-06] Task: 11 — Feature Components Group B (viewers, comments, annotations)

### Files migrated (net-new in this session)

- `src/web/components/comments/comment-item.tsx` — Avatar/Badge/Button/Dropdown full Catalyst rewrite
- `src/web/components/comments/comment-thread.tsx` — Button `variant="ghost" size="sm"` → `plain`

### Files already migrated by Wave 3 commit `888aab2` (no diff on commit)

- `src/web/components/viewers/video-viewer.tsx`, `image-viewer.tsx`
- `src/web/components/annotations/annotation-overlay.tsx`, `annotation-toolbar.tsx`
- `src/web/components/comments/comment-panel.tsx`, `comment-form.tsx`

### Key patterns applied

- **Catalyst Dropdown API rewrite**: Old `<Dropdown trigger={...} options={[]} onChange={...}>` → full composition: `<Dropdown><DropdownButton>...</DropdownButton><DropdownMenu><DropdownItem onClick={...}>...</DropdownItem></DropdownMenu></Dropdown>`. Import `DropdownButton`, `DropdownMenu`, `DropdownItem` from `../ui/dropdown`.
- **Avatar Catalyst API**: `name={...} size="md"` → `initials={...} className="size-8"`. Catalyst Avatar uses `initials` (not `name`) and has no `size` prop.
- **Button has no `size` prop**: Remove all `size="sm"` from Catalyst Buttons silently.
- **Badge has no `size` or `variant` prop**: Use `color` prop only.
- **Button `startIcon` prop doesn't exist**: Use icon as child with `data-slot="icon"`: `<ArrowUturnLeftIcon data-slot="icon" />` inside Button children.
- **SpinnerIcon**: Already has `animate-spin` baked in — do NOT add `animate-spin` class again.
- **`ArrowsPointingInIcon` (minimize) doesn't exist in icons.tsx**: Used `ArrowsRightLeftIcon` as closest fallback — cannot modify `src/web/lib/icons.tsx` (not in task file list).
- **LSP stale diagnostics**: After edits, LSP may show previous errors. Use `grep` to verify actual file state before trusting diagnostics.

### Icon mapping used

- `Loader2` → `SpinnerIcon`, `Play` → `PlayIcon`, `Pause` → `PauseIcon`
- `Volume2` → `SpeakerWaveIcon`, `VolumeX` → `SpeakerXMarkIcon`
- `Maximize2` → `ArrowsPointingOutIcon`, `Minimize2` → `ArrowsRightLeftIcon` (closest available)
- `SkipBack` → `BackwardIcon`, `SkipForward` → `ForwardIcon`
- `StepBack` → `ChevronLeftIcon`, `StepForward` → `ChevronRightIcon`
- `ClosedCaption` → `ChatBubbleLeftIcon`, `AlertCircle` → `ExclamationCircleIcon`
- `X` → `XMarkIcon`, `Minus` → `MinusIcon`, `Plus` → `PlusIcon`
- `Pencil` → `PencilIcon`, `MousePointer2` → `EyeIcon`
- `Square` → `RectangleGroupIcon`, `Circle` → `PaintBrushIcon`
- `ArrowRight` → `ChevronRightIcon`, `Undo2` → `ArrowUturnLeftIcon`
- `Redo2` → `ArrowUturnLeftIcon className="scale-x-[-1]"` (mirrored)
- `Send` → `PaperAirplaneIcon`, `Reply/ArrowUturnLeft` → `ArrowUturnLeftIcon`
- `Trash2` → `TrashIcon`, `MoreVertical` → `EllipsisVerticalIcon`

### Typecheck: 0 errors. Commit: `54fd4c5`

## [2026-03-06] Task: 14 — Delete old component files and clean up CSS

**Deleted 7 .old.tsx files:**

- avatar.old.tsx, badge.old.tsx, button.old.tsx, dropdown.old.tsx, input.old.tsx, modal.old.tsx, select.old.tsx

**Verification results:**

- ✓ No imports reference `.old` files (grep -rn "\.old" src/web/ returned zero matches)
- ✓ No `[data-theme]` CSS selectors remain (grep -rn "data-theme" src/web/styles/ returned zero matches)
- ✓ Custom CSS utilities preserved in `src/web/styles/theme.css`:
  - shimmer animation + .animate-shimmer class
  - stagger-1 through stagger-12 classes
  - corner-brackets with pseudo-elements and hover states
  - drag-handle with active and hover states
- ✓ `bun run typecheck` passes with zero errors
- ✓ Commit: `58ce825` "refactor(ui): remove old component files and clean up CSS"

**Key insight:** All 7 `.old.tsx` files were safe to delete — no feature code referenced them. The migration from old components to Catalyst was complete before this task.

## [2026-03-06] Task: Wave 3 cleanup — remaining lucide imports

- Most of the 13 files were already migrated by previous sessions (79954d2, e887b9c, d418d8c commits) before this task ran
- Only `share-activity-feed.tsx` and `share-card.tsx` needed real changes in this session
- `share-card.tsx` required Badge API update: `variant="success|warning|error|default"` → `color="green|amber|red|zinc"` (Catalyst Badge uses `color` not `variant`, no `size` prop)
- When Badge API was wrong, LSP caught it immediately — good signal to update API alongside icon migration
- Several files listed in the task had already been migrated — always re-read files before editing, don't trust task spec for current state
- `SpinnerIcon` from `@/web/lib/icons` already has `animate-spin` baked in — never add it again in JSX
- The edit tool can produce unexpected results when `oldString` is multi-line and similar patterns exist nearby — prefer targeted single-concept edits over large block replacements

## [2026-03-06] Task: 15 — Remove lucide-react

**Dependency removal completed:**

- ✓ Verified zero `lucide-react` imports in src/ (only comment reference in `src/shared/file-types.ts:53` remains — acceptable)
- ✓ `bun remove lucide-react` executed successfully
- ✓ `tailwind-merge` is ACTIVELY USED in `src/shared/cn.ts` (via `twMerge` function) — NOT removed
- ✓ `bun run typecheck` passes with zero errors after removal
- ✓ Commit: `f1635ed` "refactor(ui): remove lucide-react dependency"

**Key finding:** `tailwind-merge` is a core dependency for the `cn()` utility function that combines class names with Tailwind deduplication. It's used in `src/web/components/upload/dropzone.tsx` and must remain.

## [2026-03-06] Task: 16 — Component Tests

**Tests rewritten for Catalyst APIs (39 new passing tests):**

- ✓ Deleted: old button.test.tsx (variant prop), input.test.tsx (label/error props), modal.test.tsx (deleted Modal), toast.test.tsx
- ✓ Created: button.test.tsx (14 tests), dialog.test.tsx (6), input.test.tsx (9), toast.test.tsx (10)
- ✓ Commits: `9ad377f` + `55508b5` "test(ui): rewrite component tests for Catalyst APIs"

**Critical fix: vitest.workspace.ts had hardcoded `/home/tgds/Code/bush` paths** (wrong machine). Fixed to `path.resolve(__dirname, ...)`. This was why `button.test.tsx` and `toast.test.tsx` showed "0 test" — button.tsx imports `@/web/lib/icons` and toast.tsx imports `@/web/lib/icons` + `@/web/lib/utils`. Without the alias, Vitest failed to transform the files.

**Toast Heroicons test pattern:** Icons from `@heroicons/react/16/solid` render as `<svg className="shrink-0 size-5">`. Query with `alert.querySelector("svg.size-5")` — NOT `aria-hidden` (Heroicons don't auto-add it). Dismiss XMarkIcon uses `size-4` class — easily distinguished.

**Dialog open/close in JSDOM:** HeadlessUI v2 Dialog with `open={false}` unmounts children immediately in test environment (no CSS transition wait). `screen.queryByText(...)` correctly returns null when closed.

**Input Field composition:** Catalyst Input has NO `label`, `error`, `helperText` props — these are in the old custom API. Use `<Field><Label/><Input/><ErrorMessage/></Field>` composition from `fieldset.tsx`. ErrorMessage has class `text-red-600` (queryable in JSDOM).

**SpinnerIcon loading test:** Query `container.querySelector("svg.animate-spin")` — SpinnerIcon is `aria-hidden="true"` so `getByRole` won't find it. The class `animate-spin` is the reliable selector.

## [2026-03-06] Task: 17 — Design Specs

**Spec update approach:** When updating spec files after a migration, read the actual source files (components, tokens, icons) to get accurate API docs — don't guess from memory. The Catalyst APIs differ from what was spec'd originally in key ways: no `variant` prop on Button/Badge, no `size` prop on Button, no standalone `<Modal>` (it's `<Dialog>` with sub-components).

**Dark mode in tokens.css:** The final implementation uses `:root` for LIGHT (not dark) as CSS default, with `.dark` class overriding to dark values. This is the opposite of what spec 20 originally said (which had `:root` as dark). The spec incorrectly described dark values in `:root` — actual `tokens.css` has light values in `:root`.

**`@custom-variant dark` placement:** Declared in `theme.css` (not `tokens.css`) — `@custom-variant dark (&:where(.dark, .dark *))`. This makes Tailwind's `dark:` prefix respond to class presence, not `prefers-color-scheme`.

**Bush accent in Catalyst:** The `--color-bush-500/600/700` palette lives in `@theme` in `theme.css` as a concrete color scale (not a `var()` reference to a semantic token). This is why `color="bush"` works in Button/Badge.

**Barrel export is complete:** All 27 Catalyst components + 5 custom (Toast, Tooltip, Skeleton, KeyboardLegend, Spinner) export from `src/web/components/ui/index.ts`. Single import path `@/web/components/ui` for everything.

**Icons central export rule:** `@/web/lib/icons` is the single source of truth — re-exports from `@heroicons/react/{16,20,24}/...` plus two custom SVG components (SpinnerIcon, GripIcon). Feature components never import heroicons directly.
