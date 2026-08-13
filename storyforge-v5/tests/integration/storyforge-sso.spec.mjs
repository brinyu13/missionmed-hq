import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const composeFile = process.env.STORYFORGE_INTEGRATION_COMPOSE_FILE;
const founderId = process.env.STORYFORGE_INTEGRATION_FOUNDER_ID;
const studentId = process.env.STORYFORGE_INTEGRATION_STUDENT_ID;
const integrationBaseUrl = (process.env.STORYFORGE_INTEGRATION_BASE_URL || 'http://127.0.0.1:4179').replace(/\/$/, '');
const founderUsername = process.env.STORYFORGE_INTEGRATION_USERNAME || 'localadmin';
const founderPassword = process.env.STORYFORGE_INTEGRATION_PASSWORD || 'local-admin-password';
const assetAliases = JSON.parse(process.env.STORYFORGE_INTEGRATION_ASSET_ALIASES || '{}');
const indexAlias = process.env.STORYFORGE_INTEGRATION_INDEX_ALIAS || '';
const distDir = process.env.STORYFORGE_INTEGRATION_DIST_DIR || '';
const productCommit = process.env.STORYFORGE_INTEGRATION_PRODUCT_COMMIT || '';

async function filesUnder(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const child = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(root, child) : [child];
  }));
  return files.flat().sort();
}

function wp(...args) {
  return execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'run', '--rm', 'wpcli', 'wp', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

async function logIn(page, username = founderUsername, password = founderPassword) {
  await page.goto('/wp-login.php');
  const usernameField = page.locator('input[name="log"]');
  const passwordField = page.locator('input[name="pwd"]');
  await passwordField.fill(password);
  await usernameField.fill(username);
  await expect(usernameField).toHaveValue(username);
  await expect(passwordField).toHaveValue(password);
  await page.locator('#wp-submit').click();
  await expect(page).toHaveURL(/\/wp-admin\/(?:profile\.php)?$/);
}

test('anonymous login returns to the exact mounted deep link and obtains a real WP-backed session', async ({ page }) => {
  await page.goto('/storyforge/library?filter=mine&sort=updated');
  await expect(page).toHaveURL(/\/wp-login\.php\?/);
  await page.getByLabel('Username or Email Address').fill(founderUsername);
  await page.locator('#user_pass').fill(founderPassword);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/storyforge\/library\?filter=mine&sort=updated$/);
  await expect(page.getByText('Your story library', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /\d+ stories, none forgotten\./i })).toBeVisible();
  for (const backLink of [page.locator('a.matrixAnchor'), page.locator('a.storyforgeMatrixBack')]) {
    await expect(backLink).toHaveAttribute('href', `${integrationBaseUrl}/member-dashboard/`);
  }
});

