# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-26 (v0.0.74 - Session Limits Enforcement)
**Project status**: **MVP FUNCTIONALLY COMPLETE** - All Phase 1, Phase 2, and Phase 3 core features implemented. Platform is feature-complete for initial release. Database migration drift has been resolved - fresh deployments will work correctly.
**Implementation progress**: [1.1] Bootstrap COMPLETED, [1.2] Database Schema COMPLETED (25 tables in schema.ts), [1.3] Authentication COMPLETED, [1.4] Permissions COMPLETED, [1.5] API Foundation COMPLETED (123 endpoints), [1.6] Object Storage COMPLETED, [1.7a/b] Web Shell COMPLETED, [QW1-4] Quick Wins COMPLETED, [2.1] File Upload System COMPLETED, [2.2] Media Processing COMPLETED, [2.3] Asset Browser COMPLETED, [2.4] Asset Operations COMPLETED, [2.5] Version Stacking COMPLETED, [2.6] Video Player COMPLETED, [2.7] Image Viewer COMPLETED, [2.8a] Audio Player COMPLETED, [2.8b] PDF Viewer COMPLETED, [2.9] Comments and Annotations COMPLETED, [2.10] Metadata System COMPLETED, [2.11] Notifications COMPLETED (API + UI), [2.12] Basic Search COMPLETED, [3.1] Sharing API + UI COMPLETED, [3.2] Collections COMPLETED, [3.4] Transcription COMPLETED, [R7] Realtime Infrastructure COMPLETED, [Email] Email Service COMPLETED, [Members] Member Management COMPLETED, [Folders] Folder Navigation COMPLETED, [Upload] Folder Structure Preservation COMPLETED.
**Source of truth for tech stack**: `specs/README.md` (lines 68-92)

---

## ~~CRITICAL BLOCKER: Database Migration Drift (P1)~~ -- RESOLVED

This issue has been fixed in v0.0.56. The `migrate.ts` file now includes all 25 tables, all columns, and all indexes defined in `schema.ts`. Fresh database deployments will work correctly.

---

## IMPLEMENTATION STATISTICS

### Verification (2026-02-18)

**Verified via comprehensive code analysis:**
- All 303 tests pass (25 test files)
- API endpoints: 123 total across 18 route modules (excluding index.ts and test files)
- Database schema: 25 tables defined in schema.ts
- Database migration: 25 tables in migrate.ts (100% coverage - migration drift resolved)
- Media processing: 5 processors (metadata, thumbnail, proxy, waveform, filmstrip)
- Frontend viewers: 4 implemented (video, audio, image, pdf)
- Frontend components: 49 TSX components
- Web pages: 16 Next.js pages

| Metric | Status | Notes |
|--------|--------|-------|
| **API Endpoints** | 123 (100%) | 18 route modules: accounts(10), auth(3), bulk(6), collections(7), comments(8), custom-fields(6), files(17), folders(9), metadata(3), notifications(5), projects(5), search(2), shares(10), transcription(6), users(3), version-stacks(11), webhooks(7), workspaces(5) |
| **Database Schema (schema.ts)** | 25 tables (100%) | All tables defined with proper indexes |
| **Database Migration (migrate.ts)** | 25 tables (100%) | All tables, columns, and indexes now included |
| **Test Files** | 25 | 303 tests passing, good coverage on core modules |
| **Spec Files** | 21 | Comprehensive specifications exist |
| **TODO Comments** | 10 | See detailed breakdown below |
| **Media Processing** | 100% | BullMQ + Worker infrastructure, metadata extraction, thumbnail generation, proxy transcoding, waveform extraction, filmstrip sprites |
| **Real-time (WebSocket)** | 100% | Event bus, WebSocket manager, browser client, React hooks, all 26 event types wired |
| **Email Service** | Partial | Provider interface done, all providers are console stubs |
| **Member Management** | 100% | List/invite/update/remove members with role checks |
| **Notifications** | 100% | API + UI with real-time updates |
| **Upload System** | 100% | Chunked upload, resumable, folder preservation |
| **Annotation Tools** | 100% | Canvas overlay, drawing tools, color/stroke picker, undo/redo |
| **Share System** | 100% | API + UI (list, detail, new, public pages) |
| **Folder Navigation** | 100% | FolderTree sidebar, Breadcrumbs, create folder modal |
| **Collections** | 100% | API + UI (list, detail pages) |
| **Transcription** | 100% | API + Deepgram/faster-whisper providers |
| **Viewers** | 100% | Video, Audio, Image, PDF |

