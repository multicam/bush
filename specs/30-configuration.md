# Bush - Configuration & Secrets Management

## Overview

All configuration flows from a single validated source: the Zod schema in `src/config/env.ts`. Every environment variable is typed, defaulted, and marked required or optional at definition time. The code schema is authoritative — this document is reference documentation. When adding a new env var, update `src/config/env.ts` first, then `.env.example`. The system follows five principles: environment variables only (no config files, no hardcoded values), no secrets in git ever, fail fast at startup with clear error messages, single typed source of truth, and type-safe access through the `config` object (never raw `process.env`).

---

## Specification

### 1. Central Source of Truth

```
src/config/env.ts          → Zod schema: defines, validates, types every variable
  ↓
.env.example               → Documents all variables with defaults (mirrors env.ts)
  ↓
.env.local                 → Developer overrides (not in git)
```

### 2. Environment Files

| File | In Git | Purpose |
|------|--------|---------|
| `.env.example` | Yes | Documents all variables with placeholder values |
| `.env.local` | No | Developer overrides (personal credentials, local paths) |
| `.env.test` | Yes | Test environment defaults (deterministic, no external services) |
| `.env.production` | No | Production values, deployed via CI/secrets manager |

#### Load Order (highest priority wins)
1. Actual environment variables (always win)
2. `.env.local` (dev only)
3. `.env.test` (when `NODE_ENV=test`)
4. `.env.example` (fallback defaults)

---

### 3. Complete Environment Variables

#### App & Core

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `NODE_ENV` | enum | `development` | No | `development` \| `test` \| `production` |
| `PORT` | number | `3001` | No | API server port |
| `HOST` | string | `0.0.0.0` | No | Bind address |
| `LOG_LEVEL` | enum | `info` | No | `debug` \| `info` \| `warn` \| `error` |
| `APP_URL` | url | — | Yes | Next.js frontend URL |
| `API_URL` | url | — | Yes | Hono backend URL |

#### Database (SQLite)

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `DATABASE_URL` | string | — | Yes | SQLite path (e.g., `./data/bush.db`) |
| `DATABASE_WAL_MODE` | boolean | `true` | No | Enable WAL mode |
| `DATABASE_BUSY_TIMEOUT` | number | `5000` | No | Busy timeout in ms |

#### Redis

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `REDIS_URL` | string | — | Yes | Redis connection string |
| `REDIS_KEY_PREFIX` | string | `bush:` | No | Key namespace |

#### Authentication

Bush uses WorkOS AuthKit as the current identity provider. The variables below are WorkOS-specific; the surrounding auth logic is isolated behind a thin adapter interface so the provider can be replaced without touching application code. See `02-authentication.md` for the full auth model.

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `WORKOS_API_KEY` | string | — | Yes | Yes | WorkOS API key (`sk_test_...`) |
| `WORKOS_CLIENT_ID` | string | — | Yes | No | WorkOS client ID (`client_...`) |
| `WORKOS_REDIRECT_URI` | url | — | No | No | Override redirect URI |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | url | — | Yes | No | AuthKit SDK redirect (must match dashboard) |
| `WORKOS_WEBHOOK_SECRET` | string | — | Yes | Yes | Webhook signing secret (`whsec_...`) |
| `WORKOS_COOKIE_PASSWORD` | string | — | No | Yes | Cookie encryption (min 32 chars, falls back to `SESSION_SECRET`) |

#### Object Storage (S3-compatible interface)

Application code interacts exclusively with the `StorageProvider` interface. The env vars below select and configure the concrete backend. See `06-storage.md` for the full storage model.

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `STORAGE_PROVIDER` | enum | `minio` | No | No | `minio` \| `s3` \| `r2` \| `b2` |
| `STORAGE_ENDPOINT` | string | — | Yes | No | Provider endpoint URL |
| `STORAGE_REGION` | string | `us-east-1` | No | No | AWS region |
| `STORAGE_ACCESS_KEY` | string | — | Yes | Yes | S3 access key |
| `STORAGE_SECRET_KEY` | string | — | Yes | Yes | S3 secret key |
| `STORAGE_BUCKET` | string | — | Yes | No | Primary bucket name |
| `STORAGE_BUCKET_DERIVATIVES` | string | — | No | No | Separate bucket for derivatives |

