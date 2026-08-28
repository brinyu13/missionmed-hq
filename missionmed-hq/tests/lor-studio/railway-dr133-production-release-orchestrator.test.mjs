import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  PATH_B_FIXTURE_PROJECT_ID,
  PATH_B_FIXTURE_RELEASE_COMMIT,
  signedOpenAiPrivacyEnvironment,
} from './fixtures/signed-openai-privacy-attestations.mjs';
import {
  DR133_PRODUCTION_RELEASE_CONTRACT,
  DR133_RELEASE_ORCHESTRATOR_CONTRACT,
  DR133_RELEASE_VARIABLE_EXPECTATION_SCHEMA,
  DR133_RELEASE_VARIABLE_KEYS,
  DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
  Dr133ProductionReleaseError,
  activateDr133NamedCanaryCandidate,
  activateDr133NamedRolloutCandidate,
  bindDr133ReleaseVariable,
  captureDr133ReleaseDeploymentPreimage,
  createDr133ProductionReleaseOrchestrator,
  createDr133ImmutableReleaseArchive,
  createDr133ReleaseVariableExpectationManifest,
  deployDr133ImmutableDarkCandidate,
  dr133ReleaseVariableValueSha256,
  dr133ProductionReleaseErrorReceipt,
  dr133ReleaseDeploymentRef,
  inspectDr133ReleaseVariableValue,
  inspectDr133ReleaseVariable,
  parseDr133ReleaseDeploymentList,
  parseDr133ReleaseVariableExpectationManifest,
  runDr133ExactRollbackRedeployDrill,
  verifyDr133CanaryHealthAndContainment,
  verifyDr133DarkHealthAndContainment,
  verifyDr133ReleaseRemoteBindings,
  verifyDr133ReleaseVariablesFromEnvironment,
} from '../../scripts/lor-studio/railway-dr133-production-release-orchestrator.mjs';

const CA = await readFile(new URL('./dr133-production-root-ca.pem', import.meta.url), 'utf8');
const PREIMAGE_ID = '11111111-1111-4111-8111-111111111111';
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222';
const ROLLBACK_ID = '33333333-3333-4333-8333-333333333333';
const REDEPLOY_ID = '44444444-4444-4444-8444-444444444444';
const UNRELATED_ID = '55555555-5555-4555-8555-555555555555';
const CREATED_PREIMAGE = '2026-08-26T20:00:00.000Z';
const CREATED_CANDIDATE = '2026-08-26T21:00:00.000Z';
const OPENAI_PRIVACY = signedOpenAiPrivacyEnvironment(PATH_B_FIXTURE_PROJECT_ID);

const TARGET_VALUES = Object.freeze({
  MMHQ_LOR_STUDIO_TARGET_SCHEMA_VERSION: 'missionmed.lor.target-binding.v2',
  MMHQ_LOR_STUDIO_TARGET_RATIFIED: 'true',
  MMHQ_LOR_STUDIO_TARGET_DECISION_RECORD: DR133_TARGET.decisionRecord,
  MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT: DR133_TARGET.deploymentEnvironment,
  MMHQ_LOR_STUDIO_TARGET_PROVIDER: DR133_TARGET.provider,
  MMHQ_LOR_STUDIO_TARGET_PROJECT_ID: DR133_TARGET.projectId,
  MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_ID: DR133_TARGET.environmentId,
  MMHQ_LOR_STUDIO_TARGET_SERVICE_ID: DR133_TARGET.databaseServiceId,
  MMHQ_LOR_STUDIO_TARGET_DATABASE_NAME: DR133_TARGET.databaseName,
  MMHQ_LOR_STUDIO_TARGET_REGION: DR133_TARGET.region,
  MMHQ_LOR_STUDIO_TARGET_SCHEMA: 'lor_studio',
  MMHQ_LOR_STUDIO_TARGET_MIGRATION_LEDGER: DR133_TARGET.migrationLedger,
  MMHQ_LOR_STUDIO_TARGET_PROVIDER_RESOURCE_BOUND: 'true',
  MMHQ_LOR_STUDIO_TARGET_INDEPENDENTLY_VERIFIED: 'true',
  MMHQ_LOR_STUDIO_TARGET_HEALTH: 'ready',
  MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_BOUND: 'true',
  MMHQ_LOR_STUDIO_TARGET_DATA_COPIED: 'false',
  MMHQ_LOR_STUDIO_TARGET_PRODUCTION_DATA_BINDING_PASSED: 'true',
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_SCHEMA_VERSION:
    'missionmed.lor.production-runtime-target.v1',
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_EXECUTION_SERVICE_ID: DR133_TARGET.applicationServiceId,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_HOST: DR133_TARGET.databaseHost,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_ADMIN: DR133_TARGET.databaseAdmin,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_LOGIN: DR133_RUNTIME_LOGIN,
});

const TRUE_PROOF_KEYS = new Set([
  'MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED',
  'MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND',
]);

function validVariableValue(key) {
  if (TARGET_VALUES[key] !== undefined) return TARGET_VALUES[key];
  if (TRUE_PROOF_KEYS.has(key)) return 'true';
  switch (key) {
    case 'LOR_DR133_RUNTIME_DATABASE_CA': return CA;
    case 'LOR_DR133_RUNTIME_DATABASE_URL':
      return `postgresql://${DR133_RUNTIME_LOGIN}:${'z'.repeat(64)}`
        + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`;
    case 'MMHQ_LOR_INVITATION_HMAC_KEY': return Buffer.alloc(32, 3).toString('base64url');
    case 'MMHQ_LOR_INVITATION_HMAC_KEY_VERSION': return 'lor-invitation-k1';
    case 'MMHQ_LOR_INVITATION_ORIGIN':
      return 'https://missionmed-hq-production.up.railway.app';
    case 'MMHQ_LOR_OPENAI_API_KEY': return `sk-proj-${'a'.repeat(48)}`;
    case 'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL':
      return OPENAI_PRIVACY.MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL;
    case 'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64':
      return OPENAI_PRIVACY.MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64;
    case 'MMHQ_LOR_OPENAI_PROJECT_ID': return PATH_B_FIXTURE_PROJECT_ID;
    case 'MMHQ_LOR_POSTMARK_FROM_EMAIL': return 'lor@missionmedinstitute.com';
    case 'MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL': return '';
    case 'MMHQ_LOR_POSTMARK_SERVER_ID': return 'missionmed-lor-production';
    case 'MMHQ_LOR_POSTMARK_SERVER_TOKEN': return 'p'.repeat(48);
    case 'MMHQ_LOR_PRIVATE_STORAGE_IDENTITY': return 'railway-postgres-lor-writer-depot';
    case 'MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64': return Buffer.alloc(32, 5).toString('base64');
    case 'MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION': return 'lor-storage-k1';
    case 'MMHQ_LOR_RELEASE_COMMIT': return PATH_B_FIXTURE_RELEASE_COMMIT;
    case 'MMHQ_LOR_RESTORE_PROOF_BASE64URL':
      return Buffer.from('{"proof":"metadata-only"}', 'utf8').toString('base64url');
    case 'MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64':
      return Buffer.alloc(44, 7).toString('base64');
    case 'MMHQ_LOR_STUDIO_ENABLED': return 'false';
    case 'MMHQ_LOR_STUDIO_KILL_SWITCH': return 'true';
    case 'MMHQ_LOR_STUDIO_REQUIRE_CANARY': return 'true';
    default: return assert.fail(`missing fixture for ${key}`);
  }
}

function validVariableEnvironment() {
  return Object.fromEntries(DR133_RELEASE_VARIABLE_KEYS.map(
    (key) => [key, validVariableValue(key)],
  ));
}

function variableExpectations(environment = validVariableEnvironment()) {
  const entries = DR133_RELEASE_VARIABLE_KEYS.map((key) => {
    const bytes = Buffer.from(environment[key], 'utf8');
    try {
      return {
        key,
        sha256: inspectDr133ReleaseVariableValue(key, bytes).valueSha256,
      };
    } finally {
      bytes.fill(0);
    }
  });
  return createDr133ReleaseVariableExpectationManifest(entries);
}

function outcome(stdout = Buffer.alloc(0), overrides = {}) {
  return {
    exitCode: 0,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(JSON.stringify(stdout), 'utf8'),
    stderrBytes: 0,
    childStarted: true,
    spawnFailed: false,
    timedOut: false,
    overflow: false,
    killFailed: false,
    closeObserved: true,
    uncertainChild: false,
    processError: false,
    stdinError: false,
    stdoutError: false,
    stderrError: false,
    executableDrift: false,
    ...overrides,
  };
}

function deployment(id, createdAt, { canRollback = false, status = 'SUCCESS' } = {}) {
  return { id, status, createdAt, canRollback };
}

function deploymentLogsUrl(id, { reversed = false } = {}) {
  const base = `https://railway.com/project/${DR133_TARGET.projectId}`
    + `/service/${DR133_TARGET.applicationServiceId}`;
  const environment = `environmentId=${DR133_TARGET.environmentId}`;
  const deploymentId = `id=${id}`;
  return `${base}?${reversed ? `${deploymentId}&${environment}` : `${environment}&${deploymentId}`}`;
}

function deploymentListOutcome(records) {
  return outcome({
    data: {
      deployments: {
        edges: records.map((record) => ({ node: record })),
      },
    },
  });
}

function httpResponse(url, status, payload) {
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  let delivered = false;
  return {
    status,
    url,
    body: {
      getReader() {
        return {
          async read() {
            if (delivered) return { done: true, value: undefined };
            delivered = true;
            return { done: false, value: bytes };
          },
          async cancel() { bytes.fill(0); },
        };
      },
    },
  };
}

function darkFetchRecorder() {
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      calls.push({ url, options });
      if (url.endsWith('/health')) return httpResponse(url, 200, { status: 'ok' });
      if (url.endsWith('/health/lor-studio')) {
        return httpResponse(url, 200, { status: 'ready' });
      }
      return httpResponse(url, 404, { error: 'lor_feature_disabled' });
    },
  };
}