---

## TODO COMMENTS ANALYSIS (10 total)

### Important Severity (8)

These should be addressed for production readiness:

1. **Email Providers (5 TODOs)** - `src/lib/email/index.ts`
   - SendGrid provider: falls back to console
   - SES provider: falls back to console
   - Postmark provider: falls back to console
   - Resend provider: falls back to console
   - SMTP provider: falls back to console
   - **Impact**: No production email capability; only console logging works
   - **Recommendation**: Implement SendGrid provider first

2. ~~**Permission Checks (3 TODOs)** - `src/api/routes/transcription.ts:42,66`~~ -- RESOLVED
   - Now uses `permissionService.getProjectPermission()` for proper access checks

3. ~~**Session Cache Invalidation (2 TODOs)** - `src/api/routes/accounts.ts:594,664`~~ -- RESOLVED
   - `invalidateOnRoleChange()` is now called at lines 596 and 667

4. ~~**Comment Deletion Permission Check** - `src/api/routes/comments.ts:421`~~ -- RESOLVED (v0.0.72)
   - Now properly checks for owner, account admin, or full_access permission

### Minor Severity (2)

These are nice-to-fix but not blocking:

1. **PDF Viewer Text Layer** - `src/web/components/viewers/pdf-viewer.tsx:253`
   - Issue: pdf.js v4+ API changes for text layer
   - Impact: Cannot select/copy text from PDFs

2. **Collection File Viewer** - `src/web/app/projects/[id]/collections/[collectionId]/page.tsx:364`
   - Issue: Click handler only logs to console
   - Impact: Cannot open files from collection view

---

## PRIORITY TASK LIST - PRODUCTION READINESS

**MVP features are functionally complete**, but the following items must be addressed before production deployment.

### Legend
- **P1**: Critical - Blocks fresh deployments or has security implications
- **P2**: Important - Should be fixed before production launch
- **P3**: Minor - Nice-to-have, can be deferred

---

## P1 - CRITICAL (Must Fix Before Fresh Deployment)

**All P1 items have been resolved.**

---

## P2 - IMPORTANT (Should Fix Before Production)

### ~~[P2] Permission Validation Before Grant [2h]~~ -- COMPLETED (v0.0.70)

- `validatePermissionChange()` is now called from `grantProjectPermission()` and `grantFolderPermission()`
- Prevents granting permissions that would lower inherited permissions
- Location: `src/permissions/service.ts`

### ~~[P2] Transcription Permission Checks [2h]~~ -- COMPLETED (v0.0.69)

- `hasEditAccess` and `hasShareAccess` now use `permissionService.getProjectPermission()` for proper access checks
- Location: `src/api/routes/transcription.ts`

### ~~[P2] Redis Cache Invalidation for Role Changes [30m]~~ -- COMPLETED (v0.0.69)

- `invalidateOnRoleChange()` is called at lines 596 and 667 in `src/api/routes/accounts.ts`
- Role changes now immediately invalidate affected sessions

### ~~[P2] Share Channel Permission Check [2h]~~ -- COMPLETED (v0.0.71)

- Proper account access check now implemented
- Location: `src/realtime/ws-manager.ts`

### ~~[P2] File Channel Permission Check [1h]~~ -- COMPLETED (v0.0.71)

- Proper project access check now implemented
- Location: `src/realtime/ws-manager.ts`

### ~~[P2] Comment Permission Check [1h]~~ -- COMPLETED (v0.0.72)

- Comment deletion now properly checks for owner, account admin, or full_access permission
- Location: `src/api/routes/comments.ts`

### ~~[P2] Email Provider Implementation [4h]~~ -- COMPLETED (v0.0.73)

- SMTP provider is now fully implemented with template rendering
- All 10 email templates implemented (member-invitation, password-reset, welcome, comment-mention, comment-reply, share-created, email-verification, file-processed, export-complete, notification-digest)
- Configuration via `EMAIL_PROVIDER` environment variable
- Nodemailer dependency added
- Location: `src/lib/email/smtp.ts`
- Tests: 75 passing tests across email module

### [P2] CDN Provider Interface [4h] -- NOT STARTED

