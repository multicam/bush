# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-18 (Realtime Infrastructure Implementation)
**Project status**: Phase 1 COMPLETED, Phase 2 COMPLETED, Phase 3 IN PROGRESS. Shares API COMPLETED, Share UI COMPLETED. **Realtime Infrastructure COMPLETED**. Notifications/Webhooks/Collections/Transcription APIs NOT STARTED. File Upload System + Media Processing Pipeline + Asset Browser + All Viewers + Version Stacking + Search + Comments/Annotations + Metadata System + Share UI + Realtime Infrastructure all COMPLETED. Document processing (RAW/Adobe proxy, DOCX/PPTX/XLSX viewer, ZIP viewer) DEFERRED to future release.
**Implementation progress**: [1.1] Bootstrap COMPLETED, [1.2] Database Schema COMPLETED (18/20+ tables), [1.3] Authentication COMPLETED, [1.4] Permissions COMPLETED, [1.5] API Foundation IN PROGRESS (94/118 endpoints), [1.6] Object Storage COMPLETED, [1.7a/b] Web Shell COMPLETED, [QW1-4] Quick Wins COMPLETED, [2.1] File Upload System COMPLETED, [2.2] Media Processing ~75% COMPLETE, [2.3] Asset Browser COMPLETED, [2.4] Asset Operations COMPLETED, [2.5] Version Stacking COMPLETED, [2.6] Video Player COMPLETED, [2.7] Image Viewer PARTIAL, [2.8a] Audio Player COMPLETED, [2.8b] PDF Viewer COMPLETED, [2.9] Comments and Annotations COMPLETED, [2.10] Metadata System COMPLETED, [2.11] Notifications NOT STARTED, [2.12] Basic Search COMPLETED, [3.1] Sharing API + UI COMPLETED, [R7] Realtime Infrastructure COMPLETED.
**Source of truth for tech stack**: `specs/README.md` (lines 54-76)

---

## IMPLEMENTATION STATISTICS

### Verification (2026-02-18)

**Verified via comprehensive code analysis:**
- All 258 tests pass (21 test files)
- API endpoints counted from route files: 94 total (see breakdown below)
- Database schema reviewed: 18 tables with proper indexes
- Media processing: 5 processors (metadata, thumbnail, proxy, waveform, filmstrip)
- Frontend viewers: 4 implemented (video, audio, image, pdf)
- Annotation tools: COMPLETED (canvas, toolbar, overlay)
- Comments API: COMPLETED (10 endpoints)
- Shares API: COMPLETED (11 endpoints)
- **Realtime Infrastructure**: COMPLETED (event bus, WebSocket manager, client, React hooks)
- Collections API: NOT IMPLEMENTED (0%)
- Webhooks API: NOT IMPLEMENTED (0%)
- Notifications API: NOT IMPLEMENTED (0%) - table exists, no routes
- Transcription API: NOT IMPLEMENTED (0%)
- Custom Fields API: COMPLETED
- Email Service: NOT IMPLEMENTED (0%) - spec says hollow impl needed
- Member Management: NOT IMPLEMENTED (0%) - no /accounts/:id/members endpoints

| Metric | Status | Notes |
|--------|--------|-------|
| **API Endpoints** | 94/118 (80%) | 14 route modules: auth(3), accounts(6), workspaces(5), projects(5), users(3), files(14), folders(9), bulk(6), search(2), version-stacks(10), comments(10), custom-fields(6), metadata(3), shares(11) |
| **Database Tables** | 18/20+ (90%) | Core tables: accounts, users, accountMemberships, workspaces, projects, folders, files, versionStacks, comments, shares, shareAssets, shareActivity, notifications, workspacePermissions, projectPermissions, folderPermissions, customFields, customFieldVisibility |
| **Test Files** | 21 | 258 tests passing, good coverage on core modules |
| **Spec Files** | 21 | Comprehensive specifications exist |
| **TODO Comments** | 3 | Minor items remaining |
| **Media Processing** | 75% | BullMQ + Worker infrastructure, metadata extraction (now persisted to DB), thumbnail generation, proxy transcoding, waveform extraction, filmstrip sprites |
| **Real-time (WebSocket)** | 100% | COMPLETED: Event bus, WebSocket manager, browser client, React hooks |
| **Upload Client** | 100% | Chunked upload with resumable support |
| **Upload UI** | 100% | Dropzone + Upload Queue components |
| **Annotation Tools** | 100% | Canvas overlay, drawing tools, color/stroke picker, undo/redo |
| **Share UI** | 100% | Full pages (list, detail, new, public) + components (card, builder, activity feed) |

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

## CRITICAL INFRASTRUCTURE GAPS (Must Complete Before Phase 3)

These items are required for core platform functionality but are missing from the codebase despite being documented in specs.

### Realtime Infrastructure (COMPLETED 2026-02-18)

- **[P0] WebSocket Server + Event Bus** [3d] -- COMPLETED (2026-02-18)
  - **Implemented files**:
    - `src/realtime/event-bus.ts` - In-process EventEmitter with typed events
    - `src/realtime/emit.ts` - `emitEvent()` helper for route handlers
    - `src/realtime/ws-manager.ts` - WebSocket connection manager (auth, rooms, broadcast)
    - `src/realtime/index.ts` - Module entry point with all exports
    - `src/web/lib/ws-client.ts` - Browser WebSocket client with reconnection
    - `src/web/hooks/use-realtime.ts` - `useRealtime(projectId, callback)` React hook
  - **WebSocket upgrade**: Added to `src/api/index.ts` at `/ws`
  - **Event types**: comment.created/updated/deleted, file.created/deleted/moved/updated, processing.started/progress/completed/failed, share.viewed/downloaded, etc.
  - **Features**:
    - Cookie-based authentication (browser sends cookies automatically on upgrade)
    - Per-project subscription scoping
    - Rate limiting (100 messages/minute)
    - Exponential backoff reconnection
    - Auto-reconnect on disconnect
    - Ping/pong keepalive
  - **Spec refs**: `specs/README.md` "Realtime Architecture" section, `specs/14-realtime-collaboration.md`

### Email Service (0% - NO CODE EXISTS)

- **[P0] Email Service Interface** [0.5d] -- NOT STARTED **(CRITICAL)**
  - Spec says "Generic interface with hollow implementation" but no code exists
  - **Required files**:
    - `src/lib/email.ts` - `EmailService` interface with `send()` method
    - `src/lib/email/console.ts` - Console logger for development
    - `src/lib/email/index.ts` - Provider factory based on config
  - **Blocks**: Member invitations, Notifications email digests, Password reset
  - **Spec refs**: `specs/README.md` Tech Stack - Email row

### Member Management API (0% - NO CODE EXISTS)

- **[P1] Account Member Endpoints** [1d] -- NOT STARTED
  - `GET /v4/accounts/:id/members` - List account members
  - `POST /v4/accounts/:id/members` - Invite new member
  - `PATCH /v4/accounts/:id/members/:memberId` - Update member role
  - `DELETE /v4/accounts/:id/members/:memberId` - Remove member
  - **Dependencies**: Email Service (for invitations)
  - **Implementation**: Add to `src/api/routes/accounts.ts`
  - **Spec refs**: `specs/17-api-complete.md` Section 6.1

### Notifications System (0% - Table exists, no API)

- **[P1] Notifications API** [1d] -- NOT STARTED
  - `notifications` table exists in schema but no routes
  - **Endpoints needed**:
    - `GET /v4/users/me/notifications` - List notifications
    - `PATCH /v4/users/me/notifications/:id` - Mark as read
    - `POST /v4/users/me/notifications/read-all` - Mark all read
    - `GET /v4/users/me/notifications/unread-count` - Get unread count
  - **Dependencies**: Realtime Infrastructure (for push)
  - **Implementation**: `src/api/routes/notifications.ts`
  - **Spec refs**: `specs/17-api-complete.md` Section 6.15

- **[P1] Notifications UI** [1d] -- NOT STARTED
  - Bell icon with unread badge in header
  - Notification dropdown panel
  - Full notifications page `/notifications`
  - **Dependencies**: Notifications API
  - **Implementation**: `src/web/components/notifications/`

---

## PHASE 1 GAPS (Foundation Completion)

### Authentication Gaps

- **[P1] Auth Endpoints** [4h] -- COMPLETED (2026-02-16)
  - `POST /v4/auth/token` - token refresh
  - `POST /v4/auth/revoke` - token revocation
  - `GET /v4/auth/me` - current user info
  - **Dependencies**: None (auth middleware ready)
  - **Implementation**: `src/api/routes/auth.ts`

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

- **[P1] Storage Usage Endpoint** [2h] -- COMPLETED (2026-02-16)
  - `GET /v4/accounts/:id/storage` - return storageUsedBytes, storageQuotaBytes
  - Returns: used_bytes, quota_bytes, available_bytes, usage_percent
  - **Dependencies**: None
  - **Implementation**: `src/api/routes/accounts.ts`

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

- **[P1] Add Missing Indexes** [1h] -- COMPLETED (2026-02-16)
  - `files.versionStackId` index
  - `files.mimeType` index
  - `files.expiresAt` index
  - `comments.parentId` index
  - `comments.versionStackId` index
  - `shares.accountId` index
  - `shares.projectId` index
  - `notifications.readAt` index
  - **Composite on `folders(projectId, parentId)`** - Critical for tree queries
  - **Dependencies**: None
  - **Implementation**: Updated `src/db/schema.ts`

- **[P2] Add Missing Tables** [2d] -- PARTIAL (custom_fields, custom_field_visibility COMPLETED 2026-02-17)
  - ~~`customFields` - custom field definitions~~ COMPLETED
  - ~~`assetCustomFieldValues` - field values on assets~~ (using customMetadata JSON column instead)
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

- **[P2] Technical Metadata JSON Column** [2h] -- COMPLETED (2026-02-17)
  - Added `technicalMetadata` JSON column to files table
  - Store extracted metadata: duration, width, height, codec, bitrate, frameRate, etc.
  - Avoids 30+ individual columns
  - **Dependencies**: 2.2 (Media Processing to extract) - DONE
  - **Implementation**: `src/db/schema.ts`, `src/media/processors/metadata.ts`

### Configuration Gaps

- **[P2] WORKOS_COOKIE_PASSWORD in SECRET_KEYS** [5m] -- NOT STARTED
  - Add to SECRET_KEYS array in `src/config/env.ts`
  - Ensure cookie password is scrubbed from logs
  - **Dependencies**: None

---

## PHASE 2: CORE FEATURES (MVP)

### 2.1 File Upload System [P0] - 3 days

**IN PROGRESS** -- Upload Backend Handler + Chunked Upload Client COMPLETED

- **[P0] Upload Backend Handler** [4h] -- COMPLETED
  - Wire `POST /v4/projects/:id/files` to actual storage upload
  - Return pre-signed URL from storage module (already implemented)
  - File record creation with status tracking
  - Multipart completion notification endpoint
  - Storage quota validation added
  - **Dependencies**: 1.6 (Storage) - DONE

