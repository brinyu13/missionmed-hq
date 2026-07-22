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
    await runChecks('MMC CAM 007 route state matrix browser validation', [
      ['loading is explicit and does not substitute fixture content', async () => {
        await withScenarioPage(browser, review, 'loading', async ({ page, probe }) => {
          await page.goto(review.url('/mmc-private/today', 'loading'), { waitUntil: 'domcontentloaded' });
          await page.getByTestId('state-loading').waitFor({ state: 'visible', timeout: 700 });
          assertEqual((await page.locator('body').innerText()).includes('Amina Rahman'), false, 'Loading state exposed resolved fixture data early');
          await waitForRouteReady(page, { timeout: 5_000 });
          assertCleanProbe(probe);
        });
      }],
      ['empty state is explicit and avoids false safety claims', async () => {
        await withScenarioPage(browser, review, 'empty', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/today', 'empty');
          await page.getByTestId('state-empty').waitFor({ state: 'visible' });
          const text = await page.getByTestId('state-empty').innerText();
          assert(/does not|No verified|zero/iu.test(text), 'Empty state does not explain its bounded meaning');
          assertCleanProbe(probe);
        });
      }],
      ['partial state names unavailable sections while preserving available work', async () => {
        await withScenarioPage(browser, review, 'partial', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/today', 'partial');
          await page.getByTestId('state-partial').waitFor({ state: 'visible' });
          await page.getByTestId('attention-list').waitFor({ state: 'visible' });
          assertCleanProbe(probe);
        });
      }],
      ['stale state remains visible beside timestamped content', async () => {
        await withScenarioPage(browser, review, 'stale', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/today', 'stale');
          await page.getByTestId('state-stale').waitFor({ state: 'visible' });
          await page.getByTestId('attention-list').waitFor({ state: 'visible' });
          assert((await page.getByTestId('state-stale').innerText()).toLowerCase().includes('stale'), 'Stale state is not named in text');
          assertCleanProbe(probe);
        });
      }],
      ['read failure renders safe error without protected fixture detail', async () => {
        await withScenarioPage(browser, review, 'error', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/today', 'error');
          await page.getByTestId('state-error').waitFor({ state: 'visible' });
          const body = await page.locator('body').innerText();
          assert(!body.includes('Amina Rahman'), 'Error state retained protected fixture detail');
          assertCleanProbe(probe, {
            allowHttpStatuses: [503],
            allowConsolePatterns: [expectedResourceConsole(503)],
          });
        });
      }],
      ['revocation renders safe access loss without protected fixture detail', async () => {
        await withScenarioPage(browser, review, 'revoked', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/today', 'revoked');
          await page.getByTestId('state-revoked').waitFor({ state: 'visible' });
          const body = await page.locator('body').innerText();
          assert(!body.includes('Amina Rahman'), 'Revoked state retained protected fixture detail');
          assertCleanProbe(probe, {
            allowHttpStatuses: [403],
            allowConsolePatterns: [expectedResourceConsole(403)],
          });
        });
      }],
      ['offline-not-saved command keeps browser text and names persistence truth', async () => {
        await withScenarioPage(browser, review, 'offline-not-saved', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/students', 'offline-not-saved');
          await attemptQuickCapture(page, 'Offline fixture draft must remain visible.');
          await page.locator('#save-status[data-state="OFFLINE_NOT_SAVED"]').waitFor({ state: 'visible' });
          await page.locator('.command-error').getByText('Not saved', { exact: true }).waitFor({ state: 'visible' });
          assertEqual(await page.getByRole('textbox', { name: 'Capture', exact: true }).inputValue(), 'Offline fixture draft must remain visible.', 'Offline command discarded browser text');
          assertCleanProbe(probe, {
            allowHttpStatuses: [503],
            allowConsolePatterns: [expectedResourceConsole(503)],
          });
        });
      }],
      ['version conflict keeps browser text and names compare/reapply state', async () => {
        await withScenarioPage(browser, review, 'conflict', async ({ page, probe }) => {
          await openScenario(page, review, '/mmc-private/students', 'conflict');
          await attemptQuickCapture(page, 'Conflict fixture draft must remain visible.');
          await page.locator('#save-status[data-state="CONFLICT"]').waitFor({ state: 'visible' });
          await page.locator('.command-error').getByText('A newer version exists', { exact: true }).waitFor({ state: 'visible' });
          assertEqual(await page.getByRole('textbox', { name: 'Capture', exact: true }).inputValue(), 'Conflict fixture draft must remain visible.', 'Conflict command discarded browser text');
          assertCleanProbe(probe, {
            allowHttpStatuses: [409],
            allowConsolePatterns: [expectedResourceConsole(409)],
          });
        });
      }],
    ], {
      browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
    });
  });
});

async function withScenarioPage(browser, review, scenario, callback) {
  const context = await createIsolatedContext(browser, { viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const probe = installPageProbe(page, review.baseUrl);
    await callback({ page, probe });
  } finally {
    await context.close();
  }
}

async function openScenario(page, review, route, scenario) {
  await page.goto(review.url(route, scenario), { waitUntil: 'domcontentloaded' });
  await waitForRouteReady(page, { timeout: 10_000 });
  await assertNoHorizontalOverflow(page);
}

async function attemptQuickCapture(page, value) {
  await page.getByRole('button', { name: 'Quick capture' }).first().click();
  const dialog = page.getByTestId('quick-capture-dialog');
  await dialog.getByLabel('Student').selectOption({ index: 1 });
  await dialog.getByLabel('Capture type', { exact: true }).selectOption('MENTOR_TASK');
  await dialog.getByRole('textbox', { name: 'Capture', exact: true }).fill(value);
  await dialog.getByRole('button', { name: 'Save mentor draft' }).click();
}

function expectedResourceConsole(status) {
  return new RegExp(`Failed to load resource: the server responded with a status of ${status}\\b`, 'u');
}
