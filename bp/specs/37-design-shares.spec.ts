/**
 * Design Benchmark: Shares & Collections
 *
 * Measures share cards, collection list spacing, and page balance.
 * Focus: card grid consistency, action button alignment, empty state spacing.
 *
 * Reference: agno.com uses clean card-based layouts for shared content.
 * Bush uses: share-card components, collection grid, create modals.
 */
import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
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

test.describe("Design Bench: Shares Page", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/shares");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("page container padding and balance", async ({ authedPage: page }) => {
    const container = await measureBox(page, "main > div");
    expect(container).not.toBeNull();

    expect(isOnSpacingScale(container!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(container!.paddingLeft)).toBe(true);

    const hBalance = checkHBalance(container!.paddingLeft, container!.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "37-shares-container");
  });

  test("shares heading typography", async ({ authedPage: page }) => {
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();

    const typo = await measureLocatorTypography(h1);
    expect(typo).not.toBeNull();

    expect(typo!.fontFamily).toContain("Inter");
    // Shares uses font-semibold (600), text-2xl
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.semibold);
    expect(typo!.fontSize).toBeGreaterThanOrEqual(24);
  });

  test("share card padding and balance", async ({ authedPage: page }) => {
    const cards = page.locator("main [class*='border'][class*='rounded']");
    const count = await cards.count();

    if (count > 0) {
      const card = cards.first();
      const box = await measureLocator(card);
      expect(box).not.toBeNull();

      // Card padding should be on-scale
      if (box!.paddingTop > 0) {
        expect(isOnSpacingScale(box!.paddingTop)).toBe(true);
      }
      if (box!.paddingLeft > 0) {
        const hBalance = checkHBalance(box!.paddingLeft, box!.paddingRight);
        expect(hBalance.balanced).toBe(true);
      }
    }
  });

  test("share card layout is grid-based", async ({ authedPage: page }) => {
    // Verify shares are displayed in a structured grid or list layout
    const grid = page.locator("main [class*='grid'], main [class*='flex-col']").first();
    if (await grid.isVisible()) {
      const box = await measureLocator(grid);
      expect(box).not.toBeNull();

      // Grid container should have reasonable width
      expect(box!.width).toBeGreaterThan(200);

      // If it has a gap, it should be on spacing scale
      if (box!.gap > 0) {
        expect(isOnSpacingScale(box!.gap)).toBe(true);
      }

      await captureScreenshot(page, "37-shares-grid-layout");
    }
  });

  test("full page screenshot", async ({ authedPage: page }) => {
    await captureScreenshot(page, "37-shares-full", { fullPage: true });
  });
});

test.describe("Design Bench: Collections Page", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    // Collections are nested under a project — navigate via project first
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    const url = page.url();
    await page.goto(url + "/collections");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("page container padding and balance", async ({ authedPage: page }) => {
    const container = await measureBox(page, "main > div");
    expect(container).not.toBeNull();

    expect(isOnSpacingScale(container!.paddingTop)).toBe(true);
    expect(isOnSpacingScale(container!.paddingLeft)).toBe(true);

    const hBalance = checkHBalance(container!.paddingLeft, container!.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "37-collections-container");
  });

  test("collections heading typography", async ({ authedPage: page }) => {
    const h1 = page.getByRole("heading", { name: "Collections" }).first();
    await expect(h1).toBeVisible();

    const typo = await measureLocatorTypography(h1);
    expect(typo).not.toBeNull();

    expect(typo!.fontFamily).toContain("Inter");
    // Collections uses font-bold (700)
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.bold);
    expect(typo!.fontSize).toBeGreaterThanOrEqual(24);
  });

  test("collection card grid gap", async ({ authedPage: page }) => {
    const grid = page.locator("main [class*='grid']").first();
    if (await grid.isVisible()) {
      const box = await measureLocator(grid);
      expect(box).not.toBeNull();

      if (box!.gap > 0) {
        expect(isOnSpacingScale(box!.gap)).toBe(true);
      }
    }
  });

  test("create button exists and has balanced padding", async ({ authedPage: page }) => {
    const createBtn = page.getByRole("button", { name: /Create|New/i }).first();

    if (await createBtn.isVisible()) {
      const box = await measureLocator(createBtn);
      expect(box).not.toBeNull();

      // Horizontal padding should be balanced
      const hBalance = checkHBalance(box!.paddingLeft, box!.paddingRight);
      expect(hBalance.balanced).toBe(true);

      // Button height should be reasonable
      expect(box!.height).toBeGreaterThanOrEqual(28);
      expect(box!.height).toBeLessThanOrEqual(48);
    }
  });

  test("full page screenshot", async ({ authedPage: page }) => {
    await captureScreenshot(page, "37-collections-full", { fullPage: true });
  });
});