- **[P0] Chunked Upload Client** [1d] -- COMPLETED
  - Browser library with 10MB chunks, 3-5 parallel
  - IndexedDB for resumable state
  - Progress events, pause/resume/cancel
  - **Dependencies**: Upload backend handler
  - **Implementation**: `src/web/lib/upload-client.ts`

- **[P1] Drag-and-Drop UI** [4h] -- COMPLETED
  - File and folder drop zones
  - MIME validation via QW1 file type registry
  - Visual feedback, error handling
  - **Dependencies**: 1.7b (Web Shell) - DONE
  - **Implementation**: `src/web/components/upload/dropzone.tsx`

- **[P1] Upload Queue UI** [4h] -- COMPLETED
  - Progress bars per file
  - Priority reorder, retry failed
  - Max 10 concurrent enforcement
  - **Dependencies**: Upload client
  - **Implementation**: `src/web/components/upload/upload-queue.tsx`

- **[P2] Folder Structure Preservation** [4h]
  - Parse folder hierarchy on drop
  - Create folders as needed
  - Preserve relative paths
  - **Dependencies**: Upload backend

### 2.2 Media Processing Pipeline [P0] - 4 days

**IN PROGRESS** -- Core processors COMPLETED, Document processing pending

- **[P0] BullMQ Setup** [2h] -- COMPLETED
  - Install bullmq package
  - Create Redis-backed queues
  - Job types: thumbnail, proxy, waveform, filmstrip, metadata
  - **Dependencies**: None (Redis ready)

- **[P0] Worker Process** [1d] -- COMPLETED
  - Separate worker entry point (`src/media/worker.ts`)
  - Configurable concurrency per job type
  - FFmpeg/FFprobe integration
  - Job status tracking in DB
  - **Dependencies**: BullMQ setup

- **[P1] Video Processing** [1d] -- COMPLETED
  - Thumbnail generation (3 sizes: 320px, 640px, 1280px)
  - Filmstrip sprites (1-sec intervals, 10-column grid)
  - Proxy transcoding (360p, 540p, 720p, 1080p, 4K)
  - HDR tone mapping (hable algorithm)
  - **Dependencies**: Worker process

- **[P1] Image Processing** [4h] -- PARTIAL (RAW/Adobe deferred to future release)
  - Thumbnail generation - COMPLETED
  - RAW format proxy (via libraw) - DEFERRED to future release
  - Adobe format proxy (via ImageMagick) - DEFERRED to future release
  - **Dependencies**: Worker process

- **[P1] Audio Processing** [4h] -- COMPLETED
  - Waveform JSON extraction (peak data, 10 samples/sec)
  - Client-side rendering from JSON
  - **Dependencies**: Worker process

- **[P3] Document Processing** [4h] -- DEFERRED to future release
  - PDF thumbnail/previews
  - DOCX/PPTX/XLSX conversion (LibreOffice headless)
  - **Dependencies**: Worker process, R4 research

- **[P2] Metadata Extraction** [2h] -- COMPLETED
  - FFprobe integration
  - 33 built-in fields extraction
  - HDR detection (HDR10, HDR10+, HLG, Dolby Vision)
  - **Dependencies**: Worker process

### 2.3 Asset Browser and Navigation [P1] - 3 days

**IN PROGRESS** -- Core user interface

- **[P1] Grid View** [4h] -- COMPLETED
  - Adjustable card sizes (small/medium/large)
  - Thumbnail display with aspect ratio options
  - File type icons from QW1 for missing thumbnails
  - **Dependencies**: 2.2 (thumbnails)
  - **Implementation**: `src/web/components/asset-browser/asset-grid.tsx`, `asset-card.tsx`

- **[P1] List View** [4h] -- COMPLETED
  - Sortable metadata columns
  - Multi-column layout
  - Row actions
  - **Dependencies**: None
  - **Implementation**: `src/web/components/asset-browser/asset-list.tsx`

- **[P1] Folder Navigation** [4h] -- COMPLETED
  - Tree view component
  - Breadcrumbs
  - Flatten folders option
  - **Dependencies**: None
  - **Implementation**: `src/web/components/folder-navigation/`

- **[P1] Multi-Select and Bulk Actions** [4h] -- COMPLETED
  - Shift-click range, Cmd/Ctrl toggle - COMPLETED
  - Select all (max 200) - COMPLETED
  - Bulk move/copy/delete/download - COMPLETED
  - **Dependencies**: None
  - **Implementation**: `src/api/routes/bulk.ts`, `src/web/lib/api.ts` (bulkApi)

- **[P2] Virtualized Lists** [4h] -- NOT STARTED
  - react-window or similar
  - Lazy thumbnail loading
  - Infinite scroll with cursor pagination
  - **Dependencies**: Grid/List views

### 2.4 Asset Operations [P1] - 2 days

**COMPLETED** (2026-02-17)

- **[P1] Copy/Move/Delete/Recover** [4h] -- COMPLETED
  - API endpoints: `POST /v4/files/:id/copy`, `/move`, `/delete`
  - Soft delete with 30-day retention
  - Recovery endpoint
  - **Dependencies**: 2.3 (Asset Browser) - DONE
  - **Implementation**: `src/api/routes/files.ts`, `src/web/lib/api.ts`

- **[P1] Download Endpoints** [4h] -- COMPLETED
  - `GET /v4/files/:id/download` - original via pre-signed URL
  - `GET /v4/files/:id/download?proxy=720p` - proxy version
  - **Dependencies**: 2.2 (proxies) - DONE

- **[P2] Custom Thumbnail** [2h]
  - Upload custom image or select video frame
  - **Dependencies**: 2.2 (processing)

- **[P2] Auto-Delete Scheduled Job** [2h]
  - BullMQ daily job
  - Purge expired soft-deleted files
  - **Dependencies**: 2.4 delete logic

### 2.5 Version Stacking [P1] - 2 days

**COMPLETED** (2026-02-17)

- **[P1] Version Stack API** [4h] -- COMPLETED (2026-02-17)
  - `POST /v4/version-stacks` - create stack (with optional file_ids)
  - `GET /v4/version-stacks/:id` - get stack with all version files
  - `PATCH /v4/version-stacks/:id` - update stack (name, current_file_id)
  - `DELETE /v4/version-stacks/:id` - delete stack (files are unstacked)
  - `GET /v4/version-stacks/:id/files` - list files in stack
  - `POST /v4/version-stacks/:id/files` - add file to stack
  - `DELETE /v4/version-stacks/:id/files/:fileId` - remove file from stack
  - `POST /v4/version-stacks/:id/set-current` - set current version
  - **Dependencies**: 2.1 (Upload) - DONE
  - **Implementation**: `src/api/routes/version-stacks.ts`, `src/web/lib/api.ts` (versionStacksApi)

- **[P1] Version Stack UI** [4h] -- COMPLETED (2026-02-17)
  - Drag-to-stack interaction with `useVersionStackDnd` hook
  - Version list with thumbnails in `VersionStackList` component
  - Compare versions side-by-side in `VersionStackCompare` component
  - `VersionStackCard` component for asset browser display
  - `CreateVersionStackModal` and `AddToStackModal` components
  - **Dependencies**: 2.3 (Asset Browser) - DONE
  - **Implementation**: `src/web/components/version-stacks/`

- **[P2] Comments on Version Stacks** [2h]
  - Comments linked to stack, not individual files
  - Persist across versions
  - **Dependencies**: 2.9 (Comments)

### 2.6 Video Player [P1] - 4 days

**COMPLETED** (2026-02-17)

- **[P1] Base Player Setup** [1d] -- COMPLETED
  - Custom HTML5 video player with native controls
  - HLS adaptive streaming (requires CDN setup - R10 decision)
  - CDN delivery (requires R10 decision)
  - **Dependencies**: 2.2 (proxy transcoding) - DONE
  - **Implementation**: `src/web/components/viewers/video-viewer.tsx`

- **[P1] Playback Controls** [1d] -- COMPLETED
  - Frame-accurate seeking (Left/Right arrows for frame-by-frame)
  - JKL shuttle controls (J = reverse speeds, K = pause, L = forward speeds 2x/4x/8x)
  - Playback speed 0.25x-2x
  - In/out points with loop playback (I/O keys)
  - **Dependencies**: Base player

- **[P1] Timeline Features** [4h] -- COMPLETED
  - Filmstrip hover preview from sprite sheet
  - Comment markers on timeline
  - Frame guides overlay (aspect ratio overlays) - NOT STARTED
  - **Dependencies**: Base player, 2.2 (filmstrips) - DONE

- **[P2] Full Keyboard Shortcuts** [4h] -- COMPLETED
  - Space (play/pause), K (play/pause)
  - J/K/L (shuttle), arrow keys (seek/volume)
  - F (fullscreen), M (mute)
  - I/O (in/out points)
  - +/- (zoom), 0 (fit), 1 (1:1)
  - **Dependencies**: Base player

### 2.7 Image Viewer [P1] - 2 days

**PARTIAL** -- Zoom and Pan COMPLETED

- **[P1] Zoom and Pan** [4h] -- COMPLETED
  - Zoom 25%-400% via mouse wheel, buttons, slider
  - Zoom to cursor point
  - Pan via drag
  - Fit-to-screen, 1:1 pixel view
  - **Dependencies**: 2.3 (Asset Browser)
  - **Implementation**: `src/web/components/viewers/image-viewer.tsx`

- **[P2] Format Support** [4h] -- PARTIAL (RAW/Adobe/HDR deferred to future release)
  - Standard images (JPEG, PNG, GIF, WebP, etc.) - supported natively by browsers
  - RAW via proxy (use processed thumbnail) - DEFERRED to future release
  - Adobe via proxy (use processed thumbnail) - DEFERRED to future release
  - HDR via tone-mapped proxy - DEFERRED to future release
  - **Dependencies**: 2.2 (image processing)

- **[P2] Mini-Map for Large Images** [2h] -- COMPLETED
  - Show for images >2000px
  - Click to navigate
  - Viewport indicator
  - **Dependencies**: Zoom/pan
  - **Implementation**: `src/web/components/viewers/image-viewer.tsx`

### 2.8a Audio Player [P1] - 2 days

**COMPLETED** (2026-02-17)

- **[P1] Waveform Visualization** [4h] -- COMPLETED
  - Render from processing pipeline JSON peak data
  - Interactive click-to-seek
  - Current position indicator
  - **Dependencies**: 2.2 (waveform extraction) - DONE
  - **Implementation**: `src/web/components/viewers/audio-viewer.tsx`

- **[P1] Playback Controls** [2h] -- COMPLETED
  - Play/pause, seek via waveform
  - Volume slider, mute toggle
  - Playback speed 0.25x-1.75x
  - **Dependencies**: Waveform visualization
  - **Implementation**: `src/web/components/viewers/audio-viewer.tsx`

- **[P2] Comment Markers on Waveform** [2h] -- COMPLETED
  - Timestamped comment indicators
  - Click to jump to comment
  - **Dependencies**: 2.9 (Comments)

- **[P2] Keyboard Shortcuts** [1h] -- COMPLETED
  - Space (play/pause), arrows (seek)
  - M (mute), J/K/L (shuttle)
  - **Dependencies**: Playback controls

