import crypto from 'node:crypto';

import { parseStrictRfc3339 } from '../contracts/timestamp-contract.mjs';

export const ATTESTED_IDENTITY_SCHEMA = 'mmc.identity.attestation/v1';
export const ATTESTED_IDENTITY_SIGNATURE_ALGORITHM = 'HMAC-SHA256';
export const IDENTITY_DECISION_VERSION = 1;

export const IDENTITY_STATE = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  PROBABLE: 'PROBABLE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CONFLICT: 'CONFLICT',
  VERIFIED_LOCAL_LINK: 'VERIFIED_LOCAL_LINK',
  REVOKED: 'REVOKED',
});

export const IDENTITY_ENVIRONMENT = Object.freeze({
  FIXTURE: 'FIXTURE',
  LOCAL: 'LOCAL',
  STAGING: 'STAGING',
  LIVE: 'LIVE',
});

const ENVIRONMENTS = new Set(Object.values(IDENTITY_ENVIRONMENT));
const ACCEPTED_VERIFY_KEY_STATES = new Set(['ACTIVE', 'RETIRING']);
const SIGNING_KEY_STATES = new Set(['ACTIVE', 'RETIRING', 'REVOKED']);
const SOURCE_RECORD_SCHEMES = new Set(['OPAQUE_ID', 'HMAC_SHA256']);
const REGISTRY_STATE = Symbol('mmc.identity.registry-state');
const VERIFIED_EVIDENCE = Symbol('mmc.identity.verified-evidence');
const POLICY_AUTHORITY = Symbol('mmc.identity.policy-authority');
const POLICY_STATE = Symbol('mmc.identity.policy-state');
const REPLAY_GUARD = Symbol('mmc.identity.replay-guard');
const MAX_CANONICAL_PAYLOAD_BYTES = 256 * 1024;
const MAX_ASSERTIONS = 16;
const DEFAULT_MAX_EVIDENCE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_OBSERVATION_AGE_MS = 5 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_MS = 30 * 1000;

const ENVELOPE_KEYS = Object.freeze([
  'schema',
  'evidenceId',
  'issuer',
  'audience',
  'adapter',
  'keyId',
  'tenantId',
  'environment',
  'source',
  'observedAt',
  'expiresAt',
  'payloadHash',
  'assertions',
  'nonce',
  'signature',
]);
const ADAPTER_KEYS = Object.freeze(['id', 'version']);
const SOURCE_KEYS = Object.freeze(['family', 'record']);
const SOURCE_RECORD_KEYS = Object.freeze(['scheme', 'value']);
const ASSERTION_KEYS = Object.freeze(['field', 'anchorType', 'valueDigest']);
const SIGNATURE_KEYS = Object.freeze(['algorithm', 'value']);
const SIGN_INPUT_KEYS = Object.freeze([
  'evidenceId',
  'tenantId',
  'environment',
  'sourceRecordId',
  'sourceRecordScheme',
  'observedAt',
  'expiresAt',
  'payload',
  'assertions',
  'nonce',
]);

export class MmcIdentityAttestationError extends TypeError {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = 'MmcIdentityAttestationError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export class MemoryEvidenceNonceGuard {
  #consumed = new Map();
  #nextPruneAtMs = 0;

  constructor() {
    Object.defineProperty(this, REPLAY_GUARD, { value: true });
  }

  consume(input) {
    assertPlainRecord(input, 'replay input');
    assertExactKeys(input, ['scope', 'nonce', 'expiresAt', 'now'], 'replay input');
    const nowMs = requireCanonicalTimestamp(input.now, 'REPLAY_TIME_INVALID');
    const expiresAtMs = requireCanonicalTimestamp(input.expiresAt, 'REPLAY_EXPIRY_INVALID');
    if (nowMs >= this.#nextPruneAtMs) {
      for (const [key, expiry] of this.#consumed) {
        if (expiry <= nowMs) this.#consumed.delete(key);
      }
      this.#nextPruneAtMs = nowMs + 60 * 1000;
    }
    const replayKey = sha256Hex(`mmc.identity.nonce.v1\0${input.scope}\0${input.nonce}`);
    if (this.#consumed.has(replayKey)) {
      fail('EVIDENCE_NONCE_REPLAYED', 'The attested identity evidence nonce has already been consumed.');
    }
    this.#consumed.set(replayKey, expiresAtMs);
  }

  get size() {
    return this.#consumed.size;
  }
}

