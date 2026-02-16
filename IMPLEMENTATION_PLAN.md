# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-16 (Deep Research Update)
**Project status**: Phase 1 substantially COMPLETED, Phase 2 IN PROGRESS - Upload Backend Handler COMPLETED
**Implementation progress**: [1.1] Bootstrap COMPLETED, [1.2] Database Schema COMPLETED, [1.3] Authentication COMPLETED, [1.4] Permissions COMPLETED, [1.5] API Foundation IN PROGRESS, [1.6] Object Storage COMPLETED, [1.7a/b] Web Shell COMPLETED, [QW1-4] Quick Wins COMPLETED, [2.1] File Upload System IN PROGRESS. Code refactoring pass COMPLETED.
**Source of truth for tech stack**: `specs/README.md` (lines 54-76)

---

## IMPLEMENTATION STATISTICS

| Metric | Status | Notes |
|--------|--------|-------|
| **API Endpoints** | 39/110+ (35%) | 6 route modules implemented, multipart upload + download added |
| **Database Tables** | 14/26 (54%) | Core tables complete, feature tables missing |
| **Test Files** | 19 | Good coverage on core modules |
| **Spec Files** | 21 | Comprehensive specifications exist |
| **TODO Comments** | 1 | `src/web/context/auth-context.tsx:149` |
| **Media Processing** | 0% | Infrastructure only, no workers |
| **Real-time (WebSocket)** | 0% | Not implemented |

---

## PRIORITY TASK LIST - WHAT'S REMAINING

This section lists all remaining implementation tasks, prioritized by impact and dependencies. Updated based on comprehensive research validation.

### Legend
- **P0**: Blocking/Critical - prevents other work or core functionality
- **P1**: High - needed for MVP/Iteration 1
- **P2**: Medium - important but not blocking
- **P3**: Low - nice-to-have, deferrable
- **Effort**: Estimated time (h = hours, d = days)
- **Dependencies**: What must complete first

---

## PHASE 1 GAPS (Foundation Completion)

### Authentication Gaps

- **[P1] Auth Endpoints** [4h] -- NOT STARTED **(PROMOTED FROM P0)**
  - `POST /v4/auth/token` - token refresh
  - `POST /v4/auth/revoke` - token revocation
  - `GET /v4/auth/me` - current user info
  - **Dependencies**: None (auth middleware ready)
  - **Note**: Can use existing session flow in meantime

- **[P2] Guest/Reviewer Access Flows** [2d] -- NOT STARTED **(DEPRIORITIZED FROM P1)**
  - Implement 3 access tiers: authenticated, identified (email code), unidentified (anonymous)
  - Share-link-based access without WorkOS account
  - Guest session management and constraints
  - **Dependencies**: 1.3 (Auth) - DONE, 3.1 (Sharing)
  - **Spec refs**: `specs/12-authentication.md` Section 4
  - **Note**: Not needed for Iteration 1 - users can authenticate

- **[P3] Session Limits Enforcement** [4h] -- NOT STARTED **(DEPRIORITIZED FROM P2)**
  - Enforce max 10 concurrent sessions per user
  - Add session count check in session-cache.ts
  - Evict oldest session when limit exceeded
  - **Dependencies**: None (infrastructure ready)

- **[P3] Failed Login Tracking/Lockout** [4h] -- NOT STARTED **(DEPRIORITIZED FROM P2)**
  - Track failed login attempts in Redis
  - Implement progressive lockout (5 min, 15 min, 1 hr)
  - **Dependencies**: None (infrastructure ready)

- **[P2] `bush_key_` API Key Token Type** [1d] -- NOT STARTED
  - Generate/validate `bush_key_` prefixed tokens for server-to-server auth
  - API key management CRUD endpoints
  - Key scoping (read-only, read-write, admin)
  - **Dependencies**: 1.5 (API) - partial
  - **Spec refs**: `specs/17-api-complete.md` Section 2.2

### API Gaps (1.5 Completion)

- **[P1] Storage Usage Endpoint** [2h] -- NOT STARTED
  - `GET /v4/accounts/:id/storage` - return storageUsedBytes, storageQuotaBytes
  - Calculate from files table or cache in accounts
  - **Dependencies**: None

