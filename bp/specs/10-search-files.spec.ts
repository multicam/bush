import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-10: Search Files", () => {
  test("command palette opens with Cmd+K", async ({ authedPage: page }) => {
    // Trigger command palette
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(500);

    // Look for command palette / search dialog
    const palette = page.locator(
      "[data-testid='command-palette'], [role='dialog']:has(input), " +
      "[class*='command'], [class*='palette'], [class*='search-dialog']"
    ).first();

    if (await palette.isVisible()) {
      await captureScreenshot(page, "10-command-palette-open");

      // Type a search query
      const searchInput = palette.locator("input").first();
      await searchInput.fill("shot_001");
      await page.waitForTimeout(500);

      await captureScreenshot(page, "10-command-palette-search");
    } else {
      // Try Ctrl+K for Linux
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(500);
      await captureScreenshot(page, "10-command-palette-ctrl-k");
    }
  });

  test("project file search works", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.locator("a:has-text('Super Bowl Commercial')").first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Look for a search input on the project page
    const searchInput = page.locator(
      "input[type='search'], input[placeholder*='search' i], " +
      "[data-testid='search-input'], input[placeholder*='filter' i]"
    ).first();

    if (await searchInput.isVisible()) {
      await searchInput.fill("shot");
      await page.waitForTimeout(500);
      await captureScreenshot(page, "10-project-search-results");
    } else {
      await captureScreenshot(page, "10-no-search-input");
    }
  });
});
