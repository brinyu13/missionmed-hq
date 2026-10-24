import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { rootCertificates } from 'node:tls';

import {
  DR133_RUNTIME_CA_TRANSFER_CONTRACT,
  Dr133RuntimeCaTransferError,
  acceptDr133VariableSetOutcome,
  assertDr133RuntimeTargetRootCa,
  createSecretSafeRailwayCommandRunner,
  dr133RuntimeCaTransferDescriptors,
  dr133FileSnapshotsMatch,
  inspectDr133RailwayRuntimeRootCa,
  transferDr133RailwayRuntimeRootCa,
  validateDr133VariableSetReceipt,
  validateDr133RuntimeRootCa,
  validateDr133SshAgentInventory,
} from '../../scripts/lor-studio/railway-dr133-runtime-ca-transfer.mjs';
import { DR133_TARGET } from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';

const NOW = Date.now();
const TEST_CA = rootCertificates.find((candidate) => {
  try {
    const certificate = new X509Certificate(candidate);
    return certificate.ca === true
      && certificate.checkIssued(certificate)
      && certificate.verify(certificate.publicKey)
      && Date.parse(certificate.validFrom) <= NOW
      && Date.parse(certificate.validTo) - NOW >= 31 * 24 * 60 * 60 * 1_000;
  } catch {
    return false;
  }
});
if (!TEST_CA) throw new Error('Node runtime has no suitable self-signed test root CA');

const DOWNLOAD_KEYS = [
  'localPath', 'overwritten', 'remotePath', 'service', 'serviceInstanceId',
];
const INSTANCE_ID = '00000000-0000-4000-8000-000000000001';
const TEST_RAILWAY_TOKEN = 'r'.repeat(48);

function environment(base, overrides = {}) {
  return { HOME: '/Users/brianb', TMPDIR: base, RAILWAY_API_TOKEN: TEST_RAILWAY_TOKEN, ...overrides };
}

function transferError(code) {
  return (error) => error instanceof Dr133RuntimeCaTransferError && error.code === code;
}

function success(stdout) {
  return Object.freeze({
    exitCode: 0,
    stdout: Buffer.from(stdout),
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
  });
}

function downloadReceipt(localPath, overrides = {}) {
  return JSON.stringify({
    localPath,
    overwritten: false,
    remotePath: '/var/lib/postgresql/data/certs/root.crt',
    service: { id: DR133_TARGET.databaseServiceId, name: 'Postgres' },
    serviceInstanceId: INSTANCE_ID,
    ...overrides,
  });
}

function variableReceipt(overrides = {}) {
  return JSON.stringify({ keys: ['LOR_DR133_RUNTIME_DATABASE_CA'], set: true, ...overrides });
}

function fixture({ fileBytes = Buffer.from(TEST_CA), downloadStdout, sinkStdout } = {}) {
  const calls = [];
  let sinkBytes = null;
  const commandRunner = async (descriptor) => {
    calls.push(descriptor);
    if (descriptor.args[0] === 'service') {
      const localPath = descriptor.args[descriptor.args.indexOf('download') + 2];
      await writeFile(localPath, fileBytes);
      return success(downloadStdout ?? downloadReceipt(localPath));
    }
    sinkBytes = Buffer.from(descriptor.stdin);
    return success(sinkStdout ?? variableReceipt());
  };
  return { calls, commandRunner, sinkBytes: () => sinkBytes };
}

