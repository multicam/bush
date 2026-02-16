# Bush - Real-Time Collaboration

## Summary
Bush uses WebSockets to deliver real-time updates across the platform -- comments, upload progress, processing status, presence, and notifications. The server runs on Bun's native WebSocket API with Redis pub/sub for horizontal scaling across multiple Bun instances. Clients connect via a single persistent WebSocket, subscribe to channels, and receive events as they happen. When WebSocket connectivity fails, the client falls back to polling.

---

## 1. WebSocket Architecture

### 1.1 Server Stack

| Layer | Technology | Role |
|-------|-----------|------|
| WebSocket server | Bun native `Bun.serve()` | Connection handling, message routing |
| Pub/sub backbone | Redis | Cross-instance event fan-out |
| Presence store | Redis (hashes + TTL) | Track who is viewing what |
| Message broker | BullMQ + Redis | Async event ingestion from backend services |

### 1.2 Connection Endpoint

```
wss://ws.bush.io/v4/cable?token=bush_tok_...
```

- Single WebSocket connection per browser tab
- Bun handles upgrade via `server.upgrade()` -- no external proxy needed
- TLS termination at load balancer or Bun directly depending on deployment

### 1.3 Multi-Instance Fan-Out

```
Client A ──► Bun Instance 1 ──► Redis pub/sub ──► Bun Instance 2 ──► Client B
                                       │
                                       ▼
                                 Bun Instance 3 ──► Client C
```

- Each Bun instance subscribes to Redis channels matching active client subscriptions
- When a backend service emits an event (e.g., comment created), it publishes to the relevant Redis channel
- Each Bun instance receives the message and forwards it to locally connected clients subscribed to that channel
- Redis channel naming: `bush:ws:{channel_type}:{resource_id}` (e.g., `bush:ws:project:proj_abc123`)

### 1.4 Heartbeat / Keepalive

- Server sends WebSocket ping frame every **30 seconds**
- Client must respond with pong
- Server disconnects after **2 missed pongs** (60 seconds unresponsive)
- Client-side: if no message received for 45 seconds, send application-level ping as fallback

---

## 2. Connection Lifecycle

### 2.1 Connect

1. Client opens WebSocket to `wss://ws.bush.io/v4/cable?token=bush_tok_...`
2. Server validates token on upgrade -- rejects with `4001` close code if invalid
3. Server associates connection with authenticated user
4. Server responds with connection confirmation:

```json
{
  "type": "connection.established",
  "connection_id": "conn_abc123",
  "server_time": "2026-01-15T10:30:00Z"
}
```

### 2.2 Authenticate (Alternative)

If token is not in query param, client sends it as first message:

```json
{
  "action": "authenticate",
  "token": "bush_tok_..."
}
```

Server responds with `connection.established` or closes with `4001`.

### 2.3 Subscribe

Client subscribes to channels after connection:

```json
{
  "action": "subscribe",
  "channel": "project",
  "resource_id": "proj_abc123"
}
```

Server validates permissions, then confirms:

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

### 2.4 Unsubscribe

```json
{
  "action": "unsubscribe",
  "channel": "project",
  "resource_id": "proj_abc123"
}
```

### 2.5 Disconnect

- Client closes WebSocket normally
- Server cleans up: removes subscriptions, clears presence entries
- On abnormal disconnect (network drop), server detects via missed pongs and cleans up

---

## 3. Channel Model

### 3.1 Channel Types

| Channel | Resource ID | Purpose | Example Events |
|---------|-------------|---------|----------------|
| `project` | `proj_*` | Project-level activity | File uploads, deletes, moves, member changes, status changes |
| `file` | `file_*` | Single file/asset activity | Comments, annotations, versions, processing status, metadata |
| `user` | `user_*` (self only) | Personal events | Notifications, mentions, assignment changes |
| `share` | `share_*` | Share link activity | Reviewer views, comments, downloads |

### 3.2 Permission Checks on Subscribe

| Channel | Required Permission |
|---------|-------------------|
| `project` | Any project-level permission (View Only or above) |
| `file` | Any permission on the file's parent project |
| `user` | Must be the authenticated user (can only subscribe to own channel) |
| `share` | Must be project member with Edit & Share or above, OR valid share token |

### 3.3 Subscription Limits

