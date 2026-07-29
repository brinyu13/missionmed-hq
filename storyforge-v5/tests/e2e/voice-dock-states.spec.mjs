import { test, expect } from '@playwright/test';
import {
  closePageAndReset,
  installDeterministicMedia,
  loginStudent,
  resetVoiceFixture,
  seedActiveRecording,
  setVoiceScope,
  studentRecordingSessionCount,
} from './voice-fixture.mjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await resetVoiceFixture();
  await setVoiceScope();
  await installDeterministicMedia(page);
});

test.afterEach(async ({ page }) => {
  await closePageAndReset(page);
});

async function openIdleDock(page) {
  await loginStudent(page);
  await page.locator('#heroTitle').fill('A voice story');
  await page.getByRole('button', { name: 'Save it' }).click();
  await expect(page.locator('#voxDock.idle')).toBeVisible();
}

test('the dock walks through idle, recording, paused, resumed, and review states', async ({
  page,
}) => {
  await seedActiveRecording();
  await openIdleDock(page);
  await expect(
    page.getByRole('button', { name: 'Start voice recording' }),
  ).toContainText('Speak it — StoryForge types while you talk');
  await expect(page.locator('#voxDock [role="status"]')).toHaveAttribute(
    'aria-live',
    'polite',
  );

  await page.getByRole('button', { name: 'Start voice recording' }).click();
  await expect(page.locator('#voxDock.rec')).toBeVisible();
  await expect(page.getByText('Listening.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause voice recording' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish voice recording' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Discard voice recording' })).toBeVisible();

  await page.getByRole('button', { name: 'Pause voice recording' }).click();
  await expect(page.locator('#voxDock.paused')).toBeVisible();
  await expect(page.getByText(/Paused — nothing lost/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume voice recording' })).toBeVisible();

  await page.getByRole('button', { name: 'Resume voice recording' }).click();
  await expect(page.locator('#voxDock.rec')).toBeVisible();
  await page.getByRole('button', { name: 'Finish voice recording' }).click();
  await expect(page.locator('#voxDock.review')).toBeVisible();
  await expect(page.getByText(/Captured\. The transcript above is yours/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Record more/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Discard this recording/ })).toBeVisible();
  await expect(page.locator('#voiceConsent')).toHaveCount(0);
});

test('a muted capture auto-pauses with the exact interruption explanation', async ({ page }) => {
  await seedActiveRecording();
  await openIdleDock(page);
  await page.getByRole('button', { name: 'Start voice recording' }).click();
  await expect(page.locator('#voxDock.rec')).toBeVisible();
  await page.evaluate(() => {
    window.__storyforgeVoiceTestMedia.track.dispatchEvent(new Event('mute'));
  });
  await expect(page.locator('#voxDock.paused')).toBeVisible();
  await expect(page.locator('#voxDock')).toContainText(
    'Paused automatically when you switched away — nothing lost.',
  );
});

test('microphone denial tells the truth and typing remains usable', async ({ page }) => {
  await page.close();
  const replacement = await page.context().newPage();
  await installDeterministicMedia(replacement, { denied: true });
  await loginStudent(replacement);
  await replacement.locator('#heroTitle').fill('Permission denied story');
  await replacement.getByRole('button', { name: 'Save it' }).click();
  await replacement.getByRole('button', { name: 'Start voice recording' }).click();
  await expect(replacement.locator('#voxDock.error')).toContainText(
    'Microphone access was not available. You can allow it in your browser settings, or just keep typing.',
  );
  await replacement.locator('#capBody').fill('I can still type the whole story.');
  await expect(replacement.locator('#capBody')).toHaveValue(
    'I can still type the whole story.',
  );
  expect(await studentRecordingSessionCount()).toBe(0);
  await replacement.close();
});

test('a failed segment upload remains visibly recoverable after Done', async ({ page }) => {
  await page.close();
  const replacement = await page.context().newPage();
  await installDeterministicMedia(replacement, { emitChunk: true });
  await seedActiveRecording();
  await openIdleDock(replacement);
  await replacement.locator('#capBody').fill('The local segment must remain recoverable.');
  await replacement.getByRole('button', { name: 'Start voice recording' }).click();
  await expect(replacement.locator('#voxDock.rec')).toBeVisible();
  await replacement.getByRole('button', { name: 'Finish voice recording' }).click();
  await expect(replacement.locator('#voxDock')).toContainText(
    'Connection hiccup. Your recording is safe on this device. Reconnecting…',
  );
  await expect(replacement.locator('#capBody')).toHaveValue(
    'The local segment must remain recoverable.',
  );
  await replacement.getByRole('button', { name: 'Save story' }).click();
  await expect(replacement.locator('#capture.open')).toBeVisible();
  await expect(replacement.locator('#voxDock')).toContainText(
    'Connection hiccup. Your recording is safe on this device. Reconnecting…',
  );
  await expect(replacement.locator('#capBody')).toHaveValue(
    'The local segment must remain recoverable.',
  );
  await replacement.close();
});

test('the voice dock has no serious or critical axe findings', async ({ page }) => {
  await openIdleDock(page);
  await page.addScriptTag({ url: '/_test/axe.js' });
  const result = await page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
  }));
  const serious = result.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious).toEqual([]);
});

test('discard removes the take while preserving text typed both before and during it', async ({
  page,
}) => {
  await seedActiveRecording();
  await openIdleDock(page);
  const body = page.locator('#capBody');
  await body.fill('Typed before recording.');
  await page.getByRole('button', { name: 'Start voice recording' }).click();
  await expect(page.locator('#voxDock.rec')).toBeVisible();
  await body.fill('Typed before recording. Typed while the microphone was active.');
  await page.getByRole('button', { name: 'Finish voice recording' }).click();
  await expect(page.locator('#voxDock.review')).toBeVisible();
  await page.getByRole('button', { name: /Discard this recording/ }).click();
  await expect(page.locator('#voxDock.idle')).toBeVisible();
  await expect(body).toHaveValue(
    'Typed before recording. Typed while the microphone was active.',
  );
});
