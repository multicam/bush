# Bush Complete Specifications

Bush is a professional media review and collaboration platform for video, audio, and image assets.

---

**Current Phase**: MVP Complete (specs last refactored 2026-02-27)

| Metric | Count |
|--------|-------|
| API Endpoints | 136 across 18 route modules |
| Database Tables | 27 with proper indexes |
| Tests | 81 test files |
| Frontend Components | 52 TSX components |
| Web Pages | 16 Next.js pages |

---

## Specification Files

### Product

| File | Description |
|------|-------------|
| [00-product-reference.md](./00-product-reference.md) | Complete feature catalogue — 22 categories, 300+ features, phase tags |

### Technical

| File | Description |
|------|-------------|
| [01-data-model.md](./01-data-model.md) | Entity relationships, constraints, cascade rules, soft-delete |
| [02-authentication.md](./02-authentication.md) | WorkOS AuthKit, session management, auth provider abstraction |
| [03-permissions.md](./03-permissions.md) | Roles, permission levels, inheritance, share access tiers |
| [04-api-reference.md](./04-api-reference.md) | Complete V4 REST API — endpoints, pagination, rate limiting |
| [05-realtime.md](./05-realtime.md) | WebSocket events, presence, live cursors, scaling path |
| [06-storage.md](./06-storage.md) | Storage provider interface, CDN, upload flows, backups |
| [07-media-processing.md](./07-media-processing.md) | FFmpeg pipeline, transcoding, thumbnails, abstract worker |
| [08-transcription.md](./08-transcription.md) | Deepgram/whisper provider abstraction, captions, export |
| [09-search.md](./09-search.md) | FTS5 architecture, scoped search, indexing pipeline |
| [10-notifications.md](./10-notifications.md) | Presence-aware delivery, email suppression, preferences |
| [11-email.md](./11-email.md) | Plain-text transactional email, provider abstraction |
| [12-security.md](./12-security.md) | Content security, audit logging, encryption, compliance targets |
| [13-billing.md](./13-billing.md) | Usage-based billing, storage + processing meters, soft-block |
| [14-conventions.md](./14-conventions.md) | Error handling, ID generation, code patterns, testing |
| [15-frontend-testing.md](./15-frontend-testing.md) | E2E (Playwright), component tests, accessibility, visual regression |

### Design

| File | Description |
|------|-------------|
| [20-design-foundations.md](./20-design-foundations.md) | Tokens, colors, typography, spacing, motion, layout |
| [21-design-components.md](./21-design-components.md) | Components, patterns, keyboard shortcuts, share pages |

### Configuration

| File | Description |
|------|-------------|
| [30-configuration.md](./30-configuration.md) | All env vars, secrets management, local dev setup |

---

## Technology Stack

Source of truth for technology choices. Documentation stating otherwise should be updated.

| Role | Current Choice | Notes |
|------|---------------|-------|
| Frontend (Web) | Next.js + TypeScript | SSR, routing, API routes |
| Frontend (Mobile) | Native Swift | iOS/iPadOS/Apple TV (Phase 2) |
| Desktop Transfer | Tauri | Phase 2 — web upload is the standard path |
| Backend API | Bun + Hono + TypeScript | Bun.serve(), RESTful V4, native WebSocket, OAuth 2.0 |
| Database | SQLite (`bun:sqlite`) + Drizzle ORM | WAL mode, type-safe schema-as-code |
| Cache | Redis | Caching, sessions, rate limiting |
| Realtime | Bun native WebSocket + EventEmitter | MVP: in-process; scaling path: Redis pub/sub → dedicated WS service |
| Search | SQLite FTS5 | Upgrade path to dedicated engine when needed |
| Object Storage | S3-compatible interface | MinIO for dev, Cloudflare R2 for prod (free egress) |
| CDN | CDN-agnostic interface | Bunny CDN current; CloudFront/Fastly for future |
| Media Processing | FFmpeg + ImageMagick | Transcoding, thumbnails, filmstrips, waveforms, HLS |
| Video Streaming | hls.js | Adaptive bitrate HLS playback (Chrome/Firefox); native HLS (Safari) |
| Message Queue | BullMQ + Redis | Async jobs: transcoding, transcription, notifications |
| Transcription | Provider interface | Deepgram Nova-2 (prod), faster-whisper (dev/fallback) |
| Email | Provider interface | Hollow stub; Resend/SES/Postmark/SendGrid via `EMAIL_PROVIDER` |
| Billing | Stripe (Phase 2) | Plan enforcement, usage metering |
| Deployment | Hetzner VPS + systemd + Caddy | Single server, ~$10-13/mo, Litestream backups to R2 |
| Authentication | WorkOS AuthKit | Email/password, social, MFA, SSO-ready |
| CI/CD | GitHub Actions | Secrets injected via Actions secrets |

---

## Deployment Topology

```
                Internet
                   |
               [Caddy] :443
                   |
               bush.io
               /       \
        /v4/*          everything else
          |                  |
   [Hono API] :3001   [Next.js] :3000
          |
       [Redis] :6379
       /       \
 [BullMQ]    [Sessions]
    |
[Worker] (FFmpeg)
    |
[S3 / R2 Storage]

[SQLite] /var/data/bush.db
    |
[Litestream] → R2 backup
```

Single VPS (Hetzner CX32: 4 vCPU, 8 GB RAM). Three app processes (Next.js, Hono API, BullMQ Worker) + Caddy + Litestream. Path-based routing — no CORS needed.

---

## Quick Reference

### Data Hierarchy

```
Account → Workspace → Project → Folder → [File | Version Stack | Folder]
```

### Account Roles

| Role | Scope |
|------|-------|
| Account Owner | Full account access, billing |
| Content Admin | All content, no billing |
| Member | Granted workspace/project access |
| Guest | Limited (1 project max) |
| Reviewer | Share link access only |

### Permission Levels

| Level | Capabilities |
|-------|-------------|
| Full Access | All abilities |
| Edit & Share | Upload, manage, share, download, comment |
| Edit | Edit & Share minus share/download |
| Comment Only | Comment and view |
| View Only | View only |

See `03-permissions.md` for the full permission model.

### Supported File Formats

| Type | Formats |
|------|---------|
| Video | 3GPP, AVI, FLV, MKV, MOV, MP4, MXF, WebM, WMV |
| Audio | AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA |
| Image | RAW (15+ formats), BMP, EXR, GIF, HEIC, JPG, PNG, TIFF, WebP |
| Document | PDF, Markdown, DOCX, PPTX, XLSX _(ZIP viewer: Phase 2)_ |

---

## References

Useful external resources for implementation guidance:

| Link | Relevance |
|------|-----------|
| [simple-ffmpegjs](https://github.com/Fats403/simple-ffmpegjs) | FFmpeg pipeline reference |
| [image-js](https://github.com/image-js/image-js) | Image processing in JS |
| [bunqueue](https://github.com/egeominotti/bunqueue) | Bun-native queue patterns |
| [Performance-optimized video embeds](https://frontendmasters.com/blog/performance-optimized-video-embeds-with-zero-javascript/) | Zero-JS video embed techniques |
| [Piccalilli: JS cleanup](https://piccalil.li/blog/its-about-to-get-a-lot-easier-for-your-javascript-to-clean-up-after-itself/) | AbortController / resource cleanup |
| [React best practices (Vercel)](https://vercel.com/blog/introducing-react-best-practices) | Server components, data fetching patterns |
| [CSS in 2026](https://blog.logrocket.com/css-in-2026) | Modern CSS reference for design system |
| [Griddy Icons](https://griddyicons.com/) | Icon library candidate |
