import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ASSET_BROKER_LIMITS,
  createInMemoryObjectAdapter,
  createNativePathAdapter,
  createOpaqueAssetBroker,
  createServerAssetAuthorityIssuer,
} from '../../../lib/mmc/assets/opaque-asset-broker.mjs';

const NOW = '2026-07-15T12:00:00.000Z';
const NOT_BEFORE = '2026-07-15T09:00:00.000Z';
const EXPIRES_AT = '2026-07-15T18:00:00.000Z';
let brokerNowMs = Date.parse(NOW);
const brokerClock = () => new Date(brokerNowMs);
const SOURCE_OBJECT_ID = 'object_fixture_recording_0001';
const MP4_BYTES = Uint8Array.from([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x00,
  0x69, 0x73, 0x6f, 0x6d,
  0x6d, 0x70, 0x34, 0x31,
]);
const authorityIssuer = createServerAssetAuthorityIssuer();
const activeGrantIds = new Set([
  'authority_grant_006_acquisition',
  'authority_grant_006_transcript_processing',
]);
const authorizeGrant = async ({ grant }) => activeGrantIds.has(grant.grantId);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function grantFixture(grantType, scope, overrides = {}) {
  return authorityIssuer.issueGrant({
    grantId: `authority_grant_006_${grantType.toLowerCase()}`,
    grantType,
    state: 'ACTIVE',
    tenantId: scope.tenantId,
    environment: scope.environment,
    subjectLinkId: scope.subjectLinkId,
    assetKind: scope.assetKind,
    notBefore: NOT_BEFORE,
    expiresAt: EXPIRES_AT,
    ...overrides,
  });
}

function contextFixture({ includeSource = true, ...overrides } = {}) {
  const scope = {
    tenantId: 'tenant_fixture_006',
    environment: 'FIXTURE',
    subjectLinkId: 'subject_link_006_student_a',
    assetKind: 'RECORDING',
    ...overrides,
  };
  const context = {
    tenantId: scope.tenantId,
    environment: scope.environment,
    subjectLinkId: scope.subjectLinkId,
    assetKind: scope.assetKind,
    acquisitionGrant: overrides.acquisitionGrant ?? grantFixture('ACQUISITION', scope),
    processingGrant: overrides.processingGrant ?? grantFixture('TRANSCRIPT_PROCESSING', scope),
  };
  if (includeSource) context.sourceObjectId = overrides.sourceObjectId ?? SOURCE_OBJECT_ID;
  return context;
}

function registrationRequest(overrides = {}) {
  return {
    requestId: 'asset_request_006_0001',
    declaredMimeType: 'video/mp4',
    declaredByteLength: MP4_BYTES.byteLength,
    expectedSha256: sha256(MP4_BYTES),
    ...overrides,
  };
}

async function expectCode(action, code, message) {
  await assert.rejects(action, (error) => error?.code === code, message);
}

assert.throws(
  () => createNativePathAdapter(),
  (error) => error?.code === 'MMC_ASSET_NATIVE_PATH_ADAPTER_DISABLED',
  'Native filesystem paths must remain default-deny; realpath is not an openat/TOCTOU proof.',
);

for (const expiresAt of [
  '2026-02-29T18:00:00.000Z',
  '2026-07-15T18:00:00.000+15:00',
]) {
  assert.throws(
    () => grantFixture('ACQUISITION', contextFixture(), { expiresAt }),
    (error) => error?.code === 'MMC_ASSET_INVALID_TIMESTAMP',
    `Asset authority timestamps must reject invalid calendar/offset value ${expiresAt}.`,
  );
}

const adapter = createInMemoryObjectAdapter({ chunkSize: 3 });
const putResult = adapter.putObject({ objectId: SOURCE_OBJECT_ID, bytes: MP4_BYTES });
assert.deepEqual(putResult, { objectId: SOURCE_OBJECT_ID, byteLength: MP4_BYTES.byteLength });
assert.equal(Object.isFrozen(putResult), true);
assert.throws(
  () => adapter.putObject({ objectId: SOURCE_OBJECT_ID, bytes: MP4_BYTES }),
  (error) => error?.code === 'MMC_ASSET_OBJECT_EXISTS',
  'The object-style adapter must reject overwrite instead of mutating registered bytes.',
);
assert.throws(
  () => createOpaqueAssetBroker({ adapter, maxByteLength: 64 }),
  (error) => error?.code === 'MMC_ASSET_AUTHORITY_DENIED',
  'A broker without a current authority adapter must fail closed.',
);

