import { test, expect } from '@playwright/test';
import {
  authHeaders,
  audioAssetCountForStory,
  closePageAndReset,
  devToken,
  loginStudent,
  recordingSessionState,
  removeAudioAsset,
  resetVoiceFixture,
  seedRecoveredTranscript,
  seedVerifiedAudioAsset,
  setRecordingState,
  setVoiceScope,
  studentCaptureDraft,
  studentStoriesByTitle,
} from './voice-fixture.mjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await resetVoiceFixture();
  await setVoiceScope();
});

test.afterEach(async ({ page }) => {
  await closePageAndReset(page);
});

async function holdAssemblyPending(page, recordingId, {
  state = () => 'finishing',
} = {}) {
  let reads = 0;
  let completedReads = 0;
  let finishCalls = 0;
  let finishCompleted = false;
  let completedReadsAfterFinish = 0;
  await page.route((url) => (
    url.pathname === `/api/recordings/${recordingId}/finish`
  ), async (route) => {
    finishCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'finishing' }),
    });
    finishCompleted = true;
  });
  await page.route((url) => (
    url.pathname === `/api/recordings/${recordingId}`
  ), async (route) => {
    reads += 1;
    const current = state();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        state: current,
        transcriptionAvailable: false,
        segments: [],
        totalDurationMs: 18_000,
        assembled: ['assembled', 'attached'].includes(current),
      }),
    });
    completedReads += 1;
    if (finishCompleted) completedReadsAfterFinish += 1;
  });
  return {
    reads: () => reads,
    completedReads: () => completedReads,
    finishCalls: () => finishCalls,
    completedReadsAfterFinish: () => completedReadsAfterFinish,
  };
}

async function settleCompletedRecordingRead(page, held, readsBeforeStep) {
  await expect.poll(held.completedReads, {
    timeout: 2_000,
    intervals: [10, 20, 50],
  }).toBeGreaterThan(readsBeforeStep);
  await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
}

async function advancePendingAssemblyWindow(page, held) {
  const readsBeforePreDeadlinePoll = held.completedReads();
  await page.clock.fastForward(88_000);
  await settleCompletedRecordingRead(page, held, readsBeforePreDeadlinePoll);
  await page.clock.fastForward(1_999);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  const readsBeforeDecisionPoll = held.completedReads();
  await page.clock.fastForward(1);
  await settleCompletedRecordingRead(page, held, readsBeforeDecisionPoll);
  await expect(page.getByRole('alertdialog')).toBeVisible();
}

async function openAssemblyDecision(page, recordingId, options = {}) {
  await page.clock.install({ time: new Date('2030-01-01T00:00:00.000Z') });
  const held = await holdAssemblyPending(page, recordingId, options);
  await loginStudent(page);
  await expect(page.locator('#capture.open')).toBeVisible();
  if (options.beforeSave) await options.beforeSave();
  await page.clock.pauseAt(new Date('2030-01-01T00:01:00.000Z'));
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect.poll(held.finishCalls).toBe(1);
  await expect.poll(held.completedReadsAfterFinish).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
  await advancePendingAssemblyWindow(page, held);
  return held;
}

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

