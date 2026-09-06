import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { FOUNDER_TEST_AGENT_ID } from '../founder-paid-test-gate.mjs';
import { IVPREP_PRODUCT_PROJECT_REF } from '../providers/supabase-durable-adapter.mjs';
import { runProfileBAgentWorker } from './start-profile-b-worker.mjs';

const REQUIRED_BINDINGS = Object.freeze([
  'OPENAI_API_KEY',
  'LEMONSLICE_API_KEY',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'IVPREP_SUPABASE_SERVICE_ROLE_KEY',
]);

function validateHostedEnvironment(environment) {
  if (environment.IVPREP_HOSTED_RUNTIME !== 'true') throw new Error('IVPREP_HOSTED_RUNTIME_DISABLED');
  if (REQUIRED_BINDINGS.some((name) => !String(environment[name] || ''))) {
    throw new Error('IVPREP_HOSTED_BINDINGS_UNAVAILABLE');
  }
  if (environment.IVPREP_SUPABASE_URL !== `https://${IVPREP_PRODUCT_PROJECT_REF}.supabase.co`)
    throw new Error('IVPREP_HOSTED_DATABASE_TARGET_MISMATCH');
  if (!['marin', 'coral', 'shimmer'].includes(environment.IVPREP_REALTIME_VOICE))
    throw new Error('IVPREP_HOSTED_VOICE_INVALID');
  if (environment.IVPREP_LEMONSLICE_AGENT_ID !== FOUNDER_TEST_AGENT_ID)
    throw new Error('IVPREP_HOSTED_AGENT_MISMATCH');
  const port = Number(environment.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('IVPREP_HOSTED_PORT_INVALID');
  return port;
}

export function createHostedWorkerHealthServer({
  port,
  state,
  createServer = http.createServer,
} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !state) {
    throw new TypeError('Hosted worker health configuration is invalid.');
  }
  return createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
      response.end('{"ok":false}');
      return;
    }
    const ready = state.workerRegistered === true && state.failedClosed !== true;
    response.writeHead(ready ? 200 : 503, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify({
      ok: ready,
      workerRegistered: state.workerRegistered === true,
      providerSessionsCreated: state.providerSessionsCreated,
      profile: 'PROFILE_B_OPENAI_NATIVE_AUDIO',
      agent: FOUNDER_TEST_AGENT_ID,
    }));
  });
}

export async function runHostedProfileBWorker({
  environment = process.env,
  runWorker = runProfileBAgentWorker,
  createHealthServer = createHostedWorkerHealthServer,
} = {}) {
  const port = validateHostedEnvironment(environment);
  const state = {
    workerRegistered: false,
    providerSessionsCreated: 0,
    failedClosed: false,
  };
  const healthServer = createHealthServer({ port, state });
  await new Promise((resolve, reject) => {
    healthServer.once('error', reject);
    healthServer.listen(port, '0.0.0.0', resolve);
  });
  console.info(JSON.stringify({ subsystem: 'ivprep_3472a', milestone: 'worker_health_listening' }));
  try {
    await runWorker({
      environment,
      onRegistered: () => {
        state.workerRegistered = true;
        console.info(JSON.stringify({ subsystem: 'ivprep_3472a', milestone: 'worker_registered' }));
      },
    });
  } catch (error) {
    state.failedClosed = true;
    console.error('IVPREP_HOSTED_WORKER_FAILED_CLOSED');
    throw error;
  } finally {
    await new Promise((resolve) => healthServer.close(resolve));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runHostedProfileBWorker();
}
