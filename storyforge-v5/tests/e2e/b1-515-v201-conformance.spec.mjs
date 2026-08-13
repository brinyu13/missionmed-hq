import { expect, test } from '@playwright/test';
import pg from 'pg';

const MAYA = '11111111-1111-4111-8111-111111111111';
const NOAH = '22222222-2222-4222-8222-222222222222';
const PROMPT_ONE = '51510000-0000-4000-8000-000000000001';
const PROMPT_TWO = '51510000-0000-4000-8000-000000000002';
const MAYA_ARENA_AVATAR = '51510000-0000-4000-8000-000000000003';
const MAYA_ARENA_THUMBNAIL = 'https://cdn.missionmedinstitute.com/e2e/active-maya-avatar.webp';

const ACCEPTANCE = Object.freeze({
  'B1-515-E2E-01': 'list-first Inspiration with filters, pinned shelf, reorder, curation, and voice-first action',
  'B1-515-E2E-02': 'reversible Archive and Trash preserve the exact student story',
  'B1-515-E2E-03': 'direct administrator status, stars, per-use scores, and publication controls',
  'B1-515-E2E-04': 'recipient-bound classmate feedback revokes without cross-story access',
  'B1-515R-E2E-05': 'real-name administrator masterkey reuses student Home, Library, and Story Room',
  'B1-515R-E2E-06': 'administrator Action Center and governed Content Studio expose truthful workflows',
  'B1-515R-E2E-07': 'returned contribution review and grouped Settings persist only bounded data',
});

let submittedStory;
let sharedStory;
let contributionId;

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

function headers(value) { return { Authorization: `Bearer ${value}` }; }

async function createStory(request, jwt, title, text) {
  const response = await request.post('/api/stories', {
    headers: headers(jwt), data: { title, text, captureType: 'text', surface: 'quick' },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).story;
}

async function choosePersona(page, label) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  const persona = page.getByRole('button', { name: label });
  await expect(change.or(persona)).toBeVisible();
  if (await change.isVisible()) await change.click();
  await expect(persona).toBeVisible();
  await persona.click();
}

