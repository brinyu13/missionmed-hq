import { createHash, createHmac, randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import pg from 'pg';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const MENTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROMPT_ID = '51410000-0000-4000-8000-000000000001';
const CONTRIBUTOR_PROMPT_ID = '51420000-0000-4000-8000-000000000001';
const INVITATION_ID = '51430000-0000-4000-8000-000000000001';
const GUEST_TOKEN = Buffer.alloc(32, 81).toString('base64url');
const GATEWAY_SECRET = 'b1-514-e2e-gateway-secret-32-bytes-minimum';
const RECOMMENDATION = 'What quiet act of advocacy changed what happened next?';
const VERSION_ONE = 'I noticed the concern, listened carefully, and made the next safe step visible.';
const VERSION_TWO = `${VERSION_ONE} The team acted together and the patient felt heard.`;
const MENTOR_TRANSCRIPT = 'Keep the patient voice at the center and make your turning point unmistakable.';

// Executable acceptance-ID map for the enabled, isolated B1-514 browser lane.
const ACCEPTANCE = Object.freeze({
  'B1-514-E2E-01': 'versioned consent, private-safe history, truthful Home HUD, DB recommendation',
  'B1-514-E2E-02': 'purposeful story versions and DB-backed Inspiration preferences',
  'B1-514-E2E-03': 'student Request-a-Story editor and token-scoped guest text contribution',
  'B1-514-E2E-04': 'published mentor transcript plus original-audio controls',
  'B1-514-E2E-05': 'dark, light, auto, Ember Storm, and Lumen Drift persistence',
});

let historicalStory;
let mentorStory;
let mentorNote;

async function withDatabase(operation) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok(), `signed ${persona} fixture`).toBeTruthy();
  return (await response.json()).token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createStory(request, token, title, text) {
  const response = await request.post('/api/stories', {
    headers: authHeaders(token),
    data: { title, text, captureType: 'text', surface: 'quick' },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).story;
}

async function openStudent(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('[data-view="home"]')).toBeVisible();
}

async function acceptConsentIfShown(page) {
  const sheet = page.locator('.b1513r3ConsentSheet');
  if (!await sheet.isVisible().catch(() => false)) return;
  await sheet.locator('[data-consent-confirm]').check();
  await sheet.locator('[data-consent-decision="accept"]').click();
  await expect(sheet).toBeHidden();
}

