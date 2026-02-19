/**
 * Vitest Global Setup
 *
 * Sets up environment variables for tests that need them.
 * This file runs before any test files.
 */
import { vi } from "vitest";

// Mock bun:sqlite for vitest/node environment
vi.mock("bun:sqlite", () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 0 })),
    })),
    exec: vi.fn(),
    close: vi.fn(),
  };
  return {
    default: mockDb,
    Database: vi.fn(() => mockDb),
  };
});

// Set test environment variables
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("APP_URL", "https://test.local");
vi.stubEnv("API_URL", "https://api.test.local");
vi.stubEnv("DATABASE_URL", ":memory:");
vi.stubEnv("REDIS_URL", "redis://localhost:6379");
vi.stubEnv("WORKOS_API_KEY", "test-key");
vi.stubEnv("WORKOS_CLIENT_ID", "test-client-id");
vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", "https://test.local/callback");
vi.stubEnv("WORKOS_WEBHOOK_SECRET", "test-webhook-secret");
vi.stubEnv("STORAGE_ENDPOINT", "http://localhost:9000");
vi.stubEnv("STORAGE_ACCESS_KEY", "test-access-key");
vi.stubEnv("STORAGE_SECRET_KEY", "test-secret-key");
vi.stubEnv("STORAGE_BUCKET", "test-bucket");
vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-32-characters");
