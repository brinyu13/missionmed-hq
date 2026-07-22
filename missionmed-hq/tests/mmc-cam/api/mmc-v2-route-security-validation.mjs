import assert from 'node:assert/strict';

import { MmcCommandKernel, MemoryCommandRepository } from '../../../lib/mmc/commands/command-kernel.mjs';
import { SingleWriterCutover } from '../../../lib/mmc/cutover/single-writer-cutover.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';
import { handleMmcV2Route, isMmcV2Path } from '../../../routes/mmc/index.mjs';

const session = Object.freeze({ csrfToken: 'csrf_006_route_exact', user: { id: 6 } });
const baseConfig = Object.freeze({
  gatewayEnabled: true,
  commandEnabled: true,
  inMemoryKernelEnabled: true,
  tenantId: '00600000-0000-4000-8000-000000000001',
  environment: 'LOCAL',
  approvedOrigins: Object.freeze(['https://mmc.local.test']),
  maxJsonBytes: 64 * 1024,
});
const kernel = new MmcCommandKernel({ repository: new MemoryCommandRepository() });
const cutover = new SingleWriterCutover({ tenantId: baseConfig.tenantId, environment: baseConfig.environment });
const operator = Object.freeze({
  id: '00600000-0000-4000-8000-000000000002', tenantId: baseConfig.tenantId, environment: baseConfig.environment,
  role: 'operator', capabilities: Object.freeze([MMC_CAPABILITIES.OPERATIONS]),
});
const reconciliationHash = 'a'.repeat(64);
await cutover.beginShadow({
  v1Count: 0, v2Count: 0, v1Hash: reconciliationHash, v2Hash: reconciliationHash,
}, { principal: operator });
const frozen = await cutover.freezeV1({ inflightV1Commands: 0 }, { principal: operator });
await cutover.markDrained({
  lockId: frozen.lockId, expectedGeneration: frozen.generation,
  inflightV1Commands: 0, inflightV2Commands: 0,
}, { principal: operator });
await cutover.updateReconciliation({
  v1Count: 0, v2Count: 0, v1Hash: reconciliationHash, v2Hash: reconciliationHash,
}, { principal: operator });
await cutover.switchToV2({
  lockId: frozen.lockId, expectedGeneration: frozen.generation,
}, { principal: operator });
await cutover.setFeaturePlane({ plane: 'reads', enabled: true }, { principal: operator });
await cutover.setFeaturePlane({ plane: 'commands', enabled: true }, { principal: operator });

assert.equal(isMmcV2Path('/api/mmc/v2'), true);
assert.equal(isMmcV2Path('/api/mmc/v2/commands'), true);
assert.equal(isMmcV2Path('/api/mmc/coaching-pipeline'), false);

function request(method, body, headers = {}) {
  return {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      origin: 'https://mmc.local.test',
      'sec-fetch-site': 'same-origin',
      'x-mmhq-csrf': session.csrfToken,
      ...headers,
    },
  };
}

function deps(overrides = {}) {
  return {
    session,
    authHeaders: { 'X-Auth-Fixture': 'authorized' },
    isAuthorizedMmcPrivateSession: () => true,
    buildMmcPrincipal: () => ({ id: '00600000-0000-4000-8000-000000000003', role: 'admin' }),
    v2Config: baseConfig,
    commandKernel: kernel,
    cutoverAuthority: cutover,
    sendJson: (response, status, payload, headers) => Object.assign(response, { status, payload, headers }),
    ...overrides,
  };
}

async function invoke(pathname, req, overrides = {}) {
  const response = {};
  await handleMmcV2Route(req, response, new URL(`https://mmc.local.test${pathname}`), deps(overrides));
  return response;
}

let response = await invoke('/api/mmc/v2/status', request('GET', null));
assert.equal(response.status, 200);
assert.equal(response.payload.data.authority, 'CAM_V2');
assert.equal(response.payload.data.persistence, 'LOCAL_IN_MEMORY_FOUNDATION');
assert.equal(response.payload.data.featurePlanes.ingest, false);
assert.equal(response.payload.data.featurePlanes.reads, false, 'No v2 read endpoint is implemented yet.');
assert.equal(response.payload.data.featurePlanes.commands, true);
assert.equal(response.payload.data.writerState, 'V2_WRITER');
assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
assert.match(response.headers['Content-Security-Policy'], /default-src 'none'/u);
assert.equal(Object.hasOwn(response.payload.data, 'projectRef'), false);

