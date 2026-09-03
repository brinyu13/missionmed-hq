import { spawn } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
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
const SSH_ADD_BINARY = '/usr/bin/ssh-add';
const SSH_ADD_BINARY_SHA256 =
  '7480726a0626a25ef200abecf3f131c279f63d29caac418237229729f3f31974';
const RAILWAY_SSH_IDENTITY_SHA256 =
  'SHA256:1XELSoL+4coSC8deWxyjbfQcj4PiHBCk3+iKZ3BCThU';
const ROOT_CA_REMOTE_PATH = '/var/lib/postgresql/data/certs/root.crt';
const ROOT_PREFIX = 'f2-lor-dr133-ca-';
const ROOT_NAME = /^f2-lor-dr133-ca-[A-Za-z0-9_-]{6,}$/u;
const ROOT_CA_FILENAME = 'root.crt';
const VARIABLE_KEY = 'LOR_DR133_RUNTIME_DATABASE_CA';
const TARGET_CA_DER_SHA256 =
  '145916ab2b8b892314cd36178163a236b5e95d02072146fd84694483ed364d09';
const TARGET_OPENSSL_PREFIX_SHA256 =
  '5e5a255681ba14905137016cebb4237c2755da37185e1484a847dbd291f92c0d';
const MAX_CAPTURE_BYTES = 16 * 1024;
const MIN_CA_BYTES = 256;
const MAX_CA_BYTES = 16 * 1024;
const MIN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1_000;
const SAFE_PATH = '/usr/bin:/bin';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PEM = /^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/]{1,76}={0,2}\r?\n)+-----END CERTIFICATE-----\r?\n?$/u;
const PREFIX_ASSIGNMENT = /^(?:(?:export|declare\s+-x)\s+)?[A-Za-z_][A-Za-z0-9_]{1,127}\s*=/iu;
const SENSITIVE_PREFIX_WORD = /(?:^|[^A-Za-z0-9])(?:ACCESS_KEY|API_KEY|DATABASE_URL|PASSWORD|PRIVATE_KEY|RAILWAY_API_TOKEN|SECRET|TOKEN)(?:[^A-Za-z0-9]|$)/iu;
const FORBIDDEN_PREFIX_MATERIAL = /(?:https?|postgres(?:ql)?):\/\/|\/proc\/[^\s]*environ|PRIVATE KEY|BEGIN CERTIFICATE|(?:gh[opusr]|github_pat|railway|sk)-(?:[A-Za-z0-9_-]{20,})/iu;
const OPENSSL_ALGORITHM = /^[A-Za-z][A-Za-z0-9._-]{1,63}$/u;
const OPENSSL_DATE = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4} GMT$/u;
const OPENSSL_HEX = /^(?:[0-9a-f]{2}:){1,63}[0-9a-f]{2}:?$/iu;
const OPENSSL_DN = /^[A-Za-z0-9][A-Za-z0-9 .,:;_+/@()=-]{0,510}$/u;
const OPENSSL_RESERVED_HEADING = /(?:Version:|Serial Number:|Signature Algorithm:|Issuer:|Validity|Not Before:|Not After :|Subject:|Subject Public Key Info:|X509v3 extensions:|Signature Value:)/u;
const OPENSSL_EXTENSION_NAMES = new Set([
  'Authority Key Identifier', 'Basic Constraints', 'Key Usage',
  'Subject Key Identifier',
]);
const OPENSSL_KEY_USAGES = new Set([
  'Certificate Sign', 'CRL Sign', 'Data Encipherment', 'Decipher Only',
  'Digital Signature', 'Encipher Only', 'Key Agreement', 'Key Encipherment',
  'Non Repudiation',
]);
const OPTION_KEYS = new Set(['commandRunner', 'environment', 'now', 'sink']);
const RUNNER_OPTION_KEYS = new Set(['spawnProcess', 'killGraceMs', 'verifyExecutable']);
const OUTCOME_KEYS = new Set([
  'exitCode', 'stdout', 'stderrBytes', 'childStarted', 'spawnFailed', 'timedOut',
  'overflow', 'killFailed', 'closeObserved', 'uncertainChild', 'processError',
  'stdinError', 'stdoutError', 'stderrError', 'executableDrift',
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
  if (token === undefined) fail('RAILWAY_CREDENTIAL_REQUIRED');
  if (
    typeof token !== 'string'
    || token.length < 20
    || token.length > 2_048
    || /[\u0000-\u0020\u007f]/u.test(token)
  ) fail('RAILWAY_CREDENTIAL_INVALID');
  result.RAILWAY_API_TOKEN = token;
  return Object.freeze(result);
}

async function anchorSshAgentSocket(rawValue) {
  if (rawValue === undefined) fail('SSH_AGENT_REQUIRED');
  const candidate = safeAbsolutePath(rawValue, 'SSH_AGENT_SOCKET_INVALID');
  try {
    const before = await lstat(candidate, { bigint: true });
    const resolved = await realpath(candidate);
    const after = await lstat(resolved, { bigint: true });
    const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
    if (!before.isSocket() || before.isSymbolicLink() || before.nlink !== 1n
      || !after.isSocket() || after.isSymbolicLink() || after.nlink !== 1n
      || before.dev !== after.dev || before.ino !== after.ino
      || before.uid !== after.uid || (currentUid !== null && after.uid !== currentUid)) {
      fail('SSH_AGENT_SOCKET_INVALID');
    }
    return Object.freeze({
      path: resolved,
      dev: after.dev,
      ino: after.ino,
      uid: after.uid,
    });
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('SSH_AGENT_SOCKET_INVALID');
  }
}

async function verifyAnchoredSshAgentSocket(anchor) {
  try {
    const current = await lstat(anchor.path, { bigint: true });
    if (await realpath(anchor.path) !== anchor.path
      || !current.isSocket() || current.isSymbolicLink() || current.nlink !== 1n
      || current.dev !== anchor.dev || current.ino !== anchor.ino || current.uid !== anchor.uid) {
      fail('SSH_AGENT_SOCKET_INVALID');
    }
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('SSH_AGENT_SOCKET_INVALID');
  }
}

export function validateDr133SshAgentInventory(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 4_096) {
    if (Buffer.isBuffer(bytes)) bytes.fill(0);
    fail('SSH_AGENT_IDENTITY_REJECTED');
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('SSH_AGENT_IDENTITY_REJECTED');
  }
  const match = /^256 (SHA256:[A-Za-z0-9+/]{43}) ([\x21-\x7e](?:[\x20-\x7e]{0,510}[\x21-\x7e])?) \(ED25519\)\n$/u.exec(text);
  if (!match || match[1] !== RAILWAY_SSH_IDENTITY_SHA256) {
    fail('SSH_AGENT_IDENTITY_REJECTED');
  }
  return true;
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

export function createSecretSafeRailwayCommandRunner(executablePath, options = {}) {
  safeAbsolutePath(executablePath, 'RAILWAY_EXECUTABLE_INVALID');
  if (!plain(options) || Object.keys(options).some((key) => !RUNNER_OPTION_KEYS.has(key))) {
    fail('COMMAND_RUNNER_OPTIONS_INVALID');
  }
  const {
    spawnProcess = spawn,
    killGraceMs = 1_000,
    verifyExecutable = verifyStagedRailwayBinary,
  } = options;
  if (typeof spawnProcess !== 'function') fail('SPAWN_PROCESS_INVALID');
  if (typeof verifyExecutable !== 'function') fail('EXECUTABLE_VERIFIER_INVALID');
  if (!Number.isSafeInteger(killGraceMs) || killGraceMs < 10 || killGraceMs > 5_000) {
    fail('KILL_GRACE_INVALID');
  }
  return async (descriptor) => {
    assertCommandDescriptor(descriptor);
    try {
      await verifyExecutable(executablePath);
    } catch {
      return Object.freeze({
        exitCode: null,
        stdout: Buffer.alloc(0),
        stderrBytes: 0,
        childStarted: false,
        spawnFailed: true,
        timedOut: false,
        overflow: false,
        killFailed: false,
        closeObserved: false,
        uncertainChild: false,
        processError: false,
        stdinError: false,
        stdoutError: false,
        stderrError: false,
        executableDrift: true,
      });
    }
    const outcome = await new Promise((resolve) => {
      let child;
      let settled = false;
      let childStarted = false;
      let spawnFailed = false;
      let timedOut = false;
      let overflow = false;
      let killFailed = false;
      let closeObserved = false;
      let processError = false;
      let stdinError = false;
      let stdoutError = false;
      let stderrError = false;
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
          processError,
          stdinError,
          stdoutError,
          stderrError,
          executableDrift: false,
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
        child = spawnProcess(executablePath, descriptor.args, {
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
      child.stdout.once('error', () => {
        stdoutError = true;
        terminate();
      });
      child.stderr.once('error', () => {
        stderrError = true;
        terminate();
      });
      child.once('error', () => {
        processError = true;
        spawnFailed = !childStarted;
        terminate();
        if (!childStarted) finish(null, false);
      });
      child.once('close', (code) => {
        closeObserved = true;
        finish(Number.isInteger(code) ? code : null, false);
      });
      if (descriptor.stdin !== null) {
        child.stdin.once('error', () => {
          stdinError = true;
          terminate();
        });
        child.stdin.end(descriptor.stdin);
      }
      if (!settled) {
        executionTimer = setTimeout(() => {
          timedOut = true;
          terminate();
        }, descriptor.timeoutMs);
      }
    });
    try {
      await verifyExecutable(executablePath);
      return outcome;
    } catch {
      return Object.freeze({ ...outcome, executableDrift: true });
    }
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
    && outcome.processError === false
    && outcome.stdinError === false
    && outcome.stdoutError === false
    && outcome.stderrError === false
    && outcome.executableDrift === false
    && (allowStdout || outcome.stdout.length === 0);
  if (!ok) {
    outcome.stdout.fill(0);
    fail('COMMAND_FAILED_CLOSED');
  }
  return outcome.stdout;
}

export function acceptDr133VariableSetOutcome(outcome) {
  const definitelyNotStarted = exactKeys(outcome, OUTCOME_KEYS)
    && outcome.childStarted === false
    && outcome.spawnFailed === true
    && outcome.uncertainChild === false
    && outcome.closeObserved === false;
  try {
    return successfulOutcome(outcome, { allowStdout: true });
  } catch (error) {
    if (definitelyNotStarted && error instanceof Dr133RuntimeCaTransferError
      && error.code === 'COMMAND_FAILED_CLOSED') throw error;
    fail('VARIABLE_SET_OUTCOME_UNKNOWN');
  }
}

export function dr133FileSnapshotsMatch(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.uid === right.uid
    && left.gid === right.gid
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

async function verifyStagedRailwayBinary(stagedPath) {
  let handle;
  let bytes;
  try {
    if (await realpath(stagedPath) !== stagedPath) fail('RAILWAY_BINARY_STAGE_FAILED');
    const before = await lstat(stagedPath, { bigint: true });
    handle = await open(stagedPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
    if (!dr133FileSnapshotsMatch(opened, before)
      || !dr133FileSnapshotsMatch(after, opened)
      || !opened.isFile() || opened.nlink !== 1n
      || Number(opened.mode & 0o777n) !== 0o500
      || (currentUid !== null && opened.uid !== currentUid)
      || BigInt(bytes.length) !== opened.size
      || createHash('sha256').update(bytes).digest('hex') !== RAILWAY_BINARY_SHA256) {
      fail('RAILWAY_BINARY_STAGE_FAILED');
    }
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('RAILWAY_BINARY_STAGE_FAILED');
  } finally {
    bytes?.fill(0);
    await handle?.close().catch(() => undefined);
  }
}

async function stagePinnedRailwayBinary(root) {
  let bytes;
  let sourceHandle;
  let stagedWriteHandle;
  let stagedReadHandle;
  try {
    if (await realpath(RAILWAY_BINARY) !== RAILWAY_BINARY) fail('RAILWAY_BINARY_DRIFT');
    const before = await lstat(RAILWAY_BINARY, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) {
      fail('RAILWAY_BINARY_DRIFT');
    }
    if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('NOFOLLOW_UNAVAILABLE');
    sourceHandle = await open(RAILWAY_BINARY, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await sourceHandle.stat({ bigint: true });
    if (!dr133FileSnapshotsMatch(opened, before)) fail('RAILWAY_BINARY_DRIFT');
    bytes = await sourceHandle.readFile();
    const after = await sourceHandle.stat({ bigint: true });
    if (!dr133FileSnapshotsMatch(after, opened) || BigInt(bytes.length) !== opened.size) {
      fail('RAILWAY_BINARY_DRIFT');
    }
    if (createHash('sha256').update(bytes).digest('hex') !== RAILWAY_BINARY_SHA256) {
      fail('RAILWAY_BINARY_DRIFT');
    }
    const binDirectory = path.join(root, 'bin');
    const stagedPath = path.join(binDirectory, 'railway');
    await mkdir(binDirectory, { mode: 0o700 });
    if (await realpath(binDirectory) !== binDirectory) fail('RAILWAY_BINARY_STAGE_FAILED');
    stagedWriteHandle = await open(
      stagedPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o500,
    );
    await stagedWriteHandle.writeFile(bytes);
    await stagedWriteHandle.sync();
    const written = await stagedWriteHandle.stat({ bigint: true });
    if (!written.isFile() || written.nlink !== 1n || written.size !== opened.size
      || Number(written.mode & 0o777n) !== 0o500) fail('RAILWAY_BINARY_STAGE_FAILED');
    await stagedWriteHandle.close();
    stagedWriteHandle = undefined;
    if (await realpath(stagedPath) !== stagedPath) fail('RAILWAY_BINARY_STAGE_FAILED');
    stagedReadHandle = await open(stagedPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stagedBefore = await stagedReadHandle.stat({ bigint: true });
    const stagedBytes = await stagedReadHandle.readFile();
    try {
      const stagedAfter = await stagedReadHandle.stat({ bigint: true });
      const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
      if (!dr133FileSnapshotsMatch(stagedAfter, stagedBefore)
        || !stagedBefore.isFile() || stagedBefore.nlink !== 1n
        || Number(stagedBefore.mode & 0o777n) !== 0o500
        || (currentUid !== null && stagedBefore.uid !== currentUid)
        || BigInt(stagedBytes.length) !== stagedBefore.size
        || createHash('sha256').update(stagedBytes).digest('hex') !== RAILWAY_BINARY_SHA256) {
        fail('RAILWAY_BINARY_STAGE_FAILED');
      }
    } finally {
      stagedBytes.fill(0);
    }
    return stagedPath;
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('RAILWAY_BINARY_STAGE_FAILED');
  } finally {
    bytes?.fill(0);
    await sourceHandle?.close().catch(() => undefined);
    await stagedWriteHandle?.close().catch(() => undefined);
    await stagedReadHandle?.close().catch(() => undefined);
  }
}

async function verifyPinnedSshAddBinary(executablePath) {
  let handle;
  let bytes;
  try {
    if (executablePath !== SSH_ADD_BINARY || await realpath(executablePath) !== executablePath) {
      fail('SSH_AGENT_VERIFIER_DRIFT');
    }
    const before = await lstat(executablePath, { bigint: true });
    if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('NOFOLLOW_UNAVAILABLE');
    handle = await open(executablePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!dr133FileSnapshotsMatch(opened, before)
      || !dr133FileSnapshotsMatch(after, opened)
      || !opened.isFile() || opened.nlink !== 1n
      || Number(opened.mode & 0o777n) !== 0o755
      || opened.uid !== 0n || opened.gid !== 0n
      || BigInt(bytes.length) !== opened.size
      || createHash('sha256').update(bytes).digest('hex') !== SSH_ADD_BINARY_SHA256) {
      fail('SSH_AGENT_VERIFIER_DRIFT');
    }
  } catch (error) {
    if (error instanceof Dr133RuntimeCaTransferError) throw error;
    fail('SSH_AGENT_VERIFIER_DRIFT');
  } finally {
    bytes?.fill(0);
    await handle?.close().catch(() => undefined);
  }
}

async function verifyDedicatedRailwaySshAgent(anchor, cwd) {
  let inventory;
  try {
    await verifyAnchoredSshAgentSocket(anchor);
    const runner = createSecretSafeRailwayCommandRunner(SSH_ADD_BINARY, {
      verifyExecutable: verifyPinnedSshAddBinary,
    });
    const outcome = await runner(Object.freeze({
      args: ['-l', '-E', 'sha256'],
      cwd,
      env: Object.freeze({
        PATH: SAFE_PATH,
        SSH_AUTH_SOCK: anchor.path,
        LANG: 'C',
        LC_ALL: 'C',
        TERM: 'dumb',
        NO_COLOR: '1',
        CI: '1',
      }),
      stdin: null,
      timeoutMs: 5_000,
    }));
    inventory = successfulOutcome(outcome, { allowStdout: true });
    validateDr133SshAgentInventory(inventory);
    await verifyAnchoredSshAgentSocket(anchor);
  } catch {
    fail('SSH_AGENT_IDENTITY_REJECTED');
  } finally {
    inventory?.fill(0);
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

export function validateDr133VariableSetReceipt(bytes) {
  const value = parseExactJson(bytes, new Set(['keys', 'set']), 'VARIABLE_SET_OUTCOME_UNKNOWN');
  if (value.set !== true || !Array.isArray(value.keys)
    || value.keys.length !== 1 || value.keys[0] !== VARIABLE_KEY) {
    fail('VARIABLE_SET_OUTCOME_UNKNOWN');
  }
}

export function assertDr133RuntimeTargetRootCa(validated) {
  if (!plain(validated)
    || validated.sha256 !== TARGET_CA_DER_SHA256
    || validated.textPrefixSha256 !== TARGET_OPENSSL_PREFIX_SHA256) {
    fail('ROOT_CA_TARGET_MISMATCH');
  }
}

function validateOpenSslTextPrefix(prefix) {
  if (prefix === '') return true;
  if (prefix.length > 8_192
    || /[^\x0a\x0d\x20-\x7e]/u.test(prefix)
    || FORBIDDEN_PREFIX_MATERIAL.test(prefix)
    || SENSITIVE_PREFIX_WORD.test(prefix)) return false;
  const withoutCrlf = prefix.replaceAll('\r\n', '');
  if (withoutCrlf.includes('\r')
    || (prefix.includes('\r\n') && withoutCrlf.includes('\n'))) return false;
  const normalized = prefix.replaceAll('\r\n', '\n');
  if (!normalized.endsWith('\n')) return false;
  const split = normalized.split('\n');
  if (split.at(-1) !== '') return false;
  const lines = split.slice(0, -1);
  if (lines.length < 22 || lines.length > 512
    || lines.some((line) => line.length > 512
      || (line !== line.trimEnd()
        && !/^ {12}X509v3 (?:[A-Za-z][A-Za-z0-9 .()-]{1,96}|[0-9]+(?:\.[0-9]+)+): $/u.test(line))
      || /[\t{}\[\]"'`]/u.test(line)
      || PREFIX_ASSIGNMENT.test(line.trimStart()))) return false;
  let cursor = 0;
  const exact = (value) => {
    if (lines[cursor] !== value) return false;
    cursor += 1;
    return true;
  };
  const match = (expression) => {
    const result = expression.exec(lines[cursor] ?? '');
    if (!result) return null;
    cursor += 1;
    return result;
  };
  if (!exact('Certificate:') || !exact('    Data:')
    || !match(/^ {8}Version: [1-3] \(0x[0-9a-f]+\)$/iu)) return false;
  const serial = match(/^ {8}Serial Number:(?: [0-9]+ \(0x[0-9a-f]+\)| [0-9a-f:]+)?$/iu);
  if (!serial) return false;
  if (serial[0] === '        Serial Number:') {
    let serialLineCount = 0;
    while (OPENSSL_HEX.test((lines[cursor] ?? '').slice(12))
      && (lines[cursor] ?? '').startsWith('            ')) {
      cursor += 1;
      serialLineCount += 1;
    }
    if (serialLineCount === 0) return false;
  }
  const innerSignature = match(/^ {8}Signature Algorithm: ([A-Za-z][A-Za-z0-9._-]{1,63})$/u);
  const issuer = match(/^ {8}Issuer: (.+)$/u);
  if (!innerSignature || !OPENSSL_ALGORITHM.test(innerSignature[1])
    || !issuer || !OPENSSL_DN.test(issuer[1]) || OPENSSL_RESERVED_HEADING.test(issuer[1])
    || !exact('        Validity')) return false;
  const notBefore = match(/^ {12}Not Before: (.+)$/u);
  const notAfter = match(/^ {12}Not After : (.+)$/u);
  const subject = match(/^ {8}Subject: (.+)$/u);
  if (!notBefore || !OPENSSL_DATE.test(notBefore[1])
    || !notAfter || !OPENSSL_DATE.test(notAfter[1])
    || !subject || !OPENSSL_DN.test(subject[1]) || OPENSSL_RESERVED_HEADING.test(subject[1])
    || !exact('        Subject Public Key Info:')) return false;
  const publicKeyAlgorithm = match(/^ {12}Public Key Algorithm: ([A-Za-z][A-Za-z0-9._-]{1,63})$/u);
  if (!publicKeyAlgorithm) return false;
  if (publicKeyAlgorithm[1] === 'rsaEncryption') {
    if (!match(/^ {16}Public-Key: \([1-9][0-9]{2,4} bit\)$/u)
      || !exact('                Modulus:')) return false;
    let modulusLines = 0;
    while ((lines[cursor] ?? '').startsWith('                    ')
      && OPENSSL_HEX.test((lines[cursor] ?? '').slice(20))) {
      cursor += 1;
      modulusLines += 1;
    }
    if (modulusLines === 0
      || !match(/^ {16}Exponent: [1-9][0-9]{0,9} \(0x[0-9a-f]+\)$/iu)) return false;
  } else if (publicKeyAlgorithm[1] === 'id-ecPublicKey') {
    if (!match(/^ {16}Public-Key: \([1-9][0-9]{2,4} bit\)$/u)
      || !exact('                pub:')) return false;
    let publicKeyLines = 0;
    while ((lines[cursor] ?? '').startsWith('                    ')
      && OPENSSL_HEX.test((lines[cursor] ?? '').slice(20))) {
      cursor += 1;
      publicKeyLines += 1;
    }
    if (publicKeyLines === 0
      || !match(/^ {16}ASN1 OID: [A-Za-z0-9._-]{1,64}$/u)) return false;
    if ((lines[cursor] ?? '').startsWith('                NIST CURVE: ')
      && !match(/^ {16}NIST CURVE: [A-Za-z0-9._-]{1,64}$/u)) return false;
  } else {
    return false;
  }
  if (!exact('        X509v3 extensions:')) return false;
  const extensionNames = new Set();
  let basicConstraintsCaCount = 0;
  while (cursor < lines.length && !lines[cursor].startsWith('    Signature Algorithm:')) {
    const header = match(/^ {12}X509v3 ([A-Za-z][A-Za-z0-9 .()-]{1,96}|[0-9]+(?:\.[0-9]+)+):(?: critical| )?$/u);
    if (!header || (!OPENSSL_EXTENSION_NAMES.has(header[1])
      && !/^[0-9]+(?:\.[0-9]+)+$/u.test(header[1]))
      || extensionNames.has(header[1])) return false;
    extensionNames.add(header[1]);
    let valueLines = 0;
    while (cursor < lines.length
      && !lines[cursor].startsWith('            X509v3 ')
      && !lines[cursor].startsWith('    Signature Algorithm:')) {
      const value = match(/^ {16}(?: {4})?([A-Za-z0-9][A-Za-z0-9 .,:;_+/@()=-]{0,495})$/u);
      if (!value || PREFIX_ASSIGNMENT.test(value[1])
        || SENSITIVE_PREFIX_WORD.test(value[1])
        || OPENSSL_RESERVED_HEADING.test(value[1])) {
        return false;
      }
      if (header[1] === 'Basic Constraints') {
        if (!/^CA:TRUE(?:, pathlen:[0-9]+)?$/u.test(value[1])) return false;
        basicConstraintsCaCount += 1;
      } else if (header[1] === 'Key Usage') {
        const usages = value[1].split(', ');
        if (usages.length === 0 || usages.some((usage) => !OPENSSL_KEY_USAGES.has(usage))) {
          return false;
        }
      } else if (!OPENSSL_HEX.test(value[1])) {
        return false;
      }
      valueLines += 1;
    }
    if (valueLines !== 1) return false;
  }
  const outerSignature = match(/^ {4}Signature Algorithm: ([A-Za-z][A-Za-z0-9._-]{1,63})$/u);
  if (!outerSignature || outerSignature[1] !== innerSignature[1]
    || !exact('    Signature Value:')) return false;
  let signatureLines = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    const indent = line.startsWith('         ') ? 9 : line.startsWith('        ') ? 8 : 0;
    if ((indent !== 8 && indent !== 9) || !OPENSSL_HEX.test(line.slice(indent))) return false;
    cursor += 1;
    signatureLines += 1;
  }
  return signatureLines > 0 && basicConstraintsCaCount === 1;
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
  const begin = text.indexOf('-----BEGIN CERTIFICATE-----');
  const endMarker = '-----END CERTIFICATE-----';
  const end = text.indexOf(endMarker);
  if (begin < 0 || end < begin
    || text.match(/-----BEGIN CERTIFICATE-----/gu)?.length !== 1
    || text.match(/-----END CERTIFICATE-----/gu)?.length !== 1) {
    fail('ROOT_CA_REJECTED');
  }
  const prefix = text.slice(0, begin);
  const pemText = text.slice(begin, end + endMarker.length);
  const suffix = text.slice(end + endMarker.length);
  if (!PEM.test(pemText) || !/^\r?\n?$/u.test(suffix) || text.includes('PRIVATE KEY')) {
    fail('ROOT_CA_REJECTED');
  }
  if (!validateOpenSslTextPrefix(prefix)) fail('ROOT_CA_REJECTED');
  try {
    const certificate = new X509Certificate(pemText);
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
      textPrefixSha256: createHash('sha256').update(prefix).digest('hex'),
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

export function dr133RuntimeCaTransferDescriptors(localPath) {
  return Object.freeze({
    download: downloadArgs(safeAbsolutePath(localPath, 'COMMAND_CWD_INVALID')),
    variableSet: variableSetArgs(),
  });
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
    if (!dr133FileSnapshotsMatch(opened, before)) {
      fail('DOWNLOADED_FILE_CHANGED');
    }
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.length) !== opened.size || !dr133FileSnapshotsMatch(after, opened)) {
      fail('DOWNLOADED_FILE_CHANGED');
    }
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
    rootSafe = path.dirname(root) === base && ROOT_NAME.test(path.basename(root));
    if (!rootSafe) fail('TEMP_ROOT_REJECTED');
    await chmod(root, 0o700);
    const resolvedRoot = await realpath(root);
    if (resolvedRoot !== root || !ROOT_NAME.test(path.basename(root))) fail('TEMP_ROOT_REJECTED');
    const home = path.join(root, 'home');
    const downloadDirectory = path.join(root, 'download');
    await mkdir(home, { mode: 0o700 });
    await mkdir(downloadDirectory, { mode: 0o700 });
    const stagedRailwayBinary = await stagePinnedRailwayBinary(root);
    const sshAgent = commandRunner
      ? undefined : await anchorSshAgentSocket(environment.SSH_AUTH_SOCK);
    const railwayCommandRunner = commandRunner
      ?? createSecretSafeRailwayCommandRunner(stagedRailwayBinary);
    const effectiveCommandRunner = commandRunner
      ? commandRunner
      : async (descriptor) => {
        await verifyDedicatedRailwaySshAgent(sshAgent, root);
        const outcome = await railwayCommandRunner(descriptor);
        await verifyDedicatedRailwaySshAgent(sshAgent, root);
        return outcome;
      };
    const isolatedEnv = Object.freeze({
      ...env,
      HOME: home,
      TMPDIR: root,
      ...(sshAgent ? { SSH_AUTH_SOCK: sshAgent.path } : {}),
    });
    const localPath = path.join(downloadDirectory, ROOT_CA_FILENAME);
    const downloadOutcome = await effectiveCommandRunner(Object.freeze({
      args: downloadArgs(localPath), cwd: root, env: isolatedEnv, stdin: null, timeoutMs: 30_000,
    }));
    commandBytes = successfulOutcome(downloadOutcome, { allowStdout: true });
    validateDownloadReceipt(commandBytes, localPath);
    commandBytes.fill(0);
    commandBytes = undefined;
    downloadedBytes = await readDownloadedFile(localPath, downloadDirectory);
    const validated = validateDr133RuntimeRootCa(downloadedBytes, { now });
    if (sink) assertDr133RuntimeTargetRootCa(validated);
    pemBytes = validated.pemBytes;
    downloadedBytes.fill(0);
    downloadedBytes = undefined;
    if (sink) {
      if (sink === true) {
        let sinkOutcome;
        try {
          sinkOutcome = await effectiveCommandRunner(Object.freeze({
            args: variableSetArgs(), cwd: root, env: isolatedEnv,
            stdin: pemBytes, timeoutMs: 15_000,
          }));
        } catch {
          fail('VARIABLE_SET_OUTCOME_UNKNOWN');
        }
        commandBytes = acceptDr133VariableSetOutcome(sinkOutcome);
        validateDr133VariableSetReceipt(commandBytes);
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
    commandRunner: options.commandRunner,
    now: options.now ?? Date.now(),
    sink: false,
  });
}

export async function transferDr133RailwayRuntimeRootCa(rawOptions = {}) {
  const options = optionsSnapshot(rawOptions);
  return await executeTransfer({
    environment: options.environment ?? process.env,
    commandRunner: options.commandRunner,
    now: options.now ?? Date.now(),
    sink: options.sink ?? true,
  });
}
