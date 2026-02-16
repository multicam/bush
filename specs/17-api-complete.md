# 17 -- Bush API Complete Specification

## Version: V4 (Current)

---

## 1. Design Principles

- RESTful architecture with JSON:API-style response envelopes
- All endpoints prefixed with `/v4/`
- Content-Type: `application/json` for all requests and responses
- UTF-8 encoding throughout
- Idempotent operations where possible (PUT, DELETE)
- Resource-oriented URLs: nouns, not verbs
- Plural resource names (`/projects`, not `/project`)
- Nested resources for parent-child relationships (`/projects/:id/files`)
- HATEOAS-lite: `links` object in responses for pagination, not full hypermedia

---

## 2. Authentication

### 2.1 Authentication Methods

#### Web (Browser) — Cookie-Based Auth

The web frontend authenticates via WorkOS AuthKit cookies. No bearer token is needed for browser requests.

1. User logs in via WorkOS AuthKit hosted UI
2. AuthKit SDK creates an encrypted `wos-session` cookie (iron-session)
3. Browser sends this cookie with each request (via Next.js rewrite proxy for `/v4/*`)
4. Hono auth middleware unseals the `wos-session` cookie and creates/retrieves a Bush session from Redis
5. Session includes user ID, account ID, role — scoping all API responses

This flow is transparent to the frontend: the web API client simply makes relative `/v4/*` requests.

#### API — Bearer Tokens

External API clients and service-to-service integrations use bearer tokens:

```
Authorization: Bearer bush_tok_abc123def456...
```

**Token format:** `bush_tok_` prefix followed by base62 string.

Alternatively, a `userId:sessionId` pair can be used as a bearer token (useful for development/testing).

**Token lifecycle (planned):**
- Token refresh via `POST /v4/auth/token` with refresh token
- Access tokens expire after 5 minutes (aligned with `specs/12-authentication.md`)
- Refresh tokens expire after 7 days

### 2.2 API Keys (Server-to-Server)

For automated integrations and CI/CD pipelines, API keys can be used instead of OAuth tokens.

```
Authorization: Bearer bush_key_abc123def456...
```

- Generated in Account Settings > Developer > API Keys
- Scoped to specific permissions (read-only, read-write, admin)
- No expiration unless explicitly set
- Can be revoked at any time
- API key format: `bush_key_` prefix followed by 48-character base62 string

### 2.3 Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v4/auth/token` | Exchange refresh token for new access token |
| `POST` | `/v4/auth/revoke` | Revoke a token |
| `GET` | `/v4/auth/me` | Get current authenticated user and permissions |

**Example -- Token Refresh:**

```http
POST /v4/auth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "bush_rt_abc123..."
}
```

```json
{
  "data": {
    "access_token": "bush_tok_newtoken...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "bush_rt_newrefresh..."
  }
}
```

---

## 3. Response Format

### 3.1 Success Response (List)

```json
{
  "data": [
    {
      "id": "abc123",
      "type": "file",
      "attributes": {
        "name": "hero-shot.mp4",
        "file_size": 104857600,
        "status": "complete",
        "created_at": "2026-01-15T10:30:00Z",
        "updated_at": "2026-01-15T10:35:00Z"
      }
    }
  ],
  "links": {
    "next": "/v4/projects/xyz/files?cursor=eyJpZCI6ImFiYzEyMyJ9"
  },
  "total_count": 142
}
```

### 3.2 Success Response (Single Resource)

```json
{
  "data": {
    "id": "abc123",
    "type": "file",
    "attributes": { ... }
  }
}
```

### 3.3 Success Response (No Content)

HTTP 204 with empty body. Used for DELETE operations and some updates.

### 3.4 Error Response

```json
{
  "errors": [
    {
      "title": "Validation Error",
      "detail": "Name must be between 1 and 255 characters",
      "status": 422,
      "code": "validation_error",
      "source": {
        "pointer": "/data/attributes/name"
      }
    }
  ]
}
```

Error codes: `validation_error`, `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limit_exceeded`, `service_unavailable`, `internal_error`.

Multiple errors can be returned in a single response.

