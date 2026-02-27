/**
 * Database Migration Script
 *
 * Run with: bun run db:migrate
 */
import { Database } from "bun:sqlite";
import { config } from "../config/index.js";
import * as fs from "fs";
import * as path from "path";

console.log("Running database migrations...");

// Ensure data directory exists
const dbPath = config.DATABASE_URL;
if (dbPath !== ":memory:") {
  const dbDir = path.dirname(dbPath);
  if (dbDir !== "." && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }
}

const sqlite = new Database(config.DATABASE_URL);

if (config.DATABASE_WAL_MODE && config.DATABASE_URL !== ":memory:") {
  sqlite.exec("PRAGMA journal_mode = WAL");
}

// Create tables directly for initial setup
sqlite.exec(`
  -- ============================================
  -- CORE TABLES
  -- ============================================

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free',
    storage_quota_bytes INTEGER NOT NULL DEFAULT 2147483648,
    storage_used_bytes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    workos_user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS account_memberships (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(account_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_restricted INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    is_restricted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    folder_id TEXT,
    version_stack_id TEXT,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    checksum TEXT,
    status TEXT NOT NULL DEFAULT 'uploading',
    technical_metadata TEXT,
    rating INTEGER,
    asset_status TEXT,
    keywords TEXT DEFAULT '[]',
    notes TEXT,
    assignee_id TEXT,
    custom_metadata TEXT,
    custom_thumbnail_key TEXT,
    deleted_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS version_stacks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    current_file_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (current_file_id) REFERENCES files(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    file_id TEXT,
    version_stack_id TEXT,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    text TEXT NOT NULL,
    timestamp INTEGER,
    duration INTEGER,
    page INTEGER,
    annotation TEXT,
    is_internal INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (version_stack_id) REFERENCES version_stacks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ============================================
  -- CUSTOM FIELDS
  -- ============================================

  CREATE TABLE IF NOT EXISTS custom_fields (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    options TEXT,
    is_visible_by_default INTEGER NOT NULL DEFAULT 1,
    editable_by TEXT NOT NULL DEFAULT 'full_access',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, slug)
  );

  CREATE TABLE IF NOT EXISTS custom_field_visibility (
    id TEXT PRIMARY KEY,
    custom_field_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    is_visible INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(custom_field_id, project_id)
  );

  -- ============================================
  -- SHARING
  -- ============================================

  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    project_id TEXT,
    created_by_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    passphrase TEXT,
    expires_at INTEGER,
    layout TEXT NOT NULL DEFAULT 'grid',
    allow_comments INTEGER NOT NULL DEFAULT 1,
    allow_downloads INTEGER NOT NULL DEFAULT 0,
    show_all_versions INTEGER NOT NULL DEFAULT 0,
    show_transcription INTEGER NOT NULL DEFAULT 0,
    featured_field TEXT,
    branding TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS share_assets (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(share_id, file_id)
  );

  CREATE TABLE IF NOT EXISTS share_activity (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL,
    file_id TEXT,
    type TEXT NOT NULL,
    viewer_email TEXT,
    viewer_ip TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  -- ============================================
  -- NOTIFICATIONS
  -- ============================================

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data TEXT,
    read_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ============================================
  -- PERMISSIONS
  -- ============================================

  CREATE TABLE IF NOT EXISTS workspace_permissions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view_only',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS project_permissions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view_only',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS folder_permissions (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view_only',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(folder_id, user_id)
  );

  -- ============================================
  -- COLLECTIONS
  -- ============================================

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'team',
    filter_rules TEXT,
    is_dynamic INTEGER NOT NULL DEFAULT 0,
    default_view TEXT NOT NULL DEFAULT 'grid',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS collection_assets (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_by_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(collection_id, file_id)
  );

  -- ============================================
  -- WEBHOOKS
  -- ============================================

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_triggered_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status_code INTEGER,
    response TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER,
    delivered_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
  );

  -- ============================================
  -- TRANSCRIPTION
  -- ============================================

  CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_transcript_id TEXT,
    full_text TEXT,
    language TEXT,
    language_confidence INTEGER,
    speaker_count INTEGER,
    speaker_names TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    duration_seconds INTEGER,
    is_edited INTEGER NOT NULL DEFAULT 0,
    edited_at INTEGER,
    edited_by_user_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (edited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS transcript_words (
    id TEXT PRIMARY KEY,
    transcript_id TEXT NOT NULL,
    word TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    speaker INTEGER,
    confidence INTEGER,
    position INTEGER NOT NULL,
    original_word TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS captions (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    language TEXT NOT NULL,
    format TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    label TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Notification Settings
  CREATE TABLE IF NOT EXISTS notification_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    -- Email notification preferences
    email_mentions INTEGER NOT NULL DEFAULT 1,
    email_comment_replies INTEGER NOT NULL DEFAULT 1,
    email_comments INTEGER NOT NULL DEFAULT 1,
    email_uploads INTEGER NOT NULL DEFAULT 0,
    email_status_changes INTEGER NOT NULL DEFAULT 1,
    email_share_invites INTEGER NOT NULL DEFAULT 1,
    email_share_views INTEGER NOT NULL DEFAULT 0,
    email_share_downloads INTEGER NOT NULL DEFAULT 0,
    email_assignments INTEGER NOT NULL DEFAULT 1,
    email_file_processed INTEGER NOT NULL DEFAULT 1,
    -- In-app notification preferences
    in_app_mentions INTEGER NOT NULL DEFAULT 1,
    in_app_comment_replies INTEGER NOT NULL DEFAULT 1,
    in_app_comments INTEGER NOT NULL DEFAULT 1,
    in_app_uploads INTEGER NOT NULL DEFAULT 1,
    in_app_status_changes INTEGER NOT NULL DEFAULT 1,
    in_app_share_invites INTEGER NOT NULL DEFAULT 1,
    in_app_share_views INTEGER NOT NULL DEFAULT 1,
    in_app_share_downloads INTEGER NOT NULL DEFAULT 1,
    in_app_assignments INTEGER NOT NULL DEFAULT 1,
    in_app_file_processed INTEGER NOT NULL DEFAULT 1,
    -- Digest preferences
    digest_enabled INTEGER NOT NULL DEFAULT 0,
    digest_frequency TEXT NOT NULL DEFAULT 'daily',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ============================================
  -- API KEYS
  -- ============================================

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'read_only',
    expires_at INTEGER,
    last_used_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- ============================================
  -- INDEXES
  -- ============================================

  -- Core indexes
  CREATE INDEX IF NOT EXISTS workspaces_account_id_idx ON workspaces(account_id);
  CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects(workspace_id);
  CREATE INDEX IF NOT EXISTS projects_archived_at_idx ON projects(archived_at);
  CREATE INDEX IF NOT EXISTS folders_project_id_idx ON folders(project_id);
  CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id);
  CREATE INDEX IF NOT EXISTS folders_path_idx ON folders(path);
  CREATE INDEX IF NOT EXISTS folders_project_parent_idx ON folders(project_id, parent_id);

  -- Files indexes
  CREATE INDEX IF NOT EXISTS files_project_id_idx ON files(project_id);
  CREATE INDEX IF NOT EXISTS files_folder_id_idx ON files(folder_id);
  CREATE INDEX IF NOT EXISTS files_status_idx ON files(status);
  CREATE INDEX IF NOT EXISTS files_version_stack_id_idx ON files(version_stack_id);
  CREATE INDEX IF NOT EXISTS files_mime_type_idx ON files(mime_type);
  CREATE INDEX IF NOT EXISTS files_expires_at_idx ON files(expires_at);
  CREATE INDEX IF NOT EXISTS files_assignee_id_idx ON files(assignee_id);
  CREATE INDEX IF NOT EXISTS files_project_deleted_idx ON files(project_id, deleted_at);
  CREATE INDEX IF NOT EXISTS files_project_folder_deleted_idx ON files(project_id, folder_id, deleted_at);

  -- Version stacks indexes
  CREATE INDEX IF NOT EXISTS version_stacks_project_id_idx ON version_stacks(project_id);

  -- Comments indexes
  CREATE INDEX IF NOT EXISTS comments_file_id_idx ON comments(file_id);
  CREATE INDEX IF NOT EXISTS comments_user_id_idx ON comments(user_id);
  CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON comments(parent_id);
  CREATE INDEX IF NOT EXISTS comments_version_stack_id_idx ON comments(version_stack_id);

  -- Custom fields indexes
  CREATE INDEX IF NOT EXISTS custom_fields_account_id_idx ON custom_fields(account_id);
  CREATE INDEX IF NOT EXISTS custom_field_visibility_custom_field_id_idx ON custom_field_visibility(custom_field_id);
  CREATE INDEX IF NOT EXISTS custom_field_visibility_project_id_idx ON custom_field_visibility(project_id);

  -- Shares indexes
  CREATE INDEX IF NOT EXISTS shares_account_id_idx ON shares(account_id);
  CREATE INDEX IF NOT EXISTS shares_project_id_idx ON shares(project_id);
  CREATE INDEX IF NOT EXISTS share_assets_share_id_idx ON share_assets(share_id);
  CREATE INDEX IF NOT EXISTS share_assets_file_id_idx ON share_assets(file_id);
  CREATE INDEX IF NOT EXISTS share_activity_share_id_idx ON share_activity(share_id);
  CREATE INDEX IF NOT EXISTS share_activity_type_idx ON share_activity(type);
  CREATE INDEX IF NOT EXISTS share_activity_created_at_idx ON share_activity(created_at);

  -- Notifications indexes
  CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS notifications_read_at_idx ON notifications(read_at);

  -- Permissions indexes
  CREATE INDEX IF NOT EXISTS workspace_permissions_workspace_id_idx ON workspace_permissions(workspace_id);
  CREATE INDEX IF NOT EXISTS workspace_permissions_user_id_idx ON workspace_permissions(user_id);
  CREATE INDEX IF NOT EXISTS project_permissions_project_id_idx ON project_permissions(project_id);
  CREATE INDEX IF NOT EXISTS project_permissions_user_id_idx ON project_permissions(user_id);
  CREATE INDEX IF NOT EXISTS folder_permissions_folder_id_idx ON folder_permissions(folder_id);
  CREATE INDEX IF NOT EXISTS folder_permissions_user_id_idx ON folder_permissions(user_id);

  -- Collections indexes
  CREATE INDEX IF NOT EXISTS collections_project_id_idx ON collections(project_id);
  CREATE INDEX IF NOT EXISTS collections_created_by_user_id_idx ON collections(created_by_user_id);
  CREATE INDEX IF NOT EXISTS collections_type_idx ON collections(type);
  CREATE INDEX IF NOT EXISTS collection_assets_collection_id_idx ON collection_assets(collection_id);
  CREATE INDEX IF NOT EXISTS collection_assets_file_id_idx ON collection_assets(file_id);
  CREATE INDEX IF NOT EXISTS collection_assets_sort_order_idx ON collection_assets(sort_order);

  -- Webhooks indexes
  CREATE INDEX IF NOT EXISTS webhooks_account_id_idx ON webhooks(account_id);
  CREATE INDEX IF NOT EXISTS webhooks_is_active_idx ON webhooks(is_active);
  CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx ON webhook_deliveries(webhook_id);
  CREATE INDEX IF NOT EXISTS webhook_deliveries_status_idx ON webhook_deliveries(status);
  CREATE INDEX IF NOT EXISTS webhook_deliveries_created_at_idx ON webhook_deliveries(created_at);

  -- Transcripts indexes
  CREATE UNIQUE INDEX IF NOT EXISTS transcripts_file_id_idx ON transcripts(file_id);
  CREATE INDEX IF NOT EXISTS transcripts_status_idx ON transcripts(status);
  CREATE INDEX IF NOT EXISTS transcripts_provider_idx ON transcripts(provider);
  CREATE INDEX IF NOT EXISTS transcript_words_transcript_id_idx ON transcript_words(transcript_id);
  CREATE INDEX IF NOT EXISTS transcript_words_transcript_start_idx ON transcript_words(transcript_id, start_ms);
  CREATE INDEX IF NOT EXISTS transcript_words_transcript_position_idx ON transcript_words(transcript_id, position);

  -- Captions indexes
  CREATE INDEX IF NOT EXISTS captions_file_id_idx ON captions(file_id);
  CREATE INDEX IF NOT EXISTS captions_language_idx ON captions(language);

  -- Notification Settings indexes
  CREATE UNIQUE INDEX IF NOT EXISTS notification_settings_user_id_idx ON notification_settings(user_id);

  -- API Keys indexes
  CREATE INDEX IF NOT EXISTS api_keys_account_id_idx ON api_keys(account_id);
  CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys(key_prefix);
  CREATE INDEX IF NOT EXISTS api_keys_expires_at_idx ON api_keys(expires_at);
  CREATE INDEX IF NOT EXISTS api_keys_revoked_at_idx ON api_keys(revoked_at);

  -- ============================================
  -- FTS5 VIRTUAL TABLES
  -- ============================================

  -- FTS5 virtual table for file search
  CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    id UNINDEXED,
    name,
    original_name,
    mime_type,
    content='files',
    content_rowid='rowid',
    tokenize='porter unicode61'
  );

  -- Triggers to keep FTS index in sync with files table
  CREATE TRIGGER IF NOT EXISTS files_fts_insert AFTER INSERT ON files BEGIN
    INSERT INTO files_fts(rowid, id, name, original_name, mime_type)
    VALUES (NEW.rowid, NEW.id, NEW.name, NEW.original_name, NEW.mime_type);
  END;

  CREATE TRIGGER IF NOT EXISTS files_fts_update AFTER UPDATE ON files BEGIN
    UPDATE files_fts SET
      name = NEW.name,
      original_name = NEW.original_name,
      mime_type = NEW.mime_type
    WHERE rowid = NEW.rowid;
  END;

  CREATE TRIGGER IF NOT EXISTS files_fts_delete AFTER DELETE ON files BEGIN
    DELETE FROM files_fts WHERE rowid = OLD.rowid;
  END;

  -- FTS5 virtual table for transcript search
  -- Note: This is a standalone FTS table (not content-indexed) since transcripts are in a separate table
  CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
    id UNINDEXED,
    file_id UNINDEXED,
    full_text,
    tokenize='porter unicode61'
  );
`);

console.log("✅ Migrations completed successfully");

sqlite.close();
