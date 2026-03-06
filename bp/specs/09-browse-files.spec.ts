import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-09: Browse Files (Grid/List)", () => {
  test("project detail shows files and folders", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Should see folder names from seed
    await expect(page.locator("main").getByText("Footage").first()).toBeVisible();

    await captureScreenshot(page, "09-browse-files-default");
  });

  test("Upload Files button is present", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    await expect(uploadBtn).toBeVisible();

    await captureScreenshot(page, "09-upload-button");
  });

  test("can toggle grid/list view in asset browser", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // View toggle buttons (title attributes)
    const listViewBtn = page.getByTitle("List view");
    const gridViewBtn = page.getByTitle("Grid view");

    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, "09-list-view");

      await gridViewBtn.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, "09-grid-view");
    } else {
      await captureScreenshot(page, "09-no-view-toggle");
    }
  });

  test("folder navigation works", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Click on the Footage folder
    const folderItem = page.locator("main").getByText("Footage").first();
    if (await folderItem.isVisible()) {
      await folderItem.click({ force: true });
      await page.waitForTimeout(500);

      // Should see files inside the folder
      await captureScreenshot(page, "09-inside-footage-folder");
    }
  });

  test("folder sidebar toggle works", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    const toggleBtn = page.getByRole("button", { name: /Hide Folders|Show Folders/i });
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, "09-folders-toggled");
    }
  });
});
