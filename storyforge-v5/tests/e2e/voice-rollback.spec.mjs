import { test, expect } from '@playwright/test';
import {
  STUDENT_ID,
  authHeaders,
  closePageAndReset,
  devToken,
  installDeterministicMedia,
  loginStudent,
  resetVoiceFixture,
  seedActiveRecording,
  setVoiceScope,
} from './voice-fixture.mjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await resetVoiceFixture();
});

test.afterEach(async ({ page }) => {
  await closePageAndReset(page);
});

test('scope off removes the UI capability and refuses new and legacy capture endpoints', async ({
  page,
  request,
}) => {
  const token = await devToken(request);
  const session = await request.get('/api/session', { headers: authHeaders(token) });
  expect(session.ok()).toBeTruthy();
  expect((await session.json()).capabilities.voiceCapture).toBe(false);

  const open = await request.post('/api/recordings', {
    headers: authHeaders(token),
    data: {},
  });
  expect(open.status()).toBe(403);
  expect((await open.json()).error.code).toBe('voice_disabled');

  const presign = await request.post('/api/audio/presign', {
    headers: authHeaders(token),
    data: {
      storyId: '10000000-0000-4000-8000-000000000001',
      contentType: 'audio/webm',
      byteSize: 16,
    },
  });
  expect(presign.status()).toBe(403);
  expect((await presign.json()).error.code).toBe('voice_disabled');

  const confirm = await request.post(
    '/api/audio/10000000-0000-4000-8000-000000000001/confirm',
    {
      headers: authHeaders(token),
      data: { durationMs: 4_000 },
    },
  );
  expect(confirm.status()).toBe(403);
  expect((await confirm.json()).error.code).toBe('voice_disabled');

  await loginStudent(page);
  await expect(page.locator('.heroMic, #voxDock')).toHaveCount(0);
});

test('turning scope off during a take keeps draft text and degrades truthfully', async ({
  page,
  request,
}) => {
  await setVoiceScope();
  await seedActiveRecording();
  await installDeterministicMedia(page);
  await loginStudent(page);
  await page.locator('#heroTitle').fill('Rollback draft');
  await page.getByRole('button', { name: 'Save it' }).click();
  await page.locator('#capBody').fill('These typed words must survive rollback.');
  await page.getByRole('button', { name: 'Start voice recording' }).click();
  await expect(page.locator('#voxDock.rec')).toBeVisible();

  await setVoiceScope({ scope: 'off', allowlist: [] });
  await expect(page.locator('#voxDock.error')).toContainText(
    'Voice capture is currently unavailable. Every word so far is kept in your draft. You can keep typing.',
    { timeout: 5_000 },
  );

  const token = await devToken(request);
  await expect.poll(async () => {
    const draft = await request.get('/api/drafts/story-builder', {
      headers: authHeaders(token),
    });
    return (await draft.json()).draft?.payload?.text;
  }).toBe('These typed words must survive rollback.');

  await page.reload();
  await expect(page.locator('.heroMic')).toHaveCount(0);
  const after = await request.get('/api/drafts/story-builder', {
    headers: authHeaders(token),
  });
  expect((await after.json()).draft.payload).toMatchObject({
    title: 'Rollback draft',
    text: 'These typed words must survive rollback.',
    voice: {
      recordingId: expect.any(String),
    },
  });
  expect((await after.json()).draft.payload.voice.recordingId).not.toBe(STUDENT_ID);
});
