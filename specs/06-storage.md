# Bush - Storage

## Overview

Bush uses provider-agnostic abstraction layers for all storage concerns: object storage, CDN delivery, and database backup. Application code interacts exclusively with the `StorageProvider` and `CDNProvider` interfaces; concrete vendor bindings (Cloudflare R2, Bunny CDN, Hetzner, etc.) are injected via environment configuration and documented in `30-configuration.md`. Storage keys follow a deterministic hierarchical scheme so every derivative asset is addressable without a database lookup. Upload flows use pre-signed URLs to bypass the application server for all file data. Quota enforcement, lifecycle management, and soft deletion are application-layer concerns applied uniformly regardless of the underlying storage vendor.

---

## Specification

### 1. StorageProvider Interface [Phase 1]

All object storage operations go through this interface. No application code calls vendor SDKs directly.

```typescript
interface StorageProvider {
  /** Generate a pre-signed PUT URL for direct client upload */
  getUploadUrl(key: string, options: UploadUrlOptions): Promise<PresignedUrl>;

  /** Generate a pre-signed GET URL for direct download */
  getDownloadUrl(key: string, options?: DownloadUrlOptions): Promise<PresignedUrl>;

  /** Initiate a multipart upload; returns an upload ID */
  createMultipartUpload(key: string): Promise<string>;

  /** Get pre-signed URLs for each part of a multipart upload */
  getPartUploadUrls(key: string, uploadId: string, partCount: number): Promise<PresignedUrl[]>;

  /** Complete a multipart upload given the ETags from each part */
  completeMultipartUpload(key: string, uploadId: string, parts: PartETag[]): Promise<void>;

  /** Abort an in-progress multipart upload */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  /** Delete a single object */
  delete(key: string): Promise<void>;

  /** Delete all objects sharing a key prefix */
  deletePrefix(prefix: string): Promise<void>;

  /** Check whether a key exists */
  exists(key: string): Promise<boolean>;

  /** Return object metadata (size, content type, last modified) */
  stat(key: string): Promise<ObjectMetadata | null>;
}
```

Provider is selected via the `STORAGE_PROVIDER` environment variable. Supported implementations: AWS S3, Cloudflare R2, MinIO, Backblaze B2. Configuration variables live in `30-configuration.md`.

---

### 2. CDNProvider Interface [Phase 1]

```typescript
interface CDNProvider {
  /** Return the delivery URL for a given storage key */
  getDeliveryUrl(storageKey: string, options?: DeliveryOptions): string;

  /** Purge a single key from CDN cache */
  invalidate(storageKey: string): Promise<void>;

  /** Purge all keys under a path prefix from CDN cache */
  invalidatePrefix(prefix: string): Promise<void>;
}
```

CDN is configured as a pull origin pointing at the object storage bucket. Provider selected via `CDN_PROVIDER`. All delivery URLs are signed (time-limited tokens). Vendor details and token configuration live in `30-configuration.md`.

---

### 3. Backup Interface [Phase 1]

```typescript
interface BackupProvider {
  /** Stream WAL frames or snapshot to backup destination */
  streamWAL(sourceDb: string, destinationKey: string): Promise<void>;

  /** Write a full snapshot to backup storage */
  writeSnapshot(sourceDb: string, destinationKey: string): Promise<void>;

  /** Restore from a snapshot key + optional WAL replay */
  restore(snapshotKey: string, walPrefix: string, targetPath: string): Promise<void>;

  /** List available snapshots */
  listSnapshots(): Promise<BackupSnapshot[]>;
}
```

---

### 4. Storage Key Structure [Phase 1]

```
{account_id}/{project_id}/{asset_id}/{type}/{filename}
```

| Segment | Description |
|---------|-------------|
| `account_id` | Account UUID |
| `project_id` | Project UUID |
| `asset_id` | Asset UUID |
| `type` | `original`, `proxy`, `thumbnail`, `filmstrip`, `waveform`, `hls`, `pages` |
| `filename` | Original filename (originals) or deterministic generated name (derivatives) |

#### Derivative Key Naming

