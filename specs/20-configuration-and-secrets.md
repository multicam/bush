# Bush - Configuration & Secrets Management

## Summary
All configuration via environment variables (12-factor app). Type-safe validation at startup with Zod. No secrets in code or git. Single `.env.example` as schema documentation. Fail fast on missing or invalid config.

---

## 1. Configuration Philosophy

- **Environment variables only** -- no config files, no hardcoded values, no feature flags in code
- **No secrets in git** -- ever. `.env.example` has placeholders only
- **Fail fast** -- validate all config at startup; crash with clear error messages before accepting traffic
- **Single source of truth** -- Zod schema defines every variable, its type, whether it's required, and its default
- **Type-safe access** -- all config accessed through a typed `config` object, never raw `process.env`

---

## 2. Environment Files

| File | In Git | Purpose |
|------|--------|---------|
| `.env.example` | Yes | Documents all variables with placeholder values |
| `.env.local` | No | Developer overrides (personal credentials, local paths) |
| `.env.test` | Yes | Test environment defaults (deterministic, no external services) |
| `.env.production` | No | Production values, deployed via CI/secrets manager |

### Load Order (highest priority wins)
1. Actual environment variables (always win)
2. `.env.local` (dev only)
3. `.env.test` (when `NODE_ENV=test`)
4. `.env.example` (fallback defaults)

---

## 3. Complete Environment Variables

### `.env.example`

```bash
# =============================================================================
# Bush Platform - Environment Variables
# =============================================================================
# Copy to .env.local and fill in real values.
# Variables marked [REQUIRED] have no defaults and must be set.
# Variables marked [SECRET] must never be committed to git.
# =============================================================================

# -- App --
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=debug                          # debug | info | warn | error
APP_URL=http://localhost:3000            # Next.js frontend URL
API_URL=http://localhost:3001            # Hono backend URL

# -- Database (SQLite) --
DATABASE_URL=./data/bush.db              # Relative to project root
DATABASE_WAL_MODE=true
DATABASE_BUSY_TIMEOUT=5000

# -- Redis --
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=bush:

# -- WorkOS AuthKit [REQUIRED] [SECRET] --
WORKOS_API_KEY=sk_test_...               # [SECRET] WorkOS API key
WORKOS_CLIENT_ID=client_...              # [REQUIRED] WorkOS client ID
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_WEBHOOK_SECRET=whsec_...          # [SECRET] WorkOS webhook signing secret
WORKOS_COOKIE_PASSWORD=                   # [SECRET] Cookie encryption password (min 32 chars). Uses SESSION_SECRET if not set.

# -- Object Storage (S3-compatible) --
STORAGE_PROVIDER=minio                   # minio | s3 | r2 | b2
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minioadmin            # [SECRET] S3 access key
STORAGE_SECRET_KEY=minioadmin            # [SECRET] S3 secret key
STORAGE_BUCKET=bush-primary
STORAGE_BUCKET_DERIVATIVES=              # Optional, defaults to primary bucket

# -- CDN --
CDN_PROVIDER=none                        # none | bunny | cloudfront | fastly
CDN_BASE_URL=                            # Empty for dev (serves from storage direct)
CDN_SIGNING_KEY=                         # [SECRET] CDN signing key

# -- Media Processing --
FFMPEG_PATH=/usr/bin/ffmpeg              # Path to ffmpeg binary
FFPROBE_PATH=/usr/bin/ffprobe            # Path to ffprobe binary
MEDIA_TEMP_DIR=./data/tmp                # Temp directory for processing
MEDIA_MAX_CONCURRENT_JOBS=2              # Concurrent FFmpeg processes

# -- Email (SMTP) --
SMTP_HOST=localhost
SMTP_PORT=1025                           # Mailpit default port
SMTP_USER=
SMTP_PASS=                               # [SECRET]
SMTP_FROM=noreply@bush.local
SMTP_SECURE=false                        # true for TLS in production

# -- Next.js Public Variables --
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_APP_NAME=Bush

# -- Session --
SESSION_SECRET=change-me-in-production   # [SECRET] Session encryption key
SESSION_MAX_AGE=604800                   # 7 days in seconds

# -- Rate Limiting --
RATE_LIMIT_WINDOW_MS=60000               # 1 minute
RATE_LIMIT_MAX_REQUESTS=100              # Per window per IP

# -- Upload --
UPLOAD_MAX_FILE_SIZE=10737418240         # 10 GB in bytes
UPLOAD_PRESIGNED_URL_EXPIRY=3600         # 1 hour in seconds
UPLOAD_MULTIPART_CHUNK_SIZE=10485760     # 10 MB

# -- Backup --
BACKUP_STORAGE_BUCKET=bush-backups
LITESTREAM_ENABLED=false                 # Enable SQLite streaming backup
```

