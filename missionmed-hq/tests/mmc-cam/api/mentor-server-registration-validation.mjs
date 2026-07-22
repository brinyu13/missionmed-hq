import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  handleMmcCoachingPipelineRoute,
  isMmcCoachingPipelinePath,
} from '../../../routes/mmc-coaching-pipeline.mjs';

const tenantId = '00700000-0000-4000-8000-000000000001';
const mentorId = '00700000-0000-4000-8000-000000000002';
const session = Object.freeze({ csrfToken: 'csrf_mentor_registration_007', user: { id: 7 } });
const baseConfig = Object.freeze({
  enabled: true,
  commandsEnabled: true,
  inMemoryEnabled: true,
  tenantId,
  environment: 'FIXTURE',
  approvedOrigins: Object.freeze(['https://mmc.local.test']),
  allowLoopbackHttp: false,
  maxJsonBytes: 64 * 1024,
});

assert.equal(isMmcCoachingPipelinePath('/api/mmc/v2/mentor/today'), true);
assert.equal(isMmcCoachingPipelinePath('/api/mmc/v2/mentor/students'), true);
assert.equal(isMmcCoachingPipelinePath('/api/mmc/v2mentor/today'), false);

let response = await invoke('/api/mmc/v2/mentor/today');
assert.equal(response.status, 200);
assert.deepEqual(Object.keys(response.payload).sort(), ['data', 'meta']);
assert.equal(response.payload.data.kind, 'MENTOR_TODAY');
assert.equal(response.payload.meta.environment, 'FIXTURE');
assert.equal(response.payload.data.operatingState.providers, 'DISABLED');
assert.equal(response.payload.data.operatingState.studentPublication, 'DISABLED_UNTIL_008');

response = await invoke('/api/mmc/v2/mentor/today', {
  mentorConfig: { ...baseConfig, enabled: false },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MMC_MENTOR_EXPERIENCE_DISABLED');

response = await invoke('/api/mmc/v2/mentor/today', {
  mentorConfig: { ...baseConfig, environment: 'STAGING' },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MENTOR_DURABLE_PERSISTENCE_REQUIRED');

response = await invoke('/api/mmc/v2/mentor/today', {
  isAuthorizedMmcPrivateSession: () => false,
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'MMC_PRIVATE_FORBIDDEN');

response = await invoke('/api/mmc/v2/mentor/today', {
  buildMmcPrincipal: () => ({ id: mentorId, role: 'operator' }),
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'MENTOR_ROLE_REQUIRED');

response = await invoke('/api/mmc/v2/mentor/operations', {
  buildMmcPrincipal: () => ({ id: mentorId, role: 'operator' }),
});
assert.equal(response.status, 200);
assert.equal(response.payload.data.kind, 'MENTOR_OPERATIONS');
assert.equal(response.payload.data.providerIntegrations, 'UNAVAILABLE');
assert.equal(response.payload.data.durablePersistence, 'UNAVAILABLE');

response = await invoke('/api/mmc/coaching-pipeline/status');
assert.equal(response.status, 200);
assert.equal(response.payload.status, 'SEALED');
assert.equal(response.payload.mutationEnabled, false);

const serverSource = readFileSync(path.join(process.cwd(), 'missionmed-hq/server.mjs'), 'utf8');
const routeIndexSource = readFileSync(path.join(process.cwd(), 'missionmed-hq/routes/mmc/index.mjs'), 'utf8');
for (const pattern of [
  /MMHQ_MMC_CAM_MENTOR_ENABLED/u,
  /MMHQ_MMC_CAM_MENTOR_COMMANDS_ENABLED/u,
  /MMHQ_MMC_CAM_LOCAL_IN_MEMORY_ENABLED/u,
  /MMHQ_MMC_CAM_LOCAL_HTTP_ENABLED/u,
  /mentorConfig: getMmcMentorLocalConfig\(\)/u,
  /mentorSendJson: sendMmcPrivateJson/u,
  /const localRuntimeAllowed = !IS_PRODUCTION/u,
]) {
  assert.match(serverSource, pattern, `Missing fail-closed mentor registration pattern: ${pattern}`);
}
assert.match(routeIndexSource, /isMmcMentorPath\(url\?\.pathname\)/u);
assert.match(routeIndexSource, /handleMmcMentorRoute\(request, response, url, deps\)/u);

console.log(JSON.stringify({
  result: 'MMC CAM mentor shared-server registration validation passed',
  authenticatedPrivateBoundary: true,
  fixtureQueries: true,
  defaultOff: true,
  stagingInMemoryDenied: true,
  mentorOperatorSeparation: true,
  operationsRoleGate: true,
  historicalPipelineSealed: true,
  productionRuntimeRegistrationDenied: true,
}, null, 2));

async function invoke(pathname, overrides = {}) {
  const response = {};
  const url = new URL(`https://mmc.local.test${pathname}`);
  await handleMmcCoachingPipelineRoute({ method: 'GET', headers: {} }, response, url, {
    session,
    authHeaders: {},
    isAuthorizedMmcPrivateSession: () => true,
    buildMmcPrincipal: () => ({ id: mentorId, role: 'mentor' }),
    mentorConfig: baseConfig,
    sendJson: (target, status, payload, headers) => Object.assign(target, { status, payload, headers }),
    ...overrides,
  });
  return response;
}
