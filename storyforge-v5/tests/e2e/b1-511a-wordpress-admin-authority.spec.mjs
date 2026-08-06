import { expect, test } from '@playwright/test';
import pg from 'pg';

const founderStudentId = '11111111-1111-4111-8111-111111111111';

async function setFounderConsole(enabled) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE public.sf_feature_flags
          SET scope = $1,
              allowlist = $2::uuid[],
              cohorts = '{}'::text[],
              updated_at = now()
        WHERE key = 'admin_console'`,
      enabled ? ['allowlist', [founderStudentId]] : ['off', []],
    );
  } finally {
    await client.end();
  }
}

test.beforeEach(async () => setFounderConsole(true));
test.afterEach(async () => setFounderConsole(false));

test('WordPress Founder authority adds Administrator View without replacing Student View', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Founder · Student + Admin' }).click();

  await expect(page.getByRole('button', { name: 'Student View' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Administrator View' })).toBeVisible();
  await expect(page.locator('[data-open-capture]').first()).toBeVisible();

  await page.getByRole('button', { name: 'Administrator View' }).click();
  await expect(page.locator('[data-view="admin-home"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Admin Home' })).toBeVisible();
  await expect(page.getByText(/private stories remain invisible/i)).toBeVisible();

  await page.getByRole('button', { name: 'Student View' }).click();
  await expect(page.locator('[data-view="home"]')).toBeVisible();
  await expect(page.locator('[data-open-capture]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Student View' })).toHaveAttribute('aria-pressed', 'true');
});
