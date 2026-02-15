# IMPLEMENTATION PLAN - Bush Platform

## PROJECT OVERVIEW

Bush is a cloud-based creative collaboration platform for video, design, and marketing teams. It provides a unified workspace for uploading creative files (100+ formats, up to 5TB), managing projects through a hierarchical workspace/project/folder structure, conducting frame-accurate review and approval with annotations, managing workflows via rich metadata and dynamic Collections, and sharing work externally through custom-branded presentations.

The ultimate goal is to build a production-grade platform that rivals Frame.io, serving the full creative asset lifecycle from camera capture through final delivery, with web, mobile (iOS/iPad), desktop (Transfer app), and third-party integrations (Adobe, NLE editors).

---

## ARCHITECTURE DECISIONS

### Technology Stack Choices

- **Frontend (Web)**: React or Next.js with TypeScript
  - Complex interactive UI (player, annotation canvas, drag-and-drop file management)
  - Real-time collaboration requires WebSocket support
  - Canvas/WebGL for annotation tools and video player overlay
- **Frontend (Mobile)**: Native Swift for iOS/iPadOS/Apple TV (per spec requirement)
- **Frontend (Desktop Transfer App)**: Electron or Tauri for cross-platform Mac/Windows
- **Backend API**: Node.js (TypeScript) or Go
  - RESTful API (V4 spec defines JSON:API-like format with cursor pagination)
  - OAuth 2.0 authentication
  - Rate limiting with leaky bucket algorithm
  - WebSocket server for real-time features (comments, notifications, upload progress)
- **Database**:
  - PostgreSQL as primary relational store (accounts, users, permissions, projects, metadata)
  - Redis for caching, session management, rate limiting, real-time pub/sub
  - Elasticsearch for full-text search, metadata search, transcript search
- **Object Storage**: AWS S3 (primary) with Storage Connect support for customer-owned buckets
- **Media Processing Pipeline**:
  - FFmpeg-based transcoding service for proxy generation (360p through 4K)
  - Thumbnail generation, hover scrub filmstrips, audio waveforms
  - Containerized workers (Kubernetes Jobs or AWS ECS tasks)
- **CDN**: CloudFront or similar for proxy/thumbnail delivery and adaptive streaming
- **AI/ML Services**:
  - Speech-to-text service for transcription (27 languages, speaker ID)
  - Computer vision for visual search / Media Intelligence
- **Message Queue**: RabbitMQ or AWS SQS for async job processing (transcoding, transcription, notifications)

### Deployment Architecture

- Containerized microservices on Kubernetes (or AWS ECS)
- Infrastructure-as-code (Terraform)
- CI/CD pipeline (GitHub Actions or similar)
- Multi-region deployment for low-latency global access
- Separate media processing cluster with auto-scaling

### Third-Party Service Dependencies

- AWS S3 + CloudFront (storage and CDN)
- Transcription API (AWS Transcribe, Deepgram, or AssemblyAI for 27-language support with speaker ID)
- Email delivery service (SendGrid or AWS SES for notifications, share invites, digests)
- OAuth providers (Google, Apple, Adobe IMS)

---

## PHASE 1: FOUNDATION [Priority: CRITICAL]

Core infrastructure and data models that everything else depends on.

### 1.1 Database Schema & Core Data Models
- Account model (owner, billing plan, storage quota)
  - Ref: `specs/00-atomic-features.md` Section 1 (Account & Authentication)
- Workspace model (name, settings, belongs to Account)
- Project model (name, logo, active/inactive status, restricted flag, notification toggle, asset lifecycle settings)
- Folder model (name, parent folder, project, restricted flag)
  - Ref: `specs/00-atomic-features.md` Section 5 (Folder Management)
- Hierarchy enforcement: Account > Workspace > Project > Folder > [Asset | Version Stack | Folder]
  - Ref: `specs/00-complete-support-documentation.md` Section 3.1

### 1.2 User & Authentication System
- User model (email, name, avatar, account role)
- Account roles: Account Owner, Content Admin, Member, Guest, Reviewer
  - Ref: `specs/00-complete-support-documentation.md` Section 1.2
- Authentication: email/password, Google Sign-In, Apple ID, Adobe ID
  - Ref: `specs/00-complete-support-documentation.md` Section 1.3
- Two-factor authentication (2FA)
- OAuth 2.0 token issuance and refresh
- Session management

