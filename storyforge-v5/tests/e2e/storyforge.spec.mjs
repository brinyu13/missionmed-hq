import assert from 'node:assert/strict';
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
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

test('canonical dark backgrounds persist on the authenticated profile and respect reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  await expect(page.locator('body')).toHaveAttribute('data-role', 'student');
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)).toBe('rgb(10, 13, 20)');
  await expect(page.locator('aside .nav button')).toHaveText([
    '⌂ Home',
    '▤ Story Library',
    '◇ Interview Prep',
    '● Notifications',
    '⚙ Settings',
  ]);

  await page.getByRole('button', { name: /Interview Prep/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Prepare the next natural question.' })).toBeFocused();
  const prepTypography = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 16px Archivo'),
      document.fonts.load('italic 800 16px Archivo'),
      document.fonts.load('700 16px Rajdhani'),
      document.fonts.load('500 16px Lora'),
      document.fonts.load('italic 400 16px Lora'),
    ]);
    await document.fonts.ready;
    return {
      status: document.fonts.status,
      families: {
        archivo: document.fonts.check('400 16px Archivo'),
        archivoItalic: document.fonts.check('italic 800 16px Archivo'),
        rajdhani: document.fonts.check('700 16px Rajdhani'),
        lora: document.fonts.check('500 16px Lora'),
        loraItalic: document.fonts.check('italic 400 16px Lora'),
      },
      questions: [...document.querySelectorAll('.question-card')].map((card) => {
        const heading = card.querySelector('h2');
        const style = getComputedStyle(heading);
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          height: heading.getBoundingClientRect().height,
          cardWidth: card.getBoundingClientRect().width,
          overflows: card.scrollWidth > card.clientWidth,
        };
      }),
    };
  });
  expect(prepTypography.status).toBe('loaded');
  expect(prepTypography.families).toEqual({
    archivo: true,
    archivoItalic: true,
    rajdhani: true,
    lora: true,
    loraItalic: true,
  });
  expect(prepTypography.questions.length).toBeGreaterThan(0);
  for (const question of prepTypography.questions) {
    expect(question.fontFamily).toContain('Archivo');
    expect(question.fontSize).toBe('18px');
    expect(question.height).toBeLessThanOrEqual(100);
    expect(question.cardWidth).toBeGreaterThan(300);
    expect(question.overflows).toBe(false);
  }
  await page.screenshot({
    path: '../_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/storyforge-v5-interview-prep.png',
    fullPage: true,
  });
  await page.addScriptTag({ url: '/_test/axe.js' });
  const prepAxe = await page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
  }));
  expect(prepAxe.violations.map((item) => item.id)).not.toContain('heading-order');

  await page.getByRole('button', { name: /Settings/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Your environment.' })).toBeFocused();
  for (const name of ['Emberlight', 'Aurora', 'Night Constellation', 'Deep Tide', 'Meridian', 'Static Dark']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const aurora = page.getByRole('button', { name: /Aurora/ });
  await aurora.click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body, '::before').animationName)).toBe('none');
  await expect(page.getByRole('button', { name: /Aurora/ })).toBeFocused();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your environment.' })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  await expect(page.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /Emberlight/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
});

test('mobile keeps a real Back to Matrix path and Settings route visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  const matrixLink = page.locator('.mobile-matrix-link');
  await expect(matrixLink).toBeVisible();
  await expect(matrixLink).toHaveAttribute('href', /\/member-dashboard\/$/);
  const settings = page.locator('.mobile-nav [data-nav="settings"]');
  await expect(settings).toBeVisible();
  await settings.click();
  await expect(page.getByRole('heading', { name: 'Your environment.' })).toBeVisible();
  await expect(page.locator('.settings-matrix-link')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => {
    sessionStorage.setItem('storyforge_local_fixture_persona', 'mentor');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your environment.' })).toBeVisible();
  const mentorMobileNav = page.locator('.mobile-nav button');
  await expect(mentorMobileNav).toHaveCount(6);
  for (const label of ['Home', 'Students', 'Review Queue', 'My Activity', 'Interview Prep', 'Settings']) {
    await expect(page.locator(`.mobile-nav button[aria-label="${label}"]`)).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.mobile-matrix-link')).toBeVisible();

  await page.locator('.mobile-nav button[aria-label="Students"]').click();
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
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('storyforge_local_fixture_persona', 'studentOther');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  await page.getByRole('button', { name: /Quick capture/i }).first().click();
  await page.getByRole('button', { name: 'Write' }).click();
  await page.getByLabel('Story title').fill('Private founder rehearsal');
  await page.getByLabel('Tell it in your own words').fill(
    'I can keep refining this story while mentor review remains unavailable.',
  );
  await page.getByRole('button', { name: 'Save private story' }).click();

  await expect(page.getByRole('heading', { name: 'Private founder rehearsal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mentor review unavailable' })).toBeDisabled();
  await expect(page.getByText('Mentor review is not enabled yet. Your private story remains editable.')).toBeVisible();
  await expect(page.getByLabel('Current telling')).toBeEditable();
  await expect(page.getByText('private', { exact: true })).toBeVisible();
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
    path: '../_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/storyforge-v5-approved-workspace.png',
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
    path: '../_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/storyforge-v5-student-home.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Mobile StoryForge navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' }).last()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '../_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/storyforge-v5-student-mobile.png',
  });
});
