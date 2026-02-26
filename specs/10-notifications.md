# Bush - Notification System

## Overview

Notifications inform users of activity that requires their attention: new comments, file processing results, project invitations, and more. Every notification is always delivered in-app (via WebSocket when the user is online, or available for polling on reconnect). Email is the secondary channel and is presence-aware: if the user has an active WebSocket connection subscribed to the relevant project, email is suppressed. If the user has been offline for more than 5 minutes, pending notifications are batched and queued for email delivery. This design avoids email spam for users actively working in the product while ensuring offline users are never silently missed.

---

## 1. Notification Types

| Type | Trigger | Target users |
|------|---------|-------------|
| `comment_added` | New top-level comment on a file | File watchers, project members with `comment_only` or higher |
| `comment_reply` | Reply added to a comment thread | Thread participants (commenter + previous repliers) |
| `mention` | User @-mentioned in a comment body | Mentioned user |
| `file_uploaded` | File upload completes (status → `ready`) | Project members with `edit` or higher |
| `file_processing_complete` | Proxy/thumbnail generation succeeds | File uploader |
| `file_processing_failed` | Processing job fails permanently | File uploader, account admins |
| `version_added` | New version pushed to a version stack | Watchers of the version stack |
| `status_changed` | File review status changes | File assignee, project members with `comment_only` or higher |
| `assignment` | File assigned to a user | Assigned user |
| `share_created` | Share link created for a project/file | Project owner, account admins |
| `share_accessed` | Share link first accessed by a reviewer | Share creator |
| `project_invitation` | User invited to a project | Invited user |

**Phase tag**: All types above = MVP.

Future types (not in MVP): `approval_requested`, `approval_decision`, `export_complete`.

---

## 2. Data Model

### `notifications` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK, `ntf_` prefix | Notification ID |
| `user_id` | text | FK → users.id, NOT NULL | Recipient |
| `account_id` | text | FK → accounts.id, NOT NULL | Account scope |
| `type` | text | NOT NULL | One of the types in section 1 |
| `title` | text | NOT NULL | Short display title (e.g., "New comment on video.mp4") |
| `body` | text | NOT NULL | Full notification body |
| `resource_type` | text | NOT NULL | `file` \| `comment` \| `project` \| `share` |
| `resource_id` | text | NOT NULL | ID of the primary resource |
| `project_id` | text | FK → projects.id, nullable | Project context (null for account-level notifications) |
| `actor_id` | text | FK → users.id, nullable | User who triggered the notification (null for system events) |
| `read` | boolean | NOT NULL, default false | Read state |
| `email_sent` | boolean | NOT NULL, default false | Whether an email has been dispatched for this notification |
| `created_at` | datetime | NOT NULL, default now | Creation timestamp |
| `read_at` | datetime | nullable | When the user read it |

**Indexes**: `(user_id, read, created_at DESC)` for unread count queries. `(user_id, created_at DESC)` for the notification feed. `(project_id, created_at DESC)` for batch email queries.

### `notification_preferences` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | text | FK → users.id, NOT NULL | User |
| `type` | text | NOT NULL | Notification type (matches types in section 1) |
| `email_enabled` | boolean | NOT NULL, default true | Whether email should be sent for this type |
| `in_app_enabled` | boolean | NOT NULL, default true | Whether in-app delivery is active (reserved; always true for MVP) |
| PRIMARY KEY | — | `(user_id, type)` | One row per user per type |

**Default behavior**: If no row exists for a `(user_id, type)` pair, treat as `email_enabled = true`. Preferences only need to be stored when the user has changed a default.

---

## 3. Delivery Channels

### 3.1 In-App (Always)

**Phase tag**: MVP.

Every notification is persisted to the `notifications` table immediately when the triggering event occurs. Delivery to the browser:

1. **User is online** (active WebSocket connection): push the notification payload directly over the WebSocket connection. The client updates the unread count and inserts the item into the notification dropdown without a page refresh.
2. **User is offline or reconnecting**: the notification sits in the database. On WebSocket reconnect, the client queries `GET /v4/notifications?since=<last_seen_at>` to fetch any missed notifications.

WebSocket payload for a new notification:
```json
{
  "type": "notification.created",
  "payload": {
    "id": "ntf_xxx",
    "type": "comment_added",
    "title": "New comment on video.mp4",
    "body": "Jane: 'The color grading looks great at 01:23'",
    "resource_type": "file",
    "resource_id": "fil_xxx",
    "project_id": "prj_xxx",
    "actor_id": "usr_xxx",
    "read": false,
    "created_at": "2026-01-15T10:00:00Z"
  }
}
```

### 3.2 Email (Presence-Aware)

**Phase tag**: Presence-aware suppression = MVP. Aggregation = Phase 2.

Email delivery is controlled by the following decision tree, evaluated when a notification is created:

```
1. Does the user have email_enabled = true for this notification type? (default: yes)
   NO  → do not send email. Done.
   YES → continue.

2. Is the user currently "online" for the relevant project?
   (Definition: active WebSocket connection subscribed to project_id within last 5 minutes)
   YES → suppress email. Mark notification.email_sent = false. Done.
   NO  → continue.

3. Enqueue email to BullMQ `email:send` queue with a 5-minute delay.
   The job checks presence again at execution time.
   If user came online during the delay → cancel/skip the email job.
   If user is still offline → deliver the email.
```

**Aggregation (Phase 2)**: Instead of one email per notification, batch notifications within a 5-minute window per user. A single email covers "3 new comments on video.mp4" and "2 new files in Campaign 2026". Implementation: the BullMQ job is a "pending email batch" with a debounced delay; adding more notifications to the same window extends or replaces the existing job.

---

