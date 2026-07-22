import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  ATTESTED_IDENTITY_SCHEMA,
  ATTESTED_IDENTITY_SIGNATURE_ALGORITHM,
  IDENTITY_ENVIRONMENT,
  IDENTITY_STATE,
  MemoryEvidenceNonceGuard,
  createAttestedEvidenceVerifier,
  createAttestedIdentityResolver,
  createIdentityResolutionPolicy,
  createServerAdapterSigner,
  createTrustedAdapterRegistry,
} from '../../../lib/mmc/identity/attested-identity-kernel.mjs';

const ISSUER = 'missionmed.server.identity-adapters';
const AUDIENCE = 'missionmed.mmc.identity-kernel';
const TENANT_ALPHA = 'tenant_alpha_006';
const TENANT_BETA = 'tenant_beta_006';
const NOW = '2026-07-15T12:00:00.000Z';
const OBSERVED_AT = '2026-07-15T11:59:00.000Z';
const EXPIRES_AT = '2026-07-15T13:00:00.000Z';
const COMPLETED_AT = '2026-07-15T11:30:00.000Z';
const CURRENT_SECRET = 'current-adapter-key-material-006-'.repeat(2);
const OLD_SECRET = 'retiring-adapter-key-material-005-'.repeat(2);
const SECONDARY_SECRET = 'secondary-adapter-key-material-006-'.repeat(2);
const CURRENT_KEY = key('key_current_006', CURRENT_SECRET, 'ACTIVE');
const EXPECTED_ADVERSARIAL_DATASET_HASH = 'sha256:2ce966b55dcc8356ebfeee0d50dec5848da106d4de58d423c3ce95f4d316eff2';
let identityNowMs = Date.parse(NOW);
const identityClock = () => new Date(identityNowMs);
const identityResolver = createAttestedIdentityResolver({ clock: identityClock });
let sequence = 0;

assert.deepEqual(Object.values(IDENTITY_STATE), [
  'UNVERIFIED',
  'PROBABLE',
  'MANUAL_REVIEW',
  'CONFLICT',
  'VERIFIED_LOCAL_LINK',
  'REVOKED',
]);
assert.equal(Object.isFrozen(IDENTITY_STATE), true);
assert.equal(Object.isFrozen(IDENTITY_ENVIRONMENT), true);

const registry = buildRegistry({ defaultKeys: [CURRENT_KEY] });
const registryDescription = registry.describe();
assert.equal(Object.isFrozen(registryDescription), true);
assert.equal(JSON.stringify(registry).includes(CURRENT_SECRET), false, 'Registry JSON must never expose signing material.');
assert.equal(JSON.stringify(registryDescription).includes(CURRENT_SECRET), false, 'Registry descriptions must redact key material.');

const rosterSigner = signerFor(registry, 'institutional-roster-adapter');
const applicationSigner = signerFor(registry, 'application-authority-adapter');
const rosterMirrorSigner = signerFor(registry, 'institutional-roster-mirror');

const envelopeA = signEvidence(rosterSigner, {
  anchorValue: '  stu-0001  ',
  field: 'student.institutional_id',
  sourceRecordScheme: 'OPAQUE_ID',
});
const envelopeB = signEvidence(applicationSigner, {
  anchorValue: 'STU-0001',
  field: 'application.student_id',
  sourceRecordScheme: 'HMAC_SHA256',
});

assert.equal(envelopeA.schema, ATTESTED_IDENTITY_SCHEMA);
assert.equal(envelopeA.signature.algorithm, ATTESTED_IDENTITY_SIGNATURE_ALGORITHM);
assert.equal(Object.isFrozen(envelopeA), true);
assert.equal(Object.hasOwn(envelopeA, 'payload'), false, 'Signed envelopes retain only the payload hash.');
assert.equal(JSON.stringify(envelopeB).includes('raw-upstream-record'), false, 'HMAC record references must hide raw upstream IDs.');
assert.match(envelopeB.source.record.value, /^hmac-sha256:[a-f0-9]{64}$/u);

