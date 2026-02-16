# Bush - Authentication

## Summary
Bush uses WorkOS AuthKit as its primary authentication provider, handling identity verification, session tokens, MFA, and enterprise SSO. Bush owns account roles, permission mapping, guest/reviewer access, and Adobe IMS integration. This spec defines the boundary between WorkOS-managed and Bush-managed auth concerns.

---

## What WorkOS Handles vs What Bush Builds

| Concern | Owner | Notes |
|---------|-------|-------|
| Email/password signup & login | WorkOS | AuthKit hosted UI or embedded components |
| Google Sign-In | WorkOS | Social auth provider |
| Apple ID Sign-In | WorkOS | Social auth provider |
| MFA / 2FA (TOTP) | WorkOS | Enforced per-organization or user-level |
| SSO / SAML / OIDC | WorkOS | Enterprise IdP connections (Okta, Azure AD, Google Workspace) |
| Magic Link (passwordless) | WorkOS | Email-based passwordless login |
| User identity records | WorkOS | Canonical user profile (email, name, avatar) |
| Session tokens (access + refresh) | WorkOS | JWT access tokens, opaque refresh tokens |
| Organization membership | WorkOS | Maps to Bush accounts |
| **Account roles & permissions** | **Bush** | Owner, Content Admin, Member, Guest, Reviewer |
| **Permission levels on resources** | **Bush** | Full Access, Edit & Share, Edit, Comment Only, View Only |
| **Guest/reviewer access** | **Bush** | Share-link-based access, no WorkOS account required |
| **Adobe IMS OAuth** | **Bush** | Custom OAuth 2.0 integration (Phase 4) |
| **Session cache** | **Bush** | Redis-backed session state |
| **Account switcher** | **Bush** | Multi-account context switching |

---

## Authentication Methods

### Primary (via WorkOS AuthKit)

All primary auth flows use WorkOS AuthKit. Bush does not implement its own identity verification.

- **Email/password** -- standard signup and login
- **Google Sign-In** -- OAuth 2.0 social auth
- **Apple ID** -- OAuth 2.0 social auth
- **Magic Link** -- passwordless email verification
- **MFA/2FA** -- TOTP via authenticator app, managed entirely by WorkOS
- **SSO/SAML** -- enterprise identity providers, WorkOS handles provider configuration and protocol negotiation transparently

### Next.js Integration

- Use `@workos-inc/authkit-nextjs` SDK
- Server-side session validation via HTTP-only cookies
- Middleware-based route protection in App Router
- WorkOS handles the hosted login UI; Bush controls redirect URIs and post-auth routing

### Adobe IMS OAuth (Phase 4)

Custom integration -- WorkOS does not support Adobe as a social auth provider.

- **Purpose**: Enable Adobe ID login for users of Bush Adobe panel integrations (Premiere Pro, Lightroom)
- **Flow**: Standard OAuth 2.0 authorization code grant against Adobe IMS endpoints
- **Scope**: `openid`, `creative_sdk`, `profile`, `email`
- **Behavior**:
  - If user has existing Bush account: link Adobe identity to Bush user record
  - If user has no Bush account: create Bush user from Adobe profile, then link
  - Adobe access/refresh tokens stored per-user for API access to Creative Cloud services
- **Token storage**: Encrypted in database, refresh tokens rotated on use
- **Not a standalone login method** in Phase 4 -- Adobe IMS links to an existing Bush identity. Standalone Adobe login is a future consideration.

---

## Session Management

### Token Architecture

WorkOS issues two tokens on successful authentication:

| Token | Type | Default TTL | Storage |
|-------|------|-------------|---------|
| Access token | JWT | 5 minutes | HTTP-only secure cookie |
| Refresh token | Opaque | 7 days (configurable) | HTTP-only secure cookie |

### Session Lifecycle

1. User authenticates via WorkOS AuthKit
2. WorkOS returns access token + refresh token
3. Bush stores both in encrypted HTTP-only cookies
4. On each request, middleware validates access token
5. If access token expired, use refresh token to obtain new pair
6. Refresh tokens are single-use; always store the newly returned token
7. If refresh fails (session expired or revoked), redirect to login

### Redis Session Cache

Bush maintains a server-side session cache in Redis to avoid decoding JWTs on every request and to store Bush-specific session state.

- **Key**: `session:{user_id}:{session_id}`
- **TTL**: Matches refresh token expiration (7 days default)
- **Cached data**:
  - User ID, email, display name
  - Current account ID (for account switcher)
  - Account role for current account
  - WorkOS organization ID
  - Session creation timestamp
  - Last activity timestamp