function canaryVariableEnvironment() {
  return {
    ...validVariableEnvironment(),
    MMHQ_LOR_STUDIO_ENABLED: 'true',
    MMHQ_LOR_STUDIO_KILL_SWITCH: 'false',
    MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'true',
  };
}

function rolloutVariableEnvironment() {
  return {
    ...validVariableEnvironment(),
    MMHQ_LOR_STUDIO_ENABLED: 'true',
    MMHQ_LOR_STUDIO_KILL_SWITCH: 'false',
    MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'false',
  };
}

function canaryFetchRecorder({ initiallyDark = false } = {}) {
  const calls = [];
  let candidateProbeCount = 0;
  return {
    calls,
    async fetch(url, options) {
      calls.push({ url, options });
      if (url.endsWith('/health')) return httpResponse(url, 200, { status: 'ok' });
      if (url.endsWith('/health/lor-studio')) {
        return httpResponse(url, 200, { status: 'ready' });
      }
      candidateProbeCount += 1;
      if (
        initiallyDark
        && candidateProbeCount <= DR133_PRODUCTION_RELEASE_CONTRACT.darkContainmentSurfaces.length
      ) {
        return httpResponse(url, 404, { error: 'lor_feature_disabled' });
      }
      return httpResponse(url, 403, {
        error: 'candidate_auth_start_denied',
        message: 'Faculty invitation sign-in could not be started.',
      });
    },
  };
}

function failingRolloutFetchRecorder() {
  const calls = [];
  let readinessCount = 0;
  let candidateCount = 0;
  return {
    calls,
    async fetch(url, options) {
      calls.push({ url, options });
      if (url.endsWith('/health')) return httpResponse(url, 200, { status: 'ok' });
      if (url.endsWith('/health/lor-studio')) {
        readinessCount += 1;
        return readinessCount === 2
          ? httpResponse(url, 503, { status: 'unavailable' })
          : httpResponse(url, 200, { status: 'ready' });
      }
      candidateCount += 1;
      return candidateCount === 1
        ? httpResponse(url, 403, {
          error: 'candidate_auth_start_denied',
          message: 'Faculty invitation sign-in could not be started.',
        })
        : httpResponse(url, 404, { error: 'lor_feature_disabled' });
    },
  };
}

test('release inventory is exact, sorted, dedicated, and exposes no arbitrary-command surface', () => {
  assert.equal(DR133_RELEASE_VARIABLE_KEYS.length, 55);
  assert.deepEqual(DR133_RELEASE_VARIABLE_KEYS, [...DR133_RELEASE_VARIABLE_KEYS].sort());
  assert.equal(new Set(DR133_RELEASE_VARIABLE_KEYS).size, 55);
  assert.ok(DR133_RELEASE_VARIABLE_KEYS.every(
    (key) => key.startsWith('MMHQ_LOR_') || key.startsWith('LOR_DR133_'),
  ));
  assert.ok(!DR133_RELEASE_VARIABLE_KEYS.includes('OPENAI_API_KEY'));
  assert.ok(!DR133_RELEASE_VARIABLE_KEYS.includes('DATABASE_URL'));
  assert.ok(DR133_RELEASE_VARIABLE_KEYS.includes('MMHQ_LOR_RELEASE_COMMIT'));
  assert.deepEqual(
    DR133_RELEASE_VARIABLE_KEYS.filter((key) => key.startsWith('MMHQ_LOR_OPENAI_')),
    [
      'MMHQ_LOR_OPENAI_API_KEY',
      'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL',
      'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64',
      'MMHQ_LOR_OPENAI_PROJECT_ID',
    ],
  );
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.variableMutation,
    'railway variable set KEY --stdin --skip-deploys --json');
  assert.deepEqual(DR133_PRODUCTION_RELEASE_CONTRACT.operations, [
    'activate-canary',
    'activate-rollout',
    'bind-variable',
    'capture-preimage',
    'deploy-dark',
    'inspect-variable',
    'rollback-redeploy',
    'verify-bindings',
    'verify-dark',
  ]);
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.arbitraryCommands, false);
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.environmentDump, false);
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.secretOutput, false);
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.operatorReadinessRoute, '/health/lor-studio');
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.openAiProjectId,
    PATH_B_FIXTURE_PROJECT_ID);
  assert.equal(DR133_PRODUCTION_RELEASE_CONTRACT.sourceCommitBinding,
    'MMHQ_LOR_RELEASE_COMMIT_domain_separated_expectation_hash');
  assert.deepEqual(DR133_PRODUCTION_RELEASE_CONTRACT.archivePaths, [
    '.railwayignore', 'missionmed-hq', 'package-lock.json', 'package.json', 'railway.json',
  ]);
});

test('every fixed release variable passes the runtime-aligned shape contract', () => {
  const environment = validVariableEnvironment();
  for (const key of DR133_RELEASE_VARIABLE_KEYS) {
    const bytes = Buffer.from(environment[key], 'utf8');
    try {
      const inspected = inspectDr133ReleaseVariableValue(key, bytes);
      assert.equal(inspected.key, key);
      assert.match(inspected.valueSha256, /^[a-f0-9]{64}$/u);
      assert.equal(inspected.byteLength, bytes.length);
    } finally {
      bytes.fill(0);
    }
  }
  assert.throws(
    () => inspectDr133ReleaseVariableValue('OPENAI_API_KEY', Buffer.from('forbidden')),
    (error) => error instanceof Dr133ProductionReleaseError
      && error.code === 'VARIABLE_KEY_NOT_ALLOWED',
  );
  assert.throws(
    () => inspectDr133ReleaseVariableValue(
      'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_ID',
      Buffer.from('staging'),
    ),
    (error) => error instanceof Dr133ProductionReleaseError
      && error.code === 'VARIABLE_VALUE_SHAPE_INVALID',
  );
  assert.equal(
    validVariableValue('MMHQ_LOR_RELEASE_COMMIT'),
    PATH_B_FIXTURE_RELEASE_COMMIT,
  );
  for (const [key, value] of [
    ['MMHQ_LOR_RELEASE_COMMIT', PATH_B_FIXTURE_RELEASE_COMMIT.toUpperCase()],
    ['MMHQ_LOR_RELEASE_COMMIT', PATH_B_FIXTURE_RELEASE_COMMIT.slice(0, -1)],
    ['MMHQ_LOR_OPENAI_PROJECT_ID', 'proj_lorproduction'],
  ]) {
    assert.throws(
      () => inspectDr133ReleaseVariableValue(key, Buffer.from(value, 'utf8')),
      (error) => error instanceof Dr133ProductionReleaseError
        && error.code === 'VARIABLE_VALUE_SHAPE_INVALID',
    );
  }
});