### 1.3 Permission System
- Five permission levels: Full Access, Edit & Share, Edit, Comment Only, View Only
  - Ref: `specs/00-complete-support-documentation.md` Section 2.1
- Permission inheritance: Workspace cascades to Project cascades to Folder/Asset
  - Ref: `specs/00-complete-support-documentation.md` Section 2.2
- Restricted Projects break inheritance chain (invite-only)
  - Ref: `specs/00-complete-support-documentation.md` Section 2.3
- Restricted Folders (Team+ plan feature)
  - Ref: `specs/00-complete-support-documentation.md` Section 5.2
- Permission cannot be lowered below inherited level
- Workspace permissions matrix implementation
  - Ref: `specs/00-complete-support-documentation.md` Section 2.4
- Project permissions matrix implementation
  - Ref: `specs/00-complete-support-documentation.md` Section 2.5
- Access Groups (group-based permission assignment)
  - Ref: `specs/11-security-features.md` (Access Groups)

### 1.4 RESTful API Foundation (V4)
- JSON:API-style response format: `{ "data": [...], "links": { "next": "..." }, "total_count": N }`
  - Ref: `specs/00-complete-support-documentation.md` Section 21.4
- Error format: `{ "errors": [{ "detail", "source", "title" }] }`
  - Ref: `specs/00-complete-support-documentation.md` Section 21.5
- Standard HTTP status codes (200, 201, 204, 400, 401, 403, 404, 422, 429)
- Cursor-based pagination (default 50, max 100)
  - Ref: `specs/00-complete-support-documentation.md` Section 21.3
- Rate limiting with leaky bucket algorithm (10 req/min to 100 req/sec depending on endpoint)
  - Response headers: `x-ratelimit-*`
  - Ref: `specs/00-atomic-features.md` Section 18.2
- CRUD endpoints for all core resources: Accounts, Workspaces, Projects, Folders, Files, Version Stacks, Users, Comments, Shares, Custom Fields, Webhooks
  - Ref: `specs/00-atomic-features.md` Section 18.3

### 1.5 Object Storage Layer
- S3 bucket provisioning and configuration
- Pre-signed upload URL generation for chunked uploads
  - Ref: `specs/00-atomic-features.md` Section 4.2 (pre-signed upload URLs)
- Storage quota tracking per account (Free: 2GB, Pro: 2TB+2TB/member, Team: 3TB+2TB/member)
  - Ref: `specs/00-atomic-features.md` Section 14.1
- File download (original and proxy)
- Storage abstraction layer to support future Storage Connect (customer S3 buckets)

### 1.6 Web Application Shell
- Application scaffolding (React/Next.js + TypeScript)
- Authentication flows (login, signup, OAuth, 2FA)
- Account switcher (multiple accounts)
  - Ref: `specs/00-atomic-features.md` Section 1.4
- Global navigation: workspace sidebar, project list, folder tree
- Responsive layout with multi-panel design (expand/collapse panels)
  - Ref: `specs/03-file-management.md` (Multi-Panel Layout)
- Breadcrumb navigation
  - Ref: `specs/00-atomic-features.md` Section 5.3

---

## PHASE 2: CORE FEATURES [Priority: HIGH]

Essential features for a minimum viable product.

### 2.1 File Upload System
- Web browser drag-and-drop upload (single and bulk)
  - Ref: `specs/00-complete-support-documentation.md` Section 4.1
- Chunked upload for large files (up to 5TB max file size)
  - Ref: `specs/00-complete-support-documentation.md` Section 4.2
- Upload constraints: max 10 concurrent, 500 assets per upload, 250 folders per upload
- Upload progress visibility with real-time updates
- Priority queue management (drag-to-reorder)
  - Ref: `specs/00-atomic-features.md` Section 4.2
- Upload via pre-signed URLs (API flow: POST create file > PUT chunks > system processes)
  - Ref: `specs/00-atomic-features.md` Section 18.4
- MIME type validation against supported formats (video: 9 formats, audio: 8, image: 25+, documents: 5)
  - Ref: `specs/00-complete-support-documentation.md` Section 4.3

### 2.2 Media Processing Pipeline
- Async job queue for post-upload processing
- Thumbnail generation for all supported file types
- Hover scrub filmstrip generation (video)
- Proxy transcoding at multiple resolutions (360p, 540p, 720p, 1080p, 4K)
  - Ref: `specs/00-complete-support-documentation.md` Section 4.4
