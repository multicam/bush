/**
 * Database Migration Script
 *
 * Run with: bun run db:migrate
 */
import Database from "better-sqlite3";
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
  sqlite.pragma("journal_mode = WAL");
}

// Create tables directly for initial setup
sqlite.exec(`
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
    deleted_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
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
    branding TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

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

  CREATE INDEX IF NOT EXISTS workspaces_account_id_idx ON workspaces(account_id);
  CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects(workspace_id);
  CREATE INDEX IF NOT EXISTS folders_project_id_idx ON folders(project_id);
  CREATE INDEX IF NOT EXISTS files_project_id_idx ON files(project_id);
  CREATE INDEX IF NOT EXISTS files_status_idx ON files(status);
  CREATE INDEX IF NOT EXISTS comments_file_id_idx ON comments(file_id);
  CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

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
`);

console.log("✅ Migrations completed successfully");

sqlite.close();
