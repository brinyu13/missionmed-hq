import assetAliases from './generated-asset-aliases.mjs';

const DEFAULT_BASE_PATH = '/storyforge/';
const ASSET_ALIAS_PATTERN = /^\/_asset\/([a-f0-9]{12})$/;

function basePath(env) {
  const value = String(env.STORYFORGE_BASE_PATH || DEFAULT_BASE_PATH).trim();
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

function withCachePolicy(response, pathname) {
  const headers = new Headers(response.headers);
  const contentType = String(headers.get('content-type') || '').toLowerCase();
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    headers.set('Cache-Control', 'no-store, private');
    headers.set('Pragma', 'no-cache');
  } else if (!response.ok) {
    headers.set('Cache-Control', 'no-store, max-age=0');
  } else if (contentType.includes('text/html')) {
    headers.set('Cache-Control', 'no-store, max-age=0');
  } else if (/\/assets\/(?:[^/]+\/)*[^/]+\.[a-f0-9]{12}\.(?:css|js|svg|png|woff2?)$/i.test(pathname)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    headers.set('Cache-Control', 'no-cache');
  }
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  headers.set('X-StoryForge-Route', 'edge');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function strippedRequest(request, url, prefix) {
  const target = new URL(url);
  const remainder = url.pathname.slice(prefix.length);
  target.pathname = `/${remainder}`.replace(/\/+/g, '/');
  return new Request(target, request);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function staticError(status, message, pathname) {
  return withCachePolicy(
    new Response(message, {
      status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }),
    pathname,
  );
}

async function aliasedAssetResponse(request, env, url, alias) {
  const entry = assetAliases[alias];
  if (!entry || entry.path === 'index.html') {
    return staticError(404, 'StoryForge asset not found.', `/_asset/${alias}`);
  }

  const target = new URL(url);
  target.pathname = `/${entry.path}`;
  target.search = '';
  const source = await env.ASSETS.fetch(new Request(target, { method: 'GET' }));
  if (source.status !== 200) {
    return staticError(503, 'StoryForge release is temporarily unavailable.', target.pathname);
  }

  const bytes = await source.arrayBuffer();
  const hash = await sha256Hex(bytes);
  if (bytes.byteLength !== entry.size || hash !== entry.sha256 || hash.slice(0, 12) !== alias) {
    return staticError(503, 'StoryForge release integrity check failed.', target.pathname);
  }

  const headers = new Headers(source.headers);
  headers.delete('Content-Encoding');
  headers.delete('Set-Cookie');
  headers.delete('Transfer-Encoding');
  headers.set('Content-Length', String(bytes.byteLength));
  headers.set('Content-Type', entry.type);
  const response = new Response(request.method === 'HEAD' ? null : bytes, {
    status: 200,
    headers,
  });
  return withCachePolicy(response, target.pathname);
}

async function staticResponse(request, env, url, prefix) {
  const assetRequest = strippedRequest(request, url, prefix);
  const assetPath = new URL(assetRequest.url).pathname;
  const aliasMatch = assetPath.match(ASSET_ALIAS_PATTERN);
  if (aliasMatch) {
    return aliasedAssetResponse(request, env, url, aliasMatch[1]);
  }
  if (
    assetPath.startsWith('/_asset/')
    || assetPath.startsWith('/assets/')
    || /\.[a-z0-9]+$/i.test(assetPath)
  ) {
    return staticError(404, 'StoryForge asset not found.', assetPath);
  }
  let response = await env.ASSETS.fetch(assetRequest);
  if (response.status === 404 && !/\.[a-z0-9]+$/i.test(assetRequest.url)) {
    const fallback = new URL(assetRequest.url);
    fallback.pathname = '/index.html';
    response = await env.ASSETS.fetch(new Request(fallback, assetRequest));
  }
  return withCachePolicy(response, assetPath);
}

async function apiResponse(request, env, url, prefix) {
  const backend = new URL(env.STORYFORGE_ORIGIN);
  const incoming = new URL(strippedRequest(request, url, prefix).url);
  backend.pathname = incoming.pathname;
  backend.search = incoming.search;
  const outbound = new Request(backend, request);
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'content-type', 'origin']) {
    const value = outbound.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const response = await fetch(new Request(outbound, { headers, redirect: 'manual' }));
  return withCachePolicy(response, incoming.pathname);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = basePath(env);
    const normalizedPath = url.pathname.replace(/\/{2,}/g, '/');
    if (normalizedPath !== url.pathname) {
      url.pathname = normalizedPath;
      return new Response(null, {
        status: 308,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          Location: `${url.pathname}${url.search}`,
          'X-StoryForge-Route': 'edge',
        },
      });
    }
    if (url.pathname === prefix.slice(0, -1)) {
      url.pathname = prefix;
      return new Response(null, {
        status: 308,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          Location: `${url.pathname}${url.search}`,
          'X-StoryForge-Route': 'edge',
        },
      });
    }
    if (!url.pathname.startsWith(prefix)) {
      return new Response('StoryForge route not found.', { status: 404 });
    }
    const remainder = url.pathname.slice(prefix.length);
    if (remainder === 'healthz' || remainder === 'api' || remainder.startsWith('api/')) {
      return apiResponse(request, env, url, prefix);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed.', { status: 405 });
    }
    return staticResponse(request, env, url, prefix);
  },
};
