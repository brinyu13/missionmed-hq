import assert from 'node:assert/strict';
import { test, expect } from '@playwright/test';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok(), `fixture token for ${persona}`).toBeTruthy();
  return (await response.json()).token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createStory(request, token, title, { submit = true } = {}) {
  const response = await request.post('/api/stories', {
    headers: authHeaders(token),
    data: {
      title,
      text: `${title} preserves a concrete action, result, and lesson for behavioral verification.`,
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(response.status(), `create ${title}`).toBe(201);
  const story = (await response.json()).story;
  if (submit) {
    const submitted = await request.post(`/api/stories/${story.id}/submit`, {
      headers: authHeaders(token),
      data: { surface: 'workspace' },
    });
    expect(submitted.ok(), `submit ${title}`).toBeTruthy();
  }
  return story;
}

async function createQuestion(request, token, text, family = 'clinical') {
  const response = await request.post('/api/questions', {
    headers: authHeaders(token),
    data: { text, family, surface: 'library' },
  });
  expect(response.status(), `create ${text}`).toBe(201);
  return (await response.json()).question;
}

async function createPair(request, token, storyId, questionId, studentStrength) {
  const response = await request.post('/api/story-question-pairs', {
    headers: authHeaders(token),
    data: {
      storyId,
      questionId,
      studentStrength,
      why: 'This is a deliberately persisted story-question fit.',
      surface: 'workshop',
    },
  });
  expect(response.status(), 'create story-question pair').toBe(201);
  return (await response.json()).pair;
}

async function confirmAndScorePair(request, mentor, pairId, mentorStrength) {
  const confirmed = await request.post(`/api/story-question-pairs/${pairId}/confirm`, {
    headers: authHeaders(mentor),
    data: { surface: 'workshop' },
  });
  expect(confirmed.ok(), 'mentor confirms pair').toBeTruthy();
  const scored = await request.patch(`/api/story-question-pairs/${pairId}`, {
    headers: authHeaders(mentor),
    data: { mentorStrength, surface: 'workshop' },
  });
  expect(scored.ok(), 'mentor scores pair').toBeTruthy();
}

async function login(page, personaLabel) {
  await page.goto('/');
  await page.getByRole('button', { name: personaLabel }).click();
  await expect(page.locator('.homeHero, [data-view="mhome"], [data-view="qlib"]').first())
    .toBeVisible();
}

test('[B1-503] version zero remains a real concurrency token for stories and durable drafts', async ({
  request,
}) => {
  const student = await devToken(request, 'studentOther');
  const story = await createStory(request, student, 'Version-zero story', { submit: false });
  expect(Number(story.row_version)).toBe(0);

  const firstUpdate = await request.patch(`/api/stories/${story.id}`, {
    headers: authHeaders(student),
    data: {
      title: 'Version-zero story first writer',
      text: story.current_text,
      expectedVersion: 0,
      surface: 'workspace',
    },
  });
  expect(firstUpdate.ok()).toBeTruthy();
  expect(Number((await firstUpdate.json()).story.row_version)).toBe(1);

  const staleUpdate = await request.patch(`/api/stories/${story.id}`, {
    headers: authHeaders(student),
    data: {
      title: 'Version-zero story stale writer',
      text: story.current_text,
      expectedVersion: 0,
      surface: 'workspace',
    },
  });
  expect(staleUpdate.status()).toBe(409);
  expect((await staleUpdate.json()).error.code).toBe('40001');

  const firstDraft = await request.patch('/api/drafts/story-builder', {
    headers: authHeaders(student),
    data: {
      payload: { title: 'First draft writer', text: 'Persisted once.' },
      expectedVersion: 0,
    },
  });
  expect(firstDraft.ok()).toBeTruthy();
  const draft = (await firstDraft.json()).draft;
  expect(Number(draft.row_version)).toBe(0);

  const secondDraft = await request.patch('/api/drafts/story-builder', {
    headers: authHeaders(student),
    data: {
      payload: { title: 'Second draft writer', text: 'Valid version-zero update.' },
      expectedVersion: 0,
    },
  });
  expect(secondDraft.ok()).toBeTruthy();
  expect(Number((await secondDraft.json()).draft.row_version)).toBe(1);

  const staleDraft = await request.patch('/api/drafts/story-builder', {
    headers: authHeaders(student),
    data: {
      payload: { title: 'Stale draft writer', text: 'Must never overwrite.' },
      expectedVersion: 0,
    },
  });
  expect(staleDraft.status()).toBe(409);
  expect((await staleDraft.json()).error.code).toBe('40001');
  const persistedDraft = await request.get('/api/drafts/story-builder', {
    headers: authHeaders(student),
  });
  expect((await persistedDraft.json()).draft.payload.title).toBe('Second draft writer');
});

test('[B1-503] readiness requires the preferred pair itself to be confirmed and strong', async ({
  request,
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const student = await devToken(request, 'student');
  const mentor = await devToken(request, 'mentor');
  const question = await createQuestion(
    request,
    student,
    `How did you protect a patient decision when the plan changed? ${suffix}`,
  );
  const weakPreferredStory = await createStory(request, student, `Weak preferred ${suffix}`);
  const strongOtherStory = await createStory(request, student, `Strong other ${suffix}`);
  const weakPair = await createPair(
    request,
    student,
    weakPreferredStory.id,
    question.id,
    4,
  );
  const strongPair = await createPair(
    request,
    student,
    strongOtherStory.id,
    question.id,
    5,
  );
  await confirmAndScorePair(request, mentor, weakPair.id, 2);
  await confirmAndScorePair(request, mentor, strongPair.id, 5);

  const preferWeak = await request.post('/api/question-preferences', {
    headers: authHeaders(student),
    data: {
      questionId: question.id,
      storyId: weakPreferredStory.id,
      surface: 'workshop',
    },
  });
  expect(preferWeak.ok()).toBeTruthy();

  let intelligence = await request.get('/api/interview-intelligence', {
    headers: authHeaders(student),
  });
  let row = (await intelligence.json()).questions.find((item) => item.id === question.id);
  expect(row).toMatchObject({
    state: 'progress',
    pairCount: 2,
    confirmedCount: 2,
    readyPairCount: 0,
    bestMentorStrength: 5,
  });

  const preferStrong = await request.post('/api/question-preferences', {
    headers: authHeaders(student),
    data: {
      questionId: question.id,
      storyId: strongOtherStory.id,
      surface: 'workshop',
    },
  });
  expect(preferStrong.ok()).toBeTruthy();
  intelligence = await request.get('/api/interview-intelligence', {
    headers: authHeaders(student),
  });
  row = (await intelligence.json()).questions.find((item) => item.id === question.id);
  expect(row).toMatchObject({
    state: 'ready',
    pairCount: 2,
    confirmedCount: 2,
    readyPairCount: 1,
  });

  const followup = await request.post('/api/pair-followups', {
    headers: authHeaders(student),
    data: {
      pairId: strongPair.id,
      text: 'What evidence changed your decision?',
      clinical: true,
      prepared: false,
      note: 'Name the evidence and its consequence.',
      surface: 'workshop',
    },
  });
  expect(followup.status()).toBe(201);
  intelligence = await request.get('/api/interview-intelligence', {
    headers: authHeaders(student),
  });
  const intelligencePayload = await intelligence.json();

  await login(page, 'Student · Maya');
  await page.getByRole('button', { name: /Interview Prep/ }).first().click();
  const prepRow = page.locator('.qiRow').filter({ hasText: question.text });
  await expect(
    page.locator('.readyStrip .fstat').filter({ hasText: 'Ready' }).locator('.n'),
  ).toHaveText(String(intelligencePayload.stats.ready));
  await expect(
    page.locator('.readyStrip .fstat').filter({ hasText: 'In progress' }).locator('.n'),
  ).toHaveText(String(intelligencePayload.stats.progress));
  await expect(
    page.locator('.readyStrip .fstat').filter({ hasText: 'No story yet' }).locator('.n'),
  ).toHaveText(String(intelligencePayload.stats.gaps));
  await expect(
    page.locator('.readyStrip .fstat').filter({ hasText: 'Follow-ups prepared' }).locator('.n'),
  ).toHaveText(
    `${intelligencePayload.stats.followupsPrepared}/${intelligencePayload.stats.followupsTotal}`,
  );
  await expect(prepRow.locator('.qFam')).toContainText('student');
  await expect(prepRow).toContainText('2 stories');
  await expect(prepRow).toContainText('0/1 follow-ups');
  await expect(prepRow.getByLabel('Best mentor strength for this question'))
    .toHaveAttribute('aria-label', 'Best mentor strength for this question: 5 of 5');
  await expect(prepRow.getByText('Ready', { exact: true })).toBeVisible();
});

test('[B1-503] Workshop exposes the persisted follow-up editing model and no-pair capture path', async ({
  request,
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const student = await devToken(request, 'student');
  const mentor = await devToken(request, 'mentor');
  const question = await createQuestion(
    request,
    student,
    `What did this clinical experience teach you? ${suffix}`,
  );
  const storyOne = await createStory(request, student, `Workshop first ${suffix}`);
  const storyTwo = await createStory(request, student, `Workshop second ${suffix}`);
  const pairOne = await createPair(request, student, storyOne.id, question.id, 4);
  const pairTwo = await createPair(request, student, storyTwo.id, question.id, 4);
  await confirmAndScorePair(request, mentor, pairOne.id, 4);
  await confirmAndScorePair(request, mentor, pairTwo.id, 4);
  await request.post('/api/question-preferences', {
    headers: authHeaders(student),
    data: { questionId: question.id, storyId: storyOne.id, surface: 'workshop' },
  });

  const firstCreate = await request.post('/api/pair-followups', {
    headers: authHeaders(student),
    data: {
      pairId: pairOne.id,
      text: 'What was your initial differential?',
      clinical: true,
      prepared: false,
      note: '',
      surface: 'workshop',
    },
  });
  expect(firstCreate.status()).toBe(201);
  const first = (await firstCreate.json()).followup;
  const secondCreate = await request.post('/api/pair-followups', {
    headers: authHeaders(mentor),
    data: {
      pairId: pairOne.id,
      text: 'When did you escalate?',
      clinical: false,
      prepared: false,
      note: '',
      surface: 'workshop',
    },
  });
  expect(secondCreate.status()).toBe(201);
  const second = (await secondCreate.json()).followup;

  const edited = await request.patch(`/api/pair-followups/${second.id}`, {
    headers: authHeaders(mentor),
    data: {
      text: 'When did you escalate and why?',
      note: 'Tie the escalation threshold to the patient state.',
      clinical: true,
      sortOrder: 2,
      expectedVersion: 0,
      surface: 'workshop',
    },
  });
  expect(edited.ok()).toBeTruthy();
  const editedFollowup = (await edited.json()).followup;
  expect(editedFollowup).toMatchObject({
    text: 'When did you escalate and why?',
    preparation_note: 'Tie the escalation threshold to the patient state.',
    clinical: true,
    sort_order: 2,
  });
  expect(Number(editedFollowup.row_version)).toBe(1);
  const staleEdit = await request.patch(`/api/pair-followups/${second.id}`, {
    headers: authHeaders(mentor),
    data: {
      note: 'A stale note must not overwrite.',
      expectedVersion: 0,
      surface: 'workshop',
    },
  });
  expect(staleEdit.status()).toBe(409);
  expect((await staleEdit.json()).error.code).toBe('40001');

  await login(page, 'Student · Maya');
  await page.getByRole('button', { name: /Interview Prep/ }).first().click();
  await page.locator('.qiRow').filter({ hasText: question.text }).click();
  await expect(page.locator('[data-view="qshop"] h1')).toContainText(question.text);
  await expect(page.getByLabel('Follow-ups for')).toHaveValue(pairOne.id);
  const editedRow = page.locator('.fupRow').filter({
    has: page.locator(`[data-followup-text="${second.id}"]`),
  });
  await expect(editedRow.locator(`[data-followup-text="${second.id}"]`))
    .toHaveValue('When did you escalate and why?');
  await expect(editedRow.locator(`[data-followup-note="${second.id}"]`))
    .toHaveValue('Tie the escalation threshold to the patient state.');
  await expect(editedRow.getByText('DB', { exact: true })).toBeVisible();
  await expect(editedRow.locator(`[data-followup-clinical="${second.id}"]`)).toBeChecked();
  await expect(editedRow.locator('[data-move-delta="1"]')).toHaveAttribute('title', 'Move down');
  await expect(editedRow.locator('[data-move-delta="-1"]')).toHaveAttribute('title', 'Move up');
  await page.getByLabel('Follow-ups for').selectOption(pairTwo.id);
  await expect(page.getByText('None mapped yet')).toBeVisible();
  await page.getByLabel('Follow-ups for').selectOption(pairOne.id);
  await editedRow.locator(`[data-followup-text="${second.id}"]`)
    .fill('When should you have escalated and why?');
  await editedRow.locator(`[data-followup-note="${second.id}"]`)
    .fill('State the escalation threshold and the patient consequence.');
  await editedRow.getByRole('button', { name: 'Save edits' }).click();
  await expect(page.locator(`[data-followup-text="${second.id}"]`))
    .toHaveValue('When should you have escalated and why?');
  await expect(page.locator(`[data-followup-note="${second.id}"]`))
    .toHaveValue('State the escalation threshold and the patient consequence.');
  await page.locator('.fupRow').filter({
    has: page.locator(`[data-followup-text="${second.id}"]`),
  }).locator('[data-move-delta="-1"]').click();
  await expect(page.locator('.fupRow [data-followup-text]').first())
    .toHaveValue('When should you have escalated and why?');
  assert.notEqual(first.id, second.id);

  const noPairQuestion = await createQuestion(
    request,
    student,
    `What story is still missing? ${suffix}`,
    'behavioral',
  );
  await page.getByRole('button', { name: 'Interview Prep' }).first().click();
  await page.locator('.qiRow').filter({ hasText: noPairQuestion.text }).click();
  await page.getByRole('button', { name: 'Capture a new story for this question' }).click();
  await expect(page.locator('#capture.open')).toBeVisible();
  await expect(
    page.locator('#capture .capHint').filter({ hasText: noPairQuestion.text }),
  ).toBeVisible();
});

test('[B1-503] story lifecycle timestamps preserve mentor opening and reviewer identity', async ({
  request,
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const student = await devToken(request, 'student');
  const mentor = await devToken(request, 'mentor');
  const story = await createStory(request, student, `Timestamp proof ${suffix}`);
  const opened = await request.post(`/api/stories/${story.id}/open`, {
    headers: authHeaders(mentor),
    data: { surface: 'quick' },
  });
  expect(opened.ok()).toBeTruthy();
  const reviewed = await request.post(`/api/stories/${story.id}/review`, {
    headers: authHeaders(mentor),
    data: {
      feedback: 'The chronology is concrete and the reviewer attribution must remain visible.',
      status: 'reviewed',
      mentorScore: 4,
      needsFollowup: false,
      classification: 'clinical',
      surface: 'workspace',
    },
  });
  expect(reviewed.ok()).toBeTruthy();

  const detailResponse = await request.get(`/api/stories/${story.id}`, {
    headers: authHeaders(student),
  });
  const detail = (await detailResponse.json()).story;
  expect(detail.submitted_at).toBeTruthy();
  expect(detail.opened_at).toBeTruthy();
  expect(detail.reviewed_at).toBeTruthy();
  expect(detail.reviewed_by_name).toBe('Dr. Chen');

  await login(page, 'Student · Maya');
  await page.getByRole('button', { name: /Story Library/ }).first().click();
  await page.locator(`[data-story-row="${story.id}"] [data-open-story]`).click();
  const timeline = page.locator('#room .tsList').first();
  await expect(timeline.getByText('Submitted', { exact: true })).toBeVisible();
  await expect(timeline.getByText('First opened by mentor', { exact: true })).toBeVisible();
  await expect(timeline.getByText('Last reviewed', { exact: true })).toBeVisible();
  await expect(timeline).toContainText('Dr. Chen');
  await expect(page.locator('#room').getByText(/Mentor score — Dr\. Chen/)).toBeVisible();
});

test('[B1-503] governed imports enforce authorization, formula and near-review checks, and rollback history', async ({
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const student = await devToken(request, 'student');
  const admin = await devToken(request, 'admin');
  const studentPreview = await request.post('/api/imports/preview', {
    headers: authHeaders(student),
    data: { format: 'paste', text: `Unauthorized question ${suffix}` },
  });
  expect(studentPreview.status()).toBe(403);
  const studentList = await request.get('/api/imports', {
    headers: authHeaders(student),
  });
  expect(studentList.status()).toBe(403);
  const studentCommit = await request.post('/api/imports/commit', {
    headers: authHeaders(student),
    data: {
      sourceName: 'student-bypass',
      format: 'paste',
      rows: [{ text: `Unauthorized question ${suffix}`, family: 'core', selected: true }],
    },
  });
  expect(studentCommit.status()).toBe(403);

  const missingFingerprint = await request.post('/api/imports/commit', {
    headers: authHeaders(admin),
    data: {
      sourceName: `missing-fingerprint-${suffix}`,
      format: 'paste',
      rows: [{
        text: `Which experience changed your approach? ${suffix}`,
        family: 'core',
        selected: true,
      }],
    },
  });
  expect(missingFingerprint.status()).toBe(400);
  expect((await missingFingerprint.json()).error.code).toBe('import_preview_stale');

  const formulaPreview = await request.post('/api/imports/preview', {
    headers: authHeaders(admin),
    data: { format: 'paste', text: '=2+2 | core' },
  });
  expect(formulaPreview.ok()).toBeTruthy();
  const formulaPayload = await formulaPreview.json();
  expect(formulaPayload.rows[0].formulaLike).toBe(true);
  expect(formulaPayload.rows[0].selected).toBe(false);
  const formulaCommit = await request.post('/api/imports/commit', {
    headers: authHeaders(admin),
    data: {
      sourceName: `formula-${suffix}`,
      format: 'paste',
      rows: [{ ...formulaPayload.rows[0], selected: true }],
      reviewFingerprint: formulaPayload.reviewFingerprint,
    },
  });
  expect(formulaCommit.status()).toBe(400);
  expect((await formulaCommit.json()).error.code).toBe('import_preview_stale');

  const questions = await request.get('/api/questions', { headers: authHeaders(admin) });
  const existing = (await questions.json()).questions.find(
    (question) => question.canonical_key === 'q1',
  );
  expect(existing).toBeTruthy();
  const nearText = `${existing.text.replace(/[?.!]$/, '')} today?`;
  const nearPreview = await request.post('/api/imports/preview', {
    headers: authHeaders(admin),
    data: { format: 'paste', text: nearText },
  });
  expect(nearPreview.ok()).toBeTruthy();
  const nearPayload = await nearPreview.json();
  const nearRow = nearPayload.rows[0];
  expect(nearRow.nearDuplicateId).toBe(existing.id);
  expect(nearRow.selected).toBe(false);

  const forgedNear = await request.post('/api/imports/commit', {
    headers: authHeaders(admin),
    data: {
      sourceName: `near-unreviewed-${suffix}`,
      format: 'paste',
      rows: [{
        text: nearText,
        family: nearRow.family,
        selected: true,
        nearDuplicateId: null,
      }],
      reviewFingerprint: nearPayload.reviewFingerprint,
    },
  });
  expect(forgedNear.status()).toBe(400);
  expect((await forgedNear.json()).error.code).toBe('import_preview_stale');

  const reviewedNear = await request.post('/api/imports/commit', {
    headers: authHeaders(admin),
    data: {
      sourceName: `near-reviewed-${suffix}`,
      format: 'paste',
      rows: [{ ...nearRow, selected: true }],
      reviewFingerprint: nearPayload.reviewFingerprint,
    },
  });
  expect(reviewedNear.status()).toBe(201);
  const reviewedBatch = (await reviewedNear.json()).batch;
  let batches = await request.get('/api/imports', { headers: authHeaders(admin) });
  let reviewedHistory = (await batches.json()).batches.find(
    (batch) => batch.id === reviewedBatch.id,
  );
  expect(reviewedHistory).toMatchObject({
    state: 'committed',
    created_question_count: 1,
  });

  const rollback = await request.post(`/api/imports/${reviewedBatch.id}/rollback`, {
    headers: authHeaders(admin),
    data: {},
  });
  expect(rollback.ok()).toBeTruthy();
  expect((await rollback.json()).batch).toMatchObject({
    id: reviewedBatch.id,
    state: 'rolled_back',
  });
  batches = await request.get('/api/imports', { headers: authHeaders(admin) });
  reviewedHistory = (await batches.json()).batches.find(
    (batch) => batch.id === reviewedBatch.id,
  );
  expect(reviewedHistory.state).toBe('rolled_back');
  expect(reviewedHistory.rolled_back_at).toBeTruthy();
});

test('[B1-503] archived stories disappear from interview-prep derivatives', async ({
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const student = await devToken(request, 'student');
  const mentor = await devToken(request, 'mentor');
  const question = await createQuestion(
    request,
    student,
    `How did the archived case change your reasoning? ${suffix}`,
  );
  const story = await createStory(request, student, `Archived derivative ${suffix}`);
  const pair = await createPair(request, student, story.id, question.id, 5);
  await confirmAndScorePair(request, mentor, pair.id, 5);
  await request.post('/api/question-preferences', {
    headers: authHeaders(student),
    data: { questionId: question.id, storyId: story.id, surface: 'workshop' },
  });
  await request.post('/api/pair-followups', {
    headers: authHeaders(student),
    data: {
      pairId: pair.id,
      text: 'Which archived detail changed the differential?',
      clinical: true,
      prepared: true,
      note: 'This must not count after archive.',
      surface: 'workshop',
    },
  });
  await request.post('/api/question-coaching-notes', {
    headers: authHeaders(mentor),
    data: {
      studentId: STUDENT_ID,
      questionId: question.id,
      storyId: story.id,
      body: 'This story-scoped coaching note must not outlive the active story surface.',
      surface: 'workshop',
    },
  });

  const before = await request.get('/api/interview-intelligence', {
    headers: authHeaders(student),
  });
  expect((await before.json()).questions.find((item) => item.id === question.id))
    .toMatchObject({
      state: 'ready',
      pairCount: 1,
      followupsTotal: 1,
      followupsPrepared: 1,
    });

  const archived = await request.post(`/api/stories/${story.id}/archive`, {
    headers: authHeaders(student),
    data: { surface: 'library' },
  });
  expect(archived.ok()).toBeTruthy();

  const after = await request.get('/api/interview-intelligence', {
    headers: authHeaders(student),
  });
  expect((await after.json()).questions.find((item) => item.id === question.id))
    .toMatchObject({
      state: 'none',
      preferredStoryId: null,
      pairCount: 0,
      confirmedCount: 0,
      readyPairCount: 0,
      followupsTotal: 0,
      followupsPrepared: 0,
    });

  const workshop = await request.get(`/api/questions/${question.id}/workshop`, {
    headers: authHeaders(student),
  });
  const payload = await workshop.json();
  expect(payload.preferredStoryId).toBeNull();
  expect(payload.preference).toBeNull();
  expect(payload.pairs).toEqual([]);
  expect(payload.suggestedStories.some((item) => item.id === story.id)).toBe(false);
  expect(payload.coachingNotes.some((item) => item.story_id === story.id)).toBe(false);

  const queue = await request.get('/api/queue', { headers: authHeaders(mentor) });
  expect((await queue.json()).stories.some((item) => item.id === story.id)).toBe(false);
});
