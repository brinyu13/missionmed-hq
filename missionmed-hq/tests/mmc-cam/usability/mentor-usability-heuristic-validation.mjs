#!/usr/bin/env node

import { createIsolatedContext, withReviewBrowser } from '../browser/playwright-runtime.mjs';
import { PRIMARY_SUBJECT_ID } from '../browser/fixture-data.mjs';
import { withReviewServer } from '../browser/review-server.mjs';
import {
  assert,
  assertCleanProbe,
  assertEqual,
  installPageProbe,
  runChecks,
  waitForRouteReady,
} from '../browser/review-test-kit.mjs';

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser }) => {
    const context = await createIsolatedContext(browser, { viewport: { width: 1280, height: 800 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5_000);
      const probe = installPageProbe(page, review.baseUrl);

      await runChecks('MMC CAM 007 automated usability heuristics (not human usability proof)', [
        ['Today exposes exactly three first-tier conditions and at most four more', async () => {
          await open(page, review, '/mmc-private/today');
          assertEqual(await page.getByTestId('attention-list').locator(':scope > li').count(), 3, 'Today first tier is not exactly three items for the seven-item fixture');
          const disclosure = page.locator('details.attention-more');
          await disclosure.waitFor({ state: 'visible' });
          assert(/4 more/iu.test(await disclosure.locator('summary').innerText()), 'Today disclosure does not name four additional conditions');
          assertEqual(await disclosure.locator('ol > li').count(), 4, 'Today disclosure exceeds the four-more budget');
        }],
        ['top attention item presents identity, reason, due time, trust, and next action', async () => {
          const top = page.getByTestId('attention-list').locator(':scope > li').first();
          await top.getByRole('heading', { level: 3 }).waitFor({ state: 'visible' });
          assert((await top.locator('time').count()) >= 1, 'Top attention item lacks objective due time');
          assert((await top.getByRole('link').count()) + (await top.getByRole('button').count()) >= 1, 'Top attention item lacks an action');
          assert((await top.locator('.trust-row').count()) >= 1, 'Top attention item lacks trust state');
          assert((await top.innerText()).length >= 40, 'Top attention item lacks bounded explanation');
        }],
        ['Today has one dominant action in the page-intro region', async () => {
          assertEqual(await page.locator('.page-intro .button--primary').count(), 1, 'Today page intro has competing dominant actions');
        }],
        ['student workspace keeps one-minute brief, continuity, and publication boundary distinct', async () => {
          await open(page, review, `/mmc-private/students/${PRIMARY_SUBJECT_ID}/overview`);
          await page.getByRole('heading', { level: 2, name: 'One-minute brief' }).waitFor({ state: 'visible' });
          await page.getByTestId('continuity-thread').waitFor({ state: 'visible' });
          await page.getByRole('heading', { level: 2, name: 'Student publication is disabled' }).waitFor({ state: 'visible' });
          assertEqual(await page.getByRole('button', { name: 'Student preview unavailable' }).isDisabled(), true, 'Disabled publication boundary became interactive');
        }],
        ['Reviews selects one consequential decision and does not bulk approve', async () => {
          await open(page, review, '/mmc-private/reviews');
          await page.getByTestId('reviews-workspace').waitFor({ state: 'visible' });
          assertEqual(await page.getByText(/bulk approve/iu).count(), 0, 'Review UI exposes bulk-approval language');
          assertEqual(await page.getByTestId('reviews-workspace').getByRole('button', { name: /Commit this decision/u }).count(), 1, 'Review workspace lacks one bounded decision command');
        }],
        ['Operations remains a separate capability-gated destination', async () => {
          await open(page, review, '/mmc-private/operations');
          await page.getByRole('heading', { level: 1, name: 'Operations' }).waitFor({ state: 'visible' });
          assert((await page.locator('main').innerText()).includes('Capability-gated'), 'Operations does not name its capability boundary');
          await open(page, review, '/mmc-private/today');
          assertEqual(await page.locator('main').getByText(/provider|dead letter|job trace/iu).count(), 0, 'Operations mechanics leaked into Today');
        }],
        ['person scoring, gamification, and Partner Demo language are absent', async () => {
          const sourceText = await page.locator('body').innerText();
          for (const pattern of [/\brisk score\b/iu, /\breadiness score\b/iu, /\bxp\b/iu, /\blevel up\b/iu, /\bleaderboard\b/iu, /\bpartner demo\b/iu]) {
            assert(!pattern.test(sourceText), `Rejected product language is visible: ${pattern}`);
          }
        }],
        ['browser stayed same-origin without runtime failures', async () => {
          assertCleanProbe(probe);
        }],
      ], {
        browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
      });

      process.stdout.write(`${JSON.stringify({
        humanUsabilityClaim: 'NOT_RUN',
        fiveSecondComprehensionClaim: 'NOT_RUN',
        mentorTaskTimingClaim: 'NOT_RUN',
        resultMeaning: 'Automated structure and wording heuristics only; Founder and representative mentor review remain required.',
      })}\n`);
    } finally {
      await context.close();
    }
  });
});

async function open(page, review, route) {
  await page.goto(review.url(route), { waitUntil: 'domcontentloaded' });
  await waitForRouteReady(page);
}