- **[P1] File Download/Access Endpoints** [4h] -- COMPLETED
  - `GET /v4/projects/:projectId/files/:id/download` - Pre-signed download URL for original
  - `GET /v4/files/:id/thumbnail` - Thumbnail URL (pending 2.2)
  - `GET /v4/files/:id/proxy` - Proxy video URL (pending 2.2)
  - **Dependencies**: 2.2 (Media Processing for thumbnails/proxies)
  - **Critical for**: Asset viewing and downloading

- **[P2] Member Management Endpoints** [1d] -- NOT STARTED
  - `GET /v4/accounts/:id/members` - list members
  - `POST /v4/accounts/:id/members` - invite member
  - `PATCH /v4/accounts/:id/members/:memberId` - update role
  - `DELETE /v4/accounts/:id/members/:memberId` - remove member
  - **Dependencies**: None

- **[P3] OpenAPI Spec Generation** [1d] -- NOT STARTED **(DEPRIORITIZED FROM P2)**
  - Generate OpenAPI 3.1 spec from Hono routes
  - Serve at `/v4/openapi.json`
  - Enable API documentation and SDK generation
  - **Dependencies**: 1.5 routes complete
  - **Note**: Documentation, not functional - defer

- **[P3] Filtering/Sparse Fieldsets** [1d] -- NOT STARTED
  - Query parameter filtering (`?filter[status]=ready`)
  - Sparse fieldsets (`?fields[files]=name,size`)
  - **Dependencies**: None
  - **Spec refs**: `specs/17-api-complete.md` Section 5

- **[P3] Per-Account Rate Limiting** [4h] -- NOT STARTED
  - Current: per-IP only
  - Add account-scoped rate limits
  - Higher limits for paid plans
  - **Dependencies**: specs/13-billing-and-plans.md

### Permissions Gaps

- **[P2] Fix Missing Import in service.ts** [15m] -- BUG
  - `accountMemberships` used but not imported in `src/permissions/service.ts`
  - Already fixed via `src/db/schema.ts` re-export
  - **Verify**: Check import is working

- **[P2] Permission Validation Before Grant** [2h] -- NOT STARTED
  - Call `validatePermissionChange()` before `grantProjectPermission()` etc.
  - Prevent lowering inherited permissions
  - **Dependencies**: None (function exists)

- **[P3] Access Groups (Team+ Feature)** [3d] -- DEFERRED to Phase 5
  - Bulk permission management via groups
  - Group CRUD, member assignment
  - Plan-gate check for Team+ tier
  - **Dependencies**: specs/13-billing-and-plans.md

- **[P3] Asset-Level Permission Function** [4h] -- NOT STARTED
  - `getAssetPermission(userId, fileId)` helper
  - Derive from folder/project/workspace inheritance
  - **Dependencies**: None

### Database Schema Gaps

- **[P1] Add Missing Indexes** [1h] -- NOT STARTED
  - `files.versionStackId` index
  - `files.mimeType` index
  - `files.expiresAt` index
  - `comments.parentId` index
  - `comments.versionStackId` index
  - `shares.accountId` index
  - `notifications.readAt` index
  - **Composite on `folders(projectId, parentId)`** - Critical for tree queries
  - **Dependencies**: None
  - **Note**: Some indexes already exist in schema.ts but not in migrate.ts

- **[P2] Add Missing Tables** [2d] -- NOT STARTED
  - `customFields` - custom field definitions
  - `assetCustomFieldValues` - field values on assets
  - `webhooks` - webhook configurations
  - `auditLog` - security audit trail
  - `collections` - saved asset collections
  - `collectionAssets` - assets in collections
  - `transcripts` - transcription data
  - `shareAssets` - assets in shares
  - `shareActivity` - share view/download tracking
  - `commentAttachments` - files attached to comments
  - `userNotificationSettings` - per-user notification prefs
  - **Dependencies**: None (can add incrementally)

- **[P2] Technical Metadata JSON Column** [2h] -- NOT STARTED **(NEW)**
  - Add `technicalMetadata` JSON column to files table
  - Store extracted metadata: duration, width, height, codec, bitrate, frameRate, etc.
  - Avoids 30+ individual columns
  - **Dependencies**: 2.2 (Media Processing to extract)

### Configuration Gaps

