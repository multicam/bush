/**
 * Bush Platform - Env Configuration Tests
 *
 * Note: env.ts calls process.exit(1) at module level if validation fails,
 * so we can't directly import it in tests without full env setup.
 * The scrubSecrets and SECRET_KEYS exports are tested indirectly
 * through integration tests that load the full config.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Config Env Module", () => {
  it("should have NODE_ENV set in test environment", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  describe("scrubSecrets", () => {
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      // Save original values
      originalEnv.SESSION_SECRET = process.env.SESSION_SECRET;
      originalEnv.WORKOS_COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD;
    });

    afterEach(() => {
      // Restore original values
      if (originalEnv.SESSION_SECRET !== undefined) {
        process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
      } else {
        delete process.env.SESSION_SECRET;
      }
      if (originalEnv.WORKOS_COOKIE_PASSWORD !== undefined) {
        process.env.WORKOS_COOKIE_PASSWORD = originalEnv.WORKOS_COOKIE_PASSWORD;
      } else {
        delete process.env.WORKOS_COOKIE_PASSWORD;
      }
    });

    it("should scrub secrets from message", async () => {
      // Set a test secret
      process.env.SESSION_SECRET = "my-super-secret-key-12345";

      // Import after setting env
      const { scrubSecrets } = await import("./env.js");

      const message = "Error with key my-super-secret-key-12345 in log";
      const scrubbed = scrubSecrets(message);

      expect(scrubbed).not.toContain("my-super-secret-key-12345");
      expect(scrubbed).toContain("[REDACTED:SESSION_SECRET]");
    });

    it("should handle short secrets (less than 4 chars)", async () => {
      process.env.SESSION_SECRET = "abc";

      const { scrubSecrets } = await import("./env.js");

      const message = "Error with key abc in log";
      const scrubbed = scrubSecrets(message);

      // Short secrets should not be scrubbed
      expect(scrubbed).toBe(message);
    });

    it("should handle message without secrets", async () => {
      process.env.SESSION_SECRET = "my-super-secret-key-12345";

      const { scrubSecrets } = await import("./env.js");

      const message = "This is a normal log message";
      const scrubbed = scrubSecrets(message);

      expect(scrubbed).toBe(message);
    });

    it("should handle empty message", async () => {
      process.env.SESSION_SECRET = "my-super-secret-key-12345";

      const { scrubSecrets } = await import("./env.js");

      const scrubbed = scrubSecrets("");

      expect(scrubbed).toBe("");
    });

    it("should handle undefined secret value", async () => {
      delete process.env.SESSION_SECRET;

      const { scrubSecrets } = await import("./env.js");

      const message = "This is a normal log message";
      const scrubbed = scrubSecrets(message);

      expect(scrubbed).toBe(message);
    });
  });
});
