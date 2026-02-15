# Bush Complete Support & Documentation Reference

---

# 1. ACCOUNT & AUTHENTICATION


## 1.2 Account Roles

### Account Owner
- One per account
- Full access to all features
- Billing and plan management
- Can only own one account

### Content Admin
- See all content in account
- Cannot update plans or billing
- Can manage users and projects

### Member/Guest
- Access to assigned Workspaces/Projects
- Manage own profile and notifications
- Require permission grants to resources

### Reviewer
- Non-registered user
- Access via secure share links
- Free (doesn't count toward seat limit)

## 1.3 Authentication Methods

| Method | Plan Required |
|--------|---------------|
| Email/Password | All plans |
| Google Sign-In | All plans |
| Apple ID | All plans |
| Adobe ID | All plans |

---

# 2. USER PERMISSIONS

## 2.1 Permission Levels

| Permission | Capabilities |
|------------|-------------|
| **Full Access** | All abilities - upload, manage, share, delete, download |
| **Edit & Share** | Upload, manage, share, comment, view, download |
| **Edit** | Same as Edit & Share WITHOUT share/download |
| **Comment Only** | Comment and view only |
| **View Only** | View only |

## 2.2 Permission Inheritance

- Workspace permissions cascade down to Projects
- Project permissions cascade to folders/assets
- **Cannot lower inherited permissions** (e.g., Full Access at workspace cannot be reduced at project level)
- **Restricted Projects** break inheritance chain

## 2.3 Restricted Projects

- Only visible to directly invited users
- Workspace members don't inherit access
- Account Owners and Content Admins retain access
- No limitations on who can be invited (except Guest 1-project limit)

## 2.4 Workspace Permissions Matrix

| Action | Owner/Admin | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|-------------|-------------|--------------|------|--------------|-----------|
| View Workspace | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create Projects | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create Restricted Projects | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Add Members | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete Workspace | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

## 2.5 Project Permissions Matrix

| Action | Owner/Admin | Full Access | Edit & Share | Edit | Comment Only | View Only |
|--------|-------------|-------------|--------------|------|--------------|-----------|
| Upload/Delete Assets | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Share Assets | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Download Assets | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Comment | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| View Assets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 2.6 External Share Permissions

| Action | Authenticated | Identified | Unidentified |
|--------|---------------|------------|--------------|
| View Assets | ✓ | ✓ | ✓ |
| Comment | ✓ (if enabled) | ✓ (if enabled) | ✓ (if enabled) |
| Download | ✓ (if enabled) | ✓ (if enabled) | ✓ (if enabled) |
| Share | ✗ | ✗ | ✗ |

---

# 3. WORKSPACE & PROJECT MANAGEMENT

## 3.1 Hierarchy

```
Account
├── Workspace
│   ├── Project
│   │   ├── Folder
│   │   │   ├── Asset
│   │   │   └── Version Stack
│   │   └── Asset
│   └── Project
└── Workspace
```

## 3.2 Workspace Overview

- Multiple private Workspaces
- Per-client isolation
- Department separation
- Brand-specific Workspaces
- Workspace-level user management

## 3.3 Project Settings

| Setting | Description |
|---------|-------------|
| Name | Project title |
| Logo/Icon | Custom visual identifier |
| Notifications | Toggle on/off |
| Asset Lifecycle | Enable/disable auto-delete |
| Active/Inactive | Archive status |

## 3.4 Active vs Inactive Projects

- **Active**: Normal visibility in workspace
- **Inactive**: Filtered from default view, archived state
- Inactive projects can be reactivated
- All data preserved in either state

---

# 4. FILE MANAGEMENT

## 4.1 Upload Methods

| Method | Platform | Features |
|--------|----------|----------|
| Web Browser | Web | Drag-drop, bulk upload |
| Transfer App | Mac/Windows | Large files, EDL support |
| Camera to Cloud | Hardware | Automatic from set |
| iOS App | iPhone/iPad | Camera roll import |
| Adobe Panel | Premiere/AE | Direct export |
| API | Integration | Programmatic upload |

## 4.2 Upload Specifications

| Specification | Limit |
|---------------|-------|
| Max file size | 5TB |
| Max concurrent uploads | 10 |
| Max assets per upload | 500 |
| Max folders per upload | 250 |
| Bulk operation limit | 200 assets |

## 4.3 Supported File Types

### Video Formats
| Format | Codecs |
|--------|--------|
| 3GPP/3GPP2 | H263, MPEG-4 |
| AVI | MJPEG, MPEG4 |
| FLV | FLV1 |
| MKV | H264/AVC |
| MOV | H264/AVC, H265/HEVC, MJPEG, ProRes |
| MP4 | H264/AVC, H265/HEVC |
| MXF | DNxHD, JPEG2000, ProRes |
| WebM | VP8 |
| WMV | WMV2 |

### Audio Formats
- AAC
- AIFF (PCM)
- FLAC
- M4A (AAC, MPEG)
- MP3 (MPEG)
- OGG (Vorbis)
- WAV (PCM)
- WMA (wmav2)

### Image Formats
- RAW: 3fr, arw, cr2, cr3, crw, mrw, nef, orf, pef, raf, rw2, sr2, srf, srw
- Standard: BMP, EXR, GIF, HEIC, JPG, PNG, TGA, TIFF, WebP
- Adobe: AI, EPS, INDD, PSD

### Document Formats
- PDF (multi-page)
- DOCX/DOC (MS Word)
- PPTX/PPT (MS PowerPoint)
- XLSX/XLS (MS Excel)
- Interactive ZIP (HTML)

## 4.4 Asset Conversion

| Output | Purpose |
|--------|---------|
| Thumbnail | Grid view preview |
| Hover scrub | Timeline preview |
| Proxy (360p-4K) | Streaming playback |
| Audio waveform | Timeline visualization |

## 4.5 Version Stacking

- Drag new version onto existing asset
- Automatic version numbering
- View all versions in stack
- Compare versions
- Download specific version
- Comments persist across versions

## 4.6 Asset Operations

| Operation | Description |
|-----------|-------------|
| Copy To | Duplicate to another location |
| Move To | Relocate asset |
| Delete | Move to Recently Deleted |
| Recover | Restore from trash (30 days) |
| Download | Original or proxy |
| Set Thumbnail | Custom preview image |
| Reset Lifecycle | Restart auto-delete timer |

---

# 5. FOLDER MANAGEMENT

## 5.1 Folder Types

| Type | Visibility |
|------|------------|
| Standard | All project members |
| Restricted | Invite-only access |

## 5.2 Restricted Folders

- Invite-only access
- Breaks permission inheritance
- Visible only to invited users + Admins
- Team+ feature

## 5.3 Folder Operations

- Create nested folders
- Rename
- Move
- Copy
- Delete
- Flatten folders view (display option)

---

# 6. METADATA SYSTEM

## 6.1 Built-in Metadata Fields (33 fields)

### Video/Audio Technical
- Alpha Channel
- Audio Bit Depth
- Audio Bit Rate
- Audio Codec
- Bit Depth
- Bit Rate
- Channels
- Color Space
- Duration
- Dynamic Range
- End Time
- Frame Rate
- Resolution - Height
- Resolution - Width
- Sample Rate
- Start Time
- Video Bit Rate
- Video Codec

### File Information
- Date Uploaded
- File Size
- File Type
- Format
- Page Count
- Source Filename

### Collaboration
- Assignee
- Comment Count
- Keywords
- Notes
- Rating (1-5)
- Seen By
- Status
- Transcript
- Uploader

## 6.2 Custom Metadata Fields (10 types)

| Type | Use Case |
|------|----------|
| Single-line text | Names, titles |
| Multi-line text | Descriptions |
| Number | Quantities |
| Date | Deadlines |
| Single-select | Status dropdown |
| Multi-select | Tags |
| Checkbox | Yes/No |
| User reference | Assignments |
| URL | Links |
| Rating | Stars (1-5) |

## 6.3 Metadata Features

### Account-Wide Metadata
- Metadata travels with assets
- Preserved on copy/move/duplicate
- Single field definition, multiple uses

### Field Management Tab (Admins)
- View all custom fields
- Show/hide fields
- Edit field settings
- Delete fields
- Manage project visibility

### Field Permissions
- **Admins Only**: Only admins can create/edit
- **Admins & Full Access**: Both can create/edit

## 6.4 Appearance Options

| Option | Values |
|--------|--------|
| Layout | Grid, List |
| Card Size | Small, Medium, Large |
| Aspect Ratio | 16:9, 1:1, 9:16 |
| Thumbnail Scale | Fit/Fill |
| Show Card Info | Toggle |
| Flatten Folders | Toggle |

---

# 7. COLLECTIONS

## 7.1 Collection Types

| Type | Visibility |
|------|------------|
| Team Collection | All project members |
| Private Collection | Creator only |

## 7.2 Collection Features

- Dynamic filtering with saved rules
- Real-time sync with source assets
- Share Collections externally
- Custom sort within Collection
- List or Grid view

## 7.3 Use Cases

- Marketing deliverables by platform
- Auditions by role (4+ stars)
- Assets by status
- Custom review sets

---

# 8. COMMENTS & ANNOTATIONS

## 8.1 Comment Types

| Type | Description |
|------|-------------|
| Single-frame | Timestamped to specific frame |
| Range-based | Spans time range (in/out points) |
| Anchored | Pinned to screen location |
| Internal | Private to workspace members |
| Public | Visible to all reviewers |

## 8.2 Comment Features

- Frame-accurate timestamp
- Pagestamp (PDFs)
- Text body with formatting
- Emoji reactions
- @ mentions (notifications)
- Hashtags (organization)
- Color hex codes (design reference)
- Attachments (images, videos, documents)
- Annotations (drawings, shapes)

## 8.3 Annotation Tools

- Free draw
- Line
- Arrow
- Rectangle
- Multiple colors
- Undo/redo

## 8.4 Comment Management

| Action | Description |
|--------|-------------|
| Reply | Threaded responses |
| Edit | Modify own comments |
| Delete | Remove own comments |
| Mark Complete | Track resolution |
| Copy | Duplicate comment |
| Paste | Apply to another asset |
| Filter | By hashtag, user, status |
| Print | Document-style output |
| Export | CSV, Plain Text, EDL |

## 8.5 Comment Permissions

| Action | Owner/Admin | Full Access | Edit | Comment Only | View Only |
|--------|-------------|-------------|------|--------------|-----------|
| Create Comment | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit Own | ✓ | ✓ | ✓ | ✓ | ✗ |
| Delete Own | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit Any | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Any | ✓ | ✓ | ✗ | ✗ | ✗ |

## 8.6 Attachments

- Max 6 attachments per comment
- Supported: images, videos, audio, PDFs
- Preview in comments
- Pro+ feature

---

# 9. PLAYER & VIEWER

## 9.1 Video Player Controls

| Control | Keyboard |
|---------|----------|
| Play/Pause | Space, K |
| Frame back | Left Arrow |
| Frame forward | Right Arrow |
| Rewind (2x, 4x, 8x) | J |
| Fast forward (2x, 4x, 8x) | L |
| Full screen | F |
| Set in point | I |
| Set out point | O |
| Loop range | Toggle |
| Volume | Up/Down Arrow |
| Mute | M |

## 9.2 Playback Resolution

- Auto (adaptive)
- 360p
- 540p
- 720p
- 1080p
- 4K

## 9.3 JKL Shuttle Controls

| Key | Speed |
|-----|-------|
| J | 2x → 4x → 8x reverse |
| K | Pause |
| L | 2x → 4x → 8x forward |

## 9.4 Frame Guides

- Aspect ratio overlays
- Mask mode (hide outside guide)
- Preset ratios (16:9, 4:3, 1:1, etc.)

## 9.5 Image Viewer

- Zoom up to 400%
- Pan navigation
- Fit to screen
- 1:1 pixel view
- Mini-map for large images

## 9.6 PDF Viewer

- Multi-page navigation
- Page thumbnails
- Zoom controls
- Page jump
- Text markups

## 9.7 Comparison Viewer

- Side-by-side comparison
- Linked zoom/playback
- Version comparison
- Independent controls toggle

## 9.8 Keyboard Shortcuts (Global)

| Action | Mac | Windows |
|--------|-----|---------|
| In-project search | ⌘F | Ctrl+F |
| Quick-search | ⌘K | Ctrl+K |
| Select all | ⌘A | Ctrl+A |
| Deselect all | ⌘⇧A | Ctrl+Shift+A |
| Delete | Delete | Delete |
| Download | ⌘D | Ctrl+D |
| Share | ⌘⇧S | Ctrl+Shift+S |

---

# 10. TRANSCRIPTION

## 10.1 Supported Languages (27)

Arabic, Cantonese/Traditional Chinese, Czech, Danish, Dutch, English (US/UK), French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Mandarin/Simplified Chinese, Mandarin/Traditional Chinese, Norwegian, Polish, Portuguese, Russian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese

## 10.2 Transcription Features

| Feature | Description |
|---------|-------------|
| Auto-detect language | Automatic language identification |
| Speaker ID | Identify individual speakers |
| Editable transcripts | Modify text inline |
| Search transcript | Find specific words |
| Time-synced | Text highlights during playback |
| Auto-scroll | Follow along during playback |
| Caption export | SRT, VTT, TXT |

## 10.3 Caption Ingest

- Upload SRT/VTT files
- Multiple caption tracks
- Language selection
- Frame-generated vs ingested labels

## 10.4 Transcription Permissions

| Action | Owner/Admin | Full Access | Edit | Comment Only | View Only |
|--------|-------------|-------------|------|--------------|-----------|
| Generate | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete | ✓ | ✓ | ✓ | ✗ | ✗ |
| View | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit | ✓ | ✓ | ✓ | ✗ | ✗ |

## 10.5 Speaker Label Consent

- Explicit consent required
- US users in Texas & Illinois cannot use (legal restrictions)
- "I Agree" to bypass for future transcripts

---

# 11. SHARES

## 11.1 Share Types

| Type | Access | Plan |
|------|--------|------|
| Public | Anyone with link | All  |
| Secure | Specific email invites | All  |

## 11.2 Share Layouts

| Layout | Description |
|--------|-------------|
| Grid | Thumbnail grid, individual viewers |
| Reel | Sequential single player |
| Open in Viewer | Single asset bypasses landing |

## 11.3 Share Settings

### Security
- Passphrase protection
- Expiration date/time

### Permissions
- Allow comments
- Allow downloads
- Show all versions
- Display transcriptions/captions

### Featured Field
- Default field editable by recipients
- Updates sync to project

## 11.4 Custom Branding

| Element | Options |
|---------|---------|
| Icon | Emoji or custom image |
| Header | Size, visibility |
| Background | Custom image |
| Description | Text below creator name |
| Appearance | Light/dark mode |
| Accent Colors | Custom palette |
| Thumbnail Display | Various options |

## 11.5 Share Activity

Trackable actions:
- Opened Share Link
- Viewed Asset
- Commented
- Downloaded

## 11.6 Share Notifications

Reviewers receive emails for:
- Invite to new share
- Comment created (on their commented assets)
- Reply created (on their comments)
- @ mention

---

# 12. SEARCH

## 12.1 Standard Search

- Global search across account
- Search by filename
- Search by metadata
- Search by status
- Search by keywords
- Search by uploader
- Search by file type

## 12.2 Enhanced Search (Media Intelligence)

- Natural language processing
- Semantic understanding
- Visual search
- Transcript search
- Instant results (no Enter required)
- Preview panel

## 12.3 Search Results

- Relevance ranking
- Thumbnail previews
- File info display
- Filter refinement

---

# 13. NOTIFICATIONS

## 13.1 In-App Notifications

- @ mentions
- Comment replies
- New uploads
- Status changes
- Share activity
- Per-project toggle

## 13.2 Email Notifications

- Daily digest option
- Immediate alerts
- Per-project settings
- Per-asset subscription

## 13.3 Push Notifications (iOS)

- @ mentions
- Comment replies
- New shares

---

# 14. STORAGE


## 14.2 Storage Connect

- Connect own AWS S3 bucket
- Primary bucket (read/write)
- Additional read-only buckets
- Bush stores proxies separately
- API asset registration


### Asset Lifecycle Features
- Clock icon on expiring assets
- Hover shows days remaining
- Reset lifecycle option
- 30-day recovery after deletion

---

# 15. SECURITY

## 15.1 Certifications

- SOC 2 Type 2
- TPN+ Gold Shield
- ISO 27001


---

# 16. CAMERA TO CLOUD (C2C)

## 16.1 Supported Hardware

| Manufacturer | Models |
|--------------|--------|
| Atomos | CONNECT series |
| Teradek | Serv, Prism, Cube |
| RED | V-RAPTOR, KOMODO |
| Canon | C400, C80, select cameras |
| Fujifilm | Select cameras |
| Panasonic | LUMIX select cameras |
| Nikon | Select cameras |
| Leica | Select cameras |
| Sound Devices | 8 Series |
| Ambient | Lockit |
| Accsoon | Select devices |

## 16.2 Supported Apps

- Filmic Pro
- Mavis Camera
- Magic ViewFinder
- ZoeLog
- FilmDataBox
- Pomfort LiveGrade
- Viviana Cloud Box

## 16.3 C2C Features

- Automatic upload from set
- Metadata preservation
- Proxy generation
- Date-based folder organization
- Real-time collaboration
- 4K/HDR support (plan dependent)

## 16.4 C2C Settings

- Device authorization
- Timezone adjustment
- Project selection
- Upload quality settings

---

# 17. INTEGRATIONS

## 17.1 Adobe Premiere Pro

### V4 Panel (25.6+)
- Browse Workspaces/Projects
- Import media directly
- Upload sequences
- Manage versions
- Real-time comment sync to markers

### Comments Panel (25.2+)
- Comment viewing
- Timeline marker sync
- Basic asset access

## 17.2 Other Adobe Apps

| App | Integration |
|-----|-------------|
| After Effects | Panel |
| Lightroom | C2C upload |
| Workfront | Workflow automation |

## 17.3 NLE Integrations

| App | Features |
|-----|----------|
| Final Cut Pro | Comments as markers, EDL import |
| DaVinci Resolve | EDL comment import |
| Media Composer | C2C workflow |

## 17.4 Automation Platforms

- Adobe Workfront Fusion
- Zapier
- Make (Integromat)
- Pipedream
- Pabbly Connect

---

# 18. MOBILE APPS

## 18.1 iOS/iPadOS App

### Requirements
- iOS/iPadOS 17.0+
- iPhone/iPad compatible

### Features
- Asset navigation
- Commenting and player page
- File upload
- Image viewer
- Asset sharing
- Asset download
- Move/copy operations
- Push notifications
- Restricted/inactive project support

### iOS Settings
- Thumbnail size adjustment
- Metadata display
- Pinch to zoom (400%)
- Playback speed control
- Resolution control
- Skip interval customization

## 18.2 Apple TV App

- 4K 10-bit HDR viewing
- Big screen presentations
- Resolution controls
- Playback speed

## 18.3 Android

- No native app
- Web access via browser

---

# 19. DESKTOP APPS

## 19.1 Bush Transfer

### Supported Platforms
- macOS (Apple Silicon)
- macOS (Intel)
- Windows

### Features
- Bulk upload/download
- Folder structure preservation
- Speed control
- Priority queue
- EDL/log file support
- Large file support (5TB+)

### Requirements
- Windows 7+
- macOS 10.15 (Catalina)+

## 19.2 Bush Mac App

- Watch folders
- Auto-upload
- System integration
- macOS 11.0 (Big Sur)+

---

# 20. SYSTEM REQUIREMENTS

## 20.1 Web App

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Browser | Latest 2 versions of Chrome, Safari, Firefox, Edge | Latest Chrome, Safari |
| OS | Windows, macOS, Chrome OS | Windows 10 (64-bit)+, macOS 11+ |
| RAM | 4GB | 8GB+ |

## 20.2 Adobe Panel

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Premiere Pro | CC 2019 (13.0) | CC 2022 (22.3)+ |
| After Effects | CC 2018 (15.0) | CC 2022 (22.3)+ |
| OS | Windows, macOS | Windows 10+, macOS 10.15+ |

## 20.3 iOS App

| Component | Requirement |
|-----------|-------------|
| iPhone | iOS 17.0+ |
| iPad | iPadOS 17.0+ |

## 20.4 Mac App

- macOS 11.0 (Big Sur)+

## 20.5 Bush Transfer

- Windows 7+
- macOS 10.15 (Catalina)+

---

# 21. API (V4)

## 21.1 Authentication

- OAuth 2.0
- Adobe IMS integration
- Bearer token
- Token refresh

## 21.2 Rate Limiting

| Level | Rate |
|-------|------|
| Standard | 10 req/min |
| High | 100 req/sec |

Headers: `x-ratelimit-*`

## 21.3 Pagination

- Cursor-based
- Default: 50 items
- Max: 100 items per page
- Optional total count

## 21.4 Response Format

```json
{
  "data": [...],
  "links": { "next": "..." },
  "total_count": 21
}
```

## 21.5 Error Format

```json
{
  "errors": [{
    "detail": "Error message",
    "source": { "pointer": "/data/field" },
    "title": "Error Title"
  }]
}
```

## 21.6 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |




