# Bush - Data Model

## Overview

Bush uses a single SQLite database (Drizzle ORM, WAL mode) as its primary relational store. The schema is organized around a strict five-level hierarchy — Account → Workspace → Project → Folder → [File | Version Stack | Folder] — with each level owned by the one above via a cascade-delete foreign key. Identity is delegated to WorkOS; Bush stores a local `users` record keyed by `workos_user_id`. Permissions, shares, comments, transcripts, and webhooks are all first-class entities with their own tables. Soft-delete is used selectively (files only); all other entities use hard cascade deletes.

---

## Specification

### Entity Hierarchy

```
Account
├── User (via account_memberships, many-to-many)
├── Workspace
│   └── Project
│       ├── Folder (self-referential tree: parentId)
│       │   └── File  (folderId → folders.id, SET NULL on delete)
│       ├── File  (root-level, folderId = NULL)
│       └── Version Stack
│           └── File  (versionStackId on files, no FK constraint — logical reference)
├── Custom Field (account-wide definitions)
├── Share
│   └── Share Asset (join: share ↔ file)
│   └── Share Activity (view / comment / download events)
└── Webhook
    └── Webhook Delivery
```

---

### Entity Reference

#### `accounts` — Top-level organizational and billing entity

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`acc_`) |
| `name` | text NOT NULL | Display name |
| `slug` | text UNIQUE NOT NULL | URL-safe identifier, derived from email prefix at auto-provision |
| `plan` | enum | `free`, `pro`, `team`, `enterprise` |
| `storage_quota_bytes` | integer | Default 2 GB |
| `storage_used_bytes` | integer | Running total, updated on upload/delete |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Relationships:** One account has many workspaces, many account_memberships, many custom_fields, many shares, many webhooks.

**Deletion behavior:** Deleting an account cascades to all workspaces (and transitively to all projects, folders, files, permissions, shares, webhooks, etc.).

---

#### `users` — Authenticated Bush users

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`usr_`) |
| `workos_user_id` | text UNIQUE NOT NULL | Canonical identity from WorkOS |
| `email` | text UNIQUE NOT NULL | |
| `first_name` | text | |
| `last_name` | text | |
| `avatar_url` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Relationships:** One user has many account_memberships, many workspace/project/folder permissions, many comments, many notifications. Users are referenced by files (assignee), shares (creator), transcripts (editor), webhooks (creator), collections (creator), captions (creator).

**Deletion behavior:** `users` is referenced by many tables. Deleting a user cascades (or SET NULL) per FK definition: memberships, permissions, comments cascade; assignee/editor/creator references SET NULL.

**Note:** WorkOS is the identity authority. Bush never stores passwords. The `workos_user_id` is the stable cross-reference. Auto-provisioning creates a user + personal account on first login.

---

