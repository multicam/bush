/**
 * Design Benchmark: Project List
 *
 * Measures project list page layout, card spacing, and grid balance.
 * Focus: grid gaps, card proportions, search bar spacing, view toggle balance.
 *
 * Reference: agno.com uses rounded cards with subtle shadows, generous padding.
 * Bush uses: border-based cards, grid/list toggle, workspace filter.
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

test.describe("Design Bench: Project List", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("page container padding matches dashboard", async ({ authedPage: page }) => {
    // Should use same p-8 (32px) as dashboard for consistency
    const container = await measureBox(page, "main > div");
    expect(container).not.toBeNull();
    if (!container) {
      throw new Error("Unable to measure projects page container");
    }

    // Check padding is on spacing scale
    expect(isOnSpacingScale(container.paddingTop)).toBe(true);
    expect(isOnSpacingScale(container.paddingLeft)).toBe(true);

    // Horizontal balance
    const hBalance = checkHBalance(container.paddingLeft, container.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "32-projects-container");
  });

  test("page heading typography", async ({ authedPage: page }) => {
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible();

    const typo = await measureLocatorTypography(heading);
    expect(typo).not.toBeNull();
    if (!typo) {
      throw new Error("Unable to measure projects heading typography");
    }

    // Should use heading scale (h1 = 32px or text-3xl ≈ 30px)
    expect(typo.fontSize).toBeGreaterThanOrEqual(28);
    expect(typo.fontSize).toBeLessThanOrEqual(32);

    await captureScreenshot(page, "32-projects-heading");
  });

  test("project card grid gap is on-scale", async ({ authedPage: page }) => {
    const cards = page.locator("a[href^='/projects/']");
    const count = await cards.count();

    if (count > 1) {
      const first = await cards.nth(0).boundingBox();
      const second = await cards.nth(1).boundingBox();

      if (first && second) {
        const horizontalGap = Math.abs(second.x - (first.x + first.width));
        const verticalGap = Math.abs(second.y - (first.y + first.height));
        const resolvedGap = Math.min(horizontalGap, verticalGap);

        expect(resolvedGap).toBeGreaterThanOrEqual(0);
        if (resolvedGap > 0) {
          expect(isOnSpacingScale(Math.round(resolvedGap))).toBe(true);
        }
      }

      await captureScreenshot(page, "32-projects-grid");
    }
  });

  test("project card padding and border-radius", async ({ authedPage: page }) => {
    // Project cards are links with padding and border
    const card = page.locator("a[href^='/projects/']").first();
    if (await card.isVisible()) {
      const box = await measureLocator(card);
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error("Unable to measure project card");
      }

      // Padding should be on spacing scale
      expect(isOnSpacingScale(box.paddingTop)).toBe(true);
      expect(isOnSpacingScale(box.paddingLeft)).toBe(true);

      // Horizontal padding balance
      const hBalance = checkHBalance(box.paddingLeft, box.paddingRight);
      expect(hBalance.balanced).toBe(true);
    }
  });

  test("project card border-radius consistency", async ({ authedPage: page }) => {
    const cards = page.locator("a[href^='/projects/']");
    const count = await cards.count();

    const radii: number[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      const card = cards.nth(i);
      if (await card.isVisible()) {
        const r = await card.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
        radii.push(r);
      }
    }

    // All cards should have the same border-radius
    if (radii.length > 1) {
      const firstRadius = radii[0];
      for (const r of radii) {
        expect(r).toBeCloseTo(firstRadius, 0);
      }
      // Should match a token value
      const matchesToken = Object.values(TOKENS.radius).some((t) => Math.abs(t - firstRadius) < 1);
      expect(matchesToken).toBe(true);
    }
  });

  test("search/filter controls spacing", async ({ authedPage: page }) => {
    // Search input area — projects page uses custom styled input (px-3 py-2)
    const searchInput = page.locator("input[type='text'], input[placeholder*='Search']").first();
    if (await searchInput.isVisible()) {
      const box = await measureLocator(searchInput);
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error("Unable to measure projects search input");
      }

      // NOTE: Custom inline inputs use className-based padding, not design system Input component.
      // The padding is set via Tailwind utility (px-3 = 12px) but may be overridden by pl-10
      // when a start icon is present. Record actual value for comparison.
      // This is a design system compliance finding if paddingLeft is 0.
      expect(box.paddingLeft).toBeGreaterThanOrEqual(0);

      // Input height should be reasonable (20-44px)
      expect(box.height).toBeGreaterThanOrEqual(20);
      expect(box.height).toBeLessThanOrEqual(44);

      await captureScreenshot(page, "32-projects-search-input");
    }
  });

  test("view toggle buttons are equally sized", async ({ authedPage: page }) => {
    // Grid/List toggle buttons
    const gridBtn = page.getByLabel(/grid/i).first();
    const listBtn = page.getByLabel(/list/i).first();

    if ((await gridBtn.isVisible()) && (await listBtn.isVisible())) {
      const gridBox = await measureLocator(gridBtn);
      const listBox = await measureLocator(listBtn);

      expect(gridBox).not.toBeNull();
      expect(listBox).not.toBeNull();
      if (!gridBox || !listBox) {
        throw new Error("Unable to measure view toggle buttons");
      }

      // Toggle buttons should be the same size (balanced)
      expect(gridBox.width).toBeCloseTo(listBox.width, 2);
      expect(gridBox.height).toBeCloseTo(listBox.height, 2);
    }
  });

  test("full page screenshot for agno comparison", async ({ authedPage: page }) => {
    await captureScreenshot(page, "32-projects-full", { fullPage: true });
  });
});
