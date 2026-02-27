/**
 * Bush Platform - Authentication E2E Tests
 *
 * Tests for authentication flows including login, logout, and protected routes.
 * Reference: specs/15-frontend-testing.md - Authentication Tests
 */
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Protected Routes", () => {
    test("unauthenticated user is redirected to login from dashboard", async ({ page }) => {
      await page.goto("/dashboard");

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("unauthenticated user is redirected to login from projects", async ({ page }) => {
      await page.goto("/projects");

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("unauthenticated user is redirected to login from notifications", async ({ page }) => {
      await page.goto("/notifications");

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("unauthenticated user is redirected to login from settings", async ({ page }) => {
      await page.goto("/settings");

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Login Page", () => {
    test("login page renders correctly", async ({ page }) => {
      await page.goto("/login");

      // Check for login page elements
      await expect(page.locator("h1, h2").first()).toBeVisible();

      // Should have a login button or form
      const loginButton = page.locator('button:has-text("Sign"), button:has-text("Log"), a:has-text("Sign")');
      await expect(loginButton.first()).toBeVisible();
    });

    test("login page has proper meta tags", async ({ page }) => {
      await page.goto("/login");

      // Check page title
      await expect(page).toHaveTitle(/Bush|Login/i);
    });
  });

  test.describe("Signup Page", () => {
    test("signup page renders correctly", async ({ page }) => {
      await page.goto("/signup");

      // Check for signup page elements
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });
  });

  test.describe("Home Page", () => {
    test("home page is accessible without authentication", async ({ page }) => {
      await page.goto("/");

      // Home page should load
      await expect(page).toHaveURL("/");
    });

    test("home page has call to action for login/signup", async ({ page }) => {
      await page.goto("/");

      // Should have some CTA for authentication
      const cta = page.locator('a:has-text("Sign"), button:has-text("Sign"), a:has-text("Log"), a:has-text("Get Started")');
      await expect(cta.first()).toBeVisible();
    });
  });
});
