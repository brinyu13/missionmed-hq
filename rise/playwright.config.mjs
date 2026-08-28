import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export default defineConfig({
  testDir: path.join(here, "tests/browser"),
  outputDir: "/tmp/p1-rise-5003-playwright",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(root, "../_AI_HANDOFFS/from_codex/P1_RISE_5007_PRIVATE_BETA_FULL_REGISTRY_STUDENT_INTEL/artifacts/playwright-report.json") }],
  ],
  webServer: process.env.RISE_BASE_URL ? undefined : {
    command: "node tests/browser/fixture-server.mjs",
    url: "http://127.0.0.1:4178/api/rise/v1/health",
    reuseExistingServer: false,
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.RISE_BASE_URL || "http://127.0.0.1:4178",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
