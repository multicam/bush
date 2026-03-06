import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "media");

test.describe("UC-08: Upload Mixed Media", () => {
  test("can upload multiple file types at once", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Hide Next.js dev overlay after navigation
    await dismissDevOverlay(page);

    // Show dropzone
    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    await uploadBtn.click();
    await page.waitForTimeout(500);

    // Skip the webkitdirectory input used for folder uploads
    const fileInput = page.locator("input[type='file']:not([webkitdirectory])").first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles([
        path.join(FIXTURES_DIR, "sample-video.mp4"),
        path.join(FIXTURES_DIR, "sample-image.jpg"),
        path.join(FIXTURES_DIR, "sample-audio.mp3"),
        path.join(FIXTURES_DIR, "sample-document.pdf"),
      ]);
      await page.waitForTimeout(1500);
      await captureScreenshot(page, "08-mixed-upload-started");
    } else {
      await captureScreenshot(page, "08-no-file-input");
    }
  });

  test("project shows different file types with appropriate icons", async ({
    authedPage: page,
  }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Navigate into folders to see different file types
    const footageFolder = page.locator("main").getByText("Footage").first();
    if (await footageFolder.isVisible()) {
      await footageFolder.click({ force: true });
      await page.waitForTimeout(500);
    }

    // Should see video files with file type indicators
    await captureScreenshot(page, "08-file-type-icons");
  });
});
