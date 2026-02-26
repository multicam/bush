# Design System: Components & Patterns

**Status**: Spec complete, implementation pending
**Audience**: Future you. This is a reference doc, not a tutorial.

---

## Overview

This spec covers all interactive components, UI patterns, keyboard shortcuts, and page-level treatments in the Bush design system. Every component here is built on the token foundations defined in `20-design-foundations.md` — colors, spacing, radius, shadows, motion durations, and easings are referenced by name, not by raw value. Read the foundations spec first.

---

## Specification

### Components

#### Button

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| `primary` | `--accent` | `--text-inverse` | none | Main CTAs |
| `secondary` | `transparent` | `--text-primary` | `--border-default` | Secondary actions |
| `ghost` | `transparent` | `--text-secondary` | none | Tertiary, toolbar actions |
| `danger` | `transparent` | `--status-error` | `--status-error` | Destructive (but remember: undo > confirm) |

| Size | Height | Padding (h) | Font | Radius |
|------|--------|-------------|------|--------|
| `sm` | 32px | 12px | `body-sm` (13px) | `--radius-sm` |
| `md` | 36px | 16px | `body` (14px) | `--radius-sm` |
| `lg` | 40px | 20px | `body` (14px) | `--radius-sm` |

States: hover (background shift), active (darker), disabled (`opacity: 0.5`, no pointer), loading (spinner replaces label, width maintained).

Primary button hover: `--accent-hover`. Shadow: `--shadow-accent` on focus.

---

#### Input

Single-line text input.

| Property | Value |
|----------|-------|
| Background | `--surface-2` |
| Border | `--border-default`, `--border-active` on focus |
| Text | `--text-primary` |
| Placeholder | `--text-muted` |
| Radius | `--radius-sm` |
| Focus | `--shadow-accent` ring |
| Heights | Same as button sizes (32/36/40px) |

Support: start icon, end icon, error state (border `--status-error`), helper text below.

---

#### Select

Native `<select>` with custom styling. Matches input dimensions and styling. Custom chevron icon (`ChevronDown`, `--text-muted`).

---

#### Modal

- **Backdrop**: `--surface-0` at `60%` opacity, `backdrop-filter: blur(4px)`
- **Dialog**: `--surface-2` background, `--radius-lg`, `--shadow-lg`
- **Sizes**: `sm` (400px), `md` (520px), `lg` (680px), `xl` (860px), `full` (90vw × 90vh)
- **Animation**: Backdrop fades in. Dialog `scale(0.98)→1` + `opacity 0→1`, `--duration-enter`.
- **Close**: `X` button top-right + `Escape` key. Focus trapped inside.

---

#### Toast (Sonner-style)

- **Position**: Top-center, stacked vertically
- **Background**: `--surface-2`, `--border-default` border
- **Types**: `success` (green left accent), `error` (red), `warning` (amber), `info` (blue), `neutral` (no accent)
- **Actions**: Optional action buttons ("Undo", "View file") — right-aligned, ghost style
- **Auto-dismiss**: 5s default, pauses on hover. Errors persist until dismissed.
- **Animation**: Slide down + fade in. Stack shifts smoothly when new toasts arrive.
- **Max visible**: 3. Older toasts compress into a count badge.

---

#### Dropdown / Context Menu

- **Background**: `--surface-2`
- **Border**: `--border-default`, `--radius-md`
- **Shadow**: `--shadow-md`
- **Items**: `body-sm` (13px), `--space-2` vertical padding, `--space-3` horizontal
- **Hover**: `--surface-3` background
- **Separator**: 1px `--border-default`, `--space-1` margin
- **Keyboard**: Arrow keys navigate, Enter selects, Escape closes
- **Icons**: Optional leading icon per item, 16px, `--text-muted`
- **Destructive items**: `--status-error` text color

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

| Variant | Background | Text |
|---------|-----------|------|
| `default` | `--surface-3` | `--text-secondary` |
| `accent` | `--accent-muted` | `--accent` |
| `success` | `rgba(34,197,94,0.15)` | `--status-success` |
| `warning` | `rgba(245,158,11,0.15)` | `--status-warning` |
| `error` | `rgba(239,68,68,0.15)` | `--status-error` |

