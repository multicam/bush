import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-03: View Dashboard", () => {
  test("dashboard loads with heading and stats", async ({ authedPage: page }) => {
    await expect(page).toHaveURL(/\/dashboard/);

    // Dashboard heading
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await captureScreenshot(page, "03-dashboard");
  });

  test("sidebar navigation is present", async ({ authedPage: page }) => {
    // Sidebar may be collapsed (icon-only) or expanded
    // Look for nav links by href rather than visible text
    const navLinks = page.locator("nav a, aside a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    await captureScreenshot(page, "03-dashboard-sidebar");
  });

  test("recent projects section visible", async ({ authedPage: page }) => {
    const recentProjects = page.getByRole("heading", { name: "Recent Projects" });
    await expect(recentProjects).toBeVisible();

    // Should show seeded projects
    await expect(page.getByText("Super Bowl Commercial").first()).toBeVisible();

    await captureScreenshot(page, "03-dashboard-recent-projects");
  });

  test("quick actions section visible", async ({ authedPage: page }) => {
    const quickActions = page.getByRole("heading", { name: "Quick Actions" });
    await expect(quickActions).toBeVisible();

    // Quick action links
    await expect(page.getByText("Upload Files").first()).toBeVisible();
    await expect(page.getByText("Create Share").first()).toBeVisible();

    await captureScreenshot(page, "03-dashboard-quick-actions");
  });

  test("notification bell in sidebar", async ({ authedPage: page }) => {
    const bell = page.getByLabel("Notifications").first();
    await expect(bell).toBeVisible();

    await captureScreenshot(page, "03-dashboard-notification-bell");
  });
});
