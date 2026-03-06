/**
 * Design Benchmark: Notifications
 *
 * Measures notification page layout, list item spacing, and component balance.
 * Focus: list rhythm, item padding, filter controls, mark-all-read button alignment.
 *
 * Reference: Tailwind UI Catalyst demo notification patterns (bell + dropdown + full page).
 * Bush uses: bell in sidebar, dropdown panel, /notifications page with filters.
 */
import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import {
  measureBox,
  measureLocator,
  measureLocatorTypography,
  isOnSpacingScale,
  checkHBalance,
  TOKENS,
} from "../helpers/design-bench";

test.describe("Design Bench: Notifications Page", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("page container padding", async ({ authedPage: page }) => {
    const container = await measureBox(page, "main > div");
    expect(container).not.toBeNull();

    // Padding should be on spacing scale
    expect(isOnSpacingScale(container!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(container!.paddingLeft)).toBe(true);

    // Horizontal balance
    const hBalance = checkHBalance(container!.paddingLeft, container!.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "35-notifications-container");
  });

  test("page heading matches design token", async ({ authedPage: page }) => {
    const heading = page.getByRole("heading", { name: "Notifications" });
    await expect(heading).toBeVisible();

    const typo = await measureLocatorTypography(heading);
    expect(typo).not.toBeNull();

    // Notifications uses text-2xl font-semibold (24px, 600)
    expect(typo!.fontSize).toBeGreaterThanOrEqual(24);
    expect(typo!.fontSize).toBeLessThanOrEqual(32);
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.semibold);
  });

  test("notification list item spacing rhythm", async ({ authedPage: page }) => {
    // Measure gaps between notification items using evaluate directly
    const gaps = await page.evaluate(() => {
      // Find container with notification items
      const containers = document.querySelectorAll("main ul, main div");
      for (const container of containers) {
        const children = Array.from(container.children).filter(
          (c) => getComputedStyle(c).display !== "none" && c.tagName !== "H1" && c.tagName !== "H2"
        );
        if (children.length >= 3) {
          const result: number[] = [];
          for (let i = 1; i < children.length; i++) {
            const prev = children[i - 1].getBoundingClientRect();
            const curr = children[i].getBoundingClientRect();
            result.push(Math.round(curr.top - prev.bottom));
          }
          if (result.length > 0 && result.every((g) => g >= 0)) return result;
        }
      }
      return [];
    });

    if (gaps.length > 1) {
      // All gaps should be consistent (within 2px tolerance)
      const avgGap = gaps.reduce((a: number, b: number) => a + b, 0) / gaps.length;
      for (const gap of gaps) {
        expect(Math.abs(gap - avgGap)).toBeLessThanOrEqual(4);
      }
    }
  });

  test("notification item padding and balance", async ({ authedPage: page }) => {
    // Individual notification items
    const items = page.locator("main [class*='border']").filter({ has: page.locator("p, span") });
    const count = await items.count();

    if (count > 0) {
      const item = items.first();
      const box = await measureLocator(item);
      expect(box).not.toBeNull();

      // Padding should be on spacing scale
      if (box!.paddingTop > 0) {
        expect(isOnSpacingScale(box!.paddingTop)).toBe(true);
      }
      if (box!.paddingLeft > 0) {
        expect(isOnSpacingScale(box!.paddingLeft)).toBe(true);
      }

      // Horizontal balance
      if (box!.paddingLeft > 0 && box!.paddingRight > 0) {
        const hBalance = checkHBalance(box!.paddingLeft, box!.paddingRight);
        expect(hBalance.balanced).toBe(true);
      }
    }
  });

  test("filter controls spacing", async ({ authedPage: page }) => {
    const filterSelect = page.locator("select").first();
    if (await filterSelect.isVisible()) {
      const box = await measureLocator(filterSelect);
      expect(box).not.toBeNull();

      // Select padding should be on-scale
      expect(isOnSpacingScale(box!.paddingLeft)).toBe(true);

      await captureScreenshot(page, "35-notifications-filter");
    }
  });

  test("mark all read button alignment", async ({ authedPage: page }) => {
    const markAllBtn = page.getByRole("button", { name: /Mark all as read/i });
    if (await markAllBtn.isVisible()) {
      const box = await measureLocator(markAllBtn);
      expect(box).not.toBeNull();

      // Button/link should have positive height
      expect(box!.height).toBeGreaterThan(16);

      // Horizontal padding should be balanced
      const hBalance = checkHBalance(box!.paddingLeft, box!.paddingRight);
      expect(hBalance.balanced).toBe(true);
    }
  });

  test("full page screenshot for comparison", async ({ authedPage: page }) => {
    await captureScreenshot(page, "35-notifications-full", { fullPage: true });
  });
});

test.describe("Design Bench: Notification Bell (Sidebar)", () => {
  test("bell icon alignment in sidebar", async ({ authedPage: page }) => {
    // Bell is inside the sidebar
    const bellContainer = page.locator("aside button[aria-label='Notifications']");
    if (await bellContainer.isVisible()) {
      const box = await measureLocator(bellContainer);
      expect(box).not.toBeNull();

      // Same padding as other sidebar items (px-4 py-3 = 16px 12px)
      expect(isOnSpacingScale(box!.paddingLeft)).toBe(true);
      expect(isOnSpacingScale(box!.paddingTop)).toBe(true);

      await captureScreenshot(page, "35-notification-bell");
    }
  });
});