async function withBase(fn) {
  const base = mkdtempSync(path.join(tmpdir(), 'f2-lor-ca-test-'));
  try {
    return await fn(base);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

function commandDescriptor(overrides = {}) {
  return {
    args: ['whoami', '--json'],
    cwd: '/private/missionmed',
    env: { HOME: '/private/missionmed/home', PATH: '/usr/bin:/bin' },
    stdin: null,
    timeoutMs: 1_000,
    ...overrides,
  };
}

function fakeChild({ pid = 42042, killResult = true } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killSignals = [];
  child.kill = (signal) => {
    child.killSignals.push(signal);
    return killResult;
  };
  return child;
}

test('real secret-safe command runner executes only its verified-path argument and redacts stderr', async () => {
  const executablePath = '/private/missionmed/bin/railway';
  const child = fakeChild();
  const spawnCalls = [];
  let verificationCount = 0;
  const stdinChunks = [];
  child.stdin.on('data', (chunk) => stdinChunks.push(Buffer.from(chunk)));
  const runner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => { verificationCount += 1; },
    spawnProcess: (file, args, options) => {
      spawnCalls.push({ file, args, options });
      setImmediate(() => {
        child.stdout.write(Buffer.from('{"safe":true}'));
        child.stderr.write(Buffer.from('DO_NOT_EMIT_STDERR_SECRET'));
        child.emit('close', 0);
      });
      return child;
    },
  });
  const stdin = Buffer.from('public-test-input');
  const outcome = await runner(commandDescriptor({ stdin }));
  assert.equal(spawnCalls.length, 1);
  assert.equal(verificationCount, 2);
  assert.equal(spawnCalls[0].file, executablePath);
  assert.deepEqual(spawnCalls[0].args, ['whoami', '--json']);
  assert.deepEqual(spawnCalls[0].options, {
    cwd: '/private/missionmed',
    env: { HOME: '/private/missionmed/home', PATH: '/usr/bin:/bin' },
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.equal(Buffer.concat(stdinChunks).toString('utf8'), 'public-test-input');
  assert.equal(outcome.stdout.toString('utf8'), '{"safe":true}');
  assert.equal(outcome.stderrBytes, Buffer.byteLength('DO_NOT_EMIT_STDERR_SECRET'));
  assert.doesNotMatch(JSON.stringify(outcome), /DO_NOT_EMIT_STDERR_SECRET/u);
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.closeObserved, true);
});

test('real secret-safe command runner classifies spawn, nonzero, overflow, and timeout outcomes', async () => {
  const executablePath = '/private/missionmed/bin/railway';
  const spawnFailure = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {},
    spawnProcess: () => { throw new Error('DO_NOT_EMIT_SPAWN_FAILURE'); },
  });
  const spawnOutcome = await spawnFailure(commandDescriptor());
  assert.equal(spawnOutcome.spawnFailed, true);
  assert.equal(spawnOutcome.childStarted, false);
  assert.doesNotMatch(JSON.stringify(spawnOutcome), /DO_NOT_EMIT/u);

  const nonzeroChild = fakeChild();
  const nonzeroRunner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {},
    spawnProcess: () => {
      setImmediate(() => nonzeroChild.emit('close', 7));
      return nonzeroChild;
    },
  });
  const nonzeroOutcome = await nonzeroRunner(commandDescriptor());
  assert.equal(nonzeroOutcome.exitCode, 7);
  assert.equal(nonzeroOutcome.closeObserved, true);

  const overflowChild = fakeChild();
  const overflowRunner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {},
    spawnProcess: () => {
      setImmediate(() => {
        overflowChild.stdout.write(Buffer.alloc((16 * 1_024) + 1, 0x41));
        overflowChild.emit('close', 0);
      });
      return overflowChild;
    },
  });
  const overflowOutcome = await overflowRunner(commandDescriptor());
  assert.equal(overflowOutcome.overflow, true);
  assert.deepEqual(overflowChild.killSignals, ['SIGKILL']);

  const driftChild = fakeChild();
  let driftChecks = 0;
  const driftRunner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {
      driftChecks += 1;
      if (driftChecks === 2) throw new Error('TEST_EXECUTABLE_DRIFT');
    },
    spawnProcess: () => {
      setImmediate(() => driftChild.emit('close', 0));
      return driftChild;
    },
  });
  const driftOutcome = await driftRunner(commandDescriptor());
  assert.equal(driftOutcome.executableDrift, true);
  assert.equal(driftOutcome.exitCode, 0);

  const processErrorChild = fakeChild();
  const processErrorRunner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {},
    spawnProcess: () => {
      setImmediate(() => {
        processErrorChild.emit('error', new Error('DO_NOT_EMIT_POST_START_ERROR'));
        processErrorChild.emit('close', 0);
      });
      return processErrorChild;
    },
  });
  const processErrorOutcome = await processErrorRunner(commandDescriptor());
  assert.equal(processErrorOutcome.processError, true);
  assert.equal(processErrorOutcome.exitCode, 0);

  const stdinErrorChild = fakeChild();
  const stdinErrorRunner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {},
    spawnProcess: () => {
      setImmediate(() => {
        stdinErrorChild.stdin.emit('error', new Error('DO_NOT_EMIT_STDIN_ERROR'));
        stdinErrorChild.emit('close', 0);
      });
      return stdinErrorChild;
    },
  });
  const stdinErrorOutcome = await stdinErrorRunner(commandDescriptor({
    stdin: Buffer.from('public-test-input'),
  }));
  assert.equal(stdinErrorOutcome.stdinError, true);
  assert.equal(stdinErrorOutcome.exitCode, 0);

  for (const stream of ['stdout', 'stderr']) {
    const streamErrorChild = fakeChild();
    const streamErrorRunner = createSecretSafeRailwayCommandRunner(executablePath, {
      verifyExecutable: async () => {},
      spawnProcess: () => {
        setImmediate(() => {
          streamErrorChild[stream].emit('error', new Error('DO_NOT_EMIT_STREAM_ERROR'));
          streamErrorChild.emit('close', 0);
        });
        return streamErrorChild;
      },
    });
    const streamErrorOutcome = await streamErrorRunner(commandDescriptor());
    assert.equal(streamErrorOutcome[`${stream}Error`], true);
    assert.equal(streamErrorOutcome.exitCode, 0);
  }

  const timeoutChild = fakeChild();
  const timeoutRunner = createSecretSafeRailwayCommandRunner(executablePath, {
    verifyExecutable: async () => {},
    spawnProcess: () => timeoutChild,
    killGraceMs: 10,
  });
  const timeoutOutcome = await timeoutRunner(commandDescriptor());
  assert.equal(timeoutOutcome.timedOut, true);
  assert.equal(timeoutOutcome.uncertainChild, true);
  assert.equal(timeoutOutcome.closeObserved, false);
  assert.deepEqual(timeoutChild.killSignals, ['SIGKILL']);
});