---

## 4. Config Validation Schema

Zod schema at `src/config/env.ts` -- imported by both backend and frontend server code.

```typescript
import { z } from "zod";

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_WAL_MODE: z.coerce.boolean().default(true),
  DATABASE_BUSY_TIMEOUT: z.coerce.number().int().positive().default(5000),

  // Redis
  REDIS_URL: z.string().min(1),
  REDIS_KEY_PREFIX: z.string().default("bush:"),

  // WorkOS
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url(),
  WORKOS_WEBHOOK_SECRET: z.string().min(1),
  WORKOS_COOKIE_PASSWORD: z.string().min(32).optional(), // For AuthKit SDK encryption

  // Storage
  STORAGE_PROVIDER: z.enum(["minio", "s3", "r2", "b2"]).default("minio"),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_BUCKET_DERIVATIVES: z.string().optional(),

  // CDN
  CDN_PROVIDER: z.enum(["none", "bunny", "cloudfront", "fastly"]).default("none"),
  CDN_BASE_URL: z.string().url().optional().or(z.literal("")),
  CDN_SIGNING_KEY: z.string().optional(),

  // Media
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),
  FFPROBE_PATH: z.string().default("/usr/bin/ffprobe"),
  MEDIA_TEMP_DIR: z.string().default("./data/tmp"),
  MEDIA_MAX_CONCURRENT_JOBS: z.coerce.number().int().positive().default(2),

  // Email
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().email().default("noreply@bush.local"),
  SMTP_SECURE: z.coerce.boolean().default(false),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE: z.coerce.number().int().positive().default(604800),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // Upload
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().int().positive().default(10737418240),
  UPLOAD_PRESIGNED_URL_EXPIRY: z.coerce.number().int().positive().default(3600),
  UPLOAD_MULTIPART_CHUNK_SIZE: z.coerce.number().int().positive().default(10485760),

  // Backup
  BACKUP_STORAGE_BUCKET: z.string().default("bush-backups"),
  LITESTREAM_ENABLED: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
```

