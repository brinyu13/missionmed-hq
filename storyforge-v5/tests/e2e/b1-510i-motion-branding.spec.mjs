import { expect, test } from '@playwright/test';

test.describe('premium motion and branded opening', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('opening uses the exact integrated hierarchy, subtitle, and healthy bundled logo', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    await expect(page.locator('.storyforgeIntro')).toBeVisible();
    await expect(page.locator('.introCreator')).toHaveText("DR BRIAN'S");
    await expect(page.locator('.introProgram')).toHaveText('MATCH PREP ON-CALL');
    await expect(page.locator('.introProduct')).toHaveText('StoryForge');
    await expect(page.locator('.introSubtitle')).toHaveText('TURN THE MOMENTS THAT MADE YOU INTO STORIES YOU CAN USE.');
    expect(await page.locator('.introLogo').evaluate((image) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }))).toEqual(expect.objectContaining({ complete: true }));
    expect(await page.locator('.introLogo').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await page.locator('.introLogo').evaluate((image) => image.naturalHeight)).toBeGreaterThan(0);
    await expect(page.locator('body')).not.toContainText('IV PREP ON-CALL');
    await page.screenshot({ path: testInfo.outputPath('intro-branding.png'), fullPage: true });
    await expect(page.locator('#storyforgeOpening')).toBeHidden();
    await expect(page.locator('main .greet')).toContainText('Maya');
  });

  test('motion energy follows workspace and capture state without overflow', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-motion-energy', 'low');
    await page.getByRole('button', { name: /New Story/ }).first().click();
    await expect(page.locator('body')).toHaveAttribute('data-motion-energy', 'active');
    await page.screenshot({ path: testInfo.outputPath('medium-energy-capture.png'), fullPage: true });
    await page.evaluate(() => { document.body.dataset.motionEnergy = 'recording'; });
    await page.screenshot({ path: testInfo.outputPath('recording-energy-visual-check.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('static rich fallback disables all premium animation', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    await expect(page.locator('.storyforgeIntro')).toBeVisible();
    const intro = await page.evaluate(() => ({
      product: getComputedStyle(document.querySelector('.introProduct')).animationName,
      sparks: getComputedStyle(document.querySelector('.introSpark')).display,
      subtitle: document.querySelector('.introSubtitle')?.textContent,
    }));
    expect(intro).toEqual({
      product: 'none',
      sparks: 'none',
      subtitle: 'TURN THE MOMENTS THAT MADE YOU INTO STORIES YOU CAN USE.',
    });
    await expect(page.locator('#storyforgeOpening')).toBeHidden();
    const result = await page.evaluate(() => ({
      enabled: document.body.classList.contains('motion-enabled'),
      aurora: getComputedStyle(document.querySelector('.aur.a')).animationName,
      canvasBlank: !document.querySelector('#bgfx').getContext('2d').getImageData(0, 0, 1, 1).data.some(Boolean),
    }));
    expect(result.aurora).toBe('none');
    expect(result.canvasBlank).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('reduced-motion.png'), fullPage: true });
  });
});
