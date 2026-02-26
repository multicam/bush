# Bush - Email System

## Overview

Transactional email delivery for notifications, invitations, processing results, and authentication flows. The system is built on a `EmailService` interface so the underlying provider (Resend, SendGrid, SES, Postmark) can be swapped at deploy time via environment variables. All emails are plain text — no HTML templates for MVP. Emails are dispatched asynchronously via a BullMQ queue (`email:send`) so route handlers and worker callbacks never block on SMTP or provider API calls. A console provider logs to stdout for local development without requiring any external service.

---

## 1. Provider Abstraction

### 1.1 Interface

All email sending goes through a single interface in `src/email/service.ts`:

```typescript
interface EmailMessage {
  to: string | string[];         // recipient address(es)
  subject: string;
  body: string;                  // plain-text body (HTML body added Phase 2)
  replyTo?: string;
  headers?: Record<string, string>;
}

interface EmailResult {
  messageId: string;
  provider: string;
}

interface EmailService {
  send(message: EmailMessage): Promise<EmailResult>;
  isHealthy(): Promise<boolean>;  // used by /health endpoint
}
```

### 1.2 Providers

| Provider | `EMAIL_PROVIDER` value | Auth mechanism | Notes |
|----------|----------------------|----------------|-------|
| Resend | `resend` | `RESEND_API_KEY` | Preferred for new deployments |
| SendGrid | `sendgrid` | `SENDGRID_API_KEY` | Established option |
| Amazon SES | `ses` | `AWS_SES_ACCESS_KEY` + `AWS_SES_SECRET_KEY` | Region via `AWS_SES_REGION` |
| Postmark | `postmark` | `POSTMARK_SERVER_TOKEN` | Strong deliverability |
| Console (dev) | `console` | — | Logs to stdout, always succeeds |
| SMTP | `smtp` | `SMTP_*` vars (already defined) | Fallback / Mailpit for dev |

Provider is instantiated at startup in `src/email/factory.ts` and injected as a singleton. If `EMAIL_PROVIDER` is not set, defaults to `smtp` (which works with the existing `SMTP_*` variables and Mailpit for dev).

### 1.3 Provider Selection Logic

```typescript
function createEmailService(config: Config): EmailService {
  switch (config.EMAIL_PROVIDER) {
    case 'resend':    return new ResendEmailService(config);
    case 'sendgrid':  return new SendGridEmailService(config);
    case 'ses':       return new SESEmailService(config);
    case 'postmark':  return new PostmarkEmailService(config);
    case 'console':   return new ConsoleEmailService();
    case 'smtp':
    default:          return new SMTPEmailService(config);
  }
}
```

---

## 2. Email Queue

All emails are sent asynchronously via BullMQ. No route handler or worker callback calls `emailService.send()` directly.

**Queue name**: `email:send`

**Job payload**:
```typescript
interface EmailJob {
  type: EmailType;               // see section 3
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, string>;  // for logging / analytics
}
```

**Queue configuration**:
| Setting | Value | Rationale |
|---------|-------|-----------|
| Concurrency | 5 | Avoid provider rate limits |
| Attempts | 3 | Retry transient failures |
| Backoff | exponential, 60s base | Avoid hammering provider on failure |
| Remove on complete | after 7 days | Audit trail |
| Remove on fail | after 30 days | Debugging |

**Enqueue from code**:
```typescript
import { emailQueue } from '../email/queue.js';

await emailQueue.add('send', {
  type: 'comment_notification',
  to: user.email,
  subject: 'New comment on video.mp4',
  body: buildCommentNotificationBody(comment, file, project),
});
```

---

## 3. Email Types and Templates

All templates are plain text for MVP. Each template is a function in `src/email/templates/` that returns `{ subject, body }`.

### 3.1 Format Rules

- Max line length: 72 characters (wraps cleanly in all email clients).
- Action URL on its own line, preceded and followed by a blank line.
- Footer separator: `---` followed by a one-line tagline and the unsubscribe link.
- No images, no HTML, no inline CSS.

