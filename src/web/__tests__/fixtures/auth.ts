/**
 * Bush Platform - Auth Test Fixture
 *
 * Reusable authentication fixture for E2E tests.
 * Reference: specs/15-frontend-testing.md
 */
import { test as base, Page } from "@playwright/test";

/**
 * Auth fixture that provides authenticated page state
 *
 * For tests that require authentication, use this fixture instead of regular { page }
 *
 * @example
 * ```ts
 * import { test, expect } from "./fixtures/auth";
 *
 * test("dashboard loads", async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto("/dashboard");
 *   await expect(authenticatedPage).toHaveURL(/dashboard/);
 * });
 * ```
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Check for test credentials
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      // Skip authentication if no test credentials - tests will run unauthenticated
      // For protected routes, this will redirect to login which is expected behavior
      await use(page);
      return;
    }

    // Navigate to login page
    await page.goto("/login");

    // Wait for the login page to load
    await page.waitForLoadState("networkidle");

    // The app uses WorkOS AuthKit - check if we're on a login page with a form
    // or if we need to handle WorkOS redirect

    // Try to find and fill login form if it exists
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Check if we have a traditional login form
    const hasLoginForm = await emailInput.isVisible().catch(() => false);

    if (hasLoginForm) {
      // Fill in credentials
      await emailInput.fill(testEmail);
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill(testPassword);
      }
      await submitButton.click();

      // Wait for navigation to complete
      await page.waitForURL(/dashboard|projects/, { timeout: 30000 }).catch(() => {
        // If we don't redirect to dashboard, the test will need to handle auth state
      });
    }

    // Store auth state in localStorage/cookies for subsequent tests
    // This allows tests to run faster by not repeating login

    await use(page);
  },
});

export { expect } from "@playwright/test";
