import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-06: Create Project", () => {
  test("projects page has New Project button", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const createBtn = page.getByRole("button", { name: /New Project/i }).or(page.getByRole("link", { name: /New Project/i }));
    await expect(createBtn.first()).toBeVisible();

    await captureScreenshot(page, "06-projects-new-project-button");
  });

  test("dashboard also has New Project action", async ({ authedPage: page }) => {
    const newProjectBtn = page.getByRole("button", { name: /New Project/i }).or(page.getByRole("link", { name: /New Project/i }));
    await expect(newProjectBtn.first()).toBeVisible();

    await captureScreenshot(page, "06-dashboard-new-project");
  });
});
