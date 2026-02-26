# Bush - Billing & Plans

## Overview

Usage-based billing with a generous free tier and pay-per-unit overages. The two billable dimensions are storage (GB of files stored) and processing (minutes of media transcoded or transcribed). Team seats are unlimited and not a billing dimension. When a free-tier account exceeds a limit, enforcement is a soft block: existing content remains fully accessible for viewing, commenting, downloading, and sharing — only the specific operation that requires more of the limited resource is blocked. Billing provider is Stripe, using Stripe Meters for usage-based billing. The metering architecture is specified here; exact price points are set at launch and not part of this spec.

---

## 1. Plans and Limits

### 1.1 Free Tier

| Dimension | Free limit | Enforcement |
|-----------|------------|-------------|
| Storage | 5 GB total | Soft block on new uploads |
| Processing | 60 minutes/month | Soft block on new processing jobs |
| Seats / team members | Unlimited | Not metered |
| Projects | Unlimited | Not metered |
| Share links | Unlimited | Not metered |
| Workspaces | 1 | Not metered |

### 1.2 Paid Tier (Overage Model)

When an account exceeds free-tier limits, overages are billed at per-unit rates via Stripe Meters. Exact pricing TBD.

| Dimension | Meter unit | Billing cadence |
|-----------|-----------|-----------------|
| Storage overage | GB-month (daily average) | Monthly |
| Processing overage | Minutes consumed above free 60 | Monthly |

Accounts must have a Stripe payment method on file to be billed for overages. If no payment method exists and the account is over limit, the soft block applies as described in section 3.

---

## 2. Usage Meters

### 2.1 Storage

**What is counted**: original uploaded file bytes + all derivative files (proxies, thumbnails, filmstrips, waveform images, HLS segments). Both the primary S3 bucket and the derivatives bucket count against the same storage meter.

**Unit**: bytes in the database, displayed as GB to users.

**Where stored**: `accounts.storage_used_bytes` (integer, NOT NULL, default 0).

**Update events**:

| Event | Operation | Amount |
|-------|-----------|--------|
| Upload complete (multipart finalized) | Increment | `file.size_bytes` (original) |
| Processing complete | Increment | Sum of derivative sizes (fetched from S3 `HeadObject`) |
| File deleted | Decrement | `file.size_bytes` + sum of derivative sizes |
| File version added | Increment | New version `size_bytes` |
| File version deleted | Decrement | Deleted version `size_bytes` + derivatives |

**Consistency**: storage increments/decrements happen inside the same SQLite write transaction as the file record change. Storage used is always eventually consistent with actual S3 usage (S3 object sizes are trusted as reported; no reconciliation job in MVP).

**Reconciliation (Phase 2)**: a nightly BullMQ job computes actual S3 usage for the account and corrects `storage_used_bytes` if it drifts more than 1% from the metered value.

### 2.2 Processing

**What is counted**: duration in seconds of the source media file for each completed transcoding or transcription job. Not the wall-clock time of the job — the duration of the media itself.

**Unit**: seconds in the database, displayed as minutes to users.

**Where stored**: `accounts.processing_used_seconds_month` (integer, NOT NULL, default 0).

**Reset**: on the first day of each calendar month, a scheduled BullMQ job resets `processing_used_seconds_month = 0` for all accounts. The reset timestamp is stored in `accounts.processing_reset_at`.

**Update events**:

| Job type | Increment amount | Trigger |
|----------|-----------------|---------|
| Proxy transcode | `file.duration_seconds` | BullMQ `media:proxy` completion callback |
| Transcription | `file.duration_seconds` | BullMQ `transcription` completion callback |
| Thumbnail generation | 0 (not metered) | — |
| Filmstrip generation | 0 (not metered) | — |
| Waveform generation | 0 (not metered) | — |

Only transcode and transcription are metered because they are the CPU-intensive operations. Thumbnail and filmstrip jobs are fast enough to include in the free tier without metering.

**Idempotency**: each BullMQ job stores its own `accountId` and `fileDurationSeconds` in the job data. The completion callback checks a `processing_jobs_accounted` table (a set of job IDs) before incrementing — if the job ID is already present, skip the increment. This prevents double-counting on job retries.

---

## 3. Soft-Block Enforcement

### 3.1 Storage Block

**Trigger**: `accounts.storage_used_bytes >= storage_limit_bytes` (5 GB = 5,368,709,120 bytes for free tier).