**Standard template structure**:
```
{greeting}

{body_paragraph}

{action_url}

---
Bush — bush.io
To stop receiving these emails: {unsubscribe_url}
```

### 3.2 `comment_notification`

**Trigger**: `notifications` service when delivering a `comment_added` or `comment_reply` notification via email.

**Phase tag**: MVP.

```
Subject: New comment on {file_name}

{actor_name} left a comment on {file_name} in {project_name}:

  "{comment_body_truncated_to_200_chars}"

View comment:
{comment_url}

---
Bush — bush.io
To stop receiving these emails: {unsubscribe_url}
```

### 3.3 `mention_notification`

**Trigger**: `mention` notification type.

**Phase tag**: MVP.

```
Subject: {actor_name} mentioned you in {project_name}

{actor_name} mentioned you in a comment on {file_name}:

  "{comment_body_truncated_to_200_chars}"

View comment:
{comment_url}

---
Bush — bush.io
To stop receiving these emails: {unsubscribe_url}
```

### 3.4 `project_invitation`

**Trigger**: user invited to a project.

**Phase tag**: MVP.

```
Subject: You've been invited to {project_name}

{actor_name} has invited you to collaborate on {project_name}
in {workspace_name}.

Accept invitation:
{invitation_url}

This link expires in 7 days.

---
Bush — bush.io
```

Note: invitation emails do not include an unsubscribe link — they are transactional actions initiated by a specific user, not recurring notifications.

### 3.5 `share_notification`

**Trigger**: share link created, recipient is an external reviewer with a known email address.

**Phase tag**: MVP.

```
Subject: {actor_name} shared {file_or_project_name} with you

{actor_name} has shared {file_or_project_name} with you for review.

{share_message_if_provided}

View files:
{share_url}

{expiry_line_if_applicable}

---
Bush — bush.io
```

### 3.6 `file_processing_complete`

**Trigger**: BullMQ media processing worker on job completion.

**Phase tag**: MVP.

```
Subject: {file_name} is ready

{file_name} has finished processing and is ready to view.

View file:
{file_url}

---
Bush — bush.io
To stop receiving these emails: {unsubscribe_url}
```

### 3.7 `file_processing_failed`

**Trigger**: BullMQ media processing worker on permanent job failure (all retries exhausted).

**Phase tag**: MVP.

```
Subject: Processing failed for {file_name}

We were unable to process {file_name}. This may be due to an
unsupported format or a corrupted file.

You can try uploading the file again or contact support if
the issue persists.

View file:
{file_url}

Support: support@bush.io

---
Bush — bush.io
To stop receiving these emails: {unsubscribe_url}
```

### 3.8 `password_reset`

**Phase tag**: Not implemented by Bush. Handled entirely by WorkOS AuthKit (WorkOS sends the password reset email directly). Bush does not send password reset emails.

### 3.9 `weekly_digest`

**Phase tag**: Phase 2.

A summary of activity across the user's projects in the past 7 days. BullMQ scheduled job runs every Monday at 09:00 in the account's timezone (default UTC). Content: new files uploaded, comments left, shares created. Only sent if there was activity. Subject: "Your Bush activity for {date_range}".

---

## 4. Unsubscribe

Every notification email (all types except `project_invitation`) includes a one-click unsubscribe link in the footer:

```
{APP_URL}/unsubscribe?token={unsubscribe_token}&type={notification_type}
```

**Token**: HMAC-SHA256 of `userId + notificationType + secret`, base64url-encoded. No database row needed — the token is self-verifying.

**Unsubscribe handler** (`GET /unsubscribe`): verifies the token, sets `notification_preferences.email_enabled = false` for the given type, shows a confirmation page ("You've been unsubscribed from {type} emails. You can manage all preferences in Settings.").

