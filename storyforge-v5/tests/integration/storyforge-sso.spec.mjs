import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const composeFile = process.env.STORYFORGE_INTEGRATION_COMPOSE_FILE;
const studentId = process.env.STORYFORGE_INTEGRATION_STUDENT_ID;

function wp(...args) {
  return execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'run', '--rm', 'wpcli', 'wp', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

test('anonymous login returns to the exact mounted deep link and obtains a real WP-backed session', async ({ page }) => {
  await page.goto('/storyforge/library?filter=mine&sort=updated');
  await expect(page).toHaveURL(/\/wp-login\.php\?/);
  await page.getByLabel('Username or Email Address').fill('maya');
  await page.locator('#user_pass').fill('storyforge-local-password');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/storyforge\/library\?filter=mine&sort=updated$/);
  await expect(page.getByRole('heading', { name: 'Your stories, with their history intact.' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← Back to Matrix' })).toHaveAttribute('href', 'http://127.0.0.1:4179/member-dashboard/');
});

test('Matrix navigation and dashboard tile are server-gated and StoryForge wins route precedence', async ({ page, request }) => {
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('maya');
  await page.locator('#user_pass').fill('storyforge-local-password');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.goto('/member-dashboard/');
  await expect(page.locator('a.missionmed-storyforge-nav')).toHaveCount(1);
  await expect(page.locator('a.missionmed-storyforge-tile')).toHaveCount(1);

  await page.goto('/storyforge/prep/workshop');
  await expect(page.getByRole('heading', { name: 'Prepare the next natural question.' })).toBeVisible();

  const appRoute = await request.get('/storyforge/library');
  expect(appRoute.status()).toBe(200);
  expect(appRoute.headers()['x-storyforge-local-edge']).toBe('storyforge');
  expect(await appRoute.text()).toContain('<title>StoryForge · MissionMed</title>');
  expect(appRoute.headers()['cache-control']).toContain('no-store');

  const wpRoute = await request.get('/member-dashboard/');
  expect(wpRoute.status()).toBe(200);
  expect(wpRoute.headers()['x-storyforge-local-edge']).toBe('wordpress');
  expect(await wpRoute.text()).toContain('Matrix Test Dashboard');

  const assetName = process.env.STORYFORGE_INTEGRATION_HASHED_ASSET;
  const asset = await request.get(`/storyforge/assets/${assetName}`);
  expect(asset.status()).toBe(200);
  expect(asset.headers()['cache-control']).toContain('immutable');
});

test('nonce, JWT signature, and allowed-origin checks fail closed', async ({ page, request }) => {
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('maya');
  await page.locator('#user_pass').fill('storyforge-local-password');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.goto('/storyforge/');
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  const probe = await page.evaluate(async () => {
    const bootstrap = await fetch(
      `/wp-admin/admin-ajax.php?action=missionmed_storyforge_bootstrap&return_to=${encodeURIComponent(location.href)}`,
      { credentials: 'include' },
    ).then((response) => response.json());
    const csrf = await fetch(bootstrap.data.token_endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const issued = await fetch(bootstrap.data.token_endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': bootstrap.data.nonce },
      body: '{}',
    });
    return {
      csrfStatus: csrf.status,
      csrfBody: await csrf.json(),
      issuedStatus: issued.status,
      issuedBody: await issued.json(),
    };
  });
  expect(probe.csrfStatus).toBe(403);
  expect(probe.issuedStatus).toBe(200);

  const tampered = await request.get('/storyforge/api/session', {
    headers: { Authorization: `Bearer ${probe.issuedBody.token}x` },
  });
  expect(tampered.status()).toBe(401);

  const disallowed = await request.get('/storyforge/api/config', {
    headers: { Origin: 'https://evil.example' },
  });
  expect(disallowed.status()).toBe(403);
  expect((await disallowed.json()).error.code).toBe('origin_not_allowed');
});

test('an ended WordPress session locks an already-open app without persisting authority', async ({ page }) => {
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('maya');
  await page.locator('#user_pass').fill('storyforge-local-password');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.goto('/storyforge/');
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  wp('user', 'session', 'destroy', studentId, '--all');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByRole('heading', { name: 'Your MissionMed session ended.' })).toBeVisible({ timeout: 10_000 });
});

test('eligibility revocation locks the open app before one short token TTL elapses', async ({ page }) => {
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('maya');
  await page.locator('#user_pass').fill('storyforge-local-password');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.goto('/storyforge/');
  await expect(page.getByRole('heading', { name: 'Shape what only you can tell.' })).toBeVisible();

  wp('user', 'meta', 'update', studentId, '_missionmed_storyforge_local_eligible', '0');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByRole('heading', { name: 'Your 360 access has changed.' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Your MissionMed 360 access is not currently active.')).toBeVisible();
});
