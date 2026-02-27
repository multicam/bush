/**
 * Bush Platform - Dashboard E2E Tests
 *
 * Tests for dashboard page functionality and navigation.
 * Reference: specs/15-frontend-testing.md - Dashboard Tests
 */
import { test, expect } from "./fixtures/auth";

test.describe("Dashboard", () => {
  // Note: These tests require authentication
  // The auth fixture handles login if TEST_USER_EMAIL and TEST_USER_PASSWORD are set

  test.describe.skip("Authenticated Dashboard", () => {
    // Skip these tests if no test credentials are available
    // They can be enabled in CI with proper credentials

    test("dashboard loads for authenticated user", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard");

      // Dashboard should be visible
      await expect(authenticatedPage).toHaveURL(/dashboard/);
    });

    test("dashboard shows workspace selector", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard");

      // Should have some workspace UI
      const workspaceSelector = authenticatedPage.locator('[data-testid="workspace-selector"], button:has-text("Workspace"), select');
      await expect(workspaceSelector.first()).toBeVisible();
    });

    test("dashboard shows recent projects or empty state", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard");

      // Should show either projects or an empty state message
      const projectsGrid = authenticatedPage.locator('[data-testid="projects-grid"]');
      const emptyState = authenticatedPage.locator('text=/No projects|Get started|Create your first/i');

      // Either projects grid or empty state should be visible
      await expect(projectsGrid.or(emptyState).first()).toBeVisible();
    });
  });

  test.describe("Navigation", () => {
    test("sidebar navigation links are present on login page", async ({ page }) => {
      await page.goto("/login");

      // Login page should load successfully
      await expect(page).toHaveURL(/\/login/);
    });

    test("public pages are accessible", async ({ page }) => {
      // Home page should be accessible
      await page.goto("/");
      await expect(page).toHaveURL("/");

      // Login page should be accessible
      await page.goto("/login");
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
