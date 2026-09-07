import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore, SupabaseRestStore } from '../src/storage/supabase-rest.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionShellPath = path.join(packageDir, 'public/index.production.html');
const pluginPath = path.join(packageDir, 'wordpress/missionmed-missionaccounts-sso/missionmed-missionaccounts-sso.php');
const routePath = path.join(packageDir, 'infra/wordpress/missionmed-missionaccounts-route.php');
const dockerfilePath = path.join(packageDir, 'Dockerfile');
const dockerignorePath = path.join(packageDir, '.dockerignore');
const railwayPath = path.join(packageDir, 'railway.json');
const stripeBrowserPath = path.join(packageDir, 'public/missionaccounts-stripe.js');

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
  const runtimeSource = await readFile(path.join(packageDir, 'public/missionaccounts-runtime.js'), 'utf8');
  assert.match(html, /data-missionaccounts-build="production"/);
  assert.match(html, /<title>MissionAccounts · MissionMed Institute<\/title>/);
  assert.match(html, /MissionAccounts · server-authoritative record/);
  assert.match(html, /Server-authoritative state/);
  assert.match(html, /Automatic billing remains disabled|automatic billing remains disabled/);
  assert.match(html, /function paymentSheet\(si, mode\)\{ if\(document\.documentElement\.dataset\.missionaccountsBuild==='production'\) return window\.MissionAccountsRuntime\.dispatch\('payment-setup'/);
  assert.match(html, /function reportSheet\(\)\{/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('attendance-issue-report'/);
  assert.match(html, /history\.replaceState\(null,'',location\.pathname\+location\.search\+'#\/me'\)/);
  assert.match(html, /This goes to her private review list\./);
  assert.match(html, /function viewAttendanceIssues\(\)/);
  assert.match(html, /data-attendance-issue-review/);
  assert.match(html, /These reports are private and never change Zoom evidence, attendance, or billing by themselves\./);
  assert.match(html, /Review history/);
  assert.match(html, /id="missionaccounts-runtime-gate-style"/);
  assert.match(html, /data-missionaccounts-runtime="authenticated-readonly"/);
  assert.match(html, /\[data-reset\][^\n]*display:none!important/);
  assert.match(html, /id="missionaccountsRuntimeGate"/);
  assert.match(html, /id="hSearchInput" aria-label="Find a student"/);
  assert.match(html, /id="missionaccounts-bootstrap-route-guard"/);
  assert.match(html, /__MISSIONACCOUNTS_REQUESTED_HASH/);
  assert.match(html, /!latest&&!\['billing','exam'\]\.includes\(sub\)\) sub='billing'/);
  assert.doesNotMatch(html, /<title>[^<]*prototype<\/title>|Prototype · view as|Prototype — your decisions are saved in this browser only/);
  assert.match(html, /authenticated-role-scoped-runtime/);
  assert.match(html, /src="\.\/assets\/runtime"/);
  assert.match(html, /Provider configured · latest sync/);
  assert.match(html, /Attendance updates automatically after the daily Zoom sync runs/);
  assert.doesNotMatch(html, /MX-EXAMPREP-5000B_Reconciled_Ledger/);
  assert.doesNotMatch(html, /Ahunna Nzerem|Adriana Rodríguez/);
  assert.match(html, /missionaccountsBuild==='production'\) return fresh\(\)/);
  assert.match(html, /missionaccountsBuild==='production'\) return;/);
  assert.match(html, /function hydrateAuthoritative\(nextD,nextWS,idMaps\)/);
  assert.match(runtimeSource, /attendanceEventGroups/);
  assert.match(runtimeSource, /Multiple preserved source attendances contribute to this logical attendance/);
  assert.match(html, /data-report\],\[data-attendance-issue-review\]/);
  assert.match(html, /missionAccountsApplyCapabilityState\(w\)/);
  assert.match(html, /missionAccountsApplyCapabilityState\(document\.getElementById\(id\)\)/);
  assert.match(html, /function missionAccountsConfirmGroupSheet/);
  assert.match(html, /missionAccountsBatchOutcome/);
  assert.match(html, /dispatch\('billing-decision-reversal'/);
  assert.match(html, /No attendance yet\./);
  assert.match(html, /function missionAccountsZoomHealth\(\)/);
  assert.match(html, /Schedule not reported by this deployment/);
  assert.match(html, /Source review needed/);
  assert.match(html, /integration exception/);
  assert.match(html, /Authoritative hydration is production-only/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('billing-decision'/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('identity-adjudication'/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('device-identity-adjudication'/);
  assert.match(html, /capabilities\.identity_review!==true/);
  assert.match(html, /Which student record should MissionAccounts keep\?/);
  assert.doesNotMatch(html, /Identity adjudication is not enabled yet/);
  assert.doesNotMatch(html, /Device identity adjudication is not enabled yet/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('student-contact'/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('invoice-readiness'/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('hosted-invoice'/);
  assert.match(html, /Send Stripe invoice/);
  assert.match(html, /Open Stripe invoice/);
  assert.match(html, /Stripe-hosted invoicing is disabled/);
  assert.match(runtimeSource, /'hosted-invoice': 'hosted_invoices'/);
  assert.match(runtimeSource, /Only Dr J can manage hosted invoices/);
  assert.match(html, /MissionAccountsRuntime\.dispatch\('exam-transition',\{si,action:'passed'/);
  assert.match(html, /hydrateAuthoritative, toast/);
  assert.match(html, /onclick=async\(\)=>\{ const si=\+b\.dataset\.saveContact/);
  assert.match(html, /onclick=async\(\)=>\{ const \[si,k,v\]=b\.dataset\.ready\.split/);
});

test('every executable inline production script parses in the browser language grammar', async () => {
  const html = await readFile(productionShellPath, 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let executableCount = 0;
  for (const [, attributes, source] of scripts) {
    if (/\bsrc\s*=/.test(attributes) || /\btype=["']application\/json["']/.test(attributes)) continue;
    executableCount += 1;
    assert.doesNotThrow(
      () => new vm.Script(source),
      `Production inline script ${executableCount} must parse before deployment`,
    );
  }
  assert.ok(executableCount > 0);
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
      payments: {
        provider: 'stripe',
        setupEnabled: false,
        mode: 'disabled',
        publishableKey: null,
      },
    });
    const privateSession = await fetch(`${base}/missionaccounts/api/session`);
    assert.equal(privateSession.status, 401);

    const assetPaths = ['runtime', 'auth', 'canonical-adapter', 'stripe'];
    for (const asset of assetPaths) {
      const response = await fetch(`${base}/missionaccounts/assets/${asset}`);
      assert.equal(response.status, 200, `${asset} must be available at an extensionless Matrix gateway path`);
      assert.match(response.headers.get('content-type'), /application\/javascript/);
    }
    const runtime = await (await fetch(`${base}/missionaccounts/assets/runtime`)).text();
    assert.match(runtime, /from '\.\/auth'/);
    assert.doesNotMatch(runtime, /from '\.\/missionaccounts-auth\.js'/);
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

test('production process fails before listening when Zoom is enabled without its complete S2S binding', () => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '0',
    MISSIONACCOUNTS_SUPABASE_URL: 'https://database.invalid',
    MISSIONACCOUNTS_SUPABASE_SERVICE_KEY: 'local-test-placeholder',
    MISSIONACCOUNTS_ZOOM_SYNC: '1',
    MISSIONACCOUNTS_ZOOM_MODE: 'configured',
    MISSIONACCOUNTS_ZOOM_ACCOUNT_ID: 'account-id',
  };
  delete env.MISSIONACCOUNTS_ZOOM_CLIENT_ID;
  delete env.MISSIONACCOUNTS_ZOOM_CLIENT_SECRET;
  delete env.MISSIONACCOUNTS_ZOOM_HOST_USER_ID;
  delete env.MISSIONACCOUNTS_ZOOM_MEETING_RULES_JSON;
  const result = spawnSync(process.execPath, ['src/server.mjs'], {
    cwd: packageDir,
    env,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Zoom client ID is required/i);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /local-test-placeholder/);
});

test('isolated production packaging cannot include the private Founder preview', async () => {
  const [dockerfile, dockerignore, railwaySource] = await Promise.all([
    readFile(dockerfilePath, 'utf8'),
    readFile(dockerignorePath, 'utf8'),
    readFile(railwayPath, 'utf8'),
  ]);
  assert.match(dockerfile, /FROM node:22-alpine/);
  assert.match(dockerfile, /public\/index\.production\.html/);
  assert.match(dockerfile, /public\/missionaccounts-canonical-adapter\.js/);
  assert.match(dockerfile, /public\/missionaccounts-stripe\.js/);
  assert.doesNotMatch(dockerfile, /COPY\s+(?:--[^\s]+\s+)*\.\s/);
  assert.doesNotMatch(dockerfile, /COPY[^\n]*public(?:\s|\/\s)/);
  assert.doesNotMatch(dockerfile, /public\/index\.html|canon-manifest|historical-import/);
  assert.match(dockerignore, /^\*$/m);
  assert.match(dockerignore, /!public\/index\.production\.html/);
  assert.match(dockerignore, /!public\/missionaccounts-canonical-adapter\.js/);
  assert.match(dockerignore, /!public\/missionaccounts-stripe\.js/);
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

test('canonical database reads paginate instead of silently truncating historical attendance', async () => {
  const store = Object.create(SupabaseRestStore.prototype);
  const calls = [];
  store.request = async (_path, options) => {
    calls.push(options.headers.range);
    return calls.length === 1
      ? Array.from({ length: 1_000 }, (_, index) => ({ id: index }))
      : Array.from({ length: 437 }, (_, index) => ({ id: 1_000 + index }));
  };
  const rows = await store.requestAll('attendance_event?select=id');
  assert.equal(rows.length, 1_437);
  assert.deepEqual(calls, ['0-999', '1000-1999']);
});

test('browser runtime requests the authenticated role-scoped bootstrap before any production unlock', async () => {
  const source = await readFile(path.join(packageDir, 'public/missionaccounts-runtime.js'), 'utf8');
  assert.match(source, /await auth\.request\('\/ui\/bootstrap'\)/);
  assert.match(source, /\['passed', 'not_passed', 'no_result'\]\.includes\(payload\.action\)/);
  assert.match(source, /await refreshCanonical\(\)/);
  assert.match(source, /state\.bootstrap\.scope === 'student'/);
  assert.match(source, /startsWith\('#\/me'\)/);
  assert.match(source, /const initialHydration = state\.bootstrap === null/);
  assert.match(source, /!hasAttendance[^]*'#\/me\/billing'/);
  assert.match(source, /openSecureStripeSetup/);
  assert.match(source, /state\.user\?\.role !== 'student'/);
  assert.match(source, /publishableKey: state\.payments\.publishableKey/);
  assert.match(source, /publishableKey: state\.payments\.publishableKey \? '\[configured\]' : null/);
  assert.match(source, /mutation\('\/me\/attendance-issues'/);
  assert.match(source, /Only the signed-in student can report an attendance issue/);
  assert.match(source, /const isReportRoute = String\(studentHash\)\.includes\('report=1'\)/);
  assert.match(source, /mutation\(`\/admin\/attendance-issues\/\$\{issueId\}\/review`/);
  assert.match(source, /Only Dr J can review attendance issues/);
  assert.match(source, /missionaccountsRuntime = state\.bootstrap \? 'authenticated-readonly'/);
  assert.match(source, /function updateRuntimeGate\(message\)/);
  assert.match(source, /updateRuntimeGate\(state\.error\)/);
  assert.doesNotMatch(source, /missionaccountsRuntime\s*=\s*['"]ready['"]/);
});

test('browser Stripe setup uses only Stripe-hosted Elements and contains no MissionMed card fields', async () => {
  const source = await readFile(stripeBrowserPath, 'utf8');
  assert.match(source, /https:\/\/js\.stripe\.com\/v3\//);
  assert.match(source, /elements\.create\('payment'/);
  assert.match(source, /stripe\.confirmSetup/);
  assert.match(source, /payment_method_data: \{ allow_redisplay: 'always' \}/);
  assert.match(source, /This does not turn on automatic billing/);
  assert.doesNotMatch(source, /type=["'](?:text|tel|number)["'][^>]*(?:card|cvc|exp)|name=["'](?:card|cvc|exp)/i);
});

test('public config exposes only a feature-gated Stripe Test-Mode publishable key', async () => {
  const baseConfig = {
    production: true,
    localAuth: false,
    basePath: '/missionaccounts/',
    wpBootstrapPath: '/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap',
    tokenRefreshSkewSeconds: 15,
    issuer: 'https://missionmedinstitute.com/wp-json/missionmed/v1/missionaccounts',
    audience: 'missionaccounts',
    jwtSecret: 'test-production-secret-that-is-at-least-32-bytes',
    jwksUrl: '',
    features: { autoBilling: true },
    stripeMode: 'test',
  };
  await withServer({
    config: { ...baseConfig, stripePublishableKey: 'pk_test_browser_safe_123' },
    store: new PreviewStore(),
  }, async base => {
    const response = await fetch(`${base}/missionaccounts/api/config`);
    const payload = await response.json();
    assert.deepEqual(payload.payments, {
      provider: 'stripe',
      setupEnabled: true,
      mode: 'test',
      publishableKey: 'pk_test_browser_safe_123',
    });
    assert.doesNotMatch(JSON.stringify(payload), /sk_(?:test|live)_/);
  });
  await withServer({
    config: { ...baseConfig, stripePublishableKey: 'pk_live_must_not_be_exposed' },
    store: new PreviewStore(),
  }, async base => {
    const payload = await (await fetch(`${base}/missionaccounts/api/config`)).json();
    assert.equal(payload.payments.setupEnabled, false);
    assert.equal(payload.payments.publishableKey, null);
  });
});

test('static CSP allowlists only the Stripe.js origins required by the secure payment element', async () => {
  await withServer({
    config: { production: false, localAuth: true, basePath: '/missionaccounts/', features: {} },
    store: new PreviewStore(),
  }, async base => {
    const response = await fetch(`${base}/missionaccounts/missionaccounts-stripe.js`);
    assert.equal(response.status, 200);
    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /script-src[^;]*https:\/\/js\.stripe\.com[^;]*https:\/\/\*\.js\.stripe\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/api\.stripe\.com/);
    assert.match(csp, /frame-src[^;]*https:\/\/hooks\.stripe\.com/);
    assert.doesNotMatch(csp, /https:\/\/\*\s/);
  });
});

test('same-origin WordPress gateway is default-off, targetless, bounded, and strips cookies from upstream requests', async () => {
  execFileSync('php', ['-l', routePath], { stdio: 'pipe' });
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /MISSIONACCOUNTS_ROUTE_ENABLED/);
  assert.match(source, /getenv\('MISSIONACCOUNTS_ROUTE_ENABLED'\)/);
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