#### CDN

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `CDN_PROVIDER` | enum | `none` | No | No | `none` \| `bunny` \| `cloudfront` \| `fastly` |
| `CDN_BASE_URL` | url | — | No | No | CDN URL (empty for dev) |
| `CDN_SIGNING_KEY` | string | — | No | Yes | CDN signing key |

#### Media Processing: Binaries

FFmpeg and ImageMagick are the current processing backends. Paths default to standard system locations. See `07-media-processing.md` for the full processing pipeline.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FFMPEG_PATH` | string | `/usr/bin/ffmpeg` | FFmpeg binary |
| `FFPROBE_PATH` | string | `/usr/bin/ffprobe` | FFprobe binary |
| `IMAGEMAGICK_PATH` | string | `/usr/bin/convert` | ImageMagick convert |
| `IDENTIFY_PATH` | string | `/usr/bin/identify` | ImageMagick identify |
| `DCRAW_PATH` | string | `/usr/bin/dcraw` | RAW processor (Phase 2) |
| `LIBREOFFICE_PATH` | string | `/usr/bin/libreoffice` | Doc conversion (Phase 2) |

#### Media Processing: Behavior

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MEDIA_TEMP_DIR` | string | `/tmp/bush-processing` | Temp directory |
| `THUMBNAIL_FORMAT` | enum | `webp` | `webp` \| `jpeg` |
| `THUMBNAIL_QUALITY` | number | `80` | 1-100 |
| `THUMBNAIL_POSITION` | number | `0.5` | 0-1, video frame extraction point |
| `HLS_SEGMENT_DURATION` | number | `6` | HLS segment seconds |
| `PROXY_PRESET` | string | `medium` | FFmpeg encoding preset |

#### Media Processing: Worker Concurrency

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WORKER_THUMBNAIL_CONCURRENCY` | number | `4` | Concurrent thumbnail jobs |
| `WORKER_FILMSTRIP_CONCURRENCY` | number | `2` | Concurrent filmstrip jobs |
| `WORKER_PROXY_CONCURRENCY` | number | `2` | Concurrent proxy transcode jobs |
| `WORKER_WAVEFORM_CONCURRENCY` | number | `4` | Concurrent waveform jobs |
| `WORKER_METADATA_CONCURRENCY` | number | `8` | Concurrent metadata jobs |

#### Transcription

Bush abstracts transcription behind a provider interface. The active provider is selected by `TRANSCRIPTION_PROVIDER`; only the credentials for the selected provider are required at runtime. See `08-transcription.md` for the full transcription model.

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `TRANSCRIPTION_PROVIDER` | enum | `deepgram` | No | No | `faster-whisper` (dev) \| `deepgram` (prod) \| `assemblyai` |
| `TRANSCRIPTION_MAX_DURATION` | number | `7200` | No | No | Max audio duration in seconds |
| `DEEPGRAM_API_KEY` | string | — | When provider=deepgram | Yes | Deepgram API key |
| `ASSEMBLYAI_API_KEY` | string | — | When provider=assemblyai | Yes | AssemblyAI API key |
| `FASTER_WHISPER_URL` | string | — | When provider=faster-whisper | No | Server URL (e.g., `http://localhost:8080`) |

#### Email

Bush abstracts email sending behind an `EmailService` interface. The current implementation is a hollow stub; a concrete provider (Resend, SendGrid, SES, Postmark) is injected by selecting `EMAIL_PROVIDER`. SMTP fallback is always available for dev. See `11-email.md` for the full email model.

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `EMAIL_PROVIDER` | enum | `smtp` | No | No | `smtp` \| `resend` \| `sendgrid` \| `ses` \| `postmark` |
| `EMAIL_FROM` | email | `noreply@bush.local` | No | No | From address |
| `EMAIL_REPLY_TO` | email | — | No | No | Reply-to address |
| `EMAIL_API_KEY` | string | — | When provider != smtp | Yes | Provider API key |
| `SMTP_HOST` | string | `localhost` | No | No | SMTP server (fallback / dev) |
| `SMTP_PORT` | number | `1025` | No | No | SMTP port (Mailpit default for dev) |
| `SMTP_USER` | string | `""` | No | No | SMTP username |
| `SMTP_PASS` | string | `""` | No | Yes | SMTP password |
| `SMTP_SECURE` | boolean | `false` | No | No | TLS (`true` in production) |