#### `account_memberships` — Users ↔ Accounts (with role)

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `account_id` | text FK → accounts | Cascade delete |
| `user_id` | text FK → users | Cascade delete |
| `role` | enum | `owner`, `content_admin`, `member`, `guest`, `reviewer` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(account_id, user_id)` — one role per user per account.

**Relationships:** Joins users to accounts. One user can belong to multiple accounts with different roles.

**Deletion behavior:** Deleting the account or user cascades and removes the membership row.

---

#### `workspaces` — Logical grouping within an account

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`ws_`) |
| `account_id` | text FK → accounts | Cascade delete |
| `name` | text NOT NULL | |
| `description` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Relationships:** One workspace has many projects and many workspace_permissions.

**Deletion behavior:** Deleting a workspace cascades to all projects within it (and transitively to folders, files, comments, etc.).

---

#### `projects` — Primary container for files and folders

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`prj_`) |
| `workspace_id` | text FK → workspaces | Cascade delete |
| `name` | text NOT NULL | |
| `description` | text | |
| `is_restricted` | boolean | Default false. Breaks workspace-level permission inheritance. |
| `archived_at` | timestamp | NULL = active. Non-null = archived (soft-archive). |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:** `workspace_id`, `archived_at`.

**Relationships:** One project has many folders, files, version stacks, project_permissions, collections, and custom_field_visibility entries.

**Deletion behavior:** Deleting a project cascades to all owned folders, files, version stacks, comments (via files), permissions, collections, and custom_field_visibility rows.

**Soft-archive:** `archived_at` being set hides the project from default listings but does not delete data. Restored by clearing `archived_at`.

---

#### `folders` — Hierarchical organization within projects

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`fld_`) |
| `project_id` | text FK → projects | Cascade delete |
| `parent_id` | text | Self-referential (no FK constraint). NULL = root folder. |
| `name` | text NOT NULL | |
| `path` | text NOT NULL | Materialized path string (e.g., `/design/assets`) |
| `depth` | integer | 0 = root-level folder |
| `is_restricted` | boolean | Default false. Breaks project-level permission inheritance. |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:** `project_id`, `parent_id`, `path`, composite `(project_id, parent_id)`.

**Relationships:** One folder has many child folders (self-referential via `parent_id`), many files, many folder_permissions.

**Deletion behavior:** Deleting a folder cascades to folder_permissions. Files in the folder have `folder_id` SET NULL (not deleted) when the folder is deleted — the file remains in the project at root level.

**Note:** `parent_id` is a logical self-reference without a FK constraint (to avoid recursive cascade issues). Application code must handle orphan detection.

---

#### `files` — Assets stored in the system

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`fil_`) |
| `project_id` | text FK → projects | Cascade delete |
| `folder_id` | text FK → folders | SET NULL on folder delete |
| `version_stack_id` | text | Logical reference to version_stacks (no FK). NULL = standalone file. |
| `name` | text NOT NULL | Display name |
| `original_name` | text NOT NULL | Filename as uploaded |
| `mime_type` | text NOT NULL | |
| `file_size_bytes` | integer NOT NULL | |
| `checksum` | text | MD5/SHA-256 for deduplication |
| `status` | enum | `uploading`, `processing`, `ready`, `processing_failed`, `deleted` |
| `technical_metadata` | JSON | Extracted by FFmpeg: duration, resolution, codec, frame rate, HDR, color space, etc. |
| `rating` | integer | Built-in metadata: 1–5 stars |
| `asset_status` | text | Built-in metadata: custom workflow status value |
| `keywords` | JSON array | Built-in metadata: tags |
| `notes` | text | Built-in metadata: user notes |
| `assignee_id` | text FK → users | SET NULL on user delete |
| `custom_metadata` | JSON | Map of `custom_field_id → value` for account custom fields |
| `custom_thumbnail_key` | text | S3 key for user-uploaded or frame-captured thumbnail |
| `deleted_at` | timestamp | NULL = active. Soft-delete marker. |
| `expires_at` | timestamp | For time-limited files (e.g., share-only assets) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:** `project_id`, `folder_id`, `status`, `version_stack_id`, `mime_type`, `expires_at`, `assignee_id`, composite `(project_id, deleted_at)`, composite `(project_id, folder_id, deleted_at)`.

**Relationships:** One file has many comments, one transcript (1:1), many captions, and can belong to many share_assets and collection_assets.

**Soft-delete:** Setting `deleted_at` marks the file as deleted without removing the row. Files with `deleted_at IS NOT NULL` are excluded from default queries. Hard-delete (row removal) is performed by a scheduled purge job.

**Deletion behavior (hard-delete):** Cascades to comments, transcripts (and transcript_words), captions, share_assets, collection_assets.

---

#### `version_stacks` — Group related file versions

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`vs_`) |
| `project_id` | text FK → projects | Cascade delete |
| `name` | text NOT NULL | |
| `current_file_id` | text FK → files | No cascade (SET NULL implicitly via nullable). Points to the "active" version. |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Relationships:** One version stack contains many files (via `files.version_stack_id`). One version stack can be referenced by comments directly.

**Deletion behavior:** Deleting a version stack removes the stack row. Files that belong to it (`files.version_stack_id`) are not deleted — they become standalone files.

---

#### `comments` — Frame-accurate feedback on assets

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`cmt_`) |
| `file_id` | text FK → files | Cascade delete. NULL if attached to a version stack directly. |
| `version_stack_id` | text FK → version_stacks | Cascade delete. NULL if attached to a file. |
| `user_id` | text FK → users | Cascade delete |
| `parent_id` | text | Self-referential for threaded replies (no FK constraint) |
| `text` | text NOT NULL | Comment body |
| `timestamp` | real | Seconds into media as float (e.g., 34.567). Sub-frame precision. |
| `duration` | real | Duration of selection in seconds as float |
| `page` | integer | Page number (PDF/image) |
| `annotation` | JSON | Drawing annotation data (shape, coordinates, color) |
| `is_internal` | boolean | If true, hidden from external reviewers |
| `completed_at` | timestamp | NULL = open. Non-null = resolved. |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:** `file_id`, `user_id`, `parent_id`, `version_stack_id`.

---

#### `custom_fields` — Account-wide custom metadata field definitions

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`cf_`) |
| `account_id` | text FK → accounts | Cascade delete |
| `name` | text NOT NULL | Display name |
| `slug` | text NOT NULL | URL-safe identifier, unique per account |
| `type` | enum | `text`, `textarea`, `number`, `date`, `single_select`, `multi_select`, `checkbox`, `user`, `url`, `rating` |
| `description` | text | |
| `options` | JSON array | For `single_select` / `multi_select` fields |
| `is_visible_by_default` | boolean | Whether field appears in file detail by default |
| `editable_by` | enum | `admin` or `full_access` — who can change values |
| `sort_order` | integer | Display ordering |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(account_id, slug)`.