export function createTrustedAdapterRegistry(input) {
  assertPlainRecord(input, 'trusted adapter registry');
  assertAllowedKeys(input, ['issuer', 'audience', 'adapters', 'maxEvidenceLifetimeMs'], 'trusted adapter registry');
  for (const field of ['issuer', 'audience', 'adapters']) requireOwn(input, field, 'trusted adapter registry');
  const issuer = requireAuthorityIdentifier(input.issuer, 'TRUSTED_ISSUER_INVALID');
  const audience = requireAuthorityIdentifier(input.audience, 'TRUSTED_AUDIENCE_INVALID');
  if (!Array.isArray(input.adapters) || input.adapters.length < 1 || input.adapters.length > 64) {
    fail('TRUSTED_ADAPTER_REGISTRY_INVALID', 'The trusted adapter registry is invalid.');
  }
  const maxEvidenceLifetimeMs = requireBoundedInteger(
    input.maxEvidenceLifetimeMs ?? DEFAULT_MAX_EVIDENCE_LIFETIME_MS,
    60 * 1000,
    30 * 24 * 60 * 60 * 1000,
    'TRUSTED_ADAPTER_REGISTRY_INVALID',
  );
  const adapters = new Map();

  for (const rawAdapter of input.adapters) {
    assertPlainRecord(rawAdapter, 'trusted adapter');
    assertExactKeys(rawAdapter, [
      'adapterId',
      'adapterVersion',
      'sourceFamily',
      'allowedAnchorTypes',
      'environments',
      'tenantIds',
      'keys',
    ], 'trusted adapter');
    const adapterId = requireSlug(rawAdapter.adapterId, 'TRUSTED_ADAPTER_INVALID');
    const adapterVersion = requireVersion(rawAdapter.adapterVersion, 'TRUSTED_ADAPTER_INVALID');
    const sourceFamily = requireSlug(rawAdapter.sourceFamily, 'TRUSTED_SOURCE_FAMILY_INVALID');
    const allowedAnchorTypes = requireUniqueStringSet(
      rawAdapter.allowedAnchorTypes,
      requireAnchorType,
      'TRUSTED_ANCHOR_REGISTRY_INVALID',
    );
    const environments = requireUniqueStringSet(
      rawAdapter.environments,
      requireEnvironment,
      'TRUSTED_ADAPTER_ENVIRONMENT_INVALID',
    );
    const tenantIds = requireUniqueStringSet(
      rawAdapter.tenantIds,
      (value) => requireOpaqueIdentifier(value, 'TRUSTED_TENANT_INVALID'),
      'TRUSTED_TENANT_REGISTRY_INVALID',
    );
    if (!Array.isArray(rawAdapter.keys) || rawAdapter.keys.length < 1 || rawAdapter.keys.length > 8) {
      fail('TRUSTED_KEY_REGISTRY_INVALID', 'The trusted adapter key registry is invalid.');
    }
    const keys = new Map();
    for (const rawKey of rawAdapter.keys) {
      assertPlainRecord(rawKey, 'trusted adapter key');
      assertExactKeys(rawKey, ['keyId', 'secret', 'status', 'notBefore', 'notAfter'], 'trusted adapter key');
      const keyId = requireOpaqueIdentifier(rawKey.keyId, 'TRUSTED_KEY_INVALID');
      if (keys.has(keyId)) fail('TRUSTED_KEY_DUPLICATE', 'The trusted adapter key registry contains a duplicate key.');
      const secret = normalizeSecret(rawKey.secret);
      const status = String(rawKey.status || '').trim().toUpperCase();
      if (!SIGNING_KEY_STATES.has(status)) fail('TRUSTED_KEY_STATUS_INVALID', 'The trusted adapter key state is invalid.');
      const notBeforeMs = requireCanonicalTimestamp(rawKey.notBefore, 'TRUSTED_KEY_TIME_INVALID');
      const notAfterMs = requireCanonicalTimestamp(rawKey.notAfter, 'TRUSTED_KEY_TIME_INVALID');
      if (notAfterMs <= notBeforeMs) fail('TRUSTED_KEY_TIME_INVALID', 'The trusted adapter key validity interval is invalid.');
      keys.set(keyId, Object.freeze({
        keyId,
        secret,
        status,
        notBefore: rawKey.notBefore,
        notAfter: rawKey.notAfter,
        notBeforeMs,
        notAfterMs,
      }));
    }
    const adapterKey = makeAdapterKey(adapterId, adapterVersion);
    if (adapters.has(adapterKey)) fail('TRUSTED_ADAPTER_DUPLICATE', 'The trusted adapter registry contains a duplicate adapter.');
    adapters.set(adapterKey, Object.freeze({
      adapterId,
      adapterVersion,
      sourceFamily,
      allowedAnchorTypes,
      environments,
      tenantIds,
      keys,
    }));
  }

  const state = Object.freeze({ issuer, audience, adapters, maxEvidenceLifetimeMs });
  const registry = {
    issuer,
    audience,
    describe() {
      return deepFreeze({
        issuer,
        audience,
        maxEvidenceLifetimeMs,
        adapters: [...adapters.values()].map((adapter) => ({
          adapterId: adapter.adapterId,
          adapterVersion: adapter.adapterVersion,
          sourceFamily: adapter.sourceFamily,
          environments: [...adapter.environments].sort(),
          tenantIds: [...adapter.tenantIds].sort(),
          allowedAnchorTypes: [...adapter.allowedAnchorTypes].sort(),
          keys: [...adapter.keys.values()].map((key) => ({
            keyId: key.keyId,
            status: key.status,
            notBefore: key.notBefore,
            notAfter: key.notAfter,
          })),
        })),
      });
    },
  };
  Object.defineProperty(registry, REGISTRY_STATE, { value: state });
  return Object.freeze(registry);
}

export function createServerAdapterSigner(options) {
  assertPlainRecord(options, 'server adapter signer');
  assertAllowedKeys(options, [
    'registry',
    'adapterId',
    'adapterVersion',
    'keyId',
    'clock',
    'maxObservationAgeMs',
    'clockSkewMs',
  ], 'server adapter signer');
  const registryState = requireRegistry(options.registry);
  const adapterId = requireSlug(options.adapterId, 'TRUSTED_ADAPTER_INVALID');
  const adapterVersion = requireVersion(options.adapterVersion, 'TRUSTED_ADAPTER_INVALID');
  const adapter = getTrustedAdapter(registryState, adapterId, adapterVersion);
  const keyId = requireOpaqueIdentifier(options.keyId, 'TRUSTED_KEY_INVALID');
  const key = adapter.keys.get(keyId);
  if (!key || key.status !== 'ACTIVE') {
    fail('SIGNING_KEY_NOT_ACTIVE', 'The server adapter signing key is not active.');
  }
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  const maxObservationAgeMs = requireBoundedInteger(
    options.maxObservationAgeMs ?? DEFAULT_MAX_OBSERVATION_AGE_MS,
    0,
    24 * 60 * 60 * 1000,
    'SIGNER_POLICY_INVALID',
  );
  const clockSkewMs = requireBoundedInteger(
    options.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS,
    0,
    5 * 60 * 1000,
    'SIGNER_POLICY_INVALID',
  );

  return Object.freeze({
    adapterId,
    adapterVersion,
    keyId,
    sign(input) {
      assertPlainRecord(input, 'attested evidence signing input');
      assertExactKeys(input, SIGN_INPUT_KEYS, 'attested evidence signing input');
      const evidenceId = requireOpaqueIdentifier(input.evidenceId, 'EVIDENCE_ID_INVALID');
      const tenantId = requireOpaqueIdentifier(input.tenantId, 'EVIDENCE_TENANT_INVALID');
      const environment = requireEnvironment(input.environment);
      assertAdapterScope(adapter, tenantId, environment);
      const observedAtMs = requireCanonicalTimestamp(input.observedAt, 'EVIDENCE_OBSERVED_AT_INVALID');
      const expiresAtMs = requireCanonicalTimestamp(input.expiresAt, 'EVIDENCE_EXPIRES_AT_INVALID');
      const nowMs = requireClockMilliseconds(clock, 'SIGNER_CLOCK_INVALID');
      if (observedAtMs > nowMs + clockSkewMs || observedAtMs < nowMs - maxObservationAgeMs) {
        fail('EVIDENCE_OBSERVATION_TIME_REJECTED', 'The adapter observation time is outside its signing window.');
      }
      assertEvidenceTiming(observedAtMs, expiresAtMs, key, registryState.maxEvidenceLifetimeMs);
      const nonce = requireNonce(input.nonce);
      const sourceRecord = buildSourceRecord(input.sourceRecordScheme, input.sourceRecordId, key.secret);
      const assertions = buildSignedAssertions(input.assertions, adapter.allowedAnchorTypes);
      const payloadCanonical = canonicalJson(input.payload);
      if (Buffer.byteLength(payloadCanonical, 'utf8') > MAX_CANONICAL_PAYLOAD_BYTES) {
        fail('EVIDENCE_PAYLOAD_TOO_LARGE', 'The attested evidence payload exceeds its bound.');
      }
      const unsignedEnvelope = {
        schema: ATTESTED_IDENTITY_SCHEMA,
        evidenceId,
        issuer: registryState.issuer,
        audience: registryState.audience,
        adapter: { id: adapterId, version: adapterVersion },
        keyId,
        tenantId,
        environment,
        source: { family: adapter.sourceFamily, record: sourceRecord },
        observedAt: input.observedAt,
        expiresAt: input.expiresAt,
        payloadHash: sha256Tagged(`mmc.identity.payload.v1\0${payloadCanonical}`),
        assertions,
        nonce,
      };
      const signatureValue = signCanonicalEnvelope(unsignedEnvelope, key.secret);
      return deepFreeze({
        ...unsignedEnvelope,
        signature: {
          algorithm: ATTESTED_IDENTITY_SIGNATURE_ALGORITHM,
          value: signatureValue,
        },
      });
    },
  });
}

