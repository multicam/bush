# Frontend Testing: UI/UX Workflow

**Status**: Spec complete, implementation pending
**Audience**: All contributors. Read this before writing frontend tests.

---

## Overview

This spec defines the complete frontend testing strategy for Bush. It covers E2E testing with Playwright, component testing with Vitest + Testing Library, accessibility auditing, and visual regression testing. The goal: every user-facing workflow has automated coverage, and no UI regression ships undetected.

The backend testing conventions in `14-conventions.md` remain unchanged. This spec extends the testing strategy to the web frontend (`src/web/`), which was previously excluded from all coverage metrics.

---

## Specification

### Testing Stack

| Tool | Purpose | Phase |
|------|---------|-------|
| Playwright | E2E browser tests — full user workflows | MVP |
| Vitest + @testing-library/react | Component unit/integration tests | MVP |
| @axe-core/playwright | Accessibility auditing in E2E tests | MVP |
| Playwright visual comparisons | Screenshot-based visual regression | Phase 2 |

### Installation

```bash
bun add -d @playwright/test @testing-library/react @testing-library/jest-dom @testing-library/user-event @axe-core/playwright
bunx playwright install chromium
```

---

### Test Organization

```
src/web/
  __tests__/                      ← E2E tests (Playwright)
    auth.spec.ts                  ← Login, signup, logout, session
    dashboard.spec.ts             ← Dashboard page, workspace switching
    projects.spec.ts              ← Project CRUD, file browser
    file-viewer.spec.ts           ← Video/image/audio player, annotations
    comments.spec.ts              ← Comments, @mentions, threads
    shares.spec.ts                ← Share creation, public share pages
    collections.spec.ts           ← Collection CRUD, asset management
    notifications.spec.ts         ← Notification list, mark read
    search.spec.ts                ← Global search, filters
    upload.spec.ts                ← File upload, drag & drop, progress
    settings.spec.ts              ← Account settings, workspace settings
    keyboard.spec.ts              ← Keyboard shortcuts, accessibility nav
    realtime.spec.ts              ← WebSocket events, live updates
    accessibility.spec.ts         ← Global a11y audit across all pages
  components/
    <component>/<component>.test.tsx  ← Component tests (co-located)
  hooks/
    <hook>.test.ts                    ← Hook tests (co-located)
  lib/
    <util>.test.ts                    ← Utility tests (co-located)
playwright.config.ts              ← Playwright configuration
```

Component tests are co-located with their source. E2E tests live in `__tests__/` at the web root.

### Playwright Configuration

```typescript
// src/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./__tests__",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
```

### NPM Scripts

```json
{
  "test:e2e": "playwright test --config src/web/playwright.config.ts",
  "test:e2e:ui": "playwright test --config src/web/playwright.config.ts --ui",
  "test:e2e:headed": "playwright test --config src/web/playwright.config.ts --headed",
  "test:components": "vitest run --config vitest.config.ts src/web/"
}
```

---

### Critical User Journeys (E2E)

These are the workflows that must have E2E coverage. Each maps to a test file.

#### 1. Authentication (`auth.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Sign up flow | New user → signup page → WorkOS → callback → dashboard | P0 |
| Login flow | Existing user → login → WorkOS → callback → dashboard | P0 |
| Logout | Authenticated → logout → redirected to home | P0 |
| Session persistence | Refresh page → still authenticated | P0 |
| Session expiry | Expired cookie → redirected to login | P1 |
| Protected routes | Unauthenticated → /dashboard → redirected to login | P0 |

**Auth test helper**: Create a reusable `authenticate()` fixture that stores auth state to avoid repeating login for every test.

```typescript
// src/web/__tests__/fixtures/auth.ts
import { test as base } from "@playwright/test";

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Load stored auth state or perform login
    await page.goto("/login");
    // ... login flow
    await use(page);
  },
});
```

#### 2. Dashboard (`dashboard.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Dashboard loads | Shows projects, recent files, activity | P0 |
| Workspace switcher | Switch between workspaces | P1 |
| Empty state | New account shows onboarding prompts | P1 |
| Navigation | Sidebar links navigate correctly | P0 |

#### 3. Projects (`projects.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Create project | New project → appears in list | P0 |
| Open project | Click project → file browser loads | P0 |
| Create folder | New folder inside project | P0 |
| Navigate folders | Breadcrumb and folder tree navigation | P0 |
| Rename project | Inline rename | P1 |
| Delete project | Delete with confirmation | P1 |
| Project settings | Update project metadata | P2 |

#### 4. File Viewer (`file-viewer.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Video playback | Open video → plays, pause, seek, volume | P0 |
| Image viewer | Open image → zoom, pan | P0 |
| Audio player | Open audio → plays with waveform | P1 |
| PDF viewer | Open PDF → paginate | P1 |
| Filmstrip | Video filmstrip thumbnails render | P1 |
| Keyboard controls | Space=play/pause, J/K/L=seek, F=fullscreen | P0 |
| Annotation overlay | Draw annotation → persists on timeline | P1 |

