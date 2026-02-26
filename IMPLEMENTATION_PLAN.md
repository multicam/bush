# IMPLEMENTATION PLAN - Bush Platform

**Last updated**: 2026-02-27 (v0.0.84 - Deep Research Audit)
**Project status**: **MVP FUNCTIONALLY COMPLETE** - All Phase 1, 2, and 3 core features implemented. Database migration drift resolved. New audit identified production-readiness gaps (P2/P3) from deep codebase analysis.
**Source of truth for tech stack**: `specs/README.md` (lines 68-92)

---

## IMPLEMENTATION STATISTICS

**Verified via comprehensive code analysis (2026-02-27):**

| Metric | Value | Notes |
|--------|-------|-------|
| **API Endpoints** | 136 | 18 route modules: accounts(10), auth(3), bulk(7), collections(7), comments(8), custom-fields(6), files(17), folders(9), metadata(3), notifications(7), projects(10), search(2), shares(11), transcription(6), users(3), version-stacks(11), webhooks(7), workspaces(9) |
| **Database Tables** | 26 | schema.ts and migrate.ts in sync (100% coverage) |
| **Test Files** | 81 | 80 .test.ts + 1 .test.tsx |
| **Spec Files** | 18 | Comprehensive specifications (+ README.md index) |
| **Frontend Components** | 52 | TSX components (non-test) |
| **Web Pages** | 16 | Next.js pages |
| **Media Processors** | 5 | metadata, thumbnail, proxy, waveform, filmstrip |
| **Email Templates** | 10 | All implemented via SMTP provider |
| **WebSocket Events** | 26 | All event types wired |
| **TODO Comments** | 10 | 1 minor (PDF text layer), 9 informational |

---

## PRIORITY TASK LIST

### Legend
- **P1**: Critical -- blocks deployment or has security implications
- **P2**: Important -- should fix before production launch
- **P3**: Minor -- can defer post-launch

---

## P1 - CRITICAL

**All P1 items resolved.** Database migration drift fixed in v0.0.56.

---

## P2 - IMPORTANT (Should Fix Before Production)

### [P2] Stale Spec References in Source Code [2h] -- NOT STARTED

- **Problem**: 107 stale spec references across ~60 source files (comments pointing to old spec filenames like `specs/17-api-complete.md`, `specs/12-authentication.md`, `specs/16-storage-and-data.md`, etc.)
- **Impact**: Developer confusion; comments point to non-existent files
- **Solution**: Mass find/replace across codebase:
  - `specs/17-api-complete.md` → `specs/04-api-reference.md`
  - `specs/12-authentication.md` → `specs/02-authentication.md`
  - `specs/16-storage-and-data.md` → `specs/06-storage.md`
  - `specs/15-media-processing.md` → `specs/07-media-processing.md`
  - `specs/14-realtime-collaboration.md` → `specs/05-realtime.md`
  - `specs/06-transcription-and-captions.md` → `specs/08-transcription.md`
  - `specs/13-billing-and-plans.md` → `specs/13-billing.md`
  - `specs/00-complete-support-documentation.md` → `specs/03-permissions.md` (or relevant spec)
  - `specs/00-atomic-features.md` → `specs/00-product-reference.md`
  - `specs/04-review-and-approval.md` → `specs/04-api-reference.md` (comments section)
  - `specs/03-file-management.md` → `specs/04-api-reference.md` (files section)
  - `specs/05-sharing-and-presentations.md` → `specs/04-api-reference.md` (shares section)

### [P2] CORS Hardcoded Localhost Origin [30m] -- NOT STARTED

- **Problem**: `src/api/index.ts:51` — `http://localhost:3000` is always added to CORS allowed origins, including production
- **Impact**: Security — localhost origin accepted in production
- **Solution**: Conditionally add localhost only when `NODE_ENV !== 'production'`

### [P2] Webhook Events Never Emitted [2h] -- NOT STARTED

- **Problem**: `emitWebhookEvent` is exported from `src/api/routes/webhooks.ts` and re-exported from `routes/index.ts`, but no production code ever calls it. 7 webhook registration endpoints work, but events are never delivered.
- **Impact**: Users can register webhooks but will never receive events
- **Solution**: Wire `emitWebhookEvent` calls into file, comment, share, project, and member route handlers per the 19 event types in `specs/04-api-reference.md`

### [P2] Notifications Never Created From Routes [2h] -- NOT STARTED