async function openLibraryStory(page, title) {
  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  const row = page.locator('[data-story-row]').filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Open story' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await withDatabase(async (client) => {
    const keys = [
      'admin_console', 'admin_directory', 'admin_review_controls', 'story_archive', 'story_promotions',
      'per_use_scoring', 'peer_share', 'inspiration', 'inspiration_browse', 'inspiration_admin', 'request_a_story', 'voice_capture',
      'avatar_identity',
    ];
    const flags = await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all', allowlist='{}'::uuid[], cohorts='{}'::text[], updated_at=now()
       WHERE key=ANY($1::text[])`, [keys],
    );
    expect(flags.rowCount).toBe(keys.length);
    await client.query(`UPDATE public.sf_users SET cohort='B1-515 E2E' WHERE id=ANY($1::uuid[])`, [[MAYA, NOAH]]);
    await client.query(
      `UPDATE public.sf_users
          SET arena_avatar_id=$2, arena_avatar_thumbnail_url=$3, arena_avatar_synced_at=now()
        WHERE id=$1`,
      [MAYA, MAYA_ARENA_AVATAR, MAYA_ARENA_THUMBNAIL],
    );
    await client.query(
      `INSERT INTO public.sf_inspiration_prompts
         (id,library_key,text,territory,follow_up,interview_use,state,recommended,sort_order,domain_ids,energy_ids)
       VALUES
         ($1,'q-515','What childhood moment first taught you to advocate for someone?','childhood','Who was there?','Advocacy','active',true,515,ARRAY['personal'],ARRAY['moving']),
         ($2,'q-516','What did your first clinical team teach you about listening?','medical_school','What changed next?','Teamwork','active',false,516,ARRAY['medical_clinical'],ARRAY['serious'])
       ON CONFLICT (id) DO NOTHING`, [PROMPT_ONE, PROMPT_TWO],
    );
  });
  const maya = await token(request, 'student');
  submittedStory = await createStory(request, maya, `B1-515 administrator proof ${Date.now()}`, 'A submitted story with a clear action, turning point, and learning lesson.');
  const submitted = await request.post(`/api/stories/${submittedStory.id}/submit`, {
    headers: headers(maya), data: { expectedVersion: Number(submittedStory.row_version), surface: 'workspace' },
  });
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
  submittedStory = (await submitted.json()).story;
  sharedStory = await createStory(request, maya, `B1-515 classmate proof ${Date.now()}`, 'Maya listened first, named the concern, and helped the group choose a safer plan.');
  await withDatabase(async (client) => {
    const invitation = await client.query(
      `INSERT INTO public.sf_story_invitations
         (student_id,contributor_first_name,relationship_id,email,status,personal_message,disclosure_version,contributed_at)
       VALUES ($1,'Jordan','best_friend','jordan@example.test','story_shared','A synthetic browser fixture.','b1-515r-e2e-v1',now())
       RETURNING id`,
      [MAYA],
    );
    const contribution = await client.query(
      `INSERT INTO public.sf_story_contributions
         (invitation_id,kind,transcript,prompt_text_snapshot,state)
       VALUES ($1,'text','Jordan remembered the exact moment Maya paused, listened, and changed the plan.','What moment showed Maya listening well?','new')
       RETURNING id`,
      [invitation.rows[0].id],
    );
    contributionId = contribution.rows[0].id;
  });
});

test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='off', allowlist='{}'::uuid[], cohorts='{}'::text[], updated_at=now()
       WHERE key=ANY($1::text[])`, [[
        'admin_console', 'admin_directory', 'admin_review_controls', 'story_archive', 'story_promotions',
        'per_use_scoring', 'peer_share', 'inspiration', 'inspiration_browse', 'inspiration_admin', 'request_a_story', 'voice_capture',
        'avatar_identity',
      ]],
    );
    await client.query(`UPDATE public.sf_users SET cohort='2027' WHERE id=$1`, [MAYA]);
    await client.query(`UPDATE public.sf_users SET cohort='2028' WHERE id=$1`, [NOAH]);
  });
});

test(`[B1-515-E2E-01] ${ACCEPTANCE['B1-515-E2E-01']}`, async ({ page }) => {
  await choosePersona(page, 'Student · Maya');
  await page.getByRole('button', { name: 'Inspiration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inspiration', exact: true })).toBeVisible();
  await expect(page.getByText('How this works', { exact: true })).toBeVisible();
  await expect(page.locator('[data-inspiration-filter-chip="domain"]').first()).toBeVisible();
  await expect(page.locator('[data-inspiration-filter-chip="lifeStage"]').first()).toBeVisible();
  await expect(page.locator('.b1515DrBrian').first()).toHaveText(/Dr Brian Recommends/);
  const first = page.locator(`[data-inspiration-prompt="${PROMPT_ONE}"]`).last();
  const second = page.locator(`[data-inspiration-prompt="${PROMPT_TWO}"]`).last();
  await expect(first.getByRole('button', { name: /Answer by voice/ })).toBeVisible();
  await first.getByRole('button', { name: 'Pin' }).click();
  await second.getByRole('button', { name: 'Pin' }).click();
  const shelf = page.locator('.b1515Pinned');
  await expect(shelf.getByText('My Pinned Questions', { exact: true })).toBeVisible();
  await expect(shelf.locator('.b1515PinnedPrompt')).toHaveCount(2);
  await shelf.locator('.b1515PinnedPrompt').first().getByRole('button', { name: 'Move down' }).click();
  await expect(shelf.locator('.b1515PinnedPrompt').first()).toContainText('childhood moment');
  await page.locator('[data-inspiration-filter-chip="lifeStage"][data-value="medical_school"]').click();
  await expect(page.locator('.b1515Pinned .b1515PinnedPrompt')).toHaveCount(1);
  await expect(page.locator('.b1515Pinned .b1515PinnedPrompt')).toContainText('first clinical team');
});

