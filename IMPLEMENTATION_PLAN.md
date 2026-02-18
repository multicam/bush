# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-18 (v0.0.54 - Comprehensive Codebase Analysis)
**Project status**: **MVP FUNCTIONALLY COMPLETE** - All Phase 1, Phase 2, and Phase 3 core features implemented. Platform is feature-complete for initial release BUT has critical database migration drift that will break fresh deployments.
**Implementation progress**: [1.1] Bootstrap COMPLETED, [1.2] Database Schema COMPLETED (25 tables in schema.ts), [1.3] Authentication COMPLETED, [1.4] Permissions COMPLETED, [1.5] API Foundation COMPLETED (123 endpoints), [1.6] Object Storage COMPLETED, [1.7a/b] Web Shell COMPLETED, [QW1-4] Quick Wins COMPLETED, [2.1] File Upload System COMPLETED, [2.2] Media Processing COMPLETED, [2.3] Asset Browser COMPLETED, [2.4] Asset Operations COMPLETED, [2.5] Version Stacking COMPLETED, [2.6] Video Player COMPLETED, [2.7] Image Viewer COMPLETED, [2.8a] Audio Player COMPLETED, [2.8b] PDF Viewer COMPLETED, [2.9] Comments and Annotations COMPLETED, [2.10] Metadata System COMPLETED, [2.11] Notifications COMPLETED (API + UI), [2.12] Basic Search COMPLETED, [3.1] Sharing API + UI COMPLETED, [3.2] Collections COMPLETED, [3.4] Transcription COMPLETED, [R7] Realtime Infrastructure COMPLETED, [Email] Email Service COMPLETED, [Members] Member Management COMPLETED, [Folders] Folder Navigation COMPLETED, [Upload] Folder Structure Preservation COMPLETED.
**Source of truth for tech stack**: `specs/README.md` (lines 68-92)

---

## CRITICAL BLOCKER: Database Migration Drift (P1)

### The Problem

The `schema.ts` file defines **25 tables** but `migrate.ts` only creates **11 tables**. This means:

- **Fresh database deployments will FAIL** - features requiring missing tables will not work
- **Existing databases work** because they were created with incremental migrations not captured in `migrate.ts`

### Missing Tables from migrate.ts (14 tables)

| Table | Schema Location | Impact |
|-------|-----------------|--------|
| `custom_fields` | schema.ts:211 | Custom field definitions - feature broken |
| `custom_field_visibility` | schema.ts:240 | Per-project field visibility - feature broken |
| `workspace_permissions` | schema.ts:389 | Workspace-level permissions - feature broken |
| `project_permissions` | schema.ts:407 | Project-level permissions - feature broken |
| `folder_permissions` | schema.ts:425 | Folder-level permissions - feature broken |
| `collections` | schema.ts:457 | Collections - feature broken |
| `collection_assets` | schema.ts:481 | Collection asset links - feature broken |
| `webhooks` | schema.ts:521 | Webhook configurations - feature broken |
| `webhook_deliveries` | schema.ts:557 | Delivery tracking - feature broken |
| `transcripts` | schema.ts:593 | Transcription data - feature broken |
| `transcript_words` | schema.ts:620 | Word-level timestamps - feature broken |
| `captions` | schema.ts:640 | Caption tracks - feature broken |
| `share_assets` | schema.ts:334 | Assets in shares - feature broken |
| `share_activity` | schema.ts:349 | Share view/download tracking - feature broken |

### Missing Columns in files table (8 columns)

| Column | Schema Line | Purpose |
|--------|-------------|---------|
| `technical_metadata` | schema.ts:168 | Technical metadata JSON (duration, codec, etc.) |
| `rating` | schema.ts:170 | 1-5 star rating |
| `asset_status` | schema.ts:171 | Custom status value |
| `keywords` | schema.ts:172 | Tags/keywords JSON array |
| `notes` | schema.ts:173 | User notes |
| `assignee_id` | schema.ts:174 | Assigned user ID |
| `custom_metadata` | schema.ts:176 | Custom field values JSON |
| `custom_thumbnail_key` | schema.ts:178 | User-defined thumbnail storage key |

### Missing Columns in shares table (3 columns)

| Column | Schema Line | Purpose |
|--------|-------------|---------|
| `show_all_versions` | schema.ts:319 | Show all versions in share |
| `show_transcription` | schema.ts:320 | Show transcription in share |
| `featured_field` | schema.ts:321 | Featured metadata field |

