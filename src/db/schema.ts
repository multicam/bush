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
  // Critical composite index for tree queries (children of a folder in a project)
  projectParentIdx: index("folders_project_parent_idx").on(table.projectId, table.parentId),
}));

/**
 * Technical metadata structure extracted from media files
 * Stored as JSON in the files table
 */
export interface TechnicalMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitRate: number | null;
  sampleRate: number | null;
  channels: number | null;
  isHDR: boolean;
  hdrType: string | null;
  colorSpace: string | null;
  audioBitDepth: number | null;
  format: string | null;
  hasAlpha: boolean;
}

/**
 * Built-in editable metadata fields
 */
export interface BuiltInMetadata {
  rating: number | null; // 1-5
  status: string | null; // Custom status value
  keywords: string[]; // Array of tags/keywords
  notes: string | null; // User notes
  assigneeId: string | null; // User ID of assignee
}

/**
 * Custom field value types
 */
export type CustomFieldValue =
  | string
  | number
  | boolean
  | string[]
  | null;

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
  // Technical metadata extracted from file (read-only)
  technicalMetadata: text("technical_metadata", { mode: "json" }).$type<TechnicalMetadata>(),
  // Built-in editable metadata
  rating: integer("rating"), // 1-5
  assetStatus: text("asset_status"), // Custom status (renamed to avoid conflict with file status)
  keywords: text("keywords", { mode: "json" }).$type<string[]>().default([]),
  notes: text("notes"),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  // Custom metadata values (field_id -> value)
  customMetadata: text("custom_metadata", { mode: "json" }).$type<Record<string, CustomFieldValue>>(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("files_project_id_idx").on(table.projectId),
  folderIdx: index("files_folder_id_idx").on(table.folderId),
  statusIdx: index("files_status_idx").on(table.status),
  versionStackIdx: index("files_version_stack_id_idx").on(table.versionStackId),
  mimeTypeIdx: index("files_mime_type_idx").on(table.mimeType),
  expiresAtIdx: index("files_expires_at_idx").on(table.expiresAt),
  assigneeIdx: index("files_assignee_id_idx").on(table.assigneeId),
}));

/**
 * Custom field types supported by the system
 */
export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "single_select"
  | "multi_select"
  | "checkbox"
  | "user"
  | "url"
  | "rating";

/**
 * Custom Fields - Account-wide custom metadata field definitions
 */
export const customFields = sqliteTable("custom_fields", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // URL-safe identifier
  type: text("type", {
    enum: ["text", "textarea", "number", "date", "single_select", "multi_select", "checkbox", "user", "url", "rating"]
  }).notNull(),
  description: text("description"),
  // For select fields: array of options
  options: text("options", { mode: "json" }).$type<string[]>(),
  // Whether this field is visible by default
  isVisibleByDefault: integer("is_visible_by_default", { mode: "boolean" }).notNull().default(true),
  // Who can edit this field's values
  editableBy: text("editable_by", {
    enum: ["admin", "full_access"]
  }).notNull().default("full_access"),
  // Sort order for display
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  accountIdx: index("custom_fields_account_id_idx").on(table.accountId),
  accountSlugIdx: uniqueIndex("custom_fields_account_slug_idx").on(table.accountId, table.slug),
}));

/**
 * Custom Field Visibility - Per-project visibility settings for custom fields
 */
export const customFieldVisibility = sqliteTable("custom_field_visibility", {
  id: text("id").primaryKey(),
  customFieldId: text("custom_field_id").notNull().references(() => customFields.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  customFieldIdx: index("custom_field_visibility_custom_field_id_idx").on(table.customFieldId),
  projectIdx: index("custom_field_visibility_project_id_idx").on(table.projectId),
  fieldProjectIdx: uniqueIndex("custom_field_visibility_field_project_idx").on(table.customFieldId, table.projectId),
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
  parentIdx: index("comments_parent_id_idx").on(table.parentId),
  versionStackIdx: index("comments_version_stack_id_idx").on(table.versionStackId),
}));

/**
 * Share branding configuration
 */
export interface ShareBranding {
  logoUrl?: string;
  backgroundColor?: string;
  accentColor?: string;
  headerSize?: "small" | "medium" | "large";
  description?: string;
  darkMode?: boolean;
}

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
  showAllVersions: integer("show_all_versions", { mode: "boolean" }).notNull().default(false),
  showTranscription: integer("show_transcription", { mode: "boolean" }).notNull().default(false),
  featuredField: text("featured_field"),
  branding: text("branding", { mode: "json" }).$type<ShareBranding>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  slugIdx: uniqueIndex("shares_slug_idx").on(table.slug),
  accountIdx: index("shares_account_id_idx").on(table.accountId),
  projectIdx: index("shares_project_id_idx").on(table.projectId),
}));

