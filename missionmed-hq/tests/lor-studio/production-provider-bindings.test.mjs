import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCTION_PROVIDER_BINDINGS_CONTRACT,
  createFacultyInvitationSecretProviderBinding,
  createOpenAiProductionProviderBinding,
  createPostmarkProductionProviderBinding,
  createProductionProviderBindings,
} from '../../lor-studio/adapters/production-provider-bindings.mjs';
import {
  OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
} from '../../lor-studio/adapters/openai-grounded-proposal-adapter.mjs';
import { IntegrationDisabledError } from '../../lor-studio/domain/errors.js';
import { canonicalize } from '../../lor-studio/domain/value-utils.js';
import {
  signedOpenAiPrivacyAttestation,
  signedOpenAiPrivacyEnvironment,
} from './fixtures/signed-openai-privacy-attestations.mjs';

const OPENAI_SECRET = 'sk-project-lor-test-secret-value';
const POSTMARK_SECRET = 'postmark-test-server-token-value';
const HMAC_KEY = Buffer.alloc(32, 0x5a).toString('base64url');
const PROJECT_ID = 'proj_UTCDEhLVMT6aQnCXnBElihZT';
const RELEASE_COMMIT = '9a7a5f56bbc584ace07472e283b1013ab7897fca';
const SERVER_ID = 'postmark-server-lor-production';
const NOW = new Date('2026-08-26T12:00:00.000Z');
const OPENAI_OPTIONS = Object.freeze({ clock: () => NOW });

function environment(overrides = {}) {
  return {
    MMHQ_LOR_OPENAI_API_KEY: OPENAI_SECRET,
    MMHQ_LOR_OPENAI_PROJECT_ID: PROJECT_ID,
    ...signedOpenAiPrivacyEnvironment(PROJECT_ID),
    MMHQ_LOR_POSTMARK_SERVER_TOKEN: POSTMARK_SECRET,
    MMHQ_LOR_POSTMARK_SERVER_ID: SERVER_ID,
    MMHQ_LOR_POSTMARK_FROM_EMAIL: 'lor@example.test',
    MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL: 'support@example.test',
    MMHQ_LOR_INVITATION_ORIGIN: 'https://example.test',
    MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED: 'true',
    MMHQ_LOR_INVITATION_HMAC_KEY: HMAC_KEY,
    MMHQ_LOR_INVITATION_HMAC_KEY_VERSION: 'lor-invitation-hmac-v1',
    MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED: 'true',
    ...overrides,
  };
}

function assertSafeFailure(error) {
  assert.ok(error instanceof IntegrationDisabledError);
  const serialized = `${error.message} ${JSON.stringify(error.details)} ${JSON.stringify(error)}`;
  assert.equal(serialized.includes(OPENAI_SECRET), false);
  assert.equal(serialized.includes(POSTMARK_SECRET), false);
  assert.equal(serialized.includes(HMAC_KEY), false);
  assert.equal('cause' in error, false);
  return true;
}

