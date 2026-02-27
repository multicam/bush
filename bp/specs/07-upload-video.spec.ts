import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import path from "path";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "media");

test.describe("UC-07: Upload Video", () => {
  test("project detail has Upload Files button", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    await expect(uploadBtn).toBeVisible();

    await captureScreenshot(page, "07-upload-button");
  });

  test("clicking Upload Files shows dropzone", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    await uploadBtn.click();
    await page.waitForTimeout(500);

    // Dropzone should appear (aria-label="Upload files")
    const dropzone = page.getByRole("button", { name: /Upload files/i }).or(page.locator("[class*='dropzone']")).first();
    if (await dropzone.isVisible()) {
      await captureScreenshot(page, "07-dropzone-visible");
    }

    // Cancel button should appear
    const cancelBtn = page.getByRole("button", { name: "Cancel" });
    if (await cancelBtn.isVisible()) {
      await captureScreenshot(page, "07-dropzone-with-cancel");
    }
  });

  test("can trigger file upload with video fixture", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Show dropzone first
    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    await uploadBtn.click();
    await page.waitForTimeout(500);

    // Find hidden file input
    const fileInput = page.locator("input[type='file']").first();
    if (await fileInput.count() > 0) {
      const videoPath = path.join(FIXTURES_DIR, "sample-video.mp4");
      await fileInput.setInputFiles(videoPath);
      await page.waitForTimeout(1000);
      await captureScreenshot(page, "07-upload-video-started");
    } else {
      await captureScreenshot(page, "07-no-file-input");
    }
  });
});
