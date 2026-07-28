import { defineConfig } from '@playwright/test';

import {
  CANONICAL_SHA256,
  CONFORMANCE_VIEWPORTS,
} from './tests/conformance/authority-contract.mjs';

export default defineConfig({
  testDir: './tests/conformance',
  outputDir: './.local/conformance-results',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  preserveOutput: 'always',
  metadata: {
    authoritySha256: CANONICAL_SHA256,
    comparison: 'canonical-derived visual, structural, responsive, and overflow gate',
    pixelIdentityClaimed: false,
    viewports: CONFORMANCE_VIEWPORTS,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: '.local/conformance-report', open: 'never' }],
    ['json', { outputFile: '.local/conformance-results.json' }],
  ],
  use: {
    baseURL: process.env.STORYFORGE_CONFORMANCE_BASE_URL || 'http://127.0.0.1:4193',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