test('expectation manifest is exact, complete, canonical, ordered, and hash-only', () => {
  const created = variableExpectations();
  assert.equal(created.manifest.schemaVersion, DR133_RELEASE_VARIABLE_EXPECTATION_SCHEMA);
  assert.equal(created.manifest.variables.length, 55);
  assert.equal(JSON.stringify(created.manifest).includes('sk-proj-'), false);
  assert.deepEqual(parseDr133ReleaseVariableExpectationManifest(created.encoded), created);

  const missing = created.manifest.variables.slice(1);
  assert.throws(
    () => createDr133ReleaseVariableExpectationManifest(missing),
    (error) => error.code === 'VARIABLE_EXPECTATIONS_INCOMPLETE',
  );
  const reordered = [...created.manifest.variables];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () => createDr133ReleaseVariableExpectationManifest(reordered),
    (error) => error.code === 'VARIABLE_EXPECTATION_ORDER_INVALID',
  );
});

test('runtime URL lifecycle handoff uses the exact domain-separated expectation hash', () => {
  const key = 'LOR_DR133_RUNTIME_DATABASE_URL';
  const value = validVariableValue(key);
  const bytes = Buffer.from(value, 'utf8');
  const alternateKey = 'MMHQ_LOR_OPENAI_API_KEY';
  try {
    const valueSha256 = dr133ReleaseVariableValueSha256(key, bytes);
    const created = variableExpectations();
    const manifestEntry = created.manifest.variables.find((entry) => entry.key === key);
    assert.equal(manifestEntry.sha256, valueSha256);
    assert.equal(inspectDr133ReleaseVariableValue(key, bytes).valueSha256, valueSha256);
    assert.notEqual(dr133ReleaseVariableValueSha256(alternateKey, bytes), valueSha256);
    assert.equal(JSON.stringify({ key, valueSha256 }).includes(value), false);
    assert.equal(JSON.stringify(created.manifest).includes(value), false);
  } finally {
    bytes.fill(0);
  }
});

test('service-side variable verification emits only aggregate shape/hash evidence', () => {
  const environment = validVariableEnvironment();
  const expected = variableExpectations(environment);
  const receipt = verifyDr133ReleaseVariablesFromEnvironment({
    encodedExpectations: expected.encoded,
    environment: { ...environment, UNRELATED_SECRET: 'must-never-be-read' },
  });
  assert.deepEqual(receipt, {
    contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
    result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
    manifestSha256: expected.manifestSha256,
    variableCount: 55,
  });
  assert.equal(JSON.stringify(receipt).includes(environment.MMHQ_LOR_OPENAI_API_KEY), false);
  environment.MMHQ_LOR_STUDIO_ENABLED = 'true';
  assert.throws(
    () => verifyDr133ReleaseVariablesFromEnvironment({
      encodedExpectations: expected.encoded,
      environment,
    }),
    (error) => error.code === 'VARIABLE_PROBE_HASH_MISMATCH',
  );
});

test('bind-variable uses one exact --stdin --skip-deploys command and zeroes secret bytes', async () => {
  const key = 'MMHQ_LOR_OPENAI_API_KEY';
  const secret = Buffer.from(validVariableValue(key), 'utf8');
  const expectedHash = inspectDr133ReleaseVariableValue(key, secret).valueSha256;
  let observed;
  const receipt = await bindDr133ReleaseVariable({
    key,
    value: secret,
    expectedSha256: expectedHash,
    environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
    async commandRunner(descriptor) {
      observed = {
        args: descriptor.args,
        envKeys: Object.keys(descriptor.env).sort(),
        stdin: Buffer.from(descriptor.stdin),
      };
      return outcome({ keys: [key], set: true });
    },
  });
  assert.deepEqual(observed.args, [
    'variable', 'set', key, '--stdin', '--skip-deploys', '--json',
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.applicationServiceId,
  ]);
  assert.equal(observed.args.join(' ').includes(validVariableValue(key)), false);
  assert.equal(JSON.stringify(observed.envKeys).includes(key), false);
  assert.equal(observed.stdin.toString('utf8'), validVariableValue(key));
  observed.stdin.fill(0);
  assert.ok(secret.every((byte) => byte === 0));
  assert.deepEqual(receipt, {
    contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
    operation: 'bind-variable',
    result: 'VARIABLE_STAGED_NO_DEPLOY_VERIFIED',
    key,
    valueSha256: expectedHash,
    bindingState: 'PROVIDER_CONFIRMED',
  });
});

test('inspect-variable produces the pre-mutation hash receipt without retaining or printing value bytes', () => {
  const key = 'MMHQ_LOR_OPENAI_API_KEY';
  const valueText = validVariableValue(key);
  const value = Buffer.from(valueText, 'utf8');
  const receipt = inspectDr133ReleaseVariable({ key, value });
  assert.equal(receipt.operation, 'inspect-variable');
  assert.equal(receipt.result, 'VARIABLE_NAME_SHAPE_HASH_VERIFIED');
  assert.equal(receipt.key, key);
  assert.match(receipt.valueSha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(receipt).includes(valueText), false);
  assert.ok(value.every((byte) => byte === 0));
});

test('binding refuses a hash mismatch before calling the provider', async () => {
  let called = false;
  const value = Buffer.from(validVariableValue('MMHQ_LOR_POSTMARK_SERVER_TOKEN'), 'utf8');
  await assert.rejects(
    bindDr133ReleaseVariable({
      key: 'MMHQ_LOR_POSTMARK_SERVER_TOKEN',
      value,
      expectedSha256: '0'.repeat(64),
      environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
      async commandRunner() { called = true; return outcome(); },
    }),
    (error) => error.code === 'VARIABLE_VALUE_HASH_MISMATCH'
      && error.mutationState === 'NOT_ATTEMPTED',
  );
  assert.equal(called, false);
  assert.ok(value.every((byte) => byte === 0));
});

test('binding treats timeout, overflow, stderr, and output-schema drift as unknown mutation outcomes', async () => {
  const key = 'MMHQ_LOR_POSTMARK_SERVER_TOKEN';
  for (const [name, response] of [
    ['timeout', () => outcome(Buffer.from('private-timeout-output'), { timedOut: true })],
    ['overflow', () => outcome(Buffer.from('private-overflow-output'), { overflow: true })],
    ['stderr', () => outcome(Buffer.alloc(0), { stderrBytes: 1 })],
    ['empty receipt', () => outcome(Buffer.alloc(0))],
    ['malformed receipt', () => outcome(Buffer.from('{', 'utf8'))],
    ['schema', () => outcome({ keys: [key], set: true, value: 'private-provider-output' })],
  ]) {
    const value = Buffer.from(validVariableValue(key), 'utf8');
    const expectedSha256 = inspectDr133ReleaseVariableValue(key, value).valueSha256;
    let providerOutput;
    await assert.rejects(
      bindDr133ReleaseVariable({
        key,
        value,
        expectedSha256,
        environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
        async commandRunner() {
          const result = response();
          providerOutput = result.stdout;
          return result;
        },
      }),
      (error) => error instanceof Dr133ProductionReleaseError
        && error.mutationState === 'OUTCOME_UNKNOWN',
      name,
    );
    assert.ok(value.every((byte) => byte === 0), name);
    assert.ok(providerOutput.every((byte) => byte === 0), name);
  }
});

test('remote verification invokes only the fixed deployed probe and validates its schema', async () => {
  const expected = variableExpectations();
  let descriptor;
  const receipt = await verifyDr133ReleaseRemoteBindings({
    encodedExpectations: expected.encoded,
    environment: {
      HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
    },
    async commandRunner(value) {
      descriptor = value;
      return outcome({
        contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
        result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
        manifestSha256: expected.manifestSha256,
        variableCount: 55,
      });
    },
  });
  assert.deepEqual(descriptor.args.slice(0, 7), [
    'ssh', '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.applicationServiceId,
  ]);
  assert.equal(descriptor.args[7], '/usr/local/bin/node');
  assert.equal(descriptor.args[8],
    'missionmed-hq/scripts/lor-studio/run-dr133-railway-production-release-variable-probe.mjs');
  assert.equal(descriptor.args[9], expected.encoded);
  assert.equal(descriptor.stdin, null);
  assert.equal(descriptor.env.SSH_AUTH_SOCK, '/tmp/agent.sock');
  assert.equal(receipt.result, 'REMOTE_VARIABLE_KEYS_SHAPES_HASHES_VERIFIED');
});