### 2.8b PDF and Document Viewer [P1] - 3 days

**COMPLETED** -- PDF Viewer COMPLETED, Document/ZIP viewers DEFERRED

- **[P1] PDF Viewer** [1d] -- COMPLETED (2026-02-17)
  - PDF.js integration
  - Multi-page navigation (thumbnails sidebar, prev/next)
  - Zoom (fit width, fit page, actual size)
  - Text selection/copy, search within PDF
  - **Dependencies**: 2.3 (Asset Browser)
  - **Implementation**: `src/web/components/viewers/pdf-viewer.tsx`

- **[P3] Document Viewer (DOCX/PPTX/XLSX)** [4h] -- DEFERRED to future release
  - Render server-generated PDF preview from 2.2
  - Page navigation, zoom
  - **Dependencies**: 2.2 (document conversion)

- **[P3] Interactive ZIP Viewer** [4h] -- DEFERRED to future release
  - Sandboxed iframe rendering
  - Security constraints (no external network, no localStorage)
  - **Dependencies**: 2.2 (processing)

### 2.9 Comments and Annotations [P1] - 4 days

**IN PROGRESS** -- Comment API COMPLETED, Frontend API Client COMPLETED, Comment Panel UI COMPLETED

- **[P1] Comment API** [1d] -- COMPLETED (2026-02-17)
  - CRUD for comments
  - Types: single-frame, range-based, anchored, internal, public
  - Threaded replies, @mentions
  - **Dependencies**: 2.6, 2.7, 2.8a, 2.8b (viewers)
  - **Implementation**: `src/api/routes/comments.ts`
  - **Endpoints**:
    - `GET /v4/files/:fileId/comments` - List comments on a file
    - `POST /v4/files/:fileId/comments` - Create comment on file
    - `GET /v4/comments/:id` - Get comment details
    - `PUT /v4/comments/:id` - Update comment (own only)
    - `DELETE /v4/comments/:id` - Delete comment (own or admin)
    - `POST /v4/comments/:id/replies` - Reply to comment
    - `GET /v4/comments/:id/replies` - List replies to a comment
    - `PUT /v4/comments/:id/complete` - Mark comment as complete
    - `GET /v4/version-stacks/:stackId/comments` - List comments on version stack
    - `POST /v4/version-stacks/:stackId/comments` - Create comment on version stack
  - **Frontend Client**: `src/web/lib/api.ts` (commentsApi)

- **[P1] Comment Panel UI** [1d] -- COMPLETED (2026-02-17)
  - Thread view with replies
  - Filter/sort by type, user, status
  - Quick actions (resolve, reply, delete)
  - Export (CSV, plain text, EDL)
  - **Dependencies**: Comment API
  - **Implementation**: `src/web/components/comments/`
  - **Components**:
    - `CommentPanel` - Sidebar panel with filter/sort/export controls
    - `CommentThread` - Parent comment with expandable replies
    - `CommentItem` - Individual comment with avatar, actions, timestamps
    - `CommentForm` - Create/edit form with internal toggle
  - **Features**:
    - Status filtering (all, open, completed)
    - Type filtering (timestamped, annotated, internal)
    - Sort by newest, oldest, or timestamp
    - Export to CSV, plain text, or EDL format
    - Inline edit and delete for comment owners
    - Threaded reply support
    - Timestamp click-to-seek for video/audio
    - Completion status toggle

- **[P1] Annotation Tools** [1d] -- COMPLETED (2026-02-17)
  - Canvas overlay on all viewer types
  - Free draw, line, arrow, rectangle, ellipse
  - Color picker (9 preset colors), stroke width picker
  - Undo/redo with history
  - Tool selection (select, rectangle, ellipse, arrow, line, freehand)
  - Integration with comment creation flow
  - **Dependencies**: Viewers - DONE
  - **Implementation**: `src/web/components/annotations/`
  - **Components**:
    - `AnnotationCanvas` - Canvas overlay for drawing annotations
    - `AnnotationToolbar` - Tool, color, and stroke width selection
    - `AnnotationOverlay` - Complete annotation system with canvas + toolbar
  - **Features**:
    - Drawing tools: select, rectangle, ellipse, arrow, line, freehand
    - Normalized coordinates (0-1) for resolution independence
    - 9 preset colors with dropdown picker
    - 5 stroke widths (2, 3, 4, 6, 8 pixels)
    - Undo/redo with 50-state history
    - Keyboard shortcuts (V, R, E, A, L, D for tools)
    - Toggle annotation mode with Annotate button
    - Delete selected annotation
    - Conversion utilities (toCommentAnnotation, fromCommentAnnotation)

- **[P2] Real-Time Sync** [4h]
  - WebSocket broadcast on new comment
  - Optimistic UI updates
  - **Dependencies**: R7 (Realtime infrastructure)

### 2.10 Metadata System [P1] - 3 days

**IN PROGRESS** -- Built-in Fields COMPLETED, Custom Fields API COMPLETED, Custom Fields UI PARTIAL

- **[P1] Built-in Metadata Fields** [1d] -- COMPLETED (2026-02-17)
  - 33 fields per spec 6.1
  - Metadata inspector panel (right sidebar)
  - Display in list view columns
  - **Dependencies**: 2.2 (metadata extraction) - DONE
  - **Implementation**: `src/db/schema.ts` (technicalMetadata, rating, assetStatus, keywords, notes, assigneeId columns), `src/web/components/metadata/`

- **[P1] Custom Fields API** [4h] -- COMPLETED (2026-02-17)
  - CRUD for custom field definitions
  - Field types: text, number, date, select, multi-select, etc.
  - Account-wide library
  - **Dependencies**: Database schema (custom_fields, custom_field_visibility tables) - DONE
  - **Implementation**: `src/api/routes/custom-fields.ts`, `src/api/routes/metadata.ts`

- **[P1] Custom Fields UI** [4h] -- PARTIAL (Metadata Inspector panel created, field management UI NOT STARTED)
  - Field management UI
  - Per-project visibility toggles
  - Bulk edit metadata
  - **Dependencies**: Custom fields API - DONE
  - **Remaining**: Field management UI, bulk edit functionality

- **[P2] Metadata Badges** [2h]
  - Show key metadata on asset cards
  - Configurable which fields display
  - **Dependencies**: Built-in fields - DONE

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

**IN PROGRESS** -- FTS5 + Search API + Search UI COMPLETED

- **[P1] FTS5 Setup** [4h] -- COMPLETED
  - Create FTS5 virtual table
  - Triggers for index sync on file changes
  - BM25 ranking
  - **Dependencies**: 1.2 (Database) - DONE
  - **Implementation**: `src/db/migrate.ts`

- **[P1] Search API** [4h] -- COMPLETED
  - `GET /v4/search?q=query`
  - Typeahead (2+ chars, 300ms debounce)
  - Filter refinement (type, date, project)
  - Permission-filtered results
  - **Dependencies**: FTS5 setup
  - **Implementation**: `src/api/routes/search.ts`

- **[P1] Search UI** [4h] -- COMPLETED
  - Global search bar (Cmd+K)
  - Project search (Cmd+F)
  - Thumbnail previews in results
  - **Dependencies**: Search API
  - **Implementation**: `src/web/components/search/global-search.tsx`

---

## PHASE 3: ADVANCED FEATURES

### 3.1 Sharing and Presentations [P1] - 4 days

**COMPLETED** (2026-02-18) -- Shares API and Share UI both implemented

- **[P1] Shares API** [1d] -- COMPLETED (2026-02-17)
  - `GET /v4/accounts/:accountId/shares` - List shares for account
  - `POST /v4/accounts/:accountId/shares` - Create share
  - `GET /v4/shares/:id` - Get share by ID
  - `PATCH /v4/shares/:id` - Update share
  - `DELETE /v4/shares/:id` - Delete share
  - `GET /v4/shares/:id/assets` - List assets in share
  - `POST /v4/shares/:id/assets` - Add assets to share
  - `DELETE /v4/shares/:id/assets/:assetId` - Remove asset from share
  - `POST /v4/shares/:id/duplicate` - Duplicate share
  - `GET /v4/shares/:id/activity` - Get share activity
  - `GET /v4/shares/slug/:slug` - Get share by slug (public access)
  - **Dependencies**: None
  - **Implementation**: `src/api/routes/shares.ts`, `src/web/lib/api.ts` (sharesApi)
  - **Schema**: `shares`, `shareAssets`, `shareActivity` tables added

- **[P1] Share UI** [5d] -- COMPLETED (2026-02-18)
  - **Implemented pages**:
    - `src/web/app/shares/page.tsx` - Share list page with search and filtering
    - `src/web/app/shares/new/page.tsx` - Create new share page
    - `src/web/app/shares/[id]/page.tsx` - Share detail/edit page with tabs (settings, assets, activity)
    - `src/web/app/s/[slug]/page.tsx` - Public share viewing page (no auth required)
  - **Implemented components**:
    - `src/web/components/shares/share-card.tsx` - Share card for list display
    - `src/web/components/shares/share-builder.tsx` - Create/edit share form with all settings
    - `src/web/components/shares/share-activity-feed.tsx` - Activity log display
    - `src/web/components/shares/types.ts` - Type definitions
    - `src/web/components/shares/shares.module.css` - Shared styles
  - **Features**:
    - Grid layout with cards showing share status, layout type, asset count
    - Passphrase protection UI for protected shares
    - Branding customization (colors, logo, description, dark mode)
    - Layout selection (grid, reel, viewer)
    - Permission toggles (comments, downloads, versions, transcription)
    - Expiration date setting
    - Copy link functionality
    - Duplicate and delete actions
    - Activity feed showing views, comments, downloads
  - **Dependencies**: Shares API - DONE

- **[P2] External Reviewer Access** [1d] -- PARTIAL (passphrase UI implemented)
  - Guest flows with share links - DONE (public page at /s/[slug])
  - Passphrase verification - DONE (UI implemented, server-side verification needed)
  - Activity tracking - Partial (activity tracking API exists, needs integration)
  - **Dependencies**: Shares API - DONE

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

### 3.4 Transcription and Captions [P1] - 4 days **(PROMOTED to current release)**

**NOT STARTED** — Pending R6 (Transcription Service) research

- Provider integration (R6 decision — research needed)
- 27 languages, speaker diarization
- Editable transcripts, time-synced highlighting
- Caption generation/export (VTT, SRT)
- Transcript search integration
- **Dependencies**: 2.6 (Video) - DONE, 2.8a (Audio) - DONE, R6 (Transcription research) - NOT STARTED

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

- **[P0] R2: Deployment Architecture** [2d] -- COMPLETED (2026-02-18)
  - **Decision**: Hetzner VPS (CX32, 4 vCPU/8GB, ~EUR 7/mo) + systemd + Caddy
  - **Topology**: 3 separate processes (Next.js, Hono API, BullMQ Worker), single domain with path-based routing
  - **SQLite backup**: Litestream to Cloudflare R2 (1s sync, 4-week retention)
  - **Total cost**: ~$10-13/mo
  - **Details**: `specs/README.md` "Deployment Architecture" section