const guard = new MemoryEvidenceNonceGuard();
const evidenceA = verify(envelopeA, { registry, replayGuard: guard });
const evidenceB = verify(envelopeB, { registry, replayGuard: guard });
assert.equal(evidenceA.evidenceId, envelopeA.evidenceId);
assert.equal(evidenceA.tenantId, TENANT_ALPHA);
assert.equal(evidenceA.environment, 'LOCAL');
assert.equal(Object.isFrozen(evidenceA), true);
assert.equal(Object.hasOwn(evidenceA, 'signature'), false);
assert.equal(Object.hasOwn(evidenceA, 'rawAnchorValue'), false);

const localPolicy = createIdentityResolutionPolicy({
  policyVersion: 'identity-policy-006.1',
  approvedSourceFamilies: ['institutional-roster', 'application-authority'],
  strongAnchorTypes: ['INSTITUTIONAL_STUDENT_ID'],
  automaticPromotionEnvironments: ['LOCAL'],
  subjectAnchorBindings: [subjectBinding('subject_ref_alpha_0001', 'LOCAL', 'STU-0001')],
  liveEvaluation: null,
});
const manualPolicy = createIdentityResolutionPolicy({
  policyVersion: 'identity-policy-006.1-manual',
  approvedSourceFamilies: ['institutional-roster', 'application-authority'],
  strongAnchorTypes: ['INSTITUTIONAL_STUDENT_ID'],
  automaticPromotionEnvironments: [],
  subjectAnchorBindings: [subjectBinding('subject_ref_alpha_0001', 'LOCAL', 'STU-0001')],
  liveEvaluation: null,
});
const localCandidate = candidate(TENANT_ALPHA, 'LOCAL', 'subject_ref_alpha_0001');

const automaticLink = resolve([evidenceA, evidenceB], localCandidate, localPolicy);
assert.equal(automaticLink.state, IDENTITY_STATE.VERIFIED_LOCAL_LINK);
assert.equal(automaticLink.automatic, true);
assert.equal(automaticLink.reason, 'TWO_INDEPENDENT_ATTESTED_AUTHORITIES_EXACT_ANCHOR');
assert.equal(automaticLink.policyVersion, 'identity-policy-006.1');
assert.deepEqual(automaticLink.evidenceIds, [evidenceA.evidenceId, evidenceB.evidenceId].sort());
assert.deepEqual(automaticLink.independentSourceFamilies, ['application-authority', 'institutional-roster']);
assert.match(automaticLink.matchedAnchor.valueDigest, /^sha256:[a-f0-9]{64}$/u);
assert.equal(Object.isFrozen(automaticLink), true);

const arbitrarySubjectAttack = resolve(
  [evidenceA, evidenceB],
  candidate(TENANT_ALPHA, 'LOCAL', 'subject_ref_arbitrary_victim'),
  localPolicy,
);
assert.equal(arbitrarySubjectAttack.state, IDENTITY_STATE.MANUAL_REVIEW);
assert.equal(arbitrarySubjectAttack.reason, 'SUBJECT_ANCHOR_BINDING_MISSING_OR_MISMATCH');

const unverified = resolve([], localCandidate, localPolicy);
assert.equal(unverified.state, IDENTITY_STATE.UNVERIFIED);
assert.equal(unverified.reason, 'NO_ATTESTED_EVIDENCE');

const probable = resolve([evidenceA], localCandidate, localPolicy);
assert.equal(probable.state, IDENTITY_STATE.PROBABLE);
assert.equal(probable.automatic, false);

const mirrorEnvelope = signEvidence(rosterMirrorSigner, {
  anchorValue: 'STU-0001',
  field: 'mirror.student_id',
});
const mirrorEvidence = verify(mirrorEnvelope, { registry, replayGuard: guard });
const sameFamilyOnly = resolve([evidenceA, mirrorEvidence], localCandidate, localPolicy);
assert.equal(sameFamilyOnly.state, IDENTITY_STATE.PROBABLE, 'Two adapters from one upstream family count once.');
assert.deepEqual(sameFamilyOnly.independentSourceFamilies, ['institutional-roster']);

const weakNameA = verify(signEvidence(rosterSigner, {
  anchorType: 'FULL_NAME',
  anchorValue: 'Same Name',
  field: 'student.full_name',
}), { registry, replayGuard: guard });
const weakNameB = verify(signEvidence(applicationSigner, {
  anchorType: 'FULL_NAME',
  anchorValue: 'Same Name',
  field: 'application.full_name',
}), { registry, replayGuard: guard });
const weakOnly = resolve([weakNameA, weakNameB], localCandidate, localPolicy);
assert.equal(weakOnly.state, IDENTITY_STATE.MANUAL_REVIEW, 'Name-only evidence can never verify identity.');
assert.equal(weakOnly.reason, 'NO_POLICY_APPROVED_STRONG_ANCHOR');