- **Problem**: `CDNProvider` interface not implemented
- **Impact**: Cannot invalidate CDN cache or use CDN-specific features
- **Recommendation**: Implement Bunny CDN adapter per specs/README.md
- **Location**: `src/storage/`

### ~~[P2] Session Limits Enforcement [4h]~~ -- COMPLETED (v0.0.74)

- Max 10 concurrent sessions per user now enforced
- Oldest sessions evicted when limit exceeded
- Configuration via `MAX_CONCURRENT_SESSIONS` environment variable (default: 10)
- Location: `src/auth/session-cache.ts`
- Spec refs: `specs/12-authentication.md`

### [P2] Grant Permission API Exposure [4h] -- NOT STARTED

- **Problem**: `permissionService` has `grantProjectPermission()`, `grantFolderPermission()`, `grantWorkspacePermission()` methods that are implemented and tested but NOT exposed via API routes
- **Impact**: Permission granting UI may be incomplete - users cannot manage permissions through the API
- **Location**: `src/permissions/service.ts:384-455`
- **Solution**: Either add API endpoints for permission management, or verify that permission assignment happens via account/workspace/project membership roles only
- **Note**: May be intentional design - permissions could be derived from account roles rather than explicit grants

---

## P3 - MINOR (Can Be Deferred)

### [P3] PDF Viewer Text Layer [4h] -- NOT STARTED

- **Problem**: TODO at `src/web/components/viewers/pdf-viewer.tsx:253`
- **Impact**: Cannot select/copy text from PDFs
- **Cause**: pdf.js v4+ API changes

### [P3] Collection Detail File Viewer Integration [2h] -- NOT STARTED

- **Problem**: TODO at `src/web/app/projects/[id]/collections/[collectionId]/page.tsx:364`
- **Impact**: Clicking files in collection view only logs to console

### [P3] Document Processing [4d] -- DEFERRED

- PDF thumbnail/previews
- DOCX/PPTX/XLSX conversion (LibreOffice headless)
- Interactive ZIP viewer (sandboxed iframe)
- **Dependencies**: Worker process - DONE

### [P3] Image Format Support [4h] -- DEFERRED

- RAW via proxy (libraw/dcraw binary required)
- Adobe format proxy (ImageMagick required)
- HDR via tone-mapped proxy
- **Dependencies**: 2.2 (image processing) - DONE

### [P3] Access Groups [3d] -- DEFERRED

- Bulk permission management via groups
- Group CRUD, member assignment
- Plan-gate check for Team+ tier
- **Dependencies**: specs/13-billing-and-plans.md (deferred)

### [P3] API Key Token Type [1d] -- DEFERRED

- Generate/validate `bush_key_` prefixed tokens
- API key management CRUD endpoints
- Key scoping (read-only, read-write, admin)
- **Spec refs**: `specs/17-api-complete.md` Section 2.2

### [P3] OpenAPI Spec Generation [1d] -- DEFERRED

- Generate OpenAPI 3.1 spec from Hono routes
- Serve at `/v4/openapi.json`
- **Dependencies**: Routes complete - DONE

### [P3] Missing API Endpoints (Lower Priority) [1d] -- NOT STARTED

- `POST /v4/projects/:id/duplicate` - Project duplication
- `POST /v4/bulk/files/metadata` - Bulk metadata update
- `GET/PUT /v4/users/me/notifications/settings` - User notification preferences
- `POST /v4/shares/:id/invite` - Share invitation email
- `GET /v4/projects/:project_id/shares` - List shares for project

---

## CORRECTLY DEFERRED (No Action Needed)

The following are correctly deferred per spec/README.md:

- Document Processing (PDF thumb, DOCX/PPTX/XLSX) - P3
- RAW/Adobe Format Thumbnails - P3 (requires dcraw and ImageMagick binaries)
- Access Groups - P3 (depends on billing)
- API Key Token Type (`bush_key_`) - P3
- HLS Generation - Using MP4 proxies with CDN delivery instead
- AssemblyAI Provider - Deepgram + faster-whisper cover needs
- Enhanced Search (Visual/Semantic) - Requires AI/ML provider decision

---

## COMPLETED FEATURES (Historical Reference)

### Phase 1: Foundation (100% Complete)