- **[P2] WORKOS_COOKIE_PASSWORD in SECRET_KEYS** [5m] -- NOT STARTED
  - Add to SECRET_KEYS array in `src/config/env.ts`
  - Ensure cookie password is scrubbed from logs
  - **Dependencies**: None

---

## PHASE 2: CORE FEATURES (MVP)

### 2.1 File Upload System [P0] - 3 days

**IN PROGRESS** -- Upload Backend Handler COMPLETED

- **[P0] Upload Backend Handler** [4h] -- COMPLETED
  - Wire `POST /v4/projects/:id/files` to actual storage upload
  - Return pre-signed URL from storage module (already implemented)
  - File record creation with status tracking
  - Multipart completion notification endpoint
  - Storage quota validation added
  - **Dependencies**: 1.6 (Storage) - DONE

- **[P0] Chunked Upload Client** [1d]
  - Browser library with 10MB chunks, 3-5 parallel
  - IndexedDB for resumable state
  - Progress events, pause/resume/cancel
  - **Dependencies**: Upload backend handler

- **[P1] Drag-and-Drop UI** [4h]
  - File and folder drop zones
  - MIME validation via QW1 file type registry
  - Visual feedback, error handling
  - **Dependencies**: 1.7b (Web Shell) - DONE

- **[P1] Upload Queue UI** [4h]
  - Progress bars per file
  - Priority reorder, retry failed
  - Max 10 concurrent enforcement
  - **Dependencies**: Upload client

- **[P2] Folder Structure Preservation** [4h]
  - Parse folder hierarchy on drop
  - Create folders as needed
  - Preserve relative paths
  - **Dependencies**: Upload backend

### 2.2 Media Processing Pipeline [P0] - 4 days

**NOT STARTED** -- Critical for thumbnails, proxies, all viewers

- **[P0] BullMQ Setup** [2h]
  - Install bullmq package
  - Create Redis-backed queues
  - Job types: thumbnail, proxy, waveform, filmstrip, metadata
  - **Dependencies**: None (Redis ready)

- **[P0] Worker Process** [1d]
  - Separate worker entry point
  - Configurable concurrency per job type
  - FFmpeg/FFprobe integration
  - Job status tracking in DB
  - **Dependencies**: BullMQ setup

- **[P1] Video Processing** [1d]
  - Thumbnail generation (3 sizes: 160px, 320px, 640px)
  - Filmstrip sprites (1-sec intervals)
  - Proxy transcoding (360p, 540p, 720p, 1080p, 4K)
  - HDR tone mapping
  - **Dependencies**: Worker process

- **[P1] Image Processing** [4h]
  - Thumbnail generation
  - RAW format proxy (via libraw)
  - Adobe format proxy (via ImageMagick)
  - **Dependencies**: Worker process

- **[P1] Audio Processing** [4h]
  - Waveform JSON extraction (peak data)
  - Waveform PNG visualization
  - **Dependencies**: Worker process

- **[P2] Document Processing** [4h]
  - PDF thumbnail/previews
  - DOCX/PPTX/XLSX conversion (LibreOffice headless)
  - **Dependencies**: Worker process, R4 research

- **[P2] Metadata Extraction** [2h]
  - FFprobe integration
  - 33 built-in fields extraction
  - Store in files table
  - **Dependencies**: Worker process

### 2.3 Asset Browser and Navigation [P1] - 3 days

**NOT STARTED** -- Core user interface

- **[P1] Grid View** [4h]
  - Adjustable card sizes (small/medium/large)
  - Thumbnail display with aspect ratio options
  - File type icons from QW1 for missing thumbnails
  - **Dependencies**: 2.2 (thumbnails)

- **[P1] List View** [4h]
  - Sortable metadata columns
  - Multi-column layout
  - Row actions
  - **Dependencies**: None

- **[P1] Folder Navigation** [4h]
  - Tree view component
  - Breadcrumbs
  - Flatten folders option
  - **Dependencies**: None

- **[P1] Multi-Select and Bulk Actions** [4h]
  - Shift-click range, Cmd/Ctrl toggle
  - Select all (max 200)
  - Bulk move/copy/delete/download
  - **Dependencies**: None

- **[P2] Virtualized Lists** [4h]
  - react-window or similar
  - Lazy thumbnail loading
  - Infinite scroll with cursor pagination
  - **Dependencies**: Grid/List views