- Max **50 active subscriptions** per connection
- Subscribing beyond limit returns `subscription.rejected` with reason `subscription_limit_exceeded`

---

## 4. Real-Time Events

### 4.1 Event Message Format

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

- `event_id` -- monotonically increasing per channel/resource, used for missed-event recovery
- `timestamp` -- ISO 8601 server time

### 4.2 Comment Events

| Event | Trigger | Data |
|-------|---------|------|
| `comment.created` | New comment or reply | Full comment object (text, user, timestamp, annotations, parent_id) |
| `comment.updated` | Comment text edited | Comment ID + updated fields |
| `comment.deleted` | Comment removed | Comment ID |
| `comment.completed` | Marked as complete | Comment ID, completed_by, completed_at |

### 4.3 File / Upload Events

| Event | Trigger | Data |
|-------|---------|------|
| `file.created` | New file uploaded | File object (name, type, size, uploader) |
| `file.deleted` | File removed | File ID |
| `file.moved` | File moved to different folder | File ID, old_folder_id, new_folder_id |
| `file.updated` | Metadata changed | File ID + changed fields |
| `file.status_changed` | Workflow status updated | File ID, old_status, new_status, changed_by |
| `upload.progress` | Upload chunk completed | File ID, bytes_uploaded, bytes_total, percentage |

### 4.4 Processing Events

| Event | Trigger | Data |
|-------|---------|------|
| `processing.started` | Transcoding begins | File ID, job_type (transcode, thumbnail, filmstrip, waveform) |
| `processing.progress` | Processing update | File ID, job_type, percentage |
| `processing.completed` | Processing finished | File ID, job_type, output URLs |
| `processing.failed` | Processing error | File ID, job_type, error_message |
| `transcription.completed` | Transcription ready | File ID, language, word_count |

### 4.5 Version Events

| Event | Trigger | Data |
|-------|---------|------|
| `version.created` | New version uploaded | Version object (number, file, uploader) |

### 4.6 Project Events

| Event | Trigger | Data |
|-------|---------|------|
| `folder.created` | New folder | Folder object |
| `folder.deleted` | Folder removed | Folder ID |
| `member.added` | User added to project | User ID, permission_level |
| `member.removed` | User removed from project | User ID |

### 4.7 User Events

| Event | Trigger | Data |
|-------|---------|------|
| `notification.created` | New notification | Full notification object |
| `notification.read` | Notification marked read | Notification ID |

### 4.8 Share Events

| Event | Trigger | Data |
|-------|---------|------|
| `share.viewed` | Someone opens share link | Viewer info (name/email if provided) |
| `share.downloaded` | Asset downloaded from share | File ID, viewer info |

---

## 5. Presence System

### 5.1 Presence Updates

Client broadcasts presence to indicate what they are viewing:

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

### 5.2 Presence Statuses

| Status | Meaning |
|--------|---------|
| `viewing` | Actively viewing the asset |
| `idle` | Tab open but no interaction for 5 minutes |
| `commenting` | Actively writing a comment |

### 5.3 Presence Storage (Redis)

- Key: `bush:presence:{channel}:{resource_id}` (Redis hash)
- Field: `user_id`
- Value: JSON state object
- TTL: **60 seconds** on each key, refreshed on every presence update
- If no update received within 60 seconds, user is automatically removed from presence

### 5.4 Presence Leave

On unsubscribe or disconnect, server immediately removes user from presence and broadcasts:

```json
{
  "type": "presence.leave",
  "channel": "file",
  "resource_id": "file_xyz789",
  "user_id": "user_abc"
}
```

### 5.5 Idle Timeout

- Client tracks user interaction (mouse, keyboard, scroll)
- After **5 minutes** of inactivity, client sends presence update with `status: "idle"`
- On resume of interaction, client sends `status: "viewing"`

### 5.6 UI Rendering

- Asset cards show avatar stack of users currently viewing
- File detail view shows active viewers with cursor position (for video: playhead position)
- Idle users shown with reduced opacity
- Max **5 avatars** shown, then `+N` overflow indicator

---

## 6. Conflict Resolution

### 6.1 Metadata Editing -- Last-Write-Wins

- No locking on metadata fields
- Client sends optimistic update, renders immediately
- Server validates and persists; broadcasts `file.updated` to all subscribers
- If another user changes the same field, the latest write wins
- All clients receive the `file.updated` event and reconcile their local state
- UI: if a field the user is actively editing is changed remotely, show a **conflict indicator** ("This field was updated by [User] -- reload to see latest")