### 3.5 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST that creates a resource |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Malformed request syntax |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Valid auth but insufficient permissions |
| 404 | Not Found | Resource does not exist or not accessible |
| 409 | Conflict | Resource state conflict (e.g., duplicate name) |
| 422 | Unprocessable Entity | Valid syntax but semantic validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |
| 503 | Service Unavailable | Maintenance or overload |

---

## 4. Pagination

### 4.1 Cursor-Based Pagination

All list endpoints use cursor-based pagination. Offset-based pagination is not supported.

**Query parameters:**
- `limit` -- Number of items per page (default: 50, max: 100)
- `cursor` -- Opaque base64url cursor token from previous response

**Example:**

```http
GET /v4/projects/xyz/files?limit=25
```

```json
{
  "data": [ ... ],
  "links": {
    "self": "/v4/projects/xyz/files?limit=25",
    "next": "/v4/projects/xyz/files?limit=25&cursor=eyJpZCI6ImFiYzEyMyJ9"
  },
  "meta": {
    "total_count": 142,
    "page_size": 25,
    "has_more": true
  }
}
```

- When there are no more pages, `links.next` is `null`
- Cursor tokens are base64-encoded, opaque to clients, and expire after 24 hours
- Sort order is preserved across pages

### 4.2 Sorting

- `sort` parameter accepts field names, prefixed with `-` for descending
- Example: `?sort=-created_at` (newest first)
- Default sort: `-created_at` for most resources

---

## 5. Rate Limiting

### 5.1 Algorithm

Sliding window algorithm backed by Redis sorted sets. Each endpoint category has its own rate limit configuration. Requests are tracked per IP (or per account when authenticated).

### 5.2 Limits

| Endpoint Category | Rate | Window |
|-------------------|------|--------|
| Standard (all API) | 100 req/min | 60s |
| Auth endpoints | 10 req/min | 60s |
| Upload endpoints | 20 req/min | 60s |
| Search endpoints | 30 req/min | 60s |
| Webhook endpoints | 1000 req/min | 60s |

Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` environment variables.

### 5.3 Response Headers

Every response includes rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706123456
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

### 5.4 Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706123456
```

```json
{
  "errors": [
    {
      "title": "Rate Limit Exceeded",
      "detail": "You have exceeded the rate limit. Retry after 2 seconds."
    }
  ]
}
```

---

## 6. Complete Endpoint Inventory

### 6.1 Accounts

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/accounts/:id` | Get account details | Account Member |
| `PUT` | `/v4/accounts/:id` | Update account settings | Account Owner |
| `GET` | `/v4/accounts/:id/members` | List account members | Account Member |
| `POST` | `/v4/accounts/:id/members` | Invite member to account | Account Owner, Content Admin |
| `DELETE` | `/v4/accounts/:id/members/:user_id` | Remove member from account | Account Owner, Content Admin |
| `PUT` | `/v4/accounts/:id/members/:user_id` | Update member role | Account Owner |
| `GET` | `/v4/accounts/:id/storage` | Get storage usage | Account Owner, Content Admin |

### 6.2 Workspaces

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/accounts/:account_id/workspaces` | List workspaces | Account Member |
| `POST` | `/v4/accounts/:account_id/workspaces` | Create workspace | Account Owner, Content Admin |
| `GET` | `/v4/workspaces/:id` | Get workspace details | Workspace Member |
| `PUT` | `/v4/workspaces/:id` | Update workspace | Account Owner, Content Admin |
| `DELETE` | `/v4/workspaces/:id` | Delete workspace | Account Owner |
| `GET` | `/v4/workspaces/:id/members` | List workspace members | Workspace Member |
| `POST` | `/v4/workspaces/:id/members` | Add member to workspace | Full Access+ |
| `PUT` | `/v4/workspaces/:id/members/:user_id` | Update member permission | Full Access+ |
| `DELETE` | `/v4/workspaces/:id/members/:user_id` | Remove member from workspace | Full Access+ |