- Audio waveform generation
- Technical metadata extraction (codec, bitrate, resolution, frame rate, color space, duration, etc.)
  - Ref: `specs/00-atomic-features.md` Section 6.1 (all 33 built-in fields)
- HDR proxy support
- Processing status tracking per asset

### 2.3 Asset Browser & Navigation
- Grid view with adjustable card size (small, medium, large)
- List view
- Aspect ratio options (16:9, 1:1, 9:16)
- Thumbnail scale (fit/fill)
- Show/hide card info toggle
- Flatten folders view option
  - Ref: `specs/00-complete-support-documentation.md` Section 6.4
- Sort by any metadata field
- Drag-and-drop for organizing (move between folders)
- Multi-select for bulk operations (max 200 assets)
  - Ref: `specs/00-complete-support-documentation.md` Section 4.2

### 2.4 Asset Operations
- Copy to (duplicate to another location)
- Move to (relocate asset)
- Delete (move to Recently Deleted)
- Recover from trash (30-day retention window)
- Download original file
- Download proxy
- Set custom thumbnail
  - Ref: `specs/00-complete-support-documentation.md` Section 4.6

### 2.5 Version Stacking
- Drag new version onto existing asset to create stack
- Automatic version numbering (v1, v2, v3...)
- View all versions in stack
- Download specific version
- Comments persist across versions
  - Ref: `specs/00-complete-support-documentation.md` Section 4.5

### 2.6 Video Player
- Play/pause, scrub, frame-by-frame navigation (left/right arrows)
- JKL shuttle controls (2x, 4x, 8x forward/reverse)
  - Ref: `specs/00-complete-support-documentation.md` Section 9.3
- Playback speed adjustment (0.25x - 1.75x)
- Loop playback
- Full screen mode (F key)
- Volume control and mute (M key)
- Adaptive streaming with manual resolution selection (360p through 4K)
  - Ref: `specs/00-complete-support-documentation.md` Section 9.2
- Frame-accurate hover preview on timeline
- In/out point marking (I/O keys) with range playback
- Frame guides / aspect ratio overlays with mask mode
  - Ref: `specs/00-complete-support-documentation.md` Section 9.4
- All keyboard shortcuts per spec
  - Ref: `specs/00-complete-support-documentation.md` Section 9.1 and 9.8

### 2.7 Image Viewer
- Zoom up to 400%
- Pan navigation
- Fit to screen
- 1:1 pixel view
- Mini-map for large images
  - Ref: `specs/00-complete-support-documentation.md` Section 9.5

### 2.8 PDF Viewer
- Multi-page navigation with page thumbnails
- Zoom controls
- Page jump
- Text markups
  - Ref: `specs/00-complete-support-documentation.md` Section 9.6

### 2.9 Comments & Annotations
- Comment types: single-frame (timestamped), range-based (in/out), anchored (pinned to location)
  - Ref: `specs/00-complete-support-documentation.md` Section 8.1
- Comment visibility: internal (workspace only) vs public (all reviewers)
- Comment body: text, emoji reactions, @mentions (trigger notifications), hashtags, color hex codes
  - Ref: `specs/00-complete-support-documentation.md` Section 8.2
- Comment attachments: up to 6 per comment (images, videos, audio, PDFs) - Pro+ feature
  - Ref: `specs/00-complete-support-documentation.md` Section 8.6
- Annotation tools overlay on video/image: free draw, line, arrow, rectangle, multiple colors, undo/redo
  - Ref: `specs/00-complete-support-documentation.md` Section 8.3
- Pagestamp comments for PDFs
- Comment management: reply (threaded), edit own, delete own, mark complete, copy, paste
- Comment permissions matrix (owner/admin can edit/delete any; Comment Only can create/edit/delete own)
  - Ref: `specs/00-complete-support-documentation.md` Section 8.5
- Comment panel: thread view, filter controls (by hashtag, user, status), sort options, link to specific comment
  - Ref: `specs/00-atomic-features.md` Section 8.5
- Comment export: CSV, Plain Text, EDL
  - Ref: `specs/00-complete-support-documentation.md` Section 8.4
- Comment search
- Print comments