const autoDisabled = resolve([evidenceA, evidenceB], localCandidate, manualPolicy);
assert.equal(autoDisabled.state, IDENTITY_STATE.MANUAL_REVIEW);
assert.equal(autoDisabled.reason, 'AUTOMATIC_PROMOTION_DISABLED');

const conflictingEvidenceB = verify(signEvidence(applicationSigner, {
  anchorValue: 'STU-9999',
  field: 'application.student_id',
}), { registry, replayGuard: guard });
const conflict = resolve([evidenceA, conflictingEvidenceB], localCandidate, localPolicy);
assert.equal(conflict.state, IDENTITY_STATE.CONFLICT);
assert.equal(conflict.reason, 'CONTRADICTORY_STRONG_ANCHORS');
assert.deepEqual(conflict.conflictingAnchorTypes, ['INSTITUTIONAL_STUDENT_ID']);
assert.equal(conflict.automatic, false);

const revoked = identityResolver.resolve({
  evidence: [evidenceA, evidenceB],
  candidate: localCandidate,
  policy: localPolicy,
  revokedEvidenceIds: [],
  revocation: {
    state: 'REVOKED',
    reasonCode: 'WRONG_SUBJECT_LINK',
    revokedAt: '2026-07-15T11:58:00.000Z',
  },
});
assert.equal(revoked.state, IDENTITY_STATE.REVOKED);
assert.equal(revoked.reason, 'WRONG_SUBJECT_LINK');
assert.deepEqual(revoked.evidenceIds, [evidenceA.evidenceId, evidenceB.evidenceId].sort());

assertCode(
  () => resolve([structuredClone(evidenceA)], localCandidate, localPolicy),
  'UNATTESTED_IDENTITY_EVIDENCE',
  'A browser/client JSON copy must lose server attestation authority.',
);
assertCode(
  () => resolve([evidenceA], localCandidate, structuredClone(localPolicy)),
  'IDENTITY_POLICY_AUTHORITY_REQUIRED',
  'A browser/client policy lookalike must carry no authority.',
);
assertCode(
  () => rosterSigner.sign({ ...signingInput(), assertions: [{ field: 'student.id', anchorType: 'BROWSER_CONFIDENCE', value: '1.0' }] }),
  'EVIDENCE_ANCHOR_TYPE_REJECTED',
);
const callerWeightedInput = signingInput();
callerWeightedInput.assertions = [{
  field: 'student.institutional_id',
  anchorType: 'INSTITUTIONAL_STUDENT_ID',
  value: 'STU-CALLER-WEIGHT',
  confidence: 1,
}];
assertCode(
  () => rosterSigner.sign(callerWeightedInput),
  'IDENTITY_EXACT_FIELDS_REQUIRED',
  'Caller-authored confidence cannot enter an attested field assertion.',
);

assertCode(
  () => rosterSigner.sign({ ...signingInput(), observedAt: '2026-02-29T11:59:00.000Z' }),
  'EVIDENCE_OBSERVED_AT_INVALID',
  'Signed identity evidence must reject impossible calendar dates.',
);
assertCode(
  () => rosterSigner.sign({ ...signingInput(), observedAt: '0000-01-01T11:59:00.000Z' }),
  'EVIDENCE_OBSERVED_AT_INVALID',
  'Signed identity evidence must reject RFC3339 year zero.',
);
assertCode(
  () => rosterSigner.sign({ ...signingInput(), evidenceId: 12345678 }),
  'EVIDENCE_ID_INVALID',
  'Typed identity identifiers must never coerce numeric JSON values to strings.',
);
assertCode(
  () => rosterSigner.sign({ ...signingInput(), nonce: 1234567890123456 }),
  'EVIDENCE_NONCE_INVALID',
  'Typed evidence nonces must never coerce numeric JSON values to strings.',
);

const browserAuthorityField = { ...structuredClone(envelopeA), browserAuthority: true };
assertVerifyCode(browserAuthorityField, 'IDENTITY_EXACT_FIELDS_REQUIRED');

