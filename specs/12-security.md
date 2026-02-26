# Bush - Security

## Overview

Bush provides security controls appropriate for enterprise creative collaboration: content protection for pre-release media, granular audit logging, organization-wide policy enforcement, data encryption, and hardened API boundaries. Authentication and access control are delegated to `02-authentication.md` and `03-permissions.md` respectively; this spec covers everything else. Compliance certifications (SOC 2 Type 2, TPN+ Gold Shield, ISO 27001) are aspirational design targets — Bush is architected to satisfy their controls, but active certification programs are not a current requirement and are planned for a future phase.

---

## Specification

### 1. Content Security

#### 1.1 Forensic Watermarking — Phase 3

Invisible watermarks embedded in proxy streams, traceable to the specific viewer.

```typescript
interface WatermarkProvider {
  // Embed a watermark into a proxy stream at generation time.
  // Returns the path/URL of the watermarked output.
  embedWatermark(input: MediaSource, identity: ViewerIdentity): Promise<string>;

  // Extract viewer identity from a suspected watermarked asset.
  // Used in forensic analysis; not called during normal playback.
  extractWatermark(sample: MediaSource): Promise<ViewerIdentity | null>;
}

interface ViewerIdentity {
  accountId: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
}
```

Implementation notes:

- Applied server-side during proxy generation; source files are never watermarked
- The encoded payload is: account ID, user ID, session ID, timestamp
- Must survive common transformations: re-encoding, moderate cropping, screen capture
- Configurable per account (enable/disable) and per project (override)
- Extraction requires Bush forensic analysis tooling, not available to end users
- Enterprise plan feature

#### 1.2 Secure Streaming — Phase 2

All streaming URLs are signed and short-lived.

```typescript
interface StreamingUrlSigner {
  // Sign a streaming URL, binding it to the current session.
  // The URL expires after ttlSeconds and is invalid from any other session.
  signUrl(url: string, session: BushSession, ttlSeconds: number): string;

  // Verify an incoming signed URL is valid and belongs to the session.
  verifyUrl(signedUrl: string, session: BushSession): boolean;
}
```

Implementation notes:

- Signature algorithm: HMAC-SHA256
- Default URL expiration: 1 hour (configurable per account)
- URLs are bound to the issuing session — cannot be replayed from a different session
- HLS/DASH manifests and individual segments are each independently signed
- Playback requires a valid session cookie in addition to the signed URL
- Geo-restriction: Future

#### 1.3 Download Protection — Phase 2

- Downloads are permission-gated: requires Edit & Share or Full Access permission level (see `03-permissions.md`)
- Share links can explicitly disable downloads regardless of user permission
- Download URLs are signed and single-use: expire after first use or 15 minutes, whichever comes first
- All downloads written to the audit log: user identity, asset ID, format, timestamp, IP

#### 1.4 DRM — Not in Scope

DRM was evaluated and dropped from the Bush roadmap. Forensic watermarking, signed streaming URLs, and download gating provide sufficient content protection for target use cases.

---

### 2. Audit Logging

#### 2.1 Events Logged — MVP (core), Phase 2 (export)

**Authentication events:**

- Login success/failure (method, IP, user agent)
- Logout
- MFA enrollment/removal
- Session revocation
- Password change

**Content access events:**

- Asset viewed (user, asset ID, timestamp, IP)
- Asset downloaded (user, asset ID, format, timestamp, IP)
- Asset uploaded
- Asset deleted
- Asset moved/copied

**Permission events:**

- Permission granted/revoked on resource
- Access Group created/modified/deleted
- Member added/removed from Access Group
- Role change (e.g., Member promoted to Content Admin)
- User invited/removed from account

**Share events:**

- Share link created
- Share link accessed (viewer identity if available)
- Share link revoked
- Share settings changed (passphrase, expiration, download toggle)

**Admin events:**

- Account security settings changed
- MFA enforcement toggled
- Session timeout policy changed
- IP allowlist modified
- Watermarking settings changed
- Account plan changed

#### 2.2 Log Format

Each audit log entry:

```json
{
  "id": "ulid",
  "account_id": "string",
  "actor_id": "string | null",
  "actor_type": "user | system | api_key",
  "event_type": "string",
  "resource_type": "string | null",
  "resource_id": "string | null",
  "metadata": {},
  "ip_address": "string | null",
  "user_agent": "string | null",
  "timestamp": "ISO 8601"
}
```

`actor_id` is null for system-generated events. `event_type` follows dot notation: `asset.downloaded`, `share_link.revoked`, `role.changed`, etc.

