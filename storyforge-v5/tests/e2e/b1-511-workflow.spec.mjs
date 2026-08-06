import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { expect, test } from '@playwright/test';

const FLAG_KEYS = [
  'story_workflow',
  'story_taxonomy',
  'inline_priority',
  'story_search',
  'mentor_notes',
];

const packageDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const screenshotDir = path.resolve(
  packageDir,
  '../_AI_HANDOFFS/from_codex/B1-511_storyforge_student_mentor_workflow/screenshots',
);
mkdirSync(screenshotDir, { recursive: true });

async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok(), `fixture token for ${persona}`).toBeTruthy();
  return (await response.json()).token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function setB1511Flags(scope) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = $1,
              allowlist = ARRAY[]::uuid[],
              cohorts = ARRAY[]::text[],
              updated_at = now()
        WHERE key = ANY($2::text[])`,
      [scope, FLAG_KEYS],
    );
    expect(result.rowCount).toBe(FLAG_KEYS.length);
  } finally {
    await client.end();
  }
}

async function createStory(request, token, title) {
  const response = await request.post('/api/stories', {
    headers: authHeaders(token),
    data: {
      title,
      text: `${title} preserves a concrete action, result, and lesson for B1-511 verification.`,
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).story;
}

test.beforeEach(async () => {
  await setB1511Flags('eligible_all');
});

test.afterEach(async () => {
  await setB1511Flags('off');
});

test('B1-511 submission, taxonomy, priority, mentor notes, withdrawal, and privacy form one server-enforced lifecycle', async ({ request }) => {
  const student = await devToken(request, 'student');
  const studentWithoutMentor = await devToken(request, 'studentOther');
  const mentor = await devToken(request, 'mentor');

  const studentSession = await request.get('/api/session', { headers: authHeaders(student) });
  expect((await studentSession.json()).capabilities).toMatchObject({
    submissionReview: true,
    taxonomy: true,
    inlinePriority: true,
    storySearch: true,
    mentorNotes: false,
    mentorNotesRead: true,
  });

  const unassignedStory = await createStory(request, studentWithoutMentor, 'B1-511 assignment-independent submission');
  const unassignedSubmit = await request.post(`/api/stories/${unassignedStory.id}/submit`, {
    headers: authHeaders(studentWithoutMentor),
    data: { surface: 'workspace' },
  });
  expect(unassignedSubmit.ok()).toBeTruthy();

  let story = await createStory(request, student, 'B1-511 mentor workflow proof');
  const taxonomy = await request.patch(`/api/stories/${story.id}/taxonomy`, {
    headers: authHeaders(student),
    data: {
      categories: ['clinical', 'communication'],
      uses: ['ps', 'myeras_most_impactful'],
      expectedVersion: Number(story.row_version),
      surface: 'workspace',
    },
  });
  expect(taxonomy.ok()).toBeTruthy();
  story = (await taxonomy.json()).story;
  const priority = await request.patch(`/api/stories/${story.id}/priority`, {
    headers: authHeaders(student),
    data: { priority: 5, expectedVersion: Number(story.rowVersion), surface: 'library' },
  });
  expect(priority.ok()).toBeTruthy();
  story = (await priority.json()).story;
  const submitted = await request.post(`/api/stories/${story.id}/submit`, {
    headers: authHeaders(student),
    data: { surface: 'workspace' },
  });
  expect(submitted.ok()).toBeTruthy();
  story = (await submitted.json()).story;

  const mentorSession = await request.get('/api/session', { headers: authHeaders(mentor) });
  expect((await mentorSession.json()).capabilities).toMatchObject({
    mentorNotes: true,
    mentorNotesRead: true,
  });
  const created = await request.post(`/api/stories/${story.id}/mentor-notes`, {
    headers: authHeaders(mentor),
    data: { body: 'Preserve the turning point and the result.', internalOnly: false, surface: 'workspace' },
  });
  expect(created.status()).toBe(201);
  let note = (await created.json()).note;
  const beforePublish = await request.get(`/api/stories/${story.id}/mentor-notes`, {
    headers: authHeaders(student),
  });
  expect((await beforePublish.json()).notes).toEqual([]);
  const published = await request.post(`/api/mentor-notes/${note.id}/publish`, {
    headers: authHeaders(mentor),
    data: { expectedVersion: note.rowVersion, surface: 'workspace' },
  });
  expect(published.ok()).toBeTruthy();
  note = (await published.json()).note;
  expect(note.state).toBe('published');
  const visible = await request.get(`/api/stories/${story.id}/mentor-notes`, {
    headers: authHeaders(student),
  });
  expect((await visible.json()).notes.map((item) => item.body)).toEqual([
    'Preserve the turning point and the result.',
  ]);

  const internalCreated = await request.post(`/api/stories/${story.id}/mentor-notes`, {
    headers: authHeaders(mentor),
    data: { body: 'Reviewer-only note.', internalOnly: true, surface: 'workspace' },
  });
  expect(internalCreated.status()).toBe(201);
  const internal = (await internalCreated.json()).note;
  const internalPublish = await request.post(`/api/mentor-notes/${internal.id}/publish`, {
    headers: authHeaders(mentor),
    data: { expectedVersion: internal.rowVersion, surface: 'workspace' },
  });
  expect(internalPublish.status()).toBe(403);
  const crossUser = await request.get(`/api/stories/${story.id}/mentor-notes`, {
    headers: authHeaders(studentWithoutMentor),
  });
  expect(crossUser.status()).toBe(404);

  const withdrawn = await request.post(`/api/stories/${story.id}/withdraw`, {
    headers: authHeaders(student),
    data: { expectedVersion: Number(story.row_version), surface: 'workspace' },
  });
  expect(withdrawn.ok()).toBeTruthy();
  expect((await withdrawn.json()).story.status).toBe('private');
  const mentorAfterWithdrawal = await request.get(`/api/stories/${story.id}/mentor-notes`, {
    headers: authHeaders(mentor),
  });
  expect(mentorAfterWithdrawal.status()).toBe(404);
});

test('B1-511 Library keeps uninterrupted search and row-only priority controls in the canonical student release', async ({ page, request }) => {
  const student = await devToken(request, 'student');
  await createStory(request, student, 'B1-511 uninterrupted-search proof');
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  await page.screenshot({
    path: path.join(screenshotDir, 'student-private-library-desktop.png'),
    fullPage: true,
  });
  await expect(page.getByRole('option', { name: 'Sort: priority 5→1' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Clinical', exact: true })).toBeVisible();
  const search = page.locator('#libQ');
  await search.fill('uninterrupted-search proof');
  await expect(search).toHaveValue('uninterrupted-search proof');
  await page.waitForTimeout(260);
  await expect(page.locator('#libraryRows [data-story-row]')).toHaveCount(1);
  const priority = page.locator('[data-library-priority="5"]').first();
  await expect(priority).toBeVisible();
  await priority.click();
  await expect(priority).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('uninterrupted-search proof');
  await page.screenshot({
    path: path.join(screenshotDir, 'student-search-priority-category.png'),
    fullPage: true,
  });

  await search.press('Escape');
  await search.fill('');
  await page.getByRole('button', { name: 'Clinical', exact: true }).click();
  await page.screenshot({
    path: path.join(screenshotDir, 'student-category-filter.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: path.join(screenshotDir, 'student-library-tablet-768x1024.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(screenshotDir, 'student-library-mobile-390x844.png'),
    fullPage: true,
  });
});

test('B1-511 sole renderer offers submission to an eligible student without a mentor assignment', async ({ page, request }) => {
  const student = await devToken(request, 'studentOther');
  await createStory(request, student, 'B1-511 assignment-independent UI canary');

  await page.goto('/');
  await page.getByRole('button', { name: 'Second student · privacy boundary' }).click();
  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  const row = page.locator('[data-story-row]').filter({ hasText: 'B1-511 assignment-independent UI canary' });
  await row.getByRole('button', { name: 'Open story' }).click();
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible();
  await expect(page.getByText('Mentor review unavailable', { exact: true })).toHaveCount(0);
});
