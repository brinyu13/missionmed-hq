import { test, expect } from '@playwright/test';
import {
  authHeaders,
  closePageAndReset,
  devToken,
  loginStudent,
  removeAudioAsset,
  resetVoiceFixture,
  seedRecoveredTranscript,
  seedVerifiedAudioAsset,
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

test('voice save waits for assembled state and attaches through E7', async ({ page }) => {
  await seedRecoveredTranscript({
    text: 'The reviewed transcript is ready to save.',
  });

  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  await page.getByRole('button', { name: 'Save story' }).click();

  await expect(page.locator('#capture.open')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('Saved.');
});

test('E7 409 pending response retries and then saves once', async ({ page }) => {
  await seedRecoveredTranscript({
    text: 'The reviewed transcript is ready to save.',
  });
  let attachAttempts = 0;

  await page.route('**/api/stories', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    attachAttempts += 1;
    if (attachAttempts === 1) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'voice_assembly_pending',
            message: 'Your recording is still being prepared.',
            retryAfterMs: 2_000,
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await loginStudent(page);
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect(page.locator('#capture.open')).toHaveCount(0);
  expect(attachAttempts).toBe(2);
});

test('assembly failure preserves the draft and shows the immutable safe-text copy', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'The reviewed transcript is ready to save.',
  });
  await page.route(`**/api/recordings/${recordingId}/finish`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'finishing' }),
    });
  });
  await page.route(`**/api/recordings/${recordingId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        state: 'failed',
        transcriptionAvailable: false,
        segments: [],
        totalDurationMs: 18_000,
        assembled: false,
      }),
    });
  });

  await loginStudent(page);
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#capBody')).toHaveValue(
    'The reviewed transcript is ready to save.',
  );
  await expect(page.locator('#toast')).toContainText(
    "We couldn't attach your audio this time. Every word is safe in your story text. You can save your story now, and you can record again anytime.",
  );
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect(page.locator('#capture.open')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('Saved.');
});

test('multi-segment playback refreshes E9 before each later segment', async ({
  page,
  request,
}) => {
  const token = await devToken(request);
  const create = await request.post('/api/stories', {
    headers: authHeaders(token),
    data: {
      title: 'Sequential playback proof',
      text: 'Every private segment must remain playable for the full recording.',
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(create.status()).toBe(201);
  const story = (await create.json()).story;
  const assetId = await seedVerifiedAudioAsset(story.id);
  let playbackCalls = 0;
  try {
    await page.addInitScript(() => {
      window.__playedAudioUrls = [];
      class DeterministicAudio extends EventTarget {
        constructor(url) {
          super();
          this.url = url;
          window.__playedAudioUrls.push(url);
        }

        async play() {
          queueMicrotask(() => this.dispatchEvent(new Event('ended')));
        }
      }
      Object.defineProperty(window, 'Audio', {
        configurable: true,
        value: DeterministicAudio,
      });
    });
    await page.route(`**/api/audio/${assetId}/playback`, async (route) => {
      playbackCalls += 1;
      const generation = playbackCalls === 1 ? 'initial' : 'refreshed';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playbackUrls: [
            `https://private.example/${generation}-0`,
            `https://private.example/${generation}-1`,
          ],
          expiresIn: 300,
        }),
      });
    });

    await loginStudent(page);
    await page.getByRole('button', { name: /Story Library/ }).first().click();
    await page.locator(`[data-story-row="${story.id}"] [data-open-story]`).click();
    await page.getByRole('button', { name: 'Play original audio' }).click();
    await expect.poll(
      () => page.evaluate(() => window.__playedAudioUrls),
    ).toEqual([
      'https://private.example/initial-0',
      'https://private.example/refreshed-1',
    ]);
    expect(playbackCalls).toBe(2);
  } finally {
    await removeAudioAsset(assetId);
  }
});