**Blocked operations**:
- `POST /v4/projects/:id/files` (new upload)
- `POST /v4/files/:id/versions` (version replacement upload)

**Allowed operations** (no restriction):
- Viewing files, playback, thumbnails
- Downloading files
- Commenting and annotations
- Sharing (creating share links, accessing existing shares)
- Metadata editing
- Renaming, moving files
- Deleting files (which also reduces storage — always allowed)
- Exporting transcripts or captions

**API response when blocked**:
```json
HTTP 402 Payment Required
{
  "error": {
    "code": "STORAGE_LIMIT_EXCEEDED",
    "message": "Your account has reached its storage limit (5 GB). Delete files or upgrade to continue uploading.",
    "details": {
      "storage_used_bytes": 5400000000,
      "storage_limit_bytes": 5368709120,
      "upgrade_url": "https://bush.io/settings/billing"
    }
  }
}
```

**Frontend**: upload buttons are disabled and show a tooltip when the account is over its storage limit. The account usage page shows a prominent warning banner.

### 3.2 Processing Block

**Trigger**: `accounts.processing_used_seconds_month >= processing_limit_seconds_month` (60 minutes = 3600 seconds for free tier).

**Blocked operations**:
- New uploads that would trigger transcoding (video, audio files)
- Manual re-process requests

**Behavior**: files upload normally but remain in `status = 'pending_processing'`. They are not enqueued for transcoding or transcription. The user sees the file in the library with a "Pending — upgrade to process" state. When the account's processing limit resets at the start of the next month (or the account upgrades), `pending_processing` files are automatically enqueued.

**Allowed operations**:
- Viewing already-processed files
- All metadata, commenting, sharing operations
- Uploading image or document files (no processing minutes consumed)

**API response when processing is blocked**: upload succeeds (`201 Created`) with the file in `pending_processing` status. The response includes a `processing_blocked: true` field and a `reason` explaining the limit.

---

## 4. Data Model

### 4.1 Changes to `accounts` table

Add the following columns:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `storage_used_bytes` | integer | `0` | Current total storage used across all files and derivatives |
| `storage_limit_bytes` | integer | `5368709120` | Storage limit (5 GB for free tier) |
| `processing_used_seconds_month` | integer | `0` | Processing consumed this billing month |
| `processing_limit_seconds_month` | integer | `3600` | Processing limit per month (60 min free tier) |
| `processing_reset_at` | datetime | now | When the monthly processing counter last reset |
| `stripe_customer_id` | text | null | Stripe Customer object ID |
| `stripe_subscription_id` | text | null | Stripe Subscription object ID (null for free-tier-only accounts) |
| `plan` | text | `'free'` | `'free'` \| `'paid'` |
| `billing_email` | email | null | Override billing contact (defaults to account owner email) |

### 4.2 `processing_jobs_accounted` table

Idempotency table for processing increments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `job_id` | text | PK | BullMQ job ID |
| `account_id` | text | FK → accounts.id | Account |
| `duration_seconds` | integer | NOT NULL | Amount that was credited |
| `created_at` | datetime | NOT NULL, default now | When the increment happened |

Rows older than 90 days are purged by the nightly cleanup job (safe — BullMQ retries will not reappear after 90 days).

---

## 5. Stripe Integration

**Phase tag**: Phase 2.

### 5.1 Customer Lifecycle

| Event | Stripe action |
|-------|---------------|
| Account created | Lazily create Stripe Customer on first billing action |
| Payment method added | Attach to Stripe Customer, set as default |
| Account deleted | Cancel active subscription, mark customer as deleted |

### 5.2 Usage Reporting (Stripe Meters)

