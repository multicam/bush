# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-16
**Project status**: Iteration 1 in progress
**Implementation progress**: [1.1] Bootstrap Project COMPLETED, [1.2] Database Schema COMPLETED, [1.3] Authentication System IN PROGRESS (WorkOS integration, session cache, middleware done), [1.4] Permission System COMPLETED, [1.6] Object Storage COMPLETED, [QW1] File Type Registry COMPLETED, [QW2] Seed Data COMPLETED, [QW3] Component Library Foundation partially COMPLETED (CSS variables), [QW4] Error Handling Utilities COMPLETED.
**Source of truth for tech stack**: `specs/README.md` (lines 37-58)

### KNOWN IMPLEMENTATION NOTES

1. **Bun AVX Issue**: Bun crashes on CPUs without AVX support. Node.js + tsx is being used instead for development. This affects the runtime but does not change the target tech stack (Bun remains the target for production on AVX-capable servers).
2. **Package Manager**: Using npm with package-lock.json for development (not bun.lock) due to AVX issue. CI workflow uses Node.js 22.

### KNOWN SPEC INCONSISTENCIES (Resolve Before Implementation)

1. **Token TTL mismatch**: `specs/12-authentication.md` (lines 74-75) says access token TTL = 5 minutes, refresh token TTL = 7 days. `specs/17-api-complete.md` (lines 33-34) says access token = 1 hour, refresh token = 30 days. **Must resolve before Phase 1.3 (Authentication).**
   - **Resolution Options**:
     - Option A: Update `specs/17-api-complete.md` lines 33-34 to 5 min / 7 days (security-focused, recommended)
     - Option B: Update `specs/12-authentication.md` lines 74-75 to 1 hour / 30 days (usability-focused)
   - **Decision deadline**: Before Phase 1.3 (Authentication)

2. **README deferral labels**: `specs/README.md` (lines 43-45) defers `13-billing-and-plans.md` to Phase 5 and `19-accessibility.md` to Phase 3+. These are needed earlier per this plan's blocking dependencies.
   - **ACTION**: When specs/13-billing-and-plans.md and specs/19-accessibility.md are written, update `specs/README.md` to remove the "Phase 3+" and "Phase 5" deferral labels.

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
| Backend API | Bun + TypeScript | RESTful V4 API, WebSockets; OAuth 2.0 via WorkOS (not custom) |
| **Authentication** | **WorkOS AuthKit** | **Email/password, social login, MFA, SSO -- all delegated. See `specs/12-authentication.md`** |
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
   - **Deliverable**: `docs/deployment-architecture.md` (to be created)
   - **Priority**: CRITICAL -- informs project structure
   - **Spec refs**: none (new document to create)

2. **[1.1] Bootstrap Project** [1 day, starts Day 2-3 after R2 direction is clear] -- COMPLETED
   - Initialize monorepo structure (Bun workspace or Turborepo) -- COMPLETED
   - Set up TypeScript configuration (shared tsconfig), ESLint, Prettier -- COMPLETED
   - Set up Vitest testing framework -- COMPLETED
   - Configure GitHub Actions CI/CD pipeline -- COMPLETED (using Node.js 22 + npm due to Bun AVX issue)
   - **Set up Redis** (local dev: install via system package manager or Homebrew; staging/prod: select managed provider -- Upstash, Redis Cloud, or self-hosted). Redis is required by: session cache (1.3), rate limiting (1.5), BullMQ job queues (2.2), WebSocket pub/sub (2.9), and presence (realtime). -- COMPLETED (documented, not installed)
   - **Create `.env.example`** with all 47 environment variables from `specs/20-configuration-and-secrets.md` Section 3 (WorkOS, Redis, S3, database, FFmpeg, session, rate limiting, upload, backup, etc.) -- COMPLETED
   - **Create `.env.test`** for deterministic test configuration per `specs/20-configuration-and-secrets.md` Section 8 -- COMPLETED
   - **Create `.gitignore`** with comprehensive rules per `specs/20-configuration-and-secrets.md` Section 9 -- COMPLETED
   - **Set up Zod config validation** at startup per `specs/20-configuration-and-secrets.md` Section 4 (fail fast on missing/invalid config) -- COMPLETED
   - **Resolve Next.js + Bun API architecture**: Does Bun serve as the Next.js runtime (single process) or is there a separate Bun HTTP server alongside Next.js (two processes)? This is the most consequential architectural decision and must be answered by R2 before Bootstrap proceeds. If separate: define the port/routing strategy and CORS configuration. -- NOT STARTED
   - Create development environment setup docs (reference `specs/20-configuration-and-secrets.md` Section 7 for MinIO, Mailpit, Redis local setup) -- NOT STARTED
   - **Depends on**: R2 direction (not full completion)
   - **Blocks**: Everything else
   - **Spec refs**: `specs/README.md`, `specs/20-configuration-and-secrets.md`
   - **NOTE**: Bun crashes on CPUs without AVX support. Node.js + tsx is being used instead for development.

3. **[QW1] Create File Type Registry** [0.5 day, part of Bootstrap] -- COMPLETED
   - Central registry mapping MIME types to file categories (video/audio/image/document) -- COMPLETED
   - Include all 100+ supported formats from `specs/00-atomic-features.md` Section 4.3 -- COMPLETED
   - Include codec validation rules per container format -- COMPLETED
   - Used by: upload validation, processing pipeline, viewer routing, asset browser icons
   - **Rationale**: Every component needs to know file types; build once, share everywhere
   - **Spec refs**: `specs/00-atomic-features.md` Section 4.3, `specs/00-complete-support-documentation.md` Section 4.3
   - **Implementation**: Functions `getFileCategory`, `getViewerType`, `isValidCodec`, `getProcessingPipeline`, etc. with full test coverage.

**Spec Writing Stream:**

4. **[S12] Review specs/12-authentication.md** [0.5 day] -- NOT STARTED
   - **NOTE**: specs/12-authentication.md is COMPLETE (235 lines, 9.5K). It specifies WorkOS AuthKit integration, NOT custom auth.
   - Review spec for completeness against implementation needs
   - Confirm WorkOS AuthKit SDK setup steps, session cache design, role definitions
   - Validate guest/reviewer access tier flows are implementation-ready
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

