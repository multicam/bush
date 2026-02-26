# Bush Design System

**Status**: Spec complete, implementation pending
**Reference**: [agno.com docs](https://docs.agno.com/) — dark-first, generous whitespace, depth via background layering
**Audience**: Future you. This is a reference doc, not a tutorial.

---

## Design Principles

Every decision in this system traces back to five principles:

| Principle | Meaning | Example |
|-----------|---------|---------|
| **Quiet until needed** | UI elements hide until relevant | Drag handles appear on hover. Upload drawer auto-shows/hides. Sidebar is a thin rail until hovered. |
| **No clutter, just the stuff** | Remove anything that doesn't serve the current task | No zebra-striped tables. No confirmation modals — use undo. Monochromatic file types — icons, not colors. |
| **Airy by default, dense when working** | Generous spacing that tightens in high-density contexts | Content areas use relaxed padding. Asset grids compress via density slider. |
| **Dark-first, light-available** | Dark theme is the default experience | Dark is designed first, light is derived. User toggle, dark on first visit. |
| **Motion is meaning** | Animation communicates state changes, not decoration | Skeleton shimmer = loading. Slide-in = new content. Fade-out = removed. Corner brackets = interactive. |

---

## Migration Strategy

### From: CSS Modules + `globals.css` utility classes (BEM)
### To: Tailwind CSS v4 + CSS custom properties

**Why Tailwind v4**: Native CSS-based configuration via `@theme`. CSS custom properties are the source of truth — Tailwind consumes them. Tokens remain accessible outside Tailwind (canvas rendering, SVG, custom video player).

### Approach

1. Install Tailwind v4 + `@tailwindcss/vite` (or postcss plugin for Next.js)
2. Define all tokens as CSS custom properties in a `tokens.css` file
3. Map tokens to Tailwind via `@theme` in the main CSS entry
4. Migrate components one-by-one — coexistence with CSS Modules during transition
5. Delete each `.module.css` file after its component is migrated
6. Remove `globals.css` utility classes (`.btn`, `.input`, etc.) as components move to Tailwind
7. Keep `tokens.css` as the permanent source of truth

### File structure (post-migration)

```
src/web/
  styles/
    tokens.css          ← CSS custom properties (source of truth)
    theme.css           ← @theme mapping + Tailwind directives
    scrollbar.css       ← Custom scrollbar overrides
    globals.css         ← Minimal resets, font-face declarations
```

### Token → Tailwind mapping example

```css
/* tokens.css */
:root {
  --surface-0: #09090b;
  --surface-1: #18181b;
  /* ... */
}

/* theme.css */
@import "tailwindcss";
@import "./tokens.css";

@theme {
  --color-surface-0: var(--surface-0);
  --color-surface-1: var(--surface-1);
}
```

Usage: `bg-surface-0`, `text-primary`, `border-default`.

---

## Color System

### Architecture

Three layers:

```
Primitives (raw values)
  → Semantic tokens (purpose-based names)
    → Tailwind classes (utility usage)
```

Primitives are never used directly in components. Semantic tokens are what you reference.

### Dark Theme (default)

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-0` | `#09090b` | Deepest background (sidebar rail, inset areas) |
| `--surface-1` | `#111113` | Page background |
| `--surface-2` | `#18181b` | Cards, panels, elevated surfaces |
| `--surface-3` | `#27272a` | Hover states, active backgrounds |
| `--surface-4` | `#3f3f46` | Active/pressed states |
| | | |
| `--border-default` | `#27272a` | Standard borders |
| `--border-hover` | `#3f3f46` | Borders on hover |
| `--border-active` | `#52525b` | Borders on active/focus |
| | | |
| `--text-primary` | `#fafafa` | Headings, primary content |
| `--text-secondary` | `#a1a1aa` | Descriptions, supporting text |
| `--text-muted` | `#71717a` | Placeholders, disabled, timestamps |
| `--text-inverse` | `#18181b` | Text on accent backgrounds |
| | | |
| `--accent` | `#ff4017` | Primary actions, links, focus rings |
| `--accent-hover` | `#e63a14` | Accent on hover |
| `--accent-active` | `#cc3311` | Accent on press |
| `--accent-muted` | `rgba(255, 64, 23, 0.15)` | Accent backgrounds (badges, highlights) |
| `--accent-glow` | `rgba(255, 64, 23, 0.25)` | Focus ring glow |
| | | |
| `--status-success` | `#22c55e` | Completed, ready, online |
| `--status-warning` | `#f59e0b` | Processing, pending |
| `--status-error` | `#ef4444` | Failed, destructive |
| `--status-info` | `#3b82f6` | Informational |

### Light Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-0` | `#ffffff` | Deepest background |
| `--surface-1` | `#fafafa` | Page background |
| `--surface-2` | `#f4f4f5` | Cards, panels |
| `--surface-3` | `#e4e4e7` | Hover states |
| `--surface-4` | `#d4d4d8` | Active/pressed |
| | | |
| `--border-default` | `#e4e4e7` | Standard borders |
| `--border-hover` | `#d4d4d8` | Borders on hover |
| `--border-active` | `#a1a1aa` | Borders on active/focus |
| | | |
| `--text-primary` | `#18181b` | Headings, primary content |
| `--text-secondary` | `#52525b` | Descriptions |
| `--text-muted` | `#a1a1aa` | Placeholders, disabled |
| `--text-inverse` | `#fafafa` | Text on accent backgrounds |
| | | |
| `--accent` | `#ff4017` | Same across themes |
| `--accent-hover` | `#e63a14` | |
| `--accent-active` | `#cc3311` | |
| `--accent-muted` | `rgba(255, 64, 23, 0.10)` | Slightly less opaque in light |
| `--accent-glow` | `rgba(255, 64, 23, 0.20)` | |
| | | |
| Status tokens | Same values | Status colors are theme-independent |

### Theme Implementation

```css
/* Dark (default) */
:root {
  --surface-0: #09090b;
  /* ... all dark tokens */
}

/* Light (user-toggled) */
[data-theme="light"] {
  --surface-0: #ffffff;
  /* ... all light overrides */
}
```

Theme toggle writes `data-theme` attribute to `<html>`. Persist choice in `localStorage`. Default to `dark` on first visit.

### Viewer Context

The media viewer (video, audio, image, PDF) is **always dark** regardless of theme. This is intentional — media needs a neutral dark backdrop for accurate color perception. The viewer area uses `--surface-0` and `--surface-1` from the dark palette directly, not from the current theme.

```css
[data-viewer] {
  --surface-0: #09090b;
  --surface-1: #111113;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --border-default: #27272a;
}
```

---

## Typography

### Fonts

| Role | Family | Load |
|------|--------|------|
| Body | `'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif` | Google Fonts / self-hosted, `font-display: swap`, variable weight |
| Code | `'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace` | Google Fonts / self-hosted, `font-display: swap` |

### Type Scale

| Name | Size | Weight | Line height | Tracking | Usage |
|------|------|--------|-------------|----------|-------|
| `display` | 48px | 700 | 1.1 | -0.02em | Hero headings (marketing, share pages) |
| `h1` | 32px | 600 | 1.2 | -0.02em | Page titles |
| `h2` | 24px | 600 | 1.3 | -0.01em | Section headings |
| `h3` | 20px | 600 | 1.4 | 0 | Subsection headings |
| `h4` | 16px | 600 | 1.5 | 0 | Card titles, panel headers |
| `body` | 14px | 400 | 1.6 | 0 | Default text |
| `body-sm` | 13px | 400 | 1.5 | 0 | Secondary content, table cells |
| `caption` | 12px | 400 | 1.4 | 0 | Timestamps, helper text, metadata |
| `label` | 11px | 500 | 1.3 | 0.05em | Uppercase section labels, overlines |
| `code` | 13px | 400 | 1.6 | 0 | Inline code, code blocks (JetBrains Mono) |

### Rules

- **14px body** — not 16px. Bush is a tool, not a reading app. 14px is information-dense without being cramped.
- **`-0.02em` tracking on large text** — Inter opens up at large sizes. Tighten it.
- **`label` is always uppercase** — used for section dividers, overlines, metadata category headers.
- **No font size below 11px** — accessibility floor.

---

## Spacing

### Base Unit: 4px

| Token | Value | Common use |
|-------|-------|------------|
| `--space-0` | 0 | — |
| `--space-1` | 4px | Tight gaps (icon-to-text) |
| `--space-2` | 8px | Inline element spacing, compact padding |
| `--space-3` | 12px | Input padding, small component gaps |
| `--space-4` | 16px | Standard component padding, list gaps |
| `--space-5` | 20px | Card padding, section gaps |
| `--space-6` | 24px | Content area padding (airy default) |
| `--space-8` | 32px | Section separation |
| `--space-10` | 40px | Large section gaps |
| `--space-12` | 48px | Page-level vertical rhythm |
| `--space-16` | 64px | Major section breaks |
| `--space-20` | 80px | Hero spacing, share page sections |

### Density Modes

Two density contexts, not a global toggle:

| Context | Content padding | Component gaps | Applied where |
|---------|-----------------|----------------|---------------|
| **Default (airy)** | `--space-6` (24px) | `--space-4` (16px) | Most of the app — dashboards, settings, share management |
| **Dense** | `--space-3` (12px) | `--space-2` (8px) | Asset grids, metadata tables, folder trees, comment threads |

Dense mode is automatic based on context, not user-toggled (except via the asset grid density slider).

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Small inline elements, chips |
| `--radius-sm` | 6px | Buttons, inputs, select |
| `--radius-md` | 8px | Cards, dropdowns, menus |
| `--radius-lg` | 12px | Modals, panels, dialogs |
| `--radius-full` | 9999px | Pills, tags, badges, avatars |

Slightly sharper than Agno. No `rounded-xl` (16px) in the default system.

---

## Shadows

Shadows are **subtle** in dark mode. Depth is primarily communicated through background layering (`surface-0` → `surface-1` → `surface-2`), not shadows.

| Token | Dark value | Light value | Usage |
|-------|-----------|-------------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (buttons) |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns, menus |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | `0 8px 24px rgba(0,0,0,0.12)` | Modals, command palette |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.6)` | `0 16px 48px rgba(0,0,0,0.16)` | Full-screen overlays |
| `--shadow-accent` | `0 0 12px var(--accent-glow)` | `0 0 8px var(--accent-glow)` | Focus rings, accent buttons |

---

## Motion

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `100ms` | Hover color changes, opacity shifts |
| `--duration-normal` | `200ms` | Default transitions, menu open/close |
| `--duration-slow` | `300ms` | Panel slide, sidebar expand |
| `--duration-enter` | `250ms` | Elements appearing (toasts, modals) |
| `--duration-exit` | `200ms` | Elements disappearing (faster out than in) |

### Easings

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General purpose |
| `--ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering (decelerate in) |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving (accelerate out) |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful micro-interactions (badge count, upload complete) |

