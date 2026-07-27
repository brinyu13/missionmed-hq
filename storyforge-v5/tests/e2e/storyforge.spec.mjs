import assert from 'node:assert/strict';
import { test, expect } from '@playwright/test';

async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

test('raw API enforces privacy and the two-mentor coaching lifecycle', async ({ request }) => {
  const student = await devToken(request, 'student');
  const mentor = await devToken(request, 'mentor');
  const mentorTwo = await devToken(request, 'mentorTwo');
  const unassigned = await devToken(request, 'unassignedMentor');
  const admin = await devToken(request, 'admin');

  const create = await request.post('/api/stories', {
    headers: authHeaders(student),
    data: {
      title: 'API privacy proof',
      text: 'I noticed a family was being left out of the plan and asked the team to pause.',
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(create.status()).toBe(201);
  const story = (await create.json()).story;

  const gatedAi = await request.post('/api/ai/suggest', {
    headers: authHeaders(mentor),
    data: { mode: 'general' },
  });
  expect(gatedAi.status()).toBe(403);
  expect((await gatedAi.json()).error.code).toBe('ai_feature_gated');

  const gatedAudio = await request.post('/api/audio/presign', {
    headers: authHeaders(student),
    data: { storyId: story.id, contentType: 'audio/webm', byteSize: 128 },
  });
  expect(gatedAudio.status()).toBe(503);
  expect((await gatedAudio.json()).error.code).toBe('audio_storage_unavailable');

  for (const token of [mentor, unassigned, admin]) {
    const response = await request.get(`/api/stories/${story.id}`, { headers: authHeaders(token) });
    expect(response.status()).toBe(404);
  }

  const submit = await request.post(`/api/stories/${story.id}/submit`, {
    headers: authHeaders(student),
    data: { surface: 'workspace' },
  });
  expect(submit.ok()).toBeTruthy();

  expect((await request.get(`/api/stories/${story.id}`, { headers: authHeaders(mentor) })).status()).toBe(200);
  expect((await request.get(`/api/stories/${story.id}`, { headers: authHeaders(unassigned) })).status()).toBe(404);
  expect((await request.get(`/api/stories/${story.id}`, { headers: authHeaders(admin) })).status()).toBe(404);

  await request.post(`/api/stories/${story.id}/open`, {
    headers: authHeaders(mentor),
    data: { surface: 'quick' },
  });
  const review = await request.post(`/api/stories/${story.id}/review`, {
    headers: authHeaders(mentor),
    data: {
      feedback: 'Name the decision you influenced, then connect it to the next action you took.',
      status: 'needs_revision',
      mentorScore: 4,
      needsFollowup: true,
      classification: 'clinical',
      surface: 'workspace',
    },
  });
  expect(review.ok()).toBeTruthy();

  const notifications = await request.get('/api/notifications', { headers: authHeaders(student) });
  const studentNotifications = (await notifications.json()).notifications;
  expect(studentNotifications.some((item) => item.story_id === story.id && item.event_key === 'story.needs_revision')).toBeTruthy();

  await request.patch(`/api/stories/${story.id}`, {
    headers: authHeaders(student),
    data: {
      title: story.title,
      text: `${story.current_text} I learned to make the patient’s voice an explicit part of our decision.`,
      studentScore: 5,
      uses: ['behavioral'],
      surface: 'workspace',
    },
  });
  await request.post(`/api/stories/${story.id}/submit`, {
    headers: authHeaders(student),
    data: { surface: 'workspace' },
  });
  await request.post(`/api/stories/${story.id}/open`, {
    headers: authHeaders(mentorTwo),
    data: { surface: 'quick' },
  });
  const approved = await request.post(`/api/stories/${story.id}/review`, {
    headers: authHeaders(mentorTwo),
    data: {
      feedback: 'Approved. The reflection now names a durable change in behavior.',
      status: 'approved',
      mentorScore: 5,
      needsFollowup: false,
      classification: 'clinical',
      surface: 'workspace',
    },
  });
  expect((await approved.json()).story.status).toBe('approved');

  const detail = await request.get(`/api/stories/${story.id}`, { headers: authHeaders(student) });
  const final = await detail.json();
  expect(final.story.original_text).toBe(story.original_text);
  expect(final.story.current_text).not.toBe(story.original_text);
  expect(new Set(final.feedback.map((item) => item.mentor_id)).size).toBe(2);
});

test('student and mentor complete the V5 browser loop with truthful gates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Enter StoryForge' })).toBeVisible();
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  await page.getByRole('button', { name: /Quick capture/i }).first().click();
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByText(/Recording is unavailable in this environment/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeDisabled();
  await page.getByRole('button', { name: 'Write' }).click();
  await page.getByLabel('Story title').fill('A hard conversation');
  await page.getByLabel('Tell it in your own words').fill('I had to explain a difficult change while keeping the person involved in the decision.');
  await page.getByRole('button', { name: 'Save private story' }).click();
  await expect(page.getByRole('heading', { name: 'A hard conversation' })).toBeVisible();
  await page.getByRole('button', { name: 'Self score 4 of 5' }).click();
  await page.getByRole('button', { name: 'Submit to mentors' }).click();
  await expect(page.getByText('submitted', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Mentor · Dr. Chen' }).click();
  await page.getByRole('button', { name: /Review Queue/ }).first().click();
  await page.getByRole('button', { name: /A hard conversation/ }).click();
  await expect(page.getByText('opened', { exact: true })).toBeVisible();
  await page.getByLabel('Mentor score 4 of 5').click();
  await page.getByLabel('Feedback or ask').fill('Show what you noticed in the other person and how that changed your next sentence.');
  await page.getByRole('button', { name: 'Request revision' }).click();
  await expect(page.getByText('needs revision', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.getByRole('button', { name: /Notifications/ }).first().click();
  const revisionNotice = page.locator('[data-notification]').filter({
    hasText: 'Show what you noticed in the other person',
  });
  await expect(revisionNotice).toBeVisible();
  await revisionNotice.click();
  const current = page.getByLabel('Current telling');
  await current.fill(`${await current.inputValue()} I learned to pause and check understanding before offering the next option.`);
  await page.getByRole('button', { name: 'Resubmit to mentors' }).click();
  await expect(page.getByText('resubmitted', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Second mentor · Dr. Rivera' }).click();
  await page.getByRole('button', { name: /Review Queue/ }).first().click();
  await page.getByRole('button', { name: /A hard conversation/ }).click();
  await page.getByLabel('Mentor score 5 of 5').click();
  await page.getByLabel('Feedback or ask').fill('Approved. The revision makes your observation and behavior change concrete.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('approved', { exact: true })).toBeVisible();
  await expect(page.getByText('Dr. Chen')).toBeVisible();
  await expect(page.locator('#main').getByText('Dr. Rivera')).toBeVisible();

  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: '../_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-approved-workspace.png',
    fullPage: true,
  });
});

test('core student home has no serious or critical axe findings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();
  await page.addScriptTag({ url: '/_test/axe.js' });
  const result = await page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
    rules: {
      'color-contrast': { enabled: true },
    },
  }));
  const serious = result.violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  assert.deepEqual(
    serious.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    [],
  );
  await page.screenshot({
    path: '../_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-student-home.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Mobile StoryForge navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' }).last()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '../_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-student-mobile.png',
  });
});
