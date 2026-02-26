# 05 — Bush Realtime Collaboration

## Overview

Bush delivers real-time updates over a persistent WebSocket connection — comments, upload progress, processing status, presence, and notifications arrive the moment they happen. The server is implemented with Bun's native WebSocket API. The current MVP uses an in-process EventEmitter for event fan-out (single server, events only); the architecture scales incrementally to Redis pub/sub for multi-process fan-out (Phase 2), then adds presence and live cursors (Phase 2/3). All three phases are specified here as the complete target system; phase tags indicate implementation priority, not deferral indefinitely.

---

## Specification

### 1. Architecture

#### 1.1 Server Stack

**MVP [Phase 1] — Events Only**

| Layer | Technology | Role |
|-------|-----------|------|
| WebSocket server | Hono `upgradeWebSocket()` on `Bun.serve()` | Connection handling, message routing |
| Event bus | In-process EventEmitter | Route handler to WebSocket delivery |
| Auth | Cookie-based session extraction | Same auth middleware as HTTP requests |

**Phase 2 — Multi-Process Fan-Out + Presence**

| Layer | Technology | Role |
|-------|-----------|------|
| WebSocket server | Bun native `Bun.serve()` | Connection handling, message routing |
| Pub/sub backbone | Redis | Cross-instance event fan-out |
| Presence store | Redis (hashes + TTL) | Track who is viewing what |
| Message broker | BullMQ + Redis | Async event ingestion from backend services |

**Phase 3 — Live Cursors, Typing Indicators**

Dedicated WebSocket service extracted to a separate process; all Phase 2 infrastructure is reused.

#### 1.2 Connection Endpoint

**MVP (same-origin browser clients):**

```
wss://bush.io/ws
```

- WebSocket endpoint served on the same Hono server as the REST API
- Cookie-based auth: browser sends session cookies automatically on same-origin WebSocket upgrade
- Caddy proxies the WebSocket upgrade transparently
- No token in the URL for browser clients — the `wos-session` cookie carries auth

**External API clients (token-based):**

```
wss://bush.io/ws?token=bush_tok_...
```

Or: connect without a token in the URL and send an `authenticate` message as the first action (see §2.2).

#### 1.3 Multi-Instance Fan-Out [Phase 2]

```
Client A  →  Bun Instance 1  →  Redis pub/sub  →  Bun Instance 2  →  Client B
                                      |
                                      ↓
                                Bun Instance 3  →  Client C
```

- Each Bun instance subscribes to Redis channels matching active client subscriptions
- When a backend route handler emits an event, it publishes to the relevant Redis channel
- Each Bun instance receives the message and forwards it to locally connected clients subscribed to that channel
- Redis channel naming convention: `bush:ws:{channel_type}:{resource_id}` (e.g., `bush:ws:project:proj_abc123`)
- One Redis subscriber per Bun instance, not one per client connection

#### 1.4 Heartbeat / Keepalive

- Server sends a WebSocket ping frame every **30 seconds**
- Client must respond with pong
- Server disconnects after **2 missed pongs** (60 seconds unresponsive)
- Client-side fallback: if no message received for 45 seconds, send an application-level ping message

---

### 2. Connection Lifecycle

#### 2.1 Connect

**MVP:** Client opens WebSocket to `wss://bush.io/ws`. Browser sends session cookies automatically. Server extracts session from cookies using existing auth middleware. Rejects with `4001` close code if no valid session.

**External clients:** Client opens `wss://bush.io/ws?token=bush_tok_...`. Server validates the token on upgrade and rejects with `4001` if invalid.

On successful auth, server responds with:

```json
{
  "type": "connection.established",
  "connection_id": "conn_abc123",
  "server_time": "2026-01-15T10:30:00Z"
}
```

#### 2.2 Authenticate (Alternative for External Clients)

If no token is in the query parameter, the client sends it as the first message after the upgrade:

```json
{
  "action": "authenticate",
  "token": "bush_tok_..."
}
```

