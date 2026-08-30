import http from 'node:http';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const host = '127.0.0.1';
let sealedOrigin = null;
const now = () => Date.now();

// The synthetic harness session must be built from ONE captured instant. Reading
// the clock separately for issuedAt and expiresAt let the pair drift by >=1ms,
// which pushed the session TTL to 1800001ms against the 1800s cap enforced by
// strictProjectHqSession, and every harness request failed closed with
// ivprep_authentication_required. The session lifetime is also held below the
// cap so the boundary is not load-bearing. Production is unaffected: HQ derives
// both stamps from a single Date instance (missionmed-hq/server.mjs).
const HARNESS_SESSION_TTL_SECONDS = 25 * 60;
const HARNESS_MAX_TTL_SECONDS = 30 * 60;
const bootMs = now();

const registry = new InMemoryAdmissionRegistry({ now });
registry.grantSyntheticEntitlement({
  subject: 'wp:3440',
  revision: 'local-browser-harness-1',
  expiresAtMs: bootMs + HARNESS_SESSION_TTL_SECONDS * 1000,
  founder: true,
  voice: true,
  video: false,
  grantedVideoSeconds: 0,
});

const hqSession = Object.freeze({
  version: 1,
  issuedAt: new Date(bootMs).toISOString(),
  expiresAt: new Date(bootMs + HARNESS_SESSION_TTL_SECONDS * 1000).toISOString(),
  csrfToken: 'local_harness_csrf_3440',
  authSource: 'wordpress-cookie',
  user: Object.freeze({ id: 3440, roles: Object.freeze(['administrator']) }),
});
// The browser client only initializes Delivery Intelligence (camera, microphone,
// holistic wireframes, telemetry) when the admission payload reports
// runtime.mode === 'hosted'. Without an explicit runtimeState the mount defaults
// to mode 'disabled', so the local harness served the product shell with the
// entire sensor stage inert and no way to verify it off-Railway.
//
// This models the exact state we need to be able to verify: a hosted runtime
// whose paid provider is NOT available. Practice, wireframes and telemetry must
// work here. workerRegistrationState stays UNAVAILABLE and
// paidProviderCreationEnabled stays false, so no provider session can be created
// and this harness cannot incur provider spend.
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
    hqSessionMaxTtlSeconds: HARNESS_MAX_TTL_SECONDS,
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