test('deployment list parser rejects extra or malformed provider fields', () => {
  const record = deployment(PREIMAGE_ID, CREATED_PREIMAGE);
  const bytes = deploymentListOutcome([record]).stdout;
  assert.deepEqual(parseDr133ReleaseDeploymentList(bytes), [record]);
  bytes.fill(0);
  const malformed = deploymentListOutcome([{ ...record, secretBearingMeta: 'forbidden' }]).stdout;
  assert.throws(
    () => parseDr133ReleaseDeploymentList(malformed),
    (error) => error.code === 'DEPLOYMENT_LIST_RECEIPT_INVALID',
  );
  malformed.fill(0);
});

test('capture-preimage returns an exact target-bound deployment reference', async () => {
  const record = deployment(PREIMAGE_ID, CREATED_PREIMAGE);
  let descriptor;
  const receipt = await captureDr133ReleaseDeploymentPreimage({
    environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
    async commandRunner(value) {
      descriptor = value;
      return deploymentListOutcome([record]);
    },
  });
  assert.equal(descriptor.binary, 'railway');
  assert.equal(descriptor.args[0], 'api');
  assert.match(descriptor.args[1], /query LorReleaseDeployments/u);
  assert.equal(
    descriptor.args.every((argument) => !/[\u0000\r\n]/u.test(argument)),
    true,
  );
  assert.equal(receipt.deploymentRef, dr133ReleaseDeploymentRef(record));
  assert.equal(receipt.result, 'EXACT_DEPLOYMENT_PREIMAGE_CAPTURED');
});

test('custody archive uses fixed Git/Tar operations and never forwards Railway credentials', async () => {
  const commit = 'a'.repeat(40);
  const descriptors = [];
  const archive = await createDr133ImmutableReleaseArchive({
    sourceCommit: commit,
    environment: {
      HOME: '/tmp/home', TMPDIR: '/tmp',
      RAILWAY_API_TOKEN: 'r'.repeat(32),
      DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
    },
    async commandRunner(descriptor) {
      descriptors.push(descriptor);
      assert.equal(Object.hasOwn(descriptor.env, 'RAILWAY_API_TOKEN'), false);
      assert.equal(Object.hasOwn(descriptor.env, 'SSH_AUTH_SOCK'), false);
      if (descriptor.args.includes('rev-parse')) return outcome(Buffer.from(`${commit}\n`));
      if (descriptor.args.includes('archive')) {
        const outputArg = descriptor.args.find((value) => value.startsWith('--output='));
        await writeFile(outputArg.slice('--output='.length), Buffer.from('fixed archive bytes'));
        return outcome();
      }
      if (descriptor.binary === 'tar') {
        const stage = descriptor.args.at(-1);
        await mkdir(`${stage}/missionmed-hq`, { recursive: true });
        for (const file of ['.railwayignore', 'package-lock.json', 'package.json', 'railway.json']) {
          await writeFile(`${stage}/${file}`, `${file}\n`);
        }
        await writeFile(`${stage}/missionmed-hq/package.json`, '{}\n');
        return outcome();
      }
      return assert.fail('unexpected archive command');
    },
  });
  try {
    assert.deepEqual(descriptors.map(({ binary }) => binary), ['git', 'git', 'tar']);
    assert.deepEqual(descriptors[1].args.slice(-7), [
      commit, '--', '.railwayignore', 'missionmed-hq', 'package-lock.json', 'package.json',
      'railway.json',
    ]);
    assert.match(archive.archiveSha256, /^[a-f0-9]{64}$/u);
    assert.match(archive.treeSha256, /^[a-f0-9]{64}$/u);
    assert.equal(archive.fileCount, 5);
    assert.equal(await archive.verify(), true);
  } finally {
    await archive.cleanup();
  }
});

test('immutable dark deploy requires dark flag hashes and uploads only a fixed custody stage', async () => {
  const expected = variableExpectations();
  const before = deployment(PREIMAGE_ID, CREATED_PREIMAGE);
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const unrelated = deployment(UNRELATED_ID, '2026-08-26T21:01:00.000Z');
  const calls = [];
  let listCalls = 0;
  let verifies = 0;
  let cleanups = 0;
  const receipt = await deployDr133ImmutableDarkCandidate({
    sourceCommit: PATH_B_FIXTURE_RELEASE_COMMIT,
    encodedExpectations: expected.encoded,
    environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
    clock: () => 0,
    async sleep() {},
    async commandRunner(descriptor) {
      calls.push(descriptor);
      if (descriptor.args[0] === 'api') {
        listCalls += 1;
        return deploymentListOutcome(
          listCalls === 1 ? [before] : [unrelated, candidate, before],
        );
      }
      assert.equal(descriptor.args[0], 'up');
      return outcome({
        deploymentId: CANDIDATE_ID,
        logsUrl: deploymentLogsUrl(CANDIDATE_ID),
      });
    },
    async createArchive(options) {
      assert.equal(options.sourceCommit, PATH_B_FIXTURE_RELEASE_COMMIT);
      return {
        archiveSha256: 'b'.repeat(64),
        treeSha256: 'c'.repeat(64),
        fileCount: 321,
        stageDirectory: '/tmp/f2-lor-dr133-release-test/stage',
        async verify() { verifies += 1; return true; },
        async cleanup() { cleanups += 1; return true; },
      };
    },
  });
  const upload = calls.find(({ args }) => args[0] === 'up');
  assert.deepEqual(upload.args, [
    'up', '/tmp/f2-lor-dr133-release-test/stage',
    '--path-as-root', '--detach', '--json', '--yes',
    '--message', `F2-LOR-1012 DR-133 ${PATH_B_FIXTURE_RELEASE_COMMIT}`,
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.applicationServiceId,
  ]);
  assert.equal(verifies, 2);
  assert.equal(cleanups, 1);
  assert.equal(receipt.result, 'IMMUTABLE_DARK_CANDIDATE_DEPLOYED');
  assert.equal(receipt.preimageDeploymentId, PREIMAGE_ID);
  assert.equal(receipt.candidateDeploymentId, CANDIDATE_ID);
  assert.equal(receipt.archiveSha256, 'b'.repeat(64));
  assert.equal(JSON.stringify(receipt).includes('railway.com'), false);
});

test('immutable dark deploy preserves the exact legacy one-key upload receipt', async () => {
  const before = deployment(PREIMAGE_ID, CREATED_PREIMAGE);
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  let listCalls = 0;
  const receipt = await deployDr133ImmutableDarkCandidate({
    sourceCommit: PATH_B_FIXTURE_RELEASE_COMMIT,
    encodedExpectations: variableExpectations().encoded,
    environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
    clock: () => 0,
    async sleep() {},
    async commandRunner(descriptor) {
      if (descriptor.args[0] === 'api') {
        listCalls += 1;
        return deploymentListOutcome(listCalls === 1 ? [before] : [candidate, before]);
      }
      assert.equal(descriptor.args[0], 'up');
      return outcome({ deploymentId: CANDIDATE_ID });
    },
    async createArchive() {
      return {
        archiveSha256: 'b'.repeat(64),
        treeSha256: 'c'.repeat(64),
        fileCount: 321,
        stageDirectory: '/tmp/f2-lor-dr133-release-test/stage',
        async verify() { return true; },
        async cleanup() { return true; },
      };
    },
  });
  assert.equal(receipt.candidateDeploymentId, CANDIDATE_ID);
  assert.equal(listCalls, 2);
});