### 6.3 Projects

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/workspaces/:workspace_id/projects` | List projects in workspace | Workspace Member |
| `POST` | `/v4/workspaces/:workspace_id/projects` | Create project | Edit+ |
| `GET` | `/v4/projects/:id` | Get project details | Project Member |
| `PUT` | `/v4/projects/:id` | Update project | Edit+ |
| `DELETE` | `/v4/projects/:id` | Delete project | Account Owner, Content Admin |
| `POST` | `/v4/projects/:id/duplicate` | Duplicate project | Edit+ |
| `PUT` | `/v4/projects/:id/archive` | Archive/unarchive project | Edit+ |
| `GET` | `/v4/projects/:id/members` | List project members | Project Member |
| `POST` | `/v4/projects/:id/members` | Add member to project | Full Access+ |
| `PUT` | `/v4/projects/:id/members/:user_id` | Update member permission | Full Access+ |
| `DELETE` | `/v4/projects/:id/members/:user_id` | Remove member from project | Full Access+ |

### 6.4 Folders

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/projects/:project_id/folders` | List root-level folders | View Only+ |
| `GET` | `/v4/folders/:id` | Get folder details | View Only+ |
| `GET` | `/v4/folders/:id/children` | List folder contents (files, subfolders) | View Only+ |
| `POST` | `/v4/projects/:project_id/folders` | Create folder at project root | Edit+ |
| `POST` | `/v4/folders/:id/folders` | Create subfolder | Edit+ |
| `PUT` | `/v4/folders/:id` | Update folder (rename, restrict) | Edit+ |
| `DELETE` | `/v4/folders/:id` | Delete folder and contents | Edit+ |
| `POST` | `/v4/folders/:id/move` | Move folder to new parent | Edit+ |

### 6.5 Files

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/projects/:project_id/files` | List files in project root | View Only+ |
| `GET` | `/v4/folders/:folder_id/files` | List files in folder | View Only+ |
| `GET` | `/v4/files/:id` | Get file details | View Only+ |
| `POST` | `/v4/files` | Create file placeholder + get upload URLs | Edit+ |
| `PUT` | `/v4/files/:id` | Update file metadata | Edit+ |
| `DELETE` | `/v4/files/:id` | Delete file | Edit+ |
| `POST` | `/v4/files/:id/move` | Move file to folder/project | Edit+ |
| `POST` | `/v4/files/:id/copy` | Copy file to folder/project | Edit+ |
| `GET` | `/v4/files/:id/download` | Get download URL (signed, expires 1h) | Edit & Share+ |
| `GET` | `/v4/files/:id/thumbnail` | Get thumbnail URL | View Only+ |
| `GET` | `/v4/files/:id/proxy` | Get proxy/preview URL | View Only+ |

**File Upload Flow:**

1. `POST /v4/files` -- Create placeholder, receive pre-signed upload URLs
2. `PUT` to each pre-signed URL -- Upload file chunks directly to storage
3. System processes upload asynchronously (transcoding, thumbnail generation)
4. Poll `GET /v4/files/:id` or listen via WebSocket for status updates

**Example -- Create File:**

```http
POST /v4/files
Content-Type: application/json
Authorization: Bearer bush_tok_...

{
  "data": {
    "type": "file",
    "attributes": {
      "name": "hero-shot.mp4",
      "file_size": 104857600,
      "file_type": "video/mp4"
    },
    "relationships": {
      "parent": {
        "type": "folder",
        "id": "folder_abc123"
      }
    }
  }
}
```

```json
{
  "data": {
    "id": "file_xyz789",
    "type": "file",
    "attributes": {
      "name": "hero-shot.mp4",
      "status": "waiting_upload",
      "upload_urls": [
        "https://storage.bush.io/upload/chunk1?sig=...",
        "https://storage.bush.io/upload/chunk2?sig=..."
      ],
      "chunk_size": 52428800,
      "created_at": "2026-01-15T10:30:00Z"
    }
  }
}
```

### 6.6 Version Stacks

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/files/:file_id/versions` | List all versions of a file | View Only+ |
| `POST` | `/v4/files/:file_id/versions` | Add new version to stack | Edit+ |
| `GET` | `/v4/versions/:id` | Get specific version details | View Only+ |
| `PUT` | `/v4/versions/:id` | Update version metadata | Edit+ |
| `DELETE` | `/v4/versions/:id` | Delete specific version | Edit+ |
| `PUT` | `/v4/versions/:id/set-current` | Set version as current | Edit+ |
| `POST` | `/v4/files/stack` | Create version stack from multiple files | Edit+ |
| `POST` | `/v4/files/:file_id/unstack` | Remove file from version stack | Edit+ |