Server responds with `connection.established` or closes with `4001`. This path is not used by browser clients (cookie auth is automatic).

#### 2.3 Subscribe

Client subscribes to channels after connection is established:

```json
{
  "action": "subscribe",
  "channel": "project",
  "resource_id": "proj_abc123"
}
```

Server validates permissions (see §3.2), then confirms:

```json
{
  "type": "subscription.confirmed",
  "channel": "project",
  "resource_id": "proj_abc123"
}
```

Or rejects:

```json
{
  "type": "subscription.rejected",
  "channel": "project",
  "resource_id": "proj_abc123",
  "reason": "insufficient_permissions"
}
```

**Missed-event recovery on reconnect:** Client tracks `last_event_id` per subscription. On re-subscribe after a reconnect, include the last known event ID:

```json
{
  "action": "subscribe",
  "channel": "file",
  "resource_id": "file_xyz789",
  "since_event_id": "evt_abc123"
}
```

Server replays missed events from a short-term event log (Redis list, 1-hour TTL, max 1000 events per channel). If the gap is too large, server responds with `subscription.reset` — client must refetch full state via REST API (`04-api-reference.md`).

#### 2.4 Unsubscribe

```json
{
  "action": "unsubscribe",
  "channel": "project",
  "resource_id": "proj_abc123"
}
```

#### 2.5 Disconnect

- Client closes WebSocket normally
- Server cleans up: removes subscriptions, clears presence entries, broadcasts `presence.leave` if applicable
- On abnormal disconnect (network drop), server detects via missed pongs and cleans up

---

### 3. Channel Model

#### 3.1 Channel Types

| Channel | Resource ID | Purpose | Example Events |
|---------|-------------|---------|----------------|
| `project` | `proj_*` | Project-level activity | File uploads, deletes, moves, member changes, status changes |
| `file` | `file_*` | Single file/asset activity | Comments, annotations, versions, processing status, metadata |
| `user` | `user_*` (self only) | Personal events | Notifications, mentions, assignment changes |
| `share` | `share_*` | Share link activity | Reviewer views, comments, downloads |

#### 3.2 Permission Checks on Subscribe

> Permission level definitions are in `03-permissions.md`.

| Channel | Required Permission |
|---------|-------------------|
| `project` | Any project-level permission (View Only or above) |
| `file` | Any permission on the file's parent project |
| `user` | Must be the authenticated user (can only subscribe to own channel) |
| `share` | Edit & Share or above on the parent project, OR valid share token |

Permissions are checked on every `subscribe` action, not just on initial connect. If a user's permissions change while connected (e.g., removed from project), the server sends:

```json
{
  "type": "subscription.revoked",
  "channel": "project",
  "resource_id": "proj_abc123",
  "reason": "permissions_changed"
}
```

Permission changes are detected via Redis pub/sub on permission-change events [Phase 2]. In MVP, revocation is enforced on next subscribe or reconnect.

#### 3.3 Subscription Limits

- Max **50 active subscriptions** per connection
- Subscribing beyond the limit returns `subscription.rejected` with reason `subscription_limit_exceeded`

---

### 4. Event System

#### 4.1 Event Message Format

All server-to-client event messages follow this structure:

```json
{
  "channel": "file",
  "resource_id": "file_xyz789",
  "event": "comment.created",
  "event_id": "evt_abc123",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": { }
}
```

- `event_id` — monotonically increasing per channel/resource, used for missed-event recovery
- `timestamp` — ISO 8601 server time
- `data` — event-specific payload (see tables below)

#### 4.2 Comment Events [MVP]

Delivered on the `file` channel.

| Event | Trigger | Data |
|-------|---------|------|
| `comment.created` | New comment or reply | Full comment object (text, user, timestamp, annotations, parent_id, client_id) |
| `comment.updated` | Comment text edited | Comment ID + updated fields |
| `comment.deleted` | Comment removed | Comment ID |
| `comment.completed` | Marked as complete | Comment ID, completed_by, completed_at |

