# Frame.io Complete Specifications

## Overview

Frame.io is a cloud-based creative collaboration platform for video, photo, design, and marketing teams. This spec directory contains exhaustive documentation extracted from:
- Main website (frame.io)
- Help documentation (help.frame.io) - **150+ articles**
- Developer API (developer.frame.io)

---

## Specification Files

### Master Reference Documents
| File | Description |
|------|-------------|
| [00-complete-support-documentation.md](./00-complete-support-documentation.md) | **COMPREHENSIVE support documentation (23 sections)** |
| [00-atomic-features.md](./00-atomic-features.md) | Atomic feature breakdown (22 categories, 300+ features) |

### Category Summaries
| File | Description |
|------|-------------|
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
| [11-security-features.md](./11-security-features.md) | Security, watermarking, DRM |
| [12-pricing-plans.md](./12-pricing-plans.md) | All pricing tiers |
| [13-customer-success.md](./13-customer-success.md) | Case studies, ROI metrics |

---

## Quick Reference

### Help Documentation Collections

| Collection | Articles | Topics |
|------------|----------|--------|
| Upload and Organize | 22 | Account, Projects, Metadata, Files |
| Collaboration and Playback | 21 | Users, Sharing, Comments, Player |
| Integrations | 28 | Adobe, iOS, Mac, Transfer, Partners |
| Enterprise | 23 | SSO, Watermarking, DRM, Storage |
| Account Settings | 11 | Billing, Notifications, Branding |
| Frame.io C2C | 29 | Hardware, Apps, Training |
| **Total** | **~150+** | |

### Hierarchy
```
Account → Workspace → Project → Folder → [File | Version Stack | Folder]
```

### Pricing Summary
| Plan | Price | Members | Storage | Key Features |
|------|-------|---------|---------|--------------|
| Free | $0 | 2 | 2GB | C2C, Transcription, Basic features |
| Pro | $15/mo | 5 | 2TB | Custom branding, Watermarking, In-app chat |
| Team | $25/mo | 15 | 3TB | Internal comments, Restricted projects |
| Enterprise | Custom | Custom | Custom | SSO, DRM, Forensic watermarking, Storage Connect |

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

### Watermarking Types
| Type | Plan | Features |
|------|------|----------|
| Static | Pro+ | Text overlay, position, opacity |
| Session-Based | Enterprise Prime | Email, IP, geolocation, timestamp |
| Forensic | Enterprise Prime | Invisible, traceable identifiers |

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

---

## Feature Count Summary

| Category | Atomic Features |
|----------|-----------------|
| Account & Authentication | 15 |
| Workspace Management | 10 |
| User Management | 20 |
| File Management | 30 |
| Folder Management | 10 |
| Metadata System | 45 |
| Collections | 10 |
| Comments & Annotations | 40 |
| Player & Viewer | 30 |
| Transcription | 20 |
| Shares | 30 |
| Search | 15 |
| Notifications | 12 |
| Storage | 10 |
| Security | 25 |
| Camera to Cloud | 25 |
| Integrations | 40 |
| API | 20 |
| Mobile Apps | 20 |
| Desktop Apps | 10 |
| Enterprise | 20 |
| Support | 10 |
| **TOTAL** | **450+** |

---

## Images Directory

```
specs/images/
├── main/           # 15 website screenshots (~32MB)
├── features/       # 14 feature page images (~50MB)
├── help/           # 2 help screenshots (~4MB)
└── help_docs/      # 29 help doc images (~varies)
```

---

## Source URLs

- Main: https://frame.io/
- Help: https://help.frame.io/en/
- API Docs: https://next.developer.frame.io/
- Status: https://status.frame.io/
- Blog: https://blog.frame.io/

---

## Download Scripts

| Script | Purpose |
|--------|---------|
| `download_images.py` | Main website & features images |
| `download_help_images.py` | Help documentation images |

---

*Generated: 2025-02-15*
*Sources: frame.io, help.frame.io (150+ articles), developer.frame.io*
*Images: 60+ downloaded*
