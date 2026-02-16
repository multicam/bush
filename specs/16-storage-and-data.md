# Bush - Storage & Data

## Summary
Storage architecture, upload flows, quota management, CDN delivery, and backup strategy for the Bush platform. All storage interactions go through provider-agnostic abstraction layers -- swap S3 providers or CDN vendors without application code changes.

---

## 1. Storage Architecture

### Provider Abstraction
- Single `StorageProvider` interface wrapping all object storage operations
- Implementations: AWS S3, Cloudflare R2, MinIO, Backblaze B2
- Provider selected via environment configuration, not code
- All access through the abstraction -- no direct SDK calls in application code

### Storage Key Structure
```
{account_id}/{project_id}/{asset_id}/{type}/{filename}
```

| Segment | Description |
|---------|-------------|
| `account_id` | Account UUID |
| `project_id` | Project UUID |
| `asset_id` | Asset UUID |
| `type` | `original`, `proxy`, `thumbnail`, `filmstrip`, `waveform`, `hls` |
| `filename` | Original filename (originals) or generated name (derivatives) |

Examples:
```
acc_abc/proj_123/ast_456/original/interview_final.mov
acc_abc/proj_123/ast_456/proxy/720p.mp4
acc_abc/proj_123/ast_456/thumbnail/thumb_320.jpg
acc_abc/proj_123/ast_456/filmstrip/strip.jpg
acc_abc/proj_123/ast_456/hls/720p/playlist.m3u8
```

### Bucket Strategy
- **Primary bucket**: All originals + derivatives for Bush-managed storage
- **Separate bucket** (optional): Proxies/derivatives only (for CDN origin)
- Storage Connect accounts: customer bucket for originals, Bush bucket for proxies

---

## 2. Upload Flow

### Pre-signed URL Upload
1. Client requests upload URL from API (includes file metadata: name, size, MIME type)
2. API validates: quota available, file size within limits, file type allowed
3. API generates pre-signed PUT URL (expiry: 1 hour)
4. Client uploads directly to object storage (bypasses application server)
5. Object storage triggers completion webhook or client confirms upload
6. API creates asset record, enqueues processing jobs (proxy, thumbnail, etc.)

### Multipart / Chunked Uploads
- Files > 100MB: mandatory multipart upload
- Chunk size: 10MB default (configurable per client)
- Flow:
  1. Client requests multipart initiation
  2. API returns upload ID + pre-signed URLs for each part
  3. Client uploads parts in parallel (up to 6 concurrent parts)
  4. Client signals completion with part ETags
  5. API triggers multipart completion on storage provider

### Resumable Uploads
- Upload state tracked server-side (Redis, keyed by upload ID)
- Client can query completed parts and resume from last successful part
- Incomplete uploads expire after 24 hours (cleanup job)
- Transfer App and web client both support resume

### Upload Constraints
| Constraint | Limit |
|------------|-------|
| Max file size | 10 GB |
| Concurrent uploads per user | 10 |
| Assets per batch upload | 500 |
| Pre-signed URL expiry | 1 hour |
| Multipart upload expiry | 24 hours |
| Min multipart chunk | 5 MB |
| Default multipart chunk | 10 MB |

---

## 3. Storage Quotas

### Plan Tiers
| Plan | Base Storage | Per-Member Bonus | Total Formula |
|------|-------------|-----------------|---------------|
| Free | 2 GB | -- | 2 GB |
| Pro | 2 TB | +2 TB/member | 2 + (2 * members) TB |
| Team | 3 TB | +2 TB/member | 3 + (2 * members) TB |
| Enterprise | Custom | Custom | Negotiated |

### What Counts Toward Quota
- Original uploaded files (full size)
- Proxies, thumbnails, filmstrips, waveforms do NOT count
- Recently Deleted items still count until permanently deleted or 30-day expiry

### Quota Tracking
- `accounts` table: `storage_used_bytes` (BIGINT), `storage_quota_bytes` (BIGINT)
- Atomic increment on upload completion: `UPDATE accounts SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`
- Atomic decrement on permanent deletion
- Recalculation job (weekly) to reconcile drift between DB and actual storage

### Quota Enforcement
1. **Pre-upload check**: reject upload if `storage_used_bytes + file_size > storage_quota_bytes`
2. **Return clear error**: HTTP 413 with remaining quota in response body
3. **Grace period**: none -- hard limit enforcement
4. **Quota change on plan upgrade/downgrade**: immediate effect, no retroactive enforcement (over-quota accounts can't upload but aren't force-deleted)

