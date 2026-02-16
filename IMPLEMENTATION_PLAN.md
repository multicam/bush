# IMPLEMENTATION PLAN - Bush Platform

## PROJECT OVERVIEW

Bush is a cloud-based creative collaboration platform for video, design, and marketing teams. It provides a unified workspace for uploading creative files (100+ formats, up to 5TB), managing projects through a hierarchical workspace/project/folder structure, conducting frame-accurate review and approval with annotations, managing workflows via rich metadata and dynamic Collections, and sharing work externally through custom-branded presentations.

The ultimate goal is to build a production-grade platform that rivals Frame.io, serving the full creative asset lifecycle from camera capture through final delivery, with web, mobile (iOS/iPad), desktop (Transfer app), and third-party integrations (Adobe, NLE editors).

**Current Status**: Greenfield project - specifications complete, no implementation exists yet.

---

## LOCKED TECHNOLOGY STACK

**Source of Truth**: `/home/tgds/projects/bush/specs/README.md` (lines 38-58)

| Category | Technology | Notes |
|----------|------------|-------|
| **Frontend (Web)** | Next.js + TypeScript | SSR, routing, API routes |
| **Frontend (Mobile)** | Native Swift | iOS/iPadOS/Apple TV (Phase 2) |
| **Desktop Transfer App** | Tauri | Phase 2 — webapp is standard upload path |
| **Backend API** | Bun + TypeScript | RESTful V4 API, WebSockets, OAuth 2.0 |
| **Database** | SQLite | Primary relational store (NOT PostgreSQL) |
| **Cache / Realtime** | Redis | Caching, sessions, rate limiting, pub/sub |
| **Search** | SQLite FTS5 | Upgrade path to dedicated engine if needed |
| **Object Storage** | S3-compatible API | Provider-agnostic (AWS S3, R2, MinIO, B2) |
| **CDN** | TBD (preference: Bunny CDN) | CDN-agnostic abstraction |
| **Media Processing** | FFmpeg | Transcoding, thumbnails, filmstrips, waveforms |
| **Message Queue** | BullMQ + Redis | Async jobs: transcoding, transcription, notifications |
| **Transcription** | TBD (abstracted interface) | 27 languages, speaker ID — provider chosen later |
| **AI/ML (Vision)** | TBD | Visual search / Media Intelligence |
| **Deployment** | TBD | **No Docker, no Kubernetes** (explicit requirement) |
| **CI/CD** | GitHub Actions | |

---

## ARCHITECTURE DECISIONS

### Core Hierarchy
```
Account → Workspace → Project → Folder → [File | Version Stack | Folder]
```

### Deployment Philosophy
- **No containers**: No Docker, no Kubernetes (explicit requirement from specs/README.md)
- **Simple deployment**: Direct process management or traditional hosting
- **Monolithic start**: Can split into microservices later if needed
- **SQLite advantages**: Single file database, no separate DB server, perfect for initial deployment

### Third-Party Service Dependencies

**Required Immediately (Phase 1)**:
- Object storage (S3-compatible: AWS S3, Cloudflare R2, Backblaze B2, or MinIO)
- Email delivery (SendGrid or AWS SES for notifications, share invites)
- OAuth providers (Google, Apple, Adobe IMS)

**Required for Advanced Features (Phase 3)**:
- Transcription API (AWS Transcribe, Deepgram, or AssemblyAI for 27-language support with speaker ID)
- Vision API (AWS Rekognition or Google Vision for visual search - Phase 3+)

---

## PHASE 1: FOUNDATION [Priority: CRITICAL]

**Status**: Not started

Core infrastructure and data models that everything else depends on. **No implementation exists yet.**

### 1.1 Database Schema & Core Data Models

**Dependencies**: None (foundation layer)

**SQLite Schema Design**:
- Account model (id, owner_id, plan_tier, storage_quota_bytes, created_at)
- User model (id, email, name, avatar_url, account_id, role, created_at)
- Workspace model (id, account_id, name, settings_json, created_at)
- Project model (id, workspace_id, name, logo_url, status, is_restricted, notification_enabled, lifecycle_settings_json)
- Folder model (id, project_id, parent_folder_id, name, is_restricted)
- File model (id, folder_id, version_stack_id, filename, size_bytes, mime_type, storage_key, status, metadata_json, created_at)
- VersionStack model (id, project_id, folder_id, name, current_version_id)

**Hierarchy Enforcement**:
- Foreign key constraints to enforce Account > Workspace > Project > Folder > File
- Check constraints for validation
- Triggers for cascade operations

**References**:
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 2 (Workspace Management)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 3.1 (Hierarchy)

**Implementation Steps**:
1. Design SQLite schema with proper indexes and foreign keys
2. Create migration system (consider Drizzle ORM or Kysely for TypeScript)
3. Implement models with TypeScript types
4. Write schema validation tests
5. Set up seed data for development

---

### 1.2 User & Authentication System

**Dependencies**: Database schema (1.1)

**User Model**:
- Account roles: Account Owner, Content Admin, Member, Guest, Reviewer
- User attributes: email, name, avatar, password_hash (bcrypt), 2fa_secret, created_at
- Account association: Each user belongs to one account (multi-account via account switcher)

**Authentication Methods**:
- Email/password (bcrypt for hashing, minimum 8 characters)
- Google Sign-In (OAuth 2.0)
- Apple ID (OAuth 2.0)
- Adobe ID (Adobe IMS OAuth)
- Two-factor authentication (TOTP, QR code generation)

**Session Management**:
- Redis-based sessions (session tokens stored in Redis with TTL)
- JWT for API authentication (access token + refresh token)
- Token expiration: Access token 1 hour, refresh token 30 days
- Secure cookie handling (httpOnly, secure, sameSite)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 1.2 (Account Roles)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 1.3 (Authentication)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 1 (Account & Authentication)

**Implementation Steps**:
1. Set up Bun server with authentication routes
2. Implement bcrypt password hashing
3. Integrate OAuth providers (Google, Apple, Adobe IMS)
4. Implement TOTP 2FA with QR code generation
5. Set up Redis session storage
6. Create JWT signing and verification
7. Build account switcher logic (multi-account support)
8. Write authentication tests (unit + integration)

---

### 1.3 Permission System

**Dependencies**: User & Authentication (1.2), Database schema (1.1)

**Five Permission Levels**:
1. **Full Access**: All abilities (upload, manage, share, delete, download)
2. **Edit & Share**: Upload, manage, share, comment, view, download
3. **Edit**: Same as Edit & Share WITHOUT share/download
4. **Comment Only**: Comment and view only
5. **View Only**: View only

**Permission Storage**:
- WorkspacePermission model (workspace_id, user_id, permission_level)
- ProjectPermission model (project_id, user_id, permission_level)
- FolderPermission model (folder_id, user_id, permission_level) - for Restricted Folders (Team+ plan)
- AccessGroup model (id, account_id, name) - for bulk permission management

**Permission Inheritance Rules**:
- Workspace permissions cascade to Projects
- Project permissions cascade to Folders/Assets
- **Cannot lower inherited permissions** (critical constraint)
- Restricted Projects break inheritance chain (invite-only)
- Restricted Folders break inheritance (Team+ feature)
- Account Owner and Content Admin always retain access

**Permission Check Algorithm**:
```typescript
function checkPermission(user, resource, action): boolean {
  // 1. Check if Account Owner or Content Admin (always full access)
  if (user.role === 'owner' || user.role === 'admin') return true;

  // 2. Get resource hierarchy (folder -> project -> workspace)
  const hierarchy = getResourceHierarchy(resource);

  // 3. Check for restricted resource (breaks inheritance)
  if (resource.is_restricted) {
    // Only direct permissions count
    return hasDirectPermission(user, resource, action);
  }

  // 4. Walk up hierarchy, collect highest permission
  let maxPermission = null;
  for (const parent of hierarchy) {
    const perm = getDirectPermission(user, parent);
    if (perm && isHigherPermission(perm, maxPermission)) {
      maxPermission = perm;
    }
  }

  // 5. Check if permission allows action
  return permissionAllowsAction(maxPermission, action);
}
```

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 2.1 (Permission Levels)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 2.2 (Inheritance)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 2.3 (Restricted Projects)
- `/home/tgds/projects/bush/specs/11-security-features.md` (Access Groups)

**Implementation Steps**:
1. Create permission models in database
2. Implement permission inheritance algorithm
3. Build permission check middleware for API routes
4. Implement Restricted Project/Folder logic
5. Create Access Groups for bulk management
6. Write extensive permission tests (all edge cases)
7. Document permission matrix for all resource types

---

### 1.4 RESTful API Foundation (V4)

**Dependencies**: Authentication (1.2), Permissions (1.3), Database (1.1)

**API Framework**: Bun + TypeScript (Hono or Elysia recommended for routing)

