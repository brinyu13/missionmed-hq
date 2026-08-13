import assert from 'node:assert/strict';
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import pg from 'pg';

async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function resetSharedFixturePreferences(request) {
  const student = await devToken(request, 'student');
  const studentOther = await devToken(request, 'studentOther');
  const admin = await devToken(request, 'admin');
  for (const token of [student, studentOther]) {
    const background = await request.patch('/api/preferences/background', {
      headers: authHeaders(token),
      data: { background: 'ember' },
    });
    expect(background.ok()).toBeTruthy();
  }
  const current = await request.get('/api/presentation', { headers: authHeaders(student) });
  expect(current.ok()).toBeTruthy();
  const configuration = (await current.json()).configuration;
  if (configuration.payload.navigation.interviewPrepVisible) {
    const published = await request.post('/api/admin/console/content-display/publish', {
      headers: authHeaders(admin),
      data: {
        expectedVersion: Number(configuration.rowVersion ?? configuration.version),
        payload: {
          ...configuration.payload,
          navigation: { interviewPrepVisible: false },
        },
      },
    });
    expect(published.ok()).toBeTruthy();
  }
}

test.beforeEach(async ({ request }) => {
  await resetSharedFixturePreferences(request);
});

async function setMentorAssignmentActive(studentId, mentorId, active) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE public.sf_mentor_assignments
       SET active = $3
       WHERE student_id = $1 AND mentor_id = $2`,
      [studentId, mentorId, active],
    );
    assert.equal(result.rowCount, 1);
  } finally {
    await client.end();
  }
}

async function mismatchedWordPressIdentityToken() {
  return new SignJWT({
    app_role: 'student',
    storyforge_eligible: true,
    wp_user_id: 1102,
    name: 'Mismatched WordPress identity',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('storyforge-local-e2e')
    .setAudience('storyforge')
    .setSubject('11111111-1111-4111-8111-111111111111')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode('b1-500-local-e2e-secret-not-for-production'));
}

test('raw API enforces privacy and the two-mentor coaching lifecycle', async ({ request }) => {
  const student = await devToken(request, 'student');
  const studentWithoutMentor = await devToken(request, 'studentOther');
  const mentor = await devToken(request, 'mentor');
  const mentorTwo = await devToken(request, 'mentorTwo');
  const unassigned = await devToken(request, 'unassignedMentor');
  const admin = await devToken(request, 'admin');

  const initialStudentSession = await request.get('/api/session', {
    headers: authHeaders(student),
  });
  expect((await initialStudentSession.json()).user.background_preference).toBe('ember');
  const preferenceUpdate = await request.patch('/api/preferences/background', {
    headers: authHeaders(student),
    data: { background: 'aurora' },
  });
  expect(preferenceUpdate.ok()).toBeTruthy();
  expect((await preferenceUpdate.json()).backgroundPreference).toBe('aurora');
  const otherStudentSession = await request.get('/api/session', {
    headers: authHeaders(studentWithoutMentor),
  });
  expect((await otherStudentSession.json()).user.background_preference).toBe('ember');
  const persistedStudentSession = await request.get('/api/session', {
    headers: authHeaders(student),
  });
  expect((await persistedStudentSession.json()).user.background_preference).toBe('aurora');
  const invalidPreference = await request.patch('/api/preferences/background', {
    headers: authHeaders(student),
    data: { background: 'sunlit-parchment' },
  });
  expect(invalidPreference.status()).toBe(400);
  expect((await invalidPreference.json()).error.code).toBe('22023');
  await request.patch('/api/preferences/background', {
    headers: authHeaders(student),
    data: { background: 'ember' },
  });

  const mismatchedIdentity = await request.get('/api/session', {
    headers: authHeaders(await mismatchedWordPressIdentityToken()),
  });
  expect(mismatchedIdentity.status()).toBe(403);
  expect((await mismatchedIdentity.json()).error.code).toBe('eligibility_required');

  const studentCustomCreate = await request.post('/api/questions', {
    headers: authHeaders(student),
    data: {
      text: 'How did this experience change the way you ask for help?',
      family: 'personal',
      surface: 'library',
    },
  });
  expect(studentCustomCreate.status()).toBe(201);
  const studentCustomQuestion = (await studentCustomCreate.json()).question;
  expect(studentCustomQuestion).toMatchObject({
    provenance: 'student',
    owner_student_id: '11111111-1111-4111-8111-111111111111',
    governance_state: 'draft',
  });
  const ownerQuestions = await request.get('/api/questions', {
    headers: authHeaders(student),
  });
  expect((await ownerQuestions.json()).questions.some(
    (question) => question.id === studentCustomQuestion.id,
  )).toBeTruthy();
  for (const token of [studentWithoutMentor, mentor, mentorTwo, unassigned, admin]) {
    const questions = await request.get('/api/questions', { headers: authHeaders(token) });
    expect((await questions.json()).questions.some(
      (question) => question.id === studentCustomQuestion.id,
    )).toBeFalsy();
  }
  const assignedMentorQuestions = await request.get('/api/questions', {
    headers: authHeaders(mentor),
    params: { studentId: '11111111-1111-4111-8111-111111111111' },
  });
  expect((await assignedMentorQuestions.json()).questions.some(
    (question) => question.id === studentCustomQuestion.id,
  )).toBeTruthy();
  const unassignedMentorScope = await request.get('/api/questions', {
    headers: authHeaders(mentor),
    params: { studentId: '22222222-2222-4222-8222-222222222222' },
  });
  expect(unassignedMentorScope.status()).toBe(403);
  expect((await unassignedMentorScope.json()).error.code).toBe('42501');
  const duplicateCustom = await request.post('/api/questions', {
    headers: authHeaders(student),
    data: {
      text: '  how did this experience change the way you ask for help?  ',
      family: 'personal',
      surface: 'library',
    },
  });
  expect(duplicateCustom.status()).toBe(409);
  expect((await duplicateCustom.json()).error.code).toBe('23505');
  const invalidCustom = await request.post('/api/questions', {
    headers: authHeaders(student),
    data: {
      text: 'Which experience best demonstrates that growth?',
      family: 'unsupported-family',
      surface: 'library',
    },
  });
  expect(invalidCustom.status()).toBe(400);
  expect((await invalidCustom.json()).error.code).toBe('22023');

  const parallelPrivateCreate = await request.post('/api/questions', {
    headers: authHeaders(studentWithoutMentor),
    data: {
      text: 'How did this experience change the way you ask for help?',
      family: 'personal',
      surface: 'library',
    },
  });
  expect(parallelPrivateCreate.status()).toBe(201);
  const parallelPrivateQuestion = (await parallelPrivateCreate.json()).question;
  expect(parallelPrivateQuestion.owner_student_id)
    .toBe('22222222-2222-4222-8222-222222222222');

  await setMentorAssignmentActive(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    true,
  );
  try {
    const mentorTwoUnscoped = await request.get('/api/questions', {
      headers: authHeaders(mentorTwo),
    });
    const unscopedQuestions = (await mentorTwoUnscoped.json()).questions;
    expect(unscopedQuestions.some(
      (question) => question.id === studentCustomQuestion.id,
    )).toBeFalsy();
    expect(unscopedQuestions.some(
      (question) => question.id === parallelPrivateQuestion.id,
    )).toBeFalsy();

    const mentorTwoFirstStudent = await request.get('/api/questions', {
      headers: authHeaders(mentorTwo),
      params: { studentId: '11111111-1111-4111-8111-111111111111' },
    });
    const firstStudentQuestions = (await mentorTwoFirstStudent.json()).questions;
    expect(firstStudentQuestions.some(
      (question) => question.id === studentCustomQuestion.id,
    )).toBeTruthy();
    expect(firstStudentQuestions.some(
      (question) => question.id === parallelPrivateQuestion.id,
    )).toBeFalsy();
    expect(firstStudentQuestions.filter((question) => question.owner_student_id).every(
      (question) => question.owner_student_id === '11111111-1111-4111-8111-111111111111',
    )).toBeTruthy();

    const mentorTwoSecondStudent = await request.get('/api/questions', {
      headers: authHeaders(mentorTwo),
      params: { studentId: '22222222-2222-4222-8222-222222222222' },
    });
    const secondStudentQuestions = (await mentorTwoSecondStudent.json()).questions;
    expect(secondStudentQuestions.some(
      (question) => question.id === parallelPrivateQuestion.id,
    )).toBeTruthy();
    expect(secondStudentQuestions.some(
      (question) => question.id === studentCustomQuestion.id,
    )).toBeFalsy();
    expect(secondStudentQuestions.filter((question) => question.owner_student_id).every(
      (question) => question.owner_student_id === '22222222-2222-4222-8222-222222222222',
    )).toBeTruthy();
  } finally {
    await setMentorAssignmentActive(
      '22222222-2222-4222-8222-222222222222',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      false,
    );
  }

  const mentorSharedCreate = await request.post('/api/questions', {
    headers: authHeaders(mentor),
    data: {
      text: 'What detail would make the turning point clearer?',
      family: 'behavioral',
      surface: 'library',
    },
  });
  expect(mentorSharedCreate.status()).toBe(201);
  const mentorSharedQuestion = (await mentorSharedCreate.json()).question;
  expect(mentorSharedQuestion).toMatchObject({
    provenance: 'mentor',
    owner_student_id: null,
    governance_state: 'draft',
    created_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    approved_by: null,
  });
  expect(mentorSharedQuestion.approved_at).toBeNull();
  const globalDuplicate = await request.post('/api/questions', {
    headers: authHeaders(mentorTwo),
    data: {
      text: '  what detail would make the turning point clearer? ',
      family: 'behavioral',
      surface: 'library',
    },
  });
  expect(globalDuplicate.status()).toBe(409);
  expect((await globalDuplicate.json()).error.code).toBe('23505');
  for (const token of [student, studentWithoutMentor, mentorTwo, unassigned]) {
    const questions = await request.get('/api/questions', { headers: authHeaders(token) });
    expect((await questions.json()).questions.some(
      (question) => question.id === mentorSharedQuestion.id,
    )).toBeFalsy();
  }
  const creatorDrafts = await request.get('/api/questions', { headers: authHeaders(mentor) });
  expect((await creatorDrafts.json()).questions.some(
    (question) => question.id === mentorSharedQuestion.id,
  )).toBeTruthy();
  const adminDrafts = await request.get('/api/questions', { headers: authHeaders(admin) });
  expect((await adminDrafts.json()).questions.some(
    (question) => question.id === mentorSharedQuestion.id,
  )).toBeTruthy();
  const studentApproval = await request.post(`/api/questions/${mentorSharedQuestion.id}/approve`, {
    headers: authHeaders(student),
    data: { surface: 'library' },
  });
  expect(studentApproval.status()).toBe(403);
  const approvedQuestion = await request.post(`/api/questions/${mentorSharedQuestion.id}/approve`, {
    headers: authHeaders(admin),
    data: { surface: 'library' },
  });
  expect(approvedQuestion.status()).toBe(200);
  expect((await approvedQuestion.json()).question).toMatchObject({
    governance_state: 'approved',
    approved_by: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  });
  for (const token of [student, studentWithoutMentor, mentor, mentorTwo, unassigned, admin]) {
    const questions = await request.get('/api/questions', { headers: authHeaders(token) });
    expect((await questions.json()).questions.some(
      (question) => question.id === mentorSharedQuestion.id,
    )).toBeTruthy();
  }

  const adminSingleAdd = await request.post('/api/questions', {
    headers: authHeaders(admin),
    data: {
      text: 'Which application experience deserves more context?',
      family: 'cv',
      surface: 'library',
    },
  });
  expect(adminSingleAdd.status()).toBe(403);
  expect((await adminSingleAdd.json()).error.code).toBe('42501');

  const privateOnly = await request.post('/api/stories', {
    headers: authHeaders(studentWithoutMentor),
    data: {
      title: 'Founder-only private workflow',
      text: 'This story must remain editable while mentor review is unavailable.',
      captureType: 'text',
      surface: 'quick',
    },
  });
  expect(privateOnly.status()).toBe(201);
  const privateOnlyStory = (await privateOnly.json()).story;
  const privateOnlyDetail = await request.get(`/api/stories/${privateOnlyStory.id}`, {
    headers: authHeaders(studentWithoutMentor),
  });
  expect((await privateOnlyDetail.json()).story.mentor_review_available).toBe(false);
  const deniedSubmit = await request.post(`/api/stories/${privateOnlyStory.id}/submit`, {
    headers: authHeaders(studentWithoutMentor),
    data: { surface: 'workspace' },
  });
  expect(deniedSubmit.status()).toBe(403);
  expect((await deniedSubmit.json()).error.code).toBe('42501');
  const stillPrivate = await request.get(`/api/stories/${privateOnlyStory.id}`, {
    headers: authHeaders(studentWithoutMentor),
  });
  expect((await stillPrivate.json()).story.status).toBe('private');

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
  const sharedPair = await request.post('/api/story-question-pairs', {
    headers: authHeaders(student),
    data: {
      storyId: story.id,
      questionId: mentorSharedQuestion.id,
      studentStrength: 3,
      why: 'The approved mentor question is relevant to this story.',
      surface: 'workshop',
    },
  });
  expect(sharedPair.status()).toBe(201);
  expect((await sharedPair.json()).pair.question_id).toBe(mentorSharedQuestion.id);
  const assignedDetail = await request.get(`/api/stories/${story.id}`, {
    headers: authHeaders(student),
  });
  expect((await assignedDetail.json()).story.mentor_review_available).toBe(true);

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
  expect(gatedAudio.status()).toBe(403);
  expect((await gatedAudio.json()).error.code).toBe('voice_disabled');

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
  expect(studentNotifications.some((item) => (
    item.story_id === story.id
    && item.event_key === 'story.changes'
    && item.event_category === 'status'
  ))).toBeTruthy();

  const revision = await request.patch(`/api/stories/${story.id}`, {
    headers: authHeaders(student),
    data: {
      title: story.title,
      text: `${story.current_text} I learned to make the patient’s voice an explicit part of our decision.`,
      studentScore: 5,
      uses: ['iv'],
      surface: 'workspace',
    },
  });
  expect(revision.ok()).toBeTruthy();
  const revisedStory = (await revision.json()).story;
  expect(revisedStory.current_text).not.toBe(story.original_text);
  expect(revisedStory).toMatchObject({
    status: 'awaiting',
    revised: true,
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
  expect(final.history.length).toBeGreaterThan(6);
  expect(new Set(final.history.map((item) => item.actor_id))).toEqual(new Set([
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ]));
  expect(final.history.some((item) => (
    item.action === 'story.revised_and_resubmitted'
    && item.previous_value.status === 'changes'
    && item.new_value.status === 'awaiting'
  ))).toBeTruthy();

  const sessionCreate = await request.post('/api/coaching-sessions', {
    headers: authHeaders(mentor),
    data: {
      studentId: '11111111-1111-4111-8111-111111111111',
      items: [{ label: 'Client-fabricated agenda item must be ignored' }],
    },
  });
  expect(sessionCreate.status()).toBe(201);
  const sessionPayload = await sessionCreate.json();
  expect(sessionPayload.session.student_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(sessionPayload.items.length).toBeGreaterThan(0);
  expect(sessionPayload.items.every((item) => (
    item.label !== 'Client-fabricated agenda item must be ignored'
    && (item.story_id || item.question_id)
  ))).toBeTruthy();
  const durableSessions = await request.get(
    '/api/coaching-sessions?studentId=11111111-1111-4111-8111-111111111111',
    { headers: authHeaders(mentor) },
  );
  const durableSession = (await durableSessions.json()).sessions.find(
    (session) => session.id === sessionPayload.session.id,
  );
  expect(durableSession.items).toHaveLength(sessionPayload.items.length);
  await setMentorAssignmentActive(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    false,
  );
  try {
    const retainedItem = await request.patch(
      `/api/coaching-session-items/${sessionPayload.items[0].id}`,
      {
        headers: authHeaders(mentor),
        data: { completed: true },
      },
    );
    expect(retainedItem.status()).toBe(404);
    const retainedEnd = await request.post(
      `/api/coaching-sessions/${sessionPayload.session.id}/end`,
      {
        headers: authHeaders(mentor),
        data: { summary: 'This retained id must not work.' },
      },
    );
    expect(retainedEnd.status()).toBe(404);
    const revokedSessions = await request.get(
      '/api/coaching-sessions?studentId=11111111-1111-4111-8111-111111111111',
      { headers: authHeaders(mentor) },
    );
    expect((await revokedSessions.json()).sessions).toEqual([]);
    const revokedActivity = await request.get(
      '/api/mentor/activity?period=all&studentId=11111111-1111-4111-8111-111111111111',
      { headers: authHeaders(mentor) },
    );
    expect((await revokedActivity.json()).activity).toEqual([]);
    const revokedStudent = await request.get(
      '/api/students/11111111-1111-4111-8111-111111111111',
      { headers: authHeaders(mentor) },
    );
    expect(revokedStudent.status()).toBe(404);
    const revokedHome = await request.get('/api/mentor/home', {
      headers: authHeaders(mentor),
    });
    expect((await revokedHome.json()).recentActivity.every(
      (event) => !event.student_id && !event.story_id,
    )).toBeTruthy();
  } finally {
    await setMentorAssignmentActive(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      true,
    );
  }
  const completedSession = await request.post(`/api/coaching-sessions/${sessionPayload.session.id}/end`, {
    headers: authHeaders(mentor),
    data: { summary: 'API durability proof complete.' },
  });
  expect(completedSession.status()).toBe(200);
});

test('mentor question-library loading carries the selected student scope', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await page.getByRole('button', { name: 'Mentor · Dr. Chen' }).click();
  await page.locator('#rail').getByRole('button', { name: 'Students' }).click();
  await page.locator('[data-open-student]').filter({ hasText: 'Maya' }).click();
  await expect(page.locator('[data-view="mstudent"] h1')).toContainText('Maya');
  await page.locator('[data-student-prep]').click();
  await expect(page.locator('[data-view="prep"]')).toBeVisible();

  const scopedRequest = page.waitForRequest((outgoing) => (
    new URL(outgoing.url()).pathname === '/api/questions'
  ));
  await page.locator('[data-view="prep"]').getByRole('button', { name: 'Question Library' }).first().click();
  const requestUrl = new URL((await scopedRequest).url());
  expect(requestUrl.searchParams.get('studentId'))
    .toBe('11111111-1111-4111-8111-111111111111');
  await expect(page.locator('[data-view="qlib"]')).toBeVisible();
  await expect(page.locator('#importFile')).toBeVisible();
  await expect(page.locator('#importText')).toHaveAttribute('placeholder', /Behavioral/);
});

test('canonical dark backgrounds persist on the authenticated profile and respect reduced motion', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('.homeHero')).toBeVisible();
  await expect(page.locator('.greet')).toContainText(/Good (morning|afternoon|evening), Maya\./);
  await expect(page.getByText('What happened that you don’t want to lose?')).toBeVisible();

  await expect(page.locator('body')).toHaveAttribute('data-role', 'student');
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)).toBe('rgb(10, 13, 20)');
  for (const name of ['Home', 'Story Library', 'Notifications', 'Settings']) {
    await expect(page.locator('#rail').getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }

  await expect(page.locator('#rail').getByRole('button', { name: /Interview Prep/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Settings/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Your StoryForge.' })).toBeFocused();
  const settingsTypography = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 16px Archivo'),
      document.fonts.load('italic 800 16px Archivo'),
      document.fonts.load('700 16px Rajdhani'),
      document.fonts.load('500 16px Lora'),
      document.fonts.load('italic 400 16px Lora'),
    ]);
    await document.fonts.ready;
    return { status: document.fonts.status, families: {
      archivo: document.fonts.check('400 16px Archivo'),
      archivoItalic: document.fonts.check('italic 800 16px Archivo'),
      rajdhani: document.fonts.check('700 16px Rajdhani'),
      lora: document.fonts.check('500 16px Lora'),
      loraItalic: document.fonts.check('italic 400 16px Lora'),
    } };
  });
  expect(settingsTypography.status).toBe('loaded');
  expect(settingsTypography.families).toEqual({ archivo: true, archivoItalic: true, rajdhani: true, lora: true, loraItalic: true });
  await page.addScriptTag({ url: '/_test/axe.js' });
  const settingsAxe = await page.evaluate(async () => window.axe.run(document, { resultTypes: ['violations'] }));
  expect(settingsAxe.violations.map((item) => item.id)).not.toContain('heading-order');
  for (const name of ['Emberlight', 'Aurora', 'Night Constellation', 'Deep Tide', 'Meridian', 'Static Dark']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const aurora = page.getByRole('button', { name: /Aurora/ });
  await aurora.click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  expect(await page.locator('.aur.a').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Save environment' }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your StoryForge.' })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  await expect(page.getByRole('button', { name: /Aurora/ })).toHaveClass(/\bon\b/);

  await page.getByRole('button', { name: /Emberlight/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
  await page.getByRole('button', { name: 'Save environment' }).click();
});

test('mobile keeps a real Back to Matrix path and Settings route visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('.homeHero')).toBeVisible();

  const settings = page.locator('#rail [data-nav="settings"]');
  await expect(settings).toBeVisible();
  await settings.click();
  await expect(page.getByRole('heading', { name: 'Your StoryForge.' })).toBeVisible();
  const matrixLink = page.locator('.settingsPage a').filter({ hasText: 'Go' });
  await expect(matrixLink).toBeVisible();
  await expect(matrixLink).toHaveAttribute('href', /\/member-dashboard\/$/);

  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => {
    sessionStorage.setItem('storyforge_local_fixture_persona', 'mentor');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your StoryForge.' })).toBeVisible();
  for (const label of ['Home', 'Students', 'Review Queue', 'My Activity', 'Settings']) {
    await expect(page.locator('#rail').getByRole('button', { name: new RegExp(label) })).toBeVisible();
  }
  await expect(page.locator('#rail').getByRole('button', { name: /Interview Prep/ })).toHaveCount(0);
  await expect(page.locator('#rail').getByRole('button', { name: 'Teaching Mode' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(matrixLink).toBeVisible();

  await page.locator('#rail').getByRole('button', { name: 'Students' }).click();
  await expect(page.getByRole('heading', { name: 'Students' })).toBeFocused();
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Students' })).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).pathname).toBe('/students');

  await page.addScriptTag({ url: '/_test/axe.js' });
  const studentsAxe = await page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
  }));
  expect(studentsAxe.violations.map((item) => item.id)).not.toContain('heading-order');
});

test('configuration failure is bounded, actionable, and never exposes raw fetch text', async ({ page }) => {
  await page.route('**/api/config', (route) => route.abort('failed'));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'StoryForge could not open safely.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'StoryForge could not open safely.' })).toBeFocused();
  await expect(page.getByText('Your stories were not changed.')).toBeVisible();
  await expect(page.getByText('Failed to fetch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Matrix' })).toHaveAttribute('href', /\/member-dashboard\/$/);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('main#main')).not.toHaveAttribute('role', 'alert');

  await page.addScriptTag({ url: '/_test/axe.js' });
  const failureAxe = await page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
  }));
  expect(failureAxe.violations.map((item) => item.id)).not.toContain('landmark-one-main');
  expect(failureAxe.violations.map((item) => item.id)).not.toContain('aria-allowed-role');

  await page.unroute('**/api/config');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Enter StoryForge' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Enter StoryForge' })).toBeFocused();
});

test('zero-assignment student sees a truthful disabled mentor-review state', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('storyforge_local_fixture_persona', 'studentOther');
  });
  await page.reload();
  await expect(page.locator('.homeHero')).toBeVisible();

  await page.locator('[data-open-capture]').first().click();
  await page.locator('#capTitle').fill('Private founder rehearsal');
  await page.locator('#capBody').fill(
    'I can keep refining this story while mentor review remains unavailable.',
  );
  await page.getByRole('button', { name: 'Save story' }).click();

  await page.getByRole('button', { name: /Private founder rehearsal/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Private founder rehearsal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mentor review unavailable' })).toBeDisabled();
  await expect(page.getByText('Mentor review is not enabled yet. This story remains editable, and its visibility setting is unchanged.')).toBeVisible();
  await page.getByRole('tab', { name: 'Working version' }).click();
  await expect(page.getByLabel('Working version')).toBeEditable();
});

test('Quick Capture draft restores to the signed account and clears after a real save', async ({ page }) => {
  const lesson = 'I learned to name the concern early and invite the team into the next decision.';
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.locator('[data-open-capture]').first().click();
  await expect(page.locator('summary.capMoreHead')).toHaveCount(0);
  await expect(page.getByText(/Add more now/i)).toHaveCount(0);
  await expect(page.locator('#capLesson')).toBeVisible();
  await expect(page.locator('#capLesson')).toBeEditable();
  await page.locator('#capTitle').fill('Durable cross-session capture draft');
  await page.locator('#capBody').fill('This text must survive a reload because it is saved to the signed student account.');
  await page.locator('#capLesson').fill(lesson);
  await expect(page.locator('#captureDraftStatus')).toHaveText('Draft saved to your account.');
  await page.getByRole('button', { name: 'Close Quick Capture' }).click();

  await page.reload();
  await expect(page.locator('.homeHero')).toBeVisible();
  await page.locator('[data-open-capture]').first().click();
  await expect(page.locator('#capTitle')).toHaveValue('Durable cross-session capture draft');
  await expect(page.locator('#capBody')).toHaveValue(
    'This text must survive a reload because it is saved to the signed student account.',
  );
  await expect(page.locator('#capLesson')).toHaveValue(lesson);
  await expect(page.locator('#captureDraftStatus')).toHaveText('Draft restored from your account.');
  await page.getByRole('button', { name: 'Save story' }).click();

  await page.getByRole('button', { name: /Durable cross-session capture draft/ }).click();
  await page.getByRole('tab', { name: 'Working version' }).click();
  await expect(page.locator('#storyLesson')).toHaveValue(lesson);
  await page.locator('#room [data-close-overlay]').click();

  await page.locator('[data-open-capture]').first().click();
  await expect(page.locator('#capTitle')).toHaveValue('');
  await expect(page.locator('#capBody')).toHaveValue('');
  await expect(page.locator('#capLesson')).toHaveValue('');
  await page.getByRole('button', { name: 'Close Quick Capture' }).click();
});

test('admin uploads a CSV into staged review and explicitly approves its draft', async ({ page }) => {
  const questionText = 'What did you change after receiving feedback in a high-stakes setting?';
  await page.goto('/');
  await page.getByRole('button', { name: 'Admin · least privilege' }).click();
  await expect(page.getByRole('button', { name: 'Question Library' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Story Library|Students|Review Queue/ })).toHaveCount(0);
  await page.locator('#importFile').setInputFiles({
    name: 'b1-503-governed-questions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Question,Family\n"${questionText}",behavioral\n`),
  });
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText(questionText)).toBeVisible();
  await page.getByRole('button', { name: 'Commit selected drafts' }).click();
  const row = page.locator('.qlibRow').filter({ hasText: questionText });
  await expect(row.getByText('draft', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Approve for shared library' }).click();
  await expect(page.locator('.qlibRow').filter({ hasText: questionText }).getByText('approved', { exact: true })).toBeVisible();
});

