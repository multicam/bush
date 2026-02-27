import { test, expect } from "@playwright/test";
import { captureScreenshot } from "../helpers/screenshot";

test.describe("UC-02: Demo Login", () => {
  test("DEMO_MODE login bypasses WorkOS and redirects to dashboard", async ({ page }) => {
    // Hit the login endpoint directly
    await page.goto("/api/auth/login");

    // Should redirect straight to dashboard (no WorkOS involved)
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    await captureScreenshot(page, "02-demo-login-redirect");
  });

  test("session endpoint returns demo user data", async ({ page }) => {
    const response = await page.request.get("/api/auth/session");
    const session = await response.json();

    expect(session.isAuthenticated).toBe(true);
    expect(session.user).toBeTruthy();
    expect(session.user.email).toBe("alice@alpha.studio");
    expect(session.user.displayName).toBe("Alice Chen");
    expect(session.currentAccount).toBeTruthy();
    expect(session.currentAccount.slug).toBe("alpha-studios");
    expect(session.currentAccount.role).toBe("owner");
    expect(session.accounts.length).toBeGreaterThan(0);
  });

  test("logout in DEMO_MODE redirects to home", async ({ page }) => {
    const response = await page.request.get("/api/auth/logout", {
      maxRedirects: 0,
    });
    // Should redirect to /
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/");
  });
});