const tamperedPayload = structuredClone(envelopeA);
tamperedPayload.payloadHash = `sha256:${'0'.repeat(64)}`;
assertVerifyCode(tamperedPayload, 'EVIDENCE_SIGNATURE_INVALID');

const tamperedAssertion = structuredClone(envelopeA);
tamperedAssertion.assertions[0].valueDigest = `sha256:${'1'.repeat(64)}`;
assertVerifyCode(tamperedAssertion, 'EVIDENCE_SIGNATURE_INVALID');

const wrongIssuer = structuredClone(envelopeA);
wrongIssuer.issuer = 'attacker.server.identity-adapters';
assertVerifyCode(wrongIssuer, 'EVIDENCE_ISSUER_REJECTED');

const wrongAudience = structuredClone(envelopeA);
wrongAudience.audience = 'attacker.mmc.identity-kernel';
assertVerifyCode(wrongAudience, 'EVIDENCE_AUDIENCE_REJECTED');

const wrongAdapterVersion = structuredClone(envelopeA);
wrongAdapterVersion.adapter.version = '9.9.9';
assertVerifyCode(wrongAdapterVersion, 'EVIDENCE_ADAPTER_UNTRUSTED');

const wrongSourceFamily = structuredClone(envelopeA);
wrongSourceFamily.source.family = 'attacker-source-family';
assertVerifyCode(wrongSourceFamily, 'EVIDENCE_SOURCE_FAMILY_REJECTED');

const wrongKey = structuredClone(envelopeA);
wrongKey.keyId = 'key_unknown_006';
assertVerifyCode(wrongKey, 'EVIDENCE_KEY_UNTRUSTED');

const wrongMaterialRegistry = buildRegistry({
  adapterIds: ['institutional-roster-adapter'],
  defaultKeys: [key('key_current_006', SECONDARY_SECRET, 'ACTIVE')],
});
assertVerifyCode(envelopeA, 'EVIDENCE_SIGNATURE_INVALID', { registry: wrongMaterialRegistry });

const crossTenantEnvelope = signEvidence(rosterSigner, { anchorValue: 'STU-TENANT-1' });
assertVerifyCode(crossTenantEnvelope, 'EVIDENCE_TENANT_MISMATCH', {
  expectedTenantId: TENANT_BETA,
});

const fixtureEnvelope = signEvidence(rosterSigner, {
  environment: 'FIXTURE',
  anchorValue: 'FIXTURE-STU-1',
});
assertVerifyCode(fixtureEnvelope, 'EVIDENCE_ENVIRONMENT_MISMATCH', {
  expectedEnvironment: 'LIVE',
});
const fixtureEvidence = verify(fixtureEnvelope, {
  registry,
  replayGuard: new MemoryEvidenceNonceGuard(),
  expectedEnvironment: 'FIXTURE',
});
assertCode(
  () => resolve([fixtureEvidence], candidate(TENANT_ALPHA, 'LIVE', 'subject_ref_live_0001'), localPolicy),
  'IDENTITY_ENVIRONMENT_ISOLATION_VIOLATION',
);
assertCode(
  () => resolve([evidenceA], candidate(TENANT_BETA, 'LOCAL', 'subject_ref_beta_0001'), localPolicy),
  'IDENTITY_TENANT_ISOLATION_VIOLATION',
);

const replayEnvelope = signEvidence(rosterSigner, { anchorValue: 'STU-REPLAY-1' });
const replayGuard = new MemoryEvidenceNonceGuard();
verify(replayEnvelope, { registry, replayGuard });
assertVerifyCode(replayEnvelope, 'EVIDENCE_NONCE_REPLAYED', { replayGuard });

const nonceEnvelope = signEvidence(rosterSigner, { anchorValue: 'STU-NONCE-1' });
assertVerifyCode(nonceEnvelope, 'EVIDENCE_NONCE_MISMATCH', { expectedNonce: 'nonce_wrong_binding_006' });

