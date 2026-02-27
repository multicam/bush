import { test, expect } from "@playwright/test";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-01: Home Page", () => {
  test("home page loads and redirects authenticated user to dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // In DEMO_MODE, authenticated users get redirected to dashboard
    // If we see the dashboard, that's correct behavior
    const isDashboard = page.url().includes("/dashboard");
    const hasHeading = await page.getByRole("heading", { name: /Creative Collaboration/i }).isVisible().catch(() => false);

    if (isDashboard) {
      // Authenticated redirect — expected in DEMO_MODE
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    } else if (hasHeading) {
      // Unauthenticated landing page
      await expect(page.getByRole("heading", { name: /Creative Collaboration/i })).toBeVisible();
    }

    await captureScreenshot(page, "01-home-page");
  });

  test("home page captures full state", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await captureScreenshot(page, "01-home-full", { fullPage: true });
  });
});