### 2.4 Asset Operations [P1] - 2 days

**NOT STARTED**

- **[P1] Copy/Move/Delete/Recover** [4h]
  - API endpoints: `POST /v4/files/:id/copy`, `/move`, `/delete`
  - Soft delete with 30-day retention
  - Recovery endpoint
  - **Dependencies**: 2.3 (Asset Browser)

- **[P1] Download Endpoints** [4h]
  - `GET /v4/files/:id/download` - original via pre-signed URL
  - `GET /v4/files/:id/download?proxy=720p` - proxy version
  - **Dependencies**: 2.2 (proxies)

- **[P2] Custom Thumbnail** [2h]
  - Upload custom image or select video frame
  - **Dependencies**: 2.2 (processing)

- **[P2] Auto-Delete Scheduled Job** [2h]
  - BullMQ daily job
  - Purge expired soft-deleted files
  - **Dependencies**: 2.4 delete logic

### 2.5 Version Stacking [P1] - 2 days

**NOT STARTED**

- **[P1] Version Stack API** [4h]
  - `POST /v4/version-stacks` - create stack
  - `POST /v4/version-stacks/:id/files` - add version
  - `DELETE /v4/version-stacks/:id/files/:fileId` - remove
  - `PATCH /v4/version-stacks/:id/current` - set current
  - **Dependencies**: 2.1 (Upload)

- **[P1] Version Stack UI** [4h]
  - Drag-to-stack interaction
  - Version list with thumbnails
  - Compare versions side-by-side
  - **Dependencies**: 2.3 (Asset Browser)

- **[P2] Comments on Version Stacks** [2h]
  - Comments linked to stack, not individual files
  - Persist across versions
  - **Dependencies**: 2.9 (Comments)

### 2.6 Video Player [P1] - 4 days

**NOT STARTED**

- **[P1] Base Player Setup** [1d]
  - Video.js or Shaka Player integration
  - HLS adaptive streaming
  - CDN delivery (requires R10 decision)
  - **Dependencies**: 2.2 (proxy transcoding), R3 research

- **[P1] Playback Controls** [1d]
  - Frame-accurate seeking
  - JKL shuttle controls
  - Playback speed 0.25x-1.75x
  - In/out points, loop
  - **Dependencies**: Base player

- **[P1] Timeline Features** [4h]
  - Filmstrip hover preview
  - Comment markers on timeline
  - Frame guides overlay
  - **Dependencies**: Base player, 2.2 (filmstrips)

- **[P2] Full Keyboard Shortcuts** [4h]
  - Space (play/pause), J/K/L (shuttle)
  - Arrow keys (seek), F (fullscreen)
  - M (mute), I/O (in/out points)
  - **Dependencies**: Base player

### 2.7 Image Viewer [P1] - 2 days

**NOT STARTED**

- **[P1] Zoom and Pan** [4h]
  - Zoom 25%-400% via mouse wheel, buttons, slider
  - Zoom to cursor point
  - Pan via drag
  - Fit-to-screen, 1:1 pixel view
  - **Dependencies**: 2.3 (Asset Browser)

- **[P1] Format Support** [4h]
  - Standard images (JPEG, PNG, GIF, WebP, etc.)
  - RAW via proxy (use processed thumbnail)
  - Adobe via proxy (use processed thumbnail)
  - HDR via tone-mapped proxy
  - **Dependencies**: 2.2 (image processing)

- **[P2] Mini-Map for Large Images** [2h]
  - Show for images >2000px
  - Click to navigate
  - Viewport indicator
  - **Dependencies**: Zoom/pan

### 2.8a Audio Player [P1] - 2 days

**NOT STARTED** -- Was missing from original plan

- **[P1] Waveform Visualization** [4h]
  - Render from processing pipeline JSON peak data
  - Interactive click-to-seek
  - Current position indicator
  - **Dependencies**: 2.2 (waveform extraction)

- **[P1] Playback Controls** [2h]
  - Play/pause, seek via waveform
  - Volume slider, mute toggle
  - Playback speed 0.25x-1.75x
  - **Dependencies**: Waveform visualization

- **[P2] Comment Markers on Waveform** [2h]
  - Timestamped comment indicators
  - Click to jump to comment
  - **Dependencies**: 2.9 (Comments)

