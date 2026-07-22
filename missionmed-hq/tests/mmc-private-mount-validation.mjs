import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { decodeCanonicalRequestPathname } from '../lib/mmc/trust/security.mjs';

const rootDir = process.cwd();
const serverPath = path.join(rootDir, 'missionmed-hq/server.mjs');
const securityPath = path.join(rootDir, 'missionmed-hq/lib/mmc/trust/security.mjs');
const mountDir = path.join(rootDir, 'missionmed-hq/public/mmc-private');
const requiredMountFiles = [
  'index.html',
  'src/styles.css',
  'src/mmc-data-adapters.js',
  'src/mmc-ownership-layer.js',
  'src/app.js',
];

const serverSource = readFileSync(serverPath, 'utf8');
const securitySource = readFileSync(securityPath, 'utf8');
const mountSources = requiredMountFiles
  .map((relativePath) => readFileSync(path.join(mountDir, relativePath), 'utf8'))
  .join('\n');
const indexSource = readFileSync(path.join(mountDir, 'index.html'), 'utf8');
const appSource = readFileSync(path.join(mountDir, 'src/app.js'), 'utf8');

for (const relativePath of requiredMountFiles) {
  assert.equal(statSync(path.join(mountDir, relativePath)).isFile(), true, `Missing MMC private mount file: ${relativePath}`);
}

for (const requiredServerPattern of [
  /const MMC_PRIVATE_ROUTE_PREFIX = '\/mmc-private';/u,
  /MMHQ_MMC_PRIVATE_ALLOWED_WP_ROLES/u,
  /MMHQ_MMC_PRIVATE_ALLOWED_WP_EMAILS/u,
  /function isMmcPrivatePath/u,
  /function isAuthorizedMmcPrivateUser/u,
  /function isAuthorizedMmcPrivateSession/u,
  /function handleMmcPrivateMount/u,
  /MMHQ_MMC_PERSISTENCE_ENABLED/u,
  /MMHQ_MMC_SUPABASE_URL/u,
  /MMHQ_MMC_SUPABASE_ANON_KEY/u,
  /MMHQ_MMC_SUPABASE_JWT_SECRET/u,
  /function handleMmcPersistenceRoute/u,
  /readSessionFromRequest\(request\)/u,
  /isAuthorizedMmcPrivateUser\(session\.user\)/u,
  /X-MissionMed-Private-Mount/u,
  /MMC_JSON_SECURITY_HEADERS/u,
  /mmc_historical_surface_sealed/u,
  /decodeCanonicalRequestPathname\(url\.pathname\)/u,
]) {
  assert.match(serverSource, requiredServerPattern, `Missing private mount guard pattern: ${requiredServerPattern}`);
}

for (const [encodedPath, decodedPath] of [
  ['/mmc-private/index.html', '/mmc-private/index.html'],
  ['/mmc-private%2Fsrc%2Fapp.js', '/mmc-private/src/app.js'],
  ['/students/Ada%20Lovelace', '/students/Ada Lovelace'],
]) {
  assert.equal(decodeCanonicalRequestPathname(encodedPath), decodedPath,
    `Canonical request path should decode safely: ${encodedPath}`);
}

for (const encodedPath of [
  '/x/%2e%2e%2fmmc-private/index.html',
  '/x/%2E%2E%2Fmmc-private/src/app.js',
  '/x/%2e%2e/mmc-private/index.html',
  '/x/%2e/mmc-private/index.html',
  '/x/%5c..%5cmmc-private/index.html',
  '/%2Fmmc-private/index.html',
  '/%2fmmc-private/src/app.js',
  '/x/%2f..%2fmmc-private/index.html',
  '/mmc-private/%00index.html',
  '/bad/%E0%A4%A',
]) {
  assert.throws(
    () => decodeCanonicalRequestPathname(encodedPath),
    (error) => error?.statusCode === 400
      && ['INVALID_REQUEST_PATH', 'NON_CANONICAL_REQUEST_PATH'].includes(error?.code),
    `Non-canonical or malformed path must fail closed before static routing: ${encodedPath}`,
  );
}

for (const strictHeaderPattern of [
  /'Cache-Control': 'no-store, max-age=0'/u,
  /'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"/u,
  /'Cross-Origin-Resource-Policy': 'same-origin'/u,
  /'Referrer-Policy': 'no-referrer'/u,
  /'X-Content-Type-Options': 'nosniff'/u,
  /'X-Frame-Options': 'DENY'/u,
  /'X-Robots-Tag': 'noindex, nofollow, noarchive'/u,
]) {
  assert.match(securitySource, strictHeaderPattern, `Missing strict MMC response header: ${strictHeaderPattern}`);
}