export function createAttestedEvidenceVerifier(options) {
  assertPlainRecord(options, 'attested evidence verifier options');
  assertExactKeys(options, ['registry', 'replayGuard', 'clock'], 'attested evidence verifier options');
  for (const field of ['registry', 'replayGuard', 'clock']) {
    requireOwn(options, field, 'attested evidence verifier options');
  }
  requireRegistry(options.registry);
  if (!options.replayGuard?.[REPLAY_GUARD] || typeof options.replayGuard.consume !== 'function') {
    fail('EVIDENCE_REPLAY_GUARD_REQUIRED', 'A server replay guard is required for identity evidence.');
  }
  if (typeof options.clock !== 'function') {
    fail('EVIDENCE_VERIFICATION_TIME_INVALID', 'The server verification clock is invalid.');
  }

  return Object.freeze({
    verify(envelope, context) {
      assertPlainRecord(context, 'attested evidence verification request');
      assertExactKeys(context, [
        'expectedTenantId',
        'expectedEnvironment',
        'expectedNonce',
      ], 'attested evidence verification request');
      for (const field of ['expectedTenantId', 'expectedEnvironment', 'expectedNonce']) {
        requireOwn(context, field, 'attested evidence verification request');
      }
      const verifiedAt = new Date(requireClockMilliseconds(
        options.clock,
        'EVIDENCE_VERIFICATION_TIME_INVALID',
      )).toISOString();
      return verifyAttestedEvidence(envelope, {
        registry: options.registry,
        replayGuard: options.replayGuard,
        expectedTenantId: context.expectedTenantId,
        expectedEnvironment: context.expectedEnvironment,
        expectedNonce: context.expectedNonce,
        now: verifiedAt,
      });
    },
  });
}

function verifyAttestedEvidence(envelope, context) {
  validateEnvelopeShape(envelope);
  assertPlainRecord(context, 'attested evidence verification context');
  assertExactKeys(context, [
    'registry',
    'replayGuard',
    'expectedTenantId',
    'expectedEnvironment',
    'expectedNonce',
    'now',
  ], 'attested evidence verification context');
  const registryState = requireRegistry(context.registry);
  if (envelope.issuer !== registryState.issuer) fail('EVIDENCE_ISSUER_REJECTED', 'The evidence issuer is not trusted.');
  if (envelope.audience !== registryState.audience) fail('EVIDENCE_AUDIENCE_REJECTED', 'The evidence audience is not trusted.');
  const adapter = getTrustedAdapter(registryState, envelope.adapter.id, envelope.adapter.version);
  if (envelope.source.family !== adapter.sourceFamily) {
    fail('EVIDENCE_SOURCE_FAMILY_REJECTED', 'The evidence source authority family is not trusted for this adapter.');
  }
  assertAdapterScope(adapter, envelope.tenantId, envelope.environment);
  if (envelope.assertions.some((assertion) => !adapter.allowedAnchorTypes.has(assertion.anchorType))) {
    fail('EVIDENCE_ANCHOR_TYPE_REJECTED', 'The server adapter is not approved for an asserted anchor type.');
  }
  const key = adapter.keys.get(envelope.keyId);
  if (!key) fail('EVIDENCE_KEY_UNTRUSTED', 'The evidence signing key is not trusted.');
  if (!ACCEPTED_VERIFY_KEY_STATES.has(key.status)) {
    fail('EVIDENCE_KEY_REVOKED', 'The evidence signing key is revoked.');
  }
  const unsignedEnvelope = Object.fromEntries(ENVELOPE_KEYS
    .filter((field) => field !== 'signature')
    .map((field) => [field, envelope[field]]));
  const expectedSignature = signCanonicalEnvelope(unsignedEnvelope, key.secret);
  if (!safeEqualBase64Url(expectedSignature, envelope.signature.value)) {
    fail('EVIDENCE_SIGNATURE_INVALID', 'The evidence signature is invalid.');
  }

  const nowMs = requireCanonicalTimestamp(context.now, 'EVIDENCE_VERIFICATION_TIME_INVALID');
  const observedAtMs = requireCanonicalTimestamp(envelope.observedAt, 'EVIDENCE_OBSERVED_AT_INVALID');
  const expiresAtMs = requireCanonicalTimestamp(envelope.expiresAt, 'EVIDENCE_EXPIRES_AT_INVALID');
  assertEvidenceTiming(observedAtMs, expiresAtMs, key, registryState.maxEvidenceLifetimeMs);
  if (observedAtMs > nowMs + DEFAULT_CLOCK_SKEW_MS) {
    fail('EVIDENCE_NOT_YET_VALID', 'The evidence observation time is in the future.');
  }
  if (expiresAtMs <= nowMs) fail('EVIDENCE_EXPIRED', 'The attested identity evidence has expired.');

  const expectedTenantId = requireOpaqueIdentifier(context.expectedTenantId, 'EVIDENCE_TENANT_CONTEXT_INVALID');
  const expectedEnvironment = requireEnvironment(context.expectedEnvironment);
  const expectedNonce = requireNonce(context.expectedNonce);
  if (envelope.tenantId !== expectedTenantId) fail('EVIDENCE_TENANT_MISMATCH', 'The evidence tenant binding does not match.');
  if (envelope.environment !== expectedEnvironment) {
    fail('EVIDENCE_ENVIRONMENT_MISMATCH', 'The evidence environment binding does not match.');
  }
  if (!safeEqualText(envelope.nonce, expectedNonce)) fail('EVIDENCE_NONCE_MISMATCH', 'The evidence nonce binding does not match.');
  if (!context.replayGuard?.[REPLAY_GUARD] || typeof context.replayGuard.consume !== 'function') {
    fail('EVIDENCE_REPLAY_GUARD_REQUIRED', 'A server replay guard is required for identity evidence.');
  }
  context.replayGuard.consume({
    scope: [registryState.audience, expectedTenantId, expectedEnvironment].join('\u001f'),
    nonce: envelope.nonce,
    expiresAt: envelope.expiresAt,
    now: context.now,
  });

  const verified = {
    evidenceId: envelope.evidenceId,
    envelopeHash: sha256Tagged(canonicalJson(envelope)),
    issuer: envelope.issuer,
    audience: envelope.audience,
    adapterId: envelope.adapter.id,
    adapterVersion: envelope.adapter.version,
    keyId: envelope.keyId,
    tenantId: envelope.tenantId,
    environment: envelope.environment,
    sourceFamily: envelope.source.family,
    sourceRecord: structuredClone(envelope.source.record),
    observedAt: envelope.observedAt,
    expiresAt: envelope.expiresAt,
    payloadHash: envelope.payloadHash,
    assertions: structuredClone(envelope.assertions),
    nonceDigest: sha256Tagged(`mmc.identity.nonce-retention.v1\0${envelope.nonce}`),
    verifiedAt: context.now,
  };
  Object.defineProperty(verified, VERIFIED_EVIDENCE, { value: true });
  return deepFreeze(verified);
}

