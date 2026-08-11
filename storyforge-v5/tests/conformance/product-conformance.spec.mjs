import { test, expect } from '@playwright/test';

import {
  CONFORMANCE_VIEWPORTS,
  PRODUCT_SURFACES,
} from './authority-contract.mjs';
import {
  assertCanonicalAuthority,
  assertMarkers,
  compareSurfacePair,
  loginCandidate,
  openCandidateSurface,
  openCanonicalPage,
  openCanonicalSurface,
  seedConformanceData,
  settle,
} from './helpers/harness.mjs';

let seed;

test.beforeAll(async ({ request }) => {
  await assertCanonicalAuthority();
  seed = await seedConformanceData(request);
});

for (const viewport of CONFORMANCE_VIEWPORTS) {
  test.describe(`[B1-503] ${viewport.key} canonical comparison`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const [surfaceKey, contract] of Object.entries(PRODUCT_SURFACES)) {
      test(`${contract.label} matches Founder-approved V5`, async ({
        browser,
        page,
      }, testInfo) => {
        const canonical = await openCanonicalPage(browser, {
          width: viewport.width,
          height: viewport.height,
        });
        try {
          await openCanonicalSurface(canonical.page, surfaceKey);
          await openCandidateSurface(page, surfaceKey, seed);
          await compareSurfacePair(
            testInfo,
            surfaceKey,
            viewport.key,
            canonical.page,
            page,
          );

          await assertMarkers(canonical.page, surfaceKey);
          await assertMarkers(page, surfaceKey, { soft: true, production: true });

          const expectedCandidateSelector = {
            route: '#main section',
            story: '#room.open .roomSheet, #room.open [role="dialog"]',
            capture: '#capture.open .capSheet, #capture.open [role="dialog"]',
            'quick-look': '#quick.open .drawer, #quick.open [role="dialog"]',
            'quick-review': '#quick.open .drawer, #quick.open [role="dialog"]',
            'question-workshop': '#main section[data-view="qshop"]',
            'mentor-student': '#main section[data-view="mstudent"]',
            teaching: '#teach.open [role="dialog"]',
            session: '#sesh.on',
          }[contract.kind];
          if (expectedCandidateSelector) {
            await expect.soft(
              page.locator(expectedCandidateSelector).first(),
              `${contract.label} production surface at ${viewport.key}`,
            ).toBeVisible();
          }

          if (surfaceKey === 'interview_prep') {
            const bars = await page.locator('.famBar').evaluateAll((nodes) => nodes.map((node) => ({
              height: node.getBoundingClientRect().height,
              value: Number(node.value),
              max: Number(node.max),
            })));
            expect(bars.length).toBeGreaterThan(0);
            expect(
              bars.every(({ height, value, max }) => (
                height >= 5 && height <= 8 && max === 100 && value >= 0 && value <= max
              )),
              'family coverage remains a canonical six-pixel progress bar',
            ).toBe(true);
          }

          if (surfaceKey === 'settings') {
            const geometry = await page.locator('section[data-view="settings"]').evaluate(
              (section) => ({
                width: section.getBoundingClientRect().width,
                cardWidths: [...section.querySelectorAll('.bgCard')]
                  .map((card) => card.getBoundingClientRect().width),
              }),
            );
            expect(geometry.width, 'canonical settings content width')
              .toBeLessThanOrEqual(900);
            // B1-514 adds the two Founder-approved Ember Storm and Lumen Drift
            // environments to the six canonical V5 choices.
            expect(geometry.cardWidths.length).toBe(8);
            expect(
              geometry.cardWidths.every((width) => width >= 190),
              'background cards retain the canonical readable grid',
            ).toBe(true);
          }

          if (surfaceKey === 'teaching_mode') {
            const geometry = await page.evaluate(() => ({
              selectBackgrounds: [...document.querySelectorAll('.tBar .tSel')]
                .map((select) => getComputedStyle(select).backgroundColor),
              segmentSizes: [...document.querySelectorAll('.aDim .segs button')]
                .map((segment) => {
                  const box = segment.getBoundingClientRect();
                  return { width: box.width, height: box.height };
                }),
            }));
            expect(
              geometry.selectBackgrounds.every((color) => color !== 'rgb(255, 255, 255)'),
              'Teaching Mode selectors use the canonical dark treatment',
            ).toBe(true);
            expect(geometry.segmentSizes.length).toBeGreaterThan(0);
            expect(
              geometry.segmentSizes.every(({ width, height }) => width >= 24 && height >= 8),
              'Teaching Mode craft segments remain visible and operable',
            ).toBe(true);
          }
        } finally {
          await canonical.context.close();
        }
      });
    }
  });
}

