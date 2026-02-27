import type { Page } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "bush");

/**
 * Capture a named screenshot to bp/screenshots/bush/
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    fullPage: options?.fullPage ?? false,
  });
  return filePath;
}