### 2.10 Metadata System
- 33 built-in metadata fields (auto-populated from file analysis where applicable)
  - Technical: Alpha Channel, Audio Bit Depth/Rate/Codec, Bit Depth/Rate, Channels, Color Space, Duration, Dynamic Range, End/Start Time, Frame Rate, Resolution H/W, Sample Rate, Video Bit Rate/Codec
  - File info: Date Uploaded, File Size, File Type, Format, Page Count, Source Filename
  - Collaboration: Assignee, Comment Count, Keywords, Notes, Rating (1-5), Seen By, Status, Transcript, Uploader
  - Ref: `specs/00-complete-support-documentation.md` Section 6.1
- 10 custom metadata field types: single-line text, multi-line text, number, date, single-select, multi-select, checkbox, user reference, URL, rating
  - Ref: `specs/00-complete-support-documentation.md` Section 6.2
- Account-wide field library (define once, use across projects)
- Field visibility toggles per project
- Field Management Tab for admins (view, show/hide, edit, delete, manage project visibility)
- Field permissions: "Admins Only" vs "Admins & Full Access"
  - Ref: `specs/00-complete-support-documentation.md` Section 6.3
- Metadata persists on copy/move/duplicate operations

### 2.11 Notifications System
- In-app notifications: @mentions, comment replies, new uploads, status changes, share activity
  - Per-project toggle
  - Ref: `specs/00-complete-support-documentation.md` Section 13.1
- Email notifications: daily digest, immediate alerts, per-project settings, per-asset subscription
  - Ref: `specs/00-complete-support-documentation.md` Section 13.2
- Real-time delivery via WebSocket for in-app notifications

### 2.12 Basic Search
- Global search across account
- Search by: filename, metadata values, status, keywords, uploader, file type
- Instant results (no Enter required)
- Thumbnail previews in results
- Filter refinement
  - Ref: `specs/00-complete-support-documentation.md` Section 12.1 and 12.3

---

## PHASE 3: ADVANCED FEATURES [Priority: MEDIUM]

Important features that enhance the platform beyond MVP.

### 3.1 Sharing & Presentations
- Share creation: public (anyone with link) and secure (specific email invites)
  - Ref: `specs/00-complete-support-documentation.md` Section 11.1
- Share layouts: Grid (thumbnail grid), Reel (sequential single player), Open in Viewer (single asset bypass)
  - Ref: `specs/00-complete-support-documentation.md` Section 11.2
- Share settings:
  - Passphrase protection
  - Expiration date/time
  - Allow/disallow comments
  - Allow/disallow downloads
  - Show/hide all versions
  - Display transcriptions/captions toggle
  - Ref: `specs/00-complete-support-documentation.md` Section 11.3
- Featured field selection (default editable field for recipients; updates sync back to project)
  - Ref: `specs/00-complete-support-documentation.md` Section 11.3 (Featured Field)
- Custom branding: icon (emoji or custom image), header size/visibility, background image, description, light/dark mode, accent colors, thumbnail display options
  - Ref: `specs/00-complete-support-documentation.md` Section 11.4
- WYSIWYG share builder with live preview
  - Ref: `specs/05-sharing-and-presentations.md` (WYSIWYG Editor)
- Share operations: create, duplicate, delete, copy link, send via email
  - Ref: `specs/00-atomic-features.md` Section 11.5
- Share activity tracking: opened, viewed, commented, downloaded
  - Ref: `specs/00-complete-support-documentation.md` Section 11.5
- Share notifications: invite, comment, reply, @mention emails to reviewers
  - Ref: `specs/00-complete-support-documentation.md` Section 11.6
- External share permissions: Authenticated vs Identified vs Unidentified reviewer access
  - Ref: `specs/00-complete-support-documentation.md` Section 2.6

### 3.2 Collections
- Team Collections (visible to all project members) and Private Collections (creator only)
  - Ref: `specs/00-complete-support-documentation.md` Section 7.1
- Dynamic filtering with saved filter rules (by metadata, status, assignee, etc.)
- Real-time sync with source assets (changes to assets reflected in Collections automatically)
- Custom sort within Collection
- List and Grid view options
- Add assets manually or via filter rules
- Share Collections externally (uses Share system)
- Create, delete Collection operations
  - Ref: `specs/00-complete-support-documentation.md` Section 7.2

### 3.3 Comparison Viewer
- Side-by-side asset comparison
- Linked zoom and playback (synchronized scrubbing)
- Version comparison mode
- Independent controls toggle (un-link for manual comparison)
  - Ref: `specs/00-complete-support-documentation.md` Section 9.7

