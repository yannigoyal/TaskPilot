import { defineConfig, devices } from "@playwright/test";

const backendDir = "../backend";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `sh -c 'rm -f /tmp/taskpilot-e2e-dev.db && DATABASE_PATH=/tmp/taskpilot-e2e-dev.db uv run uvicorn app.main:app --hostname 127.0.0.1 --port 8000'`,
      cwd: backendDir,
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
