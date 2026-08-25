import { spawn } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  unlink,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { DR133_TARGET } from './railway-dr133-runner-core.mjs';

export const DR133_RUNTIME_CA_TRANSFER_CONTRACT =
  'missionmed.lor.dr133-runtime-ca-transfer.v1';

const RAILWAY_BINARY = '/opt/homebrew/Cellar/railway/5.30.4/bin/railway';
const RAILWAY_BINARY_SHA256 =
  '6b508973c6b3f43c7926e5345a4460cef40ed22b766d0e2fcc6a498d00262684';
const ROOT_CA_REMOTE_PATH = '/var/lib/postgresql/data/certs/root.crt';
const ROOT_PREFIX = 'f2-lor-dr133-ca-';
const ROOT_NAME = /^f2-lor-dr133-ca-[A-Za-z0-9_-]{6,}$/u;
const ROOT_CA_FILENAME = 'root.crt';
const VARIABLE_KEY = 'LOR_DR133_RUNTIME_DATABASE_CA';
const MAX_CAPTURE_BYTES = 16 * 1024;
const MIN_CA_BYTES = 256;
const MAX_CA_BYTES = 16 * 1024;
const MIN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1_000;
const SAFE_PATH = '/usr/bin:/bin';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PEM = /^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/]{1,76}={0,2}\r?\n)+-----END CERTIFICATE-----\r?\n?$/u;
const OPTION_KEYS = new Set(['commandRunner', 'environment', 'now', 'sink']);
const RUNNER_OPTION_KEYS = new Set(['spawnProcess', 'killGraceMs']);
const OUTCOME_KEYS = new Set([
  'exitCode', 'stdout', 'stderrBytes', 'childStarted', 'spawnFailed', 'timedOut',
  'overflow', 'killFailed', 'closeObserved', 'uncertainChild',
]);

export class Dr133RuntimeCaTransferError extends Error {
  constructor(code) {
    super(`DR-133 runtime CA transfer failed: ${code}`);
    this.name = 'Dr133RuntimeCaTransferError';
    this.code = code;
  }
}

function fail(code) {
  throw new Dr133RuntimeCaTransferError(code);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  return plain(value)
    && Reflect.ownKeys(value).every((key) => typeof key === 'string' && expected.has(key))
    && Reflect.ownKeys(value).length === expected.size;
}

function safeAbsolutePath(value, code) {
  if (
    typeof value !== 'string'
    || !path.isAbsolute(value)
    || value.length > 4_096
    || /[\u0000\r\n]/u.test(value)
  ) fail(code);
  return value;
}

function safeEnvironment(rawEnvironment) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') fail('ENVIRONMENT_REQUIRED');
  const home = safeAbsolutePath(rawEnvironment.HOME ?? homedir(), 'HOME_INVALID');
  const temporary = safeAbsolutePath(rawEnvironment.TMPDIR ?? tmpdir(), 'TMPDIR_INVALID');
  const result = {
    PATH: SAFE_PATH,
    HOME: home,
    TMPDIR: temporary,
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: '1',
    DO_NOT_TRACK: '1',
    RAILWAY_NO_TELEMETRY: '1',
    RAILWAY_NO_AUTO_UPDATE: '1',
  };
  const token = rawEnvironment.RAILWAY_API_TOKEN;
  if (token !== undefined) {
    if (
      typeof token !== 'string'
      || token.length < 20
      || token.length > 2_048
      || /[\u0000-\u0020\u007f]/u.test(token)
    ) fail('RAILWAY_CREDENTIAL_INVALID');
    result.RAILWAY_API_TOKEN = token;
  }
  return Object.freeze(result);
}

function assertCommandDescriptor(descriptor) {
  if (!plain(descriptor)) fail('COMMAND_DESCRIPTOR_INVALID');
  const keys = new Set(['args', 'cwd', 'env', 'stdin', 'timeoutMs']);
  if (!exactKeys(descriptor, keys)) fail('COMMAND_DESCRIPTOR_INVALID');
  if (
    !Array.isArray(descriptor.args)
    || descriptor.args.length < 1
    || descriptor.args.some((entry) => typeof entry !== 'string' || /[\u0000\r\n]/u.test(entry))
  ) fail('COMMAND_ARGUMENTS_INVALID');
  safeAbsolutePath(descriptor.cwd, 'COMMAND_CWD_INVALID');
  if (!plain(descriptor.env)) fail('COMMAND_ENVIRONMENT_INVALID');
  if (descriptor.stdin !== null && !Buffer.isBuffer(descriptor.stdin)) {
    fail('COMMAND_STDIN_INVALID');
  }
  if (!Number.isSafeInteger(descriptor.timeoutMs) || descriptor.timeoutMs < 1_000
    || descriptor.timeoutMs > 30_000) fail('COMMAND_TIMEOUT_INVALID');
}

