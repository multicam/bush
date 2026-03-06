# Design System: Components & Patterns

**Status**: Updated — Catalyst UI Kit migration complete
**Audience**: Future you. This is a reference doc, not a tutorial.

---

## Overview

This spec covers all interactive components, UI patterns, keyboard shortcuts, and page-level treatments in the Bush design system. Every component here is built on the token foundations defined in `20-design-foundations.md` — colors, spacing, radius, shadows, motion durations, and easings are referenced by name, not by raw value. Read the foundations spec first.

**Component library**: [Catalyst UI Kit](https://catalyst.tailwindui.com/) (Tailwind Labs) — 27 TypeScript components in `src/web/components/ui/`, backed by Headless UI and styled with Tailwind v4. Plus 5 Bush custom components kept from the pre-Catalyst codebase (Toast, Tooltip, Skeleton, KeyboardLegend, Spinner).

**Import all components from the barrel**:

```tsx
import { Button, Dialog, DialogTitle, Field, Input, Badge, Sidebar } from "@/web/components/ui";
```

---

## Specification

### Components

#### Button

Catalyst `Button` component. No `variant` or `size` prop — use `color`, `outline`, or `plain`.

| Prop      | Values                                                      | Usage                                                     |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| `color`   | `"bush"`, `"red"`, `"zinc"`, `"dark/zinc"`, `"white"`, etc. | Solid colored button                                      |
| `outline` | `true`                                                      | Outlined button (no `color` prop)                         |
| `plain`   | `true`                                                      | No border/background — tertiary, toolbar actions          |
| `loading` | `true`                                                      | Prepends `SpinnerIcon`, disables button, sets `aria-busy` |
| `href`    | `string`                                                    | Renders as `<Link>` instead of `<button>`                 |

**Primary action**: `color="bush"` — uses `--color-bush-500: #ff4017`  
**Destructive**: `color="red"` — use sparingly (prefer undo pattern)  
**No size prop** — responsive sizing built-in: slightly smaller on `sm:` breakpoint.

States: hover (white overlay), active (darker), disabled (`opacity-50`, no pointer), loading (spinner + `aria-busy`).

Focus: `outline-2 outline-offset-2 outline-blue-500` (Headless UI managed).

```tsx
import { Button } from '@/web/components/ui'

<Button color="bush">Upload files</Button>
<Button outline>Cancel</Button>
<Button plain>Settings</Button>
<Button color="red">Delete project</Button>
<Button color="bush" loading>Saving…</Button>
<Button color="bush" href="/dashboard">Go to dashboard</Button>
```

---

#### Input / Field

Catalyst `Input` + `Field` / `Label` / `ErrorMessage` / `Description` pattern (from `fieldset.tsx`). Always wrap `Input` in a `Field` for accessible label association.

```tsx
import { Field, Label, Input, ErrorMessage, Description } from '@/web/components/ui'

<Field>
  <Label>Email</Label>
  <Input type="email" name="email" />
</Field>

<Field>
  <Label>Password</Label>
  <Description>Min 8 characters</Description>
  <Input type="password" name="password" />
  <ErrorMessage>Password is required</ErrorMessage>
</Field>
```

With leading icon (using `InputGroup`):

```tsx
import { InputGroup, Input } from "@/web/components/ui";
import { MagnifyingGlassIcon } from "@/web/lib/icons";

<InputGroup>
  <MagnifyingGlassIcon data-slot="icon" />
  <Input type="search" placeholder="Search…" />
</InputGroup>;
```

`Input` supports all standard HTML input types: `text`, `email`, `password`, `search`, `number`, `tel`, `url`, plus date types.

States: `data-hover` (darker border), `data-invalid` (red border), `data-disabled` (dimmed + locked). Pass `data-invalid` to show error styling; pair with `ErrorMessage` for accessible error text.

---

#### Select

Catalyst `Select` component — wraps native `<select>` with custom styling. Matches `Input` dimensions and styling. Always wrap in `Field` + `Label` like `Input`. Custom chevron icon (`ChevronDownIcon`, `--text-muted`).

```tsx
import { Field, Label, Select } from "@/web/components/ui";

<Field>
  <Label>Status</Label>
  <Select name="status">
    <option value="active">Active</option>
    <option value="archived">Archived</option>
  </Select>
</Field>;
```

---

#### Dialog

Catalyst `Dialog` component backed by Headless UI. Handles click-outside, `Escape` key, and focus trapping automatically — no manual wiring needed.

**Sizes** (Tailwind `max-w-*`): `xs`, `sm`, `md`, `lg` (default), `xl`, `2xl`, `3xl`, `4xl`, `5xl`

**Anatomy**:

```tsx
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
  Button,
} from "@/web/components/ui";

<Dialog open={isOpen} onClose={setIsOpen}>
  <DialogTitle>Delete project</DialogTitle>
  <DialogDescription>This action cannot be undone.</DialogDescription>
  <DialogBody>{/* content */}</DialogBody>
  <DialogActions>
    <Button plain onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button color="red">Delete</Button>
  </DialogActions>
</Dialog>;
```

- **Backdrop**: `zinc-950/25` (light) / `zinc-950/50` (dark), transitions on open/close
- **Panel**: `bg-white` / `dark:bg-zinc-900`, `rounded-2xl`, `shadow-lg`, `ring-1`
- **Mobile**: slides up from bottom. **Desktop**: scale + fade transition
- **Accessibility**: `role="dialog"`, focus trap, `aria-labelledby` via `DialogTitle`

---

#### Toast (Custom — kept from pre-Catalyst codebase)

Custom Sonner-style toast — `import { toast } from '@/web/components/ui'`

- **Position**: Top-center, stacked vertically, `--z-toast`
- **Background**: `--surface-2`, `--border-default` border
- **Types**: `success` (green left accent), `error` (red), `warning` (amber), `info` (blue), `neutral` (no accent)
- **Actions**: Optional action buttons ("Undo", "View file") — right-aligned, `plain` style
- **Auto-dismiss**: 5s default, pauses on hover. Errors persist until dismissed.
- **Animation**: Slide down + fade in. Stack shifts smoothly when new toasts arrive.
- **Max visible**: 3. Older toasts compress into a count badge.

---

#### Dropdown

Catalyst `Dropdown` / `DropdownButton` / `DropdownMenu` / `DropdownItem` backed by Headless UI `Menu`. Keyboard navigation (arrows, Enter, Escape) handled automatically.

```tsx
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownSection,
} from "@/web/components/ui";
import { EllipsisHorizontalIcon } from "@/web/lib/icons";

<Dropdown>
  <DropdownButton plain>
    <EllipsisHorizontalIcon />
  </DropdownButton>
  <DropdownMenu anchor="bottom end">
    <DropdownItem href="/settings">Settings</DropdownItem>
    <DropdownSeparator />
    <DropdownItem onClick={handleDelete}>Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>;
```

- **Background**: `bg-white/75 backdrop-blur-xl` / `dark:bg-zinc-800/75`
- **Shadow**: `shadow-lg ring-1 ring-zinc-950/10`
- **`anchor` prop**: `"bottom"`, `"bottom start"`, `"bottom end"`, `"top"`, etc.
- **Destructive items**: Add `className="text-red-600 dark:text-red-500"` to `DropdownItem`
- **Leading icons**: Place inside `DropdownItem` with `data-slot="icon"`

---

#### Tooltip

- **Background**: `--surface-3` (dark), `--surface-0` (light, for contrast)
- **Text**: `caption` size (12px), `--text-primary`
- **Radius**: `--radius-xs`
- **Arrow**: 6px CSS triangle
- **Delay**: 500ms show, 0ms hide
- **Position**: Auto (prefers top, flips if clipped)
- **Keyboard shortcut hint**: Right-aligned, `--text-muted`, `code` font

---

#### Badge

Catalyst `Badge` with `color` prop (Tailwind color name). No `variant` prop. Optionally interactive via `BadgeButton`.

| Scenario                       | Color prop         |
| ------------------------------ | ------------------ |
| Neutral / default              | `"zinc"` (default) |
| Success / ready / approved     | `"green"`          |
| Warning / pending / processing | `"amber"`          |
| Error / failed                 | `"red"`            |
| Info / active                  | `"blue"`           |
| Bush accent highlight          | `"orange"`         |

```tsx
import { Badge, BadgeButton } from '@/web/components/ui'

<Badge color="green">Approved</Badge>
<Badge color="amber">Processing</Badge>
<Badge color="red">Failed</Badge>
<BadgeButton color="zinc" href="/status">Draft</BadgeButton>
```

Size: `text-sm/5 sm:text-xs/5`, `rounded-md`, `px-1.5 py-0.5`.

---

#### Avatar

Catalyst `Avatar` component.

- **Shape**: Rounded square (`--radius-md`)
- **Sizes**: `sm` (28px), `md` (36px), `lg` (44px), `xl` (56px) — set via `className="size-8"` etc.
- **Fallback**: Initials or geometric pattern — provide `initials` prop or `src` for image
- **Presence dot**: 8px circle, bottom-right, border `2px --surface-1` (to cut out from background)
  - Online: `--status-success`
  - Away: `--status-warning`
  - Offline: `--text-muted`

---

#### Sidebar

Catalyst sidebar components from `sidebar.tsx`. Used as the app's primary navigation shell.

**Components**: `Sidebar`, `SidebarHeader`, `SidebarBody`, `SidebarFooter`, `SidebarSection`, `SidebarItem`, `SidebarLabel`, `SidebarHeading`, `SidebarDivider`, `SidebarSpacer`

**Layout shell**: `SidebarLayout` from `sidebar-layout.tsx` — positions sidebar alongside main content.

```tsx
import {
  SidebarLayout,
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarFooter,
  SidebarSection,
  SidebarItem,
  SidebarLabel,
  SidebarHeading,
} from "@/web/components/ui";
import { HomeIcon, BriefcaseIcon } from "@/web/lib/icons";

<SidebarLayout
  sidebar={
    <Sidebar>
      <SidebarHeader>{/* Logo, workspace switcher */}</SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarHeading>Navigation</SidebarHeading>
          <SidebarItem href="/dashboard" current={pathname === "/dashboard"}>
            <HomeIcon />
            <SidebarLabel>Dashboard</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/projects" current={pathname.startsWith("/projects")}>
            <BriefcaseIcon />
            <SidebarLabel>Projects</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarBody>
      <SidebarFooter>{/* User avatar, theme toggle */}</SidebarFooter>
    </Sidebar>
  }
>
  {children}
</SidebarLayout>;
```

- `current` prop on `SidebarItem` highlights the active route
- `SidebarItem` renders as `<Link>` when `href` is provided, `<button>` otherwise
- Icons inside `SidebarItem` use `20/solid` Heroicons (via `@/web/lib/icons`)

---

#### Spinner

Two paths depending on context:

1. **`SpinnerIcon`** from `@/web/lib/icons` — custom inline SVG with `animate-spin`. For standalone use or inside Catalyst's `data-slot="icon"` pattern.
2. **`Spinner`** from `@/web/components/ui` — thin wrapper for use outside button context.

```tsx
import { SpinnerIcon } from '@/web/lib/icons'

<SpinnerIcon className="size-4" />   {/* 16px */}
<SpinnerIcon className="size-5" />   {/* 20px */}
<SpinnerIcon className="size-6" />   {/* 24px */}
<SpinnerIcon data-slot="icon" />     {/* Catalyst icon slot */}
```

Color: `currentColor`. The `Button` component uses `SpinnerIcon` internally when `loading={true}`.

---

#### Table

- **Header**: `label` style (11px, uppercase, `--text-muted`), no background
- **Rows**: No zebra striping. Separator: 1px `--border-default` between rows.
- **Hover**: `--surface-2` background
- **Selection**: Checkbox column appears on hover (first column). Selected rows get `--accent-muted` background.
- **Actions**: Via context menu (right-click or kebab icon on hover)
- **Sort**: Click column header. Arrow indicator (`ChevronUpIcon` / `ChevronDownIcon` from `@/web/lib/icons`), `--text-muted`
- **Density**: Dense mode by default (tables are inherently data-heavy)

---

#### Command Palette

- **Trigger**: `Cmd+K` (Mac) / `Ctrl+K` (Linux/Windows)
- **Position**: Top-center, `--z-command-palette` (900), with backdrop blur
- **Width**: 560px
- **Structure**:
  - Search input at top (no border, large font `h4` 16px)
  - Results grouped by category with `label` headers
  - Each result: icon (16px) + name + optional description (`--text-muted`) + shortcut hint (right-aligned, `code` font)
- **Navigation**: Arrow keys, Enter to select, Escape to close
- **Animation**: `scale(0.98)→1` + `opacity`, `--duration-enter`
- **Recent**: Shows recent commands/files when input is empty
- **Nested**: Selecting a category (e.g., "Go to project...") narrows results. Backspace returns to root.

---

#### Keyboard Legend

- **Trigger**: `?` key (when no input is focused)
- **Display**: Modal-style overlay listing contextual shortcuts
- **Grouping**: By context (Global, Navigation, Viewer, Asset Grid, Comments)
- **Format**: Description left, key combo right in `<kbd>` styled badges
- **`<kbd>` style**: `--surface-3` background, `--border-default` border, `--radius-xs`, `code` font, `caption` size

---

### Keyboard Shortcuts

#### Global

| Key                    | Action               |
| ---------------------- | -------------------- |
| `Cmd/Ctrl + K`         | Command palette      |
| `?`                    | Keyboard legend      |
| `Cmd/Ctrl + /`         | Toggle sidebar       |
| `Cmd/Ctrl + Shift + U` | Toggle upload drawer |

#### Navigation

| Key        | Action              |
| ---------- | ------------------- |
| `G then D` | Go to Dashboard     |
| `G then P` | Go to Projects      |
| `G then S` | Go to Shares        |
| `G then N` | Go to Notifications |

#### Asset Grid

| Key                    | Action                                |
| ---------------------- | ------------------------------------- |
| `J` / `K`              | Next / previous item                  |
| `Enter`                | Open selected item                    |
| `Space`                | Quick preview                         |
| `Cmd/Ctrl + A`         | Select all                            |
| `Delete` / `Backspace` | Delete selected (with undo toast)     |
| `N`                    | New folder                            |
| `U`                    | Upload files                          |
| `1` / `2` / `3`        | Density: compact / default / expanded |

#### Viewer

| Key               | Action                   |
| ----------------- | ------------------------ |
| `Space`           | Play / pause             |
| `←` / `→`         | Seek -5s / +5s           |
| `Shift + ←` / `→` | Seek -1 frame / +1 frame |
| `↑` / `↓`         | Volume up / down         |
| `M`               | Mute / unmute            |
| `F`               | Fullscreen               |
| `C`               | Toggle comment panel     |
| `Escape`          | Close viewer             |
| `[` / `]`         | Previous / next file     |

#### Comments

| Key                | Action                       |
| ------------------ | ---------------------------- |
| `Cmd/Ctrl + Enter` | Submit comment               |
| `Escape`           | Cancel reply / discard draft |

---

### Patterns

#### Empty States

Minimal. Three elements only:

1. **Icon**: Relevant Heroicons 24/outline icon, 48px (`size-12`), `text-text-muted`. Import from `@/web/lib/icons`.
2. **Text**: One sentence, `body` size, `--text-secondary`. Conversational. ("No files here yet.")
3. **Action**: Single `color="bush"` or `outline` button. ("Upload files")

No illustrations. No multi-paragraph explanations.

---

#### Loading States (Skeletons)

- Skeletons mirror the exact layout of the content they replace
- Background: `--surface-3`
- Shimmer: Linear gradient sweep (`--surface-3` → `--surface-4` → `--surface-3`), 1.5s, infinite
- **Asset grid**: Skeleton cards at current density setting
- **Comment panel**: Skeleton comment bubbles (avatar circle + text lines)
- **Tables**: Skeleton rows with column-width-matched bars
- **Viewer**: Full dark area with centered `Spinner`

---

#### Error States

Conversational, not clinical.

| Context            | Message style                           | Example                                     |
| ------------------ | --------------------------------------- | ------------------------------------------- |
| Inline field error | Red text below input, `caption` size    | "That email's already taken"                |
| Toast error        | `error` toast, persists until dismissed | "Upload failed. Retry?" (with Retry action) |
| Full-page error    | Empty state pattern with error icon     | "Something broke. Try refreshing."          |

---

#### Destructive Actions

**No confirmation modals.** Use optimistic action + undo toast.

Flow:

1. User clicks delete
2. Item immediately removed from UI (fade-out animation)
3. Toast appears: "Deleted [item name]. Undo?" — 8s timeout
4. Undo restores the item with fade-in animation
5. After timeout, deletion is committed server-side

Exception: Irreversible actions with high blast radius (delete workspace, remove team member) get a **confirmation input** — type the name to confirm. Not a modal with "Are you sure?" buttons.

---

#### Drag and Drop

- **Drag handle**: `GripIcon` from `@/web/lib/icons` (custom 2×3 dot SVG), hidden by default, fades in on hover (`--text-muted`). Apply `.drag-handle` CSS class.
- **Drag preview**: Semi-transparent clone of the item, slight rotation (2deg), `--shadow-lg`
- **Drop target**: `--accent-muted` background + dashed `--accent` border on valid targets
- **Invalid target**: No visual change (don't show red — just don't show green)

---

### Upload Drawer

- **Position**: Bottom of viewport, full width, above toasts (`--z-upload-drawer`)
- **Height**: Auto based on content, max 40vh, scrollable internally
- **Background**: `--surface-2`, `--border-default` top border
- **Behavior**: Auto-appears when uploads start. Auto-dismisses 3s after all uploads complete. Drag handle to resize. Can be manually collapsed to a thin bar showing count + overall progress.
- **Per-file row**: Filename (truncated) + file type icon + progress bar + percentage + status icon (spinner → check → error)
- **Progress bar**: 2px height, `--accent` fill, `--surface-3` track
- **Actions**: Pause/resume per file, cancel per file, "Cancel all" in header

---

### Share Pages

Share pages (`/s/[slug]`) are Bush's public face. They follow a **different** visual treatment than the app.

#### Differences from App

| Property      | App                    | Share Page                                |
| ------------- | ---------------------- | ----------------------------------------- |
| Default theme | Dark                   | Light                                     |
| Typography    | Functional (14px body) | Editorial (`display` headings, 16px body) |
| Spacing       | Airy/dense contextual  | Generous throughout                       |
| Branding      | Bush nav               | Bush logo + sharer's logo                 |
| Viewer        | Dark always            | Dark always (consistent)                  |
| Target        | Desktop                | Responsive (desktop + tablet + phone)     |

#### Layout

```
┌──────────────────────────────────────────────┐
│ [Bush logo]              [Sharer logo/name]  │
├──────────────────────────────────────────────┤
│                                              │
│  [Share title — display typography]          │
│  [Description — body 16px]                   │
│                                              │
│  [Asset grid or single viewer]               │
│                                              │
│  [Comments (if enabled)]                     │
│                                              │
├──────────────────────────────────────────────┤
│  Powered by Bush                             │
└──────────────────────────────────────────────┘
```

#### Responsive Breakpoints (share pages only)

| Breakpoint | Width      | Adjustments                                             |
| ---------- | ---------- | ------------------------------------------------------- |
| Desktop    | ≥1024px    | Full layout, side-by-side where applicable              |
| Tablet     | 768–1023px | Single column, reduced spacing                          |
| Mobile     | <768px     | Stacked layout, full-width assets, collapsible comments |

#### Password Protection

If share requires a password, show a centered card with:

- Bush logo
- Sharer's logo
- "This share is password protected"
- Password input + Submit button
- Minimal, elegant. No extra chrome.

---

### Presence & Collaboration

#### User Cursors (Viewer/Canvas)

- **Cursor**: Small arrow + name label below
- **Label**: `caption` size, `--radius-xs`, padding `2px 6px`
- **Color**: Assigned per-user from a fixed palette of 8 distinguishable colors (not the accent color — these need to be distinct from each other):
  - `#f97316` (orange), `#8b5cf6` (purple), `#06b6d4` (cyan), `#ec4899` (pink),
  - `#22c55e` (green), `#eab308` (yellow), `#6366f1` (indigo), `#14b8a6` (teal)
- **Fade**: Cursor fades to `0.3` opacity after 5s of no movement. Returns to `1` on move.

#### Avatar Stack (Project Header)

Up to 4 avatars stacked with `-8px` overlap. `+N` badge for overflow. Each avatar shows presence color ring (2px).

---

### Accessibility

Not a separate concern — built into every component above.

#### Non-negotiables

- **Focus visible**: `--shadow-accent` ring on all interactive elements via `:focus-visible` (not `:focus` — no rings on click)
- **Color contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for large text/UI). The dark palette + `--text-primary` on `--surface-1` = ~16:1 ratio.
- **`prefers-reduced-motion`**: All animations disabled (see `20-design-foundations.md` Motion section)
- **Keyboard navigation**: Every action reachable without a mouse. Tab order follows visual order.
- **ARIA**: Labels on icon-only buttons, `role="dialog"` on modals, `aria-live="polite"` on toasts
- **Semantic HTML**: `<nav>`, `<main>`, `<header>`, `<button>`, `<dialog>`. No `<div>` buttons.

---

## Cross-References

- `20-design-foundations.md` — Tokens, color system, spacing, radius, shadows, motion durations and easings, layout primitives, z-index scale, iconography conventions referenced throughout this spec
- `00-product-reference.md` / `00-product-reference.md` — Feature scope that determines which components are needed and in which contexts
- `04-api-reference.md` / `04-api-reference.md` — API endpoints that components consume (file lists, comment threads, share data, upload endpoints)
- `05-realtime.md` — WebSocket event types that drive presence cursors, avatar stack state, and real-time comment updates
