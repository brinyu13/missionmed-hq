import { expect, test } from '@playwright/test';
import pg from 'pg';

import { installDeterministicMedia } from './voice-fixture.mjs';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

let reviewStory;

async function withDatabase(operation) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try { return await operation(client); } finally { await client.end(); }
}

async function token(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

async function choosePersona(page, label) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  const persona = page.getByRole('button', { name: label });
  await expect(change.or(persona)).toBeVisible();
  if (await change.isVisible()) await change.click();
  await persona.click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await withDatabase(async (client) => {
    const flags = await client.query(
      `UPDATE public.sf_feature_flags
          SET scope='allowlist', allowlist=$2::uuid[], cohorts='{}'::text[], updated_at=now()
        WHERE key=ANY($1::text[])`,
      [[
        'admin_console', 'admin_review_controls', 'mentor_notes', 'per_use_scoring',
      ], [ADMIN_ID]],
    );
    expect(flags.rowCount).toBe(4);
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope='eligible_all', allowlist='{}'::uuid[], cohorts='{}'::text[], updated_at=now()
        WHERE key=ANY($1::text[])`,
      [['voice_capture', 'story_versions']],
    );
  });
  const student = await token(request, 'student');
  const created = await request.post('/api/stories', {
    headers: { Authorization: `Bearer ${student}` },
    data: {
      title: `B1-515 fast voice repair ${Date.now()}`,
      text: 'A complete submitted story for the repaired mentor voice experience and mirrored Story Room.',
      lesson: 'Clear feedback improves the next telling.',
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  reviewStory = (await created.json()).story;
  const submitted = await request.post(`/api/stories/${reviewStory.id}/submit`, {
    headers: { Authorization: `Bearer ${student}` },
    data: { expectedVersion: Number(reviewStory.row_version), surface: 'workspace' },
  });
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
});

test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope='off', allowlist='{}'::uuid[], cohorts='{}'::text[], updated_at=now()
        WHERE key=ANY($1::text[])`,
      [[
        'admin_console', 'admin_review_controls', 'mentor_notes', 'per_use_scoring',
        'voice_capture', 'story_versions',
      ]],
    );
  });
});

test('[B1-515-FAST-VOICE-01] mentor feedback is idle until explicit Start and uses the wide canonical workspace', async ({ page }) => {
  await installDeterministicMedia(page, { emitChunk: true });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let calls = 0;
    navigator.mediaDevices.getUserMedia = async (...args) => { calls += 1; return original(...args); };
    window.__mentorMicCalls = () => calls;
  });
  await choosePersona(page, 'Admin · least privilege');
  await page.getByRole('button', { name: 'Review Queue', exact: true }).click();
  await page.locator('.adminStoryRow').filter({ hasText: reviewStory.title }).getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('region', { name: 'Mentor Review' })).toBeVisible();
  await expect(page.getByText('Ready · microphone off')).toBeVisible();
  await expect(page.getByRole('button', { name: '🎙 Start recording' })).toBeVisible();
  expect(await page.evaluate(() => window.__mentorMicCalls())).toBe(0);
  await expect(page.locator('#adminReviewSuitability')).toHaveCount(0);
  await expect(page.locator('[data-admin-suitability]')).toHaveCount(6);
  await expect(page.locator('#adminStudentFeedback')).toHaveCount(0);

  await page.getByRole('button', { name: '🎙 Start recording' }).click();
  await expect(page.getByText(/Recording ·/)).toBeVisible();
  expect(await page.evaluate(() => window.__mentorMicCalls())).toBe(1);
  await page.waitForTimeout(4_300);
  await expect(page.locator('#mentorNoteText')).toHaveValue(/Deterministic near-live transcript segment 1\./);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(/Paused · nothing lost/)).toBeVisible();
  const pausedText = await page.locator('#mentorNoteText').inputValue();
  await page.waitForTimeout(400);
  await expect(page.locator('#mentorNoteText')).toHaveValue(pausedText);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText(/Recording ·/)).toBeVisible();
  await page.getByRole('button', { name: '■ Stop & review' }).click();
  await expect(page.getByText(/Audio captured · transcript ready/)).toBeVisible();
  await page.locator('#mentorNoteText').fill(`${pausedText} Edited after recording.`);
  await page.getByRole('button', { name: 'Publish transcript + audio' }).click();
  await expect(page.getByText('Transcript + original voice')).toBeVisible();
});