7. **[1.6] Set up Object Storage** [1 day] -- COMPLETED
   - Implement provider-agnostic S3-compatible storage interface per `specs/16-storage-and-data.md` -- COMPLETED
   - Choose initial provider (Cloudflare R2 for zero egress, or Backblaze B2 for low cost) -- COMPLETED (supports R2, MinIO, B2, AWS S3)
   - Configure pre-signed URL generation (upload and download) -- COMPLETED
   - Implement multipart upload support -- COMPLETED
   - Define storage key structure: `{account_id}/{project_id}/{file_id}/{type}/{filename}` -- COMPLETED
   - Set up development storage (MinIO -- see detailed setup instructions in `specs/20-configuration-and-secrets.md` Section 7) -- COMPLETED
   - **Depends on**: 1.1 (Bootstrap)
   - **Does NOT depend on R1 or R5** -- basic storage needs no scale research
   - **Spec refs**: `specs/00-atomic-features.md` Section 4.2, 14.1

8. **[1.2] Design Database Schema** [2 days] -- COMPLETED
   - Design SQLite schema with proper indexes and foreign keys -- COMPLETED
   - Core models: Account, User, Workspace, Project, Folder, File, VersionStack, Comment, Share, CustomField, Webhook, Notification -- COMPLETED (Account, User, AccountMembership, Workspace, Project, Folder, File, VersionStack, Comment, Share, Notification)
   - Hierarchy enforcement: Account > Workspace > Project > Folder > File -- COMPLETED
   - Foreign key constraints, check constraints, triggers for cascades -- COMPLETED
   - Choose and configure ORM/query builder (Drizzle ORM recommended -- supports SQLite + PostgreSQL migration path) -- COMPLETED (Drizzle ORM)
   - Create migration system -- COMPLETED (src/db/migrate.ts)
   - Write schema validation tests -- NOT STARTED (basic functionality verified via seed script)
   - **Depends on**: 1.1 (Bootstrap)
   - **R1 dependency softened**: R1 informs configuration (WAL mode, connection pooling), not schema design
   - **Spec refs**: `specs/00-atomic-features.md` Section 2, `specs/00-complete-support-documentation.md` Section 3.1

9. **[QW2] Create Seed Data Scripts** [0.5 day, alongside 1.2] -- COMPLETED
   - Generate realistic development data: accounts, users, workspaces, projects, folders -- COMPLETED
   - Include multiple permission levels and roles to test edge cases -- COMPLETED
   - Create deterministic seed (same data every run) and random seed (fuzz testing) -- COMPLETED
   - Include sample file records (no actual files -- just metadata for testing) -- COMPLETED
   - **Depends on**: 1.2 (Database Schema)
   - **Blocks**: nothing, but accelerates all testing

**Spec Writing Stream (continued):**

10. **[S11] ~~Expand specs/11-security-features.md~~ -- REMOVED** [0 days]
    - **CORRECTION**: specs/11-security-features.md is COMPLETE (400 lines, 16K). Previous plan incorrectly stated "only 38 lines".
    - Spec already covers: Access Groups data model, audit logging, forensic watermarking (visible/invisible, HLS integration), 2FA enforcement, IP allowlisting, permission levels, and organization-wide security policies.
    - **No action needed** -- spec is implementation-ready for Phase 1.4 (Permissions) and Phase 5.2 (Security Compliance).
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
    - Implement authentication flows UI (WorkOS AuthKit hosted login, post-auth routing, account switcher, role indicators)
    - Set up state management (React Context for auth/workspace, TanStack Query for server state)
    - **Depends on**: 1.1 (Bootstrap)
    - **Can start before API (1.5)** -- build static shell first, connect to API in Week 2
    - **Spec refs**: `specs/00-atomic-features.md` Section 1.4, 5.3, `specs/03-file-management.md`

13. **[QW3] Set up Component Library Foundation** [0.5 day, part of 1.7a] -- PARTIALLY COMPLETED
    - Create shared UI primitives: Button, Input, Select, Modal, Toast, Dropdown, Tooltip -- NOT STARTED
    - Define design tokens (colors, spacing, typography, shadows) as CSS variables -- COMPLETED
    - Set up Storybook or simple component documentation page -- NOT STARTED
    - Establish consistent error state patterns (loading, empty, error for every data-fetching component) -- NOT STARTED
    - Follow specs/19-accessibility.md guidelines from the start (ARIA, keyboard nav, focus management) -- NOT STARTED
    - **Rationale**: Every frontend task needs these; building ad-hoc leads to inconsistency
    - **Spec refs**: `specs/19-accessibility.md` (when written)

### Week 2 (Days 8-14): Authentication, Permissions, API

14. **[1.3] Build Authentication System (WorkOS AuthKit)** [3 days] -- NOT STARTED
    - **NOTE**: Authentication is delegated to WorkOS AuthKit per `specs/12-authentication.md`. Bush does NOT build custom email/password, OAuth, MFA, or JWT issuance.
    - Install and configure `@workos-inc/authkit-nextjs` SDK
    - Set up WorkOS organization and environment variables (API key, client ID, redirect URIs)
    - Implement server-side session validation middleware (App Router middleware-based route protection)
    - Build Redis session cache layer (key: `session:{user_id}:{session_id}`, TTL matches refresh token)
    - Implement account role system (Owner, Content Admin, Member, Guest, Reviewer) -- Bush-managed, not WorkOS
    - Build permission mapping for account roles (role assignment, role change with cache invalidation)
    - Implement account switcher UI and logic (multi-account context switching without re-auth)
    - Create guest/reviewer share-link access flows (3 tiers: authenticated, identified, unidentified)
    - Secure cookie configuration (httpOnly, secure, sameSite=lax, domain=.bush.app)
    - Adobe IMS OAuth stub (R11 informs details, full implementation Phase 4)
    - Integration tests for WorkOS authentication flows
    - **Depends on**: 1.2 (Database Schema), specs/12-authentication.md (COMPLETE)
    - **Blocks**: 1.4, 1.5
    - **Spec refs**: `specs/12-authentication.md`, `specs/00-complete-support-documentation.md` Sections 1.2, 1.3
    - **NOTE**: WorkOS handles identity verification, social auth, MFA, SSO, and token issuance. This may be faster than originally estimated (custom auth). Timeline kept at 3 days to account for role system, guest access, and account switcher complexity.

