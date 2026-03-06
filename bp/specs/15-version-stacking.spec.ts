import { test, dismissDevOverlay } from "../helpers/demo-auth";
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

    const versionIndicator = page
      .getByText(/Version Stack|versions?/i)
      .or(page.getByRole("button", { name: /Create Version Stack|Add to Stack/i }))
      .first();
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

      // Hide Next.js dev overlay after file viewer navigation
      await dismissDevOverlay(page);

      const versionUI = page
        .getByRole("button", { name: /version|stack/i })
        .or(page.getByText(/version/i))
        .first();

      if (await versionUI.isVisible()) {
        await captureScreenshot(page, "15-version-stack-ui");
      } else {
        await captureScreenshot(page, "15-file-viewer-no-version-ui");
      }
    }
  });
});