test('missing Railway token fails before any command runner invocation', async () => {
  await withBase(async (base) => {
    let invocations = 0;
    await assert.rejects(
      inspectDr133RailwayRuntimeRootCa({
        commandRunner: async () => { invocations += 1; },
        environment: { HOME: '/Users/brianb', TMPDIR: base },
        now: NOW,
      }),
      transferError('RAILWAY_CREDENTIAL_REQUIRED'),
    );
    assert.equal(invocations, 0);
    assert.deepEqual(await readdir(base), []);
  });
});

test('dedicated SSH agent inventory accepts only the exact Railway ED25519 identity', () => {
  const expected = '256 SHA256:1XELSoL+4coSC8deWxyjbfQcj4PiHBCk3+iKZ3BCThU '
    + '/private/missionmed/railway-key (ED25519)\n';
  assert.equal(validateDr133SshAgentInventory(Buffer.from(expected)), true);
  for (const value of [
    expected.replace('1XEL', '2XEL'),
    `${expected}${expected}`,
    expected.trimEnd(),
    expected.replace('\n', '\r\n'),
    expected.replace('256 ', '2048 '),
    expected.replace('(ED25519)', '(RSA)'),
    expected.replace('railway-key', 'railway-key\nPASSWORD=DO_NOT_EMIT'),
  ]) {
    assert.throws(
      () => validateDr133SshAgentInventory(Buffer.from(value)),
      transferError('SSH_AGENT_IDENTITY_REJECTED'),
    );
  }
  assert.throws(
    () => validateDr133SshAgentInventory(Buffer.from([0xff, 0xfe])),
    transferError('SSH_AGENT_IDENTITY_REJECTED'),
  );
});

