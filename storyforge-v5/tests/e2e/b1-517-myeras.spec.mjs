import { expect, test } from '@playwright/test';
import pg from 'pg';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const B1_517_FLAGS = [
  'eras_taxonomy',
  'myeras_workspace',
  'clinical_case_metadata',
  'use_ranking',
  'myeras_versions',
];

async function withDatabase(operation) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try { return await operation(client); } finally { await client.end(); }
}

async function chooseStudent(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await expect(page.locator('#storyforgeOpening')).toBeHidden();
  await expect(page.locator('[data-view="home"]')).toBeVisible();
}

test.describe('B1-517 MyERAS alignment workspace', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await withDatabase(async (client) => {
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope='eligible_all',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
          WHERE key=ANY($1::text[])`,
        [B1_517_FLAGS],
      );
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope='off',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
          WHERE key='ai_condensation'`,
      );
      await client.query(
        `DELETE FROM public.sf_myeras_experience_stories
          WHERE experience_id IN (SELECT id FROM public.sf_myeras_experiences WHERE student_id=$1)`,
        [STUDENT_ID],
      );
      await client.query('DELETE FROM public.sf_myeras_experiences WHERE student_id=$1', [STUDENT_ID]);
      await client.query('DELETE FROM public.sf_myeras_impactful WHERE student_id=$1', [STUDENT_ID]);
    });
  });

  test.afterAll(async () => {
    await withDatabase(async (client) => {
      await client.query(
        `UPDATE public.sf_feature_flags
            SET scope='off',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
          WHERE key=ANY($1::text[])`,
        [[...B1_517_FLAGS, 'ai_condensation']],
      );
    });
  });

  test('creates and reloads a full-fidelity experience without inventing unavailable AAMC fields', async ({ page }) => {
    await chooseStudent(page);
    await page.getByRole('button', { name: 'MyERAS Experiences', exact: true }).click();

    await expect(page.locator('[data-view="myeras"]')).toBeVisible();
    await expect(page.locator('.b1517ProfileBadge')).toContainText('ERAS 2027 season');
    await expect(page.getByText('AI condensing is off. You can complete every MyERAS field manually.')).toBeVisible();

    await page.getByRole('button', { name: 'Add the first experience' }).click();
    const form = page.locator('#myerasExperienceForm');
    await expect(form).toBeVisible();
    await expect(form.getByText('Participation frequency remains unavailable')).toBeVisible();
    await expect(form.locator('[data-myeras-field="participationFrequency"]')).toHaveCount(0);

    await form.locator('[data-myeras-field="organization"]').fill('Community Health Partnership');
    await form.locator('[data-myeras-field="experienceType"]').selectOption('volunteer_service_advocacy');
    await form.locator('[data-myeras-field="positionTitle"]').fill('Student volunteer');
    await form.locator('[data-myeras-field="startMonth"]').fill('2026-01-01');
    await form.locator('[data-myeras-field="country"]').fill('United States');
    await form.locator('[data-myeras-field="stateProvince"]').fill('New York');
    await form.locator('[data-myeras-field="city"]').fill('Albany');
    await form.locator('[data-myeras-field="postalCode"]').fill('12208');
    await form.locator('[data-myeras-field="setting"]').selectOption('urban');
    await form.locator('[data-myeras-field="primaryFocus"]').selectOption('community_involvement_outreach');
    await form.locator('[data-myeras-field="keyCharacteristic"]').selectOption('empathy_and_compassion');

    const description = `I listened to community members, coordinated a practical response, and learned to verify the outcome. ${'Specific truthful detail. '.repeat(36)}`;
    await form.locator('[data-myeras-field="descriptionText"]').fill(description);
    await expect(form.locator('[data-myeras-counter="descriptionText"]')).toContainText('over ERAS target; nothing is truncated');
    await form.getByRole('button', { name: 'Add experience' }).click();

    const card = page.locator('[data-myeras-experience]').filter({ hasText: 'Community Health Partnership' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Volunteer/service/advocacy');
    await expect(card).toContainText('over ERAS target; nothing is truncated');

    await page.reload();
    await expect(page.locator('[data-view="home"]')).toBeVisible();
    await page.getByRole('button', { name: 'MyERAS Experiences', exact: true }).click();
    await expect(page.locator('[data-view="myeras"]')).toBeVisible();
    await expect(page.locator('[data-myeras-experience]').filter({ hasText: 'Community Health Partnership' })).toHaveCount(1);
  });

  test('keeps the feature family independently default-closed', async ({ page }) => {
    await withDatabase((client) => client.query(
      `UPDATE public.sf_feature_flags
          SET scope='off',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
        WHERE key='myeras_workspace'`,
    ));

    await chooseStudent(page);
    await expect(page.getByRole('button', { name: 'MyERAS Experiences', exact: true })).toHaveCount(0);
    await page.goto('/myeras');
    await expect(page.locator('[data-view="myeras"]')).toHaveCount(0);

    await withDatabase((client) => client.query(
      `UPDATE public.sf_feature_flags
          SET scope='eligible_all',allowlist='{}'::uuid[],cohorts='{}'::text[],updated_at=now()
        WHERE key='myeras_workspace'`,
    ));
  });
});
