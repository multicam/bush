/**
 * Bush Platform - Database Schema
 *
 * SQLite schema with Drizzle ORM.
 * Core models: Account, User, Workspace, Project, Folder, File, etc.
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Accounts - Top-level billing and organizational entity
 */
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["free", "pro", "team", "enterprise"] }).notNull().default("free"),
  storageQuotaBytes: integer("storage_quota_bytes").notNull().default(2147483648), // 2GB default
  storageUsedBytes: integer("storage_used_bytes").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  slugIdx: uniqueIndex("accounts_slug_idx").on(table.slug),
}));

/**
 * Users - Authenticated Bush users (identity managed by WorkOS)
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workosUserId: text("workos_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workosIdx: uniqueIndex("users_workos_user_id_idx").on(table.workosUserId),
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
}));

/**
 * Account Memberships - Users associated with accounts
 */
export const accountMemberships = sqliteTable("account_memberships", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "content_admin", "member", "guest", "reviewer"] }).notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  accountUserIdx: uniqueIndex("account_memberships_account_user_idx").on(table.accountId, table.userId),
}));

/**
 * Workspaces - Logical grouping within an account
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  accountIdx: index("workspaces_account_id_idx").on(table.accountId),
}));

/**
 * Projects - Primary container for files and folders
 */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isRestricted: integer("is_restricted", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceIdx: index("projects_workspace_id_idx").on(table.workspaceId),
  archivedIdx: index("projects_archived_at_idx").on(table.archivedAt),
}));

/**
 * Folders - Hierarchical organization within projects
 */
export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  path: text("path").notNull(),
  depth: integer("depth").notNull().default(0),
  isRestricted: integer("is_restricted", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("folders_project_id_idx").on(table.projectId),
  parentIdx: index("folders_parent_id_idx").on(table.parentId),
  pathIdx: index("folders_path_idx").on(table.path),
}));

/**
 * Files - Assets stored in the system
 */
export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
  versionStackId: text("version_stack_id"),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  checksum: text("checksum"),
  status: text("status", {
    enum: ["uploading", "processing", "ready", "processing_failed", "deleted"]
  }).notNull().default("uploading"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("files_project_id_idx").on(table.projectId),
  folderIdx: index("files_folder_id_idx").on(table.folderId),
  statusIdx: index("files_status_idx").on(table.status),
}));

/**
 * Version Stacks - Group related file versions
 */
export const versionStacks = sqliteTable("version_stacks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currentFileId: text("current_file_id").references(() => files.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("version_stacks_project_id_idx").on(table.projectId),
}));

/**
 * Comments - Frame-accurate feedback on assets
 */
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  fileId: text("file_id").references(() => files.id, { onDelete: "cascade" }),
  versionStackId: text("version_stack_id").references(() => versionStacks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  text: text("text").notNull(),
  timestamp: integer("timestamp"),
  duration: integer("duration"),
  page: integer("page"),
  annotation: text("annotation", { mode: "json" }),
  isInternal: integer("is_internal", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  fileIdx: index("comments_file_id_idx").on(table.fileId),
  userIdx: index("comments_user_id_idx").on(table.userId),
}));

/**
 * Shares - Share links for external review
 */
export const shares = sqliteTable("shares", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  passphrase: text("passphrase"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  layout: text("layout", { enum: ["grid", "reel", "viewer"] }).notNull().default("grid"),
  allowComments: integer("allow_comments", { mode: "boolean" }).notNull().default(true),
  allowDownloads: integer("allow_downloads", { mode: "boolean" }).notNull().default(false),
  branding: text("branding", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  slugIdx: uniqueIndex("shares_slug_idx").on(table.slug),
}));

/**
 * Notifications - User notifications
 */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  data: text("data", { mode: "json" }),
  readAt: integer("read_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index("notifications_user_id_idx").on(table.userId),
}));