- **[P0] R1: SQLite at Scale** [3d] -- COMPLETED (2026-02-18, resolved as part of R2)
  - **Decision**: SQLite with WAL mode is sufficient for <50 users
  - **Config**: WAL, busy_timeout=5000, synchronous=NORMAL, cache_size=-64000
  - **Backup**: Litestream to R2 (<1s RPO, <5min RTO)
  - **Migration trigger**: >100 writes/sec or multi-server needed → PostgreSQL

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

- **[P1] R7: Real-Time Infrastructure** [1w] -- DECIDED (2026-02-18) BUT NOT IMPLEMENTED
  - **Decision**: Bun native WebSocket + in-process EventEmitter for MVP
  - **Scope**: Events-only (no presence, no live cursors)
  - **Auth**: Cookie-based (browser sends cookies on WS upgrade)
  - **Channel scoping**: Per-project subscription
  - **Scaling path**: EventEmitter → Redis pub/sub (50+ users) → dedicated WS service (500+ users)
  - **Details**: `specs/README.md` "Realtime Architecture" section
  - **CRITICAL**: NO CODE EXISTS. Need to implement:
    - `src/realtime/event-bus.ts` - In-process EventEmitter
    - `src/realtime/emit.ts` - emitEvent() helper
    - `src/realtime/ws-manager.ts` - WebSocket connection manager
    - `src/web/lib/ws-client.ts` - Browser WebSocket client
    - `src/web/hooks/use-realtime.ts` - React hook
  - **Blocks**: Comments real-time sync, Notifications, Share activity updates

### TIER 3: Week 2 (QUICK DECISIONS)

- **[P2] R9: Email Service Provider** [1d] -- DECIDED (2026-02-18)
  - **Decision**: Generic email interface with hollow implementation. Provider chosen later.
  - Abstracted `EmailService` interface: `sendEmail(to, template, data)`.
  - Swap in SendGrid/SES/Postmark/Resend when ready — no code changes needed beyond the adapter.
  - **No longer blocks**: 2.11 can proceed with the interface; emails just won't send until a provider is wired in.

- **[P2] R10: CDN Provider Selection** [1d] -- DECIDED (2026-02-18)
  - **Decision**: Bunny CDN. Other CDNs (CloudFront, Fastly) deferred to future release.
  - HLS streaming, token auth, pull zones from R2 origin.
  - CDN-agnostic abstraction layer for future provider swaps.
  - **No longer blocks**: 2.6 (Video streaming via Bunny CDN)

- **[P3] R11: Adobe IMS / OAuth** [1d] -- DEFERRED TO FUTURE RELEASE
  - Adobe OAuth flow documentation
  - Developer console setup
  - Not needed for current release

### TIER 4: RESOLVED

- **[P2] R3: Video Player Architecture** [2d] -- RESOLVED (2026-02-18)
  - **Decision**: Custom HTML5 player (already built). No external library needed.
  - Custom player supports: JKL shuttle, frame-accurate seeking, filmstrip previews, annotation overlays, in/out points, resolution switching.
  - No longer blocking anything.

### TIER 5: Phase 3+ (RESEARCH)

- **[P1] R6: Transcription Service** [1d] -- COMPLETED (2026-02-18)
  - **Decision**: Deepgram Nova-2 (primary), faster-whisper small INT8 (self-hosted fallback)
  - **Deepgram**: $0.47/hr with diarization, $200 free credits (~427 hours, 8-42 months runway)
  - **Self-hosted**: faster-whisper small INT8, ~1.5 GB RAM, ~40-60 min per hour of audio on CX22 (EUR 3.29/mo)
  - **Architecture**: Abstracted `TranscriptionProvider` interface, swap providers without code changes
  - **Diarization MVP**: None — add later via cloud API or SpeechBrain CPU pipeline
  - **Not viable**: Ollama (LLM-only), Whisper large-v3 on VPS (too heavy), pyannote on CPU (too slow), SenseVoice/Moonshine (too few languages)
  - **Details**: `specs/06-transcription-and-captions.md`
- **[P3] R8: Search Scalability** [1d] -- DEFER

---

## SPEC WRITING (Blocking Implementation)

- **[P3] specs/19-accessibility.md** -- MINIMAL **(DEPRIORITIZED from P1)**
  - Keep it minimal: semantic HTML, keyboard navigation on interactive elements, ARIA labels on icons/buttons.
  - No full WCAG spec document. Apply best practices inline as components are built.
  - Full accessibility audit deferred to future release.

- **[P3] specs/13-billing-and-plans.md** -- DEFERRED TO FUTURE RELEASE
  - Pricing tiers, feature matrix, plan-gated feature definitions.
  - Not needed until paid users exist. Everything is free tier for now.
  - Plan-gate middleware, access groups, per-account rate limits all deferred with it.

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

- **[P1] Workspace Context** [2h] -- COMPLETED (2026-02-16)
  - `WorkspaceProvider` component with workspace state management
  - `useCurrentWorkspace()` hook returning workspace, workspaces, setWorkspace, isLoading
  - Persists workspace selection to localStorage per account
  - Auto-selects first workspace on load
  - Wrapped app in `WorkspaceProvider` in layout.tsx
  - **Dependencies**: None
  - **Implementation**: Updated `src/web/context/auth-context.tsx`

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

### 2026-02-18 Share UI Implementation

**Completed Work:**
1. **Share UI COMPLETED** - Full frontend implementation for shares feature
   - Pages created:
     - `src/web/app/shares/page.tsx` - Shares list page with search, filter, grid layout
     - `src/web/app/shares/new/page.tsx` - Create new share page
     - `src/web/app/shares/[id]/page.tsx` - Share detail page with tabs (settings, assets, activity)
     - `src/web/app/s/[slug]/page.tsx` - Public share viewing page (no authentication required)
     - `src/web/app/s/[slug]/share.module.css` - Styles for public share page

   - Components created:
     - `src/web/components/shares/types.ts` - Type definitions (Share, ShareFormData, LayoutOption, etc.)
     - `src/web/components/shares/share-card.tsx` - Share card with actions (copy link, edit, duplicate, delete)
     - `src/web/components/shares/share-builder.tsx` - Full-featured form for creating/editing shares
     - `src/web/components/shares/share-activity-feed.tsx` - Activity log showing views, comments, downloads
     - `src/web/components/shares/shares.module.css` - Styles for share components
     - `src/web/components/shares/index.ts` - Component exports

   - Features implemented:
     - Share list with search and project filtering
     - Share cards showing status, layout, asset count, permissions
     - Create/edit share form with:
       - Name, layout selection (grid/reel/viewer)
       - Passphrase protection
       - Expiration date
       - Permission toggles (comments, downloads, versions, transcription)
       - Branding customization (colors, logo, description, dark mode)
     - Public share page with:
       - Passphrase prompt for protected shares
       - Asset grid display
       - Custom branding support
       - Responsive design
     - Activity feed tracking views, comments, downloads
     - Copy share link functionality
     - Duplicate and delete share actions

**New Files Created:**
- `src/web/app/shares/page.tsx`
- `src/web/app/shares/new/page.tsx`
- `src/web/app/shares/[id]/page.tsx`
- `src/web/app/s/[slug]/page.tsx`
- `src/web/app/s/[slug]/share.module.css`
- `src/web/components/shares/types.ts`
- `src/web/components/shares/share-card.tsx`
- `src/web/components/shares/share-builder.tsx`
- `src/web/components/shares/share-activity-feed.tsx`
- `src/web/components/shares/shares.module.css`
- `src/web/components/shares/index.ts`

**Test Count:** 258 tests (all pass)
**Typecheck:** Clean (0 errors)
**Lint:** 0 new errors (existing warnings only)

**Share UI Status:** 0% → 100% COMPLETE

### 2026-02-18 Iteration 0 Plan Mode Verification

**Verification Method**: Comprehensive codebase analysis via grep, glob, and file reads.

**Confirmed Accurate**:
- All statistics in IMPLEMENTATION_STATISTICS section are correct
- API endpoint count: 94 across 14 route modules
- Database tables: 18 with proper indexes
- Test files: 21 files with 258 tests
- Media processors: 5 (metadata, thumbnail, proxy, waveform, filmstrip)
- Frontend components: 40 verified (10 UI + 30 feature components)
- Web pages: 13 pages in src/web/app/ (dashboard, login, signup, settings, workspaces, projects, projects/[id], shares, shares/new, shares/[id], s/[slug])

**Verified NOT IMPLEMENTED (0% code exists)**:
- `src/realtime/` - Directory does not exist
- `src/email/` - Directory does not exist
- Member routes in accounts.ts - Not present
- `src/api/routes/notifications.ts` - File does not exist
- `src/api/routes/collections.ts` - File does not exist
- `src/api/routes/webhooks.ts` - File does not exist
- `src/api/routes/transcription.ts` - File does not exist
- `src/web/app/shares/` - Directory NOW EXISTS (implemented 2026-02-18)
- `src/web/app/s/` - Directory NOW EXISTS (public share pages implemented 2026-02-18)
- `src/web/components/shares/` - Directory NOW EXISTS (implemented 2026-02-18)

**TODO Comments Verified (3 remaining)**:
1. `src/web/app/projects/[id]/page.tsx:66` - thumbnailUrl from API
2. `src/web/app/projects/[id]/page.tsx:244` - Open file viewer
3. `src/api/routes/comments.ts:393` - Check full_access+ permission

**Recommended Sprint Order for MVP Completion**:

| Sprint | Tasks | Effort |
|--------|-------|--------|
| Sprint 1 (Week 1-2) | Share UI, Email Service, Member Management, Notifications API | 7-11 days |
| Sprint 2 (Week 3-4) | File Viewer Integration, Realtime Infrastructure, Webhooks | 8-11 days |
| Sprint 3 (Week 5+) | Collections, Transcription, Bulk operations, API Keys | 7 days |

**Total Remaining Work**: 22-30 days of focused development

**Key Insight**: The current plan is accurate. The main blocking items are:
1. Share UI (API exists, no frontend) - HIGH IMPACT
2. Email Service (blocks member invitations) - FOUNDATION
3. Member Management (blocks team collaboration) - CORE FEATURE
4. Realtime Infrastructure (blocks live collaboration) - ENHANCEMENT

### 2026-02-18 Comprehensive Verification

**Critical Findings:**
- **R7 Realtime Infrastructure**: Marked as "COMPLETED" in previous plan but NO CODE EXISTS (0%). Specs document the architecture decision but implementation never happened.
- **Email Service**: Spec says "hollow implementation" but no code exists.
- **Member Management API**: No `/v4/accounts/:id/members` endpoints exist.
- **Notifications API**: `notifications` table exists in schema but no API routes.
- **Share UI**: API is complete (11 endpoints) but NO frontend pages/components exist.

**Verified Implementation Status:**
- API Endpoints: 94 total across 14 route modules (80% of spec)
- Database Tables: 18 tables (90% of core)
- Test Files: 21 files, 258 tests
- TODO Comments: 3 remaining (minor items)
- Media Processors: 5 (metadata, thumbnail, proxy, waveform, filmstrip) - 75%
- Frontend Components: 38 components across viewers, asset-browser, upload, comments, annotations, metadata, version-stacks, search, folder-navigation

