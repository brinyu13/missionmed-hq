import assert from 'node:assert/strict';

import { handleMmcCoachingPipelineRoute } from '../routes/mmc-coaching-pipeline.mjs';

const session = { csrfToken: 'csrf_006_webex_route_seal' };
let fetchCalls = 0;
let workerCalls = 0;
const deps = {
  session,
  authHeaders: {},
  isAuthorizedMmcPrivateSession: () => true,
  fetch: async () => { fetchCalls += 1; throw new Error('sealed'); },
  readJsonBody: async () => { workerCalls += 1; throw new Error('sealed'); },
  getMmcPersistenceConfig: () => { workerCalls += 1; throw new Error('sealed'); },
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

for (const route of ['/webex/status', '/webex/recordings']) {
  const response = await call(route, 'GET');
  assert.equal(response.statusCode, 410);
  assert.equal(response.payload.error, 'mmc_legacy_pipeline_sealed');
}

let response = await call('/webex/pull', 'POST');
assert.equal(response.statusCode, 403);
assert.equal(response.payload.error, 'CSRF_VALIDATION_FAILED');
response = await call('/webex/pull', 'POST', { 'x-mmhq-csrf': session.csrfToken });
assert.equal(response.statusCode, 410);
assert.equal(response.payload.status, 'SEALED');
assert.equal(fetchCalls, 0, 'The sealed route must not call Webex.');
assert.equal(workerCalls, 0, 'The sealed route must not invoke worker or persistence dependencies.');

console.log('MMC-507 Webex trigger route seal validation passed.');
