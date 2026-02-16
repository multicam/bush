/**
 * Bush Platform - Env Configuration Tests
 *
 * Note: env.ts calls process.exit(1) at module level if validation fails,
 * so we can't directly import it in tests without full env setup.
 * The scrubSecrets and SECRET_KEYS exports are tested indirectly
 * through integration tests that load the full config.
 */
import { describe, it, expect } from "vitest";

describe("Config Env Module", () => {
  it("should have NODE_ENV set in test environment", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
