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
  retries: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Run E2E against a PRODUCTION build, not `next dev`. The dev server compiles
    // routes on first hit, so under a serial 23-test run cold routes intermittently
    // time out (flaky for environmental, not code, reasons). A built server has no
    // cold compiles → fast + deterministic (23/23 in ~2 min). reuseExistingServer
    // lets you point at an already-running `npm start` for quick local iteration.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    timeout: 300_000,
    reuseExistingServer: true,
  },
});
