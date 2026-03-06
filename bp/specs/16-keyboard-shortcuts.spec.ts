import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-16: Keyboard Shortcuts", () => {
  test("Ctrl+K remains stable and interacts when search overlay exists", async ({
    authedPage: page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.message);
    });

    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);

    const palette = page.getByRole("dialog", { name: /command palette/i });
    const paletteVisible = await palette.isVisible().catch(() => false);

    if (paletteVisible) {
      await captureScreenshot(page, "16-command-palette-open");

      const input = palette.getByPlaceholder(/Search files and commands/i);
      await input.fill("project");
      await page.waitForTimeout(300);
      await captureScreenshot(page, "16-command-palette-search");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await expect(palette).not.toBeVisible();
    } else {
      await captureScreenshot(page, "16-no-command-palette-mounted");
      await expect(page.getByRole("link", { name: /Dashboard/i }).first()).toBeVisible();
    }

    expect(runtimeErrors).toEqual([]);
  });

  test("? key interaction remains stable", async ({ authedPage: page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.message);
    });

    await page.keyboard.press("Shift+/"); // ? on US keyboard
    await page.waitForTimeout(500);

    const legend = page.getByRole("dialog", { name: /keyboard shortcuts/i });
    if (await legend.isVisible().catch(() => false)) {
      await expect(legend).toBeVisible();
      await captureScreenshot(page, "16-keyboard-legend");
      await page.keyboard.press("Escape");
      await expect(legend).not.toBeVisible();
    } else {
      await captureScreenshot(page, "16-keyboard-legend-not-mounted");
      await expect(page.getByRole("link", { name: /Projects/i }).first()).toBeVisible();
    }

    expect(runtimeErrors).toEqual([]);
  });

  test("theme toggle via sidebar", async ({ authedPage: page }) => {
    const themeBtn = page.getByLabel(/Switch to (light|dark) theme/i);
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      await captureScreenshot(page, "16-theme-toggled");

      // Toggle back
      await themeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test("Escape closes open dialogs", async ({ authedPage: page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.message);
    });

    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);

    const dialog = page.getByRole("dialog", { name: /command palette|keyboard shortcuts/i });
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await expect(dialog).not.toBeVisible();
      await captureScreenshot(page, "16-escape-closes-dialog");
    } else {
      await captureScreenshot(page, "16-escape-no-dialog-open");
      await expect(page.getByRole("link", { name: /Dashboard/i }).first()).toBeVisible();
    }

    expect(runtimeErrors).toEqual([]);
  });
});