/**
 * Share Assets - Assets included in a share
 */
export const shareAssets = sqliteTable("share_assets", {
  id: text("id").primaryKey(),
  shareId: text("share_id").notNull().references(() => shares.id, { onDelete: "cascade" }),
  fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  shareIdx: index("share_assets_share_id_idx").on(table.shareId),
  fileIdx: index("share_assets_file_id_idx").on(table.fileId),
  shareFileIdx: uniqueIndex("share_assets_share_file_idx").on(table.shareId, table.fileId),
}));

/**
 * Share Activity - Track views, comments, and downloads on shares
 */
export const shareActivity = sqliteTable("share_activity", {
  id: text("id").primaryKey(),
  shareId: text("share_id").notNull().references(() => shares.id, { onDelete: "cascade" }),
  fileId: text("file_id").references(() => files.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["view", "comment", "download"] }).notNull(),
  viewerEmail: text("viewer_email"),
  viewerIp: text("viewer_ip"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  shareIdx: index("share_activity_share_id_idx").on(table.shareId),
  typeIdx: index("share_activity_type_idx").on(table.type),
  createdIdx: index("share_activity_created_at_idx").on(table.createdAt),
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
  readAtIdx: index("notifications_read_at_idx").on(table.readAt),
}));

/**
 * Permission levels for resources
 */
export type PermissionLevel = "full_access" | "edit_and_share" | "edit" | "comment_only" | "view_only";

/**
 * Workspace Permissions - User access to workspaces
 */
export const workspacePermissions = sqliteTable("workspace_permissions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission", {
    enum: ["full_access", "edit_and_share", "edit", "comment_only", "view_only"]
  }).notNull().default("view_only"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceUserIdx: uniqueIndex("workspace_permissions_workspace_user_idx").on(table.workspaceId, table.userId),
  workspaceIdx: index("workspace_permissions_workspace_id_idx").on(table.workspaceId),
  userIdx: index("workspace_permissions_user_id_idx").on(table.userId),
}));

/**
 * Project Permissions - User access to projects
 */
export const projectPermissions = sqliteTable("project_permissions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission", {
    enum: ["full_access", "edit_and_share", "edit", "comment_only", "view_only"]
  }).notNull().default("view_only"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  projectUserIdx: uniqueIndex("project_permissions_project_user_idx").on(table.projectId, table.userId),
  projectIdx: index("project_permissions_project_id_idx").on(table.projectId),
  userIdx: index("project_permissions_user_id_idx").on(table.userId),
}));

/**
 * Folder Permissions - User access to restricted folders
 */
export const folderPermissions = sqliteTable("folder_permissions", {
  id: text("id").primaryKey(),
  folderId: text("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission", {
    enum: ["full_access", "edit_and_share", "edit", "comment_only", "view_only"]
  }).notNull().default("view_only"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  folderUserIdx: uniqueIndex("folder_permissions_folder_user_idx").on(table.folderId, table.userId),
  folderIdx: index("folder_permissions_folder_id_idx").on(table.folderId),
  userIdx: index("folder_permissions_user_id_idx").on(table.userId),
}));

/**
 * Collection Types - Team or Private
 */
export type CollectionType = "team" | "private";

/**
 * Collection Filter Rule - For dynamic collections
 */
export interface CollectionFilterRule {
  field: string; // Field name (e.g., "status", "rating", "keywords")
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains";
  value: string | number | boolean | string[] | null;
}

/**
 * Collections - Saved asset groupings
 */
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", { enum: ["team", "private"] }).notNull().default("team"),
  // Dynamic filter rules (JSON array of filter conditions)
  filterRules: text("filter_rules", { mode: "json" }).$type<CollectionFilterRule[]>(),
  // Whether this is a dynamic collection (auto-updates based on filters) or manual
  isDynamic: integer("is_dynamic", { mode: "boolean" }).notNull().default(false),
  // View preference for this collection
  defaultView: text("default_view", { enum: ["grid", "list"] }).notNull().default("grid"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("collections_project_id_idx").on(table.projectId),
  createdByIdx: index("collections_created_by_user_id_idx").on(table.createdByUserId),
  typeIdx: index("collections_type_idx").on(table.type),
}));

/**
 * Collection Assets - Assets in manual collections
 */
export const collectionAssets = sqliteTable("collection_assets", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  addedByUserId: text("added_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  collectionIdx: index("collection_assets_collection_id_idx").on(table.collectionId),
  fileIdx: index("collection_assets_file_id_idx").on(table.fileId),
  collectionFileIdx: uniqueIndex("collection_assets_collection_file_idx").on(table.collectionId, table.fileId),
  sortOrderIdx: index("collection_assets_sort_order_idx").on(table.sortOrder),
}));