### Key Design Decisions
- **`z.coerce`** handles string-to-number/boolean conversion (all env vars are strings)
- **`.default()`** for optional vars with sensible defaults
- **No `.optional()`** on secrets -- forces explicit configuration
- **`safeParse`** gives all errors at once, not just the first one
- **`process.exit(1)`** on failure -- never start with bad config
- **Build phase bypass**: During `NEXT_PHASE=phase-production-build`, config validation is skipped and placeholder values are used (Next.js builds don't have runtime secrets)

---

## 5. Production Configuration

### What Changes Between Dev and Prod

| Variable | Dev Value | Prod Value |
|----------|-----------|------------|
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` or `warn` |
| `APP_URL` | `http://localhost:3000` | `https://app.bush.com` |
| `API_URL` | `http://localhost:3001` | `https://api.bush.com` |
| `DATABASE_URL` | `./data/bush.db` | `/var/data/bush.db` |
| `STORAGE_PROVIDER` | `minio` | `r2` / `s3` / `b2` |
| `STORAGE_ENDPOINT` | `http://localhost:9000` | Provider endpoint |
| `CDN_PROVIDER` | `none` | `bunny` |
| `CDN_BASE_URL` | (empty) | `https://cdn.bush.com` |
| `SMTP_HOST` | `localhost` (Mailpit) | Production SMTP provider |
| `SMTP_SECURE` | `false` | `true` |
| `LITESTREAM_ENABLED` | `false` | `true` |
| `SESSION_SECRET` | dev placeholder | 64+ char random string |
| All `[SECRET]` vars | Dev/test credentials | Production credentials |

### Secret Sourcing in Production

| Secret | Source |
|--------|--------|
| `WORKOS_API_KEY` | GitHub Secrets -> deployment env |
| `WORKOS_CLIENT_ID` | GitHub Secrets -> deployment env |
| `WORKOS_WEBHOOK_SECRET` | GitHub Secrets -> deployment env |
| `WORKOS_COOKIE_PASSWORD` | GitHub Secrets -> deployment env |
| `STORAGE_ACCESS_KEY` | GitHub Secrets -> deployment env |
| `STORAGE_SECRET_KEY` | GitHub Secrets -> deployment env |
| `CDN_SIGNING_KEY` | GitHub Secrets -> deployment env |
| `SMTP_PASS` | GitHub Secrets -> deployment env |
| `SESSION_SECRET` | GitHub Secrets -> deployment env |

---

## 6. Secrets Management

### Principles
- **No secrets manager initially** -- environment variables on host, sourced from GitHub Secrets via CI/CD
- **Upgrade path**: migrate to HashiCorp Vault or AWS Secrets Manager when needed (abstraction layer in place)
- **Never log secrets** -- scrub from all log output (see below)
- **Never return secrets in API responses**
- **Rotate without downtime** -- secrets are read at startup; rotation requires restart (acceptable for initial deployment)

### Secret Scrubbing

```typescript
// Middleware: scrub secrets from log output
const SECRET_KEYS = [
  "WORKOS_API_KEY", "WORKOS_WEBHOOK_SECRET", "WORKOS_COOKIE_PASSWORD",
  "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY",
  "CDN_SIGNING_KEY", "SMTP_PASS", "SESSION_SECRET",
];

function scrubSecrets(message: string): string {
  for (const key of SECRET_KEYS) {
    const value = process.env[key];
    if (value && value.length > 4) {
      message = message.replaceAll(value, `[REDACTED:${key}]`);
    }
  }
  return message;
}
```

### Secret Rotation Strategy

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| `WORKOS_API_KEY` | On compromise or annually | Generate new key in WorkOS dashboard, update GitHub Secret, redeploy |
| `STORAGE_ACCESS_KEY/SECRET_KEY` | On compromise or annually | Create new key pair in provider, update GitHub Secret, redeploy, delete old key |
| `CDN_SIGNING_KEY` | On compromise | Rotate in CDN dashboard, update GitHub Secret, redeploy |
| `SESSION_SECRET` | On compromise | Update secret, redeploy (all active sessions invalidated) |
| `WORKOS_WEBHOOK_SECRET` | On compromise | Rotate in WorkOS dashboard, update GitHub Secret, redeploy |

### GitHub Secrets Setup
- All secrets stored in GitHub repository settings -> Secrets and variables -> Actions
- Environment-specific secrets: `production` and `staging` environments in GitHub
- CI/CD workflow injects secrets as environment variables during deployment
- Secrets are masked in GitHub Actions logs automatically

---

## 7. Local Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | >= 1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | >= 22 | Required for Next.js (tsx uses Node runtime) |
| Redis | >= 7.0 | `brew install redis` or `apt install redis-server` |
| FFmpeg | >= 6.0 | `brew install ffmpeg` or `apt install ffmpeg` |
| MinIO | latest | `brew install minio/stable/minio` or binary download |
| Mailpit | latest | `brew install mailpit` or binary download |

### Step-by-Step

```bash
# 1. Clone and install dependencies
git clone git@github.com:org/bush.git
cd bush
bun install

# 2. Create local env file
cp .env.example .env.local

# 3. Start Redis
redis-server --daemonize yes

# 4. Start MinIO (local S3)
mkdir -p ./data/minio
minio server ./data/minio --console-address ":9001"
# Default credentials: minioadmin / minioadmin
# Console: http://localhost:9001
# API: http://localhost:9000

# 5. Create MinIO bucket
# Via console UI at http://localhost:9001 or:
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/bush-primary

# 6. Start Mailpit (local email)
mailpit
# SMTP: localhost:1025
# Web UI: http://localhost:8025

# 7. Edit .env.local with your values
# - Set WORKOS_API_KEY and WORKOS_CLIENT_ID from your WorkOS dev account
# - Set SESSION_SECRET to any 32+ char string for dev
# - Other defaults should work as-is

# 8. Initialize database
bun run db:migrate

# 9. Start development servers
bun run dev          # Starts both backend and frontend
# Or separately:
bun run dev:api      # Hono API on port 3001
bun run dev:web      # Next.js on port 3000
```

### Dev Server Architecture

The platform runs two development servers:

- **API server** (`:3001`): Hono + tsx, loaded via `tsx watch --env-file=.env.local src/api/index.ts`
- **Web server** (`:3000`): Next.js, loaded via `bash -c 'set -a; source .env.local; set +a; PORT=3000 exec next dev src/web'`

**Why the `dev:web` workaround?** Next.js looks for `.env.local` relative to the app root (`src/web/`), but the project's `.env.local` is at the repository root. The script sources `.env.local` into the shell environment so Next.js gets all the env vars (WorkOS keys, Redis URL, etc.). `PORT=3000` overrides the `PORT=3001` value from `.env.local` (which is the API port) to prevent the two servers from colliding.

Next.js also proxies `/v4/*` requests to the Hono API via rewrites in `next.config.ts`, so browser requests don't cross origins and cookies are forwarded transparently. See `specs/12-authentication.md` "Next.js → Hono API Proxy" for details.

### WorkOS Dev Account Setup
1. Create a free account at [workos.com](https://workos.com)
2. Create an environment (Development)
3. Enable AuthKit in the WorkOS dashboard
4. Configure redirect URI: `http://localhost:3000/auth/callback`
5. Copy API Key (`sk_test_...`) and Client ID (`client_...`) to `.env.local`
6. Set `WORKOS_COOKIE_PASSWORD` to a random 32+ character string (or leave blank to use `SESSION_SECRET`)
7. Set up a webhook endpoint (use a tunnel like `ngrok` or WorkOS CLI for local testing)

**Important:** The redirect URI in the WorkOS dashboard must match `NEXT_PUBLIC_WORKOS_REDIRECT_URI` in `.env.local` exactly. The AuthKit SDK reads this variable (the `NEXT_PUBLIC_` prefix is required).

### Verifying Local Setup
```bash
# Check Redis
redis-cli ping                    # Should return PONG

# Check MinIO
curl http://localhost:9000/minio/health/live   # Should return 200

# Check FFmpeg
ffmpeg -version                   # Should show version info

# Check Mailpit
curl http://localhost:8025/api/v1/messages     # Should return empty array
```

---

## 8. Test Environment

`.env.test` provides deterministic, isolated configuration:

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
SMTP_HOST=localhost
SMTP_PORT=1025
SESSION_SECRET=test-session-secret-at-least-32-chars-long
```

- Uses in-memory SQLite for speed and isolation
- Separate Redis key prefix to avoid collision with dev data
- Separate MinIO bucket (`bush-test`)
- WorkOS calls mocked in tests (no real API calls)

---

## 9. gitignore Rules

```gitignore
# Environment files
.env.local
.env.production
.env.*.local

# Database
data/
*.db
*.db-wal
*.db-shm

# MinIO data
data/minio/

# Media temp files
data/tmp/

# Dependencies
node_modules/

# Build output
.next/
dist/

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/

# Logs
*.log
```

**Committed files:**
- `.env.example` -- variable documentation with placeholders
- `.env.test` -- deterministic test configuration
- `.gitignore`

---

## 10. Next.js Public Variables

Next.js requires `NEXT_PUBLIC_` prefix for client-side variables. These are **not secrets** -- they are embedded in the JavaScript bundle sent to browsers.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (optional — web client uses Next.js proxy in browser) |
| `NEXT_PUBLIC_WS_URL` | WebSocket connection URL |
| `NEXT_PUBLIC_APP_NAME` | Application display name |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | WorkOS AuthKit redirect URI (required by AuthKit SDK) |

- Never prefix a secret with `NEXT_PUBLIC_` -- it will be exposed to all users
- Server-side Next.js code (API routes, Server Components) can access all env vars without the prefix
- The `NEXT_PUBLIC_WORKOS_REDIRECT_URI` is an exception: it's not a secret (it's a URL), but the `NEXT_PUBLIC_` prefix is required by the AuthKit SDK internals
- In the browser, API calls use relative `/v4` paths (routed through Next.js rewrite proxy to the Hono backend), so `NEXT_PUBLIC_API_URL` is not used for browser requests

---

## 11. Config Access Patterns

### Backend (Hono)
```typescript
import { config } from "../config/index.js";

// Type-safe, validated at startup
const port = config.PORT;           // number
const redisUrl = config.REDIS_URL;  // string
```

### Frontend Server (Next.js Server Components / API Routes)
```typescript
import { config } from "../config/index.js";

// Same validated config object
const apiKey = config.WORKOS_API_KEY;
```

### Frontend Client (Next.js Client Components)
```typescript
// Only NEXT_PUBLIC_ vars available
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

---

## 12. Health Check Endpoint

The backend exposes `GET /health` which verifies:
- Config loaded successfully (implicit -- server wouldn't start otherwise)
- Database connection (SQLite read query)
- Redis connection (PING)
- Storage connectivity (HEAD bucket)

Returns `200 OK` with component status, or `503 Service Unavailable` if any dependency is down.
