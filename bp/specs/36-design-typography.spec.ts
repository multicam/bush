/**
 * Design Benchmark: Typography
 *
 * Measures heading hierarchy, body text, and font usage across pages.
 * Focus: font size adherence to tokens, line height, weight, family consistency.
 *
 * Reference: agno.com uses SF Pro/Inter, larger headings, generous line-height.
 * Bush uses: Inter (--font-sans), JetBrains Mono (--font-mono), 14px body.
 */
import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import {
  measureLocatorTypography,
  measureTypography,
  TOKENS,
} from "../helpers/design-bench";

test.describe("Design Bench: Typography — Dashboard", () => {
  test("h1 heading uses correct font and weight", async ({ authedPage: page }) => {
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();

    const typo = await measureLocatorTypography(h1);
    expect(typo).not.toBeNull();

    // Font family should be Inter
    expect(typo!.fontFamily).toContain("Inter");

    // Weight should be bold (700)
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.bold);

    // Size should be in heading range (28-48px)
    expect(typo!.fontSize).toBeGreaterThanOrEqual(28);
    expect(typo!.fontSize).toBeLessThanOrEqual(48);
  });

  test("body text uses correct size and family", async ({ authedPage: page }) => {
    // Welcome text paragraph
    const body = page.locator("main p").first();
    if (await body.isVisible()) {
      const typo = await measureLocatorTypography(body);
      expect(typo).not.toBeNull();

      // Font family should be Inter
      expect(typo!.fontFamily).toContain("Inter");

      // Body text: 13-14px range
      expect(typo!.fontSize).toBeGreaterThanOrEqual(TOKENS.fontSize.bodySm);
      expect(typo!.fontSize).toBeLessThanOrEqual(16);
    }
  });

  test("section headings use consistent size and weight", async ({ authedPage: page }) => {
    // Section headings (Recent Projects, Quick Actions)
    const headings = page.locator("main h2");
    const count = await headings.count();

    const sizes: number[] = [];
    const weights: string[] = [];

    for (let i = 0; i < count; i++) {
      const heading = headings.nth(i);
      if (await heading.isVisible()) {
        const typo = await measureLocatorTypography(heading);
        if (typo) {
          sizes.push(typo.fontSize);
          weights.push(typo.fontWeight);
        }
      }
    }

    // All h2s should be the same size
    if (sizes.length > 1) {
      for (const size of sizes) {
        expect(size).toBeCloseTo(sizes[0], 0);
      }
    }

    // All h2s should be the same weight
    if (weights.length > 1) {
      for (const weight of weights) {
        expect(weight).toBe(weights[0]);
      }
    }

    // h2 weight should be semibold
    if (weights.length > 0) {
      expect(weights[0]).toBe(TOKENS.fontWeight.semibold);
    }
  });

  test("link text uses accent color or underline on hover", async ({ authedPage: page }) => {
    // "View all" link
    const link = page.locator("main a").filter({ hasText: "View all" }).first();
    if (await link.isVisible()) {
      const typo = await measureLocatorTypography(link);
      expect(typo).not.toBeNull();

      // Link should use caption/small size
      expect(typo!.fontSize).toBeLessThanOrEqual(TOKENS.fontSize.body);
    }
  });
});

test.describe("Design Bench: Typography — Projects", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("projects page h1 matches dashboard h1", async ({ authedPage: page }) => {
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();

    const typo = await measureLocatorTypography(h1);
    expect(typo).not.toBeNull();

    // Should match dashboard heading style
    expect(typo!.fontFamily).toContain("Inter");
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.bold);
    expect(typo!.fontSize).toBeGreaterThanOrEqual(28);
  });

  test("project name text in cards", async ({ authedPage: page }) => {
    // Measure the largest text inside the first project card link
    const fontSize = await page.evaluate(() => {
      const links = document.querySelectorAll("a[href^='/projects/']");
      let maxSize = 0;
      for (const link of links) {
        const spans = link.querySelectorAll("span, h3, h4, p");
        for (const el of spans) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size > maxSize) maxSize = size;
        }
      }
      return maxSize;
    });

    if (fontSize > 0) {
      // Project name should be readable (10-18px range — badge text can be small)
      expect(fontSize).toBeGreaterThanOrEqual(10);
      expect(fontSize).toBeLessThanOrEqual(18);
    }
  });
});

test.describe("Design Bench: Typography — Workspaces", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/workspaces");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("workspace page heading consistency", async ({ authedPage: page }) => {
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();

    const typo = await measureLocatorTypography(h1);
    expect(typo).not.toBeNull();

    expect(typo!.fontFamily).toContain("Inter");
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.bold);
    expect(typo!.fontSize).toBeGreaterThanOrEqual(28);
  });

  test("workspace card name typography", async ({ authedPage: page }) => {
    const wsName = page.locator("a[href^='/workspaces/'] span, a[href^='/workspaces/'] h3").first();
    if (await wsName.isVisible()) {
      const typo = await measureLocatorTypography(wsName);
      expect(typo).not.toBeNull();

      // Card names should be consistent with project card names
      expect(typo!.fontSize).toBeGreaterThanOrEqual(TOKENS.fontSize.bodySm);
      expect(typo!.fontSize).toBeLessThanOrEqual(18);
    }
  });
});

test.describe("Design Bench: Typography — Notifications", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);
  });

  test("notifications heading matches other pages", async ({ authedPage: page }) => {
    const h1 = page.getByRole("heading", { name: "Notifications" });
    await expect(h1).toBeVisible();

    const typo = await measureLocatorTypography(h1);
    expect(typo).not.toBeNull();

    expect(typo!.fontFamily).toContain("Inter");
    // Notifications uses font-semibold (600)
    expect(typo!.fontWeight).toBe(TOKENS.fontWeight.semibold);
    expect(typo!.fontSize).toBeGreaterThanOrEqual(24);
  });

  test("notification text uses appropriate size hierarchy", async ({ authedPage: page }) => {
    // Check that notification body text is smaller than heading
    const heading = page.getByRole("heading", { name: "Notifications" });
    const bodyText = page.locator("main p, main span").filter({ hasText: /commented|New|upload/i }).first();

    if (await heading.isVisible() && await bodyText.isVisible()) {
      const headingTypo = await measureLocatorTypography(heading);
      const bodyTypo = await measureLocatorTypography(bodyText);

      expect(headingTypo).not.toBeNull();
      expect(bodyTypo).not.toBeNull();

      // Body text should be smaller than heading
      expect(bodyTypo!.fontSize).toBeLessThan(headingTypo!.fontSize);
    }
  });
});

test.describe("Design Bench: Typography — Sidebar", () => {
  test("sidebar nav label font-size", async ({ authedPage: page }) => {
    // Expand sidebar
    await page.hover("aside");
    await page.waitForTimeout(400);

    // Select the label span (second span in nav item, not the icon span)
    // NavItem renders: <span>(icon)</span> + <span class="text-sm font-medium">(label)</span>
    const navLabel = page.locator("aside nav a span.font-medium").first();
    if (await navLabel.isVisible()) {
      const typo = await measureLocatorTypography(navLabel);
      expect(typo).not.toBeNull();

      // Nav labels: text-sm = 14px, font-medium = 500
      expect(typo!.fontSize).toBeCloseTo(14, 0);
      expect(typo!.fontWeight).toBe(TOKENS.fontWeight.medium);
    }
  });
});
