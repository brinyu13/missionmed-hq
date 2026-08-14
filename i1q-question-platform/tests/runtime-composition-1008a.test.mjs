import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { QuestionPlatform } from '../src/platform.mjs';
import {
  RuntimeConfigurationError,
  createProductionQuestionPlatformServer,
  loadHashPinnedRuntimeComposition,
  startConfiguredRuntime,
} from '../src/runtime.mjs';

function runtimeError(code) {
  return (error) => error instanceof RuntimeConfigurationError && error.code === code;
}

function persistentPlatformStub() {
  return Object.fromEntries([
    'featureFlagEnabled',
    'governance',
    'assignGovernanceSlot',
    'registerReviewer',
    'setFeatureFlag',
    'get',
    'list',
    'create',
    'update',
    'createRevision',
    'editDraftRevision',
    'submitRevisionCandidate',
    'readAssignedReviewContent',
    'createReviewAssignment',
    'acceptReviewAssignment',
    'submitReviewEvent',
    'assembleRelease',
    'recordReleaseValidation',
    'promoteRelease',
    'artifactForPhase',
  ].map((name) => [name, async () => {
    throw new Error(`synthetic_unimplemented:${name}`);
  }]));
}

function composition(overrides = {}) {
  return {
    descriptor: {
      contract: 'i1q.runtime.v1',
      persistence: 'postgresql',
      actor_context: 'transaction_local',
      audit: 'durable',
      synthetic_data_only: true,
      feature_flags_default_off: true,
    },
    platform: persistentPlatformStub(),
    identityResolver: async () => {},
    staticAccessResolver: async () => false,
    logoutResolver: async () => false,
    readinessResolver: async () => ({ datastore: false, migration: false, audit: false, feature_flags_off: true }),
    finalizationResolver: async () => null,
    reviewContentResolver: async () => null,
    ...overrides,
  };
}

test('production composition rejects memory, synthetic, and incomplete runtimes', () => {
  assert.throws(
    () => createProductionQuestionPlatformServer({ ...composition(), platform: new QuestionPlatform() }),
    runtimeError('persistent_runtime_platform_required'),
  );
  assert.throws(
    () => createProductionQuestionPlatformServer({ ...composition(), platform: { syntheticDemo: true } }),
    runtimeError('persistent_runtime_platform_required'),
  );
  assert.throws(
    () => createProductionQuestionPlatformServer({ ...composition(), readinessResolver: null }),
    runtimeError('runtime_resolver_missing:readinessResolver'),
  );
  assert.doesNotThrow(() => createProductionQuestionPlatformServer(composition()));
});

test('configured runtime requires authorized staging mode, explicit bind, and hash-pinned adapter', async () => {
  await assert.rejects(startConfiguredRuntime({}), runtimeError('runtime_mode_not_authorized'));
  await assert.rejects(
    startConfiguredRuntime({ I1Q_RUNTIME_MODE: 'staging', I1Q_BIND_HOST: 'localhost', PORT: '4176' }),
    runtimeError('runtime_bind_host_invalid'),
  );
  await assert.rejects(
    startConfiguredRuntime({ I1Q_RUNTIME_MODE: 'staging', I1Q_BIND_HOST: '127.0.0.1', PORT: '4176' }),
    runtimeError('runtime_composition_module_invalid'),
  );
  await assert.rejects(
    loadHashPinnedRuntimeComposition({ modulePath: '../outside.mjs', moduleSha256: '0'.repeat(64) }),
    runtimeError('runtime_composition_module_invalid'),
  );
});

test('npm start fails closed instead of launching the in-memory platform', () => {
  const run = spawnSync(process.execPath, ['src/runtime.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {},
  });
  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, 'runtime_mode_not_authorized\n');
});