test('custody snapshot comparison detects every file-identity and mutation field', () => {
  const snapshot = Object.freeze({
    dev: 1n,
    ino: 2n,
    mode: 0o100500n,
    nlink: 1n,
    uid: 501n,
    gid: 20n,
    size: 16_028_800n,
    mtimeNs: 3n,
    ctimeNs: 4n,
  });
  assert.equal(dr133FileSnapshotsMatch(snapshot, { ...snapshot }), true);
  for (const key of Object.keys(snapshot)) {
    assert.equal(
      dr133FileSnapshotsMatch(snapshot, { ...snapshot, [key]: snapshot[key] + 1n }),
      false,
      key,
    );
  }
});

test('uses fixed service-files and variable-set descriptors with no shell or remote command', async () => {
  await withBase(async (base) => {
    const fake = fixture();
    const receipt = await inspectDr133RailwayRuntimeRootCa({
      commandRunner: fake.commandRunner,
      environment: environment(base),
      now: NOW,
    });
    assert.equal(receipt.contract, DR133_RUNTIME_CA_TRANSFER_CONTRACT);
    assert.equal(receipt.result, 'ROOT_CA_INSPECTED_VERIFIED');
    assert.equal(receipt.transport, 'railway-service-files-sftp');
    assert.equal(receipt.shellUsed, false);
    assert.equal(fake.calls.length, 1);
    const localPath = fake.calls[0].args[fake.calls[0].args.indexOf('download') + 2];
    const descriptors = dr133RuntimeCaTransferDescriptors(localPath);
    assert.deepEqual(fake.calls[0].args, descriptors.download);
    assert.deepEqual(descriptors.variableSet, [
      'variable', 'set', 'LOR_DR133_RUNTIME_DATABASE_CA', '--stdin',
      '--skip-deploys', '--json', '--project', DR133_TARGET.projectId,
      '--environment', DR133_TARGET.environmentId,
      '--service', DR133_TARGET.executionServiceId,
    ]);
    for (const call of fake.calls) {
      const flattened = call.args.join(' ');
      assert.doesNotMatch(flattened, /(?:^|\s)(?:ssh|sh|bash|-c|env|printenv|run)(?:\s|$)/u);
      assert.notEqual(call.env.HOME, '/Users/brianb');
      assert.equal(path.basename(call.env.HOME), 'home');
      assert.equal(
        await realpath(path.dirname(path.dirname(call.env.HOME))),
        await realpath(base),
      );
      assert.deepEqual(Object.keys(call.env).sort(), [
        'CI', 'DO_NOT_TRACK', 'HOME', 'LANG', 'LC_ALL', 'NO_COLOR', 'PATH',
        'RAILWAY_API_TOKEN', 'RAILWAY_NO_AUTO_UPDATE', 'RAILWAY_NO_TELEMETRY',
        'TERM', 'TMPDIR', 'TZ',
      ]);
      assert.equal(call.env.RAILWAY_API_TOKEN, TEST_RAILWAY_TOKEN);
    }
    assert.equal(fake.sinkBytes(), null);
    assert.deepEqual(await readdir(base), []);
  });
});

test('inspection returns safe metadata, never PEM, and never invokes a sink command', async () => {
  await withBase(async (base) => {
    const fake = fixture();
    const receipt = await inspectDr133RailwayRuntimeRootCa({
      commandRunner: fake.commandRunner,
      environment: environment(base),
      now: NOW,
    });
    assert.deepEqual(Object.keys(receipt).sort(), [
      'contract', 'result', 'sha256', 'shellUsed', 'transport', 'validTo',
    ]);
    assert.equal(receipt.result, 'ROOT_CA_INSPECTED_VERIFIED');
    assert.match(receipt.sha256, /^[0-9a-f]{64}$/u);
    assert.doesNotMatch(JSON.stringify(receipt), /BEGIN CERTIFICATE|PRIVATE KEY/u);
    assert.equal(fake.calls.length, 1);
    assert.deepEqual(await readdir(base), []);
  });
});

