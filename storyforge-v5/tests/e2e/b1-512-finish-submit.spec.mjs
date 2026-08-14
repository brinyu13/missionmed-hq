import pg from 'pg';
import { expect, test } from '@playwright/test';

async function setWorkflowScope(scope) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = $1,
              allowlist = ARRAY[]::uuid[],
              cohorts = ARRAY[]::text[],
              updated_at = now()
        WHERE key = 'story_workflow'`,
      [scope],
    );
    expect(result.rowCount).toBe(1);
  } finally {
    await client.end();
  }
}

async function devToken(request, persona = 'student') {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

async function createStory(request, token, { title, text }) {
  const response = await request.post('/api/stories', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, text, captureType: 'text', surface: 'quick' },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).story;
}

async function openStudent(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
}

test.beforeEach(async () => {
  await setWorkflowScope('eligible_all');
});

test.afterEach(async () => {
  await setWorkflowScope('off');
});

test('Finish It highlights only exact missing completion items and clears them without remounting', async ({ page, request }, testInfo) => {
  const student = await devToken(request);
  const title = `B1-512 incomplete ${Date.now()}`;
  await createStory(request, student, { title, text: 'A short but durable story.' });
  await openStudent(page);

  const finish = page.locator('[data-completion-guidance="finish"]').filter({ hasText: title });
  await expect(finish).toBeVisible();
  await finish.click();

  await expect(page.getByRole('tab', { name: 'Working version' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Please complete the items highlighted below.', { exact: true })).toBeVisible();
  await expect(page.locator('.b1512CompletionField.b1512Incomplete')).toHaveCount(2);
  await expect(page.locator('#storyEditText')).toBeFocused();
  await expect(page.locator('#storyEditText')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#storyEditText')).toHaveAttribute('aria-describedby', 'completion-help-text');
  await expect(page.locator('#storyLesson')).toHaveAttribute('aria-describedby', 'completion-help-lesson');

  await page.locator('#storyEditText').evaluate((element) => { element.dataset.b1512Stable = 'yes'; });
  const fortyWords = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
  await page.locator('#storyEditText').fill(fortyWords);
  await expect(page.locator('[data-completion-field="text"]')).not.toHaveClass(/b1512Incomplete/);
  await expect(page.locator('[data-completion-field="lesson"]')).toHaveClass(/b1512Incomplete/);
  await expect(page.locator('#storyEditText')).toHaveAttribute('data-b1512-stable', 'yes');

  await page.locator('#storyLesson').fill('I learned to name the concern and invite the team into the next decision.');
  await expect(page.locator('.b1512CompletionField.b1512Incomplete')).toHaveCount(0);
  await expect(page.getByText('Everything required here is complete.', { exact: true })).toBeVisible();
  await expect(page.locator('#storyEditText')).toHaveValue(fortyWords);

  await page.addScriptTag({ url: '/_test/axe.js' });
  const axe = await page.evaluate(async () => window.axe.run('#room', {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  }));
  expect(axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact))).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.locator('#room .roomSheet').evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath('finish-it-guidance-mobile-390x844.png'),
    fullPage: true,
  });
});

test('normal Story Detail stays normal while invalid submission uses the same Working Version guidance', async ({ page, request }, testInfo) => {
  const student = await devToken(request);
  const title = `B1-512 submit ${Date.now()}`;
  await createStory(request, student, { title, text: 'ab' });
  await openStudent(page);
  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  const row = page.locator('[data-story-row]').filter({ hasText: title });
  await row.getByRole('button', { name: 'Open story' }).click();

  await expect(page.locator('[data-completion-summary]')).toHaveCount(0);
  await expect(page.getByText('Submitting makes this story available to an authorized reviewer.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review' }).click();

  await expect(page.getByRole('tab', { name: 'Working version' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-completion-field="text"]')).toHaveClass(/b1512Incomplete/);
  await expect(page.locator('#storyEditText')).toBeFocused();
  await expect(page.locator('#storyEditText')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-completion-field="lesson"]')).not.toHaveClass(/b1512Incomplete/);
  await expect(page.locator('#room .stChip').first()).toHaveText('Draft');

  await page.locator('#storyEditText').fill('abc');
  await expect(page.getByText(/Save the Working version before submitting/)).toBeVisible();
  await page.getByRole('button', { name: 'Save working version' }).click();
  await expect(page.getByText('Everything required here is complete.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.locator('#room .stChip').first()).toHaveText('Awaiting review');

  await page.screenshot({
    path: testInfo.outputPath('submit-for-review-repaired-desktop.png'),
    fullPage: true,
  });
});