- **Authentication**: WorkOS AuthKit, session cache, token refresh
- **Permissions**: 5-level hierarchy (owner, content_admin, member, guest, reviewer)
- **API Foundation**: 123 endpoints across 18 route modules
- **Object Storage**: R2/B2/S3-compatible with pre-signed URLs
- **Database**: 25 tables defined (migration drift is deployment issue, not schema issue)

### Phase 2: Core Features (100% Complete)

- **File Upload**: Chunked, resumable, folder preservation
- **Media Processing**: 5 processors (metadata, thumbnail, proxy, waveform, filmstrip)
- **Asset Browser**: Grid/list views, virtualized, folder navigation
- **Asset Operations**: Copy/move/delete/recover, download
- **Version Stacking**: Stack management, comparison viewer
- **Video Player**: JKL shuttle, frame-accurate seek, filmstrip preview
- **Image Viewer**: Zoom/pan, mini-map
- **Audio Player**: Waveform visualization, markers
- **PDF Viewer**: Multi-page, zoom
- **Comments**: API + UI, annotations, threading
- **Metadata**: Built-in fields, custom fields API + UI
- **Notifications**: API + UI, real-time
- **Search**: FTS5 for files and transcripts

### Phase 3: Advanced Features (100% Complete)

- **Sharing**: API + UI, public pages, passphrase protection
- **Collections**: API + UI, team/private
- **Comparison Viewer**: Side-by-side, linked playback/zoom
- **Transcription**: Deepgram/faster-whisper, FTS5 search, SRT/VTT/TXT export
- **Real-time**: WebSocket, event bus, all 26 event types
- **Email Service**: Interface + console provider
- **Member Management**: Full CRUD with role checks

---

## RESEARCH DECISIONS (All Resolved)

| Decision | Choice | Status |
|----------|--------|--------|
| R1: SQLite at Scale | SQLite WAL for <50 users | DONE |
| R2: Deployment | Hetzner VPS + systemd + Caddy | DONE |
| R3: Video Player | Custom HTML5 | DONE |
| R4: Media Transcoding | FFmpeg validated | DONE |
| R5: Large File Upload | Chunked + tus.io | DONE |
| R6: Transcription | Deepgram + faster-whisper | DONE |
| R7: Real-time | Bun WebSocket + EventEmitter | DONE |
| R9: Email | Provider interface | DONE |
| R10: CDN | Bunny CDN (deferred implementation) | DECIDED |

---

## SUMMARY: ACTION ITEMS FOR PRODUCTION

### Must Fix (P1) - Before Any Fresh Deployment

1. ~~**Database Migration Drift**~~ -- COMPLETED in v0.0.56

### Should Fix (P2) - Before Production Launch

2. ~~Permission validation before grant~~ -- COMPLETED v0.0.70
3. ~~Transcription permission checks~~ -- COMPLETED v0.0.69
4. ~~Session cache invalidation on role changes~~ -- COMPLETED v0.0.69
5. ~~Share channel permission check~~ -- COMPLETED v0.0.71
6. ~~File channel permission check~~ -- COMPLETED v0.0.71
7. ~~Comment deletion permission check~~ -- COMPLETED v0.0.72
8. ~~Email provider implementation (SMTP with nodemailer)~~ -- COMPLETED v0.0.73
9. ~~Session limits enforcement~~ -- COMPLETED v0.0.74
10. CDN provider implementation (Bunny CDN per specs)
11. Grant permission API exposure (verify design or add endpoints)

### Can Defer (P3)

12. PDF text layer
13. Collection file viewer integration
14. Document processing
15. RAW/Adobe image support
16. Access groups
17. API key token type
18. OpenAPI spec generation
19. Route test coverage (currently 0%)
20. WebSocket rate limit configuration

---

## CHANGE LOG

### v0.0.74 (2026-02-26) - Session Limits Enforcement

**Completed:**
- Implemented max concurrent sessions enforcement (default: 10 sessions per user)
- Oldest sessions automatically evicted when limit exceeded
- Added `MAX_CONCURRENT_SESSIONS` environment variable for configuration
- Added `enforceSessionLimit()` and `getSessionCount()` methods to session cache
- Session limits enforced during `sessionCache.set()` operation
- Added comprehensive tests for session limit enforcement
- Location: `src/auth/session-cache.ts`, `src/config/env.ts`
- Spec refs: `specs/12-authentication.md` (Session Limits section)

