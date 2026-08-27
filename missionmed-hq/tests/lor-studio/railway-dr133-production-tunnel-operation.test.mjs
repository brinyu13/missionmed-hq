import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_RUNNER_CONTRACT,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_TARGET,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  DR133_DATABASE_SERVICE_NAME,
  DR133_OPERATION_CLOSURE_PATHS,
  DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT,
  Dr133ProductionTunnelOperationError,
  buildDr133TunnelChildEnvironments,
  createDr133RailwayProductionTunnelExecutor,
  dr133ServiceOperationCommandArgs,
  dr133TunnelCommandArgs,
  preflightDr133RailwayProductionTunnelSourceCustody,
  validateDr133TunnelServiceReceipt,
  verifyDr133PgDependencyClosure,
  verifyDr133ProductionPinnedToolchain,
} from '../../scripts/lor-studio/run-dr133-railway-production-tunnel-operation.mjs';

const PRODUCTION_CA = await readFile(
  new URL('./dr133-production-root-ca.pem', import.meta.url),
  'utf8',
);
const TOKEN = 'r'.repeat(48);
const PORT = 55_432;
const SOURCE_COMMIT = 'a'.repeat(40);
const WORKSPACE = Object.freeze({
  base: '/tmp',
  root: '/tmp/f2-lor-dr133-production-tunnel-test',
  home: '/tmp/f2-lor-dr133-production-tunnel-test/home',
  temporary: '/tmp/f2-lor-dr133-production-tunnel-test/tmp',
});
const RUNTIME_URL = `postgresql://lor_studio_runtime_login:${'A'.repeat(48)}`
  + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`;
const HASH_KEYS = Object.freeze({
  aiProposalRollbackSha256: 'ai-proposal-rollback',
  aiProposalSha256: 'ai-proposal',
  encryptedPrivateStorageRollbackSha256: 'encrypted-private-storage-rollback',
  encryptedPrivateStorageSha256: 'encrypted-private-storage',
  facultyCandidateAuthHandoffRollbackSha256:
    'faculty-candidate-auth-handoff-rollback',
  facultyCandidateAuthHandoffSha256: 'faculty-candidate-auth-handoff',
  facultyInvitationRollbackSha256: 'faculty-invitation-rollback',
  facultyInvitationSha256: 'faculty-invitation',
  facultyPrivateExportRollbackSha256: 'faculty-private-export-rollback',
  facultyPrivateExportSha256: 'faculty-private-export',
  foundationSha256: 'foundation',
  identityScopeRollbackSha256: 'identity-scope-rollback',
  identityScopeSha256: 'identity-scope',
  mentorAssignmentRollbackSha256: 'mentor-assignment-rollback',
  mentorAssignmentSha256: 'mentor-assignment',
  rlsSha256: 'rls',
  studentEvidenceRollbackSha256: 'student-evidence-rollback',
  studentEvidenceSha256: 'student-evidence',
});

function artifactHash(id) {
  return DR133_ARTIFACTS.find((artifact) => artifact.id === id).sha256;
}

function runnerHashes() {
  return Object.fromEntries(Object.entries(HASH_KEYS).map(([key, id]) => [key, artifactHash(id)]));
}

function successReceipt(mode) {
  if (mode === 'connectivity-preflight') {
    return {
      contract: 'missionmed.lor.railway-dr133-production-connectivity.v1',
      result: 'FRESH_PRIVATE_TARGET_VERIFIED',
      postgresMajor: 18,
    };
  }
  if (mode === 'rollback-drill') {
    return {
      contract: 'missionmed.lor.railway-dr133-production-rollback-drill.v1',
      mode,
      result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED',
      postgresMajor: 18,
      relationCount: DR133_RELATIONS.length,
      rollbackCount: 10,
      verifiedArtifactCount: 20,
      ...runnerHashes(),
      foundationRollbackSha256: artifactHash('foundation-rollback'),
      rlsRollbackSha256: artifactHash('rls-rollback'),
    };
  }
  const result = {
    migration: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED',
    'successor-migration': 'SUCCESSOR_COMMITTED_VERIFIED',
    'schema-verifier': 'SCHEMA_VERIFIED_NO_MUTATION',
    'runtime-login': 'RUNTIME_LOGIN_COMMITTED_VERIFIED',
    'runtime-login-deprovision': 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
  }[mode];
  const receipt = { contract: DR133_RUNNER_CONTRACT, mode, result };
  if (['migration', 'successor-migration', 'schema-verifier'].includes(mode)) {
    Object.assign(receipt, runnerHashes(), {
      postgresMajor: 18,
      relationCount: DR133_RELATIONS.length,
      definerCount: DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length,
    });
  }
  if (mode === 'runtime-login') {
    receipt.mentorAssignmentRollbackSha256 = artifactHash('mentor-assignment-rollback');
  }
  if (mode === 'runtime-login-deprovision') {
    receipt.postgresMajor = 18;
    receipt.runtimeDeprovisionGuardRollbackSha256 = artifactHash(
      'mentor-assignment-rollback',
    );
    receipt.runtimeDeprovisionGuardStage = 8;
  }
  return receipt;
}

function failureReceipt(mode, result) {
  const receipt = {
    contract: DR133_RUNNER_CONTRACT,
    mode,
    result,
    runnerCode: 'POSTFLIGHT_REJECTED',
    postgresCode: null,
  };
  if (['migration', 'successor-migration', 'schema-verifier'].includes(mode)) {
    Object.assign(receipt, runnerHashes());
  }
  if (mode === 'runtime-login' && result !== 'NO_MUTATION') {
    receipt.mentorAssignmentRollbackSha256 = artifactHash('mentor-assignment-rollback');
  }
  if (mode === 'runtime-login-deprovision' && result !== 'NO_MUTATION') {
    receipt.runtimeDeprovisionGuardRollbackSha256 = artifactHash(
      'mentor-assignment-rollback',
    );
    receipt.runtimeDeprovisionGuardStage = 8;
  }
  return receipt;
}

function receiptBytes(receipt) {
  return Buffer.from(`${JSON.stringify(receipt)}\n`);
}

class FakeChild extends EventEmitter {
  constructor(pid, { streams }) {
    super();
    this.pid = pid;
    if (streams) {
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
    }
  }

  close(code = 0, signal = null) {
    this.emit('close', code, signal);
  }
}

function harness({
  agentFailureAt = null,
  createAgentFailure = false,
  operationOutcomes = [{ receipt: successReceipt('connectivity-preflight'), exitCode: 0 }],
  readiness = true,
  stderr = null,
  survivingOperationDescendant = false,
  tunnelClosesDuringOperation = false,
  uncertainOperationGroup = false,
  uncertainTunnel = false,
} = {}) {
  const calls = [];
  const children = new Map();
  const processGroups = new Map();
  let nextPid = 30_000;
  let tunnelOpen = false;
  let agentVerifications = 0;
  let cleanupCount = 0;
  let abortableSleepCount = 0;
  let abortedSleepCount = 0;
  const queue = [...operationOutcomes];
  const dependencies = {
    allocatePort: async () => PORT,
    cleanupWorkspace: async () => { cleanupCount += 1; },
    createNodeVerifier: async () => ({
      directory: '/usr/local/bin', verify: async () => true,
    }),
    createOperationSourceVerifier: async () => ({ verify: async () => true }),
    createSshAgentVerifier: async () => {
      if (createAgentFailure) throw new Error('secret-bearing identity error');
      return {
        socketPath: '/tmp/agent.sock',
        verify: async () => {
          agentVerifications += 1;
          if (agentVerifications === agentFailureAt) throw new Error('identity mismatch secret');
          return true;
        },
      };
    },
    createWorkspace: async () => WORKSPACE,
    isProcessGroupAlive: (pid) => processGroups.get(pid) ?? false,
    operationTimeoutMs: () => 5_000,
    probeLoopbackPort: async () => (readiness ? tunnelOpen : false),
    signalProcessGroup: (pid, signal) => {
      calls.push({ kind: 'signal', pid, signal });
      const child = children.get(pid);
      if (!child || (pid === 30_000 && uncertainTunnel)
        || (pid !== 30_000 && uncertainOperationGroup)) return false;
      processGroups.set(pid, false);
      if (pid === 30_000) tunnelOpen = false;
      queueMicrotask(() => child.close(null, signal));
      return true;
    },
    sleep: async (_milliseconds, { signal } = {}) => {
      if (!signal) return await new Promise((resolve) => setImmediate(resolve));
      abortableSleepCount += 1;
      return await new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => finish(false), 100);
        const finish = (aborted) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          if (aborted) abortedSleepCount += 1;
          resolve();
        };
        const onAbort = () => finish(true);
        if (signal.aborted) finish(true);
        else signal.addEventListener('abort', onAbort, { once: true });
      });
    },
    spawnProcess: (executable, args, options) => {
      const pid = nextPid;
      nextPid += 1;
      const streams = options.stdio[1] === 'pipe';
      const child = new FakeChild(pid, { streams });
      children.set(pid, child);
      processGroups.set(pid, true);
      calls.push({ kind: 'spawn', executable, args, options, pid });
      if (pid === 30_000) {
        tunnelOpen = true;
      } else {
        const outcome = queue.shift();
        queueMicrotask(() => {
          if (stderr) child.stderr.write(Buffer.from(stderr));
          if (outcome?.receipt) child.stdout.write(receiptBytes(outcome.receipt));
          if (tunnelClosesDuringOperation) {
            tunnelOpen = false;
            processGroups.set(30_000, false);
            children.get(30_000).close(1, null);
          } else {
            if (!survivingOperationDescendant) processGroups.set(pid, false);
            child.close(outcome?.exitCode ?? 1, null);
          }
        });
      }
      return child;
    },
    stageRailwayBinary: async () => ({
      path: '/tmp/f2-lor-dr133-production-tunnel-test/bin/railway',
      verify: async () => true,
    }),
    timings: {
      startupAttempts: 2,
      startupDelayMs: 0,
      startupStabilityMs: 0,
      probeTimeoutMs: 1,
      shutdownGraceMs: 1,
      killGraceMs: 1,
      processGroupProbeDelayMs: 1,
      portClosureAttempts: 2,
      portClosureDelayMs: 0,
    },
    verifySshTransportBinary: async () => true,
  };
  return {
    calls,
    cleanupCount: () => cleanupCount,
    agentVerifications: () => agentVerifications,
    abortableSleepCount: () => abortableSleepCount,
    abortedSleepCount: () => abortedSleepCount,
    execute: createDr133RailwayProductionTunnelExecutor(dependencies),
  };
}

function options(mode = 'connectivity-preflight') {
  return {
    databaseCa: PRODUCTION_CA,
    environment: {
      RAILWAY_API_TOKEN: TOKEN,
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      TMPDIR: '/tmp',
    },
    mode,
    sourceCommit: SOURCE_COMMIT,
    ...(mode === 'runtime-login' ? { runtimeDatabaseUrl: RUNTIME_URL } : {}),
  };
}

function tunnelError(code) {
  return (error) => error instanceof Dr133ProductionTunnelOperationError
    && error.code === code
    && !/postgres(?:ql)?:\/\/|BEGIN CERTIFICATE|secret-bearing/iu.test(error.message);
}

test('descriptors pin exact connect name and exact no-local sanitizer-only service command', () => {
  assert.deepEqual(dr133TunnelCommandArgs(PORT), [
    'connect', DR133_DATABASE_SERVICE_NAME,
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--ssh', '--tunnel-only', '--port', String(PORT),
  ]);
  const operation = dr133ServiceOperationCommandArgs('connectivity-preflight', PORT);
  assert.deepEqual(operation.slice(0, 8), [
    'run', '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.databaseServiceId,
    '--no-local',
  ]);
  assert.equal(operation[8], '--');
  assert.equal(operation[9], '/usr/bin/env');
  assert.equal(operation.includes('/usr/bin/python3'), true);
  assert.equal(operation.includes('-I'), true);
  assert.equal(operation.includes('-E'), true);
  assert.equal(operation.includes('-s'), true);
  assert.equal(operation.at(-4), '/usr/local/bin/node');
  assert.equal(
    operation.at(-3),
    '/Users/brianb/MissionMed_worktrees/F2-LOR-1009/missionmed-hq/'
      + 'scripts/lor-studio/run-dr133-railway-production-service-operation.mjs',
  );
  assert.equal(operation.at(-2), 'connectivity-preflight');
  assert.equal(operation.at(-1), String(PORT));
  assert.equal(operation.some((value) => value === '-c' || value === 'node'), false);
});

test('pinned production toolchain accepts the exact root-owned macOS multicall Python stub', async () => {
  assert.equal(await verifyDr133ProductionPinnedToolchain(), true);
});

test('child environments are exact allowlists and never give the Node operation SSH-agent access', () => {
  const built = buildDr133TunnelChildEnvironments({
    databaseCa: PRODUCTION_CA,
    mode: 'runtime-login',
    nodeDirectory: '/usr/local/bin',
    port: PORT,
    runtimeDatabaseUrl: RUNTIME_URL,
    socketPath: '/tmp/agent.sock',
    token: TOKEN,
    workspace: WORKSPACE,
  });
  assert.equal(built.tunnel.SSH_AUTH_SOCK, '/tmp/agent.sock');
  assert.equal(Object.hasOwn(built.operation, 'SSH_AUTH_SOCK'), false);
  assert.equal(built.operation.LOR_DR133_TUNNEL_HOST, '127.0.0.1');
  assert.equal(built.operation.LOR_DR133_TUNNEL_PORT, String(PORT));
  assert.equal(built.operation.LOR_DR133_RUNTIME_DATABASE_URL, RUNTIME_URL);
  for (const denied of [
    'DATABASE_URL', 'DATABASE_PUBLIC_URL', 'NODE_OPTIONS', 'PGOPTIONS',
    'PGSSLNEGOTIATION', 'BASH_ENV', 'ENV',
  ]) assert.equal(Object.hasOwn(built.operation, denied), false, denied);
});

test('all seven service receipt modes accept only canonical one-line fixed receipts', () => {
  for (const mode of [
    'connectivity-preflight', 'migration', 'successor-migration', 'schema-verifier',
    'rollback-drill', 'runtime-login', 'runtime-login-deprovision',
  ]) {
    const receipt = successReceipt(mode);
    assert.deepEqual(validateDr133TunnelServiceReceipt(receiptBytes(receipt), mode, 0), receipt);
  }
  const blocked = {
    contract: 'missionmed.lor.railway-dr133-production-connectivity.v1',
    result: 'BLOCKED',
    runnerCode: 'CONNECT_FAILED',
    postgresCode: null,
  };
  assert.deepEqual(
    validateDr133TunnelServiceReceipt(receiptBytes(blocked), 'connectivity-preflight', 1),
    blocked,
  );
});

test('receipt validator rejects extra output, mode drift, exit drift, artifact drift, and secrets', () => {
  const migration = successReceipt('migration');
  const deprovision = successReceipt('runtime-login-deprovision');
  for (const [bytes, mode, exitCode] of [
    [Buffer.from(`notice\n${JSON.stringify(migration)}\n`), 'migration', 0],
    [receiptBytes(migration), 'schema-verifier', 0],
    [receiptBytes(migration), 'migration', 1],
    [receiptBytes({ ...migration, foundationSha256: '0'.repeat(64) }), 'migration', 0],
    [
      receiptBytes({ ...deprovision, runtimeDeprovisionGuardStage: 5 }),
      'runtime-login-deprovision',
      0,
    ],
    [Buffer.from('{"contract":"postgresql://password"}\n'), 'migration', 1],
  ]) assert.throws(() => validateDr133TunnelServiceReceipt(bytes, mode, exitCode));
});

test('executor orders readiness, custody rechecks, exact spawns, safe receipt, SIGINT, and cleanup', async () => {
  const fixture = harness();
  const receipt = await fixture.execute(options());
  assert.deepEqual(receipt, successReceipt('connectivity-preflight'));
  const spawns = fixture.calls.filter(({ kind }) => kind === 'spawn');
  assert.equal(spawns.length, 2);
  assert.deepEqual(spawns[0].args, dr133TunnelCommandArgs(PORT));
  assert.deepEqual(spawns[0].options.stdio, ['ignore', 'ignore', 'ignore']);
  assert.equal(spawns[0].options.shell, false);
  assert.equal(spawns[0].options.detached, true);
  assert.deepEqual(
    spawns[1].args,
    dr133ServiceOperationCommandArgs('connectivity-preflight', PORT),
  );
  assert.deepEqual(spawns[1].options.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(spawns[1].options.env.LOR_DR133_MODE, 'connectivity-preflight');
  assert.equal(Object.hasOwn(spawns[1].options.env, 'DATABASE_URL'), false);
  assert.equal(Object.hasOwn(spawns[1].options.env, 'LOR_DR133_SOURCE_COMMIT'), false);
  assert.equal(fixture.calls.some(
    ({ kind, pid, signal }) => kind === 'signal' && pid === 30_000 && signal === 'SIGINT',
  ), true);
  assert.equal(fixture.agentVerifications() >= 4, true);
  assert.equal(fixture.cleanupCount(), 1);
  assert.equal(fixture.abortableSleepCount() >= 1, true);
  assert.equal(fixture.abortedSleepCount() >= 1, true);
  assert.doesNotMatch(JSON.stringify(receipt), /BEGIN CERTIFICATE|postgres(?:ql)?:\/\//u);
});

test('agent mismatch before spawn and anchored re-verification drift fail closed', async () => {
  const rejected = harness({ createAgentFailure: true });
  await assert.rejects(rejected.execute(options()), tunnelError('SSH_AGENT_IDENTITY_REJECTED'));
  assert.equal(rejected.calls.some(({ kind }) => kind === 'spawn'), false);
  assert.equal(rejected.cleanupCount(), 1);

  const drifted = harness({ agentFailureAt: 2 });
  await assert.rejects(drifted.execute(options()), tunnelError('SSH_AGENT_IDENTITY_REJECTED'));
  assert.equal(drifted.calls.filter(({ kind }) => kind === 'spawn').length, 1);
  assert.equal(drifted.cleanupCount(), 1);
});

test('readiness timeout, stderr secret, tunnel loss, and uncertain reap remain distinct', async () => {
  const notReady = harness({ readiness: false });
  await assert.rejects(notReady.execute(options()), tunnelError('TUNNEL_READINESS_TIMEOUT'));

  const stderr = harness({ stderr: 'postgresql://admin:password@private\n' });
  await assert.rejects(stderr.execute(options()), tunnelError('SERVICE_STDERR_REJECTED'));

  const lost = harness({ tunnelClosesDuringOperation: true });
  await assert.rejects(lost.execute(options()), tunnelError('TUNNEL_LOST_DURING_OPERATION'));

  const uncertain = harness({ uncertainTunnel: true });
  await assert.rejects(uncertain.execute(options()), tunnelError('TUNNEL_CHILD_UNCERTAIN'));
});

test('leader close is insufficient until every detached operation descendant is gone', async () => {
  const cleaned = harness({ survivingOperationDescendant: true });
  assert.deepEqual(
    await cleaned.execute(options()),
    successReceipt('connectivity-preflight'),
  );
  assert.equal(cleaned.calls.some(
    ({ kind, pid, signal }) => kind === 'signal' && pid === 30_001 && signal === 'SIGINT',
  ), true);

  const uncertain = harness({
    survivingOperationDescendant: true,
    uncertainOperationGroup: true,
  });
  await assert.rejects(
    uncertain.execute(options()),
    tunnelError('SERVICE_CHILD_UNCERTAIN'),
  );
  assert.equal(uncertain.cleanupCount(), 1);
});

test('valid service failure is preserved and risky runtime-login failure is deprovisioned', async () => {
  const blocked = {
    contract: 'missionmed.lor.railway-dr133-production-connectivity.v1',
    result: 'BLOCKED',
    runnerCode: 'CONNECT_FAILED',
    postgresCode: null,
  };
  const ordinary = harness({ operationOutcomes: [{ receipt: blocked, exitCode: 1 }] });
  await assert.rejects(
    ordinary.execute(options()),
    (error) => tunnelError('SERVICE_OPERATION_REJECTED')(error)
      && error.safeReceipts.length === 1
      && error.safeReceipt.result === 'BLOCKED',
  );

  const risky = failureReceipt(
    'runtime-login',
    'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED',
  );
  const deprovisioned = successReceipt('runtime-login-deprovision');
  const compensated = harness({
    operationOutcomes: [
      { receipt: risky, exitCode: 1 },
      { receipt: deprovisioned, exitCode: 0 },
    ],
  });
  await assert.rejects(
    compensated.execute(options('runtime-login')),
    (error) => tunnelError('RUNTIME_LOGIN_REJECTED_DEPROVISIONED')(error)
      && error.safeReceipts.length === 2
      && error.safeReceipts[0].result === risky.result
      && error.safeReceipts[1].result === deprovisioned.result,
  );
  const operationSpawns = compensated.calls.filter(
    ({ kind, options: spawnOptions }) => kind === 'spawn' && spawnOptions.stdio[1] === 'pipe',
  );
  assert.equal(operationSpawns.length, 2);
  assert.equal(operationSpawns[0].options.env.LOR_DR133_MODE, 'runtime-login');
  assert.equal(
    operationSpawns[1].options.env.LOR_DR133_MODE,
    'runtime-login-deprovision',
  );
  assert.equal(
    Object.hasOwn(operationSpawns[1].options.env, 'LOR_DR133_RUNTIME_DATABASE_URL'),
    false,
  );

  const provenNoMutation = harness({
    operationOutcomes: [{
      receipt: failureReceipt('runtime-login', 'NO_MUTATION'),
      exitCode: 1,
    }],
  });
  await assert.rejects(
    provenNoMutation.execute(options('runtime-login')),
    tunnelError('SERVICE_OPERATION_REJECTED'),
  );
  assert.equal(
    provenNoMutation.calls.filter(
      ({ kind, options: spawnOptions }) => kind === 'spawn' && spawnOptions.stdio[1] === 'pipe',
    ).length,
    1,
  );
});

test('unknown runtime-login outcome is compensated and failed compensation is explicit', async () => {
  const deprovisioned = successReceipt('runtime-login-deprovision');
  const unknown = harness({
    operationOutcomes: [
      { receipt: { contract: 'invalid' }, exitCode: 0 },
      { receipt: deprovisioned, exitCode: 0 },
    ],
  });
  await assert.rejects(
    unknown.execute(options('runtime-login')),
    (error) => tunnelError('RUNTIME_LOGIN_OUTCOME_UNKNOWN_DEPROVISIONED')(error)
      && error.safeReceipts.length === 1
      && error.safeReceipts[0].result === deprovisioned.result,
  );

  const original = failureReceipt(
    'runtime-login',
    'RUNTIME_LOGIN_COMMITTED_VERIFICATION_UNKNOWN',
  );
  const cleanupFailure = failureReceipt(
    'runtime-login-deprovision',
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFICATION_UNKNOWN',
  );
  const unproven = harness({
    operationOutcomes: [
      { receipt: original, exitCode: 1 },
      { receipt: cleanupFailure, exitCode: 1 },
    ],
  });
  await assert.rejects(
    unproven.execute(options('runtime-login')),
    (error) => tunnelError('RUNTIME_LOGIN_CLEANUP_UNPROVEN')(error)
      && error.safeReceipts.length === 2
      && error.safeReceipts.at(-1).result === cleanupFailure.result,
  );
});

test('isolated sanitizer argv contains no secret and hostile startup variables cannot execute', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'f2-lor-sanitizer-hostile-'));
  const nodeMarker = path.join(root, 'node-marker');
  const pythonMarker = path.join(root, 'python-marker');
  const shellMarker = path.join(root, 'shell-marker');
  const nodePayload = path.join(root, 'node-payload.cjs');
  const pythonPayload = path.join(root, 'python-startup.py');
  const shellPayload = path.join(root, 'shell-startup.sh');
  try {
    await writeFile(nodePayload, `require('node:fs').writeFileSync(${JSON.stringify(nodeMarker)}, 'bad')\n`);
    await writeFile(pythonPayload, `open(${JSON.stringify(pythonMarker)}, 'w').write('bad')\n`);
    await writeFile(shellPayload, `/bin/echo bad > ${JSON.stringify(shellMarker)}\n`);
    const operation = dr133ServiceOperationCommandArgs('connectivity-preflight', PORT);
    const delimiter = operation.indexOf('--');
    const executable = operation[delimiter + 1];
    const args = operation.slice(delimiter + 2);
    const secretPassword = 'secret-admin-password-never-in-argv';
    const hostileEnvironment = {
      DATABASE_URL: `postgresql://${secretPassword}@invalid.invalid:5432/railway`,
      DATABASE_PUBLIC_URL: `postgresql://${secretPassword}@public.invalid:5432/railway`,
      LOR_DR133_MODE: 'connectivity-preflight',
      LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
      LOR_DR133_TUNNEL_HOST: '127.0.0.1',
      LOR_DR133_TUNNEL_PORT: String(PORT),
      RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
      RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
      RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
      RAILWAY_SERVICE_ID: DR133_TARGET.databaseServiceId,
      NODE_OPTIONS: `--require=${nodePayload}`,
      NODE_PATH: root,
      PYTHONPATH: root,
      PYTHONSTARTUP: pythonPayload,
      BASH_ENV: shellPayload,
      ENV: shellPayload,
      PATH: root,
      PGOPTIONS: '-c statement_timeout=1',
      PGSSLNEGOTIATION: 'direct',
    };
    const argv = JSON.stringify([executable, ...args]);
    assert.doesNotMatch(argv, new RegExp(secretPassword, 'u'));
    assert.doesNotMatch(argv, /BEGIN CERTIFICATE|postgres(?:ql)?:\/\//u);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: '/Users/brianb/MissionMed_worktrees/F2-LOR-1009/missionmed-hq',
        env: hostileEnvironment,
        shell: false,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('sanitizer test timed out'));
      }, 10_000);
      child.once('error', reject);
      child.once('close', (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });
    assert.equal(code, 1);
    for (const marker of [nodeMarker, pythonMarker, shellMarker]) {
      await assert.rejects(readFile(marker), { code: 'ENOENT' });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source guard proves pre-pg custody, dynamic post-scrub import, and exact closure inventory', async () => {
  const tunnelSource = await readFile(
    new URL('../../scripts/lor-studio/run-dr133-railway-production-tunnel-operation.mjs', import.meta.url),
    'utf8',
  );
  const wrapperSource = await readFile(
    new URL('../../scripts/lor-studio/run-dr133-railway-production-service-operation.mjs', import.meta.url),
    'utf8',
  );
  const sanitizerSource = await readFile(
    new URL('../../scripts/lor-studio/dr133_railway_production_service_sanitizer.py', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    tunnelSource,
    /from '\.\/(?:verify-dr133-railway-production-connectivity|run-dr133-railway-production-rollback-drill)\.mjs'/u,
  );
  assert.doesNotMatch(wrapperSource, /^import .*runDr133Production/mu);
  assert.equal(
    wrapperSource.indexOf('scrubDr133SensitiveAmbientEnvironment(ambient)')
      < wrapperSource.indexOf('await import(operationDescriptor.module)'),
    true,
  );
  assert.equal(sanitizerSource.indexOf('os.environ.clear()') < sanitizerSource.indexOf('os.execve('), true);
  assert.doesNotMatch(
    `${sanitizerSource}\n${wrapperSource}`,
    /RAILWAY_(?:DEPLOYMENT_ID|REPLICA_REGION)/u,
  );
  assert.match(tunnelSource, /const PYTHON_BINARY_NLINK = 78n;/u);
  assert.match(tunnelSource, /opened\.nlink !== expectedNlink/u);
  assert.match(
    tunnelSource,
    /\[PYTHON_BINARY, PYTHON_BINARY_SHA256, PYTHON_BINARY_NLINK\]/u,
  );
  for (const denied of [
    'NODE_OPTIONS', 'DATABASE_PUBLIC_URL', 'PGOPTIONS', 'PGSSLNEGOTIATION',
    'PYTHONPATH', 'PYTHONSTARTUP', 'BASH_ENV',
  ]) assert.doesNotMatch(sanitizerSource.split('clean = {')[1].split('}')[0], new RegExp(denied, 'u'));
  assert.equal(DR133_OPERATION_CLOSURE_PATHS.includes('package.json'), true);
  assert.equal(DR133_OPERATION_CLOSURE_PATHS.includes('package-lock.json'), true);
  for (const relativePath of [
    'missionmed-hq/scripts/lor-studio/complete-dr133-railway-production-runtime-binding.mjs',
    'missionmed-hq/scripts/lor-studio/railway-dr133-production-runtime-url-binding.mjs',
  ]) assert.equal(DR133_OPERATION_CLOSURE_PATHS.includes(relativePath), true);
  assert.equal(
    DR133_OPERATION_CLOSURE_PATHS.includes(
      'missionmed-hq/scripts/lor-studio/dr133_railway_production_service_sanitizer.py',
    ),
    true,
  );
  assert.equal(await verifyDr133PgDependencyClosure(), true);
});

test('source-custody preflight has a fixed safe contract and rejects unpinned input', async () => {
  assert.equal(
    DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT,
    'missionmed.lor.railway-dr133-source-custody-preflight.v1',
  );
  await assert.rejects(
    preflightDr133RailwayProductionTunnelSourceCustody({ sourceCommit: 'not-a-commit' }),
    tunnelError('SOURCE_COMMIT_INVALID'),
  );
  await assert.rejects(
    preflightDr133RailwayProductionTunnelSourceCustody({
      sourceCommit: SOURCE_COMMIT,
      unexpected: true,
    }),
    tunnelError('SOURCE_CUSTODY_PREFLIGHT_OPTIONS_INVALID'),
  );
});