const privateSessionAuthSource = extractBetween(serverSource, 'function isAuthorizedMmcPrivateSession', 'async function handleMmcPrivateMount');
assert.doesNotMatch(privateSessionAuthSource, /isAuthorizedWordPressUser/u, 'MMC private route must not inherit the broad shared HQ role allowlist.');
assert.match(privateSessionAuthSource, /isAuthorizedMmcPrivateUser\(session\.user\)/u, 'MMC private route must use its route-specific authorization predicate.');

const privateMountHandlerSource = extractBetween(serverSource, 'async function handleMmcPrivateMount', 'function getMmcPersistenceConfig');
assert.match(privateMountHandlerSource, /sendJson\(response, 410/u,
  'The historical HTML surface must be sealed at the authenticated runtime mount.');
assert.match(privateMountHandlerSource, /\.\.\.MMC_JSON_SECURITY_HEADERS/u,
  'The sealed mount response must enforce the strict MMC JSON CSP and no-store header set.');
assert.doesNotMatch(privateMountHandlerSource, /serveStatic/u,
  'The runtime mount must not serve the inline-handler historical HTML surface.');

const privateRouteIndex = serverSource.indexOf('if (isMmcPrivatePath(pathname))');
const apiRouteIndex = serverSource.indexOf("if (pathname.startsWith('/api/'))");
const staticServeIndex = serverSource.indexOf('await serveStatic(response, pathname);');
assert.ok(privateRouteIndex > -1, 'Private MMC route guard is not registered.');
assert.ok(apiRouteIndex > -1, 'API route branch was not found.');
assert.ok(staticServeIndex > -1, 'Static serve branch was not found.');
assert.ok(privateRouteIndex < apiRouteIndex, 'Private MMC route must be evaluated before generic API/static routing.');
assert.ok(privateRouteIndex < staticServeIndex, 'Private MMC route must be evaluated before public static serving.');

const authStartSource = extractBetween(serverSource, "if (pathname === '/api/auth/start')", "if (pathname === '/api/bridge/health')");
assert.match(authStartSource, /resolveAuthSessionFinalRedirect\(searchParams\.get\('final'\), request\)/u, 'Auth start must sanitize final redirects.');
assert.match(authStartSource, /hqEntry\.searchParams\.set\('final', finalRedirect\)/u, 'Auth start must preserve sanitized final redirects.');

for (const forbiddenMountPattern of [
  /XMLHttpRequest\s*\(/iu,
  /navigator\.sendBeacon/iu,
  /WebSocket\s*\(/iu,
  /EventSource\s*\(/iu,
  /https?:\/\//iu,
  /service_role/iu,
  /wp-json/iu,
  /api\/scheduler/iu,
  /supabase/iu,
  /cloudflare/iu,
  /r2_/iu,
  /railway/iu,
  /kinsta/iu,
]) {
  assert.equal(forbiddenMountPattern.test(mountSources), false, `Private mount contains forbidden integration pattern: ${forbiddenMountPattern}`);
}

assert.match(mountSources, /\/api\/mmc\/persistence/u, 'Private mount must use only the same-origin MMC persistence API.');
assert.doesNotMatch(mountSources, /fetch\s*\(\s*['"]https?:/iu, 'Private mount must not fetch external URLs.');

for (const assetPattern of [
  /<link rel="stylesheet" href="\.\/src\/styles\.css\?v=100">/u,
  /<script src="\.\/src\/mmc-data-adapters\.js\?v=010"><\/script>/u,
  /<script src="\.\/src\/mmc-ownership-layer\.js\?v=100"><\/script>/u,
  /<script src="\.\/src\/app\.js\?v=100"><\/script>/u,
]) {
  assert.match(indexSource, assetPattern, `Private mount asset reference must remain local: ${assetPattern}`);
}

for (const approvedSurface of [
  'Mentor Memory',
  'Meeting Intelligence',
  'Student Intelligence Profile',
  'Student Briefing Engine',
  'local MMC profile photo',
  'mentor/admin review only for now',
  'future-supported, not enabled publicly',
  'WHO IS THIS PERSON?',
  'OPEN LOOPS',
  'PROMISES MADE',
  'LAST ADVICE',
  'RELATIONSHIP CONTEXT',
  'TIMELINE SUMMARY',
  'NEXT BEST MOVE',
  'Student View Preview',
  'Call Prep',
  'Session Command',
  'Actions',
  'Post-Session Capture',
  'Private Alpha Control',
  'Resume Session',
  'Export Snapshot',
]) {
  assert.match(mountSources, new RegExp(escapeRegExp(approvedSurface)), `Missing approved MMC surface: ${approvedSurface}`);
}

assert.match(appSource, /productionDependencies:\s*false/u, 'MMC private mount must keep production dependencies disabled.');
assert.match(mountSources, /productionIntegration:\s*false/u, 'Historical MMC UI must not claim production integration.');
assert.match(mountSources, /schemaPersistenceEnabled:\s*false/u, 'Historical MMC UI must not claim whole-state persistence readiness.');
assert.match(mountSources, /writeMode:\s*"sealed"/u, 'Historical MMC UI must expose the sealed v1 write boundary.');
assert.match(mountSources, /TRUST_KERNEL_UI_REVIEW_ONLY/u, 'Historical MMC UI must expose its current review-only status.');
assert.doesNotMatch(readFileSync(path.join(mountDir, 'src/mmc-ownership-layer.js'), 'utf8'), /persistenceFetchOptions\("POST"/u,
  'Historical ownership runtime must not submit a v1 whole-state POST.');
assert.match(appSource, /apiCalls:\s*ownershipRuntime \? 'same-origin \/api\/mmc\/persistence \+ \/api\/mmc\/coaching-pipeline only'/u, 'Preserved historical archaeology must document its former same-origin MMC boundary.');
assert.match(appSource, /data-testid="pipeline-admin-panel"/u, 'MMC private mount must expose the admin-only Pipeline Admin panel.');
assert.match(appSource, /data-testid="pipeline-run-analysis"/u, 'MMC private mount must expose the real analysis workflow control.');
assert.match(appSource, /\/analysis-runs\/analyze/u, 'MMC private mount must call the same-origin real analysis route.');
assert.match(appSource, /mentorIntelligenceLayer:\s*ownershipRuntime \? 'MMC-016 Student Briefing Engine backed by MMC-021 persistence'/u, 'MMC private mount must expose MMC-016 mentor intelligence backed by MMC-021 persistence.');
assert.match(appSource, /window\.MMC_MENTOR_INTELLIGENCE/u, 'MMC private mount must expose the MMC-016 validation harness.');
assert.match(appSource, /profilePhotoSupport:\s*'local-internal-pilot-only'/u, 'MMC private mount must keep profile photo support local only.');
assert.match(appSource, /productionPhotoUpload:\s*false/u, 'MMC private mount must not enable production photo upload.');
assert.match(mountSources, /data-testid="profile-photo-upload"/u, 'MMC private mount must expose local admin photo upload control.');
assert.match(mountSources, /data-testid="briefing-profile-photo"/u, 'MMC private mount must render briefing profile photo surface.');
assert.match(mountSources, /externalRequestsEnabled: false/u, 'MMC private mount must keep external requests disabled.');
assert.match(mountSources, /externalWritesEnabled: false/u, 'MMC private mount must keep external writes disabled.');
assert.match(appSource, /window\.MMCApp/u, 'MMC private mount must expose the validation harness.');
assert.match(appSource, /window\.MMC_PRIVATE_ALPHA/u, 'MMC private mount must expose the private alpha launch harness.');
assert.match(appSource, /validatePrivateAlphaLaunch/u, 'MMC private mount must expose private alpha launch validation.');
assert.match(appSource, /exportPilotSnapshot/u, 'MMC private mount must expose local snapshot export.');
assert.match(appSource, /recoverSession/u, 'MMC private mount must expose session recovery.');

const discoveredFiles = listFiles(mountDir).map((file) => path.relative(mountDir, file).replaceAll(path.sep, '/')).sort();
assert.deepEqual(discoveredFiles, requiredMountFiles.sort(), 'MMC private mount should contain only the expected packaged alpha files.');

console.log('MMC private mount validation passed');

function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.ok(start > -1 && end > start, `Could not extract source block between ${startNeedle} and ${endNeedle}`);
  return source.slice(start, end);
}

function listFiles(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const absolutePath = path.join(directory, name);
    const details = statSync(absolutePath);
    if (details.isDirectory()) {
      entries.push(...listFiles(absolutePath));
    } else {
      entries.push(absolutePath);
    }
  }
  return entries;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
