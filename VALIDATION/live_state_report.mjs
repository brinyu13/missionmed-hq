#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = new URL('..', import.meta.url).pathname.replace(/\/VALIDATION\/?$/u, '');
const DEFAULT_CDN_BASE = 'https://cdn.missionmedinstitute.com';
const DEFAULT_WP_BASE = 'https://missionmedinstitute.com';
const DEFAULT_RAILWAY_BASE = 'https://missionmed-hq-production.up.railway.app';

const DEFAULT_STALE_MARKERS = [
  'plgndqcplokwiuimwhzh',
  'supabase.auth.signUp',
  'service_role',
];

const SELECTED_HEADERS = [
  'cache-control',
  'etag',
  'last-modified',
  'age',
  'cf-cache-status',
  'cf-ray',
  'content-type',
  'content-length',
  'server',
  'via',
  'x-cache',
  'x-missionmed-route',
  'x-missionmed-stat-intercept',
  'x-missionmed-stat-variant',
  'x-missionmed-upstream-status',
  'x-missionmed-upstream-transport',
  'x-missionmed-drills-intercept',
  'x-missionmed-drills-mode',
  'x-missionmed-drills-signal',
  'x-missionmed-drills-v3',
  'x-missionmed-arena-auth-mode',
  'x-missionmed-arena-auth-config',
  'x-kinsta-cache',
  'x-cache-status',
];

const ROUTES = [
  {
    id: 'arena',
    route: '/arena',
    source: 'LIVE/arena.html',
    cdnKey: 'html-system/LIVE/arena.html',
    wpPaths: ['/arena'],
    requiredMarkers: ['SYSTEM: ARENA', 'window.MMOS', 'MMOS.registerMode', '/api/auth/exchange', '/api/auth/bootstrap'],
    note: 'Arena wrapper injects WordPress auth config, so wrapper SHA is expected to differ from CDN/local even when current.',
  },
  {
    id: 'stat',
    route: '/stat',
    source: 'LIVE/stat.html',
    cdnKey: 'html-system/LIVE/stat.html',
    wpPaths: ['/stat'],
    requiredMarkers: ['SYSTEM: STAT', 'window.MMOS', 'MMOS.registerMode', '/api/auth/exchange', '/api/auth/bootstrap'],
    note: 'STAT wrapper should proxy the CDN artifact without HTML mutation.',
  },
  {
    id: 'stat-v3',
    route: '/stat-v3',
    source: 'LIVE/stat_v3.html',
    cdnKey: 'html-system/LIVE/stat_v3.html',
    wpPaths: ['/stat-v3'],
    requiredMarkers: ['STAT V3', 'Match Settings', 'Find Opponent', 'Ready Check', 'Legacy STAT'],
    note: 'STAT V3 is a separate side-route artifact and should not replace legacy /stat.',
  },
  {
    id: 'daily',
    route: '/daily',
    source: 'LIVE/daily.html',
    cdnKey: 'html-system/LIVE/daily.html',
    wpPaths: ['/daily', '/drills?entry=daily_rounds'],
    requiredMarkers: ['SYSTEM: MODE_DAILYROUNDS', 'mm_selected_drill', '/drills?video_id=', '/api/auth/exchange', '/api/auth/bootstrap'],
    note: 'Daily can be reached directly at /daily or through the /drills?entry=daily_rounds menu alias.',
  },
  {
    id: 'drills',
    route: '/drills',
    source: 'LIVE/drills.html',
    cdnKey: 'html-system/LIVE/drills.html',
    wpPaths: ['/drills'],
    requiredMarkers: ['SYSTEM: DRILLS', 'window.MMOS', 'MMOS.registerMode', 'No valid drill contract', 'query.video_id'],
    note: 'Direct /drills without a contract is allowed to show the contract guard.',
  },
  {
    id: 'daily-drills-v3',
    route: '/daily-drills-v3',
    source: 'LIVE/daily_drills_v3.html',
    cdnKey: 'html-system/LIVE/daily_drills_v3.html',
    wpPaths: ['/daily-drills-v3'],
    requiredMarkers: ['daily_drills_v3', 'Pick Your Subject', 'Pick a Video Drill', 'Summary + Feedback'],
    note: 'Daily/Drills V3 is a separate side-by-side artifact and should not replace legacy /daily or /drills.',
  },
];