The `client_id` field in `comment.created` enables optimistic UI reconciliation (see §7).

#### 4.3 File and Upload Events [MVP]

Delivered on the `project` channel (project-level) and `file` channel (file-level).

| Event | Trigger | Data |
|-------|---------|------|
| `file.created` | New file uploaded | File object (name, type, size, uploader) |
| `file.deleted` | File removed | File ID |
| `file.moved` | File moved to different folder | File ID, old_folder_id, new_folder_id |
| `file.updated` | Metadata changed | File ID + changed fields |
| `file.status_changed` | Workflow status updated | File ID, old_status, new_status, changed_by |
| `upload.progress` | Upload chunk completed | File ID, bytes_uploaded, bytes_total, percentage |

#### 4.4 Processing Events [MVP]

Delivered on the `file` channel.

| Event | Trigger | Data |
|-------|---------|------|
| `processing.started` | Transcoding begins | File ID, job_type (`transcode`, `thumbnail`, `filmstrip`, `waveform`) |
| `processing.progress` | Processing update | File ID, job_type, percentage |
| `processing.completed` | Processing finished | File ID, job_type, output URLs |
| `processing.failed` | Processing error | File ID, job_type, error_message |
| `transcription.completed` | Transcription ready | File ID, language, word_count |

#### 4.5 Version Events [MVP]

Delivered on the `file` channel.

| Event | Trigger | Data |
|-------|---------|------|
| `version.created` | New version uploaded | Version object (number, file, uploader) |

#### 4.6 Project Events [MVP]

Delivered on the `project` channel.

| Event | Trigger | Data |
|-------|---------|------|
| `folder.created` | New folder | Folder object |
| `folder.deleted` | Folder removed | Folder ID |
| `member.added` | User added to project | User ID, permission_level |
| `member.removed` | User removed from project | User ID |

#### 4.7 User Events [MVP]

Delivered on the `user` channel (personal).

| Event | Trigger | Data |
|-------|---------|------|
| `notification.created` | New notification | Full notification object |
| `notification.read` | Notification marked read | Notification ID |

#### 4.8 Share Events [MVP]

Delivered on the `share` channel.

| Event | Trigger | Data |
|-------|---------|------|
| `share.viewed` | Someone opens share link | Viewer info (name/email if provided) |
| `share.downloaded` | Asset downloaded from share | File ID, viewer info |

#### 4.9 Event Publishing — Server Implementation [MVP]

When a REST API route handler creates an event:

1. Persist to database
2. **MVP:** Emit via in-process EventEmitter (`bush:event`) → WebSocket manager broadcasts to subscribed clients (skipping the actor)
3. **Phase 2+:** Additionally store event in Redis event log (`LPUSH bush:events:{channel}:{resource_id}`, 1-hour TTL) and publish to Redis pub/sub (`PUBLISH bush:ws:{channel}:{resource_id}`)

```
REST Route Handler
  → emitEvent("comment.created", projectId, userId, payload)
    → EventEmitter("bush:event")           [MVP]
      → WebSocket Manager
        → broadcast to subscribed clients (skip actor)
```

---

### 5. Presence System [Phase 2]

#### 5.1 Presence Updates

Client broadcasts presence to indicate what it is viewing:

```json
{
  "action": "presence",
  "channel": "file",
  "resource_id": "file_xyz789",
  "state": {
    "status": "viewing",
    "cursor_position": 34.5
  }
}
```

Server broadcasts to all other subscribers on the same channel/resource:

```json
{
  "type": "presence.update",
  "channel": "file",
  "resource_id": "file_xyz789",
  "user": {
    "id": "user_abc",
    "name": "Jane Smith",
    "avatar_url": "https://..."
  },
  "state": {
    "status": "viewing",
    "cursor_position": 34.5
  }
}
```

#### 5.2 Presence Statuses

| Status | Meaning |
|--------|---------|
| `viewing` | Actively viewing the asset |
| `idle` | Tab open but no interaction for 5 minutes |
| `commenting` | Actively writing a comment |