- **[P2] Keyboard Shortcuts** [1h]
  - Space (play/pause), arrows (seek)
  - M (mute), J/K/L (shuttle)
  - **Dependencies**: Playback controls

### 2.8b PDF and Document Viewer [P1] - 3 days

**NOT STARTED** -- Expanded from PDF-only

- **[P1] PDF Viewer** [1d]
  - PDF.js integration
  - Multi-page navigation (thumbnails sidebar, prev/next)
  - Zoom (fit width, fit page, actual size)
  - Text selection/copy, search within PDF
  - **Dependencies**: 2.3 (Asset Browser)

- **[P1] Document Viewer (DOCX/PPTX/XLSX)** [4h]
  - Render server-generated PDF preview from 2.2
  - Page navigation, zoom
  - **Dependencies**: 2.2 (document conversion)

- **[P2] Interactive ZIP Viewer** [4h]
  - Sandboxed iframe rendering
  - Security constraints (no external network, no localStorage)
  - **Dependencies**: 2.2 (processing)

### 2.9 Comments and Annotations [P1] - 4 days

**NOT STARTED**

- **[P1] Comment API** [1d]
  - CRUD for comments
  - Types: single-frame, range-based, anchored, internal, public
  - Threaded replies, @mentions
  - **Dependencies**: 2.6, 2.7, 2.8a, 2.8b (viewers)

- **[P1] Comment Panel UI** [1d]
  - Thread view with replies
  - Filter/sort by type, user, status
  - Quick actions (resolve, reply, delete)
  - Export (CSV, plain text, EDL)
  - **Dependencies**: Comment API

- **[P1] Annotation Tools** [1d]
  - Canvas overlay on all viewer types
  - Free draw, line, arrow, rectangle
  - Color picker, undo/redo
  - **Dependencies**: Viewers

- **[P2] Real-Time Sync** [4h]
  - WebSocket broadcast on new comment
  - Optimistic UI updates
  - **Dependencies**: R7 (Realtime infrastructure)

### 2.10 Metadata System [P1] - 3 days

**NOT STARTED**

- **[P1] Built-In Metadata Fields** [1d]
  - 33 fields per spec 6.1
  - Metadata inspector panel (right sidebar)
  - Display in list view columns
  - **Dependencies**: 2.2 (metadata extraction)

- **[P1] Custom Fields API** [4h]
  - CRUD for custom field definitions
  - Field types: text, number, date, select, multi-select, etc.
  - Account-wide library
  - **Dependencies**: Database schema (customFields table)

- **[P1] Custom Fields UI** [4h]
  - Field management UI
  - Per-project visibility toggles
  - Bulk edit metadata
  - **Dependencies**: Custom fields API

- **[P2] Metadata Badges** [2h]
  - Show key metadata on asset cards
  - Configurable which fields display
  - **Dependencies**: Built-in fields

### 2.11 Notifications System [P1] - 3 days

**NOT STARTED**

- **[P1] In-App Notifications** [1d]
  - Real-time via WebSocket
  - Bell icon with unread count
  - Notification dropdown panel
  - Mark as read, clear all
  - **Dependencies**: R7 (Realtime infrastructure)

- **[P1] Email Notifications** [1d]
  - Email service integration (R9 decision)
  - Email templates for each notification type
  - Daily digest (9am local time)
  - Immediate alerts (<1 min delivery)
  - **Dependencies**: R9 (Email research)

- **[P2] User Preferences UI** [4h]
  - Per-project notification settings
  - Per-asset subscription toggle
  - Email vs in-app preferences
  - **Dependencies**: In-app notifications

### 2.12 Basic Search [P1] - 2 days

**NOT STARTED**

- **[P1] FTS5 Setup** [4h]
  - Create FTS5 virtual table
  - Triggers for index sync on file changes
  - BM25 ranking
  - **Dependencies**: 1.2 (Database) - DONE

- **[P1] Search API** [4h]
  - `GET /v4/search?q=query`
  - Typeahead (2+ chars, 300ms debounce)
  - Filter refinement (type, date, project)
  - Permission-filtered results
  - **Dependencies**: FTS5 setup

- **[P1] Search UI** [4h]
  - Global search bar (Cmd+K)
  - Project search (Cmd+F)
  - Thumbnail previews in results
  - **Dependencies**: Search API

---

