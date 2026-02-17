# Bush - Complete Atomic Feature Specifications

## Summary
This document contains an exhaustive breakdown of ALL atomic features extracted from the Bush platform, help documentation, and developer API.

---

## 1. ACCOUNT & AUTHENTICATION


### 1.2 Account Roles
| Role | Permissions |
|------|-------------|
| Account Owner | Full access to all, billing, plan management |
| Content Admin | All content access, no billing/plan management |
| Member | Access to granted workspaces/projects |
| Guest | Limited (1 project max) |
| Reviewer | Access only to assigned Share links |

### 1.3 Authentication Methods
- Social Sign-On (Google, Apple, etc.)
- Adobe ID integration
- Two-factor authentication (2FA)

### 1.4 Account Settings
- Password management
- Email management
- Notification settings
- Billing information
- Invoice download
- Plan upgrades/downgrades
- Account cancellation
- Account switcher (multiple accounts)

---

## 2. WORKSPACE MANAGEMENT

### 2.1 Workspace Hierarchy
```
Account → Workspace → Project → Folder → [File | Version Stack | Folder]
```

### 2.2 Workspace Features
- Multiple workspaces per account
- Workspace-level user management
- Workspace visibility controls
- Cross-workspace asset movement

### 2.3 Project Types
| Type | Visibility |
|------|------------|
| Internal | Visible to workspace members |
| Restricted | Invite-only access |
| Active | Normal visibility |
| Inactive | Filtered from default view |

### 2.4 Project Settings
- Project name
- Project logo/icon
- Project notifications toggle
- Project duplication
- Archive (inactive status)
- Access request management

---

## 3. USER MANAGEMENT

### 3.1 User Permission Levels
| Permission | Description |
|------------|-------------|
| Full Access | All abilities |
| Edit & Share | Upload, manage, share, comment, view, download |
| Edit | Edit & Share minus share/download |
| Comment Only | Comment and view |
| View Only | View only |

### 3.2 User Operations
- Add user to workspace
- Add user to project
- Remove user from workspace
- Remove user from project
- Bulk user management
- Access Groups

### 3.3 Permission Inheritance
- Workspace permissions cascade to projects
- Project permissions cascade to folders/assets
- Restricted projects break inheritance chain
- Cannot lower inherited permissions

---

## 4. FILE MANAGEMENT

### 4.1 Upload Methods
- Web browser drag-and-drop
- Bush Transfer app
- Camera to Cloud (C2C)
- iOS/iPadOS app
- Adobe panel uploads
- API uploads

### 4.2 Upload Features
- Bulk uploads
- Progress visibility
- Priority queue management
- Chunked uploads (large files)
- Pre-signed upload URLs (API)

### 4.3 Supported File Types (Validated)

#### Video
- 3GPP/3GPP2 (3G2/3GP) - H263, MPEG-4
- AVI - MJPEG, MPEG4
- FLV - FLV1
- MKV - H264/AVC
- MOV - H264/AVC, H265/HEVC, MJPEG, ProRes
- MP4 - H264/AVC, H265/HEVC
- MXF - DNxHD, JPEG2000, ProRes
- WebM - VP8
- WMV - WMV2

#### Audio
- AAC
- AIFF - PCM
- FLAC
- M4A - AAC, MPEG
- MP3 - MPEG
- OGG - Vorbis
- WAV - PCM
- WMA - wmav2

#### Image
- 3fr, arw, cr2, cr3, crw, mrw, nef, orf, pef, raf, rw2, sr2, srf, srw (RAW)
- AI, EPS, INDD (Adobe)
- BMP, EXR, GIF, HEIC, JPG, PNG, PSD, TGA, TIFF, webp

#### Documents
- PDF (multi-page)
- Markdown (.md, .markdown)
- DOCX/DOC (MS Word)
- PPTX/PPT (MS PowerPoint)
- XLSX/XLS (MS Excel)
- Interactive ZIP (HTML) *(future release)*

### 4.4 Asset Conversion
- Automatic proxy generation
- Thumbnail generation
- Multiple resolution proxies
- HDR proxy support

### 4.5 Asset Operations
- Copy assets
- Move assets
- Delete assets
- Recover deleted assets (within retention period)
- Version stacking
- Download (original or proxy)
- Download still frame
- Set custom thumbnail