### Missing Indexes

The `migrate.ts` is also missing ~40+ indexes defined in `schema.ts`:

**Files table indexes:**
- `files_folder_id_idx`, `files_version_stack_id_idx`, `files_mime_type_idx`, `files_expires_at_idx`, `files_assignee_id_idx`

**Folders table indexes:**
- `folders_parent_id_idx`, `folders_path_idx`, `folders_project_parent_idx` (critical for tree queries)

**Projects table indexes:**
- `projects_archived_at_idx`

**Shares table indexes:**
- `shares_slug_idx`, `shares_account_id_idx`, `shares_project_id_idx`

**Other tables (all indexes missing):**
- `custom_fields`, `custom_field_visibility`, `workspace_permissions`, `project_permissions`, `folder_permissions`, `collections`, `collection_assets`, `webhooks`, `webhook_deliveries`, `transcripts`, `transcript_words`, `captions`, `share_assets`, `share_activity`

### Solution Required

Update `/home/tgds/projects/bush/src/db/migrate.ts` to include all tables, columns, and indexes from schema.ts.

**Estimated effort**: 4 hours
**Priority**: P1 - Must be fixed before any fresh deployment

---

## IMPLEMENTATION STATISTICS

### Verification (2026-02-18)

**Verified via comprehensive code analysis:**
- All 303 tests pass (25 test files)
- API endpoints: 123 total across 18 route modules (excluding index.ts and test files)
- Database schema: 25 tables defined in schema.ts
- Database migration: Only 11 tables in migrate.ts (CRITICAL GAP)
- Media processing: 5 processors (metadata, thumbnail, proxy, waveform, filmstrip)
- Frontend viewers: 4 implemented (video, audio, image, pdf)
- Frontend components: 49 TSX components
- Web pages: 16 Next.js pages

| Metric | Status | Notes |
|--------|--------|-------|
| **API Endpoints** | 123 (100%) | 18 route modules: accounts(10), auth(3), bulk(6), collections(7), comments(8), custom-fields(6), files(17), folders(9), metadata(3), notifications(5), projects(5), search(2), shares(10), transcription(6), users(3), version-stacks(11), webhooks(7), workspaces(5) |
| **Database Schema (schema.ts)** | 25 tables (100%) | All tables defined with proper indexes |
| **Database Migration (migrate.ts)** | 11/25 tables (44%) | **CRITICAL GAP** - 14 tables missing |
| **Test Files** | 25 | 303 tests passing, good coverage on core modules |
| **Spec Files** | 21 | Comprehensive specifications exist |
| **TODO Comments** | 12 | See detailed breakdown below |
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

## TODO COMMENTS ANALYSIS (12 total)

### Important Severity (10)

These should be addressed for production readiness:

1. **Email Providers (5 TODOs)** - `src/lib/email/index.ts`
   - SendGrid provider: falls back to console
   - SES provider: falls back to console
   - Postmark provider: falls back to console
   - Resend provider: falls back to console
   - SMTP provider: falls back to console
   - **Impact**: No production email capability; only console logging works
   - **Recommendation**: Implement SendGrid provider first

2. **Permission Checks (3 TODOs)** - `src/api/routes/transcription.ts:42,66`
   - TODO at line 42: Project-level permission check for getting transcription
   - TODO at line 66: Project-level permission check for creating transcription
   - **Impact**: Any account member can transcribe any file
   - **Solution**: Add `requirePermission()` middleware

3. **Session Cache Invalidation (2 TODOs)** - `src/api/routes/accounts.ts:594,664`
   - TODO at line 594: Invalidate sessions on role update
   - TODO at line 664: Invalidate sessions on member removal
   - **Impact**: Role changes take up to 5 minutes to take effect (access token TTL)

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

### [P1] Database Migration Drift [4h] -- NOT STARTED

**The single most critical issue.**

- **Problem**: 14 tables defined in `schema.ts` are missing from `migrate.ts`
- **Missing tables**: custom_fields, custom_field_visibility, workspace_permissions, project_permissions, folder_permissions, collections, collection_assets, webhooks, webhook_deliveries, transcripts, transcript_words, captions, share_assets, share_activity
- **Missing columns in files table**: technicalMetadata, rating, assetStatus, keywords, notes, assigneeId, customMetadata, customThumbnailKey
- **Missing columns in shares table**: show_all_versions, show_transcription, featured_field
- **Missing indexes**: ~40+ indexes across all missing tables, plus files (5), folders (3), projects (1), shares (3)
- **Impact**: Fresh database deployments will fail; features will not work
- **Solution**: Update `src/db/migrate.ts` to include all schema tables/columns/indexes
- **File**: `/home/tgds/projects/bush/src/db/migrate.ts`