export function createSecretSafeRailwayCommandRunner(options = {}) {
  if (!plain(options) || Object.keys(options).some((key) => !RUNNER_OPTION_KEYS.has(key))) {
    fail('COMMAND_RUNNER_OPTIONS_INVALID');
  }
  const { spawnProcess = spawn, killGraceMs = 1_000 } = options;
  if (typeof spawnProcess !== 'function') fail('SPAWN_PROCESS_INVALID');
  if (!Number.isSafeInteger(killGraceMs) || killGraceMs < 10 || killGraceMs > 5_000) {
    fail('KILL_GRACE_INVALID');
  }
  return async (descriptor) => {
    assertCommandDescriptor(descriptor);
    return await new Promise((resolve) => {
      let child;
      let settled = false;
      let childStarted = false;
      let spawnFailed = false;
      let timedOut = false;
      let overflow = false;
      let killFailed = false;
      let closeObserved = false;
      let stderrBytes = 0;
      let stdoutBytes = 0;
      const stdout = [];
      let executionTimer;
      let killTimer;

      const finish = (exitCode, uncertainChild = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(executionTimer);
        clearTimeout(killTimer);
        const bytes = Buffer.concat(stdout);
        for (const chunk of stdout) chunk.fill(0);
        resolve(Object.freeze({
          exitCode,
          stdout: bytes,
          stderrBytes,
          childStarted,
          spawnFailed,
          timedOut,
          overflow,
          killFailed,
          closeObserved,
          uncertainChild,
        }));
      };
      const terminate = () => {
        if (settled || closeObserved || killTimer) return;
        try {
          if (child.kill('SIGKILL') !== true) killFailed = true;
        } catch {
          killFailed = true;
        }
        killTimer = setTimeout(() => finish(null, childStarted && !closeObserved), killGraceMs);
      };
      try {
        child = spawnProcess(RAILWAY_BINARY, descriptor.args, {
          cwd: descriptor.cwd,
          env: descriptor.env,
          shell: false,
          stdio: [descriptor.stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        });
        childStarted = Number.isSafeInteger(child?.pid) && child.pid > 0;
      } catch {
        spawnFailed = true;
        finish(null, false);
        return;
      }
      const captureStdout = (value) => {
        const chunk = Buffer.from(value);
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_CAPTURE_BYTES) {
          chunk.fill(0);
          overflow = true;
          terminate();
          return;
        }
        stdout.push(chunk);
      };
      const discardStderr = (value) => {
        stderrBytes += Buffer.byteLength(value);
        if (stderrBytes > MAX_CAPTURE_BYTES) {
          overflow = true;
          terminate();
        }
      };
      child.stdout.on('data', captureStdout);
      child.stderr.on('data', discardStderr);
      child.once('error', () => {
        spawnFailed = !childStarted;
        terminate();
        if (!childStarted) finish(null, false);
      });
      child.once('close', (code) => {
        closeObserved = true;
        finish(Number.isInteger(code) ? code : null, false);
      });
      if (descriptor.stdin !== null) {
        child.stdin.once('error', () => terminate());
        child.stdin.end(descriptor.stdin);
      }
      executionTimer = setTimeout(() => {
        timedOut = true;
        terminate();
      }, descriptor.timeoutMs);
    });
  };
}

function successfulOutcome(outcome, { allowStdout }) {
  if (!exactKeys(outcome, OUTCOME_KEYS) || !Buffer.isBuffer(outcome.stdout)) {
    if (Buffer.isBuffer(outcome?.stdout)) outcome.stdout.fill(0);
    fail('COMMAND_OUTCOME_INVALID');
  }
  const ok = outcome.exitCode === 0
    && outcome.stderrBytes === 0
    && outcome.childStarted === true
    && outcome.spawnFailed === false
    && outcome.timedOut === false
    && outcome.overflow === false
    && outcome.killFailed === false
    && outcome.closeObserved === true
    && outcome.uncertainChild === false
    && (allowStdout || outcome.stdout.length === 0);
  if (!ok) {
    outcome.stdout.fill(0);
    fail('COMMAND_FAILED_CLOSED');
  }
  return outcome.stdout;
}

