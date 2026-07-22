#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createIsolatedContext, withReviewBrowser } from '../browser/playwright-runtime.mjs';
import { PRIMARY_SESSION_ID, PRIMARY_SUBJECT_ID } from '../browser/fixture-data.mjs';
import { withReviewServer } from '../browser/review-server.mjs';
import {
  assert,
  assertCleanProbe,
  assertNoHorizontalOverflow,
  installPageProbe,
  parseCliArgs,
  waitForRouteReady,
} from '../browser/review-test-kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const options = parseCliArgs();
const outputRoot = path.resolve(options.output || path.join(HERE, 'evidence', 'mentor-007'));
const capturedAt = new Date().toISOString();
const entries = [];
let totalBytes = 0;

await ensureDiskHeadroom(outputRoot);
await fs.mkdir(outputRoot, { recursive: true });

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser }) => {
    const engineVersion = await browser.version();
    const todayViewports = [
      [1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [320, 740],
    ];
    for (const [width, height] of todayViewports) {
      await capture({ browser, review, engineVersion, id: `today-${width}x${height}`, route: '/mmc-private/today', width, height });
    }

    const routeSet = [
      ['students', '/mmc-private/students'],
      ['student-overview', `/mmc-private/students/${PRIMARY_SUBJECT_ID}/overview`],
      ['call-prep', `/mmc-private/students/${PRIMARY_SUBJECT_ID}/prep`],
      ['work', '/mmc-private/work'],
      ['reviews', '/mmc-private/reviews'],
      ['operations', '/mmc-private/operations'],
      ['long-transcript', `/mmc-private/students/${PRIMARY_SUBJECT_ID}/history/sessions/${PRIMARY_SESSION_ID}`, 'long-transcript'],
      ['long-rtl', `/mmc-private/students/${PRIMARY_SUBJECT_ID}/overview`, 'long-rtl'],
    ];
    for (const [id, route, scenario = 'default'] of routeSet) {
      await capture({ browser, review, engineVersion, id: `${id}-1280x800`, route, scenario, width: 1280, height: 800 });
    }

    for (const scenario of ['loading', 'empty', 'partial', 'stale', 'error', 'revoked']) {
      await capture({
        browser,
        review,
        engineVersion,
        id: `state-${scenario}-390x844`,
        route: '/mmc-private/today',
        scenario,
        width: 390,
        height: 844,
        loadingCapture: scenario === 'loading',
      });
    }
    for (const scenario of ['offline-not-saved', 'conflict']) {
      await capture({
        browser,
        review,
        engineVersion,
        id: `state-${scenario}-390x844`,
        route: '/mmc-private/students',
        scenario,
        width: 390,
        height: 844,
        commandState: true,
      });
    }
  });
});

entries.sort((left, right) => left.id.localeCompare(right.id));
const manifest = {
  schemaVersion: 1,
  title: 'MMC CAM 007 Founder Review Screenshot Manifest',
  capturedAt,
  dataClassification: 'SYNTHETIC_ONLY',
  productionConnections: false,
  captureSurface: 'viewport only; browser chrome excluded',
  browserClaim: entries[0]?.browser || 'NOT_CAPTURED',
  axeClaim: 'NOT_RUN',
  voiceOverClaim: 'NOT_RUN',
  humanUsabilityClaim: 'NOT_RUN',
  totalFiles: entries.length,
  totalBytes,
  entries,
};
await fs.writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await fs.writeFile(path.join(outputRoot, 'CHECKSUMS.sha256'), `${entries.map((entry) => `${entry.sha256}  ${entry.file}`).join('\n')}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  outputRoot,
  screenshotCount: entries.length,
  totalBytes,
  manifest: path.join(outputRoot, 'manifest.json'),
  checksums: path.join(outputRoot, 'CHECKSUMS.sha256'),
}, null, 2)}\n`);