### 4.6 Version Stacking
- Drag new version onto existing asset
- Automatic version numbering
- View all versions
- Compare versions
- Download specific version

---

## 5. FOLDER MANAGEMENT

### 5.1 Folder Operations
- Create folder
- Create subfolder
- Rename folder
- Move folder
- Copy folder
- Delete folder
- Restricted folders (Team+)

### 5.2 Restricted Folders
- Invite-only access
- Breaks permission inheritance
- Visible only to invited users
- Admins retain access

### 5.3 Folder Navigation
- Nested folder tree
- Breadcrumb navigation
- Flatten folders view option

---

## 6. METADATA SYSTEM

### 6.1 Built-in Metadata Fields (33 fields)

| Field | Type | Editable |
|-------|------|----------|
| Alpha Channel | Read-only | No |
| Assignee | User reference | Yes |
| Audio Bit Depth | Read-only | No |
| Audio Bit Rate | Read-only | No |
| Audio Codec | Read-only | No |
| Bit Depth | Read-only | No |
| Bit Rate | Read-only | No |
| Channels | Read-only | No |
| Color Space | Read-only | No |
| Comment Count | Read-only | No |
| Date Uploaded | Timestamp | No |
| Duration | Read-only | No |
| Dynamic Range | Read-only | No |
| End Time | Read-only | No |
| File Size | Read-only | No |
| File Type | Read-only | No |
| Format | Read-only | No |
| Frame Rate | Read-only | No |
| Keywords | Text | Yes |
| Notes | Text | Yes |
| Page Count | Read-only | No |
| Rating | Rating (1-5) | Yes |
| Resolution - Height | Read-only | No |
| Resolution - Width | Read-only | No |
| Sample Rate | Read-only | No |
| Seen By | User reference | No |
| Source Filename | Read-only | No |
| Start Time | Read-only | No |
| Status | Select | Yes |
| Transcript | Text | Yes |
| Uploader | User reference | No |
| Video Bit Rate | Read-only | No |
| Video Codec | Read-only | No |

### 6.2 Custom Metadata Fields (10 field types)
1. Single-line text
2. Multi-line text
3. Number
4. Date
5. Single-select
6. Multi-select
7. Checkbox
8. User reference
9. URL
10. Rating

### 6.3 Metadata Management
- Account-wide field library
- Field visibility toggles per project
- Field Management Tab (Admins)
- Add field to all projects
- Field permissions (Admins only vs Admins + Full Access)

### 6.4 Metadata Persistence
- Metadata travels with assets across projects/workspaces
- Preserved on copy/move/duplicate operations

---

## 7. COLLECTIONS

### 7.1 Collection Types
| Type | Visibility |
|------|------------|
| Team Collection | All project members |
| Private Collection | Creator only |

### 7.2 Collection Features
- Dynamic filtering
- Saved filter configurations
- Real-time sync with source assets
- Share Collections
- List view / Grid view
- Custom sort within Collection

### 7.3 Collection Operations
- Create Collection
- Add filter rules
- Add assets manually
- Share Collection
- Delete Collection

---

## 8. COMMENTS & ANNOTATIONS

### 8.1 Comment Types
| Type | Description |
|------|-------------|
| Single-frame | Timestamped to specific frame |
| Range-based | Spanning time range (in/out points) |
| Anchored | Pinned to specific screen location |
| Internal | Private to workspace members only |
| Public | Visible to all reviewers |

### 8.2 Comment Features
- Frame-accurate timestamp
- Pagestamp (for PDFs)
- Text body
- Emoji reactions
- @ mentions (user notifications)
- Hashtags (organization)
- Color hex codes (design reference)
- Attachments (images, videos, documents)
- Annotations (drawings, arrows, shapes)

### 8.3 Annotation Tools
- Free draw
- Line
- Arrow
- Rectangle
- Multiple colors
- Undo/redo

### 8.4 Comment Management
- Reply to comments
- Edit own comments
- Delete own comments
- Mark as complete
- Copy comment
- Paste comment
- Comment search
- Filter by hashtag
- Filter by user
- Filter by status
- Print comments
- Export comments (CSV, Plain Text, EDL)

### 8.5 Comment Panel
- Thread view
- Filter controls
- Sort options
- Quick actions
- Link to specific comment