---

## 4. Proxy & Derivative Storage

### Derivative Types
| Type | Format | Generated For | Notes |
|------|--------|--------------|-------|
| Thumbnail | JPEG, 320px wide | Video, Image, PDF | First frame (video), first page (PDF) |
| Filmstrip | JPEG sprite sheet | Video | 1 frame per second, 160px wide |
| Waveform | JSON + PNG | Audio, Video (audio track) | Peak amplitude data |
| Proxy video | H.264 MP4 | Video | Multiple resolutions |
| HLS segments | .ts + .m3u8 | Video | Adaptive streaming |
| PDF preview | JPEG per page | PDF | One image per page |

### Proxy Video Resolutions
| Label | Resolution | Bitrate (approx) |
|-------|-----------|-------------------|
| 360p | 640x360 | 800 kbps |
| 720p | 1280x720 | 2.5 Mbps |
| 1080p | 1920x1080 | 5 Mbps |

- Source resolution determines which proxies are generated (never upscale)
- All proxies: H.264, AAC audio, MP4 container
- HLS: same resolutions, 6-second segments, master playlist with all variants

### Derivative Key Naming
```
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_320.jpg   # named by pixel width (320, 640, 1280)
{account_id}/{project_id}/{asset_id}/filmstrip/strip.jpg
{account_id}/{project_id}/{asset_id}/waveform/waveform.json
{account_id}/{project_id}/{asset_id}/waveform/waveform.png
{account_id}/{project_id}/{asset_id}/proxy/360p.mp4
{account_id}/{project_id}/{asset_id}/proxy/720p.mp4
{account_id}/{project_id}/{asset_id}/proxy/1080p.mp4
{account_id}/{project_id}/{asset_id}/hls/master.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/playlist.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/segment_001.ts
```

### Processing Pipeline
- Upload completion triggers BullMQ jobs: `generate:thumbnail`, `generate:proxy`, `generate:filmstrip`, `generate:waveform`
- Jobs processed by FFmpeg workers
- Progress tracked in Redis, exposed via WebSocket to client
- Retry: 3 attempts with exponential backoff
- Failed jobs: asset marked with processing error status, manual retry available

---

## 5. CDN Integration

### CDN Abstraction
- `CDNProvider` interface: `getDeliveryUrl(storageKey, options)`, `invalidate(storageKey)`, `invalidatePrefix(prefix)`
- Implementations: Bunny CDN (preferred), CloudFront, Fastly, or any pull-based CDN
- CDN configured as pull origin from object storage bucket
- Provider selected via environment configuration

### Delivery Strategy
| Content | Delivery Method | Cache TTL |
|---------|----------------|-----------|
| Thumbnails | CDN (public, signed URL) | 30 days |
| Filmstrips | CDN (public, signed URL) | 30 days |
| Proxy video | CDN (signed URL, token-authenticated) | 7 days |
| HLS segments | CDN (signed URL, token-authenticated) | 7 days |
| HLS playlists | CDN (signed URL, short TTL) | 5 minutes |
| Originals | Direct pre-signed URL from storage (no CDN) | N/A |
| Waveform data | CDN (public, signed URL) | 30 days |

### Signed URL Strategy
- All CDN URLs are signed (time-limited tokens)
- Token includes: expiry timestamp, allowed path, client IP binding (optional)
- Share link viewers get short-lived tokens refreshed via API
- Prevents hotlinking and unauthorized access

### Cache Invalidation
- Asset deletion: invalidate all derivative keys for that asset
- Version replacement: invalidate previous version's derivatives
- Bulk invalidation: prefix-based purge (`{account_id}/{project_id}/{asset_id}/*`)
- Invalidation is async -- stale content acceptable for up to 5 minutes

---

## 6. Database & Cache