### 3.4 Transcription & Captions
- AI-powered speech-to-text transcription
- 27 supported languages (Arabic, Cantonese, Czech, Danish, Dutch, English US/UK, French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Mandarin Simplified/Traditional, Norwegian, Polish, Portuguese, Russian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese)
  - Ref: `specs/00-complete-support-documentation.md` Section 10.1
- Automatic language detection
- Speaker identification with consent management (opt-in, US Texas/Illinois restrictions)
  - Ref: `specs/00-complete-support-documentation.md` Section 10.5
- Editable transcripts with inline editing
- Searchable transcripts
- Time-synced text highlighting during playback with auto-scroll
- Caption generation from transcripts
- Caption export: SRT, VTT, TXT
- Caption ingest: upload SRT/VTT files, multiple tracks, language selection
  - Ref: `specs/00-complete-support-documentation.md` Section 10.3
- Transcription permissions matrix (generate/delete/export require Edit+, view for all, edit requires Edit+)
  - Ref: `specs/00-complete-support-documentation.md` Section 10.4
- Transcript content searchable via global search

### 3.5 Enhanced Search (Media Intelligence)
- Natural language processing for query understanding
- Semantic search (intent-based, not just keyword matching)
- Visual search (search by visual content of assets)
- Transcript content search
- Relevance ranking improvements
  - Ref: `specs/00-complete-support-documentation.md` Section 12.2

### 3.6 Webhook System
- Webhook registration and management via API
- Event subscriptions for: asset uploaded, comment created, status changed, share activity, etc.
- Webhook delivery with retry logic
- Webhook secret/signature verification
  - Ref: `specs/00-atomic-features.md` Section 18.3 (Webhooks listed as core resource)

### 3.7 Asset Lifecycle Management
- Automatic expiration with configurable retention (30/60/90 days or custom duration)
- Workspace-level lifecycle policies
- Clock icon on expiring assets, hover shows days remaining
- Reset lifecycle option
- 30-day recovery after auto-deletion
  - Ref: `specs/00-complete-support-documentation.md` Section 14 (Asset Lifecycle)

### 3.8 Content Security
- Centralized security configuration
- Organization-wide security policies

---

## PHASE 4: INTEGRATIONS & APPS [Priority: MEDIUM-LOW]

Native apps and third-party integrations.

### 4.1 Storage Connect
- Customer-owned AWS S3 bucket connection
- Primary bucket (read/write) for original files
- Additional read-only buckets
- Bush proxies stored separately in Bush-managed storage
- API asset registration for externally stored files
  - Ref: `specs/00-complete-support-documentation.md` Section 14.2

### 4.2 Bush Transfer Desktop App
- Cross-platform: macOS (Apple Silicon + Intel), Windows
  - Requirements: Win 7+, macOS 10.15+
- Bulk upload and download with folder structure preservation
- Transfer speed control
- Priority queue (drag-to-reorder)
- EDL/log file support for comment round-trips
- Large file support (5TB+)
- Watch folders with auto-upload (Mac App variant)
  - Ref: `specs/00-complete-support-documentation.md` Section 19.1 and 19.2

### 4.3 iOS / iPadOS App
- Native Swift development
- Requirements: iOS/iPadOS 17.0+
- Full asset navigation with adjustable thumbnail size
- Commenting and annotation on player page
- File upload from camera roll
- Image viewer with pinch to zoom (400%), double-tap to jump
- Asset sharing with full branding controls
- Asset download, move/copy operations
- Push notifications (@mentions, replies, new shares)
- Playback speed and resolution control
- Customizable skip interval
- Restricted/inactive project support
- Metadata display and filtering
  - Ref: `specs/00-complete-support-documentation.md` Section 18.1

### 4.4 Apple TV App
- 4K 10-bit HDR viewing
- Big screen presentations
- Resolution and playback speed controls
  - Ref: `specs/00-complete-support-documentation.md` Section 18.2

### 4.5 Adobe Premiere Pro Integration
- V4 Panel (Premiere 25.6+): browse workspaces/projects, import media, upload sequences, manage versions, real-time comment sync to timeline markers
  - Ref: `specs/00-complete-support-documentation.md` Section 17.1
- Comments Panel (Premiere 25.2+): comment viewing, timeline marker sync
- After Effects panel support

