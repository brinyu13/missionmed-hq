import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  POSTGRES_HARNESS_CONTRACT,
  PostgresHarnessError,
  createDisposablePostgresHarness,
  createPostgresHarnessCommandRunner,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const BINARIES = Object.freeze({
  initdb: '/synthetic/bin/fake-initdb',
  pgCtl: '/synthetic/bin/fake-pg-ctl',
  createdb: '/synthetic/bin/fake-createdb',
  psql: '/synthetic/bin/fake-psql',
});

function success() {
  return Object.freeze({
    exitCode: 0,
    preSpawnFailure: false,
    spawnFailed: false,
    childStarted: true,
    childError: false,
    timedOut: false,
    overflow: false,
    killFailed: false,
    exitObserved: true,
    closeObserved: true,
    uncertainChild: false,
  });
}

function failure() {
  return Object.freeze({
    exitCode: 1,
    preSpawnFailure: false,
    spawnFailed: false,
    childStarted: true,
    childError: false,
    timedOut: false,
    overflow: false,
    killFailed: false,
    exitObserved: true,
    closeObserved: true,
    uncertainChild: false,
  });
}

function uncertainFailure() {
  return Object.freeze({
    exitCode: null,
    preSpawnFailure: false,
    spawnFailed: false,
    childStarted: true,
    childError: true,
    timedOut: true,
    overflow: false,
    killFailed: true,
    exitObserved: false,
    closeObserved: false,
    uncertainChild: true,
  });
}

function argumentAfter(args, flag) {
  const index = args.indexOf(flag);
  assert.notEqual(index, -1, `missing ${flag}`);
  return args[index + 1];
}

function createFakeCommandRunner({ shouldFail } = {}) {
  const calls = [];
  return {
    calls,
    async runner(command) {
      calls.push(command);
      const versionProbe = command.args.length === 1 && command.args[0] === '--version';
      if (!versionProbe && command.binary === BINARIES.initdb) {
        const dataDirectory = argumentAfter(command.args, '--pgdata');
        await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
        await writeFile(path.join(dataDirectory, 'postgresql.conf'), '', 'utf8');
      }
      if (shouldFail?.(command, calls)) return failure();
      return success();
    },
  };
}

