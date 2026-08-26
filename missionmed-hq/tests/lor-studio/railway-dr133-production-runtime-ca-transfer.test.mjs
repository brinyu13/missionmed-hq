import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  DR133_RUNTIME_CA_TRANSFER_CONTRACT,
  createSecretSafeRailwayCommandRunner,
  transferDr133RailwayRuntimeRootCa,
} from '../../scripts/lor-studio/railway-dr133-production-runtime-ca-transfer.mjs';
import {
  DR133_TARGET,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';

const CA = await readFile(new URL('./dr133-production-root-ca.pem', import.meta.url));
const REMOTE_CA = Buffer.concat([
  execFileSync('/opt/homebrew/bin/openssl', [
    'x509', '-in', new URL('./dr133-production-root-ca.pem', import.meta.url).pathname,
    '-text', '-noout',
  ]),
  CA,
]);
assert.equal(
  createHash('sha256').update(REMOTE_CA.subarray(0, REMOTE_CA.length - CA.length)).digest('hex'),
  'a73df22cc4ae331d72db5113b74d3d5485dc01dc76a55a0a04c672e3c7cc00d9',
);
const TOKEN = `railway_${'r'.repeat(32)}`;
const INSTANCE_ID = '00000000-0000-4000-8000-000000000001';

function outcome(stdout, overrides = {}) {
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
    ...overrides,
  });
}

function fakeChild(pid = 42042) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

function descriptor(overrides = {}) {
  return {
    args: ['whoami', '--json'],
    cwd: '/private/missionmed',
    env: { HOME: '/private/missionmed/home', PATH: '/usr/bin:/bin' },
    stdin: null,
    timeoutMs: 1_000,
    ...overrides,
  };
}

function runnerFor(child, overrides = {}) {
  const spawnOptions = [];
  const runner = createSecretSafeRailwayCommandRunner('/private/missionmed/bin/railway', {
    isProcessGroupAlive: async () => false,
    processGroupProbeDelayMs: 1,
    signalProcessGroup: async () => true,
    sleep: async () => undefined,
    verifyExecutable: async () => true,
    spawnProcess(file, args, options) {
      spawnOptions.push({ file, args, options });
      return child;
    },
    ...overrides,
  });
  return { runner, spawnOptions };
}

test('production CA runner accepts only a detached leader with a proven empty group', async () => {
  const child = fakeChild();
  const { runner, spawnOptions } = runnerFor(child);
  setImmediate(() => {
    child.stdout.end('{"safe":true}');
    child.emit('close', 0);
  });
  const receipt = await runner(descriptor());
  assert.equal(receipt.exitCode, 0);
  assert.equal(receipt.closeObserved, true);
  assert.equal(receipt.uncertainChild, false);
  assert.equal(receipt.stdout.toString('utf8'), '{"safe":true}');
  receipt.stdout.fill(0);
  assert.equal(spawnOptions.length, 1);
  assert.equal(spawnOptions[0].options.detached, true);
});

test('leader close with a surviving descendant is reaped but still rejected', async () => {
  const child = fakeChild();
  let alive = true;
  const signals = [];
  const { runner } = runnerFor(child, {
    isProcessGroupAlive: async () => alive,
    signalProcessGroup: async (pid, signal) => {
      signals.push([pid, signal]);
      alive = false;
      return true;
    },
  });
  setImmediate(() => child.emit('close', 0));
  const receipt = await runner(descriptor());
  assert.equal(receipt.closeObserved, true);
  assert.equal(receipt.uncertainChild, true);
  assert.equal(receipt.killFailed, false);
  assert.deepEqual(signals, [[child.pid, 'SIGKILL']]);
});

test('unreapable production CA descendants remain explicitly uncertain', async () => {
  const child = fakeChild();
  const { runner } = runnerFor(child, {
    isProcessGroupAlive: async () => true,
    killGraceMs: 10,
    signalProcessGroup: async () => true,
  });
  setImmediate(() => child.emit('close', 0));
  const receipt = await runner(descriptor());
  assert.equal(receipt.uncertainChild, true);
  assert.equal(receipt.killFailed, true);
});

test('timeout kills the detached group and requires leader-close plus group-empty proof', async () => {
  const child = fakeChild();
  let alive = true;
  const { runner } = runnerFor(child, {
    isProcessGroupAlive: async () => alive,
    killGraceMs: 10,
    signalProcessGroup: async () => {
      alive = false;
      setImmediate(() => child.emit('close', null));
      return true;
    },
    sleep: async () => await new Promise((resolve) => setImmediate(resolve)),
  });
  const receipt = await runner(descriptor());
  assert.equal(receipt.timedOut, true);
  assert.equal(receipt.closeObserved, true);
  assert.equal(receipt.uncertainChild, false);
  assert.equal(receipt.killFailed, false);
});

test('exact production CA transfer downloads only the pinned file and stages only the public CA', async () => {
  const base = mkdtempSync(path.join(tmpdir(), 'f2-lor-production-ca-test-'));
  let stagedInput;
  const calls = [];
  try {
    const receipt = await transferDr133RailwayRuntimeRootCa({
      environment: {
        HOME: '/Users/brianb',
        TMPDIR: base,
        RAILWAY_API_TOKEN: TOKEN,
      },
      now: Date.now(),
      sink: true,
      async commandRunner(observed) {
        calls.push(observed);
        if (observed.args[0] === 'service') {
          const localPath = observed.args[observed.args.indexOf('download') + 2];
          await writeFile(localPath, REMOTE_CA);
          return outcome(JSON.stringify({
            localPath,
            overwritten: false,
            remotePath: '/var/lib/postgresql/data/certs/root.crt',
            service: { id: DR133_TARGET.databaseServiceId, name: 'Postgres-3TCU' },
            serviceInstanceId: INSTANCE_ID,
          }));
        }
        stagedInput = Buffer.from(observed.stdin);
        return outcome(JSON.stringify({
          keys: ['LOR_DR133_RUNTIME_DATABASE_CA'],
          set: true,
        }));
      },
    });
    assert.deepEqual(receipt, {
      contract: DR133_RUNTIME_CA_TRANSFER_CONTRACT,
      result: 'ROOT_CA_BOUND_VERIFIED',
      sha256: '819aeb9a89bc2728aaca019b7bd30f426fe5eef027a0ce201daf8fdf2ff1d897',
      shellUsed: false,
      textPrefixSha256: 'a73df22cc4ae331d72db5113b74d3d5485dc01dc76a55a0a04c672e3c7cc00d9',
      transport: 'railway-service-files-sftp',
      validTo: '2028-11-23T08:23:51.000Z',
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].args[0], 'service');
    assert.deepEqual(calls[1].args.slice(0, 6), [
      'variable', 'set', 'LOR_DR133_RUNTIME_DATABASE_CA',
      '--stdin', '--skip-deploys', '--json',
    ]);
    assert.deepEqual(stagedInput, CA);
    stagedInput.fill(0);
    assert.equal(calls[1].stdin.every((byte) => byte === 0), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