### Animation Patterns

| Pattern | Implementation | Where |
|---------|---------------|-------|
| **Corner bracket hover** | Four `2px` border segments at corners, fade in on hover (`opacity 0→1`, `--duration-normal`) | Cards, grid items |
| **Skeleton shimmer** | Linear gradient sweep, `1.5s` infinite, `--ease-default` | All loading states |
| **Staggered grid entry** | Items fade + translate-y (8px→0), staggered by `30ms` per item | Asset grid, search results |
| **Slide panel** | `translateX(100%)→0` for right panels, `--duration-slow`, `--ease-enter` | Comment panel, upload drawer |
| **Sidebar expand** | Width `64px→240px`, `--duration-slow`, `--ease-default`. Labels fade in after width completes. | Icon rail → full sidebar |
| **Toast stack** | `translateY(-8px)→0` + `opacity 0→1`, `--duration-enter`. Stack shifts with `translateY`. | Top-center toasts |
| **Fade out on remove** | `opacity 1→0` + `scale(1→0.98)`, `--duration-exit` | Deleted items, dismissed toasts |
| **Upload progress** | Determinate bar fill, no animation on the bar itself (instant visual feedback) | Upload drawer |
| **Focus ring pulse** | `box-shadow` with `--shadow-accent`, one subtle pulse on focus (`scale 1→1.02→1`) | Focused interactive elements |