export function createIdentityResolutionPolicy(input) {
  assertPlainRecord(input, 'identity resolution policy');
  assertExactKeys(input, [
    'policyVersion',
    'approvedSourceFamilies',
    'strongAnchorTypes',
    'automaticPromotionEnvironments',
    'subjectAnchorBindings',
    'liveEvaluation',
  ], 'identity resolution policy');
  const policyVersion = requirePolicyVersion(input.policyVersion);
  const approvedSourceFamilies = requireUniqueStringSet(
    input.approvedSourceFamilies,
    (value) => requireSlug(value, 'IDENTITY_POLICY_SOURCE_INVALID'),
    'IDENTITY_POLICY_SOURCE_INVALID',
  );
  const strongAnchorTypes = requireUniqueStringSet(
    input.strongAnchorTypes,
    requireAnchorType,
    'IDENTITY_POLICY_ANCHOR_INVALID',
  );
  const automaticPromotionEnvironments = requireUniqueStringSet(
    input.automaticPromotionEnvironments,
    requireEnvironment,
    'IDENTITY_POLICY_ENVIRONMENT_INVALID',
    { allowEmpty: true },
  );
  const subjectAnchorBindings = normalizeSubjectAnchorBindings(input.subjectAnchorBindings);
  const liveEvaluation = normalizeLiveEvaluation(input.liveEvaluation);
  if (automaticPromotionEnvironments.has(IDENTITY_ENVIRONMENT.LIVE)) {
    fail('IDENTITY_LIVE_SIGNED_EVALUATION_REQUIRED',
      'Live automatic identity promotion requires a signed, durable, replay-verifiable evaluation authority.');
  }
  const policyState = Object.freeze({
    policyVersion,
    approvedSourceFamilies,
    strongAnchorTypes,
    automaticPromotionEnvironments,
    subjectAnchorBindings,
    liveEvaluation,
  });
  const policy = {
    policyVersion,
    approvedSourceFamilies: Object.freeze([...approvedSourceFamilies].sort()),
    strongAnchorTypes: Object.freeze([...strongAnchorTypes].sort()),
    automaticPromotionEnvironments: Object.freeze([...automaticPromotionEnvironments].sort()),
    subjectAnchorBindings: Object.freeze([...subjectAnchorBindings.values()].map((binding) => ({ ...binding }))),
    liveEvaluation,
  };
  Object.defineProperty(policy, POLICY_AUTHORITY, { value: true });
  Object.defineProperty(policy, POLICY_STATE, { value: policyState });
  return deepFreeze(policy);
}

export function createAttestedIdentityResolver(options) {
  assertPlainRecord(options, 'identity resolver options');
  assertExactKeys(options, ['clock'], 'identity resolver options');
  requireOwn(options, 'clock', 'identity resolver options');
  if (typeof options.clock !== 'function') {
    fail('IDENTITY_DECISION_TIME_INVALID', 'The server decision clock is invalid.');
  }

  return Object.freeze({
    resolve(input) {
      assertPlainRecord(input, 'attested identity resolution request');
      assertAllowedKeys(input, [
        'evidence',
        'candidate',
        'policy',
        'revokedEvidenceIds',
        'revocation',
      ], 'attested identity resolution request');
      for (const field of ['evidence', 'candidate', 'policy']) {
        requireOwn(input, field, 'attested identity resolution request');
      }
      const decidedAt = new Date(requireClockMilliseconds(
        options.clock,
        'IDENTITY_DECISION_TIME_INVALID',
      )).toISOString();
      return resolveAttestedIdentity({ ...input, now: decidedAt });
    },
  });
}

