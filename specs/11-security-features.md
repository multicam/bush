# Bush - Security Features

## Summary
Bush provides enterprise-grade security for creative content collaboration. The platform targets SOC 2 Type 2, TPN+ Gold Shield, and ISO 27001 certifications. Security spans access control, content protection, audit logging, data encryption, and API hardening. Authentication is delegated to WorkOS AuthKit (see spec 12-authentication.md).

---

## 1. Security Certifications (Phase 5)

- **SOC 2 Type 2** -- controls for security, availability, and confidentiality
- **TPN+ Gold Shield** -- Motion Picture Association content security assessment
- **ISO 27001** -- information security management system certification

---

## 2. Access Control

### 2.1 Permission Levels

Five permission levels govern what a user can do within a workspace, project, or folder:

| Level | Upload/Delete | Share | Download | Comment | View |
|-------|:---:|:---:|:---:|:---:|:---:|
| **Full Access** | Y | Y | Y | Y | Y |
| **Edit & Share** | Y | Y | Y | Y | Y |
| **Edit** | Y | N | N | Y | Y |
| **Comment Only** | N | N | N | Y | Y |
| **View Only** | N | N | N | N | Y |

- Full Access additionally grants member management and restricted project/folder creation
- Edit & Share is identical to Full Access minus member management

### 2.2 Permission Inheritance

- Workspace permissions cascade to all projects within that workspace
- Project permissions cascade to all folders and assets within that project
- Folder permissions cascade to nested folders and assets
- **Permissions can only be elevated, never lowered** -- if a user has Full Access at the workspace level, it cannot be reduced to View Only at the project level
- Restricted Projects and Restricted Folders break the inheritance chain (see 2.3)

### 2.3 Restricted Projects and Folders

Restricted resources break normal permission inheritance. Only explicitly invited users can see or access them.

- **Restricted Projects**: workspace-level permissions do not cascade in; users must be directly invited
- **Restricted Folders**: project-level permissions do not cascade in; users must be directly invited
- Account Owners and Content Admins always retain access regardless of restriction
- Only users with Full Access (or Owner/Admin role) can create restricted projects or folders
- Guest role limit still applies (1 project max)
- Team+ plan feature

### 2.4 Access Groups

Access Groups allow bulk permission management by grouping account members.

**Model:**
- An Access Group has a name, optional description, and belongs to one account
- An Access Group contains one or more account members
- A member can belong to multiple Access Groups
- Access Groups can be granted permissions on workspaces, projects, and folders just like individual users

**Operations:**
- Create, rename, delete Access Group
- Add/remove members from Access Group
- Grant Access Group a permission level on a resource (workspace, project, folder)
- Remove Access Group permission from a resource
- When an Access Group is granted access, all members inherit that permission
- When a member is added to an Access Group, they immediately receive all permissions the group holds
- When a member is removed from an Access Group, their group-derived permissions are revoked (individual grants remain)

**Database schema (conceptual):**
```
access_groups: id, account_id, name, description, created_at, updated_at
access_group_members: access_group_id, user_id, added_at
access_group_permissions: access_group_id, resource_type, resource_id, permission_level, granted_at, granted_by
```

### 2.5 Share Link Security

- Share links contain cryptographically random tokens (min 32 bytes, URL-safe base64)
- Optional passphrase protection (bcrypt hashed, verified server-side)
- Optional expiration date/time
- Per-share toggles: disable downloads, disable comments, hide previous versions
- Share creator can revoke link at any time
- Rate limiting on share link access to prevent brute-force
- See spec 12-authentication.md for reviewer access tiers (Authenticated, Identified, Unidentified)

---

## 3. Content Security

### 3.1 Forensic Watermarking

Invisible watermarks embedded in proxy streams, traceable to the specific viewer.

- Applied during proxy generation (server-side)
- Watermark encodes: account ID, user ID, session ID, timestamp
- Survives common transformations: re-encoding, cropping, screen capture
- Not applied to original source files -- only proxies and streaming playback
- Extraction requires Bush forensic analysis tooling
- Configurable per account (enable/disable) and per project (override)
- Enterprise plan feature

### 3.2 Secure Streaming

- All streaming URLs are signed with HMAC and include expiration
- Default URL expiration: 1 hour (configurable per account)
- URLs bound to session -- cannot be shared or replayed from a different session
- HLS/DASH manifests and segments each individually signed
- Playback requires valid session cookie in addition to signed URL
- Geo-restriction capability (Phase 5)

### 3.3 Download Protection

