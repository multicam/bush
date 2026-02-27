/**
 * Test Constants
 *
 * Centralized constants for tests to avoid hardcoded values and improve maintainability.
 * These values are used across test files to ensure consistency and ease of updates.
 */

/**
 * Network endpoints for testing
 */
export const TEST_ENDPOINTS = {
  /** Local Redis server URL */
  REDIS_URL: "redis://localhost:6379",

  /** Local S3-compatible storage endpoint (MinIO) */
  S3_ENDPOINT: "http://localhost:9000",

  /** Local API server base URL */
  API_BASE_URL: "http://localhost:3000",

  /** Local Faster Whisper transcription service */
  FASTER_WHISPER_URL: "http://localhost:8000",
} as const;

/**
 * Redis connection options for testing
 */
export const TEST_REDIS_OPTIONS = {
  host: "localhost",
  port: 6379,
} as const;

/**
 * S3 storage options for testing
 */
export const TEST_STORAGE_OPTIONS = {
  endpoint: TEST_ENDPOINTS.S3_ENDPOINT,
  accessKey: "test-access-key",
  secretKey: "test-secret-key",
  bucket: "test-bucket",
  region: "us-east-1",
} as const;

/**
 * Test user IDs (use generateId() for new tests, these are for consistency)
 */
export const TEST_IDS = {
  USER_1: "user_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  USER_2: "user_01ARZ3NDEKTSV4RRFFQ69G5FAW",
  PROJECT_1: "proj_01ARZ3NDEKTSV4RRFFQ69G5FAX",
  FILE_1: "file_01ARZ3NDEKTSV4RRFFQ69G5FAY",
  FOLDER_1: "folder_01ARZ3NDEKTSV4RRFFQ69G5FAZ",
  WORKSPACE_1: "ws_01ARZ3NDEKTSV4RRFFQ69G5FB0",
} as const;

/**
 * Common timeout values for tests (in milliseconds)
 */
export const TEST_TIMEOUTS = {
  /** Short timeout for fast operations */
  SHORT: 100,

  /** Standard timeout for most async operations */
  STANDARD: 1000,

  /** Long timeout for slow operations (e.g., file processing) */
  LONG: 5000,

  /** Maximum timeout for very slow operations */
  MAX: 10000,
} as const;

/**
 * File size constants for testing (in bytes)
 */
export const TEST_FILE_SIZES = {
  /** 1 KB */
  KB_1: 1024,

  /** 1 MB */
  MB_1: 1024 * 1024,

  /** 10 MB */
  MB_10: 10 * 1024 * 1024,

  /** 100 MB */
  MB_100: 100 * 1024 * 1024,
} as const;

/**
 * Response body type for API test responses
 *
 * Use this instead of `as any` for response bodies:
 * ```ts
 * const body = (await res.json()) as TestResponseBody;
 * ```
 */
export interface TestResponseBody {
  data?: unknown;
  errors?: Array<{ code: string; detail: string; source?: { pointer: string } }>;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
  };
}

/**
 * Helper to extract response body with proper typing
 */
export async function getResponseBody(
  res: Response
): Promise<TestResponseBody> {
  return (await res.json()) as TestResponseBody;
}

/**
 * Helper to extract error response body
 */
export async function getErrorBody(
  res: Response
): Promise<{ errors: Array<{ code: string; detail: string }> }> {
  return (await res.json()) as { errors: Array<{ code: string; detail: string }> };
}
