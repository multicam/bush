/**
 * Bush Platform - API Server Entry Point
 *
 * Node.js + Hono backend server with CORS, health checks, and API routes.
 * Uses @hono/node-server for Node.js compatibility.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { config, scrubSecrets } from "../config/index.js";
import { storage } from "../storage/index.js";
import { sqlite } from "../db/index.js";
import { redisHealthCheck } from "../redis/index.js";

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

// Start server
console.log(`\n🚀 Bush API Server starting...`);
console.log(`   Environment: ${config.NODE_ENV}`);
console.log(`   Port: ${config.PORT}`);
console.log(`   API URL: ${config.API_URL}`);
console.log(`   App URL: ${config.APP_URL}\n`);

serve({
  fetch: app.fetch,
  port: config.PORT,
  hostname: config.HOST,
});

console.log(`✅ Server listening on http://${config.HOST}:${config.PORT}`);