**Deletion behavior:** Deleting an account cascades. Deleting a custom field cascades to custom_field_visibility rows. File `custom_metadata` values referencing the deleted field are orphaned JSON (no FK); application code must handle cleanup.

---

#### `custom_field_visibility` — Per-project visibility overrides for custom fields

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `custom_field_id` | text FK → custom_fields | Cascade delete |
| `project_id` | text FK → projects | Cascade delete |
| `is_visible` | boolean | Overrides `custom_fields.is_visible_by_default` for this project |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(custom_field_id, project_id)`.

---

#### `workspace_permissions` — User access grants at workspace level

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`wp_`) |
| `workspace_id` | text FK → workspaces | Cascade delete |
| `user_id` | text FK → users | Cascade delete |
| `permission` | enum | `full_access`, `edit_and_share`, `edit`, `comment_only`, `view_only` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(workspace_id, user_id)`.

---

#### `project_permissions` — User access grants at project level

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`pp_`) |
| `project_id` | text FK → projects | Cascade delete |
| `user_id` | text FK → users | Cascade delete |
| `permission` | enum | `full_access`, `edit_and_share`, `edit`, `comment_only`, `view_only` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(project_id, user_id)`.

---

#### `folder_permissions` — User access grants at folder level

**Phase: Phase 2**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`fp_`) |
| `folder_id` | text FK → folders | Cascade delete |
| `user_id` | text FK → users | Cascade delete |
| `permission` | enum | `full_access`, `edit_and_share`, `edit`, `comment_only`, `view_only` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(folder_id, user_id)`.

---

#### `shares` — Share links for external review

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`shr_`) |
| `account_id` | text FK → accounts | Cascade delete |
| `project_id` | text FK → projects | Cascade delete. NULL for account-level shares. |
| `created_by_user_id` | text FK → users | Cascade delete |
| `name` | text NOT NULL | Human-readable share name |
| `slug` | text UNIQUE NOT NULL | Cryptographically random token (min 32 bytes, URL-safe base64) |
| `passphrase` | text | bcrypt-hashed passphrase for protection. NULL = no passphrase. |
| `expires_at` | timestamp | NULL = no expiration |
| `layout` | enum | `grid`, `reel`, `viewer` |
| `allow_comments` | boolean | Default true |
| `allow_downloads` | boolean | Default false |
| `show_all_versions` | boolean | Default false |
| `show_transcription` | boolean | Default false |
| `featured_field` | text | Custom field ID to display on asset cards |
| `branding` | JSON | `{ logoUrl, backgroundColor, accentColor, headerSize, description, darkMode }` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

#### `share_assets` — Assets included in a share

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `share_id` | text FK → shares | Cascade delete |
| `file_id` | text FK → files | Cascade delete |
| `sort_order` | integer | Display ordering within the share |
| `created_at` | timestamp | |

**Unique constraint:** `(share_id, file_id)`.

---

#### `share_activity` — View, comment, and download events on shares

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `share_id` | text FK → shares | Cascade delete |
| `file_id` | text FK → files | Cascade delete. NULL for share-level events. |
| `type` | enum | `view`, `comment`, `download`, `auth_failed` |
| `viewer_email` | text | Email if Identified Reviewer; NULL if anonymous |
| `viewer_ip` | text | |
| `user_agent` | text | |
| `created_at` | timestamp | |

**Indexes:** `share_id`, `type`, `created_at`.

---

