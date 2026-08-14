import { expect, test } from '@playwright/test';
import pg from 'pg';

const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MAYA_ID = '11111111-1111-4111-8111-111111111111';
const NOAH_ID = '22222222-2222-4222-8222-222222222222';
const STORY_ONE = '51520000-0000-4000-8000-000000000001';
const STORY_TWO = '51520000-0000-4000-8000-000000000002';
const AVATAR = 'https://cdn.missionmedinstitute.com/e2e/maya-active.webp';

async function withDatabase(operation) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try { return await operation(client); } finally { await client.end(); }
}

async function choosePersona(page, label) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  const persona = page.getByRole('button', { name: label });
  await expect(change.or(persona)).toBeVisible();
  if (await change.isVisible()) await change.click();
  await persona.click();
}

test.describe('B1-515R2 signature opening', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('loads product data behind the bounded opening and leaves only when ready', async ({ page }) => {
    let releaseStories;
    const storiesStarted = new Promise((resolve) => { releaseStories = resolve; });
    let continueStories;
    const storiesMayContinue = new Promise((resolve) => { continueStories = resolve; });
    await page.route('**/api/stories?**', async (route) => {
      releaseStories();
      await storiesMayContinue;
      await route.continue();
    });

    await page.goto('/');
    const enteredAt = Date.now();
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    await storiesStarted;

    await expect(page.locator('#storyforgeOpening')).toBeVisible();
    await expect(page.locator('.introCreator')).toHaveText("DR BRIAN'S");
    await expect(page.locator('.introProgram')).toHaveText('MATCH PREP ON-CALL');
    await expect(page.locator('.introProduct')).toHaveText('StoryForge');
    await expect(page.locator('.introSubtitle')).toHaveText('TURN THE MOMENTS THAT MADE YOU INTO STORIES YOU CAN USE.');
    continueStories();

    await expect(page.locator('#storyforgeOpening')).toBeHidden();
    expect(Date.now() - enteredAt).toBeGreaterThanOrEqual(1450);
    await expect(page.locator('main .greet')).toContainText('Maya');
  });

  test('does not replay during internal navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Student · Maya' }).click();
    await expect(page.locator('#storyforgeOpening')).toBeHidden();

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your StoryForge.' })).toBeVisible();
    await expect(page.locator('#storyforgeOpening')).toBeHidden();

    await page.getByRole('button', { name: 'Story Library', exact: true }).click();
    await expect(page.getByText('Your story library', { exact: true })).toBeVisible();
    await expect(page.locator('#storyforgeOpening')).toBeHidden();
  });

  test('guest contribution links bypass the StoryForge opening completely', async ({ page }) => {
    const token = 'a'.repeat(43);
    await page.route(new RegExp(`/storyforge/guest/${token}/?$`), async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace('<head>', '<head>\n  <base href="/">');
      await route.fulfill({ response, body: html });
    });
    await page.route(`**/api/requests/guest/${token}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: { firstName: 'Maya' },
          relationship: 'best_friend',
          personalMessage: '',
          journeyLine: '',
          disclosureVersion: '2026-08-01',
          expiresAt: '2026-09-01T00:00:00.000Z',
          prompts: [{ id: 'prompt-1', text: 'What is one moment you remember about {name}?', hint: '' }],
        }),
      });
    });

    await page.goto(`/storyforge/guest/${token}`);
    await expect(page.locator('#storyforgeOpening')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Maya asked for your help.' })).toBeVisible();
  });
});

test.describe('B1-515R2 compact administrator product', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await withDatabase(async (client) => {
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope='allowlist',allowlist=$1::uuid[],cohorts='{}'::text[],updated_at=now()
          WHERE key='admin_console'`,
        [[ADMIN_ID]],
      );
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope='eligible_all',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
          WHERE key=ANY($1::text[])`,
        [['admin_directory', 'avatar_identity']],
      );
    });
  });

  test.afterAll(async () => {
    await withDatabase(async (client) => {
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope='off',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
          WHERE key=ANY($1::text[])`,
        [['admin_console', 'admin_directory', 'avatar_identity']],
      );
    });
  });

  test('uses orange-gold mission control, current-360 population, Arena avatars, and student-group queue', async ({ page }) => {
    const avatar = { available: true, headshotUrl: AVATAR };
    const storyOne = { id: STORY_ONE, title: 'A clear turning point', studentId: MAYA_ID, studentName: 'Maya Student', status: 'awaiting', updatedAt: '2026-08-14T11:00:00.000Z', submittedAt: '2026-08-14T10:00:00.000Z', avatar };
    const storyTwo = { id: STORY_TWO, title: 'Listening changed the plan', studentId: NOAH_ID, studentName: 'Noah Student', status: 'in_review', updatedAt: '2026-08-14T12:00:00.000Z', submittedAt: '2026-08-14T09:00:00.000Z' };
    const population = {
      selectedKeys: ['match_mentorship_360'], defaultKey: 'match_mentorship_360',
      memberCount: 2, observedAt: '2026-08-14T12:00:00.000Z',
      options: [
        { key: 'match_mentorship_360', label: '360 Match Mentorship', available: true, selected: true },
        { key: 'personal_statement', label: 'Personal Statement students', available: false, selected: false, reason: 'canonical_identifier_unverified' },
        { key: 'interview_prep_masterclass', label: 'Interview Prep Masterclass', available: false, selected: false, reason: 'not_authorized_for_storyforge' },
        { key: 'interview_prep_essentials', label: 'Interview Prep Essentials', available: false, selected: false, reason: 'canonical_identifier_unverified' },
        { key: 'registered_users', label: 'Registered users without qualifying enrollment', available: false, selected: false, reason: 'not_entitled' },
      ],
    };
    await page.route('https://cdn.missionmedinstitute.com/**', (route) => route.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ffb340"/></svg>',
    }));
    await page.route('**/api/admin/console/home*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        metrics: { submittedStories: 2, awaitingReview: 1, inReview: 1, approved: 0, unscored: 2 },
        actionCenter: {
          whoNeedsMe: { needsReview: { count: 1, items: [storyOne] }, needsNudge: { count: 0, items: [] } },
          next: [storyOne, storyTwo],
          changed: { changesReturned: { count: 0, items: [] }, newSinceLastVisit: { count: 1, items: [storyTwo], firstVisit: false } },
          boundaries: { boundaryLimited: false, activityFrom: '2026-08-01T00:00:00.000Z' },
        }, population,
      }),
    }));
    await page.route('**/api/admin/console/population-settings', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(population),
    }));
    await page.route('**/api/admin/console/directory?**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        students: [
          { id: MAYA_ID, displayName: 'Maya Student', storyCount: 1, awaitingReview: 1, avatar },
          { id: NOAH_ID, displayName: 'Noah Student', storyCount: 1, awaitingReview: 0 },
        ], total: 2, page: 1, pageSize: 25, population,
      }),
    }));
    await page.route('**/api/admin/console/groups', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ groups: [] }) }));
    await page.route('**/api/admin/console/saved-views', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ views: [] }) }));
    await page.route('**/api/admin/console/queue?**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        groupedBy: 'student', total: 2, page: 1, pageSize: 25, stories: [storyOne, storyTwo],
        studentGroups: [
          { studentId: MAYA_ID, studentName: 'Maya Student', session: '360', storyCount: 1, waitingCount: 1, oldestWaitingAt: storyOne.submittedAt, stories: [storyOne], avatar },
          { studentId: NOAH_ID, studentName: 'Noah Student', session: '360', storyCount: 1, waitingCount: 1, oldestWaitingAt: storyTwo.submittedAt, stories: [storyTwo] },
        ],
      }),
    }));

    await choosePersona(page, 'Admin · least privilege');
    await expect(page.locator('body')).toHaveAttribute('data-role', 'admin');
    await expect(page.locator('#advBanner')).toBeHidden();
    await expect(page.locator('.b1515R2ActionRow')).toHaveCount(2);
    await expect(page.getByText('Who needs me', { exact: true })).toBeVisible();
    expect(await page.locator('body').evaluate((node) => getComputedStyle(node).getPropertyValue('--accent').trim())).toBe('#ffb340');

    await page.getByRole('button', { name: 'Students', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Student population' })).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
    await expect(page.locator('#adminPopulationForm input:disabled')).toHaveCount(4);
    await expect(page.locator('.mStuRow').filter({ hasText: 'Maya Student' }).locator('img')).toHaveAttribute('src', AVATAR);

    await page.getByRole('button', { name: 'Review Queue', exact: true }).click();
    await expect(page.locator('.b1515R2QueueGroup')).toHaveCount(2);
    await expect(page.locator('.b1515R2QueueGroup').first().getByRole('heading')).toHaveText('Maya Student');
    await expect(page.locator('.b1515R2QueueGroup').first().locator('.b1515R2QueueStory')).toHaveCount(1);
    await expect(page.locator('.b1515R2QueueGroup').first().locator('img')).toHaveAttribute('src', AVATAR);
  });
});