---

## 9. PLAYER & VIEWER

### 9.1 Video Player Controls
- Play/Pause (Space, K)
- Scrub (drag timeline)
- Frame-by-frame (Left/Right arrows)
- JKL shuttle controls
- Playback speed (0.25x - 1.75x)
- Loop playback
- Full screen (F)
- Volume control
- Mute toggle

### 9.2 Playback Resolution
- Auto (adaptive)
- 360p
- 540p
- 720p
- 1080p
- 4K (Pro+)

### 9.3 Frame Guides
- Aspect ratio overlays
- Mask mode (hide outside guide)
- Multiple preset ratios

### 9.4 Image Viewer
- Zoom (up to 400%)
- Pan
- Fit to screen
- 1:1 pixel view
- Mini-map navigation

### 9.5 PDF Viewer
- Multi-page navigation
- Page thumbnails
- Zoom controls
- Page jump

### 9.6 Markdown Viewer
- Rendered Markdown with GFM support (tables, task lists, strikethrough)
- Syntax-highlighted code blocks
- Dark theme matching other viewers

### 9.7 Comparison Viewer
- Side-by-side asset comparison
- Linked zoom/playback
- Version comparison
- Independent controls toggle

### 9.7 Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Space | Play/Pause |
| J | Rewind (2x, 4x, 8x) |
| K | Pause |
| L | Fast forward (2x, 4x, 8x) |
| F | Fullscreen |
| Left Arrow | Previous frame |
| Right Arrow | Next frame |
| I | Set in point |
| O | Set out point |
| Escape | Exit range playback |

---

## 10. TRANSCRIPTION

### 10.1 Transcription Features
- AI-powered speech-to-text
- Automatic speaker identification
- Editable transcripts
- Searchable transcripts
- Time-coded text

### 10.2 Transcript Operations
- Generate transcript
- Edit transcript text
- Search transcript
- Navigate via transcript click

---

## 11. SHARES

### 11.1 Share Types
| Type | Access |
|------|--------|
| Public | Anyone with link |
| Secure | Specific email invites |

### 11.2 Share Layouts
| Layout | Description |
|--------|-------------|
| Grid | Thumbnail grid view |
| Reel | Sequential player view |

### 11.3 Share Settings
- Visibility toggle
- Passphrase protection
- Expiration date
- Comment permission
- Download permission
- Show all versions toggle
- Display transcription toggle
- Featured field selection
- Custom branding

### 11.4 Share Branding
- Custom logo
- Custom background image
- Header size options
- Light/dark mode
- Accent colors
- Custom description

### 11.5 Share Operations
- Create share
- Duplicate share
- Delete share
- Copy share link
- Send via email
- View share activity
- Track opens/views/comments/downloads

### 11.6 Share Notifications
- Invite notification
- Comment notification
- Reply notification
- @ mention notification

---

## 12. SEARCH

### 12.1 Standard Search
- Global search across account
- Search by filename
- Search by metadata
- Search by status
- Search by keywords
- Search by uploader
- Search by file type

### 12.2 Enhanced Search (Media Intelligence)
- Natural language processing
- Semantic understanding
- Visual search
- Search by transcript content

### 12.3 Search Results
- Instant results (no Enter required)
- Preview panel
- Relevance ranking
- Filter refinement

---

## 13. NOTIFICATIONS

### 13.1 In-App Notifications
- Project notifications toggle
- @ mention alerts
- Comment replies
- New uploads
- Status changes

### 13.2 Email Notifications
- Daily digest
- Immediate alerts
- Per-project settings
- Per-asset subscription

### 13.3 Push Notifications (iOS)
- @ mentions
- Comment replies
- New shares

---

## 14. STORAGE

### 14.1 Storage Tiers
| Plan | Storage |
|------|---------|
| Free | 2GB |
| Pro | 2TB + 2TB/member |
| Team | 3TB + 2TB/member |
| Enterprise | Custom |

### 14.2 Storage Connect
- Connect own AWS S3 bucket
- Primary bucket (read/write)
- Additional read-only buckets
- Bush proxies stored separately
- API asset registration

### 14.3 Asset Lifecycle Management 
- Automatic expiration
- Retention policies
- 30/60/90 day options
- Custom duration
- Workspace-level policies