test('Matrix navigation and dashboard tile are server-gated and StoryForge wins route precedence', async ({ page, request }) => {
  await logIn(page);
  await page.goto('/member-dashboard/');
  await expect(page.locator('a.missionmed-storyforge-nav')).toHaveCount(1);
  await expect(page.locator('a.missionmed-storyforge-tile')).toHaveCount(1);
  await expect(page.locator('script[src*="matrix-launch.js"]')).toHaveCount(1);
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '#storyforge';
    link.textContent = 'Legacy StoryForge control';
    link.dataset.integrationProbe = 'storyforge';
    document.body.append(link);
  });
  await page.locator('[data-integration-probe="storyforge"]').click();
  await expect(page).toHaveURL(/\/storyforge\/$/);

  await page.goto('/storyforge/settings');
  await expect(page.locator('#main').getByText('Settings', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Your StoryForge/i })).toBeVisible();

  const appRoute = await request.get('/storyforge/library');
  expect(appRoute.status()).toBe(200);
  expect(appRoute.headers()['x-storyforge-route']).toBe('wordpress-gateway');
  const appHtml = await appRoute.text();
  expect(appHtml).toContain('<title>StoryForge V5 · MissionMed</title>');
  expect(appRoute.headers()['cache-control']).toContain('no-store');
  expect(appRoute.headers()['surrogate-control']).toBe('no-store');
  expect(appRoute.headers()['cdn-cache-control']).toBe('no-store');
  expect(appRoute.headers()['cloudflare-cdn-cache-control']).toBe('no-store');
  expect(appRoute.headers()['x-accel-expires']).toBe('0');
  expect(appRoute.headers()['content-security-policy']).toContain("object-src 'none'");
  expect(appRoute.headers()['x-robots-tag']).toContain('noindex');

  const canonical = await request.get('/storyforge', { maxRedirects: 0 });
  expect(canonical.status()).toBe(308);
  expect(canonical.headers().location).toBe('/storyforge/');

  const apiConfig = await request.get('/storyforge/api/config');
  expect(apiConfig.status()).toBe(200);
  expect(apiConfig.headers()['cache-control']).toBe('no-store, private');
  expect(apiConfig.headers()['cdn-cache-control']).toBe('no-store');

  const wpRoute = await request.get('/member-dashboard/');
  expect(wpRoute.status()).toBe(200);
  expect(wpRoute.headers()['x-storyforge-route']).toBeUndefined();
  expect(await wpRoute.text()).toContain('Matrix Test Dashboard');

  const appAlias = process.env.STORYFORGE_INTEGRATION_APP_ALIAS;
  expect(appHtml).toContain(`src="./_asset/${appAlias}"`);
  expect(appHtml).not.toContain('./assets/');
  const asset = await request.get(`/storyforge/_asset/${appAlias}`);
  expect(asset.status()).toBe(200);
  expect(asset.headers()['cache-control']).toContain('immutable');
  expect(asset.headers()['cdn-cache-control']).toBe('no-store');
  const assetBytes = await asset.body();
  expect(createHash('sha256').update(assetBytes).digest('hex').slice(0, 12)).toBe(appAlias);

  const fontAlias = process.env.STORYFORGE_INTEGRATION_FONT_ALIAS;
  const font = await request.get(`/storyforge/_asset/${fontAlias}`);
  expect(font.status()).toBe(200);
  expect(font.headers()['content-type']).toContain('font/woff2');
  expect(font.headers()['cache-control']).toContain('immutable');
  const fontBytes = await font.body();
  expect(createHash('sha256').update(fontBytes).digest('hex').slice(0, 12)).toBe(fontAlias);

  const loadedFonts = await page.evaluate(async () => ({
    archivo: (await document.fonts.load('400 16px Archivo')).length,
    archivoItalic: (await document.fonts.load('italic 800 16px Archivo')).length,
    rajdhani: (await document.fonts.load('700 16px Rajdhani')).length,
    lora: (await document.fonts.load('500 16px Lora')).length,
    loraItalic: (await document.fonts.load('italic 400 16px Lora')).length,
  }));
  expect(loadedFonts).toEqual({
    archivo: 1,
    archivoItalic: 1,
    rajdhani: 1,
    lora: 1,
    loraItalic: 1,
  });
});