```
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_small.webp
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_medium.webp
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_large.webp
{account_id}/{project_id}/{asset_id}/filmstrip/filmstrip.jpg
{account_id}/{project_id}/{asset_id}/filmstrip/filmstrip.json
{account_id}/{project_id}/{asset_id}/waveform/waveform.json
{account_id}/{project_id}/{asset_id}/proxy/360p.mp4
{account_id}/{project_id}/{asset_id}/proxy/540p.mp4
{account_id}/{project_id}/{asset_id}/proxy/720p.mp4
{account_id}/{project_id}/{asset_id}/proxy/1080p.mp4
{account_id}/{project_id}/{asset_id}/proxy/4k.mp4
{account_id}/{project_id}/{asset_id}/hls/master.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/playlist.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/segment_001.ts
{account_id}/{project_id}/{asset_id}/pages/page_001.jpg
```

Key rules:
- Thumbnails: WebP format, three named sizes (`thumb_small`, `thumb_medium`, `thumb_large`). No pixel-width naming.
- Waveform: JSON only (`waveform.json`). No PNG. Client renders from peak data.
- Proxy resolutions: five tiers (360p, 540p, 720p, 1080p, 4k). Never upscale beyond source resolution.

---

### 5. Bucket Strategy [Phase 1]

- **Primary bucket**: all originals and derivatives for Bush-managed storage.
- **Derivative-only bucket** (optional): proxies and derivatives only; used as CDN pull origin when you want to separate access policies.
- **Storage Connect accounts** (Phase 4): originals go to the customer-owned bucket; derivatives always remain in the Bush-managed bucket.

---

### 6. Upload Flow [Phase 1]

#### Pre-signed URL Upload

1. Client sends upload intent to the API: filename, size, MIME type.
2. API validates: quota headroom, file size within limit, MIME type allowed.
3. API generates pre-signed PUT URL (expiry: 1 hour) via `StorageProvider.getUploadUrl()`.
4. Client uploads the file body directly to object storage — no data passes through the application server.
5. Client confirms upload completion to the API.
6. API creates the asset record (`status = 'processing'`), enqueues derivative jobs to BullMQ (`media:thumbnail`, `media:proxy`, `media:filmstrip`, `media:waveform`, `media:metadata`).

#### Multipart / Chunked Uploads

- Files > 100 MB: mandatory multipart upload.
- Chunk size: 10 MB default, minimum 5 MB.
- Flow:
  1. Client calls multipart initiation endpoint.
  2. API calls `StorageProvider.createMultipartUpload()`, returns upload ID and per-part pre-signed URLs.
  3. Client uploads parts in parallel (up to 6 concurrent parts).
  4. Client submits part ETags to API.
  5. API calls `StorageProvider.completeMultipartUpload()`.

#### Resumable Uploads

- Upload state tracked in Redis, keyed by upload ID: completed parts, byte offsets.
- Client queries state and resumes from last successful part.
- Incomplete multipart uploads expire after 24 hours; a cleanup job calls `StorageProvider.abortMultipartUpload()`.

#### Upload Constraints

| Constraint | Limit |
|------------|-------|
| Max file size | 10 GB |
| Concurrent uploads per user | 10 |
| Assets per batch upload | 500 |
| Pre-signed URL expiry | 1 hour |
| Multipart upload expiry | 24 hours |
| Minimum multipart chunk | 5 MB |
| Default multipart chunk | 10 MB |

---

### 7. Derivative Types [Phase 1]

| Type | Format | Generated For | Notes |
|------|--------|--------------|-------|
| Thumbnail small | WebP (320x180) | Video, image, document | `thumb_small.webp` |
| Thumbnail medium | WebP (640x360) | Video, image, document | `thumb_medium.webp` |
| Thumbnail large | WebP (1280x720) | Video, image, document | `thumb_large.webp` |
| Filmstrip | JPEG sprite sheet | Video | 1 frame/sec, 160x90 tiles, 10-column grid |
| Filmstrip manifest | JSON | Video | Frame count, dimensions, interval |
| Waveform | JSON | Audio, video (audio track) | Peak amplitude array, client-side rendering |
| Proxy video | H.264 MP4 | Video | Five tiers: 360p, 540p, 720p, 1080p, 4k |
| HLS segments | `.ts` + `.m3u8` | Video | 6-second segments, master playlist |
| PDF pages | JPEG per page | PDF | One image per page for PDF viewer |

Processing pipeline details (FFmpeg commands, resolution ladder, bitrates, HDR handling) are defined in `07-media-processing.md`. Storage here defines only the key naming and derivative types.

---

### 8. Proxy Video Resolutions [Phase 1]

