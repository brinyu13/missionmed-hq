import assert from 'node:assert/strict';
import {
  generateKeyPairSync,
} from 'node:crypto';
import test from 'node:test';

import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  PRODUCTION_RESTORE_PROOF_CONTRACT,
  PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  createProductionBackupRestoreAdapterFromEnvironment,
  createProductionBackupRestoreAdapterFromVerifiedProof,
  productionRestoreSignerKeyRef,
  verifyProductionRestoreProof,
} from '../../lor-studio/adapters/production-readiness-surfaces.mjs';
import { canonicalize, sha256 } from '../../lor-studio/domain/value-utils.js';
import {
  pinnedReleaseCaptainPublicKey,
  signedProductionRestoreProof,
} from './fixtures/signed-production-restore-proofs.mjs';

const NOW = new Date('2026-08-26T16:00:00.000Z');

function configuration(suffix = 'primary') {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'production',
    provider: 'railway-postgres',
    projectId: `lor-readiness-${suffix}-project`,
    environmentId: `lor-readiness-${suffix}-environment`,
    serviceId: `lor-readiness-${suffix}-service`,
    databaseName: 'railway',
    region: 'us-west2',
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/production',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: true,
  };
}

function signedRestoreProof({ name = 'primary', overrides = {} } = {}) {
  const publicKey = pinnedReleaseCaptainPublicKey();
  const proof = Object.freeze({ ...signedProductionRestoreProof(name), ...overrides });
  return {
    pair: Object.freeze({ publicKey }),
    proof,
    provider: Object.freeze({
      signerKeyRef: PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
      async loadVerificationKey() { return publicKey; },
    }),
  };
}

function environmentFor(signed, overrides = {}) {
  return {
    MMHQ_LOR_RESTORE_PROOF_BASE64URL: Buffer
      .from(canonicalize(signed.proof), 'utf8')
      .toString('base64url'),
    MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64: signed.pair.publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64'),
    ...overrides,
  };
}

async function verifiedProof({
  binding,
  proofName = 'primary',
  clock = () => NOW,
} = {}) {
  const signed = signedRestoreProof({ name: proofName });
  return { ...signed, descriptor: await verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: signed.provider,
    clock,
  }) };
}

function statusOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    return error.details.status;
  }
  return assert.fail('expected fail-closed construction');
}

async function rejectionStatus(promise) {
  try {
    await promise;
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    return error.details.status;
  }
  return assert.fail('expected fail-closed operation');
}

test('signed restore proof is target-bound, metadata-only, and drives one adapter rehearsal', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const proof = await verifiedProof({ binding });
  assert.equal(productionRestoreSignerKeyRef(proof.pair.publicKey), proof.provider.signerKeyRef);
  assert.deepEqual(
    Object.keys(proof.descriptor).sort(),
    ['completedAt', 'evidenceRef', 'metadataOnly', 'schemaVersion', 'targetBound', 'validUntil'],
  );
  assert.equal(proof.descriptor.targetBound, true);
  assert.equal(proof.descriptor.metadataOnly, true);
  assert.match(proof.descriptor.evidenceRef, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(proof.descriptor), /databaseRestore|storageRestore|manifest/iu);

  const adapter = createProductionBackupRestoreAdapterFromVerifiedProof({
    binding,
    verifiedRestoreProof: proof.descriptor,
  });
  const result = await adapter.runSyntheticRehearsal();
  assert.equal(result.passed, true);
  assert.deepEqual(
    result.results.map(({ check, passed, errorCode }) => ({ check, passed, errorCode })),
    PRODUCTION_RESTORE_PROOF_CONTRACT.checks.map((check) => ({
      check,
      passed: true,
      errorCode: '',
    })),
  );
  const replay = await adapter.runSyntheticRehearsal();
  assert.equal(replay.passed, false);
  assert.equal(replay.results.every((entry) => entry.passed === false), true);
});

test('restore proof rejects stale, target-mismatched, tampered, and content-bearing input', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const otherBinding = resolveLorTargetBinding(configuration('other'));
  const stale = signedRestoreProof();
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: stale.proof,
    verificationKeyProvider: stale.provider,
    clock: () => new Date('2026-09-25T16:00:00.000Z'),
  })), 'RESTORE_PROOF_NOT_FRESH');

  const wrongTarget = signedRestoreProof();
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding: otherBinding,
    proof: wrongTarget.proof,
    verificationKeyProvider: wrongTarget.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_TARGET_MISMATCH');

  const tampered = signedRestoreProof();
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: Object.freeze({ ...tampered.proof, manifestRef: sha256('tampered') }),
    verificationKeyProvider: tampered.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_SIGNATURE_INVALID');

  const wrongSentinel = signedRestoreProof({
    overrides: { expectedSuccessorSentinelRef: sha256('stale-successor-sentinel') },
  });
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: wrongSentinel.proof,
    verificationKeyProvider: wrongSentinel.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_INVALID');

  const tooLong = signedRestoreProof({
    overrides: { validUntil: '2026-09-25T16:00:00.001Z' },
  });
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: tooLong.proof,
    verificationKeyProvider: tooLong.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_INVALID');

  const extraField = signedRestoreProof();
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: Object.freeze({ ...extraField.proof, content: 'student letter text' }),
    verificationKeyProvider: extraField.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_INVALID');
});

