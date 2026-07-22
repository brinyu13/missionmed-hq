#!/usr/bin/env node

import { launchReviewBrowser, createIsolatedContext } from './playwright-runtime.mjs';
import { startReviewServer } from './review-server.mjs';
import {
  assertCleanProbe,
  assertNoHorizontalOverflow,
  assertNoSensitiveBrowserText,
  installPageProbe,
  parseCliArgs,
  waitForRouteReady,
  waitForShutdownSignal,
} from './review-test-kit.mjs';

const options = parseCliArgs();
const fixture = options.fixture || 'default';
const route = options.route || '/mmc-private/today';
let review = null;
let browser = null;
let context = null;

try {
  review = await startReviewServer({ scenario: fixture });
  const launch = await launchReviewBrowser({ headed: options.headed === true });
  browser = launch.browser;
  context = await createIsolatedContext(browser, { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const probe = installPageProbe(page, review.baseUrl);
  const reviewUrl = review.url(route, fixture);

  await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' });
  await waitForRouteReady(page, { timeout: 15_000 });
  await assertNoHorizontalOverflow(page);
  await assertNoSensitiveBrowserText(page);
  assertCleanProbe(probe);

  process.stdout.write(`${JSON.stringify({
    status: 'FOUNDER_REVIEW_READY',
    dataClassification: 'SYNTHETIC_ONLY',
    productionConnections: false,
    url: reviewUrl,
    route,
    fixture,
    browser: 'local system Google Chrome via Playwright Chromium',
    command: `node missionmed-hq/tests/mmc-cam/browser/launch-mentor-review.mjs --headed --route=${route} --fixture=${fixture}`,
    shutdown: options.headed && !options.smoke ? 'Press Ctrl-C in this terminal.' : 'Automatic after smoke validation.',
  }, null, 2)}\n`);

  if (options.headed && !options.smoke) {
    await waitForShutdownSignal({ durationMs: options.durationMs });
  }
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (review) await review.close().catch(() => {});
}