- Downloads are permission-gated: requires Edit & Share or Full Access permission level
- Share links can explicitly disable downloads regardless of user permission
- Download URLs are signed and single-use (expire after first use or 15 minutes, whichever comes first)
- All downloads logged in audit trail with user identity, asset ID, timestamp, and IP

### 3.4 DRM

- **Not in scope** -- DRM was evaluated and dropped from the Bush roadmap
- Forensic watermarking + signed URLs + download gating provide sufficient content protection for target use cases

---

## 4. Audit Logging

### 4.1 Events Logged

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

### 4.2 Log Format

Each audit log entry contains:

```
{
  "id": "ulid",
  "account_id": "string",
  "actor_id": "string | null",        // null for system events
  "actor_type": "user | system | api_key",
  "event_type": "string",             // e.g., "asset.downloaded"
  "resource_type": "string | null",   // e.g., "asset", "project", "share_link"
  "resource_id": "string | null",
  "metadata": {},                      // event-specific details
  "ip_address": "string | null",
  "user_agent": "string | null",
  "timestamp": "ISO 8601"
}
```

### 4.3 Storage and Retention

- Stored in SQLite (same database, dedicated `audit_logs` table)
- Indexed on: `account_id`, `actor_id`, `event_type`, `resource_id`, `timestamp`
- **Standard plans**: 90-day retention
- **Enterprise plans**: 1-year retention
- Expired logs purged via scheduled background job (daily)
- Logs are append-only; no update or delete operations exposed via API or UI

### 4.4 Export

- Export formats: CSV, JSON
- Filterable by: date range, event type, actor, resource
- Export initiated from admin dashboard
- Large exports processed asynchronously; download link sent via email
- Export itself is logged as an audit event

---

## 5. Organization-Wide Security Policies

Account Owners and Content Admins configure these settings from the admin dashboard.

### 5.1 Password Requirements

- **Delegated to WorkOS** -- Bush does not store or validate passwords
- WorkOS enforces: minimum length, complexity rules, breach detection
- Bush can configure password policy tier via WorkOS Organization settings API

### 5.2 MFA Enforcement

- Account-wide toggle: require MFA for all members
- When enabled, users without MFA enrolled are prompted to set up TOTP on next login
- Grace period: configurable (default 7 days) before enforcement blocks access
- Account Owners can view MFA enrollment status for all members
- MFA method: TOTP via authenticator app (managed by WorkOS)

### 5.3 Session Timeout Policies

- Configurable idle timeout per account (default: 12 hours, range: 15 minutes to 30 days)
- Configurable absolute session lifetime (default: 7 days, range: 1 hour to 90 days)
- On timeout: session invalidated in Redis, user redirected to login
- Admin can revoke all active sessions for a specific user or entire account

### 5.4 IP Allowlisting (Phase 5)

- Optional: restrict account access to specific IP addresses or CIDR ranges
- Applies to all authentication methods (web, API, integrations)
- Maximum 50 IP ranges per account
- Changes take effect immediately; existing sessions from disallowed IPs terminated
- Bypass mechanism: Account Owner can always access from any IP (recovery scenario)

### 5.5 Allowed Authentication Methods

- Account-level toggles to enable/disable authentication methods:
  - Email/password
  - Google Sign-In
  - Apple ID
  - Magic Link
  - SSO/SAML (Phase 2)
- At least one method must remain enabled
- Changes propagated to WorkOS Organization configuration
- Existing sessions using a disabled method are not terminated (enforced on next login)

---

## 6. Data Protection

### 6.1 Encryption at Rest

- **S3 (media files)**: AWS S3 server-side encryption (SSE-S3, AES-256) enabled by default on all buckets
- **SQLite (application data)**: SQLCipher considered for Phase 5; standard SQLite for initial phases with filesystem-level encryption on hosting environment
- **Redis (session/cache)**: Redis configured with TLS for connections; data is ephemeral and non-sensitive (session cache, rate limit counters)
- **Backups**: All database backups encrypted at rest using AES-256

### 6.2 Encryption in Transit