test('raw booleans and raw receipts cannot impersonate a verified restore proof', () => {
  const binding = resolveLorTargetBinding(configuration());
  assert.equal(statusOf(() => createProductionBackupRestoreAdapterFromVerifiedProof({
    binding,
    verifiedRestoreProof: Object.freeze({ ready: true, passed: true }),
  })), 'VERIFIED_RESTORE_PROOF_REQUIRED');
});

test('verified proof is single-claim and freshness is rechecked when adapter is created', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const signed = signedRestoreProof({ name: 'replay' });
  const firstDescriptor = await verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: signed.provider,
    clock: () => NOW,
  });
  const duplicateDescriptor = await verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: signed.provider,
    clock: () => NOW,
  });
  createProductionBackupRestoreAdapterFromVerifiedProof({
    binding,
    verifiedRestoreProof: firstDescriptor,
  });
  assert.equal(statusOf(() => createProductionBackupRestoreAdapterFromVerifiedProof({
    binding,
    verifiedRestoreProof: duplicateDescriptor,
  })), 'VERIFIED_RESTORE_PROOF_REPLAYED');

  let current = NOW;
  const expiring = await verifiedProof({
    binding,
    proofName: 'environment',
    clock: () => current,
  });
  current = new Date('2026-09-25T16:00:00.000Z');
  assert.equal(statusOf(() => createProductionBackupRestoreAdapterFromVerifiedProof({
    binding,
    verifiedRestoreProof: expiring.descriptor,
  })), 'RESTORE_PROOF_NOT_FRESH');
});

test('key provider is pinned by SPKI fingerprint and receives only safe target metadata', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const signed = signedRestoreProof();
  const requests = [];
  const provider = Object.freeze({
    signerKeyRef: signed.provider.signerKeyRef,
    async loadVerificationKey(request) {
      requests.push(request);
      return signed.pair.publicKey;
    },
  });
  await verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: provider,
    clock: () => NOW,
  });
  assert.equal(requests.length, 1);
  assert.equal(Object.isFrozen(requests[0]), true);
  assert.deepEqual(Object.keys(requests[0]).sort(), [
    'metadataOnly', 'schemaVersion', 'signerKeyRef', 'targetRef',
  ]);
  assert.equal(requests[0].metadataOnly, true);
  assert.match(requests[0].targetRef, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(requests[0]), /signature|content|secret/iu);

  const wrongPair = generateKeyPairSync('ed25519');
  const wrongProvider = Object.freeze({
    signerKeyRef: signed.provider.signerKeyRef,
    async loadVerificationKey() { return wrongPair.publicKey; },
  });
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: wrongProvider,
    clock: () => NOW,
  })), 'RESTORE_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
});

test('proof options, check shapes, and caller boolean authority are exact and fail closed', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const signed = signedRestoreProof();
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: signed.provider,
    clock: () => NOW,
    unexpected: true,
  })), 'RESTORE_PROOF_VERIFICATION_OPTIONS_INVALID');
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: signed.proof,
    verificationKeyProvider: signed.provider,
    clock: () => NOW,
    maxAgeMilliseconds: 60_000,
  })), 'RESTORE_PROOF_VERIFICATION_OPTIONS_INVALID');

  const booleanCheck = signedRestoreProof({
    overrides: {
      checks: PRODUCTION_RESTORE_PROOF_CONTRACT.checks.map((check) => ({
        check,
        evidenceRef: sha256(`restore-check:${check}`),
        passed: true,
      })),
    },
  });
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: booleanCheck.proof,
    verificationKeyProvider: booleanCheck.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_CHECKS_INVALID');

  const smuggledChecks = PRODUCTION_RESTORE_PROOF_CONTRACT.checks.map((check) => ({
    check,
    evidenceRef: sha256(`restore-check:${check}`),
  }));
  smuggledChecks.content = 'student letter text';
  const smuggled = signedRestoreProof({ overrides: { checks: smuggledChecks } });
  assert.equal(await rejectionStatus(verifyProductionRestoreProof({
    binding,
    proof: smuggled.proof,
    verificationKeyProvider: smuggled.provider,
    clock: () => NOW,
  })), 'RESTORE_PROOF_CHECKS_INVALID');
  assert.equal(PRODUCTION_RESTORE_PROOF_CONTRACT.rawReceiptAuthority, false);
  assert.equal(PRODUCTION_RESTORE_PROOF_CONTRACT.callerBooleanAuthority, false);
  assert.equal(PRODUCTION_RESTORE_PROOF_CONTRACT.callerMaximumAgeAuthority, false);
  assert.equal(
    PRODUCTION_RESTORE_PROOF_CONTRACT.pinnedSignerKeyRef,
    PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  );
  assert.equal(
    PRODUCTION_RESTORE_PROOF_CONTRACT.maximumValidityMilliseconds,
    30 * 24 * 60 * 60 * 1_000,
  );
});

