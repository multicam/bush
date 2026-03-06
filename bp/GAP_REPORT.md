# Bush BP Gap Report

Generated: 2026-02-27
Commit: 89b6eca

## Summary

- Tests: 56 | Passed: 51 | Failed: 5
- Screenshots: 49 captured
- Gaps: 4 total (1 critical, 2 major, 1 minor)

## Gaps

### GAP-001: Nested notification buttons — invalid HTML

- **Severity**: Major
- **Category**: UI / Accessibility
- **Tests**: UC-17 (bell visible in sidebar), UC-17 (clicking bell navigates)
- **Expected**: Single `<button>` element for the notification bell in the sidebar
- **Actual**: Two nested `<button>` elements — `app-layout.tsx:237` wraps `NotificationBell` (which renders its own `<button>`) inside another `<button>`. This is invalid HTML (`<button>` cannot contain `<button>`) and causes Playwright strict mode violations.
- **Root cause**: `NotificationBell` component (`notification-bell.tsx:23`) renders a `<button>`, but `app-layout.tsx:235-254` places it inside a wrapping `<button>` with `aria-label="Notifications"`. The inner `onClick={() => {}}` is a no-op — only the outer button's `handleNotificationClick` does anything.
- **Screenshot**: `bp/screenshots/bush/17-notification-bell.png`
- **Fix**: Either make `NotificationBell` render a `<div>` instead of a `<button>` (since the outer button handles all interaction), or remove the outer `<button>` wrapper and let `NotificationBell` handle the click directly.
- **Files**: `src/web/components/layout/app-layout.tsx:235-254`, `src/web/components/notifications/notification-bell.tsx:23-50`
- **Effort**: S

### GAP-002: File upload never completes in DEMO_MODE

- **Severity**: Major
- **Category**: Functional
- **Tests**: UC-07 (trigger file upload with video fixture), UC-08 (upload multiple file types)
- **Expected**: Uploaded files should transition from "uploading" to a completed state, or the upload should be simulated in DEMO_MODE
- **Actual**: Files appear in the asset browser with status "uploading" and size "0 B" indefinitely. The upload API accepts the request but the media worker (`src/media/worker.ts`) is not running, so no processing occurs and the file remains stuck.
- **Root cause**: DEMO_MODE bypasses auth but doesn't mock or stub the upload pipeline. The file metadata is created in the database but the actual file processing (BullMQ job → FFmpeg) never runs without `bun run dev:worker`.
- **Screenshot**: `bp/screenshots/bush/07-upload-video-started.png`
- **Fix**: Either (a) start the media worker during BP tests, (b) add a DEMO_MODE stub that marks uploads as complete immediately, or (c) accept this as expected behavior and adjust tests to only assert the upload was initiated, not completed.
- **Files**: `src/api/routes/assets.ts` (upload endpoint), `src/media/worker.ts` (processing)
- **Effort**: M

### GAP-003: File viewer crashes on versioned file — runtime error

- **Severity**: Critical
- **Category**: Functional
- **Tests**: UC-15 (file viewer shows version info for stacked file)
- **Expected**: Clicking a file with a version stack opens the file viewer and shows version selector/info
- **Actual**: Page crashes with error boundary: **"Something went wrong — Object.defineProperty called on non-object"**. The entire viewer fails to render.
- **Root cause**: The file viewer component attempts to call `Object.defineProperty` on a value that is `null` or `undefined`. This likely occurs when the version stack data structure is not properly loaded or the file's version metadata is malformed. The error happens before any version UI can render.
- **Screenshot**: `bp/screenshots/bush/15-file-viewer-no-version-ui.png`
- **Fix**: Debug the file viewer's version stack loading. Check the component that resolves version stack data — it likely assumes a non-null object that the API returns as null for seeded data. Add null guards in the viewer's version resolution logic.
- **Files**: Likely `src/web/components/viewer/` (file viewer), `src/api/routes/version-stacks.ts` (API)
- **Effort**: M

### GAP-004: Bell click navigation stalls on loading state

- **Severity**: Minor
- **Category**: UX
- **Tests**: UC-17 (clicking bell navigates to notifications)
- **Expected**: Clicking the notification bell navigates to `/notifications` and shows notification content
- **Actual**: After bell click, the page shows "Loading dashboard..." spinner and never resolves within the test timeout. The bell click may trigger a panel toggle rather than a page navigation, or the notifications page takes too long to load.
- **Root cause**: The `handleNotificationClick` in `app-layout.tsx` may open a notification panel/dropdown rather than navigating to `/notifications`. Alternatively, the nested button issue (GAP-001) causes the click to not register properly on the outer button.
- **Screenshot**: `bp/screenshots/bush/17-bell-clicked.png`
- **Fix**: Likely resolves when GAP-001 is fixed. If the bell is meant to toggle a dropdown (not navigate), update the test to check for a dropdown panel instead of URL change.
- **Files**: `src/web/components/layout/app-layout.tsx` (handleNotificationClick)
- **Effort**: S (likely fixed by GAP-001)

## Design Comparison Findings

_Pending — requires Tailwind UI Catalyst demo screenshots for comparison._

## Spec Corrections

### SC-001: UC-17 notification bell selector should use getByRole

- **File**: `bp/specs/17-notifications.spec.ts`
- **Issue**: Test uses `getByLabel("Notifications")` but the button's accessible name comes from `aria-label`, not a `<label>` element. While `getByLabel` does match `aria-label`, the nested button structure means two elements match.
- **Change**: After GAP-001 is fixed (single button), selector should work. Alternatively, use `getByRole("button", { name: "Notifications" }).first()` for robustness.

### SC-002: UC-07/UC-08 upload tests need adjusted expectations

- **File**: `bp/specs/07-upload-video.spec.ts`, `bp/specs/08-upload-mixed-media.spec.ts`
- **Issue**: Tests assume upload completes within 1-1.5s timeout, but DEMO_MODE has no media worker running.
- **Change**: Either document that `bun run dev:worker` must be running for upload tests, or change assertions to only verify the upload was initiated (file appears in list), not that it completed.
