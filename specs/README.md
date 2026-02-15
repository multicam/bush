# Bush Complete Specifications

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
| [11-security-features.md](./11-security-features.md) | Security, DRM |

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




