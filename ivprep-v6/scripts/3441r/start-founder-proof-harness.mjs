import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { createRequire } from 'node:module';
import { basename, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
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
const syntheticStabilityTest = process.argv.includes('--synthetic-stability-test');
const syntheticLeaseLossTest = process.argv.includes('--synthetic-lease-loss-test');
const unexpectedArgument = process.argv.slice(2).find((value) => ![
  '--live-test-1', '--synthetic-stability-test', '--synthetic-lease-loss-test',
].includes(value));

const keeperPath = fileURLToPath(new URL('./t1-durable-lease-keeper.py', import.meta.url));
const productRoot = fileURLToPath(new URL('../../', import.meta.url));
const localRequire = createRequire(import.meta.url);
const leaseStates = new Set(['NOT_ACQUIRED', 'STABILIZING', 'READY', 'LOST', 'RELEASED']);
const requiredProviderBindings = Object.freeze([
  'OPENAI_API_KEY', 'LEMONSLICE_API_KEY', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET',
]);

class FounderHarnessStartupError extends Error {
  constructor(code) {
    super(code);
    this.name = 'FounderHarnessStartupError';
    this.code = code;
  }
}

function fixedStartupReason(error) {
  const allowed = new Set([
    'ARGUMENTS_INVALID',
    'LIVE_MODE_NOT_ENABLED',
    'PROVIDER_BINDINGS_UNAVAILABLE',
    'NPM_RUNTIME_UNAVAILABLE',
    'LOCKED_DEPENDENCY_INSTALL_FAILED',
    'LOCKED_RUNTIME_DEPENDENCIES_UNAVAILABLE',
    'LIVEKIT_CONFIGURATION_INVALID',
    'LEASE_KEEPER_INITIALIZATION_FAILED',
    'LOOPBACK_LISTEN_FAILED',
    'INTERNAL_STARTUP_FAILURE',
  ]);
  return allowed.has(error?.code) ? error.code : 'INTERNAL_STARTUP_FAILURE';
}

function reportStartupFailure(error) {
  process.stderr.write('FOUNDER HARNESS START FAILED\n');
  process.stderr.write(`REASON:\n${fixedStartupReason(error)}\n`);
}

function validateStartupContract() {
  if (unexpectedArgument || (liveRequested && (syntheticStabilityTest || syntheticLeaseLossTest))) {
    throw new FounderHarnessStartupError('ARGUMENTS_INVALID');
  }
  if (!liveRequested) return;
  if (process.env.IVPREP_FOUNDER_TEST1_LIVE_ENABLED !== 'true') {
    throw new FounderHarnessStartupError('LIVE_MODE_NOT_ENABLED');
  }
  if (requiredProviderBindings.some((name) => !process.env[name])) {
    throw new FounderHarnessStartupError('PROVIDER_BINDINGS_UNAVAILABLE');
  }
}

export async function installLockedDependencies({
  spawnProcess = spawn,
  timeoutMs = 180_000,
  npmExecPath = process.env.npm_execpath,
} = {}) {
  if (!npmExecPath || !isAbsolute(npmExecPath) || basename(npmExecPath) !== 'npm-cli.js') {
    throw new FounderHarnessStartupError('NPM_RUNTIME_UNAVAILABLE');
  }
  const child = spawnProcess(process.execPath, [
    npmExecPath, 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error',
  ], {
    cwd: productRoot,
    env: {
      PATH: '/opt/homebrew/bin:/usr/bin:/bin',
      HOME: process.env.HOME || '',
      TMPDIR: process.env.TMPDIR || '/tmp',
      LANG: 'en_US.UTF-8',
      npm_config_userconfig: '/dev/null',
      npm_config_registry: 'https://registry.npmjs.org/',
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  const result = await new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(false);
    }, timeoutMs);
    child.once('error', () => finish(false));
    child.once('exit', (code) => finish(code === 0));
  });
  if (!result) throw new FounderHarnessStartupError('LOCKED_DEPENDENCY_INSTALL_FAILED');
}

export async function ensureFounderHarnessDependencies({
  resolveDependency = () => localRequire.resolve('livekit-server-sdk'),
  install = installLockedDependencies,
} = {}) {
  try {
    resolveDependency();
    return 'PRESENT';
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') {
      throw new FounderHarnessStartupError('LOCKED_RUNTIME_DEPENDENCIES_UNAVAILABLE');
    }
  }
  process.stdout.write('FOUNDER_HARNESS_BOOTSTRAP=INSTALLING_LOCKED_DEPENDENCIES\n');
  await install();
  try {
    resolveDependency();
  } catch {
    throw new FounderHarnessStartupError('LOCKED_RUNTIME_DEPENDENCIES_UNAVAILABLE');
  }
  process.stdout.write('FOUNDER_HARNESS_BOOTSTRAP=LOCKED_DEPENDENCIES_READY\n');
  return 'INSTALLED';
}