15. **[1.4] Build Permission System** [2 days] -- COMPLETED
    - Five permission levels: Full Access, Edit and Share, Edit, Comment Only, View Only -- DONE (PermissionLevel type with hierarchy)
    - Permission models: WorkspacePermission, ProjectPermission, FolderPermission -- DONE (schema tables added)
    - Permission inheritance: Workspace > Project > Folder (cannot lower inherited permissions) -- DONE (service with inheritance logic)
    - Restricted Project/Folder logic (breaks inheritance chain, invite-only) -- DONE (service handles restricted resources)
    - Access Groups for bulk permission management (Team+ feature -- plan gate check) -- PENDING (deferred to Phase 5)
    - Permission check middleware for API routes -- DONE (src/permissions/middleware.ts)
    - Guest role constraints: 1 project max, cannot invite others, cannot delete -- DONE (defined in types)
    - Extensive permission edge-case tests (see permission matrices in `specs/00-complete-support-documentation.md` 2.4, 2.5) -- DONE (31 unit tests, 18 integration tests)
    - Integration tests with database -- DONE (src/permissions/permissions-integration.test.ts)
    - **Depends on**: 1.2, 1.3
    - **Blocks**: 1.5, all Phase 2+
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 2.1-2.5, `specs/11-security-features.md`

16. **[QW4] Build Error Handling Utilities** [0.5 day, alongside 1.5] -- COMPLETED
    - Standardized API error response format matching `specs/00-atomic-features.md` Section 18.7-18.8 -- DONE (JSON:API format)
    - HTTP error code mapping: 400, 401, 403, 404, 409, 422, 429, 500, 503 -- DONE
    - Error class hierarchy: ValidationError, AuthError, ForbiddenError, NotFoundError, RateLimitError -- DONE (src/errors/index.ts)
    - Client-side error recovery patterns (retry logic, error boundary components) -- PENDING (deferred to frontend work)
    - Structured error logging (JSON with request_id, user_id, timestamp, level) -- DONE (errorLogger utility)
    - **Rationale**: Every API route and every frontend fetch needs consistent error handling
    - **Spec refs**: `specs/00-atomic-features.md` Sections 18.7-18.8

17. **[1.5] Build API Foundation (V4)** [3 days] -- NOT STARTED
    - Set up Bun HTTP server with routing framework (Hono or Elysia)
    - **CORS middleware**: configure allowed origins (Next.js dev server, production domain), methods, headers. Required if Bun API and Next.js run on different ports/origins.
    - OAuth 2.0 authentication middleware
    - Rate limiting middleware (Redis-backed leaky bucket algorithm, per-endpoint limits per `specs/00-atomic-features.md` 18.2)
    - Cursor-based pagination (default 50, max 100 items per page)
    - JSON:API-style response format with proper error responses (use QW4 error utilities)
    - CRUD routes for core resources: accounts, workspaces, projects, folders, files, version_stacks, users, comments, shares, custom_fields, webhooks
    - Plan-gate middleware: check user plan tier before allowing gated features (requires specs/13-billing-and-plans.md to define plan-gated features)
    - **Health check endpoint**: `GET /health` verifies config, database, Redis, storage connectivity per `specs/20-configuration-and-secrets.md` Section 12. Returns 200 OK or 503 with component status.
    - OpenAPI spec generation for documentation
    - API integration tests
    - **Depends on**: 1.3, 1.4
    - **Blocks**: 1.7b, all Phase 2+
    - **Spec refs**: `specs/00-complete-support-documentation.md` Sections 21.1-21.6, `specs/00-atomic-features.md` Sections 18.2-18.5, `specs/17-api-complete.md`

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

19. **[R4] Media Transcoding Validation and Benchmarking** [Days 7-14] -- NOT STARTED
    - **NOTE**: specs/15-media-processing.md is COMPLETE (579 lines) with exact FFmpeg commands, CRF values, bitrate targets, resolution ladders, and timeout values. R4 scope reduced from "design pipeline" to "validate and benchmark spec parameters".
    - Benchmark actual transcode times against spec-defined timeouts (1GB, 10GB, 100GB files across formats)
    - Validate worker architecture: test BullMQ concurrency limits specified in spec (thumbnail=4, filmstrip=2, proxy=2, waveform=4, metadata=8)
    - Test HDR tone mapping quality with spec-defined zscale + tonemap filter parameters
    - Evaluate RAW image processing: validate libraw/dcraw for 15+ camera formats
    - Test Adobe format rendering: validate ImageMagick for PSD/AI/EPS, server-side for INDD
    - Test document rendering: LibreOffice headless for DOCX/PPTX/XLSX -- validate conversion quality and performance
    - Validate audio waveform generation parameters from spec (FFmpeg audiowaveform vs BBC audiowaveform tool)
    - Validate FFmpeg worker resource management: CPU/memory limits, tmpdir sizing under production-like load
    - **Blocks**: S15 validation (spec amendments if needed), then Phase 2.2
    - Deliverable: Validation report confirming or amending specs/15-media-processing.md parameters + benchmark data

20. **[R9] Email Service Provider Research** [1 day, Week 2] -- NOT STARTED
    - Compare SendGrid vs AWS SES vs Postmark vs Resend
    - Evaluate: deliverability, cost at scale (10K, 100K, 1M emails/month), template support, webhook tracking
    - Test transactional email latency (must be <1 minute for immediate alerts per spec)
    - Evaluate daily digest scheduling capabilities
    - Assess DKIM/SPF/DMARC configuration complexity
    - **Blocks**: 2.11 (Notifications email delivery)
    - Deliverable: Provider recommendation with cost projection