## 4. Presence Detection

**Phase tag**: MVP.

Presence is tracked in the WebSocket connection manager (`src/realtime/ws-manager.ts`) using an in-memory map:

```
presenceMap: Map<userId, Map<projectId, lastSeenAt>>
```

- When a client sends `{ type: "subscribe", projectId: "prj_xxx" }`, the manager sets `presenceMap[userId][projectId] = Date.now()`.
- The manager updates `lastSeenAt` on every incoming WebSocket message (heartbeat, or any event acknowledgment).
- When a connection closes, the manager removes the user's entry for all subscribed projects.
- A user is considered "online for project X" if `Date.now() - lastSeenAt < 5 * 60 * 1000` (5 minutes).

The notification creation logic calls `presenceManager.isOnline(userId, projectId)` synchronously (in-process, no Redis round-trip needed for MVP). Returns `true` if the user is online within the 5-minute window.

**Phase 2 scaling**: When the system moves to multiple processes (separate API and WebSocket server), presence state moves to Redis. Key: `bush:presence:{userId}:{projectId}` with a 5-minute TTL, refreshed on each WebSocket message.

---

## 5. API Endpoints

### `GET /v4/notifications`

Returns the calling user's notifications, newest first.

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `unread_only` | boolean | false | Return only unread notifications |
| `limit` | number | 30 | Max items (1–100) |
| `cursor` | string | — | Pagination cursor |
| `since` | ISO datetime | — | Return notifications created after this time (for reconnect sync) |

**Response** `200 OK`:
```json
{
  "items": [
    {
      "id": "ntf_xxx",
      "type": "comment_added",
      "title": "New comment on video.mp4",
      "body": "Jane: 'The color grading looks great at 01:23'",
      "resource_type": "file",
      "resource_id": "fil_xxx",
      "project_id": "prj_xxx",
      "actor_id": "usr_xxx",
      "read": false,
      "created_at": "2026-01-15T10:00:00Z"
    }
  ],
  "unread_count": 5,
  "next_cursor": "eyJvZmZzZXQiOjMwfQ=="
}
```

### `PATCH /v4/notifications/:id/read`

Mark a single notification as read. Sets `read = true`, `read_at = now()`.

**Response** `200 OK`: updated notification object.

### `POST /v4/notifications/read-all`

Mark all of the calling user's unread notifications as read.

**Response** `204 No Content`.

### `GET /v4/notifications/preferences`

Return the calling user's notification preferences. Returns the full list of notification types with their current settings (defaults filled in for types without a stored row).

**Response** `200 OK`:
```json
{
  "preferences": [
    { "type": "comment_added", "email_enabled": true, "in_app_enabled": true },
    { "type": "mention", "email_enabled": true, "in_app_enabled": true },
    ...
  ]
}
```

### `PATCH /v4/notifications/preferences`

Update one or more preferences.

**Request body**:
```json
{
  "preferences": [
    { "type": "file_uploaded", "email_enabled": false }
  ]
}
```

**Response** `200 OK`: full updated preferences list (same shape as GET).

---

## 6. Frontend

### 6.1 Notification Bell

- Location: main header, right side, present on all authenticated pages.
- Shows a red badge with unread count when `unread_count > 0`. Badge caps display at `99+`.
- Clicking opens the notification dropdown.

### 6.2 Notification Dropdown

- Lists most recent 30 notifications (paginated with "Load more" at bottom).
- Unread notifications have a distinct visual treatment (background color, bold title).
- Clicking a notification:
  1. Marks it as read (`PATCH /v4/notifications/:id/read`).
  2. Navigates to the relevant resource (file viewer, comment thread, etc.).
- "Mark all as read" button at the top of the dropdown.
- Empty state: "No notifications yet."

### 6.3 Real-Time Updates

The `useRealtime` hook receives `notification.created` events and updates the unread count and notification list without requiring a page refresh. The unread count in the bell badge increments immediately.

### 6.4 Preferences Page

Located at Settings > Notifications. A table of notification types with toggle switches for email delivery per type. Changes saved immediately via `PATCH /v4/notifications/preferences`.

---

## 7. Notification Creation (Internal)

Notifications are created by service functions called from route handlers and BullMQ worker callbacks — not directly in route handlers. All creation goes through `createNotification(params)` in `src/notifications/service.ts`:

```typescript
async function createNotification(params: {
  userId: string;
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  actorId?: string;
}): Promise<void>
```

This function:
1. Inserts the row into `notifications`.
2. Pushes a WebSocket event if the user is online.
3. Evaluates whether to enqueue an email job (presence check + preference check).

---

## 8. Notification Cleanup

A scheduled BullMQ job (`notifications:cleanup`) runs nightly and deletes notifications older than 90 days:

```sql
DELETE FROM notifications WHERE created_at < datetime('now', '-90 days');
```

**Phase tag**: MVP.

---

## 9. Phase Summary

| Feature | Phase |
|---------|-------|
| In-app notifications (all types) | MVP |
| WebSocket real-time delivery | MVP |
| Reconnect polling (`?since=`) | MVP |
| Presence-aware email suppression | MVP |
| Per-type email preferences | MVP |
| 90-day notification cleanup | MVP |
| Email aggregation (5-min batching) | Phase 2 |
| Redis-backed presence (multi-process) | Phase 2 |
| Mobile push notifications (APNs/FCM) | Future |

---

## Cross-References

- `05-realtime.md` — WebSocket connection manager, event bus, presence tracking
- `11-email.md` — email delivery mechanism, queue, provider abstraction
- `04-api-reference.md` — API conventions, cursor pagination, authentication
- `01-data-model.md` — base data model conventions, ID prefixes
- `30-configuration.md` — env var patterns