**Response Format** (JSON:API-style):
```json
{
  "data": [...],
  "links": { "next": "cursor_token" },
  "total_count": 21
}
```

**Error Format**:
```json
{
  "errors": [{
    "detail": "Resource not found",
    "source": { "pointer": "/data/id" },
    "title": "Not Found"
  }]
}
```

**HTTP Status Codes**:
- 200 (OK), 201 (Created), 204 (No Content)
- 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)
- 422 (Unprocessable Entity), 429 (Too Many Requests)
- 500 (Internal Server Error)

**Cursor-Based Pagination**:
- Default: 50 items per page
- Max: 100 items per page
- Cursor token encodes: last_id, sort_field, sort_direction
- Optional total_count (expensive, only when requested)

**Rate Limiting** (Leaky Bucket Algorithm):
- Store bucket state in Redis (key: `rate_limit:{user_id}:{endpoint}`)
- Different limits per endpoint:
  - Standard endpoints: 10 req/min
  - High-throughput endpoints: 100 req/sec
- Response headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`

**Core Resource Endpoints** (CRUD for all):
- `/v4/accounts`
- `/v4/workspaces`
- `/v4/projects`
- `/v4/folders`
- `/v4/files`
- `/v4/version_stacks`
- `/v4/users`
- `/v4/comments`
- `/v4/shares`
- `/v4/custom_fields`
- `/v4/webhooks`

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 21.4 (Response Format)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 21.5 (Error Format)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 18.2 (Rate Limiting)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 18.3 (Core Resources)

**Implementation Steps**:
1. Set up Bun HTTP server with chosen routing framework
2. Implement OAuth 2.0 middleware
3. Create rate limiting middleware (Redis-backed leaky bucket)
4. Build cursor pagination utility
5. Create response/error formatting utilities
6. Implement CRUD routes for all core resources
7. Add OpenAPI spec generation (for API documentation)
8. Write API integration tests
9. Set up API documentation site (Scalar or similar)

---

### 1.5 Object Storage Layer

**Dependencies**: None (infrastructure layer)

**Storage Abstraction** (S3-compatible interface):
```typescript
interface ObjectStorage {
  generatePresignedUploadUrl(key: string, expiresIn: number): Promise<string>;
  generatePresignedDownloadUrl(key: string, expiresIn: number): Promise<string>;
  uploadObject(key: string, data: Buffer): Promise<void>;
  downloadObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  copyObject(sourceKey: string, destKey: string): Promise<void>;
  listObjects(prefix: string): Promise<string[]>;
}
```

**Provider Options** (choose one initially, abstraction allows switching):
- AWS S3 (most mature, highest cost)
- Cloudflare R2 (S3-compatible, zero egress fees, good pricing)
- Backblaze B2 (S3-compatible, very low cost)
- MinIO (self-hosted, S3-compatible, good for development)

**Storage Key Structure**:
```
{account_id}/{project_id}/{file_id}/original/{filename}
{account_id}/{project_id}/{file_id}/proxies/{resolution}/{filename}
{account_id}/{project_id}/{file_id}/thumbnails/{size}/{filename}
```

**Pre-Signed Upload Flow**:
1. Client requests upload URL: `POST /v4/files` (creates file record, returns upload URL)
2. Client uploads chunks directly to S3 using pre-signed URLs
3. Client notifies completion: `PUT /v4/files/{id}/complete`
4. Server enqueues processing job (transcoding, thumbnail generation)

**Storage Quota Tracking**:
- Store quota in Account model: `storage_quota_bytes`, `storage_used_bytes`
- Update on file upload/delete (atomic increment/decrement)
- Check quota before generating upload URL
- Plan tiers: Free (2GB), Pro (2TB+2TB/member), Team (3TB+2TB/member), Enterprise (custom)

**Storage Connect** (Phase 4):
- Customer-owned AWS S3 buckets
- Read/write to primary bucket
- Read-only additional buckets
- Bush proxies stored separately in Bush-managed storage

**References**:
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 4.2 (Pre-signed URLs)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 14.1 (Storage Quotas)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 14.2 (Storage Connect)

**Implementation Steps**:
1. Choose initial provider (recommend R2 or B2 for cost)
2. Implement storage abstraction interface
3. Create S3 client wrapper (AWS SDK or direct HTTP)
4. Build pre-signed URL generation
5. Implement chunked upload support (multipart upload)
6. Create storage quota tracking
7. Write storage layer tests
8. Set up development storage (MinIO or B2)

---

### 1.6 Web Application Shell

**Dependencies**: API (1.4), Authentication (1.2)

**Framework**: Next.js 15+ with App Router + TypeScript

**Core Pages**:
- `/login` - Authentication page (email/password, social login, 2FA)
- `/signup` - Registration flow
- `/` - Dashboard (redirect to default workspace)
- `/workspaces` - Workspace list and switcher
- `/workspaces/[id]` - Workspace view (project list)
- `/workspaces/[id]/projects/[projectId]` - Project view (file browser)
- `/settings` - User settings (account, billing, notifications)

**Global Navigation Components**:
- Account Switcher (multiple accounts support)
- Workspace Sidebar (collapsible)
- Project List (filterable: active/inactive, search)
- Folder Tree Navigator (nested folders, drag-and-drop)
- Breadcrumb Navigation

**Multi-Panel Layout**:
- Left Panel: Folder tree (collapsible)
- Center Panel: File grid/list view
- Right Panel: Metadata inspector (collapsible)
- Bottom Panel: Upload queue (collapsible)

**Authentication Flows**:
- Email/password login
- OAuth flows (Google, Apple, Adobe)
- 2FA code entry
- Password reset
- Account creation

**State Management**:
- React Context for global state (auth, current workspace/project)
- React Query / TanStack Query for server state (caching, refetching)
- Local state for UI (panel visibility, selected files)

**References**:
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 1.4 (Account Switcher)
- `/home/tgds/projects/bush/specs/03-file-management.md` (Multi-Panel Layout)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 5.3 (Breadcrumb Navigation)

**Implementation Steps**:
1. Initialize Next.js project with TypeScript
2. Set up routing structure (App Router)
3. Create authentication pages and flows
4. Build global navigation components
5. Implement multi-panel layout with collapse/expand
6. Set up state management (Context + React Query)
7. Create folder tree component (nested, drag-drop)
8. Build breadcrumb navigation
9. Implement account switcher
10. Add responsive design (mobile, tablet, desktop)
11. Write component tests (Vitest + Testing Library)

---

## PHASE 2: CORE FEATURES [Priority: HIGH]

**Status**: Not started

Essential features for a minimum viable product. **Requires Phase 1 completion.**

### 2.1 File Upload System

**Dependencies**: API (1.4), Storage (1.5), Permissions (1.3), Web Shell (1.6)

**Upload Methods** (Phase 2 focuses on web upload):
- Web browser drag-and-drop
- Folder drag-and-drop (bulk upload with structure preservation)
- File picker dialog (multi-select)

**Chunked Upload Protocol** (5TB max file size):
- Chunk size: 10MB (configurable)
- Parallel chunk uploads: 3-5 concurrent
- Resumable uploads (store progress in browser IndexedDB)
- Retry logic per chunk (exponential backoff)

**Upload Flow**:
1. User selects files/folders
2. Frontend validates MIME types against 100+ supported formats
3. Frontend requests upload URLs: `POST /v4/files` (batch)
4. Server generates pre-signed URLs, creates file records (status: uploading)
5. Frontend uploads chunks to S3 directly
6. Frontend reports completion: `PUT /v4/files/{id}/complete`
7. Backend enqueues media processing job
8. Backend sends WebSocket update on processing completion

**Upload Constraints**:
- Max concurrent uploads: 10
- Max assets per upload: 500
- Max folders per upload: 250
- Max file size: 5TB

**Upload Queue UI**:
- Real-time progress bars (per file and overall)
- Pause/resume per file
- Priority queue (drag-to-reorder)
- Cancel upload
- Retry failed uploads
- Clear completed uploads

**MIME Type Validation** (100+ formats):
- **Video** (9 formats): 3GPP, AVI, FLV, MKV, MOV, MP4, MXF, WebM, WMV
- **Audio** (8 formats): AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA
- **Image** (25+ formats): RAW (15+ camera types), AI, EPS, INDD, BMP, EXR, GIF, HEIC, JPG, PNG, PSD, TGA, TIFF, WebP
- **Documents** (5 types): PDF, DOCX, PPTX, XLSX, Interactive ZIP (HTML)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.1 (Upload Methods)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.2 (Chunked Upload)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 4.2 (Priority Queue)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.3 (MIME Types)

**Implementation Steps**:
1. Build file/folder drag-and-drop component
2. Implement MIME type validation
3. Create chunked upload client library
4. Build resumable upload with IndexedDB state
5. Implement upload queue UI
6. Add progress tracking (per-chunk and overall)
7. Create priority queue management
8. Build folder structure preservation logic
9. Add WebSocket connection for real-time updates
10. Write upload tests (unit + E2E)

---

### 2.2 Media Processing Pipeline

**Dependencies**: Upload (2.1), Storage (1.5), Message Queue (BullMQ + Redis)

**Processing Jobs** (async via BullMQ):
1. **Thumbnail Generation**: Extract frame at 50% duration, resize to 320x180, 640x360, 1280x720
2. **Hover Scrub Filmstrip**: Extract frames at 1-second intervals, create sprite sheet
3. **Proxy Transcoding**: Generate H.264 MP4 proxies at 360p, 540p, 720p, 1080p, 4K (if Pro+)
4. **Audio Waveform**: Extract audio, generate waveform data (JSON or PNG)
5. **Metadata Extraction**: FFprobe for technical metadata (33 built-in fields)

**FFmpeg Commands** (example):
```bash
# Thumbnail generation
ffmpeg -i input.mp4 -ss 00:01:00 -vframes 1 -vf scale=640:360 thumb.jpg

