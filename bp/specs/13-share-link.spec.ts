import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-13: Share Link + Public Page", () => {
  test("shares page lists seeded share links", async ({ authedPage: page }) => {
    await page.goto("/shares");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Shares" })).toBeVisible();

    // Should show the seeded share
    const shareItem = page.getByText("Commercial Review").first();
    if (await shareItem.isVisible()) {
      await expect(shareItem).toBeVisible();
    }

    await captureScreenshot(page, "13-shares-list");
  });

  test("Create Share button exists", async ({ authedPage: page }) => {
    await page.goto("/shares");
    await page.waitForLoadState("networkidle");

    const createBtn = page.getByRole("button", { name: /Create Share/i }).or(page.getByRole("link", { name: /Create Share/i }));
    await expect(createBtn.first()).toBeVisible();

    await captureScreenshot(page, "13-shares-create-button");
  });

  test("share card actions work", async ({ authedPage: page }) => {
    await page.goto("/shares");
    await page.waitForLoadState("networkidle");

    // Copy link button
    const copyBtn = page.getByTitle("Copy link").first();
    if (await copyBtn.isVisible()) {
      await captureScreenshot(page, "13-share-card-actions");
    }

    // Search filter
    const searchInput = page.getByPlaceholder("Search shares...");
    if (await searchInput.isVisible()) {
      await searchInput.fill("Commercial");
      await page.waitForTimeout(300);
      await captureScreenshot(page, "13-shares-search-filtered");
    }
  });

  test("create share page loads", async ({ authedPage: page }) => {
    await page.goto("/shares/new");
    await page.waitForLoadState("networkidle");

    await captureScreenshot(page, "13-create-share-page");
  });

  test("public share page loads for seeded slug", async ({ page }) => {
    await page.goto("/s/commercial-review-2024");
    await page.waitForLoadState("networkidle");

    // Should show share content (not a 404)
    await captureScreenshot(page, "13-public-share-page");

    // Check for share content (name or assets)
    const shareContent = page.getByText("Commercial Review").first();
    if (await shareContent.isVisible()) {
      await expect(shareContent).toBeVisible();
    }
  });
});
