import { test, expect, dismissDevOverlay } from "../helpers/demo-auth";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("BP-40: UX Workflow Back-Pressure", () => {
  test("rapid route switching preserves nav shell and avoids runtime errors", async ({
    authedPage: page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.message);
    });

    const routes = [
      "/dashboard",
      "/projects",
      "/shares",
      "/notifications",
      "/workspaces",
      "/settings",
    ];

    for (let iteration = 0; iteration < 2; iteration++) {
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        await dismissDevOverlay(page);

        await expect(page.locator("nav").first()).toBeVisible();
        await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
      }
    }

    await captureScreenshot(page, "40-rapid-route-switching");
    expect(runtimeErrors).toEqual([]);
  });

  test("shortcut open/close cycles do not crash the UI", async ({ authedPage: page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.message);
    });

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Control+k");
      const palette = page.getByRole("dialog", { name: /command palette/i });
      if (await palette.isVisible().catch(() => false)) {
        const input = palette.getByPlaceholder(/Search files and commands/i);
        await input.fill(`stress-${i}`);
        await page.waitForTimeout(120);

        await page.keyboard.press("Escape");
        await expect(palette).not.toBeVisible();
      } else {
        await expect(page.getByRole("link", { name: /Projects/i }).first()).toBeVisible();
      }
    }

    await captureScreenshot(page, "40-command-palette-stress");
    expect(runtimeErrors).toEqual([]);
  });

  test("upload workflow remains responsive after repeated drawer toggles", async ({
    authedPage: page,
  }) => {
    await page.goto("/projects");
    await page.waitForLoadState("domcontentloaded");
    await dismissDevOverlay(page);

    const projectLink = page.getByRole("link", { name: /Super Bowl Commercial/i }).first();
    await projectLink.click();
    await page.waitForURL(/\/projects\/.+/);
    await page.waitForLoadState("domcontentloaded");
    await dismissDevOverlay(page);

    const uploadBtn = page.getByRole("button", { name: /Upload Files/i });
    await expect(uploadBtn).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await uploadBtn.click();
      const cancelBtn = page.getByRole("button", { name: "Cancel" });

      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }

      await expect(uploadBtn).toBeVisible();
      await expect(uploadBtn).toBeEnabled();
    }

    await captureScreenshot(page, "40-upload-drawer-stress");
  });
});
