import { defineConfig } from "@playwright/test";

// Generated regression tests run against the target app at APP_URL.
// AppPilot invokes this project with the JSON reporter and reads results/last-run.json.
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
    baseURL: process.env.APP_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
