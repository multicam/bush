/**
 * Bush Platform - API Server Entry Point
 *
 * Node.js + Hono backend server with CORS, health checks, and API routes.
 * Uses Bun.serve() for native performance.
 * Reference: specs/17-api-complete.md
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config, scrubSecrets } from "../config/index.js";
import { storage } from "../storage/index.js";
import { sqlite } from "../db/index.js";
import { redisHealthCheck } from "../redis/index.js";
import { errorHandler, notFoundHandler } from "./router.js";
import { standardRateLimit } from "./rate-limit.js";

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

// Public share access by slug (no auth required)
v4.get("/shares/slug/:slug", getShareBySlug);

// Mount V4 routes under /v4 prefix
app.route("/v4", v4);

// Error handlers
app.onError(errorHandler);
app.notFound(notFoundHandler);

// Start server
console.log(`\n🚀 Bush API Server starting...`);
console.log(`   Environment: ${config.NODE_ENV}`);
console.log(`   Port: ${config.PORT}`);
console.log(`   API URL: ${config.API_URL}`);
console.log(`   App URL: ${config.APP_URL}\n`);

Bun.serve({
  fetch: app.fetch,
  port: config.PORT,
  hostname: config.HOST,
});

console.log(`✅ Server listening on http://${config.HOST}:${config.PORT}`);

// Export app for testing
export { app };
