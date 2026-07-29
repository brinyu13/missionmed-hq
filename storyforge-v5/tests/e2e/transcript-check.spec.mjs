import { test, expect } from '@playwright/test';
import {
  closePageAndReset,
  completeServerTranscriptSegment,
  loginStudent,
  resetVoiceFixture,
  seedOutOfOrderTranscript,
  seedRecoveredTranscript,
  seedTranscriptionFailure,
  setVoiceScope,
} from './voice-fixture.mjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await resetVoiceFixture();
  await setVoiceScope();
});

test.afterEach(async ({ page }) => {
  await closePageAndReset(page);
});

test('server-provided transcript checks render and apply without exposing a provider', async ({
  page,
}) => {
  await seedRecoveredTranscript({
    text: 'I assisted during a whipple procedure and discussed a fib management.',
    flaggedTerms: [
      { from: 'whipple', to: 'Whipple', source: 'lexicon' },
      { from: 'a fib', to: 'A-fib', source: 'lexicon' },
    ],
  });
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#voxChips .voxChip')).toHaveCount(2);
  await expect(page.locator('#voxChips')).toContainText('Transcript check');
  await expect(page.locator('#voxChips')).toContainText(
    'Terms the transcription wasn’t sure about — you decide.',
  );
  await expect(page.locator('body')).not.toContainText(/OpenAI|Anthropic|Whisper/i);

  await page.locator('#voxChips .voxChip').filter({ hasText: 'whipple' }).click();
  await expect(page.locator('#capBody')).toHaveValue(
    'I assisted during a Whipple procedure and discussed a fib management.',
  );
  await expect(page.locator('#voxChips .voxChip')).toHaveCount(1);
  await expect(page.locator('#voxChips .voxChip').filter({ hasText: 'whipple' })).toHaveCount(0);
  await page.waitForTimeout(2_200);
  await expect(page.locator('#voxChips .voxChip')).toHaveCount(1);
  await expect(page.locator('#voxChips .voxChip').filter({ hasText: 'whipple' })).toHaveCount(0);
  await page.locator('#voxChips .voxChip').filter({ hasText: 'a fib' }).click();
  await expect(page.locator('#capBody')).toHaveValue(
    'I assisted during a Whipple procedure and discussed A-fib management.',
  );
  await expect(page.locator('#voxChips')).toHaveCount(0);
  await page.waitForTimeout(2_200);
  await expect(page.locator('#voxChips')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#capBody')).toHaveValue(
    'I assisted during a Whipple procedure and discussed A-fib management.',
  );
  await expect(page.locator('#voxChips')).toHaveCount(0);
});

test('Fix all applies every current server-provided transcript check', async ({ page }) => {
  await seedRecoveredTranscript({
    text: 'I assisted during a whipple procedure and discussed a fib management.',
    flaggedTerms: [
      { from: 'whipple', to: 'Whipple', source: 'lexicon' },
      { from: 'a fib', to: 'A-fib', source: 'lexicon' },
    ],
  });
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await page.getByRole('button', { name: 'Fix all 2' }).click();
  await expect(page.locator('#capBody')).toHaveValue(
    'I assisted during a Whipple procedure and discussed A-fib management.',
  );
  await expect(page.locator('#voxChips')).toHaveCount(0);
});

test('medical-looking text produces no client-invented chips when the server sends no signal', async ({
  page,
}) => {
  await seedRecoveredTranscript({
    text: 'I observed a whipple procedure and discussed a fib management.',
    flaggedTerms: [],
  });
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#capBody')).toHaveValue(/whipple/);
  await expect(page.locator('#voxChips, [data-voice-fix], [data-voice-fix-all]')).toHaveCount(0);
});

test('server segments that finish out of order still appear in recording order', async ({ page }) => {
  const recordingId = await seedOutOfOrderTranscript();
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#capBody')).toHaveValue('');
  await completeServerTranscriptSegment(recordingId, 0, 'First segment.');
  await expect(page.locator('#capBody')).toHaveValue(
    'First segment. Second segment.',
    { timeout: 5_000 },
  );
});

test('the binding failed-transcription state renders truthful retry copy', async ({ page }) => {
  await seedTranscriptionFailure();
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#voxDock')).toContainText(
    "We can't transcribe right now. Your recording is saved. Keep talking, or try transcription again from review.",
  );
  await expect(page.getByRole('button', { name: 'Retry transcription' })).toBeVisible();
  await expect(page.locator('#capBody')).toHaveValue(
    'The reviewed draft text remains available.',
  );
});

test('recovery runs again after a signed local identity round trip', async ({ page }) => {
  await seedRecoveredTranscript({
    text: 'Recovered text must remain discoverable after an identity round trip.',
    flaggedTerms: [],
  });
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await page.getByRole('button', { name: 'Close Quick Capture' }).click();
  await expect(page.locator('#capture.open')).toHaveCount(0);
  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#capBody')).toHaveValue(
    'Recovered text must remain discoverable after an identity round trip.',
  );
});