export class DurableLeaseSupervisor {
  constructor({ synthetic = true, fastSynthetic = false, syntheticFailAfter = null, onLost = () => {} } = {}) {
    this.synthetic = synthetic;
    this.fastSynthetic = fastSynthetic;
    this.syntheticFailAfter = syntheticFailAfter;
    this.onLost = onLost;
    this.child = null;
    this.closing = false;
    this.lossNotified = false;
    this.receivedInitial = false;
    this.current = Object.freeze({
      state: 'NOT_ACQUIRED', leaseId: null, fencingEpoch: null,
      heartbeatCount: 0, stableSeconds: 0,
    });
    this.receivedInitial = true;
  }

  publicState() {
    return structuredClone(this.current);
  }

  update(value) {
    const keys = Object.keys(value).sort();
    const allowed = ['fencingEpoch', 'heartbeatCount', 'leaseId', 'nonceSha256', 'stableSeconds', 'state'];
    if (!keys.every((key) => allowed.includes(key)) || !leaseStates.has(value.state)
      || !Number.isInteger(value.heartbeatCount) || value.heartbeatCount < 0
      || !Number.isInteger(value.stableSeconds) || value.stableSeconds < 0
      || (value.leaseId !== null && !/^[0-9a-f-]{36}$/u.test(value.leaseId))
      || (value.fencingEpoch !== null && (!Number.isInteger(value.fencingEpoch) || value.fencingEpoch < 1))
      || (value.nonceSha256 !== null && value.nonceSha256 !== undefined
        && !/^[0-9a-f]{64}$/u.test(value.nonceSha256))) {
      this.markLost();
      return;
    }
    this.current = Object.freeze({
      state: value.state,
      leaseId: value.leaseId,
      fencingEpoch: value.fencingEpoch,
      heartbeatCount: value.heartbeatCount,
      stableSeconds: value.stableSeconds,
    });
    if (value.state === 'LOST') this.markLost();
  }

  markLost() {
    if (this.current.state !== 'LOST') {
      this.current = Object.freeze({ ...this.current, state: 'LOST' });
    }
    if (this.lossNotified) return;
    this.lossNotified = true;
    try {
      const pending = this.onLost();
      if (pending?.catch) void pending.catch(() => {});
    } catch {
      // The local harness remains fail-closed even if teardown reporting fails.
    }
  }

  async start() {
    if (this.child) throw new Error('T1 keeper already started.');
    const args = ['-B', keeperPath];
    if (this.synthetic) args.push('--synthetic');
    if (this.fastSynthetic) {
      args.push('--heartbeat-seconds', '0.05', '--stability-seconds', '0.15');
    }
    if (this.syntheticFailAfter !== null) args.push('--synthetic-fail-after', String(this.syntheticFailAfter));
    this.child = spawn('/opt/homebrew/bin/python3', args, {
      cwd: '/tmp',
      env: {
        PATH: '/opt/homebrew/bin:/usr/bin:/bin',
        HOME: process.env.HOME || '',
        TMPDIR: process.env.TMPDIR || '/tmp',
        LANG: 'en_US.UTF-8',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderrBytes = 0;
    this.child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > 0) this.markLost();
    });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => {
      if (line.length > 2_048) return this.markLost();
      try { this.update(JSON.parse(line)); }
      catch { this.markLost(); }
    });
    this.child.once('exit', () => {
      if (!this.closing && this.current.state !== 'RELEASED') this.markLost();
    });
    const deadline = Date.now() + 3_000;
    while (!this.receivedInitial && Date.now() < deadline) {
      if (this.child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!this.receivedInitial || this.child.exitCode !== null || this.current.state === 'LOST') {
      throw new Error('T1 lease keeper failed to initialize.');
    }
    return this.publicState();
  }

  acquire() {
    if (!this.child || this.child.exitCode !== null || this.current.state !== 'NOT_ACQUIRED') return false;
    this.child.stdin.write('ACQUIRE\n');
    return true;
  }

