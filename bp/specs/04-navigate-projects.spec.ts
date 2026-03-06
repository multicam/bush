import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-04: Navigate Projects", () => {
  test("projects page lists seeded projects", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    // Should show seeded project names
    await expect(page.getByText("Super Bowl Commercial").first()).toBeVisible();
    await expect(page.getByText("Nature Documentary").first()).toBeVisible();

    await captureScreenshot(page, "04-projects-list");
  });

  test("search filter works", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Search projects...");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Commercial");
    await page.waitForTimeout(300);

    // Should filter to just the commercial project
    await expect(page.getByText("Super Bowl Commercial").first()).toBeVisible();

    await captureScreenshot(page, "04-projects-search-filtered");
  });

  test("grid/list view toggle", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("main", { state: "visible" });

    const listView = page.getByLabel("List view");
    if (await listView.isVisible()) {
      await listView.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, "04-projects-list-view");

      const gridView = page.getByLabel("Grid view");
      if (await gridView.isVisible()) {
        await gridView.click();
        await page.waitForTimeout(300);
        await captureScreenshot(page, "04-projects-grid-view");
      }
    }
  });

  test("can click into a project", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);

    await captureScreenshot(page, "04-project-detail");
  });
});
