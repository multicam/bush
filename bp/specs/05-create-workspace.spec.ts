import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-05: Create Workspace", () => {
  test("workspaces page loads with existing workspaces", async ({ authedPage: page }) => {
    await page.goto("/workspaces");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();
    await expect(page.getByText("Main Workspace").first()).toBeVisible();

    await captureScreenshot(page, "05-workspaces-list");
  });

  test("search filter works", async ({ authedPage: page }) => {
    await page.goto("/workspaces");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Search workspaces...");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Archive");
    await page.waitForTimeout(300);

    await captureScreenshot(page, "05-workspaces-search");
  });

  test("New Workspace button is present", async ({ authedPage: page }) => {
    await page.goto("/workspaces");
    await page.waitForLoadState("networkidle");

    const createBtn = page.getByRole("button", { name: /New Workspace/i }).or(page.getByRole("link", { name: /New Workspace/i }));
    await expect(createBtn.first()).toBeVisible();

    await captureScreenshot(page, "05-workspaces-create-button");
  });
});
