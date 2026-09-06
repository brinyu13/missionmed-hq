import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT,
  createOpenAiPrivacyBindingFromVerifiedAttestation,
  verifyOpenAiProductionPrivacyAttestation,
  verifyOpenAiProductionPrivacyAttestationFromEnvironment,
} from '../../lor-studio/adapters/openai-production-privacy-attestation.mjs';
import {
  OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
} from '../../lor-studio/adapters/openai-grounded-proposal-adapter.mjs';
import {
  PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  productionRestoreSignerKeyRef,
} from '../../lor-studio/adapters/production-readiness-surfaces.mjs';
import { canonicalize } from '../../lor-studio/domain/value-utils.js';
import {
  LEGACY_ZDR_V1_ATTESTATION_BASE64URL,
  PATH_B_FIXTURE_RELEASE_COMMIT,
  PINNED_RELEASE_CAPTAIN_SPKI_BASE64,
  SIGNED_FOREIGN_PROJECT_V2_REJECTION_ATTESTATION_BASE64URL,
  signedOpenAiPrivacyAttestation,
  signedOpenAiPrivacyEnvironment,
} from './fixtures/signed-openai-privacy-attestations.mjs';

const PROJECT_ID = 'proj_UTCDEhLVMT6aQnCXnBElihZT';
const RELEASE_COMMIT = PATH_B_FIXTURE_RELEASE_COMMIT;
const NOW = new Date('2026-08-26T12:00:00.000Z');

function verificationKey() {
  return createPublicKey({
    key: Buffer.from(PINNED_RELEASE_CAPTAIN_SPKI_BASE64, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function statusOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    assert.equal(error.details.integration, 'openai_grounded_proposal');
    return error.details.status;
  }
  return assert.fail('expected fail-closed operation');
}

test('source-pinned signed attestation alone mints the exact OpenAI privacy binding', () => {
  const descriptor = verifyOpenAiProductionPrivacyAttestation({
    attestation: signedOpenAiPrivacyAttestation(PROJECT_ID),
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => NOW,
  });
  assert.deepEqual(Object.keys(descriptor).sort(), [
    'attestationRef',
    'evidenceRef',
    'expiresAt',
    'issuedAt',
    'missionId',
    'model',
    'projectRef',
    'provider',
    'releaseCommit',
    'schemaVersion',
  ]);
  assert.equal(descriptor.provider, 'openai');
  assert.equal(descriptor.model, 'gpt-5.6-terra');
  assert.match(descriptor.attestationRef, /^[a-f0-9]{64}$/u);
  assert.match(descriptor.evidenceRef, /^[a-f0-9]{64}$/u);

  const binding = createOpenAiPrivacyBindingFromVerifiedAttestation({
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verifiedAttestation: descriptor,
  });
  assert.deepEqual(binding, {
    schemaVersion: 'missionmed.lor.openai-project-binding.v2',
    provider: 'openai',
    providerResourceBound: true,
    missionId: 'F2-LOR-1012',
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    privacyAuthority: 'DR-139',
    privacyPosture: 'standard_api_retention',
    zeroDataRetentionClaimed: false,
    apiDataTrainingPosture: 'api_content_not_used_for_model_training_by_default',
    processingPolicyDigest: OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
    educationRecordProcessingAuthorized: true,
    independentlyVerified: true,
  });
  assert.equal(statusOf(() => createOpenAiPrivacyBindingFromVerifiedAttestation({
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verifiedAttestation: descriptor,
  })), 'VERIFIED_OPENAI_PRIVACY_ATTESTATION_REPLAYED');
});

test('attestation enforces exact mission, release, provider, project, model and Path B claims', () => {
  const valid = signedOpenAiPrivacyAttestation(PROJECT_ID);
  const mutations = [
    { provider: 'compatible-openai-proxy' },
    { missionId: 'F2-LOR-1013' },
    { projectId: 'proj_different123' },
    { releaseCommit: 'b'.repeat(40) },
    { model: 'gpt-5.6-sol' },
    { privacyAuthority: 'DR-133' },
    { privacyPosture: 'zero_data_retention' },
    { zeroDataRetentionClaimed: true },
    { apiDataTrainingPosture: 'training_opt_out' },
    { processingPolicyDigest: 'a'.repeat(64) },
    { educationRecordProcessingAuthorized: false },
    { independentlyVerified: false },
    { evidenceDigest: 'pending' },
  ];
  for (const mutation of mutations) {
    assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
      attestation: { ...valid, ...mutation },
      projectId: PROJECT_ID,
      releaseCommit: RELEASE_COMMIT,
      verificationKey: verificationKey(),
      clock: () => NOW,
    })), 'OPENAI_PRIVACY_ATTESTATION_INVALID');
  }
});

test('a validly signed attestation for a different OpenAI project is rejected', () => {
  const foreignProjectAttestation = JSON.parse(Buffer.from(
    SIGNED_FOREIGN_PROJECT_V2_REJECTION_ATTESTATION_BASE64URL,
    'base64url',
  ).toString('utf8'));
  assert.equal(foreignProjectAttestation.projectId, 'proj_lorproduction123');
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: foreignProjectAttestation,
    projectId: foreignProjectAttestation.projectId,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => NOW,
  })), 'OPENAI_EXACT_PROJECT_BINDING_REQUIRED');
});