test('platform or environment output is rejected even when a valid CA file exists', async () => {
  await withBase(async (base) => {
    const fake = fixture({ downloadStdout: 'RAILWAY_API_TOKEN=DO_NOT_EMIT\nPATH=/usr/bin' });
    await assert.rejects(
      inspectDr133RailwayRuntimeRootCa({
        commandRunner: fake.commandRunner,
        environment: environment(base),
        now: NOW,
      }),
      transferError('DOWNLOAD_RECEIPT_REJECTED'),
    );
    assert.equal(fake.calls.length, 1);
    assert.deepEqual(await readdir(base), []);
  });
});

test('environment material prepended to the downloaded file is rejected before sink', async () => {
  await withBase(async (base) => {
    const fake = fixture({
      fileBytes: Buffer.concat([Buffer.from('DATABASE_URL=DO_NOT_EMIT\n'), Buffer.from(TEST_CA)]),
    });
    let sinkCalls = 0;
    await assert.rejects(
      transferDr133RailwayRuntimeRootCa({
        commandRunner: fake.commandRunner,
        environment: environment(base),
        now: NOW,
        sink: async () => { sinkCalls += 1; },
      }),
      transferError('ROOT_CA_REJECTED'),
    );
    assert.equal(sinkCalls, 0);
    assert.deepEqual(await readdir(base), []);
  });
});

test('nonzero, stderr, timeout, overflow, spawn, and uncertain outcomes fail closed', async () => {
  const cases = [
    { exitCode: 1 },
    { stderrBytes: 1 },
    { timedOut: true },
    { overflow: true },
    { processError: true },
    { stdinError: true },
    { stdoutError: true },
    { stderrError: true },
    { executableDrift: true },
    { spawnFailed: true, childStarted: false, exitCode: null },
    { uncertainChild: true, closeObserved: false, exitCode: null },
  ];
  for (const overrides of cases) {
    await withBase(async (base) => {
      const fake = fixture();
      fake.commandRunner = async () => Object.freeze({ ...success('{}'), ...overrides });
      await assert.rejects(
        inspectDr133RailwayRuntimeRootCa({
          commandRunner: fake.commandRunner,
          environment: environment(base),
          now: NOW,
        }),
        transferError('COMMAND_FAILED_CLOSED'),
      );
      assert.deepEqual(await readdir(base), []);
    });
  }
});

test('started or uncertain variable-set outcomes require provider readback', () => {
  const uncertainCases = [
    { exitCode: 1 },
    { stderrBytes: 1 },
    { timedOut: true },
    { overflow: true },
    { processError: true },
    { stdinError: true },
    { stdoutError: true },
    { stderrError: true },
    { uncertainChild: true, closeObserved: false, exitCode: null },
  ];
  for (const overrides of uncertainCases) {
    assert.throws(
      () => acceptDr133VariableSetOutcome(Object.freeze({ ...success('{}'), ...overrides })),
      transferError('VARIABLE_SET_OUTCOME_UNKNOWN'),
    );
  }
  assert.throws(
    () => acceptDr133VariableSetOutcome(Object.freeze({
      ...success('{}'),
      exitCode: null,
      childStarted: false,
      spawnFailed: true,
      closeObserved: false,
    })),
    transferError('COMMAND_FAILED_CLOSED'),
  );
});

test('download receipt rejects every extra, missing, rebound, or overwrite field', async () => {
  const cases = [
    (localPath) => downloadReceipt(localPath, { extra: true }),
    (localPath) => JSON.stringify(Object.fromEntries(
      Object.entries(JSON.parse(downloadReceipt(localPath)))
        .filter(([key]) => key !== DOWNLOAD_KEYS[0]),
    )),
    (localPath) => downloadReceipt(localPath, { overwritten: true }),
    (localPath) => downloadReceipt(localPath, { remotePath: '/proc/self/environ' }),
    (localPath) => downloadReceipt(localPath, { service: { id: 'wrong', name: 'Postgres' } }),
  ];
  for (const build of cases) {
    await withBase(async (base) => {
      const commandRunner = async (descriptor) => {
        const localPath = descriptor.args[descriptor.args.indexOf('download') + 2];
        await writeFile(localPath, TEST_CA);
        return success(build(localPath));
      };
      await assert.rejects(
        inspectDr133RailwayRuntimeRootCa({
          commandRunner,
          environment: environment(base),
          now: NOW,
        }),
        transferError('DOWNLOAD_RECEIPT_REJECTED'),
      );
      assert.deepEqual(await readdir(base), []);
    });
  }
});

