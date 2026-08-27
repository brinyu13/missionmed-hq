// Railway service-side probe. No static imports are allowed: only the exact
// LOR variable inventory is copied, the ambient environment is erased, and
// the verifier is dynamically imported afterward.

const CONTRACT = 'missionmed.lor.railway-dr133-production-release-variable-probe.v1';
const CONTROL = /\u0000/u;
const MAX_VALUE_LENGTH = 64 * 1_024;
const MAX_EXPECTATION_LENGTH = 32 * 1_024;
const KEYS = Object.freeze([
  'LOR_DR133_RUNTIME_DATABASE_CA',
  'LOR_DR133_RUNTIME_DATABASE_URL',
  'MMHQ_LOR_INVITATION_HMAC_KEY',
  'MMHQ_LOR_INVITATION_HMAC_KEY_VERSION',
  'MMHQ_LOR_INVITATION_ORIGIN',
  'MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_OPENAI_API_KEY',
  'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL',
  'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64',
  'MMHQ_LOR_OPENAI_PROJECT_ID',
  'MMHQ_LOR_POSTMARK_FROM_EMAIL',
  'MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL',
  'MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED',
  'MMHQ_LOR_POSTMARK_SERVER_ID',
  'MMHQ_LOR_POSTMARK_SERVER_TOKEN',
  'MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_IDENTITY',
  'MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64',
  'MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION',
  'MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_RESTORE_PROOF_BASE64URL',
  'MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64',
  'MMHQ_LOR_STUDIO_ENABLED',
  'MMHQ_LOR_STUDIO_KILL_SWITCH',
  'MMHQ_LOR_STUDIO_REQUIRE_CANARY',
  'MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_ADMIN',
  'MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_HOST',
  'MMHQ_LOR_STUDIO_RUNTIME_TARGET_ENVIRONMENT_NAME',
  'MMHQ_LOR_STUDIO_RUNTIME_TARGET_EXECUTION_SERVICE_ID',
  'MMHQ_LOR_STUDIO_RUNTIME_TARGET_LOGIN',
  'MMHQ_LOR_STUDIO_RUNTIME_TARGET_SCHEMA_VERSION',
  'MMHQ_LOR_STUDIO_TARGET_DATABASE_NAME',
  'MMHQ_LOR_STUDIO_TARGET_DATA_COPIED',
  'MMHQ_LOR_STUDIO_TARGET_DECISION_RECORD',
  'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT',
  'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_BOUND',
  'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_ID',
  'MMHQ_LOR_STUDIO_TARGET_HEALTH',
  'MMHQ_LOR_STUDIO_TARGET_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_STUDIO_TARGET_MIGRATION_LEDGER',
  'MMHQ_LOR_STUDIO_TARGET_PRODUCTION_DATA_BINDING_PASSED',
  'MMHQ_LOR_STUDIO_TARGET_PROJECT_ID',
  'MMHQ_LOR_STUDIO_TARGET_PROVIDER',
  'MMHQ_LOR_STUDIO_TARGET_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_STUDIO_TARGET_RATIFIED',
  'MMHQ_LOR_STUDIO_TARGET_REGION',
  'MMHQ_LOR_STUDIO_TARGET_SCHEMA',
  'MMHQ_LOR_STUDIO_TARGET_SCHEMA_VERSION',
  'MMHQ_LOR_STUDIO_TARGET_SERVICE_ID',
]);

function copyExactEnvironment(ambient) {
  const snapshot = Object.create(null);
  for (const key of KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(ambient, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')
      || typeof descriptor.value !== 'string'
      || descriptor.value.length > MAX_VALUE_LENGTH
      || CONTROL.test(descriptor.value)) throw new TypeError('variable missing');
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function scrub(environment) {
  for (const key of Object.keys(environment)) {
    delete environment[key];
    if (Object.hasOwn(environment, key)) throw new TypeError('environment scrub failed');
  }
}

try {
  if (process.argv.length !== 3 || typeof process.argv[2] !== 'string'
    || process.argv[2].length < 16 || process.argv[2].length > MAX_EXPECTATION_LENGTH
    || /[\u0000-\u0020\u007f]/u.test(process.argv[2])) throw new TypeError('argument invalid');
  const encodedExpectations = process.argv[2];
  const snapshot = copyExactEnvironment(process.env);
  scrub(process.env);
  Object.assign(process.env, {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: '1',
  });
  const module = await import('./railway-dr133-production-release-orchestrator.mjs');
  if (JSON.stringify(module.DR133_RELEASE_VARIABLE_KEYS) !== JSON.stringify(KEYS)) {
    throw new TypeError('variable inventory drift');
  }
  const receipt = module.verifyDr133ReleaseVariablesFromEnvironment({
    encodedExpectations,
    environment: snapshot,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} catch {
  process.stdout.write(`${JSON.stringify({
    contract: CONTRACT,
    result: 'BLOCKED',
    errorCode: 'VARIABLE_PROBE_FAILED_CLOSED',
  })}\n`);
  process.exitCode = 2;
}
