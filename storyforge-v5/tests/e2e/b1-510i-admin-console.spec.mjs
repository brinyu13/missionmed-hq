import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const packageDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const screenshotDir = path.resolve(
  packageDir,
  '../_AI_HANDOFFS/from_codex/B1-510I_storyforge_august1_canonical_and_admin_console/screenshots',
);

async function openFounderAdmin(page) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  if (await change.count()) await change.click();
  await page.getByRole('button', { name: 'Admin · least privilege' }).click();
  await expect(page.getByText('Question Governance', { exact: true })).toBeVisible();
}

async function createSubmittedStory(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.locator('[data-open-capture]').first().click();
  await page.locator('#capTitle').fill('Founder administrator review proof');
  await page.locator('#capBody').fill('I noticed a team communication gap, named it, and helped the group reach a safer plan.');
  await page.locator('#capLesson').fill('Clear communication can change the course of a difficult decision.');
  await page.getByRole('button', { name: 'Save story' }).click();
  await page.getByRole('button', { name: /Founder administrator review proof/ }).first().click();
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

async function restoreFounderAdminConsoleDefaultOff(page) {
  await page.goto('/');
  const change = page.getByRole('button', { name: 'Change fixture identity' });
  if (await change.count()) await change.click();
  await page.getByRole('button', { name: 'Admin · least privilege' }).click();
  await page.getByRole('button', { name: 'Release Controls' }).click();
  await page.locator('#adminConsoleScope').selectOption('off');
  await page.locator('#adminConsoleFeatureForm')
    .getByRole('button', { name: 'Save admin workspace gate' })
    .click();
  await expect(page.getByText('Administrator workspace disabled.', { exact: true })).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await restoreFounderAdminConsoleDefaultOff(page);
});

test('Founder-only administrator console is additive, bounded, and review-capable', async ({ page }) => {
  await createSubmittedStory(page);
  await openFounderAdmin(page);
  await activateFounderAdminConsole(page);
  await page.getByRole('button', { name: 'Admin Home' }).click();
  await expect(page.locator('[data-view="admin-home"]')).toBeVisible();
  await expect(page.getByText(/without crossing privacy lines/i)).toBeVisible();

  await page.getByRole('button', { name: 'Students', exact: true }).click();
  await expect(page.locator('#adminStudentSearchForm')).toBeVisible();
  await page.locator('#adminStudentSearch').fill('Maya');
  await page.locator('#adminStudentSearchForm').getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('[data-admin-open-student]').first()).toBeVisible();
  await page.locator('[data-admin-open-student]').first().click();
  await expect(page.locator('.privacyBoundary')).toContainText('Private and archived stories are intentionally absent');

  const review = page.locator('[data-admin-open-story]').first();
  await expect(review).toBeVisible();
  await review.click();
  await expect(page.locator('#adminStoryReviewForm')).toBeVisible();
  await expect(page.locator('[data-view="admin-story"]')).not.toContainText(/original audio|play original audio/i);
  await page.locator('#adminReviewStatus').selectOption('reviewed');
  await page.locator('#adminReviewScore').selectOption('5');
  await page.locator('#adminReviewSuitability').selectOption('both');
  await page.locator('#adminStudentFeedback').fill('Strong example with a clear turning point.');
  await page.locator('#adminInternalNote').fill('Founder-only local acceptance note.');
  await page.locator('#adminStoryReviewForm').getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByText('Strong example with a clear turning point.')).toBeVisible();
  await expect(page.getByText('Founder-only local acceptance note.')).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, 'phase-b-founder-admin-story-review.png'),
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