### 6.7 Users

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/users/me` | Get current user profile | Authenticated |
| `PUT` | `/v4/users/me` | Update current user profile | Authenticated |
| `GET` | `/v4/users/:id` | Get user profile | Account Member |
| `GET` | `/v4/users/me/notifications/settings` | Get notification preferences | Authenticated |
| `PUT` | `/v4/users/me/notifications/settings` | Update notification preferences | Authenticated |
| `GET` | `/v4/users/me/accounts` | List accounts user belongs to | Authenticated |

### 6.8 Comments

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/files/:file_id/comments` | List comments on a file | Comment Only+ |
| `POST` | `/v4/files/:file_id/comments` | Create comment on file | Comment Only+ |
| `GET` | `/v4/comments/:id` | Get comment details | Comment Only+ |
| `PUT` | `/v4/comments/:id` | Update comment (own only) | Comment Only+ |
| `DELETE` | `/v4/comments/:id` | Delete comment (own or admin) | Comment Only+ (own), Full Access+ (any) |
| `POST` | `/v4/comments/:id/replies` | Reply to comment | Comment Only+ |
| `PUT` | `/v4/comments/:id/complete` | Mark comment as complete | Edit+ |

**Comment attributes:**
- `text` -- Comment body (supports @mentions as `@[user_id]`)
- `timestamp` -- Timecode for video/audio comments (seconds, float)
- `duration` -- Duration of time-range annotation (seconds, float)
- `annotation` -- Drawing/shape annotation data (JSON)
- `page` -- Page number for PDF/document comments

**Example -- Create Comment:**

```http
POST /v4/files/file_xyz789/comments
Content-Type: application/json

{
  "data": {
    "type": "comment",
    "attributes": {
      "text": "The color grading looks off here @[user_abc]",
      "timestamp": 34.5,
      "annotation": {
        "type": "rectangle",
        "x": 0.2,
        "y": 0.3,
        "width": 0.4,
        "height": 0.3
      }
    }
  }
}
```

### 6.9 Shares

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/projects/:project_id/shares` | List shares for project | Edit & Share+ |
| `POST` | `/v4/shares` | Create share | Edit & Share+ |
| `GET` | `/v4/shares/:id` | Get share details | Edit & Share+ |
| `PUT` | `/v4/shares/:id` | Update share settings | Edit & Share+ |
| `DELETE` | `/v4/shares/:id` | Delete share | Edit & Share+ |
| `POST` | `/v4/shares/:id/items` | Add items to share | Edit & Share+ |
| `DELETE` | `/v4/shares/:id/items/:item_id` | Remove item from share | Edit & Share+ |
| `GET` | `/v4/shares/:id/activity` | Get share view/download activity | Edit & Share+ |
| `POST` | `/v4/shares/:id/invite` | Send share invitation email | Edit & Share+ |

**Share attributes:**
- `layout` -- `grid`, `reel`, or `viewer`
- `allow_comments` -- Boolean
- `allow_downloads` -- Boolean
- `show_all_versions` -- Boolean
- `show_transcriptions` -- Boolean
- `passphrase` -- Optional passphrase protection
- `expires_at` -- Optional expiration timestamp
- `branding` -- Object with `icon`, `header`, `background`, `description`, `theme`, `accent_color`

### 6.10 Custom Fields / Metadata

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/accounts/:account_id/custom_fields` | List all custom field definitions | Account Member |
| `POST` | `/v4/accounts/:account_id/custom_fields` | Create custom field definition | Admin, Full Access |
| `GET` | `/v4/custom_fields/:id` | Get custom field definition | Account Member |
| `PUT` | `/v4/custom_fields/:id` | Update custom field definition | Admin, Full Access |
| `DELETE` | `/v4/custom_fields/:id` | Delete custom field definition | Admin |
| `GET` | `/v4/files/:file_id/metadata` | Get all metadata for file | View Only+ |
| `PUT` | `/v4/files/:file_id/metadata` | Set/update metadata values on file | Edit+ |
| `PUT` | `/v4/files/:file_id/metadata/:field_id` | Set single metadata field value | Edit+ |

**Custom field types:** `text`, `textarea`, `number`, `date`, `single_select`, `multi_select`, `checkbox`, `user`, `url`, `rating`

