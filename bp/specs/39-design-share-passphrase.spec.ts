import { test, expect } from "@playwright/test";
import { captureScreenshot } from "../helpers/screenshot";
import {
  TOKENS,
  isOnSpacingScale,
  measureLocator,
  measureLocatorTypography,
} from "../helpers/design-bench";

const PROTECTED_SHARE_URL = "/s/protected-review-2024";

// Helper to wait for passphrase form to appear
async function waitForPassphraseForm(page: import("@playwright/test").Page) {
  await page.goto(PROTECTED_SHARE_URL);
  await page.waitForLoadState("networkidle");

  // Wait for loading to finish
  const loading = page.getByText("Loading share...");
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  }

  const heading = page.getByText("Protected Share");
  await expect(heading).toBeVisible({ timeout: 15000 });
}

test.describe("Design Bench: Share Passphrase Form", () => {
  test("passphrase form card has balanced padding", async ({ page }) => {
    await waitForPassphraseForm(page);

    const card = page.locator(".max-w-md").first();
    if (await card.isVisible()) {
      const box = await measureLocator(card);
      if (box) {
        if (box.paddingTop > 0) {
          expect(isOnSpacingScale(box.paddingTop)).toBeTruthy();
        }
        if (box.paddingLeft > 0) {
          expect(isOnSpacingScale(box.paddingLeft)).toBeTruthy();
        }
        if (box.paddingLeft > 0 && box.paddingRight > 0) {
          const hRatio =
            Math.min(box.paddingLeft, box.paddingRight) /
            Math.max(box.paddingLeft, box.paddingRight);
          expect(hRatio).toBeGreaterThanOrEqual(0.9);
        }
        if (box.paddingTop > 0 && box.paddingBottom > 0) {
          const vRatio =
            Math.min(box.paddingTop, box.paddingBottom) /
            Math.max(box.paddingTop, box.paddingBottom);
          expect(vRatio).toBeGreaterThanOrEqual(0.9);
        }
      }
    }
    await captureScreenshot(page, "39-passphrase-card-padding");
  });

  test("passphrase input, button, and heading design", async ({ page }) => {
    await waitForPassphraseForm(page);

    // Input sizing
    const input = page.locator('input[type="password"]');
    if (await input.isVisible()) {
      const inputBox = await measureLocator(input);
      if (inputBox) {
        expect(inputBox.height).toBeGreaterThanOrEqual(24);
      }
      const inputTypo = await measureLocatorTypography(input);
      if (inputTypo) {
        expect(inputTypo.fontSize).toBeGreaterThanOrEqual(TOKENS.fontSize.caption);
      }
    }

    // Button sizing
    const submitBtn = page.getByRole("button", { name: /Access Share/i });
    if (await submitBtn.isVisible()) {
      const btnBox = await measureLocator(submitBtn);
      if (btnBox) {
        expect(btnBox.height).toBeGreaterThan(0);
      }
    }

    // Heading typography
    const heading = page.getByText("Protected Share");
    const typo = await measureLocatorTypography(heading);
    if (typo) {
      // text-2xl = 24px = h2 token
      expect(typo.fontSize).toBe(TOKENS.fontSize.h2);
      // font-semibold = 600
      expect(typo.fontWeight).toBe(TOKENS.fontWeight.semibold);
    }

    await captureScreenshot(page, "39-passphrase-full-page", {
      fullPage: true,
    });
  });
});
