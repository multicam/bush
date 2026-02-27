import { test as base, expect, type Page } from "@playwright/test";
import path from "path";

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
    await use(page);
  },
});

export { expect };

/**
 * Screenshot output directory for bush captures
 */
export const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "bush");
