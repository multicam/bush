/**
 * Bush Platform - API Server Entry Point
 *
 * Node.js + Hono backend server with CORS, health checks, API routes, and WebSocket.
 * Uses Bun.serve() for native performance.
 * Reference: specs/17-api-complete.md
 * Reference: specs/14-realtime-collaboration.md
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config, scrubSecrets } from "../config/index.js";
import { storage } from "../storage/index.js";
import { sqlite } from "../db/index.js";
import { redisHealthCheck } from "../redis/index.js";
import { errorHandler, notFoundHandler } from "./router.js";
import { standardRateLimit, rateLimit } from "./rate-limit.js";
import { wsManager, type WebSocketData } from "../realtime/index.js";
import type { ServerWebSocket } from "bun";

// Import route modules
import {
  authRoutes,
  accountRoutes,
  workspaceRoutes,
  projectRoutes,
  fileRoutes,
  userRoutes,
  folderRoutes,
  bulkRoutes,
  searchRoutes,
  versionStackRoutes,
  commentRoutes,
  customFieldRoutes,
  metadataRoutes,
  shareRoutes,
  notificationRoutes,
  collectionRoutes,
  webhookRoutes,
  transcriptionRoutes,
  captionsRoutes,
} from "./routes/index.js";
import { getShareBySlug } from "./routes/index.js";

const app = new Hono();

// Middleware: CORS (allow Next.js frontend)
app.use(
  "*",
  cors({
    origin: [config.APP_URL, "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Middleware: Request logging with secret scrubbing
app.use(
  "*",
  logger((str) => {
    console.log(scrubSecrets(str));
  })
);

// Health check endpoint - verifies all dependencies
app.get("/health", async (c) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check 1: API server is running
  checks.api = { status: "ok" };

  // Check 2: Redis connection
  try {
    const start = Date.now();
    const isHealthy = await redisHealthCheck();
    checks.redis = {
      status: isHealthy ? "ok" : "error",
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.redis = { status: "error", error: String(error) };
  }

  // Check 3: Database connection
  try {
    const start = Date.now();
    // Run a simple query to verify connection
    sqlite.prepare("SELECT 1").get();
    checks.database = { status: "ok", latency: Date.now() - start };
  } catch (error) {
    checks.database = { status: "error", error: String(error) };
  }

  // Check 4: Storage connection
  try {
    const start = Date.now();
    const isHealthy = await storage.healthCheck();
    checks.storage = {
      status: isHealthy ? "ok" : "error",
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.storage = { status: "error", error: String(error) };
  }

  // Check 5: WebSocket connections (optional info)
  try {
    const wsStats = wsManager.getStats();
    checks.websocket = {
      status: "ok",
      latency: 0,
      ...wsStats,
    } as { status: string; latency: number };
  } catch {
    checks.websocket = { status: "ok" };
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every((c) => c.status === "ok");
  const statusCode = allHealthy ? 200 : 503;

  return c.json(
    {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: "0.0.0",
      checks,
    },
    statusCode
  );
});

// API V4 routes placeholder
app.get("/", (c) => {
  return c.json({
    name: "Bush API",
    version: "v4",
    documentation: "/docs",
  });
});

// API V4 Routes
// Reference: specs/17-api-complete.md
const v4 = new Hono();

// Apply rate limiting to all V4 routes
v4.use("*", standardRateLimit);

// Mount resource routes
v4.route("/auth", authRoutes);
v4.route("/accounts", accountRoutes);
v4.route("/workspaces", workspaceRoutes);
v4.route("/projects", projectRoutes);
v4.route("/users", userRoutes);

// Nested file routes (under projects)
v4.route("/projects/:projectId/files", fileRoutes);

// Nested folder routes (under projects)
v4.route("/projects/:projectId/folders", folderRoutes);

// Standalone folder routes
v4.route("/folders", folderRoutes);

// Bulk operations
v4.route("/bulk", bulkRoutes);

// Search
v4.route("/search", searchRoutes);

// Version Stacks
v4.route("/version-stacks", versionStackRoutes);

// Comments (standalone routes for updating/deleting comments)
v4.route("/comments", commentRoutes);

// File comments (nested under files)
v4.route("/files/:fileId/comments", commentRoutes);

// Version stack comments (using exported handlers)
// Note: These are added to version-stacks route separately

// Custom Fields (account-wide field definitions)
v4.route("/", customFieldRoutes);

// Metadata (file metadata - built-in and custom fields)
v4.route("/", metadataRoutes);

// Shares (share links for external review)
v4.route("/shares", shareRoutes);

// Share assets (nested under shares)
v4.route("/shares/:id/assets", shareRoutes);

// Share activity (nested under shares)
v4.route("/shares/:id/activity", shareRoutes);

// Account shares (nested under accounts)
v4.route("/accounts/:accountId/shares", shareRoutes);

// Public share access by slug (no auth required, rate limited to prevent brute force)
v4.get("/shares/slug/:slug", rateLimit({ preset: "auth", keyPrefix: "rl:public-share" }), getShareBySlug);

// Notifications (for current user)
v4.route("/users/me/notifications", notificationRoutes);

// Individual notification operations
v4.route("/notifications", notificationRoutes);

// Collections (nested under projects)
v4.route("/projects/:projectId/collections", collectionRoutes);

// Collection operations (standalone)
v4.route("/collections", collectionRoutes);

// Webhooks (nested under accounts)
v4.route("/accounts/:accountId/webhooks", webhookRoutes);

// Webhook operations (standalone)
v4.route("/webhooks", webhookRoutes);

// Transcription (nested under files)
v4.route("/files/:fileId/transcription", transcriptionRoutes);

// Transcription words (nested under files)
v4.route("/files/:fileId/transcription/words", transcriptionRoutes);

// Transcription export (nested under files)
v4.route("/files/:fileId/transcription/export", transcriptionRoutes);

// Captions (nested under files)
v4.route("/files/:fileId/captions", captionsRoutes);

// Mount V4 routes under /v4 prefix
app.route("/v4", v4);

// Error handlers
app.onError(errorHandler);
app.notFound(notFoundHandler);

// Initialize WebSocket manager
wsManager.init();

// Start server
console.log(`\n🚀 Bush API Server starting...`);
console.log(`   Environment: ${config.NODE_ENV}`);
console.log(`   Port: ${config.PORT}`);
console.log(`   API URL: ${config.API_URL}`);
console.log(`   App URL: ${config.APP_URL}\n`);

/**
 * Custom fetch handler that handles WebSocket upgrades for /ws endpoint
 */