function resolveAttestedIdentity(input) {
  assertPlainRecord(input, 'attested identity resolution input');
  assertAllowedKeys(input, [
    'evidence',
    'candidate',
    'policy',
    'now',
    'revokedEvidenceIds',
    'revocation',
  ], 'attested identity resolution input');
  for (const field of ['evidence', 'candidate', 'policy', 'now']) {
    requireOwn(input, field, 'attested identity resolution input');
  }
  if (!input.policy?.[POLICY_AUTHORITY]) {
    fail('IDENTITY_POLICY_AUTHORITY_REQUIRED', 'A server-owned identity resolution policy is required.');
  }
  const policy = input.policy;
  const policyState = policy[POLICY_STATE];
  const candidate = normalizeCandidate(input.candidate);
  const nowMs = requireCanonicalTimestamp(input.now, 'IDENTITY_DECISION_TIME_INVALID');
  if (!Array.isArray(input.evidence) || input.evidence.length > 100) {
    fail('IDENTITY_EVIDENCE_SET_INVALID', 'The attested identity evidence set is invalid.');
  }
  const evidence = input.evidence.map((entry) => {
    if (!entry?.[VERIFIED_EVIDENCE]) {
      fail('UNATTESTED_IDENTITY_EVIDENCE', 'Only server-verified identity evidence may enter resolution.');
    }
    if (entry.tenantId !== candidate.tenantId) {
      fail('IDENTITY_TENANT_ISOLATION_VIOLATION', 'Identity evidence cannot cross tenants.');
    }
    if (entry.environment !== candidate.environment) {
      fail('IDENTITY_ENVIRONMENT_ISOLATION_VIOLATION', 'Identity evidence cannot cross environments.');
    }
    return entry;
  });
  const evidenceIds = [...new Set(evidence.map((entry) => entry.evidenceId))].sort();
  const revokedEvidenceIds = normalizeRevokedEvidenceIds(input.revokedEvidenceIds);
  const revocation = normalizeRevocation(input.revocation, nowMs);

  if (revocation) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.REVOKED,
      reason: revocation.reasonCode,
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [],
      matchedAnchor: null,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
      revokedAt: revocation.revokedAt,
    });
  }

  const currentEvidence = evidence.filter((entry) => (
    Date.parse(entry.observedAt) <= nowMs
    && Date.parse(entry.expiresAt) > nowMs
    && !revokedEvidenceIds.has(entry.evidenceId)
  ));
  if (!evidence.length) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.UNVERIFIED,
      reason: 'NO_ATTESTED_EVIDENCE',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [],
      matchedAnchor: null,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [],
    });
  }
  if (!currentEvidence.length) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.MANUAL_REVIEW,
      reason: 'ATTESTED_EVIDENCE_EXPIRED_OR_REVOKED',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [],
      matchedAnchor: null,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
    });
  }

  const supportByAnchorType = new Map();
  const approvedEvidenceFamilies = new Set();
  let approvedStrongAssertionCount = 0;
  for (const entry of currentEvidence) {
    if (!policyState.approvedSourceFamilies.has(entry.sourceFamily)) continue;
    for (const assertion of entry.assertions) {
      if (!policyState.strongAnchorTypes.has(assertion.anchorType)) continue;
      approvedStrongAssertionCount += 1;
      approvedEvidenceFamilies.add(entry.sourceFamily);
      let digestMap = supportByAnchorType.get(assertion.anchorType);
      if (!digestMap) {
        digestMap = new Map();
        supportByAnchorType.set(assertion.anchorType, digestMap);
      }
      let support = digestMap.get(assertion.valueDigest);
      if (!support) {
        support = { families: new Set(), evidenceIds: new Set() };
        digestMap.set(assertion.valueDigest, support);
      }
      support.families.add(entry.sourceFamily);
      support.evidenceIds.add(entry.evidenceId);
    }
  }

  const conflictingAnchorTypes = [...supportByAnchorType.entries()]
    .filter(([, digestMap]) => digestMap.size > 1)
    .map(([anchorType]) => anchorType)
    .sort();
  if (conflictingAnchorTypes.length) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.CONFLICT,
      reason: 'CONTRADICTORY_STRONG_ANCHORS',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [...approvedEvidenceFamilies].sort(),
      matchedAnchor: null,
      conflictingAnchorTypes,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
    });
  }

  const exactMatches = [];
  for (const [anchorType, digestMap] of supportByAnchorType) {
    for (const [valueDigest, support] of digestMap) {
      if (support.families.size >= 2) {
        exactMatches.push({
          anchorType,
          valueDigest,
          families: [...support.families].sort(),
          evidenceIds: [...support.evidenceIds].sort(),
        });
      }
    }
  }
  exactMatches.sort((left, right) => (
    `${left.anchorType}\u001f${left.valueDigest}`.localeCompare(`${right.anchorType}\u001f${right.valueDigest}`)
  ));
  const candidateBindingKey = [candidate.tenantId, candidate.environment, candidate.subjectRefId].join('\u001f');
  const candidateBindings = policyState.subjectAnchorBindings.get(candidateBindingKey) || [];
  const matchedAnchor = exactMatches.find((match) => candidateBindings.some((binding) => (
    binding.anchorType === match.anchorType && binding.valueDigest === match.valueDigest
  ))) || null;
  if (exactMatches.length && !matchedAnchor) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.MANUAL_REVIEW,
      reason: 'SUBJECT_ANCHOR_BINDING_MISSING_OR_MISMATCH',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [...approvedEvidenceFamilies].sort(),
      matchedAnchor: null,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
    });
  }
  if (matchedAnchor) {
    const automaticAllowed = candidate.environment !== IDENTITY_ENVIRONMENT.LIVE
      && policyState.automaticPromotionEnvironments.has(candidate.environment);
    return buildIdentityDecision({
      state: automaticAllowed ? IDENTITY_STATE.VERIFIED_LOCAL_LINK : IDENTITY_STATE.MANUAL_REVIEW,
      reason: automaticAllowed ? 'TWO_INDEPENDENT_ATTESTED_AUTHORITIES_EXACT_ANCHOR' : 'AUTOMATIC_PROMOTION_DISABLED',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: matchedAnchor.families,
      matchedAnchor: {
        anchorType: matchedAnchor.anchorType,
        valueDigest: matchedAnchor.valueDigest,
        evidenceIds: matchedAnchor.evidenceIds,
      },
      automatic: automaticAllowed,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
    });
  }

  if (approvedEvidenceFamilies.size >= 2) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.MANUAL_REVIEW,
      reason: 'INDEPENDENT_AUTHORITIES_LACK_EXACT_COMMON_ANCHOR',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [...approvedEvidenceFamilies].sort(),
      matchedAnchor: null,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
    });
  }
  if (approvedStrongAssertionCount > 0) {
    return buildIdentityDecision({
      state: IDENTITY_STATE.PROBABLE,
      reason: 'ONE_APPROVED_ATTESTED_AUTHORITY',
      candidate,
      policy,
      evidenceIds,
      independentSourceFamilies: [...approvedEvidenceFamilies].sort(),
      matchedAnchor: null,
      automatic: false,
      decidedAt: input.now,
      revokedEvidenceIds: [...revokedEvidenceIds].sort(),
    });
  }
  return buildIdentityDecision({
    state: IDENTITY_STATE.MANUAL_REVIEW,
    reason: 'NO_POLICY_APPROVED_STRONG_ANCHOR',
    candidate,
    policy,
    evidenceIds,
    independentSourceFamilies: [],
    matchedAnchor: null,
    automatic: false,
    decidedAt: input.now,
    revokedEvidenceIds: [...revokedEvidenceIds].sort(),
  });
}

function normalizeLiveEvaluation(value) {
  if (value == null) {
    return Object.freeze({
      pairCount: 0,
      falsePromotions: 0,
      datasetHash: null,
      completedAt: null,
      releaseQualified: false,
    });
  }
  assertPlainRecord(value, 'live identity evaluation');
  assertExactKeys(value, ['pairCount', 'falsePromotions', 'datasetHash', 'completedAt'], 'live identity evaluation');
  const pairCount = requireBoundedInteger(value.pairCount, 0, 10_000_000, 'IDENTITY_LIVE_EVALUATION_INVALID');
  const falsePromotions = requireBoundedInteger(value.falsePromotions, 0, pairCount, 'IDENTITY_LIVE_EVALUATION_INVALID');
  if (!/^sha256:[a-f0-9]{64}$/u.test(String(value.datasetHash || ''))) {
    fail('IDENTITY_LIVE_EVALUATION_INVALID', 'The live identity evaluation is invalid.');
  }
  requireCanonicalTimestamp(value.completedAt, 'IDENTITY_LIVE_EVALUATION_INVALID');
  return Object.freeze({
    pairCount,
    falsePromotions,
    datasetHash: value.datasetHash,
    completedAt: value.completedAt,
    releaseQualified: pairCount >= 5000 && falsePromotions === 0,
  });
}

function normalizeCandidate(value) {
  assertPlainRecord(value, 'identity candidate');
  assertExactKeys(value, ['subjectRefId', 'tenantId', 'environment'], 'identity candidate');
  return Object.freeze({
    subjectRefId: requireOpaqueIdentifier(value.subjectRefId, 'IDENTITY_CANDIDATE_INVALID'),
    tenantId: requireOpaqueIdentifier(value.tenantId, 'IDENTITY_CANDIDATE_INVALID'),
    environment: requireEnvironment(value.environment),
  });
}

