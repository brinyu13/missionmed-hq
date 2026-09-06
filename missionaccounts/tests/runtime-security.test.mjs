import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionShellPath = path.join(packageDir, 'public/index.production.html');
const pluginPath = path.join(packageDir, 'wordpress/missionmed-missionaccounts-sso/missionmed-missionaccounts-sso.php');
const routePath = path.join(packageDir, 'infra/wordpress/missionmed-missionaccounts-route.php');
const dockerfilePath = path.join(packageDir, 'Dockerfile');
const dockerignorePath = path.join(packageDir, '.dockerignore');
const railwayPath = path.join(packageDir, 'railway.json');

async function withServer(options, run) {
  const server = createMissionAccountsServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
}

test('production shell preserves the canon but contains no historical roster payload or browser business state', async () => {
  const html = await readFile(productionShellPath, 'utf8');
  assert.match(html, /data-missionaccounts-build="production"/);
  assert.match(html, /authenticated-role-scoped-runtime/);
  assert.match(html, /src="\.\/missionaccounts-runtime\.js"/);
  assert.doesNotMatch(html, /MX-EXAMPREP-5000B_Reconciled_Ledger/);
  assert.doesNotMatch(html, /Ahunna Nzerem|Adriana Rodríguez/);
  assert.match(html, /missionaccountsBuild==='production'\) return fresh\(\)/);
  assert.match(html, /missionaccountsBuild==='production'\) return;/);
});

test('production server serves only the scoped shell while keeping mounted public config available', async () => {
  const config = {
    production: true,
    localAuth: false,
    basePath: '/missionaccounts/',
    wpBootstrapPath: '/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap',
    tokenRefreshSkewSeconds: 15,
    issuer: 'https://missionmedinstitute.com/wp-json/missionmed/v1/missionaccounts',
    audience: 'missionaccounts',
    jwtSecret: 'test-production-secret-that-is-at-least-32-bytes',
    jwksUrl: '',
    features: {},
  };
  await withServer({ config, store: new PreviewStore() }, async base => {
    const shell = await fetch(`${base}/missionaccounts/`);
    assert.equal(shell.status, 200);
    assert.match(shell.headers.get('cache-control'), /no-store/);
    const html = await shell.text();
    assert.match(html, /authenticated-role-scoped-runtime/);
    assert.doesNotMatch(html, /MX-EXAMPREP-5000B_Reconciled_Ledger/);

    const publicConfig = await fetch(`${base}/missionaccounts/api/config`);
    assert.equal(publicConfig.status, 200);
    assert.deepEqual(await publicConfig.json(), {
      basePath: '/missionaccounts/',
      wpBootstrapPath: '/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap',
      tokenRefreshSkewSeconds: 15,
      localAuth: false,
      identityMode: 'missionmed-signed-jwt',
    });
    const privateSession = await fetch(`${base}/missionaccounts/api/session`);
    assert.equal(privateSession.status, 401);
  });
});

test('production process fails before listening when the database target is absent', () => {
  const env = { ...process.env, NODE_ENV: 'production', PORT: '0' };
  delete env.MISSIONACCOUNTS_SUPABASE_URL;
  delete env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY;
  const result = spawnSync(process.execPath, ['src/server.mjs'], {
    cwd: packageDir,
    env,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /production requires an explicit database target/i);
});

test('isolated production packaging cannot include the private Founder preview', async () => {
  const [dockerfile, dockerignore, railwaySource] = await Promise.all([
    readFile(dockerfilePath, 'utf8'),
    readFile(dockerignorePath, 'utf8'),
    readFile(railwayPath, 'utf8'),
  ]);
  assert.match(dockerfile, /FROM node:22-alpine/);
  assert.match(dockerfile, /public\/index\.production\.html/);
  assert.doesNotMatch(dockerfile, /COPY\s+(?:--[^\s]+\s+)*\.\s/);
  assert.doesNotMatch(dockerfile, /COPY[^\n]*public(?:\s|\/\s)/);
  assert.doesNotMatch(dockerfile, /public\/index\.html|canon-manifest|historical-import/);
  assert.match(dockerignore, /^\*$/m);
  assert.match(dockerignore, /!public\/index\.production\.html/);
  assert.doesNotMatch(dockerignore, /!public\/index\.html|!public\/canon-manifest\.json/);
  const railway = JSON.parse(railwaySource);
  assert.equal(railway.build.builder, 'DOCKERFILE');
  assert.equal(railway.build.dockerfilePath, 'Dockerfile');
  assert.equal(railway.deploy.healthcheckPath, '/api/health');
});

test('MissionAccounts WordPress bridge is default-off, allowlisted, nonce/origin checked, and product isolated', async () => {
  execFileSync('php', ['-l', pluginPath], { stdio: 'pipe' });
  const source = await readFile(pluginPath, 'utf8');
  assert.match(source, /'missionaccounts_enabled'\s*=>\s*false/);
  assert.match(source, /mma_user_is_allowlisted/);
  assert.match(source, /wp_verify_nonce\(\$nonce, 'wp_rest'\)/);
  assert.match(source, /mma_verify_origin/);
  assert.match(source, /MISSIONACCOUNTS_JWT_SECRET/);
  assert.match(source, /'audience'\s*=>\s*'missionaccounts'/);
  assert.match(source, /'missionaccounts_eligible'\s*=>\s*true/);
  assert.match(source, /array\('student', 'missionaccounts_admin', 'founder'\)/);
  assert.match(source, /wp_ajax_nopriv_missionmed_missionaccounts_bootstrap/);
  assert.doesNotMatch(source, /STORYFORGE_JWT_SECRET|storyforge_eligible/);
});

test('browser auth client uses the current StoryForge-family exchange shape without persisting bearer tokens', async () => {
  const source = await readFile(path.join(packageDir, 'public/missionaccounts-auth.js'), 'utf8');
  assert.match(source, /missionmed_missionaccounts_bootstrap/);
  assert.match(source, /'X-WP-Nonce': bridge\.nonce/);
  assert.match(source, /headers\.Authorization = `Bearer \$\{token\}`/);
  assert.match(source, /credentials: config\.localAuth \? 'same-origin' : 'omit'/);
  assert.match(source, /response\.status === 401[^]*!retried/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(source, /\/api\/auth\/exchange|\/api\/auth\/bootstrap/);
});

test('same-origin WordPress gateway is default-off, targetless, bounded, and strips cookies from upstream requests', async () => {
  execFileSync('php', ['-l', routePath], { stdio: 'pipe' });
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /MISSIONACCOUNTS_ROUTE_ENABLED/);
  assert.match(source, /return false;/);
  assert.match(source, /MISSIONACCOUNTS_RAILWAY_ORIGIN/);
  assert.match(source, /strtolower\(\(string\) \(\$parts\['scheme'\]/);
  assert.match(source, /'redirection'\s*=>\s*0/);
  assert.match(source, /'reject_unsafe_urls'\s*=>\s*true/);
  assert.match(source, /MMMA_MAX_REQUEST_BYTES/);
  assert.match(source, /MMMA_MAX_RESPONSE_BYTES/);
  assert.match(source, /A MissionAccounts bearer token is required/);
  assert.match(source, /X-MissionAccounts-Route: wordpress-gateway/);
  assert.doesNotMatch(source, /https:\/\/[^'"\s]+\.up\.railway\.app/);
  assert.doesNotMatch(source, /\$_COOKIE|HTTP_COOKIE|'Cookie'/);
});
