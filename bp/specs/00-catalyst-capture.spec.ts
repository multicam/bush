import { test } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALYST_SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "catalyst");
const CATALYST_DEMO_URL = "https://catalyst-demo.tailwindui.com/";

/**
 * UC-00: Catalyst Demo Reference Capture
 *
 * Captures screenshots of Tailwind UI Catalyst demo pages for design comparison.
 * Only public (unauthenticated) pages can be captured automatically.
 * Authenticated app UI screenshots must be manually added to bp/screenshots/catalyst/.
 */
test.describe("Tailwind UI Catalyst Demo Reference Capture", () => {
  test.beforeAll(() => {
    fs.mkdirSync(CATALYST_SCREENSHOT_DIR, { recursive: true });
  });

  test("capture catalyst demo landing page", async ({ page }) => {
    await page.goto(CATALYST_DEMO_URL);
    await page.waitForLoadState("networkidle");

    await page.screenshot({
      path: path.join(CATALYST_SCREENSHOT_DIR, "catalyst-landing-full.png"),
      fullPage: true,
    });

    await page.screenshot({
      path: path.join(CATALYST_SCREENSHOT_DIR, "catalyst-landing-viewport.png"),
      fullPage: false,
    });
  });

  test("capture catalyst demo navigation and header", async ({ page }) => {
    await page.goto(CATALYST_DEMO_URL);
    await page.waitForLoadState("networkidle");

    const header = page.locator("header, nav").first();
    if (await header.isVisible()) {
      await header.screenshot({
        path: path.join(CATALYST_SCREENSHOT_DIR, "catalyst-header.png"),
      });
    }
  });

  test("capture catalyst demo footer", async ({ page }) => {
    await page.goto(CATALYST_DEMO_URL);
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer").first();
    if (await footer.isVisible()) {
      await footer.screenshot({
        path: path.join(CATALYST_SCREENSHOT_DIR, "catalyst-footer.png"),
      });
    }
  });
});