function normalizeSubjectAnchorBindings(value) {
  if (!Array.isArray(value) || value.length > 10_000) {
    fail('IDENTITY_SUBJECT_BINDINGS_INVALID', 'The server-owned subject anchor bindings are invalid.');
  }
  const bindings = new Map();
  const duplicates = new Set();
  for (const raw of value) {
    assertPlainRecord(raw, 'subject anchor binding');
    assertExactKeys(raw, ['tenantId', 'environment', 'subjectRefId', 'anchorType', 'valueDigest'], 'subject anchor binding');
    const binding = Object.freeze({
      tenantId: requireOpaqueIdentifier(raw.tenantId, 'IDENTITY_SUBJECT_BINDINGS_INVALID'),
      environment: requireEnvironment(raw.environment),
      subjectRefId: requireOpaqueIdentifier(raw.subjectRefId, 'IDENTITY_SUBJECT_BINDINGS_INVALID'),
      anchorType: requireAnchorType(raw.anchorType),
      valueDigest: requireSha256Tag(raw.valueDigest, 'IDENTITY_SUBJECT_BINDINGS_INVALID'),
    });
    const candidateKey = [binding.tenantId, binding.environment, binding.subjectRefId].join('\u001f');
    const duplicateKey = `${candidateKey}\u001f${binding.anchorType}\u001f${binding.valueDigest}`;
    if (duplicates.has(duplicateKey)) {
      fail('IDENTITY_SUBJECT_BINDINGS_INVALID', 'The server-owned subject anchor bindings contain a duplicate.');
    }
    duplicates.add(duplicateKey);
    const current = bindings.get(candidateKey) || [];
    current.push(binding);
    bindings.set(candidateKey, current);
  }
  for (const [key, entries] of bindings) {
    bindings.set(key, Object.freeze([...entries].sort((left, right) => (
      `${left.anchorType}\u001f${left.valueDigest}`.localeCompare(`${right.anchorType}\u001f${right.valueDigest}`)
    ))));
  }
  return bindings;
}

function normalizeRevokedEvidenceIds(value) {
  if (value == null) return new Set();
  return requireUniqueStringSet(
    value,
    (entry) => requireOpaqueIdentifier(entry, 'IDENTITY_REVOCATION_INVALID'),
    'IDENTITY_REVOCATION_INVALID',
    { allowEmpty: true },
  );
}

function normalizeRevocation(value, nowMs) {
  if (value == null) return null;
  assertPlainRecord(value, 'identity link revocation');
  assertExactKeys(value, ['state', 'reasonCode', 'revokedAt'], 'identity link revocation');
  if (value.state !== IDENTITY_STATE.REVOKED) {
    fail('IDENTITY_REVOCATION_INVALID', 'The identity link revocation is invalid.');
  }
  const revokedAtMs = requireCanonicalTimestamp(value.revokedAt, 'IDENTITY_REVOCATION_INVALID');
  if (revokedAtMs > nowMs) fail('IDENTITY_REVOCATION_INVALID', 'The identity link revocation is invalid.');
  const reasonCode = String(value.reasonCode || '').trim();
  if (!/^[A-Z][A-Z0-9_]{2,63}$/u.test(reasonCode)) {
    fail('IDENTITY_REVOCATION_INVALID', 'The identity link revocation is invalid.');
  }
  return Object.freeze({ reasonCode, revokedAt: value.revokedAt });
}

function buildIdentityDecision(input) {
  const decision = {
    decisionVersion: IDENTITY_DECISION_VERSION,
    state: input.state,
    reason: input.reason,
    policyVersion: input.policy.policyVersion,
    subjectRefId: input.candidate.subjectRefId,
    tenantId: input.candidate.tenantId,
    environment: input.candidate.environment,
    evidenceIds: [...input.evidenceIds],
    independentSourceFamilies: [...input.independentSourceFamilies],
    matchedAnchor: input.matchedAnchor ? structuredClone(input.matchedAnchor) : null,
    conflictingAnchorTypes: [...(input.conflictingAnchorTypes || [])],
    revokedEvidenceIds: [...(input.revokedEvidenceIds || [])],
    automatic: input.automatic === true,
    decidedAt: input.decidedAt,
    ...(input.revokedAt ? { revokedAt: input.revokedAt } : {}),
  };
  return deepFreeze(decision);
}

function validateEnvelopeShape(envelope) {
  assertPlainRecord(envelope, 'attested evidence envelope');
  assertExactKeys(envelope, ENVELOPE_KEYS, 'attested evidence envelope');
  if (envelope.schema !== ATTESTED_IDENTITY_SCHEMA) {
    fail('EVIDENCE_SCHEMA_REJECTED', 'The identity evidence schema is not supported.');
  }
  requireOpaqueIdentifier(envelope.evidenceId, 'EVIDENCE_ID_INVALID');
  requireAuthorityIdentifier(envelope.issuer, 'EVIDENCE_ISSUER_INVALID');
  requireAuthorityIdentifier(envelope.audience, 'EVIDENCE_AUDIENCE_INVALID');
  assertPlainRecord(envelope.adapter, 'attested evidence adapter');
  assertExactKeys(envelope.adapter, ADAPTER_KEYS, 'attested evidence adapter');
  requireSlug(envelope.adapter.id, 'EVIDENCE_ADAPTER_INVALID');
  requireVersion(envelope.adapter.version, 'EVIDENCE_ADAPTER_INVALID');
  requireOpaqueIdentifier(envelope.keyId, 'EVIDENCE_KEY_INVALID');
  requireOpaqueIdentifier(envelope.tenantId, 'EVIDENCE_TENANT_INVALID');
  requireEnvironment(envelope.environment);
  assertPlainRecord(envelope.source, 'attested evidence source');
  assertExactKeys(envelope.source, SOURCE_KEYS, 'attested evidence source');
  requireSlug(envelope.source.family, 'EVIDENCE_SOURCE_FAMILY_INVALID');
  validateSourceRecord(envelope.source.record);
  requireCanonicalTimestamp(envelope.observedAt, 'EVIDENCE_OBSERVED_AT_INVALID');
  requireCanonicalTimestamp(envelope.expiresAt, 'EVIDENCE_EXPIRES_AT_INVALID');
  requireSha256Tag(envelope.payloadHash, 'EVIDENCE_PAYLOAD_HASH_INVALID');
  validateEnvelopeAssertions(envelope.assertions);
  requireNonce(envelope.nonce);
  assertPlainRecord(envelope.signature, 'attested evidence signature');
  assertExactKeys(envelope.signature, SIGNATURE_KEYS, 'attested evidence signature');
  if (envelope.signature.algorithm !== ATTESTED_IDENTITY_SIGNATURE_ALGORITHM) {
    fail('EVIDENCE_SIGNATURE_ALGORITHM_REJECTED', 'The evidence signature algorithm is not supported.');
  }
  if (!/^[A-Za-z0-9_-]{43}$/u.test(String(envelope.signature.value || ''))) {
    fail('EVIDENCE_SIGNATURE_INVALID', 'The evidence signature is invalid.');
  }
}

