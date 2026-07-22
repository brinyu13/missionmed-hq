import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FixtureResponseError,
  buildFixtureEnvelope,
  createFixtureStore,
  executeFixtureCommand,
  fixtureErrorEnvelope,
  fixtureScenarioFromRequest,
  normalizeScenario,
} from './fixture-data.mjs';
import { MMC_CAM_UI_SECURITY_HEADERS } from '../../../lib/mmc/trust/security.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CAM_ASSET_ROOT = path.resolve(HERE, '../../../public/mmc-private/src/cam');
export const CAM_REVIEW_ROUTE = '/mmc-private/';

const SECURITY_HEADERS = Object.freeze({
  ...MMC_CAM_UI_SECURITY_HEADERS,
  'Cross-Origin-Opener-Policy': 'same-origin',
  Pragma: 'no-cache',
});

const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

export async function startReviewServer({ scenario = 'default', assetRoot = CAM_ASSET_ROOT } = {}) {
  const normalizedRoot = await fs.realpath(path.resolve(assetRoot));
  const indexPath = path.join(normalizedRoot, 'index.html');
  const canonicalIndexPath = await fs.realpath(indexPath);
  await assertReadableFile(canonicalIndexPath, 'CAM review index');
  if (!canonicalIndexPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error('CAM review index resolves outside the isolated asset root.');
  }

  const store = createFixtureStore({ scenario });
  const scenarioStores = new Map([[scenario, store]]);
  const getStore = (selectedScenario) => {
    if (!scenarioStores.has(selectedScenario)) {
      scenarioStores.set(selectedScenario, createFixtureStore({ scenario: selectedScenario }));
    }
    return scenarioStores.get(selectedScenario);
  };
  const sockets = new Set();
  let baseUrl = '';

  const server = http.createServer(async (request, response) => {
    try {
      await handleRequest({ request, response, normalizedRoot, indexPath: canonicalIndexPath, getStore, fallbackScenario: scenario, baseUrl });
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const statusCode = Number.isSafeInteger(error?.statusCode) ? error.statusCode : 500;
      const selected = safeScenario(request, scenario);
      sendJson(response, statusCode, fixtureErrorEnvelope(error, selected));
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 1_000;
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server, sockets);
    throw new Error('Review server did not bind to an isolated TCP port.');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  return Object.freeze({
    baseUrl,
    assetRoot: normalizedRoot,
    store,
    storeForScenario: getStore,
    url(route = CAM_REVIEW_ROUTE, selectedScenario = scenario) {
      const url = new URL(route, baseUrl);
      if (selectedScenario && selectedScenario !== 'default') url.searchParams.set('fixture', selectedScenario);
      return url.href;
    },
    async close() {
      await closeServer(server, sockets);
    },
  });
}

export async function withReviewServer(options, callback) {
  const review = await startReviewServer(options);
  try {
    return await callback(review);
  } finally {
    await review.close();
  }
}

async function handleRequest({ request, response, normalizedRoot, indexPath, getStore, fallbackScenario, baseUrl }) {
  rejectUnsafeRawTarget(request.url);
  const url = new URL(request.url || '/', baseUrl || 'http://127.0.0.1');
  const scenario = fixtureScenarioFromRequest(request, url, fallbackScenario);
  const store = getStore(scenario);
  store.requests.push({ method: String(request.method || 'GET').toUpperCase(), pathname: url.pathname, scenario });
  if (store.requests.length > 5_000) store.requests.shift();

  if (url.pathname.startsWith('/api/mmc/v2/mentor/')) {
    await handleFixtureApi({ request, response, url, scenario, store, baseUrl });
    return;
  }
  if (url.pathname === '/api/auth/session') {
    if (String(request.method || 'GET').toUpperCase() !== 'GET') {
      throw new FixtureResponseError(405, 'METHOD_NOT_ALLOWED', 'The fixture session bootstrap is read only.');
    }
    sendJson(response, 200, fixtureSessionPayload());
    return;
  }

  const method = String(request.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) {
    throw new FixtureResponseError(405, 'METHOD_NOT_ALLOWED', 'This review asset route is read only.');
  }

  if (isBlockedHistoricalAsset(url.pathname)) {
    throw new FixtureResponseError(404, 'CAM_ASSET_NOT_FOUND', 'The requested CAM asset was not found.');
  }

  const scenarioCookie = normalizeScenario(url.searchParams.get('fixture'));
  const cookieHeader = scenarioCookie
    ? `mmc_cam_fixture=${encodeURIComponent(scenarioCookie)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=600`
    : null;

  if (isCamAssetPath(url.pathname)) {
    const relative = decodeURIComponent(url.pathname.slice('/mmc-private/src/cam/'.length));
    const requestedPath = await safeAssetPath(normalizedRoot, relative || 'index.html');
    await sendFile(request, response, requestedPath, cookieHeader);
    return;
  }

  if (isCamApplicationRoute(url.pathname)) {
    await sendFile(request, response, indexPath, cookieHeader);
    return;
  }

  throw new FixtureResponseError(404, 'CAM_ROUTE_NOT_FOUND', 'The requested CAM review route was not found.');
}

async function handleFixtureApi({ request, response, url, scenario, store, baseUrl }) {
  const method = String(request.method || 'GET').toUpperCase();
  if (method === 'GET') {
    if (scenario === 'loading') await delay(1_200);
    sendJson(response, 200, buildFixtureEnvelope(url.pathname, scenario, store, url.searchParams));
    return;
  }
  if (method === 'POST' && url.pathname === '/api/mmc/v2/mentor/commands') {
    assertSameOrigin(request, baseUrl);
    assertCsrf(request);
    const command = await readBoundedJson(request, 64 * 1024);
    const data = await executeFixtureCommand(command, scenario, store);
    sendJson(response, 200, data);
    return;
  }
  throw new FixtureResponseError(405, 'METHOD_NOT_ALLOWED', 'The fixture API method is not allowed.');
}

function assertSameOrigin(request, baseUrl) {
  const origin = String(request.headers.origin || '');
  if (!baseUrl || origin !== baseUrl) {
    throw new FixtureResponseError(403, 'ORIGIN_FORBIDDEN', 'The request origin is not authorized for this fixture.');
  }
  const fetchSite = String(request.headers['sec-fetch-site'] || '');
  if (fetchSite && fetchSite !== 'same-origin') {
    throw new FixtureResponseError(403, 'FETCH_SITE_FORBIDDEN', 'Cross-site command requests are forbidden.');
  }
}

function assertCsrf(request) {
  if (String(request.headers['x-mmhq-csrf'] || '') !== 'fixture-csrf-token') {
    throw new FixtureResponseError(403, 'CSRF_INVALID', 'A valid fixture CSRF token is required.');
  }
}

async function readBoundedJson(request, maxBytes) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw new FixtureResponseError(415, 'JSON_CONTENT_TYPE_REQUIRED', 'Commands require application/json.');
  }
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new FixtureResponseError(413, 'JSON_BODY_TOO_LARGE', 'The fixture command exceeds the review limit.');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new FixtureResponseError(413, 'JSON_BODY_TOO_LARGE', 'The fixture command exceeds the review limit.');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new FixtureResponseError(400, 'JSON_BODY_INVALID', 'The fixture command body is not valid JSON.');
  }
}