const expiredSigner = signerFor(registry, 'institutional-roster-adapter', {
  clock: () => new Date('2026-07-15T10:01:00.000Z'),
});
const expiredEnvelope = signEvidence(expiredSigner, {
  observedAt: '2026-07-15T10:00:00.000Z',
  expiresAt: '2026-07-15T10:30:00.000Z',
  anchorValue: 'STU-EXPIRED-1',
});
assertVerifyCode(expiredEnvelope, 'EVIDENCE_EXPIRED');
const forgedOldTimeVerifier = createAttestedEvidenceVerifier({
  registry,
  replayGuard: new MemoryEvidenceNonceGuard(),
  clock: identityClock,
});
assertCode(
  () => forgedOldTimeVerifier.verify(expiredEnvelope, {
    expectedTenantId: expiredEnvelope.tenantId,
    expectedEnvironment: expiredEnvelope.environment,
    expectedNonce: expiredEnvelope.nonce,
    now: '2026-07-15T10:15:00.000Z',
  }),
  'IDENTITY_EXACT_FIELDS_REQUIRED',
  'A caller cannot forge an old verification time to revive expired evidence.',
);

const futureSigner = signerFor(registry, 'institutional-roster-adapter', {
  clock: () => new Date('2026-07-15T12:10:00.000Z'),
});
const futureEnvelope = signEvidence(futureSigner, {
  observedAt: '2026-07-15T12:10:00.000Z',
  expiresAt: '2026-07-15T13:10:00.000Z',
  anchorValue: 'STU-FUTURE-1',
});
assertVerifyCode(futureEnvelope, 'EVIDENCE_NOT_YET_VALID');

const oldActiveRegistry = buildRegistry({
  adapterIds: ['institutional-roster-adapter'],
  defaultKeys: [key('key_old_005', OLD_SECRET, 'ACTIVE')],
});
const oldSigner = signerFor(oldActiveRegistry, 'institutional-roster-adapter', { keyId: 'key_old_005' });
const oldEnvelope = signEvidence(oldSigner, { anchorValue: 'STU-ROTATION-1' });
const rotatedRegistry = buildRegistry({
  adapterIds: ['institutional-roster-adapter'],
  defaultKeys: [
    key('key_old_005', OLD_SECRET, 'RETIRING'),
    key('key_current_006', SECONDARY_SECRET, 'ACTIVE'),
  ],
});
const rotatedOldEvidence = verify(oldEnvelope, {
  registry: rotatedRegistry,
  replayGuard: new MemoryEvidenceNonceGuard(),
});
assert.equal(rotatedOldEvidence.keyId, 'key_old_005', 'A bounded retiring key must verify during rotation.');
const rotatedCurrentSigner = signerFor(rotatedRegistry, 'institutional-roster-adapter', {
  keyId: 'key_current_006',
});
const rotatedCurrentEnvelope = signEvidence(rotatedCurrentSigner, { anchorValue: 'STU-ROTATION-2' });
assert.equal(verify(rotatedCurrentEnvelope, {
  registry: rotatedRegistry,
  replayGuard: new MemoryEvidenceNonceGuard(),
}).keyId, 'key_current_006');

const revokedKeyRegistry = buildRegistry({
  adapterIds: ['institutional-roster-adapter'],
  defaultKeys: [
    key('key_old_005', OLD_SECRET, 'REVOKED'),
    key('key_current_006', SECONDARY_SECRET, 'ACTIVE'),
  ],
});
assertVerifyCode(oldEnvelope, 'EVIDENCE_KEY_REVOKED', { registry: revokedKeyRegistry });

assertCode(
  () => createIdentityResolutionPolicy({
    policyVersion: 'identity-policy-live-unqualified',
    approvedSourceFamilies: ['institutional-roster', 'application-authority'],
    strongAnchorTypes: ['INSTITUTIONAL_STUDENT_ID'],
    automaticPromotionEnvironments: ['LIVE'],
    subjectAnchorBindings: [],
    liveEvaluation: {
      pairCount: 4999,
      falsePromotions: 0,
      datasetHash: `sha256:${'a'.repeat(64)}`,
      completedAt: COMPLETED_AT,
    },
  }),
  'IDENTITY_LIVE_SIGNED_EVALUATION_REQUIRED',
);

const ADVERSARIAL_PAIR_COUNT = 5000;
const corpusGuard = new MemoryEvidenceNonceGuard();
const corpusHash = crypto.createHash('sha256');
const random = mulberry32(0x5eed0006);
let falsePromotions = 0;
let conflictPairs = 0;