### SQLite (Primary Database)
- WAL mode enabled (concurrent reads during writes)
- Single-writer with IMMEDIATE transactions for writes
- Connection pool: 1 writer, multiple readers
- PRAGMA settings: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`
- FTS5 for full-text search (asset names, metadata, comments)

### Redis
- **Caching**: session data, quota snapshots, frequently accessed metadata
- **Rate limiting**: token bucket per API key / IP
- **Pub/Sub**: real-time events (upload progress, comment notifications, status changes)
- **BullMQ**: job queue for async processing (transcoding, transcription, notifications)
- **Upload state**: multipart upload tracking, resumable upload progress

### Redis Key Namespaces
```
bush:session:{session_id}        -- session data
bush:quota:{account_id}          -- cached quota snapshot
bush:upload:{upload_id}          -- multipart upload state
bush:ratelimit:{key}             -- rate limit counters
bush:ws:{user_id}                -- WebSocket connection tracking
bush:cache:{resource}:{id}       -- general cache entries
```

---

## 7. Backup & Recovery

### SQLite Backup
- **Litestream** (or equivalent): continuous WAL streaming to object storage
- RPO (Recovery Point Objective): < 1 second (WAL frames streamed in real-time)
- RTO (Recovery Time Objective): < 5 minutes (restore from latest snapshot + WAL replay)
- Daily full snapshots stored in separate backup bucket
- Retention: 30 daily snapshots, 12 weekly snapshots

### Redis Persistence
- **RDB snapshots**: every 15 minutes (or after 1000 writes)
- **AOF (Append Only File)**: enabled, `appendfsync everysec`
- Redis data is cache/ephemeral -- full rebuild from SQLite is possible
- Critical state (upload tracking) has SQLite fallback

### Object Storage Redundancy
- Provider-level redundancy (S3: 99.999999999% durability)
- No application-level replication of object storage
- Cross-region replication: provider configuration, not application concern (except Data Residency, see Section 9)

### Recently Deleted (Soft Delete)
- Deleted assets moved to "Recently Deleted" per account
- 30-day retention before permanent deletion
- Storage quota: still counts until permanent deletion
- Permanent deletion: removes original + all derivatives from object storage
- Cleanup job runs daily: permanently deletes expired soft-deleted assets

---

## 8. Asset Lifecycle Management

### Retention Policies
- Configurable at workspace level
- Options: 30 / 60 / 90 days, custom duration, or no expiration
- Clock icon displayed on assets approaching expiration
- Hover shows days remaining
- Users can reset lifecycle (extend retention) if they have Edit permission

### Lifecycle Flow
1. Asset uploaded -- lifecycle clock starts (if policy active)
2. Approaching expiration: visual indicator + optional notification
3. Expiration reached: asset moves to Recently Deleted
4. 30 days in Recently Deleted: permanent deletion (original + derivatives)

---

## 9. Data Residency (Phase 5)

### EU Data Residency
- Separate storage bucket in EU region
- Account-level setting: data residency region
- New uploads routed to region-appropriate bucket
- Existing assets: migration tool for region transfer
- Database: separate SQLite instance per region, or region-tagged rows (TBD)
- CDN: region-aware origin routing

### Multi-Region Considerations
- Storage provider must support the target region
- Backup streams replicated within the same region
- Cross-region access: CDN handles edge delivery regardless of origin region

---

## 10. Storage Connect (Phase 4)

### Overview
- Customers connect their own S3-compatible bucket to Bush
- Bush reads/writes originals to customer bucket
- Proxies and derivatives stored in Bush-managed storage (always)

### Bucket Configuration
| Bucket Type | Access | Stored Content |
|-------------|--------|---------------|
| Primary (customer) | Read + Write | Originals |
| Additional (customer) | Read-only | Existing assets (import) |
| Bush-managed | Read + Write | Proxies, thumbnails, HLS, filmstrips, waveforms |

### Storage Connect Flow
1. Customer provides bucket credentials (access key, secret, endpoint, region)
2. Bush validates connectivity (test PUT + GET + DELETE)
3. Customer sets bucket as primary or read-only
4. Uploads: originals go to customer bucket, derivatives to Bush bucket
5. Downloads: originals served from customer bucket (pre-signed URL)

### Quota Behavior with Storage Connect
- Storage in customer-owned buckets does NOT count toward Bush quota
- Bush-managed derivative storage does NOT count toward quota (same as standard)
- Customer responsible for their own bucket costs and capacity

---

## 11. Storage Provider Configuration

### Environment Variables
```
STORAGE_PROVIDER=s3           # s3 | r2 | minio | b2
STORAGE_ENDPOINT=https://...
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_BUCKET=bush-primary
STORAGE_BUCKET_DERIVATIVES=bush-derivatives   # optional, defaults to primary

CDN_PROVIDER=bunny            # bunny | cloudfront | fastly | none
CDN_BASE_URL=https://cdn.bush.example.com
CDN_SIGNING_KEY=...

BACKUP_STORAGE_BUCKET=bush-backups
```

### Health Checks
- Storage connectivity: verified on startup, checked every 60 seconds
- CDN connectivity: verified on startup
- Failures: logged, alerted, graceful degradation (serve direct from storage if CDN down)
