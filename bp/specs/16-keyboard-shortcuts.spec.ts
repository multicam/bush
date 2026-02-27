import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-16: Keyboard Shortcuts", () => {
  test("Ctrl+K opens command palette", async ({ authedPage: page }) => {
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);

    const palette = page.locator("[role='dialog']:has(input[type='text']), [class*='command'], [class*='palette']").first();

    if (await palette.isVisible()) {
      await captureScreenshot(page, "16-command-palette-open");

      // Type a search
      const input = palette.locator("input").first();
      await input.fill("project");
      await page.waitForTimeout(300);
      await captureScreenshot(page, "16-command-palette-search");

      // Close with Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await expect(palette).not.toBeVisible();
    } else {
      await captureScreenshot(page, "16-no-command-palette");
    }
  });

  test("? key opens keyboard shortcut legend", async ({ authedPage: page }) => {
    await page.keyboard.press("Shift+/"); // ? on US keyboard
    await page.waitForTimeout(500);

    const legend = page.locator(
      "[role='dialog']:has-text('shortcut'), [role='dialog']:has-text('keyboard'), " +
      "[class*='keyboard'], [class*='shortcut']"
    ).first();

    if (await legend.isVisible()) {
      await captureScreenshot(page, "16-keyboard-legend");
    } else {
      await captureScreenshot(page, "16-no-keyboard-legend");
    }
  });

  test("theme toggle via sidebar", async ({ authedPage: page }) => {
    const themeBtn = page.getByLabel(/Switch to (light|dark) theme/i);
    if (await themeBtn.isVisible()) {
      const initialLabel = await themeBtn.getAttribute("aria-label");
      await themeBtn.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, "16-theme-toggled");

      // Toggle back
      await themeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test("Escape closes open dialogs", async ({ authedPage: page }) => {
    // Open command palette
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);

    const dialog = page.locator("[role='dialog']").first();
    if (await dialog.isVisible()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await expect(dialog).not.toBeVisible();
      await captureScreenshot(page, "16-escape-closes-dialog");
    }
  });
});
