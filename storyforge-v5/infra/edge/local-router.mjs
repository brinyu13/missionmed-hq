import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import assetAliases from './generated-asset-aliases.mjs';

const listenPort = Number.parseInt(process.env.STORYFORGE_EDGE_PORT || '4179', 10);
const listenHost = process.env.STORYFORGE_EDGE_HOST || '127.0.0.1';
const storyforgeOrigin = new URL(process.env.STORYFORGE_EDGE_APP_ORIGIN || 'http://127.0.0.1:4180');
const wordpressOrigin = new URL(process.env.STORYFORGE_EDGE_WP_ORIGIN || 'http://127.0.0.1:8081');
const audioOrigin = (() => {
  try {
    const parsed = new URL(String(process.env.STORYFORGE_R2_ENDPOINT || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch {
    return '';
  }
})();
const arenaAvatarOrigin = 'https://cdn.missionmedinstitute.com';
const staticDir = path.resolve(
  process.env.STORYFORGE_EDGE_STATIC_DIR
    || fileURLToPath(new URL('../../dist/', import.meta.url)),
);
const basePath = `/${String(process.env.STORYFORGE_BASE_PATH || '/storyforge/').replace(/^\/+|\/+$/g, '')}/`;
const canonicalPath = basePath.slice(0, -1);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function cacheHeaders(headers, url, status, assetCache = '') {
  const next = new Headers(headers);
  const pathname = url.pathname;
  const contentType = String(next.get('content-type') || '').toLowerCase();
  const storyforgeApiPath = `${basePath}api`;
  const wordpressTokenPath = '/wp-json/missionmed/v1/storyforge/token';
  const isWordPressBootstrap = pathname === '/wp-admin/admin-ajax.php'
    && url.searchParams.get('action') === 'missionmed_storyforge_bootstrap';
  if (
    pathname === storyforgeApiPath
    || pathname.startsWith(`${storyforgeApiPath}/`)
    || pathname === wordpressTokenPath
    || pathname === `${wordpressTokenPath}/`
    || isWordPressBootstrap
  ) {
    next.set('cache-control', 'no-store, private');
    next.set('pragma', 'no-cache');
  } else if (status < 200 || status >= 300) {
    next.set('cache-control', 'no-store, max-age=0');
  } else if (contentType.includes('text/html')) {
    next.set('cache-control', 'no-store, max-age=0');
  } else if (
    assetCache === 'immutable'
    || /\/assets\/(?:[^/]+\/)*[^/]+\.[a-f0-9]{12}\.(?:css|js|svg|png|woff2?)$/i.test(pathname)
  ) {
    next.set('cache-control', 'public, max-age=31536000, immutable');
  } else if (assetCache === 'revalidate') {
    next.set('cache-control', 'no-cache');
  }
  next.set('x-storyforge-local-edge', pathname.startsWith(basePath) ? 'storyforge' : 'wordpress');
  return next;
}

function localSecurityHeaders(headers) {
  const next = new Headers(headers);
  next.set('content-security-policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: ${arenaAvatarOrigin}`,
    `media-src 'self' blob:${audioOrigin ? ` ${audioOrigin}` : ''}`,
    `connect-src 'self'${audioOrigin ? ` ${audioOrigin}` : ''}`,
    "font-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  next.set('referrer-policy', 'no-referrer');
  next.set('x-content-type-options', 'nosniff');
  next.set('x-frame-options', 'SAMEORIGIN');
  next.set('permissions-policy', 'camera=(), geolocation=(), microphone=(self)');
  return next;
}

function sendStaticError(response, incoming, status, message) {
  response.statusCode = status;
  for (const [name, value] of localSecurityHeaders(cacheHeaders(
    new Headers({ 'content-type': 'text/plain; charset=utf-8' }),
    incoming,
    status,
  ))) {
    response.setHeader(name, value);
  }
  response.end(message);
}

async function readAliasedAsset(alias) {
  const entry = assetAliases[alias];
  if (!entry || entry.path === 'index.html') return null;

  const [root, candidate] = await Promise.all([
    realpath(staticDir),
    realpath(path.resolve(staticDir, entry.path)),
  ]);
  const expected = path.join(root, ...entry.path.split('/'));
  if (candidate !== expected || !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error('StoryForge alias resolved outside the approved static root.');
  }
  const details = await stat(candidate);
  if (!details.isFile() || details.size !== entry.size) {
    throw new Error('StoryForge alias size check failed.');
  }
  const data = await readFile(candidate);
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (sha256 !== entry.sha256 || sha256.slice(0, 12) !== alias) {
    throw new Error('StoryForge alias integrity check failed.');
  }
  return { data, entry };
}

async function serveStatic(request, response, incoming) {
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    response.statusCode = 405;
    response.setHeader('cache-control', 'no-store, max-age=0');
    response.setHeader('x-storyforge-local-edge', 'storyforge');
    response.end('Method not allowed.');
    return;
  }

  let requested;
  let isRootRequest = false;
  try {
    const remainder = decodeURIComponent(incoming.pathname.slice(basePath.length));
    isRootRequest = remainder === '';
    requested = remainder || 'index.html';
  } catch {
    requested = '';
  }
  const aliasMatch = requested.match(/^_asset\/([a-f0-9]{12})$/);
  if (aliasMatch) {
    let asset;
    try {
      asset = await readAliasedAsset(aliasMatch[1]);
    } catch {
      sendStaticError(response, incoming, 503, 'StoryForge release integrity check failed.');
      return;
    }
    if (!asset) {
      sendStaticError(response, incoming, 404, 'StoryForge asset not found.');
      return;
    }
    response.statusCode = 200;
    const headers = localSecurityHeaders(cacheHeaders(
      new Headers({ 'content-type': asset.entry.type }),
      incoming,
      200,
      asset.entry.cache,
    ));
    headers.set('content-length', String(asset.data.length));
    for (const [name, value] of headers) response.setHeader(name, value);
    response.end(request.method === 'HEAD' ? undefined : asset.data);
    return;
  }
  if (
    requested.startsWith('_asset/')
    || requested.startsWith('assets/')
    || (!isRootRequest && path.extname(requested))
  ) {
    sendStaticError(response, incoming, 404, 'StoryForge asset not found.');
    return;
  }
  let filePath = path.resolve(staticDir, requested);
  const insideStaticDir = filePath === staticDir || filePath.startsWith(`${staticDir}${path.sep}`);
  if (!insideStaticDir) filePath = '';

  let data = null;
  if (filePath) {
    try {
      const details = await stat(filePath);
      if (details.isFile()) data = await readFile(filePath);
    } catch {
      data = null;
    }
  }
  if (!data && requested && !path.extname(requested)) {
    filePath = path.join(staticDir, 'index.html');
    try {
      data = await readFile(filePath);
    } catch {
      data = null;
    }
  }
  if (!data) {
    sendStaticError(response, incoming, 404, 'StoryForge asset not found.');
    return;
  }

  response.statusCode = 200;
  const headers = localSecurityHeaders(cacheHeaders(
    new Headers({ 'content-type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream' }),
    incoming,
    200,
  ));
  headers.set('content-length', String(data.length));
  for (const [name, value] of headers) response.setHeader(name, value);
  response.end(request.method === 'HEAD' ? undefined : data);
}

async function proxy(request, response) {
  const incoming = new URL(request.url || '/', `http://${request.headers.host || `${listenHost}:${listenPort}`}`);
  const normalizedPath = incoming.pathname.replace(/\/{2,}/g, '/');
  if (normalizedPath !== incoming.pathname) {
    response.statusCode = 308;
    response.setHeader('cache-control', 'no-store, max-age=0');
    response.setHeader('location', `${normalizedPath}${incoming.search}`);
    response.setHeader('x-storyforge-local-edge', 'storyforge');
    response.end();
    return;
  }
  if (incoming.pathname === canonicalPath) {
    response.statusCode = 308;
    response.setHeader('cache-control', 'no-store, max-age=0');
    response.setHeader('location', `${basePath}${incoming.search}`);
    response.setHeader('x-storyforge-local-edge', 'storyforge');
    response.end();
    return;
  }
  const isStoryForge = incoming.pathname.startsWith(basePath);
  const storyforgeRemainder = isStoryForge ? incoming.pathname.slice(basePath.length) : '';
  const isStoryForgeApi = storyforgeRemainder === 'healthz'
    || storyforgeRemainder === 'api'
    || storyforgeRemainder.startsWith('api/');
  if (isStoryForge && !isStoryForgeApi) {
    await serveStatic(request, response, incoming);
    return;
  }
  const target = new URL(isStoryForge ? storyforgeOrigin : wordpressOrigin);
  target.pathname = isStoryForge
    ? `/${incoming.pathname.slice(basePath.length)}`.replace(/\/+/g, '/')
    : incoming.pathname;
  target.search = incoming.search;

  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && !['host', 'content-length'].includes(name.toLowerCase())) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  headers.set('host', isStoryForge ? storyforgeOrigin.host : incoming.host);
  headers.set('x-forwarded-host', incoming.host);
  headers.set('x-forwarded-port', String(incoming.port || (incoming.protocol === 'https:' ? 443 : 80)));
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''));

  const method = request.method || 'GET';
  const body = ['GET', 'HEAD'].includes(method) ? undefined : Readable.toWeb(request);
  const upstream = await fetch(target, { method, headers, body, redirect: 'manual', duplex: body ? 'half' : undefined });
  response.statusCode = upstream.status;
  for (const [name, value] of cacheHeaders(upstream.headers, incoming, upstream.status)) {
    if (!['content-encoding', 'content-length', 'set-cookie', 'transfer-encoding'].includes(name.toLowerCase())) {
      response.setHeader(name, value);
    }
  }
  const setCookies = upstream.headers.getSetCookie();
  if (setCookies.length > 0) {
    response.setHeader('set-cookie', setCookies);
  }
  if (!upstream.body) {
    response.end();
    return;
  }
  Readable.fromWeb(upstream.body).pipe(response);
}

const server = http.createServer((request, response) => {
  proxy(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) {
      response.statusCode = 502;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
    }
    response.end('Local edge proxy failed.');
  });
});

server.listen(listenPort, listenHost, () => {
  console.log(`StoryForge local edge listening on http://${listenHost}:${listenPort}`);
});
