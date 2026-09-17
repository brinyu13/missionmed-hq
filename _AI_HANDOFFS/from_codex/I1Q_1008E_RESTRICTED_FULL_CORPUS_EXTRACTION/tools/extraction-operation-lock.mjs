import { spawn } from 'node:child_process';
import { constants as fsConstants, lstatSync } from 'node:fs';
import { open } from 'node:fs/promises';

import { assertBoundaryPath } from './boundary.mjs';

export const EXTRACTION_OPERATION_LOCK_PATH = 'state/.extraction-operation.lock';

const LOCKF_PATH = '/usr/bin/lockf';
const READY_MARKER = 'MISSIONMED_EXTRACTION_OPERATION_LOCK_READY';
const HOLDER_SOURCE = [
  `process.stdout.write('${READY_MARKER}\\n');`,
  'process.stdin.resume();',
  "process.stdin.once('end', () => process.exit(0));",
].join('');
const FILE_MODE = 0o600;
const MODE_MASK = 0o7777;

const SAFE_CODES = new Set([
  'operation_lock_busy',
  'operation_lock_io_failure',
  'operation_lock_lost',
  'operation_lock_platform_unsupported',
]);

export class ExtractionOperationLockError extends Error {
  constructor(code) {
    const safeCode = SAFE_CODES.has(code) ? code : 'operation_lock_io_failure';
    super(safeCode);
    this.name = 'ExtractionOperationLockError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new ExtractionOperationLockError(code);
}

function secureLockStat(stat) {
  if (!stat?.isFile() || stat.isSymbolicLink()
      || stat.uid !== process.getuid() || stat.nlink !== 1
      || (stat.mode & MODE_MASK) !== FILE_MODE) fail('operation_lock_io_failure');
}

async function ensureStableLockFile(path) {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    fail('operation_lock_platform_unsupported');
  }
  let handle;
  let created = false;
  try {
    try {
      handle = await open(
        path,
        fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
        FILE_MODE,
      );
      created = true;
      await handle.chmod(FILE_MODE);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      handle = await open(path, fsConstants.O_RDWR | fsConstants.O_NOFOLLOW);
    }
    const stat = await handle.stat();
    secureLockStat(stat);
    if (created) await handle.sync();
    return { dev: stat.dev, ino: stat.ino };
  } catch (error) {
    if (error instanceof ExtractionOperationLockError) throw error;
    fail('operation_lock_io_failure');
  } finally {
    await handle?.close().catch(() => {});
  }
}

/**
 * Acquire one stable kernel advisory lock shared by extraction and rotation.
 * The pathname is persistent. Kernel ownership, not PID metadata or unlinking,
 * controls exclusivity and is released automatically if either process dies.
 */