**Example -- Set Metadata:**

```http
PUT /v4/files/file_xyz789/metadata
Content-Type: application/json

{
  "data": {
    "field_abc": "approved",
    "field_def": ["vfx", "color"],
    "field_ghi": 4
  }
}
```

### 6.11 Collections

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/projects/:project_id/collections` | List collections in project | View Only+ |
| `POST` | `/v4/projects/:project_id/collections` | Create collection | Edit+ |
| `GET` | `/v4/collections/:id` | Get collection details and items | View Only+ |
| `PUT` | `/v4/collections/:id` | Update collection | Collection Creator, Admin |
| `DELETE` | `/v4/collections/:id` | Delete collection | Collection Creator, Admin |
| `POST` | `/v4/collections/:id/items` | Add items to collection | Collection Creator, Edit+ |
| `DELETE` | `/v4/collections/:id/items/:item_id` | Remove item from collection | Collection Creator, Edit+ |

### 6.12 Webhooks

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/accounts/:account_id/webhooks` | List webhooks | Account Owner, Content Admin |
| `POST` | `/v4/accounts/:account_id/webhooks` | Create webhook | Account Owner, Content Admin |
| `GET` | `/v4/webhooks/:id` | Get webhook details | Account Owner, Content Admin |
| `PUT` | `/v4/webhooks/:id` | Update webhook | Account Owner, Content Admin |
| `DELETE` | `/v4/webhooks/:id` | Delete webhook | Account Owner, Content Admin |
| `GET` | `/v4/webhooks/:id/deliveries` | List recent deliveries | Account Owner, Content Admin |
| `POST` | `/v4/webhooks/:id/test` | Send test event | Account Owner, Content Admin |

**Webhook event types:**

| Event | Trigger |
|-------|---------|
| `file.created` | File uploaded |
| `file.updated` | File metadata changed |
| `file.deleted` | File deleted |
| `file.status_changed` | Processing status changed |
| `file.downloaded` | File downloaded |
| `version.created` | New version added |
| `comment.created` | Comment posted |
| `comment.updated` | Comment edited |
| `comment.deleted` | Comment deleted |
| `comment.completed` | Comment marked complete |
| `share.created` | Share link created |
| `share.viewed` | Share link opened by recipient |
| `project.created` | Project created |
| `project.updated` | Project settings changed |
| `project.deleted` | Project deleted |
| `member.added` | User added to project/workspace |
| `member.removed` | User removed from project/workspace |
| `transcription.completed` | Transcription finished processing |

**Webhook payload format:**

```json
{
  "event": "comment.created",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "id": "comment_abc123",
    "type": "comment",
    "attributes": { ... }
  },
  "account_id": "account_xyz",
  "webhook_id": "webhook_def"
}
```

**Webhook security:**
- Payloads signed with HMAC-SHA256
- Signature in `x-bush-signature` header
- Secret provided at webhook creation time
- Delivery retried 3 times with exponential backoff (1min, 5min, 30min)

### 6.13 Search

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/accounts/:account_id/search` | Search across account | Account Member |
| `GET` | `/v4/projects/:project_id/search` | Search within project | Project Member |

**Query parameters:**
- `q` -- Search query string (required)
- `type` -- Filter by resource type: `file`, `folder`, `project`, `comment`
- `file_type` -- Filter by file type: `video`, `image`, `audio`, `document`
- `status` -- Filter by status
- `uploader` -- Filter by uploader user ID
- `created_after` -- ISO 8601 timestamp
- `created_before` -- ISO 8601 timestamp
- `sort` -- `relevance` (default), `-created_at`, `name`
- Standard pagination parameters

**Example:**

```http
GET /v4/accounts/acc_123/search?q=hero+shot&type=file&file_type=video&sort=relevance&page[size]=25
```

### 6.14 Transcription

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/v4/files/:file_id/transcription` | Generate transcription | Edit+ |
| `GET` | `/v4/files/:file_id/transcription` | Get transcription | View Only+ |
| `PUT` | `/v4/files/:file_id/transcription` | Update transcription text | Edit+ |
| `DELETE` | `/v4/files/:file_id/transcription` | Delete transcription | Edit+ |
| `GET` | `/v4/files/:file_id/transcription/export` | Export transcription (SRT, VTT, TXT) | Edit & Share+ |
| `POST` | `/v4/files/:file_id/captions` | Upload caption file (SRT/VTT) | Edit+ |
| `GET` | `/v4/files/:file_id/captions` | List caption tracks | View Only+ |
| `DELETE` | `/v4/files/:file_id/captions/:caption_id` | Delete caption track | Edit+ |

