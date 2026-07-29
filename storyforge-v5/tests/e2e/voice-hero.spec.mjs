import { test, expect } from '@playwright/test';
import {
  closePageAndReset,
  loginStudent,
  resetVoiceFixture,
  setVoiceScope,
} from './voice-fixture.mjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await resetVoiceFixture();
});

test.afterEach(async ({ page }) => {
  await closePageAndReset(page);
});

test('flag off exposes no voice affordance and leaves the canonical typing flow intact', async ({
  page,
}) => {
  await loginStudent(page);
  await expect(page.locator('#heroTitle')).toHaveAttribute(
    'placeholder',
    '…type it before it fades',
  );
  await expect(page.locator('.heroMic')).toHaveCount(0);

  await page.locator('#heroTitle').fill('A typed story');
  await page.getByRole('button', { name: 'Save it' }).click();
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#voxDock, [data-record-audio]')).toHaveCount(0);
  await expect(page.locator('#capBody')).toHaveAttribute(
    'placeholder',
    'Tell it like you’d tell a trusted friend. Don’t polish it — just get it down.',
  );
  await page.locator('#capBody').fill('Typing remains fully usable with voice off.');
  await expect(page.locator('#capBody')).toHaveValue(
    'Typing remains fully usable with voice off.',
  );
});

test('eligible allowlisted student sees the exact native hero promise and one-time hint', async ({
  page,
}) => {
  await setVoiceScope();
  await loginStudent(page);
  const mic = page.locator('.heroMic');
  await expect(page.locator('#heroTitle')).toHaveAttribute(
    'placeholder',
    '…type it — or just talk',
  );
  await expect(mic).toBeVisible();
  await expect(mic).toHaveAttribute(
    'title',
    'Speak it — StoryForge types while you talk',
  );
  await expect(mic).toHaveClass(/newPulse/);
  await expect(page.locator('#toast')).toContainText(
    'New in StoryForge — tap the mic and it types while you talk.',
    { timeout: 3_500 },
  );
});

test('the hint is acknowledged by the hero mic and does not pulse on the next render', async ({
  page,
}) => {
  await setVoiceScope();
  await loginStudent(page);
  await expect(page.locator('.heroMic')).toHaveClass(/newPulse/);
  await page.locator('.heroMic').click();
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('storyforge_voice_hint_seen'),
  )).toBe('1');
  await page.reload();
  await expect(page.locator('.heroMic')).toBeVisible();
  await expect(page.locator('.heroMic')).not.toHaveClass(/newPulse/);
});

test('a non-allowlisted eligible student cannot discover the voice capability', async ({
  page,
}) => {
  await setVoiceScope();
  await loginStudent(page, { persona: 'Second student · privacy boundary' });
  await expect(page.locator('.heroMic, #voxDock')).toHaveCount(0);
  await expect(page.locator('#heroTitle')).toHaveAttribute(
    'placeholder',
    '…type it before it fades',
  );
});