const asyncDenyBroker = createOpaqueAssetBroker({
  adapter,
  maxByteLength: 64,
  authorizeGrant: async () => false,
  clock: brokerClock,
});
await expectCode(
  () => asyncDenyBroker.registerAsset(registrationRequest(), contextFixture()),
  'MMC_ASSET_AUTHORITY_DENIED',
  'An asynchronous authority denial must never be treated as truthy authority.',
);

const broker = createOpaqueAssetBroker({ adapter, maxByteLength: 64, authorizeGrant, clock: brokerClock });
const registerResult = await broker.registerAsset(registrationRequest(), contextFixture());
assert.match(registerResult.handle, /^ast_[a-f0-9]{32}$/u);
assert.deepEqual(Object.keys(registerResult).sort(), ['handle', 'metadata']);
assert.deepEqual(Object.keys(registerResult.metadata).sort(), [
  'assetKind',
  'byteLength',
  'createdAt',
  'handle',
  'mimeType',
  'sha256',
  'state',
]);
assert.equal(Object.isFrozen(registerResult), true);
assert.equal(Object.isFrozen(registerResult.metadata), true);
assert.equal(registerResult.metadata.state, 'ACTIVE');
assert.equal(registerResult.metadata.createdAt, NOW, 'Asset timestamps must come from the broker clock.');
assert.equal(registerResult.metadata.sha256, sha256(MP4_BYTES));
const publicRegistrationJson = JSON.stringify(registerResult);
for (const forbidden of [
  SOURCE_OBJECT_ID,
  '/Users/',
  'token',
  'provider',
  'privatePayload',
  'tenant_fixture_006',
  'subject_link_006_student_a',
]) {
  assert.equal(publicRegistrationJson.includes(forbidden), false, `Public registration result leaked ${forbidden}.`);
}

const exactRegistrationReplay = await broker.registerAsset(registrationRequest(), contextFixture());
assert.equal(exactRegistrationReplay, registerResult, 'Exact request replay must return the immutable original result.');
assert.equal(exactRegistrationReplay.handle, registerResult.handle);

await expectCode(
  () => broker.registerAsset(
    registrationRequest({ expectedSha256: '0'.repeat(64) }),
    contextFixture(),
  ),
  'MMC_ASSET_IDEMPOTENCY_CONFLICT',
  'A scoped request identifier cannot be rebound to a different content hash.',
);

const alternateSourceObjectId = 'object_fixture_recording_0002';
adapter.putObject({ objectId: alternateSourceObjectId, bytes: MP4_BYTES });
await expectCode(
  () => broker.registerAsset(
    registrationRequest(),
    contextFixture({ sourceObjectId: alternateSourceObjectId }),
  ),
  'MMC_ASSET_IDEMPOTENCY_CONFLICT',
  'A scoped request identifier cannot be rebound to another immutable source object.',
);

const isolatedScopeRegistrations = await Promise.all([
  broker.registerAsset(registrationRequest(), contextFixture({ subjectLinkId: 'subject_link_006_student_b' })),
  broker.registerAsset(registrationRequest(), contextFixture({ tenantId: 'tenant_fixture_007' })),
  broker.registerAsset(registrationRequest(), contextFixture({ environment: 'LOCAL' })),
]);
assert.equal(new Set(isolatedScopeRegistrations.map((result) => result.handle)).size, 3);
assert.equal(isolatedScopeRegistrations.some((result) => result.handle === registerResult.handle), false,
  'Request identifiers must be scoped by tenant, environment, subject, and asset kind.');

const concurrentRegistrationRequest = registrationRequest({ requestId: 'asset_request_006_concurrent' });
const concurrentRegistrations = await Promise.all(Array.from({ length: 100 }, () => (
  broker.registerAsset(concurrentRegistrationRequest, contextFixture())
)));
assert.equal(new Set(concurrentRegistrations.map((result) => result.handle)).size, 1,
  'One hundred identical concurrent registrations must commit one opaque handle.');
assert.equal(concurrentRegistrations.every((result) => result === concurrentRegistrations[0]), true,
  'Concurrent exact retries must replay the same immutable receipt.');
assert.equal(JSON.stringify(concurrentRegistrations[0]).includes(SOURCE_OBJECT_ID), false);

