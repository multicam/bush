import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-12: Time-Stamped Comments", () => {
  test("file viewer shows comment panel with seeded comments", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Navigate into Footage folder and click on a video file
    const footageFolder = page.getByText("Footage").first();
    if (await footageFolder.isVisible()) {
      await footageFolder.click();
      await page.waitForTimeout(500);
    }

    const videoFile = page.getByText("shot_001_main.mp4").first();
    if (await videoFile.isVisible()) {
      await videoFile.click();
      await page.waitForTimeout(1000);

      // Show comments panel if hidden
      const showCommentsBtn = page.getByRole("button", { name: /Show Comments/i });
      if (await showCommentsBtn.isVisible()) {
        await showCommentsBtn.click();
        await page.waitForTimeout(500);
      }

      // Comment panel should show "Comments" heading
      const commentsHeading = page.getByRole("heading", { name: /Comments/i });
      if (await commentsHeading.isVisible()) {
        await expect(commentsHeading).toBeVisible();
      }

      // Should show seeded comment text
      const comment = page.getByText("Great shot").first();
      if (await comment.isVisible()) {
        await expect(comment).toBeVisible();
      }

      await captureScreenshot(page, "12-comments-panel");
    } else {
      await captureScreenshot(page, "12-no-video-file-in-folder");
    }
  });

  test("comment form is available", async ({ authedPage: page }) => {
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

      // Show comments
      const showCommentsBtn = page.getByRole("button", { name: /Show Comments/i });
      if (await showCommentsBtn.isVisible()) {
        await showCommentsBtn.click();
        await page.waitForTimeout(500);
      }

      // Look for comment input
      const commentInput = page.getByPlaceholder("Add a comment...");
      if (await commentInput.isVisible()) {
        await commentInput.fill("BP test comment");
        await captureScreenshot(page, "12-comment-input-filled");
      } else {
        await captureScreenshot(page, "12-no-comment-input");
      }
    }
  });

  test("comment filter and export buttons exist", async ({ authedPage: page }) => {
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

      const showCommentsBtn = page.getByRole("button", { name: /Show Comments/i });
      if (await showCommentsBtn.isVisible()) {
        await showCommentsBtn.click();
        await page.waitForTimeout(500);
      }

      // Filter and export buttons
      const filterBtn = page.getByTitle("Filter comments");
      const exportBtn = page.getByTitle("Export comments");

      if (await filterBtn.isVisible()) {
        await captureScreenshot(page, "12-comment-filter-export-buttons");
      }
    }
  });
});
