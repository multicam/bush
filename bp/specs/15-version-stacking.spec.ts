import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-15: Version Stacking", () => {
  test("file with version stack shows version indicator", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Navigate to Footage folder where the versioned file lives
    const footageFolder = page.getByText("Footage").first();
    if (await footageFolder.isVisible()) {
      await footageFolder.click();
      await page.waitForTimeout(500);
    }

    // Look for version indicators on file cards/rows
    const versionIndicator = page.locator("[class*='version'], [title*='version' i]").first();
    if (await versionIndicator.isVisible()) {
      await captureScreenshot(page, "15-version-indicator-visible");
    } else {
      await captureScreenshot(page, "15-file-list-no-version-indicator");
    }
  });

  test("file viewer shows version info for stacked file", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    const footageFolder = page.getByText("Footage").first();
    if (await footageFolder.isVisible()) {
      await footageFolder.click();
      await page.waitForTimeout(500);
    }

    // Click on the versioned file
    const videoFile = page.getByText("shot_001_main.mp4").first();
    if (await videoFile.isVisible()) {
      await videoFile.click();
      await page.waitForTimeout(1000);

      // Look for version selector or version info in the viewer
      const versionUI = page.locator(
        "[class*='version'], select:has(option), " +
        "button:has-text('Version'), text=version"
      ).first();

      if (await versionUI.isVisible()) {
        await captureScreenshot(page, "15-version-stack-ui");
      } else {
        await captureScreenshot(page, "15-file-viewer-no-version-ui");
      }
    }
  });
});