const OPTIONAL_ROUTES = [
  {
    id: 'hq',
    route: '/hq',
    source: 'missionmed-hq/public/index.html',
    urlBase: 'railway',
    path: '/hq',
    expectedStatuses: [200, 302, 401],
    note: 'HQ is Railway-hosted and auth-gated. This worktree does not contain missionmed-hq/public/index.html.',
  },
  {
    id: 'usce-request',
    route: '/usce.html',
    source: 'missionmed-hq/public/usce.html',
    urlBase: 'railway',
    path: '/usce.html',
    expectedStatuses: [200],
    note: 'USCE request/admin/tracker HTML is Railway static runtime, not R2/CDN LIVE manifest runtime.',
  },
  {
    id: 'usce-admin',
    route: '/usce-admin.html',
    source: 'missionmed-hq/public/usce-admin.html',
    urlBase: 'railway',
    path: '/usce-admin.html',
    expectedStatuses: [200],
    note: 'USCE admin shell is inspected for route truth only; no auth or data mutation is performed.',
  },
  {
    id: 'usce-student',
    route: '/usce-student.html',
    source: 'missionmed-hq/public/usce-student.html',
    urlBase: 'railway',
    path: '/usce-student.html',
    expectedStatuses: [200],
    note: 'USCE student shell is inspected for route truth only; no portal token flow is exercised.',
  },
];

function parseArgs(argv) {
  const args = {
    manifest: '_SYSTEM/DEPLOY_MANIFEST.json',
    liveDir: 'LIVE',
    cdnBase: DEFAULT_CDN_BASE,
    wpBase: DEFAULT_WP_BASE,
    railwayBase: DEFAULT_RAILWAY_BASE,
    output: '',
    jsonOutput: '',
    timeoutMs: 30000,
    strict: false,
    staleMarkers: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = requireValue(argv, ++i, arg);
    else if (arg === '--live-dir') args.liveDir = requireValue(argv, ++i, arg);
    else if (arg === '--cdn-base') args.cdnBase = requireValue(argv, ++i, arg).replace(/\/+$/u, '');
    else if (arg === '--wp-base') args.wpBase = requireValue(argv, ++i, arg).replace(/\/+$/u, '');
    else if (arg === '--railway-base') args.railwayBase = requireValue(argv, ++i, arg).replace(/\/+$/u, '');
    else if (arg === '--output') args.output = requireValue(argv, ++i, arg);
    else if (arg === '--json-output') args.jsonOutput = requireValue(argv, ++i, arg);
    else if (arg === '--timeout-ms') args.timeoutMs = Number.parseInt(requireValue(argv, ++i, arg), 10);
    else if (arg === '--stale-marker') args.staleMarkers.push(requireValue(argv, ++i, arg));
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be an integer >= 1000');
  }

  return args;
}

