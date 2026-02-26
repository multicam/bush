# Bush - Search System

## Overview

Full-text search across all project content — file names, descriptions, comments, transcript text, and custom metadata field values — powered by SQLite FTS5. Search is always scoped: the default scope is a single project; workspace-level search (across all projects the user can access) is an optional broader scope. Results are grouped by content type, ranked by relevance, and filtered by the caller's permission level so users never see content from projects they cannot access. The scaling path from SQLite FTS5 to a dedicated search engine (Meilisearch or Typesense) is documented but not needed until the indexed document count or query latency warrants it.

---

## 1. FTS5 Index Architecture

### 1.1 Virtual Tables

One FTS5 virtual table is created per indexed content type. All tables use the `unicode61` tokenizer with `remove_diacritics=2` to handle accented characters correctly.

```sql
-- File names and descriptions
CREATE VIRTUAL TABLE fts_files USING fts5(
  file_id UNINDEXED,
  project_id UNINDEXED,
  account_id UNINDEXED,
  name,
  description,
  keywords,           -- comma-joined tag/keyword values
  custom_fields,      -- space-joined "fieldname:value" pairs
  content='files',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- Comment text (including replies)
CREATE VIRTUAL TABLE fts_comments USING fts5(
  comment_id UNINDEXED,
  file_id UNINDEXED,
  project_id UNINDEXED,
  account_id UNINDEXED,
  body,
  tokenize='unicode61 remove_diacritics 2'
);

-- Transcript segments (word-level, from transcription pipeline)
CREATE VIRTUAL TABLE fts_transcripts USING fts5(
  transcript_id UNINDEXED,
  file_id UNINDEXED,
  project_id UNINDEXED,
  account_id UNINDEXED,
  text,
  tokenize='unicode61 remove_diacritics 2'
);
```

`UNINDEXED` columns are stored but excluded from the full-text index. They exist solely to carry IDs back in search results without polluting ranking.

### 1.2 Ranking

Use the built-in `bm25()` ranking function. For multi-column tables, weight columns by relevance importance:

| Table | Column weights (name > description > others) |
|-------|----------------------------------------------|
| `fts_files` | `bm25(fts_files, 10, 5, 3, 1)` — name, description, keywords, custom_fields |
| `fts_comments` | `bm25(fts_comments)` — single content column |
| `fts_transcripts` | `bm25(fts_transcripts)` — single content column |

Lower bm25 score = better match (bm25 returns negative values in SQLite). Sort ascending.

### 1.3 Content Synchronization Triggers

FTS5 content tables (`content=''`) require manual sync. Use database triggers to keep the FTS indexes in sync with the source tables.

```sql
-- Example for fts_files (replicate pattern for fts_comments, fts_transcripts)
CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
  INSERT INTO fts_files(file_id, project_id, account_id, name, description, keywords, custom_fields)
  VALUES (new.id, new.project_id, new.account_id, new.name, new.description, '', '');
END;

CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
  INSERT INTO fts_files(fts_files, file_id, ...) VALUES('delete', old.rowid);
END;

CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
  INSERT INTO fts_files(fts_files, ...) VALUES('delete', old.rowid);
  INSERT INTO fts_files(file_id, ...) VALUES (new.id, ...);
END;
```

Custom field values and keywords are denormalized strings rebuilt and re-indexed whenever `file_custom_fields` or `file_tags` rows change.

---

## 2. Indexed Content

| Content type | Source table(s) | Indexed columns | Phase |
|-------------|-----------------|-----------------|-------|
| File name | `files` | `name` | MVP |
| File description | `files` | `description` | MVP |
| Keywords / tags | `file_tags` | Joined into `fts_files.keywords` | MVP |
| Custom metadata | `file_custom_fields` | Joined into `fts_files.custom_fields` as `fieldname:value` pairs | MVP |
| Comments | `comments` | `body` | MVP |
| Transcript segments | `transcripts` | `text` | MVP |
| Captions / SRT | `captions` | Not indexed separately — covered by transcript index | MVP |
| Visual / semantic content | (future AI model) | — | Future |

**Not indexed**: file binary content, raw metadata JSON blobs, user display names (searchable via separate user lookup).

---

## 3. Search Scopes

| Scope | Trigger | Query target |
|-------|---------|-------------|
| Project (default) | `GET /v4/projects/:id/search` | All FTS tables filtered to `project_id = :id` |
| Workspace | `GET /v4/workspaces/:id/search` | All FTS tables filtered to `project_id IN (accessible_projects)` |

