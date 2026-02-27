/**
 * Bush Platform - API Documentation Route
 *
 * Serves API documentation at /docs endpoint.
 * Reference: specs/04-api-reference.md
 */
import { Hono } from "hono";

const app = new Hono();

/**
 * GET /docs - API Documentation
 *
 * Returns comprehensive API documentation including:
 * - Available endpoints organized by resource
 * - Authentication methods
 * - Response format information
 */
app.get("/", (c) => {
  return c.json({
    name: "Bush API",
    version: "v4",
    description: "REST API for Bush media asset management platform",
    specification: "JSON:API 1.0",

    authentication: {
      methods: [
        {
          type: "cookie",
          description: "Browser sessions via WorkOS AuthKit",
          header: "Cookie: wos-session",
          endpoints: {
            login: "Redirect to /auth/login",
            logout: "POST /v4/auth/logout",
            me: "GET /v4/auth/me",
          },
        },
        {
          type: "bearer",
          description: "API token authentication",
          header: "Authorization: Bearer bush_tok_...",
          token_prefix: "bush_tok_",
          endpoints: {
            token: "POST /v4/auth/token",
            revoke: "POST /v4/auth/revoke",
          },
        },
      ],
      token_lifecycle: {
        access_token_ttl_seconds: 300,
        refresh_token_ttl_days: 7,
      },
    },

    endpoints: {
      auth: {
        base: "/v4/auth",
        routes: [
          { method: "POST", path: "/token", description: "Exchange refresh token for access token" },
          { method: "POST", path: "/revoke", description: "Revoke a token" },
          { method: "GET", path: "/me", description: "Get current authenticated user" },
        ],
      },
      accounts: {
        base: "/v4/accounts",
        routes: [
          { method: "GET", path: "/", description: "List accounts for current user" },
          { method: "POST", path: "/", description: "Create a new account" },
          { method: "GET", path: "/:id", description: "Get account by ID" },
          { method: "PATCH", path: "/:id", description: "Update account" },
          { method: "DELETE", path: "/:id", description: "Delete account" },
          { method: "GET", path: "/:id/members", description: "List account members" },
          { method: "GET", path: "/:id/shares", description: "List shares for account" },
          { method: "GET", path: "/:id/webhooks", description: "List webhooks for account" },
        ],
      },
      workspaces: {
        base: "/v4/workspaces",
        routes: [
          { method: "GET", path: "/", description: "List workspaces" },
          { method: "POST", path: "/", description: "Create workspace" },
          { method: "GET", path: "/:id", description: "Get workspace" },
          { method: "PATCH", path: "/:id", description: "Update workspace" },
          { method: "DELETE", path: "/:id", description: "Delete workspace" },
          { method: "POST", path: "/:id/members", description: "Add member to workspace" },
          { method: "GET", path: "/:id/members", description: "List workspace members" },
          { method: "DELETE", path: "/:id/members/:userId", description: "Remove member" },
        ],
      },
      projects: {
        base: "/v4/projects",
        routes: [
          { method: "GET", path: "/", description: "List projects" },
          { method: "POST", path: "/", description: "Create project" },
          { method: "GET", path: "/:id", description: "Get project" },
          { method: "PATCH", path: "/:id", description: "Update project" },
          { method: "DELETE", path: "/:id", description: "Delete project" },
          { method: "POST", path: "/:id/duplicate", description: "Duplicate project" },
          { method: "GET", path: "/:id/files", description: "List files in project" },
          { method: "POST", path: "/:id/files", description: "Create file upload" },
          { method: "GET", path: "/:id/folders", description: "List folders in project" },
          { method: "POST", path: "/:id/folders", description: "Create folder" },
          { method: "GET", path: "/:id/collections", description: "List collections" },
        ],
      },
      files: {
        base: "/v4/projects/:projectId/files",
        routes: [
          { method: "GET", path: "/", description: "List files" },
          { method: "POST", path: "/", description: "Initialize file upload" },
          { method: "GET", path: "/:id", description: "Get file" },
          { method: "PATCH", path: "/:id", description: "Update file" },
          { method: "DELETE", path: "/:id", description: "Delete file" },
          { method: "POST", path: "/:id/copy", description: "Copy file" },
          { method: "POST", path: "/:id/move", description: "Move file" },
          { method: "GET", path: "/:id/download", description: "Download file" },
          { method: "GET", path: "/:id/versions", description: "List file versions" },
        ],
      },
      folders: {
        base: "/v4/folders",
        routes: [
          { method: "GET", path: "/:id", description: "Get folder" },
          { method: "PATCH", path: "/:id", description: "Update folder" },
          { method: "DELETE", path: "/:id", description: "Delete folder" },
          { method: "POST", path: "/:id/folders", description: "Create subfolder" },
          { method: "POST", path: "/:id/move", description: "Move folder" },
        ],
      },
      comments: {
        base: "/v4/comments",
        routes: [
          { method: "GET", path: "/:id", description: "Get comment" },
          { method: "PUT", path: "/:id", description: "Update comment" },
          { method: "DELETE", path: "/:id", description: "Delete comment" },
          { method: "POST", path: "/:id/replies", description: "Reply to comment" },
          { method: "POST", path: "/:id/complete", description: "Mark comment complete" },
        ],
      },
      shares: {
        base: "/v4/shares",
        routes: [
          { method: "GET", path: "/slug/:slug", description: "Access share by slug (public)" },
          { method: "POST", path: "/", description: "Create share" },
          { method: "GET", path: "/:id", description: "Get share" },
          { method: "PATCH", path: "/:id", description: "Update share" },
          { method: "DELETE", path: "/:id", description: "Delete share" },
          { method: "POST", path: "/:id/assets", description: "Add assets to share" },
          { method: "POST", path: "/:id/invite", description: "Send share invite" },
        ],
      },
      collections: {
        base: "/v4/collections",
        routes: [
          { method: "GET", path: "/", description: "List collections" },
          { method: "POST", path: "/", description: "Create collection" },
          { method: "GET", path: "/:id", description: "Get collection" },
          { method: "PATCH", path: "/:id", description: "Update collection" },
          { method: "DELETE", path: "/:id", description: "Delete collection" },
          { method: "POST", path: "/:id/items", description: "Add items to collection" },
          { method: "DELETE", path: "/:id/items/:itemId", description: "Remove item" },
        ],
      },
      webhooks: {
        base: "/v4/webhooks",
        routes: [
          { method: "GET", path: "/", description: "List webhooks" },
          { method: "POST", path: "/", description: "Create webhook" },
          { method: "GET", path: "/:id", description: "Get webhook" },
          { method: "PUT", path: "/:id", description: "Update webhook" },
          { method: "DELETE", path: "/:id", description: "Delete webhook" },
          { method: "POST", path: "/:id/test", description: "Test webhook delivery" },
          { method: "GET", path: "/:id/deliveries", description: "List webhook deliveries" },
        ],
      },
      notifications: {
        base: "/v4/users/me/notifications",
        routes: [
          { method: "GET", path: "/", description: "List notifications" },
          { method: "POST", path: "/:id/read", description: "Mark notification as read" },
          { method: "POST", path: "/read-all", description: "Mark all as read" },
        ],
      },
      version_stacks: {
        base: "/v4/version-stacks",
        routes: [
          { method: "GET", path: "/", description: "List version stacks" },
          { method: "POST", path: "/", description: "Create version stack" },
          { method: "GET", path: "/:id", description: "Get version stack" },
          { method: "PATCH", path: "/:id", description: "Update version stack" },
          { method: "DELETE", path: "/:id", description: "Delete version stack" },
          { method: "POST", path: "/:id/versions", description: "Add version to stack" },
          { method: "GET", path: "/:id/comments", description: "Get stack comments" },
        ],
      },
      search: {
        base: "/v4/search",
        routes: [
          { method: "GET", path: "/files", description: "Search files" },
          { method: "GET", path: "/transcripts", description: "Search transcripts" },
        ],
      },
      bulk: {
        base: "/v4/bulk",
        routes: [
          { method: "POST", path: "/files/copy", description: "Bulk copy files" },
          { method: "POST", path: "/files/move", description: "Bulk move files" },
          { method: "POST", path: "/files/delete", description: "Bulk delete files" },
          { method: "POST", path: "/files/metadata", description: "Bulk update metadata" },
          { method: "POST", path: "/trash/restore", description: "Bulk restore files" },
        ],
      },
      transcription: {
        base: "/v4/files/:fileId/transcription",
        routes: [
          { method: "GET", path: "/", description: "Get transcription" },
          { method: "POST", path: "/", description: "Start transcription" },
          { method: "DELETE", path: "/", description: "Delete transcription" },
          { method: "GET", path: "/words", description: "Get transcription words" },
          { method: "GET", path: "/export", description: "Export transcription (SRT/VTT/TXT)" },
        ],
      },
      captions: {
        base: "/v4/files/:fileId/captions",
        routes: [
          { method: "GET", path: "/", description: "List captions" },
          { method: "POST", path: "/", description: "Upload caption file" },
          { method: "GET", path: "/:id", description: "Get caption" },
          { method: "DELETE", path: "/:id", description: "Delete caption" },
        ],
      },
    },

    response_format: {
      type: "JSON:API 1.0",
      content_type: "application/json",
      success_single: {
        example: { data: { id: "abc123", type: "file", attributes: {} } },
      },
      success_list: {
        example: { data: [], links: { next: "cursor" }, total_count: 0 },
      },
      error: {
        example: {
          errors: [{ status: "400", title: "Bad Request", detail: "Invalid input" }],
        },
      },
      pagination: {
        type: "cursor-based",
        parameters: { cursor: "Pagination cursor", limit: "Items per page (default: 50)" },
      },
    },

    rate_limits: {
      default: { requests: 100, window: "1 minute" },
      auth: { requests: 10, window: "1 minute" },
      upload: { requests: 20, window: "1 minute" },
    },

    realtime: {
      websocket: "/ws",
      protocol: "WebSocket",
      events: [
        "file.created",
        "file.updated",
        "file.deleted",
        "file.status_changed",
        "comment.created",
        "comment.updated",
        "comment.deleted",
        "comment.completed",
        "project.created",
        "project.updated",
        "project.deleted",
        "share.created",
        "share.viewed",
        "transcription.completed",
        "version.created",
        "member.added",
        "member.removed",
      ],
    },

    links: {
      self: "/docs",
      api_root: "/",
      health: "/health",
      openapi: "/v4/openapi.json (planned)",
    },
  });
});

export default app;