test('student and mentor complete the V5 browser loop with truthful gates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Enter StoryForge' })).toBeVisible();
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('.homeHero')).toBeVisible();

  await page.locator('[data-open-capture]').first().click();
  await expect(page.locator('#voxDock')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /voice recording|voice note/i })).toHaveCount(0);
  await page.locator('#capTitle').fill('A hard conversation');
  await page.locator('#capBody').fill('I had to explain a difficult change while keeping the person involved in the decision.');
  await page.getByRole('button', { name: 'Save story' }).click();
  await page.getByRole('button', { name: /A hard conversation/ }).first().click();
  await expect(page.getByRole('heading', { name: 'A hard conversation' })).toBeVisible();
  await page.getByRole('group', { name: 'Student score' }).getByRole('button', { name: '4' }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Awaiting review', { exact: true }).first()).toBeVisible();
  await page.locator('#room [data-close-overlay]').click();

  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Mentor · Dr. Chen' }).click();
  await page.locator('[data-nav="queue"]').first().click();
  await expect(page.locator('[data-view="mqueue"]')).toBeVisible();
  const firstReview = page.locator('[data-story-row]').filter({ hasText: 'A hard conversation' });
  await firstReview.locator('[data-open-story]').click();
  await expect(page.getByText('Awaiting review', { exact: true }).first()).toBeVisible();
  await page.getByRole('group', { name: 'Mentor score' }).getByRole('button', { name: '4' }).click();
  await page.locator('#mentorFeedback').fill('Show what you noticed in the other person and how that changed your next sentence.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await page.getByRole('button', { name: 'Changes requested' }).click();
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await page.locator('#room [data-close-overlay]').click();

  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.getByRole('button', { name: /Notifications/ }).first().click();
  const revisionNotice = page.locator('[data-open-notification]').filter({ hasText: 'Changes requested' });
  await expect(revisionNotice).toBeVisible();
  await revisionNotice.click();
  await page.getByRole('tab', { name: 'Working version' }).click();
  const current = page.getByLabel('Working version');
  await current.fill(`${await current.inputValue()} I learned to pause and check understanding before offering the next option.`);
  await page.getByRole('button', { name: 'Save working version' }).click();
  await expect(page.getByText(/Awaiting review/).first()).toBeVisible();
  await page.locator('#room [data-close-overlay]').click();

  await page.getByRole('button', { name: 'Change fixture identity' }).click();
  await page.getByRole('button', { name: 'Second mentor · Dr. Rivera' }).click();
  await page.locator('[data-nav="queue"]').first().click();
  await expect(page.locator('[data-view="mqueue"]')).toBeVisible();
  await page.getByRole('button', { name: /Revised — needs re-review/ }).click();
  const secondReview = page.locator('[data-story-row]').filter({ hasText: 'A hard conversation' });
  await secondReview.locator('[data-open-story]').click();
  await page.getByRole('group', { name: 'Mentor score' }).getByRole('button', { name: '5' }).click();
  await page.locator('#mentorFeedback').fill('Approved. The revision makes your observation and behavior change concrete.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await page.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Dr. Chen').first()).toBeVisible();
  await expect(page.locator('#room').getByText('Dr. Rivera').first()).toBeVisible();
  const history = page.locator('#room .railCard').filter({ hasText: 'History' });
  const expandHistory = history.locator('[data-expand-story-history]');
  if (await expandHistory.count()) await expandHistory.click();
  await expect(history.getByText('Revised and resubmitted')).toBeVisible();
  await expect(history.getByText('Dr. Chen').first()).toBeVisible();
  await expect(history.getByText('Dr. Rivera').first()).toBeVisible();
});

test('core student home has no serious or critical axe findings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('.homeHero')).toBeVisible();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'StoryForge navigation' })).toBeVisible();
  await expect(page.locator('.homeHero')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' }).last()).toBeVisible();
});