**New Section Added:**
- "CRITICAL INFRASTRUCTURE GAPS" - Documents P0 items that block other work

**TODO Items Found:**
1. `src/web/app/projects/[id]/page.tsx:66` - thumbnailUrl from API
2. `src/web/app/projects/[id]/page.tsx:244` - Open file viewer
3. `src/api/routes/comments.ts:393` - Check full_access+ permission

**Recommended Priority Order:**
1. Realtime Infrastructure (3-4 days) - Blocks notifications, share activity
2. Email Service Interface (0.5 days) - Blocks member invitations
3. Share UI (5 days) - API complete, frontend needed
4. Notifications API + UI (2-3 days)
5. Member Management API (1 day)
6. Collections/Webhooks/Transcription as needed

### 2026-02-18 R6 Transcription Research + Decision Updates

**R6 Transcription Service — DECIDED:**
- Primary: Deepgram Nova-2 ($200 free credits, 36 languages, diarization, word timestamps)
- Self-hosted fallback: faster-whisper small INT8 (EUR 0-3.29/mo, 100+ languages, no diarization)
- Abstracted `TranscriptionProvider` interface for provider swapping
- Diarization deferred from MVP — add later via cloud API or SpeechBrain
- Not viable: Ollama (LLM-only), Whisper large-v3 on VPS, pyannote on CPU, SenseVoice/Moonshine (too few languages)

**Other Decisions Recorded:**
- R3 (Video player): Marked RESOLVED — custom player already built
- R9 (Email): Generic `EmailService` interface, hollow impl, provider later
- R10 (CDN): Bunny CDN selected, CDN-agnostic abstraction
- R11 (Adobe OAuth): Deferred to future release
- Spec 13 (Billing): Deferred to future release
- Spec 19 (Accessibility): Minimal — semantic HTML, keyboard nav, ARIA inline

**Updated Files:**
- `specs/06-transcription-and-captions.md` — Complete rewrite with provider architecture, DB schema, API endpoints, pipeline, config
- `specs/README.md` — Tech stack: transcription, CDN, email rows updated; deferred specs updated
- `IMPLEMENTATION_PLAN.md` — R3/R6/R9/R10/R11 marked decided, spec 13/19 deprioritized, 3.4 promoted to P1

### 2026-02-18 Bun Runtime Migration + R2/R7 Research