for (let index = 0; index < ADVERSARIAL_PAIR_COUNT; index += 1) {
  const [leftAnchor, rightAnchor] = adversarialNegativePair(index, random);
  corpusHash.update(`${index}\u001f${leftAnchor}\u001f${rightAnchor}\n`, 'utf8');
  const leftEnvelope = signEvidence(rosterSigner, {
    anchorValue: leftAnchor,
    field: 'student.institutional_id',
    payload: { corpus: 'negative-pairs-v1', pair: index, side: 'left' },
  });
  const rightEnvelope = signEvidence(applicationSigner, {
    anchorValue: rightAnchor,
    field: 'application.student_id',
    payload: { corpus: 'negative-pairs-v1', pair: index, side: 'right' },
  });
  const leftEvidence = verify(leftEnvelope, { registry, replayGuard: corpusGuard });
  const rightEvidence = verify(rightEnvelope, { registry, replayGuard: corpusGuard });
  const decision = resolve(
    [leftEvidence, rightEvidence],
    candidate(TENANT_ALPHA, 'LOCAL', `subject_negative_${String(index).padStart(5, '0')}`),
    localPolicy,
  );
  if (decision.state === IDENTITY_STATE.VERIFIED_LOCAL_LINK) falsePromotions += 1;
  if (decision.state === IDENTITY_STATE.CONFLICT) conflictPairs += 1;
}

const adversarialDatasetHash = `sha256:${corpusHash.digest('hex')}`;
assert.equal(falsePromotions, 0, 'The deterministic 5,000-pair negative corpus must have zero false promotions.');
assert.equal(conflictPairs, ADVERSARIAL_PAIR_COUNT, 'Every deliberately contradictory strong-anchor pair must remain a conflict.');
assert.equal(corpusGuard.size, ADVERSARIAL_PAIR_COUNT * 2);
assert.equal(adversarialDatasetHash, buildAdversarialCorpusHash(), 'The adversarial corpus hash must be deterministic.');
assert.equal(adversarialDatasetHash, EXPECTED_ADVERSARIAL_DATASET_HASH, 'The seeded corpus must retain its locked release-gate hash.');

const liveManualPolicy = createIdentityResolutionPolicy({
  policyVersion: 'identity-policy-live-manual-006',
  approvedSourceFamilies: ['institutional-roster', 'application-authority'],
  strongAnchorTypes: ['INSTITUTIONAL_STUDENT_ID'],
  automaticPromotionEnvironments: [],
  subjectAnchorBindings: [subjectBinding('subject_ref_live_qualified_0001', 'LIVE', 'LIVE-STU-0001')],
  liveEvaluation: null,
});
assertCode(
  () => createIdentityResolutionPolicy({
    policyVersion: 'identity-policy-live-qualified-but-unsigned-006',
    approvedSourceFamilies: ['institutional-roster', 'application-authority'],
    strongAnchorTypes: ['INSTITUTIONAL_STUDENT_ID'],
    automaticPromotionEnvironments: ['LIVE'],
    subjectAnchorBindings: [subjectBinding('subject_ref_live_qualified_0001', 'LIVE', 'LIVE-STU-0001')],
    liveEvaluation: {
      pairCount: ADVERSARIAL_PAIR_COUNT,
      falsePromotions,
      datasetHash: adversarialDatasetHash,
      completedAt: COMPLETED_AT,
    },
  }),
  'IDENTITY_LIVE_SIGNED_EVALUATION_REQUIRED',
  'Caller-supplied evaluation metadata cannot authorize live automatic identity promotion.',
);
const liveGuard = new MemoryEvidenceNonceGuard();
const liveEvidenceA = verify(signEvidence(rosterSigner, {
  environment: 'LIVE',
  anchorValue: 'LIVE-STU-0001',
}), { registry, replayGuard: liveGuard, expectedEnvironment: 'LIVE' });
const liveEvidenceB = verify(signEvidence(applicationSigner, {
  environment: 'LIVE',
  anchorValue: ' live-stu-0001 ',
}), { registry, replayGuard: liveGuard, expectedEnvironment: 'LIVE' });
const liveCandidate = candidate(TENANT_ALPHA, 'LIVE', 'subject_ref_live_qualified_0001');
const liveBeforeQualification = resolve([liveEvidenceA, liveEvidenceB], liveCandidate, liveManualPolicy);
assert.equal(liveBeforeQualification.state, IDENTITY_STATE.MANUAL_REVIEW);
assert.equal(liveBeforeQualification.reason, 'AUTOMATIC_PROMOTION_DISABLED');