# Proxy transcoding (720p)
ffmpeg -i input.mp4 -vf scale=-2:720 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k proxy_720p.mp4

# Filmstrip generation
ffmpeg -i input.mp4 -vf "fps=1,scale=160:90,tile=10x10" filmstrip.jpg

# Waveform generation
ffmpeg -i input.mp4 -filter_complex "showwavespic=s=1920x200:colors=blue" waveform.png

# Metadata extraction
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

**Job Queue Design** (BullMQ):
- Queue: `media-processing`
- Concurrency: 4 workers (configurable)
- Job priorities: thumbnail (high), proxy (medium), waveform (low)
- Retry: 3 attempts with exponential backoff
- Failure handling: Mark file as processing_failed, send notification

**Processing Status Tracking**:
- File model status: `uploading` → `processing` → `ready` / `processing_failed`
- Store processing progress: `processing_progress_percent` (0-100)
- WebSocket updates to frontend on status changes

**HDR Proxy Support**:
- Detect HDR (Dolby Vision, HDR10, HLG) via FFprobe
- Tone map to SDR for proxies: `-vf zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`
- Preserve HDR for 4K proxy (Pro+ feature)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.4 (Proxy Generation)
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 6.1 (Metadata Fields)

**Implementation Steps**:
1. Set up BullMQ with Redis
2. Create media processing worker
3. Implement FFmpeg wrapper functions
4. Build thumbnail generation job
5. Create proxy transcoding job (multiple resolutions)
6. Implement filmstrip generation
7. Build waveform generation
8. Create metadata extraction (FFprobe parsing)
9. Add HDR detection and tone mapping
10. Implement progress tracking and WebSocket updates
11. Add error handling and retry logic
12. Write processing pipeline tests

---

### 2.3 Asset Browser & Navigation

**Dependencies**: API (1.4), Upload (2.1), Processing (2.2), Permissions (1.3)

**View Modes**:
- **Grid View**: Thumbnail cards with adjustable size (small, medium, large)
- **List View**: Compact rows with metadata columns

**Grid View Customization**:
- Card size: Small (160px), Medium (240px), Large (320px)
- Aspect ratio: 16:9, 1:1, 9:16 (for thumbnail display)
- Thumbnail scale: Fit (letterbox/pillarbox) or Fill (crop to fit)
- Show/hide card info (filename, metadata badges)

**Flatten Folders View**:
- Toggle to show all nested assets in flat list
- Breadcrumb shows original location
- Useful for searching/filtering across folders

**Sorting**:
- Sort by any metadata field (date uploaded, filename, size, custom fields)
- Ascending/descending
- Multi-level sort (primary, secondary)

**Drag-and-Drop Operations**:
- Drag files to folder (move)
- Drag files with Cmd/Ctrl (copy)
- Drag to reorder in custom sort mode
- Visual feedback during drag (ghost image, drop target highlighting)

**Multi-Select** (max 200 assets):
- Click + Shift (range select)
- Click + Cmd/Ctrl (toggle individual)
- Select all (Cmd+A / Ctrl+A)
- Deselect all (Cmd+Shift+A / Ctrl+Shift+A)
- Bulk actions: Move, Copy, Delete, Download, Edit Metadata

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 6.4 (Flatten Folders)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.2 (Multi-Select)

**Implementation Steps**:
1. Build grid view component with virtualization (react-window or similar)
2. Create list view component
3. Implement card size adjustment
4. Add aspect ratio and thumbnail scale options
5. Build flatten folders logic
6. Implement sorting by metadata fields
7. Create drag-and-drop handlers (move/copy)
8. Build multi-select functionality
9. Add bulk action toolbar
10. Optimize performance (virtualization, lazy loading)
11. Write asset browser tests

---

### 2.4 Asset Operations

**Dependencies**: Asset Browser (2.3), Permissions (1.3), Storage (1.5)

**Operations**:
- **Copy To**: Duplicate asset to another folder/project (with metadata)
- **Move To**: Relocate asset (permission check on source and destination)
- **Delete**: Move to Recently Deleted (30-day retention)
- **Recover**: Restore from Recently Deleted
- **Permanent Delete**: After 30 days or manual permanent delete
- **Download Original**: Generate download URL for original file
- **Download Proxy**: Generate download URL for proxy (select resolution)
- **Set Custom Thumbnail**: Upload custom image or select frame from video

**Trash Management**:
- Recently Deleted folder per project
- Auto-delete after 30 days
- Manual permanent delete (Owner/Admin only)
- Recover restores to original location

**Download Flow**:
1. User requests download: `POST /v4/files/{id}/download` (specifies original or proxy)
2. Server checks permissions (Edit & Share or higher for download)
3. Server generates pre-signed S3 download URL (expires in 1 hour)
4. Server returns download URL
5. Frontend initiates download

**Custom Thumbnail Upload**:
1. User uploads image (drag-drop or file picker)
2. Frontend uploads to: `{account_id}/{project_id}/{file_id}/thumbnails/custom/{filename}`
3. Server updates file record: `custom_thumbnail_key`
4. Asset browser displays custom thumbnail instead of auto-generated

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.6 (Custom Thumbnail)

**Implementation Steps**:
1. Implement copy/move API endpoints
2. Create delete and recover endpoints
3. Build Recently Deleted UI
4. Implement 30-day auto-delete job (BullMQ scheduled job)
5. Create download URL generation
6. Build custom thumbnail upload
7. Add permission checks for all operations
8. Write operation tests

---

### 2.5 Version Stacking

**Dependencies**: Upload (2.1), Asset Browser (2.3)

**Version Stack Concept**:
- Group multiple versions of same asset (e.g., v1, v2, v3 of logo.png)
- Automatic version numbering
- Comments persist across all versions in stack
- One "current" version displayed by default

**Creating Version Stack**:
1. User drags new file onto existing asset
2. Frontend detects drop on existing asset
3. Frontend creates version: `POST /v4/version_stacks/{stack_id}/versions` (uploads file)
4. Backend increments version number, creates new file record linked to stack
5. Backend updates stack's current_version_id to new version

**Version Stack Model**:
```typescript
VersionStack {
  id: string;
  project_id: string;
  folder_id: string;
  name: string;
  current_version_id: string;
  created_at: Date;
}

File {
  id: string;
  version_stack_id: string | null; // null if not in stack
  version_number: number | null; // 1, 2, 3, ... (null if not in stack)
  // ... other file fields
}
```

**Version Operations**:
- View all versions (expand stack)
- Download specific version
- Set version as current
- Compare versions (opens comparison viewer)
- Delete version (requires admin permission)

**Comment Persistence**:
- Comments linked to version_stack_id, not individual file_id
- Comments visible across all versions
- Comment timestamp maps to frame number (video) or page (PDF)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 4.5 (Version Stacking)

**Implementation Steps**:
1. Create VersionStack and File linking in schema
2. Implement drag-new-version-onto-asset detection
3. Build version creation API endpoint
4. Create version list UI (expand stack)
5. Implement version comparison logic
6. Ensure comments persist across versions
7. Write version stacking tests

---

### 2.6 Video Player

**Dependencies**: Asset Browser (2.3), Processing (2.2), CDN setup

**Player Architecture Decision**: Custom HTML5 video player vs. Video.js/Shaka Player
- **Recommendation**: Start with Video.js (extensible, frame-accurate seeking possible)
- Evaluate custom player later if Video.js limitations found

**Core Player Controls**:
- Play/Pause (Space, K)
- Scrub timeline (drag playhead)
- Frame-by-frame navigation (Left/Right arrows)
- JKL shuttle controls:
  - J: Reverse at 2x, 4x, 8x (press repeatedly)
  - K: Pause
  - L: Forward at 2x, 4x, 8x (press repeatedly)