async function assertPinnedRailwayBinary() {
  let bytes;
  try {
    if (await realpath(RAILWAY_BINARY) !== RAILWAY_BINARY) fail('RAILWAY_BINARY_DRIFT');
    const stat = await lstat(RAILWAY_BINARY);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('RAILWAY_BINARY_DRIFT');
    bytes = await readFile(RAILWAY_BINARY);
    if (createHash('sha256').update(bytes).digest('hex') !== RAILWAY_BINARY_SHA256) {
      fail('RAILWAY_BINARY_DRIFT');
    }
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('RAILWAY_BINARY_DRIFT');
  } finally {
    bytes?.fill(0);
  }
}

function parseExactJson(bytes, expectedKeys, code) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail(code);
  }
  if (!exactKeys(value, expectedKeys)) fail(code);
  return value;
}

function validateDownloadReceipt(bytes, localPath) {
  const value = parseExactJson(
    bytes,
    new Set(['localPath', 'overwritten', 'remotePath', 'service', 'serviceInstanceId']),
    'DOWNLOAD_RECEIPT_REJECTED',
  );
  if (
    value.localPath !== localPath
    || value.overwritten !== false
    || value.remotePath !== ROOT_CA_REMOTE_PATH
    || !exactKeys(value.service, new Set(['id', 'name']))
    || value.service.id !== DR133_TARGET.databaseServiceId
    || value.service.name !== 'Postgres'
    || typeof value.serviceInstanceId !== 'string'
    || !UUID.test(value.serviceInstanceId)
  ) fail('DOWNLOAD_RECEIPT_REJECTED');
}

function validateVariableReceipt(bytes) {
  const value = parseExactJson(bytes, new Set(['keys', 'set']), 'VARIABLE_SET_OUTCOME_UNKNOWN');
  if (value.set !== true || !Array.isArray(value.keys)
    || value.keys.length !== 1 || value.keys[0] !== VARIABLE_KEY) {
    fail('VARIABLE_SET_OUTCOME_UNKNOWN');
  }
}

export function validateDr133RuntimeRootCa(bytes, { now = Date.now() } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length < MIN_CA_BYTES || bytes.length > MAX_CA_BYTES
    || !Number.isFinite(now)) fail('ROOT_CA_REJECTED');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('ROOT_CA_REJECTED');
  }
  if (!PEM.test(text) || text.includes('PRIVATE KEY')
    || text.match(/-----BEGIN CERTIFICATE-----/gu)?.length !== 1
    || text.match(/-----END CERTIFICATE-----/gu)?.length !== 1) {
    fail('ROOT_CA_REJECTED');
  }
  try {
    const certificate = new X509Certificate(text);
    const validFrom = Date.parse(certificate.validFrom);
    const validTo = Date.parse(certificate.validTo);
    if (certificate.ca !== true || !certificate.checkIssued(certificate)
      || !certificate.verify(certificate.publicKey)
      || !(validFrom <= now && now < validTo)
      || validTo - now < MIN_VALIDITY_MS) fail('ROOT_CA_REJECTED');
    const pemBytes = Buffer.from(certificate.toString(), 'ascii');
    return Object.freeze({
      pemBytes,
      sha256: createHash('sha256').update(certificate.raw).digest('hex'),
      validFrom: new Date(validFrom).toISOString(),
      validTo: new Date(validTo).toISOString(),
    });
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('ROOT_CA_REJECTED');
  }
}

function downloadArgs(localPath) {
  return Object.freeze([
    'service', 'files',
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.databaseServiceId,
    'download', ROOT_CA_REMOTE_PATH, localPath,
    '--concurrency', '1', '--json',
  ]);
}

function variableSetArgs() {
  return Object.freeze([
    'variable', 'set', VARIABLE_KEY, '--stdin', '--skip-deploys', '--json',
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.executionServiceId,
  ]);
}