**Transcription request attributes:**
- `language` -- ISO 639-1 code or `auto` for auto-detection
- `speaker_identification` -- Boolean (requires consent acknowledgment)

### 6.15 Notifications

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/v4/users/me/notifications` | List notifications | Authenticated |
| `PUT` | `/v4/notifications/:id/read` | Mark notification as read | Authenticated |
| `PUT` | `/v4/users/me/notifications/read-all` | Mark all notifications as read | Authenticated |
| `GET` | `/v4/users/me/notifications/unread-count` | Get unread notification count | Authenticated |

---

## 7. Bulk Operations

Bulk endpoints accept arrays of resource IDs and apply the same operation to all. Maximum 100 items per bulk request.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `POST` | `/v4/bulk/files/move` | Move multiple files to a folder/project | Edit+ |
| `POST` | `/v4/bulk/files/copy` | Copy multiple files | Edit+ |
| `POST` | `/v4/bulk/files/delete` | Delete multiple files | Edit+ |
| `POST` | `/v4/bulk/files/metadata` | Update metadata on multiple files | Edit+ |
| `POST` | `/v4/bulk/files/download` | Get download URLs for multiple files | Edit & Share+ |
| `POST` | `/v4/bulk/folders/move` | Move multiple folders | Edit+ |
| `POST` | `/v4/bulk/folders/delete` | Delete multiple folders | Edit+ |
| `POST` | `/v4/bulk/members/add` | Add members to multiple projects | Full Access+ |
| `POST` | `/v4/bulk/members/remove` | Remove members from multiple projects | Full Access+ |

**Example -- Bulk Move:**

```http
POST /v4/bulk/files/move
Content-Type: application/json