Size: `caption` (12px), `--radius-full`, horizontal padding `--space-2`, height 22px.

---

#### Avatar

- **Shape**: Rounded square (`--radius-md`)
- **Sizes**: `sm` (28px), `md` (36px), `lg` (44px), `xl` (56px)
- **Fallback**: Geometric pattern + initials (Figma-style), color derived from user ID hash
- **Presence dot**: 8px circle, bottom-right, border `2px --surface-1` (to cut out from background)
  - Online: `--status-success`
  - Away: `--status-warning`
  - Offline: `--text-muted`

---

#### Spinner

Lucide `Loader2` icon with CSS `rotate` animation, `1s linear infinite`.
Sizes match icon sizes: 16px, 20px, 24px. Color: `currentColor`.

---

#### Table

- **Header**: `label` style (11px, uppercase, `--text-muted`), no background
- **Rows**: No zebra striping. Separator: 1px `--border-default` between rows.
- **Hover**: `--surface-2` background
- **Selection**: Checkbox column appears on hover (first column). Selected rows get `--accent-muted` background.
- **Actions**: Via context menu (right-click or kebab icon on hover)
- **Sort**: Click column header. Arrow indicator (`ChevronUp`/`ChevronDown`), `--text-muted`
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

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Command palette |
| `?` | Keyboard legend |
| `Cmd/Ctrl + /` | Toggle sidebar |
| `Cmd/Ctrl + Shift + U` | Toggle upload drawer |

#### Navigation

| Key | Action |
|-----|--------|
| `G then D` | Go to Dashboard |
| `G then P` | Go to Projects |
| `G then S` | Go to Shares |
| `G then N` | Go to Notifications |

#### Asset Grid

| Key | Action |
|-----|--------|
| `J` / `K` | Next / previous item |
| `Enter` | Open selected item |
| `Space` | Quick preview |
| `Cmd/Ctrl + A` | Select all |
| `Delete` / `Backspace` | Delete selected (with undo toast) |
| `N` | New folder |
| `U` | Upload files |
| `1` / `2` / `3` | Density: compact / default / expanded |

#### Viewer

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `←` / `→` | Seek -5s / +5s |
| `Shift + ←` / `→` | Seek -1 frame / +1 frame |
| `↑` / `↓` | Volume up / down |
| `M` | Mute / unmute |
| `F` | Fullscreen |
| `C` | Toggle comment panel |
| `Escape` | Close viewer |
| `[` / `]` | Previous / next file |

#### Comments

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + Enter` | Submit comment |
| `Escape` | Cancel reply / discard draft |

---

### Patterns

#### Empty States

Minimal. Three elements only:

1. **Icon**: Relevant Lucide icon, 48px, `--text-muted`
2. **Text**: One sentence, `body` size, `--text-secondary`. Conversational. ("No files here yet.")
3. **Action**: Single `primary` or `secondary` button. ("Upload files")

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

| Context | Message style | Example |
|---------|--------------|---------|
| Inline field error | Red text below input, `caption` size | "That email's already taken" |
| Toast error | `error` toast, persists until dismissed | "Upload failed. Retry?" (with Retry action) |
| Full-page error | Empty state pattern with error icon | "Something broke. Try refreshing." |

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

- **Drag handle**: `GripVertical` icon, hidden by default, fades in on hover (`--text-muted`)
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

| Property | App | Share Page |
|----------|-----|-----------|
| Default theme | Dark | Light |
| Typography | Functional (14px body) | Editorial (`display` headings, 16px body) |
| Spacing | Airy/dense contextual | Generous throughout |
| Branding | Bush nav | Bush logo + sharer's logo |
| Viewer | Dark always | Dark always (consistent) |
| Target | Desktop | Responsive (desktop + tablet + phone) |

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

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Desktop | ≥1024px | Full layout, side-by-side where applicable |
| Tablet | 768–1023px | Single column, reduced spacing |
| Mobile | <768px | Stacked layout, full-width assets, collapsible comments |

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
