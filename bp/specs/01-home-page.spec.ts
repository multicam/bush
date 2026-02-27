import { test, expect } from "@playwright/test";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-01: Home Page", () => {
  test("renders landing page with hero and CTAs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have the hero heading
    const heading = page.getByRole("heading", { name: /Creative Collaboration/i });
    await expect(heading).toBeVisible();

    // Should have Sign In and Get Started CTAs
    await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Started" }).or(page.getByRole("link", { name: "Get Started" })).first()).toBeVisible();

    await captureScreenshot(page, "01-home-page");
  });

  test("features section is visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should show features section
    const featuresHeading = page.getByRole("heading", { name: /Everything you need/i });
    await expect(featuresHeading).toBeVisible();

    // Feature cards
    await expect(page.getByRole("heading", { name: "Video Review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Asset Management" })).toBeVisible();

    await captureScreenshot(page, "01-home-features", { fullPage: true });
  });

  test("Sign In navigates to login flow", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click Sign In button in hero
    const signInBtn = page.getByRole("button", { name: "Sign In" }).or(page.getByRole("link", { name: "Sign In" })).first();
    await signInBtn.click();

    // In DEMO_MODE, should redirect to dashboard
    await page.waitForURL(/\/(dashboard|login)/);

    await captureScreenshot(page, "01-home-after-signin");
  });
});