### Week 3-4 (Days 15-28): Upload, Processing, Browser

21. **[S15] Review and validate specs/15-media-processing.md** [0.5 day, after R4] -- NOT STARTED
    - **NOTE**: specs/15-media-processing.md is COMPLETE (579 lines, 21K). It already documents exact FFmpeg commands, CRF values, bitrate targets, resolution ladders, HDR tone mapping parameters, timeouts, and failure handling.
    - Reduced scope: Review spec against R4 research findings and amend if needed
    - Validate that specified FFmpeg parameters produce expected quality/performance
    - Confirm timeout values are realistic based on R4 benchmarks
    - Check document conversion parameters (LibreOffice headless) against R4 findings
    - **Depends on**: R4 completion (for validation data)
    - **Blocks**: Phase 2.2 implementation (spec itself is ready; R4 validates it)

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

**Iteration 1 Definition (explicit)**: A user can sign up via WorkOS, create a workspace and project, upload files (with chunked/resumable support), see processing produce thumbnails and proxies, browse files in grid/list view, and navigate the folder tree. Items 2.4-2.12 (viewers, comments, metadata, notifications, search) are post-Iteration 1.

**Solo developer timeline caveat**: The 4-week timeline assumes 2+ engineers working parallel streams. A solo developer should plan 5-6 weeks, as the backend (Stream 1) and frontend (Stream 4) cannot truly run in parallel.

### Milestone Checkpoints

| Day | Milestone | Verify |
|-----|-----------|--------|
| 7 | Foundation Ready | Schema migrated, Redis connected, MinIO bucket created, WorkOS configured |
| 14 | API Ready | Auth working, API responding, Web Shell connected to API |
| 21 | Upload Working | Files upload, processing pipeline jobs queue |
| 28 | Iteration 1 | User can sign up, create workspace/project, upload, see processed thumbnails, browse |

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
Days 1-2:  R2 Research (Deployment) -- MUST produce Next.js+Bun architecture decision
Day 3:     Bootstrap (1.1) + File Type Registry (QW1) + Redis setup + .env.example
Days 3-4:  Object Storage (1.6)
Days 4-7:  Database Schema (1.2) + Seed Data (QW2) <-- R1 config incorporated Day 6
Days 8-10: Authentication (1.3 -- WorkOS AuthKit) + Error Utilities (QW4)
Days 11-12: Permissions (1.4) -- must produce permission middleware before 1.5
Days 12-14: API Foundation (1.5) -- starts once permission middleware available (Day 12 overlap)
```

**CORRECTION**: 1.4 and 1.5 are NOT fully parallel -- 1.5 depends on 1.4's permission middleware. The timeline shows 1.4 finishing its core middleware by Day 12, enabling 1.5 to start integration while 1.4 completes edge-case tests.

**Key outputs**:
- Deployed development environment with CI/CD
- Database schema with migrations and seed data
- RESTful API with auth/permissions/rate-limiting
- Shared utilities: file type registry, error handling

**NOTE on Authentication (1.3)**: With WorkOS AuthKit handling identity verification, social auth, MFA, and token issuance, the authentication phase focuses on Bush-specific concerns: role system, session cache, account switcher, and guest/reviewer flows. This may complete faster than the 3-day estimate, creating slack for Permissions (1.4) to start earlier. Timeline kept conservative to account for WorkOS SDK integration learning curve and guest access complexity.

### Stream 2: Spec Writing
**Owner**: Product owner / technical writer
**Timeline**: Days 1-14

```
Days 1-3:  Review specs/12-authentication.md (COMPLETE) + write specs/19-accessibility.md
Days 4-7:  specs/13-billing-and-plans.md (specs/11-security-features.md is COMPLETE -- no expansion needed)
Days 8-10: Review specs/15-media-processing.md (COMPLETE) against early R4 findings
Days 11-14: Review specs/14-realtime-collaboration.md (COMPLETE) + validate against R7 early findings
```

**Key outputs**:
- specs/19-accessibility.md and specs/13-billing-and-plans.md written (2 new specs)
- specs/12-authentication.md, specs/11-security-features.md, specs/15-media-processing.md reviewed and confirmed implementation-ready (3 existing specs validated)
- specs/14-realtime-collaboration.md (COMPLETE) reviewed and validated against R7 early findings
- Unblocks Phase 1-3 implementation
- **NOTE**: Stream 2 workload is lighter than originally estimated since 6 of 9 specs are already COMPLETE. Freed capacity can be redirected to specs/19-accessibility.md depth and specs/13-billing-and-plans.md completeness.

**Change from previous plan**: specs/14-realtime-collaboration.md writing moved earlier (Days 11-14 instead of "after R7"). Rationale: the spec can be drafted based on requirements and standard WebSocket patterns; R7 research refines the scaling strategy but does not block the protocol design. This prevents the spec from becoming a bottleneck for Phase 2.9 (Comments) and 2.11 (Notifications).

**UPDATE (2026-02-16)**: specs/14-realtime-collaboration.md is now COMPLETE (19K). Days 11-14 task is review/validation only, not writing from scratch.

### Stream 3: Research
**Owner**: Senior engineer / architect
**Timeline**: Days 1-28 (overlapping)

```
Days 1-2:   R2 (Deployment) [CRITICAL -- blocks Bootstrap]
Days 1-6:   R1 (SQLite) [CRITICAL -- informs Schema config]
Days 7-14:  R4 (Media Transcoding Validation) [HIGH -- validates spec, blocks Processing pipeline]
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
- FFmpeg parameter validation report (confirming or amending specs/15-media-processing.md)
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

### QW1. File Type Registry [Day 3, with Bootstrap] -- COMPLETED

- Central TypeScript module mapping MIME types to categories, icons, viewer types, and processing rules
- All 100+ formats from spec: 9 video containers with codec validation, 8 audio, 25+ image (including 14 RAW, 4 Adobe), 5 document
- Functions: `getFileCategory(mime)`, `getViewerType(mime)`, `isValidCodec(container, codec)`, `getProcessingPipeline(mime)`
- Used by: upload validation, processing pipeline routing, asset browser icons, viewer component selection
- **Estimated effort**: 4 hours
- **Spec refs**: `specs/00-atomic-features.md` Section 4.3

