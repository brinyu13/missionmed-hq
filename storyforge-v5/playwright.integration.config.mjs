import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  outputDir: process.env.STORYFORGE_INTEGRATION_PLAYWRIGHT_OUTPUT_DIR
    || '.local/integration-results',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', {
      outputFolder: process.env.STORYFORGE_INTEGRATION_PLAYWRIGHT_REPORT_DIR
        || '.local/integration-report',
      open: 'never',
    }],
  ],
  use: {
    baseURL: process.env.STORYFORGE_INTEGRATION_BASE_URL || 'http://127.0.0.1:4179',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