test('[B1-515-FAST-VOICE-02] student entry points and purposeful versions never auto-start', async ({ page }) => {
  await installDeterministicMedia(page, { emitChunk: true });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let calls = 0;
    navigator.mediaDevices.getUserMedia = async (...args) => { calls += 1; return original(...args); };
    window.__studentMicCalls = () => calls;
  });
  await choosePersona(page, 'Student · Maya');
  await page.getByRole('button', { name: 'Tell it out loud' }).click();
  await expect(page.getByRole('button', { name: 'Start voice recording' })).toBeVisible();
  expect(await page.evaluate(() => window.__studentMicCalls())).toBe(0);
  await page.locator('#capture [data-close-overlay]').click();

  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  await page.locator('[data-story-row]').filter({ hasText: reviewStory.title }).getByRole('button', { name: 'Open story' }).click();
  await page.getByRole('tab', { name: '30-Second Version' }).click();
  await expect(page.getByRole('button', { name: '🎙 Start recording' })).toBeVisible();
  expect(await page.evaluate(() => window.__studentMicCalls())).toBe(0);
  await page.route(/\/api\/recordings\/[a-f0-9-]+(?:\/segments)?$/, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname.endsWith('/segments')) {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ accepted: true }) });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: 'assembled',
          segments: [{ seq: 0, transcribeState: 'transcribed', transcript: 'Deterministic near-live transcript segment 1.', flaggedTerms: [] }],
        }),
      });
      return;
    }
    await route.continue();
  });
  const firstVersionSegment = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && /\/api\/recordings\/[a-f0-9-]+\/segments$/.test(new URL(response.url()).pathname)
  ));
  await page.getByRole('button', { name: '🎙 Start recording' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  expect(await page.evaluate(() => window.__studentMicCalls())).toBe(1);
  const segmentResponse = await firstVersionSegment;
  expect(segmentResponse.ok()).toBeTruthy();
  await expect(page.locator('#storyVersionText')).toHaveValue(/Deterministic near-live transcript segment 1\./);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.route('**/api/recordings/*/finish', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'assembled' }) });
  });
  await page.route('**/api/stories/*/version-recordings/*/attach', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: 'Deterministic near-live transcript segment 1.',
        audioAssetId: '99999999-9999-4999-8999-999999999999',
      }),
    });
  });
  await page.getByRole('button', { name: '■ Stop & review' }).click();
  await expect(page.locator('[data-version-voice-status]')).toContainText('Transcript ready to edit');
});

test('[B1-515-FAST-VOICE-03] closing the Story Room stops and discards an active mentor recording', async ({ page }) => {
  await installDeterministicMedia(page, { emitChunk: true });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let latestStream = null;
    navigator.mediaDevices.getUserMedia = async (...args) => {
      latestStream = await original(...args);
      return latestStream;
    };
    window.__mentorTracksEnded = () => latestStream?.getTracks().every((track) => track.readyState === 'ended') === true;
  });
  let audioUploads = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/mentor-notes\/[a-f0-9-]+\/audio$/.test(new URL(request.url()).pathname)) {
      audioUploads += 1;
    }
  });
  await choosePersona(page, 'Admin · least privilege');
  await page.getByRole('button', { name: 'Review Queue', exact: true }).click();
  await page.locator('.adminStoryRow').filter({ hasText: reviewStory.title }).getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: '🎙 Start recording' }).click();
  await expect(page.getByText(/Recording ·/)).toBeVisible();
  await page.getByRole('button', { name: 'Review Queue', exact: true }).click();
  await expect(page.getByText('Mentor Review')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__mentorTracksEnded())).toBe(true);
  expect(audioUploads).toBe(0);
});