test('immutable dark deploy accepts the exact current receipt with query order reversed', async () => {
  const before = deployment(PREIMAGE_ID, CREATED_PREIMAGE);
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  let listCalls = 0;
  const receipt = await deployDr133ImmutableDarkCandidate({
    sourceCommit: PATH_B_FIXTURE_RELEASE_COMMIT,
    encodedExpectations: variableExpectations().encoded,
    environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
    clock: () => 0,
    async sleep() {},
    async commandRunner(descriptor) {
      if (descriptor.args[0] === 'api') {
        listCalls += 1;
        return deploymentListOutcome(listCalls === 1 ? [before] : [candidate, before]);
      }
      assert.equal(descriptor.args[0], 'up');
      return outcome({
        deploymentId: CANDIDATE_ID,
        logsUrl: deploymentLogsUrl(CANDIDATE_ID, { reversed: true }),
      });
    },
    async createArchive() {
      return {
        archiveSha256: 'b'.repeat(64),
        treeSha256: 'c'.repeat(64),
        fileCount: 321,
        stageDirectory: '/tmp/f2-lor-dr133-release-test/stage',
        async verify() { return true; },
        async cleanup() { return true; },
      };
    },
  });
  assert.equal(receipt.candidateDeploymentId, CANDIDATE_ID);
  assert.equal(JSON.stringify(receipt).includes('logsUrl'), false);
});

test('immutable dark deploy rejects unbound upload receipts with unknown mutation state', async () => {
  const validLogsUrl = deploymentLogsUrl(CANDIDATE_ID);
  const expectedPath = `/project/${DR133_TARGET.projectId}`
    + `/service/${DR133_TARGET.applicationServiceId}`;
  const invalidReceipts = [
    Buffer.alloc(0),
    Buffer.from('{', 'utf8'),
    {},
    { deploymentId: 'not-a-deployment-id' },
    { deploymentId: CANDIDATE_ID, secondDeploymentId: UNRELATED_ID },
    { deploymentId: CANDIDATE_ID, logsUrl: null },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl, extra: true },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace('https:', 'http:') },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace('railway.com', 'railway.example') },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace('railway.com', 'railway.com.evil.example') },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace('https://', 'https://operator@') },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace('railway.com', 'railway.com:443') },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace(DR133_TARGET.projectId, UNRELATED_ID) },
    {
      deploymentId: CANDIDATE_ID,
      logsUrl: validLogsUrl.replace(DR133_TARGET.applicationServiceId, UNRELATED_ID),
    },
    {
      deploymentId: CANDIDATE_ID,
      logsUrl: validLogsUrl.replace(DR133_TARGET.environmentId, UNRELATED_ID),
    },
    { deploymentId: CANDIDATE_ID, logsUrl: validLogsUrl.replace(CANDIDATE_ID, UNRELATED_ID) },
    { deploymentId: CANDIDATE_ID, logsUrl: `${validLogsUrl}&view=build` },
    {
      deploymentId: CANDIDATE_ID,
      logsUrl: `${validLogsUrl}&environmentId=${DR133_TARGET.environmentId}`,
    },
    { deploymentId: CANDIDATE_ID, logsUrl: `${validLogsUrl}&id=${CANDIDATE_ID}` },
    { deploymentId: CANDIDATE_ID, logsUrl: `${validLogsUrl}#build` },
    { deploymentId: CANDIDATE_ID, logsUrl: `${validLogsUrl}\n` },
    {
      deploymentId: CANDIDATE_ID,
      logsUrl: `https://railway.com${expectedPath}?%65nvironmentId=`
        + `${DR133_TARGET.environmentId}&id=${CANDIDATE_ID}`,
    },
  ];
  for (const invalidReceipt of invalidReceipts) {
    let listCalls = 0;
    await assert.rejects(
      deployDr133ImmutableDarkCandidate({
        sourceCommit: PATH_B_FIXTURE_RELEASE_COMMIT,
        encodedExpectations: variableExpectations().encoded,
        environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
        clock: () => 0,
        async sleep() {},
        async commandRunner(descriptor) {
          if (descriptor.args[0] === 'api') {
            listCalls += 1;
            return deploymentListOutcome([
              deployment(PREIMAGE_ID, CREATED_PREIMAGE),
            ]);
          }
          assert.equal(descriptor.args[0], 'up');
          return outcome(invalidReceipt);
        },
        async createArchive() {
          return {
            archiveSha256: 'b'.repeat(64),
            treeSha256: 'c'.repeat(64),
            fileCount: 321,
            stageDirectory: '/tmp/f2-lor-dr133-release-test/stage',
            async verify() { return true; },
            async cleanup() { return true; },
          };
        },
      }),
      (error) => error.code === 'DEPLOYMENT_UPLOAD_RECEIPT_INVALID'
        && error.mutationState === 'OUTCOME_UNKNOWN',
    );
    assert.equal(listCalls, 1);
  }
});

test('deploy-dark rejects a non-dark expectation before provider commands', async () => {
  const environment = validVariableEnvironment();
  environment.MMHQ_LOR_STUDIO_ENABLED = 'true';
  const expected = variableExpectations(environment);
  let called = false;
  await assert.rejects(
    deployDr133ImmutableDarkCandidate({
      sourceCommit: PATH_B_FIXTURE_RELEASE_COMMIT,
      encodedExpectations: expected.encoded,
      environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
      async commandRunner() { called = true; return outcome(); },
    }),
    (error) => error.code === 'DARK_FLAG_EXPECTATION_INVALID',
  );
  assert.equal(called, false);
});

test('deploy-dark rejects a sourceCommit versus release-manifest mismatch before provider or archive work', async () => {
  let providerCalled = false;
  let archiveCalled = false;
  await assert.rejects(
    deployDr133ImmutableDarkCandidate({
      sourceCommit: 'b'.repeat(40),
      encodedExpectations: variableExpectations().encoded,
      environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
      async commandRunner() {
        providerCalled = true;
        return outcome();
      },
      async createArchive() {
        archiveCalled = true;
        return assert.fail('release mismatch reached archive creation');
      },
    }),
    (error) => error.code === 'RELEASE_COMMIT_EXPECTATION_INVALID'
      && error.mutationState === 'NOT_ATTEMPTED',
  );
  assert.equal(providerCalled, false);
  assert.equal(archiveCalled, false);
});

test('dark health verifies public containment and metadata-only LOR readiness', async () => {
  const recorder = darkFetchRecorder();
  const result = await verifyDr133DarkHealthAndContainment({
    fetchImplementation: recorder.fetch,
  });
  assert.deepEqual(result, {
    health: 'VERIFIED',
    containment: 'FEATURE_DISABLED_VERIFIED',
    operatorReadiness: 'VERIFIED_METADATA_ONLY',
    launchReady: true,
  });
  assert.deepEqual(recorder.calls.map(({ url }) => url), [
    'https://missionmed-hq-production.up.railway.app/health',
    'https://missionmed-hq-production.up.railway.app/health/lor-studio',
    ...DR133_PRODUCTION_RELEASE_CONTRACT.darkContainmentSurfaces.map(
      ({ path: pathname }) => `https://missionmed-hq-production.up.railway.app${pathname}`,
    ),
  ]);
  assert.equal(recorder.calls[0].options.credentials, 'omit');
  assert.equal(recorder.calls[0].options.redirect, 'error');
  assert.equal(recorder.calls[1].options.method, 'GET');
  assert.deepEqual(
    recorder.calls.slice(2).map(({ options }) => options.method),
    DR133_PRODUCTION_RELEASE_CONTRACT.darkContainmentSurfaces.map(({ method }) => method),
  );
  assert.ok(recorder.calls.slice(2).every(
    ({ options }) => Object.hasOwn(options.headers, 'Authorization') === false,
  ));
});

test('dark health rejects exposure or redirect on every auth and canonical HTML surface', async () => {
  const surfaces = DR133_PRODUCTION_RELEASE_CONTRACT.darkContainmentSurfaces;
  for (const exposed of surfaces) {
    const calls = [];
    await assert.rejects(
      verifyDr133DarkHealthAndContainment({
        async fetchImplementation(url, options) {
          calls.push({ url, options });
          if (url.endsWith('/health')) return httpResponse(url, 200, { status: 'ok' });
          if (url.endsWith('/health/lor-studio')) {
            return httpResponse(url, 200, { status: 'ready' });
          }
          if (url === `https://missionmed-hq-production.up.railway.app${exposed.path}`) {
            return httpResponse(url, 302, { error: 'unexpected_exposure' });
          }
          return httpResponse(url, 404, { error: 'lor_feature_disabled' });
        },
      }),
      (error) => error.code === 'HTTP_STATUS_INVALID',
    );
    assert.ok(calls.some(
      ({ url }) => url === `https://missionmed-hq-production.up.railway.app${exposed.path}`,
    ));
  }
});