#### `share_auth_attempts` — Brute-force protection for passphrase-protected shares

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `share_id` | text FK → shares | Cascade delete |
| `ip_address` | text NOT NULL | Client IP (from X-Forwarded-For or X-Real-IP) |
| `attempt_count` | integer | Number of consecutive failed attempts |
| `last_attempt_at` | timestamp | |
| `locked_until` | timestamp | NULL if not locked. Set based on threshold (5→10min, 10→30min, 20+→2hr) |
| `created_at` | timestamp | |

**Indexes:** unique `(share_id, ip_address)`, `locked_until`.

---

#### `collections` — Saved asset groupings

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`col_`) |
| `project_id` | text FK → projects | Cascade delete |
| `created_by_user_id` | text FK → users | Cascade delete |
| `name` | text NOT NULL | |
| `description` | text | |
| `type` | enum | `team` (shared) or `private` |
| `filter_rules` | JSON array | `[{ field, operator, value }]` — for dynamic collections |
| `is_dynamic` | boolean | If true, membership computed from `filter_rules` at query time |
| `default_view` | enum | `grid`, `list` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

#### `collection_assets` — Files in manual (non-dynamic) collections

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `collection_id` | text FK → collections | Cascade delete |
| `file_id` | text FK → files | Cascade delete |
| `sort_order` | integer | |
| `added_by_user_id` | text FK → users | Cascade delete |
| `created_at` | timestamp | |

**Unique constraint:** `(collection_id, file_id)`.

---

#### `notifications` — In-app user notifications

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `user_id` | text FK → users | Cascade delete |
| `type` | text NOT NULL | Notification type string |
| `title` | text NOT NULL | |
| `body` | text | |
| `data` | JSON | Arbitrary notification payload |
| `read_at` | timestamp | NULL = unread |
| `created_at` | timestamp | |

---

#### `webhooks` — HTTP webhook endpoint registrations

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Prefixed ID (`wh_`) |
| `account_id` | text FK → accounts | Cascade delete |
| `created_by_user_id` | text FK → users | Cascade delete |
| `name` | text NOT NULL | |
| `url` | text NOT NULL | Target URL |
| `secret` | text NOT NULL | Used for HMAC-SHA256 payload signing |
| `events` | JSON array | `[{ type, filters? }]` — event type subscriptions with optional project/workspace filter |
| `is_active` | boolean | Default true |
| `last_triggered_at` | timestamp | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Event types:** `file.created`, `file.updated`, `file.deleted`, `file.status_changed`, `file.downloaded`, `version.created`, `comment.created`, `comment.updated`, `comment.deleted`, `comment.completed`, `share.created`, `share.viewed`, `project.created`, `project.updated`, `project.deleted`, `member.added`, `member.removed`, `transcription.completed`.

---

#### `webhook_deliveries` — Webhook delivery attempt log

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `webhook_id` | text FK → webhooks | Cascade delete |
| `event_type` | text NOT NULL | |
| `payload` | JSON NOT NULL | Full event payload sent |
| `status_code` | integer | HTTP response code |
| `response` | text | Response body (truncated) |
| `status` | enum | `pending`, `success`, `failed`, `retrying` |
| `attempt_count` | integer | |
| `next_retry_at` | timestamp | |
| `delivered_at` | timestamp | |
| `created_at` | timestamp | |

---

#### `transcripts` — AI transcriptions of audio/video files

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `file_id` | text FK → files | Cascade delete. Unique (one transcript per file). |
| `provider` | enum | `deepgram`, `assemblyai`, `faster-whisper` |
| `provider_transcript_id` | text | External provider job ID |
| `full_text` | text | Complete transcript text |
| `language` | text | Detected or specified language code |
| `language_confidence` | integer | Detection confidence 0–100 |
| `speaker_count` | integer | Number of detected speakers |
| `speaker_names` | JSON | Map of speaker index → display name |
| `status` | enum | `pending`, `processing`, `completed`, `failed` |
| `error_message` | text | |
| `duration_seconds` | integer | |
| `is_edited` | boolean | Whether the transcript has been manually edited |
| `edited_at` | timestamp | |
| `edited_by_user_id` | text FK → users | SET NULL on user delete |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