test('PEM gate rejects private keys, multiple roots, extra bytes, malformed UTF-8, and expiry risk', () => {
  const valid = Buffer.from(TEST_CA);
  const cases = [
    Buffer.concat([valid, valid]),
    Buffer.concat([Buffer.from('leading\n'), valid]),
    Buffer.concat([valid, Buffer.from('\ntrailing')]),
    Buffer.from('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n'),
    Buffer.from([0xff, 0xfe, 0xfd, ...valid.subarray(0, 260)]),
  ];
  for (const value of cases) {
    assert.throws(() => validateDr133RuntimeRootCa(value, { now: NOW }), transferError('ROOT_CA_REJECTED'));
  }
  const certificate = new X509Certificate(TEST_CA);
  assert.throws(
    () => validateDr133RuntimeRootCa(valid, {
      now: Date.parse(certificate.validTo) - (29 * 24 * 60 * 60 * 1_000),
    }),
    transferError('ROOT_CA_REJECTED'),
  );
});

test('provider sink rejects a different valid self-signed CA before variable mutation', async () => {
  const validated = validateDr133RuntimeRootCa(Buffer.from(TEST_CA), { now: NOW });
  assert.throws(
    () => assertDr133RuntimeTargetRootCa(validated),
    transferError('ROOT_CA_TARGET_MISMATCH'),
  );
  await withBase(async (base) => {
    const fake = fixture();
    await assert.rejects(
      transferDr133RailwayRuntimeRootCa({
        commandRunner: fake.commandRunner,
        environment: environment(base),
        now: NOW,
      }),
      transferError('ROOT_CA_TARGET_MISMATCH'),
    );
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.sinkBytes(), null);
    assert.deepEqual(await readdir(base), []);
  });
});

test('accepts the Railway OpenSSL text-plus-PEM root format but rejects lookalike prefixes', () => {
  const prefixLines = [
    'Certificate:',
    '    Data:',
    '        Version: 3 (0x2)',
    '        Serial Number: 1 (0x1)',
    '        Signature Algorithm: sha256WithRSAEncryption',
    '        Issuer: CN = Railway CA',
    '        Validity',
    '            Not Before: Jan  1 00:00:00 2026 GMT',
    '            Not After : Jan  1 00:00:00 2036 GMT',
    '        Subject: CN = Railway CA',
    '        Subject Public Key Info:',
    '            Public Key Algorithm: rsaEncryption',
    '                Public-Key: (2048 bit)',
    '                Modulus:',
    '                    00:aa:bb:',
    '                    cc:dd',
    '                Exponent: 65537 (0x10001)',
    '        X509v3 extensions:',
    '            X509v3 Basic Constraints: critical',
    '                CA:TRUE',
    '            X509v3 Key Usage: critical',
    '                Certificate Sign, CRL Sign',
    '    Signature Algorithm: sha256WithRSAEncryption',
    '    Signature Value:',
    '         00:aa:bb:',
    '         cc:dd',
    '',
  ];
  const opensslPrefix = prefixLines.join('\n');
  for (const prefix of [opensslPrefix, prefixLines.join('\r\n')]) {
    const value = validateDr133RuntimeRootCa(
      Buffer.concat([Buffer.from(prefix), Buffer.from(TEST_CA)]),
      { now: NOW },
    );
    assert.match(value.sha256, /^[0-9a-f]{64}$/u);
  }
  const mutations = [
    prefixLines.toReversed().join('\n'),
    [...prefixLines.slice(0, 3), prefixLines[2], ...prefixLines.slice(3)].join('\n'),
    opensslPrefix.replace('CN = Railway CA', 'CN = Version: Railway CA'),
    opensslPrefix.replace('                CA:TRUE', '                RAILWAY_API_TOKEN=DO_NOT_EMIT'),
    opensslPrefix.replace('                CA:TRUE', '                export token=DO_NOT_EMIT'),
    opensslPrefix.replace('                CA:TRUE', '                arbitrary printable line'),
    opensslPrefix.replace(
      '                Certificate Sign, CRL Sign',
      '                Certificate Sign, CRL Sign\n                Export RAILWAY_API_TOKEN=opaque',
    ),
    opensslPrefix.replace(
      '                Certificate Sign, CRL Sign',
      '                Certificate Sign, CRL Sign\n                declare -x DATABASE_URL=opaque',
    ),
    opensslPrefix.replace(
      '                Certificate Sign, CRL Sign',
      '                Certificate Sign, CRL Sign\n                SECRET : opaque',
    ),
    opensslPrefix.replace(
      '                Certificate Sign, CRL Sign',
      '                Certificate Sign, CRL Sign\n                PASSWORD opaque',
    ),
    opensslPrefix.replace(
      '                Certificate Sign, CRL Sign',
      '                Certificate Sign, CRL Sign\n                DB=opaque',
    ),
    opensslPrefix.replace(
      '                Certificate Sign, CRL Sign',
      '                Certificate Sign, CRL Sign\n                arbitrary printable text',
    ),
    opensslPrefix.replace('                CA:TRUE', '                CA:TRUE\t'),
    opensslPrefix.replace('                CA:TRUE', '                CA:TRUE '),
    opensslPrefix.replace('\n        Validity\n', '\r\n        Validity\n'),
    opensslPrefix.replace('         00:aa:bb:\n         cc:dd\n', ''),
    opensslPrefix.replace('         cc:dd', '       cc:dd'),
  ];
  for (const [index, prefix] of mutations.entries()) {
    assert.throws(
      () => validateDr133RuntimeRootCa(
        Buffer.concat([Buffer.from(prefix), Buffer.from(TEST_CA)]),
        { now: NOW },
      ),
      transferError('ROOT_CA_REJECTED'),
      `mutation ${index}`,
    );
  }
});

