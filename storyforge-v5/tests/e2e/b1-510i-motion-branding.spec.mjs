import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const packageDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const screenshotDir = path.resolve(
  packageDir,
  '../_AI_HANDOFFS/from_codex/B1-510I_storyforge_august1_canonical_and_admin_console/screenshots',
);

test.describe('premium motion and branded opening', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('opening uses exact hierarchy and official bundled logo', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.storyforgeIntro')).toBeVisible();
    await expect(page.locator('.introCreator')).toHaveText("Dr Brian's IV Prep On-Call");
    await expect(page.locator('.introInstitution')).toHaveText('MissionMed Institute');
    await expect(page.locator('.introDivision')).toHaveText('Mission:Residency Division');
    await expect(page.locator('.introProduct')).toHaveText('StoryForge');
    await expect(page.locator('.introLogo')).toHaveJSProperty('complete', true);
    await page.screenshot({ path: path.join(screenshotDir, 'phase-c-intro-branding.png'), fullPage: true });
  });

  test('motion energy follows workspace and capture state without overflow', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-motion-energy', 'low');
    await page.getByRole('button', { name: /New Story/ }).first().click();
    await expect(page.locator('body')).toHaveAttribute('data-motion-energy', 'active');
    await page.screenshot({ path: path.join(screenshotDir, 'phase-c-medium-energy-capture.png'), fullPage: true });
    await page.evaluate(() => { document.body.dataset.motionEnergy = 'recording'; });
    await page.screenshot({ path: path.join(screenshotDir, 'phase-c-recording-energy-visual-check.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('static rich fallback disables all premium animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    const result = await page.evaluate(() => ({
      enabled: document.body.classList.contains('motion-enabled'),
      aurora: getComputedStyle(document.querySelector('.aur.a')).animationName,
      canvasBlank: !document.querySelector('#bgfx').getContext('2d').getImageData(0, 0, 1, 1).data.some(Boolean),
    }));
    expect(result.aurora).toBe('none');
    expect(result.canvasBlank).toBe(true);
    await page.screenshot({ path: path.join(screenshotDir, 'phase-c-reduced-motion.png'), fullPage: true });
  });
});
