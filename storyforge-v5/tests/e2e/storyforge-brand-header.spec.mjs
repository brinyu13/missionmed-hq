import { test, expect } from '@playwright/test';

async function openStudent(page) {
  await page.goto('/');
  const fixture = page.getByRole('button', { name: 'Student · Maya' });
  if (await fixture.count()) await fixture.click();
  await expect(page.locator('.homeHero')).toBeVisible();
}

test('brand header renders the exact approved copy and no Timeline artifacts', async ({ page }, testInfo) => {
  await openStudent(page);
  await expect(page.locator('.storyforgeBrandTitle')).toHaveText('MissionMed//Storyforge');
  await expect(page.locator('.storyforgeBrandSub')).toHaveText('MISSION:RESIDENCY DIVISION');
  await expect(page.locator('#hdr')).not.toContainText(/TIMELINE|SEASON ONE|TIMELINE OPS|\bS1\b/i);
  await page.screenshot({
    path: testInfo.outputPath('checkpoint-3-final-brand-desktop-1440x1000.png'),
    fullPage: true,
  });
});

test('Matrix return and existing StoryForge actions retain their handlers', async ({ page }) => {
  await openStudent(page);
  await expect(page.locator('.storyforgeMatrixBack')).toHaveAttribute('href', /\/member-dashboard\/$/);
  await expect(page.locator('#omni')).toBeVisible();
  await page.locator('#hdr').getByRole('button', { name: /New Story/ }).click();
  await expect(page.locator('#captureForm')).toBeVisible();
});

test('fixed header offsets the rail and main content without overlap', async ({ page }) => {
  await openStudent(page);
  const geometry = await page.evaluate(() => {
    const header = document.querySelector('#hdr').getBoundingClientRect();
    const rail = document.querySelector('#rail').getBoundingClientRect();
    const main = document.querySelector('main').getBoundingClientRect();
    return {
      headerBottom: header.bottom,
      railTop: rail.top,
      mainTop: main.top,
      bodyOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(geometry.railTop).toBeGreaterThanOrEqual(geometry.headerBottom);
  expect(geometry.mainTop).toBeGreaterThanOrEqual(geometry.headerBottom);
  expect(geometry.bodyOverflow).toBe(false);
});

test('responsive header preserves its title at laptop tablet and narrow mobile widths', async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 1100, height: 760, name: 'laptop-1100x760' },
    { width: 768, height: 1024, name: 'tablet-768x1024' },
    { width: 390, height: 844, name: 'mobile-390x844' },
    { width: 320, height: 700, name: 'narrow-320x700' },
  ]) {
    await page.setViewportSize(viewport);
    await openStudent(page);
    const title = page.locator('.storyforgeBrandTitle');
    await expect(title).toBeVisible();
    const clipping = await title.evaluate((element) => {
      const titleBox = element.getBoundingClientRect();
      const headerBox = document.querySelector('#hdr').getBoundingClientRect();
      return (
        titleBox.left < headerBox.left
        || titleBox.right > headerBox.right
        || titleBox.top < headerBox.top
        || titleBox.bottom > headerBox.bottom
      );
    });
    expect(clipping).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`checkpoint-4-${viewport.name}.png`),
      fullPage: true,
    });
  }
});

test('Quick Capture remains above the brand header and restores focus on close', async ({ page }, testInfo) => {
  await openStudent(page);
  const launch = page.locator('#hdr').getByRole('button', { name: /New Story/ });
  await launch.click();
  const dialog = page.locator('#captureForm');
  await expect(dialog).toBeVisible();
  const z = await page.evaluate(() => ({
    header: Number.parseInt(getComputedStyle(document.querySelector('#hdr')).zIndex, 10),
    capture: Number.parseInt(getComputedStyle(document.querySelector('#capture')).zIndex, 10),
  }));
  expect(z.capture).toBeGreaterThan(z.header);
  await page.screenshot({
    path: testInfo.outputPath('checkpoint-4-overlay-quick-capture.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launch).toBeFocused();
});

test('brand header retains accessible navigation, focus, and contrast checks', async ({ page }) => {
  await openStudent(page);
  await page.locator('.storyforgeMatrixBack').focus();
  await expect(page.locator('.storyforgeMatrixBack')).toBeFocused();
  await page.addScriptTag({ url: '/_test/axe.js' });
  const result = await page.evaluate(async () => window.axe.run('#hdr', {
    resultTypes: ['violations'],
  }));
  expect(result.violations.filter((finding) => (
    ['color-contrast', 'link-name', 'button-name', 'duplicate-id'].includes(finding.id)
  ))).toEqual([]);
});
