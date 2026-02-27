/**
 * Bush Platform - Test Seed Data
 *
 * Test data fixtures for E2E tests.
 * Reference: specs/15-frontend-testing.md
 */

/**
 * Test account configuration
 * Set these via environment variables in CI
 */
export const testAccount = {
  email: process.env.TEST_USER_EMAIL || "test@bush.io",
  name: process.env.TEST_USER_NAME || "Test User",
  password: process.env.TEST_USER_PASSWORD || "",
};

/**
 * Test workspace configuration
 */
export const testWorkspace = {
  name: process.env.TEST_WORKSPACE_NAME || "Test Workspace",
};

/**
 * Test project configuration
 */
export const testProject = {
  name: process.env.TEST_PROJECT_NAME || "Test Project",
};