- **TLS 1.2+** required on all connections (TLS 1.0 and 1.1 disabled)
- TLS 1.3 preferred when supported by client
- HSTS header with `max-age=31536000; includeSubDomains; preload`
- Certificate managed via automated provisioning (Let's Encrypt or AWS Certificate Manager)
- Internal service-to-service communication also over TLS

### 6.3 Key Management

- S3 encryption keys managed by AWS KMS
- Application secrets (API keys, OAuth client secrets) stored in environment variables, never in code or database
- Adobe IMS tokens encrypted in database using application-level encryption key
- Key rotation policy: annually or on suspected compromise

---

## 7. API Security

### 7.1 Rate Limiting

- Redis-backed sliding window rate limiting
- Default limits (per endpoint category):
  - Authentication endpoints: 10 requests/minute per IP
  - API read endpoints: 300 requests/minute per token
  - API write endpoints: 60 requests/minute per token
  - Upload endpoints: 20 requests/minute per token
  - Share link access: 30 requests/minute per IP
- Rate limit headers returned on all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Exceeded limits return `429 Too Many Requests` with `Retry-After` header
- See API spec for full rate limiting details

### 7.2 Input Validation and Sanitization

- All request bodies validated against JSON schemas (Zod) before processing
- Path and query parameters validated for type, length, and format
- File upload validation: MIME type checked against allowed list, file size limits enforced
- No raw SQL construction; all queries use parameterized statements (Drizzle ORM)
- HTML content in user-generated fields (comments, descriptions) sanitized to prevent XSS

### 7.3 CORS Policy

- Allowed origins: `bush.app`, `*.bush.app` (production); configurable for development
- Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Allowed headers: `Authorization, Content-Type, X-Request-ID`
- Credentials: `true` (cookies required for session auth)
- `Access-Control-Max-Age`: 86400 (24 hours)
- No wildcard origins in production

### 7.4 CSRF Protection

- `SameSite=Lax` cookies prevent most CSRF vectors
- Origin header validation on all state-changing requests
- API token-based requests (OAuth bearer) are inherently CSRF-safe
- Share link endpoints use additional CSRF token for form submissions (passphrase entry)

### 7.5 Security Headers

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

- CSP report-uri configured for violation monitoring
- Frame-ancestors set to `'none'` (Bush is not embedded in iframes)

---

## 8. Compliance (Phase 5)

### 8.1 SOC 2 Type 2

Required controls Bush must demonstrate:

- **Access control**: role-based access, MFA, session management (sections 2, 5)
- **Audit logging**: comprehensive event logging with retention (section 4)
- **Change management**: version-controlled infrastructure, deployment approvals
- **Encryption**: data at rest and in transit (section 6)
- **Incident response**: documented procedures for security incidents
- **Vendor management**: WorkOS, AWS, and other third-party security reviews
- **Monitoring**: uptime monitoring, error tracking, anomaly detection

### 8.2 TPN+ Gold Shield

MPA content security requirements specific to media workflows:

- **Content protection**: forensic watermarking, signed streaming URLs, download gating (section 3)
- **Access control**: granular permissions, restricted projects/folders, share link security (section 2)
- **Physical security**: cloud infrastructure (AWS) with SOC-certified data centers
- **Network security**: TLS enforcement, CORS, CSP headers, IP allowlisting (sections 6, 7, 5.4)
- **Asset tracking**: audit trail for all content access and movement (section 4)
- **Personnel security**: background checks, access reviews (operational, not software)

### 8.3 ISO 27001

Information security management system requirements:

- **Risk assessment**: documented risk register and treatment plans
- **Security policies**: organization-wide security configuration (section 5)
- **Asset management**: inventory of information assets, classification scheme
- **Cryptography**: encryption standards and key management (section 6)
- **Operations security**: logging, monitoring, malware protection
- **Compliance**: regular internal audits, management reviews, continuous improvement cycle

---

## Phase Summary

| Feature | Phase |
|---------|-------|
| Permission levels and inheritance | Phase 1 |
| Restricted Projects | Phase 1 |
| Access Groups | Phase 1 |
| Share link security (passphrase, expiration, download toggle) | Phase 1 |
| Audit logging (core events) | Phase 1 |
| Encryption in transit (TLS 1.2+) | Phase 1 |
| Encryption at rest (S3 SSE) | Phase 1 |
| Rate limiting | Phase 1 |
| Input validation (Zod schemas) | Phase 1 |
| CORS, CSRF, security headers | Phase 1 |
| Restricted Folders | Phase 2 |
| Forensic watermarking | Phase 3 |
| Secure streaming (signed URLs) | Phase 2 |
| Download protection (signed, single-use URLs) | Phase 2 |
| Audit log export (CSV, JSON) | Phase 2 |
| MFA enforcement (account-wide) | Phase 2 |
| Session timeout policies | Phase 2 |
| Allowed authentication methods toggle | Phase 2 |
| IP allowlisting | Phase 5 |
| SQLCipher (SQLite encryption at rest) | Phase 5 |
| SOC 2 Type 2 certification | Phase 5 |
| TPN+ Gold Shield certification | Phase 5 |
| ISO 27001 certification | Phase 5 |
