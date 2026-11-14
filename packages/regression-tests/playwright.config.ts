import { defineConfig } from "@playwright/test";

// Generated regression tests run against the target app at APP_URL.
// AppPilot invokes this project with the JSON reporter and reads the JSON from stdout.
const appUrl = process.env.APP_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [["json", { outputFile: "results/last-run.json" }], ["list"]],
  outputDir: "results/artifacts",
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // In CI (APPPILOT_CI_SHOP=1) start the demo shop with its seeded bugs switched off (APX_BUGS_DEFAULT=off),
  // so the generated tests act as a regression guard for the fixes. Locally the shop is expected to be running.
  webServer: process.env.APPPILOT_CI_SHOP
    ? {
        command: "cd ../../apps/demo-shop && APX_TEST_HOOKS=1 APX_BUGS_DEFAULT=off npm run start:prod",
        url: appUrl,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