#### Billing (Phase 2)

Billing variables are required only when billing is enabled. See `13-billing.md` for the full billing model.

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `STRIPE_SECRET_KEY` | string | — | When billing enabled | Yes | Stripe secret key (`sk_live_...` / `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | string | — | When billing enabled | Yes | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PRICE_ID_STORAGE` | string | — | When billing enabled | No | Stripe price ID for storage tier |
| `STRIPE_PRICE_ID_PROCESSING` | string | — | When billing enabled | No | Stripe price ID for processing tier |

#### Search

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SEARCH_INDEX_BATCH_SIZE` | number | `100` | Documents per indexing batch |

#### Session & Security

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `SESSION_SECRET` | string | — | Yes | Yes | Session encryption key (min 32 chars) |
| `SESSION_MAX_AGE` | number | `604800` | No | No | Session TTL in seconds (7 days) |
| `TRUST_PROXY` | boolean | `false` | No | No | Trust X-Forwarded-For (behind Caddy) |

#### Rate Limiting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | number | `60000` | Window in ms (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `100` | Requests per window per IP |

#### Upload

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `UPLOAD_MAX_FILE_SIZE` | number | `10737418240` | Max file size (10 GB) |
| `UPLOAD_PRESIGNED_URL_EXPIRY` | number | `3600` | Pre-signed URL TTL (1 hour) |
| `UPLOAD_MULTIPART_CHUNK_SIZE` | number | `10485760` | Chunk size (10 MB) |

#### Backup

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BACKUP_STORAGE_BUCKET` | string | `bush-backups` | Backup bucket name |
| `LITESTREAM_ENABLED` | boolean | `false` | Enable SQLite streaming backup |

#### Next.js Public Variables

These are embedded in the browser bundle — not secrets.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | url | — | API base URL (optional, browser uses proxy) |
| `NEXT_PUBLIC_WS_URL` | string | — | WebSocket URL |
| `NEXT_PUBLIC_APP_NAME` | string | `Bush` | Display name |

---

### 4. Secrets Management

#### Secret Keys (scrubbed from logs)

Defined in `src/config/env.ts` → `SECRET_KEYS` array:

1. `WORKOS_API_KEY`
2. `WORKOS_WEBHOOK_SECRET`
3. `WORKOS_COOKIE_PASSWORD`
4. `STORAGE_ACCESS_KEY`
5. `STORAGE_SECRET_KEY`
6. `CDN_SIGNING_KEY`
7. `EMAIL_API_KEY`
8. `SMTP_PASS`
9. `SESSION_SECRET`
10. `DEEPGRAM_API_KEY`
11. `ASSEMBLYAI_API_KEY`
12. `STRIPE_SECRET_KEY`
13. `STRIPE_WEBHOOK_SECRET`

#### Principles

- **No secrets manager initially** — environment variables on host, sourced from GitHub Secrets via CI/CD
- **Upgrade path**: migrate to HashiCorp Vault or AWS Secrets Manager when needed
- **Never log secrets** — `scrubSecrets()` in `src/config/env.ts` replaces values with `[REDACTED:KEY_NAME]`
- **Never return secrets in API responses**
- **Rotate without downtime** — secrets are read at startup; rotation requires restart

#### Secret Rotation

| Secret | Rotation | Procedure |
|--------|----------|-----------|
| `WORKOS_API_KEY` | On compromise or annually | Rotate in WorkOS dashboard, update GitHub Secret, redeploy |
| `STORAGE_ACCESS_KEY/SECRET_KEY` | On compromise or annually | Create new key pair, update, redeploy, delete old key |
| `CDN_SIGNING_KEY` | On compromise | Rotate in CDN dashboard, update, redeploy |
| `SESSION_SECRET` | On compromise | Update (invalidates all sessions), redeploy |
| `DEEPGRAM_API_KEY` | On compromise | Rotate in Deepgram dashboard |
| `STRIPE_SECRET_KEY` | On compromise or annually | Rotate in Stripe dashboard, update, redeploy |

#### Production Secret Sourcing

All secrets stored in GitHub repository → Secrets and variables → Actions. CI/CD injects them as environment variables during deployment. Secrets are masked in GitHub Actions logs automatically.

---

### 5. Dev vs Production

| Variable | Dev | Production |
|----------|-----|------------|
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` or `warn` |
| `APP_URL` | `http://localhost:3000` | `https://app.bush.com` |
| `API_URL` | `http://localhost:3001` | `https://api.bush.com` |
| `DATABASE_URL` | `./data/bush.db` | `/var/data/bush.db` |
| `STORAGE_PROVIDER` | `minio` | `r2` / `s3` |
| `STORAGE_ENDPOINT` | `http://localhost:9000` | Provider endpoint |
| `CDN_PROVIDER` | `none` | `bunny` |
| `TRANSCRIPTION_PROVIDER` | `faster-whisper` | `deepgram` |
| `FASTER_WHISPER_URL` | `http://localhost:8080` | — |
| `EMAIL_PROVIDER` | `smtp` | `resend` (or preferred provider) |
| `SMTP_HOST` | `localhost` (Mailpit) | — |
| `SMTP_SECURE` | `false` | `true` |
| `TRUST_PROXY` | `false` | `true` |
| `LITESTREAM_ENABLED` | `false` | `true` |

---

### 6. Services & Endpoints (Dev)

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **Next.js** | 3000 | `http://localhost:3000` | Frontend + API proxy |
| **Hono API** | 3001 | `http://localhost:3001` | Backend API + WebSocket |
| **Redis** | 6379 | `redis://localhost:6379` | Cache, sessions, BullMQ |
| **MinIO** | 9000 | `http://localhost:9000` | S3-compatible storage |
| **MinIO Console** | 9001 | `http://localhost:9001` | MinIO admin UI |
| **Mailpit SMTP** | 1025 | `localhost:1025` | Dev email capture |
| **Mailpit UI** | 8025 | `http://localhost:8025` | Email viewer |
| **faster-whisper** | 8080 | `http://localhost:8080` | GPU transcription server |
| **BullMQ Worker** | — | — | Media processing (separate process) |

---

### 7. Local Development Setup

#### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | >= 1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | >= 22 | Required for Next.js |
| Redis | >= 7.0 | `apt install redis-server` |
| FFmpeg | >= 6.0 | `apt install ffmpeg` |
| MinIO | latest | Binary download |
| Mailpit | latest | Binary download |

Optional (for transcription dev):

| Tool | Version | Install |
|------|---------|---------|
| NVIDIA Driver | >= 535 | System package |
| CUDA | >= 12.2 | System package |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| faster-whisper-server | latest | See transcription setup below |

#### Step-by-Step

```bash
# 1. Clone and install
git clone git@github.com:multicam/bush.git && cd bush
bun install

# 2. Create local env
cp .env.example .env.local
# Edit .env.local: set WORKOS_API_KEY, WORKOS_CLIENT_ID, SESSION_SECRET

# 3. Start services
redis-server --daemonize yes

# MinIO
mkdir -p ./data/minio
minio server ./data/minio --console-address ":9001"
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/bush-primary

# Mailpit
mailpit  # SMTP :1025, UI :8025

# 4. Database
bun run db:migrate

# 5. Run
bun run dev          # API (3001) + web (3000)
bun run dev:worker   # Media processing worker (separate terminal)
```

#### Transcription Setup (GPU)

```bash
# Create venv
uv venv ~/.venvs/whisper-server
source ~/.venvs/whisper-server/bin/activate

# Install and run
uv pip install faster-whisper-server
faster-whisper-server --model large-v3-turbo --device cuda --port 8080
```

Ensure `.env.local` has:
```bash
TRANSCRIPTION_PROVIDER=faster-whisper
FASTER_WHISPER_URL=http://localhost:8080
```

#### WorkOS Dev Account Setup

1. Create a free account at [workos.com](https://workos.com)
2. Create a Development environment
3. Enable AuthKit, configure redirect URI: `http://localhost:3000/auth/callback`
4. Copy API Key and Client ID to `.env.local`
5. Set `SESSION_SECRET` to any 32+ char string

#### Verify Setup

```bash
redis-cli ping                                    # PONG
curl http://localhost:9000/minio/health/live       # 200
ffmpeg -version                                    # version info
curl http://localhost:8025/api/v1/messages          # []
curl http://localhost:8080/health                   # faster-whisper (if running)
```

---

### 8. Dev Server Architecture

| Process | Command | Port | Description |
|---------|---------|------|-------------|
| API | `bun run dev:api` | 3001 | Hono server + WebSocket (`/ws`) |
| Web | `bun run dev:web` | 3000 | Next.js (proxies `/v4/*` to API) |
| Worker | `bun run dev:worker` | — | BullMQ media processing |
| Transcription | `faster-whisper-server` | 8080 | GPU transcription (optional) |

**Why the `dev:web` workaround?** Next.js looks for `.env.local` relative to the app root (`src/web/`), but the project's `.env.local` is at the repo root. The script sources `.env.local` into the shell so Next.js gets all env vars. `PORT=3000` overrides `PORT=3001` to prevent collision.

Next.js proxies `/v4/*` requests to Hono via rewrites in `next.config.ts`, so browser requests don't cross origins and cookies forward transparently.

---

### 9. Test Environment

`.env.test` provides deterministic, isolated config:

```bash
NODE_ENV=test
PORT=3002
APP_URL=http://localhost:3002
API_URL=http://localhost:3002
DATABASE_URL=:memory:
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=bush:test:
WORKOS_API_KEY=sk_test_fake_key_for_testing
WORKOS_CLIENT_ID=client_test_fake_id
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3002/auth/callback
WORKOS_WEBHOOK_SECRET=whsec_test_fake_secret
STORAGE_PROVIDER=minio
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=bush-test
CDN_PROVIDER=none
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SESSION_SECRET=test-session-secret-at-least-32-chars-long
TRANSCRIPTION_PROVIDER=faster-whisper
FASTER_WHISPER_URL=http://localhost:8080
```

- In-memory SQLite for speed
- Separate Redis key prefix (`bush:test:`)
- Separate MinIO bucket (`bush-test`)
- WorkOS calls mocked in tests

---

### 10. Config Access in Code

#### Backend (Hono)

```typescript
import { config } from "../config/index.js";

const port = config.PORT;           // number, validated
const redisUrl = config.REDIS_URL;  // string, validated
```

#### Frontend Server (Next.js Server Components)

```typescript
import { config } from "../config/index.js";
const apiKey = config.WORKOS_API_KEY;  // same validated config
```

#### Frontend Client (Browser)

```typescript
// Only NEXT_PUBLIC_ vars available
const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
```

#### Build Phase

During `NEXT_PHASE=phase-production-build`, validation is skipped and placeholder values are used. Runtime config is validated on server start.

---

### 11. Health Check

`GET /health` verifies:
- Config loaded (implicit — server wouldn't start otherwise)
- Database connection (SQLite read)
- Redis connection (PING)
- Storage connectivity (HEAD bucket)

Returns `200 OK` with status, or `503` if any dependency is down.

---

### 12. .gitignore

```gitignore
.env.local
.env.production
.env.*.local
data/
*.db
*.db-wal
*.db-shm
node_modules/
.next/
dist/
.DS_Store
*.log
```

Committed: `.env.example`, `.env.test`, `.gitignore`

---

## Cross-references

- `02-authentication.md` — auth model, session logic, guest/reviewer access
- `06-storage.md` — storage provider interface, upload flows, CDN delivery
- `07-media-processing.md` — FFmpeg pipeline, worker configuration
- `08-transcription.md` — transcription provider interface, API key usage
- `11-email.md` — email service interface, transactional email templates
- `13-billing.md` — billing model, plan enforcement, Stripe integration (Phase 2)
