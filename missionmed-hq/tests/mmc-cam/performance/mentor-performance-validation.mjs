#!/usr/bin/env node

import { createIsolatedContext, withReviewBrowser } from '../browser/playwright-runtime.mjs';
import { PRIMARY_SESSION_ID, PRIMARY_SUBJECT_ID } from '../browser/fixture-data.mjs';
import { withReviewServer } from '../browser/review-server.mjs';
import {
  assert,
  assertCleanProbe,
  assertEqual,
  assertNoHorizontalOverflow,
  installPageProbe,
  runChecks,
  waitForRouteReady,
} from '../browser/review-test-kit.mjs';

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser }) => {
    const context = await createIsolatedContext(browser, { viewport: { width: 1280, height: 800 } });
    try {
      const page = await context.newPage();
      const probe = installPageProbe(page, review.baseUrl);
      const timings = {};

      await runChecks('MMC CAM 007 performance and bounded-scale browser validation', [
        ['Today local fixture reaches ready state under two seconds', async () => {
          const started = performance.now();
          await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          timings.todayReadyMs = Math.round(performance.now() - started);
          assert(timings.todayReadyMs < 2_000, `Today ready time exceeded local release target: ${timings.todayReadyMs}ms`);
        }],
        ['scale query proves 1000 students with bounded page', async () => {
          const result = await browserQuery(page, '/api/mmc/v2/mentor/students?limit=100', 'scale');
          assertEqual(result.status, 200, 'Scale student query failed');
          assertEqual(result.payload.data.total, 1000, 'Scale student total drifted');
          assertEqual(result.payload.data.students.length, 100, 'Scale student page is not bounded to 100');
          assert(result.durationMs < 2_000, `Scale student query exceeded 2s: ${result.durationMs}ms`);
        }],
        ['scale query proves 10000 work items with bounded page', async () => {
          const result = await browserQuery(page, '/api/mmc/v2/mentor/work?limit=100', 'scale');
          assertEqual(result.status, 200, 'Scale work query failed');
          assertEqual(result.payload.data.total, 10_000, 'Scale work total drifted');
          assertEqual(result.payload.data.items.length, 100, 'Scale work page is not bounded to 100');
          assert(result.durationMs < 2_000, `Scale work query exceeded 2s: ${result.durationMs}ms`);
        }],
        ['scale query proves 500 reviews with bounded page', async () => {
          const result = await browserQuery(page, '/api/mmc/v2/mentor/reviews?limit=100', 'scale');
          assertEqual(result.status, 200, 'Scale review query failed');
          assertEqual(result.payload.data.total, 500, 'Scale review total drifted');
          assertEqual(result.payload.data.items.length, 100, 'Scale review page is not bounded to 100');
          assert(result.durationMs < 2_000, `Scale review query exceeded 2s: ${result.durationMs}ms`);
        }],
        ['scale query proves 100 sessions for one student with bounded history page', async () => {
          const result = await browserQuery(page, '/api/mmc/v2/mentor/students/subject_scale_000001/history?limit=100', 'scale');
          assertEqual(result.status, 200, 'Scale history query failed');
          assertEqual(result.payload.data.sessions.length, 100, 'Scale session history count drifted');
          assert(result.durationMs < 2_000, `Scale history query exceeded 2s: ${result.durationMs}ms`);
        }],
        ['100k-character transcript-like evidence remains bounded and renderable', async () => {
          const result = await browserQuery(page, `/api/mmc/v2/mentor/students/${PRIMARY_SUBJECT_ID}/history/sessions/${PRIMARY_SESSION_ID}`, 'long-transcript');
          assertEqual(result.status, 200, 'Long transcript fixture query failed');
          const characters = result.payload.data.captures.reduce((sum, item) => sum + item.text.length, 0);
          assert(characters >= 100_000, `Long transcript fixture is below 100k characters: ${characters}`);
          assertEqual(result.payload.data.captures.length, 100, 'Long transcript fixture did not respect the 100-capture contract');
          assert(result.durationMs < 2_000, `Long transcript query exceeded 2s: ${result.durationMs}ms`);
          await page.goto(review.url(`/mmc-private/students/${PRIMARY_SUBJECT_ID}/history/sessions/${PRIMARY_SESSION_ID}`, 'long-transcript'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          await assertNoHorizontalOverflow(page);
        }],
        ['rapid client routing remains bounded', async () => {
          const durations = [];
          for (let index = 0; index < 20; index += 1) {
            const target = index % 2 ? 'Today' : 'Work';
            const started = performance.now();
            const nav = page.locator('[data-testid="cam-rail"] a').filter({ hasText: target });
            await nav.click();
            await waitForRouteReady(page);
            durations.push(performance.now() - started);
          }
          timings.routeP95Ms = Math.round(percentile(durations, 0.95));
          assert(timings.routeP95Ms < 1_000, `Client route p95 exceeded 1s: ${timings.routeP95Ms}ms`);
        }],
        ['rendered scale page remains bounded to one server page', async () => {
          await page.goto(review.url('/mmc-private/students', 'scale'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          const rows = await page.getByTestId('student-directory').locator('tbody tr').count();
          assert(rows > 0 && rows <= 100, `Scale directory rendered an unbounded row count: ${rows}`);
          await assertNoHorizontalOverflow(page);
          const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize || null);
          if (heap !== null) assert(heap < 200 * 1024 * 1024, `Scale page used more than 200 MiB JS heap: ${heap}`);
        }],
        ['browser stayed same-origin without runtime failures', async () => {
          assertCleanProbe(probe);
          process.stdout.write(`${JSON.stringify({ observedTimings: timings })}\n`);
        }],
      ], {
        browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
      });
    } finally {
      await context.close();
    }
  });
});

async function browserQuery(page, pathname, fixture) {
  return page.evaluate(async ({ pathname: path, fixture: scenario }) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('fixture', scenario);
    const started = performance.now();
    const response = await fetch(`${url.pathname}${url.search}`, { credentials: 'same-origin' });
    const payload = await response.json();
    return { status: response.status, payload, durationMs: performance.now() - started };
  }, { pathname, fixture });
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1))];
}