async function createSandbox() {
  // Keep the nested fake harness below PostgreSQL's short Unix-socket limit.
  // `/tmp` is resolved by the harness before ownership checks (to `/private/tmp`
  // on macOS), so cleanup still binds to the exact real parent and inode.
  return mkdtemp(path.join('/tmp', 'lpht-'));
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

function isHarnessError(code) {
  return (error) => error instanceof PostgresHarnessError && error.code === code;
}

async function writeNodeFixture(directory, name, body) {
  const fixturePath = path.join(directory, `${name}.cjs`);
  await writeFile(fixturePath, `#!${process.execPath}\n${body}\n`, 'utf8');
  await chmod(fixturePath, 0o700);
  return fixturePath;
}

function runnerDescriptor(binary, cwd, timeoutMs = 1_000) {
  return {
    binary,
    args: [],
    cwd,
    env: {
      PATH: '/usr/bin:/bin',
      LANG: 'C',
      LC_ALL: 'C',
      TZ: 'UTC',
      PGPASSFILE: '/dev/null',
      PGCONNECT_TIMEOUT: '5',
    },
    stdin: null,
    timeoutMs,
  };
}

test('factory exposes no existing-cluster, connection-string, host, or credential input', () => {
  assert.throws(
    () => createDisposablePostgresHarness({ connectionString: 'postgresql://forbidden' }),
    isHarnessError('HARNESS_OPTIONS_UNRECOGNIZED'),
  );
  assert.throws(
    () => createDisposablePostgresHarness({ host: '127.0.0.1' }),
    isHarnessError('HARNESS_OPTIONS_UNRECOGNIZED'),
  );
  assert.throws(
    () => createDisposablePostgresHarness({ dataDirectory: '/tmp/existing-cluster' }),
    isHarnessError('HARNESS_OPTIONS_UNRECOGNIZED'),
  );
  assert.equal(POSTGRES_HARNESS_CONTRACT.externalTargets, 'prohibited');
  assert.equal(POSTGRES_HARNESS_CONTRACT.existingClusters, 'prohibited_no_input_surface');
  assert.throws(
    () => createDisposablePostgresHarness(),
    isHarnessError('BINARY_SET_INVALID'),
  );
  assert.throws(
    () => createDisposablePostgresHarness({
      binaries: { ...BINARIES, initdb: 'relative-initdb' },
    }),
    isHarnessError('INITDB_BINARY_INVALID'),
  );
});

test('default runner distinguishes spawn failure and reaps timeout and overflow fixtures', async () => {
  const sandbox = await createSandbox();
  const runner = createPostgresHarnessCommandRunner({ killGraceMs: 100 });
  try {
    const spawnFailure = await runner(runnerDescriptor(
      path.join(sandbox, 'does-not-exist'),
      sandbox,
      100,
    ));
    assert.equal(spawnFailure.preSpawnFailure, true);
    assert.equal(spawnFailure.childStarted, false);
    assert.equal(spawnFailure.uncertainChild, false);

    const timeoutFixture = await writeNodeFixture(
      sandbox,
      'timeout',
      'setInterval(() => {}, 1_000);',
    );
    const timedOut = await runner(runnerDescriptor(timeoutFixture, sandbox, 50));
    assert.equal(timedOut.timedOut, true);
    assert.equal(timedOut.childStarted, true);
    assert.equal(timedOut.closeObserved, true);
    assert.equal(timedOut.uncertainChild, false);

    const overflowFixture = await writeNodeFixture(
      sandbox,
      'overflow',
      "process.stdout.write('x'.repeat(70 * 1024)); setInterval(() => {}, 1_000);",
    );
    const overflowed = await runner(runnerDescriptor(overflowFixture, sandbox, 1_000));
    assert.equal(overflowed.overflow, true);
    assert.equal(overflowed.childStarted, true);
    assert.equal(overflowed.closeObserved, true);
    assert.equal(overflowed.uncertainChild, false);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('default runner waits for close after exit before reporting success', async () => {
  const sandbox = await createSandbox();
  const runner = createPostgresHarnessCommandRunner({ killGraceMs: 100 });
  try {
    const closeFixture = await writeNodeFixture(
      sandbox,
      'exit-before-close',
      [
        "const { spawn } = require('node:child_process');",
        "const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 180)'],",
        "  { stdio: ['ignore', 'inherit', 'inherit'] });",
        'child.unref();',
      ].join('\n'),
    );
    const startedAt = Date.now();
    const outcome = await runner(runnerDescriptor(closeFixture, sandbox, 1_000));
    const elapsedMs = Date.now() - startedAt;
    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.exitObserved, true);
    assert.equal(outcome.closeObserved, true);
    assert.equal(outcome.uncertainChild, false);
    assert.ok(elapsedMs >= 100, `runner resolved before inherited pipe closed: ${elapsedMs}ms`);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('default runner delivers bounded SQL bytes over stdin without a pathname', async () => {
  const sandbox = await createSandbox();
  const runner = createPostgresHarnessCommandRunner({ killGraceMs: 100 });
  try {
    const stdinFixture = await writeNodeFixture(
      sandbox,
      'stdin',
      [
        "const chunks = [];",
        "process.stdin.on('data', (chunk) => chunks.push(chunk));",
        "process.stdin.on('end', () => {",
        "  const input = Buffer.concat(chunks).toString('utf8');",
        "  process.exit(input === 'SELECT 1;\\n' ? 0 : 2);",
        "});",
      ].join('\n'),
    );
    const outcome = await runner({
      ...runnerDescriptor(stdinFixture, sandbox, 1_000),
      stdin: Buffer.from('SELECT 1;\n'),
    });
    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.closeObserved, true);
    assert.equal(outcome.uncertainChild, false);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('kill error without close is bounded and explicitly marks the child uncertain', async () => {
  class UnkillableChild extends EventEmitter {
    constructor() {
      super();
      this.pid = 42_424;
      this.stdout = new EventEmitter();
      this.stderr = new EventEmitter();
    }

    kill() {
      throw new Error('synthetic kill failure');
    }
  }
  const runner = createPostgresHarnessCommandRunner({
    spawnProcess: () => new UnkillableChild(),
    killGraceMs: 20,
  });
  const outcome = await runner(runnerDescriptor('/synthetic/bin/hung', '/tmp', 20));
  assert.equal(outcome.childStarted, true);
  assert.equal(outcome.timedOut, true);
  assert.equal(outcome.killFailed, true);
  assert.equal(outcome.closeObserved, false);
  assert.equal(outcome.uncertainChild, true);
});

test('runner distinguishes a child-with-pid error and waits for its close', async () => {
  class StartedErrorChild extends EventEmitter {
    constructor() {
      super();
      this.pid = 42_425;
      this.stdout = new EventEmitter();
      this.stderr = new EventEmitter();
    }

    kill() {
      setImmediate(() => {
        this.emit('exit', null, 'SIGKILL');
        this.emit('close', null, 'SIGKILL');
      });
      return true;
    }
  }
  let child;
  const runner = createPostgresHarnessCommandRunner({
    spawnProcess: () => {
      child = new StartedErrorChild();
      setImmediate(() => { child.emit('error', new Error('synthetic child error')); });
      return child;
    },
    killGraceMs: 100,
  });
  const outcome = await runner(runnerDescriptor('/synthetic/bin/started-error', '/tmp', 500));
  assert.equal(outcome.preSpawnFailure, false);
  assert.equal(outcome.spawnFailed, false);
  assert.equal(outcome.childStarted, true);
  assert.equal(outcome.childError, true);
  assert.equal(outcome.exitObserved, true);
  assert.equal(outcome.closeObserved, true);
  assert.equal(outcome.uncertainChild, false);
});

test('base root must resolve inside operating-system temporary storage', async () => {
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: process.cwd(),
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  await assert.rejects(harness.start(), isHarnessError('START_FAILED_CONTAINED'));
  assert.deepEqual(fake.calls, []);
});

test('synthetic harness uses unique roots and identities, Unix sockets only, and exact cleanup', async () => {
  const sandbox = await createSandbox();
  const sqlFile = path.join(sandbox, 'synthetic-migration.sql');
  await writeFile(sqlFile, 'SELECT 1;\n', 'utf8');
  const firstRunner = createFakeCommandRunner();
  const secondRunner = createFakeCommandRunner();
  const first = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: firstRunner.runner,
  });
  const second = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: secondRunner.runner,
  });

  try {
    const firstDescription = await first.start();
    const secondDescription = await second.start();
    assert.equal(firstDescription.transport, 'unix_socket_only');
    assert.equal(firstDescription.externallyReachable, false);
    assert.equal(Object.hasOwn(firstDescription, 'connectionString'), false);
    assert.equal(Object.hasOwn(firstDescription, 'password'), false);
    assert.notEqual(firstDescription.tempRoot, secondDescription.tempRoot);
    assert.notEqual(firstDescription.database, secondDescription.database);
    assert.notEqual(firstDescription.administrativeRole, secondDescription.administrativeRole);
    assert.match(path.basename(firstDescription.tempRoot), /^f2lorpg-/u);
    assert.equal(path.dirname(firstDescription.tempRoot), await realSandbox(sandbox));

    const rootStat = await lstat(firstDescription.tempRoot);
    const socketStat = await lstat(firstDescription.socketDirectory);
    const logStat = await lstat(path.join(firstDescription.tempRoot, 'postgres.log'));
    assert.equal(rootStat.mode & 0o777, 0o700);
    assert.equal(socketStat.mode & 0o777, 0o700);
    assert.equal(logStat.isFile(), true);
    assert.equal(logStat.isSymbolicLink(), false);
    assert.equal(logStat.nlink, 1);
    assert.equal(logStat.mode & 0o777, 0o600);
    const configuration = await readFile(
      path.join(firstDescription.tempRoot, 'd', 'postgresql.conf'),
      'utf8',
    );
    assert.match(configuration, /listen_addresses = ''/u);
    assert.match(configuration, /unix_socket_permissions = 0700/u);
    assert.match(configuration, /fsync = off/u);
    assert.doesNotMatch(configuration, /0\.0\.0\.0|::|password/u);

    const connection = first.connectionOptions();
    assert.deepEqual(Object.keys(connection).sort(), ['database', 'host', 'port', 'user']);
    assert.equal(connection.host, firstDescription.socketDirectory);
    assert.equal(connection.user, firstDescription.administrativeRole);
    assert.notEqual(connection.user, firstDescription.applicationRole);
    assert.throws(
      () => first.connectionOptions({ role: 'application' }),
      isHarnessError('CONNECTION_OPTIONS_INVALID'),
    );

    assert.deepEqual(await first.applySqlFile(sqlFile), {
      applied: true,
      syntheticLocalOnly: true,
    });
    const psql = firstRunner.calls.find(
      (call) => call.binary === BINARIES.psql && call.args[0] !== '--version',
    );
    assert.ok(psql);
    assert.equal(argumentAfter(psql.args, '--host'), firstDescription.socketDirectory);
    assert.equal(argumentAfter(psql.args, '--dbname'), firstDescription.database);
    assert.equal(argumentAfter(psql.args, '--file'), '-');
    assert.equal(psql.stdin.toString('utf8'), 'SELECT 1;\n');
    const snapshotName = (await readdir(firstDescription.tempRoot))
      .find((entry) => /^migration-[a-f0-9]{20}\.sql$/u.test(entry));
    assert.ok(snapshotName);
    const snapshotPath = path.join(firstDescription.tempRoot, snapshotName);
    assert.equal(await readFile(snapshotPath, 'utf8'), 'SELECT 1;\n');
    assert.equal((await lstat(snapshotPath)).mode & 0o777, 0o400);

    for (const command of firstRunner.calls) {
      const keys = Object.keys(command.env).sort();
      assert.deepEqual(keys, [
        'LANG',
        'LC_ALL',
        'PATH',
        'PGCONNECT_TIMEOUT',
        'PGPASSFILE',
        'TZ',
      ]);
      assert.equal(command.env.PATH, '/usr/bin:/bin');
      assert.equal(keys.some((key) => /DATABASE_URL|PGHOST|PGUSER|PGDATABASE|PGPASSWORD/u.test(key)), false);
    }
    assert.equal(
      firstRunner.calls.some((call) => call.args.includes('127.0.0.1') || call.args.includes('0.0.0.0')),
      false,
    );

    assert.deepEqual(await first.stop(), {
      stopped: true,
      cleaned: true,
      alreadyStopped: false,
    });
    assert.equal(await pathExists(firstDescription.tempRoot), false);
    assert.deepEqual(await first.stop(), {
      stopped: true,
      cleaned: true,
      alreadyStopped: true,
    });
    await second.stop();
    assert.equal(await pathExists(secondDescription.tempRoot), false);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

async function realSandbox(sandbox) {
  const { realpath } = await import('node:fs/promises');
  return realpath(sandbox);
}

test('initdb failure is contained and its unique temporary root is removed', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner({
    shouldFail(command) {
      return command.binary === BINARIES.initdb && command.args[0] !== '--version';
    },
  });
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    await assert.rejects(harness.start(), isHarnessError('START_FAILED_CONTAINED'));
    const entries = await readdir(sandbox);
    assert.deepEqual(entries, []);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('post-initdb configuration symlink substitution is contained without touching its target', async () => {
  const sandbox = await createSandbox();
  const externalTarget = path.join(sandbox, 'configuration-target.txt');
  await writeFile(externalTarget, 'unchanged', { mode: 0o600 });
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: async (command) => {
      const outcome = await fake.runner(command);
      if (command.binary === BINARIES.initdb && command.args[0] !== '--version') {
        const configurationPath = path.join(
          argumentAfter(command.args, '--pgdata'),
          'postgresql.conf',
        );
        await rm(configurationPath);
        await symlink(externalTarget, configurationPath);
      }
      return outcome;
    },
  });
  try {
    await assert.rejects(harness.start(), isHarnessError('START_FAILED_CONTAINED'));
    assert.equal(await readFile(externalTarget, 'utf8'), 'unchanged');
    assert.deepEqual(await readdir(sandbox), ['configuration-target.txt']);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('post-initdb log symlink substitution is contained without touching its target', async () => {
  const sandbox = await createSandbox();
  const externalTarget = path.join(sandbox, 'log-target.txt');
  await writeFile(externalTarget, 'unchanged', { mode: 0o600 });
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: async (command) => {
      const outcome = await fake.runner(command);
      if (command.binary === BINARIES.initdb && command.args[0] !== '--version') {
        const logPath = path.join(command.cwd, 'postgres.log');
        await rm(logPath);
        await symlink(externalTarget, logPath);
      }
      return outcome;
    },
  });
  try {
    await assert.rejects(harness.start(), isHarnessError('START_FAILED_CONTAINED'));
    assert.equal(await readFile(externalTarget, 'utf8'), 'unchanged');
    assert.deepEqual(await readdir(sandbox), ['log-target.txt']);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('uncertain child state preserves the unique root and reports cleanup unproven', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: async (command) => {
      const outcome = await fake.runner(command);
      if (command.binary === BINARIES.initdb && command.args[0] !== '--version') {
        return uncertainFailure();
      }
      return outcome;
    },
  });
  try {
    await assert.rejects(
      harness.start(),
      isHarnessError('START_FAILED_CLEANUP_UNPROVEN'),
    );
    const entries = await readdir(sandbox);
    assert.equal(entries.length, 1);
    assert.match(entries[0], /^f2lorpg-/u);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('setup failure after root creation removes only the validated unique root', async () => {
  const sandbox = await mkdtemp(path.join('/tmp', `lpht-${'x'.repeat(65)}-`));
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    await assert.rejects(harness.start(), isHarnessError('START_FAILED_CONTAINED'));
    assert.deepEqual(await readdir(sandbox), []);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('uncertain startup is stopped immediately before its root is cleaned', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner({
    shouldFail(command) {
      return command.binary === BINARIES.pgCtl && command.args[0] === 'start';
    },
  });
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    await assert.rejects(harness.start(), isHarnessError('START_FAILED_CONTAINED'));
    const stop = fake.calls.find(
      (call) => call.binary === BINARIES.pgCtl && call.args[0] === 'stop',
    );
    assert.ok(stop);
    assert.equal(argumentAfter(stop.args, '-m'), 'immediate');
    assert.deepEqual(await readdir(sandbox), []);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('shutdown falls back from fast to immediate and cleans only after a proved stop', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner({
    shouldFail(command) {
      return command.binary === BINARIES.pgCtl
        && command.args[0] === 'stop'
        && argumentAfter(command.args, '-m') === 'fast';
    },
  });
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    const description = await harness.start();
    await harness.stop();
    const stopModes = fake.calls
      .filter((call) => call.binary === BINARIES.pgCtl && call.args[0] === 'stop')
      .map((call) => argumentAfter(call.args, '-m'));
    assert.deepEqual(stopModes, ['fast', 'immediate']);
    assert.equal(await pathExists(description.tempRoot), false);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('failed fast and immediate shutdown preserves the exact root', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner({
    shouldFail(command) {
      return command.binary === BINARIES.pgCtl && command.args[0] === 'stop';
    },
  });
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    const description = await harness.start();
    await assert.rejects(
      harness.stop(),
      isHarnessError('SHUTDOWN_UNPROVEN_ROOT_PRESERVED'),
    );
    assert.equal(await pathExists(description.tempRoot), true);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('shutdown never invokes pg_ctl for a same-name replacement root', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    const description = await harness.start();
    const displaced = `${description.tempRoot}-displaced`;
    await rename(description.tempRoot, displaced);
    await mkdir(description.tempRoot, { mode: 0o700 });
    const stopCount = fake.calls.filter(
      (call) => call.binary === BINARIES.pgCtl && call.args[0] === 'stop',
    ).length;
    await assert.rejects(
      harness.stop(),
      isHarnessError('SHUTDOWN_TARGET_IDENTITY_MISMATCH_ROOT_PRESERVED'),
    );
    assert.equal(fake.calls.filter(
      (call) => call.binary === BINARIES.pgCtl && call.args[0] === 'stop',
    ).length, stopCount);
    assert.equal(await pathExists(description.tempRoot), true);
    assert.equal(await pathExists(displaced), true);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('shutdown never invokes pg_ctl for a same-name replacement data directory', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    const description = await harness.start();
    const dataDirectory = path.join(description.tempRoot, 'd');
    const displaced = path.join(description.tempRoot, 'd-displaced');
    await rename(dataDirectory, displaced);
    await mkdir(dataDirectory, { mode: 0o700 });
    const stopCount = fake.calls.filter(
      (call) => call.binary === BINARIES.pgCtl && call.args[0] === 'stop',
    ).length;
    await assert.rejects(
      harness.stop(),
      isHarnessError('SHUTDOWN_TARGET_IDENTITY_MISMATCH_ROOT_PRESERVED'),
    );
    assert.equal(fake.calls.filter(
      (call) => call.binary === BINARIES.pgCtl && call.args[0] === 'stop',
    ).length, stopCount);
    assert.equal(await pathExists(dataDirectory), true);
    assert.equal(await pathExists(displaced), true);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('apply never invokes psql for a same-name replacement socket directory', async () => {
  const sandbox = await createSandbox();
  const sqlFile = path.join(sandbox, 'synthetic.sql');
  await writeFile(sqlFile, 'SELECT 1;\n', 'utf8');
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    const description = await harness.start();
    const displaced = path.join(description.tempRoot, 's-displaced');
    await rename(description.socketDirectory, displaced);
    await mkdir(description.socketDirectory, { mode: 0o700 });
    const psqlCount = fake.calls.filter(
      (call) => call.binary === BINARIES.psql && call.args[0] !== '--version',
    ).length;
    await assert.rejects(
      harness.applySqlFile(sqlFile),
      isHarnessError('APPLY_TARGET_IDENTITY_MISMATCH_ROOT_PRESERVED'),
    );
    assert.equal(fake.calls.filter(
      (call) => call.binary === BINARIES.psql && call.args[0] !== '--version',
    ).length, psqlCount);
    assert.equal(await pathExists(description.socketDirectory), true);
    assert.equal(await pathExists(displaced), true);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('SQL execution accepts only absolute regular non-symlink files', async () => {
  const sandbox = await createSandbox();
  const fake = createFakeCommandRunner();
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: fake.runner,
  });
  try {
    await harness.start();
    await assert.rejects(
      harness.applySqlFile('relative.sql'),
      isHarnessError('SQL_FILE_PATH_INVALID'),
    );
    const target = path.join(sandbox, 'target.sql');
    const link = path.join(sandbox, 'link.sql');
    await writeFile(target, 'SELECT 1;\n', 'utf8');
    await symlink(target, link);
    await assert.rejects(harness.applySqlFile(link), isHarnessError('SQL_FILE_UNSAFE'));
    await harness.stop();
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('SQL execution uses verified stdin bytes when the source path changes', async () => {
  const sandbox = await createSandbox();
  const sqlFile = path.join(sandbox, 'source.sql');
  await writeFile(sqlFile, 'SELECT 1;\n', 'utf8');
  const fake = createFakeCommandRunner();
  let observedStdin;
  const harness = createDisposablePostgresHarness({
    baseTempRoot: sandbox,
    binaries: BINARIES,
    commandRunner: async (command) => {
      if (command.binary === BINARIES.psql && command.args[0] !== '--version') {
        await writeFile(sqlFile, 'SELECT 999;\n', 'utf8');
        observedStdin = command.stdin.toString('utf8');
      }
      return fake.runner(command);
    },
  });
  try {
    const description = await harness.start();
    await harness.applySqlFile(sqlFile);
    assert.equal(observedStdin, 'SELECT 1;\n');
    const snapshotName = (await readdir(description.tempRoot))
      .find((entry) => /^migration-[a-f0-9]{20}\.sql$/u.test(entry));
    assert.ok(snapshotName);
    const observedSnapshotPath = path.join(description.tempRoot, snapshotName);
    assert.equal((await lstat(observedSnapshotPath)).mode & 0o777, 0o400);
    await harness.stop();
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