test('dedicated production factory binds exact OpenAI, Postmark and invitation-secret resources', async () => {
  const result = createProductionProviderBindings(environment(), OPENAI_OPTIONS);
  assert.deepEqual(result.openai.binding, {
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
  assert.equal(result.openai.credentialProvider.serverOnly, true);
  assert.equal(
    await result.openai.credentialProvider.getBearerToken({
      provider: 'openai',
      projectId: PROJECT_ID,
      purpose: 'lor_grounded_proposal',
    }),
    OPENAI_SECRET,
  );

  assert.equal(result.postmark.binding.invitationOrigin, 'https://example.test');
  assert.equal(result.postmark.binding.templateAlias, 'lor-faculty-invitation-v1');
  assert.equal(result.postmark.transportBinding.serverId, SERVER_ID);
  assert.equal(result.postmark.transportBinding.messageStream, 'outbound');
  assert.equal(
    await result.postmark.credentialProvider.getServerToken({
      provider: 'postmark',
      purpose: 'lor_faculty_invitation_delivery',
      serverId: SERVER_ID,
    }),
    POSTMARK_SECRET,
  );

  assert.equal(result.facultyInvitationSecrets.binding.keyVersion, 'lor-invitation-hmac-v1');
  const key = await result.facultyInvitationSecrets.keyProvider.getKey({
    purpose: 'lor_faculty_invitation_hmac',
    keyVersion: 'lor-invitation-hmac-v1',
  });
  assert.deepEqual(key, Buffer.from(HMAC_KEY, 'base64url'));
  key.fill(0);
  const secondKey = await result.facultyInvitationSecrets.keyProvider.getKey({
    purpose: 'lor_faculty_invitation_hmac',
    keyVersion: 'lor-invitation-hmac-v1',
  });
  assert.deepEqual(secondKey, Buffer.from(HMAC_KEY, 'base64url'), 'callers receive defensive copies');
});

test('private credential material is absent from serialization and public property descriptors', () => {
  const result = createProductionProviderBindings(environment(), OPENAI_OPTIONS);
  const serialized = JSON.stringify(result);
  for (const secret of [OPENAI_SECRET, POSTMARK_SECRET, HMAC_KEY]) {
    assert.equal(serialized.includes(secret), false);
  }
  for (const provider of [
    result.openai.credentialProvider,
    result.postmark.credentialProvider,
    result.facultyInvitationSecrets.keyProvider,
  ]) {
    const descriptors = Object.getOwnPropertyDescriptors(provider);
    assert.deepEqual(Object.keys(descriptors), ['serverOnly']);
    assert.equal(descriptors.serverOnly.value, true);
  }
});

test('credential providers refuse reuse against a different project, server or key version', async () => {
  const result = createProductionProviderBindings(environment(), OPENAI_OPTIONS);
  await assert.rejects(
    () => result.openai.credentialProvider.getBearerToken({
      provider: 'openai',
      projectId: 'proj_unboundproject999',
      purpose: 'lor_grounded_proposal',
    }),
    assertSafeFailure,
  );
  await assert.rejects(
    () => result.postmark.credentialProvider.getServerToken({
      provider: 'postmark',
      purpose: 'lor_faculty_invitation_delivery',
      serverId: 'unbound-server',
    }),
    assertSafeFailure,
  );
  await assert.rejects(
    () => result.facultyInvitationSecrets.keyProvider.getKey({
      purpose: 'lor_faculty_invitation_hmac',
      keyVersion: 'unbound-version',
    }),
    assertSafeFailure,
  );
});

test('generic credentials are never fallbacks and are not read', () => {
  let genericGetterCalls = 0;
  const env = {
    OPENAI_API_KEY: OPENAI_SECRET,
    POSTMARK_SERVER_TOKEN: POSTMARK_SECRET,
  };
  Object.defineProperty(env, 'AWS_SECRET_ACCESS_KEY', {
    enumerable: true,
    get() {
      genericGetterCalls += 1;
      return 'must-not-be-read';
    },
  });
  assert.throws(() => createOpenAiProductionProviderBinding(env, OPENAI_OPTIONS), assertSafeFailure);
  assert.throws(() => createPostmarkProductionProviderBinding(env), assertSafeFailure);
  assert.equal(genericGetterCalls, 0);
});

test('partial provider evidence and non-exact truth values fail closed', () => {
  const tamperedClaims = (overrides) => Buffer.from(canonicalize({
    ...signedOpenAiPrivacyAttestation(PROJECT_ID),
    ...overrides,
  }), 'utf8').toString('base64url');
  const openaiOverrides = [
    { MMHQ_LOR_OPENAI_API_KEY: '' },
    { MMHQ_LOR_OPENAI_PROJECT_ID: 'project-default' },
    { MMHQ_LOR_OPENAI_PROJECT_ID: 'proj_lorproduction123' },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: '' },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: '***' },
    { MMHQ_LOR_RELEASE_COMMIT: '' },
    { MMHQ_LOR_RELEASE_COMMIT: 'A'.repeat(40) },
    { MMHQ_LOR_RELEASE_COMMIT: 'b'.repeat(40) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      privacyAuthority: 'DR-133',
    }) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      privacyPosture: 'zero_data_retention',
    }) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      zeroDataRetentionClaimed: true,
    }) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      apiDataTrainingPosture: 'training_opt_out',
    }) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      processingPolicyDigest: 'a'.repeat(64),
    }) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      educationRecordProcessingAuthorized: false,
    }) },
    { MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL: tamperedClaims({
      independentlyVerified: false,
    }) },
  ];
  for (const overrides of openaiOverrides) {
    assert.throws(
      () => createOpenAiProductionProviderBinding(environment(overrides), OPENAI_OPTIONS),
      assertSafeFailure,
    );
  }
  const postmarkOverrides = [
    { MMHQ_LOR_POSTMARK_SERVER_TOKEN: '' },
    { MMHQ_LOR_POSTMARK_FROM_EMAIL: 'Display Name <lor@example.test>' },
    { MMHQ_LOR_POSTMARK_FROM_EMAIL: 'LOR@example.test' },
    { MMHQ_LOR_INVITATION_ORIGIN: 'http://example.test' },
    { MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND: 'false' },
    { MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED: 'pending' },
  ];
  for (const overrides of postmarkOverrides) {
    assert.throws(
      () => createPostmarkProductionProviderBinding(environment(overrides)),
      assertSafeFailure,
    );
  }
});