Bush uses [Stripe Meters](https://stripe.com/docs/billing/subscriptions/usage-based) for usage-based billing. At the end of each billing period, usage is reported via Meter Events:

| Meter | Stripe event name | Reported value |
|-------|------------------|----------------|
| Storage | `bush_storage_gb_month` | Daily average GB stored (computed from `storage_used_bytes` snapshots) |
| Processing | `bush_processing_minutes` | Total minutes consumed above free tier threshold |

Storage snapshots: a nightly BullMQ job reads `storage_used_bytes` for every paid account and records the daily snapshot to a `storage_snapshots` table. At billing period end, the monthly average is computed and reported to Stripe.

### 5.3 Webhook Handlers

`POST /v4/webhooks/stripe` handles Stripe events:

| Stripe event | Bush action |
|-------------|-------------|
| `invoice.payment_succeeded` | Record payment, clear any access restrictions, log |
| `invoice.payment_failed` | Log, flag account for outreach (no immediate hard block) |
| `customer.subscription.updated` | Sync `plan`, `storage_limit_bytes`, `processing_limit_seconds_month` |
| `customer.subscription.deleted` | Downgrade account to free tier limits |
| `payment_method.attached` | Log, clear any "no payment method" flags |

Webhook signature verified using `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent()`. Events that fail signature verification are rejected with `400 Bad Request`.

### 5.4 Billing Portal

Stripe's hosted Customer Portal is used for all billing management (view invoices, change payment method, cancel plan). Bush redirects to the portal URL from the billing settings page — no custom billing UI needed.

Portal session created via `POST /v4/billing/portal` → returns `{ url: "https://billing.stripe.com/..." }`. Frontend redirects to this URL.

---

## 6. Usage Dashboard

**Phase tag**: Phase 2.

Location: Settings > Usage (accessible to account Owner and Content Admin roles).

Display:

```
Storage
  [============================    ] 4.2 GB of 5.0 GB used (84%)
  Breakdown: 3.1 GB original files · 1.1 GB derivatives

Processing this month  (resets Feb 1)
  [================                ] 38 of 60 minutes used (63%)
  Breakdown: 32 min transcoding · 6 min transcription

Billing
  Plan: Free
  [Upgrade] button
```

For paid accounts: add billing history table (invoice date, amount, status, download link).

Data served by `GET /v4/billing/usage`:
```json
{
  "storage": {
    "used_bytes": 4508876800,
    "limit_bytes": 5368709120,
    "used_gb": 4.2,
    "limit_gb": 5.0,
    "percent": 84
  },
  "processing": {
    "used_seconds": 2280,
    "limit_seconds": 3600,
    "used_minutes": 38,
    "limit_minutes": 60,
    "resets_at": "2026-03-01T00:00:00Z",
    "percent": 63
  },
  "plan": "free",
  "stripe_customer_id": null
}
```

---

## 7. API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/v4/billing/usage` | Current usage and limits | Account Owner, Content Admin |
| `POST` | `/v4/billing/portal` | Create Stripe portal session, return URL | Account Owner |
| `POST` | `/v4/webhooks/stripe` | Stripe webhook receiver | Stripe signature (no user auth) |

---

## 8. Configuration

Add to `src/config/env.ts`:

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `STRIPE_SECRET_KEY` | string | — | When billing enabled | Yes | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_PUBLISHABLE_KEY` | string | — | When billing enabled | No | Stripe publishable key (`pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | string | — | When billing enabled | Yes | Webhook signing secret (`whsec_...`) |
| `STRIPE_STORAGE_METER_ID` | string | — | When billing enabled | No | Stripe Meter ID for storage |
| `STRIPE_PROCESSING_METER_ID` | string | — | When billing enabled | No | Stripe Meter ID for processing |
| `FREE_TIER_STORAGE_BYTES` | number | `5368709120` | No | No | Free storage limit (5 GB) |
| `FREE_TIER_PROCESSING_SECONDS` | number | `3600` | No | No | Free processing limit (60 min) |

New secrets to add to `SECRET_KEYS` in `src/config/env.ts`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

## 9. Phase Summary

| Feature | Phase |
|---------|-------|
| Free tier limits in data model | MVP |
| Storage metering (increment/decrement on upload/delete) | MVP |
| Processing metering (increment on job completion) | MVP |
| Soft-block enforcement on upload and processing | MVP |
| Pending-processing queue for over-limit accounts | MVP |
| `GET /v4/billing/usage` endpoint | MVP |
| Stripe Customer creation | Phase 2 |
| Stripe Meters usage reporting | Phase 2 |
| Stripe webhook handlers | Phase 2 |
| Stripe Customer Portal integration | Phase 2 |
| Usage dashboard UI | Phase 2 |
| Storage reconciliation job | Phase 2 |
| Overage invoice notifications | Phase 2 |
| Per-workspace billing | Future |
| Annual billing option | Future |

---

## Cross-References

- `06-storage.md` — S3 storage layer, derivative storage, storage key conventions
- `07-media-processing.md` — BullMQ job completion callbacks where processing minutes are incremented
- `08-transcription.md` — transcription job completion where processing minutes are incremented
- `04-api-reference.md` — API conventions, error codes (`402 Payment Required`), authentication
- `02-authentication.md` — account owner/admin roles that control billing access
- `30-configuration.md` — env var patterns, secrets management