#### 5. Comments (`comments.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Add comment | Type and submit a comment | P0 |
| Timecoded comment | Comment at specific video timestamp | P0 |
| Reply to comment | Thread a reply | P0 |
| @mention | Mention a user → autocomplete | P1 |
| Resolve comment | Mark comment as resolved | P1 |
| Edit comment | Edit own comment | P1 |
| Delete comment | Delete own comment | P1 |

#### 6. Shares (`shares.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Create share link | Generate share from project/file | P0 |
| Public share page | Open share link → loads without auth | P0 |
| Share with password | Password-protected share page | P1 |
| Share with expiry | Expired share shows message | P1 |
| Share download | Download from share page (if enabled) | P1 |
| Share commenting | Comment on shared file as reviewer | P0 |

#### 7. Upload (`upload.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| File picker upload | Click upload → select file → completes | P0 |
| Drag & drop upload | Drag file onto dropzone → completes | P0 |
| Multi-file upload | Upload multiple files, progress bars | P0 |
| Upload cancellation | Cancel mid-upload | P1 |
| Upload to folder | Upload targets correct folder | P1 |
| Large file handling | Chunked upload for large files | P2 |

#### 8. Collections (`collections.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Create collection | New collection in project | P1 |
| Add assets | Add files to collection | P1 |
| Remove assets | Remove files from collection | P1 |
| Reorder assets | Drag to reorder | P2 |

#### 9. Search (`search.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Global search | Search from header → results | P0 |
| Filter by type | Filter results by file type | P1 |
| Search navigation | Click result → navigates to file | P0 |

#### 10. Notifications (`notifications.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Notification badge | Unread count in header | P1 |
| Notification list | View notification list | P1 |
| Mark as read | Click notification → mark read | P1 |
| Real-time notification | Receive notification via WebSocket | P2 |

#### 11. Keyboard & Accessibility (`keyboard.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| Tab navigation | Tab through all interactive elements | P1 |
| Focus indicators | Visible focus rings on all controls | P1 |
| Keyboard shortcuts | All documented shortcuts work | P1 |
| Screen reader labels | All interactive elements have labels | P1 |
| Escape closes modals | Escape key dismisses overlays | P1 |

#### 12. Real-time Updates (`realtime.spec.ts`)

| Test | Description | Priority |
|------|-------------|----------|
| WS connection | WebSocket connects on page load | P1 |
| Live comment | Comment from user A appears for user B | P2 |
| File update event | Upload complete → file list refreshes | P2 |
| Reconnection | WS disconnects → reconnects with backoff | P2 |

---

### Component Tests (Vitest + Testing Library)

Component tests verify individual components in isolation. Co-locate with the component source file.

#### Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | > 60% |
| Branches | > 50% |
| Functions | > 60% |

These targets apply to `src/web/components/`, `src/web/hooks/`, and `src/web/lib/` — page components (`src/web/app/`) are covered by E2E tests instead.

#### What to Test

| Category | Test | Example |
|----------|------|---------|
| Rendering | Component renders without crashing | `<Button>Click</Button>` renders |
| Props | Component responds to prop changes | `variant="danger"` applies correct styles |
| Events | User interactions trigger callbacks | `onClick` fires on click |
| State | Internal state updates correctly | Toggle open/closed |
| Error states | Component handles edge cases | Empty data, loading, error |
| Accessibility | Component has correct ARIA | Button has role, label, state |

#### Components Requiring Tests (Priority Order)

**P0 — Core UI Components** (`src/web/components/ui/`)
- Button, Input, Select, Modal, Toast, Dropdown
- These are used everywhere — a regression here cascades

**P0 — Layout** (`src/web/components/layout/`)
- Sidebar, Header, AppShell
- Navigation and layout structure

**P1 — Feature Components**
- `asset-browser/` — Grid, List, AssetCard, MetadataBadges
- `upload/` — Dropzone, UploadProgress, UploadDrawer
- `comments/` — CommentThread, CommentForm, CommentItem
- `viewers/` — VideoPlayer, ImageViewer, AudioPlayer, PDFViewer
- `shares/` — ShareDialog, ShareSettings, SharePage
- `annotations/` — AnnotationCanvas, AnnotationToolbar

**P2 — Secondary Components**
- `notifications/` — NotificationList, NotificationItem
- `search/` — SearchBar, SearchResults
- `version-stacks/` — VersionStack, VersionCompare
- `folder-navigation/` — FolderTree, Breadcrumb
- `collections/` — CollectionGrid, CollectionDialog
- `metadata/` — MetadataPanel, CustomFields
- `transcript/` — TranscriptViewer, TranscriptSearch

#### Test Pattern

