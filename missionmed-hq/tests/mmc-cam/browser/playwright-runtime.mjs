import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PLAYWRIGHT_ENTRY = '/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const CHROME_CANDIDATES = Object.freeze([
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]);

export async function resolveBrowserRuntime() {
  const playwrightEntry = path.resolve(process.env.MMC_PLAYWRIGHT_ENTRY || DEFAULT_PLAYWRIGHT_ENTRY);
  const chromeExecutable = process.env.MMC_CHROME_EXECUTABLE
    ? path.resolve(process.env.MMC_CHROME_EXECUTABLE)
    : await firstExecutable(CHROME_CANDIDATES);
  await assertFile(playwrightEntry, 'Playwright runtime');
  await assertFile(chromeExecutable, 'system Chrome');
  const module = await import(pathToFileURL(playwrightEntry).href);
  if (!module?.chromium?.launch) throw new Error('Resolved Playwright runtime does not expose chromium.launch().');
  return Object.freeze({ chromium: module.chromium, playwrightEntry, chromeExecutable });
}

export async function launchReviewBrowser({ headed = false, slowMo = 0 } = {}) {
  const runtime = await resolveBrowserRuntime();
  const browser = await runtime.chromium.launch({
    executablePath: runtime.chromeExecutable,
    headless: !headed,
    slowMo,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-features=OptimizationHints,MediaRouter,Translate',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--password-store=basic',
      '--use-mock-keychain',
    ],
  });
  return Object.freeze({ browser, runtime });
}

export async function withReviewBrowser(options, callback) {
  const launch = await launchReviewBrowser(options);
  try {
    return await callback(launch);
  } finally {
    await launch.browser.close();
  }
}

export async function createIsolatedContext(browser, {
  viewport = { width: 1280, height: 800 },
  reducedMotion = 'reduce',
  locale = 'en-US',
} = {}) {
  return browser.newContext({
    viewport,
    locale,
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    reducedMotion,
    serviceWorkers: 'block',
    acceptDownloads: false,
    permissions: [],
  });
}

async function firstExecutable(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue through the bounded, known local candidates.
    }
  }
  return '';
}

async function assertFile(candidate, label) {
  if (!candidate) throw new Error(`${label} is unavailable.`);
  try {
    const stats = await fs.stat(candidate);
    if (!stats.isFile()) throw new Error('not a file');
  } catch (error) {
    throw new Error(`${label} is unavailable at ${candidate}: ${error.message}`);
  }
}
