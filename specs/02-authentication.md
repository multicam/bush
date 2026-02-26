# Bush - Authentication

## Overview

Bush delegates identity verification entirely to WorkOS AuthKit. WorkOS handles email/password login, social auth (Google, Apple), magic links, MFA/TOTP, and enterprise SSO/SAML. Bush owns the concerns that sit above identity: account roles, permission mapping, session context, multi-account switching, and guest/reviewer access for external collaborators. A thin auth interface isolates the WorkOS dependency so the adapter layer is the only code that changes if the provider ever switches. This spec covers the WorkOS/Bush responsibility boundary, session management, cookie configuration, multi-account switching, and the guest/reviewer access model; permission details live in `03-permissions.md`.

---

## Specification

### 1. Auth Interface

Bush defines a thin interface that WorkOS implements. No application code calls WorkOS SDK methods directly — it calls the interface. If Bush ever migrates off WorkOS, only the adapter changes.

```typescript
interface AuthProvider {
  // Verify an incoming credential (code exchange, token decode, etc.)
  // Returns a canonical BushIdentity on success, throws AuthError on failure.
  authenticate(credential: AuthCredential): Promise<BushIdentity>;

  // Retrieve the active session from an incoming request.
  // Returns null if no valid session exists (not found, expired, revoked).
  getSession(req: Request): Promise<BushSession | null>;

  // Resolve a session to a full user record.
  // May return null if the session is valid but the user was deleted.
  getUser(session: BushSession): Promise<BushUser | null>;

  // Attempt to silently refresh an expired session.
  // Returns a new BushSession or null if the refresh token is invalid/expired.
  refreshToken(session: BushSession): Promise<BushSession | null>;
}

interface BushIdentity {
  providerId: string;          // WorkOS user ID (wos_usr_...)
  email: string;
  name: string | null;
  avatarUrl: string | null;
  organizationId: string | null; // WorkOS org ID, null for personal accounts
}

interface BushSession {
  userId: string;              // Bush user ID (maps from providerId)
  sessionId: string;
  accountId: string;           // Current active account
  expiresAt: Date;
}

interface BushUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}
```

The current implementation is `WorkOSAuthProvider`. It is the only code in the codebase that imports from `@workos-inc/authkit-nextjs` or calls WorkOS endpoints directly.

---

### 2. WorkOS vs Bush Responsibility Matrix

| Concern | Owner | Notes |
|---------|-------|-------|
| Email/password signup and login | WorkOS | AuthKit hosted UI or embedded components |
| Google Sign-In | WorkOS | Social auth provider |
| Apple ID Sign-In | WorkOS | Social auth provider |
| MFA / 2FA (TOTP) | WorkOS | Enforced per-organization or user-level |
| SSO / SAML / OIDC | WorkOS | Enterprise IdP connections (Okta, Azure AD, Google Workspace) — Phase 2 |
| Magic link (passwordless) | WorkOS | Email-based passwordless login |
| User identity records | WorkOS | Canonical user profile (email, name, avatar) |
| Session tokens (access + refresh) | WorkOS | JWT access tokens, opaque refresh tokens |
| Organization membership | WorkOS | Maps to Bush accounts |
| Account roles and permissions | Bush | Owner, Content Admin, Member, Guest, Reviewer — see `03-permissions.md` |
| Guest / reviewer access | Bush | Share-link-based access, no WorkOS account required |
| Adobe IMS OAuth | Bush | Custom OAuth 2.0 integration — Future |
| Session cache | Bush | Redis-backed session state |
| Account switcher | Bush | Multi-account context switching |

---

### 3. Authentication Methods

#### 3.1 Primary Methods via WorkOS AuthKit — MVP

All primary auth flows use WorkOS AuthKit. Bush does not implement its own identity verification.

- **Email/password** — standard signup and login
- **Google Sign-In** — OAuth 2.0 social auth
- **Apple ID** — OAuth 2.0 social auth
- **Magic link** — passwordless email verification
- **MFA/2FA** — TOTP via authenticator app, managed entirely by WorkOS

#### 3.2 Enterprise SSO — Phase 2

- **SSO / SAML / OIDC** — enterprise identity providers; WorkOS handles provider configuration and protocol negotiation transparently

#### 3.3 Adobe IMS OAuth — Future

Custom integration — WorkOS does not support Adobe as a social auth provider.

- **Purpose**: Enable Adobe ID login for users of Bush Adobe panel integrations (Premiere Pro, Lightroom)
- **Flow**: Standard OAuth 2.0 authorization code grant against Adobe IMS endpoints
- **Scopes**: `openid`, `creative_sdk`, `profile`, `email`
- **Behavior**:
  - If the user has an existing Bush account: link Adobe identity to the Bush user record
  - If the user has no Bush account: create a Bush user from the Adobe profile, then link
  - Adobe access/refresh tokens stored per user for API access to Creative Cloud services