response = await invoke('/api/mmc/v2/status', request('GET', null), {
  v2Config: { ...baseConfig, gatewayEnabled: false },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MMC_V2_GATEWAY_DISABLED');
assert.equal(Object.hasOwn(response.payload, 'stack'), false);

response = await invoke('/api/mmc/v2/status', request('GET', null), {
  v2Config: { ...baseConfig, tenantId: 'opaque_tenant_not_durable' },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MMC_V2_TENANT_UNAVAILABLE');

response = await invoke('/api/mmc/v2/status', request('GET', null), {
  buildMmcPrincipal: () => ({ id: 'opaque_principal_not_durable', role: 'admin' }),
});
assert.equal(response.status, 401);
assert.equal(response.payload.error.code, 'MMC_V2_PRINCIPAL_UUID_REQUIRED');

const command = {
  commandId: '00600000-0000-4000-8000-000000000101',
  idempotencyKey: 'idem_route_006_0001', expectedVersion: 0,
  targetId: '00600000-0000-4000-8000-000000000201',
  kind: 'task.upsert', purpose: 'Create a local synthetic command proof.',
  payload: { title: 'Review bounded route proof', ownerType: 'MENTOR', status: 'ACCEPTED', sensitivity: 'NORMAL' },
  schemaVersion: 1,
};
response = await invoke('/api/mmc/v2/commands', request('POST', command));
assert.equal(response.status, 200);
assert.equal(response.payload.status, 'COMMITTED');
assert.equal(response.payload.replayed, false);
response = await invoke('/api/mmc/v2/commands', request('POST', command));
assert.equal(response.status, 200);
assert.equal(response.payload.replayed, true);
assert.equal(cutover.snapshot().acknowledgedV2Writes, 1, 'A replay must not create a second acknowledged v2 write.');
response = await invoke('/api/mmc/v2/commands', request('POST', {
  ...command,
  commandId: '00600000-0000-4000-8000-000000000198',
  idempotencyKey: 'idem_route_006_version_conflict',
}));
assert.equal(response.status, 409);
assert.deepEqual(response.payload.error.conflict, {
  expectedVersion: 0,
  currentVersion: 1,
  resolution: 'COMPARE_AND_REAPPLY',
});

response = await invoke('/api/mmc/v2/commands', request('POST', {
  ...command,
  commandId: '00600000-0000-4000-8000-000000000199',
  idempotencyKey: 'idem_route_006_opaque_target',
  targetId: 'opaque_target_not_durable',
}));
assert.equal(response.status, 422);
assert.equal(response.payload.error.code, 'MMC_V2_TARGET_UUID_REQUIRED');

response = await invoke('/api/mmc/v2/commands', request('POST', {
  ...command,
  commandId: '0190A1B2-C3D4-9E5F-8A9B-0C1D2E3F4A5B',
  idempotencyKey: 'idem_route_006_unknown_uuid_version',
  targetId: '0190b1c2-d3e4-7f50-9a0b-1c2d3e4f5a6b',
}));
assert.equal(response.status, 422);
assert.equal(response.payload.error.code, 'MMC_V2_COMMAND_UUID_REQUIRED');

response = await invoke('/api/mmc/v2/commands', request('POST', {
  ...command,
  commandId: '0190A1B2-C3D4-7E5F-8A9B-0C1D2E3F4A5B',
  idempotencyKey: 'idem_route_006_uuid_v7_canonicalized',
  targetId: '0190B1C2-D3E4-7F50-9A0B-1C2D3E4F5A6B',
}));
assert.equal(response.status, 200);
assert.equal(response.payload.commandId, '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
assert.equal(response.payload.objectResults[0].id, '0190b1c2-d3e4-7f50-9a0b-1c2d3e4f5a6b');

response = await invoke('/api/mmc/v2/commands', request('POST', {
  ...command,
  commandId: '00600000-0000-4000-8000-000000000102',
  idempotencyKey: 'idem_route_006_cutover_missing',
  targetId: '00600000-0000-4000-8000-000000000202',
}), { cutoverAuthority: undefined });
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MMC_V2_CUTOVER_AUTHORITY_REQUIRED');

response = await invoke('/api/mmc/v2/commands', request('POST', command, {
  origin: 'https://mmc.local.test.attacker.example',
}));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'ORIGIN_FORBIDDEN');

response = await invoke('/api/mmc/v2/commands', request('POST', command, { 'x-mmhq-csrf': '' }));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'CSRF_VALIDATION_FAILED');

response = await invoke('/api/mmc/v2/commands', request('POST', command, { 'x-mmhq-csrf': 12345678 }), {
  session: { csrfToken: 12345678, user: { id: 6 } },
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'CSRF_VALIDATION_FAILED');

response = await invoke('/api/mmc/v2/commands', request('POST', Buffer.from([0xc3, 0x28])));
assert.equal(response.status, 400);
assert.equal(response.payload.error.code, 'MALFORMED_UTF8');

response = await invoke('/api/mmc/v2/commands', request('POST', 'x'.repeat(64 * 1024 + 1)));
assert.equal(response.status, 413);
assert.equal(response.payload.error.code, 'PAYLOAD_TOO_LARGE');

response = await invoke('/api/mmc/v2/commands', request('POST', command), {
  buildMmcPrincipal: () => ({ id: '00600000-0000-4000-8000-000000000004', role: 'mentor' }),
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'MMC_V2_ASSIGNMENT_AUTHZ_UNAVAILABLE');

response = await invoke('/api/mmc/v2/commands', request('POST', command), {
  v2Config: { ...baseConfig, environment: 'LIVE' },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MMC_V2_DURABLE_PERSISTENCE_REQUIRED');

response = await invoke('/api/mmc/v2/commands', request('POST', command), {
  isAuthorizedMmcPrivateSession: () => false,
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'MMC_PRIVATE_FORBIDDEN');

console.log(JSON.stringify({
  result: 'MMC v2 route security validation passed',
  gatewayDefaultOff: true,
  cutoverAuthorityRequired: true,
  securityHeaders: true,
  exactOrigin: true,
  unconditionalCsrf: true,
  malformedUtf8Rejected: true,
  boundedJson: true,
  mentorAssignmentFailClosed: true,
  liveInMemoryDenied: true,
  privateAuthRequired: true,
  canonicalDurableUuidBoundary: true,
  canonicalVersionConflictEnvelope: true,
}, null, 2));