async function openStoryFromLibrary(page, title) {
  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  const row = page.locator('[data-story-row]').filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Open story' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function setEnabledFixtures() {
  await withDatabase(async (client) => {
    const keys = [
      'visibility_consent', 'story_versions', 'inspiration', 'request_a_story',
      'guest_contributions', 'story_workflow', 'mentor_notes',
    ];
    const flags = await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = 'eligible_all', allowlist = '{}'::uuid[], cohorts = '{}'::text[], updated_at = now()
        WHERE key = ANY($1::text[])`,
      [keys],
    );
    expect(flags.rowCount).toBe(keys.length);
    await client.query(
      `UPDATE public.sf_users
          SET theme_preference = 'dark', background_preference = 'ember'
        WHERE id = $1`,
      [STUDENT_ID],
    );
    await client.query(
      `INSERT INTO public.sf_inspiration_prompts
         (id, library_key, text, territory, follow_up, interview_use, state, recommended, sort_order)
       VALUES ($1, 'q-514', $2, 'advocacy', 'What did you notice first?', 'Behavioral advocacy questions', 'active', true, 514)
       ON CONFLICT (id) DO NOTHING`,
      [PROMPT_ID, RECOMMENDATION],
    );
    await client.query(
      `INSERT INTO public.sf_contributor_prompts
         (id, library_key, relationship_ids, text, hint, state, sort_order)
       VALUES ($1, 'c-514', ARRAY['parent'], 'What is one moment when {student} surprised you?',
               'A small, specific memory is perfect.', 'active', 514)
       ON CONFLICT (id) DO NOTHING`,
      [CONTRIBUTOR_PROMPT_ID],
    );
    await client.query(
      `INSERT INTO public.sf_story_invitations
         (id, student_id, contributor_first_name, relationship_id, email, token_hash,
          status, personal_message, disclosure_version, sent_at, expires_at)
       VALUES ($1, $2, 'Jordan', 'parent', 'jordan@example.test', $3, 'sent',
               'Please share one memory in your own words.', 'b1-514-e2e-v1', now(), now() + interval '2 days')
       ON CONFLICT (id) DO NOTHING`,
      [INVITATION_ID, STUDENT_ID, createHash('sha256').update(GUEST_TOKEN).digest('hex')],
    );
  });
}

async function seedMentorFeedback(request) {
  const student = await devToken(request, 'student');
  const mentor = await devToken(request, 'mentor');
  historicalStory = await createStory(
    request,
    student,
    `B1-514 private-safe history ${Date.now()}`,
    'This historical story existed before any mentorship visibility consent.',
  );
  mentorStory = await createStory(
    request,
    student,
    `B1-514 mentor voice ${Date.now()}`,
    'A submitted story used to verify the student-facing feedback surface.',
  );
  const submitted = await request.post(`/api/stories/${mentorStory.id}/submit`, {
    headers: authHeaders(student),
    data: { expectedVersion: Number(mentorStory.row_version), surface: 'workspace' },
  });
  expect(submitted.ok()).toBeTruthy();
  mentorStory = (await submitted.json()).story;
  const created = await request.post(`/api/stories/${mentorStory.id}/mentor-notes`, {
    headers: authHeaders(mentor),
    data: { body: MENTOR_TRANSCRIPT, internalOnly: false, surface: 'workspace' },
  });
  expect(created.status()).toBe(201);
  mentorNote = (await created.json()).note;
  const published = await request.post(`/api/mentor-notes/${mentorNote.id}/publish`, {
    headers: authHeaders(mentor),
    data: { expectedVersion: mentorNote.rowVersion, surface: 'workspace' },
  });
  expect(published.ok()).toBeTruthy();
  mentorNote = (await published.json()).note;
  const assetId = randomUUID();
  await withDatabase((client) => client.query(
    `INSERT INTO public.sf_mentor_note_media
       (id, note_id, author_id, student_id, story_id, object_key, content_type,
        byte_size, checksum_sha256, transcript, provider_id, model_id, state, verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'audio/webm', 4096, $7, $8,
             'b1-514-e2e', 'fixture-transcript', 'verified', now())`,
    [
      assetId, mentorNote.id, MENTOR_ID, STUDENT_ID, mentorStory.id,
      `storyforge-mentor-notes/${MENTOR_ID}/${STUDENT_ID}/${mentorStory.id}/${mentorNote.id}/${assetId}.webm`,
      'a'.repeat(64), MENTOR_TRANSCRIPT,
    ],
  ));
}

async function installGuestGateway(page) {
  const baseURL = process.env.STORYFORGE_E2E_BASE_URL || 'http://127.0.0.1:4179';
  await page.route('**/storyforge/guest/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch({ url: `${baseURL}/` });
    const body = (await response.text()).replace('<head>', '<head><base href="/">');
    return route.fulfill({ response, body });
  });
  await page.route('**/storyforge/api/requests/guest/**', async (route) => {
    const original = new URL(route.request().url());
    const pathname = original.pathname.replace(/^\/storyforge\//, '/');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const pseudonym = createHash('sha256').update('b1-514-browser-guest').digest('hex');
    const signature = createHmac('sha256', GATEWAY_SECRET)
      .update(`${route.request().method()}\n${pathname}\n${timestamp}\n${pseudonym}`)
      .digest('hex');
    const response = await route.fetch({
      url: new URL(pathname, baseURL).toString(),
      headers: {
        ...route.request().headers(),
        'x-storyforge-client-pseudonym': pseudonym,
        'x-storyforge-gateway-timestamp': timestamp,
        'x-storyforge-gateway-signature': signature,
      },
    });
    await route.fulfill({ response });
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await setEnabledFixtures();
  await seedMentorFeedback(request);
});

test.afterAll(async () => {
  await withDatabase((client) => client.query(
    `UPDATE public.sf_feature_flags
        SET scope = 'off', allowlist = '{}'::uuid[], cohorts = '{}'::text[], updated_at = now()
      WHERE key = ANY($1::text[])`,
    [[
      'visibility_consent', 'story_versions', 'inspiration', 'request_a_story',
      'guest_contributions', 'story_workflow', 'mentor_notes',
    ]],
  ));
});

test(`[B1-514-E2E-01] ${ACCEPTANCE['B1-514-E2E-01']}`, async ({ page, request }) => {
  await openStudent(page);
  const consent = page.locator('.b1513r3ConsentSheet');
  await expect(consent).toBeVisible();
  await expect(consent.getByRole('heading', { name: 'Your stories. Your choice.' })).toBeVisible();
  await consent.locator('[data-consent-confirm]').check();
  await consent.locator('[data-consent-decision="accept"]').click();
  await expect(consent).toBeHidden();

  await expect(page.locator('.b1513r3Recommends')).toContainText(RECOMMENDATION);
  await expect(page.locator('.b1513r3Hud')).toBeVisible();
  await expect(page.locator('.b1513r3Hud')).toContainText('Private — only me');
  await expect(page.locator('.b1513r3Hud')).toContainText('Mentor Visible');
  await expect(page.locator('.b1513r3Hud [role="progressbar"]')).toHaveCount(1);

  const student = await devToken(request, 'student');
  const afterConsent = await createStory(
    request,
    student,
    `B1-514 post-consent ${Date.now()}`,
    'A new story created after affirmative versioned mentorship consent.',
  );
  const visibility = await withDatabase((client) => client.query(
    'SELECT id, coalesce(visibility, \'private\') AS visibility FROM public.sf_stories WHERE id = ANY($1::uuid[])',
    [[historicalStory.id, afterConsent.id]],
  ));
  const rows = new Map(visibility.rows.map((story) => [story.id, story.visibility]));
  expect(rows.get(historicalStory.id)).toBe('private');
  expect(rows.get(afterConsent.id)).toBe('mentor_visible');
  await page.reload();
  await expect(page.locator('.b1513r3Hud')).toContainText('Mentor Visible');
});

test(`[B1-514-E2E-02] ${ACCEPTANCE['B1-514-E2E-02']}`, async ({ page }) => {
  await openStudent(page);
  await acceptConsentIfShown(page);
  await openStoryFromLibrary(page, historicalStory.title);
  await page.getByRole('tab', { name: '30-Second Version' }).click();
  await page.locator('#storyVersionText').fill(VERSION_ONE);
  const firstVersionSave = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
    && /\/api\/stories\/[a-f0-9-]+\/versions\/thirty_second$/i.test(new URL(response.url()).pathname)
  ));
  await page.getByRole('button', { name: 'Save this version' }).click();
  expect((await firstVersionSave).status()).toBe(200);
  await expect(page.locator('#storyVersionText')).toHaveValue(VERSION_ONE);
  await page.locator('#storyVersionText').fill(VERSION_TWO);
  const secondVersionSave = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
    && /\/api\/stories\/[a-f0-9-]+\/versions\/thirty_second$/i.test(new URL(response.url()).pathname)
  ));
  await page.getByRole('button', { name: 'Save this version' }).click();
  expect((await secondVersionSave).status()).toBe(200);
  await expect(page.getByText('Earlier tellings (1)')).toBeVisible();
  await page.getByText('Earlier tellings (1)').click();
  await expect(page.getByText(VERSION_ONE, { exact: true })).toBeVisible();

  await page.locator('[data-close-overlay]').click();
  await page.getByRole('button', { name: 'Inspiration', exact: true }).click();
  await expect(page.locator('.b1514PromptCard')).toContainText(RECOMMENDATION);
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await expect(page.locator('.b1514PromptList')).toHaveClass(/grid/);
  const preference = await withDatabase((client) => client.query(
    'SELECT inspiration_layout FROM public.sf_users WHERE id = $1',
    [STUDENT_ID],
  ));
  expect(preference.rows[0]?.inspiration_layout).toBe('grid');
  await page.reload();
  await expect(page.locator('.b1514PromptList')).toHaveClass(/grid/);
  await expect(page.locator('.b1514PromptCard')).toContainText(RECOMMENDATION);
});

test(`[B1-514-E2E-03] ${ACCEPTANCE['B1-514-E2E-03']}`, async ({ page, browser }) => {
  await openStudent(page);
  await acceptConsentIfShown(page);
  await page.getByRole('button', { name: 'Request a Story', exact: true }).click();
  await page.getByRole('button', { name: '＋ Invite someone to share a story' }).first().click();
  await page.locator('#requestFirstName').fill('Alex');
  await page.getByRole('button', { name: 'Best Friend', exact: true }).click();
  await page.locator('#requestEmail').fill('alex@example.test');
  await page.locator('#requestMessage').fill('Please share the moment exactly as you remember it.');
  const createResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/requests'
    && response.request().method() === 'POST'
  ));
  const previewResponse = page.waitForResponse((response) => (
    /\/api\/requests\/[a-f0-9-]+\/preview$/i.test(new URL(response.url()).pathname)
  ));
  await page.getByRole('button', { name: /Continue — preview before sending/ }).click();
  const created = await createResponse;
  expect(created.status(), await created.text()).toBe(201);
  const previewed = await previewResponse;
  expect(previewed.status(), await previewed.text()).toBe(200);
  await expect(page.getByRole('heading', { name: /Exactly what Alex will receive/ })).toBeVisible();
  await expect(page.locator('.b1514RaEmail')).toContainText('Please share the moment exactly as you remember it.');
  await page.getByRole('button', { name: 'Keep as draft' }).click();
  await expect(page.locator('.b1514Invitation').filter({ hasText: 'Alex' })).toContainText('Draft');

  const context = await browser.newContext();
  const guestPage = await context.newPage();
  try {
    await installGuestGateway(guestPage);
    const baseURL = process.env.STORYFORGE_E2E_BASE_URL || 'http://127.0.0.1:4179';
    await guestPage.goto(`${baseURL}/storyforge/guest/${GUEST_TOKEN}`);
    await expect(guestPage.getByRole('heading', { name: 'Maya asked for your help.' })).toBeVisible();
    await guestPage.getByRole('button', { name: 'BEGIN' }).click();
    await guestPage.getByRole('button', { name: 'Type instead' }).click();
    await guestPage.locator('#guestStory').fill('Maya stayed calm, listened, and helped everyone agree on the next step.');
    await guestPage.getByRole('button', { name: /Review my story/ }).click();
    await expect(guestPage.getByRole('heading', { name: 'These are your words.' })).toBeVisible();
    await guestPage.getByRole('button', { name: 'SEND TO MAYA ➤' }).click();
    await expect(guestPage.getByRole('heading', { name: 'Thank you. ❤' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test(`[B1-514-E2E-04] ${ACCEPTANCE['B1-514-E2E-04']}`, async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function play() {
      this.dataset.playCount = String(Number(this.dataset.playCount || 0) + 1);
      this.dataset.playState = 'playing';
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      this.dataset.playState = 'paused';
    };
  });
  await page.route(`**/api/mentor-notes/${mentorNote.id}/playback`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ url: 'https://audio.example.test/mentor-note.webm' }),
  }));
  await openStudent(page);
  await acceptConsentIfShown(page);
  await openStoryFromLibrary(page, mentorStory.title);
  const feedback = page.locator('.b1513r3Feedback');
  await expect(feedback.locator('.b1513r3Transcript')).toHaveText(MENTOR_TRANSCRIPT);
  await expect(feedback).toContainText('Transcript + original voice');
  const listen = feedback.getByRole('button', { name: 'Listen to original voice' });
  await listen.click();
  const audio = feedback.locator('audio[aria-label="Mentor note audio"]');
  await expect(audio).toHaveAttribute('controls', '');
  await expect.poll(() => audio.evaluate((node) => node.clientWidth)).toBeGreaterThan(0);
  await expect(audio).toHaveAttribute('data-play-state', 'playing');
  await audio.evaluate((node) => node.pause());
  await expect(audio).toHaveAttribute('data-play-state', 'paused');
  await audio.evaluate((node) => node.play());
  await expect(audio).toHaveAttribute('data-play-count', '2');
});

test(`[B1-514-E2E-05] ${ACCEPTANCE['B1-514-E2E-05']}`, async ({ page }) => {
  await openStudent(page);
  await acceptConsentIfShown(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('[data-theme-preference="light"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme-pref', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('[data-theme-preference="auto"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme-pref', 'auto');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
  await page.locator('[data-theme-preference="dark"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: /Ember Storm/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'emberstorm');
  await page.getByRole('button', { name: 'Save environment' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'emberstorm');
  await page.getByRole('button', { name: /Lumen Drift/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'lumen');
  await page.getByRole('button', { name: 'Save environment' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'lumen');
  await expect(page.getByText('Saved: Lumen Drift')).toBeVisible();
});
