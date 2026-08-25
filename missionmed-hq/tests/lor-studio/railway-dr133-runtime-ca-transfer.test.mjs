import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { rootCertificates } from 'node:tls';

import {
  DR133_RUNTIME_CA_TRANSFER_CONTRACT,
  Dr133RuntimeCaTransferError,
  inspectDr133RailwayRuntimeRootCa,
  transferDr133RailwayRuntimeRootCa,
  validateDr133RuntimeRootCa,
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

test('uses fixed service-files and variable-set descriptors with no shell or remote command', async () => {
  await withBase(async (base) => {
    const fake = fixture();
    const receipt = await transferDr133RailwayRuntimeRootCa({
      commandRunner: fake.commandRunner,
      environment: { HOME: '/Users/brianb', TMPDIR: base },
      now: NOW,
    });
    assert.equal(receipt.contract, DR133_RUNTIME_CA_TRANSFER_CONTRACT);
    assert.equal(receipt.result, 'ROOT_CA_BOUND_VERIFIED');
    assert.equal(receipt.transport, 'railway-service-files-sftp');
    assert.equal(receipt.shellUsed, false);
    assert.equal(fake.calls.length, 2);
    assert.deepEqual(fake.calls[0].args.slice(0, 10), [
      'service', 'files', '--project', DR133_TARGET.projectId,
      '--environment', DR133_TARGET.environmentId,
      '--service', DR133_TARGET.databaseServiceId, 'download',
      '/var/lib/postgresql/data/certs/root.crt',
    ]);
    assert.deepEqual(fake.calls[1].args, [
      'variable', 'set', 'LOR_DR133_RUNTIME_DATABASE_CA', '--stdin',
      '--skip-deploys', '--json', '--project', DR133_TARGET.projectId,
      '--environment', DR133_TARGET.environmentId,
      '--service', DR133_TARGET.executionServiceId,
    ]);
    for (const call of fake.calls) {
      const flattened = call.args.join(' ');
      assert.doesNotMatch(flattened, /(?:^|\s)(?:ssh|sh|bash|-c|env|printenv|run)(?:\s|$)/u);
      assert.deepEqual(Object.keys(call.env).sort(), [
        'CI', 'DO_NOT_TRACK', 'HOME', 'LANG', 'LC_ALL', 'NO_COLOR', 'PATH',
        'RAILWAY_NO_AUTO_UPDATE', 'RAILWAY_NO_TELEMETRY', 'TERM', 'TMPDIR', 'TZ',
      ]);
    }
    assert.equal(new X509Certificate(fake.sinkBytes()).fingerprint256.length > 0, true);
    assert.deepEqual(await readdir(base), []);
  });
});

test('inspection returns safe metadata, never PEM, and never invokes a sink command', async () => {
  await withBase(async (base) => {
    const fake = fixture();
    const receipt = await inspectDr133RailwayRuntimeRootCa({
      commandRunner: fake.commandRunner,
      environment: { HOME: '/Users/brianb', TMPDIR: base },
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
        environment: { HOME: '/Users/brianb', TMPDIR: base },
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
        environment: { HOME: '/Users/brianb', TMPDIR: base },
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
          environment: { HOME: '/Users/brianb', TMPDIR: base },
          now: NOW,
        }),
        transferError('COMMAND_FAILED_CLOSED'),
      );
      assert.deepEqual(await readdir(base), []);
    });
  }
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
          environment: { HOME: '/Users/brianb', TMPDIR: base },
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

test('accepts the Railway OpenSSL text-plus-PEM root format but rejects lookalike prefixes', () => {
  const opensslPrefix = [
    'Certificate:',
    '    Data:',
    '        Version: 3 (0x2)',
    '        Serial Number: 1',
    '        Signature Algorithm: sha256WithRSAEncryption',
    '        Issuer: CN = Railway CA',
    '        Validity',
    '            Not Before: Jan  1 00:00:00 2026 GMT',
    '            Not After : Jan  1 00:00:00 2036 GMT',
    '        Subject: CN = Railway CA',
    '        Subject Public Key Info:',
    '        X509v3 extensions:',
    '            X509v3 Basic Constraints: critical',
    '                CA:TRUE',
    '    Signature Value:',
    '',
  ].join('\n');
  const value = validateDr133RuntimeRootCa(
    Buffer.concat([Buffer.from(opensslPrefix), Buffer.from(TEST_CA)]),
    { now: NOW },
  );
  assert.match(value.sha256, /^[0-9a-f]{64}$/u);
  assert.throws(
    () => validateDr133RuntimeRootCa(
      Buffer.concat([Buffer.from('Certificate:\n    Data:\nRAILWAY_API_TOKEN=DO_NOT_EMIT\n'), Buffer.from(TEST_CA)]),
      { now: NOW },
    ),
    transferError('ROOT_CA_REJECTED'),
  );
});

test('sink failure is fixed-code, zero-output, and cleans the isolated temp root', async () => {
  await withBase(async (base) => {
    const fake = fixture();
    const sentinel = 'DO_NOT_EMIT_PRIVATE_SINK_VALUE';
    await assert.rejects(
      transferDr133RailwayRuntimeRootCa({
        commandRunner: fake.commandRunner,
        environment: { HOME: '/Users/brianb', TMPDIR: base },
        now: NOW,
        sink: async () => { throw new Error(sentinel); },
      }),
      (error) => {
        assert.equal(error.code, 'TRANSFER_FAILED_CLOSED');
        assert.doesNotMatch(error.message, new RegExp(sentinel, 'u'));
        return true;
      },
    );
    assert.deepEqual(await readdir(base), []);
  });
});

test('malformed variable-set receipt is an outcome-unknown fixed code and never returns PEM', async () => {
  await withBase(async (base) => {
    const fake = fixture({ sinkStdout: JSON.stringify({ set: true, value: TEST_CA }) });
    await assert.rejects(
      transferDr133RailwayRuntimeRootCa({
        commandRunner: fake.commandRunner,
        environment: { HOME: '/Users/brianb', TMPDIR: base },
        now: NOW,
      }),
      transferError('VARIABLE_SET_OUTCOME_UNKNOWN'),
    );
    assert.deepEqual(await readdir(base), []);
  });
});

test('source permanently excludes remote shell and arbitrary environment inheritance', async () => {
  const source = await readFile(new URL(
    '../../scripts/lor-studio/railway-dr133-runtime-ca-transfer.mjs', import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /railway\s+ssh|['"]ssh['"]|['"](?:sh|bash)['"]|shell:\s*true/u);
  assert.doesNotMatch(source, /\.\.\.process\.env|console\.(?:log|error)\s*\(/u);
  assert.match(source, /shell:\s*false/u);
  assert.match(source, /service['"],\s*['"]files/u);
});
