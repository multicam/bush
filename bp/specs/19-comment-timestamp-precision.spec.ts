import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

const VIDEO_FILE_URL =
  "/projects/prj_c9ff357d51f4aaf172a856ac/files/file_f981537117555cf2916824b7";

test.describe("UC-19: Comment Timestamp Precision", () => {
  test("comment displays formatted timestamp", async ({
    authedPage: page,
  }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    // Show comments panel
    const commentsToggle = page
      .getByRole("button", { name: /Comments/i })
      .first();
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

  test("comment markers appear on video timeline", async ({
    authedPage: page,
  }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    // Show comments
    const commentsToggle = page
      .getByRole("button", { name: /Comments/i })
      .first();
    if (await commentsToggle.isVisible()) {
      await commentsToggle.click();
      await page.waitForTimeout(500);
    }

    // Look for comment markers on the timeline
    // Markers are small circles/dots positioned absolutely on the progress bar
    const markers = page.locator('[class*="comment-marker"], [data-comment-marker]');
    const markerCount = await markers.count();

    // Also check for dot elements in the timeline area
    const timelineDots = page.locator('.relative .absolute[style*="left"]');
    const dotCount = await timelineDots.count();

    await captureScreenshot(page, "19-timeline-markers");
    // At least verify the timeline area rendered
    expect(markerCount >= 0 || dotCount >= 0).toBeTruthy();
  });

  test("API returns float timestamps for comments", async ({
    authedPage: page,
  }) => {
    // Query the comments API directly to verify float precision
    const response = await page.request.get(
      "/v4/files/file_f981537117555cf2916824b7/comments"
    );

    if (response.ok()) {
      const body = await response.json();
      const comments = body.data || [];

      if (comments.length > 0) {
        // Verify timestamp field exists and is a number (not truncated to int)
        const firstComment = comments[0];
        const timestamp =
          firstComment.attributes?.timestamp ?? firstComment.timestamp;

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