#### 5.3 Presence Storage (Redis) [Phase 2]

- Key: `bush:presence:{channel}:{resource_id}` (Redis hash)
- Field: `user_id`
- Value: JSON state object
- TTL: **60 seconds** on the hash, refreshed on every presence update
- If no update received within 60 seconds, the user is automatically removed from presence

#### 5.4 Presence Leave

On unsubscribe or disconnect, server immediately removes user from presence and broadcasts:

```json
{
  "type": "presence.leave",
  "channel": "file",
  "resource_id": "file_xyz789",
  "user_id": "user_abc"
}
```

#### 5.5 Idle Timeout

- Client tracks user interaction (mouse, keyboard, scroll)
- After **5 minutes** of inactivity, client sends `presence` update with `status: "idle"`
- On resumed interaction, client sends `status: "viewing"`

#### 5.6 UI Rendering [Phase 2]

- Asset cards show an avatar stack of users currently viewing
- File detail view shows active viewers with cursor position (for video: playhead position)
- Idle users shown with reduced opacity
- Max **5 avatars** shown, then `+N` overflow indicator

---

### 6. Live Cursors and Typing Indicators [Phase 3]

Live cursor position is carried in the `cursor_position` field of presence updates (see §5.1). For video files, this is the playhead time in seconds. For image files, this is a normalized `{x, y}` coordinate.

Typing indicators use the `commenting` presence status. When a user begins composing a comment, the client immediately sends a presence update with `status: "commenting"`; all other subscribers see "[User] is commenting..." in the UI.

No additional message types are required beyond the presence system — Phase 3 is an extension of Phase 2 presence, not a separate protocol.

---

### 7. Conflict Resolution

#### 7.1 Metadata Editing — Last-Write-Wins

- No locking on metadata fields
- Client sends an optimistic update and renders immediately
- Server validates and persists; broadcasts `file.updated` to all subscribers
- If another user changes the same field concurrently, the latest write wins
- All clients receive `file.updated` and reconcile their local state
- UI: if a field the user is actively editing is changed remotely, show a conflict indicator: "This field was updated by [User] — reload to see latest"

#### 7.2 Comment Editing — Lock-on-Edit

When a user begins editing a comment, the client sends:

```json
{
  "action": "comment.lock",
  "comment_id": "comment_abc"
}
```

- Server sets a Redis lock: `bush:lock:comment:{comment_id}` with **30-second TTL**
- Lock is broadcast to other clients — they see the comment as "being edited by [User]" and the edit button is disabled
- On save or cancel, client sends `comment.unlock`; server clears the lock
- If lock TTL expires (user abandoned the edit), the lock auto-releases
- If another user attempts to edit a locked comment, server rejects with `comment.locked` error

#### 7.3 File Operations — Server-Authoritative

- File upload, delete, move, version creation: server is the source of truth
- No optimistic UI for destructive file operations (delete, move)
- Upload progress is tracked server-side and broadcast via `upload.progress` events
- Version stacking: server determines version number; clients do not predict it

---

### 8. Optimistic UI Strategy

#### 8.1 Applicable Operations

| Operation | Optimistic? | Rationale |
|-----------|-------------|-----------|
| Create comment | Yes | Low conflict risk, high latency sensitivity |
| Edit comment | Yes | User owns the comment; lock prevents conflicts |
| Delete comment | Yes | Immediate feedback expected |
| Mark comment complete | Yes | Simple toggle |
| Edit metadata field | Yes | Last-write-wins makes this safe |
| Upload file | No | Server-authoritative; progress streamed |
| Delete file | No | Destructive; needs server confirmation |
| Move file | No | Affects multiple views; server-authoritative |

#### 8.2 Client-Side Prediction Flow (Comments)