test('the WordPress gateway is exact, manifest-bound, and fail-closed', async ({ request }) => {
  const health = await request.get('/storyforge/healthz');
  expect(health.status()).toBe(200);
  expect(health.headers()['cache-control']).toBe('no-store, private');
  expect(health.headers()['surrogate-control']).toBe('no-store');
  expect(health.headers()['cdn-cache-control']).toBe('no-store');
  expect(health.headers()['cloudflare-cdn-cache-control']).toBe('no-store');
  expect(health.headers()['x-accel-expires']).toBe('0');
  expect(health.headers()['x-storyforge-route']).toBe('wordpress-gateway');
  expect(await health.json()).toEqual({ ok: true, service: 'storyforge-v5' });

  const appAlias = process.env.STORYFORGE_INTEGRATION_APP_ALIAS;
  const head = await request.head(`/storyforge/_asset/${appAlias}`);
  expect(head.status()).toBe(200);
  expect(head.headers()['cache-control']).toContain('immutable');
  expect(await head.body()).toHaveLength(0);

  const missing = await request.get('/storyforge/_asset/deadbeefcafe');
  expect(missing.status()).toBe(404);
  expect(missing.headers()['cache-control']).toBe('no-store, private');

  const wrongMethod = await request.post(`/storyforge/_asset/${appAlias}`, { data: '{}' });
  expect(wrongMethod.status()).toBe(405);

  const legacyExtensionAsset = await request.get(`/storyforge/assets/app.${appAlias}.js`);
  expect(legacyExtensionAsset.status()).toBe(404);

  const manifestPaths = Object.values(assetAliases).map(({ path: assetPath }) => assetPath).sort();
  expect(manifestPaths).toEqual(await filesUnder(distDir, 'assets'));
  for (const [alias, entry] of Object.entries(assetAliases)) {
    const expected = await readFile(path.join(distDir, entry.path));
    const aliased = await request.get(`/storyforge/_asset/${alias}`);
    const actual = await aliased.body();
    expect(aliased.status(), entry.path).toBe(200);
    expect(actual.equals(expected), entry.path).toBe(true);
    expect(actual).toHaveLength(entry.size);
    expect(createHash('sha256').update(actual).digest('hex')).toBe(entry.sha256);
    expect(aliased.headers()['content-type']).toBe(entry.type);
    expect(aliased.headers()['cache-control']).toBe(
      entry.cache === 'immutable'
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    );
    expect(aliased.headers()['surrogate-control'], entry.path).toBe('no-store');
    expect(aliased.headers()['cdn-cache-control'], entry.path).toBe('no-store');
    expect(aliased.headers()['cloudflare-cdn-cache-control'], entry.path).toBe('no-store');
    expect(aliased.headers()['x-accel-expires'], entry.path).toBe('0');

    const raw = await request.get(`/storyforge/${entry.path}`);
    expect(raw.status(), entry.path).toBe(404);
    const pluginRaw = await request.get(`/wp-content/plugins/missionmed-storyforge-sso/dist/${entry.path}`);
    expect(pluginRaw.status(), entry.path).toBe(404);
    const muPluginRaw = await request.get(`/wp-content/mu-plugins/missionmed-storyforge-runtime/${entry.path}`);
    expect(muPluginRaw.status(), entry.path).toBe(404);
  }

  expect(indexAlias).toMatch(/^[a-f0-9]{12}$/);
  const indexAliasResponse = await request.get(`/storyforge/_asset/${indexAlias}`);
  expect(indexAliasResponse.status()).toBe(404);
  const rawIndex = await request.get('/storyforge/index.html');
  expect(rawIndex.status()).toBe(404);
  for (const publicIndexPath of [
    '/wp-content/plugins/missionmed-storyforge-sso/dist/index.html',
    '/wp-content/mu-plugins/missionmed-storyforge-runtime/index.html',
  ]) {
    const response = await request.get(publicIndexPath);
    expect(response.status(), publicIndexPath).toBe(404);
  }

  expect(productCommit).toMatch(/^[a-f0-9]{40}$/);
  for (const directBundlePath of [
    process.env.STORYFORGE_INTEGRATION_RELEASE_BUNDLE_PATH,
    `/wp-content/mu-plugins/missionmed-storyforge-runtime/releases/${productCommit}/release.php`,
  ]) {
    const directBundle = await request.get(directBundlePath);
    expect(directBundle.status(), directBundlePath).toBe(404);
    expect(await directBundle.body(), directBundlePath).toHaveLength(0);
    expect(directBundle.headers()['cache-control']).toBe('no-store, private');
    expect(directBundle.headers()['x-content-type-options']).toBe('nosniff');
    expect(directBundle.headers()['x-storyforge-route']).toBeUndefined();
  }

  const rootStoryForgeMuFiles = JSON.parse(wp(
    'eval',
    '$found=array();foreach(scandir(WPMU_PLUGIN_DIR) as $name){$file=WPMU_PLUGIN_DIR."/".$name;if(is_file($file)&&str_ends_with(strtolower($name),".php")&&false!==stripos($name,"storyforge")){$found[]=$name;}}sort($found);echo wp_json_encode($found);',
  ));
  expect(rootStoryForgeMuFiles).toEqual(['missionmed-storyforge-route.php']);

  const devRoute = await request.post('/storyforge/api/dev/session/student', {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  });
  expect(devRoute.status()).toBe(404);

  const missingBearer = await request.get('/storyforge/api/session');
  expect(missingBearer.status()).toBe(401);
  expect((await missingBearer.json()).error.code).toBe('auth_required');

  const forbiddenMethod = await request.put('/storyforge/api/session', {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  });
  expect(forbiddenMethod.status()).toBe(405);

  const encodedDelimiter = await request.get('/storyforge/%25encoded');
  expect(encodedDelimiter.status()).toBe(400);

  const alternatePublicAsset = await request.get('/wp-content/plugins/missionmed-storyforge-sso/dist/index.html');
  expect(alternatePublicAsset.status()).toBe(404);
  expect(alternatePublicAsset.headers()['x-storyforge-route']).toBeUndefined();
});

