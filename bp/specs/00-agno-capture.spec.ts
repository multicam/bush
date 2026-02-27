import { test } from "@playwright/test";
import path from "path";

const AGNO_SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "agno");

/**
 * UC-00: Agno.com Reference Capture
 *
 * Captures screenshots of agno.com's public pages for design comparison.
 * Only public (unauthenticated) pages can be captured automatically.
 * Authenticated app UI screenshots must be manually added to bp/screenshots/agno/.
 */
test.describe("Agno.com Reference Capture", () => {
  test("capture agno.com landing page", async ({ page }) => {
    await page.goto("https://www.agno.com");
    await page.waitForLoadState("networkidle");

    await page.screenshot({
      path: path.join(AGNO_SCREENSHOT_DIR, "agno-landing-full.png"),
      fullPage: true,
    });

    await page.screenshot({
      path: path.join(AGNO_SCREENSHOT_DIR, "agno-landing-viewport.png"),
      fullPage: false,
    });
  });

  test("capture agno.com navigation and header", async ({ page }) => {
    await page.goto("https://www.agno.com");
    await page.waitForLoadState("networkidle");

    const header = page.locator("header, nav").first();
    if (await header.isVisible()) {
      await header.screenshot({
        path: path.join(AGNO_SCREENSHOT_DIR, "agno-header.png"),
      });
    }
  });

  test("capture agno.com footer", async ({ page }) => {
    await page.goto("https://www.agno.com");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer").first();
    if (await footer.isVisible()) {
      await footer.screenshot({
        path: path.join(AGNO_SCREENSHOT_DIR, "agno-footer.png"),
      });
    }
  });
});