- **Token storage**: Encrypted in the database; refresh tokens rotated on use
- **Not a standalone login method** in initial rollout — Adobe IMS links to an existing Bush identity. Standalone Adobe login is a future consideration.

---

### 4. Next.js Integration

- Use `@workos-inc/authkit-nextjs` SDK inside `WorkOSAuthProvider` only
- Server-side session validation via HTTP-only cookies
- Middleware-based route protection in App Router (`authkitMiddleware` with `middlewareAuth` mode)
- WorkOS hosts the login UI; Bush controls redirect URIs and post-auth routing
- Callback route at `/auth/callback` — handled by `handleAuth()` from the AuthKit SDK
- `AuthKitProvider` wraps the app layout for client-side session access
- Redirect URI configured via `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (the `NEXT_PUBLIC_` prefix is required by the AuthKit SDK)

#### 4.1 Next.js to Hono API Proxy — MVP

In development, the Next.js frontend (`:3000`) and Hono API (`:3001`) run on different ports. To avoid cross-origin cookie issues, Next.js proxies API requests:

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: "/v4/:path*",
      destination: `${process.env.API_URL || "http://localhost:3001"}/v4/:path*`,
    },
  ];
},
```

The web API client uses relative `/v4` paths in the browser (routed through the proxy) and direct URLs server-side:

```typescript
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/v4"; // Goes through Next.js proxy
  }
  return process.env.API_URL || "http://localhost:3001/v4";
}
```

This ensures cookies set by WorkOS AuthKit (on `:3000`) are forwarded to the Hono API transparently.

---

### 5. Session Management — MVP

#### 5.1 Token Architecture

WorkOS issues two tokens on successful authentication:

| Token | Type | TTL | Storage |
|-------|------|-----|---------|
| Access token | JWT | 5 minutes | HTTP-only secure cookie (inside `wos-session`) |
| Refresh token | Opaque | 7 days (configurable) | HTTP-only secure cookie (inside `wos-session`) |

The access token TTL is 5 minutes. Any API example showing `expires_in: 3600` is incorrect.

#### 5.2 Session Lifecycle

**Web (browser) flow:**

1. User authenticates via WorkOS AuthKit hosted login UI
2. WorkOS redirects to `/auth/callback` with authorization code
3. AuthKit SDK (`handleAuth`) exchanges the code for tokens and creates an encrypted `wos-session` cookie (iron-session)
4. On subsequent requests, Hono auth middleware unseals `wos-session` to extract WorkOS user info via `AuthProvider.getSession()`
5. Middleware calls `findOrCreateUser` to map WorkOS identity to a Bush user (auto-provisions personal account for new users)
6. Middleware creates a Bush session in Redis and caches it for the request duration
7. AuthKit middleware in Next.js handles token refresh transparently via `AuthProvider.refreshToken()`
8. If `wos-session` is expired or invalid, the AuthKit middleware redirects to login

**API (bearer token) flow:**

1. Client authenticates and obtains a `bush_tok_` or `userId:sessionId` bearer token
2. On each request, auth middleware parses the `Authorization: Bearer` header
3. Session looked up from Redis by user/session ID
4. On cache miss, request is rejected (no JWT fallback currently)

**Auth middleware fallback chain:**

1. Bearer token (`Authorization: Bearer bush_tok_...` or `userId:sessionId`)
2. `bush_session` cookie (base64-encoded JSON or plain `userId:sessionId` format)
3. `wos-session` cookie (iron-session encrypted, unsealed with `WORKOS_COOKIE_PASSWORD` or `SESSION_SECRET`)

#### 5.3 Redis Session Cache

Bush maintains a server-side session cache in Redis to avoid decoding JWTs on every request and to store Bush-specific session state.

- **Key format**: `session:{user_id}:{session_id}`
- **TTL**: Matches refresh token expiration (7 days default)
- **Cached data**:
  - User ID, email, display name
  - Current account ID (for account switcher)
  - Account role for current account
  - WorkOS organization ID
  - Session creation timestamp
  - Last activity timestamp
- **Invalidation**: On logout, role change, account switch, or security event
- **On cache miss**: Decode JWT, query database, repopulate cache

#### 5.4 Session Limits

- Maximum concurrent sessions per user: configurable, default 10
- On exceeding limit: oldest session revoked
- Admin can revoke all sessions for a specific user

---

### 6. Cookie Configuration — MVP

**`wos-session` cookie** (managed by WorkOS AuthKit SDK):

- Encrypted with iron-session using `WORKOS_COOKIE_PASSWORD` (falls back to `SESSION_SECRET`)
- Contains: access token, refresh token, WorkOS user profile, organization ID
- `httpOnly: true`, `secure: true` (production), `sameSite: "lax"`, `path: "/"`

**`bush_session` cookie** (set by Bush callback handler):

- Format: base64-encoded JSON `{ userId, sessionId, ... }` or plain `userId:sessionId`
- `httpOnly: true`, `secure: true` (production), `sameSite: "lax"`, `path: "/"`
- `maxAge`: 7 days (matches session TTL)

