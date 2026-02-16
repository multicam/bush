/**
 * Bush Platform - Environment Configuration
 *
 * Type-safe configuration with Zod validation.
 * All configuration accessed through the typed `config` object.
 * Fail fast on missing or invalid config.
 */
import { z } from "zod";

/**
 * Secret keys that must be scrubbed from logs
 */
export const SECRET_KEYS = [
  "WORKOS_API_KEY",
  "WORKOS_WEBHOOK_SECRET",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "CDN_SIGNING_KEY",
  "SMTP_PASS",
  "SESSION_SECRET",
] as const;

/**
 * Zod schema for environment variables
 */
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_WAL_MODE: z.coerce.boolean().default(true),
  DATABASE_BUSY_TIMEOUT: z.coerce.number().int().positive().default(5000),

  // Redis
  REDIS_URL: z.string().min(1),
  REDIS_KEY_PREFIX: z.string().default("bush:"),

  // WorkOS
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url(),
  WORKOS_WEBHOOK_SECRET: z.string().min(1),
  WORKOS_COOKIE_PASSWORD: z.string().min(32).optional(), // For AuthKit SDK encryption

  // Storage
  STORAGE_PROVIDER: z.enum(["minio", "s3", "r2", "b2"]).default("minio"),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_BUCKET_DERIVATIVES: z.string().optional(),

  // CDN
  CDN_PROVIDER: z.enum(["none", "bunny", "cloudfront", "fastly"]).default("none"),
  CDN_BASE_URL: z.string().url().optional().or(z.literal("")),
  CDN_SIGNING_KEY: z.string().optional(),

  // Media Processing
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),
  FFPROBE_PATH: z.string().default("/usr/bin/ffprobe"),
  IMAGEMAGICK_PATH: z.string().default("/usr/bin/convert"),
  IDENTIFY_PATH: z.string().default("/usr/bin/identify"),
  DCRAW_PATH: z.string().default("/usr/bin/dcraw"),
  LIBREOFFICE_PATH: z.string().default("/usr/bin/libreoffice"),
  MEDIA_TEMP_DIR: z.string().default("/tmp/bush-processing"),
  THUMBNAIL_FORMAT: z.enum(["webp", "jpeg"]).default("webp"),
  THUMBNAIL_QUALITY: z.coerce.number().int().min(1).max(100).default(80),
  THUMBNAIL_POSITION: z.coerce.number().min(0).max(1).default(0.5),
  HLS_SEGMENT_DURATION: z.coerce.number().int().positive().default(6),
  PROXY_PRESET: z.string().default("medium"),

  // Worker Concurrency
  WORKER_THUMBNAIL_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_FILMSTRIP_CONCURRENCY: z.coerce.number().int().positive().default(2),
  WORKER_PROXY_CONCURRENCY: z.coerce.number().int().positive().default(2),
  WORKER_WAVEFORM_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_METADATA_CONCURRENCY: z.coerce.number().int().positive().default(8),

  // Email
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().email().default("noreply@bush.local"),
  SMTP_SECURE: z.coerce.boolean().default(false),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE: z.coerce.number().int().positive().default(604800),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  TRUST_PROXY: z.coerce.boolean().default(false),

  // Upload
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().int().positive().default(10737418240),
  UPLOAD_PRESIGNED_URL_EXPIRY: z.coerce.number().int().positive().default(3600),
  UPLOAD_MULTIPART_CHUNK_SIZE: z.coerce.number().int().positive().default(10485760),

  // Backup
  BACKUP_STORAGE_BUCKET: z.string().default("bush-backups"),
  LITESTREAM_ENABLED: z.coerce.boolean().default(false),

  // Next.js Public Variables (also available server-side)
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Bush"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Env {
  // During Next.js build phase, use relaxed validation if env vars aren't set
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" ||
    (process.env.NODE_ENV === "production" && !process.env.APP_URL);

  if (isBuildPhase) {
    // Return a partial config for build time - only needed for type checking
    // The actual runtime config will be validated on server start
    return {
      NODE_ENV: "production",
      PORT: 3001,
      HOST: "0.0.0.0",
      LOG_LEVEL: "info",
      APP_URL: "https://build.placeholder",
      API_URL: "https://build.placeholder",
      DATABASE_URL: ":memory:",
      DATABASE_WAL_MODE: false,
      DATABASE_BUSY_TIMEOUT: 5000,
      REDIS_URL: "redis://placeholder",
      REDIS_KEY_PREFIX: "bush:",
      WORKOS_API_KEY: "placeholder",
      WORKOS_CLIENT_ID: "placeholder",
      WORKOS_REDIRECT_URI: "https://build.placeholder/callback",
      NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://build.placeholder/callback",
      WORKOS_WEBHOOK_SECRET: "placeholder",
      WORKOS_COOKIE_PASSWORD: "placeholder-cookie-password-for-build-32c",
      STORAGE_PROVIDER: "minio",
      STORAGE_ENDPOINT: "placeholder",
      STORAGE_REGION: "us-east-1",
      STORAGE_ACCESS_KEY: "placeholder",
      STORAGE_SECRET_KEY: "placeholder",
      STORAGE_BUCKET: "placeholder",
      SESSION_SECRET: "placeholder-for-build-at-least-32-characters",
      SESSION_MAX_AGE: 604800,
      RATE_LIMIT_WINDOW_MS: 60000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      TRUST_PROXY: false,
      UPLOAD_MAX_FILE_SIZE: 5368709120,
      UPLOAD_PRESIGNED_URL_EXPIRY: 3600,
      UPLOAD_MULTIPART_CHUNK_SIZE: 10485760,
      BACKUP_STORAGE_BUCKET: "placeholder",
      LITESTREAM_ENABLED: false,
      NEXT_PUBLIC_APP_NAME: "Bush",
      // Media Processing
      FFMPEG_PATH: "/usr/bin/ffmpeg",
      FFPROBE_PATH: "/usr/bin/ffprobe",
      IMAGEMAGICK_PATH: "/usr/bin/convert",
      IDENTIFY_PATH: "/usr/bin/identify",
      DCRAW_PATH: "/usr/bin/dcraw",
      LIBREOFFICE_PATH: "/usr/bin/libreoffice",
      MEDIA_TEMP_DIR: "/tmp/bush-processing",
      THUMBNAIL_FORMAT: "webp",
      THUMBNAIL_QUALITY: 80,
      THUMBNAIL_POSITION: 0.5,
      HLS_SEGMENT_DURATION: 6,
      PROXY_PRESET: "medium",
      WORKER_THUMBNAIL_CONCURRENCY: 4,
      WORKER_FILMSTRIP_CONCURRENCY: 2,
      WORKER_PROXY_CONCURRENCY: 2,
      WORKER_WAVEFORM_CONCURRENCY: 4,
      WORKER_METADATA_CONCURRENCY: 8,
    } as Env;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ Invalid environment configuration:\n");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("\nPlease check your .env.local file against .env.example\n");
    process.exit(1);
  }

  return result.data;
}

/**
 * Scrub secrets from a message string
 */
export function scrubSecrets(message: string): string {
  let scrubbed = message;
  for (const key of SECRET_KEYS) {
    const value = process.env[key];
    if (value && value.length > 4) {
      // Use split/join for replacement to handle special regex characters
      scrubbed = scrubbed.split(value).join(`[REDACTED:${key}]`);
    }
  }
  return scrubbed;
}

/**
 * Type-safe configuration object
 * Validated at startup - app will not start with invalid config
 */
export const config = loadConfig();

/**
 * Check if we're in development mode
 */
export const isDev = config.NODE_ENV === "development";

/**
 * Check if we're in test mode
 */
export const isTest = config.NODE_ENV === "test";

/**
 * Check if we're in production mode
 */
export const isProd = config.NODE_ENV === "production";