#### 2.3 Storage and Retention — MVP

- Stored in SQLite in a dedicated `audit_logs` table
- Indexes on: `account_id`, `actor_id`, `event_type`, `resource_id`, `timestamp`
- Standard plans: 90-day retention
- Enterprise plans: 1-year retention
- Expired logs purged by a scheduled background job (daily)
- Append-only: no update or delete operations exposed via API or UI

#### 2.4 Export — Phase 2

- Export formats: CSV, JSON
- Filterable by: date range, event type, actor, resource
- Export initiated from admin dashboard
- Large exports processed asynchronously; download link sent via email
- The export action itself is written to the audit log

---

### 3. Organization Security Policies

Account Owners and Content Admins configure these settings from the admin dashboard.

#### 3.1 Password Requirements — MVP

- Delegated to WorkOS; Bush does not store or validate passwords
- WorkOS enforces: minimum length, complexity rules, breach detection
- Bush configures the password policy tier via WorkOS Organization settings API

#### 3.2 MFA Enforcement — Phase 2

- Account-wide toggle: require MFA for all members
- When enabled, users without MFA enrolled are prompted to set up TOTP on next login
- Grace period: configurable (default 7 days) before enforcement blocks access
- Account Owners can view MFA enrollment status for all members
- MFA method: TOTP via authenticator app (managed by WorkOS)

#### 3.3 Session Timeout Policies — Phase 2

- Configurable idle timeout per account (default: 12 hours; range: 15 minutes to 30 days)
- Configurable absolute session lifetime (default: 7 days; range: 1 hour to 90 days)
- On timeout: session invalidated in Redis; user redirected to login
- Admin can revoke all active sessions for a specific user or for the entire account

#### 3.4 Allowed Authentication Methods — Phase 2

Account-level toggles to enable or disable authentication methods:

- Email/password
- Google Sign-In
- Apple ID
- Magic link
- SSO/SAML (Phase 2)

At least one method must remain enabled. Changes are propagated to WorkOS Organization configuration. Existing sessions using a disabled method are not terminated — enforcement applies on the next login.

#### 3.5 IP Allowlisting — Future

- Optional: restrict account access to specific IP addresses or CIDR ranges
- Applies to all authentication methods (web, API, integrations)
- Maximum 50 IP ranges per account
- Changes take effect immediately; existing sessions from disallowed IPs are terminated
- Bypass mechanism: Account Owner can always access from any IP (recovery scenario)

---

### 4. Data Protection

#### 4.1 Encryption at Rest — MVP

- **S3 (media files)**: AWS S3 server-side encryption (SSE-S3, AES-256) enabled by default on all buckets
- **SQLite (application data)**: SQLCipher is the target for Future; standard SQLite for initial phases with filesystem-level encryption on the hosting environment
- **Redis (session/cache)**: TLS on connections; data is ephemeral and non-sensitive (session cache, rate limit counters)
- **Backups**: All database backups encrypted at rest using AES-256

#### 4.2 Encryption in Transit — MVP