```
httpOnly: true
secure: NODE_ENV === "production"   // false on localhost
sameSite: "lax"
path: "/"
domain: .bush.app                   // production only
maxAge: 7 days
```

---

### 7. Auto-Provisioning — MVP

When a new user authenticates via WorkOS for the first time, Bush automatically:

1. Creates a Bush user record mapped to the WorkOS user ID
2. Creates a personal account (`{firstName}'s Account` or `{emailLocal}'s Account`)
3. Creates an Owner membership linking the user to their personal account
4. Derives account slug from email prefix: `{email-local}-{id-suffix}`
5. Sets account plan to `free`

Every authenticated user has at least one account and can immediately use the platform.

---

### 8. Account Switcher — MVP

Users can belong to multiple Bush accounts (WorkOS organizations).

- Current account stored in session (Redis cache)
- Switching accounts updates session context without re-authentication
- UI shows list of accounts the user belongs to, with role indicator
- API requests are scoped to the current account via session context
- Account switcher accessible from all authenticated pages

For the account role model (Owner, Content Admin, Member, Guest, Reviewer) see `03-permissions.md`.

---

### 9. Guest and Reviewer Access — MVP

Share-link-based access for external collaborators. Three tiers, none requiring a WorkOS account.

| Tier | Identity | How They Access | Capabilities |
|------|----------|-----------------|-------------|
| Authenticated Reviewer | Logged-in Bush user | Click share link while logged in | Comment, annotate, download (per share settings) |
| Identified Reviewer | Email-verified | Receive share invite, verify email via code | Comment with verified identity, download (per share settings) |
| Unidentified Reviewer | Anonymous | Open public share link | View only; comment if share allows (attributed to "Anonymous") |

**Identified Reviewer flow:**

1. Share creator enters reviewer's email address
2. Bush sends share invitation email with unique link
3. Reviewer clicks link, enters email, receives a verification code
4. Code verified server-side; reviewer receives a limited session cookie
5. Session scoped to that specific share — no dashboard access
6. Session TTL matches share link expiration

**Share link security:**

- Cryptographically random token (min 32 bytes, URL-safe base64)
- Optional passphrase protection (bcrypt hashed, verified server-side)
- Optional expiration date
- Optional download disable, optional comment disable
- Share creator can revoke at any time
- Rate limiting on share link access to prevent brute-force

For full permission detail on what Guests and Reviewers can and cannot do, see `03-permissions.md`.

**Guest upgrade path:**

- An Identified Reviewer can be invited to become a Guest or Member
- On acceptance, they create a full Bush account via WorkOS AuthKit
- Previous review activity is linked to the new account

---

### 10. API Authentication

#### 10.1 Bush API V4 — MVP / Phase 2

- OAuth 2.0 bearer tokens for API access; tokens scoped to a specific account
- API keys for service-to-service integrations — Phase 2
- Rate limiting per token/key (see `04-api-reference.md` for limits)

#### 10.2 Webhook Verification — MVP

- WorkOS webhooks verified via WorkOS signature validation
- Bush webhooks to external services signed with HMAC-SHA256

---

### 11. Security Considerations

- All auth endpoints behind Redis-based rate limiting
- Failed login attempts tracked per email; lockout after configurable threshold
- CSRF protection via `sameSite` cookies and origin validation
- No sensitive data in JWT claims beyond user ID and org ID
- Refresh token rotation enforced (single-use)
- Session revocation propagated via Redis pub/sub for multi-instance deployments
- Audit log entries written for: login success/failure, logout, MFA enrollment/removal, session revocation, role change, share link access

For the full security policy (rate limiting, headers, encryption, etc.) see `12-security.md`.

---

### 12. Phase Summary

| Feature | Phase |
|---------|-------|
| WorkOS AuthKit integration (email/password, social, MFA) | MVP |
| Auth interface (`AuthProvider`) wrapping WorkOS | MVP |
| Session management (tokens, Redis cache, cookies) | MVP |
| Auto-provisioning (personal account on first login) | MVP |
| Guest/reviewer access (all 3 tiers) | MVP |
| Account switcher | MVP |
| API bearer token authentication | MVP |
| Webhook HMAC verification | MVP |
| SSO/SAML enterprise connections | Phase 2 |
| API keys for service-to-service | Phase 2 |
| Session timeout policy (admin-configurable) | Phase 2 |
| Allowed authentication methods toggle (per account) | Phase 2 |
| Adobe IMS OAuth integration | Future |

---

## Cross-references

- `03-permissions.md` — Full permission model: account roles, permission levels, inheritance, restricted resources, access groups
- `04-api-reference.md` — API authentication headers, token format, rate limit headers
- `12-security.md` — Security policies: rate limiting, CORS, headers, encryption, audit logging, MFA enforcement
- `30-configuration.md` — Environment variables: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD`, `SESSION_SECRET`, `REDIS_URL`