const openContext = contextFixture({ includeSource: false });
const opened = await broker.openAsset({ handle: registerResult.handle }, openContext);
assert.equal(opened.handle, registerResult.handle);
assert.equal(opened.metadata, registerResult.metadata);
assert.deepEqual(Object.keys(opened).sort(), ['handle', 'metadata']);
assert.equal(JSON.stringify(opened).includes('bytes'), false, 'Serialized open metadata must not contain private bytes.');
const firstProcessorCopy = await opened.readBytesForProcessing();
assert.equal(Buffer.from(firstProcessorCopy).equals(Buffer.from(MP4_BYTES)), true);
assert.equal(Object.hasOwn(opened, 'path'), false);
assert.equal(Object.hasOwn(opened, 'url'), false);
assert.equal(Object.hasOwn(opened, 'provider'), false);
assert.equal(Object.hasOwn(opened, 'sourceObjectId'), false);

brokerNowMs = Date.parse('2026-07-15T19:00:00.000Z');
await expectCode(
  () => broker.openAsset({ handle: registerResult.handle }, openContext),
  'MMC_ASSET_AUTHORITY_DENIED',
  'The broker clock must expire an otherwise active durable grant.',
);
await expectCode(
  () => broker.openAsset({ handle: registerResult.handle }, { ...openContext, now: NOW }),
  'MMC_ASSET_UNKNOWN_FIELD',
  'A caller cannot forge an old operation time to reuse an expired grant.',
);
brokerNowMs = Date.parse(NOW);

firstProcessorCopy[0] = 0xff;
const openedAgain = await broker.openAsset({ handle: registerResult.handle }, openContext);
assert.equal(
  (await openedAgain.readBytesForProcessing())[0],
  MP4_BYTES[0],
  'A processor copy must not mutate the immutable object adapter.',
);

for (const [field, value] of [
  ['path', '/Users/example/private/recording.mp4'],
  ['root', '/Volumes/private'],
  ['url', 'https://provider.invalid/private'],
  ['provider', 'synthetic-provider'],
  ['providerPayload', { private: true }],
  ['dropZonePath', '../private'],
  ['symlink', '../../secret'],
  ['assetKind', 'RECORDING'],
]) {
  await expectCode(
    () => broker.registerAsset({ ...registrationRequest(), [field]: value }, contextFixture()),
    'MMC_ASSET_UNKNOWN_FIELD',
    `Browser/request field ${field} must fail exact-field validation.`,
  );
}

await expectCode(
  () => broker.openAsset({ handle: registerResult.handle, path: '/Users/example/private' }, openContext),
  'MMC_ASSET_UNKNOWN_FIELD',
  'Open requests must contain only an opaque handle.',
);

await expectCode(
  () => broker.registerAsset(
    registrationRequest(),
    { ...contextFixture(), path: '/Users/example/private/recording.mp4' },
  ),
  'MMC_ASSET_UNKNOWN_FIELD',
  'Even server context must reject path-shaped extensions.',
);

const revokedRegisterContext = contextFixture();
revokedRegisterContext.acquisitionGrant = {
  ...revokedRegisterContext.acquisitionGrant,
  state: 'REVOKED',
};
await expectCode(
  () => broker.registerAsset(registrationRequest(), revokedRegisterContext),
  'MMC_ASSET_AUTHORITY_DENIED',
  'Registration must recheck active acquisition authority.',
);

const expiredRegisterContext = contextFixture();
expiredRegisterContext.processingGrant = {
  ...expiredRegisterContext.processingGrant,
  expiresAt: NOW,
};
await expectCode(
  () => broker.registerAsset(registrationRequest(), expiredRegisterContext),
  'MMC_ASSET_AUTHORITY_DENIED',
  'Registration must recheck active processing authority.',
);

const revokedOpenContext = contextFixture({ includeSource: false });
revokedOpenContext.processingGrant = {
  ...revokedOpenContext.processingGrant,
  state: 'REVOKED',
};
await expectCode(
  () => broker.openAsset({ handle: registerResult.handle }, revokedOpenContext),
  'MMC_ASSET_AUTHORITY_DENIED',
  'Open must recheck current processing authority.',
);

const revokedOpenAcquisitionContext = contextFixture({ includeSource: false });
revokedOpenAcquisitionContext.acquisitionGrant = {
  ...revokedOpenAcquisitionContext.acquisitionGrant,
  state: 'REVOKED',
};
await expectCode(
  () => broker.openAsset({ handle: registerResult.handle }, revokedOpenAcquisitionContext),
  'MMC_ASSET_AUTHORITY_DENIED',
  'Open must recheck current acquisition authority.',
);

