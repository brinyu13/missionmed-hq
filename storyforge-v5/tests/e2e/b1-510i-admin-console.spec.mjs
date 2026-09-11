import { expect, test } from '@playwright/test';
import pg from 'pg';
import {
  removeAudioAsset,
  seedVerifiedAudioAsset,
  studentStoriesByTitle,
} from './voice-fixture.mjs';

const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function openFounderAdmin(page) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  await expect(change).toBeVisible();
  await change.click();
  await page.getByRole('button', { name: 'Admin · least privilege' }).click();
  await expect(page.getByText('Question Governance', { exact: true })).toBeVisible();
}

async function createSubmittedStory(page, title = 'Founder administrator review proof') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.locator('[data-open-capture]').first().click();
  await page.locator('#capTitle').fill(title);
  await page.locator('#capBody').fill('I noticed a team communication gap, named it, and helped the group reach a safer plan.');
  await page.locator('#capLesson').fill('Clear communication can change the course of a difficult decision.');
  await page.getByRole('button', { name: 'Save story' }).click();
  await page.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.locator('#room [data-close-overlay]').click();
}

async function activateFounderAdminConsole(page) {
  await page.getByRole('button', { name: 'Release Controls' }).click();
  await expect(page.locator('#adminConsoleFeatureForm')).toBeVisible();
  await page.locator('#adminConsoleScope').selectOption('allowlist');
  await page.locator('#adminConsoleFeatureForm').getByRole('button', { name: 'Save admin workspace gate' }).click();
  await expect(page.getByText('Administrator View', { exact: true })).toBeVisible();
}

async function setDirectReviewFlags(scope) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope=$1,
              allowlist=CASE WHEN $1='allowlist' THEN $2::uuid[] ELSE '{}'::uuid[] END,
              cohorts='{}'::text[],
              updated_at=now()
        WHERE key=ANY($3::text[])`,
      [scope, [ADMIN_ID], ['admin_review_controls', 'per_use_scoring', 'mentor_notes']],
    );
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope=CASE WHEN $1='off' THEN 'off' ELSE 'eligible_all' END,
              allowlist='{}'::uuid[],
              cohorts='{}'::text[],
              updated_at=now()
        WHERE key='admin_directory'`,
      [scope],
    );
  } finally {
    await client.end();
  }
}

async function restoreFounderAdminConsoleDefaultOff(page) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  await expect(change).toBeVisible();
  await change.click();
  await page.getByRole('button', { name: 'Admin · least privilege' }).click();
  await page.getByRole('button', { name: 'Release Controls' }).click();
  await page.locator('#adminConsoleScope').selectOption('off');
  await page.locator('#adminConsoleFeatureForm')
    .getByRole('button', { name: 'Save admin workspace gate' })
    .click();
  await expect(page.getByText('Administrator workspace disabled.', { exact: true })).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await setDirectReviewFlags('off');
  await restoreFounderAdminConsoleDefaultOff(page);
});

test('Founder-only administrator console is additive, bounded, and review-capable', async ({ page }, testInfo) => {
  test.slow();
  await createSubmittedStory(page);
  await openFounderAdmin(page);
  await activateFounderAdminConsole(page);
  await setDirectReviewFlags('allowlist');
  await page.reload();
  await page.getByRole('button', { name: 'Admin Home' }).click();
  await expect(page.locator('[data-view="admin-home"]')).toBeVisible();
  await expect(page.getByText(/without crossing privacy lines/i)).toBeVisible();

  await page.getByRole('button', { name: 'Students', exact: true }).click();
  await expect(page.locator('#adminStudentSearchForm')).toBeVisible();
  await page.locator('#adminStudentSearch').fill('Maya');
  await page.locator('#adminStudentSearchForm').getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('[data-admin-open-subject]').first()).toBeVisible();
  await page.locator('[data-admin-open-subject]').first().click();
  await expect(page.locator('.b1515SubjectBanner')).toContainText('VIEWING STORYFORGE FOR');
  await page.getByRole('button', { name: 'Open Story Library', exact: true }).click();

  const review = page.locator('[data-admin-subject-story]').first();
  await expect(review).toBeVisible();
  await review.click();
  await expect(page.locator('#adminStoryReviewForm')).toBeVisible();
  await expect(page.locator('[data-view="admin-story"]')).not.toContainText(/original audio|play original audio/i);
  await page.locator('[data-admin-review-status="reviewed"]').click();
  await expect(page.getByText('Review status updated to Reviewed.', { exact: true })).toBeVisible();
  await page.locator('[data-admin-review-score="5"]').click();
  await expect(page.getByText('Administrator score saved: 5/5.', { exact: true })).toBeVisible();
  await page.locator('#mentorNoteText').fill('Strong example with a clear turning point.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Mentor note draft saved. It is not visible to the student.', { exact: true })).toBeVisible();
  await page.locator('#adminInternalNote').fill('Founder-only local acceptance note.');
  await page.locator('#adminStoryReviewForm').getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByText('Administrator review saved and audited.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish transcript + audio' }).click();
  await expect(page.getByText('Strong example with a clear turning point.')).toBeVisible();
  await expect(page.getByText('Founder-only local acceptance note.')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('phase-b-founder-admin-story-review.png'),
    fullPage: true,
  });
});

test('student identity never receives administrator navigation or routes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.getByText('Student View', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Admin Home' })).toHaveCount(0);
  await page.goto('/students');
  await expect(page.locator('[data-view="home"]')).toBeVisible();
});

test('administrator subject playback receives only the verified observable audio asset', async ({ page }) => {
  const title = 'Administrator audio playback projection proof';
  await page.addInitScript(() => {
    window.__adminAudioUrls = [];
    class DeterministicAudio extends EventTarget {
      constructor(url) {
        super();
        this.url = url;
        this.currentTime = 0;
        this.duration = 19;
        this.paused = true;
        this.ended = false;
        window.__adminAudioUrls.push(url);
      }

      async play() {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
      }

      pause() {
        if (this.paused) return;
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
      }

      removeAttribute() {}

      load() {}
    }
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      value: DeterministicAudio,
    });
  });

  await createSubmittedStory(page, title);
  const stories = await studentStoriesByTitle(title);
  expect(stories).toHaveLength(1);
  const assetId = await seedVerifiedAudioAsset(stories[0].id);
  try {
    await page.route(`**/api/audio/${assetId}/playback`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playbackUrls: ['https://private.example/admin-subject-audio'],
          durationMs: 19_000,
          expiresIn: 300,
        }),
      });
    });
    await openFounderAdmin(page);
    await activateFounderAdminConsole(page);
    await setDirectReviewFlags('allowlist');
    await page.reload();
    await page.getByRole('button', { name: 'Students', exact: true }).click();
    await page.locator('#adminStudentSearch').fill('Maya');
    await page.locator('#adminStudentSearchForm').getByRole('button', { name: 'Search' }).click();
    await page.locator('[data-admin-open-subject]').first().click();
    await page.getByRole('button', { name: 'Open Story Library', exact: true }).click();
    await page.locator(`[data-admin-subject-story="${stories[0].id}"]`).click();

    const card = page.locator(`[data-audio-card="${assetId}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator('.audTime')).toHaveText('0:00 / 0:19');
    await card.getByRole('button', { name: 'Play original audio' }).click();
    await expect(card.getByRole('button', { name: 'Pause original audio' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__adminAudioUrls.length)).toBe(1);
  } finally {
    await removeAudioAsset(assetId);
  }
});