- **Problem**: `createNotification` and `NOTIFICATION_TYPES` are exported from `src/api/routes/notifications.ts` but never called from any route handler. The full notification system exists (API, UI, real-time delivery) but nothing triggers it.
- **Impact**: Users see an empty notification panel — the feature appears broken
- **Solution**: Add `createNotification` calls to comment routes (mentions, replies), share routes, file processing completion, member invitation, assignment changes

### [P2] AssemblyAI Provider Will Crash at Runtime [30m] -- NOT STARTED

- **Problem**: `assemblyai` is a valid option in `TRANSCRIPTION_PROVIDER` config enum (`src/config/env.ts:93`) and DB schema (`src/db/schema.ts:587`), but no provider class exists. `src/transcription/processor.ts:40-51` hits the `default` case and throws.
- **Impact**: Runtime crash if `TRANSCRIPTION_PROVIDER=assemblyai` is set
- **Solution**: Remove `assemblyai` from the config enum and DB schema, or add a clear "not implemented" error with guidance

### Previously Completed P2 Items

- ~~Permission validation before grant~~ — v0.0.70
- ~~Transcription permission checks~~ — v0.0.69
- ~~Redis cache invalidation for role changes~~ — v0.0.69
- ~~Share channel permission check~~ — v0.0.71
- ~~File channel permission check~~ — v0.0.71
- ~~Comment permission check~~ — v0.0.72
- ~~Email provider implementation (SMTP)~~ — v0.0.73
- ~~CDN provider interface (Bunny CDN)~~ — v0.0.74
- ~~Session limits enforcement~~ — v0.0.74
- ~~Grant permission API exposure~~ — v0.0.75

---

## P3 - MINOR (Can Be Deferred)

### [P3] BunnyCDN Purge Is a No-Op Stub [1h] -- NOT STARTED

- `src/storage/cdn-provider.ts:102-155` — `invalidate()` and `invalidatePrefix()` log messages but make no HTTP calls to Bunny's purge API. Cache invalidation does not actually work.

### [P3] Zero Zod Validation in Route Handlers [4h] -- NOT STARTED

- No route uses Zod for request body validation; all validation is manual `if` checks. Zod is only used in `src/config/env.ts`. Inconsistent error messages across routes.

### [P3] Email Provider Stubs [4h] -- NOT STARTED

- SendGrid, SES, Postmark, Resend fall back to SMTP with `console.warn` (`src/lib/email/index.ts:72-108`). SMTP works; native API integrations deferred.

### [P3] Auth Context Swallows Errors [30m] -- NOT STARTED

- `src/web/context/auth-context.tsx:92-100` catches errors and silently returns unauthenticated state. No logging — auth failures invisible in browser console.

### [P3] SMTP Defaults Are Dev-Only [15m] -- NOT STARTED

- `src/config/env.ts:101-105` defaults: port 1025 (Mailpit), host `localhost`, from `noreply@bush.local`. Production should require explicit config or fail loudly.

### [P3] Media Job Duration/Dimension Placeholders [1h] -- NOT STARTED

- `src/media/index.ts:100-125` — filmstrip, proxy, waveform jobs enqueued with `durationSeconds: 0`, `sourceWidth: 0`, `sourceHeight: 0`. Processors handle gracefully (skip if 0) but initial job records have wrong data.

### [P3] Dead Exports and Config [15m] -- NOT STARTED

- `cdn` export from `src/storage/index.ts:359` never imported
- `BACKUP_STORAGE_BUCKET` defined in env.ts but never referenced
- `createNotifications` (plural) exported but not re-exported

### [P3] Missing /docs Endpoint [2h] -- NOT STARTED

- `src/api/index.ts:134` references `/docs` but the endpoint returns a 404

### [P3] Body Parsing Error Swallowing [30m] -- NOT STARTED

- Several routes use `.catch(() => ({}))` for body parsing (`auth.ts:28,95`, `projects.ts:229`, `transcription.ts:165`, `shares.ts:905`). Malformed requests silently treated as empty objects.
- `transcription.ts:859` — caption storage delete errors silently swallowed with `.catch(() => {})`

### [P3] Permissions Integration Test Conditionally Skipped [15m] -- NOT STARTED

- `src/permissions/permissions-integration.test.ts:86` — entire suite skipped when `better-sqlite3` unavailable. Ensure CI always has the native module.

### [P3] PDF Viewer Text Layer [4h] -- NOT STARTED

- `src/web/components/viewers/pdf-viewer.tsx:253` — pdf.js v4+ API changes broke text layer; cannot select/copy text from PDFs

