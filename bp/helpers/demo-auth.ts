import { test as base, expect, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * BP test fixture that auto-navigates to the dashboard as a demo user.
 * All BP specs should use this instead of the base `test` import.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    // Navigate to dashboard — DEMO_MODE middleware lets us through
    await page.goto("/dashboard");
    // Wait for the page to be interactive
    await page.waitForLoadState("networkidle");
    // Hide Next.js dev overlay — it intercepts pointer events on elements near edges
    await page.evaluate(() => {
      const portal = document.querySelector("nextjs-portal");
      if (portal) (portal as HTMLElement).style.display = "none";
    });
    await use(page);
  },
});

export { expect };

/**
 * Hide the Next.js dev overlay that intercepts pointer events.
 * Call after any full page navigation (goto, URL change).
 */
export async function dismissDevOverlay(page: Page) {
  await page.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    if (portal) (portal as HTMLElement).style.display = "none";
  });
}

/**
 * Screenshot output directory for bush captures
 */
export const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "bush");
