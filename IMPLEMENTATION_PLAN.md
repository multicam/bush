# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-16
**Project status**: Iteration 0 -- Zero code exists. All items below are NOT STARTED.
**Source of truth for tech stack**: `specs/README.md` (lines 37-58)

---

## TABLE OF CONTENTS

1. [Locked Technology Stack](#locked-technology-stack)
2. [Pre-Implementation: Critical Research](#pre-implementation-critical-research)
3. [Pre-Implementation: Missing Specifications](#pre-implementation-missing-specifications)
4. [Phase 1: Foundation](#phase-1-foundation)
5. [Phase 2: Core Features (MVP)](#phase-2-core-features-mvp)
6. [Phase 3: Advanced Features](#phase-3-advanced-features)
7. [Phase 4: Integrations and Native Apps](#phase-4-integrations-and-native-apps)
8. [Phase 5: Enterprise and Scale](#phase-5-enterprise-and-scale)
9. [Dependency Graph](#dependency-graph)

---

## LOCKED TECHNOLOGY STACK

These choices are final. Any document stating otherwise must be corrected.

| Category | Technology | Notes |
|----------|------------|-------|
| Frontend (Web) | Next.js + TypeScript | SSR, routing, API routes |
| Frontend (Mobile) | Native Swift | iOS/iPadOS/Apple TV -- Phase 2 |
| Desktop Transfer App | Tauri | Phase 2 -- webapp is standard upload path |
| Backend API | Bun + TypeScript | RESTful V4 API, WebSockets, OAuth 2.0 |
| Database | SQLite | Primary relational store (NOT PostgreSQL) |
| Cache / Realtime | Redis | Caching, sessions, rate limiting, pub/sub |
| Search | SQLite FTS5 | Upgrade path to dedicated engine if needed |
| Object Storage | S3-compatible API | Provider-agnostic (AWS S3, R2, MinIO, B2) |
| CDN | TBD (preference: Bunny CDN) | CDN-agnostic abstraction |
| Media Processing | FFmpeg | Transcoding, thumbnails, filmstrips, waveforms |
| Message Queue | BullMQ + Redis | Async jobs: transcoding, transcription, notifications |
| Transcription | TBD (abstracted interface) | 27 languages, speaker ID -- provider chosen later |
| AI/ML (Vision) | TBD | Visual search / Media Intelligence |
| Deployment | TBD | **No Docker, no Kubernetes** (explicit requirement) |
| CI/CD | GitHub Actions | |

---

## PRE-IMPLEMENTATION: CRITICAL RESEARCH

These research items **must be completed before writing any code**. Each produces a written decision document or proof-of-concept that unblocks downstream implementation.

### R1. SQLite at Scale [CRITICAL -- blocks Phase 1]

- **Status**: NOT STARTED
- **Blocks**: Phase 1.1 (Database Schema), and transitively everything else
- **Research questions**:
  - Benchmark SQLite with realistic concurrent read/write workloads (simulate 100, 500, 1000 concurrent users)
  - Determine WAL mode configuration and journal size limits
  - Test database file size behavior at 1GB, 10GB, 50GB, 100GB
  - Evaluate connection pooling strategy for Bun (better-sqlite3 vs bun:sqlite vs Drizzle ORM)
  - Design backup strategy: evaluate Litestream for continuous replication to S3
  - Identify the point at which SQLite becomes a bottleneck and document the migration path (to PostgreSQL or other)
  - Evaluate multi-database strategy (separate SQLite files per account vs single database)
- **Deliverable**: Written decision document with benchmarks, configuration choices, and backup architecture

### R2. Deployment without Containers [CRITICAL -- blocks Phase 1]

- **Status**: NOT STARTED
- **Blocks**: Phase 1.4 (API Foundation), Phase 1.6 (Web App Shell)
- **Research questions**:
  - Evaluate Bun production deployment: process management, crash recovery, graceful shutdown
  - Compare options: systemd services, PM2, Fly.io (non-Docker mode), Render, Railway, bare VPS
  - Determine how to run Next.js + Bun backend on same or separate hosts
  - Plan zero-downtime deployment strategy without containers
  - Evaluate Bun's production stability and runtime maturity
  - Design process supervision for FFmpeg workers (long-running, crash-prone)
- **Deliverable**: Deployment architecture document with chosen approach, provisioning steps, and monitoring plan

### R3. Video Player Architecture [CRITICAL -- blocks Phase 2]

- **Status**: NOT STARTED
- **Blocks**: Phase 2.6 (Video Player)
- **Research questions**:
  - Compare Video.js vs Shaka Player vs fully custom HTML5 player
  - Test frame-accurate seeking across codecs (H.264 GOP structure challenges)
  - Evaluate annotation overlay approaches: Canvas, SVG, or WebGL
  - Test HLS.js integration for adaptive streaming
  - Prototype JKL shuttle controls with sub-frame accuracy
  - Assess performance with 4K and HDR content in browser
- **Deliverable**: Player architecture decision document with prototype demonstrating frame-accurate seeking

### R4. Media Transcoding Pipeline [CRITICAL -- blocks Phase 2]

- **Status**: NOT STARTED
- **Blocks**: Phase 2.2 (Media Processing Pipeline)
- **Research questions**:
  - Benchmark FFmpeg transcoding times: 1GB, 10GB, 100GB files across formats
  - Design worker architecture: single vs distributed BullMQ workers, concurrency limits
  - Test HDR tone mapping quality and performance (zscale + tonemap filters)
  - Evaluate RAW image processing: libraw, dcraw for 15+ camera formats
  - Test Adobe format rendering: ImageMagick for PSD/AI/EPS, server-side for INDD
  - Determine optimal proxy parameters: bitrate targets, CRF values, resolution ladder
  - Plan FFmpeg worker resource management: CPU/memory limits, tmpdir sizing
- **Deliverable**: Processing pipeline design document with benchmarks and FFmpeg parameter matrix

### R5. Large File Upload Strategy [HIGH -- blocks Phase 2]

- **Status**: NOT STARTED
- **Blocks**: Phase 2.1 (File Upload System)
- **Research questions**:
  - Determine optimal chunk size for S3 multipart upload (10MB vs 50MB vs 100MB)
  - Test parallel chunk upload concurrency (3 vs 5 vs 10 concurrent)
  - Evaluate browser IndexedDB for resumable upload state persistence
  - Test 5TB upload end-to-end across realistic network conditions
  - Evaluate tus.io protocol vs custom chunked upload implementation
  - Test S3 multipart upload limits with different providers (AWS S3, R2, B2)
- **Deliverable**: Upload protocol specification with chunk sizes, retry strategy, and provider compatibility matrix

### R6. Transcription Service Selection [HIGH -- blocks Phase 3]

- **Status**: NOT STARTED
- **Blocks**: Phase 3.4 (Transcription and Captions)
- **Research questions**:
  - Compare AWS Transcribe vs Deepgram vs AssemblyAI vs self-hosted Whisper
  - Test 27-language support coverage for each provider
  - Evaluate speaker identification accuracy across providers
  - Calculate cost at scale (1K, 10K, 100K hours of audio per month)
  - Assess latency (real-time vs batch processing)
  - Research Texas/Illinois biometric consent legal requirements for speaker ID
- **Deliverable**: Provider comparison matrix with recommendation and legal compliance plan

### R7. Real-Time Infrastructure [HIGH -- blocks Phase 2]

- **Status**: NOT STARTED
- **Blocks**: Phase 2.9 (Comments), Phase 2.11 (Notifications)
- **Research questions**:
  - Design WebSocket connection management for Bun server
  - Plan horizontal scaling: Redis pub/sub for multi-instance WebSocket broadcast
  - Define optimistic UI update strategy for comments and metadata edits
  - Evaluate connection limits per server instance
  - Plan reconnection and message replay on disconnect
- **Deliverable**: WebSocket protocol specification and scaling architecture document

### R8. Search Scalability [MEDIUM -- blocks Phase 3]

- **Status**: NOT STARTED
- **Blocks**: Phase 3.5 (Enhanced Search)
- **Research questions**:
  - Benchmark SQLite FTS5 with 100K, 1M, 10M indexed documents
  - Test search latency and relevance quality
  - Evaluate upgrade path: Meilisearch, Typesense, or Elasticsearch
  - Determine when FTS5 is no longer sufficient (specific metric thresholds)
- **Deliverable**: FTS5 benchmark report with upgrade trigger criteria

---

## PRE-IMPLEMENTATION: MISSING SPECIFICATIONS

These specification documents must be written before implementing the features they cover. Prioritized by when they block implementation.

### Blocks Phase 1

- **specs/12-authentication.md** [NOT STARTED]
  - SAML/SSO enterprise authentication flows
  - Session duration policies and token expiration times
  - Refresh token rotation policy
  - IP allowlisting, geo-restrictions (enterprise tier)
  - Multi-factor authentication detailed flows
  - Blocked by: nothing (can be written immediately)
  - Blocks: Phase 1.2 (Authentication System)

### Blocks Phase 2

- **specs/15-media-processing.md** [NOT STARTED]
  - Exact FFmpeg transcoding parameters (bitrate targets, CRF values, codec choices per resolution)
  - Processing timeouts and failure handling policies
  - HDR tone mapping parameter specifications
  - Interactive ZIP (HTML) rendering behavior
  - RAW and Adobe format conversion parameters
  - Blocked by: R4 (Media Transcoding Pipeline research)
  - Blocks: Phase 2.2 (Media Processing Pipeline)

- **specs/14-realtime-collaboration.md** [NOT STARTED]
  - WebSocket message protocol specification (event types, payload formats)
  - Concurrent editing conflict resolution strategy
  - Presence indicators (who is currently viewing an asset)
  - Connection lifecycle (auth, heartbeat, reconnect)
  - Blocked by: R7 (Real-Time Infrastructure research)
  - Blocks: Phase 2.9 (Comments), Phase 2.11 (Notifications)

### Blocks Phase 3

- **specs/13-billing-and-plans.md** [NOT STARTED]
  - Detailed pricing structure for each tier
  - Complete plan feature matrix (which features are gated to which plan)
  - "Team+" and "Pro+" tier boundary definitions
  - Storage quota enforcement rules
  - Overage handling and upgrade prompts
  - Blocked by: nothing (can be written immediately)
  - Blocks: Phase 3.7 (Asset Lifecycle), Phase 5.1 (Billing Management)

- **specs/17-api-complete.md** [NOT STARTED]
  - Complete endpoint inventory with request/response examples for every resource
  - Bulk API operation specifications
  - Complete webhook event type enumeration with payloads
  - API versioning strategy beyond "V4 current, V2 deprecated"
  - Error code catalog
  - Blocked by: Phase 1.4 (API Foundation must be designed first)
  - Blocks: Phase 3.6 (Webhooks), Phase 4 (all integrations)

### Blocks Phase 4+

- **specs/16-storage-and-data.md** [NOT STARTED]
  - Data residency requirements (EU regulations, regional storage)
  - Backup and disaster recovery strategy
  - Storage archival tiers (cold storage for inactive projects)
  - Storage Connect detailed protocol for non-AWS providers
  - Blocked by: R1 (SQLite at Scale research)
  - Blocks: Phase 4.1 (Storage Connect)

- **specs/18-mobile-complete.md** [NOT STARTED]
  - Android app decision (build or skip, responsive web fallback)
  - Offline mode specification (what is cached, sync-on-reconnect protocol)
  - Push notification payload specifications
  - Mobile-specific upload constraints and behavior
  - Blocked by: Phase 2 API completion
  - Blocks: Phase 4.3 (iOS App)

- **specs/19-accessibility.md** [NOT STARTED]
  - WCAG compliance level target (AA or AAA)
  - Keyboard navigation specification for all interactive components
  - Screen reader support requirements
  - Color contrast and motion sensitivity requirements
  - Blocked by: nothing (can be written immediately, should inform Phase 1.6)
  - Blocks: nothing directly, but should be referenced throughout all UI work

### Existing Specs Needing Enhancement

- **specs/11-security-features.md** [NEEDS EXPANSION -- currently only 38 lines]
  - Forensic watermarking implementation details
  - Audit log retention, format, and export specification
  - Access Groups detailed specification (referenced but not specified)
  - Organization-wide security policy configuration

---

## PHASE 1: FOUNDATION

**Status**: NOT STARTED
**Blocked by**: R1 (SQLite research), R2 (Deployment research)
**Goal**: Establish all infrastructure, data models, auth, permissions, API, and web shell. Everything else depends on this.

### 1.1 Project Bootstrap [NOT STARTED]

- Initialize monorepo structure (Bun workspace or Turborepo)
- Set up TypeScript configuration (shared tsconfig)
- Configure linting (ESLint + Prettier)
- Set up testing framework (Vitest)
- Configure CI/CD pipeline (GitHub Actions)
- Create development environment setup documentation
- **Depends on**: R2 (Deployment research -- informs project structure)
- **Blocks**: everything

### 1.2 Database Schema and Core Data Models [NOT STARTED]

- Design SQLite schema with proper indexes and foreign keys
- Core models: Account, User, Workspace, Project, Folder, File, VersionStack
- Hierarchy enforcement: Account > Workspace > Project > Folder > File
- Foreign key constraints, check constraints, triggers for cascades
- Choose and configure ORM/query builder (Drizzle ORM or Kysely)
- Create migration system
- Write schema validation tests
- Set up seed data for development
- **Depends on**: R1 (SQLite at Scale research), 1.1 (Project Bootstrap)
- **Blocks**: 1.3, 1.4, 1.5, and transitively all Phase 2+
- **Spec refs**: `specs/00-atomic-features.md` Section 2, `specs/00-complete-support-documentation.md` Section 3.1

### 1.3 User and Authentication System [NOT STARTED]

- Email/password authentication (bcrypt hashing, minimum 8 characters)
- OAuth 2.0 integration: Google Sign-In, Apple ID, Adobe IMS
- Two-factor authentication (TOTP with QR code generation)
- Redis-based session storage with TTL
- JWT access token (1hr) + refresh token (30 days)
- Secure cookie handling (httpOnly, secure, sameSite)
- Account switcher logic (multi-account support)
- Account roles: Owner, Content Admin, Member, Guest, Reviewer
- Authentication integration tests
- **Depends on**: 1.2 (Database Schema), specs/12-authentication.md (MISSING)
- **Blocks**: 1.4, 1.5 (Permission System)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 1.2, 1.3

### 1.4 Permission System [NOT STARTED]

- Five permission levels: Full Access, Edit and Share, Edit, Comment Only, View Only
- Permission models: WorkspacePermission, ProjectPermission, FolderPermission
- Permission inheritance: Workspace > Project > Folder (cannot lower inherited permissions)
- Restricted Project/Folder logic (breaks inheritance chain, invite-only)
- Access Groups for bulk permission management
- Permission check middleware for API routes
- Extensive permission edge-case tests
- **Depends on**: 1.2, 1.3
- **Blocks**: 1.5 (API Foundation -- needs auth/perm middleware), all Phase 2+
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 2.1-2.3, `specs/11-security-features.md`

### 1.5 RESTful API Foundation (V4) [NOT STARTED]

- Set up Bun HTTP server with routing framework (Hono or Elysia)
- OAuth 2.0 authentication middleware
- Rate limiting middleware (Redis-backed leaky bucket algorithm)
- Cursor-based pagination (default 50, max 100 items per page)
- JSON:API-style response format with proper error responses
- CRUD routes for core resources: accounts, workspaces, projects, folders, files, version_stacks, users, comments, shares, custom_fields, webhooks
- OpenAPI spec generation for documentation
- API integration tests
- **Depends on**: 1.2, 1.3, 1.4, R2 (Deployment research)
- **Blocks**: 1.7 (Web App Shell), all Phase 2+
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 21.4-21.5, `specs/00-atomic-features.md` Sections 18.2-18.3

### 1.6 Object Storage Layer [NOT STARTED]

- Implement provider-agnostic storage interface (S3-compatible)
- Choose initial provider (recommendation: Cloudflare R2 for zero egress, or B2 for low cost)
- Pre-signed URL generation (upload and download)
- Multipart upload support
- Storage key structure: `{account_id}/{project_id}/{file_id}/{type}/{filename}`
- Storage quota tracking (atomic increment/decrement on Account model)
- Development storage setup (MinIO or B2 free tier)
- Storage layer tests
- **Depends on**: 1.1 (Project Bootstrap)
- **Blocks**: 2.1 (File Upload), 2.2 (Media Processing)
- **Spec refs**: `specs/00-atomic-features.md` Section 4.2, 14.1

### 1.7 Web Application Shell [NOT STARTED]

- Initialize Next.js 15+ with App Router and TypeScript
- Core pages: login, signup, dashboard, workspaces, projects, settings
- Global navigation: account switcher, workspace sidebar, project list, folder tree, breadcrumbs
- Multi-panel layout: left (folder tree), center (file grid/list), right (metadata inspector), bottom (upload queue) -- all collapsible
- Authentication flows: email/password, OAuth, 2FA, password reset
- State management: React Context (auth, workspace), TanStack Query (server state)
- Responsive design (mobile, tablet, desktop)
- Component tests (Vitest + Testing Library)
- **Depends on**: 1.5 (API), 1.3 (Authentication)
- **Blocks**: all Phase 2 frontend work
- **Spec refs**: `specs/00-atomic-features.md` Section 1.4, 5.3, `specs/03-file-management.md`

---

## PHASE 2: CORE FEATURES (MVP)

**Status**: NOT STARTED
**Blocked by**: Phase 1 completion
**Goal**: Build the minimum viable product -- upload files, view them, comment on them, manage metadata, search, get notifications.

### 2.1 File Upload System [NOT STARTED]

- Web browser drag-and-drop (files and folders)
- MIME type validation (100+ formats: 9 video, 8 audio, 25+ image, 5 document)
- Chunked upload client library (10MB chunks, 3-5 parallel, resumable via IndexedDB)
- Upload queue UI: progress bars, pause/resume, priority reorder, cancel, retry
- Folder structure preservation on drag-and-drop
- Upload constraints: max 10 concurrent uploads, 500 assets per upload, 250 folders, 5TB max file size
- Backend: pre-signed URL generation, file record creation, completion notification, processing job enqueue
- **Depends on**: 1.5 (API), 1.6 (Object Storage), 1.7 (Web Shell), R5 (Large File Upload research)
- **Blocks**: 2.2 (Media Processing), 2.3 (Asset Browser)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 4.1-4.3

### 2.2 Media Processing Pipeline [NOT STARTED]

- Set up BullMQ with Redis for async job processing
- Media processing worker with configurable concurrency (default: 4 workers)
- Thumbnail generation: extract frame at 50% duration, resize to 320x180, 640x360, 1280x720
- Hover scrub filmstrip: 1-second interval frames, sprite sheet generation
- Proxy transcoding: H.264 MP4 at 360p, 540p, 720p, 1080p, 4K (Pro+ only)
- Audio waveform extraction (JSON or PNG)
- Metadata extraction via FFprobe (33 built-in fields)
- HDR detection and SDR tone mapping for proxies
- Job priorities: thumbnail (high), proxy (medium), waveform (low)
- Retry: 3 attempts with exponential backoff
- Processing status tracking: uploading > processing > ready / processing_failed
- WebSocket progress updates to frontend
- **Depends on**: 2.1 (Upload), 1.6 (Object Storage), R4 (Media Transcoding research), specs/15-media-processing.md (MISSING)
- **Blocks**: 2.3 (Asset Browser -- needs thumbnails), 2.6 (Video Player -- needs proxies)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.4, `specs/00-atomic-features.md` Section 6.1

### 2.3 Asset Browser and Navigation [NOT STARTED]

- Grid view with adjustable card size (small 160px, medium 240px, large 320px)
- List view with sortable metadata columns
- Thumbnail display options: aspect ratio (16:9, 1:1, 9:16), fit vs fill
- Flatten folders view (show all nested assets in flat list)
- Sorting by any metadata field (ascending/descending, multi-level)
- Drag-and-drop: move files to folder, copy with Cmd/Ctrl, reorder in custom sort
- Multi-select (max 200): shift-click range, cmd/ctrl-click toggle, select all
- Bulk actions: move, copy, delete, download, edit metadata
- Performance: virtualized lists (react-window or similar), lazy loading thumbnails
- **Depends on**: 1.5 (API), 2.1 (Upload), 2.2 (Processing -- for thumbnails), 1.4 (Permissions)
- **Blocks**: 2.4 (Asset Operations), 2.5 (Version Stacking), 2.6-2.8 (Viewers)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 4.2, 6.4

### 2.4 Asset Operations [NOT STARTED]

- Copy To: duplicate asset to another folder/project (preserves metadata)
- Move To: relocate asset (permission check on source and destination)
- Delete: soft-delete to Recently Deleted (30-day retention)
- Recover: restore from Recently Deleted to original location
- Permanent Delete: after 30 days or manual (Owner/Admin only)
- Download Original: generate pre-signed S3 download URL (1hr expiry)
- Download Proxy: select resolution for proxy download
- Custom Thumbnail: upload image or select frame from video
- Auto-delete scheduled job (BullMQ, daily)
- **Depends on**: 2.3 (Asset Browser), 1.4 (Permissions), 1.6 (Object Storage)
- **Blocks**: nothing critical (enhances existing features)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.6

### 2.5 Version Stacking [NOT STARTED]

- VersionStack model linking multiple File records
- Drag-new-file-onto-existing-asset to create version
- Automatic version numbering (v1, v2, v3...)
- Version list UI (expand stack to see all versions)
- Set version as current
- Compare versions (opens comparison viewer)
- Comments persist across all versions in stack (linked to stack, not file)
- Download specific version
- Delete version (admin permission required)
- **Depends on**: 2.1 (Upload), 2.3 (Asset Browser)
- **Blocks**: 3.3 (Comparison Viewer)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.5

### 2.6 Video Player [NOT STARTED]

- Base player setup (Video.js or chosen alternative per R3 research)
- Frame-accurate seeking (GOP-aware)
- JKL shuttle controls: J reverse (2x/4x/8x), K pause, L forward (2x/4x/8x)
- Playback speed: 0.25x to 1.75x
- In/out point marking (I/O keys), range playback
- HLS adaptive streaming with auto and manual quality selection (360p-4K)
- Frame guides / aspect ratio overlays (16:9, 4:3, 1:1, 9:16, 2.39:1, custom)
- Timeline: frame-accurate hover preview from filmstrip, zoom, comment markers
- Loop playback toggle
- Full keyboard shortcut suite (Space, K, J, L, arrows, M, F, I, O, Esc)
- **Depends on**: 2.3 (Asset Browser), 2.2 (Processing -- proxies/filmstrips), R3 (Video Player research)
- **Blocks**: 2.9 (Comments -- annotation overlay on player), 3.3 (Comparison Viewer)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 9.1-9.4

### 2.7 Image Viewer [NOT STARTED]

- Zoom: 25% to 400%, mouse wheel, +/- buttons, slider
- Zoom to cursor position
- Pan with drag when zoomed
- Fit to screen (default), 1:1 pixel view
- Mini-map for large images (>2000px) with viewport highlight
- Format support: standard (JPG, PNG, GIF, WebP, BMP, TIFF), RAW (via proxy), Adobe (PSD, AI, EPS via proxy), HDR (EXR via tone-mapped proxy)
- **Depends on**: 2.3 (Asset Browser), 2.2 (Processing -- image proxies)
- **Blocks**: 2.9 (Comments -- annotation overlay on images)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 9.5

### 2.8 PDF Viewer [NOT STARTED]

- PDF.js integration for rendering
- Multi-page navigation: page thumbnails sidebar, prev/next buttons, page jump, keyboard nav
- Zoom: in/out, slider, fit width, fit page, actual size, mouse wheel
- Text selection and copy
- Search within PDF
- Page rotation (90-degree increments)
- **Depends on**: 2.3 (Asset Browser), 2.2 (Processing)
- **Blocks**: 2.9 (Comments -- page-stamped comments on PDFs)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 9.6

### 2.9 Comments and Annotations [NOT STARTED]

- Comment types: single-frame (timestamped), range-based (in/out), anchored (XY position), internal (members-only), public
- Comments linked to VersionStack (persist across versions)
- Threaded replies (parent_comment_id)
- Comment body: markdown, emoji reactions, @mentions (trigger notifications), hashtags, color hex auto-rendering
- Attachments: up to 6 files per comment (Pro+ plan)
- Annotation tools: free draw, line, arrow, rectangle with color picker and configurable brush size
- HTML5 Canvas overlay on player/image/PDF viewer
- Annotation data stored as SVG paths or Canvas commands (JSON)
- Comment panel: thread view, filter by user/hashtag/status/type, sort by date/timestamp
- Quick actions: reply, edit, delete, mark complete, copy permalink
- Comment export: CSV, plain text, EDL (CMX 3600 for NLE import)
- Real-time sync via WebSocket (new comments, replies, edits, deletes)
- Optimistic UI updates
- **Depends on**: 2.6 (Video Player), 2.7 (Image Viewer), 2.8 (PDF Viewer), 1.4 (Permissions), R7 (Real-Time research), specs/14-realtime-collaboration.md (MISSING)
- **Blocks**: 2.11 (Notifications -- @mentions trigger notifications), 3.1 (Sharing)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 8.1-8.6

### 2.10 Metadata System [NOT STARTED]

- 33 built-in metadata fields (technical/read-only from FFprobe, file info, collaboration fields)
- 10 custom field types: text, textarea, number, date, single-select, multi-select, checkbox, user reference, URL, rating
- Account-wide custom field library (define once, use across projects)
- Per-project field visibility toggles
- Field permissions: "Admins Only" vs "Admins and Full Access"
- Metadata inspector panel (right sidebar) with inline editing
- Bulk edit: select multiple assets, edit shared fields
- Metadata badges on asset cards
- Metadata persists on copy/move/duplicate
- **Depends on**: 1.2 (Database), 2.1 (Upload), 2.2 (Processing -- auto-populated fields), 1.4 (Permissions)
- **Blocks**: 2.12 (Search -- search by metadata), 3.2 (Collections -- filter by metadata)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 6.1-6.3

### 2.11 Notifications System [NOT STARTED]

- Notification types: @mentions, comment replies, new uploads, status changes, share activity
- In-app: real-time via WebSocket, bell icon with unread count, notification panel, mark as read
- Email notifications: daily digest (9am user local time), immediate alerts (within 1 minute)
- Per-project notification settings (enable/disable)
- Per-asset subscription (follow for updates)
- Email service integration (SendGrid or AWS SES)
- Email templates for each notification type
- Daily digest BullMQ scheduled job
- Immediate alert job with debouncing
- User notification preferences UI
- **Depends on**: 2.9 (Comments), 1.4 (Permissions), R7 (Real-Time research), specs/14-realtime-collaboration.md (MISSING)
- **Blocks**: 3.1 (Sharing -- share notifications)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 13.1-13.2

### 2.12 Basic Search [NOT STARTED]

- SQLite FTS5 virtual table indexing: filename, metadata values, status, keywords, uploader name
- Triggers to keep FTS index updated on insert/update/delete
- Instant search: typeahead after 2+ characters, 300ms debounce
- BM25 relevance ranking (built into FTS5)
- Global search bar (Cmd+K / Ctrl+K), results dropdown (max 10), full results page
- Thumbnail previews in search results
- Filter refinement: file type, date range, project
- In-project quick search (Cmd+F / Ctrl+F)
- Search API endpoint with permission filtering
- **Depends on**: 1.2 (Database), 2.10 (Metadata)
- **Blocks**: 3.2 (Collections -- dynamic filtering uses search), 3.5 (Enhanced Search)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 12.1, 12.3

---

## PHASE 3: ADVANCED FEATURES

**Status**: NOT STARTED
**Blocked by**: Phase 2 completion (MVP)
**Goal**: External sharing, workflow tools, transcription, enhanced search, webhooks, lifecycle management.

### 3.1 Sharing and Presentations [NOT STARTED]

- Share types: public (anyone with link) and secure (email invites only)
- Share layouts: grid (thumbnail gallery), reel (sequential auto-advance), open-in-viewer (single asset direct)
- Share settings: passphrase protection, expiration date, allow comments/downloads, show versions, display transcriptions
- Featured field: default editable field for external reviewers (e.g., Status, Rating)
- Custom branding: icon (emoji/image), header, background, description, light/dark mode, accent colors, thumbnail display
- WYSIWYG share builder: drag-and-drop assets, reorder, live preview
- Share operations: create, duplicate, delete, copy link, send via email
- Share activity tracking: opened, viewed asset, commented, downloaded (with timestamp, IP, user agent)
- External reviewer types: authenticated (Bush user), identified (email-verified), unidentified (public link)
- Share notification emails: invite, comment replies, @mentions
- **Depends on**: 2.9 (Comments), 2.6 (Video Player), 2.10 (Metadata), 2.11 (Notifications), 1.4 (Permissions)
- **Blocks**: 3.2 (Collections -- can share entire Collection)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 11, `specs/05-sharing-and-presentations.md`

### 3.2 Collections [NOT STARTED]

- Collection types: team (visible to all project members) and private (creator only)
- Dynamic filtering: save filter rules (AND/OR logic with field comparisons)
- Filter rule builder UI: combine conditions for status, rating, assignee, keywords, file type, date, custom fields
- Real-time sync: collections auto-update when source assets change
- Manual asset addition: drag-to-add alongside filter rules
- Custom sort: drag-to-reorder within collection
- Grid/list view (same options as asset browser)
- Share entire Collection via Share system
- **Depends on**: 2.10 (Metadata), 2.12 (Search), 3.1 (Sharing)
- **Blocks**: nothing
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 7, `specs/02-workflow-management.md`

### 3.3 Comparison Viewer [NOT STARTED]

- Side-by-side display of two assets or versions
- Linked mode (default): synchronized playback, scrubbing, zoom, and pan
- Independent mode: separate controls for each side
- Adjustable split divider (50/50 default)
- Link/unlink toggle, swap sides button
- Launch from: asset browser (select 2), version stack, collection
- **Depends on**: 2.6 (Video Player), 2.7 (Image Viewer), 2.5 (Version Stacking)
- **Blocks**: nothing
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 9.7

### 3.4 Transcription and Captions [NOT STARTED]

- Transcription provider integration (chosen per R6 research, abstracted interface)
- 27-language support with auto-detection or manual selection
- Speaker identification with labels (with consent modal -- Texas/Illinois legal restriction)
- Editable transcripts (inline text editing)
- Time-synced text highlighting during playback
- Auto-scroll transcript with click-to-jump
- Caption generation from transcript (VTT, SRT format)
- Caption export: SRT, VTT, TXT
- Caption ingest: upload SRT/VTT files, multiple language tracks
- Transcript content searchable via global search
- Transcription workflow: request > BullMQ job > extract audio (FFmpeg) > API call > parse + store > WebSocket notify
- **Depends on**: 2.6 (Video Player), 2.2 (Processing), 2.12 (Search), R6 (Transcription research)
- **Blocks**: 3.5 (Enhanced Search -- transcript content search)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 10, `specs/06-transcription-and-captions.md`

### 3.5 Enhanced Search (Media Intelligence) [NOT STARTED]

- Visual search via Vision API (AWS Rekognition or Google Vision): detect objects, scenes, faces, text
- Transcript content search (search spoken words in videos)
- Semantic search with embedding models (cosine similarity ranking)
- Natural language query parsing: extract entities (dates, users, file types) from plain language queries
- Store visual metadata and embeddings in database
- Evaluate upgrade to dedicated search engine if FTS5 insufficient (per R8 research)
- **Depends on**: 2.12 (Basic Search), 3.4 (Transcription), R8 (Search Scalability research)
- **Blocks**: nothing
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 12.2

### 3.6 Webhook System [NOT STARTED]

- Webhook CRUD: register URL, select events, set secret
- Supported events: asset.uploaded/deleted/updated, comment.created/updated/deleted, share.created/opened/commented, status.changed, transcription.completed
- HMAC-SHA256 signature verification (X-Bush-Signature header)
- Delivery via BullMQ: POST payload to URL, verify 2xx response
- Retry: 3 attempts with exponential backoff (1min, 10min, 1hr)
- Webhook delivery logs UI (success/failure, response codes)
- **Depends on**: 1.5 (API Foundation), specs/17-api-complete.md (MISSING -- event enumeration)
- **Blocks**: Phase 4 integrations
- **Spec refs**: `specs/00-atomic-features.md` Section 18.3

### 3.7 Asset Lifecycle Management [NOT STARTED]

- Workspace-level default lifecycle: enable/disable, duration (30/60/90 days or custom)
- Per-asset lifecycle override: toggle, custom duration, explicit expiration date
- Expiration indicators: clock icon on expiring assets, hover tooltip with days remaining
- Reset lifecycle: extend expiration to full duration from now
- Daily expiration job (BullMQ scheduled): move expired assets to Recently Deleted
- 30-day recovery period before permanent deletion
- **Depends on**: 1.6 (Object Storage), 2.10 (Metadata), specs/13-billing-and-plans.md (MISSING -- plan-gated feature)
- **Blocks**: nothing
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 14

---

## PHASE 4: INTEGRATIONS AND NATIVE APPS

**Status**: NOT STARTED
**Blocked by**: Phase 2 API completion, some Phase 3 features
**Goal**: Native apps and third-party integrations to expand the platform beyond the web.

### 4.1 Storage Connect [NOT STARTED]

- Customer-owned AWS S3 bucket integration (read/write to primary, read-only additional)
- Bush proxies stored separately in Bush-managed storage
- **Depends on**: 1.6 (Object Storage), 1.5 (API), specs/16-storage-and-data.md (MISSING)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 14.2

### 4.2 Bush Transfer Desktop App [NOT STARTED]

- Technology: Tauri (per locked stack)
- Desktop upload path with watch folders
- **Depends on**: 1.5 (API), 2.1 (Upload), 2.9 (Comment Export)
- **Spec refs**: `specs/09-transfer-app.md`

### 4.3 iOS / iPadOS App [NOT STARTED]

- Technology: Native Swift (iOS/iPadOS 17.0+)
- Full platform feature parity on mobile
- **Depends on**: Complete Phase 2 API, specs/18-mobile-complete.md (MISSING)
- **Spec refs**: `specs/08-ios-ipad-apps.md`

### 4.4 Apple TV App [NOT STARTED]

- Technology: Native Swift (tvOS)
- Video playback and review focused
- **Depends on**: 4.3 (iOS App -- shared Swift codebase)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 18.2

### 4.5 Adobe Premiere Pro Integration [NOT STARTED]

- Extension panel for Premiere Pro CC 2019+
- Upload from timeline, import comments as markers
- **Depends on**: 1.5 (API), 2.9 (Comments), 2.1 (Upload), 3.6 (Webhooks)
- **Spec refs**: `specs/10-integrations.md`

### 4.6 Other Integrations [NOT STARTED]

- Adobe Lightroom plugin
- Final Cut Pro extension
- DaVinci Resolve and Avid Media Composer extensions
- Camera to Cloud (C2C) hardware/software partners
- Automation platforms: Zapier, Make, n8n
- **Depends on**: 1.5 (API), 3.6 (Webhooks)
- **Spec refs**: `specs/07-camera-to-cloud.md`, `specs/10-integrations.md`

---

## PHASE 5: ENTERPRISE AND SCALE

**Status**: NOT STARTED
**Blocked by**: Production deployment and customer feedback
**Goal**: Enterprise features, compliance, and optimization for large-scale usage.

### 5.1 Billing and Plan Management [NOT STARTED]

- Plan tiers: Free (2GB), Pro (2TB + 2TB/member), Team (3TB + 2TB/member), Enterprise (custom)
- Stripe integration for payment processing
- Plan upgrade/downgrade flows
- Storage overage handling
- **Depends on**: specs/13-billing-and-plans.md (MISSING)

### 5.2 Security Compliance [NOT STARTED]

- SOC 2 Type 2 certification
- TPN+ Gold Shield certification
- ISO 27001 certification
- Forensic watermarking
- Audit log retention and export
- **Depends on**: specs/11-security-features.md (NEEDS EXPANSION)

### 5.3 Enterprise Administration [NOT STARTED]

- SAML/SSO authentication
- Organization-wide security policies
- Advanced audit logging
- IP allowlisting, geo-restrictions
- **Depends on**: specs/12-authentication.md (MISSING)

### 5.4 Performance and Scale Optimization [NOT STARTED]

- SQLite to PostgreSQL migration path (if needed per R1 research)
- FTS5 to dedicated search engine migration (if needed per R8 research)
- CDN optimization and multi-region deployment
- Database sharding or read replicas (if needed)

### 5.5 SDK Publication [NOT STARTED]

- Official TypeScript/JavaScript SDK
- Python SDK
- API client code generation from OpenAPI spec

### 5.6 Internationalization [NOT STARTED]

- i18n framework integration in Next.js and iOS apps
- Translation for UI strings
- RTL language support

---

## DEPENDENCY GRAPH

This shows the critical path. Items on the left must be completed before items on the right.

```
RESEARCH (must complete first)
================================
R1 (SQLite)     ──> 1.2 (Database Schema)
R2 (Deployment) ──> 1.1 (Project Bootstrap), 1.5 (API Foundation)
R3 (Video)      ──> 2.6 (Video Player)
R4 (Transcoding)──> 2.2 (Media Processing)
R5 (Upload)     ──> 2.1 (File Upload)
R6 (Transcript) ──> 3.4 (Transcription)
R7 (Realtime)   ──> 2.9 (Comments), 2.11 (Notifications)
R8 (Search)     ──> 3.5 (Enhanced Search)

MISSING SPECS (must write before implementing)
================================
specs/12-authentication.md ──> 1.3 (Authentication)
specs/15-media-processing.md ──> 2.2 (Media Processing)
specs/14-realtime-collaboration.md ──> 2.9 (Comments), 2.11 (Notifications)
specs/13-billing-and-plans.md ──> 3.7 (Lifecycle), 5.1 (Billing)
specs/17-api-complete.md ──> 3.6 (Webhooks), Phase 4
specs/16-storage-and-data.md ──> 4.1 (Storage Connect)
specs/18-mobile-complete.md ──> 4.3 (iOS App)

PHASE 1 CRITICAL PATH
================================
1.1 (Bootstrap)
 └──> 1.2 (Database) + 1.6 (Object Storage)
       └──> 1.3 (Authentication)
             └──> 1.4 (Permissions)
                   └──> 1.5 (API Foundation)
                         └──> 1.7 (Web App Shell)

PHASE 2 CRITICAL PATH
================================
1.6 (Storage) + 1.7 (Web Shell) + 1.5 (API)
 └──> 2.1 (Upload)
       └──> 2.2 (Media Processing)
             └──> 2.3 (Asset Browser)
                   ├──> 2.4 (Asset Operations)
                   ├──> 2.5 (Version Stacking)
                   ├──> 2.6 (Video Player) + 2.7 (Image Viewer) + 2.8 (PDF Viewer)
                   │     └──> 2.9 (Comments & Annotations)
                   │           └──> 2.11 (Notifications)
                   └──> 2.10 (Metadata)
                         └──> 2.12 (Search)

PHASE 3 DEPENDENCIES
================================
2.9 + 2.6 + 2.10 + 2.11 ──> 3.1 (Sharing)
2.10 + 2.12 + 3.1 ──> 3.2 (Collections)
2.6 + 2.7 + 2.5 ──> 3.3 (Comparison Viewer)
2.6 + 2.2 + 2.12 ──> 3.4 (Transcription)
2.12 + 3.4 ──> 3.5 (Enhanced Search)
1.5 ──> 3.6 (Webhooks)
1.6 + 2.10 ──> 3.7 (Lifecycle)
```

---

## IMMEDIATE NEXT STEPS (Start Here)

1. **Write specs/12-authentication.md** -- unblocks Phase 1.3
2. **Complete research R1 (SQLite at Scale)** -- unblocks Phase 1.2
3. **Complete research R2 (Deployment without Containers)** -- unblocks Phase 1.1 and 1.5
4. **Write specs/19-accessibility.md** -- should inform all UI work from Phase 1.7 onward
5. **Expand specs/11-security-features.md** -- informs permission system and audit logging
6. **Begin Phase 1.1 (Project Bootstrap)** once R2 is complete
7. **Begin Phase 1.2 (Database Schema)** once R1 is complete

All other work is blocked until the above research and specifications are done.