const revokedEvidenceDecision = identityResolver.resolve({
  evidence: [evidenceA, evidenceB],
  candidate: localCandidate,
  policy: localPolicy,
  revokedEvidenceIds: [evidenceA.evidenceId, evidenceB.evidenceId],
});
assert.equal(revokedEvidenceDecision.state, IDENTITY_STATE.MANUAL_REVIEW);
assert.equal(revokedEvidenceDecision.reason, 'ATTESTED_EVIDENCE_EXPIRED_OR_REVOKED');
assert.deepEqual(revokedEvidenceDecision.revokedEvidenceIds, [evidenceA.evidenceId, evidenceB.evidenceId].sort());
assertCode(
  () => identityResolver.resolve({
    evidence: [evidenceA],
    candidate: localCandidate,
    policy: localPolicy,
    now: OBSERVED_AT,
  }),
  'IDENTITY_UNKNOWN_FIELD',
  'A caller cannot forge an old decision time to keep identity evidence current.',
);

console.log(JSON.stringify({
  result: 'MMC v2 attested identity kernel validation passed',
  schema: ATTESTED_IDENTITY_SCHEMA,
  decisionStates: Object.values(IDENTITY_STATE),
  automaticLocalLink: automaticLink.state,
  sameFamilyDeduplicated: sameFamilyOnly.state,
  conflictState: conflict.state,
  revocationState: revoked.state,
  keyRotationVerified: true,
  replayDenied: true,
  fixtureLiveIsolation: true,
  adversarialNegativePairs: ADVERSARIAL_PAIR_COUNT,
  falsePromotions,
  arbitrarySubjectPromotionDenied: true,
  adversarialDatasetHash,
  liveAutomaticPromotion: 'FAIL_CLOSED_UNTIL_SIGNED_DURABLE_EVALUATION_AUTHORITY',
  serverOwnedVerificationClock: true,
  serverOwnedDecisionClock: true,
  forgedOldTimeDenied: true,
}, null, 2));

function buildRegistry(options = {}) {
  const adapterIds = options.adapterIds || [
    'institutional-roster-adapter',
    'application-authority-adapter',
    'institutional-roster-mirror',
  ];
  const sourceFamilyByAdapter = {
    'institutional-roster-adapter': 'institutional-roster',
    'application-authority-adapter': 'application-authority',
    'institutional-roster-mirror': 'institutional-roster',
  };
  return createTrustedAdapterRegistry({
    issuer: ISSUER,
    audience: AUDIENCE,
    maxEvidenceLifetimeMs: 24 * 60 * 60 * 1000,
    adapters: adapterIds.map((adapterId) => ({
      adapterId,
      adapterVersion: '1.0.0',
      sourceFamily: sourceFamilyByAdapter[adapterId],
      allowedAnchorTypes: ['INSTITUTIONAL_STUDENT_ID', 'FULL_NAME', 'EMAIL'],
      environments: ['FIXTURE', 'LOCAL', 'STAGING', 'LIVE'],
      tenantIds: [TENANT_ALPHA, TENANT_BETA],
      keys: options.defaultKeys,
    })),
  });
}

function key(keyId, secret, status) {
  return {
    keyId,
    secret,
    status,
    notBefore: '2026-01-01T00:00:00.000Z',
    notAfter: '2027-01-01T00:00:00.000Z',
  };
}

function signerFor(targetRegistry, adapterId, options = {}) {
  return createServerAdapterSigner({
    registry: targetRegistry,
    adapterId,
    adapterVersion: '1.0.0',
    keyId: options.keyId || 'key_current_006',
    clock: options.clock || (() => new Date(NOW)),
  });
}