- Volume control (Up/Down arrows, drag slider)
- Mute toggle (M)
- Full screen (F)

**Playback Features**:
- Playback speed: 0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x
- Loop playback toggle
- In/out point marking (I/O keys)
- Range playback (play only between in/out points)

**Adaptive Streaming**:
- HLS (HTTP Live Streaming) format (m3u8 playlists)
- Auto quality selection based on bandwidth
- Manual resolution selection: 360p, 540p, 720p, 1080p, 4K (Pro+)
- FFmpeg generates HLS playlists during proxy transcoding

**Frame Guides / Aspect Ratio Overlays**:
- Preset ratios: 16:9, 4:3, 1:1, 9:16, 2.39:1, custom
- Overlay guide lines on player
- Mask mode: Darken area outside guide (semi-transparent black overlay)

**Timeline Features**:
- Frame-accurate hover preview (show thumbnail from filmstrip)
- Zoom timeline (for precise scrubbing)
- Marker display (comments appear as markers on timeline)

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| Space | Play/Pause |
| K | Pause |
| J | Reverse shuttle (2x/4x/8x) |
| L | Forward shuttle (2x/4x/8x) |
| Left/Right | Frame back/forward |
| Up/Down | Volume up/down |
| M | Mute toggle |
| F | Full screen |
| I | Set in point |
| O | Set out point |
| Esc | Exit full screen |

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.1 (Keyboard Shortcuts)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.2 (Resolution)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.3 (JKL Shuttle)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.4 (Frame Guides)

**Implementation Steps**:
1. Evaluate Video.js and set up base player
2. Implement frame-accurate seeking (GOP-aware)
3. Add JKL shuttle controls
4. Build custom controls UI
5. Implement in/out point marking
6. Create frame guide overlays
7. Add hover preview on timeline
8. Implement HLS adaptive streaming
9. Create resolution selector
10. Add all keyboard shortcuts
11. Test frame accuracy and playback performance

---

### 2.7 Image Viewer

**Dependencies**: Asset Browser (2.3), Processing (2.2)

**Zoom Features**:
- Zoom levels: 25%, 50%, 75%, 100%, 150%, 200%, 300%, 400%
- Zoom controls: +/- buttons, slider, mouse wheel
- Zoom to cursor position (center on cursor during zoom)

**Navigation**:
- Pan with drag (when zoomed in)
- Fit to screen (default view)
- 1:1 pixel view (100% zoom)
- Reset view button

**Mini-Map**:
- Show for large images (>2000px width or height)
- Thumbnail overview in corner
- Highlight visible viewport area
- Click mini-map to jump to area

**Image Format Support**:
- Standard: JPG, PNG, GIF, WebP, BMP, TIFF
- RAW (15+ camera formats): Convert to high-res JPG proxy for viewing
- Adobe: PSD, AI, EPS (render to raster proxy)
- HDR: EXR (tone-mapped proxy for viewing)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.5 (Image Viewer)

**Implementation Steps**:
1. Build image viewer component with zoom
2. Implement pan navigation
3. Add zoom to cursor feature
4. Create mini-map for large images
5. Build fit-to-screen and 1:1 pixel view
6. Test with various image formats and sizes

---

### 2.8 PDF Viewer

**Dependencies**: Asset Browser (2.3), Processing (2.2)

