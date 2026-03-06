/**
 * Design Benchmark: Dashboard
 *
 * Measures dashboard layout, card spacing, section balance against design tokens.
 * Focus: page padding, card grid gaps, section rhythm, content balance.
 *
 * Reference: Tailwind UI Catalyst demo uses generous whitespace, 8px-based spacing, subtle card shadows.
 * Bush uses: p-8 (32px page padding), gap-4/gap-8, rounded-md cards with border.
 */
import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import {
  measureBox,
  measureLocator,
  measureLocatorTypography,
  isOnSpacingScale,
  checkHBalance,
  checkVBalance,
  TOKENS,
} from "../helpers/design-bench";

function requireValue<T>(value: T | null, message: string): T {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error(message);
  }
  return value;
}

test.describe("Design Bench: Dashboard", () => {
  test("page container padding is consistent and on-scale", async ({ authedPage: page }) => {
    // Dashboard wraps in div.p-8 max-w-[80rem] mx-auto
    const container = await measureBox(page, "main > div");
    const measuredContainer = requireValue(container, "Unable to measure dashboard container");

    // All padding values should be on the 4px spacing scale
    expect(isOnSpacingScale(measuredContainer.paddingTop)).toBe(true);
    expect(isOnSpacingScale(measuredContainer.paddingLeft)).toBe(true);
    expect(isOnSpacingScale(measuredContainer.paddingBottom)).toBe(true);
    expect(isOnSpacingScale(measuredContainer.paddingRight)).toBe(true);

    // Horizontal balance (left and right padding should match)
    const hBalance = checkHBalance(measuredContainer.paddingLeft, measuredContainer.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "31-dashboard-container");
  });

  test("header area spacing and balance", async ({ authedPage: page }) => {
    // Header: flex items-start justify-between mb-8
    const header = page.locator("main h1").first();
    await expect(header).toBeVisible();

    const typo = await measureLocatorTypography(header);
    const measuredTypography = requireValue(typo, "Unable to measure dashboard header typography");

    // h1 is text-3xl = ~30px (tailwind) — should be near h1 token (32px)
    expect(measuredTypography.fontSize).toBeGreaterThanOrEqual(28);
    expect(measuredTypography.fontSize).toBeLessThanOrEqual(32);
    expect(measuredTypography.fontWeight).toBe(TOKENS.fontWeight.bold);

    await captureScreenshot(page, "31-dashboard-header");
  });

  test("stats cards grid spacing is on-scale", async ({ authedPage: page }) => {
    // Stats grid: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
    // At 1440px viewport, should be 4 columns with 16px gap
    const statsGrid = page.locator("main .grid").first();
    await expect(statsGrid).toBeVisible();

    const box = await measureLocator(statsGrid);
    const measuredGrid = requireValue(box, "Unable to measure dashboard stats grid");

    // gap-4 = 16px
    expect(measuredGrid.gap).toBeCloseTo(16, 0);
    expect(isOnSpacingScale(measuredGrid.gap)).toBe(true);
  });

  test("stat card internal padding and balance", async ({ authedPage: page }) => {
    // Stat cards: p-5 = 20px, text-center
    const statsGrid = page.locator("main .grid").first();
    await expect(statsGrid).toBeVisible();
    const statCard = await measureLocator(statsGrid.locator(":scope > div").first());
    const measuredStatCard = requireValue(statCard, "Unable to find dashboard stat card");

    // Padding should be on spacing scale
    expect(isOnSpacingScale(measuredStatCard.paddingTop)).toBe(true);
    expect(isOnSpacingScale(measuredStatCard.paddingLeft)).toBe(true);

    // All four sides should be equal (uniform padding)
    const hBalance = checkHBalance(measuredStatCard.paddingLeft, measuredStatCard.paddingRight);
    const vBalance = checkVBalance(measuredStatCard.paddingTop, measuredStatCard.paddingBottom);
    expect(hBalance.balanced).toBe(true);
    expect(vBalance.balanced).toBe(true);

    await captureScreenshot(page, "31-dashboard-stat-card");
  });

  test("stat card border-radius matches token", async ({ authedPage: page }) => {
    // rounded-md = 8px
    const statsGrid = page.locator("main .grid").first();
    await expect(statsGrid).toBeVisible();
    const radius = await statsGrid
      .locator(":scope > div")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
    const measuredRadius = requireValue(radius, "Unable to measure dashboard stat card radius");
    expect(measuredRadius).toBeCloseTo(TOKENS.radius.md, 1);
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
        const measuredSection = requireValue(box, "Unable to measure dashboard section");

        // Padding should be on spacing scale
        expect(isOnSpacingScale(measuredSection.paddingTop)).toBe(true);

        // Balanced horizontal padding
        const hBalance = checkHBalance(measuredSection.paddingLeft, measuredSection.paddingRight);
        expect(hBalance.balanced).toBe(true);

        paddings.push(measuredSection.paddingTop);
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
      const measuredSectionGrid = requireValue(
        box,
        "Unable to measure dashboard two-column section grid"
      );

      // gap-8 = 32px
      expect(measuredSectionGrid.gap).toBeCloseTo(32, 0);
      expect(isOnSpacingScale(measuredSectionGrid.gap)).toBe(true);
    }
  });

  test("project list item spacing is consistent", async ({ authedPage: page }) => {
    // Recent projects: flex flex-col gap-2 (8px)
    const projectList = page.locator("main section .flex.flex-col").first();
    if (await projectList.isVisible()) {
      const box = await measureLocator(projectList);
      const measuredProjectList = requireValue(box, "Unable to measure recent projects list");

      // gap-2 = 8px
      expect(measuredProjectList.gap).toBeCloseTo(8, 0);
      expect(isOnSpacingScale(measuredProjectList.gap)).toBe(true);
    }
  });

  test("project list item internal padding and balance", async ({ authedPage: page }) => {
    // Project items: p-3 = 12px
    const projectItem = page.locator("main section a[href^='/projects/']").first();
    if (await projectItem.isVisible()) {
      const box = await measureLocator(projectItem);
      const measuredProjectItem = requireValue(box, "Unable to measure project list item");

      // Padding should be on spacing scale
      expect(isOnSpacingScale(measuredProjectItem.paddingTop)).toBe(true);
      expect(isOnSpacingScale(measuredProjectItem.paddingLeft)).toBe(true);

      // Balanced horizontal padding
      const hBalance = checkHBalance(
        measuredProjectItem.paddingLeft,
        measuredProjectItem.paddingRight
      );
      expect(hBalance.balanced).toBe(true);
    }
  });

  test("quick action items have icon-text gap on-scale", async ({ authedPage: page }) => {
    // Quick actions: gap-3 = 12px between icon and text
    const actionItem = page.locator("main section a[href='/files/upload']").first();
    if (await actionItem.isVisible()) {
      const box = await measureLocator(actionItem);
      const measuredActionItem = requireValue(box, "Unable to measure quick action item");

      // gap-3 = 12px
      expect(measuredActionItem.gap).toBeCloseTo(12, 0);
      expect(isOnSpacingScale(measuredActionItem.gap)).toBe(true);
    }
  });

  test("full page layout screenshot for catalyst comparison", async ({ authedPage: page }) => {
    await captureScreenshot(page, "31-dashboard-full", { fullPage: true });
  });
});