function rejectUnsafeRawTarget(rawTarget = '') {
  const raw = String(rawTarget || '');
  if (raw.includes('\0') || /(?:^|[/?#\\])\.\.(?:[/?#\\]|$)/u.test(raw) || /%(?:2e|2f|5c|00)/iu.test(raw)) {
    throw new FixtureResponseError(400, 'PATH_TRAVERSAL_FORBIDDEN', 'Unsafe path syntax is forbidden.');
  }
}

function isCamAssetPath(pathname) {
  return pathname === '/mmc-private/src/cam' || pathname.startsWith('/mmc-private/src/cam/');
}

function isBlockedHistoricalAsset(pathname) {
  return pathname === '/mmc-private/src/app.js'
    || pathname === '/mmc-private/src/styles.css'
    || pathname === '/mmc-private/src/mmc-data-adapters.js'
    || pathname === '/mmc-private/src/mmc-ownership-layer.js'
    || (pathname.startsWith('/mmc-private/src/') && !isCamAssetPath(pathname));
}

function isCamApplicationRoute(pathname) {
  if (pathname === '/mmc-private' || pathname === '/mmc-private/') return true;
  if (!pathname.startsWith('/mmc-private/')) return false;
  return !pathname.startsWith('/mmc-private/src/');
}

async function safeAssetPath(root, relative) {
  const decoded = decodeURIComponent(relative).replaceAll('\\', '/');
  if (!decoded || decoded.startsWith('/') || decoded.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new FixtureResponseError(400, 'PATH_TRAVERSAL_FORBIDDEN', 'Unsafe CAM asset path is forbidden.');
  }
  const absolute = path.resolve(root, decoded);
  if (!absolute.startsWith(`${root}${path.sep}`)) {
    throw new FixtureResponseError(400, 'PATH_TRAVERSAL_FORBIDDEN', 'Unsafe CAM asset path is forbidden.');
  }
  const extension = path.extname(absolute).toLowerCase();
  if (!Object.hasOwn(CONTENT_TYPES, extension)) {
    throw new FixtureResponseError(415, 'ASSET_TYPE_FORBIDDEN', 'This CAM asset type is not served by the review harness.');
  }
  let canonical;
  try {
    canonical = await fs.realpath(absolute);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      throw new FixtureResponseError(404, 'CAM_ASSET_NOT_FOUND', 'The requested CAM asset was not found.');
    }
    throw error;
  }
  if (!canonical.startsWith(`${root}${path.sep}`)) {
    throw new FixtureResponseError(400, 'PATH_TRAVERSAL_FORBIDDEN', 'Symlink traversal outside the CAM asset root is forbidden.');
  }
  return canonical;
}

async function sendFile(request, response, absolutePath, cookieHeader) {
  const extension = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) throw new FixtureResponseError(415, 'ASSET_TYPE_FORBIDDEN', 'This CAM asset type is not served by the review harness.');
  let bytes;
  try {
    bytes = await fs.readFile(absolutePath);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') {
      throw new FixtureResponseError(404, 'CAM_ASSET_NOT_FOUND', 'The requested CAM asset was not found.');
    }
    throw error;
  }
  writeSecurityHeaders(response, {
    'Content-Length': String(bytes.length),
    'Content-Type': contentType,
    ...(cookieHeader ? { 'Set-Cookie': cookieHeader } : {}),
  });
  response.statusCode = 200;
  response.end(String(request.method || 'GET').toUpperCase() === 'HEAD' ? undefined : bytes);
}