async function readDownloadedFile(localPath, downloadDirectory) {
  let handle;
  let bytes;
  try {
    const before = await lstat(localPath, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
      || before.size < BigInt(MIN_CA_BYTES) || before.size > BigInt(MAX_CA_BYTES)) {
      fail('DOWNLOADED_FILE_REJECTED');
    }
    if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('NOFOLLOW_UNAVAILABLE');
    handle = await open(localPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size
      || opened.mtimeNs !== before.mtimeNs || opened.ctimeNs !== before.ctimeNs) {
      fail('DOWNLOADED_FILE_CHANGED');
    }
    bytes = await handle.readFile();
    if (BigInt(bytes.length) !== opened.size) fail('DOWNLOADED_FILE_CHANGED');
    await unlink(localPath);
    const entries = await readdir(downloadDirectory);
    if (entries.length !== 0) fail('DOWNLOAD_DIRECTORY_NOT_EMPTY');
    return bytes;
  } catch (error) {
    bytes?.fill(0);
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('DOWNLOADED_FILE_REJECTED');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function executeTransfer({ environment, commandRunner, now, sink }) {
  await assertPinnedRailwayBinary();
  const env = safeEnvironment(environment);
  let base;
  try {
    base = await realpath(safeAbsolutePath(env.TMPDIR, 'TMPDIR_INVALID'));
  } catch {
    fail('TMPDIR_INVALID');
  }
  const root = await mkdtemp(path.join(base, ROOT_PREFIX));
  let rootSafe = false;
  let downloadedBytes;
  let pemBytes;
  let commandBytes;
  let operationError;
  let result;
  try {
    await chmod(root, 0o700);
    const resolvedRoot = await realpath(root);
    if (resolvedRoot !== root || !ROOT_NAME.test(path.basename(root))) fail('TEMP_ROOT_REJECTED');
    rootSafe = true;
    const home = path.join(root, 'home');
    const downloadDirectory = path.join(root, 'download');
    await mkdir(home, { mode: 0o700 });
    await mkdir(downloadDirectory, { mode: 0o700 });
    const isolatedEnv = Object.freeze({ ...env, TMPDIR: root });
    const localPath = path.join(downloadDirectory, ROOT_CA_FILENAME);
    const downloadOutcome = await commandRunner(Object.freeze({
      args: downloadArgs(localPath), cwd: root, env: isolatedEnv, stdin: null, timeoutMs: 30_000,
    }));
    commandBytes = successfulOutcome(downloadOutcome, { allowStdout: true });
    validateDownloadReceipt(commandBytes, localPath);
    commandBytes.fill(0);
    commandBytes = undefined;
    downloadedBytes = await readDownloadedFile(localPath, downloadDirectory);
    const validated = validateDr133RuntimeRootCa(downloadedBytes, { now });
    pemBytes = validated.pemBytes;
    downloadedBytes.fill(0);
    downloadedBytes = undefined;
    if (sink) {
      if (sink === true) {
        const sinkOutcome = await commandRunner(Object.freeze({
          args: variableSetArgs(), cwd: root, env: isolatedEnv,
          stdin: pemBytes, timeoutMs: 15_000,
        }));
        commandBytes = successfulOutcome(sinkOutcome, { allowStdout: true });
        validateVariableReceipt(commandBytes);
      } else if (typeof sink === 'function') {
        const sinkBytes = Buffer.from(pemBytes);
        try {
          await sink(sinkBytes);
        } finally {
          sinkBytes.fill(0);
        }
      } else {
        fail('SINK_INVALID');
      }
    }
    result = Object.freeze({
      contract: DR133_RUNTIME_CA_TRANSFER_CONTRACT,
      result: sink ? 'ROOT_CA_BOUND_VERIFIED' : 'ROOT_CA_INSPECTED_VERIFIED',
      sha256: validated.sha256,
      validTo: validated.validTo,
      transport: 'railway-service-files-sftp',
      shellUsed: false,
    });
  } catch (error) {
    operationError = error instanceof Dr133RuntimeCaTransferError
      ? error : new Dr133RuntimeCaTransferError('TRANSFER_FAILED_CLOSED');
  } finally {
    commandBytes?.fill(0);
    downloadedBytes?.fill(0);
    pemBytes?.fill(0);
    try {
      if (!rootSafe) fail('TEMP_ROOT_REJECTED');
      await rm(root, { recursive: true, force: false });
    } catch {
      if (!operationError) operationError = new Dr133RuntimeCaTransferError(
        sink ? 'CLEANUP_FAILED_AFTER_BIND' : 'CLEANUP_FAILED',
      );
    }
  }
  if (operationError) throw operationError;
  return result;
}

function optionsSnapshot(value) {
  if (!plain(value) || Reflect.ownKeys(value).some(
    (key) => typeof key !== 'string' || !OPTION_KEYS.has(key),
  )) fail('OPTIONS_INVALID');
  return { ...value };
}

export async function inspectDr133RailwayRuntimeRootCa(rawOptions = {}) {
  const options = optionsSnapshot(rawOptions);
  if (Object.hasOwn(options, 'sink')) fail('INSPECT_SINK_FORBIDDEN');
  return await executeTransfer({
    environment: options.environment ?? process.env,
    commandRunner: options.commandRunner ?? createSecretSafeRailwayCommandRunner(),
    now: options.now ?? Date.now(),
    sink: false,
  });
}

export async function transferDr133RailwayRuntimeRootCa(rawOptions = {}) {
  const options = optionsSnapshot(rawOptions);
  return await executeTransfer({
    environment: options.environment ?? process.env,
    commandRunner: options.commandRunner ?? createSecretSafeRailwayCommandRunner(),
    now: options.now ?? Date.now(),
    sink: options.sink ?? true,
  });
}