async function fetchHandler(req: Request, server: { upgrade: (req: Request, options: { data: WebSocketData }) => boolean }): Promise<Response> {
  const url = new URL(req.url);

  // Handle WebSocket upgrade for /ws endpoint
  if (url.pathname === "/ws" && req.headers.get("upgrade") === "websocket") {
    // Authenticate the connection from cookies
    const cookieHeader = req.headers.get("cookie") || "";
    const authResult = await wsManager.authenticate(cookieHeader);

    if (!authResult) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Prepare WebSocket data
    const wsData: WebSocketData = {
      connectionId: wsManager.generateConnectionId(),
      userId: authResult.userId,
      session: authResult.session,
      connectedAt: new Date(),
      subscriptions: new Set(),
      messageTimestamps: [],
    };

    // Upgrade the connection
    const success = server.upgrade(req, { data: wsData });
    if (!success) {
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Return undefined - Bun will handle the WebSocket response
    return new Response(null, { status: 101 });
  }

  // For all other requests, use Hono
  return app.fetch(req);
}

Bun.serve({
  fetch: fetchHandler,
  port: config.PORT,
  hostname: config.HOST,
  websocket: {
    /**
     * Called when a WebSocket connection is opened
     */
    open(ws: ServerWebSocket<WebSocketData>) {
      wsManager.register(ws);
    },

    /**
     * Called when a message is received from a WebSocket
     */
    async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const msgString = typeof message === "string" ? message : message.toString("utf-8");
      await wsManager.handleMessage(ws, msgString);
    },

    /**
     * Called when a WebSocket connection is closed
     */
    close(ws: ServerWebSocket<WebSocketData>) {
      wsManager.unregister(ws);
    },

    /**
     * Send ping frames every 30 seconds for keepalive
     */
    idleTimeout: 60,

    /**
     * Maximum message size (16 KB)
     */
    maxPayloadLength: 16 * 1024,

    /**
     * Enable per-message deflate for compression
     */
    perMessageDeflate: true,
  },
});

console.log(`✅ Server listening on http://${config.HOST}:${config.PORT}`);
console.log(`✅ WebSocket endpoint available at ws://${config.HOST}:${config.PORT}/ws`);

// Export app for testing
export { app };
