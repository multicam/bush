/**
 * Design Benchmark: Dashboard
 *
 * Measures dashboard layout, card spacing, section balance against design tokens.
 * Focus: page padding, card grid gaps, section rhythm, content balance.
 *
 * Reference: agno.com uses generous whitespace, 8px-based spacing, subtle card shadows.
 * Bush uses: p-8 (32px page padding), gap-4/gap-8, rounded-md cards with border.
 */
import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import {
  measureBox,
  measureLocator,
  measureTypography,
  measureLocatorTypography,
  measureChildGaps,
  measureRadius,
  isOnSpacingScale,
  checkHBalance,
  checkVBalance,
  TOKENS,
} from "../helpers/design-bench";

test.describe("Design Bench: Dashboard", () => {
  test("page container padding is consistent and on-scale", async ({ authedPage: page }) => {
    // Dashboard wraps in div.p-8 max-w-[80rem] mx-auto
    const container = await measureBox(page, "main > div");
    expect(container).not.toBeNull();

    // All padding values should be on the 4px spacing scale
    expect(isOnSpacingScale(container!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(container!.paddingLeft)).toBe(true);
    expect(isOnSpacingScale(container!.paddingBottom)).toBe(true);
    expect(isOnSpacingScale(container!.paddingRight)).toBe(true);

    // Horizontal balance (left and right padding should match)
    const hBalance = checkHBalance(container!.paddingLeft, container!.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "31-dashboard-container");
  });

  test("header area spacing and balance", async ({ authedPage: page }) => {
    // Header: flex items-start justify-between mb-8
    const header = page.locator("main h1").first();
    await expect(header).toBeVisible();

    const typo = await measureLocatorTypography(header);
    expect(typo).not.toBeNull();

    // h1 is text-3xl = ~30px (tailwind) — should be near h1 token (32px)
    expect(typo!.fontSize).toBeGreaterThanOrEqual(28);
    expect(typo!.fontSize).toBeLessThanOrEqual(32);
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.bold);

    await captureScreenshot(page, "31-dashboard-header");
  });

  test("stats cards grid spacing is on-scale", async ({ authedPage: page }) => {
    // Stats grid: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
    // At 1440px viewport, should be 4 columns with 16px gap
    const statsGrid = page.locator("main .grid").first();
    await expect(statsGrid).toBeVisible();

    const box = await measureLocator(statsGrid);
    expect(box).not.toBeNull();

    // gap-4 = 16px
    expect(box!.gap).toBeCloseTo(16, 0);
    expect(isOnSpacingScale(box!.gap)).toBe(true);
  });

  test("stat card internal padding and balance", async ({ authedPage: page }) => {
    // Stat cards: p-5 = 20px, text-center
    const statCard = await measureBox(page, "main .grid > div");
    expect(statCard).not.toBeNull();

    // Padding should be on spacing scale
    expect(isOnSpacingScale(statCard!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(statCard!.paddingLeft)).toBe(true);

    // All four sides should be equal (uniform padding)
    const hBalance = checkHBalance(statCard!.paddingLeft, statCard!.paddingRight);
    const vBalance = checkVBalance(statCard!.paddingTop, statCard!.paddingBottom);
    expect(hBalance.balanced).toBe(true);
    expect(vBalance.balanced).toBe(true);

    await captureScreenshot(page, "31-dashboard-stat-card");
  });

  test("stat card border-radius matches token", async ({ authedPage: page }) => {
    // rounded-md = 8px
    const radius = await measureRadius(page, "main .grid > div");
    expect(radius).not.toBeNull();
    expect(radius).toBeCloseTo(TOKENS.radius.md, 1);
  });

  test("section cards padding and rhythm", async ({ authedPage: page }) => {
    // Recent Projects & Quick Actions sections
    const sections = page.locator("main section");
    const count = await sections.count();

    const paddings: number[] = [];
    for (let i = 0; i < count; i++) {
      const section = sections.nth(i);
      if (await section.isVisible()) {
        const box = await measureLocator(section);
        expect(box).not.toBeNull();

        // Padding should be on spacing scale
        expect(isOnSpacingScale(box!.paddingTop)).toBe(true);

        // Balanced horizontal padding
        const hBalance = checkHBalance(box!.paddingLeft, box!.paddingRight);
        expect(hBalance.balanced).toBe(true);

        paddings.push(box!.paddingTop);
      }
    }

    // All sections should use the same padding (consistent rhythm)
    if (paddings.length > 1) {
      for (const p of paddings) {
        expect(p).toBeCloseTo(paddings[0], 0);
      }
    }

    await captureScreenshot(page, "31-dashboard-sections");
  });

  test("two-column grid gap is on-scale", async ({ authedPage: page }) => {
    // grid-cols-2 gap-8 for sections at lg breakpoint
    const sectionGrid = page.locator("main > div > .grid").nth(1);
    if (await sectionGrid.isVisible()) {
      const box = await measureLocator(sectionGrid);
      expect(box).not.toBeNull();

      // gap-8 = 32px
      expect(box!.gap).toBeCloseTo(32, 0);
      expect(isOnSpacingScale(box!.gap)).toBe(true);
    }
  });

  test("project list item spacing is consistent", async ({ authedPage: page }) => {
    // Recent projects: flex flex-col gap-2 (8px)
    const projectList = page.locator("main section .flex.flex-col").first();
    if (await projectList.isVisible()) {
      const box = await measureLocator(projectList);
      expect(box).not.toBeNull();

      // gap-2 = 8px
      expect(box!.gap).toBeCloseTo(8, 0);
      expect(isOnSpacingScale(box!.gap)).toBe(true);
    }
  });

  test("project list item internal padding and balance", async ({ authedPage: page }) => {
    // Project items: p-3 = 12px
    const projectItem = page.locator("main section a[href^='/projects/']").first();
    if (await projectItem.isVisible()) {
      const box = await measureLocator(projectItem);
      expect(box).not.toBeNull();

      // Padding should be on spacing scale
      expect(isOnSpacingScale(box!.paddingTop)).toBe(true);
      expect(isOnSpacingScale(box!.paddingLeft)).toBe(true);

      // Balanced horizontal padding
      const hBalance = checkHBalance(box!.paddingLeft, box!.paddingRight);
      expect(hBalance.balanced).toBe(true);
    }
  });

  test("quick action items have icon-text gap on-scale", async ({ authedPage: page }) => {
    // Quick actions: gap-3 = 12px between icon and text
    const actionItem = page.locator("main section a[href='/files/upload']").first();
    if (await actionItem.isVisible()) {
      const box = await measureLocator(actionItem);
      expect(box).not.toBeNull();

      // gap-3 = 12px
      expect(box!.gap).toBeCloseTo(12, 0);
      expect(isOnSpacingScale(box!.gap)).toBe(true);
    }
  });

  test("full page layout screenshot for agno comparison", async ({ authedPage: page }) => {
    await captureScreenshot(page, "31-dashboard-full", { fullPage: true });
  });
});
