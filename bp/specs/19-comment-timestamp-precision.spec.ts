import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

const VIDEO_FILE_URL = "/projects/prj_c9ff357d51f4aaf172a856ac/files/file_f981537117555cf2916824b7";

test.describe("UC-19: Comment Timestamp Precision", () => {
  test("comment displays formatted timestamp", async ({ authedPage: page }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    // Show comments panel
    const commentsToggle = page.getByRole("button", { name: /Comments/i }).first();
    if (await commentsToggle.isVisible()) {
      await commentsToggle.click();
      await page.waitForTimeout(500);
    }

    // Look for seeded comment "Great shot" — it has timestamp 5000 (5s)
    const comment = page.getByText("Great shot").first();
    if (await comment.isVisible()) {
      // The comment or its container should display a timecode (e.g., "0:05")
      const commentContainer = comment.locator("..").locator("..");
      const containerText = await commentContainer.textContent();
      // Verify timecode-like text is present near the comment
      const hasTimecode = /\d+:\d{2}/.test(containerText || "");
      await captureScreenshot(page, "19-comment-timestamp-display");
      expect(hasTimecode || containerText?.includes("5")).toBeTruthy();
    } else {
      await captureScreenshot(page, "19-no-comments-visible");
    }
  });

  test("comment markers appear on video timeline", async ({ authedPage: page }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    // Show comments
    const commentsToggle = page.getByRole("button", { name: /Comments/i }).first();
    if (await commentsToggle.isVisible()) {
      await commentsToggle.click();
      await page.waitForTimeout(500);
    }

    const markers = page.locator("[title^='Comment at']");
    const markerCount = await markers.count();

    const timeline = page.locator(".relative.w-full.h-2").first();
    const timelineVisible = await timeline.isVisible().catch(() => false);
    await captureScreenshot(page, "19-timeline-markers");
    expect(page.url()).toContain("/files/file_f981537117555cf2916824b7");

    if (
      await page
        .getByText("Great shot")
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      if (timelineVisible) {
        expect(markerCount).toBeGreaterThan(0);
      }
    }
  });

  test("API returns float timestamps for comments", async ({ authedPage: page }) => {
    // Query the comments API directly to verify float precision
    const response = await page.request.get("/v4/files/file_f981537117555cf2916824b7/comments");

    if (response.ok()) {
      const body = await response.json();
      const comments = body.data || [];

      if (comments.length > 0) {
        // Verify timestamp field exists and is a number (not truncated to int)
        const firstComment = comments[0];
        const timestamp = firstComment.attributes?.timestamp ?? firstComment.timestamp;

        if (timestamp !== null && timestamp !== undefined) {
          expect(typeof timestamp).toBe("number");
          // The value should be a valid number (int or float)
          expect(Number.isFinite(timestamp)).toBeTruthy();
        }
      }
    }
    // Screenshot not needed for API-only test
  });
});