test('the 90-second decision is exact, accessible, dismissible, and re-prompts', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'The complete transcript remains in the editor.',
  });
  const held = await openAssemblyDecision(page, recordingId);

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', 'audioAssemblyTitle');
  await expect(dialog).toHaveAttribute('aria-describedby', 'audioAssemblyBody');
  await expect(page.locator('#audioAssemblyTitle')).toHaveText(
    'Your audio is still being prepared',
  );
  await expect(page.locator('#audioAssemblyBody')).toHaveText(
    'Every word of your story is already captured below and will be saved with it. Only the audio is still being prepared. You can keep waiting, or save your story now without the audio.',
  );
  await expect(dialog.locator('[aria-live]')).toHaveCount(0);
  await expect(page.locator('#toast')).not.toHaveAttribute('inert');
  await expect(dialog.getByRole('button')).toHaveText([
    'Keep Waiting',
    'Save Without Audio',
  ]);
  const keep = dialog.getByRole('button', { name: 'Keep Waiting' });
  const saveWithoutAudio = dialog.getByRole('button', {
    name: 'Save Without Audio',
  });
  await expect(keep).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(saveWithoutAudio).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(keep).toBeFocused();
  await page.locator('#toast').evaluate((node) => {
    node.tabIndex = -1;
    node.focus();
  });
  await expect(keep).toBeFocused();

  const readsBeforeFirstDismissal = held.reads();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save story' })).toBeFocused();
  await expect.poll(held.reads).toBeGreaterThan(readsBeforeFirstDismissal);
  await advancePendingAssemblyWindow(page, held);

  await page.locator('.audioAssemblyLayer').click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save story' })).toBeFocused();
  const session = await recordingSessionState(recordingId);
  expect(session.state).toBe('recording');
});

test('Save Without Audio preserves exact editor bytes, cancels once, and is single-flight', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'Original recovered transcript.',
  });
  const title = `Typed-only deadline ${recordingId}`;
  const exactText = '  Typed opening.\nMedical transcript detail.\nTyped ending.  ';
  let cancelCalls = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST'
      && new URL(request.url()).pathname === `/api/recordings/${recordingId}/cancel`
    ) {
      cancelCalls += 1;
    }
  });
  await openAssemblyDecision(page, recordingId, {
    beforeSave: async () => {
      await page.locator('#capTitle').fill(title);
      await page.locator('#capBody').fill(exactText);
    },
  });

  await page.evaluate(() => {
    const button = document.querySelector('.audioAssemblySave');
    button.click();
    button.click();
  });
  await expect(page.locator('#capture.open')).toHaveCount(0);
  await expect(page.locator('#toast')).toHaveText(
    'Saved. Every word was kept — this story has no audio attached.',
  );
  expect(cancelCalls).toBe(1);

  const stories = await studentStoriesByTitle(title);
  expect(stories).toHaveLength(1);
  expect(stories[0].current_text).toBe(exactText);
  expect(stories[0].original_text).toBe(exactText);
  expect(stories[0].capture_type).toBe('text');
  expect(await audioAssetCountForStory(stories[0].id)).toBe(0);
  expect((await recordingSessionState(recordingId)).state).toBe('cancelled');
  expect((await studentCaptureDraft()).payload).toEqual({});
});

test('reload after cancellation restores one typed-only draft and repeat submission creates one story', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'Reload-safe recovered transcript.',
  });
  const title = `Reload-safe typed story ${recordingId}`;
  const exactText = '  Typed before reload.\nRecovered transcript.\nTyped after.  ';
  let releaseFirstCreate;
  let markFirstCreateStarted;
  const firstCreateStarted = new Promise((resolve) => {
    markFirstCreateStarted = resolve;
  });
  const firstCreateRelease = new Promise((resolve) => {
    releaseFirstCreate = resolve;
  });
  let holdFirstCreate = true;
  await page.route('**/api/stories', async (route) => {
    if (route.request().method() !== 'POST' || !holdFirstCreate) {
      await route.continue();
      return;
    }
    holdFirstCreate = false;
    markFirstCreateStarted();
    await firstCreateRelease;
    await route.abort('failed').catch(() => {});
  });

  await openAssemblyDecision(page, recordingId, {
    beforeSave: async () => {
      await page.locator('#capTitle').fill(title);
      await page.locator('#capBody').fill(exactText);
    },
  });
  await page.getByRole('button', { name: 'Save Without Audio' }).click();
  await firstCreateStarted;

  const retryDraft = await studentCaptureDraft();
  expect(retryDraft.payload.text).toBe(exactText);
  expect(retryDraft.payload.voice).toBeUndefined();
  expect(retryDraft.payload.recordingId).toBeUndefined();
  expect((await recordingSessionState(recordingId)).state).toBe('cancelled');
  expect(await studentStoriesByTitle(title)).toEqual([]);

  const reload = page.reload();
  releaseFirstCreate();
  await reload;
  const persona = page.getByRole('button', { name: 'Student · Maya' });
  if (await persona.isVisible().catch(() => false)) await persona.click();
  await expect(page.locator('[data-view="home"]')).toBeVisible();
  await page.locator('[data-open-capture]').first().click();
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(page.locator('#capTitle')).toHaveValue(title);
  await expect(page.locator('#capBody')).toHaveValue(exactText);
  await expect(page.locator('.voxRecover')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Discard this recording' })).toHaveCount(0);

  await page.evaluate(() => {
    const button = document.querySelector('#captureForm [type="submit"]');
    button.click();
    button.click();
  });
  await expect(page.locator('#capture.open')).toHaveCount(0);
  const stories = await studentStoriesByTitle(title);
  expect(stories).toHaveLength(1);
  expect(stories[0].current_text).toBe(exactText);
  expect(stories[0].capture_type).toBe('text');
  expect(await audioAssetCountForStory(stories[0].id)).toBe(0);
  expect((await studentCaptureDraft()).payload).toEqual({});
});