1. User creates a comment
2. Client generates a temporary `client_id` (e.g., `tmp_abc123`)
3. Client renders the comment immediately with a pending state indicator
4. Client sends `POST /v4/files/:id/comments` with `client_id` in the request body
5. Server persists, assigns real `comment_id`, broadcasts `comment.created` event (includes `client_id`)
6. Client matches `client_id` in the event and replaces the temp comment with the server-confirmed version
7. Pending indicator is removed

#### 8.3 Reconciliation

- On receiving server confirmation, client replaces optimistic state with server state
- If server response differs from optimistic state (e.g., server sanitized text), client updates silently
- If comment ordering differs due to concurrent comments, client reorders to match server order

#### 8.4 Rollback

- If server rejects the operation (4xx response), client removes the optimistic entry
- Show toast notification: "Comment could not be saved — [reason]"
- If the user had typed a reply to the failed comment, preserve the reply draft

#### 8.5 Conflict Indicators

- Metadata field changed by another user while editing: yellow border + "[User] updated this field"
- Comment being edited by another user: lock icon + "[User] is editing..."
- Asset deleted by another user while viewing: overlay "This asset was deleted by [User]" with navigation to parent

---

### 9. Connection Management

#### 9.1 Auto-Reconnect with Exponential Backoff

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |
| 5 | 16 seconds |
| 6+ | 30 seconds (cap) |

- Add random jitter (0–1 second) to each delay to avoid thundering herd
- On successful reconnect, client re-subscribes to all previously active channels (with `since_event_id` for missed-event recovery)
- Reset backoff counter on successful reconnect

#### 9.2 Connection State UI

| State | Indicator |
|-------|-----------|
| Connected | None (default) |
| Reconnecting | Yellow dot + "Reconnecting..." in status bar |
| Disconnected (>30s) | Red dot + "Connection lost — updates may be delayed" |
| Fallback polling | Orange dot + "Limited connectivity — polling for updates" |

#### 9.3 Graceful Degradation — Polling Fallback

- If WebSocket connection fails **5 consecutive times**, switch to HTTP polling
- Poll interval: **10 seconds** for active views, **60 seconds** for background tabs
- Polling uses standard REST API endpoints (`GET /v4/files/:id/comments`, `GET /v4/projects/:id/files`)
- Continue attempting WebSocket reconnection every **5 minutes** while polling
- On successful WebSocket reconnect, stop polling and resume real-time

---

### 10. Security

#### 10.1 Authentication

> See `02-authentication.md` for the token format and session architecture.

- Browser clients: cookie-based session auth; no token in URL
- External clients: bearer token in query parameter or first message
- Token validated on every connection upgrade — expired tokens cause `4001` close
- No anonymous WebSocket connections, except `share` channel subscriptions with a valid share token

#### 10.2 Channel Permission Checks

Permissions are enforced on every `subscribe` action. If permissions change mid-session, the server sends `subscription.revoked` (see §3.2).

#### 10.3 Rate Limiting

| Action | Limit | Window |
|--------|-------|--------|
| Messages sent (all types) | 100 | per minute |
| Subscribe actions | 20 | per minute |
| Presence updates | 10 | per 10 seconds |
| Comment lock requests | 5 | per minute |

- Exceeding a rate limit: server sends an `error` message with `rate_limited` code
- Persistent abuse (rate limit hit 5 times in 10 minutes): server closes connection with `4008` close code

#### 10.4 Input Validation

- All incoming messages validated against JSON schema
- Max message size: **16 KB**
- Invalid messages: server responds with an `error` message; connection is not terminated
- `resource_id` format validated before any processing

#### 10.5 Close Codes

| Code | Meaning |
|------|---------|
| `4001` | Authentication failed |
| `4003` | Forbidden (permission denied) |
| `4008` | Rate limit exceeded (persistent abuse) |
| `4009` | Invalid message format |
| `4029` | Too many connections from same user (max 10) |

---

### 11. Server Implementation Notes (Bun)

#### 11.1 MVP Connection Handling

