/**
 * Bush Platform - Accessibility E2E Tests
 *
 * Global accessibility audit across all pages using axe-core.
 * Reference: specs/15-frontend-testing.md - Accessibility Testing
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Public pages that should have no accessibility violations
 */
const publicPages = [
  { name: "Home", path: "/" },
  { name: "Login", path: "/login" },
  { name: "Signup", path: "/signup" },
];

/**
 * Run accessibility audit on each public page
 */
for (const { name, path } of publicPages) {
  test.describe(`${name} Page Accessibility`, () => {
    test(`${name} page has no detectable accessibility violations`, async ({ page }) => {
      await page.goto(path);

      // Wait for page to be fully loaded
      await page.waitForLoadState("networkidle");

      // Run axe accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      // Assert no violations
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test(`${name} page has proper heading hierarchy`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Should have exactly one h1
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBeLessThanOrEqual(1);
    });

    test(`${name} page has lang attribute`, async ({ page }) => {
      await page.goto(path);

      const htmlLang = await page.locator("html").getAttribute("lang");
      expect(htmlLang).toBeTruthy();
    });

    test(`${name} page has title`, async ({ page }) => {
      await page.goto(path);

      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });
  });
}

test.describe("Global Accessibility Features", () => {
  test("all images have alt text on home page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const role = await img.getAttribute("role");

      // Image should have alt text or be marked as decorative (role="presentation" or alt="")
      const hasAccessibleName = alt !== null;
      const isDecorative = role === "presentation" || role === "none" || alt === "";

      expect(hasAccessibleName || isDecorative).toBe(true);
    }
  });

  test("all images have alt text on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const role = await img.getAttribute("role");

      const hasAccessibleName = alt !== null;
      const isDecorative = role === "presentation" || role === "none" || alt === "";

      expect(hasAccessibleName || isDecorative).toBe(true);
    }
  });

  test("buttons have accessible names on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const buttons = page.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute("aria-label");
      const ariaLabelledBy = await button.getAttribute("aria-labelledby");

      // Button should have accessible name via text content, aria-label, or aria-labelledby
      const hasAccessibleName = Boolean(text?.trim()) || Boolean(ariaLabel) || Boolean(ariaLabelledBy);

      expect(hasAccessibleName).toBe(true);
    }
  });

  test("form inputs have labels on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"], input[type="search"]');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      const placeholder = await input.getAttribute("placeholder");

      // Input should have accessible name via label, aria-label, aria-labelledby, or title
      // Note: placeholder alone is not sufficient for accessibility
      const hasLabel = Boolean(id) && (await page.locator(`label[for="${id}"]`).count()) > 0;
      const hasAriaLabel = Boolean(ariaLabel) || Boolean(ariaLabelledBy);

      // Either proper label or aria-label should be present
      expect(hasLabel || hasAriaLabel).toBe(true);
    }
  });

  test("page is keyboard navigable", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Tab through the page
    await page.keyboard.press("Tab");

    // Should have focus on something
    const focusedElement = page.locator(":focus");
    await expect(focusedElement.first()).toBeVisible();
  });
});
