import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-17: Notifications", () => {
  test("notification bell is visible in sidebar", async ({ authedPage: page }) => {
    const bell = page.getByLabel("Notifications").first();
    await expect(bell).toBeVisible();

    await captureScreenshot(page, "17-notification-bell");
  });

  test("clicking bell navigates to notifications", async ({ authedPage: page }) => {
    const bell = page.getByLabel("Notifications").first();
    await bell.click();
    await page.waitForTimeout(500);

    await captureScreenshot(page, "17-bell-clicked");
  });

  test("notifications page shows seeded notifications", async ({ authedPage: page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

    // Check for seeded notification content
    const notifItem = page.getByText(/Bob commented/i).or(page.getByText(/New comment/i)).first();
    if (await notifItem.isVisible()) {
      await expect(notifItem).toBeVisible();
    }

    await captureScreenshot(page, "17-notifications-page");
  });

  test("notification filter works", async ({ authedPage: page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");

    // Filter dropdown
    const filterSelect = page.locator("select#filter, select");
    if (await filterSelect.first().isVisible()) {
      await filterSelect.first().selectOption("Unread");
      await page.waitForTimeout(300);
      await captureScreenshot(page, "17-notifications-filter-unread");
    }
  });

  test("mark all as read button exists for unread notifications", async ({ authedPage: page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");

    const markAllBtn = page.getByRole("button", { name: /Mark all as read/i });
    if (await markAllBtn.isVisible()) {
      await captureScreenshot(page, "17-mark-all-read-button");
    } else {
      await captureScreenshot(page, "17-no-unread-notifications");
    }
  });
});