```typescript
// Hono upgradeWebSocket() on Bun.serve()
// Cookie-based auth: extract session from request cookies
app.get('/ws', upgradeWebSocket((c) => {
  const session = extractSessionFromCookies(c.req);
  if (!session) return { onOpen: (evt, ws) => ws.close(4001) };

  return {
    onOpen(evt, ws) { wsManager.register(ws, session.userId); },
    onMessage(evt, ws) { wsManager.route(ws, evt.data); },
    onClose(evt, ws) { wsManager.cleanup(ws); },
  };
}));
```

#### 11.2 Phase 2+ Connection Handling (Bun Native)

```typescript
Bun.serve({
  port: 3001,
  async fetch(req, server) {
    const token = new URL(req.url).searchParams.get("token");
    const user = token
      ? await validateToken(token)
      : await validateCookieSession(req);
    if (!user) return new Response("Unauthorized", { status: 401 });
    server.upgrade(req, { data: { user } });
  },
  websocket: {
    open(ws) { /* register connection */ },
    message(ws, msg) { /* route action */ },
    close(ws) { /* cleanup subscriptions, presence */ },
    perMessageDeflate: true,
  },
});
```

#### 11.3 Redis Integration [Phase 2]

- One Redis subscriber per Bun instance (not per client connection)
- Bun instance maintains a local map: `channelKey → Set<WebSocket>`
- On Redis message received, iterate local subscribers and forward
- Subscribe/unsubscribe from Redis channels as clients join/leave
- Only subscribe to a Redis channel when at least one local client needs it; unsubscribe when none remain

---

### 12. Client SDK (TypeScript)

#### 12.1 API Surface

```typescript
interface BushSocket {
  connect(opts?: { token?: string }): Promise<void>;
  subscribe(channel: string, resourceId: string, opts?: { sinceEventId?: string }): void;
  unsubscribe(channel: string, resourceId: string): void;
  sendPresence(channel: string, resourceId: string, state: PresenceState): void;
  on(event: string, handler: (data: EventMessage) => void): void;
  off(event: string, handler: (data: EventMessage) => void): void;
  readonly state: "connecting" | "connected" | "reconnecting" | "disconnected" | "polling";
  disconnect(): void;
}
```

The `bush-sdk` package (`npm install bush-sdk`) exports a pre-configured client. See `04-api-reference.md` §11 for SDK availability by phase.

#### 12.2 React Integration

```typescript
// Subscribe to a channel and receive events
function useChannel(channel: string, resourceId: string): {
  events: EventMessage[];
  presence: PresenceUser[];          // Phase 2+
  connectionState: ConnectionState;
}

// Broadcast presence for current user (Phase 2+)
function usePresence(channel: string, resourceId: string): {
  setStatus(status: PresenceStatus): void;
  setCursorPosition(position: number): void;
}
```

Canonical hook locations:
- `src/realtime/ws-manager.ts` — WebSocket connection manager (auth, rooms, broadcast)
- `src/realtime/event-bus.ts` — In-process EventEmitter and event type definitions
- `src/realtime/emit.ts` — `emitEvent()` helper for route handlers
- `src/web/lib/ws-client.ts` — Browser WebSocket client with reconnection logic
- `src/web/hooks/use-realtime.ts` — `useRealtime(projectId, callback)` React hook

#### 12.3 Next.js Considerations

- WebSocket client initialized in a React context provider at the app layout level
- Connection persists across client-side navigation — no reconnect on route change
- Server components do not use WebSocket; real-time updates are client-only
- Initial page load fetches data via REST API (SSR); WebSocket delivers updates after hydration

---

## Cross-References

- `02-authentication.md` — WorkOS session tokens, cookie-based auth, token validation; WebSocket auth inherits the same session mechanism
- `03-permissions.md` — Permission level definitions; enforced on every `subscribe` action and re-evaluated on permission changes
- `04-api-reference.md` — REST endpoints that trigger realtime events; polling fallback endpoints; SDK availability
- `30-configuration.md` — Redis connection config (`REDIS_URL`), WebSocket server port, rate limit environment variables