## PHASE 3: ADVANCED FEATURES

### 3.1 Sharing and Presentations [P1] - 4 days

**NOT STARTED**

- Share link CRUD and settings
- Layout types (grid, reel, viewer)
- Custom branding (icon, header, colors)
- External reviewer access (ties into guest flows)
- Share activity tracking
- **Dependencies**: 2.9 (Comments), 2.10 (Metadata), 2.11 (Notifications)

### 3.2 Collections [P2] - 3 days

**NOT STARTED**

- Team and private collections
- Dynamic filtering (AND/OR rules)
- Real-time sync, custom sort
- Share entire collection
- **Dependencies**: 2.10 (Metadata), 2.12 (Search), 3.1 (Sharing)

### 3.3 Comparison Viewer [P2] - 2 days

**NOT STARTED**

- Side-by-side video/image comparison
- Linked playback mode
- Adjustable split divider
- **Dependencies**: 2.6 (Video Player), 2.7 (Image Viewer), 2.5 (Version Stacks)

### 3.4 Transcription and Captions [P2] - 4 days

**NOT STARTED**

- Provider integration (R6 decision)
- 27 languages, speaker ID
- Editable transcripts, time-synced highlighting
- Caption generation/export (VTT, SRT)
- **Dependencies**: 2.6 (Video), 2.8a (Audio), R6 (Transcription research)

### 3.5 Enhanced Search [P2] - 3 days

**NOT STARTED**

- Visual search (Vision API)
- Transcript search integration
- Semantic search
- **Dependencies**: 2.12 (Basic Search), 3.4 (Transcription)

### 3.6 Webhook System [P2] - 3 days

**NOT STARTED**

- Webhook CRUD, event subscriptions
- HMAC-SHA256 signatures
- BullMQ delivery with retries
- Delivery logs UI
- **Dependencies**: 1.5 (API), 2.2 (Processing for events)

### 3.7 Asset Lifecycle Management [P2] - 2 days

**NOT STARTED**

- Workspace-level retention defaults
- Per-asset override
- Expiration indicators
- 30-day recovery period
- Daily BullMQ expiration job
- **Dependencies**: 1.6 (Storage), 2.10 (Metadata)

---

## RESEARCH ITEMS (Blocking Implementation)

### TIER 1: Week 1 (CRITICAL)

- **[P0] R2: Deployment Architecture** [2d] -- NOT STARTED
  - Determine Next.js + Bun topology (single process vs separate)
  - Process supervision, crash recovery
  - Zero-downtime deployment strategy
  - **Blocks**: 1.1 final decisions

- **[P0] R1: SQLite at Scale** [3d] -- NOT STARTED
  - Benchmark concurrent read/write
  - WAL mode, connection pooling
  - Backup strategy (Litestream)
  - **Informs**: 1.2 database config

### TIER 2: Weeks 2-3 (HIGH)

- **[P1] R4: Media Transcoding Validation** [1w] -- NOT STARTED
  - Benchmark FFmpeg parameters from spec
  - Validate HDR tone mapping, document conversion
  - Worker resource management
  - **Blocks**: 2.2 (Media Processing)

- **[P1] R5: Large File Upload Strategy** [2d] -- NOT STARTED
  - Optimal chunk size, parallel concurrency
  - tus.io protocol vs custom
  - 5TB upload testing
  - **Enhances**: 2.1 (Upload)

- **[P1] R7: Real-Time Infrastructure** [1w] -- NOT STARTED
  - WebSocket server for Bun
  - Redis pub/sub scaling
  - Connection management
  - **Blocks**: 2.9 (Comments), 2.11 (Notifications)

### TIER 3: Week 2 (QUICK DECISIONS)

- **[P2] R9: Email Service Provider** [1d] -- NOT STARTED
  - Compare SendGrid, AWS SES, Postmark, Resend
  - Deliverability, cost, template support
  - **Blocks**: 2.11 (Notifications email)

- **[P2] R10: CDN Provider Selection** [1d] -- NOT STARTED
  - Compare Bunny CDN, CloudFront, Fastly
  - HLS streaming, token auth
  - **Blocks**: 2.6 (Video streaming)

- **[P2] R11: Adobe IMS / OAuth** [1d] -- NOT STARTED
  - Adobe OAuth flow documentation
  - Developer console setup
  - **Blocks**: 1.3 Adobe login (can stub)