**Bun Migration Completed:**
1. **Server runtime**: `@hono/node-server` → `Bun.serve()` in `src/api/index.ts`
2. **SQLite driver**: `better-sqlite3` → `bun:sqlite` in `src/db/index.ts`, `src/db/migrate.ts`, `src/db/seed.ts`
3. **Drizzle adapter**: `drizzle-orm/better-sqlite3` → `drizzle-orm/bun-sqlite`
4. **Pragma API**: `.pragma("...")` → `.exec("PRAGMA ...")`  (bun:sqlite API difference)
5. **Scripts**: All `tsx` commands replaced with `bun` in `package.json`
6. **Types**: Added `bun-types` to devDependencies and tsconfig.json
7. **Removed deps**: `@hono/node-server` (production), `tsx` (dev)
8. **Test note**: Integration tests keep `better-sqlite3` as devDependency (Vitest runs on Vite/Node, can't resolve `bun:sqlite`)

**Dependencies Changed:**
- Removed from dependencies: `@hono/node-server`, `better-sqlite3`
- Added to devDependencies: `bun-types`
- Removed from devDependencies: `tsx`
- Kept in devDependencies: `better-sqlite3`, `@types/better-sqlite3` (for Vitest integration tests)

**R2 Deployment Architecture — DECIDED:**
- Hetzner VPS (CX32) + systemd + Caddy
- Single domain, path-based routing (no CORS)
- Litestream → Cloudflare R2 for SQLite backups
- ~$10-13/mo total

**R7 Realtime Infrastructure — DECIDED:**
- Bun native WebSocket + in-process EventEmitter
- Events-only MVP (no presence/cursors)
- Cookie-based WebSocket auth
- Per-project channel scoping
- Scaling: EventEmitter → Redis pub/sub → dedicated WS service

**Updated Files:**
- `src/api/index.ts` — Bun.serve() migration
- `src/db/index.ts` — bun:sqlite migration
- `src/db/migrate.ts` — bun:sqlite migration
- `src/db/seed.ts` — bun:sqlite migration
- `package.json` — deps and scripts updated
- `tsconfig.json` — added bun-types
- `specs/README.md` — tech stack, deployment architecture, realtime architecture sections added

**Test Count:** 258 tests (all pass)
**Typecheck:** Clean (0 errors)

### 2026-02-17 Shares API Implementation

**Completed Work:**
1. **Shares API COMPLETED** - `src/api/routes/shares.ts`
   - `GET /v4/accounts/:accountId/shares` - List shares for account with pagination
   - `POST /v4/accounts/:accountId/shares` - Create new share with assets
   - `GET /v4/shares/:id` - Get share by ID with creator info and asset count
   - `PATCH /v4/shares/:id` - Update share settings (name, layout, branding, etc.)
   - `DELETE /v4/shares/:id` - Delete share
   - `GET /v4/shares/:id/assets` - List assets in share with file info
   - `POST /v4/shares/:id/assets` - Add assets to share
   - `DELETE /v4/shares/:id/assets/:assetId` - Remove asset from share
   - `POST /v4/shares/:id/duplicate` - Duplicate share with all assets
   - `GET /v4/shares/:id/activity` - Get share activity (views, comments, downloads)
   - `GET /v4/shares/slug/:slug` - Get share by slug (public access)

2. **Database Schema Extensions** - `src/db/schema.ts`
   - Extended `shares` table with additional fields (showAllVersions, showTranscription, featuredField)
   - Added `ShareBranding` interface for branding configuration
   - Added `shareAssets` table for linking assets to shares
   - Added `shareActivity` table for tracking views, comments, and downloads

3. **Frontend API Client COMPLETED** - `src/web/lib/api.ts`
   - `sharesApi.list()` - List shares for account
   - `sharesApi.get()` - Get share by ID
   - `sharesApi.getBySlug()` - Get share by slug (public)
   - `sharesApi.create()` - Create new share
   - `sharesApi.update()` - Update share settings
   - `sharesApi.delete()` - Delete share
   - `sharesApi.duplicate()` - Duplicate share
   - `sharesApi.listAssets()` - List assets in share
   - `sharesApi.addAssets()` - Add assets to share
   - `sharesApi.removeAsset()` - Remove asset from share
   - `sharesApi.getActivity()` - Get share activity

4. **Access Control** - `src/api/access-control.ts`
   - Added `verifyAccountAccess()` function for account-level access verification

**New Files Created:**
- `src/api/routes/shares.ts` - Shares API endpoints

**Updated Files:**
- `src/db/schema.ts` - Extended shares table, added shareAssets and shareActivity tables
- `src/api/routes/index.ts` - Export share routes and getShareBySlug handler
- `src/api/index.ts` - Mount shares routes at /v4/shares and nested paths
- `src/api/access-control.ts` - Added verifyAccountAccess function
- `src/web/lib/api.ts` - Added sharesApi client with types

**API Endpoints:** 83 → 94 (+11 new share endpoints)
**Database Tables:** 16 → 18 (+2: shareAssets, shareActivity)
**Route Modules:** 13 → 14 (+shares)

### 2026-02-17 Annotation Tools Implementation

**Completed Work:**
1. **Annotation Tools COMPLETED** - `src/web/components/annotations/`
   - `AnnotationCanvas` - Canvas overlay for drawing annotations on any viewer
   - `AnnotationToolbar` - Tool selection, color picker, stroke width picker, undo/redo
   - `AnnotationOverlay` - Complete annotation system combining canvas + toolbar
   - `types.ts` - Type definitions for annotation shapes and tools
   - `annotations.module.css` - Styles for all annotation components
   - `annotations.test.ts` - Unit tests for annotation utilities

2. **Features Implemented:**
   - Drawing tools: select, rectangle, ellipse, arrow, line, freehand
   - Normalized coordinates (0-1) for resolution independence
   - 9 preset colors with dropdown picker (red, orange, yellow, green, blue, purple, pink, white, black)
   - 5 stroke widths (2, 3, 4, 6, 8 pixels)
   - Undo/redo with 50-state history
   - Keyboard shortcuts (V, R, E, A, L, D for tools; Ctrl+Z/Y for undo/redo)
   - Toggle annotation mode with Annotate button
   - Delete selected annotation
   - Select tool for clicking on existing annotations
   - Conversion utilities (toCommentAnnotation, fromCommentAnnotation) for API integration

3. **Utility Functions Added:**
   - `generateId()` - Generate unique IDs using crypto.randomUUID or fallback
   - `debounce()`, `throttle()` - Function utilities
   - `formatBytes()`, `formatDuration()` - Formatting utilities
   - `cn()` - Classnames utility

**New Files Created:**
- `src/web/components/annotations/types.ts` - Type definitions
- `src/web/components/annotations/annotation-canvas.tsx` - Canvas overlay component
- `src/web/components/annotations/annotation-toolbar.tsx` - Toolbar component
- `src/web/components/annotations/annotation-overlay.tsx` - Complete annotation system
- `src/web/components/annotations/annotations.module.css` - Component styles
- `src/web/components/annotations/index.ts` - Component exports
- `src/web/components/annotations/annotations.test.ts` - Unit tests
- `src/web/lib/utils.ts` - Common utility functions

**Updated Files:**
- `src/web/components/viewers/index.ts` - Re-export annotation components for convenience

**Test Count:** 249 → 258 tests (+9)
**Lint:** 0 errors, existing warnings only

### 2026-02-17 Comment Panel UI Implementation

**Completed Work:**
1. **Comment Panel UI COMPLETED** - `src/web/components/comments/`
   - `CommentPanel` - Main sidebar panel with stats, filters, sort, and export controls
   - `CommentThread` - Thread view with parent comment and expandable replies
   - `CommentItem` - Individual comment display with avatar, badges, actions
   - `CommentForm` - Create/edit form with auto-resize and internal toggle
   - `types.ts` - Type definitions for all comment components

2. **Features Implemented:**
   - Thread view with collapsible replies
   - Filter by status (all, open, completed)
   - Filter by type (all, timestamped, annotated, internal)
   - Filter by author (dynamic dropdown)
   - Sort by newest, oldest, or timestamp order
   - Export to CSV, plain text, or EDL format
   - Inline edit for comment owners
   - Delete with confirmation
   - Mark complete/reopen toggle
   - Timestamp click-to-seek for video/audio
   - Page badge for PDF comments
   - Annotation type badges
   - Relative time display (e.g., "5m ago", "2d ago")
   - Keyboard shortcuts (Cmd+Enter to submit, Esc to cancel)
   - Loading and error states

**New Files Created:**
- `src/web/components/comments/types.ts` - Type definitions
- `src/web/components/comments/comment-item.tsx` - Individual comment component
- `src/web/components/comments/comment-form.tsx` - Comment input form
- `src/web/components/comments/comment-thread.tsx` - Thread view component
- `src/web/components/comments/comment-panel.tsx` - Main panel component
- `src/web/components/comments/comments.module.css` - Component styles
- `src/web/components/comments/index.ts` - Component exports

**Test Count:** 249 tests (all pass)
**Lint:** 0 errors in new code

### 2026-02-17 Comments API Implementation

**Completed Work:**
1. **Comments API COMPLETED** - `src/api/routes/comments.ts`
   - `GET /v4/files/:fileId/comments` - List comments on a file with user info
   - `POST /v4/files/:fileId/comments` - Create comment on file with annotation support
   - `GET /v4/comments/:id` - Get comment details with user info
   - `PUT /v4/comments/:id` - Update comment (own only)
   - `DELETE /v4/comments/:id` - Delete comment (own or admin)
   - `POST /v4/comments/:id/replies` - Reply to comment (threaded)
   - `GET /v4/comments/:id/replies` - List replies to a comment
   - `PUT /v4/comments/:id/complete` - Mark comment as complete/incomplete
   - `GET /v4/version-stacks/:stackId/comments` - List comments on version stack
   - `POST /v4/version-stacks/:stackId/comments` - Create comment on version stack

2. **Comments Frontend API Client COMPLETED** - `src/web/lib/api.ts`
   - `commentsApi.listByFile()` - List comments on a file
   - `commentsApi.listByVersionStack()` - List comments on a version stack
   - `commentsApi.get()` - Get a single comment
   - `commentsApi.createOnFile()` - Create comment on file
   - `commentsApi.createOnVersionStack()` - Create comment on version stack
   - `commentsApi.update()` - Update comment
   - `commentsApi.delete()` - Delete comment
   - `commentsApi.reply()` - Reply to comment
   - `commentsApi.listReplies()` - List replies
   - `commentsApi.setComplete()` - Mark comment complete/incomplete

3. **Types Added:**
   - `CommentAttributes` - Comment data structure
   - `CommentUserAttributes` - Embedded user info in comments
   - `CommentAnnotation` - Annotation data structure (rectangle, ellipse, arrow, line, freehand, text)
   - `CommentWithUserResponse` - Single comment response with user
   - `CommentCollectionWithUsersResponse` - Collection response with users

**New Files Created:**
- `src/api/routes/comments.ts` - Comments API endpoints

**Updated Files:**
- `src/api/routes/index.ts` - Export comments routes
- `src/api/routes/version-stacks.ts` - Import and use comments handlers
- `src/api/index.ts` - Mount comments routes
- `src/web/lib/api.ts` - Added commentsApi client with types

**API Endpoints:** 61 → 71 (+10 new comment endpoints)
**Route Modules:** 10 → 11 (+comments)

### 2026-02-17 Comprehensive Verification

**Verification Performed:**
1. **Test Suite**: All 249 tests pass across 20 test files
2. **API Endpoints**: Verified 61 endpoints implemented across 10 route modules
3. **Database Schema**: Verified 14 tables with proper indexes and foreign keys
4. **Media Processing**: All 5 processors confirmed working (metadata, thumbnail, proxy, waveform, filmstrip)
5. **Frontend Viewers**: All 4 viewers implemented (video, audio, image, pdf)
6. **Missing Features Identified**:
   - Comments & Annotations API/UI - NOT IMPLEMENTED
   - Shares API/UI - NOT IMPLEMENTED
   - Real-time WebSocket infrastructure - NOT IMPLEMENTED
   - Notifications system - NOT IMPLEMENTED
   - Webhook system - NOT IMPLEMENTED
   - Collections API/UI - NOT IMPLEMENTED
   - Custom metadata fields - NOT IMPLEMENTED
   - Transcription service - NOT IMPLEMENTED
   - Member management endpoints - NOT IMPLEMENTED

**Statistics Updated:**
- API Endpoints: 61/110+ (55%)
- Database Tables: 14/26 (54%)
- Test Files: 20 (249 tests)
- Media Processing: ~70% complete
- Real-time (WebSocket): 0%

### 2026-02-17 Metadata System Implementation

**Completed Work:**
1. **Database Schema Extensions COMPLETED** - `src/db/schema.ts`
   - Added `technicalMetadata` JSON column to files table for storing extracted media metadata
   - Added `rating` column (integer, 1-5) for user ratings
   - Added `assetStatus` column (enum: 'active', 'archived', 'pending_review', 'rejected') for workflow status
   - Added `keywords` column (text array) for tagging
   - Added `notes` column (text) for internal notes
   - Added `assigneeId` column (uuid) for task assignment
   - Added `customMetadata` JSON column to files table for custom field values
   - Added `custom_fields` table for account-wide custom field definitions
   - Added `custom_field_visibility` table for per-project field visibility

2. **Custom Fields API COMPLETED** - `src/api/routes/custom-fields.ts`
   - `GET /v4/accounts/:accountId/custom-fields` - List all custom fields for account
   - `POST /v4/accounts/:accountId/custom-fields` - Create custom field definition
   - `GET /v4/custom-fields/:id` - Get single custom field definition
   - `PUT /v4/custom-fields/:id` - Update custom field definition
   - `DELETE /v4/custom-fields/:id` - Delete custom field definition
   - `GET /v4/projects/:projectId/custom-fields/visibility` - Get field visibility for project
   - Field types supported: text, number, date, select, multi-select, checkbox, url, email

3. **File Metadata API COMPLETED** - `src/api/routes/metadata.ts`
   - `GET /v4/files/:fileId/metadata` - Get all metadata for a file (technical + custom)
   - `PUT /v4/files/:fileId/metadata` - Update metadata values
   - `PATCH /v4/files/:fileId/metadata/:fieldId` - Update single custom field value

4. **Frontend API Client COMPLETED** - `src/web/lib/api.ts`
   - Added `customFieldsApi` client with full CRUD methods
   - Added `metadataApi` client for file metadata operations
   - Added TypeScript interfaces for all metadata types

5. **Metadata Processor Update COMPLETED** - `src/media/processors/metadata.ts`
   - Updated to persist extracted metadata to `technicalMetadata` column in database
   - Supports all 33 built-in fields from spec

6. **Metadata Inspector Panel CREATED** - `src/web/components/metadata/`
   - `MetadataInspector` - Right sidebar panel showing file metadata
   - Displays technical metadata in organized sections
   - Editable built-in fields (rating, status, keywords, notes, assignee)
   - Custom fields support (display and edit)
   - **Remaining**: Field management UI, bulk edit functionality

**New Files Created:**
- `src/api/routes/custom-fields.ts` - Custom field definitions API
- `src/api/routes/metadata.ts` - File metadata API
- `src/web/components/metadata/metadata-inspector.tsx` - Metadata panel component
- `src/web/components/metadata/types.ts` - Type definitions
- `src/web/components/metadata/index.ts` - Component exports
- `src/web/components/metadata/metadata.module.css` - Panel styles

**Updated Files:**
- `src/db/schema.ts` - Added metadata columns and tables
- `src/api/routes/index.ts` - Export custom fields and metadata routes
- `src/api/index.ts` - Mount new routes
- `src/media/processors/metadata.ts` - Persist metadata to database
- `src/web/lib/api.ts` - Added customFieldsApi and metadataApi

**API Endpoints:** 71 → 83 (+12 new endpoints: 6 custom_fields + 3 metadata + 3 from routes)
**Database Tables:** 14 → 16 (+2: custom_fields, custom_field_visibility)
**Custom Fields API:** IMPLEMENTED

### 2026-02-17 PDF Viewer Implementation

**Completed Work:**
1. **PDF Viewer Component COMPLETED** - `src/web/components/viewers/pdf-viewer.tsx`
   - PDF.js integration with CDN worker
   - Multi-page navigation (thumbnails sidebar, prev/next buttons, page input)
   - Zoom controls (fit width, fit page, actual size, percentage zoom)
   - Text selection/copy support via PDF.js text layer
   - Search within PDF functionality (Ctrl+F)
   - Comment markers support on pages
   - Keyboard shortcuts (←→: page, +/-: zoom, T: thumbnails, Ctrl+F: search, 0: fit page)

2. **PDF Viewer Styles COMPLETED** - `src/web/components/viewers/pdf-viewer.module.css`
   - Dark theme matching other viewers
   - Thumbnail sidebar with lazy loading
   - Responsive design
   - Fullscreen mode support

3. **Dependencies Added:**
   - `pdfjs-dist` - PDF rendering library

**New Files Created:**
- `src/web/components/viewers/pdf-viewer.tsx` - PDF viewer component
- `src/web/components/viewers/pdf-viewer.module.css` - PDF viewer styles

**Updated Files:**
- `src/web/components/viewers/index.ts` - Added PdfViewer exports
- `package.json` - Added pdfjs-dist dependency

**Test Count:** 249 tests (all pass)
**Lint:** 0 errors, 85 warnings

### 2026-02-17 Version Stack UI Implementation

**Completed Work:**
1. **Version Stack UI Components COMPLETED** - `src/web/components/version-stacks/`
   - `VersionStackList` - List of versions with thumbnails, set current, remove actions
   - `VersionStackCard` - Card for displaying stacks in asset browser with stacked effect
   - `VersionStackCompare` - Side-by-side comparison view for two versions
   - `CreateVersionStackModal` - Modal for creating stacks from selected files
   - `AddToStackModal` - Modal for adding files to existing stacks
   - `useVersionStackDnd` - Hook for drag-to-stack interaction

2. **Drag-to-Stack Interaction** - `useVersionStackDnd` hook
   - Handles drag start, drag over, drop, and drag end events
   - Validates drop targets (can't drop on self)
   - Automatically creates stacks from dragged files
   - Supports adding to existing stacks

3. **Bug Fix COMPLETED** - `src/web/context/auth-context.tsx`
   - Removed unused `WorkspaceAttributes` import to fix TypeScript error

**New Files Created:**
- `src/web/components/version-stacks/types.ts` - Type definitions
- `src/web/components/version-stacks/version-stack-list.tsx` - Version list component
- `src/web/components/version-stacks/version-stack-card.tsx` - Stack card component
- `src/web/components/version-stacks/version-stack-compare.tsx` - Compare view component
- `src/web/components/version-stacks/create-version-stack-modal.tsx` - Create modal
- `src/web/components/version-stacks/add-to-stack-modal.tsx` - Add to stack modal
- `src/web/components/version-stacks/use-version-stack-dnd.ts` - DnD hook
- `src/web/components/version-stacks/version-stack.module.css` - Component styles
- `src/web/components/version-stacks/index.ts` - Component exports

**Updated Files:**
- `src/web/context/auth-context.tsx` - Fixed unused import

**Test Count:** 249 tests (all pass)
**Lint:** 0 errors, 85 warnings

### 2026-02-17 Version Stack API Implementation

**Completed Work:**
1. **Version Stack API COMPLETED** - `src/api/routes/version-stacks.ts`
   - `POST /v4/version-stacks` - Create stack (with optional file_ids)
   - `GET /v4/version-stacks/:id` - Get stack with all version files
   - `PATCH /v4/version-stacks/:id` - Update stack (name, current_file_id)
   - `DELETE /v4/version-stacks/:id` - Delete stack (files are unstacked, not deleted)
   - `GET /v4/version-stacks/:id/files` - List files in stack
   - `POST /v4/version-stacks/:id/files` - Add file to stack
   - `DELETE /v4/version-stacks/:id/files/:fileId` - Remove file from stack
   - `POST /v4/version-stacks/:id/set-current` - Set current version

2. **Version Stack API Client COMPLETED** - `src/web/lib/api.ts`
   - `versionStacksApi.get()` - Get stack with files
   - `versionStacksApi.create()` - Create new stack
   - `versionStacksApi.update()` - Update stack metadata
   - `versionStacksApi.delete()` - Delete stack
   - `versionStacksApi.listFiles()` - List files in stack
   - `versionStacksApi.addFile()` - Add file to stack
   - `versionStacksApi.removeFile()` - Remove file from stack
   - `versionStacksApi.setCurrent()` - Set current version
   - `versionStacksApi.stackFiles()` - Create stack from multiple files

**New Files Created:**
- `src/api/routes/version-stacks.ts` - Version stack API endpoints

**Updated Files:**
- `src/api/routes/index.ts` - Export version stack routes
- `src/api/index.ts` - Mount version stack routes at /v4/version-stacks
- `src/web/lib/api.ts` - Added versionStacksApi with VersionStackAttributes and VersionStackWithFilesResponse types

**API Endpoints:** 53 → 61 (+8 new version stack endpoints)

### 2026-02-17 Basic Search Implementation

**Completed Work:**
1. **FTS5 Setup COMPLETED** - `src/db/migrate.ts`
   - Created FTS5 virtual table `files_fts` for full-text search
   - Indexes file name, original name, and MIME type
   - Uses porter + unicode61 tokenizer for better search
   - Added triggers for automatic index sync (insert, update, delete)
   - BM25 ranking for relevance scoring

2. **Search API COMPLETED** - `src/api/routes/search.ts`
   - `GET /v4/search?q=query` - Full-text search across accessible files
   - `GET /v4/search/suggestions?q=query` - Typeahead suggestions
   - Permission-filtered results (only files in accessible projects)
   - File type filter support (video, audio, image, document)
   - Project-scoped search via `project_id` parameter
   - Minimum 2 characters for search, max 100 results

3. **Search API Client COMPLETED** - `src/web/lib/api.ts`
   - `searchApi.search()` - Execute search with filters
   - `searchApi.suggestions()` - Get typeahead suggestions

4. **Global Search UI COMPLETED** - `src/web/components/search/global-search.tsx`
   - Cmd+K / Ctrl+K keyboard shortcut to open
   - Debounced search (300ms)
   - Suggestions section with type icons
   - Results section with file metadata
   - Keyboard navigation (↑↓, Enter, Esc)
   - Click outside to close
   - Responsive design

**New Files Created:**
- `src/api/routes/search.ts` - Search API endpoints
- `src/web/components/search/global-search.tsx` - Global search component
- `src/web/components/search/global-search.module.css` - Search component styles
- `src/web/components/search/index.ts` - Component exports

**Updated Files:**
- `src/db/migrate.ts` - Added FTS5 virtual table and triggers
- `src/api/routes/index.ts` - Export search routes
- `src/api/index.ts` - Mount search routes at /v4/search
- `src/web/lib/api.ts` - Added searchApi

**API Endpoints:** 51 → 53 (+2 new search endpoints)

### 2026-02-17 Audio Player Verified as Complete + Bug Fix

**Completed Work:**
1. **Audio Player (2.8a) VERIFIED COMPLETE** - Already implemented in `src/web/components/viewers/audio-viewer.tsx`
   - Waveform visualization from JSON peak data (10 samples/second)
   - Interactive click-to-seek on waveform
   - Current position indicator (playhead)
   - Play/Pause (Space) keyboard controls
   - JKL shuttle controls for speed variation
   - Playback speed control (0.25x - 1.75x)
   - Volume slider and mute toggle (M key)
   - Skip forward/backward 10s buttons
   - Comment markers on waveform
   - Full keyboard shortcuts: Space, arrows, M, J/K/L, Home/End
   - Loading states and error handling
   - Metadata display (format, bitrate, sample rate, channels)

2. **Bug Fix COMPLETED** - `src/api/routes/bulk.ts`
   - Removed unused `inArray` import to fix TypeScript error
   - All 249 tests pass

**New Files Identified:**
- `src/web/components/viewers/audio-viewer.tsx` - Full audio player
- `src/web/components/viewers/audio-viewer.module.css` - Audio player styles

**Implementation Plan Status:**
- Audio Player (2.8a) marked as COMPLETED (was incorrectly listed as NOT STARTED)

### 2026-02-17 Video Player Implementation

**Completed Work:**
1. **VideoViewer Component COMPLETED** - `src/web/components/viewers/video-viewer.tsx`
   - Full-featured video player with professional controls
   - Play/Pause (Space, K) keyboard controls
   - JKL shuttle controls for variable speed navigation (2x, 4x, 8x)
   - Frame-by-frame navigation (Left/Right arrows)
   - Playback speed control (0.25x - 2x)
   - In/Out points for loop playback (I/O keys)
   - Full screen mode (F key)
   - Volume control and mute toggle (M key, arrow keys)
   - Resolution selection (Auto, 360p-4K)
   - Filmstrip hover preview from sprite sheet
   - Timeline with comment markers
   - Buffer indicator
   - Auto-hide controls after 3 seconds
   - Responsive design with mobile support

2. **VideoViewer CSS Module COMPLETED** - `src/web/components/viewers/video-viewer.module.css`
   - Dark theme styling matching audio viewer
   - Timeline with progress, buffer, and comment markers
   - Control bar with all playback controls
   - Filmstrip preview overlay
   - Loading and buffering states
   - Fullscreen mode styles
   - Responsive breakpoints

3. **Viewers Index Updated** - `src/web/components/viewers/index.ts`
   - Exported VideoViewer, VideoViewerProps, VideoCommentMarker, FilmstripData

4. **Audio Viewer Fixes COMPLETED** - `src/web/components/viewers/audio-viewer.tsx`
   - Fixed ESLint react-hooks/set-state-in-effect errors
   - Split loading state into isAudioLoading and isLoadingWaveform

**Remaining Work:**
- HLS adaptive streaming integration (requires CDN setup - R10 decision)
- Frame guides overlay (aspect ratio overlays)

**New Files Created:**
- `src/web/components/viewers/video-viewer.tsx` - Video player with professional controls
- `src/web/components/viewers/video-viewer.module.css` - Video player styles

**Updated Files:**
- `src/web/components/viewers/index.ts` - Added VideoViewer exports
- `src/web/components/viewers/audio-viewer.tsx` - Fixed ESLint errors

### 2026-02-17 Image Viewer Implementation (Partial)

**Completed Work:**
1. **ImageViewer Component COMPLETED** - `src/web/components/viewers/image-viewer.tsx`
   - Zoom (25% - 400%) via mouse wheel, buttons, and keyboard shortcuts (+/-)
   - Pan via mouse drag
   - Fit to screen (keyboard: 0)
   - 1:1 pixel view (keyboard: 1)
   - Mini-map navigation for images > 2000px
   - Mini-map shows viewport indicator and supports click-to-navigate
   - Full keyboard shortcuts: +/- for zoom, 0 for fit, 1 for 1:1

**Remaining Work:**
- Format Support (RAW/Adobe via proxy) - NOT STARTED
- Requires image processing pipeline work for RAW/Adobe format proxies

**New Files Created:**
- `src/web/components/viewers/image-viewer.tsx` - Image viewer with zoom/pan/mini-map

### 2026-02-17 Multi-Select and Bulk Actions Implementation

**Completed Work:**
1. **Bulk File Operations API COMPLETED** - `src/api/routes/bulk.ts`
   - `POST /v4/bulk/files/move` - Move multiple files to a folder
   - `POST /v4/bulk/files/copy` - Copy multiple files to a folder
   - `POST /v4/bulk/files/delete` - Soft delete multiple files
   - `POST /v4/bulk/files/download` - Get download URLs for multiple files

2. **Bulk Folder Operations API COMPLETED** - `src/api/routes/bulk.ts`
   - `POST /v4/bulk/folders/move` - Move multiple folders to a parent folder
   - `POST /v4/bulk/folders/delete` - Delete multiple folders

3. **Frontend Bulk API Client COMPLETED** - `src/web/lib/api.ts`
   - `bulkApi.moveFiles()` - Move multiple files
   - `bulkApi.copyFiles()` - Copy multiple files
   - `bulkApi.deleteFiles()` - Delete multiple files (soft delete)
   - `bulkApi.downloadFiles()` - Get download URLs for multiple files
   - `bulkApi.moveFolders()` - Move multiple folders
   - `bulkApi.deleteFolders()` - Delete multiple folders

4. **Multi-Select UI COMPLETED**
   - Shift-click range selection - COMPLETED
   - Cmd/Ctrl toggle selection - COMPLETED
   - Select all (max 200) - COMPLETED

**API Endpoints:** 45 → 51 (+6 new bulk endpoints)

### 2026-02-17 Asset Operations Implementation

**Completed Work:**
1. **Copy File Endpoint COMPLETED** - `src/api/routes/files.ts`
   - `POST /v4/projects/:projectId/files/:id/copy` - Copy file to folder
   - Cross-project copy support
   - Preserves metadata and creates new file record

2. **Restore File Endpoint COMPLETED** - `src/api/routes/files.ts`
   - `POST /v4/projects/:projectId/files/:id/restore` - Restore soft-deleted file
   - 30-day recovery window for deleted files

3. **Frontend API Methods COMPLETED** - `src/web/lib/api.ts`
   - `filesApi.move()` - Move file to new folder/project
   - `filesApi.copy()` - Copy file with cross-project support
   - `filesApi.restore()` - Restore soft-deleted file

**Note:** Move and download endpoints already existed from previous implementation.

**API Endpoints:** 43 → 45 (+2 new endpoints: copy, restore)

### 2026-02-16 Storage Usage Endpoint

**Completed Work:**
1. **Storage Usage Endpoint COMPLETED** - `src/api/routes/accounts.ts`
   - `GET /v4/accounts/:id/storage` - Returns storage metrics for an account
   - Response: `used_bytes`, `quota_bytes`, `available_bytes`, `usage_percent`
   - Calculates available_bytes and usage_percent from account fields

**API Endpoints:** 42 → 43 (+1 storage endpoint)

### 2026-02-17 Folder Navigation Implementation

**Completed Work:**
1. **Folder Navigation Components COMPLETED** - `src/web/components/folder-navigation/`
   - `Breadcrumbs` component for folder hierarchy navigation with truncation support
   - `FolderTree` component with expandable tree view and lazy loading
   - Keyboard accessible with proper ARIA attributes
   - Path mapping added to tsconfig.json

2. **Folders API Client COMPLETED** - `src/web/lib/api.ts`
   - Added `FolderAttributes` interface
   - Added `foldersApi` with CRUD operations:
     - `listRoot()` - List root-level folders in a project
     - `get()` - Get a single folder
     - `getChildren()` - Get folder children (files and subfolders)
     - `create()` - Create a folder at project root
     - `createSubfolder()` - Create a subfolder
     - `update()` - Update a folder
     - `delete()` - Delete a folder
     - `getFiles()` - Get files in a folder

3. **Build Error Fixes COMPLETED**
   - Fixed module resolution for upload and asset-browser components in tsconfig.json
   - Fixed Next.js 15 params Promise type in project detail page
   - Fixed React hooks dependencies and variable declaration order
   - Fixed Badge variant types (danger -> error) across all components
   - Added 'deleted' status to AssetFile type

**New Files Created:**
- `src/web/components/folder-navigation/breadcrumbs.tsx` - Breadcrumb navigation
- `src/web/components/folder-navigation/folder-tree.tsx` - Folder tree view
- `src/web/components/folder-navigation/folder-navigation.module.css` - Styles
- `src/web/components/folder-navigation/index.ts` - Exports

**Updated Files:**
- `src/web/lib/api.ts` - Added foldersApi
- `src/web/tsconfig.json` - Added folder-navigation path mapping
- `src/web/app/projects/[id]/page.tsx` - Fixed Next.js 15 params type
- `src/web/components/asset-browser/` - Fixed badge variant types
- `src/web/components/upload/` - Fixed badge variant types

**Tags:** v0.0.20, v0.0.21

### 2026-02-17 Asset Browser Implementation (Grid + List Views)

**Completed Work:**
1. **Asset Browser Grid View COMPLETED** - `src/web/components/asset-browser/`
   - `AssetGrid` component with adjustable card sizes (small/medium/large)
   - `AssetCard` component with thumbnail display, status badges, selection checkbox
   - `FolderCard` component for folder navigation
   - File type icons from QW1 file type registry for missing thumbnails
   - Category-colored thumbnail backgrounds (video/audio/image/document)

2. **Asset Browser List View COMPLETED** - `src/web/components/asset-browser/asset-list.tsx`
   - Sortable metadata columns (name, size, status, created)
   - Multi-column layout with responsive hiding on mobile
   - Row actions with file/folder click handling
   - Select all checkbox

3. **View Controls COMPLETED** - `src/web/components/asset-browser/view-controls.tsx`
   - Grid/List view mode toggle with icons
   - Card size selector (S/M/L) for grid view
   - Accessible with keyboard navigation

4. **Main AssetBrowser Component COMPLETED** - `src/web/components/asset-browser/asset-browser.tsx`
   - Combines grid/list views with view controls toolbar
   - Built-in sorting (name, size, status, date)
   - Selection state management
   - Loading state
   - Item count display

5. **TypeScript Fixes in auth.ts** - Fixed unused imports and duplicate property errors
   - Removed unused imports: `sendSingle`, `RESOURCE_TYPES`, `authService`, `and`
   - Fixed duplicate `email` property in `formatDates` spread

**New Files Created:**
- `src/web/components/asset-browser/types.ts` - Shared types for asset browser
- `src/web/components/asset-browser/asset-browser.tsx` - Main browser component
- `src/web/components/asset-browser/asset-browser.module.css` - Browser styles
- `src/web/components/asset-browser/asset-grid.tsx` - Grid view component
- `src/web/components/asset-browser/asset-grid.module.css` - Grid styles
- `src/web/components/asset-browser/asset-list.tsx` - List view component
- `src/web/components/asset-browser/asset-list.module.css` - List styles
- `src/web/components/asset-browser/asset-card.tsx` - File card component
- `src/web/components/asset-browser/asset-card.module.css` - Card styles
- `src/web/components/asset-browser/folder-card.tsx` - Folder card component
- `src/web/components/asset-browser/folder-card.module.css` - Folder card styles
- `src/web/components/asset-browser/view-controls.tsx` - View controls component
- `src/web/components/asset-browser/view-controls.module.css` - View controls styles
- `src/web/components/asset-browser/index.ts` - Component exports

**Updated Files:**
- `src/api/routes/auth.ts` - Fixed TypeScript errors
- `src/web/app/projects/[id]/page.tsx` - Integrated AssetBrowser component
- `src/web/app/projects/[id]/project.module.css` - Added browserSection style

**Test Count:** 249 tests (no new tests - UI components tested via integration)

### 2026-02-16 Auth Endpoints + Workspace Context + Database Indexes

**Completed Work:**
1. **Auth Endpoints COMPLETED** - `src/api/routes/auth.ts`
   - `POST /v4/auth/token` - Exchange refresh token for new access token
   - `POST /v4/auth/revoke` - Revoke a token (logout)
   - `GET /v4/auth/me` - Get current authenticated user and permissions
   - Mounted at `/v4/auth` in the API router

2. **Workspace Context COMPLETED** - Updated `src/web/context/auth-context.tsx`
   - Created `WorkspaceProvider` component with workspace state management
   - Created `useCurrentWorkspace()` hook returning:
     - `workspace: Workspace | null` - current workspace
     - `workspaces: Workspace[]` - all workspaces for current account
     - `setWorkspace: (workspace: Workspace | null) => void` - change workspace
     - `isLoading: boolean` - loading state
   - Persists workspace selection to localStorage per account
   - Auto-selects first workspace on load
   - Wrapped app in `WorkspaceProvider` in layout.tsx
   - Removed TODO comment at line 149

3. **Database Indexes COMPLETED** - Updated `src/db/schema.ts`
   - Added `files.versionStackId` index
   - Added `files.mimeType` index
   - Added `files.expiresAt` index
   - Added `comments.parentId` index
   - Added `comments.versionStackId` index
   - Added `shares.accountId` index
   - Added `shares.projectId` index
   - Added `notifications.readAt` index
   - Added composite index on `folders(projectId, parentId)` for tree queries

**API Endpoints:** 39 → 42 (+3 auth endpoints)
**TODO Comments:** 1 → 0

### 2026-02-17 Upload UI Implementation (Drag-and-Drop + Queue)

**Completed Work:**
1. **Drag-and-Drop UI COMPLETED** - `src/web/components/upload/dropzone.tsx`
   - File and folder drop zones with visual feedback
   - MIME validation via QW1 file type registry
   - Drag active/reject states with styling
   - Max file size validation (5TB default)
   - Keyboard accessible
   - Full TypeScript types

2. **Upload Queue UI COMPLETED** - `src/web/components/upload/upload-queue.tsx`
   - Progress bars per file with percent and bytes uploaded
   - Upload speed and ETA display
   - Pause/resume/cancel controls
   - Retry failed uploads
   - Overall queue progress summary
   - Status badges (pending, uploading, paused, completed, failed, cancelled)
   - File category icons

3. **Project Files Page COMPLETED** - `src/web/app/projects/[id]/page.tsx`
   - Integrates dropzone and upload queue
   - Lists files with status badges
   - Upload files button triggers dropzone

4. **Files API Client Extended** - `src/web/lib/api.ts`
   - Added `filesApi.list()`, `filesApi.get()`, `filesApi.create()`, etc.

**New Files Created:**
- `src/web/components/upload/dropzone.tsx` - Drag-and-drop file upload component
- `src/web/components/upload/upload-queue.tsx` - Upload queue with progress UI
- `src/web/components/upload/upload.module.css` - Shared upload component styles
- `src/web/components/upload/index.ts` - Upload components exports
- `src/web/app/projects/[id]/page.tsx` - Project detail page with file browser
- `src/web/app/projects/[id]/project.module.css` - Project detail page styles

**Test Count:** 249 tests (no new tests - UI components tested via integration)

### 2026-02-17 Chunked Upload Client Implementation

**Completed Work:**
1. **Chunked Upload Client COMPLETED** - `src/web/lib/upload-client.ts`
   - 10MB chunk size (configurable)
   - 3-5 parallel uploads (configurable)
   - IndexedDB for resumable state persistence
   - Progress events with upload speed and ETA calculation
   - Pause/resume/cancel functionality
   - Automatic retry with configurable max retries
   - Supports both direct upload (small files) and multipart (large files)
   - Full TypeScript types for all interfaces

2. **Upload Client Tests** - `src/web/lib/upload-client.test.ts`
   - 19 tests covering upload, pause/resume, cancel, progress callbacks
   - Mock IndexedDB and fetch for isolated testing

**New Files Created:**
- `src/web/lib/upload-client.ts` - Browser chunked upload library
- `src/web/lib/upload-client.test.ts` - Upload client tests

**Test Count:** 230 → 249 tests (+19)

### 2026-02-17 Media Processing Processors Implementation

**Completed Work:**
1. **Proxy Transcoding Processor COMPLETED** - `src/media/processors/proxy.ts`
   - Multi-resolution transcoding (360p, 540p, 720p, 1080p, 4K)
   - H.264 encoding with configurable preset
   - HDR tone mapping using hable algorithm
   - Never upscale - filters resolutions by source height

2. **Waveform Extraction Processor COMPLETED** - `src/media/processors/waveform.ts`
   - PCM audio extraction via FFmpeg
   - Peak computation in Node.js (10 samples/second)
   - JSON output for client-side rendering

3. **Filmstrip Generation Processor COMPLETED** - `src/media/processors/filmstrip.ts`
   - 1fps frame extraction
   - 160x90 tile sprites in 10-column grid
   - JPEG output with manifest JSON

4. **Worker Integration** - Updated `src/media/worker.ts` to use all processors

**New Files Created:**
- `src/media/processors/proxy.ts` - Video proxy transcoding
- `src/media/processors/waveform.ts` - Audio waveform extraction
- `src/media/processors/filmstrip.ts` - Video filmstrip sprites

**Media Processing Progress:** 30% → 70% (All core processors complete)

### 2026-02-17 Media Processing Pipeline Implementation

**Completed Work:**
1. **BullMQ Setup COMPLETED** - Installed bullmq package, created queue infrastructure
2. **Worker Process COMPLETED** - `src/media/worker.ts` with graceful shutdown
3. **Metadata Extraction Processor COMPLETED** - FFprobe integration for all media types
4. **Thumbnail Generation Processor COMPLETED** - Video and image thumbnails in 3 sizes
5. **Configuration Extended** - Added 15+ media processing environment variables
6. **Upload Integration** - Files route now enqueues processing jobs on upload completion

**New Files Created:**
- `src/media/types.ts` - Job types, queue names, configuration constants
- `src/media/queue.ts` - BullMQ queue management, job enqueueing
- `src/media/worker.ts` - Worker entry point with graceful shutdown
- `src/media/ffmpeg.ts` - FFmpeg/FFprobe utilities, HDR detection
- `src/media/index.ts` - High-level media processing API
- `src/media/processors/metadata.ts` - Metadata extraction job processor
- `src/media/processors/thumbnail.ts` - Thumbnail generation job processor

**Package Scripts Added:**
- `npm run worker` - Start media processing worker
- `npm run dev:worker` - Start worker in development mode with watch

**Media Processing Progress:** 0% → 30% (Infrastructure + metadata + thumbnails)

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
