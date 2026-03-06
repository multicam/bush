import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";
import { measureLocator, isOnSpacingScale, checkHBalance, TOKENS } from "../helpers/design-bench";

test.describe("Design Bench: Sidebar (Catalyst)", () => {
  test("desktop sidebar width matches Catalyst rail token", async ({ authedPage: page }) => {
    const sidebar = page.locator("div.fixed.inset-y-0.left-0.w-64").first();
    await expect(sidebar).toBeVisible();

    const box = await measureLocator(sidebar);
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error("Unable to measure desktop sidebar");
    }
    expect(box.width).toBeCloseTo(TOKENS.sidebar.width, 2);

    await captureScreenshot(page, "30-sidebar-desktop");
  });

  test("primary navigation items are visible and ordered", async ({ authedPage: page }) => {
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();

    await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Workspaces" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Projects" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Files" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Collections" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Shares" }).first()).toBeVisible();
  });

  test("sidebar item spacing uses scale-aligned balanced padding", async ({ authedPage: page }) => {
    const firstNavItem = page.locator("nav a").first();
    await expect(firstNavItem).toBeVisible();

    const itemBox = await measureLocator(firstNavItem);
    expect(itemBox).not.toBeNull();
    if (!itemBox) {
      throw new Error("Unable to measure first sidebar nav item");
    }

    const hBalance = checkHBalance(itemBox.paddingLeft, itemBox.paddingRight);
    expect(hBalance.balanced).toBe(true);
    expect(isOnSpacingScale(itemBox.paddingTop)).toBe(true);
    expect(isOnSpacingScale(itemBox.paddingBottom)).toBe(true);
  });

  test("sidebar-content proportion reflects fixed desktop rail", async ({ authedPage: page }) => {
    const sidebar = await measureLocator(page.locator("div.fixed.inset-y-0.left-0.w-64").first());
    const main = await measureLocator(page.locator("main").first());

    expect(sidebar).not.toBeNull();
    expect(main).not.toBeNull();
    if (!sidebar || !main) {
      throw new Error("Unable to measure sidebar/main layout proportion");
    }

    const ratio = sidebar.width / (sidebar.width + main.width);
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(0.3);
  });

  test("mobile layout uses drawer navigation", async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await dismissDevOverlay(page);

    const openNavButton = page.getByRole("button", { name: "Open navigation" });
    await expect(openNavButton).toBeVisible();

    await openNavButton.click();
    await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();

    await captureScreenshot(page, "30-sidebar-mobile-drawer");
  });
});
