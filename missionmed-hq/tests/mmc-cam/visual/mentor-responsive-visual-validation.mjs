#!/usr/bin/env node

import { createIsolatedContext, withReviewBrowser } from '../browser/playwright-runtime.mjs';
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

const VIEWPORTS = Object.freeze([
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]);

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser }) => {
    await runChecks('MMC CAM 007 responsive and visual-structure browser validation', [
      ['all six required viewports render without page overflow', async () => {
        for (const viewport of VIEWPORTS) {
          await withViewport(browser, review, viewport, async ({ page, probe }) => {
            await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
            await waitForRouteReady(page);
            await assertNoHorizontalOverflow(page);
            const stage = await page.getByTestId('route-stage').boundingBox();
            assert(stage && stage.width <= viewport.width + 1, `Route stage exceeds ${viewport.width}px viewport`);
            assertCleanProbe(probe);
          });
        }
      }],
      ['desktop and tablet use rail while narrow screens use bottom navigation', async () => {
        for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
          await withViewport(browser, review, viewport, async ({ page }) => {
            await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
            await waitForRouteReady(page);
            assertEqual(await page.getByTestId('cam-rail').isVisible(), true, `Rail is hidden at ${viewport.width}px`);
            assertEqual(await page.getByTestId('mobile-nav').isVisible(), false, `Mobile nav is visible at ${viewport.width}px`);
          });
        }
        for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
          await withViewport(browser, review, viewport, async ({ page }) => {
            await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
            await waitForRouteReady(page);
            assertEqual(await page.getByTestId('cam-rail').isVisible(), false, `Rail is visible at ${viewport.width}px`);
            assertEqual(await page.getByTestId('mobile-nav').isVisible(), true, `Mobile nav is hidden at ${viewport.width}px`);
            assertEqual(await page.getByTestId('mobile-nav').getByRole('link').count(), 4, 'Mobile nav lost a primary destination');
            await page.getByTestId('mobile-nav').getByRole('button', { name: /More/u }).waitFor({ state: 'visible' });
          });
        }
      }],
      ['mobile primary controls meet bounded touch-target sizing', async () => {
        await withViewport(browser, review, { width: 390, height: 844 }, async ({ page }) => {
          await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          const boxes = await page.getByTestId('mobile-nav').locator('a,button').evaluateAll((nodes) => nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { width: rect.width, height: rect.height, name: node.textContent?.trim() || node.getAttribute('aria-label') };
          }));
          for (const box of boxes) {
            assert(box.width >= 44 && box.height >= 44, `Mobile control is below 44px target: ${JSON.stringify(box)}`);
          }
        });
      }],
      ['landscape mobile and 200 percent effective-width proxy preserve capability', async () => {
        for (const viewport of [{ width: 844, height: 390 }, { width: 640, height: 800 }]) {
          await withViewport(browser, review, viewport, async ({ page }) => {
            await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
            await waitForRouteReady(page);
            await assertNoHorizontalOverflow(page);
            await page.getByRole('heading', { level: 1, name: 'Today' }).waitFor({ state: 'visible' });
            await page.getByRole('link', { name: /Students/u }).last().waitFor({ state: 'visible' });
          });
        }
      }],
      ['long RTL and Unicode content wraps without route overflow', async () => {
        await withViewport(browser, review, { width: 320, height: 740 }, async ({ page, probe }) => {
          await page.goto(review.url('/mmc-private/students', 'long-rtl'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          await assertNoHorizontalOverflow(page);
          await page.getByText(/آمنة عبد الرحمن/u).waitFor({ state: 'visible' });
          assertCleanProbe(probe);
        });
      }],
      ['core text remains readable without microtype', async () => {
        await withViewport(browser, review, { width: 390, height: 844 }, async ({ page }) => {
          await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          const undersized = await page.evaluate(() => [...document.querySelectorAll('main p, main li, main button, main a')]
            .filter((node) => node.getClientRects().length && !node.classList.contains('eyebrow'))
            .map((node) => ({ node, px: Number.parseFloat(getComputedStyle(node).fontSize) }))
            .filter((entry) => entry.px < 12)
            .map((entry) => ({ tag: entry.node.tagName, className: entry.node.className, px: entry.px })));
          assertEqual(undersized.length, 0, `Readable content falls below 12px: ${JSON.stringify(undersized)}`);
        });
      }],
    ], {
      browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
    });
  });
});

async function withViewport(browser, review, viewport, callback) {
  const context = await createIsolatedContext(browser, { viewport });
  try {
    const page = await context.newPage();
    const probe = installPageProbe(page, review.baseUrl);
    await callback({ page, probe });
  } finally {
    await context.close();
  }
}