test('environment helper reads only dedicated keys and returns the verified one-rehearsal adapter', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const signed = signedRestoreProof({ name: 'environment' });
  const descriptorReads = [];
  const environment = new Proxy({
    ...environmentFor(signed),
    UNRELATED_SECRET: 'must-never-be-read',
  }, {
    getOwnPropertyDescriptor(target, key) {
      descriptorReads.push(key);
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const adapter = await createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment,
    clock: () => NOW,
  });
  assert.deepEqual(descriptorReads, PRODUCTION_RESTORE_PROOF_CONTRACT.environmentKeys);
  const result = await adapter.runSyntheticRehearsal();
  assert.equal(result.passed, true);
  assert.deepEqual(result.results.map((entry) => entry.check), PRODUCTION_RESTORE_PROOF_CONTRACT.checks);
  assert.equal((await adapter.runSyntheticRehearsal()).passed, false);
});

test('environment helper fails closed on missing, malformed, noncanonical, and wrong-key values', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const signed = signedRestoreProof();
  const validEnvironment = environmentFor(signed);

  assert.equal(await rejectionStatus(createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment: {},
    clock: () => NOW,
  })), 'RESTORE_PROOF_ENVIRONMENT_REQUIRED');
  assert.equal(await rejectionStatus(createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment: {
      MMHQ_LOR_RESTORE_PROOF_BASE64URL: validEnvironment.MMHQ_LOR_RESTORE_PROOF_BASE64URL,
    },
    clock: () => NOW,
  })), 'RESTORE_VERIFICATION_SPKI_REQUIRED');
  assert.equal(await rejectionStatus(createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment: environmentFor(signed, { MMHQ_LOR_RESTORE_PROOF_BASE64URL: '***' }),
    clock: () => NOW,
  })), 'RESTORE_PROOF_ENVIRONMENT_INVALID');
  assert.equal(await rejectionStatus(createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment: environmentFor(signed, {
      MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64: Buffer.from('not-a-der-key').toString('base64'),
    }),
    clock: () => NOW,
  })), 'RESTORE_VERIFICATION_SPKI_INVALID');

  const noncanonicalJson = Buffer.from(
    JSON.stringify({ signature: signed.proof.signature, ...signed.proof }),
    'utf8',
  ).toString('base64url');
  assert.notEqual(noncanonicalJson, validEnvironment.MMHQ_LOR_RESTORE_PROOF_BASE64URL);
  assert.equal(await rejectionStatus(createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment: environmentFor(signed, { MMHQ_LOR_RESTORE_PROOF_BASE64URL: noncanonicalJson }),
    clock: () => NOW,
  })), 'RESTORE_PROOF_JSON_NOT_CANONICAL');

  const wrongPair = generateKeyPairSync('ed25519');
  assert.equal(await rejectionStatus(createProductionBackupRestoreAdapterFromEnvironment({
    binding,
    environment: environmentFor(signed, {
      MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64: wrongPair.publicKey
        .export({ format: 'der', type: 'spki' })
        .toString('base64'),
    }),
    clock: () => NOW,
  })), 'RESTORE_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
});

test('environment helper rejects canonical proof JSON carrying a secret-bearing extra field', async () => {
  const binding = resolveLorTargetBinding(configuration());
  const signed = signedRestoreProof();
  const secretValue = 'do-not-emit-this-secret';
  const extraContentProof = { ...signed.proof, secret: secretValue };
  const environment = environmentFor(signed, {
    MMHQ_LOR_RESTORE_PROOF_BASE64URL: Buffer
      .from(canonicalize(extraContentProof), 'utf8')
      .toString('base64url'),
  });
  try {
    await createProductionBackupRestoreAdapterFromEnvironment({
      binding,
      environment,
      clock: () => NOW,
    });
    assert.fail('expected secret-bearing proof to fail closed');
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    assert.equal(error.details.status, 'RESTORE_PROOF_INVALID');
    assert.doesNotMatch(error.message, new RegExp(secretValue, 'u'));
    assert.doesNotMatch(JSON.stringify(error.details), new RegExp(secretValue, 'u'));
  }
});
