import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.MOCKS_PORT ?? 3101);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e/mocks",
  reporter: [["list"]],
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_API_MOCKS: "1" },
  },
});
