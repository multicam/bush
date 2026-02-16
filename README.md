# Bush

Cloud-based creative collaboration platform for video, design, and marketing teams. Upload creative files, manage projects, collect feedback, and share work from a unified workspace.

## Tech Stack

- **API:** Hono + Node.js 22 (TypeScript)
- **Web:** Next.js 15 (App Router, React 19)
- **Database:** SQLite + Drizzle ORM
- **Cache/Sessions:** Redis (ioredis)
- **Storage:** S3-compatible (MinIO for dev, R2/S3/B2 for prod)
- **Auth:** WorkOS AuthKit
- **Media:** FFmpeg/FFprobe

## Prerequisites

- Node.js 22+
- Redis
- [WorkOS](https://workos.com/) account (API key + client ID)
- Optional: MinIO (local S3), FFmpeg/FFprobe

## Setup

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env.local
# Edit .env.local — at minimum set:
#   WORKOS_API_KEY, WORKOS_CLIENT_ID
#   SESSION_SECRET (min 32 chars)
#   REDIS_URL (defaults to redis://localhost:6379)

# Initialize database
bun run db:migrate
bun run db:seed        # optional test data
```

## Development

```bash
# Start API (port 3001) and web (port 3000) together
bun run dev

# Or separately
bun run dev:api
bun run dev:web
```

**Note on `dev:web`:** Next.js doesn't load `.env.local` from the project root when the app lives in a subdirectory (`src/web`). The `dev:web` script works around this by sourcing `.env.local` into the shell environment and overriding `PORT=3000` (since `.env.local` sets `PORT=3001` for the API). See `package.json` for the full command.

### Health check

```bash
curl http://localhost:3001/health
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start API + web in parallel |
| `bun run dev:api` | Start Hono API server (port 3001) |
| `bun run dev:web` | Start Next.js dev server (port 3000, sources `.env.local`) |
| `bun run build` | Build Next.js for production |
| `bun test` | Run tests (Vitest) |
| `bun run test:watch` | Run tests in watch mode |
| `bun run lint` | Lint with ESLint |
| `bun run format` | Format with Prettier |
| `bun run typecheck` | TypeScript type check |
| `bun run db:migrate` | Run database migrations |
| `bun run db:generate` | Generate Drizzle migration files |
| `bun run db:seed` | Seed database with test data |

## Project Structure

```
src/
├── api/          # Hono backend (routes, middleware, rate limiting)
├── web/          # Next.js frontend (pages, components, context)
├── db/           # SQLite schema, migrations, seeds (Drizzle ORM)
├── auth/         # WorkOS AuthKit integration, session cache
├── permissions/  # RBAC permission system
├── config/       # Zod-validated environment config
├── redis/        # Redis client singleton
├── storage/      # S3-compatible storage abstraction
├── shared/       # Shared utilities (file type registry)
└── errors/       # Error handling utilities
specs/            # Product specifications
```

## WorkOS Configuration

Bush uses [WorkOS AuthKit](https://workos.com/docs/user-management) for authentication (email/password, social login, MFA, SSO).

### 1. Create a WorkOS project

Sign up at [workos.com](https://workos.com/) and create a new project.

### 2. Get your credentials

From the WorkOS Dashboard, grab:

- **API Key** (`sk_test_...`) — Settings → API Keys
- **Client ID** (`client_...`) — Settings → API Keys

### 3. Configure the redirect URI

In the WorkOS Dashboard under **Redirects**, add:

```
http://localhost:3000/auth/callback
```

### 4. Set environment variables

Add these to `.env.local`:

```bash
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_COOKIE_PASSWORD=<random-string-min-32-chars>  # optional, falls back to SESSION_SECRET
```

### 5. Enable authentication methods

In the WorkOS Dashboard under **Authentication**, enable the methods you want:

- **Email + Password** — enabled by default
- **Social login** — Google, GitHub, etc. (configure OAuth app per provider)
- **SSO** — for enterprise customers (SAML/OIDC, configure per organization)
- **MFA** — optional second factor

### Webhooks (optional)

To receive auth events (user created, session revoked, etc.):

1. In the WorkOS Dashboard under **Webhooks**, create an endpoint pointing to your API
2. Set the signing secret in `.env.local`:

```bash
WORKOS_WEBHOOK_SECRET=whsec_...
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKOS_API_KEY` | Yes | WorkOS secret API key |
| `WORKOS_CLIENT_ID` | Yes | WorkOS client ID |
| `SESSION_SECRET` | Yes | Session encryption key (min 32 chars) |
| `REDIS_URL` | No | Redis connection (default: `redis://localhost:6379`) |
| `DATABASE_URL` | No | SQLite path (default: `./data/bush.db`) |
| `STORAGE_PROVIDER` | No | `minio` / `s3` / `r2` / `b2` (default: `minio`) |