export async function acquireExtractionOperationLock({
  boundaryRoot,
  worktreeRoot,
  timeoutSeconds = 0,
} = {}) {
  if (!Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 0 || timeoutSeconds > 60) {
    fail('operation_lock_io_failure');
  }
  const path = await assertBoundaryPath(boundaryRoot, EXTRACTION_OPERATION_LOCK_PATH, {
    mustExist: false,
    kind: 'file',
    operation: 'write',
    worktreeRoot,
  });
  const stableIdentity = await ensureStableLockFile(path);

  const child = spawn(LOCKF_PATH, [
    '-k', '-s', '-t', String(timeoutSeconds), path,
    process.execPath, '-e', HOLDER_SOURCE,
  ], { stdio: ['pipe', 'pipe', 'ignore'] });
  child.stdin.on('error', () => {
    // Child exit is the authoritative loss signal below.
  });

  let readyBuffer = '';
  let state = 'ACQUIRING';
  let exitOutcome = null;
  let resolveLoss;
  const lost = new Promise((resolveLost) => { resolveLoss = resolveLost; });
  const ready = new Promise((resolveReady) => {
    child.stdout.on('data', (chunk) => {
      readyBuffer += chunk.toString('utf8');
      if (readyBuffer.includes(`${READY_MARKER}\n`)) resolveReady({ kind: 'ready' });
    });
  });
  const exited = new Promise((resolveExit) => {
    child.once('error', () => {
      exitOutcome = { kind: 'error' };
      if (state === 'HELD') {
        state = 'LOST';
        resolveLoss(new ExtractionOperationLockError('operation_lock_lost'));
      }
      resolveExit(exitOutcome);
    });
    child.once('exit', (code, signal) => {
      exitOutcome = { kind: 'exit', code, signal };
      if (state === 'HELD') {
        state = 'LOST';
        resolveLoss(new ExtractionOperationLockError('operation_lock_lost'));
      }
      resolveExit(exitOutcome);
    });
  });
  const outcome = await Promise.race([ready, exited]);
  if (outcome.kind !== 'ready') {
    child.stdin.destroy();
    if (outcome.kind === 'exit' && outcome.code === 75) fail('operation_lock_busy');
    fail('operation_lock_platform_unsupported');
  }
  state = 'HELD';
  if (exitOutcome || child.exitCode !== null || child.signalCode !== null) {
    state = 'LOST';
    fail('operation_lock_lost');
  }
  let verificationHandle;
  try {
    verificationHandle = await open(path, fsConstants.O_RDWR | fsConstants.O_NOFOLLOW);
    const stat = await verificationHandle.stat();
    secureLockStat(stat);
    if (stat.dev !== stableIdentity.dev || stat.ino !== stableIdentity.ino) {
      fail('operation_lock_io_failure');
    }
  } catch (error) {
    child.kill('SIGKILL');
    if (error instanceof ExtractionOperationLockError) throw error;
    fail('operation_lock_io_failure');
  } finally {
    await verificationHandle?.close().catch(() => {});
  }

  return Object.freeze({
    path,
    stableIdentity: Object.freeze(stableIdentity),
    child,
    exited,
    lost,
    get state() { return state; },
    get exitOutcome() { return exitOutcome; },
    _setState(value) { state = value; },
    _markIdentityLost() {
      if (state === 'HELD') {
        state = 'LOST';
        resolveLoss(new ExtractionOperationLockError('operation_lock_lost'));
      }
    },
  });
}

export function assertExtractionOperationLockHeld(lock) {
  if (!lock || lock.state !== 'HELD' || lock.child?.exitCode !== null
      || lock.child?.signalCode !== null) fail('operation_lock_lost');
  try {
    const stat = lstatSync(lock.path);
    secureLockStat(stat);
    if (stat.dev !== lock.stableIdentity?.dev || stat.ino !== lock.stableIdentity?.ino) {
      throw new ExtractionOperationLockError('operation_lock_lost');
    }
  } catch {
    lock._markIdentityLost();
    lock.child?.kill('SIGKILL');
    fail('operation_lock_lost');
  }
  return true;
}

export async function releaseExtractionOperationLock(lock) {
  if (!lock) return;
  if (lock.state === 'RELEASED') return;
  if (lock.state !== 'HELD') {
    if (lock.child?.exitCode === null && lock.child?.signalCode === null) {
      lock.child.kill('SIGKILL');
      await lock.exited.catch(() => {});
    }
    fail('operation_lock_lost');
  }
  try {
    assertExtractionOperationLockHeld(lock);
  } catch (error) {
    await lock.exited.catch(() => {});
    throw error;
  }
  lock._setState('RELEASING');
  lock.child.stdin.end();
  const outcome = await lock.exited;
  if (outcome.kind !== 'exit' || outcome.code !== 0 || outcome.signal !== null) {
    fail('operation_lock_lost');
  }
  lock._setState('RELEASED');
}

export async function withExtractionOperationLock(options, operation) {
  if (typeof operation !== 'function') fail('operation_lock_io_failure');
  const lock = await acquireExtractionOperationLock(options);
  let operationError = null;
  try {
    assertExtractionOperationLockHeld(lock);
    const result = await operation(lock);
    assertExtractionOperationLockHeld(lock);
    return result;
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      await releaseExtractionOperationLock(lock);
    } catch (releaseError) {
      if (!operationError) throw releaseError;
    }
  }
}
