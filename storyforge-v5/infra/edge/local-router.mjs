import http from 'node:http';
import { Readable } from 'node:stream';

const listenPort = Number.parseInt(process.env.STORYFORGE_EDGE_PORT || '4179', 10);
const listenHost = process.env.STORYFORGE_EDGE_HOST || '127.0.0.1';
const storyforgeOrigin = new URL(process.env.STORYFORGE_EDGE_APP_ORIGIN || 'http://127.0.0.1:4180');
const wordpressOrigin = new URL(process.env.STORYFORGE_EDGE_WP_ORIGIN || 'http://127.0.0.1:8081');
const basePath = `/${String(process.env.STORYFORGE_BASE_PATH || '/storyforge/').replace(/^\/+|\/+$/g, '')}/`;

function cacheHeaders(headers, pathname) {
  const next = new Headers(headers);
  const contentType = String(next.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    next.set('cache-control', 'no-store, max-age=0');
  } else if (/\/assets\/[^/]+\.[a-f0-9]{12}\.(?:css|js|svg|png|woff2?)$/i.test(pathname)) {
    next.set('cache-control', 'public, max-age=31536000, immutable');
  }
  next.set('x-storyforge-local-edge', pathname.startsWith(basePath) ? 'storyforge' : 'wordpress');
  return next;
}

async function proxy(request, response) {
  const incoming = new URL(request.url || '/', `http://${request.headers.host || `${listenHost}:${listenPort}`}`);
  const isStoryForge = incoming.pathname.startsWith(basePath);
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
  for (const [name, value] of cacheHeaders(upstream.headers, incoming.pathname)) {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase())) {
      response.setHeader(name, value);
    }
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