test('a cancel race rereads once and makes exactly one successful E7 attempt', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'Race-safe transcript.',
  });
  const title = `Audio race ${recordingId}`;
  let raceReady = false;
  let cancelCalls = 0;
  let raceReads = 0;
  let storyPosts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST'
      && new URL(request.url()).pathname === '/api/stories'
    ) {
      storyPosts += 1;
    }
  });
  await page.clock.install({ time: new Date('2030-01-01T00:00:00.000Z') });
  const held = await holdAssemblyPending(page, recordingId, {
    state: () => {
      if (raceReady) raceReads += 1;
      return raceReady ? 'assembled' : 'finishing';
    },
  });
  await page.route((url) => (
    url.pathname === `/api/recordings/${recordingId}/cancel`
  ), async (route) => {
    cancelCalls += 1;
    raceReady = true;
    await setRecordingState(recordingId, 'assembled');
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'state_conflict',
          message: 'Recording session is not in a compatible state.',
        },
      }),
    });
  });
  await loginStudent(page);
  await page.locator('#capTitle').fill(title);
  await page.clock.pauseAt(new Date('2030-01-01T00:01:00.000Z'));
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect.poll(held.finishCalls).toBe(1);
  await expect.poll(held.completedReadsAfterFinish).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
  await advancePendingAssemblyWindow(page, held);
  await page.getByRole('button', { name: 'Save Without Audio' }).click();
  await expect(page.locator('#capture.open')).toHaveCount(0);

  expect(cancelCalls).toBe(1);
  expect(raceReads).toBe(1);
  expect(storyPosts).toBe(1);
  const stories = await studentStoriesByTitle(title);
  expect(stories).toHaveLength(1);
  expect(stories[0].capture_type).toBe('audio');
  expect(await audioAssetCountForStory(stories[0].id)).toBe(1);
  expect((await recordingSessionState(recordingId)).state).toBe('attached');
  await expect(page.locator('#toast')).toContainText('Saved.');
  await expect(page.locator('#toast')).not.toContainText('no audio attached');
});