### [P3] Document Processing [4d] -- DEFERRED

- PDF thumbnails, DOCX/PPTX/XLSX conversion (LibreOffice headless), interactive ZIP viewer

### [P3] Image Format Support [4h] -- DEFERRED

- RAW (requires libraw/dcraw), Adobe formats (requires ImageMagick), HDR tone mapping

### [P3] Access Groups [3d] -- DEFERRED

- Bulk permission management via groups; depends on `specs/13-billing.md`

### [P3] API Key Token Type [1d] -- DEFERRED

- `bush_key_` prefixed tokens, key management CRUD, scoping. Spec: `specs/04-api-reference.md` Section 2.2

### [P3] OpenAPI Spec Generation [1d] -- DEFERRED

- Generate OpenAPI 3.1 spec from Hono routes, serve at `/v4/openapi.json`

### [P3] Route Test Coverage [2d] -- DEFERRED

- API routes (18 files), media processing (9 files), realtime (3 files), transcription (5 files) have 0% coverage

### [P3] WebSocket Rate Limit Configuration [30m] -- DEFERRED

- Rate limiting constants hardcoded in `ws-manager.ts`; should be configurable via env

### [P3] Missing API Endpoint [30m] -- DEFERRED

- `GET /v4/projects/:project_id/shares` — use `/accounts/:accountId/shares?project_id=...` as workaround

---

## CORRECTLY DEFERRED (No Action Needed)

Per specs/README.md:
- Document Processing (PDF thumb, DOCX/PPTX/XLSX) — P3
- RAW/Adobe Format Thumbnails — requires dcraw/ImageMagick binaries
- Access Groups — depends on billing
- API Key Token Type (`bush_key_`) — P3
- HLS Generation — using MP4 proxies with CDN delivery
- AssemblyAI Provider — Deepgram + faster-whisper cover needs (config enum cleanup is P2)
- Enhanced Search (Visual/Semantic) — requires AI/ML provider decision

---

## COMPLETED FEATURES

### Phase 1: Foundation (100%)

- **Authentication**: WorkOS AuthKit, session cache, token refresh, session limits (max 10)
- **Permissions**: 5-level hierarchy (owner, content_admin, member, guest, reviewer), validation before grant
- **API Foundation**: 136 endpoints across 18 route modules
- **Object Storage**: R2/B2/S3-compatible with pre-signed URLs, CDN provider interface
- **Database**: 26 tables, migration in sync

### Phase 2: Core Features (100%)

- **File Upload**: Chunked, resumable, folder structure preservation
- **Media Processing**: 5 processors (metadata, thumbnail, proxy, waveform, filmstrip)
- **Asset Browser**: Grid/list views, virtualized, folder navigation
- **Asset Operations**: Copy/move/delete/recover, download
- **Version Stacking**: Stack management, comparison viewer
- **Viewers**: Video (JKL shuttle, filmstrip), Image (zoom/pan, mini-map), Audio (waveform, markers), PDF (multi-page, zoom)
- **Comments**: API + UI, annotations, threading
- **Metadata**: Built-in fields, custom fields API + UI
- **Notifications**: API + UI, real-time updates
- **Search**: FTS5 for files and transcripts

### Phase 3: Advanced Features (100%)

- **Sharing**: API + UI, public pages, passphrase protection
- **Collections**: API + UI, team/private
- **Comparison Viewer**: Side-by-side, linked playback/zoom
- **Transcription**: Deepgram/faster-whisper, FTS5 search, SRT/VTT/TXT export
- **Real-time**: WebSocket + event bus, 26 event types
- **Email**: SMTP provider, 10 templates
- **Member Management**: Full CRUD with role checks

---

## RESEARCH DECISIONS (All Resolved)

| Decision | Choice | Status |
|----------|--------|--------|
| R1: SQLite at Scale | SQLite WAL for <50 users | DONE |
| R2: Deployment | Hetzner VPS + systemd + Caddy | DONE |
| R3: Video Player | Custom HTML5 | DONE |
| R4: Media Transcoding | FFmpeg | DONE |
| R5: Large File Upload | Chunked + tus.io | DONE |
| R6: Transcription | Deepgram + faster-whisper | DONE |
| R7: Real-time | Bun WebSocket + EventEmitter | DONE |
| R9: Email | SMTP provider interface | DONE |
| R10: CDN | Bunny CDN | DONE |

---

## SPEC INCONSISTENCIES