**PDF Rendering**: Use PDF.js (Mozilla's PDF viewer library)

**Multi-Page Navigation**:
- Page thumbnails sidebar (scrollable)
- Previous/Next page buttons
- Page jump input (type page number)
- Keyboard navigation (Page Up/Down, Arrow keys)

**Zoom Controls**:
- Zoom in/out buttons
- Zoom slider
- Fit width, Fit page, Actual size
- Mouse wheel zoom

**PDF-Specific Features**:
- Text selection (for copying)
- Search within PDF
- Page rotation (90° increments)

**Commenting**:
- Pagestamp comments (attached to specific page)
- Anchored comments (pinned to XY position on page)
- Text markups (highlight text, add note)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.6 (PDF Viewer)

**Implementation Steps**:
1. Integrate PDF.js for rendering
2. Build page thumbnail sidebar
3. Implement navigation controls
4. Add zoom and fit options
5. Create page rotation feature
6. Build pagestamp commenting (linked to page number)
7. Test with multi-page PDFs and large files

---

### 2.9 Comments & Annotations

**Dependencies**: Player (2.6), Image Viewer (2.7), PDF Viewer (2.8), Permissions (1.3), Notifications (2.11)

**Comment Types**:
1. **Single-Frame**: Timestamped to specific frame (video) or page (PDF)
2. **Range-Based**: Spans in/out points (video only)
3. **Anchored**: Pinned to XY screen location (video, image, PDF)
4. **Internal**: Visible only to workspace members
5. **Public**: Visible to all reviewers (share recipients)

**Comment Model**:
```typescript
Comment {
  id: string;
  version_stack_id: string; // linked to stack, not individual file
  user_id: string;
  parent_comment_id: string | null; // for threaded replies
  type: 'single_frame' | 'range' | 'anchored' | 'internal' | 'public';
  timestamp_start: number | null; // seconds (video) or page number (PDF)
  timestamp_end: number | null; // seconds (for range comments)
  position_x: number | null; // for anchored comments
  position_y: number | null;
  text: string;
  annotations: AnnotationData | null; // drawing data
  attachments: Attachment[]; // up to 6 files (Pro+ feature)
  is_complete: boolean;
  created_at: Date;
  updated_at: Date;
}
```

**Comment Features**:
- Text body (markdown support)
- Emoji reactions
- @mentions (trigger notifications)
- Hashtags (for filtering: #approved, #revise, etc.)
- Color hex codes (auto-detected and rendered: #FF5733)
- **Attachments**: Up to 6 images/videos/audio/PDFs per comment (Pro+ plan)

**Annotation Tools**:
- Free draw (pen tool with configurable brush size)
- Line (straight line)
- Arrow (directional arrow)
- Rectangle (hollow box)
- Color picker (red, blue, green, yellow, black, white, custom)
- Undo/redo (per annotation session)

**Annotation Rendering**:
- HTML5 Canvas overlay on video player / image viewer
- Store annotation data as SVG path commands or Canvas drawing commands (JSON)
- Replay annotations when viewing comment

**Comment Panel**:
- Thread view (comments and replies)
- Filter controls:
  - By user (dropdown)
  - By hashtag (dropdown)
  - By status (complete/incomplete)
  - By type (single/range/anchored)
- Sort options: Newest first, Oldest first, By timestamp
- Quick actions: Reply, Edit, Delete, Mark Complete, Copy permalink

**Comment Export Formats**:
1. **CSV**: Timestamp, User, Text, Status (one row per comment)
2. **Plain Text**: Formatted text document
3. **EDL** (Edit Decision List): CMX 3600 format for NLE import
   - Maps comments to timeline markers with timecode
   - Format: `001  AX       V     C        00:00:10:00 00:00:10:00 00:00:10:00 00:00:10:00`
   - Comment text in `* FROM CLIP NAME:` field

**Comment Permissions Matrix**:
| Action | Owner/Admin | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|-------------|-------------|--------------|------|--------------|-----------|
| Create | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| View | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Delete Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit Any | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete Any | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

**Real-Time Synchronization**:
- WebSocket events for new comments, replies, edits, deletes
- Optimistic UI updates (instant feedback, reconcile on server response)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 8.1 (Comment Types)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 8.2 (Comment Body)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 8.3 (Annotations)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 8.4 (Export)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 8.5 (Permissions)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 8.6 (Attachments)

**Implementation Steps**:
1. Create Comment and Annotation database models
2. Implement comment CRUD API endpoints
3. Build comment creation UI (click on player/image/PDF)
4. Create annotation canvas overlay
5. Implement annotation tools (draw, line, arrow, rectangle)
6. Build color picker and undo/redo
7. Implement comment panel with filters and sorting
8. Add @mention detection and notifications
9. Create hashtag detection and filtering
10. Implement comment attachments (up to 6 files)
11. Build comment export (CSV, Plain Text, EDL)
12. Add WebSocket real-time synchronization
13. Write comment system tests

---

### 2.10 Metadata System

**Dependencies**: Database (1.1), Upload (2.1), Processing (2.2), Permissions (1.3)

**33 Built-In Metadata Fields**:

**Technical/Read-Only** (auto-populated by FFprobe):
- Alpha Channel, Audio Bit Depth, Audio Bit Rate, Audio Codec
- Bit Depth, Bit Rate, Channels, Color Space
- Duration, Dynamic Range, End Time, Start Time
- Frame Rate, Resolution Height, Resolution Width
- Sample Rate, Video Bit Rate, Video Codec

**File Info** (auto-populated):
- Date Uploaded, File Size, File Type, Format, Page Count, Source Filename

**Collaboration** (editable):
- Assignee (user reference), Keywords (tags), Notes (multi-line text), Rating (1-5 stars), Status (single-select)

**Auto-Generated** (read-only):
- Comment Count, Seen By (list of users who viewed), Transcript, Uploader

**10 Custom Metadata Field Types**:
1. **Single-line text**: Short text input (max 255 chars)
2. **Multi-line text**: Textarea (max 5000 chars)
3. **Number**: Integer or decimal
4. **Date**: Date picker (ISO 8601 format)
5. **Single-select**: Dropdown with predefined options
6. **Multi-select**: Multiple choice from predefined options
7. **Checkbox**: Boolean (true/false)
8. **User reference**: Reference to user in account
9. **URL**: Validated URL input
10. **Rating**: 1-5 stars

**Custom Field Model**:
```typescript
CustomField {
  id: string;
  account_id: string;
  name: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'user' | 'url' | 'rating';
  options: string[] | null; // for select/multiselect types
  is_required: boolean;
  permission: 'admins_only' | 'admins_and_full_access';
  created_at: Date;
}

ProjectCustomField {
  id: string;
  project_id: string;
  custom_field_id: string;
  is_visible: boolean; // show/hide toggle per project
}

FileMetadata {
  file_id: string;
  custom_field_id: string;
  value: string | number | boolean | Date; // type depends on field type
}
```

**Metadata Management**:
- **Account-wide field library**: Define custom field once, use across all projects
- **Field Management Tab** (Admins only): View all custom fields, create/edit/delete, manage visibility per project
- **Per-project visibility toggles**: Show/hide specific custom fields in each project
- **Field permissions**: "Admins Only" (only admins can edit values) vs "Admins & Full Access" (both levels can edit)

**Metadata Persistence**:
- All metadata (built-in and custom) travels with asset
- Preserved on copy/move/duplicate operations
- Stored in file record (built-in) and FileMetadata join table (custom)

**Metadata Display & Editing**:
- Metadata inspector panel (right sidebar)
- Inline editing for editable fields
- Bulk edit: Select multiple assets, edit shared metadata fields
- Metadata badges on asset cards (show key fields)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 6.1 (Built-In Fields)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 6.2 (Custom Fields)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 6.3 (Field Permissions)

**Implementation Steps**:
1. Create CustomField and FileMetadata models
2. Implement metadata extraction during media processing
3. Build custom field management API
4. Create field management UI (admin panel)
5. Build metadata inspector component
6. Implement inline metadata editing
7. Add bulk edit functionality
8. Create per-project field visibility toggles
9. Write metadata system tests

---

### 2.11 Notifications System

**Dependencies**: Comments (2.9), Permissions (1.3), WebSocket (API 1.4), Email service

**Notification Types**:
1. **@Mentions**: User mentioned in comment
2. **Comment Replies**: Reply to user's comment
3. **New Uploads**: New assets uploaded to subscribed project
4. **Status Changes**: Asset status changed (via metadata)
5. **Share Activity**: New share created, share commented

**In-App Notifications**:
- Real-time delivery via WebSocket
- Notification bell icon with unread count badge
- Notification panel (dropdown)
- Mark as read (individual or all)
- Click to navigate to resource (asset, comment, share)

**Email Notifications**:
- **Daily Digest**: Summarize all notifications from past 24 hours (sent at 9am user local time)
- **Immediate Alerts**: Send email within 1 minute of event
- **Per-Project Settings**: Enable/disable notifications per project
- **Per-Asset Subscription**: Follow specific assets for updates

**Email Templates**:
- @Mention: "John mentioned you in a comment on 'logo_v3.png'"
- Reply: "Sarah replied to your comment on 'intro_video.mp4'"
- Upload: "5 new assets uploaded to 'Marketing Campaign' project"
- Status Change: "'final_cut.mp4' status changed to 'Approved'"

**Notification Preferences** (User Settings):
```typescript
UserNotificationSettings {
  user_id: string;
  email_digest_enabled: boolean;
  email_immediate_enabled: boolean;
  email_mentions: boolean;
  email_replies: boolean;
  email_uploads: boolean;
  email_status_changes: boolean;
  email_share_activity: boolean;
}

ProjectNotificationSettings {
  user_id: string;
  project_id: string;
  notifications_enabled: boolean; // override for specific project
}
```

**Notification Model**:
```typescript
Notification {
  id: string;
  user_id: string;
  type: 'mention' | 'reply' | 'upload' | 'status_change' | 'share';
  resource_type: 'comment' | 'file' | 'share';
  resource_id: string;
  actor_user_id: string; // who triggered the notification
  text: string; // notification message
  is_read: boolean;
  created_at: Date;
}
```

**WebSocket Events**:
```typescript
// Server to client
{
  type: 'notification',
  data: Notification
}

// Client to server (mark as read)
{
  type: 'mark_notification_read',
  notification_id: string
}
```

**Email Delivery**:
- Use SendGrid or AWS SES
- Template system (Handlebars or similar)
- Daily digest job (BullMQ scheduled job at 9am per user timezone)
- Immediate alert job (triggered on event, debounced to avoid spam)

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 13.1 (In-App)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 13.2 (Email)

**Implementation Steps**:
1. Create Notification model and preferences models
2. Implement notification creation logic (trigger on events)
3. Build WebSocket notification delivery
4. Create notification panel UI
5. Implement mark-as-read functionality
6. Set up email service (SendGrid/SES)
7. Create email templates
8. Build daily digest job
9. Create immediate alert job with debouncing
10. Add notification preferences UI
11. Write notification system tests

---

### 2.12 Basic Search

**Dependencies**: Database (1.1), Metadata (2.10)

**Search Implementation**: SQLite FTS5 (Full-Text Search)

**Search Scope**:
- Global search across account (all workspaces/projects user has access to)
- Search fields: Filename, Metadata values (custom and built-in), Status, Keywords, Uploader name

**FTS5 Virtual Table**:
```sql
CREATE VIRTUAL TABLE files_fts USING fts5(
  filename,
  metadata_text,  -- concatenated searchable metadata values
  status,
  keywords,
  uploader_name,
  content='files',  -- link to files table
  content_rowid='id'
);

-- Triggers to keep FTS index updated
CREATE TRIGGER files_fts_insert AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, filename, metadata_text, status, keywords, uploader_name)
  VALUES (new.id, new.filename, new.metadata_text, new.status, new.keywords, new.uploader_name);
END;
```

**Search Features**:
- **Instant results**: Search as user types (no Enter required)
- **Typeahead**: Show results after 2+ characters
- **Debouncing**: 300ms delay to avoid excessive queries
- **Relevance ranking**: BM25 algorithm (built-into FTS5)
- **Thumbnail previews**: Show asset thumbnails in results
- **Filter refinement**: Filter results by file type, date range, project

**Search UI**:
- Global search bar (top of page, Cmd+K / Ctrl+K shortcut)
- Search results dropdown (max 10 results, "View All" link)
- Search results page (full list with filters)

**Quick Search** (In-Project):
- Search within current project only (Cmd+F / Ctrl+F)
- Filter asset browser by search term
- Highlight matching text

**Search API**:
```typescript
GET /v4/search?q={query}&type={file_type}&project_id={project_id}

Response:
{
  "data": [
    {
      "id": "file_123",
      "filename": "logo_final.png",
      "thumbnail_url": "https://...",
      "project_id": "proj_456",
      "project_name": "Brand Refresh",
      "match_snippet": "...logo_<b>final</b>.png..."
    }
  ],
  "total_count": 42
}
```

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 12.1 (Search Features)
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 12.3 (Filter Refinement)

**Implementation Steps**:
1. Set up SQLite FTS5 virtual table
2. Create triggers to keep FTS index updated
3. Implement search API endpoint
4. Build global search bar with typeahead
5. Create search results dropdown
6. Build full search results page
7. Add filter refinement (type, date, project)
8. Implement in-project quick search
9. Write search tests (accuracy, performance)

---

## PHASE 3: ADVANCED FEATURES [Priority: MEDIUM]

**Status**: Not started

Important features that enhance the platform beyond MVP. **Requires Phase 2 completion.**

### 3.1 Sharing & Presentations

**Dependencies**: Comments (2.9), Player (2.6), Metadata (2.10), Notifications (2.11), Permissions (1.3)

**Share Types**:
- **Public Share**: Anyone with link can access
- **Secure Share**: Specific email invites only (enter emails, send invites)

**Share Layouts**:
1. **Grid**: Thumbnail grid with individual viewers per asset
2. **Reel**: Sequential single player (auto-advance to next asset)
3. **Open in Viewer**: Single asset, bypass landing page (direct to player)

**Share Settings**:
- **Security**: Passphrase protection, Expiration date/time
- **Permissions**: Allow comments, Allow downloads, Show all versions, Display transcriptions/captions
- **Featured Field**: Default editable field for recipients (e.g., Status, Notes, Rating) — updates sync back to project

**Custom Branding**:
- Icon: Emoji or custom image upload
- Header: Size (small, medium, large), Visibility toggle
- Background: Custom image upload or solid color
- Description: Text below creator name
- Appearance: Light/dark mode toggle
- Accent Colors: Custom color palette (primary, secondary)
- Thumbnail Display: Card size, aspect ratio, info toggle

**WYSIWYG Share Builder**:
- Drag-and-drop assets into share
- Reorder assets
- Live preview pane (see exactly what recipients will see)
- Save draft, publish when ready

**Share Operations**:
- Create share (select assets, configure settings/branding)
- Duplicate share (copy settings to new share)
- Delete share (mark as deleted, keep for activity tracking)
- Copy share link (to clipboard)
- Send via email (enter recipient emails, compose message)

**Share Activity Tracking**:
- Opened Share Link (timestamp, IP address, user agent)
- Viewed Asset (which asset, timestamp)
- Commented (comment ID, timestamp)
- Downloaded (asset ID, timestamp)

**Share Notifications** (recipients receive emails for):
- Invite to new share
- Comment created on their commented assets
- Reply to their comments
- @Mention in comment

**External Share Permissions**:
| Reviewer Type | Access |
|---------------|--------|
| Authenticated | Logged-in Bush user (full workspace member permissions apply) |
| Identified | Email-verified via share invite (can comment/download if enabled) |
| Unidentified | Anyone with public link (can view, comment/download if enabled) |

**Share Model**:
```typescript
Share {
  id: string;
  project_id: string;
  creator_user_id: string;
  name: string;
  layout: 'grid' | 'reel' | 'viewer';
  type: 'public' | 'secure';
  passphrase_hash: string | null;
  expires_at: Date | null;
  allow_comments: boolean;
  allow_downloads: boolean;
  show_all_versions: boolean;
  display_transcriptions: boolean;
  featured_field_id: string | null;
  branding_settings: BrandingSettings;
  created_at: Date;
}

ShareAsset {
  share_id: string;
  file_id: string;
  order: number; // for reordering
}

ShareActivity {
  id: string;
  share_id: string;
  reviewer_email: string | null; // null for unidentified
  activity_type: 'opened' | 'viewed' | 'commented' | 'downloaded';
  resource_id: string | null; // asset_id or comment_id
  created_at: Date;
}
```

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 11 (Shares)
- `/home/tgds/projects/bush/specs/05-sharing-and-presentations.md`

**Implementation Steps**:
1. Create Share, ShareAsset, ShareActivity models
2. Implement share CRUD API endpoints
3. Build share creation wizard UI
4. Create WYSIWYG share builder
5. Implement custom branding controls
6. Build share viewer (public-facing, no auth required)
7. Add passphrase protection
8. Implement expiration date enforcement
9. Create share activity tracking
10. Build share notifications (email invites, comments)
11. Add featured field editing for reviewers
12. Write sharing system tests

---

### 3.2 Collections

**Dependencies**: Metadata (2.10), Search (2.12), Shares (3.1)

**Collection Types**:
- **Team Collection**: Visible to all project members
- **Private Collection**: Creator only

**Collection Features**:
- **Dynamic Filtering**: Save filter rules (e.g., Status = "Approved" AND Rating >= 4)
- **Real-Time Sync**: When source asset changes, Collection updates automatically
- **Manual Asset Addition**: Drag assets into Collection (in addition to filter rules)
- **Custom Sort**: Reorder assets within Collection (drag-to-reorder)
- **List/Grid View**: Same view options as asset browser
- **Share Collections**: Use Share system to share entire Collection

**Filter Rule Builder**:
- Combine multiple conditions with AND/OR logic
- Field comparisons: equals, not equals, contains, greater than, less than, in list
- Supported fields: Status, Rating, Assignee, Keywords, File Type, Date Uploaded, Custom Fields
- Save filter configuration as JSON

**Collection Model**:
```typescript
Collection {
  id: string;
  project_id: string;
  creator_user_id: string;
  name: string;
  type: 'team' | 'private';
  filter_rules: FilterRule[] | null; // JSON array of filter conditions
  sort_order: 'manual' | 'date_uploaded' | 'filename' | 'custom_field';
  created_at: Date;
}

FilterRule {
  field: string; // field name (status, rating, custom field ID)
  operator: 'eq' | 'ne' | 'contains' | 'gt' | 'lt' | 'in';
  value: string | number | string[];
}

CollectionAsset {
  collection_id: string;
  file_id: string;
  order: number | null; // for manual sort
  added_manually: boolean; // true if manually added, false if matched by filter
}
```

**Use Cases**:
- Marketing Deliverables: Filter by custom field "Platform" (Instagram, Facebook, TikTok)
- Casting Selects: Filter by custom field "Role" and Rating >= 4
- Approved Assets: Filter by Status = "Approved"
- Assets by Assignee: Filter by Assignee = specific user

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 7 (Collections)
- `/home/tgds/projects/bush/specs/02-workflow-management.md`

**Implementation Steps**:
1. Create Collection, CollectionAsset models
2. Implement filter rule query builder (SQLite query generation from FilterRule JSON)
3. Build Collection CRUD API endpoints
4. Create Collection UI (sidebar, grid/list view)
5. Implement filter rule builder UI
6. Add real-time sync (re-evaluate filters on asset changes)
7. Build manual asset addition (drag-to-add)
8. Implement custom sort within Collection
9. Integrate with Share system (share entire Collection)
10. Write Collection tests (filter accuracy, real-time sync)

---

### 3.3 Comparison Viewer

**Dependencies**: Player (2.6), Image Viewer (2.7), Version Stacking (2.5)

**Comparison Modes**:
- **Side-by-Side**: Two assets/versions displayed simultaneously
- **Linked**: Zoom and playback synchronized (default)
- **Independent**: Un-link for manual comparison

**Linked Features**:
- Synchronized playback (both videos play in sync)
- Synchronized scrubbing (move playhead on one, other follows)
- Synchronized zoom and pan (zoom on one image, other zooms to same area)

**Comparison Triggers**:
- Compare two selected assets (from asset browser)
- Compare versions within version stack
- Compare assets from Collection

**Comparison UI**:
- Split view (50/50 or adjustable divider)
- Link/unlink toggle button
- Individual controls for each side (when unlinked)
- Swap sides button

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 9.7 (Comparison Viewer)

**Implementation Steps**:
1. Build comparison viewer component
2. Implement side-by-side layout with adjustable divider
3. Create linked playback synchronization
4. Add linked zoom and pan for images
5. Build link/unlink toggle
6. Implement individual controls when unlinked
7. Write comparison viewer tests

---

### 3.4 Transcription & Captions

**Dependencies**: Player (2.6), Processing (2.2), Search (2.12)

**Transcription Service**: TBD (abstracted interface) - Options: AWS Transcribe, Deepgram, AssemblyAI

**Supported Languages** (27):
Arabic, Cantonese, Czech, Danish, Dutch, English (US/UK), French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Mandarin Simplified/Traditional, Norwegian, Polish, Portuguese, Russian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese

**Transcription Features**:
- Auto-detect language (or manual selection)
- Speaker identification with labels (Speaker 1, Speaker 2, etc.)
- Editable transcripts (inline text editing)
- Searchable transcripts (integrate with global search)
- Time-synced text highlighting during playback
- Auto-scroll transcript during playback
- Click transcript to jump to timestamp

**Speaker Label Consent** (Critical Legal Requirement):
- Explicit consent required before enabling speaker ID
- **US users in Texas & Illinois cannot use** (legal restriction - disable feature for users in these states)
- Consent modal: "I Agree" to enable for future transcripts

**Caption Generation**:
- Generate captions from transcript (VTT, SRT format)
- Export formats: SRT, VTT, TXT
- Caption styling (font size, color, background)

**Caption Ingest**:
- Upload SRT/VTT files (manual caption upload)
- Multiple caption tracks (multiple languages)
- Language selection dropdown
- "Frame-generated" vs "Ingested" label (distinguish auto vs manual)

**Transcript Model**:
```typescript
Transcript {
  id: string;
  file_id: string;
  language: string; // ISO 639-1 code
  provider: string; // 'aws_transcribe' | 'deepgram' | 'assemblyai'
  speaker_labels_enabled: boolean;
  segments: TranscriptSegment[];
  status: 'processing' | 'ready' | 'failed';
  created_at: Date;
}

TranscriptSegment {
  start_time: number; // seconds
  end_time: number;
  text: string;
  speaker_label: string | null; // 'Speaker 1', 'Speaker 2', etc.
}

Caption {
  id: string;
  file_id: string;
  language: string;
  source: 'generated' | 'ingested';
  format: 'srt' | 'vtt';
  content: string; // raw SRT/VTT content
  created_at: Date;
}
```

**Transcription Workflow**:
1. User requests transcription: `POST /v4/files/{id}/transcribe` (optional language param)
2. Backend enqueues transcription job (BullMQ)
3. Worker extracts audio from video (FFmpeg)
4. Worker uploads audio to transcription service
5. Worker polls for completion or receives webhook
6. Worker parses transcript JSON and stores in database
7. Backend sends WebSocket update to frontend

**Transcription Permissions Matrix**:
| Action | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|-------------|--------------|------|--------------|-----------|
| Generate | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete | ✓ | ✓ | ✓ | ✗ | ✗ |
| View | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit | ✓ | ✓ | ✓ | ✗ | ✗ |

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 10 (Transcription)
- `/home/tgds/projects/bush/specs/06-transcription-and-captions.md`

**Implementation Steps**:
1. Choose transcription provider (AWS Transcribe recommended for 27-language support)
2. Create Transcript and Caption models
3. Implement transcription job (audio extraction, API call, parsing)
4. Build transcript viewer UI (scrollable, time-synced highlighting)
5. Add inline editing for transcript segments
6. Implement speaker label consent modal
7. Create caption generation (transcript → VTT/SRT)
8. Build caption export (download SRT/VTT/TXT)
9. Implement caption ingest (upload SRT/VTT)
10. Integrate transcript content with search
11. Write transcription system tests

---

### 3.5 Enhanced Search (Media Intelligence)

**Dependencies**: Basic Search (2.12), Transcription (3.4), Vision API (TBD)

**Enhanced Search Features**:
- **Natural Language Processing**: Understand user intent ("show me videos from last week with John")
- **Semantic Search**: Intent-based, not just keyword matching
- **Visual Search**: Search by visual content (objects, faces, scenes)
- **Transcript Content Search**: Search spoken words within videos
- **Relevance Ranking Improvements**: Machine learning-based ranking

**Visual Search** (Requires Vision API):
- Extract visual features from images/videos (AWS Rekognition or Google Vision)
- Detect objects, scenes, faces, text in images
- Store visual metadata in database
- Search by detected objects ("show me videos with dogs")

**Semantic Search**:
- Embed search queries and asset metadata using embedding models (e.g., OpenAI embeddings)
- Store embeddings in SQLite (or vector database like Qdrant if needed)
- Calculate similarity scores (cosine similarity)
- Rank results by semantic relevance

**Natural Language Query Parsing**:
- Parse query for entities: date ranges ("last week"), user names ("John"), file types ("videos")
- Build structured query from natural language input
- Example: "show me videos from last week with John" → `file_type:video AND uploaded_after:2024-02-09 AND uploader:John`

**Upgrade Path**:
- Start with SQLite FTS5 (Phase 2)
- Add transcript search (Phase 3.4)
- Add semantic search with embeddings (Phase 3.5)
- Consider dedicated search engine (Meilisearch, Typesense) if SQLite performance insufficient

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 12.2 (Media Intelligence)

**Implementation Steps**:
1. Choose vision API provider (AWS Rekognition or Google Vision)
2. Implement visual feature extraction (objects, scenes, faces)
3. Store visual metadata in database
4. Build semantic search with embeddings
5. Implement natural language query parser
6. Enhance relevance ranking algorithm
7. Add visual search to search UI
8. Write enhanced search tests

---

### 3.6 Webhook System

**Dependencies**: API (1.4)

**Webhook Features**:
- Event subscriptions (choose which events to receive)
- Webhook delivery with retry logic (3 attempts with exponential backoff)
- Webhook secret/signature verification (HMAC-SHA256)
- Webhook logs (delivery success/failure, response codes)

**Supported Events**:
- `asset.uploaded`, `asset.deleted`, `asset.updated`
- `comment.created`, `comment.updated`, `comment.deleted`
- `share.created`, `share.opened`, `share.commented`
- `status.changed` (when asset status metadata changes)
- `transcription.completed`

**Webhook Model**:
```typescript
Webhook {
  id: string;
  account_id: string;
  url: string; // destination URL
  secret: string; // for HMAC signature
  events: string[]; // subscribed events
  is_active: boolean;
  created_at: Date;
}

WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: object;
  status: 'pending' | 'success' | 'failed';
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  next_retry_at: Date | null;
  created_at: Date;
}
```

**Webhook Payload Format**:
```json
{
  "event": "asset.uploaded",
  "timestamp": "2024-02-16T12:34:56Z",
  "data": {
    "asset_id": "file_123",
    "filename": "logo.png",
    "project_id": "proj_456",
    "uploader_id": "user_789"
  }
}
```

**Signature Verification**:
- Generate HMAC-SHA256 signature of payload using webhook secret
- Send signature in `X-Bush-Signature` header
- Recipient verifies signature to ensure authenticity

**Webhook Delivery**:
- Enqueue delivery job (BullMQ) when event occurs
- Worker sends POST request to webhook URL
- Verify 200-299 response code for success
- Retry on failure (exponential backoff: 1min, 10min, 1hour)
- Mark as failed after 3 attempts

**References**:
- `/home/tgds/projects/bush/specs/00-atomic-features.md` Section 18.3 (Webhooks as core resource)

**Implementation Steps**:
1. Create Webhook and WebhookDelivery models
2. Implement webhook CRUD API endpoints
3. Build webhook registration UI
4. Create webhook delivery job (BullMQ)
5. Implement HMAC signature generation
6. Add retry logic with exponential backoff
7. Build webhook logs UI (delivery history)
8. Write webhook system tests (delivery, retries, signatures)

---

### 3.7 Asset Lifecycle Management

**Dependencies**: Storage (1.5), Metadata (2.10)

**Lifecycle Features**:
- **Automatic Expiration**: Assets auto-delete after configured duration
- **Retention Policies**: 30/60/90 day standard options, or custom duration
- **Workspace-Level Policies**: Set default retention for entire workspace
- **Per-Asset Override**: Override workspace policy for specific assets
- **Expiration Indicators**: Clock icon on expiring assets, hover shows days remaining
- **Reset Lifecycle**: Extend expiration date (reset to full duration)
- **30-Day Recovery**: After auto-deletion, assets move to trash for 30 days before permanent delete

**Lifecycle Model**:
```typescript
File {
  // ... existing fields
  lifecycle_enabled: boolean;
  lifecycle_duration_days: number | null; // null = inherit from workspace
  lifecycle_expires_at: Date | null;
}

Workspace {
  // ... existing fields
  default_lifecycle_enabled: boolean;
  default_lifecycle_duration_days: number; // 30, 60, 90, or custom
}
```

**Lifecycle Workflow**:
1. Asset uploaded → If lifecycle enabled, set `lifecycle_expires_at` = `uploaded_at + duration_days`
2. Daily job (BullMQ scheduled) checks for expired assets
3. Expired assets moved to Recently Deleted (status = `deleted`)
4. 30 days after deletion, permanent delete (remove from storage and database)

**Lifecycle UI**:
- Workspace settings: Enable lifecycle, set default duration
- Asset metadata: Lifecycle toggle, duration override, expires date, reset button
- Asset cards: Clock icon badge if expiring within 7 days
- Hover tooltip: "Expires in 3 days (Feb 19, 2024)"

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 14 (Asset Lifecycle)

**Implementation Steps**:
1. Add lifecycle fields to File and Workspace models
2. Implement lifecycle expiration job (daily BullMQ scheduled job)
3. Build lifecycle settings UI (workspace and asset levels)
4. Add expiration indicators to asset cards
5. Implement reset lifecycle functionality
6. Write lifecycle tests (expiration, recovery, permanent delete)

---

## PHASE 4: INTEGRATIONS & APPS [Priority: MEDIUM-LOW]

**Status**: Not started

Native apps and third-party integrations. **Requires Phase 2 API completion. Some features may require Phase 3.**

### 4.1 Storage Connect

**Dependencies**: Storage (1.5), API (1.4)

**Phase 4 feature - deferred.**

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 14.2 (Storage Connect)

---

### 4.2 Bush Transfer Desktop App

**Dependencies**: API (1.4), Upload (2.1), Comment Export (2.9)

**Technology**: Tauri (per locked tech stack)

**Phase 4 feature - deferred.**

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 19 (Transfer App)
- `/home/tgds/projects/bush/specs/09-transfer-app.md`

---

### 4.3 iOS / iPadOS App

**Dependencies**: Complete API (1.4), All Phase 2 features

**Technology**: Native Swift (iOS/iPadOS 17.0+)

**Phase 4 feature - deferred.**

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 18.1 (iOS App)
- `/home/tgds/projects/bush/specs/08-ios-ipad-apps.md`

---

### 4.4 Apple TV App

**Technology**: Native Swift (tvOS)

**Phase 4 feature - deferred.**

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 18.2 (Apple TV)

---

### 4.5 Adobe Premiere Pro Integration

**Dependencies**: API (1.4), Comments (2.9), Upload (2.1), Webhooks (3.6)

**Phase 4 feature - deferred.**

**References**:
- `/home/tgds/projects/bush/specs/00-complete-support-documentation.md` Section 17.1 (Premiere Pro)
- `/home/tgds/projects/bush/specs/10-integrations.md`

---

### 4.6-4.10 Other Integrations

**Phase 4 features - deferred:**
- Adobe Lightroom
- Final Cut Pro
- DaVinci Resolve & Avid Media Composer
- Camera to Cloud (C2C)
- Automation Platforms (Zapier, Make, etc.)

**References**:
- `/home/tgds/projects/bush/specs/07-camera-to-cloud.md` (C2C)
- `/home/tgds/projects/bush/specs/10-integrations.md` (All integrations)

---

## PHASE 5: ENTERPRISE & SCALE [Priority: LOW]

**Status**: Not started

Enterprise features, compliance, and platform optimization. **Requires production deployment and customer feedback.**

### 5.1-5.6 Enterprise Features

**Phase 5 features - deferred:**
- Billing & Plan Management
- Security Compliance (SOC 2, TPN+, ISO 27001)
- Enterprise Administration
- Performance & Scale Optimization
- SDK Publication
- Internationalization

---

## MISSING SPECIFICATIONS

### Critical Gaps Requiring Specification Documents

1. **Authentication & SSO** (`specs/12-authentication.md` - NEEDS CREATION)
   - SAML/SSO enterprise authentication (not specified)
   - Session duration, token expiration times, refresh token rotation policy
   - IP allowlisting, geo-restrictions for enterprise

2. **Billing & Plans** (`specs/13-billing-and-plans.md` - NEEDS CREATION)
   - Detailed pricing structure
   - Plan feature matrix (which features gated to which plan)
   - "Team+" and "Pro+" tier boundaries not fully defined

3. **Real-Time Collaboration** (`specs/14-realtime-collaboration.md` - NEEDS CREATION)
   - Concurrent editing conflict resolution
   - WebSocket protocol specification
   - Presence indicators (who is currently viewing)

4. **Media Processing Specifications** (`specs/15-media-processing.md` - NEEDS CREATION)
   - Exact proxy transcoding parameters (bitrate targets, codec choices)
   - Processing timeouts and failure handling
   - HDR tone mapping details
   - Interactive ZIP (HTML) rendering behavior

5. **Storage & Data Residency** (`specs/16-storage-and-data.md` - NEEDS CREATION)
   - Data residency requirements (EU, etc.)
   - Backup/disaster recovery strategy
   - Storage archival tiers (Glacier for inactive projects)
   - Storage Connect for non-AWS providers

6. **API Complete Specification** (`specs/17-api-complete.md` - NEEDS CREATION)
   - Complete endpoint inventory with request/response examples
   - Bulk API operations specification
   - Complete webhook event type enumeration
   - API versioning strategy beyond "V4 current, V2 deprecated"

7. **Mobile Specifications** (`specs/18-mobile-complete.md` - ENHANCEMENT NEEDED)
   - Android app specification (currently noted as "no native app")
   - Offline mode depth (what is cached, sync on reconnect)
   - Push notification payload specifications

8. **Security Complete** (ENHANCEMENT NEEDED: `specs/11-security-features.md` is only 38 lines)
   - Forensic watermarking details
   - Audit log retention and export
   - Access Groups detailed specification (mentioned but not detailed)
   - Organization-wide security policies specification

9. **Accessibility** (`specs/19-accessibility.md` - NEEDS CREATION)
   - WCAG compliance level target
   - Full accessibility requirements for web app
   - Keyboard navigation specifications
   - Screen reader support

---

## TECHNICAL RESEARCH REQUIRED

### 1. Video Player Architecture (CRITICAL - Phase 2)
- **Decision**: Custom player vs. Video.js/Shaka Player
- **Key Issues**: Frame-accurate seeking (GOP structure), Annotation overlay rendering (Canvas vs SVG vs WebGL), HLS vs DASH
- **Timeline**: Before starting Phase 2.6
- **Recommendation**: Start with Video.js, build frame-accurate seeking extension

### 2. Media Transcoding Pipeline (CRITICAL - Phase 2)
- **FFmpeg cluster design**: Single worker vs distributed workers (BullMQ with multiple worker processes)
- **Performance estimates**: Benchmark transcoding times for 1GB, 10GB, 100GB files
- **HDR proxy generation**: Research tone mapping algorithms
- **RAW processing**: Test dcraw, libraw for 15+ camera formats
- **Adobe format rendering**: Investigate server-side rendering (ImageMagick, Puppeteer for INDD)
- **Timeline**: Before starting Phase 2.2

### 3. Real-Time Infrastructure (HIGH - Phase 2)
- **WebSocket scaling**: Connection limits, horizontal scaling (Redis pub/sub for multi-instance)
- **Optimistic UI**: Strategy for comment creation, metadata editing
- **Timeline**: Before starting Phase 2.9 (Comments)

### 4. Transcription Service (HIGH - Phase 3)
- **Provider comparison**: AWS Transcribe vs Deepgram vs AssemblyAI vs Whisper (self-hosted)
- **Evaluation criteria**: 27-language support, speaker ID accuracy, cost at scale, latency
- **Speaker ID compliance**: Texas/Illinois legal restrictions implementation
- **Timeline**: Before starting Phase 3.4

### 5. Search Scalability (MEDIUM - Phase 3)
- **SQLite FTS5 limits**: Benchmark search performance with 100K, 1M, 10M files
- **Upgrade path**: When to switch to Meilisearch/Typesense/Elasticsearch
- **Visual search**: AWS Rekognition vs Google Vision cost and accuracy
- **Timeline**: Before starting Phase 3.5

### 6. Large File Upload (HIGH - Phase 2)
- **Chunking strategy**: Optimal chunk size (10MB? 100MB?), parallel chunks (how many?)
- **Resumability**: Browser storage (IndexedDB) vs server-side tracking
- **5TB upload testing**: Real-world testing across network conditions
- **Timeline**: Before starting Phase 2.1

### 7. SQLite at Scale (CRITICAL - Phase 1)
- **Performance testing**: Benchmark SQLite with realistic workloads (concurrent reads/writes)
- **Limitations**: Understand when SQLite becomes bottleneck (concurrent writes, database size)
- **Backup strategy**: WAL mode, incremental backups (Litestream recommended)
- **Timeline**: During Phase 1.1 (Database Schema)

### 8. Deployment without Containers (CRITICAL - Phase 1)
- **Options**: systemd services, PM2, traditional VPS, managed app platforms (Fly.io, Render, Railway)
- **Bun deployment**: Production readiness, process management, crash recovery
- **Asset**: Where to deploy (VPS, managed hosting, serverless options)
- **Timeline**: Before Phase 1.4 (API Foundation)

---

## PRIORITY SUMMARY

### Immediate Next Steps (Start Here)

1. **Phase 1.1**: Database schema design with SQLite
2. **Phase 1.2**: Authentication (email/password, OAuth, 2FA)
3. **Phase 1.3**: Permission system (5 levels, inheritance)
4. **Phase 1.4**: RESTful API foundation with Bun
5. **Phase 1.5**: Object storage layer (choose R2/B2/S3)
6. **Phase 1.6**: Web app shell with Next.js

**Blockers**: None - Phase 1 has no dependencies

### After Phase 1 Completion

1. **Phase 2.1-2.2**: File upload + media processing (core functionality)
2. **Phase 2.6-2.9**: Player + Comments (core review workflow)
3. **Phase 2.3-2.5**: Asset browser + operations (file management)
4. **Phase 2.10-2.12**: Metadata + Notifications + Search (workflow support)

**Blockers**: Phase 1 must be complete

### After Phase 2 Completion (MVP)

1. **Phase 3.1**: Shares (external collaboration)
2. **Phase 3.2**: Collections (workflow management)
3. **Phase 3.4**: Transcription (content search)
4. **Phase 3.6**: Webhooks (integrations foundation)

**Blockers**: Phase 2 must be complete

### Long-Term (After MVP)

- **Phase 4**: Native apps (iOS, Transfer app) and integrations (Adobe, C2C)
- **Phase 5**: Enterprise features, compliance, scale optimization

---

## TECHNOLOGY STACK CORRECTIONS FROM ORIGINAL PLAN

The original IMPLEMENTATION_PLAN.md incorrectly specified:
- ❌ PostgreSQL → ✅ SQLite (locked choice)
- ❌ Elasticsearch → ✅ SQLite FTS5 (with upgrade path)
- ❌ Kubernetes → ✅ No containers (explicit requirement)
- ❌ Node.js → ✅ Bun (locked choice)

All references to PostgreSQL, Elasticsearch, Docker, and Kubernetes have been removed and replaced with the locked technology stack from `specs/README.md`.
