import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./benchmarks",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    browserName: "chromium",
    headless: true,
    actionTimeout: 10_000,
    trace: "on-first-retry",
    baseURL: "https://novagraph-test.up.railway.app/app",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
});