Five tiers. Source resolution determines which tiers are generated; never upscale.

| Label | Resolution | Video Bitrate | Audio |
|-------|-----------|--------------|-------|
| 360p | 640×360 | 800 kbps | 128 kbps AAC |
| 540p | 960×540 | 1.5 Mbps | 128 kbps AAC |
| 720p | 1280×720 | 2.5 Mbps | 128 kbps AAC |
| 1080p | 1920×1080 | 5 Mbps | 128 kbps AAC |
| 4k | 3840×2160 | 15 Mbps | 128 kbps AAC |

HLS uses the same resolution tiers. 6-second segments. Master playlist references all generated variants.

---

### 9. Processing Queue Names [Phase 1]

BullMQ queues triggered on upload completion. All queues use the `media:*` prefix.

| Queue | Purpose |
|-------|---------|
| `media:metadata` | FFprobe extraction (always first) |
| `media:thumbnail` | Thumbnail generation |
| `media:filmstrip` | Hover scrub filmstrip |
| `media:proxy` | Proxy transcode + HLS segmentation |
| `media:waveform` | Audio waveform extraction |
| `media:transcription` | Speech-to-text (after metadata) |

Job data payload: `{ assetId, accountId, projectId, storageKey, mimeType, sourceFilename }`.

---

### 10. CDN Delivery Strategy [Phase 1]

| Content | Delivery | Cache TTL |
|---------|----------|-----------|
| Thumbnails | CDN, signed URL | 30 days |
| Filmstrips | CDN, signed URL | 30 days |
| Waveform JSON | CDN, signed URL | 30 days |
| Proxy video (MP4) | CDN, signed URL | 7 days |
| HLS segments | CDN, signed URL | 7 days |
| HLS playlists | CDN, signed URL, short TTL | 5 minutes |
| Originals | Direct pre-signed URL from storage, no CDN | N/A |

Signed URL tokens include: expiry timestamp, allowed path, optional client IP binding. All CDN URLs are signed — no unauthenticated access to any media. Share link viewers receive short-lived tokens refreshed via the API.

#### Cache Invalidation

- Asset deletion: `CDNProvider.invalidatePrefix({account_id}/{project_id}/{asset_id}/*)`.
- Version replacement: invalidate previous version's derivative prefix before writing new derivatives.
- Invalidation is asynchronous; stale content acceptable for up to 5 minutes.

#### CDN Graceful Degradation

- Health check verifies CDN connectivity on startup and every 60 seconds.
- If CDN is unreachable: fall back to direct pre-signed URLs from object storage.
- Degraded mode logged and alerted; CDN resumed automatically when connectivity restores.

---

### 11. Storage Quotas [Phase 1]

#### Plan Tiers

| Plan | Base Storage | Per-Member Bonus |
|------|-------------|-----------------|
| Free | 2 GB | — |
| Pro | 2 TB | +2 TB/member |
| Team | 3 TB | +2 TB/member |
| Enterprise | Custom | Custom |

#### What Counts Toward Quota

- Original uploaded files at their full upload size.
- Derivatives (proxies, thumbnails, filmstrips, waveforms) do NOT count toward quota.
- Soft-deleted assets still count until permanently deleted or the 30-day retention period expires.

#### Quota Tracking

- `accounts.storage_used_bytes` (BIGINT) and `accounts.storage_quota_bytes` (BIGINT).
- Atomic increment on upload completion:
  ```sql
  UPDATE accounts SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?
  ```
- Atomic decrement on permanent deletion.
- Weekly reconciliation job recalculates `storage_used_bytes` from actual storage to correct drift.

#### Quota Enforcement

1. Pre-upload check: reject if `storage_used_bytes + file_size > storage_quota_bytes`.
2. Response: HTTP 413 with remaining quota in the body.
3. Hard limit — no grace period.
4. Plan change takes immediate effect; over-quota accounts cannot upload but existing assets are not force-deleted.

---

### 12. Database and Cache [Phase 1]

#### SQLite (Primary Database)

- WAL mode (`PRAGMA journal_mode=WAL`) for concurrent reads during writes.
- Single writer with `IMMEDIATE` transactions; multiple read connections.
- PRAGMA settings: `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`.
- FTS5 virtual tables for full-text search on asset names, metadata, comments, and transcripts.

#### Redis