function validateSourceRecord(value) {
  assertPlainRecord(value, 'attested evidence source record');
  assertExactKeys(value, SOURCE_RECORD_KEYS, 'attested evidence source record');
  if (!SOURCE_RECORD_SCHEMES.has(value.scheme)) {
    fail('EVIDENCE_SOURCE_RECORD_INVALID', 'The evidence source record reference is invalid.');
  }
  if (value.scheme === 'OPAQUE_ID') {
    requireOpaqueIdentifier(value.value, 'EVIDENCE_SOURCE_RECORD_INVALID');
  } else if (!/^hmac-sha256:[a-f0-9]{64}$/u.test(String(value.value || ''))) {
    fail('EVIDENCE_SOURCE_RECORD_INVALID', 'The evidence source record reference is invalid.');
  }
}

function validateEnvelopeAssertions(assertions) {
  if (!Array.isArray(assertions) || assertions.length < 1 || assertions.length > MAX_ASSERTIONS) {
    fail('EVIDENCE_ASSERTIONS_INVALID', 'The evidence field assertions are invalid.');
  }
  const identities = new Set();
  const ordering = [];
  for (const assertion of assertions) {
    assertPlainRecord(assertion, 'attested evidence assertion');
    assertExactKeys(assertion, ASSERTION_KEYS, 'attested evidence assertion');
    const field = requireFieldPath(assertion.field);
    const anchorType = requireAnchorType(assertion.anchorType);
    requireSha256Tag(assertion.valueDigest, 'EVIDENCE_ASSERTION_DIGEST_INVALID');
    const identity = `${field}\u001f${anchorType}`;
    if (identities.has(identity)) fail('EVIDENCE_ASSERTION_DUPLICATE', 'The evidence contains duplicate field assertions.');
    identities.add(identity);
    ordering.push(`${field}\u001f${anchorType}\u001f${assertion.valueDigest}`);
  }
  if (ordering.join('\u0000') !== [...ordering].sort().join('\u0000')) {
    fail('EVIDENCE_ASSERTION_ORDER_INVALID', 'The evidence field assertions are not in canonical order.');
  }
}

function buildSignedAssertions(assertions, allowedAnchorTypes) {
  if (!Array.isArray(assertions) || assertions.length < 1 || assertions.length > MAX_ASSERTIONS) {
    fail('EVIDENCE_ASSERTIONS_INVALID', 'The evidence field assertions are invalid.');
  }
  const built = assertions.map((rawAssertion) => {
    assertPlainRecord(rawAssertion, 'adapter field assertion');
    assertExactKeys(rawAssertion, ['field', 'anchorType', 'value'], 'adapter field assertion');
    const field = requireFieldPath(rawAssertion.field);
    const anchorType = requireAnchorType(rawAssertion.anchorType);
    if (!allowedAnchorTypes.has(anchorType)) {
      fail('EVIDENCE_ANCHOR_TYPE_REJECTED', 'The server adapter is not approved for this anchor type.');
    }
    const normalizedValue = normalizeAnchorValue(anchorType, rawAssertion.value);
    return {
      field,
      anchorType,
      valueDigest: sha256Tagged(`mmc.identity.anchor.v1\0${anchorType}\0${normalizedValue}`),
    };
  });
  built.sort((left, right) => (
    `${left.field}\u001f${left.anchorType}\u001f${left.valueDigest}`
      .localeCompare(`${right.field}\u001f${right.anchorType}\u001f${right.valueDigest}`)
  ));
  validateEnvelopeAssertions(built);
  return built;
}

function normalizeAnchorValue(anchorType, value) {
  const raw = String(value ?? '');
  if (!raw || Buffer.byteLength(raw, 'utf8') > 512 || /[\u0000-\u001f\u007f]/u.test(raw)) {
    fail('EVIDENCE_ANCHOR_VALUE_INVALID', 'The adapter anchor value is invalid.');
  }
  const normalized = raw.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!normalized) fail('EVIDENCE_ANCHOR_VALUE_INVALID', 'The adapter anchor value is invalid.');
  if (anchorType === 'EMAIL') return normalized.toLowerCase();
  if (anchorType === 'FULL_NAME') return normalized.toLocaleUpperCase('en-US');
  return normalized.toLocaleUpperCase('en-US');
}

function buildSourceRecord(schemeValue, sourceRecordId, secret) {
  const scheme = String(schemeValue || '').trim().toUpperCase();
  if (!SOURCE_RECORD_SCHEMES.has(scheme)) {
    fail('EVIDENCE_SOURCE_RECORD_INVALID', 'The evidence source record reference is invalid.');
  }
  if (scheme === 'OPAQUE_ID') {
    return { scheme, value: requireOpaqueIdentifier(sourceRecordId, 'EVIDENCE_SOURCE_RECORD_INVALID') };
  }
  const raw = String(sourceRecordId ?? '');
  if (!raw || Buffer.byteLength(raw, 'utf8') > 512 || /[\u0000-\u001f\u007f]/u.test(raw)) {
    fail('EVIDENCE_SOURCE_RECORD_INVALID', 'The evidence source record reference is invalid.');
  }
  const digest = crypto.createHmac('sha256', secret)
    .update('mmc.identity.source-record.v1\0', 'utf8')
    .update(raw, 'utf8')
    .digest('hex');
  return { scheme, value: `hmac-sha256:${digest}` };
}

function assertEvidenceTiming(observedAtMs, expiresAtMs, key, maxEvidenceLifetimeMs) {
  if (expiresAtMs <= observedAtMs || expiresAtMs - observedAtMs > maxEvidenceLifetimeMs) {
    fail('EVIDENCE_VALIDITY_INTERVAL_REJECTED', 'The evidence validity interval is invalid.');
  }
  if (
    observedAtMs < key.notBeforeMs
    || observedAtMs >= key.notAfterMs
    || expiresAtMs > key.notAfterMs
  ) {
    fail('EVIDENCE_KEY_TIME_REJECTED', 'The evidence is outside the signing key validity interval.');
  }
}

function signCanonicalEnvelope(unsignedEnvelope, secret) {
  return crypto.createHmac('sha256', secret)
    .update('mmc.identity.attestation.signature.v1\0', 'utf8')
    .update(canonicalJson(unsignedEnvelope), 'utf8')
    .digest('base64url');
}

function getTrustedAdapter(registryState, adapterId, adapterVersion) {
  const adapter = registryState.adapters.get(makeAdapterKey(adapterId, adapterVersion));
  if (!adapter) fail('EVIDENCE_ADAPTER_UNTRUSTED', 'The identity evidence adapter is not trusted.');
  return adapter;
}

function assertAdapterScope(adapter, tenantId, environment) {
  if (!adapter.tenantIds.has(tenantId)) fail('EVIDENCE_TENANT_REJECTED', 'The adapter is not approved for this tenant.');
  if (!adapter.environments.has(environment)) {
    fail('EVIDENCE_ENVIRONMENT_REJECTED', 'The adapter is not approved for this environment.');
  }
}

function requireRegistry(registry) {
  const state = registry?.[REGISTRY_STATE];
  if (!state) fail('TRUSTED_ADAPTER_REGISTRY_REQUIRED', 'A server-owned trusted adapter registry is required.');
  return state;
}

function makeAdapterKey(adapterId, adapterVersion) {
  return `${adapterId}\u001f${adapterVersion}`;
}

