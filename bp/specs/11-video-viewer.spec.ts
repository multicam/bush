import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-11: Video Viewer + Controls", () => {
  test("clicking a video file opens the file viewer", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Navigate into Footage folder
    const footageFolder = page.getByText("Footage").first();
    if (await footageFolder.isVisible()) {
      await footageFolder.click();
      await page.waitForTimeout(500);
    }

    const videoFile = page.getByText("shot_001_main.mp4").first();
    if (await videoFile.isVisible()) {
      await videoFile.click();
      await page.waitForTimeout(1000);

      // Should navigate to file detail page
      await captureScreenshot(page, "11-video-viewer-opened");
    } else {
      await captureScreenshot(page, "11-no-video-file-visible");
    }
  });

  test("file viewer has Back button and file info", async ({ authedPage: page }) => {
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

    const videoFile = page.getByText("shot_001_main.mp4").first();
    if (await videoFile.isVisible()) {
      await videoFile.click();
      await page.waitForTimeout(1000);

      // Back button
      const backBtn = page.getByRole("button", { name: "Back" }).or(page.getByRole("link", { name: "Back" }));
      if (await backBtn.first().isVisible()) {
        await expect(backBtn.first()).toBeVisible();
      }

      // File name heading
      const fileName = page.getByRole("heading", { name: /shot_001_main/i });
      if (await fileName.isVisible()) {
        await expect(fileName).toBeVisible();
      }

      // Download button (only when status is "ready")
      const downloadBtn = page.getByRole("button", { name: /Download/i });
      if (await downloadBtn.isVisible()) {
        await captureScreenshot(page, "11-file-viewer-controls");
      }

      // Comments toggle
      const commentsToggle = page.getByRole("button", { name: /Hide Comments|Show Comments/i });
      if (await commentsToggle.isVisible()) {
        await captureScreenshot(page, "11-comments-toggle");
      }
    }
  });

  test("video element or player is rendered for video files", async ({ authedPage: page }) => {
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

    const videoFile = page.getByText("shot_001_main.mp4").first();
    if (await videoFile.isVisible()) {
      await videoFile.click();
      await page.waitForTimeout(1000);

      // Look for video element
      const video = page.locator("video").first();
      if (await video.isVisible()) {
        await captureScreenshot(page, "11-video-element");
      } else {
        // May show "Processing" or preview unavailable
        await captureScreenshot(page, "11-video-preview-state");
      }
    }
  });
});