One-click unsubscribe (RFC 8058) header is included in every notification email:
```
List-Unsubscribe: <{unsubscribe_url}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

---

## 5. Rate Limiting

**Per-account limit**: 100 emails per hour. Enforced by a Redis counter:
- Key: `bush:email:rate:{accountId}:{hour_bucket}` (TTL: 2 hours)
- Increment on every email enqueued. If counter exceeds 100, the job is rejected and logged at `warn` level.
- Rationale: bulk operations (e.g., inviting 50 users at once) should not generate 50 simultaneous emails; the notification aggregation in Phase 2 further reduces volume.

**Global send-rate**: The email queue concurrency of 5 naturally limits throughput to ~300 emails/minute assuming 1-second send latency per email.

---

## 6. Configuration

Add to `src/config/env.ts`. Variables marked as secret are added to the `SECRET_KEYS` array and scrubbed from logs.

| Variable | Type | Default | Required | Secret | Description |
|----------|------|---------|----------|--------|-------------|
| `EMAIL_PROVIDER` | enum | `smtp` | No | No | `smtp` \| `resend` \| `sendgrid` \| `ses` \| `postmark` \| `console` |
| `EMAIL_FROM` | email | `noreply@bush.io` | No | No | Sender address |
| `EMAIL_REPLY_TO` | email | `support@bush.io` | No | No | Reply-to address |
| `RESEND_API_KEY` | string | — | When provider=resend | Yes | Resend API key |
| `SENDGRID_API_KEY` | string | — | When provider=sendgrid | Yes | SendGrid API key |
| `AWS_SES_ACCESS_KEY` | string | — | When provider=ses | Yes | SES access key |
| `AWS_SES_SECRET_KEY` | string | — | When provider=ses | Yes | SES secret key |
| `AWS_SES_REGION` | string | `us-east-1` | When provider=ses | No | SES region |
| `POSTMARK_SERVER_TOKEN` | string | — | When provider=postmark | Yes | Postmark server token |
| `EMAIL_RATE_LIMIT_PER_HOUR` | number | `100` | No | No | Max emails/hour per account |

Existing `SMTP_*` variables (already in `30-configuration.md`) serve as the default provider.

New secrets to add to the `SECRET_KEYS` array in `src/config/env.ts`:
- `RESEND_API_KEY`
- `SENDGRID_API_KEY`
- `AWS_SES_ACCESS_KEY`
- `AWS_SES_SECRET_KEY`
- `POSTMARK_SERVER_TOKEN`

---

## 7. Dev Environment

- Default provider in dev: `smtp` pointing at Mailpit (`SMTP_HOST=localhost`, `SMTP_PORT=1025`).
- Mailpit UI at `http://localhost:8025` — all sent emails are captured here, nothing reaches real recipients.
- To test a specific provider in dev: set `EMAIL_PROVIDER=console` to see formatted email output in the API process stdout without sending anything.
- `.env.test` uses `EMAIL_PROVIDER=console` (or mocks the email queue entirely in tests).

---

## 8. Logging and Observability

Every email dispatch is logged at `info` level with:
- `type`, `to` (domain only, not full address for PII hygiene), `subject`, `messageId` from provider response
- Queue job ID for correlation

Failed deliveries are logged at `error` level with full error detail (excluding recipient PII beyond domain). After 3 failed attempts, the BullMQ job moves to the dead-letter state and triggers a `warn` log with the job ID for manual inspection.

---

## 9. Phase Summary

| Feature | Phase |
|---------|-------|
| Plain-text transactional emails (all MVP types) | MVP |
| Console provider for dev | MVP |
| BullMQ async queue | MVP |
| Unsubscribe tokens + one-click unsubscribe | MVP |
| Per-account rate limiting | MVP |
| HTML email templates | Phase 2 |
| Weekly digest | Phase 2 |
| Email open/click tracking | Future |

---

## Cross-References

- `10-notifications.md` — notification system that triggers email delivery
- `30-configuration.md` — env var patterns, SMTP variables, secrets management
- `07-media-processing.md` — processing job completion/failure triggers for `file_processing_*` email types
- `08-transcription.md` — transcription completion notifications
- `05-realtime.md` — presence detection used by `10-notifications.md` to decide whether to send email