### 4.6 Adobe Lightroom Integration
- Direct upload from Lightroom to Bush
- Camera to Cloud integration for RAW files
  - Ref: `specs/00-complete-support-documentation.md` Section 17.2

### 4.7 Final Cut Pro Integration
- Comments as timeline markers
- EDL import for comment round-trip
  - Ref: `specs/00-complete-support-documentation.md` Section 17.3

### 4.8 DaVinci Resolve & Avid Media Composer
- DaVinci Resolve: EDL comment import
- Media Composer: C2C workflow support
  - Ref: `specs/00-complete-support-documentation.md` Section 17.3

### 4.9 Camera to Cloud (C2C) System
- Device authorization and management
- Automatic upload from set when recording stops
- Metadata preservation from camera/device
- Date-based folder organization
- Timezone adjustment settings
- Project selection per device
- Upload quality settings
- 4K/HDR support (plan dependent)
- Hardware partner integrations: Atomos CONNECT, Teradek (Serv/Prism/Cube), RED (V-RAPTOR/KOMODO), Canon (C400/C80), Fujifilm, Panasonic LUMIX, Nikon, Leica, Sound Devices 8 Series, Ambient Lockit, Accsoon
- Software partner integrations: Filmic Pro, Mavis Camera, Magic ViewFinder, ZoeLog, FilmDataBox, Pomfort LiveGrade, Viviana Cloud Box
  - Ref: `specs/00-complete-support-documentation.md` Section 16

### 4.10 Automation Platform Integrations
- Adobe Workfront Fusion connector
- Zapier connector
- Make (Integromat) connector
- Pipedream connector
- Pabbly Connect connector
- Expose webhook and API triggers/actions for automation workflows
  - Ref: `specs/00-complete-support-documentation.md` Section 17.4

---

## PHASE 5: ENTERPRISE & SCALE [Priority: LOW]

Enterprise features, compliance, and platform optimization.

