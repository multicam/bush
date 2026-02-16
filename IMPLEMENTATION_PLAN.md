# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-16
**Project status**: Iteration 0 -- Zero code exists. All items below are NOT STARTED.
**Source of truth for tech stack**: `specs/README.md` (lines 37-58)

---

## TABLE OF CONTENTS

1. [Locked Technology Stack](#locked-technology-stack)
2. [Iteration 0 to 1: Four-Week MVP Path](#iteration-0-to-1-four-week-mvp-path)
3. [Parallel Workstreams](#parallel-workstreams)
4. [Quick Wins (Build First)](#quick-wins-build-first)
5. [Risk Register](#risk-register)
6. [Pre-Implementation: Critical Research](#pre-implementation-critical-research)
7. [Pre-Implementation: Missing Specifications](#pre-implementation-missing-specifications)
8. [Phase 1: Foundation](#phase-1-foundation)
9. [Phase 2: Core Features (MVP)](#phase-2-core-features-mvp)
10. [Phase 3: Advanced Features](#phase-3-advanced-features)
11. [Phase 4: Integrations and Native Apps](#phase-4-integrations-and-native-apps)
12. [Phase 5: Enterprise and Scale](#phase-5-enterprise-and-scale)
13. [Dependency Graph](#dependency-graph)

---

## LOCKED TECHNOLOGY STACK

These choices are final. Any document stating otherwise must be corrected.

| Category | Technology | Notes |
|----------|------------|-------|
| Frontend (Web) | Next.js + TypeScript | SSR, routing, API routes |
| Frontend (Mobile) | Native Swift | iOS/iPadOS/Apple TV -- Phase 4 |
| Desktop Transfer App | Tauri | Phase 4 -- webapp is standard upload path |
| Backend API | Bun + TypeScript | RESTful V4 API, WebSockets, OAuth 2.0 |
| Database | SQLite | Primary relational store (NOT PostgreSQL) |
| Cache / Realtime | Redis | Caching, sessions, rate limiting, pub/sub |
| Search | SQLite FTS5 | Upgrade path to dedicated engine if needed |
| Object Storage | S3-compatible API | Provider-agnostic (AWS S3, R2, MinIO, B2) |
| CDN | TBD (preference: Bunny CDN) | CDN-agnostic abstraction -- see R10 |
| Media Processing | FFmpeg | Transcoding, thumbnails, filmstrips, waveforms |
| Message Queue | BullMQ + Redis | Async jobs: transcoding, transcription, notifications |
| Transcription | TBD (abstracted interface) | 27 languages, speaker ID -- provider chosen later |
| AI/ML (Vision) | TBD | Visual search / Media Intelligence |
| Email Service | TBD (SendGrid or AWS SES) | Transactional email and digest -- see R9 |
| Deployment | TBD | **No Docker, no Kubernetes** (explicit requirement) |
| CI/CD | GitHub Actions | |

---

## ITERATION 0 TO 1: FOUR-WEEK MVP PATH

**Goal**: Achieve functional MVP in ~4 weeks through parallelized workstreams.

This section is the single source of truth for what to do next. It lists every action needed to reach Iteration 1, organized by timeline and grouped by workstream. Each item is marked NOT STARTED.

### Days 1-3: Foundation Launch

**Backend Foundation Stream:**

1. **[R2] Complete Deployment Research** [2 days] -- NOT STARTED
   - Research Bun production deployment options (Fly.io, Render, Railway, bare VPS with systemd)
   - Document process supervision, crash recovery, zero-downtime deployment
   - Determine how to run Next.js + Bun backend on same or separate hosts
   - Design process supervision for FFmpeg workers (long-running, crash-prone)
   - Deliverable: Deployment architecture document
   - **Priority**: CRITICAL -- informs project structure
   - **Spec refs**: none (new document to create)

2. **[1.1] Bootstrap Project** [1 day, starts Day 2-3 after R2 direction is clear] -- NOT STARTED
   - Initialize monorepo structure (Bun workspace or Turborepo)
   - Set up TypeScript configuration (shared tsconfig), ESLint, Prettier
   - Set up Vitest testing framework
   - Configure GitHub Actions CI/CD pipeline
   - Create development environment setup docs
   - **Depends on**: R2 direction (not full completion)
   - **Blocks**: Everything else
   - **Spec refs**: `specs/README.md`

3. **[QW1] Create File Type Registry** [0.5 day, part of Bootstrap] -- NOT STARTED
   - Central registry mapping MIME types to file categories (video/audio/image/document)
   - Include all 100+ supported formats from `specs/00-atomic-features.md` Section 4.3
   - Include codec validation rules per container format
   - Used by: upload validation, processing pipeline, viewer routing, asset browser icons
   - **Rationale**: Every component needs to know file types; build once, share everywhere
   - **Spec refs**: `specs/00-atomic-features.md` Section 4.3, `specs/00-complete-support-documentation.md` Section 4.3

**Spec Writing Stream:**

4. **[S12] Write specs/12-authentication.md** [1 day] -- NOT STARTED
   - Document SAML/SSO enterprise authentication flows
   - Define session duration policies and token expiration times
   - Specify refresh token rotation policy
   - Detail IP allowlisting and geo-restrictions (enterprise tier)
   - Define multi-factor authentication detailed flows (TOTP setup, recovery codes)
   - **Blocks**: Phase 1.3 (Authentication System)
   - **Parallel with**: R2, Bootstrap

5. **[S19] Write specs/19-accessibility.md** [1 day] -- NOT STARTED
   - Define WCAG compliance target (AA recommended)
   - Specify keyboard navigation for all interactive components (player, browser, comments, modals)
   - Document screen reader support requirements (ARIA labels, live regions)
   - Define color contrast ratios and motion sensitivity guidelines (prefers-reduced-motion)
   - **Informs**: All UI work from Phase 1.7 onward
   - **Parallel with**: R2, Bootstrap

**Research Stream:**

6. **[R1] Start SQLite at Scale Research** [3 days, completes Day 6] -- NOT STARTED
   - Benchmark concurrent read/write workloads (100, 500, 1000 users)
   - Test WAL mode configuration, file size behavior (1GB-100GB)
   - Evaluate connection pooling (better-sqlite3, bun:sqlite, Drizzle)
   - Design backup strategy with Litestream
   - Evaluate multi-database strategy (separate files per account vs single)
   - Identify bottleneck threshold and migration path to PostgreSQL
   - **Parallel with**: R2, Bootstrap, Spec Writing

### Days 3-7: Core Infrastructure

**Backend Foundation Stream (continued):**

7. **[1.6] Set up Object Storage** [1 day] -- NOT STARTED
   - Implement provider-agnostic S3-compatible storage interface
   - Choose initial provider (Cloudflare R2 for zero egress, or Backblaze B2 for low cost)
   - Configure pre-signed URL generation (upload and download)
   - Implement multipart upload support
   - Define storage key structure: `{account_id}/{project_id}/{file_id}/{type}/{filename}`
   - Set up development storage (MinIO or B2 free tier)
   - **Depends on**: 1.1 (Bootstrap)
   - **Does NOT depend on R1 or R5** -- basic storage needs no scale research
   - **Spec refs**: `specs/00-atomic-features.md` Section 4.2, 14.1

8. **[1.2] Design Database Schema** [2 days] -- NOT STARTED
   - Design SQLite schema with proper indexes and foreign keys
   - Core models: Account, User, Workspace, Project, Folder, File, VersionStack, Comment, Share, CustomField, Webhook, Notification
   - Hierarchy enforcement: Account > Workspace > Project > Folder > File
   - Foreign key constraints, check constraints, triggers for cascades
   - Choose and configure ORM/query builder (Drizzle ORM recommended -- supports SQLite + PostgreSQL migration path)
   - Create migration system
   - Write schema validation tests
   - **Depends on**: 1.1 (Bootstrap)
   - **R1 dependency softened**: R1 informs configuration (WAL mode, connection pooling), not schema design
   - **Spec refs**: `specs/00-atomic-features.md` Section 2, `specs/00-complete-support-documentation.md` Section 3.1

9. **[QW2] Create Seed Data Scripts** [0.5 day, alongside 1.2] -- NOT STARTED
   - Generate realistic development data: accounts, users, workspaces, projects, folders
   - Include multiple permission levels and roles to test edge cases
   - Create deterministic seed (same data every run) and random seed (fuzz testing)
   - Include sample file records (no actual files -- just metadata for testing)
   - **Depends on**: 1.2 (Database Schema)
   - **Blocks**: nothing, but accelerates all testing

**Spec Writing Stream (continued):**

10. **[S11] Expand specs/11-security-features.md** [1 day] -- NOT STARTED
    - Current file is only 38 lines -- needs major expansion
    - Add forensic watermarking implementation details (visible/invisible, HLS integration)
    - Specify audit log retention, format (structured JSON), and export (CSV/JSON)
    - Define Access Groups detailed specification (CRUD, nesting, permission inheritance)
    - Document organization-wide security policy configuration
    - Add 2FA enforcement policies, session management, IP allowlisting
    - **Informs**: Permission system (1.4) and audit logging

11. **[S13] Write specs/13-billing-and-plans.md** [1 day] -- NOT STARTED
    - Define detailed pricing structure for each tier (Free, Pro, Team, Enterprise)
    - Create complete plan feature matrix (which features gated to which plan)
    - Specify "Team+" and "Pro+" tier boundary definitions
    - Document storage quota enforcement rules and overage handling
    - Define plan-gated features explicitly: 4K proxy (Pro+), comment attachments (Pro+), restricted folders (Team+), Access Groups (Team+)
    - **Blocks**: Phase 3.7 (Lifecycle), Phase 5.1 (Billing)

**Frontend Shell Stream:**

12. **[1.7a] Start Web App Shell (static)** [3 days, completes Week 2] -- NOT STARTED
    - Initialize Next.js 15+ with App Router and TypeScript
    - Build core page structure (login, signup, dashboard, workspaces, projects, settings)
    - Implement authentication flows UI (email/password, OAuth buttons, 2FA, password reset)
    - Set up state management (React Context for auth/workspace, TanStack Query for server state)
    - **Depends on**: 1.1 (Bootstrap)
    - **Can start before API (1.5)** -- build static shell first, connect to API in Week 2
    - **Spec refs**: `specs/00-atomic-features.md` Section 1.4, 5.3, `specs/03-file-management.md`

13. **[QW3] Set up Component Library Foundation** [0.5 day, part of 1.7a] -- NOT STARTED
    - Create shared UI primitives: Button, Input, Select, Modal, Toast, Dropdown, Tooltip
    - Define design tokens (colors, spacing, typography, shadows) as CSS variables
    - Set up Storybook or simple component documentation page
    - Establish consistent error state patterns (loading, empty, error for every data-fetching component)
    - Follow specs/19-accessibility.md guidelines from the start (ARIA, keyboard nav, focus management)
    - **Rationale**: Every frontend task needs these; building ad-hoc leads to inconsistency
    - **Spec refs**: `specs/19-accessibility.md` (when written)

### Week 2 (Days 8-14): Authentication, Permissions, API

14. **[1.3] Build Authentication System** [3 days] -- NOT STARTED
    - Email/password authentication (bcrypt hashing, minimum 8 characters)
    - OAuth 2.0 integration: Google Sign-In, Apple ID
    - Adobe IMS integration (see R11 for OAuth details -- can stub initially)
    - Two-factor authentication (TOTP with QR code generation)
    - Redis-based session storage with TTL
    - JWT access token (1hr) + refresh token (30 days)
    - Secure cookie handling (httpOnly, secure, sameSite)
    - Account switcher logic (multi-account support)
    - Account roles: Owner, Content Admin, Member, Guest, Reviewer
    - Authentication integration tests
    - **Depends on**: 1.2 (Database Schema), specs/12-authentication.md
    - **Blocks**: 1.4, 1.5
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 1.2, 1.3

15. **[1.4] Build Permission System** [2 days] -- NOT STARTED
    - Five permission levels: Full Access, Edit and Share, Edit, Comment Only, View Only
    - Permission models: WorkspacePermission, ProjectPermission, FolderPermission
    - Permission inheritance: Workspace > Project > Folder (cannot lower inherited permissions)
    - Restricted Project/Folder logic (breaks inheritance chain, invite-only)
    - Access Groups for bulk permission management (Team+ feature -- plan gate check)
    - Permission check middleware for API routes
    - Guest role constraints: 1 project max, cannot invite others, cannot delete
    - Extensive permission edge-case tests (see permission matrices in `specs/00-complete-support-documentation.md` 2.4, 2.5)
    - **Depends on**: 1.2, 1.3
    - **Blocks**: 1.5, all Phase 2+
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 2.1-2.5, `specs/11-security-features.md`

16. **[QW4] Build Error Handling Utilities** [0.5 day, alongside 1.5] -- NOT STARTED
    - Standardized API error response format matching `specs/00-atomic-features.md` Section 18.7-18.8
    - HTTP error code mapping: 400, 401, 403, 404, 409, 422, 429, 500, 503
    - Error class hierarchy: ValidationError, AuthError, ForbiddenError, NotFoundError, RateLimitError
    - Client-side error recovery patterns (retry logic, error boundary components)
    - Structured error logging (JSON with request_id, user_id, timestamp, level)
    - **Rationale**: Every API route and every frontend fetch needs consistent error handling
    - **Spec refs**: `specs/00-atomic-features.md` Sections 18.7-18.8

17. **[1.5] Build API Foundation (V4)** [3 days] -- NOT STARTED
    - Set up Bun HTTP server with routing framework (Hono or Elysia)
    - OAuth 2.0 authentication middleware
    - Rate limiting middleware (Redis-backed leaky bucket algorithm, per-endpoint limits per `specs/00-atomic-features.md` 18.2)
    - Cursor-based pagination (default 50, max 100 items per page)
    - JSON:API-style response format with proper error responses (use QW4 error utilities)
    - CRUD routes for core resources: accounts, workspaces, projects, folders, files, version_stacks, users, comments, shares, custom_fields, webhooks
    - Plan-gate middleware: check user plan tier before allowing gated features
    - OpenAPI spec generation for documentation
    - API integration tests
    - **Depends on**: 1.3, 1.4
    - **Blocks**: 1.7b, all Phase 2+
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 21.1-21.6, `specs/00-atomic-features.md` Sections 18.2-18.5

18. **[1.7b] Complete Web App Shell (connected)** [2 days] -- NOT STARTED
    - Connect to API endpoints (replace mock data with real calls)
    - Implement multi-panel layout: left (folder tree), center (file grid/list), right (metadata inspector), bottom (upload queue) -- all collapsible
    - Build global navigation: account switcher, workspace sidebar, project list, folder tree, breadcrumbs
    - Add responsive design (mobile, tablet, desktop)
    - Implement keyboard shortcuts foundation (Cmd+K search, Cmd+F project search)
    - Write component tests (Vitest + Testing Library)
    - **Depends on**: 1.5 (API), 1.3 (Authentication)
    - **Blocks**: all Phase 2 frontend work
    - **Spec refs**: `specs/00-atomic-features.md` Section 1.4, 5.3

**Research (continuing in background):**

19. **[R4] Start Media Transcoding Research** [Days 7-14] -- NOT STARTED
    - Benchmark FFmpeg transcoding times: 1GB, 10GB, 100GB files across formats
    - Design worker architecture: single vs distributed BullMQ workers, concurrency limits
    - Test HDR tone mapping quality and performance (zscale + tonemap filters)
    - Evaluate RAW image processing: libraw, dcraw for 15+ camera formats
    - Test Adobe format rendering: ImageMagick for PSD/AI/EPS, server-side for INDD
    - Test document rendering: LibreOffice headless for DOCX/PPTX/XLSX to PDF/image conversion
    - Determine optimal proxy parameters: bitrate targets, CRF values, resolution ladder
    - Test audio waveform generation: FFmpeg audiowaveform vs BBC audiowaveform tool
    - Plan FFmpeg worker resource management: CPU/memory limits, tmpdir sizing
    - **Blocks**: specs/15-media-processing.md, then Phase 2.2
    - Deliverable: Processing pipeline design document with benchmarks and FFmpeg parameter matrix

20. **[R9] Email Service Provider Research** [1 day, Week 2] -- NOT STARTED
    - Compare SendGrid vs AWS SES vs Postmark vs Resend
    - Evaluate: deliverability, cost at scale (10K, 100K, 1M emails/month), template support, webhook tracking
    - Test transactional email latency (must be <1 minute for immediate alerts per spec)
    - Evaluate daily digest scheduling capabilities
    - Assess DKIM/SPF/DMARC configuration complexity
    - **Blocks**: 2.11 (Notifications email delivery)
    - Deliverable: Provider recommendation with cost projection

### Week 3-4 (Days 15-28): Upload, Processing, Browser

21. **[S15] Write specs/15-media-processing.md** [1 day, after R4] -- NOT STARTED
    - Document exact FFmpeg transcoding parameters (bitrate targets, CRF values, codec choices per resolution)
    - Specify processing timeouts and failure handling policies
    - Define HDR tone mapping parameter specifications
    - Detail RAW and Adobe format conversion parameters
    - Specify audio waveform generation parameters (samples per second, output format)
    - Define document conversion pipeline (DOCX/PPTX/XLSX to renderable format)
    - Specify Interactive ZIP (HTML) rendering behavior and sandboxing
    - **Depends on**: R4 completion
    - **Blocks**: Phase 2.2 implementation

22. **[2.1] Build File Upload System** [3 days] -- NOT STARTED
    - Web browser drag-and-drop (files and folders)
    - MIME type validation using file type registry (QW1)
    - Chunked upload client library (10MB chunks, 3-5 parallel, resumable via IndexedDB)
    - Upload queue UI: progress bars, pause/resume, priority reorder, cancel, retry
    - Folder structure preservation on drag-and-drop
    - Upload constraints: max 10 concurrent uploads, 500 assets per upload, 250 folders, 5TB max file size
    - Backend: pre-signed URL generation, file record creation, completion notification, processing job enqueue
    - **Depends on**: 1.5 (API), 1.6 (Object Storage), 1.7b (Web Shell)
    - **Does NOT require R5** -- basic upload works with 10MB chunks, 3-parallel
    - **Blocks**: 2.2 (Media Processing), 2.3 (Asset Browser)
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 4.1-4.3

23. **[2.2] Build Media Processing Pipeline** [4 days] -- NOT STARTED
    - Set up BullMQ with Redis for async job processing
    - Media processing worker with configurable concurrency (default: 4 workers)
    - **Video processing**: thumbnail generation (frame at 50% duration, 3 sizes), hover scrub filmstrip (1-sec interval sprite sheets), proxy transcoding (H.264 MP4 at 360p/540p/720p/1080p/4K)
    - **Image processing**: thumbnail generation, proxy generation for RAW/Adobe/HDR formats
    - **Audio processing**: waveform extraction (JSON peak data for timeline visualization), thumbnail (waveform image)
    - **Document processing**: PDF rendering via pdf.js, DOCX/PPTX/XLSX thumbnail generation (LibreOffice headless or similar), Interactive ZIP sandboxing
    - Metadata extraction via FFprobe (33 built-in fields per `specs/00-atomic-features.md` 6.1)
    - HDR detection and SDR tone mapping for proxies
    - Job priorities: thumbnail (high), proxy (medium), waveform (low)
    - Retry: 3 attempts with exponential backoff
    - Processing status tracking: uploading > processing > ready / processing_failed
    - WebSocket progress updates to frontend
    - **Depends on**: 2.1 (Upload), 1.6 (Object Storage), specs/15-media-processing.md, R4
    - **Blocks**: 2.3 (Asset Browser -- needs thumbnails), 2.6-2.8b (Viewers -- need proxies)
    - **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.4, `specs/00-atomic-features.md` Section 6.1

24. **[2.3] Build Asset Browser and Navigation** [3 days] -- NOT STARTED
    - Grid view with adjustable card size (small 160px, medium 240px, large 320px)
    - List view with sortable metadata columns
    - Thumbnail display options: aspect ratio (16:9, 1:1, 9:16), fit vs fill
    - File type icons using file type registry (QW1) for assets without thumbnails
    - Flatten folders view (show all nested assets in flat list)
    - Sorting by any metadata field (ascending/descending, multi-level)
    - Drag-and-drop: move files to folder, copy with Cmd/Ctrl, reorder in custom sort
    - Multi-select (max 200): shift-click range, cmd/ctrl-click toggle, select all (Cmd+A)
    - Bulk actions: move, copy, delete, download, edit metadata
    - Performance: virtualized lists (react-window or similar), lazy loading thumbnails
    - Viewer routing: route to correct viewer (video/audio/image/PDF/document) based on file type registry
    - **Depends on**: 1.5 (API), 2.1 (Upload), 2.2 (Processing -- for thumbnails), 1.4 (Permissions)
    - **Blocks**: 2.4-2.8b (all downstream Phase 2)
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 4.2, 6.4

**By Week 4 End**: Phase 1 complete + basic upload/processing/browsing functional = **Iteration 1 Achieved**

### Post-Iteration 1: Immediate Next Priorities (Weeks 5-8)

25. **[2.4] Asset Operations** [2 days] -- NOT STARTED
    - Copy To, Move To, Delete (soft-delete, 30-day retention), Recover, Permanent Delete
    - Download Original (pre-signed S3 URL, 1hr expiry), Download Proxy (select resolution)
    - Custom Thumbnail (upload image or select video frame)
    - Auto-delete scheduled job (BullMQ, daily)
    - **Depends on**: 2.3 (Asset Browser)

26. **[2.5] Version Stacking** [2 days] -- NOT STARTED
    - VersionStack model linking multiple File records
    - Drag-to-stack interaction, auto version numbering, version list UI
    - Comments persist across versions (linked to stack, not file)
    - **Depends on**: 2.1 (Upload), 2.3 (Asset Browser)

27. **[2.6] Video Player** [4 days] -- NOT STARTED
    - Base player (Video.js or alternative per R3 research)
    - Frame-accurate seeking, JKL shuttle, playback speed 0.25x-1.75x
    - HLS adaptive streaming with quality selection (360p-4K)
    - Frame guides, timeline with filmstrip hover preview, comment markers
    - Full keyboard shortcut suite
    - **Depends on**: 2.3, 2.2, R3

28. **[2.7] Image Viewer** [2 days] -- NOT STARTED
    - Zoom 25%-400%, pan, fit-to-screen, 1:1 pixel view
    - Mini-map for large images (>2000px)
    - Support: standard, RAW (via proxy), Adobe (via proxy), HDR (via tone-mapped proxy)
    - **Depends on**: 2.3, 2.2

29. **[2.8a] Audio Player** [2 days] -- NOT STARTED
    - Waveform visualization (rendered from processing pipeline JSON data)
    - Playback controls: play/pause, seek via waveform click, volume, mute
    - Playback speed control (0.25x-1.75x)
    - Time display (current / total duration)
    - Comment markers on waveform timeline (timestamped comments)
    - Keyboard shortcuts (Space play/pause, arrows seek, M mute)
    - Support all 8 audio formats: AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA
    - **Depends on**: 2.3 (Asset Browser), 2.2 (Processing -- waveform data)
    - **Blocks**: 2.9 (Comments -- timestamped comments on audio)
    - **Spec refs**: `specs/00-atomic-features.md` Section 4.3 (audio formats), `specs/00-complete-support-documentation.md` Section 4.4 (waveform)
    - **NOTE**: This item was MISSING from the previous plan. The platform supports 8 audio formats but had no audio viewer specified.

30. **[2.8b] PDF and Document Viewer** [3 days] -- NOT STARTED
    - **PDF Viewer**: PDF.js integration, multi-page navigation (thumbnails sidebar, prev/next, page jump), zoom (in/out, fit width, fit page, actual size), text selection/copy, search within PDF, page rotation
    - **Document Viewer (DOCX/PPTX/XLSX)**: Render server-generated preview (PDF conversion from processing pipeline), page navigation, zoom
    - **Interactive ZIP Viewer**: Sandboxed iframe rendering of HTML content, security constraints (no external network, no localStorage access)
    - **Depends on**: 2.3 (Asset Browser), 2.2 (Processing -- document conversion)
    - **Blocks**: 2.9 (Comments -- page-stamped comments)
    - **Spec refs**: `specs/00-complete-support-documentation.md` Section 9.6
    - **NOTE**: Document rendering (DOCX/PPTX/XLSX) and Interactive ZIP viewer were MISSING from the previous plan.

31. **[2.9] Comments and Annotations** [4 days] -- NOT STARTED
    - Comment types: single-frame (timestamped), range-based (in/out), anchored (XY position), internal (members-only), public
    - Comments linked to VersionStack (persist across versions)
    - Threaded replies, markdown body, emoji reactions, @mentions, hashtags, color hex rendering
    - Attachments: up to 6 files per comment (Pro+ plan -- use plan gate)
    - Annotation tools: free draw, line, arrow, rectangle with color picker
    - HTML5 Canvas overlay on video player, image viewer, audio waveform, PDF viewer
    - Comment panel with filtering/sorting, quick actions, export (CSV, plain text, EDL)
    - Real-time sync via WebSocket, optimistic UI updates
    - **Depends on**: 2.6, 2.7, 2.8a, 2.8b, 1.4, R7, specs/14-realtime-collaboration.md

32. **[2.10] Metadata System** [3 days] -- NOT STARTED
    - 33 built-in fields, 10 custom field types
    - Account-wide field library, per-project visibility, field permissions
    - Metadata inspector panel, bulk edit, badges on cards
    - **Depends on**: 1.2, 2.1, 2.2, 1.4

33. **[2.11] Notifications System** [3 days] -- NOT STARTED
    - In-app real-time (WebSocket), email (immediate + daily digest)
    - Email service integration (chosen per R9)
    - Email templates, BullMQ scheduled jobs, user preference UI
    - **Depends on**: 2.9, 1.4, R7, R9, specs/14-realtime-collaboration.md

34. **[2.12] Basic Search** [2 days] -- NOT STARTED
    - SQLite FTS5, BM25 ranking, typeahead, global search bar (Cmd+K)
    - Filter refinement, permission-filtered results
    - **Depends on**: 1.2, 2.10

---

## PARALLEL WORKSTREAMS

Four workstreams run simultaneously with minimal dependencies.

### Stream 1: Backend Foundation
**Owner**: Backend engineer
**Timeline**: Days 1-14

```
Days 1-2:  R2 Research (Deployment)
Day 3:     Bootstrap (1.1) + File Type Registry (QW1)
Days 3-4:  Object Storage (1.6)
Days 4-7:  Database Schema (1.2) + Seed Data (QW2) <-- R1 config incorporated Day 6
Days 8-10: Authentication (1.3) + Error Utilities (QW4)
Days 11-14: Permissions (1.4) + API Foundation (1.5)
```

**Key outputs**:
- Deployed development environment with CI/CD
- Database schema with migrations and seed data
- RESTful API with auth/permissions/rate-limiting
- Shared utilities: file type registry, error handling

### Stream 2: Spec Writing
**Owner**: Product owner / technical writer
**Timeline**: Days 1-14

```
Days 1-3:  specs/12-authentication.md + specs/19-accessibility.md
Days 4-7:  specs/11-security-features.md (expansion) + specs/13-billing-and-plans.md
Days 8-10: specs/15-media-processing.md (after R4 starts, can draft early sections)
Days 11-14: specs/14-realtime-collaboration.md (start early, before R7 completes)
```

**Key outputs**:
- 6 critical spec documents completed or substantially drafted
- Unblocks Phase 1-3 implementation

**Change from previous plan**: specs/14-realtime-collaboration.md writing moved earlier (Days 11-14 instead of "after R7"). Rationale: the spec can be drafted based on requirements and standard WebSocket patterns; R7 research refines the scaling strategy but does not block the protocol design. This prevents the spec from becoming a bottleneck for Phase 2.9 (Comments) and 2.11 (Notifications).

### Stream 3: Research
**Owner**: Senior engineer / architect
**Timeline**: Days 1-28 (overlapping)

```
Days 1-2:   R2 (Deployment) [CRITICAL -- blocks Bootstrap]
Days 1-6:   R1 (SQLite) [CRITICAL -- informs Schema config]
Days 7-14:  R4 (Media Transcoding) [HIGH -- blocks Processing pipeline]
Days 7-21:  R5 (Large File Upload) [MEDIUM -- basic upload works without]
Days 8-9:   R9 (Email Service) [LOW -- 1 day, quick decision]
Days 10-11: R10 (CDN Selection) [LOW -- 1 day, quick decision]
Days 12-13: R11 (Adobe OAuth/IMS) [LOW -- 1 day, understand integration]
Days 14-21: R7 (Real-Time Infrastructure) [MEDIUM -- blocks Comments]
Week 4:     R3 (Video Player Architecture) [MEDIUM -- blocks Video Player]
```

**Key outputs**:
- Deployment architecture decision
- SQLite configuration and backup strategy
- FFmpeg parameter matrix
- Upload protocol specification
- Email provider, CDN provider, Adobe OAuth decisions

### Stream 4: Frontend Shell
**Owner**: Frontend engineer
**Timeline**: Days 3-14

```
Day 3:      Component Library Foundation (QW3)
Days 3-7:   Start Web Shell (1.7a) -- static structure, auth UI
Days 8-10:  Continue shell -- page layouts, navigation
Days 11-14: Connect to API (1.7b), complete interactive shell
```

**Key outputs**:
- Next.js app with routing, auth flows, multi-panel layout
- Shared component library with design tokens
- State management infrastructure (React Context + TanStack Query)

### Parallelization Benefits

| Approach | Phase 1 | To Iteration 1 |
|----------|---------|-----------------|
| Sequential | ~6 weeks | ~10 weeks |
| Parallel (this plan) | ~2.5 weeks | ~4 weeks |

**Critical Success Factors**:
1. R2 must complete by Day 2 (blocks all backend work)
2. R1 findings incorporated into schema config by Day 6 (prevents rework)
3. Spec writers stay 3-5 days ahead of implementation
4. Frontend builds static shell while backend builds API (merge at Day 11)
5. Quick wins (QW1-4) built inline to prevent ad-hoc reimplementation later

---

## QUICK WINS (BUILD FIRST)

These small, high-leverage items should be built during their respective phases to prevent ad-hoc reimplementation and inconsistency across the codebase. They are embedded in the timeline above but listed here for visibility.

### QW1. File Type Registry [Day 3, with Bootstrap] -- NOT STARTED

- Central TypeScript module mapping MIME types to categories, icons, viewer types, and processing rules
- All 100+ formats from spec: 9 video containers with codec validation, 8 audio, 25+ image (including 14 RAW, 4 Adobe), 5 document
- Functions: `getFileCategory(mime)`, `getViewerType(mime)`, `isValidCodec(container, codec)`, `getProcessingPipeline(mime)`
- Used by: upload validation, processing pipeline routing, asset browser icons, viewer component selection
- **Estimated effort**: 4 hours
- **Spec refs**: `specs/00-atomic-features.md` Section 4.3

### QW2. Seed Data Scripts [Days 5-6, with Schema] -- NOT STARTED

- Development seed: 2 accounts, 3 workspaces, 5 projects, 20 folders, 100 file records, 5 users with different roles
- Permission test seed: specific scenarios for inheritance, restricted projects, guest limits
- Idempotent: can run repeatedly without duplicates
- CLI command: `bun run seed` and `bun run seed:reset`
- **Estimated effort**: 4 hours

### QW3. Component Library Foundation [Day 3, with Frontend Shell] -- NOT STARTED

- Primitives: Button (primary/secondary/ghost/danger), Input, Select, Checkbox, TextArea, Modal, Toast, Dropdown, Tooltip, Spinner, Avatar, Badge
- Design tokens as CSS custom properties: `--color-primary`, `--spacing-*`, `--font-*`, `--radius-*`, `--shadow-*`
- Dark/light theme support via CSS variables (needed for share branding later)
- Accessible by default: ARIA attributes, keyboard navigation, focus management
- **Estimated effort**: 6 hours

### QW4. Error Handling Utilities [Day 10, with API Foundation] -- NOT STARTED

- Shared error classes: `AppError` base, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`
- API error formatter: converts error classes to JSON:API error response format
- Client-side error handler: maps HTTP status codes to user-friendly messages
- Request ID generation and propagation (middleware)
- Structured logging helper: `log.info()`, `log.error()`, `log.warn()` with JSON output
- **Estimated effort**: 4 hours

---

## RISK REGISTER

### Risk 1: SQLite Performance at Scale
**Severity**: HIGH | **Probability**: MEDIUM

SQLite may not handle production workload (concurrent writes, large datasets, multi-instance deployment).

**Mitigation**:
- Complete R1 by Day 6 with realistic benchmarks
- Use Drizzle ORM (supports SQLite and PostgreSQL) for migration path
- Trigger criteria: >500 concurrent users or >100GB database
- Budget 2 weeks for PostgreSQL migration if triggered

**Monitor**: Query latency, write lock contention, connection pool saturation

### Risk 2: No-Container Deployment Complexity
**Severity**: MEDIUM | **Probability**: LOW

Deploying Bun + Next.js + FFmpeg workers + Redis without Docker increases operational complexity.

**Mitigation**:
- Complete R2 by Day 2 to validate approach
- Document every step in runbook
- Use infrastructure-as-code (Terraform or Pulumi)
- Consider Fly.io/Render with native Bun support

**Monitor**: Deployment success rate, time-to-deploy, configuration drift

### Risk 3: Bun Production Maturity
**Severity**: MEDIUM | **Probability**: MEDIUM

Bun is relatively new. Production stability unknown at scale.

**Mitigation**:
- Avoid Bun-specific APIs where possible (stay Node-compatible)
- Comprehensive error handling with process supervision
- Health checks and automatic restarts
- Budget 1 week for Node.js migration if unstable

**Monitor**: Runtime crashes, memory growth, dependency compatibility

### Risk 4: Over-Engineered for MVP
**Severity**: LOW | **Probability**: MEDIUM

Building enterprise features before validating product-market fit.

**Mitigation**:
- Defer Phase 5 until post-launch feedback
- Use feature flags for incremental rollout
- Timebox each feature: if exceeding estimate by 50%, descope or defer

### Risk 5: Missing Audio/Document Viewer (NEW)
**Severity**: MEDIUM | **Probability**: HIGH

Previous plan had no audio viewer despite supporting 8 audio formats, and no document rendering for DOCX/PPTX/XLSX despite listing them as supported.

**Mitigation**:
- Added 2.8a (Audio Player) and expanded 2.8b (Document Viewer) to the plan
- Audio waveform generation already in processing pipeline (2.2)
- Document rendering requires LibreOffice headless or similar -- included in R4 research scope
- Interactive ZIP sandboxing requires security review

### Risk 6: CDN and Email Provider Lock-in (NEW)
**Severity**: LOW | **Probability**: LOW

CDN and email service choices are TBD. Late decisions could delay features that depend on them.

**Mitigation**:
- Added R9 (Email) and R10 (CDN) as quick research items in Week 2
- Both should use provider-agnostic abstractions (already planned for storage)
- Email needed by Phase 2.11 (Notifications); CDN needed by Phase 2.6 (Video Player streaming)

---

## PRE-IMPLEMENTATION: CRITICAL RESEARCH

Research items organized by priority tier based on when they block implementation.

### TIER 1: Week 1 (CRITICAL -- Start Immediately)

#### R2. Deployment without Containers [BLOCKING] -- NOT STARTED

- **Blocks**: 1.1 (Bootstrap), project structure decisions
- **Timeline**: Days 1-2
- **Research questions**:
  - Evaluate Bun production deployment: process management, crash recovery, graceful shutdown
  - Compare: systemd services, PM2, Fly.io (non-Docker), Render, Railway, bare VPS
  - Determine Next.js + Bun backend hosting topology (same host vs separate)
  - Plan zero-downtime deployment strategy
  - Design process supervision for FFmpeg workers
- **Deliverable**: Deployment architecture document

#### R1. SQLite at Scale [CRITICAL] -- NOT STARTED

- **Blocks**: 1.2 configuration (not design)
- **Timeline**: Days 1-6
- **Research questions**:
  - Benchmark concurrent read/write (100, 500, 1000 users)
  - WAL mode configuration and journal size limits
  - Database file behavior at 1GB, 10GB, 50GB, 100GB
  - Connection pooling strategy for Bun (better-sqlite3 vs bun:sqlite vs Drizzle)
  - Backup strategy: Litestream for continuous S3 replication
  - Multi-database strategy (per-account vs single)
  - Bottleneck threshold and PostgreSQL migration path
- **Deliverable**: Decision document with benchmarks

### TIER 2: Weeks 2-3 (HIGH -- Needed for Phase 2)

#### R4. Media Transcoding Pipeline [HIGH] -- NOT STARTED

- **Blocks**: specs/15-media-processing.md, then 2.2
- **Timeline**: Days 7-14
- **Research questions**:
  - Benchmark FFmpeg transcoding times across formats and file sizes
  - Worker architecture: single vs distributed BullMQ workers
  - HDR tone mapping quality/performance (zscale + tonemap)
  - RAW image processing: libraw, dcraw for 15+ formats
  - Adobe format rendering: ImageMagick for PSD/AI/EPS, server-side for INDD
  - **Document rendering: LibreOffice headless for DOCX/PPTX/XLSX** (NEW)
  - **Audio waveform: FFmpeg audiowaveform vs BBC audiowaveform tool** (NEW)
  - Optimal proxy parameters: bitrate targets, CRF values, resolution ladder
  - FFmpeg worker resource management: CPU/memory limits, tmpdir sizing
- **Deliverable**: Processing pipeline design document with FFmpeg parameter matrix

#### R5. Large File Upload Strategy [MEDIUM] -- NOT STARTED

- **Blocks**: 2.1 advanced features (basic upload works without)
- **Timeline**: Days 7-21
- **Research questions**:
  - Optimal chunk size for S3 multipart (10MB vs 50MB vs 100MB)
  - Parallel chunk concurrency (3 vs 5 vs 10)
  - Browser IndexedDB for resumable upload state
  - 5TB end-to-end upload testing
  - tus.io protocol vs custom implementation
  - S3 multipart limits across providers (AWS S3, R2, B2)
- **Deliverable**: Upload protocol specification

#### R7. Real-Time Infrastructure [MEDIUM] -- NOT STARTED

- **Blocks**: 2.9 (Comments), 2.11 (Notifications), specs/14-realtime-collaboration.md
- **Timeline**: Days 14-21
- **Research questions**:
  - WebSocket connection management for Bun server
  - Horizontal scaling: Redis pub/sub for multi-instance broadcast
  - Optimistic UI update strategy
  - Connection limits per instance
  - Reconnection and message replay on disconnect
- **Deliverable**: WebSocket protocol specification

### TIER 3: Week 2 (LOW -- Quick Decisions)

#### R9. Email Service Provider [LOW] -- NOT STARTED (NEW)

- **Blocks**: 2.11 (Notifications -- email delivery)
- **Timeline**: Days 8-9 (1 day)
- **Research questions**:
  - Compare SendGrid vs AWS SES vs Postmark vs Resend
  - Deliverability, cost at scale (10K, 100K, 1M emails/month)
  - Transactional email latency (<1 min for immediate alerts)
  - Template support and webhook tracking (open/click/bounce)
  - DKIM/SPF/DMARC setup complexity
- **Deliverable**: Provider recommendation with cost projection
- **NOTE**: This research was MISSING from the previous plan. Notifications spec references email but no provider evaluation existed.

#### R10. CDN Provider Selection [LOW] -- NOT STARTED (NEW)

- **Blocks**: 2.6 (Video Player -- HLS streaming), production media delivery
- **Timeline**: Days 10-11 (1 day)
- **Research questions**:
  - Compare Bunny CDN (preference) vs Cloudflare vs AWS CloudFront vs KeyCDN
  - HLS streaming support and token authentication
  - Cost at scale (1TB, 10TB, 100TB egress/month)
  - Geo-distribution coverage
  - Integration with S3-compatible origins (R2, B2, AWS S3)
  - CDN-agnostic abstraction layer design
- **Deliverable**: CDN architecture document with provider recommendation
- **NOTE**: This research was MISSING from the previous plan. CDN is listed as "TBD" in tech stack but no evaluation was planned.

#### R11. Adobe IMS / OAuth Integration [LOW] -- NOT STARTED (NEW)

- **Blocks**: 1.3 (Authentication -- Adobe ID login), 4.5 (Premiere Pro integration)
- **Timeline**: Days 12-13 (1 day)
- **Research questions**:
  - Adobe IMS OAuth 2.0 flow documentation and requirements
  - Developer console setup, app registration process
  - Token scopes needed for Bush integration
  - Adobe Creative Cloud user profile data available
  - Rate limits and usage restrictions
- **Deliverable**: Adobe IMS integration guide
- **NOTE**: This research was MISSING. Auth system references Adobe IMS but no research item existed. Can stub in 1.3 and fill in later.

### TIER 4: Week 3-4 (MEDIUM -- Before Phase 2 Viewers)

#### R3. Video Player Architecture [MEDIUM] -- NOT STARTED

- **Blocks**: 2.6 (Video Player)
- **Timeline**: Week 3-4
- **Research questions**:
  - Compare Video.js vs Shaka Player vs custom HTML5 player
  - Frame-accurate seeking across codecs (H.264 GOP challenges)
  - Annotation overlay approaches: Canvas, SVG, or WebGL
  - HLS.js integration for adaptive streaming
  - JKL shuttle controls with sub-frame accuracy
  - 4K and HDR content performance in browser
- **Deliverable**: Player architecture decision with prototype

### TIER 5: Phase 3+ (Defer until Phase 2 MVP complete)

#### R6. Transcription Service Selection [LOW] -- NOT STARTED

- **Blocks**: 3.4 (Transcription)
- **Timeline**: After Phase 2
- **Research questions**:
  - Compare AWS Transcribe vs Deepgram vs AssemblyAI vs self-hosted Whisper
  - 27-language coverage, speaker identification accuracy
  - Cost at scale (1K-100K hours/month)
  - Texas/Illinois biometric consent legal requirements
- **Deliverable**: Provider comparison matrix

#### R8. Search Scalability [LOW] -- NOT STARTED

- **Blocks**: 3.5 (Enhanced Search)
- **Timeline**: After Phase 2
- **Research questions**:
  - FTS5 benchmarks at 100K, 1M, 10M documents
  - Upgrade path: Meilisearch, Typesense, or Elasticsearch
- **Deliverable**: FTS5 benchmark report with upgrade triggers

---

## PRE-IMPLEMENTATION: MISSING SPECIFICATIONS

### Specification Gap Details

The following critical details are missing from existing specs and must be documented inline or in dedicated sections before implementation begins.

1. **Error Handling Strategy** (ALL PHASES) -- addressed by QW4
   - HTTP error code mapping, response format, client recovery patterns, logging thresholds

2. **Rate Limiting Detail** (Phase 1.5)
   - Per-endpoint limits (e.g., /upload 100 req/min vs /auth 10 req/min)
   - Anonymous vs authenticated limits, plan-based tiers
   - Rate limit headers (X-RateLimit-*), 429 with Retry-After

3. **Logging and Observability** (ALL PHASES)
   - Structured JSON logging (request_id, user_id, timestamp, level)
   - Metrics: latency percentiles, error rates, queue depths
   - Log retention policies

4. **Status Field Values** (Phase 2.10)
   - Enumerated values (e.g., "New", "In Review", "Approved", "Rejected", "Final")
   - Default status on upload, status change permissions

5. **Guest Role Limits** (Phase 1.4)
   - Max guests per account, session duration, permission constraints
   - Guest-accessible API endpoint whitelist

6. **Bulk Operation Semantics** (Phase 2.3, 2.4)
   - Max 200 items per operation, partial failure handling (best-effort vs all-or-nothing)
   - Progress tracking and cancellation

7. **Plan-Gated Feature Matrix** (ALL PHASES) -- addressed by S13
   - Explicit mapping of which features require which plan tier
   - Runtime enforcement via plan-gate middleware

### Specifications to Write

Ordered by when they block implementation.

#### Blocks Phase 1

| Spec | Status | Write By | Blocks |
|------|--------|----------|--------|
| specs/12-authentication.md | NOT STARTED | Days 1-3 | 1.3 (Auth) |
| specs/19-accessibility.md | NOT STARTED | Days 1-3 | Informs all UI |
| specs/11-security-features.md (expand) | NOT STARTED | Days 4-7 | 1.4 (Permissions) |
| specs/13-billing-and-plans.md | NOT STARTED | Days 4-7 | 3.7 (Lifecycle), 5.1 (Billing) |

#### Blocks Phase 2

| Spec | Status | Write By | Blocks |
|------|--------|----------|--------|
| specs/15-media-processing.md | NOT STARTED | Days 14-15 (after R4) | 2.2 (Processing) |
| specs/14-realtime-collaboration.md | NOT STARTED | Days 11-14 (start early) | 2.9 (Comments), 2.11 (Notifications) |

#### Blocks Phase 3+

| Spec | Status | Write By | Blocks |
|------|--------|----------|--------|
| specs/17-api-complete.md | NOT STARTED | Week 3-4 | 3.6 (Webhooks), Phase 4 |
| specs/16-storage-and-data.md | NOT STARTED | After R1 | 4.1 (Storage Connect) |
| specs/18-mobile-complete.md | NOT STARTED | After Phase 2 | 4.3 (iOS App) |

---

## PHASE 1: FOUNDATION

**Status**: NOT STARTED
**Goal**: Infrastructure, data models, auth, permissions, API, and web shell.
**Timeline**: Days 1-14

### 1.1 Project Bootstrap [NOT STARTED]

- Initialize monorepo structure (Bun workspace or Turborepo)
- Set up TypeScript configuration (shared tsconfig)
- Configure linting (ESLint + Prettier)
- Set up testing framework (Vitest)
- Configure CI/CD pipeline (GitHub Actions)
- Create development environment setup docs
- Include QW1 (File Type Registry) as part of bootstrap
- **Depends on**: R2 direction
- **Blocks**: Everything
- **Timeline**: Day 3
- **Spec refs**: `specs/README.md`

### 1.2 Database Schema and Core Data Models [NOT STARTED]

- SQLite schema with indexes, foreign keys, check constraints, triggers
- Core models: Account, User, Workspace, Project, Folder, File, VersionStack, Comment, Share, CustomField, CustomFieldValue, Webhook, Notification, AuditLog
- Hierarchy: Account > Workspace > Project > Folder > File
- ORM: Drizzle ORM (supports SQLite + PostgreSQL migration)
- Migration system, schema validation tests
- QW2 (Seed Data) included
- **Depends on**: 1.1
- **R1 informs config only** (WAL mode, pooling, backup)
- **Blocks**: 1.3, 1.5, all Phase 2+
- **Timeline**: Days 4-7
- **Spec refs**: `specs/00-atomic-features.md` Section 2, `specs/00-complete-support-documentation.md` Section 3.1

### 1.3 Authentication System [NOT STARTED]

- Email/password (bcrypt, min 8 chars)
- OAuth 2.0: Google, Apple, Adobe IMS (R11 informs details, can stub)
- 2FA (TOTP with QR), Redis sessions (TTL), JWT access (1hr) + refresh (30 days)
- Secure cookies (httpOnly, secure, sameSite)
- Account switcher, account roles
- Integration tests
- **Depends on**: 1.2, specs/12-authentication.md
- **Blocks**: 1.4, 1.5
- **Timeline**: Days 8-10
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 1.2, 1.3

### 1.4 Permission System [NOT STARTED]

- Five levels, three models (Workspace/Project/Folder Permission)
- Inheritance (cannot lower), restricted project/folder logic
- Access Groups (Team+), Guest constraints (1 project max)
- Permission check middleware, edge-case tests
- **Depends on**: 1.2, 1.3
- **Blocks**: 1.5, all Phase 2+
- **Timeline**: Days 11-12
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 2.1-2.5, `specs/11-security-features.md`

### 1.5 RESTful API Foundation (V4) [NOT STARTED]

- Bun HTTP server with Hono or Elysia
- Auth middleware, rate limiting (leaky bucket, per-endpoint)
- Cursor pagination (50 default, 100 max)
- CRUD for all core resources
- Plan-gate middleware for tier-restricted features
- QW4 (Error Utilities) integrated
- OpenAPI spec generation
- Integration tests
- **Depends on**: 1.3, 1.4
- **Blocks**: 1.7b, all Phase 2+
- **Timeline**: Days 11-14
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 21.1-21.6

### 1.6 Object Storage Layer [NOT STARTED]

- Provider-agnostic S3 interface
- Pre-signed URLs (upload + download), multipart upload
- Key structure: `{account_id}/{project_id}/{file_id}/{type}/{filename}`
- Storage quota tracking
- Dev storage (MinIO or B2 free tier)
- **Depends on**: 1.1 only
- **Blocks**: 2.1, 2.2
- **Timeline**: Days 3-4
- **Spec refs**: `specs/00-atomic-features.md` Section 4.2, 14.1

### 1.7 Web Application Shell [NOT STARTED]

Split into 1.7a (static, Days 3-10) and 1.7b (connected, Days 11-14):

- Next.js 15+ with App Router, TypeScript
- QW3 (Component Library) built first
- Pages: login, signup, dashboard, workspaces, projects, settings
- Multi-panel layout, global navigation, responsive design
- Auth flows UI, state management (React Context + TanStack Query)
- Component tests
- **Depends on**: 1.1 (for 1.7a), 1.5 + 1.3 (for 1.7b)
- **Blocks**: all Phase 2 frontend
- **Timeline**: Days 3-14
- **Spec refs**: `specs/00-atomic-features.md` Section 1.4, 5.3, `specs/03-file-management.md`

---

## PHASE 2: CORE FEATURES (MVP)

**Status**: NOT STARTED
**Blocked by**: Phase 1 completion
**Goal**: Upload, view, comment, metadata, search, notifications.

### 2.1 File Upload System [NOT STARTED]

- Drag-and-drop (files + folders), MIME validation via QW1 (file type registry)
- Chunked upload (10MB chunks, 3-5 parallel, IndexedDB resume)
- Upload queue UI: progress, pause/resume, priority, cancel, retry
- Folder structure preservation, constraints enforcement
- Backend: pre-signed URLs, file records, completion, processing enqueue
- **Depends on**: 1.5, 1.6, 1.7b
- **Blocks**: 2.2, 2.3
- **Timeline**: Week 3
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 4.1-4.3

### 2.2 Media Processing Pipeline [NOT STARTED]

- BullMQ + Redis, configurable worker concurrency
- **Video**: thumbnails (3 sizes), filmstrips (1-sec sprites), proxy transcoding (360p-4K), HDR tone mapping
- **Image**: thumbnails, proxy generation for RAW/Adobe/HDR
- **Audio**: waveform extraction (JSON peaks + PNG visualization) (NEW -- previously underspecified)
- **Document**: PDF proxy, DOCX/PPTX/XLSX conversion (LibreOffice headless), Interactive ZIP preparation (NEW)
- FFprobe metadata extraction (33 fields)
- Job priorities, retry (3x exponential backoff), status tracking, WebSocket progress
- **Depends on**: 2.1, 1.6, specs/15-media-processing.md, R4
- **Blocks**: 2.3, all viewers (2.6-2.8b)
- **Timeline**: Week 3-4
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.4

### 2.3 Asset Browser and Navigation [NOT STARTED]

- Grid view (adjustable card sizes), list view (sortable columns)
- Thumbnail display options, file type icons from QW1
- Flatten folders, multi-level sorting, drag-and-drop
- Multi-select (max 200), bulk actions
- Virtualized lists, lazy thumbnail loading
- Viewer routing based on file type registry (routes to 2.6, 2.7, 2.8a, or 2.8b)
- **Depends on**: 1.5, 2.1, 2.2, 1.4
- **Blocks**: 2.4-2.8b
- **Timeline**: Week 4
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 4.2, 6.4

### 2.4 Asset Operations [NOT STARTED]

- Copy To, Move To, Delete (soft, 30-day), Recover, Permanent Delete
- Download Original/Proxy, Custom Thumbnail
- Auto-delete scheduled job (BullMQ daily)
- **Depends on**: 2.3, 1.4, 1.6
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.6

### 2.5 Version Stacking [NOT STARTED]

- VersionStack model, drag-to-create, auto numbering
- Version list UI, set current, compare, download specific
- Comments persist across versions (linked to stack)
- **Depends on**: 2.1, 2.3
- **Blocks**: 3.3 (Comparison Viewer)
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 4.5

### 2.6 Video Player [NOT STARTED]

- Base player (Video.js or per R3), frame-accurate seeking
- JKL shuttle, playback speed 0.25x-1.75x, in/out points
- HLS adaptive streaming (360p-4K), CDN delivery (requires R10)
- Frame guides, timeline with filmstrip hover, comment markers
- Loop, keyboard shortcuts, volume, mute, fullscreen
- **Depends on**: 2.3, 2.2, R3, R10
- **Blocks**: 2.9, 3.3
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 9.1-9.4

### 2.7 Image Viewer [NOT STARTED]

- Zoom 25%-400% (mouse wheel, buttons, slider), zoom to cursor
- Pan, fit-to-screen, 1:1 pixel view
- Mini-map for large images (>2000px)
- Formats: standard, RAW (via proxy), Adobe (via proxy), HDR (via tone-mapped proxy)
- **Depends on**: 2.3, 2.2
- **Blocks**: 2.9
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 9.5

### 2.8a Audio Player [NOT STARTED] -- NEW

- **Waveform visualization**: render from processing pipeline JSON peak data, interactive (click to seek)
- **Playback controls**: play/pause, seek via waveform, volume slider, mute toggle
- **Playback speed**: 0.25x to 1.75x
- **Time display**: current position / total duration, formatted as HH:MM:SS
- **Comment integration**: timestamped comment markers on waveform timeline
- **Range playback**: in/out points on waveform (I/O keys)
- **Keyboard shortcuts**: Space (play/pause), Left/Right (seek), M (mute), J/K/L (shuttle)
- **Format support**: AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA (all 8 audio formats from spec)
- **Depends on**: 2.3, 2.2 (waveform data)
- **Blocks**: 2.9 (timestamped comments on audio)
- **NOTE**: This was completely MISSING from the previous plan. The specs list 8 audio formats as supported (`specs/00-atomic-features.md` Section 4.3) and reference audio waveform extraction (`specs/00-complete-support-documentation.md` Section 4.4), but no audio viewer was planned.
- **Spec refs**: `specs/00-atomic-features.md` Section 4.3, `specs/00-complete-support-documentation.md` Section 4.4

### 2.8b PDF and Document Viewer [NOT STARTED] -- EXPANDED

- **PDF Viewer**: PDF.js, multi-page nav (thumbnails, prev/next, page jump), zoom (in/out, fit width, fit page, actual size), text selection/copy, search within PDF, page rotation
- **Document Viewer (DOCX/PPTX/XLSX)**: render server-generated PDF/image previews from processing pipeline (2.2), page navigation, zoom (NEW)
- **Interactive ZIP Viewer**: sandboxed iframe rendering, security constraints (no external network, limited API surface) (NEW)
- **Depends on**: 2.3, 2.2
- **Blocks**: 2.9 (page-stamped comments)
- **NOTE**: Previous plan only had "PDF Viewer" (2.8). Now expanded to cover all 5 document formats listed in specs: PDF, DOCX, PPTX, XLSX, Interactive ZIP.
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 9.6, `specs/00-atomic-features.md` Section 4.3

### 2.9 Comments and Annotations [NOT STARTED]

- Types: single-frame, range-based, anchored, internal, public
- Linked to VersionStack, threaded replies
- Body: markdown, emoji, @mentions, hashtags, color hex
- Attachments (6 max, Pro+ plan gate)
- Annotation tools: free draw, line, arrow, rectangle, colors, undo/redo
- Canvas overlay on **all four viewer types** (video, image, audio waveform, PDF/document)
- Comment panel: thread view, filter/sort, quick actions, export (CSV, text, EDL)
- Real-time WebSocket sync, optimistic updates
- **Depends on**: 2.6, 2.7, 2.8a, 2.8b, 1.4, R7, specs/14-realtime-collaboration.md
- **Blocks**: 2.11, 3.1
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 8.1-8.6

### 2.10 Metadata System [NOT STARTED]

- 33 built-in fields, 10 custom field types
- Account-wide library, per-project visibility, field permissions
- Inspector panel (right sidebar), bulk edit, metadata badges
- Persists on copy/move/duplicate
- **Depends on**: 1.2, 2.1, 2.2, 1.4
- **Blocks**: 2.12, 3.2
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 6.1-6.3

### 2.11 Notifications System [NOT STARTED]

- Types: @mentions, comment replies, uploads, status changes, share activity
- In-app: real-time WebSocket, bell icon, unread count, mark as read
- Email: daily digest (9am local), immediate alerts (<1 min)
- Email service integration (per R9 research -- NEW dependency)
- Email templates, BullMQ scheduled jobs, debouncing
- Per-project settings, per-asset subscription, user preferences UI
- **Depends on**: 2.9, 1.4, R7, R9, specs/14-realtime-collaboration.md
- **Blocks**: 3.1
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 13.1-13.2

### 2.12 Basic Search [NOT STARTED]

- SQLite FTS5, BM25 ranking, triggers for index sync
- Typeahead (2+ chars, 300ms debounce), global search (Cmd+K), project search (Cmd+F)
- Thumbnail previews, filter refinement (type, date, project)
- Permission-filtered results
- **Depends on**: 1.2, 2.10
- **Blocks**: 3.2, 3.5
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 12.1, 12.3

---

## PHASE 3: ADVANCED FEATURES

**Status**: NOT STARTED
**Blocked by**: Phase 2 completion
**Goal**: Sharing, workflow tools, transcription, search, webhooks, lifecycle.

### 3.1 Sharing and Presentations [NOT STARTED]

- Types: public, secure (email invites)
- Layouts: grid, reel, open-in-viewer
- Settings: passphrase, expiration, permissions, featured field
- Custom branding: icon, header, background, description, light/dark, accent colors
- WYSIWYG share builder, share operations, activity tracking
- External reviewer types: authenticated, identified, unidentified
- Share notification emails
- **Depends on**: 2.9, 2.6, 2.10, 2.11, 1.4
- **Blocks**: 3.2
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 11, `specs/05-sharing-and-presentations.md`

### 3.2 Collections [NOT STARTED]

- Types: team, private
- Dynamic filtering (AND/OR logic), filter rule builder
- Real-time sync, manual addition, custom sort
- Share entire Collection
- **Depends on**: 2.10, 2.12, 3.1
- **Spec refs**: `specs/00-complete-support-documentation.md` Section 7, `specs/02-workflow-management.md`

### 3.3 Comparison Viewer [NOT STARTED]

- Side-by-side (video, image, or mixed)
- Linked mode (synced playback/zoom/pan), independent mode
- Adjustable split divider, swap sides
- Launch from: browser (select 2), version stack, collection
- **Depends on**: 2.6, 2.7, 2.5

### 3.4 Transcription and Captions [NOT STARTED]

- Provider integration (per R6), 27 languages, speaker ID
- Editable transcripts, time-synced highlighting, auto-scroll
- Caption generation (VTT, SRT), export (SRT, VTT, TXT), ingest (upload SRT/VTT)
- Transcript searchable via global search
- Consent modal for speaker ID (Texas/Illinois legal)
- **Depends on**: 2.6, 2.8a (for audio transcription), 2.2, 2.12, R6

### 3.5 Enhanced Search (Media Intelligence) [NOT STARTED]

- Visual search (Vision API), transcript search, semantic search
- Natural language query parsing
- Upgrade to dedicated search engine if needed (per R8)
- **Depends on**: 2.12, 3.4, R8

### 3.6 Webhook System [NOT STARTED]

- CRUD: URL, events, secret
- Events: asset.*, comment.*, share.*, status.changed, transcription.completed
- HMAC-SHA256 signature, BullMQ delivery, 3x retry
- Delivery logs UI
- **Depends on**: 1.5, specs/17-api-complete.md
- **Blocks**: Phase 4

### 3.7 Asset Lifecycle Management [NOT STARTED]

- Workspace-level defaults (30/60/90 days or custom)
- Per-asset override, expiration indicators
- Reset lifecycle, daily BullMQ expiration job
- 30-day recovery period
- **Depends on**: 1.6, 2.10, specs/13-billing-and-plans.md

---

## PHASE 4: INTEGRATIONS AND NATIVE APPS

**Status**: NOT STARTED
**Blocked by**: Phase 2 API completion, some Phase 3 features
**Goal**: Native apps and third-party integrations.

### 4.1 Storage Connect [NOT STARTED]

- Customer-owned AWS S3 bucket (read/write primary, read-only additional)
- Bush proxies stored separately
- **Depends on**: 1.6, 1.5, specs/16-storage-and-data.md

### 4.2 Bush Transfer Desktop App [NOT STARTED]

- Tauri, desktop upload with watch folders
- **Depends on**: 1.5, 2.1
- **Spec refs**: `specs/09-transfer-app.md`

### 4.3 iOS / iPadOS App [NOT STARTED]

- Native Swift (iOS/iPadOS 17.0+), full feature parity
- **Depends on**: Phase 2 API, specs/18-mobile-complete.md
- **Spec refs**: `specs/08-ios-ipad-apps.md`

### 4.4 Apple TV App [NOT STARTED]

- Native Swift (tvOS), video playback focused
- **Depends on**: 4.3 (shared Swift codebase)

### 4.5 Adobe Premiere Pro Integration [NOT STARTED]

- Extension panel (CC 2019+), upload, comment sync as markers
- **Depends on**: 1.5, 2.9, 2.1, 3.6, R11
- **Spec refs**: `specs/10-integrations.md`

### 4.6 Other Integrations [NOT STARTED]

- Adobe Lightroom, Final Cut Pro, DaVinci Resolve, Avid
- Camera to Cloud (C2C) partners
- Automation: Zapier, Make, n8n
- **Depends on**: 1.5, 3.6
- **Spec refs**: `specs/07-camera-to-cloud.md`, `specs/10-integrations.md`

---

## PHASE 5: ENTERPRISE AND SCALE

**Status**: NOT STARTED
**Blocked by**: Production deployment and customer feedback

### 5.1 Billing and Plan Management [NOT STARTED]

- Tiers: Free (2GB), Pro (2TB+2TB/member), Team (3TB+2TB/member), Enterprise (custom)
- Stripe integration, upgrade/downgrade, overage handling
- **Depends on**: specs/13-billing-and-plans.md

### 5.2 Security Compliance [NOT STARTED]

- SOC 2 Type 2, TPN+ Gold Shield, ISO 27001
- Forensic watermarking, audit log retention/export
- **Depends on**: specs/11-security-features.md (expanded)

### 5.3 Enterprise Administration [NOT STARTED]

- SAML/SSO, org-wide policies, advanced audit logging
- IP allowlisting, geo-restrictions
- **Depends on**: specs/12-authentication.md

### 5.4 Performance and Scale Optimization [NOT STARTED]

- SQLite to PostgreSQL migration (if R1 triggers)
- FTS5 to dedicated search (if R8 triggers)
- CDN optimization, multi-region
- **Depends on**: Production metrics

### 5.5 SDK Publication [NOT STARTED]

- TypeScript/JavaScript SDK, Python SDK
- Code generation from OpenAPI spec

### 5.6 Internationalization [NOT STARTED]

- i18n framework in Next.js and iOS
- Translation, RTL support

---

## DEPENDENCY GRAPH

```
RESEARCH (prioritized by tier)
================================
TIER 1 (Week 1) -- CRITICAL:
R2 (Deployment)   --> 1.1 (Bootstrap) [Days 1-2, BLOCKING]
R1 (SQLite)       --> 1.2 config [Days 1-6, informs config not design]

TIER 2 (Week 2-3) -- HIGH:
R4 (Transcoding)  --> specs/15 --> 2.2 (Processing) [Days 7-14]
R5 (Upload)       --> 2.1 optimization [Days 7-21, basic works without]
R7 (Realtime)     --> specs/14 --> 2.9, 2.11 [Days 14-21]

TIER 3 (Week 2) -- LOW, quick decisions:
R9 (Email)        --> 2.11 (Notifications) [Days 8-9]     ** NEW **
R10 (CDN)         --> 2.6 (Video streaming) [Days 10-11]  ** NEW **
R11 (Adobe OAuth)  --> 1.3 (Auth, can stub) [Days 12-13]  ** NEW **

TIER 4 (Week 3-4) -- MEDIUM:
R3 (Video Player) --> 2.6 (Video Player) [Week 3-4]

TIER 5 (Phase 3+) -- LOW:
R6 (Transcription) --> 3.4 [Defer]
R8 (Search)        --> 3.5 [Defer]

SPECS (must write before implementing)
================================
specs/12-authentication.md     --> 1.3 (Auth) [Days 1-3]
specs/19-accessibility.md      --> informs all UI [Days 1-3]
specs/11-security (expand)     --> 1.4 (Permissions) [Days 4-7]
specs/13-billing-and-plans.md  --> 3.7, 5.1 [Days 4-7]
specs/14-realtime-collab.md    --> 2.9, 2.11 [Days 11-14, START EARLY]  ** MOVED EARLIER **
specs/15-media-processing.md   --> 2.2 (Processing) [Days 14-15]
specs/17-api-complete.md       --> 3.6, Phase 4 [Week 3-4]
specs/16-storage-and-data.md   --> 4.1 [Defer]
specs/18-mobile-complete.md    --> 4.3 [Defer]

QUICK WINS (built inline)
================================
QW1 (File Type Registry)   --> built with 1.1, used by 2.1, 2.2, 2.3
QW2 (Seed Data)            --> built with 1.2, used by all testing
QW3 (Component Library)    --> built with 1.7a, used by all frontend
QW4 (Error Utilities)      --> built with 1.5, used by all API routes

PHASE 1 CRITICAL PATH
================================
1.1 (Bootstrap + QW1)
 |-- 1.6 (Object Storage) [Days 3-4]
 |-- 1.7a (Web Shell static + QW3) [Days 3-10]
 '-- 1.2 (Database + QW2) [Days 4-7]
      '-- 1.3 (Auth) [Days 8-10]
           '-- 1.4 (Permissions) [Days 11-12]
                '-- 1.5 (API + QW4) [Days 11-14]
                     '-- 1.7b (Web Shell connected) [Days 13-14]

PHASE 2 CRITICAL PATH
================================
1.6 + 1.7b + 1.5
 '-- 2.1 (Upload) [Week 3]
      '-- 2.2 (Processing) [Week 3-4]
           '-- 2.3 (Asset Browser) [Week 4]
                |-- 2.4 (Asset Operations)
                |-- 2.5 (Version Stacking)
                |-- 2.6 (Video Player) + 2.7 (Image) + 2.8a (Audio) + 2.8b (PDF/Doc)
                |    '-- 2.9 (Comments & Annotations)
                |         '-- 2.11 (Notifications)
                '-- 2.10 (Metadata)
                     '-- 2.12 (Search)

PHASE 3 DEPENDENCIES
================================
2.9 + 2.6 + 2.10 + 2.11     --> 3.1 (Sharing)
2.10 + 2.12 + 3.1            --> 3.2 (Collections)
2.6 + 2.7 + 2.5              --> 3.3 (Comparison)
2.6 + 2.8a + 2.2 + 2.12     --> 3.4 (Transcription)  ** 2.8a ADDED **
2.12 + 3.4                   --> 3.5 (Enhanced Search)
1.5                          --> 3.6 (Webhooks)
1.6 + 2.10                   --> 3.7 (Lifecycle)
```

---

## CHANGE LOG FROM PREVIOUS PLAN

This section documents all material changes made in this update for traceability.

### New Items Added

1. **2.8a Audio Player** -- Platform supports 8 audio formats and specifies waveform extraction, but previous plan had no audio viewer component. Added with full specification.

2. **2.8b expanded to include Document Viewer and Interactive ZIP** -- Previous 2.8 was "PDF Viewer" only. Specs list DOCX, PPTX, XLSX, and Interactive ZIP as supported formats but had no rendering plan.

3. **R9 (Email Service Provider Research)** -- Notifications spec references email delivery but no provider evaluation existed. Added as quick 1-day research.

4. **R10 (CDN Provider Selection)** -- CDN listed as "TBD" in tech stack with no research item. Added as quick 1-day research.

5. **R11 (Adobe IMS / OAuth)** -- Authentication references Adobe ID but no research item existed. Added as quick 1-day research.

6. **QW1-QW4 (Quick Wins)** -- Component library, seed data, error utilities, and file type registry added as early inline tasks to prevent inconsistency.

7. **Risk 5 (Missing Audio/Document Viewer)** and **Risk 6 (CDN/Email lock-in)** added to risk register.

### Items Modified

8. **R4 (Media Transcoding)** expanded to include document rendering research (LibreOffice headless) and audio waveform tool comparison.

9. **2.2 (Media Processing Pipeline)** expanded to explicitly cover audio waveform generation and document conversion.

10. **specs/14-realtime-collaboration.md** writing schedule moved earlier (Days 11-14 instead of "after R7") to prevent it from blocking Comments and Notifications.

11. **2.9 (Comments)** dependency list updated to include 2.8a (Audio Player) since comments need to work on audio waveforms.

12. **3.4 (Transcription)** dependency updated to include 2.8a since audio files also need transcription.

13. **Plan-gate middleware** added to 1.5 (API) to enforce tier-restricted features at runtime.

14. **specs/13-billing-and-plans.md** expanded to require explicit plan-gated feature matrix.

### Structure Changes

15. **Quick Wins section** added as top-level section for visibility.

16. **Iteration 0 to 1 section** restructured with numbered items extending into post-Iteration 1 priorities (items 25-34).

17. **Email Service** added to locked technology stack table (was missing despite being required for notifications).

18. **Dependency graph** updated with new research items (R9, R10, R11), new viewers (2.8a, 2.8b), and quick wins.