test('a failed race E7 falls back once to typed-only and leaves conflict for sweep', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'Race fallback transcript.',
  });
  const title = `Race fallback ${recordingId}`;
  const exactText = 'Typed context.\nRace fallback transcript.\nFinal reflection.';
  let raceReady = false;
  let cancelCalls = 0;
  let raceReads = 0;
  const storyBodies = [];
  await page.clock.install({ time: new Date('2030-01-01T00:00:00.000Z') });
  const held = await holdAssemblyPending(page, recordingId, {
    state: () => {
      if (raceReady) raceReads += 1;
      return raceReady ? 'assembled' : 'finishing';
    },
  });
  await page.route((url) => (
    url.pathname === `/api/recordings/${recordingId}/cancel`
  ), async (route) => {
    cancelCalls += 1;
    if (cancelCalls === 1) {
      raceReady = true;
      await setRecordingState(recordingId, 'assembled');
    }
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'state_conflict',
          message: 'Recording session is not in a compatible state.',
        },
      }),
    });
  });
  await page.route('**/api/stories', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON();
    storyBodies.push(body);
    if (storyBodies.length === 1) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'voice_assembly_pending',
            message: 'Your recording is still being prepared.',
          },
        }),
      });
      return;
    }
    await route.continue();
  });
  await loginStudent(page);
  await page.locator('#capTitle').fill(title);
  await page.locator('#capBody').fill(exactText);
  await page.clock.pauseAt(new Date('2030-01-01T00:01:00.000Z'));
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect.poll(held.finishCalls).toBe(1);
  await expect.poll(held.completedReadsAfterFinish).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
  await advancePendingAssemblyWindow(page, held);
  await page.getByRole('button', { name: 'Save Without Audio' }).click();
  await expect(page.locator('#capture.open')).toHaveCount(0);

  expect(cancelCalls).toBe(2);
  expect(raceReads).toBe(1);
  expect(storyBodies).toHaveLength(2);
  expect(storyBodies[0].recordingId).toBe(recordingId);
  expect(storyBodies[0].captureType).toBe('audio');
  expect(storyBodies[1].recordingId).toBeUndefined();
  expect(storyBodies[1].captureType).toBe('text');
  expect(storyBodies[1].text).toBe(exactText);
  const stories = await studentStoriesByTitle(title);
  expect(stories).toHaveLength(1);
  expect(stories[0].capture_type).toBe('text');
  expect(stories[0].current_text).toBe(exactText);
  expect(await audioAssetCountForStory(stories[0].id)).toBe(0);
  expect((await recordingSessionState(recordingId)).state).toBe('assembled');
  await expect(page.locator('#toast')).toHaveText(
    'Saved. Every word was kept — this story has no audio attached.',
  );
});