### 5.1 Billing & Plan Management
- Plan tiers: Free (2GB), Pro (2TB+2TB/member), Team (3TB+2TB/member), Enterprise (custom)
- Account Owner billing management
- Invoice generation and download
- Plan upgrades/downgrades
- Account cancellation flow
- Seat management (Guest/Reviewer don't count toward seat limit)
  - Ref: `specs/00-atomic-features.md` Section 1.4

### 5.2 Security Compliance
- SOC 2 Type 2 compliance audit and certification
- TPN+ Gold Shield accreditation
- ISO 27001 certification
- Security audit logging
- Compliance documentation and reporting
  - Ref: `specs/00-complete-support-documentation.md` Section 15.1

### 5.3 Enterprise Administration
- Centralized admin console for organization-wide policies
- Bulk user management operations
- User provisioning (SAML/SSO - implied by enterprise tier)
- Audit trails for content access
- Account-wide security settings

### 5.4 Performance & Scale Optimization
- CDN optimization for global proxy delivery
- Adaptive bitrate streaming (HLS/DASH)
- Database read replicas for search-heavy workloads
- Media processing auto-scaling for burst transcoding loads
- Upload acceleration (multi-region ingestion points)
- Caching strategy optimization (Redis layers for hot metadata)

### 5.5 SDK Publication
- TypeScript SDK (`npm i -s frameio`)
- Python SDK (`pip install frameio`)
- SDK documentation and developer portal
- API reference documentation (OpenAPI spec)
  - Ref: `specs/00-atomic-features.md` Section 18.9

### 5.6 Internationalization
- UI localization framework (implied by 27-language transcription support)
- Right-to-left layout support (Arabic, Hebrew in transcription list)
- Timezone handling across all features

---

## MISSING SPECIFICATIONS

### Authentication & SSO
- No specification for SAML/SSO enterprise authentication (only Social Sign-On, Adobe ID, and 2FA mentioned)
- No details on session duration, token expiration times, or refresh token rotation policy
- No mention of IP allowlisting or geo-restrictions for enterprise accounts

### Billing & Plans
- No detailed pricing structure or plan feature matrix (which features are gated to which plan beyond storage)
- "Team+" referenced for Restricted Folders but plan boundaries not fully defined
- "Pro+" referenced for comment attachments and 4K playback but full feature gating unclear

### Real-Time Collaboration
- No specification for concurrent editing or conflict resolution (e.g., two users editing metadata simultaneously)
- No WebSocket/real-time protocol specification beyond the concept of "real-time updates"
- No specification for presence indicators (who is currently viewing an asset)

### Media Processing
- No specification for exact proxy transcoding parameters (bitrate targets, codec choices for proxies)
- No specification for processing timeouts or failure handling
- No details on HDR tone mapping for proxy generation
- No specification for Interactive ZIP (HTML) rendering behavior

### Storage
- No specification for data residency requirements (EU, etc.)
- No details on backup/disaster recovery strategy
- No specification for storage archival tiers (e.g., Glacier for inactive projects)
- Exact behavior of Storage Connect for non-AWS cloud providers not specified

### API
- No complete endpoint inventory (only resource types listed)
- No specification for bulk API operations
- Webhook event types not enumerated
- No specification for API versioning strategy beyond "V4 current, V2 deprecated"

### Mobile
- No Android app specification (explicitly noted as "no native app, web access via browser") -- is Android planned?
- Offline mode depth not specified (what exactly is cached, how is sync handled on reconnect)

### Security
- No details on forensic watermarking
- No specification for audit log retention or export

### Accessibility
- No WCAG compliance level specified for web application
- Caption/transcription accessibility features are mentioned but full accessibility requirements absent

---

## TECHNICAL RESEARCH REQUIRED

### 1. Video Player Architecture (CRITICAL)
- Evaluate build vs. buy for frame-accurate video player (custom player vs. Video.js/Shaka Player)
- Frame-accurate seeking requires understanding of GOP structure and keyframe intervals
- Annotation overlay rendering approach (Canvas vs. SVG vs. WebGL)
- Adaptive bitrate streaming format (HLS vs. DASH) and packaging pipeline
- Proxy format standardization (H.264 MP4 for broad compatibility vs. WebM/VP9 for quality)

### 2. Media Transcoding Pipeline (CRITICAL)
- FFmpeg-based transcoding cluster design and auto-scaling strategy
- Processing time estimates for various file sizes/formats to size infrastructure
- HDR proxy generation (tone mapping from HDR10/HLG/Dolby Vision to SDR proxies)
- RAW image processing pipeline (15+ camera RAW formats require specialized decoders)
- Adobe format rendering (AI, EPS, INDD, PSD) -- requires investigation of server-side rendering options

### 3. Real-Time Collaboration Infrastructure (HIGH)
- WebSocket scaling strategy (connection limits, horizontal scaling with sticky sessions or pub/sub)
- Real-time comment synchronization protocol design
- Upload progress broadcasting architecture
- Optimistic UI update strategy for collaborative operations

### 4. Transcription Service Selection (HIGH)
- Evaluate: AWS Transcribe vs. Deepgram vs. AssemblyAI vs. Whisper (self-hosted)
- Requirements: 27 languages, speaker identification, time-code accuracy, cost at scale
- Speaker ID consent management and legal compliance (Texas/Illinois restrictions)
- Latency requirements (async processing acceptable for most use cases)

### 5. Search Infrastructure (MEDIUM)
- Elasticsearch cluster sizing for metadata + transcript full-text search
- Visual search / Media Intelligence: evaluate computer vision services (AWS Rekognition, Google Vision, custom models)
- Semantic search implementation (embedding models, vector database integration)
- Indexing strategy for real-time search updates

### 6. Large File Upload Reliability (HIGH)
- Chunked upload protocol design (chunk size, retry strategy, resumability)
- 5TB upload feasibility testing across network conditions
- Pre-signed URL expiration and refresh during long uploads
- Parallel chunk upload optimization

### 7. C2C Protocol Design (MEDIUM-LOW)
- Communication protocol between camera hardware/apps and Bush cloud
- Device authentication and authorization flow
- Metadata preservation format standardization across hardware partners
- Upload quality negotiation based on network conditions on set

### 8. Native iOS Architecture (MEDIUM)
- Swift UI vs. UIKit for complex media viewer
- Offline caching strategy (which assets to cache, storage limits)
- Push notification infrastructure (APNs integration)
- Background upload/download handling on iOS

### 9. Desktop Transfer App Technology (MEDIUM-LOW)
- Electron vs. Tauri evaluation for cross-platform desktop app
- Watch folder implementation (filesystem event monitoring)
- EDL parsing library selection
- Transfer speed throttling implementation
- System tray integration for background operation
