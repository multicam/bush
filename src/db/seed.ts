/**
 * Bush Platform - Database Seed Script
 *
 * Generates realistic development data for testing.
 * Run with: npm run db:seed
 * Reset with: npm run db:seed:reset (if you add it)
 */
import Database from "better-sqlite3";
import { config } from "../config/index.js";
import * as crypto from "crypto";

// Generate a deterministic ID for reproducibility in tests
function generateId(prefix: string, seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

// Current timestamp
const now = Date.now();

console.log("Seeding database...");

const sqlite = new Database(config.DATABASE_URL);

// Use transaction for atomicity
const seed = sqlite.transaction(() => {
  // Clear existing data (in reverse dependency order)
  sqlite.exec(`
    DELETE FROM notifications;
    DELETE FROM comments;
    DELETE FROM shares;
    DELETE FROM files;
    DELETE FROM version_stacks;
    DELETE FROM folders;
    DELETE FROM projects;
    DELETE FROM workspaces;
    DELETE FROM account_memberships;
    DELETE FROM users;
    DELETE FROM accounts;
  `);

  // ========================================
  // ACCOUNTS
  // ========================================
  const accounts = [
    {
      id: generateId("acc", "account-alpha"),
      name: "Alpha Studios",
      slug: "alpha-studios",
      plan: "team",
      storageQuotaBytes: 3221225472, // 3GB (Team plan)
      storageUsedBytes: 536870912, // 512MB used
    },
    {
      id: generateId("acc", "account-beta"),
      name: "Beta Productions",
      slug: "beta-productions",
      plan: "pro",
      storageQuotaBytes: 2199023255552, // 2TB (Pro plan)
      storageUsedBytes: 10737418240, // 10GB used
    },
  ];

  const insertAccount = sqlite.prepare(`
    INSERT INTO accounts (id, name, slug, plan, storage_quota_bytes, storage_used_bytes, created_at, updated_at)
    VALUES (@id, @name, @slug, @plan, @storageQuotaBytes, @storageUsedBytes, @createdAt, @updatedAt)
  `);

  for (const account of accounts) {
    insertAccount.run({ ...account, createdAt: now, updatedAt: now });
  }

  // ========================================
  // USERS
  // ========================================
  const users = [
    {
      id: generateId("usr", "user-alice"),
      workosUserId: "workos_user_alice",
      email: "alice@alpha.studio",
      firstName: "Alice",
      lastName: "Chen",
      avatarUrl: null,
    },
    {
      id: generateId("usr", "user-bob"),
      workosUserId: "workos_user_bob",
      email: "bob@alpha.studio",
      firstName: "Bob",
      lastName: "Martinez",
      avatarUrl: null,
    },
    {
      id: generateId("usr", "user-charlie"),
      workosUserId: "workos_user_charlie",
      email: "charlie@alpha.studio",
      firstName: "Charlie",
      lastName: "Kim",
      avatarUrl: null,
    },
    {
      id: generateId("usr", "user-diana"),
      workosUserId: "workos_user_diana",
      email: "diana@beta.productions",
      firstName: "Diana",
      lastName: "Patel",
      avatarUrl: null,
    },
    {
      id: generateId("usr", "user-evan"),
      workosUserId: "workos_user_evan",
      email: "evan@beta.productions",
      firstName: "Evan",
      lastName: "Johnson",
      avatarUrl: null,
    },
  ];

  const insertUser = sqlite.prepare(`
    INSERT INTO users (id, workos_user_id, email, first_name, last_name, avatar_url, created_at, updated_at)
    VALUES (@id, @workosUserId, @email, @firstName, @lastName, @avatarUrl, @createdAt, @updatedAt)
  `);

  for (const user of users) {
    insertUser.run({ ...user, createdAt: now, updatedAt: now });
  }

  // ========================================
  // ACCOUNT MEMBERSHIPS
  // ========================================
  const memberships = [
    // Alpha Studios members
    { id: generateId("mem", "mem-alice-alpha"), accountId: accounts[0].id, userId: users[0].id, role: "owner" },
    { id: generateId("mem", "mem-bob-alpha"), accountId: accounts[0].id, userId: users[1].id, role: "content_admin" },
    { id: generateId("mem", "mem-charlie-alpha"), accountId: accounts[0].id, userId: users[2].id, role: "member" },
    // Beta Productions members
    { id: generateId("mem", "mem-diana-beta"), accountId: accounts[1].id, userId: users[3].id, role: "owner" },
    { id: generateId("mem", "mem-evan-beta"), accountId: accounts[1].id, userId: users[4].id, role: "member" },
  ];

  const insertMembership = sqlite.prepare(`
    INSERT INTO account_memberships (id, account_id, user_id, role, created_at, updated_at)
    VALUES (@id, @accountId, @userId, @role, @createdAt, @updatedAt)
  `);

  for (const membership of memberships) {
    insertMembership.run({ ...membership, createdAt: now, updatedAt: now });
  }

  // ========================================
  // WORKSPACES
  // ========================================
  const workspaces = [
    {
      id: generateId("ws", "workspace-alpha-main"),
      accountId: accounts[0].id,
      name: "Main Workspace",
      description: "Primary workspace for Alpha Studios",
    },
    {
      id: generateId("ws", "workspace-alpha-archive"),
      accountId: accounts[0].id,
      name: "Archive",
      description: "Archived projects",
    },
    {
      id: generateId("ws", "workspace-beta-main"),
      accountId: accounts[1].id,
      name: "Productions",
      description: "Active productions",
    },
  ];

  const insertWorkspace = sqlite.prepare(`
    INSERT INTO workspaces (id, account_id, name, description, created_at, updated_at)
    VALUES (@id, @accountId, @name, @description, @createdAt, @updatedAt)
  `);

  for (const workspace of workspaces) {
    insertWorkspace.run({ ...workspace, createdAt: now, updatedAt: now });
  }

  // ========================================
  // PROJECTS
  // ========================================
  const projects = [
    {
      id: generateId("prj", "project-commercial"),
      workspaceId: workspaces[0].id,
      name: "Super Bowl Commercial",
      description: "2024 Super Bowl ad campaign",
      isRestricted: false,
    },
    {
      id: generateId("prj", "project-documentary"),
      workspaceId: workspaces[0].id,
      name: "Nature Documentary",
      description: "Wildlife footage collection",
      isRestricted: false,
    },
    {
      id: generateId("prj", "project-confidential"),
      workspaceId: workspaces[0].id,
      name: "Confidential Project",
      description: "Restricted access project",
      isRestricted: true,
    },
    {
      id: generateId("prj", "project-music-video"),
      workspaceId: workspaces[2].id,
      name: "Music Video - Summer Hit",
      description: "New artist music video",
      isRestricted: false,
    },
    {
      id: generateId("prj", "project-short-film"),
      workspaceId: workspaces[2].id,
      name: "Short Film - The Journey",
      description: "15-minute short film",
      isRestricted: false,
    },
  ];

  const insertProject = sqlite.prepare(`
    INSERT INTO projects (id, workspace_id, name, description, is_restricted, archived_at, created_at, updated_at)
    VALUES (@id, @workspaceId, @name, @description, @isRestricted, NULL, @createdAt, @updatedAt)
  `);

  for (const project of projects) {
    insertProject.run({ ...project, isRestricted: project.isRestricted ? 1 : 0, createdAt: now, updatedAt: now });
  }

  // ========================================
  // FOLDERS
  // ========================================
  const folders = [
    // Commercial project folders
    {
      id: generateId("fld", "folder-commercials-footage"),
      projectId: projects[0].id,
      parentId: null,
      name: "Footage",
      path: "/Footage",
      depth: 0,
      isRestricted: false,
    },
    {
      id: generateId("fld", "folder-commercials-audio"),
      projectId: projects[0].id,
      parentId: null,
      name: "Audio",
      path: "/Audio",
      depth: 0,
      isRestricted: false,
    },
    {
      id: generateId("fld", "folder-commercials-graphics"),
      projectId: projects[0].id,
      parentId: null,
      name: "Graphics",
      path: "/Graphics",
      depth: 0,
      isRestricted: false,
    },
    // Documentary project folders
    {
      id: generateId("fld", "folder-doc-footage"),
      projectId: projects[1].id,
      parentId: null,
      name: "Raw Footage",
      path: "/Raw Footage",
      depth: 0,
      isRestricted: false,
    },
    {
      id: generateId("fld", "folder-doc-interviews"),
      projectId: projects[1].id,
      parentId: null,
      name: "Interviews",
      path: "/Interviews",
      depth: 0,
      isRestricted: false,
    },
  ];

  const insertFolder = sqlite.prepare(`
    INSERT INTO folders (id, project_id, parent_id, name, path, depth, is_restricted, created_at, updated_at)
    VALUES (@id, @projectId, @parentId, @name, @path, @depth, @isRestricted, @createdAt, @updatedAt)
  `);

  for (const folder of folders) {
    insertFolder.run({
      ...folder,
      isRestricted: folder.isRestricted ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ========================================
  // FILES
  // ========================================
  const files = [
    // Commercial footage
    {
      id: generateId("file", "file-commercial-01"),
      projectId: projects[0].id,
      folderId: folders[0].id,
      versionStackId: null,
      name: "shot_001_main.mp4",
      originalName: "shot_001_main.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 524288000, // 500MB
      checksum: "abc123",
      status: "ready",
    },
    {
      id: generateId("file", "file-commercial-02"),
      projectId: projects[0].id,
      folderId: folders[0].id,
      versionStackId: null,
      name: "shot_002_broll.mp4",
      originalName: "shot_002_broll.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 314572800, // 300MB
      checksum: "def456",
      status: "ready",
    },
    {
      id: generateId("file", "file-commercial-03"),
      projectId: projects[0].id,
      folderId: folders[0].id,
      versionStackId: null,
      name: "shot_003_product.mov",
      originalName: "shot_003_product.mov",
      mimeType: "video/quicktime",
      fileSizeBytes: 1073741824, // 1GB
      checksum: "ghi789",
      status: "processing",
    },
    // Commercial audio
    {
      id: generateId("file", "file-commercial-audio-01"),
      projectId: projects[0].id,
      folderId: folders[1].id,
      versionStackId: null,
      name: "voiceover_main.wav",
      originalName: "voiceover_main.wav",
      mimeType: "audio/wav",
      fileSizeBytes: 52428800, // 50MB
      checksum: "jkl012",
      status: "ready",
    },
    // Commercial graphics
    {
      id: generateId("file", "file-commercial-gfx-01"),
      projectId: projects[0].id,
      folderId: folders[2].id,
      versionStackId: null,
      name: "logo_animation.aep",
      originalName: "logo_animation.aep",
      mimeType: "application/vnd.adobe.aftereffects.project",
      fileSizeBytes: 104857600, // 100MB
      checksum: "mno345",
      status: "ready",
    },
    // Documentary footage
    {
      id: generateId("file", "file-doc-01"),
      projectId: projects[1].id,
      folderId: folders[3].id,
      versionStackId: null,
      name: "wildlife_bears_001.mxf",
      originalName: "wildlife_bears_001.mxf",
      mimeType: "application/mxf",
      fileSizeBytes: 2147483648, // 2GB
      checksum: "pqr678",
      status: "ready",
    },
    {
      id: generateId("file", "file-doc-02"),
      projectId: projects[1].id,
      folderId: folders[3].id,
      versionStackId: null,
      name: "wildlife_eagles_001.mxf",
      originalName: "wildlife_eagles_001.mxf",
      mimeType: "application/mxf",
      fileSizeBytes: 1879048192, // 1.75GB
      checksum: "stu901",
      status: "ready",
    },
    // Image files
    {
      id: generateId("file", "file-img-01"),
      projectId: projects[0].id,
      folderId: folders[2].id,
      versionStackId: null,
      name: "product_photo.psd",
      originalName: "product_photo.psd",
      mimeType: "image/vnd.adobe.photoshop",
      fileSizeBytes: 209715200, // 200MB
      checksum: "vwx234",
      status: "ready",
    },
    // Processing failed file
    {
      id: generateId("file", "file-failed-01"),
      projectId: projects[0].id,
      folderId: folders[0].id,
      versionStackId: null,
      name: "corrupted_file.mp4",
      originalName: "corrupted_file.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 1048576, // 1MB
      checksum: "yza567",
      status: "processing_failed",
    },
    // Uploading file
    {
      id: generateId("file", "file-uploading-01"),
      projectId: projects[0].id,
      folderId: null,
      versionStackId: null,
      name: "new_upload.mp4",
      originalName: "new_upload.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 0,
      checksum: null,
      status: "uploading",
    },
  ];

  const insertFile = sqlite.prepare(`
    INSERT INTO files (id, project_id, folder_id, version_stack_id, name, original_name, mime_type, file_size_bytes, checksum, status, deleted_at, expires_at, created_at, updated_at)
    VALUES (@id, @projectId, @folderId, @versionStackId, @name, @originalName, @mimeType, @fileSizeBytes, @checksum, @status, NULL, NULL, @createdAt, @updatedAt)
  `);

  for (const file of files) {
    insertFile.run({ ...file, createdAt: now, updatedAt: now });
  }

  // ========================================
  // COMMENTS
  // ========================================
  const comments = [
    {
      id: generateId("cmt", "comment-01"),
      fileId: files[0].id,
      versionStackId: null,
      userId: users[1].id,
      parentId: null,
      text: "Great shot! Can we extend the duration by 2 seconds?",
      timestamp: 5000, // 5 seconds in
      duration: null,
      page: null,
      annotation: null,
      isInternal: false,
    },
    {
      id: generateId("cmt", "comment-02"),
      fileId: files[0].id,
      versionStackId: null,
      userId: users[0].id,
      parentId: null,
      text: "Let's use this as the opening shot",
      timestamp: 0,
      duration: null,
      page: null,
      annotation: null,
      isInternal: false,
    },
    {
      id: generateId("cmt", "comment-03"),
      fileId: files[0].id,
      versionStackId: null,
      userId: users[1].id,
      parentId: generateId("cmt", "comment-01"), // Reply to first comment
      text: "Actually, make it 3 seconds to match the music beat",
      timestamp: null,
      duration: null,
      page: null,
      annotation: null,
      isInternal: false,
    },
    {
      id: generateId("cmt", "comment-04"),
      fileId: files[3].id,
      versionStackId: null,
      userId: users[0].id,
      parentId: null,
      text: "Audio levels need adjustment at 0:15",
      timestamp: 15000,
      duration: 3000, // Range comment from 15s to 18s
      page: null,
      annotation: null,
      isInternal: true, // Internal comment
    },
  ];

  const insertComment = sqlite.prepare(`
    INSERT INTO comments (id, file_id, version_stack_id, user_id, parent_id, text, timestamp, duration, page, annotation, is_internal, completed_at, created_at, updated_at)
    VALUES (@id, @fileId, @versionStackId, @userId, @parentId, @text, @timestamp, @duration, @page, @annotation, @isInternal, NULL, @createdAt, @updatedAt)
  `);

  for (const comment of comments) {
    insertComment.run({
      ...comment,
      annotation: comment.annotation ? JSON.stringify(comment.annotation) : null,
      isInternal: comment.isInternal ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ========================================
  // NOTIFICATIONS
  // ========================================
  const notifications = [
    {
      id: generateId("ntf", "notification-01"),
      userId: users[0].id,
      type: "comment",
      title: "New comment on your file",
      body: "Bob commented on shot_001_main.mp4",
      data: JSON.stringify({ fileId: files[0].id, commentId: comments[0].id }),
      readAt: null,
    },
    {
      id: generateId("ntf", "notification-02"),
      userId: users[1].id,
      type: "upload",
      title: "Upload complete",
      body: "shot_002_broll.mp4 is ready for review",
      data: JSON.stringify({ fileId: files[1].id }),
      readAt: now - 3600000, // Read 1 hour ago
    },
  ];

  const insertNotification = sqlite.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, data, read_at, created_at)
    VALUES (@id, @userId, @type, @title, @body, @data, @readAt, @createdAt)
  `);

  for (const notification of notifications) {
    insertNotification.run({ ...notification, createdAt: now });
  }

  console.log("\n✅ Database seeded successfully!");
  console.log("\nSeeded data:");
  console.log(`  - ${accounts.length} accounts`);
  console.log(`  - ${users.length} users`);
  console.log(`  - ${memberships.length} account memberships`);
  console.log(`  - ${workspaces.length} workspaces`);
  console.log(`  - ${projects.length} projects`);
  console.log(`  - ${folders.length} folders`);
  console.log(`  - ${files.length} files`);
  console.log(`  - ${comments.length} comments`);
  console.log(`  - ${notifications.length} notifications`);
});

seed();
sqlite.close();