#### `transcript_words` — Individual words with timestamps

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `transcript_id` | text FK → transcripts | Cascade delete |
| `word` | text NOT NULL | Possibly edited word |
| `start_ms` | integer NOT NULL | Start time in milliseconds |
| `end_ms` | integer NOT NULL | End time in milliseconds |
| `speaker` | integer | Speaker index |
| `confidence` | integer | Word confidence 0–100 |
| `position` | integer NOT NULL | Ordinal position in transcript |
| `original_word` | text | Pre-edit word (preserved when user edits) |
| `created_at` | timestamp | |

**Indexes:** `transcript_id`, composite `(transcript_id, start_ms)`, composite `(transcript_id, position)`.

---

#### `captions` — Uploaded caption tracks (SRT/VTT)

**Phase: MVP**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `file_id` | text FK → files | Cascade delete |
| `language` | text NOT NULL | BCP-47 language code |
| `format` | enum | `srt`, `vtt` |
| `storage_key` | text NOT NULL | S3 object key |
| `label` | text | Display label (e.g., "English (SDH)") |
| `is_default` | boolean | Default track for playback |
| `created_by_user_id` | text FK → users | SET NULL on user delete |
| `created_at` | timestamp | |

---

### Entity-Relationship Diagram

```
┌─────────────┐       ┌──────────────────────┐
│   accounts  │◄──────┤ account_memberships  │
│             │  1:N  │ (userId, accountId,  │
│             │       │  role)               │
│             │       └──────────────────────┘
│             │                ▲
│             │                │ N:1
│             │         ┌──────┴──────┐
│             │         │    users    │
│             │         └─────────────┘
│             │                ▲
│             │    FK SET NULL │ (assignee, editor, creator refs)
│             │                │
│  1:N        │       ┌────────┴──────┐
│             ├───────► workspaces    │
│             │  1:N  └───────────────┘
│             │               │ 1:N
│             │        ┌──────▼──────┐       ┌─────────────────────┐
│             │        │  projects   │◄──────┤ project_permissions │
│             │        └─────────────┘  1:N  │ (projectId, userId) │
│             │               │             └─────────────────────┘
│             │               │ 1:N
│             │        ┌──────▼──────┐       ┌────────────────────┐
│             │        │   folders   │◄──────┤ folder_permissions │
│             │        │ (self-ref)  │  1:N  │ (folderId, userId) │
│             │        └─────────────┘       └────────────────────┘
│             │               │ 1:N
│             │        ┌──────▼──────┐       ┌────────────────────┐
│             │        │    files    │──────►│    transcripts     │
│             │        │(soft-delete)│  1:1  │  └► transcript_    │
│             │        └─────────────┘       │      words         │
│             │               │              └────────────────────┘
│             │               │ 1:N          ┌────────────────────┐
│             │               └─────────────►│     captions       │
│             │               │ 1:N          └────────────────────┘
│             │               └─────────────►│     comments       │
│             │                              └────────────────────┘
│             │       ┌────────────────┐
│             │  1:N  │ version_stacks │
│             │       └────────────────┘
│             │               │ logical ref (files.version_stack_id)
│             │               └─────────────► files (many versions)
│             │
│  1:N        │       ┌─────────────┐      ┌──────────────┐
│             ├───────► custom_     │ 1:N  │ custom_field │
│             │        │ fields     │──────► _visibility  │
│             │        └─────────────┘      └──────────────┘
│             │
│  1:N        │       ┌─────────────┐      ┌──────────────┐
│             ├───────►   shares    │ 1:N  │ share_assets │
│             │        └─────────────┘──────►(shareId,    │
│             │               │      1:N  │  fileId)     │
│             │               └──────────►│share_activity│
│             │                          └──────────────┘
│  1:N        │       ┌─────────────┐      ┌──────────────────┐
│             └───────►  webhooks   │ 1:N  │webhook_deliveries│
│                      └─────────────┘      └──────────────────┘
└─────────────┘
```

---

### Cascade Deletion Rules

The table below describes what is deleted when a top-level entity is removed. "Cascade" means the FK `ON DELETE CASCADE` propagates automatically. "Logical" means application code must handle cleanup.