```typescript
// src/web/components/ui/button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders with label", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

---

### Accessibility Testing

Every page must pass automated accessibility checks. Use `@axe-core/playwright` in E2E tests.

#### Global A11y Audit (`accessibility.spec.ts`)

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  "/", "/login", "/signup", "/dashboard", "/projects",
  "/notifications", "/settings", "/shares",
];

for (const path of pages) {
  test(`${path} has no a11y violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
```

#### Accessibility Requirements

| Requirement | Standard | Test Method |
|-------------|----------|-------------|
| Color contrast | WCAG 2.1 AA (4.5:1 text, 3:1 large text) | axe-core |
| Keyboard navigation | All interactive elements focusable | E2E tab tests |
| Focus indicators | Visible focus ring on all controls | Visual + E2E |
| ARIA labels | All buttons, inputs, images labeled | axe-core |
| Heading hierarchy | Single h1, logical h2→h6 | axe-core |
| Form labels | All inputs have associated labels | axe-core |
| Alt text | All meaningful images have alt text | axe-core |
| Motion | Respect `prefers-reduced-motion` | Component test |

---

### Visual Regression Testing (Phase 2)

Playwright's built-in `toHaveScreenshot()` for catching unintended visual changes.

```typescript
test("dashboard matches snapshot", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveScreenshot("dashboard.png", {
    maxDiffPixelRatio: 0.01,
  });
});
```

#### Pages with Visual Snapshots

| Page | Variants |
|------|----------|
| Home (/) | Default, dark mode |
| Login | Default, error state |
| Dashboard | With projects, empty state |
| Project browser | Grid view, list view |
| File viewer | Video, image, audio |
| Share page | Public share, password prompt |

Screenshots are committed to the repo under `src/web/__tests__/snapshots/`. Update with `--update-snapshots` when intentional changes are made.

---

### Test Data & Fixtures

#### Seeded Test State

E2E tests require predictable data. Create a test seed script:

```
src/web/__tests__/
  fixtures/
    auth.ts           ← Authentication helpers (login, store state)
    seed.ts           ← Create test account, workspace, project, files
    cleanup.ts        ← Teardown after test suite
```

#### Test Account

| Field | Value |
|-------|-------|
| Email | `test@bush.io` |
| Name | Test User |
| Account | Test Account |
| Workspace | Test Workspace |
| Project | Test Project (with seeded files) |

Use environment variable `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` for auth in CI.

---

### Quality Gate

The merge gate in `14-conventions.md` is extended:

```bash
# Full quality gate
bun run test && bun run test:components && bun run test:e2e && bun run typecheck && bun run lint
```

| Check | Blocks Merge |
|-------|-------------|
| Backend tests (Vitest) | Yes |
| Component tests (Vitest) | Yes |
| E2E tests (Playwright) | Yes |
| Typecheck | Yes |
| Lint | Yes |
| A11y audit (in E2E) | Yes |
| Visual regression (Phase 2) | Warning only initially, blocking later |

---

### CI Integration

```yaml
# .github/workflows/test.yml (addition)
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx playwright install --with-deps chromium
      - run: bun run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: src/web/playwright-report/
```

---

### Implementation Phases

#### Phase 1 — Foundation (Current Sprint)

- [ ] Install Playwright and Testing Library
- [ ] Configure `playwright.config.ts`
- [ ] Add npm scripts
- [ ] Create auth fixture (reusable login)
- [ ] Write `auth.spec.ts` — login, signup, logout, protected routes
- [ ] Write `dashboard.spec.ts` — loads, navigation
- [ ] Add `accessibility.spec.ts` — global a11y audit
- [ ] Add component tests for `ui/` components (Button, Input, Modal, Toast)

#### Phase 2 — Core Workflows

- [ ] `projects.spec.ts` — CRUD, folder navigation
- [ ] `upload.spec.ts` — file picker, drag & drop, progress
- [ ] `file-viewer.spec.ts` — video/image playback, keyboard controls
- [ ] `comments.spec.ts` — add, reply, resolve, timecoded
- [ ] `shares.spec.ts` — create, public page, commenting
- [ ] Component tests for feature components (viewers, upload, comments)

#### Phase 3 — Full Coverage

- [ ] `collections.spec.ts`, `search.spec.ts`, `notifications.spec.ts`
- [ ] `keyboard.spec.ts` — full keyboard shortcut coverage
- [ ] `realtime.spec.ts` — WebSocket integration
- [ ] `settings.spec.ts` — account/workspace settings
- [ ] Visual regression snapshots for all pages
- [ ] Component tests for remaining components

---

## Cross-References

- `14-conventions.md` — Backend testing conventions, error handling, quality gate
- `20-design-foundations.md` — Design tokens, color contrast values for a11y testing
- `21-design-components.md` — Component specs defining expected behavior to test against
- `00-product-reference.md` — Feature catalogue defining what user workflows exist