- **Caching**: session data, quota snapshots, frequently accessed metadata.
- **Rate limiting**: token bucket per API key and IP address.
- **Pub/Sub**: real-time events (upload progress, processing status, comment notifications).
- **BullMQ**: backing store for all async job queues.
- **Upload state**: multipart upload tracking and resumable upload progress.

#### Redis Key Namespaces

```
bush:session:{session_id}           -- session data
bush:quota:{account_id}             -- cached quota snapshot
bush:upload:{upload_id}             -- multipart upload state
bush:ratelimit:{key}                -- rate limit counters
bush:ws:{user_id}                   -- WebSocket connection tracking
bush:cache:{resource}:{id}          -- general cache entries
bush:progress:{asset_id}:{job_type} -- processing progress
bush:worker:{worker_id}:heartbeat   -- worker health
```

---

### 13. Backup and Recovery [Phase 1]

#### SQLite Backup

- Litestream (or equivalent) streams WAL frames continuously to object storage.
- RPO: < 1 second (WAL frames streamed in real-time).
- RTO: < 5 minutes (restore from latest snapshot, replay WAL).
- Daily full snapshots stored in a dedicated backup bucket.
- Retention: 30 daily snapshots, 12 weekly snapshots.

#### Redis Persistence

- RDB snapshots every 15 minutes (or after 1000 writes).
- AOF enabled with `appendfsync everysec`.
- Redis is treated as recoverable cache; critical upload state has SQLite fallback.

#### Object Storage Redundancy

- Provider-level durability (S3-class: 99.999999999%).
- No application-level replication of object storage — redundancy is a provider and provider-configuration concern.
- Cross-region replication configured at the provider level (see Section 16 for Data Residency).

---

### 14. Asset Lifecycle Management [Phase 1]

#### Soft Delete (Recently Deleted)

- Deleted assets enter a "Recently Deleted" state, retained for 30 days.
- Storage quota still counts during the retention window.
- Permanent deletion removes original and all derivatives from object storage.
- Daily cleanup job permanently deletes assets whose retention period has expired.

#### Retention Policies

- Configurable per workspace: 30, 60, or 90 days, custom duration, or no expiration.
- Approaching-expiration indicator shown on assets (clock icon, hover shows days remaining).
- Users with Edit permission can reset the lifecycle clock (extend retention).

#### Lifecycle Flow

```
Upload complete
  → lifecycle clock starts (if workspace policy active)
  → clock icon visible when expiration is near
  → expiration reached → asset moves to Recently Deleted
  → 30 days in Recently Deleted → permanent deletion (original + all derivatives)
```

---

### 15. Storage Connect (Phase 4)

Customers connect their own S3-compatible bucket. Originals are written to and read from the customer bucket. Derivatives always remain in the Bush-managed bucket.

| Bucket Type | Access | Content |
|-------------|--------|---------|
| Customer primary bucket | Read + Write | Originals |
| Customer read-only bucket | Read-only | Existing assets for import |
| Bush-managed bucket | Read + Write | All derivatives |

#### Flow

1. Customer provides credentials (access key, secret, endpoint, region).
2. Bush validates connectivity: test PUT, GET, DELETE.
3. Customer designates bucket as primary or read-only.
4. Uploads: originals to customer bucket; derivatives to Bush bucket.
5. Downloads: originals served from customer bucket via pre-signed URL.

#### Quota Behavior

- Customer-bucket originals do NOT count toward Bush quota.
- Bush-managed derivatives do NOT count toward quota (same as standard).
- Customer is responsible for their own bucket costs and capacity.

---

### 16. Data Residency (Phase 5)

- EU data residency: separate storage bucket in EU region.
- Account-level setting controls routing of new uploads to the region-appropriate bucket.
- Existing assets: migration tool available for cross-region transfer.
- Backup streams replicated within the same region.
- CDN provides edge delivery regardless of origin region.

---

### 17. Health Checks [Phase 1]

- Storage connectivity verified on startup; re-checked every 60 seconds.
- CDN connectivity verified on startup.
- Failures: logged, alerted, graceful degradation (direct storage URLs if CDN down).

---

## Cross-references

- `07-media-processing.md` — FFmpeg commands, resolution ladder, derivative generation pipeline
- `01-data-model.md` — file and asset entity schemas, processing status fields
- `04-api-reference.md` — upload endpoints, multipart initiation, asset CRUD
- `30-configuration.md` — storage provider credentials, CDN vendor config, backup destination
