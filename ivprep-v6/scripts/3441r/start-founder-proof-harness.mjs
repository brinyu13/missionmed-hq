import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import {
  FounderProofDurableCoordinator,
  createDurableWorkerHttpHandler,
  createFounderProofRuntime,
  createSyntheticProviderDependencies,
} from '../../server/founder-proof-runtime.mjs';
import { createLiveKitSessionCoordinator } from '../../server/providers/livekit-session-coordinator.mjs';
import { InMemoryVideoEntitlementStore } from '../../server/video-entitlement-store.mjs';

const host = '127.0.0.1';
const liveRequested = process.argv.includes('--live-test-1');
if (process.argv.slice(2).some((value) => value !== '--live-test-1')) {
  throw new Error('Only the exact Founder Test 1 mode is recognized.');
}
if (liveRequested && process.env.IVPREP_FOUNDER_TEST1_LIVE_ENABLED !== 'true') {
  throw new Error('Founder live Test 1 execution is not authorized.');
}

const now = () => Date.now();
export function createFounderProofHqSession({ clock, userId = 3441 } = {}) {
  if (typeof clock !== 'function') throw new TypeError('A session clock is required.');
  const issuedAtMs = clock();
  return Object.freeze({
    version: 1,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(issuedAtMs + 30 * 60 * 1000).toISOString(),
    csrfToken: 'founder_proof_csrf_3441r',
    authSource: 'wordpress-cookie',
    user: Object.freeze({ id: userId, roles: Object.freeze(['administrator']) }),
  });
}

const registry = new InMemoryAdmissionRegistry({ now });
const entitlementStore = new InMemoryVideoEntitlementStore({ now });
registry.grantSyntheticEntitlement({
  subject: 'wp:3441',
  revision: 'founder-proof-local-1',
  expiresAtMs: now() + 30 * 60 * 1000,
  founder: true,
  voice: true,
  video: true,
  grantedVideoSeconds: 45,
});
entitlementStore.grantSyntheticSeconds('wp:3441', 45);

const hqSession = createFounderProofHqSession({ clock: now });
const coordinator = new FounderProofDurableCoordinator();
const controlToken = randomBytes(32).toString('base64url');
const handleDurableWorker = createDurableWorkerHttpHandler({ coordinator, token: controlToken });
let sealedOrigin = null;
let runtime = null;
let workerProcess = null;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  if (await handleDurableWorker(request, response, url)) return;
  if (!runtime) {
    response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end('{"error":"ivprep_unavailable"}');
    return;
  }
  if (url.pathname === '/') {
    response.writeHead(302, { Location: '/iv-prep-on-call/', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  const handled = await runtime.handler({
    request,
    response,
    url,
    hqSession,
    cookieFingerprint: '4'.repeat(64),
    hqSessionMaxTtlSeconds: 1800,
    expectedOrigin: sealedOrigin,
  });
  if (!handled) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) server.listen(0, host, async () => {
  try {
    const address = server.address();
    sealedOrigin = `http://${host}:${address.port}`;
    let providerDependencies;
    if (liveRequested) {
      const livekit = await createLiveKitSessionCoordinator({
        url: process.env.LIVEKIT_URL,
        apiKey: process.env.LIVEKIT_API_KEY,
        apiSecret: process.env.LIVEKIT_API_SECRET,
      });
      providerDependencies = Object.freeze({
        coordinator,
        liveKitSignalOrigin: livekit.signalOrigin,
        room: livekit.room,
        participant: livekit.participant,
        dispatch: livekit.dispatch,
        worker: coordinator.workerAdapter(),
      });
    } else {
      providerDependencies = createSyntheticProviderDependencies({ coordinator });
    }
    runtime = createFounderProofRuntime({ registry, entitlementStore, providerDependencies, now });
    if (liveRequested) {
      const workerPath = fileURLToPath(new URL('../../server/agents/start-profile-b-worker.mjs', import.meta.url));
      workerProcess = spawn(process.execPath, [workerPath], {
        env: {
          ...process.env,
          IVPREP_FOUNDER_PROOF_GATE_URL: `${sealedOrigin}/_3441r/worker`,
          IVPREP_FOUNDER_PROOF_GATE_TOKEN: controlToken,
        },
        stdio: 'ignore',
        windowsHide: true,
      });
      workerProcess.once('exit', () => {
        if (!closing) runtime?.paidTestGate.failClosed('profile_b_worker_exit');
      });
    }
    process.stdout.write(`LOCAL_FOUNDER_PROOF_URL=${sealedOrigin}/iv-prep-on-call/#room\n`);
    process.stdout.write(`LOCAL_FOUNDER_PROOF_MODE=${liveRequested ? 'LIVE_FOUNDER_TEST_1' : 'SYNTHETIC_ZERO_COST'}\n`);
    process.stdout.write('PROVIDER_CALLS_AT_STARTUP=0\n');
  } catch {
    server.close(() => process.exit(1));
  }
});

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const serverClosed = new Promise((resolve) => server.close(resolve));
  let clean = true;
  try {
    const stopped = await runtime?.shutdown?.('harness_shutdown');
    if (stopped?.ok !== true) clean = false;
  } catch {
    clean = false;
  }
  if (workerProcess && workerProcess.exitCode == null) {
    workerProcess.kill('SIGTERM');
    const exited = await Promise.race([
      new Promise((resolve) => workerProcess.once('exit', () => resolve(true))),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!exited && workerProcess.exitCode == null) {
      clean = false;
      workerProcess.kill('SIGKILL');
      await Promise.race([
        new Promise((resolve) => workerProcess.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 1_000)),
      ]);
    }
  }
  await serverClosed;
  if (!clean) runtime?.paidTestGate.failClosed('harness_shutdown_unconfirmed');
  process.exit(clean ? 0 : 1);
}
if (isDirectRun) {
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void close(); });
}