{
  "data": {
    "file_ids": ["file_aaa", "file_bbb", "file_ccc"],
    "destination": {
      "type": "folder",
      "id": "folder_xyz"
    }
  }
}
```

```json
{
  "data": {
    "succeeded": ["file_aaa", "file_bbb"],
    "failed": [
      {
        "id": "file_ccc",
        "error": "File not found"
      }
    ]
  }
}
```

Bulk operations are processed atomically where possible. If partial failure occurs, the response indicates which items succeeded and which failed.

---

## 8. WebSocket Protocol

### 8.1 Connection

```
wss://ws.bush.io/v4/cable?token=bush_tok_...
```

- Authentication via query parameter or first message after connect
- Connection uses WebSocket protocol (RFC 6455)
- Heartbeat ping every 30 seconds; server disconnects after 2 missed pongs
- Automatic reconnection expected from clients with exponential backoff

### 8.2 Channel Subscription

After connecting, clients subscribe to channels for specific resources:

```json
{
  "action": "subscribe",
  "channel": "project",
  "resource_id": "project_abc123"
}
```

```json
{
  "action": "subscribe",
  "channel": "file",
  "resource_id": "file_xyz789"
}
```

**Available channels:**
- `project` -- Events within a project (uploads, deletes, moves)
- `file` -- Events on a specific file (comments, status changes, versions)
- `user` -- Personal events (notifications, mentions)
- `share` -- Share link activity (views, comments)

### 8.3 Event Message Format

```json
{
  "channel": "file",
  "resource_id": "file_xyz789",
  "event": "comment.created",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "id": "comment_abc",
    "type": "comment",
    "attributes": {
      "text": "Looks good!",
      "user_id": "user_def",
      "timestamp": 34.5
    }
  }
}
```

### 8.4 Event Types

| Channel | Events |
|---------|--------|
| `project` | `file.created`, `file.deleted`, `file.moved`, `folder.created`, `folder.deleted`, `member.added`, `member.removed` |
| `file` | `comment.created`, `comment.updated`, `comment.deleted`, `comment.completed`, `version.created`, `file.status_changed`, `file.updated`, `transcription.completed` |
| `user` | `notification.created`, `notification.read` |
| `share` | `share.viewed`, `comment.created`, `share.downloaded` |

### 8.5 Presence

Clients can broadcast presence to indicate they are viewing a resource:

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

Presence updates are broadcast to all subscribers on the same channel/resource. Presence automatically expires 60 seconds after last update.

### 8.6 Unsubscribe

```json
{
  "action": "unsubscribe",
  "channel": "file",
  "resource_id": "file_xyz789"
}
```

---

## 9. API Versioning Strategy

### 9.1 Current Versions

| Version | Status | End of Life |
|---------|--------|-------------|
| V4 | Current | -- |
| V3 | Deprecated | 2026-12-31 |
| V2 | End of Life | 2025-06-30 |

### 9.2 Versioning Rules

- Version is specified in the URL path: `/v4/...`
- Each major version is a stable contract -- no breaking changes within a version
- Breaking changes trigger a new major version
- Non-breaking additions (new fields, new endpoints) are added to the current version
- Deprecated versions receive security patches only for 12 months after deprecation

### 9.3 Breaking vs Non-Breaking Changes

**Non-breaking (added to current version):**
- New optional request parameters
- New response fields
- New endpoints
- New webhook event types
- New enum values in responses

**Breaking (new major version required):**
- Removing or renaming fields
- Changing field types
- Removing endpoints
- Changing required parameters
- Changing authentication mechanisms
- Changing error response structure

### 9.4 Deprecation Headers

When calling deprecated versions, responses include:

```
Sunset: Sat, 31 Dec 2026 23:59:59 GMT
Deprecation: true
Link: </v4/projects>; rel="successor-version"
```

### 9.5 Migration

- Migration guides published for each major version transition
- SDKs updated to support new versions before old versions are sunset
- Webhook payloads include a `api_version` field so receivers can handle multiple versions

---

## 10. Filtering and Field Selection

### 10.1 Sparse Fieldsets

Request only specific fields to reduce payload size:

```
GET /v4/projects/xyz/files?fields[file]=name,file_size,status,created_at
```

### 10.2 Including Related Resources

Sideload related resources to avoid N+1 requests:

```
GET /v4/files/abc?include=comments,versions
```

```json
{
  "data": {
    "id": "abc",
    "type": "file",
    "attributes": { ... },
    "relationships": {
      "comments": { "data": [{ "type": "comment", "id": "c1" }] },
      "versions": { "data": [{ "type": "version", "id": "v1" }] }
    }
  },
  "included": [
    { "id": "c1", "type": "comment", "attributes": { ... } },
    { "id": "v1", "type": "version", "attributes": { ... } }
  ]
}
```

### 10.3 Filtering

List endpoints support filtering via query parameters:

```
GET /v4/projects/xyz/files?filter[status]=complete&filter[file_type]=video
GET /v4/projects/xyz/files?filter[created_at][gte]=2026-01-01T00:00:00Z
```

**Filter operators (via nested keys):**
- `eq` -- Equals (default when no operator specified)
- `neq` -- Not equals
- `gt`, `gte` -- Greater than, greater than or equal
- `lt`, `lte` -- Less than, less than or equal
- `in` -- In list (comma-separated values)

---

## 11. SDKs

| Language | Package | Install |
|----------|---------|---------|
| TypeScript/JavaScript | `bush-sdk` | `npm install bush-sdk` |
| Python | `bush-sdk` | `pip install bush-sdk` |

SDKs handle authentication, pagination, rate limit retries, and provide typed interfaces for all endpoints.

---

## 12. Common Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer bush_tok_...` or `Bearer bush_key_...` |
| `Content-Type` | Yes (POST/PUT/PATCH) | `application/json` |
| `Accept` | No | `application/json` (default) |
| `X-Request-Id` | No | Client-generated UUID for request tracing |
| `X-Idempotency-Key` | No | Idempotency key for POST requests (UUID, valid 24h) |

---

## 13. Common Response Headers

| Header | Description |
|--------|-------------|
| `x-request-id` | Server-generated or echoed request ID |
| `X-RateLimit-Limit` | Rate limit ceiling |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Reset timestamp (Unix) |
| `content-type` | `application/json; charset=utf-8` |
| `cache-control` | Caching directives |
