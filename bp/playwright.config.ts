import { defineConfig, devices } from "@playwright/test";

/**
 * BP (Back-Pressure) Playwright configuration
 *
 * Runs use case specs sequentially against a running DEMO_MODE dev server.
 * Assumes: DEMO_MODE=true bun run dev is already running.
 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["html", { outputFolder: "./results/html-report" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "on",
    trace: "on-first-retry",
    video: "off",
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: "bp-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  outputDir: "./results/test-results",
});