function normalizeSecret(value) {
  if (!Buffer.isBuffer(value) && typeof value !== 'string') {
    fail('TRUSTED_KEY_SECRET_INVALID', 'The trusted adapter signing key material is invalid.');
  }
  const secret = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8');
  if (secret.byteLength < 32 || secret.byteLength > 512) {
    fail('TRUSTED_KEY_SECRET_INVALID', 'The trusted adapter signing key material is invalid.');
  }
  return secret;
}

function requireUniqueStringSet(values, normalizer, code, options = {}) {
  if (!Array.isArray(values) || (!options.allowEmpty && values.length < 1) || values.length > 128) {
    fail(code, 'The trusted identity registry list is invalid.');
  }
  const normalized = values.map(normalizer);
  if (new Set(normalized).size !== normalized.length) fail(code, 'The trusted identity registry list contains duplicates.');
  return new Set(normalized);
}

function requireAuthorityIdentifier(value, code) {
  if (typeof value !== 'string') fail(code, 'The identity authority identifier is invalid.');
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,255}$/u.test(text)) fail(code, 'The identity authority identifier is invalid.');
  return text;
}

function requireOpaqueIdentifier(value, code) {
  if (typeof value !== 'string') fail(code, 'The opaque identity identifier is invalid.');
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(text)) fail(code, 'The opaque identity identifier is invalid.');
  return text;
}

function requireSlug(value, code) {
  if (typeof value !== 'string') fail(code, 'The identity registry slug is invalid.');
  const text = value.trim();
  if (!/^[a-z][a-z0-9._-]{2,95}$/u.test(text)) fail(code, 'The identity registry slug is invalid.');
  return text;
}

function requireVersion(value, code) {
  if (typeof value !== 'string') fail(code, 'The adapter version is invalid.');
  const text = value.trim();
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(text)) fail(code, 'The adapter version is invalid.');
  return text;
}

function requirePolicyVersion(value) {
  if (typeof value !== 'string') {
    fail('IDENTITY_POLICY_VERSION_INVALID', 'The identity policy version is invalid.');
  }
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(text)) {
    fail('IDENTITY_POLICY_VERSION_INVALID', 'The identity policy version is invalid.');
  }
  return text;
}

function requireAnchorType(value) {
  if (typeof value !== 'string') {
    fail('EVIDENCE_ANCHOR_TYPE_INVALID', 'The evidence anchor type is invalid.');
  }
  const text = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{2,63}$/u.test(text)) {
    fail('EVIDENCE_ANCHOR_TYPE_INVALID', 'The evidence anchor type is invalid.');
  }
  return text;
}

function requireFieldPath(value) {
  if (typeof value !== 'string') {
    fail('EVIDENCE_ASSERTION_FIELD_INVALID', 'The evidence assertion field path is invalid.');
  }
  const text = value.trim();
  if (!/^[a-z][a-z0-9_.-]{1,127}$/u.test(text)) {
    fail('EVIDENCE_ASSERTION_FIELD_INVALID', 'The evidence assertion field path is invalid.');
  }
  return text;
}

function requireNonce(value) {
  if (typeof value !== 'string') {
    fail('EVIDENCE_NONCE_INVALID', 'The evidence nonce binding is invalid.');
  }
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(text)) {
    fail('EVIDENCE_NONCE_INVALID', 'The evidence nonce binding is invalid.');
  }
  return text;
}

function requireEnvironment(value) {
  if (typeof value !== 'string') {
    fail('IDENTITY_ENVIRONMENT_INVALID', 'The identity environment is invalid.');
  }
  const environment = value.trim().toUpperCase();
  if (!ENVIRONMENTS.has(environment)) {
    fail('IDENTITY_ENVIRONMENT_INVALID', 'The identity environment is invalid.');
  }
  return environment;
}

function requireSha256Tag(value, code) {
  const text = String(value || '');
  if (!/^sha256:[a-f0-9]{64}$/u.test(text)) fail(code, 'The identity evidence digest is invalid.');
  return text;
}

function requireCanonicalTimestamp(value, code) {
  const text = String(value || '');
  const milliseconds = parseStrictRfc3339(text);
  if (milliseconds === null || new Date(milliseconds).toISOString() !== text) {
    fail(code, 'The identity timestamp is invalid.');
  }
  return milliseconds;
}

function requireClockMilliseconds(clock, code) {
  let value;
  try {
    value = clock();
  } catch {
    fail(code, 'The server clock is invalid.');
  }
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(String(value || ''));
  if (!Number.isFinite(milliseconds)) fail(code, 'The server clock is invalid.');
  return milliseconds;
}

function requireBoundedInteger(value, minimum, maximum, code) {
  const number = value;
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    fail(code, 'The identity policy number is invalid.');
  }
  return number;
}

function safeEqualBase64Url(left, right) {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(String(left || '')) || !/^[A-Za-z0-9_-]{43}$/u.test(String(right || ''))) {
    return false;
  }
  const leftBuffer = Buffer.from(left, 'base64url');
  const rightBuffer = Buffer.from(right, 'base64url');
  return leftBuffer.byteLength === rightBuffer.byteLength && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.byteLength === rightBuffer.byteLength
    && leftBuffer.byteLength > 0
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256Tagged(value) {
  return `sha256:${sha256Hex(value)}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value, depth = 0) {
  if (depth > 20) fail('IDENTITY_CANONICALIZATION_REJECTED', 'The identity value exceeds its canonical depth bound.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('IDENTITY_CANONICALIZATION_REJECTED', 'The identity value is not canonical JSON.');
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) fail('IDENTITY_CANONICALIZATION_REJECTED', 'The identity value exceeds its array bound.');
    return value.map((entry) => canonicalize(entry, depth + 1));
  }
  assertPlainRecord(value, 'canonical identity value');
  const keys = Object.keys(value).sort();
  if (keys.length > 256) fail('IDENTITY_CANONICALIZATION_REJECTED', 'The identity value exceeds its object bound.');
  const normalized = {};
  for (const key of keys) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || value[key] === undefined) {
      fail('IDENTITY_CANONICALIZATION_REJECTED', 'The identity value is not canonical JSON.');
    }
    normalized[key] = canonicalize(value[key], depth + 1);
  }
  return normalized;
}

function assertPlainRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('IDENTITY_SHAPE_INVALID', `The ${field} is invalid.`);
  }
}

function assertExactKeys(value, expectedKeys, field) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('IDENTITY_EXACT_FIELDS_REQUIRED', `The ${field} fields are invalid.`);
  }
}

function assertAllowedKeys(value, allowedKeys, field) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail('IDENTITY_UNKNOWN_FIELD', `The ${field} contains an unknown field.`);
  }
}

function requireOwn(value, key, field) {
  if (!Object.hasOwn(value, key)) fail('IDENTITY_REQUIRED_FIELD_MISSING', `The ${field} is missing a required field.`);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function fail(code, message) {
  throw new MmcIdentityAttestationError(code, message);
}
