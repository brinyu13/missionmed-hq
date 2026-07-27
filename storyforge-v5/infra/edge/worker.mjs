const DEFAULT_BASE_PATH = '/storyforge/';

function basePath(env) {
  const value = String(env.STORYFORGE_BASE_PATH || DEFAULT_BASE_PATH).trim();
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

function withCachePolicy(response, pathname) {
  const headers = new Headers(response.headers);
  const contentType = String(headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    headers.set('Cache-Control', 'no-store, max-age=0');
  } else if (/\/assets\/[^/]+\.[a-f0-9]{12}\.(?:css|js|svg|png|woff2?)$/i.test(pathname)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    headers.set('Cache-Control', 'no-cache');
  }
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

async function staticResponse(request, env, url, prefix) {
  const assetRequest = strippedRequest(request, url, prefix);
  let response = await env.ASSETS.fetch(assetRequest);
  if (response.status === 404 && !/\.[a-z0-9]+$/i.test(assetRequest.url)) {
    const fallback = new URL(assetRequest.url);
    fallback.pathname = '/index.html';
    response = await env.ASSETS.fetch(new Request(fallback, assetRequest));
  }
  return withCachePolicy(response, new URL(assetRequest.url).pathname);
}

async function apiResponse(request, env, url, prefix) {
  const backend = new URL(env.STORYFORGE_ORIGIN);
  const incoming = new URL(strippedRequest(request, url, prefix).url);
  backend.pathname = incoming.pathname;
  backend.search = incoming.search;
  const response = await fetch(new Request(backend, request));
  return withCachePolicy(response, incoming.pathname);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = basePath(env);
    if (!url.pathname.startsWith(prefix)) {
      return new Response('StoryForge route not found.', { status: 404 });
    }
    const remainder = url.pathname.slice(prefix.length);
    if (remainder === 'healthz' || remainder.startsWith('api/')) {
      return apiResponse(request, env, url, prefix);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed.', { status: 405 });
    }
    return staticResponse(request, env, url, prefix);
  },
};
