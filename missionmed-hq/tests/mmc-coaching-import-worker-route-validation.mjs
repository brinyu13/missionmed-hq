import assert from 'node:assert/strict';

import { handleMmcCoachingPipelineRoute } from '../routes/mmc-coaching-pipeline.mjs';

const session = { csrfToken: 'csrf_006_worker_route_seal' };
let workerCalls = 0;
let persistenceCalls = 0;
const deps = {
  session,
  authHeaders: {},
  isAuthorizedMmcPrivateSession: () => true,
  getMmcPersistenceConfig: () => { persistenceCalls += 1; throw new Error('sealed'); },
  readJsonBody: () => { workerCalls += 1; throw new Error('sealed'); },
  selectMmcRows: () => { workerCalls += 1; throw new Error('sealed'); },
  insertMmcRow: () => { workerCalls += 1; throw new Error('sealed'); },
  sendJson: (response, statusCode, payload) => Object.assign(response, { statusCode, payload }),
};

async function call(route, method, headers = {}) {
  const response = {};
  await handleMmcCoachingPipelineRoute(
    { method, headers },
    response,
    new URL(`https://mmc.local.test/api/mmc/coaching-pipeline${route}`),
    deps,
  );
  return response;
}

for (const route of ['/worker/status', '/worker/scan']) {
  const response = await call(route, 'GET');
  assert.equal(response.statusCode, 410);
  assert.equal(response.payload.error, 'mmc_legacy_pipeline_sealed');
}

for (const route of ['/worker/import', '/worker/process']) {
  let response = await call(route, 'POST');
  assert.equal(response.statusCode, 403, 'Legacy mutations must enforce CSRF even when global auth is disabled.');
  response = await call(route, 'POST', { 'x-mmhq-csrf': session.csrfToken });
  assert.equal(response.statusCode, 410);
  assert.equal(response.payload.status, 'SEALED');
}

assert.equal(workerCalls, 0, 'The sealed HTTP route must not invoke the request-driven worker bridge.');
assert.equal(persistenceCalls, 0, 'The sealed HTTP route must not obtain provider/persistence configuration.');

console.log('MMC-502 coaching import worker route seal validation passed.');