| Deleted Entity | Cascades To |
|----------------|-------------|
| **Account** | workspaces → projects → folders, files, version_stacks, comments, transcripts, transcript_words, captions, share_assets, collection_assets, project_permissions, folder_permissions; account_memberships; workspace_permissions; custom_fields → custom_field_visibility; shares → share_assets, share_activity; webhooks → webhook_deliveries; collections → collection_assets |
| **Workspace** | projects → (see Project row); workspace_permissions |
| **Project** | folders → folder_permissions; files (cascade; soft-deleted files still removed by FK cascade on hard-delete); version_stacks; project_permissions; collections → collection_assets; custom_field_visibility |
| **Folder** | folder_permissions; files.folder_id SET NULL (files survive at project root level) |
| **File** | comments; transcripts → transcript_words; captions; share_assets; collection_assets |
| **Version Stack** | comments targeting version_stack_id; files retain their row (version_stack_id becomes orphaned — application must clear) |
| **User** | account_memberships; workspace_permissions; project_permissions; folder_permissions; comments; notifications; collections; collection_assets (added_by); files.assignee_id SET NULL; transcripts.edited_by_user_id SET NULL; shares.created_by_user_id CASCADE; captions.created_by_user_id SET NULL |
| **Share** | share_assets; share_activity; share_auth_attempts |
| **Webhook** | webhook_deliveries |
| **Transcript** | transcript_words |
| **Custom Field** | custom_field_visibility; `files.custom_metadata` values orphaned (JSON, no FK — application cleanup required) |

---

### Soft-Delete Behavior

Only `files` implements true soft-delete. All other entities are hard-deleted (cascade or direct).

| Entity | Soft-Delete Column | Behavior |
|--------|--------------------|----------|
| `files` | `deleted_at` | Set to current timestamp on delete. File excluded from default queries (`WHERE deleted_at IS NULL`). Hard-delete performed by scheduled purge job after retention window. |
| `projects` | `archived_at` | Soft-archive only (not a delete). Archived projects excluded from default listings; data fully intact and restorable. |

No other tables use soft-delete. Comments, permissions, shares, and webhooks are hard-deleted when removed.

---

### JSON Field Schemas

**`files.technical_metadata`**
```typescript
{
  duration: number | null;       // Seconds
  width: number | null;          // Pixels
  height: number | null;         // Pixels
  frameRate: number | null;      // FPS
  videoCodec: string | null;     // e.g., "h264"
  audioCodec: string | null;     // e.g., "aac"
  bitRate: number | null;        // bps
  sampleRate: number | null;     // Hz
  channels: number | null;
  isHDR: boolean;
  hdrType: string | null;        // e.g., "HDR10", "HLG"
  colorSpace: string | null;
  audioBitDepth: number | null;
  format: string | null;         // Container format
  hasAlpha: boolean;
}
```

**`shares.branding`**
```typescript
{
  logoUrl?: string;
  backgroundColor?: string;   // CSS hex
  accentColor?: string;        // CSS hex
  headerSize?: "small" | "medium" | "large";
  description?: string;
  darkMode?: boolean;
}
```

**`collections.filter_rules`**
```typescript
Array<{
  field: string;               // e.g., "status", "rating", "keywords"
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains";
  value: string | number | boolean | string[] | null;
}>
```

**`webhooks.events`**
```typescript
Array<{
  type: WebhookEventType;      // e.g., "file.created"
  filters?: {
    projectId?: string;
    workspaceId?: string;
  };
}>
```

---

### Phase Summary

| Entity | Phase |
|--------|-------|
| accounts | MVP |
| users | MVP |
| account_memberships | MVP |
| workspaces | MVP |
| projects | MVP |
| folders | MVP |
| files | MVP |
| version_stacks | MVP |
| comments | MVP |
| custom_fields | MVP |
| custom_field_visibility | MVP |
| workspace_permissions | MVP |
| project_permissions | MVP |
| shares | MVP |
| share_assets | MVP |
| share_activity | MVP |
| share_auth_attempts | MVP |
| collections | MVP |
| collection_assets | MVP |
| notifications | MVP |
| webhooks | MVP |
| webhook_deliveries | MVP |
| transcripts | MVP |
| transcript_words | MVP |
| captions | MVP |
| folder_permissions | Phase 2 |
| access_groups (schema conceptual only) | Phase 2 |
| audit_logs | Phase 2 |

---

## Cross-References

- `02-authentication.md` — Users, sessions, WorkOS identity, account auto-provisioning, account_memberships roles
- `03-permissions.md` — workspace_permissions, project_permissions, folder_permissions, permission inheritance, restricted projects/folders
- `06-storage.md` (see `06-storage.md`) — S3 storage keys, file status lifecycle, proxy generation
- `04-api-reference.md` (see `04-api-reference.md`) — API endpoints that operate on these entities, cursor pagination
