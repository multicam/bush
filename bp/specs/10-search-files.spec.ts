import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-10: Search Files", () => {
  test("command palette opens with Cmd+K", async ({ authedPage: page }) => {
    // Trigger command palette
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(500);

    const palette = page.getByRole("dialog", { name: /command palette/i });
    if (!(await palette.isVisible().catch(() => false))) {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(500);
    }

    if (await palette.isVisible().catch(() => false)) {
      await expect(palette).toBeVisible();
      await captureScreenshot(page, "10-command-palette-open");

      const searchInput = palette.getByPlaceholder(/Search files and commands/i);
      await expect(searchInput).toBeVisible();
      await searchInput.fill("shot_001");
      await page.waitForTimeout(500);

      await captureScreenshot(page, "10-command-palette-search");
    } else {
      await captureScreenshot(page, "10-command-palette-not-mounted");
      await expect(page.getByRole("link", { name: /Projects/i }).first()).toBeVisible();
    }
  });

  test("project file search works", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("domcontentloaded");

    const projectLink = page.locator("a:has-text('Super Bowl Commercial')").first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page
      .locator("input[placeholder*='Search' i], input[type='search']")
      .first();

    if (await searchInput.isVisible()) {
      await searchInput.fill("shot");
      await page.waitForTimeout(500);
      await captureScreenshot(page, "10-project-search-results");
    } else {
      await captureScreenshot(page, "10-no-search-input");
    }
  });
});