### QW2. Seed Data Scripts [Days 5-6, with Schema] -- COMPLETED

- Development seed: 2 accounts, 5 users, 3 workspaces, 5 projects, 5 folders, 10 file records, 4 comments, 2 notifications -- COMPLETED
- Permission test seed: specific scenarios for inheritance, restricted projects, guest limits -- COMPLETED
- Multiple permission levels and file statuses included -- COMPLETED
- CLI command: `bun run seed` -- COMPLETED
- **Estimated effort**: 4 hours

### QW3. Component Library Foundation [Day 3, with Frontend Shell] -- PARTIALLY COMPLETED

- Primitives: Button (primary/secondary/ghost/danger), Input, Select, Checkbox, TextArea, Modal, Toast, Dropdown, Tooltip, Spinner, Avatar, Badge -- NOT STARTED
- Design tokens as CSS custom properties: `--color-primary`, `--spacing-*`, `--font-*`, `--radius-*`, `--shadow-*` -- COMPLETED
- Dark/light theme support via CSS variables (needed for share branding later) -- NOT STARTED
- Accessible by default: ARIA attributes, keyboard navigation, focus management -- NOT STARTED
- **Estimated effort**: 6 hours

### QW4. Error Handling Utilities [Day 10, with API Foundation] -- NOT STARTED