- **Invalidation**: On logout, role change, account switch, or security event
- **Fallback**: If cache miss, decode JWT + query database, then repopulate cache

### Cookie Configuration

```
httpOnly: true
secure: true (always, even in dev via HTTPS proxy)
sameSite: "lax"
path: "/"
domain: .bush.app (production)
maxAge: 7 days (matches refresh token TTL)
```

### Session Limits

- Maximum concurrent sessions per user: configurable, default 10
- On exceeding limit: oldest session revoked
- Admin can revoke all sessions for a user

---

## Account Roles

Bush-managed roles, independent of WorkOS. WorkOS organizations map 1:1 to Bush accounts.

### Role Definitions

| Role | Scope | Key Capabilities |
|------|-------|-----------------|
| **Account Owner** | Full account | All permissions, billing, plan management, user management, security settings |
| **Content Admin** | All content | All content operations, user management, no billing/plan access |
| **Member** | Granted resources | Access to assigned workspaces/projects, upload, comment, share (per permission level) |
| **Guest** | Single project | Limited to 1 project, no workspace-level access |
| **Reviewer** | Share links only | Access only via share links, no dashboard access |

### Role Assignment

- Account Owner is set at account creation (transferable)
- Only Account Owner can assign Content Admin role
- Content Admin can assign Member and Guest roles
- Roles are per-account (a user can be Owner on one account and Member on another)
- Role changes take effect immediately; Redis session cache invalidated on change

### Account Switcher

Users can belong to multiple Bush accounts (WorkOS organizations).

- Current account stored in session (Redis cache)
- Switching accounts updates session context without re-authentication
- UI shows list of accounts user belongs to with role indicator
- API requests scoped to current account via session context
- Account switcher accessible from all authenticated pages

---

## Guest & Reviewer Access

Share-link-based access for external collaborators. Three tiers, none requiring a WorkOS account.

### Access Tiers

| Tier | Identity | How They Access | Capabilities |
|------|----------|-----------------|-------------|
| **Authenticated Reviewer** | Logged-in Bush user | Click share link while logged in | Comment, annotate, download (per share settings) |
| **Identified Reviewer** | Email-verified | Receive share invite, verify email via code | Comment with verified identity, download (per share settings) |
| **Unidentified Reviewer** | Anonymous | Open public share link | View only, comment if share allows (comments attributed to "Anonymous") |

### Identified Reviewer Flow

1. Share creator enters reviewer's email address
2. Bush sends share invitation email with unique link
3. Reviewer clicks link, enters email, receives verification code
4. Code verified server-side; reviewer gets a limited session cookie
5. Session scoped to that specific share -- no dashboard access
6. Session TTL matches share link expiration

### Share Link Security

- Share links contain cryptographically random token (min 32 bytes, URL-safe base64)
- Optional passphrase protection (hashed with bcrypt, verified server-side)
- Optional expiration date
- Optional download disable
- Optional comment disable
- Share creator can revoke link at any time
- Rate limiting on share link access (prevent brute-force)

### Guest Upgrade Path

- Identified reviewer can be invited to become a Guest or Member
- If they accept, they create a full Bush account (via WorkOS AuthKit)
- Previous review activity linked to new account

---

## API Authentication

### Bush API (V4)

- OAuth 2.0 bearer tokens for API access
- Tokens scoped to specific account
- API keys for service-to-service integrations (Phase 2)
- Rate limiting per token/key

### Webhook Verification

- WorkOS webhooks verified via signature validation
- Bush webhooks to external services signed with HMAC-SHA256

---

## Security Considerations

- All auth endpoints behind rate limiting (Redis-based)
- Failed login attempts tracked per-email (lockout after configurable threshold)
- CSRF protection via `sameSite` cookies + origin validation
- No sensitive data in JWT claims beyond user ID and org ID
- Refresh token rotation enforced (single-use tokens)
- Session revocation propagated via Redis pub/sub for multi-instance deployments
- Audit log for all auth events: login, logout, role change, session revocation, share access

---

## Phase Summary

| Feature | Phase |
|---------|-------|
| WorkOS AuthKit integration (email/password, social, MFA) | Phase 1 |
| Session management (tokens, Redis cache, cookies) | Phase 1 |
| Account roles and permission mapping | Phase 1 |
| Guest/reviewer access (all 3 tiers) | Phase 1 |
| Account switcher | Phase 1 |
| SSO/SAML enterprise connections | Phase 2 |
| API keys for service-to-service | Phase 2 |
| Adobe IMS OAuth integration | Phase 4 |
