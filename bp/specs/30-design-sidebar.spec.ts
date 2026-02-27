/**
 * Design Benchmark: Sidebar (Icon Rail)
 *
 * Measures the sidebar component against design tokens and agno.com reference.
 * Focus: spacing, balance, proportions, navigation rhythm.
 *
 * Reference: agno.com uses an icon rail sidebar with glass morphism.
 * Bush uses: 64px collapsed → 240px expanded, bg-surface-0.
 */
import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import {
  measureBox,
  measureTypography,
  measureChildGaps,
  isOnSpacingScale,
  checkHBalance,
  TOKENS,
} from "../helpers/design-bench";

test.describe("Design Bench: Sidebar", () => {
  test("sidebar collapsed width matches token (64px)", async ({ authedPage: page }) => {
    const sidebar = await measureBox(page, "aside");
    expect(sidebar).not.toBeNull();
    expect(sidebar!.width).toBeCloseTo(TOKENS.sidebar.collapsed, 0);

    await captureScreenshot(page, "30-sidebar-collapsed");
  });

  test("sidebar logo area height and balance", async ({ authedPage: page }) => {
    // Wait for sidebar to fully render
    await page.waitForSelector("aside > div:first-child", { timeout: 5000 });
    // Logo container: h-16 = 64px, px-4 = 16px
    const logo = await measureBox(page, "aside > div:first-child");
    expect(logo).not.toBeNull();
    expect(logo!.height).toBeCloseTo(64, 0); // h-16

    // Horizontal padding should be balanced
    const hBalance = checkHBalance(logo!.paddingLeft, logo!.paddingRight);
    expect(hBalance.balanced).toBe(true);
    expect(isOnSpacingScale(logo!.paddingLeft)).toBe(true);

    await captureScreenshot(page, "30-sidebar-logo");
  });

  test("nav items have consistent spacing rhythm", async ({ authedPage: page }) => {
    // Measure gaps between nav items inside <nav>
    const gaps = await measureChildGaps(page, "aside nav");

    expect(gaps.length).toBeGreaterThan(0);

    // All gaps should be consistent (same value within 2px tolerance)
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const gap of gaps) {
      expect(Math.abs(gap - avgGap)).toBeLessThanOrEqual(2);
    }
  });

  test("nav item padding is on spacing scale and balanced", async ({ authedPage: page }) => {
    // Nav items are <a> inside <nav> — px-4 py-3 = 16px 12px
    const navItem = await measureBox(page, "aside nav a");
    expect(navItem).not.toBeNull();

    // Horizontal padding should be balanced
    const hBalance = checkHBalance(navItem!.paddingLeft, navItem!.paddingRight);
    expect(hBalance.balanced).toBe(true);

    // All padding values should be on the spacing scale
    expect(isOnSpacingScale(navItem!.paddingLeft)).toBe(true);
    expect(isOnSpacingScale(navItem!.paddingRight)).toBe(true);
    expect(isOnSpacingScale(navItem!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(navItem!.paddingBottom)).toBe(true);
  });

  test("nav item typography matches body-sm token", async ({ authedPage: page }) => {
    // Expand sidebar by hovering
    await page.hover("aside");
    await page.waitForTimeout(400); // Wait for transition

    const navText = await measureTypography(page, "aside nav a span:last-child");
    // nav text is text-sm = 14px (tailwind) but labeled body-sm
    // The span only shows when expanded
    if (navText) {
      expect(navText.fontSize).toBeCloseTo(14, 0);
      expect(navText.fontWeight).toBe(TOKENS.fontWeight.medium);
    }

    await captureScreenshot(page, "30-sidebar-expanded");
  });

  test("footer section spacing mirrors nav section", async ({ authedPage: page }) => {
    // Footer section: border-t border-border-default py-2
    // Should have consistent vertical padding with nav section
    const nav = await measureBox(page, "aside nav");
    const footer = await measureBox(page, "aside > div:last-child");

    expect(nav).not.toBeNull();
    expect(footer).not.toBeNull();

    // Both should have padding on the spacing scale
    expect(isOnSpacingScale(nav!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(footer!.paddingTop)).toBe(true);

    // Footer py should be on scale
    expect(isOnSpacingScale(footer!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(footer!.paddingBottom)).toBe(true);
  });

  test("sidebar vs content area proportion", async ({ authedPage: page }) => {
    const sidebar = await measureBox(page, "aside");
    const main = await measureBox(page, "main");

    expect(sidebar).not.toBeNull();
    expect(main).not.toBeNull();

    // Sidebar should be much narrower than content (collapsed ratio ~4.6%)
    const ratio = sidebar!.width / (sidebar!.width + main!.width);
    expect(ratio).toBeLessThan(0.1); // Sidebar < 10% of total width
    expect(ratio).toBeGreaterThan(0.02); // But not invisible

    // Both should exist and have positive dimensions
    expect(sidebar!.width).toBeGreaterThan(50);
    expect(main!.width).toBeGreaterThan(1000);
  });
});
