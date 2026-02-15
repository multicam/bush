# Frame.io Complete Specifications

## Overview

Frame.io is a cloud-based creative collaboration platform for video, photo, design, and marketing teams. This spec directory contains exhaustive documentation of all features extracted from:
- Main website (frame.io)
- Help documentation (help.frame.io)
- Developer API (developer.frame.io)

**Key Metrics:**
- 2.9x faster creative workflows
- 2.7x faster review and approval (Pfeiffer Report)
- 31% reduction in review churn (IDC)

---

## Specification Files

### Master Reference
| File | Description |
|------|-------------|
| [00-atomic-features.md](./00-atomic-features.md) | **COMPLETE atomic breakdown of ALL 22 feature categories** |

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

### Supported Platforms
- Web (Chrome, Firefox, Safari, Edge)
- iOS/iPadOS (native Swift)
- Apple TV (4K HDR)
- macOS (Transfer app, Mac app)
- Windows (Transfer app)
- Adobe Premiere Pro (panel)
- Adobe Lightroom (C2C)
- Final Cut Pro

### Security Certifications
- SOC 2 Type 2
- TPN+ Gold Shield
- ISO 27001

### Watermarking Types
| Type | Plan | Features |
|------|------|----------|
| Static | Pro+ | Text/logo overlay |
| Session-Based | Enterprise Prime | Email, IP, geolocation |
| Forensic | Enterprise Prime | Invisible, traceable |

### C2C Hardware Partners
- Atomos, Teradek, RED, Canon, Fujifilm, Panasonic, Nikon, Leica
- Sound Devices, Ambient, Accsoon

### API Versions
- **V4** (Current) - RESTful, OAuth 2.0, cursor pagination
- **V2** (Legacy) - Deprecated

### SDKs
- TypeScript: `npm i -s frameio`
- Python: `pip install frameio`

---

## Feature Count Summary

| Category | Atomic Features |
|----------|-----------------|
| Account & Authentication | 12 |
| Workspace Management | 8 |
| User Management | 10 |
| File Management | 25 |
| Folder Management | 10 |
| Metadata System | 40+ |
| Collections | 8 |
| Comments & Annotations | 30+ |
| Player & Viewer | 25+ |
| Transcription | 6 |
| Shares | 20+ |
| Search | 10+ |
| Notifications | 10 |
| Storage | 8 |
| Security | 20+ |
| Camera to Cloud | 20+ |
| Integrations | 30+ |
| API | 15 endpoints |
| Mobile Apps | 15+ |
| Desktop Apps | 8 |
| Enterprise | 15+ |
| Support | 6 |
| **TOTAL** | **300+** |

---

## Source URLs

- Main: https://frame.io/
- Pricing: https://frame.io/pricing
- What's New: https://frame.io/whats-new
- Resources: https://frame.io/resources
- Integrations: https://frame.io/integrations
- Enterprise: https://frame.io/enterprise
- Help: https://help.frame.io/en/
- API Docs: https://next.developer.frame.io/
- Status: https://status.frame.io/
- Blog: https://blog.frame.io/

---

## Directory Structure

```
specs/
├── 00-atomic-features.md      # Complete atomic breakdown
├── 01-overview.md
├── 02-workflow-management.md
├── 03-file-management.md
├── 04-review-and-approval.md
├── 05-sharing-and-presentations.md
├── 06-transcription-and-captions.md
├── 07-camera-to-cloud.md
├── 08-ios-ipad-apps.md
├── 09-transfer-app.md
├── 10-integrations.md
├── 11-security-features.md
├── 12-pricing-plans.md
├── 13-customer-success.md
├── README.md                  # This file
└── images/                    # UI screenshots (to be populated)
```

---

*Generated: 2025-02-15*
*Sources: frame.io, help.frame.io, developer.frame.io*