### `prefers-reduced-motion`

All animations respect `prefers-reduced-motion: reduce`. When active: durations drop to `0ms`, transforms are disabled, opacity transitions remain (they're non-distracting).

---

## Layout

### App Shell

```
┌──────────────────────────────────────────────┐
│ [icon rail]  [        content area         ] │
│ [  64px   ]  [                             ] │
│ [         ]  [                             ] │
│ [         ]  [                             ] │
│ [         ]  [                             ] │
└──────────────────────────────────────────────┘
```

- **Icon rail**: 64px wide, `surface-0` background. Expands to 240px on hover with animation. Contains nav icons + user avatar at bottom.
- **Content area**: Fills remaining width. Contains page header + scrollable content.
- **No fixed top header bar**. Page-level headers are part of the content scroll, not a separate chrome bar. This maximizes vertical space.

### File Viewer Layout

```
┌──────────────────────────────────────────────┐
│ [header bar — file name, actions, close]     │
├────────────────────────────┬─────────────────┤
│                            │  [comment       │
│   [media viewer]           │   panel]        │
│   surface-0, always dark   │   resizable     │
│                            │   collapsible   │
│                            │                 │
├────────────────────────────┤                 │
│ [player controls]          │                 │
└────────────────────────────┴─────────────────┘
```

- **Viewer area**: Always dark (`data-viewer` context). Media centered, letterboxed.
- **Comment panel**: Default 360px, resizable (min 280px, max 600px), collapsible to 0. Draggable resize handle.
- **Player controls**: Custom, dark, overlaid on viewer bottom. Auto-hide after 3s of no mouse movement. Reappear on mouse move.

### Asset Grid Density

Fluid density slider with three named detents:

| Detent | Thumbnail size | Card width | Metadata shown | Gap |
|--------|---------------|------------|----------------|-----|
| **Compact** | 120 × 80px | 140px | Filename only | 8px |
| **Default** | 200 × 130px | 220px | Filename, type icon, duration/size | 12px |
| **Expanded** | 300 × 190px | 320px | Filename, type, duration, status badge, uploader | 16px |

Slider allows fluid values between detents. Thumbnail sizes interpolate linearly. Metadata visibility has discrete breakpoints (items appear/disappear at specific widths, not partially).

Grid uses CSS Grid with `auto-fill` and `minmax()` — the number of columns is always automatic based on available width.

---

## Z-Index Scale

| Token | Value | Layer |
|-------|-------|-------|
| `--z-base` | `0` | Normal flow |
| `--z-dropdown` | `100` | Dropdowns, context menus |
| `--z-sticky` | `200` | Sticky headers, pinned elements |
| `--z-sidebar` | `300` | Sidebar hover-expand overlay |
| `--z-modal-backdrop` | `400` | Modal dim overlay |
| `--z-modal` | `500` | Modal dialog |
| `--z-upload-drawer` | `600` | Upload progress drawer |
| `--z-toast` | `700` | Toast notifications |
| `--z-tooltip` | `800` | Tooltips |
| `--z-command-palette` | `900` | Command palette (above everything) |

**Rule**: Command palette is always accessible, even over modals.

---

## Iconography

**Library**: [Lucide React](https://lucide.dev/) — consistent 24px grid, 2px stroke weight, MIT licensed.

### Conventions

- **Size**: 16px in dense contexts (tables, compact nav), 20px default, 24px in headers/empty states
- **Stroke**: Always `currentColor` — inherits text color from parent
- **File type icons**: Monochromatic. Differentiate by symbol shape, not color:
  - Video: `Film` or `Video`
  - Audio: `Music` or `AudioLines`
  - Image: `Image`
  - Document: `FileText`
  - Folder: `Folder` / `FolderOpen`
- **Action icons**: `Plus`, `Trash2`, `Pencil`, `Download`, `Share2`, `MoreHorizontal`, `Search`, `X`
- **Status icons**: `Check` (success), `AlertTriangle` (warning), `AlertCircle` (error), `Info` (info), `Loader2` (spinner, animated rotate)

### Drag Handle

Six-dot grip icon (`GripVertical`). Hidden by default, fades in on row/card hover. Color: `--text-muted`.

---

## Components

### Button

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

### Input

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

### Select

Native `<select>` with custom styling. Matches input dimensions and styling. Custom chevron icon (`ChevronDown`, `--text-muted`).

### Modal

- **Backdrop**: `--surface-0` at `60%` opacity, `backdrop-filter: blur(4px)`
- **Dialog**: `--surface-2` background, `--radius-lg`, `--shadow-lg`
- **Sizes**: `sm` (400px), `md` (520px), `lg` (680px), `xl` (860px), `full` (90vw × 90vh)
- **Animation**: Backdrop fades in. Dialog `scale(0.98)→1` + `opacity 0→1`, `--duration-enter`.
- **Close**: `X` button top-right + `Escape` key. Focus trapped inside.

### Toast (Sonner-style)

- **Position**: Top-center, stacked vertically
- **Background**: `--surface-2`, `--border-default` border
- **Types**: `success` (green left accent), `error` (red), `warning` (amber), `info` (blue), `neutral` (no accent)
- **Actions**: Optional action buttons ("Undo", "View file") — right-aligned, ghost style
- **Auto-dismiss**: 5s default, pauses on hover. Errors persist until dismissed.
- **Animation**: Slide down + fade in. Stack shifts smoothly when new toasts arrive.
- **Max visible**: 3. Older toasts compress into a count badge.

### Dropdown / Context Menu

- **Background**: `--surface-2`
- **Border**: `--border-default`, `--radius-md`
- **Shadow**: `--shadow-md`
- **Items**: `body-sm` (13px), `--space-2` vertical padding, `--space-3` horizontal
- **Hover**: `--surface-3` background
- **Separator**: 1px `--border-default`, `--space-1` margin
- **Keyboard**: Arrow keys navigate, Enter selects, Escape closes
- **Icons**: Optional leading icon per item, 16px, `--text-muted`
- **Destructive items**: `--status-error` text color

### Tooltip

- **Background**: `--surface-3` (dark), `--surface-0` (light, for contrast)
- **Text**: `caption` size (12px), `--text-primary`
- **Radius**: `--radius-xs`
- **Arrow**: 6px CSS triangle
- **Delay**: 500ms show, 0ms hide
- **Position**: Auto (prefers top, flips if clipped)
- **Keyboard shortcut hint**: Right-aligned, `--text-muted`, `code` font

### Badge

| Variant | Background | Text |
|---------|-----------|------|
| `default` | `--surface-3` | `--text-secondary` |
| `accent` | `--accent-muted` | `--accent` |
| `success` | `rgba(34,197,94,0.15)` | `--status-success` |
| `warning` | `rgba(245,158,11,0.15)` | `--status-warning` |
| `error` | `rgba(239,68,68,0.15)` | `--status-error` |

Size: `caption` (12px), `--radius-full`, horizontal padding `--space-2`, height 22px.

### Avatar

- **Shape**: Rounded square (`--radius-md`)
- **Sizes**: `sm` (28px), `md` (36px), `lg` (44px), `xl` (56px)
- **Fallback**: Geometric pattern + initials (Figma-style), color derived from user ID hash
- **Presence dot**: 8px circle, bottom-right, border `2px --surface-1` (to cut out from background)
  - Online: `--status-success`
  - Away: `--status-warning`
  - Offline: `--text-muted`

### Spinner

Lucide `Loader2` icon with CSS `rotate` animation, `1s linear infinite`.
Sizes match icon sizes: 16px, 20px, 24px. Color: `currentColor`.

### Table

- **Header**: `label` style (11px, uppercase, `--text-muted`), no background
- **Rows**: No zebra striping. Separator: 1px `--border-default` between rows.
- **Hover**: `--surface-2` background
- **Selection**: Checkbox column appears on hover (first column). Selected rows get `--accent-muted` background.
- **Actions**: Via context menu (right-click or kebab icon on hover)
- **Sort**: Click column header. Arrow indicator (`ChevronUp`/`ChevronDown`), `--text-muted`
- **Density**: Dense mode by default (tables are inherently data-heavy)

### Command Palette

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

### Keyboard Legend

- **Trigger**: `?` key (when no input is focused)
- **Display**: Modal-style overlay listing contextual shortcuts
- **Grouping**: By context (Global, Navigation, Viewer, Asset Grid, Comments)
- **Format**: Description left, key combo right in `<kbd>` styled badges
- **`<kbd>` style**: `--surface-3` background, `--border-default` border, `--radius-xs`, `code` font, `caption` size

---

## Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Command palette |
| `?` | Keyboard legend |
| `Cmd/Ctrl + /` | Toggle sidebar |
| `Cmd/Ctrl + Shift + U` | Toggle upload drawer |

### Navigation

| Key | Action |
|-----|--------|
| `G then D` | Go to Dashboard |
| `G then P` | Go to Projects |
| `G then S` | Go to Shares |
| `G then N` | Go to Notifications |

### Asset Grid

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

### Viewer

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

### Comments

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + Enter` | Submit comment |
| `Escape` | Cancel reply / discard draft |

---

## Patterns

### Empty States

Minimal. Three elements only:

1. **Icon**: Relevant Lucide icon, 48px, `--text-muted`
2. **Text**: One sentence, `body` size, `--text-secondary`. Conversational. ("No files here yet.")
3. **Action**: Single `primary` or `secondary` button. ("Upload files")

No illustrations. No multi-paragraph explanations.

### Loading States (Skeletons)

- Skeletons mirror the exact layout of the content they replace
- Background: `--surface-3`
- Shimmer: Linear gradient sweep (`--surface-3` → `--surface-4` → `--surface-3`), 1.5s, infinite
- **Asset grid**: Skeleton cards at current density setting
- **Comment panel**: Skeleton comment bubbles (avatar circle + text lines)
- **Tables**: Skeleton rows with column-width-matched bars
- **Viewer**: Full dark area with centered `Spinner`

### Error States

Conversational, not clinical.

| Context | Message style | Example |
|---------|--------------|---------|
| Inline field error | Red text below input, `caption` size | "That email's already taken" |
| Toast error | `error` toast, persists until dismissed | "Upload failed. Retry?" (with Retry action) |
| Full-page error | Empty state pattern with error icon | "Something broke. Try refreshing." |

### Destructive Actions

**No confirmation modals.** Use optimistic action + undo toast.

Flow:
1. User clicks delete
2. Item immediately removed from UI (fade-out animation)
3. Toast appears: "Deleted [item name]. Undo?" — 8s timeout
4. Undo restores the item with fade-in animation
5. After timeout, deletion is committed server-side

Exception: Irreversible actions with high blast radius (delete workspace, remove team member) get a **confirmation input** — type the name to confirm. Not a modal with "Are you sure?" buttons.

### Drag and Drop

- **Drag handle**: `GripVertical` icon, hidden by default, fades in on hover (`--text-muted`)
- **Drag preview**: Semi-transparent clone of the item, slight rotation (2deg), `--shadow-lg`
- **Drop target**: `--accent-muted` background + dashed `--accent` border on valid targets
- **Invalid target**: No visual change (don't show red — just don't show green)

### Scrollbars

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--surface-4);
  border-radius: var(--radius-full);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```

Appear on scroll, auto-hide after 1.5s of no scroll activity (where supported).

---

## Upload Drawer

- **Position**: Bottom of viewport, full width, above toasts (`--z-upload-drawer`)
- **Height**: Auto based on content, max 40vh, scrollable internally
- **Background**: `--surface-2`, `--border-default` top border
- **Behavior**: Auto-appears when uploads start. Auto-dismisses 3s after all uploads complete. Drag handle to resize. Can be manually collapsed to a thin bar showing count + overall progress.
- **Per-file row**: Filename (truncated) + file type icon + progress bar + percentage + status icon (spinner → check → error)
- **Progress bar**: 2px height, `--accent` fill, `--surface-3` track
- **Actions**: Pause/resume per file, cancel per file, "Cancel all" in header

---

## Share Pages

Share pages (`/s/[slug]`) are Bush's public face. They follow a **different** visual treatment than the app.

### Differences from App

| Property | App | Share Page |
|----------|-----|-----------|
| Default theme | Dark | Light |
| Typography | Functional (14px body) | Editorial (`display` headings, 16px body) |
| Spacing | Airy/dense contextual | Generous throughout |
| Branding | Bush nav | Bush logo + sharer's logo |
| Viewer | Dark always | Dark always (consistent) |
| Target | Desktop | Responsive (desktop + tablet + phone) |

### Layout

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

### Responsive Breakpoints (share pages only)

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Desktop | ≥1024px | Full layout, side-by-side where applicable |
| Tablet | 768–1023px | Single column, reduced spacing |
| Mobile | <768px | Stacked layout, full-width assets, collapsible comments |

### Password Protection

If share requires a password, show a centered card with:
- Bush logo
- Sharer's logo
- "This share is password protected"
- Password input + Submit button
- Minimal, elegant. No extra chrome.

---

## Presence & Collaboration

### User Cursors (Viewer/Canvas)

- **Cursor**: Small arrow + name label below
- **Label**: `caption` size, `--radius-xs`, padding `2px 6px`
- **Color**: Assigned per-user from a fixed palette of 8 distinguishable colors (not the accent color — these need to be distinct from each other):
  - `#f97316` (orange), `#8b5cf6` (purple), `#06b6d4` (cyan), `#ec4899` (pink),
  - `#22c55e` (green), `#eab308` (yellow), `#6366f1` (indigo), `#14b8a6` (teal)
- **Fade**: Cursor fades to `0.3` opacity after 5s of no movement. Returns to `1` on move.

### Avatar Stack (Project Header)

Up to 4 avatars stacked with `-8px` overlap. `+N` badge for overflow. Each avatar shows presence color ring (2px).

---

## Accessibility

Not a separate concern — built into every component above.

### Non-negotiables

- **Focus visible**: `--shadow-accent` ring on all interactive elements via `:focus-visible` (not `:focus` — no rings on click)
- **Color contrast**: WCAG AA minimum (4.5:1 for text, 3:1 for large text/UI). The dark palette + `--text-primary` on `--surface-1` = ~16:1 ratio.
- **`prefers-reduced-motion`**: All animations disabled (see Motion section)
- **Keyboard navigation**: Every action reachable without a mouse. Tab order follows visual order.
- **ARIA**: Labels on icon-only buttons, `role="dialog"` on modals, `aria-live="polite"` on toasts
- **Semantic HTML**: `<nav>`, `<main>`, `<header>`, `<button>`, `<dialog>`. No `<div>` buttons.

---

## Implementation Checklist

Suggested migration order — each step is independently shippable:

| # | Step | Scope |
|---|------|-------|
| 1 | Install Tailwind v4, create `tokens.css` + `theme.css` | Infrastructure |
| 2 | Implement theme toggle (`data-theme`, localStorage, default dark) | Infrastructure |
| 3 | Load Inter + JetBrains Mono fonts | Infrastructure |
| 4 | Migrate UI primitives: Button, Input, Select, Badge, Spinner | Components |
| 5 | Migrate Modal, Toast (switch to Sonner pattern), Tooltip | Components |
| 6 | Build Command Palette + Keyboard Legend | New components |
| 7 | Rebuild sidebar as icon rail with hover-expand | Layout |
| 8 | Migrate asset grid with density slider | Feature |
| 9 | Rebuild file viewer with custom controls + collapsible/resizable comment panel | Feature |
| 10 | Implement skeleton loading states | Pattern |
| 11 | Implement upload drawer | Feature |
| 12 | Add corner bracket hover + staggered grid animations | Polish |
| 13 | Build custom scrollbars + drag-and-drop affordances | Polish |
| 14 | Redesign share pages (light, editorial, responsive) | Feature |
| 15 | Add presence cursors + avatar stack | Collaboration |
| 16 | Clean up: delete all `.module.css` files, remove old `globals.css` utility classes | Cleanup |
