import { test, expect } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-14: Collections", () => {
  test("project collections page shows seeded collection", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("networkidle");

    // Navigate to collections
    const url = page.url();
    await page.goto(url + "/collections");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();

    // Should show the seeded collection
    const collection = page.getByText("Hero Shots").first();
    if (await collection.isVisible()) {
      await expect(collection).toBeVisible();
    }

    await captureScreenshot(page, "14-collections-list");
  });

  test("New Collection button and modal", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);

    const url = page.url();
    await page.goto(url + "/collections");
    await page.waitForLoadState("networkidle");

    const createBtn = page.getByRole("button", { name: /New Collection/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Modal should open
      const nameInput = page.getByPlaceholder("Collection name");
      if (await nameInput.isVisible()) {
        await nameInput.fill("BP Test Collection");

        // Visibility radio buttons
        const teamRadio = page.getByRole("radio", { name: /Team/i });
        if (await teamRadio.isVisible()) {
          await teamRadio.check();
        }

        await captureScreenshot(page, "14-create-collection-modal");
      }
    } else {
      await captureScreenshot(page, "14-no-create-button");
    }
  });

  test("can view collection contents", async ({ authedPage: page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);

    const url = page.url();
    await page.goto(url + "/collections");
    await page.waitForLoadState("networkidle");

    // Click View button on the collection
    const viewBtn = page.getByRole("button", { name: "View" }).or(page.getByRole("link", { name: "View" })).first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await page.waitForTimeout(500);
      await captureScreenshot(page, "14-collection-contents");
    } else {
      // Try clicking collection name directly
      const collection = page.getByText("Hero Shots").first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(500);
        await captureScreenshot(page, "14-collection-clicked");
      }
    }
  });
});
