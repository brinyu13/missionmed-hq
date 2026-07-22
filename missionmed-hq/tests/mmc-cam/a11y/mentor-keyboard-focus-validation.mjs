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

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser }) => {
    const context = await createIsolatedContext(browser, {
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5_000);
      const probe = installPageProbe(page, review.baseUrl);
      await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
      await waitForRouteReady(page);

      await runChecks('MMC CAM 007 keyboard and focus browser validation', [
        ['semantic landmarks and unique IDs are present', async () => {
          assertEqual(await page.locator('main').count(), 1, 'CAM must expose exactly one main landmark');
          assertEqual(await page.locator('aside[aria-label]').count(), 1, 'CAM mentor rail landmark is missing');
          assert((await page.locator('nav[aria-label]').count()) >= 2, 'CAM primary/mobile navigation landmarks are missing');
          const duplicateIds = await page.evaluate(() => {
            const counts = new Map();
            document.querySelectorAll('[id]').forEach((node) => counts.set(node.id, (counts.get(node.id) || 0) + 1));
            return [...counts.entries()].filter(([, count]) => count > 1);
          });
          assertEqual(duplicateIds.length, 0, `Duplicate DOM IDs found: ${JSON.stringify(duplicateIds)}`);
        }],
        ['skip link is first and moves focus to main content', async () => {
          assertEqual(await page.evaluate(() => {
            const focusable = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
              .find((node) => !node.hidden && node.getClientRects().length);
            return focusable?.classList.contains('skip-link');
          }), true, 'Skip link is not the first keyboard target in document order');
          await page.locator('.skip-link').focus();
          await page.keyboard.press('Enter');
          assertEqual(await page.evaluate(() => {
            const main = document.getElementById('main-content');
            return Boolean(main && document.activeElement && (document.activeElement === main || main.contains(document.activeElement)));
          }), true, 'Skip link did not move focus into the main-content destination');
        }],
        ['command palette opens from keyboard and Escape restores focus', async () => {
          const dialog = page.getByTestId('command-palette');
          const opener = page.locator('[data-action="open-palette"]:visible').first();
          try {
            await opener.focus();
            await page.keyboard.press('Meta+K');
            await dialog.waitFor({ state: 'visible' });
            assertEqual(await dialog.evaluate((node) => node.open), true, 'Command palette is not modal-open');
            await page.waitForTimeout(50);
            assertEqual(await page.evaluate(() => document.activeElement?.id), 'palette-search', 'Palette search did not receive focus');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(50);
            assertEqual(await dialog.evaluate((node) => node.open), false, 'Escape did not close command palette');
            assertEqual(await opener.evaluate((node) => document.activeElement === node), true, 'Palette did not restore focus to its opener');
          } finally {
            await dialog.evaluate((node) => { if (node.open) node.close(); }).catch(() => {});
          }
        }],
        ['quick capture dialog has named fields and contains focus', async () => {
          const opener = page.getByRole('button', { name: 'Quick capture' }).first();
          const dialog = page.getByTestId('quick-capture-dialog');
          try {
            await opener.click();
            await dialog.waitFor({ state: 'visible' });
            await dialog.getByLabel('Student', { exact: true }).waitFor();
            await dialog.getByLabel('Capture type', { exact: true }).waitFor();
            await dialog.getByRole('textbox', { name: 'Capture', exact: true }).waitFor();
            await page.keyboard.press('Tab');
            assertEqual(await page.evaluate(() => document.activeElement?.closest('dialog')?.id), 'quick-capture-dialog', 'Focus escaped the modal dialog');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.getElementById('quick-capture-dialog')?.open);
          } finally {
            await dialog.evaluate((node) => { if (node.open) node.close(); }).catch(() => {});
          }
        }],
        ['client route change exposes a focused route heading', async () => {
          await page.getByTestId('cam-rail').getByRole('link', { name: /Students/u }).click();
          await waitForRouteReady(page);
          await page.waitForFunction(() => document.activeElement?.id === 'route-heading', null, { timeout: 1_000 });
          assertEqual(await page.evaluate(() => document.activeElement?.id), 'route-heading', 'Route change did not focus its heading');
          assertEqual(await page.getByTestId('route-heading').textContent(), 'Students', 'Focused route heading does not identify the route');
        }],
        ['interactive controls have accessible names', async () => {
          const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea')]
            .filter((node) => !node.hidden && node.getClientRects().length)
            .filter((node) => {
              const label = node.getAttribute('aria-label')
                || node.getAttribute('title')
                || (node.id && document.querySelector(`label[for="${CSS.escape(node.id)}"]`)?.textContent)
                || node.textContent
                || node.getAttribute('placeholder');
              return !String(label || '').trim();
            })
            .map((node) => node.outerHTML.slice(0, 160)));
          assertEqual(unnamed.length, 0, `Unnamed interactive controls found: ${unnamed.join(' | ')}`);
        }],
        ['reduced-motion preference leaves no active nonessential animation', async () => {
          assertEqual(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true, 'Reduced-motion emulation is not active');
          await page.waitForTimeout(100);
          const animations = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length);
          assertEqual(animations, 0, 'Nonessential animations remain active under reduced motion');
        }],
        ['200 percent effective-width proxy has no horizontal page overflow', async () => {
          await page.setViewportSize({ width: 640, height: 800 });
          await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          await assertNoHorizontalOverflow(page);
        }],
        ['browser stayed same-origin without console or page errors', async () => {
          assertCleanProbe(probe);
        }],
      ], {
        browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
        axeClaim: 'NOT_INSTALLED_NOT_RUN',
      });
    } finally {
      await context.close();
    }
  });
});
