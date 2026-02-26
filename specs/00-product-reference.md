# Bush — Product Reference

## Overview

Bush is a cloud-based creative collaboration platform for video, design, and marketing teams. It provides a unified workspace for uploading creative files, managing projects, collecting frame-accurate feedback, and sharing work with internal and external stakeholders. The platform spans web, iOS/iPadOS, Apple TV, and desktop (Transfer app), with deep integrations into professional NLEs and cameras. Core domains: file management, review and approval, metadata workflows, sharing, and integrations with professional production hardware and software.

---

## Table of Contents

1. [Account & Auth](#1-account--auth)
2. [Workspaces & Projects](#2-workspaces--projects)
3. [Files & Versions](#3-files--versions)
4. [Metadata & Collections](#4-metadata--collections)
5. [Review & Comments](#5-review--comments)
6. [Player & Viewer](#6-player--viewer)
7. [Sharing](#7-sharing)
8. [Transcription](#8-transcription)
9. [Search](#9-search)
10. [Notifications](#10-notifications)
11. [Storage](#11-storage)
12. [Integrations — Camera to Cloud](#12-integrations--camera-to-cloud)
13. [Integrations — Adobe & NLE](#13-integrations--adobe--nle)
14. [Integrations — Automation](#14-integrations--automation)
15. [Mobile Apps](#15-mobile-apps)
16. [Desktop Apps](#16-desktop-apps)
17. [System Requirements](#17-system-requirements)

---

## 1. Account & Auth

### Account Roles

| Role | Scope | Capabilities | Phase |
|------|-------|--------------|-------|
| Account Owner | Full account | All permissions, billing, plan management, security settings, user management | MVP |
| Content Admin | All content | All content operations and user management; no billing or plan access | MVP |
| Member | Granted resources | Access to assigned workspaces/projects per their permission level | MVP |
| Guest | Single project | Limited to 1 project; no workspace-level access | MVP |
| Reviewer | Share links only | Access via share links only; no dashboard | MVP |

Notes:
- Account Owner is transferable; only one per account.
- Roles are per-account — a user can be Owner on one account and Member on another.
- Role changes take effect immediately.

### Authentication Methods

| Method | Plan Required | Provider | Phase |
|--------|---------------|----------|-------|
| Email / password | All | WorkOS AuthKit | MVP |
| Google Sign-In | All | WorkOS AuthKit | MVP |
| Apple ID | All | WorkOS AuthKit | MVP |
| Magic Link (passwordless) | All | WorkOS AuthKit | MVP |
| MFA / 2FA (TOTP) | All | WorkOS AuthKit | MVP |
| Adobe IMS OAuth | All | Bush custom (links to existing account) | Phase 2 |
| SSO / SAML / OIDC | Enterprise | WorkOS (Okta, Azure AD, Google Workspace) | Phase 2 |

### Reviewer Access Tiers

External stakeholders accessing via share links — no WorkOS account required.

| Tier | Identity | Access Method | Capabilities | Phase |
|------|----------|---------------|--------------|-------|
| Authenticated Reviewer | Logged-in Bush user | Click share link while logged in | Comment, annotate, download (per share settings) | MVP |
| Identified Reviewer | Email-verified | Share invite email + verification code | Comment with verified identity, download (per share settings) | MVP |
| Unidentified Reviewer | Anonymous | Open public share link | View only; comment if share allows (attributed to "Anonymous") | MVP |

### Account Settings

| Setting | Phase |
|---------|-------|
| Password management (via WorkOS) | MVP |
| Email management | MVP |
| Notification preferences | MVP |
| Billing information | MVP |
| Invoice download | MVP |
| Plan upgrades / downgrades | MVP |
| Account cancellation | MVP |
| Account switcher (multiple accounts) | MVP |
| MFA enforcement (account-wide toggle) | Phase 2 |
| Session timeout policies (idle and absolute) | Phase 2 |
| Allowed auth methods toggle | Phase 2 |
| IP allowlisting (CIDR ranges, max 50) | Future |

---

## 2. Workspaces & Projects

### Hierarchy

```
Account
└── Workspace
    └── Project
        └── Folder (nestable)
            ├── Asset
            └── Version Stack
```

### Workspace Features

| Feature | Description | Phase |
|---------|-------------|-------|
| Multiple workspaces per account | Per-client or per-department isolation | MVP |
| Workspace-level user management | Add/remove members, set permission levels | MVP |
| Cross-workspace asset movement | Move assets between workspaces | MVP |

### Project Types

| Type | Visibility | Phase |
|------|------------|-------|
| Standard (Active) | All workspace members with access | MVP |
| Restricted | Invite-only; breaks permission inheritance | MVP |
| Inactive (Archived) | Hidden from default view; data preserved | MVP |

### Project Settings

| Setting | Description | Phase |
|---------|-------------|-------|
| Name | Project title | MVP |
| Logo / icon | Custom visual identifier | MVP |
| Notifications toggle | Per-project on/off | MVP |
| Asset lifecycle | Enable auto-delete policy | MVP |
| Active / Inactive | Archive state | MVP |
| Project duplication | Clone with or without assets | MVP |
| Access request management | Approve/deny requests to join | MVP |

### Permission Levels (Workspace & Project)

| Level | Upload / Delete | Share | Download | Comment | View | Manage Members | Phase |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|-------|
| Full Access | Y | Y | Y | Y | Y | Y | MVP |
| Edit & Share | Y | Y | Y | Y | Y | N | MVP |
| Edit | Y | N | N | Y | Y | N | MVP |
| Comment Only | N | N | N | Y | Y | N | MVP |
| View Only | N | N | N | N | Y | N | MVP |

### Permission Inheritance Rules

- Workspace permissions cascade to all projects and folders.
- Permissions can only be elevated, never lowered at a nested level.
- Restricted Projects and Restricted Folders break the inheritance chain.
- Account Owners and Content Admins always retain access regardless of restriction.

### Permission Matrices

**Workspace-level actions:**

| Action | Owner / Admin | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| View workspace | Y | Y | Y | Y | Y | Y |
| Create projects | Y | Y | Y | Y | N | N |
| Create restricted projects | Y | Y | N | N | N | N |
| Add members | Y | Y | N | N | N | N |
| Delete workspace | Y | N | N | N | N | N |

**Project-level actions:**

| Action | Owner / Admin | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Upload / delete assets | Y | Y | Y | Y | N | N |
| Share assets | Y | Y | Y | N | N | N |
| Download assets | Y | Y | Y | N | N | N |
| Comment | Y | Y | Y | Y | Y | N |
| View assets | Y | Y | Y | Y | Y | Y |

### Access Groups

| Feature | Description | Phase |
|---------|-------------|-------|
| Create / rename / delete group | Bulk permission management | MVP |
| Add / remove members | Members inherit all group permissions | MVP |
| Grant group permission on resource | Applies to workspace, project, or folder | MVP |
| Revoke group permission | Individual grants remain unaffected | MVP |

### Restricted Folders

| Feature | Description | Phase |
|---------|-------------|-------|
| Invite-only access | Breaks project-level permission inheritance | Phase 2 |
| Admin override | Owners and Admins always retain access | Phase 2 |
| Nested folder visibility | Hidden from non-invited users | Phase 2 |

---

## 3. Files & Versions

### Upload Methods

| Method | Platform | Features | Phase |
|--------|----------|----------|-------|
| Web browser drag-and-drop | Web | Bulk upload, progress visibility | MVP |
| API (pre-signed URLs) | Integration | Chunked, programmatic | MVP |
| Bush Transfer app | macOS / Windows | Large files, folder structure, EDL support | Phase 2 |
| iOS / iPadOS app | iPhone / iPad | Camera roll import | Phase 2 |
| Adobe panel | Premiere Pro / After Effects | Direct export | Phase 2 |
| Camera to Cloud | Hardware | Automatic from set | Phase 2 |

### Upload Specifications

| Specification | Limit |
|---------------|-------|
| Max file size | 10 GB |
| Max concurrent uploads | 10 |
| Max assets per upload batch | 500 |
| Max folders per upload batch | 250 |
| Bulk operation limit | 200 assets |
| Transfer app target speed | 30 GB in 10 minutes |

### Supported File Types

#### Video

| Format | Codecs |
|--------|--------|
| 3GPP / 3GPP2 (.3gp, .3g2) | H263, MPEG-4 |
| AVI | MJPEG, MPEG4 |
| FLV | FLV1 |
| MKV | H264/AVC |
| MOV | H264/AVC, H265/HEVC, MJPEG, ProRes |
| MP4 | H264/AVC, H265/HEVC |
| MXF | DNxHD, JPEG2000, ProRes |
| WebM | VP8 |
| WMV | WMV2 |

#### Audio

| Format | Codec |
|--------|-------|
| AAC | AAC |
| AIFF | PCM |
| FLAC | FLAC |
| M4A | AAC, MPEG |
| MP3 | MPEG |
| OGG | Vorbis |
| WAV | PCM |
| WMA | wmav2 |

#### Image

| Category | Formats |
|----------|---------|
| RAW | 3fr, arw, cr2, cr3, crw, mrw, nef, orf, pef, raf, rw2, sr2, srf, srw |
| Standard | BMP, EXR, GIF, HEIC, JPG, PNG, TGA, TIFF, WebP |
| Adobe | AI, EPS, INDD, PSD |

#### Documents

| Format | Notes | Phase |
|--------|-------|-------|
| PDF | Multi-page, pagestamp comments | MVP |
| Markdown (.md, .markdown) | Rendered with GFM (tables, task lists, code blocks) | MVP |
| DOCX / DOC | MS Word | MVP |
| PPTX / PPT | MS PowerPoint | MVP |
| XLSX / XLS | MS Excel | MVP |
| Interactive ZIP (HTML) | Embedded HTML | Future |

### Asset Conversion (Automatic)

| Output | Purpose | Phase |
|--------|---------|-------|
| Thumbnail | Grid view preview | MVP |
| Hover scrub | Timeline preview | MVP |
| Proxy 360p | Streaming playback | MVP |
| Proxy 540p | Streaming playback | MVP |
| Proxy 720p | Streaming playback | MVP |
| Proxy 1080p | Streaming playback | MVP |
| Proxy 4K | Pro+ streaming | Phase 2 |
| HDR proxy | HDR viewing | Phase 2 |
| Audio waveform | Timeline visualization | MVP |

### Asset Operations

| Operation | Description | Phase |
|-----------|-------------|-------|
| Copy to | Duplicate to another location | MVP |
| Move to | Relocate asset | MVP |
| Delete | Move to Recently Deleted | MVP |
| Recover | Restore from trash (30-day window) | MVP |
| Download original | Full resolution source file | MVP |
| Download proxy | Streaming-quality version | MVP |
| Download still frame | Single frame export | MVP |
| Set custom thumbnail | Override auto-generated thumbnail | MVP |
| Reset lifecycle | Restart auto-delete timer | MVP |

### Version Stacking

| Feature | Description | Phase |
|---------|-------------|-------|
| Create version | Drag new file onto existing asset | MVP |
| Auto-numbering | Sequential version labels | MVP |
| View all versions | Expand version stack | MVP |
| Compare versions | Side-by-side comparison viewer | MVP |
| Download specific version | Per-version download | MVP |
| Comment persistence | Comments persist across versions | MVP |
| Show/hide versions in shares | Toggle per share | MVP |

### Folder Operations

| Operation | Phase |
|-----------|-------|
| Create / rename / delete folder | MVP |
| Create subfolder (nested) | MVP |
| Move folder | MVP |
| Copy folder | MVP |
| Flatten folders view (display option) | MVP |
| Restricted folder (invite-only) | Phase 2 |

---

## 4. Metadata & Collections

### Built-in Metadata Fields (33 fields)

#### Technical — Video / Audio

| Field | Type | Editable |
|-------|------|----------|
| Alpha Channel | Read-only | No |
| Audio Bit Depth | Read-only | No |
| Audio Bit Rate | Read-only | No |
| Audio Codec | Read-only | No |
| Bit Depth | Read-only | No |
| Bit Rate | Read-only | No |
| Channels | Read-only | No |
| Color Space | Read-only | No |
| Duration | Read-only | No |
| Dynamic Range | Read-only | No |
| End Time | Read-only | No |
| Frame Rate | Read-only | No |
| Resolution - Height | Read-only | No |
| Resolution - Width | Read-only | No |
| Sample Rate | Read-only | No |
| Start Time | Read-only | No |
| Video Bit Rate | Read-only | No |
| Video Codec | Read-only | No |

#### File Information

| Field | Type | Editable |
|-------|------|----------|
| Date Uploaded | Timestamp | No |
| File Size | Read-only | No |
| File Type | Read-only | No |
| Format | Read-only | No |
| Page Count | Read-only | No |
| Source Filename | Read-only | No |

#### Collaboration

| Field | Type | Editable |
|-------|------|----------|
| Assignee | User reference | Yes |
| Comment Count | Read-only | No |
| Keywords | Text | Yes |
| Notes | Text | Yes |
| Rating | Rating (1–5 stars) | Yes |
| Seen By | User reference | No |
| Status | Select | Yes |
| Transcript | Text | Yes |
| Uploader | User reference | No |

### Custom Metadata Field Types (10 types)

| Type | Use Case | Phase |
|------|----------|-------|
| Single-line text | Names, titles, IDs | MVP |
| Multi-line text | Descriptions, notes | MVP |
| Number | Quantities, durations | MVP |
| Date | Deadlines, air dates | MVP |
| Single-select | Status dropdown | MVP |
| Multi-select | Tags, categories | MVP |
| Checkbox | Yes/No flags | MVP |
| User reference | Assignments | MVP |
| URL | Links to external resources | MVP |
| Rating | Stars (1–5) | MVP |

### Metadata Management

| Feature | Description | Phase |
|---------|-------------|-------|
| Account-wide field library | Single definition, used across projects | MVP |
| Field visibility per project | Show/hide fields per project | MVP |
| Field Management Tab | Admin-only view for all custom fields | MVP |
| Add field to all projects | Bulk enable across account | MVP |
| Field permissions | Admins only vs. Admins + Full Access | MVP |
| Metadata persistence | Travels with assets on copy/move | MVP |

### View / Display Options

| Option | Values | Phase |
|--------|--------|-------|
| Layout | Grid, List | MVP |
| Card size | Small, Medium, Large | MVP |
| Aspect ratio | 16:9, 1:1, 9:16 | MVP |
| Thumbnail scale | Fit, Fill | MVP |
| Show card info | Toggle | MVP |
| Flatten folders | Toggle | MVP |

### Collections

| Feature | Description | Phase |
|---------|-------------|-------|
| Team Collection | Visible to all project members | MVP |
| Private Collection | Creator-only visibility | MVP |
| Dynamic filtering | Saved filter rules that auto-update | MVP |
| Real-time sync | New matching assets appear automatically | MVP |
| Share Collection | Send Collection as external share | MVP |
| Custom sort within Collection | Override default asset order | MVP |
| Grid / List view | Per-Collection display preference | MVP |
| Add assets manually | Pin specific assets | MVP |

---

## 5. Review & Comments

### Comment Types

| Type | Description | Phase |
|------|-------------|-------|
| Single-frame | Timestamped to a specific frame | MVP |
| Range-based | Spans a time range (in/out points) | MVP |
| Anchored | Pinned to a specific screen location | MVP |
| Pagestamp | Anchored to a PDF page | MVP |
| Internal | Private to workspace members | MVP |
| Public | Visible to all share reviewers | MVP |

### Comment Features

| Feature | Description | Phase |
|---------|-------------|-------|
| Frame-accurate timestamp | Sub-frame precision | MVP |
| Text body | Plain text | MVP |
| Emoji reactions | React to comments | MVP |
| @ mentions | Triggers notification to mentioned user | MVP |
| Hashtags | Organize and filter comments | MVP |
| Color hex codes | Design reference inline | MVP |
| Attachments | Up to 6 per comment; images, video, audio, PDF | Phase 2 |
| Annotations | Drawn overlays on frame | MVP |

### Annotation Tools

| Tool | Phase |
|------|-------|
| Free draw | MVP |
| Line | MVP |
| Arrow | MVP |
| Rectangle | MVP |
| Multiple colors | MVP |
| Undo / redo | MVP |

### Comment Management

| Action | Description | Phase |
|--------|-------------|-------|
| Reply | Threaded response | MVP |
| Edit own | Modify own comments | MVP |
| Delete own | Remove own comments | MVP |
| Edit any | Owner / Admin / Full Access only | MVP |
| Delete any | Owner / Admin / Full Access only | MVP |
| Mark complete | Track resolution status | MVP |
| Copy | Duplicate comment | MVP |
| Paste | Apply to another asset | MVP |
| Filter by hashtag / user / status | Narrow comment list | MVP |
| Print | Document-style output | MVP |
| Export | CSV, Plain Text, EDL | MVP |
| Search | Find comment text | MVP |
| Link to specific comment | Shareable deep link | MVP |

### Comment Permissions

| Action | Owner / Admin | Full Access | Edit | Comment Only | View Only |
|--------|:---:|:---:|:---:|:---:|:---:|
| Create comment | Y | Y | Y | Y | N |
| Edit own | Y | Y | Y | Y | N |
| Delete own | Y | Y | Y | Y | N |
| Edit any | Y | Y | N | N | N |
| Delete any | Y | Y | N | N | N |

---

## 6. Player & Viewer

### Video Player

| Feature | Description | Phase |
|---------|-------------|-------|
| Play / Pause | Spacebar or K | MVP |
| Frame-by-frame forward | Right Arrow | MVP |
| Frame-by-frame back | Left Arrow | MVP |
| JKL shuttle | J = reverse (2x/4x/8x), K = pause, L = forward (2x/4x/8x) | MVP |
| Scrub | Drag timeline | MVP |
| Playback speed | 0.25x – 1.75x | MVP |
| Loop playback | Toggle | MVP |
| Volume control | Slider | MVP |
| Mute | M key | MVP |
| Set in point | I key | MVP |
| Set out point | O key | MVP |
| Fullscreen | F key | MVP |
| Frame-accurate hover preview | Hover over timeline | MVP |

### Playback Resolution

| Resolution | Plan Required | Phase |
|------------|---------------|-------|
| Auto (adaptive) | All | MVP |
| 360p | All | MVP |
| 540p | All | MVP |
| 720p | All | MVP |
| 1080p | All | MVP |
| 4K | Pro+ | Phase 2 |

### Frame Guides

| Feature | Description | Phase |
|---------|-------------|-------|
| Aspect ratio overlays | 16:9, 4:3, 1:1, 9:16 and other presets | MVP |
| Mask mode | Hide content outside guide area | MVP |

### Image Viewer

| Feature | Description | Phase |
|---------|-------------|-------|
| Zoom | Up to 400% | MVP |
| Pan | Click-drag navigation | MVP |
| Fit to screen | Reset zoom | MVP |
| 1:1 pixel view | Exact pixel rendering | MVP |
| Mini-map | Navigation aid for large images | MVP |

### PDF Viewer

| Feature | Description | Phase |
|---------|-------------|-------|
| Multi-page navigation | Scroll or jump | MVP |
| Page thumbnails | Sidebar strip | MVP |
| Zoom controls | In / out / fit | MVP |
| Page jump | Direct page input | MVP |
| Text markups | Annotate PDF pages | MVP |

### Markdown Viewer

| Feature | Description | Phase |
|---------|-------------|-------|
| GFM rendering | Tables, task lists, strikethrough | MVP |
| Syntax highlighting | Code blocks | MVP |
| Dark theme | Matches other viewers | MVP |

### Comparison Viewer

| Feature | Description | Phase |
|---------|-------------|-------|
| Side-by-side | Two assets displayed simultaneously | MVP |
| Linked zoom / playback | Synchronized scrubbing | MVP |
| Version comparison | Compare versions from same stack | MVP |
| Independent controls | Toggle linked/unlinked | MVP |

### Keyboard Shortcuts

#### Player Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| K | Pause |
| J | Rewind (press again to increase speed: 2x / 4x / 8x) |
| L | Fast forward (press again to increase speed: 2x / 4x / 8x) |
| Left Arrow | Previous frame |
| Right Arrow | Next frame |
| I | Set in point |
| O | Set out point |
| F | Fullscreen |
| M | Mute |
| Escape | Exit range playback / fullscreen |

#### Global Shortcuts

| Action | Mac | Windows |
|--------|-----|---------|
| In-project search | Cmd+F | Ctrl+F |
| Quick search (Cmd+K) | Cmd+K | Ctrl+K |
| Select all | Cmd+A | Ctrl+A |
| Deselect all | Cmd+Shift+A | Ctrl+Shift+A |
| Delete selected | Delete | Delete |
| Download | Cmd+D | Ctrl+D |
| Share | Cmd+Shift+S | Ctrl+Shift+S |

---

## 7. Sharing

### Share Types

| Type | Access | Phase |
|------|--------|-------|
| Public | Anyone with the link | MVP |
| Secure | Specific email invites with email verification | MVP |

### Share Layouts

| Layout | Description | Phase |
|--------|-------------|-------|
| Grid | Thumbnail grid; each asset opens its own viewer | MVP |
| Reel | Sequential single-player experience | MVP |
| Open in Viewer | Single asset; bypasses landing page | MVP |

### Share Settings

| Setting | Description | Phase |
|---------|-------------|-------|
| Visibility toggle | Enable / disable share link | MVP |
| Passphrase protection | bcrypt-hashed server-side verification | MVP |
| Expiration date / time | Auto-disable at configured date | MVP |
| Allow comments | Reviewer commenting on/off | MVP |
| Allow downloads | Download permission on/off | MVP |
| Show all versions | Expose version stack to reviewers | MVP |
| Display transcription | Show transcript panel in share | MVP |
| Featured field | Default editable field for recipients (syncs to project) | MVP |

### Share Branding (Custom)

| Element | Options | Phase |
|---------|---------|-------|
| Icon | Emoji or custom image | MVP |
| Custom logo | Uploaded image | MVP |
| Header | Size, visibility | MVP |
| Background image | Custom image | MVP |
| Description | Text below creator name | MVP |
| Appearance | Light / dark mode | MVP |
| Accent colors | Custom palette | MVP |

### Share Operations

| Operation | Description | Phase |
|-----------|-------------|-------|
| Create share | From project, folder, collection, or asset | MVP |
| Duplicate share | Clone with all settings | MVP |
| Delete / revoke share | Immediately disables link | MVP |
| Copy share link | Copy to clipboard | MVP |
| Send via email | Direct email invite from app | MVP |
| WYSIWYG preview | Preview before sending | MVP |

### Share Activity Tracking

| Event | Tracked | Phase |
|-------|---------|-------|
| Share link opened | Yes | MVP |
| Asset viewed | Yes | MVP |
| Comment created | Yes | MVP |
| Asset downloaded | Yes | MVP |

### Share Notifications (to reviewer)

| Trigger | Notification | Phase |
|---------|-------------|-------|
| Invited to share | Email | MVP |
| Reply to their comment | Email | MVP |
| @ mention | Email | MVP |
| New assets added to share | Email | MVP |

---

## 8. Transcription

### Transcription Features

| Feature | Description | Phase |
|---------|-------------|-------|
| Automatic transcription | Triggered after upload; async BullMQ job | MVP |
| Language auto-detection | No language hint required | MVP |
| Word-level timestamps | Every word has start/end in milliseconds | MVP |
| Time-synced highlighting | Text highlighted during playback | MVP |
| Click-to-seek | Click any word to jump to that timestamp | MVP |
| Editable transcripts | Correct errors inline; original preserved | MVP |
| Search transcript | Find words; jumps to timestamp | MVP |
| Caption export | SRT (.srt) and WebVTT (.vtt) | MVP |
| Caption ingest | Upload external SRT/VTT files | MVP |
| Multiple caption tracks | Language selection | MVP |
| Speaker diarization | Automatic speaker identification with rename | Phase 2 |

### Supported Languages

36 languages via Deepgram Nova-2 (exceeds 27-language requirement):

Bulgarian, Catalan, Chinese (Simplified), Chinese (Traditional), Czech, Danish, Dutch, English, Estonian, Finnish, Flemish, French, German, Greek, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Latvian, Lithuanian, Malay, Norwegian, Polish, Portuguese, Romanian, Russian, Slovak, Spanish, Swedish, Thai, Turkish, Ukrainian, Vietnamese

### Transcription Permissions

| Action | Owner / Admin | Full Access | Edit | Comment Only | View Only |
|--------|:---:|:---:|:---:|:---:|:---:|
| Generate | Y | Y | Y | N | N |
| Edit | Y | Y | Y | N | N |
| Export | Y | Y | Y | N | N |
| Delete | Y | Y | Y | N | N |
| View | Y | Y | Y | Y | Y |

### Caption Export Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v4/files/:id/transcript` | Get transcript with word-level data |
| POST | `/v4/files/:id/transcript` | Trigger manual re-transcription |
| PUT | `/v4/files/:id/transcript` | Edit words / rename speakers |
| DELETE | `/v4/files/:id/transcript` | Delete transcript |
| GET | `/v4/files/:id/captions` | Export VTT or SRT (`?format=vtt\|srt`) |
| GET | `/v4/files/:id/transcript/words` | Get words for time range (`?start_ms=&end_ms=`) |

---

## 9. Search

### Standard Search

| Searchable Field | Phase |
|-----------------|-------|
| Filename | MVP |
| Metadata fields | MVP |
| Status | MVP |
| Keywords | MVP |
| Uploader | MVP |
| File type | MVP |
| Transcript content | MVP |

### Search Behavior

| Feature | Description | Phase |
|---------|-------------|-------|
| Scope | Global across account | MVP |
| Instant results | No Enter required | MVP |
| Preview panel | Thumbnail and info on hover | MVP |
| Relevance ranking | By match quality | MVP |
| Filter refinement | Narrow after search | MVP |
| Transcript match | Shows context + jump-to-timestamp link | MVP |

### Enhanced Search (Media Intelligence)

| Feature | Description | Phase |
|---------|-------------|-------|
| Natural language processing | Intent-aware queries | Future |
| Semantic understanding | Conceptual matches beyond keywords | Future |
| Visual search | Search by visual similarity | Future |

---

## 10. Notifications

### In-App Notifications

| Trigger | Phase |
|---------|-------|
| @ mention | MVP |
| Comment reply | MVP |
| New upload to watched project | MVP |
| Status change | MVP |
| Share activity | MVP |
| Per-project toggle | MVP |

### Email Notifications

| Option | Phase |
|--------|-------|
| Immediate alerts | MVP |
| Daily digest | MVP |
| Per-project settings | MVP |
| Per-asset subscription | MVP |

### Push Notifications (iOS)

| Trigger | Phase |
|---------|-------|
| @ mention | Phase 2 |
| Comment reply | Phase 2 |
| New share invite | Phase 2 |

---

## 11. Storage

### Plan Storage Tiers

| Plan | Storage | Phase |
|------|---------|-------|
| Free | 2 GB | MVP |
| Pro | 2 TB + 2 TB/member | MVP |
| Team | 3 TB + 2 TB/member | MVP |
| Enterprise | Custom | MVP |

### Storage Connect (Bring Your Own Storage)

| Feature | Description | Phase |
|---------|-------------|-------|
| Connect AWS S3 bucket | Primary read/write bucket | Phase 2 |
| Read-only additional buckets | Reference additional S3 buckets | Phase 2 |
| Bush proxies stored separately | Proxies remain in Bush infrastructure | Phase 2 |
| API asset registration | Register assets stored externally | Phase 2 |

### Asset Lifecycle Management

| Setting | Options | Phase |
|---------|---------|-------|
| Auto-expiration | 30 / 60 / 90 days or custom duration | MVP |
| Workspace-level policy | Apply policy across all projects | MVP |
| Visual indicator | Clock icon on expiring assets; hover shows days remaining | MVP |
| Reset lifecycle | Restart timer on individual assets | MVP |
| Recovery after deletion | 30-day trash window | MVP |

---

## 12. Integrations — Camera to Cloud

### Supported Hardware

| Manufacturer | Models | Phase |
|--------------|--------|-------|
| Atomos | CONNECT series | Phase 2 |
| Teradek | Serv, Prism, Cube | Phase 2 |
| RED | V-RAPTOR, KOMODO | Phase 2 |
| Canon | C400, C80, select cameras | Phase 2 |
| Fujifilm | Select cameras | Phase 2 |
| Panasonic | LUMIX select cameras | Phase 2 |
| Nikon | Select cameras | Phase 2 |
| Leica | Select cameras | Phase 2 |
| Sound Devices | 8 Series | Phase 2 |
| Ambient | Lockit | Phase 2 |
| Accsoon | Select devices | Phase 2 |

### Supported C2C Apps

| App | Phase |
|-----|-------|
| Filmic Pro | Phase 2 |
| Mavis Camera | Phase 2 |
| Magic ViewFinder | Phase 2 |
| ZoeLog | Phase 2 |
| FilmDataBox | Phase 2 |
| Pomfort LiveGrade | Phase 2 |
| Viviana Cloud Box | Phase 2 |

### C2C Features

| Feature | Description | Phase |
|---------|-------------|-------|
| Automatic upload from set | Upload triggers the moment recording stops | Phase 2 |
| Metadata preservation | Camera metadata carried with clip | Phase 2 |
| Proxy generation | Automatic after upload | Phase 2 |
| Date-based folder organization | Clips organized by shoot date | Phase 2 |
| Real-time collaboration | Remote team sees footage immediately | Phase 2 |
| Device authorization | Per-device approval in settings | Phase 2 |
| Timezone adjustment | Correct folder dates for timezone | Phase 2 |

---

## 13. Integrations — Adobe & NLE

### Adobe Premiere Pro

| Feature | Min Version | Phase |
|---------|-------------|-------|
| V4 Panel — browse workspaces/projects | 25.6+ | Phase 2 |
| V4 Panel — import media directly | 25.6+ | Phase 2 |
| V4 Panel — upload sequences | 25.6+ | Phase 2 |
| V4 Panel — version management | 25.6+ | Phase 2 |
| V4 Panel — real-time comment sync to markers | 25.6+ | Phase 2 |
| Comments Panel — comment viewing | 25.2+ | Phase 2 |
| Comments Panel — timeline marker sync | 25.2+ | Phase 2 |

### Other Adobe Apps

| App | Integration | Phase |
|-----|-------------|-------|
| After Effects | Bush panel | Phase 2 |
| Lightroom | C2C upload, direct export | Phase 2 |
| Workfront | Workflow automation | Phase 2 |

### NLE Integrations

| App | Features | Phase |
|-----|----------|-------|
| Final Cut Pro | Comments as markers, EDL import | Phase 2 |
| DaVinci Resolve | EDL comment import | Phase 2 |
| Avid Media Composer | C2C workflow support | Phase 2 |

### SDK

| SDK | Package | Phase |
|-----|---------|-------|
| TypeScript / JavaScript | `npm install bush-sdk` | Phase 2 |
| Python | `pip install bush-sdk` | Phase 2 |

---

## 14. Integrations — Automation

| Platform | Phase |
|----------|-------|
| Adobe Workfront Fusion | Phase 2 |
| Zapier | Phase 2 |
| Make (Integromat) | Phase 2 |
| Pipedream | Phase 2 |
| Pabbly Connect | Phase 2 |
| DNA Fabric (storage) | Phase 2 |

---

## 15. Mobile Apps

### iOS / iPadOS App

| Feature | Description | Phase |
|---------|-------------|-------|
| Asset navigation | Browse workspaces, projects, folders | Phase 2 |
| Video / image / audio viewing | Full player with all controls | Phase 2 |
| Commenting and annotation | Frame-accurate comments on mobile | Phase 2 |
| File upload from camera roll | Import from device | Phase 2 |
| Share creation | Full share builder from mobile | Phase 2 |
| Asset download | Download to device | Phase 2 |
| Move / copy operations | Reorganize assets | Phase 2 |
| Push notifications | Mentions, replies, new shares | Phase 2 |
| Restricted / inactive project support | Full parity with web | Phase 2 |
| Pinch to zoom | Up to 400% | Phase 2 |
| Customizable skip interval | User-set jump duration | Phase 2 |
| Adjustable playback speed | Variable speed control | Phase 2 |
| Resolution control | Select proxy quality | Phase 2 |
| Adjustable thumbnail size | Small / medium / large | Phase 2 |
| Metadata display | Configurable visible fields | Phase 2 |
| Offline caching | View recently accessed assets offline | Future |

**Requirements:** iOS / iPadOS 17.0+. Native Swift. iPhone and iPad.

### Apple TV App

| Feature | Description | Phase |
|---------|-------------|-------|
| 4K 10-bit HDR viewing | Full HDR playback on Apple TV | Phase 2 |
| Big screen presentation | Living room / screening room use | Phase 2 |
| Resolution controls | Select playback quality | Phase 2 |
| Adjustable playback speed | Variable speed | Phase 2 |

### Android

| Feature | Description | Phase |
|---------|-------------|-------|
| Web browser access | Full web app via mobile browser | MVP |
| Native app | No native Android app | Future |

---

## 16. Desktop Apps

### Bush Transfer

| Feature | Description | Phase |
|---------|-------------|-------|
| Bulk upload | Upload entire project folders | Phase 2 |
| Bulk download | Download entire projects | Phase 2 |
| Folder structure preservation | No reorganization needed after transfer | Phase 2 |
| Speed control | Throttle upload/download rate | Phase 2 |
| Priority queue | Drag-and-drop to reorder queue | Phase 2 |
| EDL / log file support | Sync with edit decision lists | Phase 2 |
| Large file support | Handles files up to 10 GB | Phase 2 |

**Platforms:** macOS (Apple Silicon), macOS (Intel), Windows
**Requirements:** macOS 10.15 (Catalina)+, Windows 7+

### Bush Mac App (Watch Folders)

| Feature | Description | Phase |
|---------|-------------|-------|
| Watch folders | Monitor local folders for new files | Phase 2 |
| Auto-upload | Upload new files automatically | Phase 2 |
| System integration | macOS menu bar integration | Phase 2 |

**Requirements:** macOS 11.0 (Big Sur)+

---

## 17. System Requirements

### Web App

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Browser | Latest 2 versions of Chrome, Safari, Firefox, Edge | Latest Chrome or Safari |
| OS | Windows, macOS, Chrome OS | Windows 10 (64-bit)+, macOS 11+ |
| RAM | 4 GB | 8 GB+ |

### Adobe Panel

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Premiere Pro | CC 2019 (13.0) | CC 2022 (22.3)+ |
| After Effects | CC 2018 (15.0) | CC 2022 (22.3)+ |
| OS | Windows, macOS | Windows 10+, macOS 10.15+ |

### Mobile / TV

| Platform | Requirement |
|----------|-------------|
| iPhone | iOS 17.0+ |
| iPad | iPadOS 17.0+ |
| Apple TV | tvOS (current) |

### Desktop Apps

| App | OS | Requirement |
|-----|----|-------------|
| Bush Transfer | macOS | 10.15 (Catalina)+ |
| Bush Transfer | Windows | Windows 7+ |
| Bush Mac App | macOS | 11.0 (Big Sur)+ |

---

## Cross-References

| Topic | Spec File |
|-------|-----------|
| Authentication implementation (WorkOS, sessions, cookies) | `02-authentication.md` |
| Permission model implementation (RBAC, Access Groups) | `03-permissions.md` |
| API reference (endpoints, pagination, error codes) | `04-api-reference.md` |
| Media processing pipeline (proxies, thumbnails, FFmpeg) | `07-media-processing.md` |
| Transcription implementation (providers, DB schema, queue) | `08-transcription.md` |
| Security implementation (encryption, audit logs, watermarking) | `12-security.md` |
| Billing and plan enforcement | `13-billing.md` |
| Design system and component library | `21-design-components.md` |

### API Rate Limiting Reference

Rate limiting uses a **sliding window** algorithm backed by Redis.

| Endpoint Category | Limit |
|-------------------|-------|
| Authentication endpoints | 10 req/min per IP |
| API read endpoints | 300 req/min per token |
| API write endpoints | 60 req/min per token |
| Upload endpoints | 20 req/min per token |
| Share link access | 30 req/min per IP |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
Exceeded: `429 Too Many Requests` with `Retry-After` header.

### API Pagination Reference

- Cursor-based pagination on all list endpoints.
- Default: 50 items per page. Maximum: 100.
- Include `total_count` via query parameter.

```json
{
  "data": [...],
  "links": { "next": "..." },
  "total_count": 21
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (delete) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 5xx | Server Error |

### Security Certifications

| Certification | Scope | Phase |
|---------------|-------|-------|
| SOC 2 Type 2 | Security, availability, confidentiality | Future |
| TPN+ Gold Shield | MPA content security assessment | Future |
| ISO 27001 | Information security management | Future |
