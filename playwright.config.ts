import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E (Part B). Runs the real app against the live DB (DATA_PROVIDER=db)
 * and screenshots each verified flow into ./screenshots. One worker so the shared
 * DB stays deterministic. Each phase adds specs here alongside its unit tests.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