  async release() {
    if (!this.child || this.child.exitCode !== null) return this.current.state === 'RELEASED';
    this.closing = true;
    this.child.stdin.write('RELEASE\n');
    const exited = await Promise.race([
      once(this.child, 'exit').then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!exited && this.child.exitCode === null) {
      this.child.kill('SIGTERM');
      await Promise.race([once(this.child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))]);
    }
    return this.current.state === 'RELEASED';
  }
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
let closing = false;
let leaseSupervisor = null;

function ensureWorkerProcess() {
  if (!liveRequested || (workerProcess && workerProcess.exitCode === null)) return;
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
  workerProcess.once('error', () => runtime?.paidTestGate.failClosed('profile_b_worker_spawn_error'));
  workerProcess.once('exit', () => {
    if (!closing) runtime?.paidTestGate.failClosed('profile_b_worker_exit');
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function founderMutationAuthorized(request) {
  return request.method === 'POST'
    && request.headers.origin === sealedOrigin
    && request.headers['sec-fetch-site'] === 'same-origin'
    && request.headers['x-mmhq-csrf'] === hqSession.csrfToken
    && hqSession.user.roles.includes('administrator');
}

async function handleLeaseControl(request, response, url) {
  if (url.pathname === '/api/ivprep-v6/t1-lease' && request.method === 'GET') {
    sendJson(response, 200, { lease: leaseSupervisor?.publicState() || { state: 'LOST' } });
    return true;
  }
  if (!['/api/ivprep-v6/t1-lease/acquire', '/api/ivprep-v6/t1-lease/release'].includes(url.pathname)) {
    return false;
  }
  if (!founderMutationAuthorized(request)) {
    sendJson(response, 403, { error: 'ivprep_t1_lease_control_denied' });
    return true;
  }
  if (url.pathname.endsWith('/acquire')) {
    if (!leaseSupervisor?.acquire()) {
      sendJson(response, 409, { error: 'ivprep_t1_lease_acquire_denied' });
      return true;
    }
    sendJson(response, 202, { lease: leaseSupervisor.publicState() });
    return true;
  }
  const released = await leaseSupervisor?.release();
  sendJson(response, released ? 200 : 409, released
    ? { lease: leaseSupervisor.publicState() }
    : { error: 'ivprep_t1_lease_release_unconfirmed' });
  return true;
}

function paidMutationRequiresReadyLease(request, url) {
  if (request.method !== 'POST') return false;
  return url.pathname === '/api/ivprep-v6/provider-tests/authorize'
    || url.pathname === '/api/ivprep-v6/interviews/start';
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  if (await handleDurableWorker(request, response, url)) return;
  if (!runtime) {
    response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end('{"error":"ivprep_unavailable"}');
    return;
  }
  if (await handleLeaseControl(request, response, url)) return;
  if (paidMutationRequiresReadyLease(request, url)
    && leaseSupervisor?.publicState().state !== 'READY') {
    sendJson(response, 409, { error: 'ivprep_t1_lease_not_ready' });
    return;
  }
  if (liveRequested
    && url.pathname === '/api/ivprep-v6/provider-tests/authorize'
    && founderMutationAuthorized(request)) {
    ensureWorkerProcess();
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

async function initializeFounderHarness() {
    const address = server.address();
    sealedOrigin = `http://${host}:${address.port}`;
    leaseSupervisor = new DurableLeaseSupervisor({
      synthetic: !liveRequested,
      fastSynthetic: syntheticStabilityTest || syntheticLeaseLossTest,
      syntheticFailAfter: syntheticLeaseLossTest ? 2 : null,
      onLost: async () => {
        try { await runtime?.shutdown?.('product_lease_lost'); }
        catch { /* the harness exit remains authoritative */ }
        if (!closing) await close({ exitCode: 1 });
      },
    });
    await leaseSupervisor.start();
    let providerDependencies;
    if (liveRequested) {
      let livekit;
      try {
        livekit = await createLiveKitSessionCoordinator({
          url: process.env.LIVEKIT_URL,
          apiKey: process.env.LIVEKIT_API_KEY,
          apiSecret: process.env.LIVEKIT_API_SECRET,
        });
      } catch (error) {
        if (error?.message === 'LiveKit server configuration is unavailable.') {
          throw new FounderHarnessStartupError('LIVEKIT_CONFIGURATION_INVALID');
        }
        throw error;
      }
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
    process.stdout.write(`LOCAL_FOUNDER_PROOF_URL=${sealedOrigin}/iv-prep-on-call/#room\n`);
    process.stdout.write(`LOCAL_FOUNDER_PROOF_MODE=${liveRequested ? 'LIVE_FOUNDER_TEST_1' : 'SYNTHETIC_ZERO_COST'}\n`);
    process.stdout.write('LEASE_STATE=NOT_ACQUIRED\n');
    process.stdout.write('PROVIDER_CALLS_AT_STARTUP=0\n');
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
async function startFounderHarness() {
  validateStartupContract();
  if (liveRequested) await ensureFounderHarnessDependencies();
  await new Promise((resolve, reject) => {
    const fail = () => reject(new FounderHarnessStartupError('LOOPBACK_LISTEN_FAILED'));
    server.once('error', fail);
    server.listen(0, host, () => {
      server.off('error', fail);
      resolve();
    });
  });
  await initializeFounderHarness();
}

if (isDirectRun) {
  startFounderHarness().catch(async (error) => {
    reportStartupFailure(error);
    if (server.listening) await close({ exitCode: 1 });
    else process.exitCode = 1;
  });
}

async function close({ exitCode = 0 } = {}) {
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
  try {
    const released = await leaseSupervisor?.release();
    if (released !== true) clean = false;
  } catch {
    clean = false;
  }
  await serverClosed;
  if (!clean) runtime?.paidTestGate.failClosed('harness_shutdown_unconfirmed');
  process.exit(clean ? exitCode : 1);
}
if (isDirectRun) {
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void close(); });
}
