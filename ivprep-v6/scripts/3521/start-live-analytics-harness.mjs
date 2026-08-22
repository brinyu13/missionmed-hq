import http from 'node:http';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const host = '127.0.0.1';
const liveAnalyticsPath = '/iv-prep-on-call/live-analytics/';
const now = () => Date.now();
const bootMs = now();
const sessionTtlSeconds = 25 * 60;
const maximumSessionTtlSeconds = 30 * 60;
let sealedOrigin = null;

const registry = new InMemoryAdmissionRegistry({ now });
registry.grantSyntheticEntitlement({
  subject: 'wp:3521',
  revision: 'local-live-analytics-harness-1',
  expiresAtMs: bootMs + sessionTtlSeconds * 1_000,
  founder: true,
  voice: true,
  video: false,
  grantedVideoSeconds: 0,
});

const hqSession = Object.freeze({
  version: 1,
  issuedAt: new Date(bootMs).toISOString(),
  expiresAt: new Date(bootMs + sessionTtlSeconds * 1_000).toISOString(),
  csrfToken: 'local_harness_csrf_3521',
  authSource: 'wordpress-cookie',
  user: Object.freeze({ id: 3521, roles: Object.freeze(['administrator']) }),
});

// This harness intentionally has no provider controller and makes paid provider
// creation impossible. It exists only for the localhost analytics surface.
const handler = createIvPrepHqHandler({
  registry,
  now,
  flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: false }),
  runtimeState: async () => Object.freeze({
    mode: 'hosted',
    workerRegistrationState: 'UNAVAILABLE',
    providerSessionsCreatedAtReadiness: 0,
    paidProviderCreationEnabled: false,
  }),
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  if (url.pathname === '/') {
    response.writeHead(302, { Location: liveAnalyticsPath, 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  const handled = await handler({
    request,
    response,
    url,
    hqSession,
    cookieFingerprint: '5'.repeat(64),
    hqSessionMaxTtlSeconds: maximumSessionTtlSeconds,
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
  process.stdout.write(`LIVE_ANALYTICS_HARNESS_URL=${sealedOrigin}${liveAnalyticsPath}\n`);
  process.stdout.write('PROVIDER_SESSIONS=0\n');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
