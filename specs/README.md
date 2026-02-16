# Bush Complete Specifications

---

Important note: some features are marked "Phase 2". They have to be implemented in Phase 2. The IMPLEMENTATION_PLAN.md should be updated accordingly. However, if one or several of these features are blocking for implementation, they should loose their Phase 2 labelling.
---

## Specification Files

### Master Reference Documents

Those 2 files need to be critiqued and updated, according the planning process.
In a broader extend, all files need to be critiqued and updated, according the planning process.

| File | Description |
|------|-------------|
| [00-complete-support-documentation.md](./00-complete-support-documentation.md) | **COMPREHENSIVE support documentation (23 sections)** |
| [00-atomic-features.md](./00-atomic-features.md) | Atomic feature breakdown (22 categories, 300+ features) |

### Category Summaries
| File | Description |
|------|-----------|
| [01-overview.md](./01-overview.md) | Platform overview, value propositions |
| [02-workflow-management.md](./02-workflow-management.md) | Workspaces, projects, folders |
| [03-file-management.md](./03-file-management.md) | Upload, transfer, organization |
| [04-review-and-approval.md](./04-review-and-approval.md) | Comments, annotations, viewer |
| [05-sharing-and-presentations.md](./05-sharing-and-presentations.md) | Shares, branding, permissions |
| [06-transcription-and-captions.md](./06-transcription-and-captions.md) | AI transcription, captions |
| [07-camera-to-cloud.md](./07-camera-to-cloud.md) | C2C hardware/software integrations |
| [08-ios-ipad-apps.md](./08-ios-ipad-apps.md) | iOS, iPadOS, Apple TV apps |
| [09-transfer-app.md](./09-transfer-app.md) | Desktop transfer app |
| [10-integrations.md](./10-integrations.md) | Adobe, NLE, automation integrations |
| [11-security-features.md](./11-security-features.md) | Security |
| [12-authentication.md](./12-authentication.md) | Authentication (WorkOS AuthKit) |
| [14-realtime-collaboration.md](./14-realtime-collaboration.md) | Real-time collaboration (WebSocket, presence, events) |
| [15-media-processing.md](./15-media-processing.md) | FFmpeg pipeline, transcoding, thumbnails |
| [16-storage-and-data.md](./16-storage-and-data.md) | Storage and data |
| [17-api-complete.md](./17-api-complete.md) | Complete API reference (V4) |
| [20-configuration-and-secrets.md](./20-configuration-and-secrets.md) | Configuration, secrets management, local dev setup |

### Deferred Specifications
| File | Description | Phase |
|------|-----------|-------|
| 13-billing-and-plans.md | Pricing, plan tiers, feature gating | Phase 5 |
| 18-mobile-complete.md | iOS/Android detailed specs | Phase 4 |
| 19-accessibility.md | WCAG compliance, keyboard nav, screen readers | Phase 3+ |

---

## Technology Stack Choices

These are source of truth -- documentation stating otherwise need to be updated accordingly.

| Category | Choice | Notes |
|----------|--------|-------|
| **Frontend (Web)** | Next.js + TypeScript | SSR, routing, API routes |
| **Frontend (Mobile)** | Native Swift | iOS/iPadOS/Apple TV (Phase 2) |
| **Desktop Transfer App** | Tauri | Phase 2 — webapp is standard upload path |
| **Backend API** | Bun + Hono + TypeScript | RESTful V4 API, WebSockets, OAuth 2.0 |
| **Database** | SQLite + Drizzle ORM | Primary relational store, type-safe schema-as-code |
| **Cache / Realtime** | Redis | Caching, sessions, rate limiting, pub/sub |
| **Search** | SQLite FTS5 | Upgrade path to dedicated engine if needed |
| **Object Storage** | S3-compatible API | Provider-agnostic; MinIO for dev, R2/B2/S3 for prod |
| **CDN** | TBD (preference: Bunny CDN) | CDN-agnostic abstraction |
| **Media Processing** | FFmpeg | Transcoding, thumbnails, filmstrips, waveforms |
| **Message Queue** | BullMQ + Redis | Async jobs: transcoding, transcription, notifications |
| **Transcription** | TBD (abstracted interface) | 27 languages, speaker ID — provider chosen later |
| **AI/ML (Vision)** | TBD | Visual search / Media Intelligence |
| **Deployment** | TBD | No Docker, no Kubernetes |
| **Authentication** | WorkOS AuthKit | Email/password, social login, MFA, SSO-ready |
| **CI/CD** | GitHub Actions | |

---

## Quick Reference


### Hierarchy
```
Account → Workspace → Project → Folder → [File | Version Stack | Folder]
```


### User Permission Levels
| Level | Capabilities |
|-------|-------------|
| Full Access | All abilities |
| Edit & Share | Upload, manage, share, download, comment |
| Edit | Edit & Share minus share/download |
| Comment Only | Comment and view |
| View Only | View only |

### Account Roles
| Role | Scope |
|------|-------|
| Account Owner | Full account access, billing |
| Content Admin | All content, no billing |
| Member | Granted workspace/project access |
| Guest | Limited (1 project max) |
| Reviewer | Share link access only |

### Built-in Metadata Fields (33)
| Category | Fields |
|----------|--------|
| Technical | Alpha Channel, Bit Rate, Codec, Color Space, Duration, Frame Rate, Resolution |
| File Info | Date Uploaded, File Size, File Type, Format, Source Filename |
| Collaboration | Assignee, Comment Count, Keywords, Notes, Rating, Status, Uploader |

### Custom Metadata Types (10)
Single-line text, Multi-line text, Number, Date, Single-select, Multi-select, Checkbox, User reference, URL, Rating

### Supported File Formats
**Video**: 3GPP, AVI, FLV, MKV, MOV, MP4, MXF, WebM, WMV
**Audio**: AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA
**Image**: RAW (15+ formats), BMP, EXR, GIF, HEIC, JPG, PNG, TIFF, WebP
**Document**: PDF, DOCX, PPTX, XLSX, Interactive ZIP


### C2C Hardware Partners
- Atomos, Teradek, RED, Canon, Fujifilm, Panasonic, Nikon, Leica
- Sound Devices, Ambient, Accsoon

### C2C Software Partners
- Filmic Pro, Mavis Camera, Magic ViewFinder, ZoeLog, Pomfort LiveGrade

### System Requirements
| Platform | Minimum |
|----------|---------|
| Web | Chrome/Safari/Firefox (latest 2), 4GB RAM |
| Adobe Panel | Premiere/AE CC 2019+ |
| iOS | iOS 17.0+ |
| Mac | macOS 11.0+ |
| Transfer | Win7+, macOS 10.15+ |

### API Versions
- **V4** (Current) - RESTful, OAuth 2.0, cursor pagination
- **V2** (Legacy) - Deprecated

### Security Certifications
- SOC 2 Type 2
- TPN+ Gold Shield
- ISO 27001



## Other projects worth studying

[reference-projects.md](./reference-projects.md)