### v0.0.73 (2026-02-26) - SMTP Email Provider Implementation

**Completed:**
- Implemented full SMTP email provider with nodemailer
- Added local template rendering for all 10 email templates:
  - member-invitation, password-reset, welcome
  - comment-mention, comment-reply, share-created
  - email-verification, file-processed, export-complete
  - notification-digest
- Added `EMAIL_PROVIDER` environment variable to config
- Installed nodemailer and @types/nodemailer dependencies
- Updated email factory to use SMTP by default in production
- Added comprehensive tests (75 total email tests passing)
- Location: `src/lib/email/smtp.ts`, `src/lib/email/index.ts`

**Note:** API-based providers (SendGrid, SES, Postmark, Resend) now fall back to SMTP provider instead of console.

### v0.0.72 (2026-02-26) - Comment Permission Check

**Completed:**
- Implemented proper permission check for comment deletion
- Non-owners can now delete comments if they are account admin or have full_access permission on the project
- Location: `src/api/routes/comments.ts`

### v0.0.71 (2026-02-26) - WebSocket Channel Permission Checks

**Completed:**
- Implemented proper permission checks for WebSocket file and share channels
- File channel now verifies project access before allowing subscription
- Share channel now verifies account access before allowing subscription
- Location: `src/realtime/ws-manager.ts`

### v0.0.70 (2026-02-26) - Permission Validation Before Grant

**Completed:**
- Added permission validation before granting project and folder permissions
- `validatePermissionChange()` is now called to prevent lowering inherited permissions
- Location: `src/permissions/service.ts`

### v0.0.69 (2026-02-26) - Session Cache & Transcription Permissions Completed

**Completed:**
- Session cache invalidation on role changes - `invalidateOnRoleChange()` is called at lines 596 and 667 in accounts.ts (was already implemented)
- Transcription permission checks - `hasEditAccess` and `hasShareAccess` now use `permissionService.getProjectPermission()` for proper project-level access control

**Impact:**
- Role changes now immediately invalidate affected user sessions
- Transcription operations properly verify project-level permissions

### v0.0.56 (2026-02-26) - Database Migration Drift Fixed

**Fixed:**
- Updated `migrate.ts` to include all 25 tables from `schema.ts` (was 11 tables, 44% coverage)
- Added 14 missing tables: custom_fields, custom_field_visibility, share_assets, share_activity, workspace_permissions, project_permissions, folder_permissions, collections, collection_assets, webhooks, webhook_deliveries, transcripts, transcript_words, captions
- Added 8 missing columns to files table: technical_metadata, rating, asset_status, keywords, notes, assignee_id, custom_metadata, custom_thumbnail_key
- Added 3 missing columns to shares table: show_all_versions, show_transcription, featured_field
- Added all missing indexes (61 total indexes now included)

**Impact:**
- Fresh database deployments now work correctly
- All features requiring database tables are functional on new installations

### v0.0.55 (2026-02-18) - Deep Analysis with 250+ Parallel Subagents

**Analysis Performed:**
- Launched 10 parallel subagent teams to analyze specs, API routes, shared utilities, database layer, frontend, realtime/storage/media modules, TODO comments, and test coverage
- Deep thinking Opus analysis to synthesize findings and prioritize tasks
- Cross-referenced all findings with direct code examination

**Verified Findings:**
- API endpoint count: **123** (confirmed: accounts(10), auth(3), bulk(6), collections(7), comments(8), custom-fields(6), files(17), folders(9), metadata(3), notifications(5), projects(5), search(2), shares(10), transcription(6), users(3), version-stacks(11), webhooks(7), workspaces(5) = 123)
- Database migration drift: **14 tables missing** (44% coverage)
- TODO comments: **12 total** (7 important, 3 security-related, 2 minor)
- Test coverage: **16.08% statements** (high on core modules, 0% on routes/media/realtime)

**New Findings:**
- Grant permission API not exposed - `grantProjectPermission()` etc. not available via API
- Spec inconsistency: `specs/17-api-complete.md:93` example JSON shows `expires_in: 3600` (1 hour) but text says 5 minutes
- WebSocket rate limiting constants hardcoded (should be configurable)

**Confirmed Existing Findings:**
- `invalidateOnRoleChange()` function EXISTS in session-cache.ts - just needs calling from accounts.ts
- ~~Both file AND share channel WebSocket permission checks are permissive stubs returning `true`~~ -- Fixed in v0.0.71