### 6.2 Comment Editing -- Lock-on-Edit

- When a user starts editing a comment, client sends:

```json
{
  "action": "comment.lock",
  "comment_id": "comment_abc"
}
```

- Server sets a Redis lock: `bush:lock:comment:{comment_id}` with **30-second TTL**
- Lock broadcasts to other clients -- they see the comment as "being edited by [User]" and the edit button is disabled
- On save or cancel, client sends `comment.unlock`; server clears the lock
- If lock TTL expires (user abandoned edit), lock auto-releases
- If another user attempts to edit a locked comment, server rejects with `comment.locked` error

### 6.3 File Operations -- Server-Authoritative

- File upload, delete, move, version creation: server is the source of truth
- No optimistic UI for destructive file operations (delete, move)
- Upload: progress is tracked server-side and broadcast
- Version stacking: server determines version number

---

## 7. Optimistic UI Strategy

### 7.1 Applicable Operations

| Operation | Optimistic? | Rationale |
|-----------|-------------|-----------|
| Create comment | Yes | Low conflict risk, high latency sensitivity |
| Edit comment | Yes | User owns the comment, lock prevents conflicts |
| Delete comment | Yes | Immediate feedback expected |
| Mark comment complete | Yes | Simple toggle |
| Edit metadata field | Yes | Last-write-wins makes this safe |
| Upload file | No | Server-authoritative, progress streamed |
| Delete file | No | Destructive, needs server confirmation |
| Move file | No | Affects multiple views, server-authoritative |

### 7.2 Client-Side Prediction Flow (Comments)

1. User creates comment
2. Client generates a temporary `client_id` (e.g., `tmp_abc123`)
3. Client renders the comment immediately with pending state indicator
4. Client sends `POST /v4/files/:id/comments` with `client_id` in the request body
5. Server persists, assigns real `comment_id`, broadcasts `comment.created` event (includes `client_id`)
6. Client matches `client_id` in the event, replaces temp comment with server-confirmed version
7. Pending indicator removed

### 7.3 Reconciliation

- On receiving server confirmation, client replaces optimistic state with server state
- If server response differs from optimistic state (e.g., server sanitized text), client updates silently
- If comment ordering differs (concurrent comments), client reorders

### 7.4 Rollback

- If server rejects the operation (4xx response), client removes the optimistic entry
- Show toast notification: "Comment could not be saved -- [reason]"
- If the user had typed a reply to the failed comment, preserve the reply draft

### 7.5 Conflict Indicators

- Metadata field changed by another user while editing: yellow border + "[User] updated this field"
- Comment being edited by another user: lock icon + "[User] is editing..."
- Asset deleted by another user while viewing: overlay "This asset was deleted by [User]" with navigation to parent

---

## 8. Connection Management

### 8.1 Auto-Reconnect with Exponential Backoff

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |
| 5 | 16 seconds |
| 6+ | 30 seconds (cap) |

- Add random jitter (0--1 second) to each delay to avoid thundering herd
- On successful reconnect, client re-subscribes to all previously active channels
- Reset backoff counter on successful reconnect

### 8.2 Missed Event Recovery

- Client tracks `last_event_id` per channel/resource
- On reconnect, client sends:

```json
{
  "action": "subscribe",
  "channel": "file",
  "resource_id": "file_xyz789",
  "since_event_id": "evt_abc123"
}
```

- Server replays missed events from a **short-term event log** (Redis list, 1-hour TTL, max 1000 events per channel)
- If the gap is too large (events expired), server responds with `subscription.reset` -- client must refetch full state via REST API

### 8.3 Connection State UI

| State | Indicator |
|-------|-----------|
| Connected | None (default) |
| Reconnecting | Yellow dot + "Reconnecting..." in status bar |
| Disconnected (>30s) | Red dot + "Connection lost -- updates may be delayed" |
| Fallback polling | Orange dot + "Limited connectivity -- polling for updates" |

### 8.4 Graceful Degradation -- Polling Fallback