function signingInput(overrides = {}) {
  sequence += 1;
  const suffix = String(sequence).padStart(7, '0');
  const anchorType = overrides.anchorType || 'INSTITUTIONAL_STUDENT_ID';
  const anchorValue = overrides.anchorValue || `STU-${suffix}`;
  return {
    evidenceId: overrides.evidenceId || `evidence_${suffix}`,
    tenantId: overrides.tenantId || TENANT_ALPHA,
    environment: overrides.environment || 'LOCAL',
    sourceRecordId: overrides.sourceRecordId || `raw-upstream-record-${suffix}`,
    sourceRecordScheme: overrides.sourceRecordScheme || 'HMAC_SHA256',
    observedAt: overrides.observedAt || OBSERVED_AT,
    expiresAt: overrides.expiresAt || EXPIRES_AT,
    payload: overrides.payload || { synthetic: true, record: suffix },
    assertions: overrides.assertions || [{
      field: overrides.field || 'student.institutional_id',
      anchorType,
      value: anchorValue,
    }],
    nonce: overrides.nonce || `nonce_identity_006_${suffix}`,
  };
}

function signEvidence(adapterSigner, overrides = {}) {
  return adapterSigner.sign(signingInput(overrides));
}

function verify(envelope, overrides = {}) {
  const verifier = createAttestedEvidenceVerifier({
    registry: overrides.registry || registry,
    replayGuard: overrides.replayGuard || new MemoryEvidenceNonceGuard(),
    clock: overrides.clock || identityClock,
  });
  return verifier.verify(envelope, {
    expectedTenantId: overrides.expectedTenantId || envelope.tenantId,
    expectedEnvironment: overrides.expectedEnvironment || envelope.environment,
    expectedNonce: overrides.expectedNonce || envelope.nonce,
  });
}

function resolve(evidence, targetCandidate, policy) {
  return identityResolver.resolve({ evidence, candidate: targetCandidate, policy });
}

function candidate(tenantId, environment, subjectRefId) {
  return { tenantId, environment, subjectRefId };
}

function subjectBinding(subjectRefId, environment, anchorValue) {
  const normalized = String(anchorValue).normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleUpperCase('en-US');
  const valueDigest = `sha256:${crypto.createHash('sha256')
    .update(`mmc.identity.anchor.v1\0INSTITUTIONAL_STUDENT_ID\0${normalized}`, 'utf8')
    .digest('hex')}`;
  return {
    tenantId: TENANT_ALPHA,
    environment,
    subjectRefId,
    anchorType: 'INSTITUTIONAL_STUDENT_ID',
    valueDigest,
  };
}

function assertVerifyCode(envelope, expectedCode, overrides = {}) {
  assertCode(() => verify(envelope, {
    registry: overrides.registry || registry,
    replayGuard: overrides.replayGuard || new MemoryEvidenceNonceGuard(),
    expectedTenantId: overrides.expectedTenantId || envelope.tenantId,
    expectedEnvironment: overrides.expectedEnvironment || envelope.environment,
    expectedNonce: overrides.expectedNonce || envelope.nonce,
  }), expectedCode);
}

function assertCode(callback, expectedCode, message = '') {
  assert.throws(callback, (error) => {
    assert.equal(error?.code, expectedCode, message || `Expected ${expectedCode}.`);
    assert.equal(String(error?.message || '').includes(CURRENT_SECRET), false);
    assert.equal(String(error?.message || '').includes(OLD_SECRET), false);
    return true;
  });
}

function adversarialNegativePair(index, random) {
  const randomPart = String(Math.floor(random() * 1_000_000_000)).padStart(9, '0');
  const serial = String(index).padStart(5, '0');
  switch (index % 5) {
    case 0:
      return [`STU-${serial}-${randomPart}-O`, `STU-${serial}-${randomPart}-0`];
    case 1:
      return [`APP-${randomPart}-${serial}-1`, `APP-${randomPart}-${serial}-I`];
    case 2:
      return [`ID-${serial}-${randomPart}-A`, `ID-${serial}-${randomPart}-B`];
    case 3:
      return [`TENANT-A-${serial}-${randomPart}`, `TENANT-B-${serial}-${randomPart}`];
    default:
      return [`SUBJECT-${randomPart}-${serial}-LEFT`, `SUBJECT-${randomPart}-${serial}-RIGHT`];
  }
}

function buildAdversarialCorpusHash() {
  const digest = crypto.createHash('sha256');
  const random = mulberry32(0x5eed0006);
  for (let index = 0; index < ADVERSARIAL_PAIR_COUNT; index += 1) {
    const [leftAnchor, rightAnchor] = adversarialNegativePair(index, random);
    digest.update(`${index}\u001f${leftAnchor}\u001f${rightAnchor}\n`, 'utf8');
  }
  return `sha256:${digest.digest('hex')}`;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