for (const isolatedContext of [
  contextFixture({ includeSource: false, tenantId: 'tenant_fixture_999' }),
  contextFixture({ includeSource: false, subjectLinkId: 'subject_link_006_student_b' }),
  contextFixture({ includeSource: false, environment: 'LOCAL' }),
]) {
  await expectCode(
    () => broker.openAsset({ handle: registerResult.handle }, isolatedContext),
    'MMC_ASSET_NOT_FOUND',
    'Tenant/environment/subject mismatch must reveal no handle metadata.',
  );
}

await expectCode(
  () => broker.registerAsset(
    registrationRequest(),
    contextFixture({ environment: 'LIVE' }),
  ),
  'MMC_ASSET_ADAPTER_ENVIRONMENT_DENIED',
  'The deterministic memory adapter must never bridge fixture bytes into LIVE.',
);

await expectCode(
  () => broker.registerAsset(registrationRequest({ declaredByteLength: 65 }), contextFixture()),
  'MMC_ASSET_TOO_LARGE',
  'Declared size beyond broker policy must fail before reading.',
);

await expectCode(
  () => broker.registerAsset(
    registrationRequest({
      requestId: 'asset_request_006_size_mismatch',
      declaredByteLength: MP4_BYTES.byteLength - 1,
    }),
    contextFixture(),
  ),
  'MMC_ASSET_SIZE_MISMATCH',
  'Actual streamed bytes must match the declared count.',
);

await expectCode(
  () => broker.registerAsset(
    registrationRequest({
      requestId: 'asset_request_006_hash_mismatch',
      expectedSha256: '0'.repeat(64),
    }),
    contextFixture(),
  ),
  'MMC_ASSET_HASH_MISMATCH',
  'Actual streamed SHA-256 must match the expected integrity value.',
);

await expectCode(
  () => broker.registerAsset(
    registrationRequest({ declaredMimeType: 'text/plain' }),
    contextFixture(),
  ),
  'MMC_ASSET_MIME_DENIED',
  'Asset-kind-specific MIME allowlists must fail closed.',
);

const hostileObjectId = 'object_fixture_recording_hostile';
const hostileBytes = new TextEncoder().encode('not an mp4 payload');
adapter.putObject({ objectId: hostileObjectId, bytes: hostileBytes });
await expectCode(
  () => broker.registerAsset({
    requestId: 'asset_request_006_hostile',
    declaredMimeType: 'video/mp4',
    declaredByteLength: hostileBytes.byteLength,
    expectedSha256: sha256(hostileBytes),
  }, contextFixture({ sourceObjectId: hostileObjectId })),
  'MMC_ASSET_MAGIC_INVALID',
  'Magic-byte validation must reject MIME/content disagreement.',
);

const oversizedAdapter = createInMemoryObjectAdapter({ chunkSize: 7 });
const oversizedBytes = new Uint8Array(80);
oversizedBytes.set(MP4_BYTES.subarray(0, 12));
oversizedAdapter.putObject({ objectId: 'object_fixture_recording_oversized', bytes: oversizedBytes });
const oversizedBroker = createOpaqueAssetBroker({
  adapter: oversizedAdapter,
  maxByteLength: 64,
  authorizeGrant,
  clock: brokerClock,
});
await expectCode(
  () => oversizedBroker.registerAsset({
    requestId: 'asset_request_006_oversized',
    declaredMimeType: 'video/mp4',
    declaredByteLength: 64,
    expectedSha256: sha256(oversizedBytes),
  }, contextFixture({ sourceObjectId: 'object_fixture_recording_oversized' })),
  'MMC_ASSET_TOO_LARGE',
  'Streaming byte accounting must stop content that exceeds the broker limit.',
);

let hostileError;
try {
  await broker.registerAsset(
    { ...registrationRequest(), path: '/Users/example/private/token-value.mp4' },
    contextFixture(),
  );
} catch (error) {
  hostileError = error;
}
assert.ok(hostileError);
const safeErrorText = JSON.stringify({
  code: hostileError.code,
  message: hostileError.message,
  stack: hostileError.stack,
  field: hostileError.field,
});
assert.doesNotMatch(safeErrorText, /\/Users\/example/u);
assert.doesNotMatch(safeErrorText, /token-value/u);
assert.doesNotMatch(safeErrorText, /provider\.invalid/u);
assert.doesNotMatch(safeErrorText, /MissionMed_worktrees/u);

