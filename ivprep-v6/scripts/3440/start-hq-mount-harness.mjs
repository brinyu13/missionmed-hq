import http from 'node:http';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const host = '127.0.0.1';
let sealedOrigin = null;
const now = () => Date.now();
const registry = new InMemoryAdmissionRegistry({ now });
registry.grantSyntheticEntitlement({
  subject: 'wp:3440',
  revision: 'local-browser-harness-1',
  expiresAtMs: now() + 30 * 60 * 1000,
  founder: true,
  voice: true,
  video: false,
  grantedVideoSeconds: 0,
});

const hqSession = Object.freeze({
  version: 1,
  issuedAt: new Date(now()).toISOString(),
  expiresAt: new Date(now() + 30 * 60 * 1000).toISOString(),
  csrfToken: 'local_harness_csrf_3440',
  authSource: 'wordpress-cookie',
  user: Object.freeze({ id: 3440, roles: Object.freeze(['administrator']) }),
});
const handler = createIvPrepHqHandler({
  registry,
  now,
  flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: false }),
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  if (url.pathname === '/') {
    response.writeHead(302, { Location: '/iv-prep-on-call/', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  const handled = await handler({
    request,
    response,
    url,
    hqSession,
    cookieFingerprint: '3'.repeat(64),
    hqSessionMaxTtlSeconds: 1800,
    expectedOrigin: sealedOrigin,
  });
  if (!handled) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(0, host, () => {
  const address = server.address();
  sealedOrigin = `http://${host}:${address.port}`;
  process.stdout.write(`LOCAL_HARNESS_URL=${sealedOrigin}/iv-prep-on-call/\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