test('signature, source pin, canonical times and thirty-day maximum fail closed', () => {
  const valid = signedOpenAiPrivacyAttestation(PROJECT_ID);
  const wrongKey = generateKeyPairSync('ed25519').publicKey;
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: valid,
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: wrongKey,
    clock: () => NOW,
  })), 'OPENAI_PRIVACY_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: {
      ...valid,
      signature: `${valid.signature[0] === 'A' ? 'B' : 'A'}${valid.signature.slice(1)}`,
    },
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => NOW,
  })), 'OPENAI_PRIVACY_ATTESTATION_SIGNATURE_INVALID');
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: { ...valid, expiresAt: '2026-09-25T00:00:00.001Z' },
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => NOW,
  })), 'OPENAI_PRIVACY_ATTESTATION_INVALID');
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: valid,
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => new Date('2026-09-25T00:00:00.000Z'),
  })), 'OPENAI_PRIVACY_ATTESTATION_NOT_CURRENT');
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: valid,
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => new Date('2026-08-25T23:59:29.999Z'),
  })), 'OPENAI_PRIVACY_ATTESTATION_NOT_CURRENT');
  assert.equal(
    productionRestoreSignerKeyRef(verificationKey()),
    PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  );
});

test('raw descriptors and target replay cannot create privacy authority', () => {
  const raw = Object.freeze({
    schemaVersion: 'missionmed.lor.verified-openai-privacy-attestation.v2',
    provider: 'openai',
    missionId: 'F2-LOR-1012',
    projectRef: 'a'.repeat(64),
    releaseCommit: RELEASE_COMMIT,
    model: 'gpt-5.6-terra',
    issuedAt: '2026-08-26T00:00:00.000Z',
    expiresAt: '2026-09-25T00:00:00.000Z',
    evidenceRef: 'b'.repeat(64),
    attestationRef: 'c'.repeat(64),
  });
  assert.equal(statusOf(() => createOpenAiPrivacyBindingFromVerifiedAttestation({
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verifiedAttestation: raw,
  })), 'VERIFIED_OPENAI_PRIVACY_ATTESTATION_REQUIRED');
});

test('environment verifier reads only canonical public evidence and rejects smuggling', () => {
  const descriptorReads = [];
  const environment = new Proxy({
    ...signedOpenAiPrivacyEnvironment(PROJECT_ID),
    UNRELATED_SECRET: 'must-never-be-read',
  }, {
    getOwnPropertyDescriptor(target, key) {
      descriptorReads.push(key);
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const descriptor = verifyOpenAiProductionPrivacyAttestationFromEnvironment({
    environment,
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    clock: () => NOW,
  });
  assert.deepEqual(
    descriptorReads,
    OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.environmentKeys,
  );
  assert.equal(descriptor.provider, 'openai');

  const decoded = signedOpenAiPrivacyAttestation(PROJECT_ID);
  const noncanonical = JSON.stringify({ signature: decoded.signature, ...decoded });
  assert.notEqual(noncanonical, canonicalize(decoded));
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestationFromEnvironment({
    environment: {
      ...signedOpenAiPrivacyEnvironment(PROJECT_ID),
      MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL:
        Buffer.from(noncanonical, 'utf8').toString('base64url'),
    },
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    clock: () => NOW,
  })), 'OPENAI_PRIVACY_ATTESTATION_JSON_NOT_CANONICAL');
});

test('the previously valid signed ZDR v1 attestation cannot be relabelled or reused', () => {
  const legacy = JSON.parse(Buffer.from(
    LEGACY_ZDR_V1_ATTESTATION_BASE64URL,
    'base64url',
  ).toString('utf8'));
  assert.equal(statusOf(() => verifyOpenAiProductionPrivacyAttestation({
    attestation: legacy,
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    verificationKey: verificationKey(),
    clock: () => NOW,
  })), 'OPENAI_PRIVACY_ATTESTATION_INVALID');
});

test('contract exposes no caller boolean authority and exact signed-evidence variables', () => {
  assert.equal(OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.callerBooleanAuthority, false);
  assert.equal(
    OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.pinnedSignerKeyRef,
    PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  );
  assert.equal(
    OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.maximumValidityMilliseconds,
    30 * 24 * 60 * 60 * 1_000,
  );
  assert.deepEqual(OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.environmentKeys, [
    'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL',
    'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64',
  ]);
  assert.deepEqual(OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.exactClaims, {
    missionId: 'F2-LOR-1012',
    projectId: PROJECT_ID,
    releaseCommit: 'exact_40_hex_runtime_release_commit',
    privacyAuthority: 'DR-139',
    privacyPosture: 'standard_api_retention',
    zeroDataRetentionClaimed: false,
    apiDataTrainingPosture: 'api_content_not_used_for_model_training_by_default',
    processingPolicyDigest: OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
    educationRecordProcessingAuthorized: true,
    independentlyVerified: true,
  });
});