- TLS 1.2+ required on all connections; TLS 1.0 and 1.1 disabled
- TLS 1.3 preferred when supported by the client
- HSTS header: `max-age=31536000; includeSubDomains; preload`
- Certificate managed via automated provisioning (Let's Encrypt or AWS Certificate Manager)
- Internal service-to-service communication also over TLS

#### 4.3 Key Management — MVP

- S3 encryption keys managed by AWS KMS
- Application secrets (API keys, OAuth client secrets) stored in environment variables; never in code or database
- Adobe IMS tokens encrypted in the database using an application-level encryption key
- Key rotation policy: annually or on suspected compromise

---

### 5. API Security

#### 5.1 Rate Limiting — MVP

Redis-backed sliding window algorithm. Limits are applied per endpoint category:

| Category | Limit | Window | Key |
|----------|-------|--------|-----|
| Authentication endpoints | 10 requests | 1 minute | Per IP |
| API read endpoints | 300 requests | 1 minute | Per token |
| API write endpoints | 60 requests | 1 minute | Per token |
| Upload endpoints | 20 requests | 1 minute | Per token |
| Share link access | 30 requests | 1 minute | Per IP |

Rate limit headers returned on all responses:

```
X-RateLimit-Limit: <limit>
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset: <unix timestamp>
```

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header. See `04-api-reference.md` for full rate limiting details.

#### 5.2 Input Validation and Sanitization — MVP

- All request bodies validated against JSON schemas (Zod) before processing
- Path and query parameters validated for type, length, and format
- File upload validation: MIME type checked against allowed list; file size limits enforced
- No raw SQL string construction; all queries use parameterized statements (Drizzle ORM)
- HTML in user-generated fields (comments, descriptions) sanitized to prevent XSS

#### 5.3 CORS Policy — MVP

- Allowed origins: `bush.app`, `*.bush.app` (production); configurable for development
- Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Allowed headers: `Authorization, Content-Type, X-Request-ID`
- Credentials: `true` (cookies required for session auth)
- `Access-Control-Max-Age`: 86400 (24 hours)
- No wildcard origins in production

#### 5.4 CSRF Protection — MVP

- `SameSite=Lax` cookies prevent the most common CSRF vectors
- Origin header validation on all state-changing requests
- API bearer token requests are inherently CSRF-safe
- Share link endpoints use an additional CSRF token for form submissions (passphrase entry)

#### 5.5 Security Headers — MVP

All responses include:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.s3.amazonaws.com; media-src 'self' https://*.s3.amazonaws.com; connect-src 'self' https://api.workos.com; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- CSP `report-uri` configured for violation monitoring
- `frame-ancestors 'none'`: Bush is not embedded in iframes

---

### 6. Compliance — Aspirational

The following certifications are design targets. Bush is architected so that the technical controls required for each certification are in place; active audit programs and formal certification are planned for a future phase and are not current requirements.

#### 6.1 SOC 2 Type 2 — Future

Technical controls Bush must demonstrate:

- Access control: role-based access, MFA, session management (`02-authentication.md`, `03-permissions.md`)
- Audit logging: comprehensive event logging with retention (section 2)
- Encryption: data at rest and in transit (section 4)
- Monitoring: uptime monitoring, error tracking, anomaly detection
- Change management: version-controlled infrastructure, deployment approvals
- Incident response: documented procedures for security incidents
- Vendor management: WorkOS, AWS, and other third-party security reviews

#### 6.2 TPN+ Gold Shield — Future

MPA content security requirements specific to media workflows:

- Content protection: forensic watermarking, signed streaming URLs, download gating (section 1)
- Access control: granular permissions, restricted resources, share link security (`03-permissions.md`)
- Physical security: cloud infrastructure (AWS) with SOC-certified data centers
- Network security: TLS enforcement, CORS, CSP headers, IP allowlisting (sections 3.5, 4.2, 5.3, 5.5)
- Asset tracking: audit trail for all content access and movement (section 2)
- Personnel security: background checks, access reviews (operational, not software)

#### 6.3 ISO 27001 — Future

Information security management system requirements:

- Risk assessment: documented risk register and treatment plans
- Security policies: organization-wide security configuration (section 3)
- Asset management: inventory of information assets, classification scheme
- Cryptography: encryption standards and key management (section 4)
- Operations security: logging, monitoring, malware protection
- Compliance: regular internal audits, management reviews, continuous improvement cycle

---

### 7. Phase Summary

| Feature | Phase |
|---------|-------|
| Encryption in transit (TLS 1.2+) | MVP |
| Encryption at rest (S3 SSE-S3) | MVP |
| Rate limiting (sliding window) | MVP |
| Input validation (Zod schemas) | MVP |
| CORS, CSRF, security headers | MVP |
| Audit logging (core events) | MVP |
| Secure streaming (signed URLs) | Phase 2 |
| Download protection (signed, single-use URLs) | Phase 2 |
| Audit log export (CSV, JSON) | Phase 2 |
| MFA enforcement (account-wide) | Phase 2 |
| Session timeout policies | Phase 2 |
| Allowed authentication methods toggle | Phase 2 |
| Forensic watermarking | Phase 3 |
| IP allowlisting | Future |
| SQLCipher (SQLite encryption at rest) | Future |
| Geo-restriction on streaming | Future |
| SOC 2 Type 2 certification | Future |
| TPN+ Gold Shield certification | Future |
| ISO 27001 certification | Future |

---

## Cross-references

- `02-authentication.md` — Auth flow, session management, cookie configuration, token TTLs
- `03-permissions.md` — Access control: roles, permission levels, inheritance, restricted resources, access groups
- `04-api-reference.md` — API security details: rate limit headers, error responses, authentication headers
- `30-configuration.md` — Environment variables: `REDIS_URL`, `SESSION_SECRET`, `WORKOS_COOKIE_PASSWORD`, `AWS_KMS_KEY_ID`