test('founder-only zero-assignment workflow remains private and truthful', async ({ page }) => {
  await logIn(page);
  await page.goto('/storyforge/');
  await expect(page.locator('.greet em')).toHaveText('Dr');
  await page.getByRole('button', { name: /New Story/i }).first().click();
  const captureDialog = page.getByRole('dialog', { name: /New story — Save it before it fades/i });
  await captureDialog.locator('[name="title"]').fill('Founder private rehearsal');
  await captureDialog.locator('[name="text"]').fill(
    'This private story remains editable while mentor review is disabled.',
  );
  await captureDialog.getByRole('button', { name: 'Save story' }).click();

  await page.getByRole('button', { name: 'Story Library' }).first().click();
  const storyRow = page.locator('[data-story-row]')
    .filter({ hasText: 'Founder private rehearsal' })
    .first();
  await expect(storyRow).toBeVisible();
  const openStory = storyRow.locator('[data-open-story]').first();
  const storyId = await openStory.getAttribute('data-open-story');
  expect(storyId).toMatch(/^[a-f0-9-]{36}$/i);
  await openStory.click();

  await expect(page.getByRole('button', { name: 'Mentor review unavailable' })).toBeDisabled();
  await expect(page.getByText('Mentor review is not enabled yet. This story remains editable, and its visibility setting is unchanged.')).toBeVisible();
  await page.getByRole('tab', { name: 'Working version' }).click();
  await expect(page.getByRole('textbox', { name: 'Working version' })).toBeEditable();
  // This fixture deliberately leaves visibility-consent disabled, so the
  // canonical legacy status chip remains the privacy signal on this surface.
  await expect(page.locator('#room .roomMeta .stChip').filter({ hasText: /^Private$/ })).toBeVisible();

  const directProbe = await page.evaluate(async (id) => {
    const bootstrap = await fetch(
      `/wp-admin/admin-ajax.php?action=missionmed_storyforge_bootstrap&return_to=${encodeURIComponent(location.href)}`,
      { credentials: 'include' },
    ).then((response) => response.json());
    const issued = await fetch(bootstrap.data.token_endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': bootstrap.data.nonce },
      body: '{}',
    }).then((response) => response.json());
    const headers = {
      Authorization: `Bearer ${issued.token}`,
      'Content-Type': 'application/json',
    };
    const submit = await fetch(`/storyforge/api/stories/${id}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ surface: 'workspace' }),
    });
    const submitBody = await submit.json();
    const detail = await fetch(`/storyforge/api/stories/${id}`, { headers }).then((response) => response.json());
    return {
      submitStatus: submit.status,
      submitCode: submitBody.error?.code,
      storyStatus: detail.story?.status,
      mentorReviewAvailable: detail.story?.mentor_review_available,
    };
  }, storyId);

  expect(directProbe).toEqual({
    submitStatus: 403,
    submitCode: '42501',
    storyStatus: 'private',
    mentorReviewAvailable: false,
  });
});

test('nonce, JWT signature, and allowed-origin checks fail closed', async ({ page, request }) => {
  await logIn(page);
  await page.goto('/storyforge/');
  await expect(page.getByText('What happened that you don’t want to lose?', { exact: true })).toBeVisible();

  const probe = await page.evaluate(async () => {
    const bootstrapResponse = await fetch(
      `/wp-admin/admin-ajax.php?action=missionmed_storyforge_bootstrap&return_to=${encodeURIComponent(location.href)}`,
      { credentials: 'include' },
    );
    const bootstrap = await bootstrapResponse.json();
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
    const anonymousBootstrap = await fetch(
      `/wp-admin/admin-ajax.php?action=missionmed_storyforge_bootstrap&return_to=${encodeURIComponent(location.href)}`,
      { credentials: 'omit' },
    );
    return {
      bootstrapCache: bootstrapResponse.headers.get('cache-control'),
      csrfStatus: csrf.status,
      csrfCache: csrf.headers.get('cache-control'),
      csrfBody: await csrf.json(),
      issuedStatus: issued.status,
      issuedCache: issued.headers.get('cache-control'),
      issuedBody: await issued.json(),
      anonymousBootstrapStatus: anonymousBootstrap.status,
      anonymousBootstrapCache: anonymousBootstrap.headers.get('cache-control'),
    };
  });
  expect(probe.bootstrapCache).toBe('no-store, private');
  expect(probe.csrfStatus).toBe(403);
  expect(probe.csrfCache).toBe('no-store, private');
  expect(probe.issuedStatus).toBe(200);
  expect(probe.issuedCache).toBe('no-store, private');
  expect(probe.anonymousBootstrapStatus).toBe(401);
  expect(probe.anonymousBootstrapCache).toBe('no-store, private');

  const tampered = await request.get('/storyforge/api/session', {
    headers: { Authorization: `Bearer ${probe.issuedBody.token}x` },
  });
  expect(tampered.status()).toBe(401);
  expect(tampered.headers()['cache-control']).toBe('no-store, private');

  const disallowed = await request.get('/storyforge/api/config', {
    headers: { Origin: 'https://evil.example' },
  });
  expect(disallowed.status()).toBe(403);
  expect((await disallowed.json()).error.code).toBe('origin_not_allowed');
});

test('an ended WordPress session locks an already-open app without persisting authority', async ({ page }) => {
  await logIn(page);
  await page.goto('/storyforge/');
  await expect(page.getByText('What happened that you don’t want to lose?', { exact: true })).toBeVisible();

  wp('user', 'session', 'destroy', founderId, '--all');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByRole('heading', { name: 'Your MissionMed session ended.' })).toBeVisible({ timeout: 10_000 });
});

test('eligibility revocation locks the open app before one short token TTL elapses', async ({ page }) => {
  wp('eval', `$s=mmsf_settings();$s['allowed_user_ids']=array(${founderId},${studentId});update_option(MMSF_OPTION,$s,false);`);
  await logIn(page, 'maya', 'storyforge-local-password');
  await page.goto('/storyforge/');
  await expect(page.getByText('What happened that you don’t want to lose?', { exact: true })).toBeVisible();

  wp('user', 'meta', 'update', studentId, '_missionmed_storyforge_local_eligible', '0');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByRole('heading', { name: 'Your 360 access has changed.' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Your MissionMed 360 access is not currently active.')).toBeVisible();
});