test('a non-conflict cancel failure re-enables the same prompt and creates no story', async ({
  page,
}) => {
  const recordingId = await seedRecoveredTranscript({
    text: 'Cancellation failure transcript.',
  });
  const title = `Cancel failure ${recordingId}`;
  let cancelCalls = 0;
  let releaseCancel;
  let markCancelStarted;
  const cancelStarted = new Promise((resolve) => {
    markCancelStarted = resolve;
  });
  const cancelRelease = new Promise((resolve) => {
    releaseCancel = resolve;
  });
  await page.route((url) => (
    url.pathname === `/api/recordings/${recordingId}/cancel`
  ), async (route) => {
    cancelCalls += 1;
    markCancelStarted();
    await cancelRelease;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'audio_storage_unavailable',
          message: 'Cancellation is temporarily unavailable.',
        },
      }),
    });
  });
  await openAssemblyDecision(page, recordingId, {
    beforeSave: () => page.locator('#capTitle').fill(title),
  });
  await page.getByRole('button', { name: 'Save Without Audio' }).click();
  const dialog = page.getByRole('alertdialog');
  await cancelStarted;
  await expect(dialog.getByRole('button', { name: 'Keep Waiting' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save Without Audio' })).toBeDisabled();
  await expect(dialog).toBeFocused();
  await expect(page.locator('body')).toHaveClass(/mutating/);
  releaseCancel();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep Waiting' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Save Without Audio' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Keep Waiting' })).toBeFocused();
  await expect(page.locator('#toast')).toHaveText(
    'Cancellation is temporarily unavailable.',
  );
  expect(cancelCalls).toBe(1);
  expect(await studentStoriesByTitle(title)).toEqual([]);
  expect((await recordingSessionState(recordingId)).state).toBe('recording');
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

test('saved audio has one accessible play pause progress and replay control', async ({
  page,
  request,
}) => {
  const token = await devToken(request);
  const create = await request.post('/api/stories', {
    headers: authHeaders(token),
    data: {
      title: 'Managed replay proof',
      text: 'The original telling remains separate from this working text.',
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(create.status()).toBe(201);
  const story = (await create.json()).story;
  const assetId = await seedVerifiedAudioAsset(story.id, { durationMs: 8_000 });
  try {
    await page.addInitScript(() => {
      window.__audioInstances = [];
      window.__rejectAudioPlayCount = 0;
      class ControlledAudio extends EventTarget {
        constructor(url) {
          super();
          this.url = url;
          this.currentTime = 0;
          this.duration = 8;
          this.paused = true;
          this.ended = false;
          window.__audioInstances.push(this);
        }

        async play() {
          if (window.__rejectAudioPlayCount > 0) {
            window.__rejectAudioPlayCount -= 1;
            throw new Error('expired private URL');
          }
          this.paused = false;
          this.dispatchEvent(new Event('play'));
        }

        pause() {
          if (this.paused) return;
          this.paused = true;
          this.dispatchEvent(new Event('pause'));
        }

        removeAttribute() {}

        load() {}

        tick(seconds) {
          this.currentTime = seconds;
          this.dispatchEvent(new Event('timeupdate'));
        }

        finish() {
          this.currentTime = this.duration;
          this.ended = true;
          this.dispatchEvent(new Event('timeupdate'));
          this.dispatchEvent(new Event('ended'));
        }
      }
      Object.defineProperty(window, 'Audio', {
        configurable: true,
        value: ControlledAudio,
      });
    });
    let playbackCalls = 0;
    await page.route(`**/api/audio/${assetId}/playback`, async (route) => {
      playbackCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playbackUrls: ['https://private.example/managed-replay'],
          durationMs: 8_000,
          expiresIn: 300,
        }),
      });
    });

    await loginStudent(page);
    await page.getByRole('button', { name: /Story Library/ }).first().click();
    await page.locator(`[data-story-row="${story.id}"] [data-open-story]`).click();
    const card = page.locator(`[data-audio-card="${assetId}"]`);
    await expect(card.locator('.audWave i')).toHaveCount(46);
    await expect(page.locator('.audioBridge')).toContainText(
      'Original audio → transcribed below as the Original telling',
    );
    await card.getByRole('button', { name: 'Play original audio' }).click();
    await expect(card.getByRole('button', { name: 'Pause original audio' })).toBeFocused();
    await page.evaluate(() => window.__audioInstances.at(-1).tick(2));
    await expect(card.locator('.audTime')).toHaveText('0:02 / 0:08');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    await expect(card.locator('.audTrack i')).toHaveAttribute('style', /width:\s*25%/);

    await card.getByRole('button', { name: 'Pause original audio' }).click();
    await expect(card.getByRole('button', { name: 'Resume original audio' })).toBeFocused();
    await expect(card.getByRole('status')).toHaveText('Paused at 0:02.');
    await card.getByRole('button', { name: 'Resume original audio' }).click();
    await expect(card.getByRole('button', { name: 'Pause original audio' })).toBeFocused();

    await page.evaluate(() => window.__audioInstances.at(-1).finish());
    await expect(card.getByRole('button', { name: 'Replay original audio' })).toBeFocused();
    await expect(card.locator('.audTime')).toHaveText('0:08 / 0:08');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
    await page.evaluate(() => {
      window.__rejectAudioPlayCount = 1;
    });
    await card.getByRole('button', { name: 'Replay original audio' }).click();
    await expect.poll(() => page.evaluate(() => window.__audioInstances.length)).toBe(3);
    expect(playbackCalls).toBe(3);
    await expect(card.getByRole('button', { name: 'Pause original audio' })).toBeFocused();
  } finally {
    await removeAudioAsset(assetId);
  }
});