test('function sink cannot bypass target pinning or receive a different valid CA', async () => {
  await withBase(async (base) => {
    const fake = fixture();
    let sinkCalls = 0;
    await assert.rejects(
      transferDr133RailwayRuntimeRootCa({
        commandRunner: fake.commandRunner,
        environment: environment(base),
        now: NOW,
        sink: async () => { sinkCalls += 1; },
      }),
      transferError('ROOT_CA_TARGET_MISMATCH'),
    );
    assert.equal(sinkCalls, 0);
    assert.deepEqual(await readdir(base), []);
  });
});

test('malformed variable-set receipt is an outcome-unknown fixed code and never returns PEM', () => {
  for (const value of [
    { set: true, value: TEST_CA },
    { set: true, keys: [] },
    { set: false, keys: ['LOR_DR133_RUNTIME_DATABASE_CA'] },
    { set: true, keys: ['WRONG_KEY'] },
  ]) {
    assert.throws(
      () => validateDr133VariableSetReceipt(Buffer.from(JSON.stringify(value))),
      transferError('VARIABLE_SET_OUTCOME_UNKNOWN'),
    );
  }
});

test('source permanently excludes remote shell and arbitrary environment inheritance', async () => {
  const source = await readFile(new URL(
    '../../scripts/lor-studio/railway-dr133-runtime-ca-transfer.mjs', import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /railway\s+ssh|['"]ssh['"]|['"](?:sh|bash)['"]|shell:\s*true/u);
  assert.doesNotMatch(source, /\.\.\.process\.env|console\.(?:log|error)\s*\(/u);
  assert.doesNotMatch(source, /spawnProcess\(RAILWAY_BINARY/u);
  assert.match(source, /shell:\s*false/u);
  assert.match(source, /stagePinnedRailwayBinary\(root\)/u);
  assert.match(source, /createSecretSafeRailwayCommandRunner\(stagedRailwayBinary\)/u);
  assert.match(source, /createSecretSafeRailwayCommandRunner\(SSH_ADD_BINARY/u);
  assert.match(source, /verifyDedicatedRailwaySshAgent\(sshAgent, root\)/u);
  assert.match(source, /service['"],\s*['"]files/u);
});
