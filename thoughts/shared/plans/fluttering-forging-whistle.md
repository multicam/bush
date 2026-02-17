# Plan: Add Markdown Viewer Support

## Context

Bush already has viewers for images, video, audio, and PDF. JM wants Markdown document support added to this release alongside PDF. Markdown files (`.md`) are not currently registered in the file type registry and have no viewer component.

Markdown is simple — no server-side processing needed. The browser can render it directly from the file content (fetched via download URL).

## Spec Updates

### `specs/00-atomic-features.md` — Section 4.3 "Supported File Types"

Add under **Documents**:
```
- Markdown (.md, .markdown)
```

Add new section **9.8 Markdown Viewer**:
```
### 9.8 Markdown Viewer
- Rendered Markdown with GFM support (tables, task lists, strikethrough)
- Syntax-highlighted code blocks
- Dark theme matching other viewers
```

### `specs/15-media-processing.md` — Section 8 "Format-Specific Processing"

Add after Documents section:
```
### Markdown (.md, .markdown)
- Pipeline: none (rendered client-side)
- No server processing required — fetched as text, rendered in browser
- Thumbnail: use static document icon
```

### `specs/03-file-management.md` — Section "Supported File Types"

Add "Markdown files" to the list.

## Implementation

### 1. Register `.md` in file type registry

**File**: `src/shared/file-types.ts`

Add entry:
```typescript
{ mime: "text/markdown", category: "document", viewer: "markdown", processing: "none", extensions: [".md", ".markdown", ".mdx"], icon: "file-text" }
```

Add `"markdown"` to the `ViewerType` union.

### 2. Create Markdown Viewer component

**New file**: `src/web/components/viewers/markdown-viewer.tsx`

Props:
```typescript
export interface MarkdownViewerProps {
  src: string;        // URL to fetch markdown content
  name?: string;
  className?: string;
}
```

Behaviour:
- Fetch content from `src` URL as text
- Render with `react-markdown` + `remark-gfm` (tables, task lists, strikethrough)
- Syntax highlighting for code blocks via `react-syntax-highlighter`
- Dark theme matching other viewers (#1a1a1a background)
- Loading/error states matching existing pattern

### 3. Create CSS module

**New file**: `src/web/components/viewers/markdown-viewer.module.css`

Prose styles for headings, code, tables, blockquotes, lists, links, images, hr. Dark theme.

### 4. Export from viewers index

**File**: `src/web/components/viewers/index.ts`

### 5. Add viewer routing

**File**: `src/web/components/version-stacks/version-stack-compare.tsx` — add markdown case in `renderViewer`

### 6. Update IMPLEMENTATION_PLAN.md

## Dependencies

- `react-markdown`
- `remark-gfm`

No server-side processing needed.

## Files Modified

| File | Change |
|------|--------|
| `specs/00-atomic-features.md` | Add markdown to supported types + viewer section |
| `specs/15-media-processing.md` | Add markdown processing note |
| `specs/03-file-management.md` | Add markdown to file types list |
| `src/shared/file-types.ts` | Add markdown entry + ViewerType |
| `src/web/components/viewers/markdown-viewer.tsx` | New component |
| `src/web/components/viewers/markdown-viewer.module.css` | New styles |
| `src/web/components/viewers/index.ts` | Export MarkdownViewer |
| `src/web/components/version-stacks/version-stack-compare.tsx` | Add markdown routing |
| `IMPLEMENTATION_PLAN.md` | Update status |
| `package.json` | Add react-markdown, remark-gfm |

## Verification

1. `bun install` — deps install cleanly
2. `bun test` — all existing tests pass
3. Build succeeds without TS errors