1. **Token TTL Mismatch** — RESOLVED
   - `specs/02-authentication.md`: 5 min access / 7 days refresh
   - Code uses `expires_in: 300` (correct). No further action needed.

2. **README Deferral Labels** — INFORMATIONAL
   - `specs/README.md` correctly defers billing to Phase 5, accessibility to Phase 3+

---

## PRODUCTION READINESS

| Category | Status | Notes |
|----------|--------|-------|
| **Core Features** | DONE | All MVP features implemented |
| **API Endpoints** | DONE | 136 endpoints across 18 modules |
| **Database** | DONE | 26 tables, migration in sync |
| **Authentication** | DONE | WorkOS AuthKit, session limits |
| **Permissions** | DONE | 5-level hierarchy, all checks wired |
| **File Storage** | DONE | S3-compatible with CDN support |
| **Media Processing** | DONE | 5 processors |
| **Real-time** | DONE | WebSocket + EventEmitter |
| **Email** | DONE | SMTP provider with 10 templates |
| **Security** | PARTIAL | Session limits and permissions done; CORS localhost issue open (P2) |
| **Webhooks** | STUB | Registration works but events never emitted (P2) |
| **Notifications** | STUB | API/UI works but nothing triggers notifications (P2) |
| **Testing** | PARTIAL | Core modules tested; route/media/realtime coverage 0% |
| **Documentation** | PARTIAL | Specs complete; 107 stale spec refs in source (P2) |

**Verdict**: Platform is functionally complete. Five P2 items (stale refs, CORS, webhooks, notifications, AssemblyAI) should be addressed before production.

---

## CHANGE LOG

### v0.0.84 (2026-02-27) - Deep Research Audit

Four parallel research agents analyzed the full codebase against refactored specs. Found: 107 stale spec references in source, webhook/notification dead code paths, AssemblyAI runtime crash risk, CORS localhost in production, BunnyCDN purge stubs, zero Zod validation, silent error swallowing. Rewrote IMPLEMENTATION_PLAN.md with corrected references, compressed changelog, new P2/P3 items.

### v0.0.78-v0.0.83 (2026-02-27) - Verification Iterations

Six plan-mode verification passes confirmed: 26 tables, 136 endpoints, 81 test files, 52 components, 16 pages, 5 media processors. All prior P1/P2 items confirmed resolved.

### v0.0.77 (2026-02-27) - Missing API Endpoints

Added `POST /v4/bulk/files/metadata`, `POST /v4/projects/:id/duplicate`, `POST /v4/shares/:id/invite`. Count: 133 → 136.

### v0.0.76 (2026-02-27) - Notification Settings & Collection File Viewer

Added notification settings API (GET/PUT), `notification_settings` table (26th table). Fixed collection file click navigation. Count: 131 → 133.

### v0.0.75 (2026-02-27) - Member Management API

Added 8 workspace/project member management endpoints. Count: 123 → 131.

### v0.0.74 (2026-02-26) - Session Limits & CDN Provider

Session limit enforcement (max 10, oldest evicted). Bunny CDN with token-based URL signing.

### v0.0.73 (2026-02-26) - SMTP Email Provider

Full SMTP provider via nodemailer, 10 templates, 75 email tests. API providers fall back to SMTP.

### v0.0.72 (2026-02-26) - Comment Permission Check

Comment deletion checks for owner, account admin, or `full_access` permission.

### v0.0.71 (2026-02-26) - WebSocket Channel Permissions

File and share channel subscription verifies project/account access.

### v0.0.70 (2026-02-26) - Permission Validation Before Grant

`validatePermissionChange()` prevents lowering inherited permissions on grant.

### v0.0.69 (2026-02-26) - Session Cache & Transcription Permissions

`invalidateOnRoleChange()` wired in accounts.ts. Transcription uses project-level permission checks.

### v0.0.56 (2026-02-26) - Database Migration Drift Fixed

migrate.ts updated from 11 to 25 tables. Added 14 missing tables, 8 missing file columns, 3 missing share columns, 61 indexes.

### v0.0.55 (2026-02-18) - Deep Analysis

250+ parallel subagents confirmed 123 endpoints, 14 missing migration tables, 12 TODOs. Found grant permission API gap, WebSocket permission stubs.

### v0.0.54 (2026-02-18) - Comprehensive Codebase Analysis

Corrected endpoint count to 123. Found share table columns, ~40 missing indexes, file channel permission stub.

### v0.0.53 (2026-02-18) - Migration Drift Identified

First identification of 14 missing tables in migrate.ts (44% coverage). Cataloged 12 TODOs.