function sendJson(response, statusCode, payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  writeSecurityHeaders(response, {
    'Content-Length': String(bytes.length),
    'Content-Type': CONTENT_TYPES['.json'],
  });
  response.statusCode = statusCode;
  response.end(bytes);
}

function writeSecurityHeaders(response, extra = {}) {
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) response.setHeader(name, value);
}

function fixtureSessionPayload() {
  return {
    authenticated: true,
    authRequired: true,
    sessionPersistent: false,
    csrfToken: 'fixture-csrf-token',
    expiresAt: '2026-07-22T18:00:00.000Z',
    authAudience: 'mmc-private',
    user: {
      id: 'fixture-mentor-007',
      dbocUserId: 'fixture-mentor-007',
      login: 'fixture-mentor',
      displayName: 'Synthetic Mentor',
      email: 'mentor.fixture@example.invalid',
      roles: ['administrator'],
      scope: 'fixture-only',
      authSource: 'FIXTURE',
    },
    accessToken: '',
    authMode: { mode: 'FIXTURE', production: false },
    activeEndpoints: {},
    login: {},
  };
}

async function assertReadableFile(absolutePath, label) {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) throw new Error(`${label} is not a file.`);
  } catch (error) {
    throw new Error(`${label} is unavailable at the expected isolated CAM path: ${error.message}`);
  }
}

function safeScenario(request, fallback) {
  try {
    const url = new URL(request?.url || '/', 'http://127.0.0.1');
    return fixtureScenarioFromRequest(request || { headers: {} }, url, fallback);
  } catch {
    return normalizeScenario(fallback) || 'default';
  }
}

async function closeServer(server, sockets) {
  await new Promise((resolve) => server.close(resolve));
  for (const socket of sockets) socket.destroy();
  sockets.clear();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