test('dark health fails closed when metadata-only LOR readiness is unavailable', async () => {
  const calls = [];
  await assert.rejects(
    verifyDr133DarkHealthAndContainment({
      async fetchImplementation(url, options) {
        calls.push({ url, options });
        if (url.endsWith('/health')) return httpResponse(url, 200, { status: 'ok' });
        return httpResponse(url, 503, { status: 'unavailable' });
      },
    }),
    (error) => error.code === 'HTTP_STATUS_INVALID',
  );
  assert.deepEqual(calls.map(({ url }) => url), [
    'https://missionmed-hq-production.up.railway.app/health',
    'https://missionmed-hq-production.up.railway.app/health/lor-studio',
  ]);
});

test('canary health positively proves active runtime and anonymous denial', async () => {
  const recorder = canaryFetchRecorder();
  const result = await verifyDr133CanaryHealthAndContainment({
    fetchImplementation: recorder.fetch,
  });
  assert.deepEqual(result, {
    health: 'VERIFIED',
    containment: 'FEATURE_ACTIVE_ANONYMOUS_DENIAL_VERIFIED',
    operatorReadiness: 'VERIFIED_METADATA_ONLY',
    launchReady: true,
  });
  assert.deepEqual(recorder.calls.map(({ url }) => url), [
    'https://missionmed-hq-production.up.railway.app/health',
    'https://missionmed-hq-production.up.railway.app/health/lor-studio',
    'https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/candidate/start',
  ]);
  assert.equal(recorder.calls[2].options.method, 'POST');
  assert.equal(recorder.calls[2].options.credentials, 'omit');
  assert.equal(Object.hasOwn(recorder.calls[2].options.headers, 'Authorization'), false);
});

test('activate-canary binds only known flags, redeploys the exact candidate, and verifies all bindings', async () => {
  const activeExpectations = variableExpectations(canaryVariableEnvironment());
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const activated = deployment(REDEPLOY_ID, '2026-08-26T23:00:00.000Z');
  const recorder = canaryFetchRecorder({ initiallyDark: true });
  const descriptors = [];
  let listCalls = 0;
  const receipt = await activateDr133NamedCanaryCandidate({
    candidateDeploymentId: CANDIDATE_ID,
    candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
    encodedExpectations: activeExpectations.encoded,
    environment: {
      HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
    },
    clock: () => 0,
    sleep: async () => undefined,
    fetchImplementation: recorder.fetch,
    async commandRunner(descriptor) {
      descriptors.push(descriptor);
      if (descriptor.args[0] === 'variable') {
        return outcome({ keys: [descriptor.args[2]], set: true });
      }
      if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
        listCalls += 1;
        return deploymentListOutcome(listCalls === 1 ? [candidate] : [activated, candidate]);
      }
      if (descriptor.args[1]?.includes('mutation LorReleaseRedeploy')) {
        assert.deepEqual(JSON.parse(descriptor.args[3]), { id: CANDIDATE_ID });
        return outcome({ data: { deploymentRedeploy: { id: REDEPLOY_ID } } });
      }
      if (descriptor.args[0] === 'ssh') {
        assert.equal(descriptor.args[9], activeExpectations.encoded);
        return outcome({
          contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
          result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
          manifestSha256: activeExpectations.manifestSha256,
          variableCount: 55,
        });
      }
      return assert.fail('unexpected canary command');
    },
  });
  assert.equal(receipt.result, 'NAMED_CANARY_ACTIVATED_VERIFIED');
  assert.equal(receipt.candidateDeploymentId, CANDIDATE_ID);
  assert.equal(receipt.activatedDeploymentId, REDEPLOY_ID);
  assert.equal(receipt.activatedDeploymentRef, dr133ReleaseDeploymentRef(activated));
  assert.equal(receipt.manifestSha256, activeExpectations.manifestSha256);
  assert.equal(receipt.canaryRequired, 'VERIFIED_BY_REMOTE_BINDING');
  assert.equal(receipt.containment, 'FEATURE_ACTIVE_ANONYMOUS_DENIAL_VERIFIED');
  assert.equal(descriptors.filter(({ args }) => args[0] === 'variable').length, 3);
  assert.equal(descriptors.some(({ args }) => args[0] === 'up'), false);
  assert.equal(descriptors.some(({ args }) => args[0] === 'variable' && args[1] === 'list'), false);
  assert.equal(recorder.calls.length, 12);
  assert.equal(JSON.stringify(receipt).includes(validVariableValue('MMHQ_LOR_OPENAI_API_KEY')), false);
});

test('activate-canary rejects non-active expectations before any provider call', async () => {
  let called = false;
  await assert.rejects(
    activateDr133NamedCanaryCandidate({
      candidateDeploymentId: CANDIDATE_ID,
      candidateDeploymentRef: 'a'.repeat(64),
      encodedExpectations: variableExpectations().encoded,
      environment: {},
      async commandRunner() { called = true; return outcome(); },
    }),
    (error) => error.code === 'CANARY_FLAG_EXPECTATION_INVALID'
      && error.mutationState === 'NOT_ATTEMPTED',
  );
  assert.equal(called, false);
});

test('failed canary verification restores and remotely proves the dark candidate', async () => {
  const activeExpectations = variableExpectations(canaryVariableEnvironment());
  const darkExpectations = variableExpectations();
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const activated = deployment(REDEPLOY_ID, '2026-08-26T23:00:00.000Z');
  const restored = deployment(ROLLBACK_ID, '2026-08-26T23:01:00.000Z');
  const recorder = darkFetchRecorder();
  let listCalls = 0;
  let mutationCalls = 0;
  let probeCalls = 0;
  await assert.rejects(
    activateDr133NamedCanaryCandidate({
      candidateDeploymentId: CANDIDATE_ID,
      candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
      encodedExpectations: activeExpectations.encoded,
      environment: {
        HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
      },
      clock: () => 0,
      sleep: async () => undefined,
      fetchImplementation: recorder.fetch,
      async commandRunner(descriptor) {
        if (descriptor.args[0] === 'variable') {
          return outcome({ keys: [descriptor.args[2]], set: true });
        }
        if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
          listCalls += 1;
          if (listCalls === 1) return deploymentListOutcome([candidate]);
          if (listCalls === 2) return deploymentListOutcome([activated, candidate]);
          return deploymentListOutcome([restored, activated, candidate]);
        }
        if (descriptor.args[1]?.includes('mutation LorReleaseRedeploy')) {
          mutationCalls += 1;
          return outcome({
            data: {
              deploymentRedeploy: {
                id: mutationCalls === 1 ? REDEPLOY_ID : ROLLBACK_ID,
              },
            },
          });
        }
        if (descriptor.args[0] === 'ssh') {
          probeCalls += 1;
          if (probeCalls === 1) return outcome({ invalid: true });
          assert.equal(descriptor.args[9], darkExpectations.encoded);
          return outcome({
            contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
            result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
            manifestSha256: darkExpectations.manifestSha256,
            variableCount: 55,
          });
        }
        return assert.fail('unexpected canary compensation command');
      },
    }),
    (error) => error.code === 'CANARY_ACTIVATION_FAILED_DARK_RESTORED'
      && error.mutationState === 'PROVIDER_CONFIRMED',
  );
  assert.equal(mutationCalls, 2);
  assert.equal(probeCalls, 2);
  assert.equal(recorder.calls.length, 18);
});

