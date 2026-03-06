/**
 * Design Benchmark: Asset Browser
 *
 * Measures the file browser layout within a project detail page.
 * Focus: asset grid gaps, folder tree spacing, card proportions, view controls balance.
 *
 * Reference: Tailwind UI Catalyst demo uses thumbnail-heavy grid with hover overlays.
 * Bush uses: asset-card grid with metadata badges, folder-tree sidebar.
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

test.describe("Design Bench: Asset Browser", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    // Navigate to a project with files
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\/.+/);
      await page.waitForLoadState("networkidle");
      await dismissDevOverlay(page);
    }
  });

  test("project detail page padding", async ({ authedPage: page }) => {
    const container = await measureBox(page, "main > div");
    expect(container).not.toBeNull();
    if (!container) {
      throw new Error("Unable to measure project detail container");
    }

    // Padding should be on spacing scale
    expect(isOnSpacingScale(container.paddingTop)).toBe(true);
    expect(isOnSpacingScale(container.paddingLeft)).toBe(true);

    // Horizontal balance
    const hBalance = checkHBalance(container.paddingLeft, container.paddingRight);
    expect(hBalance.balanced).toBe(true);

    await captureScreenshot(page, "33-asset-browser-container");
  });

  test("project header spacing", async ({ authedPage: page }) => {
    const heading = page.getByRole("heading", { level: 1 }).first();
    if (await heading.isVisible()) {
      const typo = await measureLocatorTypography(heading);
      expect(typo).not.toBeNull();
      if (!typo) {
        throw new Error("Unable to measure project heading typography");
      }

      // Project name should be prominent (h2-h1 range)
      expect(typo.fontSize).toBeGreaterThanOrEqual(20);
      expect(typo.fontSize).toBeLessThanOrEqual(32);
    }
  });

  test("file grid gap is on-scale", async ({ authedPage: page }) => {
    // Asset grid uses gap classes
    const grid = page.locator("[class*='grid']").first();
    if (await grid.isVisible()) {
      const box = await measureLocator(grid);
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error("Unable to measure asset grid");
      }

      // Gap should be on spacing scale
      if (box.gap > 0) {
        expect(isOnSpacingScale(box.gap)).toBe(true);
      }
    }
  });

  test("folder and file cards have consistent grid layout", async ({ authedPage: page }) => {
    const candidateCards = page
      .locator(
        "main a[href*='/files/'], main button[aria-label*='folder' i], main button[aria-label*='file' i]"
      )
      .filter({ hasNotText: /Upload Files/i });

    const total = await candidateCards.count();
    const sample = Math.min(total, 6);
    const gridCards: Array<{ w: number; h: number }> = [];

    for (let i = 0; i < sample; i++) {
      const box = await candidateCards.nth(i).boundingBox();
      if (box) {
        gridCards.push({ w: box.width, h: box.height });
      }
    }

    if (gridCards.length > 1) {
      // Cards in the same column should share width (grid enforces this)
      const firstWidth = gridCards[0].w;
      for (const card of gridCards) {
        // Allow 2px tolerance for sub-pixel rendering
        expect(Math.abs(card.w - firstWidth)).toBeLessThanOrEqual(2);
      }
    }
  });

  test("upload button spacing from content", async ({ authedPage: page }) => {
    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    if (await uploadBtn.isVisible()) {
      const box = await measureLocator(uploadBtn);
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error("Unable to measure upload button");
      }

      // Button padding should be on spacing scale
      expect(isOnSpacingScale(box.paddingLeft)).toBe(true);
      expect(isOnSpacingScale(box.paddingRight)).toBe(true);

      // Button padding should be balanced
      const hBalance = checkHBalance(box.paddingLeft, box.paddingRight);
      expect(hBalance.balanced).toBe(true);

      // Button height should match a token
      const heightMatch =
        Math.abs(box.height - TOKENS.height.buttonSm) < 2 ||
        Math.abs(box.height - TOKENS.height.buttonMd) < 2 ||
        Math.abs(box.height - TOKENS.height.buttonLg) < 2;
      expect(heightMatch).toBe(true);
    }
  });

  test("view controls are balanced", async ({ authedPage: page }) => {
    // View toggle and sort controls in the toolbar
    const toolbar = page
      .locator("[class*='flex'][class*='items-center'][class*='justify-between']")
      .first();
    if (await toolbar.isVisible()) {
      const box = await measureLocator(toolbar);
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error("Unable to measure asset browser toolbar");
      }

      // Toolbar should have balanced horizontal padding
      const hBalance = checkHBalance(box.paddingLeft, box.paddingRight);
      expect(hBalance.balanced).toBe(true);
    }
  });

  test("breadcrumb spacing", async ({ authedPage: page }) => {
    // Navigate into a folder to see breadcrumbs
    const footageFolder = page.locator("main").getByText("Footage").first();
    if (await footageFolder.isVisible()) {
      await footageFolder.click({ force: true });
      await page.waitForTimeout(500);

      // Breadcrumb nav
      const breadcrumb = page
        .locator("nav[aria-label*='Breadcrumb'], [class*='breadcrumb']")
        .first();
      if (await breadcrumb.isVisible()) {
        const box = await measureLocator(breadcrumb);
        expect(box).not.toBeNull();
        if (!box) {
          throw new Error("Unable to measure breadcrumb layout");
        }

        // Gap between breadcrumb items should be on-scale
        if (box.gap > 0) {
          expect(isOnSpacingScale(box.gap)).toBe(true);
        }

        await captureScreenshot(page, "33-breadcrumbs");
      }
    }
  });

  test("full project detail screenshot for comparison", async ({ authedPage: page }) => {
    await captureScreenshot(page, "33-asset-browser-full", { fullPage: true });
  });
});