- If WebSocket connection fails **5 consecutive times**, switch to HTTP polling
- Poll interval: **10 seconds** for active views, **60 seconds** for background tabs
- Polling endpoints: standard REST API endpoints (`GET /v4/projects/:id/events`, `GET /v4/files/:id/comments`)
- Continue attempting WebSocket reconnection every **5 minutes** while polling
- On successful WS reconnect, stop polling and resume real-time

---

## 9. Security

### 9.1 Authentication

- Token provided in query parameter on connect OR as first message after upgrade
- Token is the same access token used for REST API (WorkOS JWT)
- Token validated on every connection -- expired tokens cause `4001` close
- No anonymous WebSocket connections (except share channels with valid share token)

### 9.2 Channel Permission Checks

- Permissions checked on every `subscribe` action -- not just on connect
- If a user's permissions change while connected (e.g., removed from project), the server sends:

```json
{
  "type": "subscription.revoked",
  "channel": "project",
  "resource_id": "proj_abc123",
  "reason": "permissions_changed"
}
```

- Permission changes are detected via Redis pub/sub on permission-change events

### 9.3 Rate Limiting

| Action | Limit | Window |
|--------|-------|--------|
| Messages sent (all types) | 100 | per minute |
| Subscribe actions | 20 | per minute |
| Presence updates | 10 | per 10 seconds |
| Comment lock requests | 5 | per minute |

- Exceeding rate limit: server sends `error` message with `rate_limited` code
- Persistent abuse (rate limit hit 5 times in 10 minutes): server closes connection with `4008` close code

### 9.4 Input Validation

- All incoming messages validated against JSON schema
- Max message size: **16 KB**
- Invalid messages: server responds with `error` message, does not disconnect
- `resource_id` format validated before any processing

### 9.5 Close Codes

| Code | Meaning |
|------|---------|
| `4001` | Authentication failed |
| `4003` | Forbidden (permission denied) |
| `4008` | Rate limit exceeded (persistent) |
| `4009` | Invalid message format |
| `4029` | Too many connections from same user (max 10) |

---

## 10. Server Implementation Notes (Bun)

### 10.1 Connection Handling

```typescript
Bun.serve({
  port: 3001,
  fetch(req, server) {
    const token = new URL(req.url).searchParams.get("token");
    const user = await validateToken(token);
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

### 10.2 Redis Integration

- One Redis subscriber per Bun instance (not per client connection)
- Bun instance maintains a local map: `channelKey -> Set<WebSocket>`
- On Redis message received, iterate local subscribers and forward
- Use `redis.subscribe()` / `redis.unsubscribe()` as clients join/leave channels
- Only subscribe to a Redis channel when at least one local client needs it; unsubscribe when none remain

### 10.3 Event Publishing (Backend Services)

When a backend action creates a real-time event (e.g., comment created via REST API):

1. Persist to database
2. Store event in Redis event log (for missed-event recovery): `LPUSH bush:events:{channel}:{resource_id}` with TTL
3. Publish to Redis pub/sub: `PUBLISH bush:ws:{channel}:{resource_id}`
4. All Bun instances receive and forward to local subscribers

---

## 11. Client SDK (TypeScript)

### 11.1 API Surface

```typescript
interface BushSocket {
  connect(token: string): Promise<void>;
  subscribe(channel: string, resourceId: string, opts?: { sinceEventId?: string }): void;
  unsubscribe(channel: string, resourceId: string): void;
  sendPresence(channel: string, resourceId: string, state: PresenceState): void;
  on(event: string, handler: (data: EventMessage) => void): void;
  off(event: string, handler: (data: EventMessage) => void): void;
  readonly state: "connecting" | "connected" | "reconnecting" | "disconnected" | "polling";
  disconnect(): void;
}
```

### 11.2 React Integration

```typescript
// Hook: subscribe to a channel and receive events
function useChannel(channel: string, resourceId: string): {
  events: EventMessage[];
  presence: PresenceUser[];
  connectionState: ConnectionState;
}

// Hook: presence for current user
function usePresence(channel: string, resourceId: string): {
  setStatus(status: PresenceStatus): void;
  setCursorPosition(position: number): void;
}
```

### 11.3 Next.js Considerations

- WebSocket client initialized in a React context provider at the app layout level
- Connection persists across client-side navigation (no reconnect on route change)
- Server components do not use WebSocket -- real-time is client-only
- Initial page load fetches data via REST (SSR); WebSocket provides updates after hydration
