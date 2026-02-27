import type { Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