---

## 15. SECURITY

### 15.1 Certifications
- SOC 2 Type 2
- TPN+ Gold Shield
- ISO 27001



### 15.4 Share Security
- Passphrase protection
- Expiration dates
- Disable downloads
- Disable comments
- Hide previous versions
- Secure sharing (invite-only)

---

## 16. CAMERA TO CLOUD (C2C)

### 16.1 Supported Hardware
- Atomos (CONNECT series)
- Teradek (Serv, Prism, Cube)
- RED (V-RAPTOR, KOMODO)
- Canon (C400, C80, select cameras)
- Fujifilm (select cameras)
- Panasonic LUMIX (select cameras)
- Nikon (select cameras)
- Leica (select cameras)
- Sound Devices (8 Series)
- Ambient (Lockit)
- Accsoon

### 16.2 Supported Apps
- Filmic Pro
- Mavis Camera
- Magic ViewFinder
- ZoeLog
- FilmDataBox
- Pomfort LiveGrade
- Viviana Cloud Box

### 16.3 C2C Features
- Automatic upload from set
- Metadata preservation
- Proxy generation
- Folder organization
- Real-time collaboration

---

## 17. INTEGRATIONS

### 17.1 Adobe Premiere Pro
- V4 Panel (25.6+)
- Comments Panel (25.2+)
- Timeline markers sync
- Direct upload
- Asset import
- Comment sync

### 17.2 Adobe Lightroom
- Direct upload from Lightroom
- C2C integration
- RAW file support

### 17.3 Final Cut Pro
- Comments as markers
- Timeline integration
- Direct upload

### 17.4 DaVinci Resolve
- EDL import for comments
- C2C workflow support

### 17.5 Media Composer (Avid)
- C2C workflow support

### 17.6 Automation Platforms
- Adobe Workfront Fusion
- Zapier
- Make (Integromat)
- Pipedream
- Pabbly Connect

### 17.7 Storage Integrations
- DNA Fabric
- AWS S3 (Storage Connect)

---

## 18. API (V4)

### 18.1 Authentication
- OAuth 2.0
- Adobe IMS integration
- Bearer token auth
- Token refresh

### 18.2 Rate Limiting
- Per-endpoint limits
- 10 req/min to 100 req/sec
- Leaky bucket algorithm
- x-ratelimit-* headers

### 18.3 Core Resources
- Accounts
- Workspaces
- Projects
- Folders
- Files
- Version Stacks
- Custom Fields
- Shares
- Users
- Comments
- Webhooks

### 18.4 File Upload Flow
1. Create file (POST) → placeholder + upload URLs
2. Upload chunks (PUT to pre-signed URLs)
3. System processes upload
4. File status updates

### 18.5 Pagination
- Cursor-based
- Default 50 items
- Max 100 items per page
- Include total count option

### 18.6 Response Format
```json
{
  "data": [...],
  "links": { "next": "..." },
  "total_count": 21
}
```

### 18.7 Error Format
```json
{
  "errors": [{
    "detail": "...",
    "source": { "pointer": "/data/foo" },
    "title": "Invalid value"
  }]
}
```

### 18.8 HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (deleted) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 5xx | Server Error |

### 18.9 SDKs
- TypeScript (npm i -s frameio)
- Python (pip install frameio)

---

## 19. MOBILE APPS

### 19.1 iOS/iPadOS App
- Native Swift development
- iPhone and iPad support
- Full review and approval
- Comment and annotate
- Upload media
- Share assets
- Push notifications
- Offline caching

### 19.2 iOS Features
- Adjustable thumbnail size
- Metadata display
- Pinch to zoom (400%)
- Playback speed control
- Resolution control
- Customizable skip interval
- Asset navigation

### 19.3 Apple TV App
- 4K 10-bit HDR viewing
- Big screen presentations
- Resolution controls
- Playback speed

### 19.4 Android
- No native app currently
- Web access via browser

---

## 20. DESKTOP APPS

### 20.1 Bush Transfer
- macOS (Apple Silicon)
- macOS (Intel)
- Windows
- Bulk upload/download
- Folder structure preservation
- Speed control
- Priority queue
- EDL/log file support

### 20.2 Bush Mac App
- Watch folders
- Auto-upload
- System integration


