import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const serverPath = path.join(rootDir, 'missionmed-hq/server.mjs');
const mountDir = path.join(rootDir, 'missionmed-hq/public/mmc-private');
const requiredMountFiles = [
  'index.html',
  'src/styles.css',
  'src/mmc-data-adapters.js',
  'src/mmc-ownership-layer.js',
  'src/app.js',
];

const serverSource = readFileSync(serverPath, 'utf8');
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
  /readSessionFromRequest\(request\)/u,
  /isAuthorizedMmcPrivateUser\(session\.user\)/u,
  /X-MissionMed-Private-Mount/u,
  /X-Robots-Tag/u,
]) {
  assert.match(serverSource, requiredServerPattern, `Missing private mount guard pattern: ${requiredServerPattern}`);
}

const privateSessionAuthSource = extractBetween(serverSource, 'function isAuthorizedMmcPrivateSession', 'function resolveMmcPrivateStaticPath');
assert.doesNotMatch(privateSessionAuthSource, /isAuthorizedWordPressUser/u, 'MMC private route must not inherit the broad shared HQ role allowlist.');
assert.match(privateSessionAuthSource, /isAuthorizedMmcPrivateUser\(session\.user\)/u, 'MMC private route must use its route-specific authorization predicate.');

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
  /fetch\s*\(/iu,
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

for (const assetPattern of [
  /<link rel="stylesheet" href="\.\/src\/styles\.css\?v=016">/u,
  /<script src="\.\/src\/mmc-data-adapters\.js\?v=010"><\/script>/u,
  /<script src="\.\/src\/mmc-ownership-layer\.js\?v=016"><\/script>/u,
  /<script src="\.\/src\/app\.js\?v=016"><\/script>/u,
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
]) {
  assert.match(mountSources, new RegExp(escapeRegExp(approvedSurface)), `Missing approved MMC surface: ${approvedSurface}`);
}

assert.match(appSource, /productionDependencies:\s*false/u, 'MMC private mount must keep production dependencies disabled.');
assert.match(appSource, /apiCalls:\s*false/u, 'MMC private mount must keep API calls disabled.');
assert.match(appSource, /mentorIntelligenceLayer:\s*ownershipRuntime \? 'MMC-016 local Student Briefing Engine'/u, 'MMC private mount must expose MMC-016 mentor intelligence.');
assert.match(appSource, /window\.MMC_MENTOR_INTELLIGENCE/u, 'MMC private mount must expose the MMC-016 validation harness.');
assert.match(appSource, /profilePhotoSupport:\s*'local-internal-pilot-only'/u, 'MMC private mount must keep profile photo support local only.');
assert.match(appSource, /productionPhotoUpload:\s*false/u, 'MMC private mount must not enable production photo upload.');
assert.match(mountSources, /data-testid="profile-photo-upload"/u, 'MMC private mount must expose local admin photo upload control.');
assert.match(mountSources, /data-testid="briefing-profile-photo"/u, 'MMC private mount must render briefing profile photo surface.');
assert.match(mountSources, /externalRequestsEnabled: false/u, 'MMC private mount must keep external requests disabled.');
assert.match(mountSources, /externalWritesEnabled: false/u, 'MMC private mount must keep external writes disabled.');
assert.match(appSource, /window\.MMCApp/u, 'MMC private mount must expose the validation harness.');

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