test('[B1-503] overlays are keyboard-operable, modal, and return focus', async ({ page }) => {
  await loginCandidate(page, 'student');

  const captureOpener = page.locator('[data-open-capture]').first();
  await expect(captureOpener).toBeVisible();
  await captureOpener.focus();
  await page.keyboard.press('Enter');

  const captureDialog = page.locator('#capture.open [role="dialog"][aria-modal="true"]').first();
  await expect(captureDialog).toBeVisible();
  await expect(captureDialog).toContainText(/Save story/i);
  expect(await captureDialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('#capture')).not.toHaveClass(/\bopen\b/);
  await expect(captureOpener).toBeFocused();

  await page.keyboard.press('n');
  await expect(page.locator('#capture.open')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press('/');
  await expect(page.locator('#libQ')).toBeFocused();

  await page.locator('[data-nav="library"]').first().click();
  const quickOpener = page.locator('[data-open-quick]').first();
  await expect(quickOpener).toBeVisible();
  await quickOpener.focus();
  await quickOpener.click();
  const quickDialog = page.locator('#quick.open [role="dialog"][aria-modal="true"]').first();
  await expect(quickDialog).toBeVisible();

  const centering = await quickDialog.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      horizontalDelta: Math.abs((box.left + box.width / 2) - innerWidth / 2),
      verticalDelta: Math.abs((box.top + box.height / 2) - innerHeight / 2),
      width: box.width,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });
  expect(centering.horizontalDelta).toBeLessThan(centering.viewportWidth * 0.08);
  expect(centering.verticalDelta).toBeLessThan(centering.viewportHeight * 0.12);
  expect(centering.width).toBeLessThan(centering.viewportWidth * 0.94);

  await page.keyboard.press('Escape');
  await expect(page.locator('#quick')).not.toHaveClass(/\bopen\b/);
  await expect(quickOpener).toBeFocused();
});

test('[B1-503] student and mentor shells remain complete at narrow widths', async ({
  browser,
}) => {
  for (const scenario of [
    { role: 'student', width: 390, required: ['Home', 'Story Library', 'Settings'] },
    { role: 'mentor', width: 320, required: ['Home', 'Students', 'Review Queue', 'Settings'] },
  ]) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: 844 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    try {
      await loginCandidate(page, scenario.role);
      for (const label of scenario.required) {
        await expect.soft(
          page.getByRole('button', { name: new RegExp(label, 'i') }).first(),
          `${scenario.role} narrow navigation exposes ${label}`,
        ).toBeVisible();
      }
      const geometry = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    } finally {
      await context.close();
    }
  }
});

test('[B1-503] production surfaces have no serious accessibility violations', async ({ page }) => {
  await loginCandidate(page, 'student');
  await page.addScriptTag({ url: '/_test/axe.js' });

  const scan = async (label) => {
    const result = await page.evaluate(async () => window.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    }));
    const serious = result.violations
      .filter((item) => ['serious', 'critical'].includes(item.impact))
      .map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => node.target),
      }));
    expect(serious, `${label} serious or critical axe violations`).toEqual([]);
  };

  await scan('student home');
  await page.locator('[data-nav="settings"]').first().click();
  await settle(page);
  await scan('settings');

  const captureOpener = page.locator('[data-open-capture]').first();
  await captureOpener.click();
  await scan('quick capture');
});