Workspace-level search builds an `IN` clause from the set of project IDs the calling user can access within that workspace. The accessible set is computed at query time from the `project_members` and `workspace_members` tables — never cached, to respect real-time permission changes.

**Phase tag**: Project search = MVP. Workspace search = MVP.

---

## 4. Query Syntax

| Syntax | Behavior | Example |
|--------|----------|---------|
| Plain terms | Implicit AND across all indexed columns | `color grading` |
| Quoted phrase | Exact phrase match | `"color grading"` |
| Prefix | Match any word starting with prefix | `colou*` |
| Exclusion | (Phase 2) NOT operator | `grading NOT audio` |

The API accepts raw query strings and passes them directly to FTS5 `MATCH` after basic sanitization (strip unmatched quotes, escape special FTS5 operators that the user did not intend). Invalid FTS5 syntax falls back to a plain LIKE search rather than returning an error.

---

## 5. API Endpoints

### `GET /v4/projects/:id/search`

**Auth**: Authenticated user. Must have at minimum `view_only` access to the project.

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query (1–500 chars) |
| `types` | string | `files,comments,transcripts` | Comma-separated list of result types to include |
| `limit` | number | `20` | Max results per type (1–100) |
| `cursor` | string | — | Pagination cursor (opaque, base64-encoded offset) |

**Response** `200 OK`:
```json
{
  "query": "color grading",
  "scope": "project",
  "project_id": "prj_xxx",
  "results": {
    "files": {
      "total": 4,
      "items": [
        {
          "id": "fil_xxx",
          "type": "file",
          "name": "Color <mark>Grading</mark> Pass 1.mp4",
          "description": "...",
          "score": 0.94,
          "highlights": {
            "name": "Color <mark>Grading</mark> Pass 1.mp4",
            "description": "Final <mark>color grading</mark> for reel..."
          },
          "project_id": "prj_xxx",
          "created_at": "2026-01-15T10:00:00Z"
        }
      ],
      "next_cursor": null
    },
    "comments": { "total": 2, "items": [...], "next_cursor": null },
    "transcripts": { "total": 7, "items": [...], "next_cursor": null }
  },
  "took_ms": 18
}
```

Highlight snippets are generated with FTS5's `snippet()` function. `<mark>` tags wrap matched terms. Front-end renders them as HTML (safe — server controls the tag; user input is stored and indexed, not echoed into highlight markup directly).

### `GET /v4/workspaces/:id/search`

Same parameters and response shape as the project endpoint. Accessible project IDs are computed per-request. Results include a `project_id` field on each item so the client can link to the correct project.

**Phase tag**: MVP.

---

## 6. Permission Filtering

Search results are filtered at query time, not post-hoc. The `WHERE` clause includes:

- **Project search**: `project_id = :projectId AND account_id = :accountId`. The route handler calls `verifyProjectAccess()` first; if the user cannot access the project at all, returns `403` before any FTS query runs.
- **Workspace search**: `project_id IN (SELECT id FROM projects WHERE workspace_id = :workspaceId AND id IN (SELECT project_id FROM project_members WHERE user_id = :userId))`. Account-level admins (Owner, Content Admin) bypass the project membership filter and see all projects in the workspace.

**Rule**: A result row is never returned if the calling user cannot access the project it belongs to. This applies even if the FTS index contains data from a project the user was later removed from — the permission filter in the SQL WHERE clause is the enforcement gate.

---

## 7. Indexing Pipeline

### 7.1 Synchronous (metadata)

File name, description, keywords, and custom field values are indexed synchronously within the same SQLite write transaction as the source data change. Because SQLite is single-writer, this adds negligible latency to the write path and keeps the FTS index always consistent.

### 7.2 Asynchronous (transcripts and comments)

| Event | Trigger | Mechanism |
|-------|---------|-----------|
| Transcript created / updated | Transcription job completes | BullMQ `search:index` job enqueued by worker completion callback |
| Comment created | `POST /v4/.../comments` | BullMQ `search:index` job enqueued by route handler (after DB write) |
| Comment updated | `PATCH /v4/.../comments/:id` | BullMQ `search:index` job |
| Comment deleted | `DELETE /v4/.../comments/:id` | BullMQ `search:delete` job |

**Queue**: `search:index` with concurrency 4. Jobs are idempotent — re-indexing the same row is safe.

