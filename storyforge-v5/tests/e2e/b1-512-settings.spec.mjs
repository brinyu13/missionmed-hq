import { expect, test } from '@playwright/test';

async function openStudentSettings(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}

test('environment selection previews without persistence, cancels, saves, and survives reload', async ({ page }) => {
  await openStudentSettings(page);
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');

  await page.getByRole('button', { name: /Deep Tide/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
  await expect(page.getByText('Selected: Deep Tide')).toBeVisible();
  await expect(page.getByText('Saved: Emberlight')).toBeVisible();

  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'tide');
  await expect(page.getByText('Preview: Active')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');

  await page.getByRole('button', { name: /Aurora/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  await page.getByRole('button', { name: 'Save environment' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  await expect(page.getByText('Saved: Aurora')).toBeVisible();

  await page.getByRole('button', { name: /Emberlight/ }).click();
  await page.getByRole('button', { name: 'Save environment' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
});

test('Standard, Large, and Extra Large preview and persist per signed user without clipping', async ({ page }) => {
  await openStudentSettings(page);
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');

  await page.getByRole('button', { name: /^Extra Large/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');
  await page.getByRole('button', { name: 'Preview', exact: true }).last().click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'extra_large');
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).last().click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');

  await page.getByRole('button', { name: /^Large/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).last().click();
  await page.getByRole('button', { name: 'Save text size' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'large');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.locator('main').evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Standard' }).click();
  await page.getByRole('button', { name: 'Save text size' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');
});