---

## P2 - IMPORTANT (Should Fix Before Production)

### [P2] Permission Validation Before Grant [2h] -- NOT STARTED

- **Problem**: `validatePermissionChange()` exists but is never called
- **Impact**: Could grant permissions that violate inheritance rules
- **Location**: `src/permissions/service.ts`
- **Solution**: Call validation before `grantProjectPermission()`, `grantFolderPermission()`

### [P2] Transcription Permission Checks [2h] -- NOT STARTED

- **Problem**: TODOs at `src/api/routes/transcription.ts:42,66` - no project permission checks
- **Impact**: Any account member can transcribe any file
- **Solution**: Add `requirePermission()` middleware to transcription routes

### [P2] Redis Cache Invalidation for Role Changes [30m] -- NOT STARTED

- **Problem**: TODOs at `src/api/routes/accounts.ts:594,664`
- **Impact**: Role changes take up to 5 minutes to take effect (access token TTL)
- **Solution**: Call existing `sessionCache.invalidateOnRoleChange()` function from `src/auth/session-cache.ts`
- **Note**: The function already exists (lines 147-165), just needs to be wired up

### [P2] Share Channel Permission Check [2h] -- NOT STARTED

- **Problem**: `src/realtime/ws-manager.ts:446-449` share permission check is placeholder returning `true`
- **Impact**: Any authenticated user could subscribe to any share's realtime events
- **Solution**: Implement proper share membership check

### [P2] File Channel Permission Check [1h] -- NOT STARTED

- **Problem**: `src/realtime/ws-manager.ts:437-440` file permission check is placeholder returning `true`
- **Impact**: Any authenticated user could subscribe to any file's realtime events
- **Solution**: Implement proper file access check via project permission

### [P2] Comment Permission Check [1h] -- NOT STARTED

- **Problem**: TODO at `src/api/routes/comments.ts:421` - `full_access+` check not implemented
- **Impact**: Comment completion may be allowed without appropriate permissions

### [P2] Email Provider Implementation [4h] -- NOT STARTED

- **Problem**: All providers (SendGrid, SES, Postmark, Resend, SMTP) are TODO stubs
- **Impact**: No production email capability; only console logging
- **Recommendation**: Implement SendGrid provider first
- **Location**: `src/lib/email/index.ts`

### [P2] CDN Provider Interface [4h] -- NOT STARTED

- **Problem**: `CDNProvider` interface not implemented
- **Impact**: Cannot invalidate CDN cache or use CDN-specific features
- **Recommendation**: Implement Bunny CDN adapter per specs/README.md
- **Location**: `src/storage/`

### [P2] Session Limits Enforcement [4h] -- NOT STARTED

- **Problem**: Max 10 concurrent sessions per user not enforced
- **Location**: `src/redis/session-cache.ts` - infrastructure exists
- **Solution**: Add session count check, evict oldest on exceed
- **Spec refs**: `specs/12-authentication.md`

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

1. **Database Migration Drift** - Update `migrate.ts` to include all 25 tables

### Should Fix (P2) - Before Production Launch

2. Permission validation before grant
3. Transcription permission checks
4. Session cache invalidation on role changes (function exists, just wire it up)
5. Share channel permission check
6. File channel permission check
7. Comment completion permission check
8. Email provider implementation (SendGrid recommended)
9. CDN provider implementation (Bunny CDN per specs)
10. Session limits enforcement

### Can Defer (P3)

11. PDF text layer
12. Collection file viewer integration
13. Document processing
14. RAW/Adobe image support
15. Access groups
16. API key token type
17. OpenAPI spec generation

---

## CHANGE LOG

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

1. **Token TTL Mismatch** -- RESOLVED
   - `specs/12-authentication.md`: 5 min access / 7 days refresh
   - `specs/17-api-complete.md`: 1 hour access / 30 days refresh
   - **Resolution**: Use 5 min/7 days per auth spec (more secure)
   - **Action needed**: Update API spec to match auth spec

2. **README Deferral Labels** -- INFORMATIONAL
   - `specs/README.md` correctly defers billing to Phase 5 and accessibility to Phase 3+
   - Update when specs are written