**Job payload**:
```json
{
  "type": "comment" | "transcript",
  "id": "<source row id>",
  "project_id": "prj_xxx",
  "account_id": "acc_xxx"
}
```

Worker reads the current row from SQLite and upserts into the FTS virtual table. If the row no longer exists (deleted between enqueue and execution), the job performs a delete from the FTS table and exits cleanly.

### 7.3 Re-indexing

A full re-index can be triggered via a CLI command (`bun run search:reindex`). It truncates and rebuilds all FTS tables from source tables. Estimated time on a project with 10,000 files: <30 seconds on the reference hardware. No downtime required — FTS reads continue to work during re-index (partial results until complete).

---

## 8. Frontend

### 8.1 Search Input

- Location: project header bar, persistent. Keyboard shortcut: `Cmd/Ctrl+K` focuses the input.
- Debounce: 300ms after last keystroke before query fires.
- Minimum query length: 2 characters.
- While loading: spinner in input field.
- Empty state: "No results for 'query'" with suggestion to broaden search terms.

### 8.2 Results Layout

Results appear in a dropdown panel (project scope) or a full results page (workspace scope):

```
[ Files (4) ]
  [icon] Color Grading Pass 1.mp4
         Final color grading for reel...            Score indicator
  [icon] Grading Notes v2.pdf
         ...

[ Comments (2) ]
  [icon] Jane on Color Grading Pass 1.mp4
         "The color grading looks great at 01:23"

[ Transcripts (7) ]
  [icon] Interview_raw.mp4  00:14:32
         "...and the color grading on this shot was..."
```

- Each result links to the resource. Transcript results deep-link to the timestamp in the player.
- Highlighted terms use `<mark>` rendered as yellow-background spans (design system token).
- Results grouped by type. Within each group, ordered by relevance score descending.
- "Show all X results" link at bottom of each group opens the full results page.

---

## 9. Performance Targets

| Metric | Target | Condition |
|--------|--------|-----------|
| Query latency (p50) | <50ms | Project with <10,000 indexed documents |
| Query latency (p99) | <200ms | Project with <10,000 indexed documents |
| Index write latency | <5ms | Synchronous metadata indexing |
| Async index lag | <10s | Comment/transcript indexing via BullMQ |
| Re-index time | <60s | 10,000 documents, single-server hardware |

FTS5 queries use `LIMIT` to bound result set size. No unbounded full-table scans. The `account_id` and `project_id` UNINDEXED columns allow early filtering in the WHERE clause before FTS ranking runs.

---

## 10. Scaling Path

| Stage | Engine | Trigger |
|-------|--------|---------|
| Current | SQLite FTS5 | <100K indexed documents per workspace |
| Phase 2 | Meilisearch or Typesense (self-hosted) | >100K documents or p99 latency >500ms |
| Future | Managed search (Algolia, Elastic Cloud) | Multi-region requirement or team bandwidth |

Migration path: the search service is abstracted behind a `SearchService` interface with `index()`, `delete()`, and `query()` methods. The SQLite FTS5 implementation is one adapter. Swapping to Meilisearch requires writing a new adapter and running a one-time re-index — no API or frontend changes needed.

**Phase 2 adapter interface** (document now, implement when needed):
```typescript
interface SearchService {
  index(doc: SearchDocument): Promise<void>;
  delete(type: SearchDocumentType, id: string): Promise<void>;
  query(params: SearchQuery): Promise<SearchResults>;
}
```

---

## 11. Configuration

No new environment variables needed for the SQLite FTS5 implementation. The FTS virtual tables live in the same SQLite database file as all other tables.

If/when migrating to a dedicated engine, add to `src/config/env.ts`:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SEARCH_PROVIDER` | enum | `sqlite` | `sqlite` \| `meilisearch` \| `typesense` |
| `SEARCH_URL` | url | — | URL of dedicated search service |
| `SEARCH_API_KEY` | string | — | API key for dedicated service (secret) |
| `SEARCH_INDEX_PREFIX` | string | `bush_` | Index name prefix |

---

## Cross-References

- `01-data-model.md` — source tables (`files`, `comments`, `transcripts`, `file_custom_fields`)
- `04-api-reference.md` — API conventions, cursor pagination, error codes
- `07-media-processing.md` — metadata extraction pipeline (source data for custom field indexing)
- `08-transcription.md` — transcript indexing trigger (BullMQ job completion)
- `05-realtime.md` — WebSocket events that trigger re-indexing (comment created/updated/deleted)
- `30-configuration.md` — env var patterns