let revokeGateEnabled = false;
let revokeGateUsed = false;
let announceRevokeGate;
let releaseRevokeGate;
const revokeGateStarted = new Promise((resolve) => { announceRevokeGate = resolve; });
const revokeGateRelease = new Promise((resolve) => { releaseRevokeGate = resolve; });
const raceBroker = createOpaqueAssetBroker({
  adapter,
  maxByteLength: 64,
  clock: brokerClock,
  authorizeGrant: async ({ grant, requiredType }) => {
    if (revokeGateEnabled && !revokeGateUsed && requiredType === 'TRANSCRIPT_PROCESSING') {
      revokeGateUsed = true;
      announceRevokeGate();
      await revokeGateRelease;
    }
    return activeGrantIds.has(grant.grantId);
  },
});
const raceRegistration = await raceBroker.registerAsset(
  registrationRequest({ requestId: 'asset_request_006_revoke_race' }),
  contextFixture(),
);
const mutableRevokeContext = contextFixture({ includeSource: false });
revokeGateEnabled = true;
const racedRevoke = raceBroker.revokeAsset({ handle: raceRegistration.handle }, mutableRevokeContext);
await revokeGateStarted;
mutableRevokeContext.tenantId = 'tenant_fixture_999';
mutableRevokeContext.acquisitionGrant = grantFixture('ACQUISITION', mutableRevokeContext);
mutableRevokeContext.processingGrant = grantFixture('TRANSCRIPT_PROCESSING', mutableRevokeContext);
releaseRevokeGate();
await assert.rejects(
  racedRevoke,
  (error) => error?.code === 'MMC_ASSET_AUTHORITY_DENIED',
  'A revoke cannot combine grants or context from different mutable scopes across awaits.',
);
const raceOpenContext = contextFixture({ includeSource: false });
assert.equal((await raceBroker.openAsset(
  { handle: raceRegistration.handle }, raceOpenContext,
)).metadata.state, 'ACTIVE', 'A denied revoke race must not alter the asset.');
const concurrentRevokes = await Promise.all(Array.from({ length: 100 }, () => (
  raceBroker.revokeAsset({ handle: raceRegistration.handle }, contextFixture({ includeSource: false }))
)));
assert.equal(new Set(concurrentRevokes.map((entry) => entry.revokedAt)).size, 1,
  'Concurrent revokes must converge on one immutable revokedAt value.');

const revoked = await broker.revokeAsset({ handle: registerResult.handle }, openContext);
assert.equal(revoked.state, 'REVOKED');
assert.equal(Object.isFrozen(revoked), true);
assert.equal(registerResult.metadata.state, 'ACTIVE', 'Prior immutable metadata snapshots must not be mutated in place.');
await expectCode(
  () => broker.openAsset({ handle: registerResult.handle }, openContext),
  'MMC_ASSET_READ_DENIED',
  'Handle revocation must fence subsequent reads.',
);
await assert.rejects(
  opened.readBytesForProcessing(),
  (error) => error?.code === 'MMC_ASSET_READ_DENIED',
  'Revocation must also fence an already-issued processing capability before byte access.',
);
assert.deepEqual(
  await broker.revokeAsset({ handle: registerResult.handle }, openContext),
  revoked,
  'Repeated revocation must be idempotent.',
);

assert.equal(ASSET_BROKER_LIMITS.DEFAULT_MAX_BYTE_LENGTH <= ASSET_BROKER_LIMITS.ABSOLUTE_MAX_BYTE_LENGTH, true);

console.log(JSON.stringify({
  result: 'MMC v2 opaque asset broker validation passed',
  adapter: 'IN_MEMORY_OBJECT',
  nativePathAdapter: 'DEFAULT_DENY',
  publicIdentity: 'OPAQUE_HANDLE_ONLY',
  streamingByteBounded: true,
  mimeAndMagicValidated: true,
  sha256Integrity: true,
  immutableMetadata: true,
  serverAttestedGrantRequired: true,
  asyncAuthorityDenyEnforced: true,
  scopedRequestIdIdempotency: true,
  concurrentRegistrationRetries: 100,
  idempotencySemanticBinding: ['SOURCE_OBJECT', 'CONTENT_SHA256', 'MIME', 'BYTE_LENGTH'],
  authorityRechecked: ['REGISTER', 'OPEN'],
  serverOwnedClock: true,
  forgedOldContextDenied: true,
  isolation: ['TENANT', 'ENVIRONMENT', 'SUBJECT', 'FIXTURE_LIVE'],
  revokedReadFenced: true,
  revokeContextRaceDenied: true,
  concurrentRevokesConverged: true,
  errorLeakage: false,
}, null, 2));