- Shared error classes: `AppError` base, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`
- API error formatter: converts error classes to JSON:API error response format
- Client-side error handler: maps HTTP status codes to user-friendly messages
- Request ID generation and propagation (middleware)
- Structured logging helper: `log.info()`, `log.error()`, `log.warn()` with JSON output
- **Secret scrubbing middleware**: Scrub sensitive values from logs per `specs/20-configuration-and-secrets.md` Section 6. Redact: WORKOS_API_KEY, WORKOS_WEBHOOK_SECRET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, CDN_SIGNING_KEY, SMTP_PASS, SESSION_SECRET.
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
  - **[MOST CRITICAL] Determine Next.js + Bun backend architecture**: Option A: Bun serves as Next.js runtime (single process, Next.js API routes handle some server logic). Option B: Separate Bun HTTP server (Hono/Elysia) alongside Next.js (two processes, clear frontend/backend split). Option C: Next.js handles SSR/pages, Bun server handles API exclusively, reverse proxy routes between them. **This decision determines monorepo structure, routing, CORS needs, and deployment topology. Must be answered Day 1-2.**
  - Evaluate Bun production deployment: process management, crash recovery, graceful shutdown
  - Compare: systemd services, PM2, Fly.io (non-Docker), Render, Railway, bare VPS
  - Plan zero-downtime deployment strategy
  - Design process supervision for FFmpeg workers (long-running, crash-prone, separate from API server)
  - **Redis hosting**: managed (Upstash/Redis Cloud) vs self-hosted. Evaluate Upstash for serverless-friendly, Redis Cloud for traditional.
- **Deliverable**: Deployment architecture document with explicit decision on Next.js+Bun topology

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

#### R4. Media Transcoding Validation and Benchmarking [HIGH] -- NOT STARTED

- **NOTE**: specs/15-media-processing.md is COMPLETE (579 lines) with exact FFmpeg commands, CRF values, bitrate targets, resolution ladders, timeouts, and worker concurrency settings. R4 scope reduced from "design pipeline" to "validate and benchmark existing spec parameters".
- **Blocks**: S15 validation (spec amendments if benchmarks contradict spec), then 2.2
- **Timeline**: Days 7-14
- **Research questions (validation focus)**:
  - Benchmark actual transcode times against spec-defined timeouts across formats and file sizes (1GB, 10GB, 100GB)
  - Validate worker concurrency settings from spec (thumbnail=4, filmstrip=2, proxy=2, waveform=4, metadata=8)
  - Validate HDR tone mapping quality/performance with spec-defined zscale + tonemap parameters
  - RAW image processing: validate libraw/dcraw for 15+ formats
  - Adobe format rendering: validate ImageMagick for PSD/AI/EPS, server-side for INDD
  - **Document rendering: LibreOffice headless for DOCX/PPTX/XLSX** -- validate conversion quality and identify alternatives if needed
  - **Audio waveform: FFmpeg audiowaveform vs BBC audiowaveform tool** -- validate against spec parameters
  - Validate spec-defined proxy parameters (CRF values, bitrate targets, resolution ladder) produce expected quality
  - Worker resource management validation: CPU/memory limits, tmpdir sizing under production-like load
- **Deliverable**: Validation report confirming or amending specs/15-media-processing.md + benchmark data

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

- **NOTE**: specs/14-realtime-collaboration.md is COMPLETE (19K) with WebSocket protocol, presence system, and event types. R7 validates scaling strategy and Bun-specific implementation details.
- **Blocks**: 2.9 (Comments), 2.11 (Notifications)
- **Timeline**: Days 14-21
- **Research questions**:
  - WebSocket connection management for Bun server (validate against spec protocol)
  - Horizontal scaling: Redis pub/sub for multi-instance broadcast
  - Optimistic UI update strategy
  - Connection limits per instance
  - Reconnection and message replay on disconnect
- **Deliverable**: Validation report for specs/14-realtime-collaboration.md + Bun-specific scaling recommendations

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
| specs/12-authentication.md | **COMPLETE** (235 lines, WorkOS AuthKit) | Review Days 1-3 | 1.3 (Auth) |
| specs/19-accessibility.md | NOT STARTED | Days 1-3 | Informs all UI |
| specs/11-security-features.md | **COMPLETE** (400 lines) | ~~Days 4-7~~ No action needed | 1.4 (Permissions) |
| specs/13-billing-and-plans.md | NOT STARTED | Days 4-7 | 3.7 (Lifecycle), 5.1 (Billing) |
| specs/20-configuration-and-secrets.md | **COMPLETE** (523 lines, 47 env vars, Zod validation) | Review Day 1 | 1.1 (Bootstrap) |

> **NOTE on specs/README.md deferral discrepancy**: `specs/README.md` (lines 43-45) incorrectly defers `13-billing-and-plans.md` to Phase 5 and `19-accessibility.md` to Phase 3+. This is inconsistent with IMPLEMENTATION_PLAN.md blocking dependencies: billing is needed by Days 4-7 (blocks plan gates in Phase 1.5), and accessibility is needed by Days 1-3 (informs all UI work from Phase 1.7 onward). The IMPLEMENTATION_PLAN.md timeline is correct per blocking dependencies. The README deferral labels should be updated when those specs are written.

#### Blocks Phase 2

| Spec | Status | Write By | Blocks |
|------|--------|----------|--------|
| specs/15-media-processing.md | **COMPLETE** (579 lines, exact FFmpeg commands) | Validate Days 14-15 (after R4) | 2.2 (Processing) |
| specs/14-realtime-collaboration.md | **COMPLETE** (593 lines, WebSocket protocol) | Review Days 11-14 | 2.9 (Comments), 2.11 (Notifications) |

#### Blocks Phase 3+

| Spec | Status | Write By | Blocks |
|------|--------|----------|--------|
| specs/17-api-complete.md | **COMPLETE** (918 lines, ~120 endpoints, full API spec) | Review Week 3-4 | 3.6 (Webhooks), Phase 4 |
| specs/16-storage-and-data.md | **COMPLETE** (333 lines, storage architecture) | Review after R1 | 4.1 (Storage Connect) |
| specs/18-mobile-complete.md | NOT STARTED | After Phase 2 | 4.3 (iOS App) |

### Specs Needing Future Expansion

These specs exist but are brief (<100 lines) and will need expansion before their respective phases:

| Spec | Lines | Blocks | Expand By |
|------|-------|--------|-----------|
| specs/06-transcription-and-captions.md | 31 | 3.4 (Transcription) | Week 5 |
| specs/09-transfer-app.md | 36 | 4.2 (Transfer Desktop App) | Week 6 |
| specs/10-integrations.md | 53 | 4.5-4.6 (Adobe/NLE integrations) | Week 7 |
| specs/07-camera-to-cloud.md | 39 | 4.6 (C2C partners) | Week 7 |

---

## PHASE 1: FOUNDATION

**Status**: NOT STARTED
**Goal**: Infrastructure, data models, auth, permissions, API, and web shell.
**Timeline**: Days 1-14

### 1.1 Project Bootstrap [COMPLETED]

- Initialize monorepo structure (Bun workspace or Turborepo) -- structure depends on R2 Next.js+Bun topology decision -- COMPLETED
- Set up TypeScript configuration (shared tsconfig) -- COMPLETED
- Configure linting (ESLint + Prettier) -- COMPLETED (flat config for ESLint 9)
- Set up testing framework (Vitest) -- COMPLETED
- Configure CI/CD pipeline (GitHub Actions) -- NOT STARTED
- **Set up Redis for local development** (install instructions + verify BullMQ and ioredis connectivity) -- COMPLETED (documented, not installed)
- **Create `.env.example`** with all required environment variables (WorkOS, Redis, S3, database, FFmpeg, app secrets) -- COMPLETED
- **Configure CORS** if R2 determines separate Next.js + Bun API processes -- NOT STARTED
- Create development environment setup docs -- NOT STARTED
- Include QW1 (File Type Registry) as part of bootstrap -- COMPLETED
- **Depends on**: R2 direction
- **Blocks**: Everything
- **Timeline**: Day 3
- **Spec refs**: `specs/README.md`
- **NOTE**: Bun crashes on CPUs without AVX support. Node.js + tsx is being used instead for development.

### 1.2 Database Schema and Core Data Models [COMPLETED]

- SQLite schema with indexes, foreign keys, check constraints, triggers -- COMPLETED
- Core models: Account, User, Workspace, Project, Folder, File, VersionStack, Comment, Share, CustomField, CustomFieldValue, Webhook, Notification, AuditLog -- COMPLETED (Account, User, AccountMembership, Workspace, Project, Folder, File, VersionStack, Comment, Share, Notification)
- Hierarchy: Account > Workspace > Project > Folder > File -- COMPLETED
- ORM: Drizzle ORM (supports SQLite + PostgreSQL migration) -- COMPLETED
- Migration system, schema validation tests -- COMPLETED (migration script, seed data)
- QW2 (Seed Data) included -- COMPLETED
- **Depends on**: 1.1
- **R1 informs config only** (WAL mode, pooling, backup)
- **Blocks**: 1.3, 1.5, all Phase 2+
- **Timeline**: Days 4-7
- **Spec refs**: `specs/00-atomic-features.md` Section 2, `specs/00-complete-support-documentation.md` Section 3.1

### 1.3 Authentication System (WorkOS AuthKit) [IN PROGRESS]

- **CORRECTED**: Authentication delegated to WorkOS AuthKit per `specs/12-authentication.md`. Bush does NOT build custom email/password, bcrypt, OAuth, TOTP/QR, or JWT issuance.
- **WorkOS integration**: Install `@workos-inc/authkit-nextjs` SDK, configure organization, env vars -- COMPLETED (SDK installed)
- **Session middleware**: Server-side validation via App Router middleware, route protection -- COMPLETED (src/web/middleware.ts)
- **Redis session cache**: Key `session:{user_id}:{session_id}`, TTL matches refresh token (7 days default), stores user ID, current account ID, account role, WorkOS org ID -- COMPLETED (src/auth/session-cache.ts, src/redis/index.ts)
- **Account roles (Bush-managed)**: Owner, Content Admin, Member, Guest, Reviewer -- role assignment, change propagation, cache invalidation -- COMPLETED (src/auth/types.ts, src/auth/service.ts)
- **Account switcher**: Multi-account context switching without re-authentication -- IN PROGRESS (API route exists, UI pending)
- **Guest/reviewer access**: 3 tiers (authenticated, identified via email code, unidentified/anonymous) -- share-link-based, no WorkOS account required -- NOT STARTED
- **Cookie config**: httpOnly, secure, sameSite=lax, domain=.bush.app -- COMPLETED (in API routes)
- **Adobe IMS**: Stub only (R11 informs details, full implementation Phase 4) -- NOT STARTED
- Integration tests for WorkOS flows, role assignment, guest access -- NOT STARTED
- **Depends on**: 1.2, specs/12-authentication.md (COMPLETE)
- **Blocks**: 1.4, 1.5
- **Timeline**: Days 8-10 (may complete faster than estimated due to WorkOS delegation)
- **Spec refs**: `specs/12-authentication.md`, `specs/00-complete-support-documentation.md` Sections 1.2, 1.3

### 1.4 Permission System [COMPLETED]

**Completed:**
- PermissionLevel type with 5-level hierarchy (full_access > edit_and_share > edit > comment_only > view_only)
- Permission tables in schema: workspacePermissions, projectPermissions, folderPermissions
- Permission service with inheritance logic (cannot lower inherited permissions)
- Guest role constraints defined (1 project max, cannot invite, cannot delete)
- Unit tests for permission types (31 tests)
- Integration tests with database (18 tests in src/permissions/permissions-integration.test.ts)
- Permission middleware for API routes (src/permissions/middleware.ts)
- Restricted Project/Folder logic (breaks inheritance chain, invite-only)

**Deferred to Phase 5:**
- Access Groups for bulk permission management (Team+ feature -- requires plan gate)

- **Depends on**: 1.2, 1.3
- **Blocks**: 1.5, all Phase 2+
- **Timeline**: Days 11-12
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 2.1-2.5, `specs/11-security-features.md`

### 1.5 RESTful API Foundation (V4) [NOT STARTED]

- Bun HTTP server with Hono or Elysia
- **CORS middleware** (required if API and Next.js are separate processes -- configure allowed origins, methods, headers, credentials)
- Auth middleware, rate limiting (leaky bucket, per-endpoint, Redis-backed)
- Cursor pagination (50 default, 100 max)
- CRUD for all core resources
- Plan-gate middleware for tier-restricted features
- QW4 (Error Utilities) integrated
- OpenAPI spec generation
- Integration tests
- **Depends on**: 1.3, 1.4 (permission middleware available by Day 12; full 1.4 edge-case testing completes in parallel)
- **Blocks**: 1.7b, all Phase 2+
- **Timeline**: Days 12-14 (starts once 1.4 permission middleware available)
- **Spec refs**: `specs/00-complete-support-documentation.md` Sections 21.1-21.6

### 1.6 Object Storage Layer [COMPLETED]

- Provider-agnostic S3 interface -- COMPLETED (src/storage/)
- Pre-signed URLs (upload + download), multipart upload -- COMPLETED
- Key structure: `{account_id}/{project_id}/{file_id}/{type}/{filename}` -- COMPLETED
- AWS SDK v3 for S3, R2, MinIO, B2 support -- COMPLETED
- Tests for storage key utilities -- COMPLETED
- Dev storage (MinIO or B2 free tier) -- COMPLETED
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
- **Spec refs**: `specs/00-atomic-features.md` Section 1.4, 5.3, `specs/00-complete-support-documentation.md` Sections 4.2, 5.3 (layout specs). NOTE: `specs/03-file-management.md` covers upload methods/transfer, not UI layout.

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
- **Depends on**: specs/11-security-features.md (COMPLETE, 400 lines)

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
R4 (Transcoding Validation) --> S15 validation --> 2.2 (Processing) [Days 7-14]
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

SPECS (must write or review before implementing)
================================
specs/20-configuration.md      --> 1.1 (Bootstrap) [COMPLETE -- review Day 1]  ** NEW **
specs/12-authentication.md     --> 1.3 (Auth) [COMPLETE -- review Days 1-3]
specs/19-accessibility.md      --> informs all UI [NOT STARTED -- write Days 1-3]
specs/11-security-features.md  --> 1.4 (Permissions) [COMPLETE -- no action needed]
specs/13-billing-and-plans.md  --> 3.7, 5.1 [NOT STARTED -- write Days 4-7]
specs/14-realtime-collab.md    --> 2.9, 2.11 [COMPLETE -- review Days 11-14]
specs/15-media-processing.md   --> 2.2 (Processing) [COMPLETE -- validate Days 14-15 via R4]
specs/17-api-complete.md       --> 3.6, Phase 4 [COMPLETE -- review Week 3-4]
specs/16-storage-and-data.md   --> 4.1 [COMPLETE -- review after R1]
specs/18-mobile-complete.md    --> 4.3 [NOT STARTED -- defer]

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
      '-- 1.3 (Auth -- WorkOS AuthKit) [Days 8-10]
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

### Corrections (2026-02-16 Research Validation)

The following corrections were made after systematic research validation of all specs and project status.

19. **Phase 1.3 Authentication System rewritten for WorkOS AuthKit** -- Previous plan described building custom auth (bcrypt, TOTP QR codes, JWT generation, OAuth 2.0 flows). `specs/12-authentication.md` specifies WorkOS AuthKit delegation for all identity verification, social auth, MFA, and SSO. Phase 1.3 now correctly reflects Bush building only: role system, session cache, account switcher, and guest/reviewer access flows. Custom bcrypt, TOTP, and JWT issuance removed.

20. **WorkOS AuthKit added to tech stack table** -- `specs/README.md` line 69 lists WorkOS AuthKit as authentication provider. This was missing from IMPLEMENTATION_PLAN.md tech stack table. Added explicit row and clarified Backend API "OAuth 2.0" note to indicate it's via WorkOS, not custom.

21. **S11 "Expand specs/11-security-features.md" removed** -- Previous plan stated spec was "only 38 lines -- needs major expansion". Actual file is 400 lines (16K) covering Access Groups, audit logging, forensic watermarking, permission levels, and 2FA enforcement. Task was unnecessary and has been struck through.

22. **S12 task reduced to review** -- `specs/12-authentication.md` is complete (235 lines, 9.5K) specifying WorkOS AuthKit integration. Task changed from "Write" to "Review" with reduced effort estimate.

23. **S15 and R4 scope reduced** -- `specs/15-media-processing.md` is complete (579 lines, 21K) with exact FFmpeg commands, CRF values, timeouts, and worker concurrency settings. S15 changed from "Write" to "Review and validate". R4 changed from "Design pipeline" to "Validate and benchmark spec parameters". Deliverable changed from design document to validation report.

24. **Spec status table corrected** -- Updated "Specifications to Write" tables to reflect that specs/11, 12, 14, 15, 16, and 17 are COMPLETE. Only specs/13 (billing), specs/18 (mobile), and specs/19 (accessibility) remain NOT STARTED.

25. **README deferral discrepancy noted** -- `specs/README.md` incorrectly defers `13-billing-and-plans.md` to Phase 5 and `19-accessibility.md` to Phase 3+. IMPLEMENTATION_PLAN.md timeline (billing by Days 4-7, accessibility by Days 1-3) is correct per blocking dependencies. Note added to spec status section.

26. **Stream 1 (Backend) WorkOS note added** -- Authentication with WorkOS AuthKit may be faster than the 3-day estimate since identity verification is delegated. Timeline kept conservative; note added about potential schedule slack.

27. **Frontend auth UI description updated** -- Item 12 (1.7a Web Shell) previously listed "email/password, OAuth buttons, 2FA, password reset" UI. Updated to reflect WorkOS AuthKit hosted login UI, post-auth routing, account switcher, and role indicators.

### Corrections (2026-02-16 Deep Analysis Review)

The following corrections address gaps and errors found during deep plan analysis.

28. **Token TTL spec inconsistency flagged** -- `specs/12-authentication.md` and `specs/17-api-complete.md` disagree on token TTL values. Added to "Known Spec Inconsistencies" section at top of plan. Must resolve before Phase 1.3.

29. **Redis bootstrapping made explicit** -- Redis was referenced throughout the plan (session cache, BullMQ, rate limiting, pub/sub) but never had an explicit setup task. Added to both 1.1 (Bootstrap, Days 1-3 timeline) and Phase 1.1 section with provider selection guidance.

30. **`.env.example` creation added** -- Zero-code project needs explicit environment variable documentation from Day 1. Added to 1.1.

31. **Next.js + Bun architecture decision elevated** -- R2 research question about Next.js+Bun topology elevated from one bullet among many to the primary gating question. Three options documented (single process, two processes, reverse proxy). This is the single most consequential architectural decision in the project.

32. **CORS middleware added** -- If Next.js and Bun API are separate processes (likely), CORS configuration is required. Added to both 1.1 (Bootstrap) and 1.5 (API Foundation).

33. **1.4/1.5 timeline corrected** -- Parallel Workstreams section previously showed "Days 11-14: Permissions (1.4) + API Foundation (1.5)" implying full parallelism, but 1.5 depends on 1.4's permission middleware. Corrected to show 1.4 completing middleware by Day 12, enabling 1.5 to start integration with Day 12 overlap.

34. **Iteration 1 definition made explicit** -- Added concrete definition of what "Iteration 1 Achieved" means: sign up, create workspace/project, upload files, processing produces thumbnails/proxies, browse files in grid/list. Items 2.4-2.12 are explicitly post-Iteration 1.

35. **Solo developer timeline caveat added** -- 4-week timeline assumes 2+ parallel engineers. Solo developer should plan 5-6 weeks since backend and frontend streams cannot truly parallelize.

36. **`specs/03-file-management.md` reference corrected** -- Phase 1.7 (Web Shell) incorrectly cited this spec for UI layout. Actual layout specs are in `specs/00-complete-support-documentation.md` Sections 4.2, 5.3 and `specs/00-atomic-features.md` Section 5.3.

37. **R2 Redis hosting research added** -- Managed Redis provider selection (Upstash vs Redis Cloud vs self-hosted) added to R2 research scope since no-Docker constraint affects Redis deployment too.

### Updates (2026-02-16 Plan Review)

The following updates were made after comprehensive spec analysis and plan review.

38. **specs/20-configuration-and-secrets.md integrated** -- This spec (523 lines, 47 environment variables, Zod validation schema) was missing from the plan. Added references throughout: Bootstrap (1.1), QW4 (secret scrubbing), spec status tables, dependency graph.

39. **Bootstrap (1.1) expanded** -- Added explicit tasks: `.env.test` creation, `.gitignore` setup, Zod config validation at startup, reference to specs/20 for MinIO/Mailpit/Redis local setup.

40. **Health check endpoint added to API Foundation (1.5)** -- `GET /health` endpoint required by specs/20 Section 12 to verify config, database, Redis, and storage connectivity.

41. **Secret scrubbing middleware added to QW4** -- Log scrubbing for WORKOS_API_KEY, STORAGE_SECRET_KEY, SESSION_SECRET, etc. per specs/20 Section 6.

42. **Milestone checkpoints added** -- Day 7, 14, 21, 28 checkpoints with explicit verification criteria for tracking progress.

43. **Specs needing future expansion section added** -- Documented brief specs (<100 lines) that need expansion before their phases: specs/06, 07, 09, 10.

44. **Token TTL inconsistency resolution path clarified** -- Added explicit options (A: security-focused, B: usability-focused) and decision deadline.

45. **README deferral discrepancy action added** -- Explicit instruction to update specs/README.md when specs/13 and specs/19 are written.

46. **R2 deliverable document named** -- `docs/deployment-architecture.md` specified as the deliverable.

47. **Spec line counts corrected** -- specs/14-realtime-collaboration.md (593 lines), specs/16-storage-and-data.md (333 lines), specs/17-api-complete.md (918 lines) counts updated for accuracy.

48. **1.6 Object Storage spec reference added** -- Added reference to specs/16-storage-and-data.md and specs/20-configuration-and-secrets.md for MinIO setup.