### TIER 4: Week 3-4 (MEDIUM)

- **[P2] R3: Video Player Architecture** [2d] -- NOT STARTED
  - Compare Video.js, Shaka Player, custom
  - Frame-accurate seeking, annotation overlays
  - **Blocks**: 2.6 (Video Player)

### TIER 5: Phase 3+ (DEFER)

- **[P3] R6: Transcription Service** [1d] -- DEFER
- **[P3] R8: Search Scalability** [1d] -- DEFER

---

## SPEC WRITING (Blocking Implementation)

- **[P1] specs/19-accessibility.md** [1d] -- NOT STARTED
  - WCAG AA compliance target
  - Keyboard navigation, screen reader support
  - **Informs**: All UI work

- **[P2] specs/13-billing-and-plans.md** [1d] -- NOT STARTED
  - Pricing tiers, feature matrix
  - Plan-gated feature definitions
  - **Blocks**: Plan-gate middleware, 5.1 (Billing)

---

## QUICK WINS (HIGH LEVERAGE)

All quick wins are COMPLETED:
- [x] QW1: File Type Registry
- [x] QW2: Seed Data Scripts
- [x] QW3: Component Library Foundation
- [x] QW4: Error Handling Utilities

---

## WEB FRONTEND GAPS

- **[P1] File Management Pages** [2d] -- NOT STARTED
  - `/files` route - file browser page
  - File upload UI integration
  - File viewer routing
  - **Dependencies**: 2.1 (Upload), 2.3 (Asset Browser)

- **[P1] Folder Navigation** [1d] -- NOT STARTED
  - Folder tree component
  - Breadcrumbs
  - Create/rename/delete folders
  - **Dependencies**: None

- **[P2] Collections Page** [4h] -- NOT STARTED
  - `/collections` route referenced in sidebar
  - **Dependencies**: 3.2 (Collections)

- **[P2] Shares Page** [4h] -- NOT STARTED
  - `/shares` route referenced in sidebar
  - **Dependencies**: 3.1 (Sharing)

- **[P2] Settings Save Functionality** [4h] -- NOT STARTED
  - Connect Settings page forms to API
  - Remove mock team member data
  - **Dependencies**: Member management endpoints

- **[P1] Workspace Context** [2h] -- NOT STARTED **(PROMOTED FROM P2)**
  - TODO placeholder at `src/web/context/auth-context.tsx:149`
  - Implement workspace selection state
  - **Dependencies**: None
  - **Critical for**: Proper multi-workspace navigation

---

## SPEC INCONSISTENCIES TO RESOLVE

1. **Token TTL Mismatch** -- RESOLVED
   - `specs/12-authentication.md`: 5 min access / 7 days refresh
   - `specs/17-api-complete.md`: 1 hour access / 30 days refresh
   - **Resolution**: Use 5 min/7 days per auth spec (more secure), update `specs/17-api-complete.md` line 51-52
   - **Action needed**: Update API spec to match auth spec

2. **README Deferral Labels** -- INFORMATIONAL
   - `specs/README.md` correctly defers billing to Phase 5 and accessibility to Phase 3+
   - Update when specs are written

---

## SUMMARY: CRITICAL PATH TO ITERATION 1

**Iteration 1 Definition**: User can sign up, create workspace/project, upload files with chunked/resumable support, see processing produce thumbnails, browse files in grid/list view, navigate folder tree, view images.

### Critical Path (Minimum for Iteration 1):

| Week | Track A (Backend) | Track B (Frontend) |
|------|-------------------|-------------------|
| 1 | Upload Backend Handler [4h] | - |
| 1-2 | BullMQ Setup + Worker [6h] | Chunked Upload Client [1d] |
| 2 | Thumbnail Generation (images) [4h] | Drag-and-Drop UI [4h] |
| 2-3 | Download/Thumbnail Endpoints [4h] | Asset Browser Grid [4h] |
| 3 | - | Folder Navigation [4h] |
| 3 | - | Basic Image Viewer [4h] |

**Total: ~10-12 days** (can be parallelized across 2 developers)

### Hard Dependencies (Cannot Parallelize):

