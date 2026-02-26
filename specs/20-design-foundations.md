# Design System: Foundations

**Status**: Spec complete, implementation pending
**Reference**: [agno.com docs](https://docs.agno.com/) — dark-first, generous whitespace, depth via background layering
**Audience**: Future you. This is a reference doc, not a tutorial.

---

## Overview

This spec defines the visual and structural foundations of the Bush design system: the principles that guide every decision, the migration path from CSS Modules to Tailwind v4, and the complete token vocabulary — colors, typography, spacing, radius, shadows, motion, layout, z-index, iconography, and scrollbars. These foundations are consumed by components (documented in `21-design-components.md`). The token layer is the source of truth; Tailwind classes are just a convenient interface to it.

---

## Specification

### Design Principles

Every decision in this system traces back to five principles:

| Principle | Meaning | Example |
|-----------|---------|---------|
| **Quiet until needed** | UI elements hide until relevant | Drag handles appear on hover. Upload drawer auto-shows/hides. Sidebar is a thin rail until hovered. |
| **No clutter, just the stuff** | Remove anything that doesn't serve the current task | No zebra-striped tables. No confirmation modals — use undo. Monochromatic file types — icons, not colors. |
| **Airy by default, dense when working** | Generous spacing that tightens in high-density contexts | Content areas use relaxed padding. Asset grids compress via density slider. |
| **Dark-first, light-available** | Dark theme is the default experience | Dark is designed first, light is derived. User toggle, dark on first visit. |
| **Motion is meaning** | Animation communicates state changes, not decoration | Skeleton shimmer = loading. Slide-in = new content. Fade-out = removed. Corner brackets = interactive. |

---

### Migration Strategy

#### From: CSS Modules + `globals.css` utility classes (BEM)
#### To: Tailwind CSS v4 + CSS custom properties

**Why Tailwind v4**: Native CSS-based configuration via `@theme`. CSS custom properties are the source of truth — Tailwind consumes them. Tokens remain accessible outside Tailwind (canvas rendering, SVG, custom video player).

#### Approach

1. Install Tailwind v4 + `@tailwindcss/vite` (or postcss plugin for Next.js)
2. Define all tokens as CSS custom properties in a `tokens.css` file
3. Map tokens to Tailwind via `@theme` in the main CSS entry
4. Migrate components one-by-one — coexistence with CSS Modules during transition
5. Delete each `.module.css` file after its component is migrated
6. Remove `globals.css` utility classes (`.btn`, `.input`, etc.) as components move to Tailwind
7. Keep `tokens.css` as the permanent source of truth

#### File Structure (post-migration)

```
src/web/
  styles/
    tokens.css          ← CSS custom properties (source of truth)
    theme.css           ← @theme mapping + Tailwind directives
    scrollbar.css       ← Custom scrollbar overrides
    globals.css         ← Minimal resets, font-face declarations
```

#### Token → Tailwind Mapping Example

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

#### Implementation Checklist

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

---

### Color System

#### Architecture

Three layers:

```
Primitives (raw values)
  → Semantic tokens (purpose-based names)
    → Tailwind classes (utility usage)
```

Primitives are never used directly in components. Semantic tokens are what you reference.

#### Dark Theme (default)

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

#### Light Theme

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

#### Theme Implementation

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

#### Viewer Context

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

### Typography

#### Fonts

| Role | Family | Load |
|------|--------|------|
| Body | `'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif` | Google Fonts / self-hosted, `font-display: swap`, variable weight |
| Code | `'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace` | Google Fonts / self-hosted, `font-display: swap` |

#### Type Scale

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

#### Rules

- **14px body** — not 16px. Bush is a tool, not a reading app. 14px is information-dense without being cramped.
- **`-0.02em` tracking on large text** — Inter opens up at large sizes. Tighten it.
- **`label` is always uppercase** — used for section dividers, overlines, metadata category headers.
- **No font size below 11px** — accessibility floor.

---

### Spacing

#### Base Unit: 4px

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

#### Density Modes

Two density contexts, not a global toggle:

| Context | Content padding | Component gaps | Applied where |
|---------|-----------------|----------------|---------------|
| **Default (airy)** | `--space-6` (24px) | `--space-4` (16px) | Most of the app — dashboards, settings, share management |
| **Dense** | `--space-3` (12px) | `--space-2` (8px) | Asset grids, metadata tables, folder trees, comment threads |

Dense mode is automatic based on context, not user-toggled (except via the asset grid density slider).

---

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Small inline elements, chips |
| `--radius-sm` | 6px | Buttons, inputs, select |
| `--radius-md` | 8px | Cards, dropdowns, menus |
| `--radius-lg` | 12px | Modals, panels, dialogs |
| `--radius-full` | 9999px | Pills, tags, badges, avatars |

Slightly sharper than Agno. No `rounded-xl` (16px) in the default system.

---

### Shadows

Shadows are **subtle** in dark mode. Depth is primarily communicated through background layering (`surface-0` → `surface-1` → `surface-2`), not shadows.

| Token | Dark value | Light value | Usage |
|-------|-----------|-------------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (buttons) |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns, menus |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | `0 8px 24px rgba(0,0,0,0.12)` | Modals, command palette |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.6)` | `0 16px 48px rgba(0,0,0,0.16)` | Full-screen overlays |
| `--shadow-accent` | `0 0 12px var(--accent-glow)` | `0 0 8px var(--accent-glow)` | Focus rings, accent buttons |

---

### Motion

#### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `100ms` | Hover color changes, opacity shifts |
| `--duration-normal` | `200ms` | Default transitions, menu open/close |
| `--duration-slow` | `300ms` | Panel slide, sidebar expand |
| `--duration-enter` | `250ms` | Elements appearing (toasts, modals) |
| `--duration-exit` | `200ms` | Elements disappearing (faster out than in) |

#### Easings

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General purpose |
| `--ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering (decelerate in) |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving (accelerate out) |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful micro-interactions (badge count, upload complete) |

#### Animation Patterns

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

#### `prefers-reduced-motion`

All animations respect `prefers-reduced-motion: reduce`. When active: durations drop to `0ms`, transforms are disabled, opacity transitions remain (they're non-distracting).

---

### Layout

#### App Shell

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

#### File Viewer Layout

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

#### Asset Grid Density

Fluid density slider with three named detents:

| Detent | Thumbnail size | Card width | Metadata shown | Gap |
|--------|---------------|------------|----------------|-----|
| **Compact** | 120 × 80px | 140px | Filename only | 8px |
| **Default** | 200 × 130px | 220px | Filename, type icon, duration/size | 12px |
| **Expanded** | 300 × 190px | 320px | Filename, type, duration, status badge, uploader | 16px |

Slider allows fluid values between detents. Thumbnail sizes interpolate linearly. Metadata visibility has discrete breakpoints (items appear/disappear at specific widths, not partially).

Grid uses CSS Grid with `auto-fill` and `minmax()` — the number of columns is always automatic based on available width.

---

### Z-Index Scale

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

### Iconography

**Library**: [Lucide React](https://lucide.dev/) — consistent 24px grid, 2px stroke weight, MIT licensed.

#### Conventions

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

#### Drag Handle

Six-dot grip icon (`GripVertical`). Hidden by default, fades in on row/card hover. Color: `--text-muted`.

---

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

## Cross-References

- `21-design-components.md` — All components and patterns built on these foundations (buttons, inputs, modals, toasts, keyboard shortcuts, patterns, share pages, presence)
- `30-configuration.md` / `30-configuration.md` — Font loading configuration, Tailwind v4 plugin setup, build tooling