test('invitation HMAC key accepts canonical base64url only and enforces 32-byte minimum', () => {
  for (const key of [
    Buffer.alloc(31, 0x5a).toString('base64url'),
    `${HMAC_KEY}=`,
    ` ${HMAC_KEY}`,
    Buffer.alloc(257, 0x5a).toString('base64url'),
  ]) {
    assert.throws(
      () => createFacultyInvitationSecretProviderBinding(environment({
        MMHQ_LOR_INVITATION_HMAC_KEY: key,
      })),
      assertSafeFailure,
    );
  }
});

test('environment accessors and proxy failures are rejected without invoking a secret getter', () => {
  let getterCalls = 0;
  const accessorEnvironment = environment();
  Object.defineProperty(accessorEnvironment, 'MMHQ_LOR_OPENAI_API_KEY', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return OPENAI_SECRET;
    },
  });
  assert.throws(
    () => createOpenAiProductionProviderBinding(accessorEnvironment),
    assertSafeFailure,
  );
  assert.equal(getterCalls, 0);

  const hostileEnvironment = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error(`provider failed with ${OPENAI_SECRET}`);
    },
  });
  assert.throws(
    () => createOpenAiProductionProviderBinding(hostileEnvironment),
    assertSafeFailure,
  );
});

test('contract publishes the exact allowlisted env names without generic provider variables', () => {
  const names = PRODUCTION_PROVIDER_BINDINGS_CONTRACT.dedicatedEnvironmentNames;
  assert.ok(names.length > 10);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((name) => name.startsWith('MMHQ_LOR_')));
  assert.equal(names.includes('OPENAI_API_KEY'), false);
  assert.equal(names.includes('POSTMARK_SERVER_TOKEN'), false);
  assert.equal(names.includes('AWS_SECRET_ACCESS_KEY'), false);
  assert.equal(names.includes('MMHQ_LOR_OPENAI_EDUCATION_RECORD_PROCESSING_AUTHORIZED'), false);
  assert.equal(names.includes('MMHQ_LOR_OPENAI_ZDR_VERIFIED'), false);
  assert.equal(names.includes('MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL'), true);
  assert.equal(names.includes('MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64'), true);
  assert.equal(names.includes('MMHQ_LOR_RELEASE_COMMIT'), true);
  assert.equal(names.includes('RAILWAY_GIT_COMMIT_SHA'), false);
  assert.equal(
    PRODUCTION_PROVIDER_BINDINGS_CONTRACT.openaiPrivacyAuthority,
    'source_pinned_signed_dr139_standard_retention_project_model_release_policy_attestation_only',
  );
  assert.equal(
    PRODUCTION_PROVIDER_BINDINGS_CONTRACT.openaiRuntimeReleaseIdentity,
    'MMHQ_LOR_RELEASE_COMMIT_exact_40_hex_release_inventory_probe_and_signed_attestation_binding',
  );
  assert.equal(PRODUCTION_PROVIDER_BINDINGS_CONTRACT.genericCredentialFallback, false);
  assert.equal(
    PRODUCTION_PROVIDER_BINDINGS_CONTRACT.invitationHmacEncoding,
    'canonical_base64url_32_to_256_bytes',
  );
});