**Updates:**
- Added "ADDITIONAL GAPS IDENTIFIED" section for grant permission API exposure
- Fixed spec inconsistency status (was marked RESOLVED but doc not fixed)
- No changes to P1/P2/P3 priorities - existing analysis was accurate

### v0.0.54 (2026-02-18) - Comprehensive Codebase Analysis

**Analysis Performed:**
- Parallel subagent analysis of all specs (21 files), src/lib, src/api, src/web, src/db, src/storage, src/permissions, src/realtime, src/media
- Corrected API endpoint count from 118 to **123** (files module has 17, not 14)
- Found additional missing columns in shares table (3 columns)
- Identified ~40+ missing indexes (not just 7)
- Added File Channel Permission Check as P2 item (was only share channel)
- Verified session cache invalidation function exists - just needs to be wired

**Key Findings:**
- `validatePermissionChange()` exists but is never called from grant methods
- `invalidateOnRoleChange()` function already exists in session-cache.ts - just needs calling
- Both share AND file channel permission checks are placeholder stubs
- Grant permission methods not wired to API routes (permission granting UI may be incomplete)

**Updates:**
- Updated endpoint counts in statistics section
- Added shares table columns to migration drift section
- Expanded missing indexes documentation
- Added File Channel Permission Check as P2 item
- Updated time estimate for session cache invalidation (function exists)
- Updated P2 summary list with 10 items (was 9)

### v0.0.53 (2026-02-18) - Critical Migration Drift Identified

**Analysis Performed:**
- Comprehensive codebase review comparing `schema.ts` vs `migrate.ts`
- Found 14 tables missing from migrations (44% coverage)
- Found 8 columns missing from files table
- Found 7 indexes missing from migrations
- Cataloged 12 TODO comments with severity ratings
- Verified API endpoint counts (118 total)

**Critical Finding:**
- Fresh database deployments will FAIL
- Features relying on missing tables will not work
- Existing databases work because they were created incrementally

**Status Update:**
- Project status: MVP COMPLETE → MVP FUNCTIONALLY COMPLETE (with critical migration drift)
- Added new section: "CRITICAL BLOCKER: Database Migration Drift"
- Reorganized priority list based on actual severity
- Updated TODO analysis with file locations and impact

### v0.0.52 (2026-02-18) - Gap Analysis Complete

(Previous changelog entries preserved in file history)

---

## SPEC INCONSISTENCIES TO RESOLVE

1. **Token TTL Mismatch** -- RESOLVED (needs doc fix)
   - `specs/12-authentication.md`: 5 min access / 7 days refresh
   - `specs/17-api-complete.md`: Example JSON shows `expires_in: 3600` (1 hour) which contradicts text saying "5 minutes"
   - **Resolution**: Use 5 min/7 days per auth spec (more secure)
   - **Action needed**: Fix example in `specs/17-api-complete.md:93` to show `expires_in: 300`

2. **README Deferral Labels** -- INFORMATIONAL
   - `specs/README.md` correctly defers billing to Phase 5 and accessibility to Phase 3+
   - Update when specs are written

---

## ADDITIONAL GAPS IDENTIFIED (v0.0.55)

### Grant Permission API Not Exposed

- **Problem**: `permissionService` has `grantProjectPermission()`, `grantFolderPermission()`, and `grantWorkspacePermission()` methods that are implemented and tested but NOT exposed via API routes
- **Impact**: Permission granting UI may be incomplete - users cannot manage permissions through the API
- **Location**: `src/permissions/service.ts:384-455`
- **Solution**: Add API endpoints for permission management or verify UI handles this differently
- **Priority**: P2

### Test Coverage Gaps

- **Problem**: API routes (18 files), media processing (9 files), realtime (3 files), and transcription (5 files) have **0% test coverage**
- **Impact**: Regressions may go undetected; refactoring is risky
- **Solution**: Prioritize tests for critical paths: file upload, permissions, sharing
- **Priority**: P3 (post-launch)

### Rate Limiting Configuration Hardcoded

- **Problem**: WebSocket rate limiting constants are hardcoded in `ws-manager.ts`
- **Impact**: Cannot tune without code changes
- **Solution**: Move to configuration
- **Priority**: P3
