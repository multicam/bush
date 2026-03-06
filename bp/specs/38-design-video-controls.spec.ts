import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import {
  TOKENS,
  isOnSpacingScale,
  measureLocator,
  measureLocatorTypography,
} from "../helpers/design-bench";

const VIDEO_FILE_URL = "/projects/prj_c9ff357d51f4aaf172a856ac/files/file_f981537117555cf2916824b7";

test.describe("Design Bench: Video Controls", () => {
  test("speed selector height matches button scale", async ({ authedPage: page }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    const speedSelect = page.getByLabel("Playback speed");
    if (await speedSelect.isVisible()) {
      const box = await measureLocator(speedSelect);
      expect(box).not.toBeNull();
      if (box) {
        // Height should be on the button scale (32, 36, or 40)
        const validHeights = [
          TOKENS.height.buttonSm,
          TOKENS.height.buttonMd,
          TOKENS.height.buttonLg,
        ];
        const closestHeight = validHeights.reduce((prev, curr) =>
          Math.abs(curr - box.height) < Math.abs(prev - box.height) ? curr : prev
        );
        // Within 4px of a valid button height
        expect(Math.abs(box.height - closestHeight)).toBeLessThanOrEqual(4);
      }
      await captureScreenshot(page, "38-speed-selector-height");
    }
  });

  test("resolution and speed selectors have consistent styling", async ({ authedPage: page }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    const speedSelect = page.getByLabel("Playback speed");
    const resolutionSelect = page.getByLabel("Playback resolution");

    const speedVisible = await speedSelect.isVisible();
    const resVisible = await resolutionSelect.isVisible().catch(() => false);

    if (speedVisible && resVisible) {
      const speedBox = await measureLocator(speedSelect);
      const resBox = await measureLocator(resolutionSelect);

      if (speedBox && resBox) {
        // Heights should match within 2px
        expect(Math.abs(speedBox.height - resBox.height)).toBeLessThanOrEqual(2);
      }

      // Typography should match
      const speedTypo = await measureLocatorTypography(speedSelect);
      const resTypo = await measureLocatorTypography(resolutionSelect);
      if (speedTypo && resTypo) {
        expect(speedTypo.fontSize).toBe(resTypo.fontSize);
      }
      await captureScreenshot(page, "38-selector-consistency");
    } else {
      await captureScreenshot(page, "38-selectors-partial");
    }
  });

  test("video controls area has balanced spacing", async ({ authedPage: page }) => {
    await page.goto(VIDEO_FILE_URL);
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    const speedSelect = page.getByLabel("Playback speed");
    const controlsArea = speedSelect.locator("xpath=ancestor::div[contains(@class,'flex')][1]");

    if (await speedSelect.isVisible().catch(() => false)) {
      const box = await measureLocator(controlsArea);
      if (box) {
        // Horizontal padding should be balanced
        if (box.paddingLeft > 0 && box.paddingRight > 0) {
          const ratio =
            Math.min(box.paddingLeft, box.paddingRight) /
            Math.max(box.paddingLeft, box.paddingRight);
          expect(ratio).toBeGreaterThanOrEqual(0.9);
        }
        // Padding values should be on spacing scale
        if (box.paddingLeft > 0) {
          expect(isOnSpacingScale(box.paddingLeft)).toBeTruthy();
        }
      }
      await captureScreenshot(page, "38-controls-spacing");
    } else {
      await captureScreenshot(page, "38-controls-not-found");
    }
  });
});