function requireValue(argv, index, option) {
  if (index >= argv.length || argv[index].startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return argv[index];
}

function printHelp() {
  console.log(`Usage: bash VALIDATION/validate_live_state.sh [options]

Options:
  --output PATH        Write a markdown report.
  --json-output PATH   Write machine-readable JSON evidence.
  --strict             Exit non-zero unless every canonical route is LIVE CURRENT.
  --stale-marker TEXT  Add a route body marker that must be absent.
  --timeout-ms N       Per-request timeout in milliseconds. Default: 30000.
  --cdn-base URL       Default: ${DEFAULT_CDN_BASE}
  --wp-base URL        Default: ${DEFAULT_WP_BASE}
  --railway-base URL   Default: ${DEFAULT_RAILWAY_BASE}
`);
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    status: result.status,
  };
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function addCacheBust(url) {
  const marker = `mm_live_state=${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return url.includes('?') ? `${url}&${marker}` : `${url}?${marker}`;
}

function selectedHeaders(headers) {
  const out = {};
  for (const key of SELECTED_HEADERS) {
    const value = headers.get(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

async function fetchEvidence(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
        'User-Agent': 'MissionMed-LiveState-Validator/1.0',
      },
    });
    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    return {
      ok: true,
      url,
      finalUrl: response.url,
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Date.now() - started,
      headers: selectedHeaders(response.headers),
      sha256: sha256(body),
      bytes: body.byteLength,
      text: body.toString('utf8'),
    };
  } catch (error) {
    return {
      ok: false,
      url,
      finalUrl: '',
      status: 0,
      statusText: '',
      elapsedMs: Date.now() - started,
      headers: {},
      sha256: '',
      bytes: 0,
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function markerSummary(text, markers) {
  const missing = [];
  const present = [];
  for (const marker of markers) {
    if (!marker) continue;
    if (text.includes(marker)) present.push(marker);
    else missing.push(marker);
  }
  return { present, missing };
}

function staleSummary(text, markers) {
  const found = [];
  for (const marker of markers) {
    if (!marker) continue;
    if (text.includes(marker)) found.push(marker);
  }
  return found;
}

function extractVersionBlock(text) {
  const firstLines = text.split(/\r?\n/u).slice(0, 80).join('\n');
  const system = firstMatch(firstLines, /SYSTEM:\s*([^\n]+)/u);
  const version = firstMatch(firstLines, /VERSION:\s*([^\n]+)/u);
  const change = firstMatch(firstLines, /CHANGE:\s*([^\n]+)/u);
  return {
    system: system ? `SYSTEM: ${system}` : '',
    version: version ? `VERSION: ${version}` : '',
    change: change ? `CHANGE: ${change}` : '',
  };
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? String(match[1]).trim() : '';
}

function cacheLooksBrowserSticky(headers) {
  const cc = String(headers['cache-control'] || '').toLowerCase();
  if (!cc) return true;
  if (cc.includes('no-store') || cc.includes('no-cache') || cc.includes('max-age=0')) return false;
  return /max-age=\d+/u.test(cc) || cc.includes('public') || cc.includes('immutable');
}

function classifyCanonicalRoute(route, local, cdnNormal, cdnBusted, wpResults, staleMarkers) {
  if (!local.exists) {
    return { classification: 'UNKNOWN', reason: `Local source missing: ${route.source}` };
  }
  if (!cdnNormal.ok || cdnNormal.status !== 200) {
    return { classification: 'UNKNOWN', reason: `CDN normal request failed with status ${cdnNormal.status || 'ERR'}` };
  }
  if (!cdnBusted.ok || cdnBusted.status !== 200) {
    return { classification: 'UNKNOWN', reason: `CDN cache-busted request failed with status ${cdnBusted.status || 'ERR'}` };
  }

  const normalMatches = cdnNormal.sha256 === local.sha256;
  const bustedMatches = cdnBusted.sha256 === local.sha256;
  const normalVsBustedDiffers = cdnNormal.sha256 !== cdnBusted.sha256;
  const cdnStaleByCache = !normalMatches && bustedMatches;
  const sourceDeployMismatch = !normalMatches && !bustedMatches;

  if (cdnStaleByCache) {
    return { classification: 'DEPLOYED BUT CDN STALE', reason: 'Cache-busted CDN body matches local SHA, normal CDN body does not.' };
  }
  if (sourceDeployMismatch) {
    const detail = normalVsBustedDiffers ? 'Normal and cache-busted CDN bodies also differ.' : 'Normal and cache-busted CDN bodies match each other but not local.';
    return { classification: 'SOURCE/DEPLOY MISMATCH', reason: `${detail} Local SHA ${local.sha256} is not the public CDN SHA.` };
  }

  const wpProblems = [];
  let wpCurrent = true;
  let browserSticky = false;
  for (const wp of wpResults) {
    if (!wp.normal.ok || wp.normal.status !== 200) {
      wpCurrent = false;
      wpProblems.push(`${wp.path} normal status ${wp.normal.status || 'ERR'}`);
      continue;
    }
    if (!wp.busted.ok || wp.busted.status !== 200) {
      wpCurrent = false;
      wpProblems.push(`${wp.path} cache-busted status ${wp.busted.status || 'ERR'}`);
      continue;
    }
    if (wp.normalMarkers.missing.length > 0) {
      wpCurrent = false;
      wpProblems.push(`${wp.path} missing marker(s): ${wp.normalMarkers.missing.join(', ')}`);
    }
    if (wp.normalStaleMarkers.length > 0) {
      wpCurrent = false;
      wpProblems.push(`${wp.path} contains stale/forbidden marker(s): ${wp.normalStaleMarkers.join(', ')}`);
    }
    if (cacheLooksBrowserSticky(wp.normal.headers)) {
      browserSticky = true;
    }
  }

  const cdnStaleMarkers = staleSummary(cdnNormal.text, staleMarkers);
  if (cdnStaleMarkers.length > 0) {
    return { classification: 'UNKNOWN', reason: `CDN contains stale/forbidden marker(s): ${cdnStaleMarkers.join(', ')}` };
  }
  if (!wpCurrent) {
    return { classification: 'CDN CURRENT BUT WORDPRESS STALE', reason: wpProblems.join('; ') };
  }
  if (browserSticky || cacheLooksBrowserSticky(cdnNormal.headers)) {
    return { classification: 'WORDPRESS CURRENT BUT BROWSER LIKELY STALE', reason: 'Current content is present, but HTML cache headers look browser-cacheable.' };
  }
  return { classification: 'LIVE CURRENT', reason: 'Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.' };
}

async function inspectCanonicalRoute(route, args, staleMarkers) {
  const sourcePath = join(ROOT_DIR, route.source);
  const local = {
    path: route.source,
    absolutePath: sourcePath,
    exists: existsSync(sourcePath),
    sha256: '',
    bytes: 0,
    markers: {},
  };

  if (local.exists) {
    const content = await readFile(sourcePath);
    local.sha256 = sha256(content);
    local.bytes = content.byteLength;
    local.markers = extractVersionBlock(content.toString('utf8'));
  }

  const cdnUrl = `${args.cdnBase}/${route.cdnKey}`;
  const cdnNormal = await fetchEvidence(cdnUrl, args.timeoutMs);
  const cdnBusted = await fetchEvidence(addCacheBust(cdnUrl), args.timeoutMs);
  const routeMarkers = Array.from(new Set([
    ...route.requiredMarkers,
    local.markers.system,
    local.markers.version,
  ].filter(Boolean)));

  const wpResults = [];
  for (const path of route.wpPaths) {
    const url = `${args.wpBase}${path}`;
    const normal = await fetchEvidence(url, args.timeoutMs);
    const busted = await fetchEvidence(addCacheBust(url), args.timeoutMs);
    wpResults.push({
      path,
      url,
      normal,
      busted,
      normalMarkers: markerSummary(normal.text, routeMarkers),
      bustedMarkers: markerSummary(busted.text, routeMarkers),
      normalStaleMarkers: staleSummary(normal.text, staleMarkers),
      bustedStaleMarkers: staleSummary(busted.text, staleMarkers),
    });
  }

  const classification = classifyCanonicalRoute(route, local, cdnNormal, cdnBusted, wpResults, staleMarkers);
  return {
    ...route,
    local,
    cdn: {
      url: cdnUrl,
      normal: summarizeFetch(cdnNormal),
      busted: summarizeFetch(cdnBusted),
      normalMarkers: markerSummary(cdnNormal.text, routeMarkers),
      bustedMarkers: markerSummary(cdnBusted.text, routeMarkers),
      normalStaleMarkers: staleSummary(cdnNormal.text, staleMarkers),
      bustedStaleMarkers: staleSummary(cdnBusted.text, staleMarkers),
    },
    wp: wpResults.map((item) => ({
      path: item.path,
      url: item.url,
      normal: summarizeFetch(item.normal),
      busted: summarizeFetch(item.busted),
      normalMarkers: item.normalMarkers,
      bustedMarkers: item.bustedMarkers,
      normalStaleMarkers: item.normalStaleMarkers,
      bustedStaleMarkers: item.bustedStaleMarkers,
    })),
    classification,
  };
}

async function inspectOptionalRoute(route, args) {
  const sourcePath = join(ROOT_DIR, route.source);
  const local = {
    path: route.source,
    exists: existsSync(sourcePath),
    sha256: '',
    bytes: 0,
    markers: {},
  };
  if (local.exists) {
    const content = await readFile(sourcePath);
    local.sha256 = sha256(content);
    local.bytes = content.byteLength;
    local.markers = extractVersionBlock(content.toString('utf8'));
  }

  const base = route.urlBase === 'railway' ? args.railwayBase : args.wpBase;
  const url = `${base}${route.path}`;
  const normal = await fetchEvidence(url, args.timeoutMs);
  const statusExpected = route.expectedStatuses.includes(normal.status);
  const shaMatches = local.exists && normal.status === 200 && normal.sha256 === local.sha256;
  const classification = !local.exists
    ? { classification: 'UNKNOWN', reason: `Local route source is absent: ${route.source}` }
    : !normal.ok
      ? { classification: 'UNKNOWN', reason: `Request failed: ${normal.error || 'unknown error'}` }
      : !statusExpected
        ? { classification: 'UNKNOWN', reason: `Unexpected status ${normal.status}; expected ${route.expectedStatuses.join('/')}` }
        : normal.status === 200 && !shaMatches
          ? { classification: 'SOURCE/DEPLOY MISMATCH', reason: 'Railway/static response SHA does not match local source SHA.' }
          : { classification: 'LIVE CURRENT', reason: 'Route responded with expected status and local source evidence is present.' };

  return {
    ...route,
    local,
    remote: summarizeFetch(normal),
    classification,
  };
}

function summarizeFetch(fetchResult) {
  return {
    ok: fetchResult.ok,
    url: fetchResult.url,
    finalUrl: fetchResult.finalUrl,
    status: fetchResult.status,
    statusText: fetchResult.statusText,
    elapsedMs: fetchResult.elapsedMs,
    headers: fetchResult.headers,
    sha256: fetchResult.sha256,
    bytes: fetchResult.bytes,
    error: fetchResult.error || '',
  };
}

function manifestTruth(manifestPath) {
  const absolute = join(ROOT_DIR, manifestPath);
  return {
    path: manifestPath,
    exists: existsSync(absolute),
  };
}

function renderHeaders(headers) {
  const entries = Object.entries(headers || {});
  if (entries.length === 0) return 'none observed';
  return entries.map(([key, value]) => `${key}: ${value}`).join('; ');
}

function renderMarkdown(report) {
  const strictHint = report.strictPassed ? 'PASS' : 'ATTENTION REQUIRED';
  const lines = [];
  lines.push('# MR-CACHE-002 Live State Evidence');
  lines.push('');
  lines.push(`Generated UTC: ${report.generatedAt}`);
  lines.push(`Overall live-state result: ${strictHint}`);
  lines.push(`Branch: ${report.git.branch || 'UNKNOWN'}`);
  lines.push(`Commit: ${report.git.commit || 'UNKNOWN'}`);
  lines.push(`Working tree status: ${report.git.statusShort || 'clean'}`);
  lines.push('');
  lines.push('## Route Classification');
  lines.push('');
  lines.push('| Route | Local SHA | CDN normal | CDN cache-busted | WordPress/Railway | Classification | Reason |');
  lines.push('|---|---|---:|---:|---:|---|---|');
  for (const route of report.routes) {
    const wpStatuses = route.wp.map((wp) => `${wp.path} ${wp.normal.status || 'ERR'}`).join(', ');
    lines.push(`| ${route.route} | ${shortSha(route.local.sha256)} | ${route.cdn.normal.status || 'ERR'} ${shortSha(route.cdn.normal.sha256)} | ${route.cdn.busted.status || 'ERR'} ${shortSha(route.cdn.busted.sha256)} | ${wpStatuses || 'n/a'} | ${route.classification.classification} | ${escapeTable(route.classification.reason)} |`);
  }
  for (const route of report.optionalRoutes) {
    lines.push(`| ${route.route} | ${shortSha(route.local.sha256)} | n/a | n/a | ${route.remote.status || 'ERR'} ${shortSha(route.remote.sha256)} | ${route.classification.classification} | ${escapeTable(route.classification.reason)} |`);
  }
  lines.push('');
  lines.push('## Canonical Runtime Details');
  for (const route of report.routes) {
    lines.push('');
    lines.push(`### ${route.id}`);
    lines.push(`- Local source: ${route.source}`);
    lines.push(`- Local SHA256: ${route.local.sha256 || 'missing'}`);
    lines.push(`- Local bytes: ${route.local.bytes}`);
    lines.push(`- Version marker: ${route.local.markers.version || 'not found'}`);
    lines.push(`- CDN URL: ${route.cdn.url}`);
    lines.push(`- CDN normal: status=${route.cdn.normal.status || 'ERR'} sha=${route.cdn.normal.sha256 || 'n/a'} bytes=${route.cdn.normal.bytes} headers=(${renderHeaders(route.cdn.normal.headers)})`);
    lines.push(`- CDN cache-busted: status=${route.cdn.busted.status || 'ERR'} sha=${route.cdn.busted.sha256 || 'n/a'} bytes=${route.cdn.busted.bytes} headers=(${renderHeaders(route.cdn.busted.headers)})`);
    if (route.cdn.normalMarkers.missing.length > 0) {
      lines.push(`- CDN missing expected marker(s): ${route.cdn.normalMarkers.missing.join(', ')}`);
    }
    if (route.cdn.normalStaleMarkers.length > 0) {
      lines.push(`- CDN contains stale/forbidden marker(s): ${route.cdn.normalStaleMarkers.join(', ')}`);
    }
    for (const wp of route.wp) {
      lines.push(`- Wrapper ${wp.path}: normal status=${wp.normal.status || 'ERR'} sha=${wp.normal.sha256 || 'n/a'} bytes=${wp.normal.bytes} headers=(${renderHeaders(wp.normal.headers)})`);
      lines.push(`- Wrapper ${wp.path} cache-busted: status=${wp.busted.status || 'ERR'} sha=${wp.busted.sha256 || 'n/a'} bytes=${wp.busted.bytes}`);
      if (wp.normalMarkers.missing.length > 0) {
        lines.push(`- Wrapper ${wp.path} missing expected marker(s): ${wp.normalMarkers.missing.join(', ')}`);
      }
      if (wp.normalStaleMarkers.length > 0) {
        lines.push(`- Wrapper ${wp.path} contains stale/forbidden marker(s): ${wp.normalStaleMarkers.join(', ')}`);
      }
    }
    lines.push(`- Classification: ${route.classification.classification}`);
    lines.push(`- Reason: ${route.classification.reason}`);
    lines.push(`- Note: ${route.note}`);
  }
  lines.push('');
  lines.push('## Optional Route Details');
  for (const route of report.optionalRoutes) {
    lines.push('');
    lines.push(`### ${route.id}`);
    lines.push(`- Local source: ${route.source}`);
    lines.push(`- Local exists: ${route.local.exists ? 'yes' : 'no'}`);
    lines.push(`- Local SHA256: ${route.local.sha256 || 'missing'}`);
    lines.push(`- Remote URL: ${route.remote.url}`);
    lines.push(`- Remote status: ${route.remote.status || 'ERR'}`);
    lines.push(`- Remote SHA256: ${route.remote.sha256 || 'n/a'}`);
    lines.push(`- Headers: ${renderHeaders(route.remote.headers)}`);
    lines.push(`- Classification: ${route.classification.classification}`);
    lines.push(`- Reason: ${route.classification.reason}`);
    lines.push(`- Note: ${route.note}`);
  }
  lines.push('');
  lines.push('## Cache Layer Interpretation');
  lines.push('');
  lines.push('- Local source current: determined by local file existence and SHA256.');
  lines.push('- Git source current: determined by current branch, commit, and dirty status.');
  lines.push('- Deployed public object: inferred from public CDN body SHA at the canonical LIVE URL.');
  lines.push('- CDN stale: detected when cache-busted CDN content matches local but normal CDN content does not.');
  lines.push('- Source/deploy mismatch: detected when neither normal nor cache-busted CDN content matches local.');
  lines.push('- WordPress stale: detected when CDN is current but wrapper route misses expected markers or stale markers are present.');
  lines.push('- Browser likely stale: detected when content is current but HTML cache headers are browser-cacheable.');
  lines.push('- Signed R2 object state: not checked by this script because it does not read or print R2 credentials.');
  lines.push('');
  lines.push('## Future Verification Command');
  lines.push('');
  lines.push('```bash');
  lines.push('bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_AFTER_DEPLOY.md');
  lines.push('```');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function shortSha(value) {
  return value ? value.slice(0, 12) : 'n/a';
}

function escapeTable(value) {
  return String(value || '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const staleMarkers = Array.from(new Set([...DEFAULT_STALE_MARKERS, ...args.staleMarkers]));
  const gitInfo = {
    branch: git(['branch', '--show-current']).stdout,
    commit: git(['rev-parse', 'HEAD']).stdout,
    commitSummary: git(['log', '-1', '--oneline', '--decorate']).stdout,
    statusShort: git(['status', '--short']).stdout,
    diffNameStatus: git(['diff', '--name-status']).stdout,
  };

  const manifest = manifestTruth(args.manifest);
  const routes = [];
  for (const route of ROUTES) {
    routes.push(await inspectCanonicalRoute(route, args, staleMarkers));
  }

  const optionalRoutes = [];
  for (const route of OPTIONAL_ROUTES) {
    optionalRoutes.push(await inspectOptionalRoute(route, args));
  }

  const strictPassed = routes.every((route) => route.classification.classification === 'LIVE CURRENT');
  const report = {
    generatedAt: new Date().toISOString(),
    git: gitInfo,
    manifest,
    config: {
      cdnBase: args.cdnBase,
      wpBase: args.wpBase,
      railwayBase: args.railwayBase,
      timeoutMs: args.timeoutMs,
      strict: args.strict,
      staleMarkers,
    },
    routes,
    optionalRoutes,
    strictPassed,
  };

  const markdown = renderMarkdown(report);
  if (args.output) {
    const outputPath = join(ROOT_DIR, args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, 'utf8');
  } else {
    process.stdout.write(markdown);
  }

  if (args.jsonOutput) {
    const jsonPath = join(ROOT_DIR, args.jsonOutput);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (args.strict && !strictPassed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`live_state_report failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
