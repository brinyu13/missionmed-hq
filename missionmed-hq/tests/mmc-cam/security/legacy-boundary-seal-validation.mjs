import assert from 'node:assert/strict';

import {
  handleMmcCoachingPipelineRoute,
  isMmcCoachingPipelinePath,
} from '../../../routes/mmc-coaching-pipeline.mjs';

assert.equal(isMmcCoachingPipelinePath('/api/mmc/coaching-pipeline/webex/pull'), true);
assert.equal(isMmcCoachingPipelinePath('/api/mmc/v2/commands'), true);

const session = { csrfToken: 'csrf_006_legacy_seal' };
let unsafeDependencyCalls = 0;
const baseDeps = {
  session,
  authHeaders: {},
  isAuthorizedMmcPrivateSession: () => true,
  getMmcPersistenceConfig: () => { unsafeDependencyCalls += 1; throw new Error('must remain unreachable'); },
  buildMmcPersistenceContext: () => { unsafeDependencyCalls += 1; throw new Error('must remain unreachable'); },
  readJsonBody: () => { unsafeDependencyCalls += 1; throw new Error('must remain unreachable'); },
  selectMmcRows: () => { unsafeDependencyCalls += 1; throw new Error('must remain unreachable'); },
  insertMmcRow: () => { unsafeDependencyCalls += 1; throw new Error('must remain unreachable'); },
  sendJson: (response, status, payload, headers) => Object.assign(response, { status, payload, headers }),
};

async function invoke(pathname, method = 'GET', headers = {}, deps = baseDeps) {
  const request = { method, headers };
  const response = {};
  await handleMmcCoachingPipelineRoute(
    request,
    response,
    new URL(`https://mmc.local.test${pathname}`),
    deps,
  );
  return response;
}

let response = await invoke('/api/mmc/coaching-pipeline/status');
assert.equal(response.status, 200);
assert.deepEqual(response.payload, {
  ok: false,
  status: 'SEALED',
  mode: 'legacy-coaching-pipeline',
  authority: 'CAM_V2',
  mutationEnabled: false,
  providerAccessEnabled: false,
  filesystemAccessEnabled: false,
  replacement: '/api/mmc/v2',
});
assert.equal(Object.hasOwn(response.payload, 'projectRef'), false);
assert.equal(Object.hasOwn(response.payload, 'apiKeyPresent'), false);

for (const pathname of [
  '/api/mmc/coaching-pipeline/inventory',
  '/api/mmc/coaching-pipeline/worker/status',
  '/api/mmc/coaching-pipeline/worker/scan',
  '/api/mmc/coaching-pipeline/webex/status',
  '/api/mmc/coaching-pipeline/webex/recordings',
  '/api/mmc/coaching-pipeline/source-assets',
  '/api/mmc/coaching-pipeline/student-resolution/review-queue',
  '/api/mmc/coaching-pipeline/roster-verification/sources',
  '/api/mmc/coaching-pipeline/prompts',
]) {
  response = await invoke(pathname);
  assert.equal(response.status, 410, `${pathname} must be sealed.`);
  assert.equal(response.payload.error, 'mmc_legacy_pipeline_sealed');
}

for (const pathname of [
  '/api/mmc/coaching-pipeline/worker/import',
  '/api/mmc/coaching-pipeline/worker/process',
  '/api/mmc/coaching-pipeline/webex/pull',
  '/api/mmc/coaching-pipeline/source-assets/import',
  '/api/mmc/coaching-pipeline/student-resolution/resolve',
  '/api/mmc/coaching-pipeline/student-resolution/approve',
  '/api/mmc/coaching-pipeline/roster-verification/resolve',
  '/api/mmc/coaching-pipeline/roster-verification/approve',
  '/api/mmc/coaching-pipeline/prompts/activate',
  '/api/mmc/coaching-pipeline/analysis-runs/analyze',
]) {
  response = await invoke(pathname, 'POST');
  assert.equal(response.status, 403, `${pathname} must require CSRF even when the global auth flag is off.`);
  assert.equal(response.payload.error, 'CSRF_VALIDATION_FAILED');
  response = await invoke(pathname, 'POST', { 'x-mmhq-csrf': session.csrfToken });
  assert.equal(response.status, 410, `${pathname} must remain sealed after CSRF validation.`);
}

response = await invoke('/api/mmc/coaching-pipeline/status', 'GET', {}, {
  ...baseDeps,
  isAuthorizedMmcPrivateSession: () => false,
});
assert.equal(response.status, 403);
assert.equal(unsafeDependencyCalls, 0, 'Sealed routes must never reach provider, filesystem, or persistence dependencies.');

const source = await import('node:fs/promises').then(({ readFile }) => (
  readFile(new URL('../../../routes/mmc-coaching-pipeline.mjs', import.meta.url), 'utf8')
));
for (const forbidden of [
  'scanCoachingDropZone',
  'pullTriggeredWebexRecordings',
  'callOpenAiStructuredAnalysis',
  'getAiProviderConfig',
  'readFileSync',
  'DEFAULT_VIDEO_REGISTRY_PATH',
  'OPENAI_API_KEY',
]) {
  assert.equal(source.includes(forbidden), false,
    `The legacy seal module must not retain dormant operational code: ${forbidden}.`);
}

console.log(JSON.stringify({
  result: 'MMC 006-A legacy boundary seal validation passed',
  historicalStatusSafe: true,
  legacyReadsSealed: true,
  legacyMutationsCsrfThenSealed: true,
  unsafeDependencyCalls,
  operationalLegacyCodeRemoved: true,
}, null, 2));