async function capture({
  browser,
  review,
  engineVersion,
  id,
  route,
  scenario = 'default',
  width,
  height,
  loadingCapture = false,
  commandState = false,
}) {
  const context = await createIsolatedContext(browser, { viewport: { width, height } });
  try {
    const page = await context.newPage();
    const probe = installPageProbe(page, review.baseUrl);
    await page.goto(review.url(route, scenario), { waitUntil: 'domcontentloaded' });
    let expectedState = null;
    if (loadingCapture) {
      expectedState = 'loading';
      await page.getByTestId('state-loading').waitFor({ state: 'visible', timeout: 700 });
    } else {
      await waitForRouteReady(page, { timeout: 15_000 });
      if (commandState) {
        await attemptQuickCapture(page, `${scenario} screenshot fixture draft.`);
        expectedState = scenario === 'offline-not-saved' ? 'OFFLINE_NOT_SAVED' : 'CONFLICT';
        await page.locator(`#save-status[data-state="${expectedState}"]`).waitFor({ state: 'visible' });
        await page.locator('.command-error').waitFor({ state: 'visible' });
      }
      await assertNoHorizontalOverflow(page);
    }
    await page.getByTestId('environment-badge').waitFor({ state: 'visible' });
    const environmentBadge = (await page.getByTestId('environment-badge').innerText()).trim();
    const authorityUnavailable = loadingCapture || ['error', 'revoked'].includes(scenario);
    assert(authorityUnavailable
      ? environmentBadge.toLowerCase().includes('unconfirmed')
      : environmentBadge.toLowerCase().includes('fixture'),
    `${id} has an unexpected visible environment badge: ${environmentBadge}`);
    assertCleanProbe(probe, {
      allowHttpStatuses: scenario === 'error' || scenario === 'offline-not-saved' ? [503] : scenario === 'revoked' ? [403] : scenario === 'conflict' ? [409] : [],
      allowConsolePatterns: expectedStatusForScenario(scenario)
        ? [expectedResourceConsole(expectedStatusForScenario(scenario))]
        : [],
    });

    const file = `${id}.jpg`;
    const absolutePath = path.join(outputRoot, file);
    await page.screenshot({
      path: absolutePath,
      type: 'jpeg',
      quality: 72,
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
    });
    const bytes = await fs.readFile(absolutePath);
    totalBytes += bytes.length;
    assert(totalBytes <= 40 * 1024 * 1024, `Screenshot evidence exceeded the 40 MiB safety cap: ${totalBytes}`);
    entries.push({
      id,
      file,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      route,
      scenario,
      expectedState,
      viewport: { width, height },
      browser: `Chromium via local system Google Chrome (${engineVersion})`,
      visibleEnvironmentBadge: environmentBadge,
      dataClassification: 'SYNTHETIC_ONLY',
      productionConnections: false,
    });
  } finally {
    await context.close();
  }
}

async function attemptQuickCapture(page, value) {
  await page.getByRole('button', { name: 'Quick capture' }).first().click();
  const dialog = page.getByTestId('quick-capture-dialog');
  await dialog.getByLabel('Student').selectOption({ index: 1 });
  await dialog.getByLabel('Capture type', { exact: true }).selectOption('MENTOR_TASK');
  await dialog.getByRole('textbox', { name: 'Capture', exact: true }).fill(value);
  await dialog.getByRole('button', { name: 'Save mentor draft' }).click();
}

function expectedStatusForScenario(scenario) {
  if (scenario === 'error' || scenario === 'offline-not-saved') return 503;
  if (scenario === 'revoked') return 403;
  if (scenario === 'conflict') return 409;
  return 0;
}

function expectedResourceConsole(status) {
  return new RegExp(`Failed to load resource: the server responded with a status of ${status}\\b`, 'u');
}

async function ensureDiskHeadroom(target) {
  const nearest = path.dirname(target);
  await fs.mkdir(nearest, { recursive: true });
  const stats = await fs.statfs(nearest);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  assert(freeBytes >= 1024 * 1024 * 1024, `Screenshot capture requires at least 1 GiB free; found ${freeBytes} bytes.`);
}