1. **BullMQ Setup** → **Worker Process** → **Processing Jobs**
2. **Upload Backend** → **Upload Client** (need API contract)
3. **Thumbnail Generation** → **Asset Browser Grid** (need thumbnails)
4. **Worker Process** → **Image Viewer** (need proxy for RAW/Adobe)

### Can Be Deferred from Iteration 1:

- Video processing (thumbnails, proxies) - Images first
- Filmstrip generation - Nice-to-have
- HLS streaming - Defer until video viewer
- Waveform extraction - Audio-only
- Real-time WebSocket - Polling acceptable for MVP
- Comments/Annotations - Phase 2
- Search - Phase 2
- Guest/Reviewer flows - Users can authenticate

### Post-Iteration 1 Priorities:

4. **2.4 Asset Operations** [2d]
5. **2.6-2.8b Viewers** [11d total]
6. **2.9 Comments** [4d]
7. **2.10 Metadata** [3d]
8. **2.11 Notifications** [3d]
9. **2.12 Search** [2d]
10. **2.5 Version Stacks** [2d]

---

## CHANGE LOG

### 2026-02-16 Iteration 1 Progress Update

**Completed Work:**
1. **Upload Backend Handler COMPLETED** - Wired to storage module with actual pre-signed URLs
2. **Storage quota validation** added to file upload endpoint
3. **File download endpoint** added: `GET /v4/projects/:projectId/files/:id/download`
4. **Multipart/chunked upload endpoints** added for large file support:
   - `POST /v4/projects/:projectId/files/:id/multipart`
   - `GET /v4/projects/:projectId/files/:id/multipart/parts`
   - `POST /v4/projects/:projectId/files/:id/multipart/complete`
   - `DELETE /v4/projects/:projectId/files/:id/multipart`
   - `POST /v4/projects/:projectId/files/:id/confirm`
5. **Test infrastructure fixes**:
   - Added `vitest.setup.ts` for environment variables
   - Fixed missing imports (`accountMemberships`, `ValidationError`)
6. **Tag v0.0.12 created**

**API Endpoints Added:** 6 new endpoints (33 → 39, 30% → 35%)

### 2026-02-16 Deep Research Update

This update incorporates comprehensive research findings using 8 parallel Sonnet agents + 1 Opus analysis agent:

**Research Findings:**
1. **Specs Analysis**: Read all 21 spec files - 300+ atomic features across 22 categories
2. **API Coverage**: Verified 33/110+ endpoints (30%) - detailed gap list added
3. **Media Processing**: Confirmed 0% implementation - no BullMQ, no FFmpeg, no workers
4. **Realtime**: Confirmed 0% implementation - no WebSocket server
5. **Database**: Verified 14 tables implemented, 12 missing - added index notes
6. **Web Frontend**: Core pages exist, file management missing, 1 TODO found
7. **Configuration**: 49 env vars verified
8. **Tests**: 19 test files with good coverage

**Priority Adjustments Made:**
- **DEPRIORITIZED**: Guest/Reviewer Flows (P1→P2), Session Limits (P2→P3), Failed Login Tracking (P2→P3), OpenAPI Generation (P2→P3)
- **PROMOTED**: Workspace Context (P2→P1), File Download Endpoints (NEW P1)
- **ADDED**: Technical Metadata JSON Column (P2), Upload Backend Handler clarification

**Key Gap Identified**: The upload endpoint creates a file record but returns a placeholder URL. The actual storage upload handler is missing.

**Spec Inconsistency**: Token TTL mismatch resolved - use auth spec values (5min/7d).

### 2026-02-16 Research Validation Update

This update incorporates comprehensive research findings on current implementation status:

1. **API Coverage**: Verified 31/118 endpoints (26%) - added detailed gap list
2. **Media Processing**: Confirmed 0% implementation - only infrastructure exists
3. **Realtime**: Confirmed 0% implementation - no WebSocket server
4. **Database**: Verified 14 tables implemented, 12 missing - added index and table lists
5. **Web Frontend**: Verified core pages exist but file management missing
6. **Configuration**: Verified 49 env vars, noted WORKOS_COOKIE_PASSWORD gap
7. **Permissions**: Noted missing import bug (already fixed) and validation gap
8. **Authentication**: Listed guest/reviewer flows, session limits, API keys as gaps

### Previous Updates

See end of document for full change history (items 1-39 from previous versions).