test('activate-rollout promotes only the current remotely verified canary deployment', async () => {
  const canaryExpectations = variableExpectations(canaryVariableEnvironment());
  const rolloutExpectations = variableExpectations(rolloutVariableEnvironment());
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const activated = deployment(REDEPLOY_ID, '2026-08-26T23:00:00.000Z');
  const recorder = canaryFetchRecorder();
  const descriptors = [];
  let listCalls = 0;
  let probeCalls = 0;
  const receipt = await activateDr133NamedRolloutCandidate({
    candidateDeploymentId: CANDIDATE_ID,
    candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
    encodedExpectations: canaryExpectations.encoded,
    environment: {
      HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
    },
    clock: () => 0,
    sleep: async () => undefined,
    fetchImplementation: recorder.fetch,
    async commandRunner(descriptor) {
      descriptors.push(descriptor);
      if (descriptor.args[0] === 'variable') {
        return outcome({ keys: [descriptor.args[2]], set: true });
      }
      if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
        listCalls += 1;
        return deploymentListOutcome(listCalls <= 2 ? [candidate] : [activated, candidate]);
      }
      if (descriptor.args[1]?.includes('mutation LorReleaseRedeploy')) {
        assert.deepEqual(JSON.parse(descriptor.args[3]), { id: CANDIDATE_ID });
        return outcome({ data: { deploymentRedeploy: { id: REDEPLOY_ID } } });
      }
      if (descriptor.args[0] === 'ssh') {
        probeCalls += 1;
        const expected = probeCalls === 1 ? canaryExpectations : rolloutExpectations;
        assert.equal(descriptor.args[9], expected.encoded);
        return outcome({
          contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
          result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
          manifestSha256: expected.manifestSha256,
          variableCount: 55,
        });
      }
      return assert.fail('unexpected rollout command');
    },
  });
  assert.equal(receipt.result, 'NAMED_ROLLOUT_ACTIVATED_VERIFIED');
  assert.equal(receipt.operation, 'activate-rollout');
  assert.equal(receipt.candidateDeploymentId, CANDIDATE_ID);
  assert.equal(receipt.activatedDeploymentId, REDEPLOY_ID);
  assert.equal(receipt.activatedDeploymentRef, dr133ReleaseDeploymentRef(activated));
  assert.equal(receipt.manifestSha256, rolloutExpectations.manifestSha256);
  assert.equal(receipt.canaryRequired, 'DISABLED_BY_REMOTE_BINDING');
  assert.equal(receipt.containment, 'FEATURE_ACTIVE_ANONYMOUS_DENIAL_VERIFIED');
  assert.equal(descriptors.filter(({ args }) => args[0] === 'variable').length, 3);
  assert.equal(descriptors.some(({ args }) => args[0] === 'up'), false);
  assert.equal(probeCalls, 2);
  assert.equal(listCalls, 3);
  assert.ok(descriptors.findIndex(({ args }) => args[0] === 'ssh')
    < descriptors.findIndex(({ args }) => args[0] === 'variable'));
  assert.equal(recorder.calls.length, 6);
});

test('activate-rollout rejects rollout or dark manifests before any provider call', async () => {
  for (const expectations of [
    variableExpectations(rolloutVariableEnvironment()),
    variableExpectations(),
  ]) {
    let called = false;
    await assert.rejects(
      activateDr133NamedRolloutCandidate({
        candidateDeploymentId: CANDIDATE_ID,
        candidateDeploymentRef: 'a'.repeat(64),
        encodedExpectations: expectations.encoded,
        environment: {},
        async commandRunner() { called = true; return outcome(); },
      }),
      (error) => error.code === 'CANARY_FLAG_EXPECTATION_INVALID'
        && error.mutationState === 'NOT_ATTEMPTED',
    );
    assert.equal(called, false);
  }
});

test('activate-rollout rejects a historical successful deployment before any binding or mutation', async () => {
  const canaryExpectations = variableExpectations(canaryVariableEnvironment());
  const historical = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const current = deployment(UNRELATED_ID, '2026-08-26T22:00:00.000Z');
  const descriptors = [];
  let fetched = false;
  await assert.rejects(
    activateDr133NamedRolloutCandidate({
      candidateDeploymentId: CANDIDATE_ID,
      candidateDeploymentRef: dr133ReleaseDeploymentRef(historical),
      encodedExpectations: canaryExpectations.encoded,
      environment: {
        HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
      },
      async fetchImplementation() { fetched = true; return httpResponse('', 500, {}); },
      async commandRunner(descriptor) {
        descriptors.push(descriptor);
        if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
          // Provider order cannot turn an older success into the current preimage.
          return deploymentListOutcome([historical, current]);
        }
        return assert.fail('historical rollout reached a non-read-only command');
      },
    }),
    (error) => error.code === 'ROLLOUT_CANARY_PREIMAGE_UNPROVEN'
      && error.mutationState === 'NOT_ATTEMPTED',
  );
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].args[1]?.includes('query LorReleaseDeployments'), true);
  assert.equal(fetched, false);
});

test('activate-rollout rejects current-deployment drift after the generic canary probe', async () => {
  const canaryExpectations = variableExpectations(canaryVariableEnvironment());
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const replacement = deployment(UNRELATED_ID, '2026-08-26T22:00:00.000Z');
  const recorder = canaryFetchRecorder();
  const descriptors = [];
  let listCalls = 0;
  await assert.rejects(
    activateDr133NamedRolloutCandidate({
      candidateDeploymentId: CANDIDATE_ID,
      candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
      encodedExpectations: canaryExpectations.encoded,
      environment: {
        HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
      },
      fetchImplementation: recorder.fetch,
      async commandRunner(descriptor) {
        descriptors.push(descriptor);
        if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
          listCalls += 1;
          return deploymentListOutcome(
            listCalls === 1 ? [candidate] : [replacement, candidate],
          );
        }
        if (descriptor.args[0] === 'ssh') {
          assert.equal(descriptor.args[9], canaryExpectations.encoded);
          return outcome({
            contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
            result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
            manifestSha256: canaryExpectations.manifestSha256,
            variableCount: 55,
          });
        }
        return assert.fail('drifted rollout reached a mutation command');
      },
    }),
    (error) => error.code === 'ROLLOUT_CANARY_PREIMAGE_UNPROVEN'
      && error.mutationState === 'NOT_ATTEMPTED',
  );
  assert.equal(listCalls, 2);
  assert.equal(recorder.calls.length, 3);
  assert.equal(descriptors.filter(({ args }) => args[0] === 'ssh').length, 1);
  assert.equal(descriptors.some(({ args }) => args[0] === 'variable'), false);
  assert.equal(descriptors.some(({ args }) => args[1]?.includes('mutation')), false);
});

test('failed rollout verification restores and remotely proves the canonical dark state', async () => {
  const canaryExpectations = variableExpectations(canaryVariableEnvironment());
  const rolloutExpectations = variableExpectations(rolloutVariableEnvironment());
  const darkExpectations = variableExpectations();
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const activated = deployment(REDEPLOY_ID, '2026-08-26T23:00:00.000Z');
  const restored = deployment(ROLLBACK_ID, '2026-08-26T23:01:00.000Z');
  const recorder = failingRolloutFetchRecorder();
  let listCalls = 0;
  let mutationCalls = 0;
  let probeCalls = 0;
  await assert.rejects(
    activateDr133NamedRolloutCandidate({
      candidateDeploymentId: CANDIDATE_ID,
      candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
      encodedExpectations: canaryExpectations.encoded,
      environment: {
        HOME: '/tmp/home', TMPDIR: '/tmp', DR133_SSH_AUTH_SOCK: '/tmp/agent.sock',
      },
      clock: () => 0,
      sleep: async () => undefined,
      fetchImplementation: recorder.fetch,
      async commandRunner(descriptor) {
        if (descriptor.args[0] === 'variable') {
          return outcome({ keys: [descriptor.args[2]], set: true });
        }
        if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
          listCalls += 1;
          if (listCalls <= 2) return deploymentListOutcome([candidate]);
          if (listCalls === 3) return deploymentListOutcome([activated, candidate]);
          return deploymentListOutcome([restored, activated, candidate]);
        }
        if (descriptor.args[1]?.includes('mutation LorReleaseRedeploy')) {
          mutationCalls += 1;
          return outcome({
            data: {
              deploymentRedeploy: {
                id: mutationCalls === 1 ? REDEPLOY_ID : ROLLBACK_ID,
              },
            },
          });
        }
        if (descriptor.args[0] === 'ssh') {
          probeCalls += 1;
          const expected = [canaryExpectations, rolloutExpectations, darkExpectations][
            probeCalls - 1
          ];
          assert.ok(expected);
          assert.equal(descriptor.args[9], expected.encoded);
          return outcome({
            contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
            result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
            manifestSha256: expected.manifestSha256,
            variableCount: 55,
          });
        }
        return assert.fail('unexpected rollout compensation command');
      },
    }),
    (error) => error.code === 'ROLLOUT_ACTIVATION_FAILED_DARK_RESTORED'
      && error.mutationState === 'PROVIDER_CONFIRMED',
  );
  assert.equal(mutationCalls, 2);
  assert.equal(probeCalls, 3);
  assert.equal(listCalls, 4);
  assert.equal(recorder.calls.length, 14);
});