test(`[B1-515-E2E-02] ${ACCEPTANCE['B1-515-E2E-02']}`, async ({ page }) => {
  await choosePersona(page, 'Student · Maya');
  await openLibraryStory(page, sharedStory.title);
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.locator('#libCollection').selectOption('archive');
  const archivedRow = page.locator('[data-story-row]').filter({ hasText: sharedStory.title });
  await expect(archivedRow).toHaveCount(1);
  await archivedRow.getByRole('button', { name: 'Move to Trash' }).click();
  await page.locator('#libCollection').selectOption('trash');
  const trashedRow = page.locator('[data-story-row]').filter({ hasText: sharedStory.title });
  await expect(trashedRow).toHaveCount(1);
  await trashedRow.getByRole('button', { name: 'Restore to Library' }).click();
  await page.locator('#libCollection').selectOption('active');
  await expect(page.locator('[data-story-row]').filter({ hasText: sharedStory.title })).toHaveCount(1);
});

test(`[B1-515-E2E-03] ${ACCEPTANCE['B1-515-E2E-03']}`, async ({ page }) => {
  await choosePersona(page, 'Admin · least privilege');
  await page.getByRole('button', { name: 'Review Queue', exact: true }).click();
  const row = page.locator('.adminStoryRow').filter({ hasText: submittedStory.title });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Review' }).click();
  await expect(page.locator('#adminStoryReviewForm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Awaiting Review' })).toBeVisible();
  await page.getByRole('button', { name: 'In Review' }).click();
  await expect(page.getByRole('button', { name: 'In Review' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-admin-review-score="5"]').click();
  await page.locator('[data-admin-suitability="ps"]').check();
  await page.locator('[data-admin-use-score="ps"][data-value="5"]').click();
  await page.getByRole('button', { name: 'Save review' }).click();
  await page.getByRole('button', { name: 'Promote to Personal Statement' }).click();
  await expect.poll(() => withDatabase(async (client) => Number((await client.query(
    `SELECT count(*) AS count FROM public.sf_story_publications WHERE story_id=$1 AND destination='personal_statement' AND active`,
    [submittedStory.id],
  )).rows[0].count))).toBe(1);
});

test(`[B1-515-E2E-04] ${ACCEPTANCE['B1-515-E2E-04']}`, async ({ page }) => {
  await choosePersona(page, 'Student · Maya');
  await openLibraryStory(page, sharedStory.title);
  await page.locator('.b1515PeerCandidates').getByText('Noah Student').click();
  await page.locator('#peerShareConfirm').check();
  await page.getByRole('button', { name: 'Create private share' }).click();
  await choosePersona(page, 'Second student · privacy boundary');
  await page.getByRole('button', { name: 'Classmate Thoughts', exact: true }).click();
  await page.locator('.b1514Invitation').filter({ hasText: sharedStory.title }).getByRole('button', { name: 'Read story' }).click();
  await expect(page.locator('.b1515PeerReader')).toContainText('Maya listened first');
  await page.locator('#peerFeedbackBody').fill('The turning point is clear; keep the specific decision at the center.');
  await page.getByRole('button', { name: 'Share feedback privately' }).click();
  await choosePersona(page, 'Student · Maya');
  await page.getByRole('button', { name: 'Classmate Thoughts', exact: true }).click();
  const share = page.locator('.b1514Invitation').filter({ hasText: sharedStory.title });
  await expect(share).toContainText('The turning point is clear');
  page.once('dialog', (dialog) => dialog.accept());
  await share.getByRole('button', { name: 'Revoke access' }).click();
  await expect(share).toContainText('Revoked');
  await choosePersona(page, 'Second student · privacy boundary');
  await page.getByRole('button', { name: 'Classmate Thoughts', exact: true }).click();
  await expect(page.locator('.b1514Invitation').filter({ hasText: sharedStory.title })).toHaveCount(0);
});

test(`[B1-515R-E2E-05] ${ACCEPTANCE['B1-515R-E2E-05']}`, async ({ page }) => {
  await page.route('https://cdn.missionmedinstitute.com/**', async (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#13d9ff"/></svg>',
  }));
  await choosePersona(page, 'Admin · least privilege');
  await page.getByRole('button', { name: 'Students', exact: true }).click();
  const maya = page.locator('.mStuRow').filter({ hasText: 'Maya Student' });
  await expect(maya).toHaveCount(1);
  await expect(maya).not.toContainText(/^Student$/);
  await expect(maya.locator(`img[src="${MAYA_ARENA_THUMBNAIL}"]`)).toBeVisible();
  await maya.getByRole('button', { name: 'Open StoryForge' }).click();
  await expect(page.getByText('VIEWING STORYFORGE FOR', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Maya Student', { exact: true }).first()).toBeVisible();
  await expect(page.locator(`.b1515SubjectBanner img[src="${MAYA_ARENA_THUMBNAIL}"]`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request a Story', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Story Library', exact: true }).click();
  const story = page.locator('[data-story-row]').filter({ hasText: submittedStory.title });
  await expect(story).toHaveCount(1);
  await story.getByRole('button', { name: 'Open story' }).click();
  await expect(page.getByRole('heading', { name: submittedStory.title })).toBeVisible();
  await expect(page.locator('#adminStoryReviewForm')).toBeVisible();
});

test(`[B1-515R-E2E-06] ${ACCEPTANCE['B1-515R-E2E-06']}`, async ({ page }) => {
  await choosePersona(page, 'Admin · least privilege');
  await expect(page.getByRole('heading', { name: 'Who needs me' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What should I do next?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
  await page.getByRole('button', { name: 'Content Studio', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Add One' }).click();
  await page.locator('#adminPromptText').fill('What moment taught you to slow down and listen before acting?');
  await page.getByRole('button', { name: 'Validate draft' }).click();
  await expect(page.getByText('Validated preview · not published', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Import' }).click();
  await page.locator('#adminPromptCsv').fill([
    'libraryKey,text,who,whoDetail,domain,energy,territory,followUp,interviewUse,state,recommended,sortOrder,expectedVersion',
    'q-901,"What did you learn, exactly?",you,,personal,serious,reflection,"What changed?","Shows reflection.",retired,false,901,',
    'q-902,"What surprised you most?",you,,personal,serious,surprise,"Why did it matter?","Shows insight.",retired,false,901,',
  ].join('\n'));
  await page.getByRole('button', { name: 'Parse and preview' }).click();
  await expect(page.getByText('Resolve duplicate stable keys or ordering values before commit.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit retired drafts' })).toBeDisabled();
});

test(`[B1-515R-E2E-07] ${ACCEPTANCE['B1-515R-E2E-07']}`, async ({ page }) => {
  await choosePersona(page, 'Student · Maya');
  await page.getByRole('button', { name: 'Request a Story', exact: true }).click();
  const review = page.locator(`[data-contribution-review="${contributionId}"]`);
  await expect(review).toBeVisible();
  await review.getByRole('radio', { name: '4' }).check();
  await review.locator('[data-contribution-review-note]').fill('Specific, reflective, and useful for a future essay.');
  await review.getByRole('button', { name: 'Save candidate review' }).click();
  await expect.poll(() => withDatabase(async (client) => (await client.query(
    'SELECT student_score,student_review_note,row_version FROM public.sf_story_contributions WHERE id=$1',
    [contributionId],
  )).rows[0])).toEqual({ student_score: 4, student_review_note: 'Specific, reflective, and useful for a future essay.', row_version: '1' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const heading of ['Appearance', 'Story Preferences', 'Notifications', 'Invitations', 'Identity']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});