test('exact rollback/redeploy proves both deployment identities and uses fixed GraphQL mutations', async () => {
  const preimage = deployment(PREIMAGE_ID, CREATED_PREIMAGE, { canRollback: true });
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  const rollback = deployment(ROLLBACK_ID, '2026-08-26T22:00:00.000Z');
  const redeploy = deployment(REDEPLOY_ID, '2026-08-26T23:00:00.000Z');
  const descriptors = [];
  let listCalls = 0;
  const recorder = darkFetchRecorder();
  const receipt = await runDr133ExactRollbackRedeployDrill({
    preimageDeploymentId: PREIMAGE_ID,
    preimageDeploymentRef: dr133ReleaseDeploymentRef(preimage),
    candidateDeploymentId: CANDIDATE_ID,
    candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
    environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
    clock: () => 0,
    sleep: async () => undefined,
    fetchImplementation: recorder.fetch,
    async commandRunner(descriptor) {
      descriptors.push(descriptor);
      if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
        listCalls += 1;
        if (listCalls === 1) return deploymentListOutcome([candidate, preimage]);
        if (listCalls === 2) return deploymentListOutcome([rollback, candidate, preimage]);
        return deploymentListOutcome([redeploy, rollback, candidate, preimage]);
      }
      if (descriptor.args[1]?.includes('mutation LorReleaseRollback')) {
        return outcome({ data: { deploymentRollback: { id: ROLLBACK_ID } } });
      }
      if (descriptor.args[1]?.includes('mutation LorReleaseRedeploy')) {
        return outcome({ data: { deploymentRedeploy: { id: REDEPLOY_ID } } });
      }
      return assert.fail('unexpected command');
    },
  });
  const mutationDescriptors = descriptors.filter(
    ({ args }) => args[1]?.includes('mutation LorRelease'),
  );
  assert.equal(mutationDescriptors.length, 2);
  assert.deepEqual(JSON.parse(mutationDescriptors[0].args[3]), { id: PREIMAGE_ID });
  assert.deepEqual(JSON.parse(mutationDescriptors[1].args[3]), { id: CANDIDATE_ID });
  assert.equal(receipt.result, 'EXACT_PREIMAGE_ROLLBACK_AND_CANDIDATE_REDEPLOY_VERIFIED');
  assert.equal(receipt.rollbackDeploymentId, ROLLBACK_ID);
  assert.equal(receipt.redeployedDeploymentId, REDEPLOY_ID);
  assert.equal(receipt.operatorReadiness, 'VERIFIED_METADATA_ONLY');
  assert.equal(receipt.launchReady, true);
  assert.equal(recorder.calls.length, 10);
});

test('every malformed deployment mutation receipt is outcome-unknown after provider start', async () => {
  const preimage = deployment(PREIMAGE_ID, CREATED_PREIMAGE, { canRollback: true });
  const candidate = deployment(CANDIDATE_ID, CREATED_CANDIDATE);
  for (const invalidReceipt of [
    Buffer.alloc(0),
    Buffer.from('{', 'utf8'),
    { data: { deploymentRollback: { id: 'not-a-deployment-id' } } },
  ]) {
    await assert.rejects(
      runDr133ExactRollbackRedeployDrill({
        preimageDeploymentId: PREIMAGE_ID,
        preimageDeploymentRef: dr133ReleaseDeploymentRef(preimage),
        candidateDeploymentId: CANDIDATE_ID,
        candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
        environment: { HOME: '/tmp/home', TMPDIR: '/tmp' },
        async commandRunner(descriptor) {
          if (descriptor.args[1]?.includes('query LorReleaseDeployments')) {
            return deploymentListOutcome([candidate, preimage]);
          }
          if (descriptor.args[1]?.includes('mutation LorReleaseRollback')) {
            return outcome(invalidReceipt);
          }
          return assert.fail('unexpected command after invalid mutation receipt');
        },
      }),
      (error) => error.code === 'DEPLOYMENT_MUTATION_RECEIPT_INVALID'
        && error.mutationState === 'OUTCOME_UNKNOWN',
    );
  }
});

test('dispatcher has fixed operations and safe error receipts never serialize private errors', async () => {
  const orchestrate = createDr133ProductionReleaseOrchestrator({
    async commandRunner() { return assert.fail('must not execute'); },
  });
  await assert.rejects(
    orchestrate({ operation: 'run-command', args: ['env'], stdin: null, environment: {} }),
    (error) => error.code === 'OPERATION_INVALID',
  );
  const privateError = new Error('sk-proj-private-value');
  const receipt = dr133ProductionReleaseErrorReceipt(privateError, 'bind-variable');
  assert.deepEqual(receipt, {
    contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
    operation: 'bind-variable',
    result: 'BLOCKED',
    errorCode: 'UNEXPECTED_FAILURE',
    mutationState: 'OUTCOME_UNKNOWN',
  });
  assert.equal(JSON.stringify(receipt).includes('private-value'), false);
});

test('launchers scrub ambient state before dynamic import and emit no injected secret', async () => {
  const launcher = new URL(
    '../../scripts/lor-studio/run-dr133-railway-production-release-operation.mjs',
    import.meta.url,
  );
  const probe = new URL(
    '../../scripts/lor-studio/run-dr133-railway-production-release-variable-probe.mjs',
    import.meta.url,
  );
  const launcherSource = await readFile(launcher, 'utf8');
  const probeSource = await readFile(probe, 'utf8');
  assert.match(launcherSource, /'activate-rollout'/u,
    'the scrubbed launcher must expose the fixed rollout operation');
  assert.ok(launcherSource.indexOf('scrub(process.env)')
    < launcherSource.indexOf("await import('./railway-dr133-production-release-orchestrator.mjs')"));
  assert.ok(probeSource.indexOf('scrub(process.env)')
    < probeSource.indexOf("await import('./railway-dr133-production-release-orchestrator.mjs')"));
  for (const forbidden of ['printenv', '/proc/self/environ', 'env |', 'set |']) {
    assert.equal(launcherSource.includes(forbidden), false);
    assert.equal(probeSource.includes(forbidden), false);
  }

  const injected = 'secret-sentinel-that-must-not-escape';
  const invalid = spawnSync(process.execPath, [fileURLToPath(launcher), 'run-command', 'env'], {
    cwd: process.cwd(),
    env: {
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR ?? '/tmp',
      INJECTED_PRIVATE_VALUE: injected,
    },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stderr, '');
  assert.equal(invalid.stdout.includes(injected), false);
  const parsed = JSON.parse(invalid.stdout);
  assert.equal(parsed.result, 'BLOCKED');
  assert.equal(parsed.operation, 'unknown');
});

test('standalone service probe scrubs unrelated environment values and emits one safe receipt', () => {
  const environment = validVariableEnvironment();
  const expected = variableExpectations(environment);
  const injected = 'unrelated-secret-sentinel';
  const probe = new URL(
    '../../scripts/lor-studio/run-dr133-railway-production-release-variable-probe.mjs',
    import.meta.url,
  );
  const completed = spawnSync(process.execPath, [fileURLToPath(probe), expected.encoded], {
    cwd: process.cwd(),
    env: { ...environment, UNRELATED_SECRET: injected },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(completed.status, 0);
  assert.equal(completed.stderr, '');
  assert.equal(completed.stdout.includes(injected), false);
  assert.equal(completed.stdout.includes(environment.MMHQ_LOR_OPENAI_API_KEY), false);
  assert.deepEqual(JSON.parse(completed.stdout), {
    contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
    result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
    manifestSha256: expected.manifestSha256,
    variableCount: 55,
  });
});
