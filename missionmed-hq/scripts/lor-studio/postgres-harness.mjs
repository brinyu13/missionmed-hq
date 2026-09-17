import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const HARNESS_SCHEMA = 'missionmed.lor.disposable-postgres-harness.v1';
const ROOT_PREFIX = 'f2lorpg-';
const ROOT_NAME_PATTERN = /^f2lorpg-[A-Za-z0-9_-]{6,}$/u;
const SQL_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{1,62}$/u;
const APPLICATION_ROLE = 'lor_studio_app';
const MAX_CAPTURE_BYTES = 64 * 1024;
const MAX_SQL_FILE_BYTES = 16 * 1024 * 1024;
const MAX_SOCKET_PATH_BYTES = 100;
const SAFE_COMMAND_PATH = '/usr/bin:/bin';

const OPTION_KEYS = new Set([
  'baseTempRoot',
  'binaries',
  'startupTimeoutMs',
  'shutdownTimeoutMs',
  'commandRunner',
]);
const BINARY_KEYS = new Set(['initdb', 'pgCtl', 'createdb', 'psql']);
const RUNNER_OPTION_KEYS = new Set(['spawnProcess', 'killGraceMs']);
const COMMAND_ENVIRONMENT_KEYS = new Set([
  'PATH',
  'LANG',
  'LC_ALL',
  'TZ',
  'PGPASSFILE',
  'PGCONNECT_TIMEOUT',
]);

export class PostgresHarnessError extends Error {
  constructor(code) {
    super(`Disposable PostgreSQL harness failed: ${code}`);
    this.name = 'PostgresHarnessError';
    this.code = code;
  }
}

function fail(code) {
  throw new PostgresHarnessError(code);
}

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertDuration(value, name) {
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    fail(`${name.toUpperCase()}_INVALID`);
  }
  return value;
}

function assertBinary(value, name) {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > 4_096
    || !path.isAbsolute(value)
    || value.includes('\0')
    || value.includes('\n')
    || value.includes('\r')
  ) {
    fail(`${name.toUpperCase()}_BINARY_INVALID`);
  }
  return value;
}

function assertBinaries(value) {
  if (!hasExactKeys(value, BINARY_KEYS)) fail('BINARY_SET_INVALID');
  return Object.freeze({
    initdb: assertBinary(value.initdb, 'initdb'),
    pgCtl: assertBinary(value.pgCtl, 'pg_ctl'),
    createdb: assertBinary(value.createdb, 'createdb'),
    psql: assertBinary(value.psql, 'psql'),
  });
}

function assertSqlIdentifier(value, name) {
  if (!SQL_IDENTIFIER_PATTERN.test(value)) fail(`${name.toUpperCase()}_INVALID`);
  return value;
}

function assertPathWithin(parent, child, name) {
  const relative = path.relative(parent, child);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`${name.toUpperCase()}_OUTSIDE_HARNESS_ROOT`);
  }
  return child;
}

function configLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sanitizedEnvironment(passfilePath) {
  return Object.freeze({
    PATH: SAFE_COMMAND_PATH,
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    PGPASSFILE: passfilePath,
    PGCONNECT_TIMEOUT: '5',
  });
}

function assertCommandDescriptor({ binary, args, cwd, env, stdin, timeoutMs }) {
  assertBinary(binary, 'command');
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) {
    fail('COMMAND_ARGUMENTS_INVALID');
  }
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) fail('COMMAND_CWD_INVALID');
  if (!hasExactKeys(env, COMMAND_ENVIRONMENT_KEYS)) fail('COMMAND_ENVIRONMENT_INVALID');
  if (
    env.PATH !== SAFE_COMMAND_PATH
    || env.LANG !== 'C'
    || env.LC_ALL !== 'C'
    || env.TZ !== 'UTC'
    || env.PGCONNECT_TIMEOUT !== '5'
    || typeof env.PGPASSFILE !== 'string'
    || !path.isAbsolute(env.PGPASSFILE)
  ) {
    fail('COMMAND_ENVIRONMENT_INVALID');
  }
  if (
    stdin !== null
    && (!Buffer.isBuffer(stdin) || stdin.length > MAX_SQL_FILE_BYTES)
  ) {
    fail('COMMAND_STDIN_INVALID');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 60_000) {
    fail('COMMAND_TIMEOUT_INVALID');
  }
}

/**
 * Shell-free bounded runner. Child output is drained and discarded so neither a
 * connection detail nor a PostgreSQL diagnostic can escape into task evidence.
 */
export function createPostgresHarnessCommandRunner(options = {}) {
  if (
    !isRecord(options)
    || Object.keys(options).some((key) => !RUNNER_OPTION_KEYS.has(key))
  ) {
    fail('COMMAND_RUNNER_OPTIONS_INVALID');
  }
  const {
    spawnProcess = spawn,
    killGraceMs = 1_000,
  } = options;
  if (typeof spawnProcess !== 'function') fail('SPAWN_PROCESS_INVALID');
  if (!Number.isSafeInteger(killGraceMs) || killGraceMs < 10 || killGraceMs > 5_000) {
    fail('KILL_GRACE_INVALID');
  }

  return async function boundedCommandRunner(descriptor) {
    assertCommandDescriptor(descriptor);
    const {
      binary,
      args,
      cwd,
      env,
      stdin,
      timeoutMs,
    } = descriptor;
    return new Promise((resolve) => {
      let settled = false;
      let capturedBytes = 0;
      let overflow = false;
      let timedOut = false;
      let childError = false;
      let killFailed = false;
      let exitObserved = false;
      let closeObserved = false;
      let executionTimer = null;
      let killTimer = null;
      let child;
      let childStarted = false;

      const finish = ({ exitCode, preSpawnFailure = false, uncertainChild = false }) => {
        if (settled) return;
        settled = true;
        if (executionTimer) clearTimeout(executionTimer);
        if (killTimer) clearTimeout(killTimer);
        resolve(Object.freeze({
          exitCode,
          preSpawnFailure,
          spawnFailed: preSpawnFailure || (!childStarted && childError),
          childStarted,
          childError,
          timedOut,
          overflow,
          killFailed,
          exitObserved,
          closeObserved,
          uncertainChild,
        }));
      };

      const requestTermination = () => {
        if (killTimer || settled || closeObserved) return;
        try {
          if (child.kill('SIGKILL') !== true) killFailed = true;
        } catch {
          killFailed = true;
        }
        killTimer = setTimeout(() => {
          finish({
            exitCode: null,
            uncertainChild: childStarted && !closeObserved,
          });
        }, killGraceMs);
      };

      try {
        child = spawnProcess(binary, args, {
          cwd,
          env,
          shell: false,
          stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        });
      } catch {
        finish({ exitCode: null, preSpawnFailure: true, uncertainChild: false });
        return;
      }
      childStarted = Number.isSafeInteger(child?.pid) && child.pid > 0;

      const drain = (chunk) => {
        capturedBytes += chunk.length;
        if (capturedBytes > MAX_CAPTURE_BYTES && !overflow) {
          overflow = true;
          requestTermination();
        }
      };
      const onChildError = () => {
        childError = true;
        if (childStarted) requestTermination();
        else finish({ exitCode: null, preSpawnFailure: true, uncertainChild: false });
      };
      try {
        child.stdout.on('data', drain);
        child.stderr.on('data', drain);
        child.once('error', onChildError);
        child.once('exit', () => {
          exitObserved = true;
        });
        child.once('close', (code) => {
          closeObserved = true;
          finish({
            exitCode: Number.isInteger(code) ? code : null,
            uncertainChild: false,
          });
        });
        if (stdin !== null) {
          child.stdin.once('error', onChildError);
          child.stdin.end(stdin);
        }
      } catch {
        childError = true;
        if (childStarted) requestTermination();
        else finish({ exitCode: null, preSpawnFailure: true, uncertainChild: false });
      }

      if (!settled) {
        executionTimer = setTimeout(() => {
          timedOut = true;
          requestTermination();
        }, timeoutMs);
      }
    });
  };
}

const defaultCommandRunner = createPostgresHarnessCommandRunner();

function commandSucceeded(outcome) {
  return isRecord(outcome)
    && outcome.exitCode === 0
    && outcome.preSpawnFailure === false
    && outcome.spawnFailed === false
    && outcome.childStarted === true
    && outcome.childError === false
    && outcome.timedOut === false
    && outcome.overflow === false
    && outcome.killFailed === false
    && outcome.exitObserved === true
    && outcome.closeObserved === true
    && outcome.uncertainChild === false;
}

function commandOutcomeValid(outcome) {
  if (!isRecord(outcome)) return false;
  const booleanKeys = [
    'preSpawnFailure',
    'spawnFailed',
    'childStarted',
    'childError',
    'timedOut',
    'overflow',
    'killFailed',
    'exitObserved',
    'closeObserved',
    'uncertainChild',
  ];
  return (outcome.exitCode === null || Number.isInteger(outcome.exitCode))
    && booleanKeys.every((key) => typeof outcome[key] === 'boolean');
}

function unknownCommandOutcome() {
  return Object.freeze({
    exitCode: null,
    preSpawnFailure: false,
    spawnFailed: false,
    childStarted: true,
    childError: true,
    timedOut: false,
    overflow: false,
    killFailed: false,
    exitObserved: false,
    closeObserved: false,
    uncertainChild: true,
  });
}

function entropySuffix() {
  return randomBytes(10).toString('hex');
}

async function readStableSqlBytes(filePath) {
  let pathStat;
  try {
    pathStat = await lstat(filePath, { bigint: true });
  } catch {
    fail('SQL_FILE_UNAVAILABLE');
  }
  if (!pathStat.isFile() || pathStat.isSymbolicLink()) fail('SQL_FILE_UNSAFE');
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('SQL_NOFOLLOW_UNAVAILABLE');

  let source;
  try {
    source = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch {
    fail('SQL_FILE_UNAVAILABLE');
  }

  let readFailed = false;
  let readError = undefined;
  let bytes;
  try {
    const before = await source.stat({ bigint: true });
    if (!before.isFile()) fail('SQL_FILE_UNSAFE');
    if (
      before.dev !== pathStat.dev
      || before.ino !== pathStat.ino
      || before.size !== pathStat.size
      || before.mtimeNs !== pathStat.mtimeNs
      || before.ctimeNs !== pathStat.ctimeNs
    ) {
      fail('SQL_FILE_CHANGED_DURING_SNAPSHOT');
    }
    if (before.size > BigInt(MAX_SQL_FILE_BYTES)) fail('SQL_FILE_TOO_LARGE');
    const expectedLength = Number(before.size);
    bytes = Buffer.alloc(expectedLength);
    let offset = 0;
    while (offset < expectedLength) {
      const { bytesRead } = await source.read(
        bytes,
        offset,
        expectedLength - offset,
        offset,
      );
      if (bytesRead === 0) fail('SQL_FILE_CHANGED_DURING_SNAPSHOT');
      offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    const { bytesRead: extraBytes } = await source.read(extra, 0, 1, expectedLength);
    const after = await source.stat({ bigint: true });
    if (
      extraBytes !== 0
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
    ) {
      fail('SQL_FILE_CHANGED_DURING_SNAPSHOT');
    }
  } catch (error) {
    readFailed = true;
    readError = error;
  }

  let closeFailed = false;
  try {
    await source.close();
  } catch {
    closeFailed = true;
  }
  if (readFailed) throw readError;
  if (closeFailed) fail('SQL_FILE_CLOSE_FAILED');
  return bytes;
}

async function appendStableRegularFile(filePath, bytes, name) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) fail(`${name}_BYTES_INVALID`);
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail(`${name}_NOFOLLOW_UNAVAILABLE`);

  let pathStat;
  try {
    pathStat = await lstat(filePath, { bigint: true });
  } catch {
    fail(`${name}_UNAVAILABLE`);
  }
  if (!pathStat.isFile() || pathStat.isSymbolicLink() || pathStat.nlink !== 1n) {
    fail(`${name}_UNSAFE`);
  }

  let target;
  try {
    target = await open(
      filePath,
      fsConstants.O_WRONLY | fsConstants.O_APPEND | fsConstants.O_NOFOLLOW,
    );
  } catch {
    fail(`${name}_UNAVAILABLE`);
  }

  let operationError;
  let after;
  try {
    const before = await target.stat({ bigint: true });
    if (
      !before.isFile()
      || before.nlink !== 1n
      || before.dev !== pathStat.dev
      || before.ino !== pathStat.ino
      || before.size !== pathStat.size
    ) {
      fail(`${name}_IDENTITY_MISMATCH`);
    }
    await target.writeFile(bytes);
    await target.sync();
    after = await target.stat({ bigint: true });
    if (
      !after.isFile()
      || after.nlink !== 1n
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size + BigInt(bytes.length)
    ) {
      fail(`${name}_WRITE_UNPROVEN`);
    }
  } catch (error) {
    operationError = error;
  }

  let closeFailed = false;
  try {
    await target.close();
  } catch {
    closeFailed = true;
  }
  if (operationError) throw operationError;
  if (closeFailed) fail(`${name}_CLOSE_FAILED`);

  let finalPathStat;
  try {
    finalPathStat = await lstat(filePath, { bigint: true });
  } catch {
    fail(`${name}_UNAVAILABLE`);
  }
  if (
    !finalPathStat.isFile()
    || finalPathStat.isSymbolicLink()
    || finalPathStat.nlink !== 1n
    || finalPathStat.dev !== after.dev
    || finalPathStat.ino !== after.ino
    || finalPathStat.size !== after.size
  ) {
    fail(`${name}_IDENTITY_MISMATCH`);
  }
}

function postgresConfiguration({ socketDirectory, port }) {
  return `
# F2-LOR-1012 disposable synthetic harness. Removed with the exact harness root.
listen_addresses = ''
unix_socket_directories = ${configLiteral(socketDirectory)}
unix_socket_permissions = 0700
port = ${port}
max_connections = 10
fsync = off
synchronous_commit = off
full_page_writes = off
logging_collector = off
log_connections = off
log_disconnections = off
log_statement = 'none'
`;
}

class DisposablePostgresHarness {
  constructor(options) {
    if (!hasExactKeys(options, OPTION_KEYS)) fail('HARNESS_OPTIONS_UNRECOGNIZED');
    if (typeof options.baseTempRoot !== 'string' || !path.isAbsolute(options.baseTempRoot)) {
      fail('BASE_TEMP_ROOT_INVALID');
    }
    if (typeof options.commandRunner !== 'function') fail('COMMAND_RUNNER_REQUIRED');
    this.baseTempRoot = options.baseTempRoot;
    this.binaries = assertBinaries(options.binaries);
    this.startupTimeoutMs = assertDuration(options.startupTimeoutMs, 'startup_timeout');
    this.shutdownTimeoutMs = assertDuration(options.shutdownTimeoutMs, 'shutdown_timeout');
    this.commandRunner = options.commandRunner;
    this.state = 'new';
    this.childUncertain = false;
    this.rootCandidate = null;
    this.paths = null;
    this.identity = null;
    this.targetIdentities = {
      dataDirectory: null,
      socketDirectory: null,
      logFile: null,
    };
    this.serverStarted = false;
    this.startAttempted = false;
  }

  async #invoke(binary, args, {
    timeoutMs = this.startupTimeoutMs,
    env,
    stdin = null,
  } = {}) {
    let outcome;
    try {
      outcome = await this.commandRunner(Object.freeze({
        binary,
        args: Object.freeze([...args]),
        cwd: this.paths?.root ?? this.identity?.baseReal ?? this.baseTempRoot,
        env: env ?? sanitizedEnvironment(this.paths?.disabledPassfile ?? '/dev/null'),
        stdin: stdin === null ? null : Buffer.from(stdin),
        timeoutMs,
      }));
    } catch {
      outcome = unknownCommandOutcome();
    }
    if (!commandOutcomeValid(outcome)) outcome = unknownCommandOutcome();
    if (outcome.uncertainChild) this.childUncertain = true;
    return outcome;
  }

  async #runChecked(binary, args, code, options) {
    const outcome = await this.#invoke(binary, args, options);
    if (outcome.uncertainChild) fail(`${code}_CHILD_UNCERTAIN_ROOT_PRESERVED`);
    if (!commandSucceeded(outcome)) fail(code);
  }

  async #resolveBaseRoot() {
    let baseReal;
    let baseStat;
    const allowedRoots = new Set();
    try {
      baseReal = await realpath(this.baseTempRoot);
      baseStat = await lstat(baseReal);
      allowedRoots.add(await realpath(tmpdir()));
      allowedRoots.add(await realpath('/tmp'));
    } catch {
      fail('BASE_TEMP_ROOT_UNAVAILABLE');
    }
    if (!baseStat.isDirectory() || baseStat.isSymbolicLink() || baseReal === path.parse(baseReal).root) {
      fail('BASE_TEMP_ROOT_UNSAFE');
    }
    const insideTemporaryStorage = [...allowedRoots].some((allowedRoot) => {
      const relative = path.relative(allowedRoot, baseReal);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
    if (!insideTemporaryStorage) fail('BASE_TEMP_ROOT_NOT_TEMPORARY');
    this.identity = { baseReal };
  }

  async #verifyToolchain() {
    const timeoutMs = Math.min(this.startupTimeoutMs, 10_000);
    for (const binary of Object.values(this.binaries)) {
      const outcome = await this.#invoke(binary, ['--version'], {
        timeoutMs,
        env: sanitizedEnvironment('/dev/null'),
      });
      if (!commandSucceeded(outcome)) fail('POSTGRES_TOOLCHAIN_UNAVAILABLE');
    }
  }

  async #createRoot() {
    const root = await mkdtemp(path.join(this.identity.baseReal, ROOT_PREFIX));
    this.rootCandidate = root;
    const rootReal = await realpath(root);
    const rootStat = await lstat(rootReal);
    if (
      path.dirname(rootReal) !== this.identity.baseReal
      || !ROOT_NAME_PATTERN.test(path.basename(rootReal))
      || !rootStat.isDirectory()
      || rootStat.isSymbolicLink()
    ) {
      fail('HARNESS_ROOT_UNSAFE');
    }
    const dataDirectory = assertPathWithin(rootReal, path.join(rootReal, 'd'), 'data_directory');
    const socketDirectory = assertPathWithin(rootReal, path.join(rootReal, 's'), 'socket_directory');
    const logPath = assertPathWithin(rootReal, path.join(rootReal, 'postgres.log'), 'log');
    const disabledPassfile = assertPathWithin(
      rootReal,
      path.join(rootReal, '.pgpass-disabled'),
      'passfile',
    );
    this.paths = Object.freeze({
      root: rootReal,
      dataDirectory,
      socketDirectory,
      logPath,
      disabledPassfile,
    });
    this.identity = Object.freeze({
      ...this.identity,
      rootDev: rootStat.dev,
      rootIno: rootStat.ino,
    });
    await chmod(rootReal, 0o700);
    await mkdir(socketDirectory, { mode: 0o700 });
    await writeFile(disabledPassfile, '', { mode: 0o600, flag: 'wx' });
    await writeFile(logPath, '', { mode: 0o600, flag: 'wx' });
    this.targetIdentities.socketDirectory = await this.#captureOwnedDirectory(
      socketDirectory,
      'SOCKET_DIRECTORY',
    );
    this.targetIdentities.logFile = await this.#captureOwnedFile(logPath, 'LOG_FILE');
  }

  async #assertOwnedRoot() {
    if (!this.paths || !this.identity) fail('HARNESS_ROOT_NOT_CREATED');
    let rootReal;
    let rootStat;
    try {
      rootReal = await realpath(this.paths.root);
      rootStat = await lstat(this.paths.root);
    } catch {
      fail('HARNESS_ROOT_MISSING');
    }
    if (
      rootReal !== this.paths.root
      || path.dirname(rootReal) !== this.identity.baseReal
      || !ROOT_NAME_PATTERN.test(path.basename(rootReal))
      || !rootStat.isDirectory()
      || rootStat.isSymbolicLink()
      || (rootStat.mode & 0o777) !== 0o700
      || rootStat.dev !== this.identity.rootDev
      || rootStat.ino !== this.identity.rootIno
    ) {
      fail('HARNESS_ROOT_IDENTITY_MISMATCH');
    }
  }

  async #cleanupRoot() {
    await this.#assertOwnedRoot();
    await rm(this.paths.root, { recursive: true, force: false, maxRetries: 0 });
    this.rootCandidate = null;
  }

  async #captureOwnedDirectory(directoryPath, name) {
    await this.#assertOwnedRoot();
    let directoryReal;
    let directoryStat;
    try {
      directoryReal = await realpath(directoryPath);
      directoryStat = await lstat(directoryPath);
    } catch {
      fail(`${name}_UNAVAILABLE`);
    }
    assertPathWithin(this.paths.root, directoryReal, name);
    if (
      directoryReal !== directoryPath
      || !directoryStat.isDirectory()
      || directoryStat.isSymbolicLink()
      || (directoryStat.mode & 0o777) !== 0o700
    ) {
      fail(`${name}_UNSAFE`);
    }
    return Object.freeze({
      path: directoryPath,
      dev: directoryStat.dev,
      ino: directoryStat.ino,
    });
  }

  async #assertOwnedDirectory(identity, name) {
    if (!identity) fail(`${name}_IDENTITY_MISSING`);
    await this.#assertOwnedRoot();
    let directoryReal;
    let directoryStat;
    try {
      directoryReal = await realpath(identity.path);
      directoryStat = await lstat(identity.path);
    } catch {
      fail(`${name}_UNAVAILABLE`);
    }
    assertPathWithin(this.paths.root, directoryReal, name);
    if (
      directoryReal !== identity.path
      || !directoryStat.isDirectory()
      || directoryStat.isSymbolicLink()
      || (directoryStat.mode & 0o777) !== 0o700
      || directoryStat.dev !== identity.dev
      || directoryStat.ino !== identity.ino
    ) {
      fail(`${name}_IDENTITY_MISMATCH`);
    }
  }

  async #captureOwnedFile(filePath, name) {
    await this.#assertOwnedRoot();
    let fileReal;
    let fileStat;
    try {
      fileReal = await realpath(filePath);
      fileStat = await lstat(filePath);
    } catch {
      fail(`${name}_UNAVAILABLE`);
    }
    assertPathWithin(this.paths.root, fileReal, name);
    if (
      fileReal !== filePath
      || !fileStat.isFile()
      || fileStat.isSymbolicLink()
      || fileStat.nlink !== 1
      || (fileStat.mode & 0o777) !== 0o600
    ) {
      fail(`${name}_UNSAFE`);
    }
    return Object.freeze({
      path: filePath,
      dev: fileStat.dev,
      ino: fileStat.ino,
    });
  }

  async #assertOwnedFile(identity, name) {
    if (!identity) fail(`${name}_IDENTITY_MISSING`);
    const observed = await this.#captureOwnedFile(identity.path, name);
    if (observed.dev !== identity.dev || observed.ino !== identity.ino) {
      fail(`${name}_IDENTITY_MISMATCH`);
    }
  }

  async #assertRuntimeTargets() {
    await this.#assertOwnedDirectory(
      this.targetIdentities.dataDirectory,
      'DATA_DIRECTORY',
    );
    await this.#assertOwnedDirectory(
      this.targetIdentities.socketDirectory,
      'SOCKET_DIRECTORY',
    );
    await this.#assertOwnedFile(this.targetIdentities.logFile, 'LOG_FILE');
  }

  async #assertInitdbTargets() {
    await this.#assertOwnedDirectory(
      this.targetIdentities.socketDirectory,
      'SOCKET_DIRECTORY',
    );
    try {
      await lstat(this.paths.dataDirectory);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      fail('DATA_DIRECTORY_STATE_UNPROVEN');
    }
    fail('DATA_DIRECTORY_PREEXISTING');
  }

  async #stopServer(mode) {
    await this.#assertRuntimeTargets();
    const seconds = String(Math.max(1, Math.ceil(this.shutdownTimeoutMs / 1_000)));
    const outcome = await this.#invoke(this.binaries.pgCtl, [
      'stop',
      '-D',
      this.paths.dataDirectory,
      '-m',
      mode,
      '-w',
      '-t',
      seconds,
    ], { timeoutMs: this.shutdownTimeoutMs });
    if (commandSucceeded(outcome)) {
      this.serverStarted = false;
      return true;
    }
    return false;
  }

  async #containStartFailure() {
    const preserveForUncertainChild = this.childUncertain;
    if (!this.paths) return this.rootCandidate === null && !preserveForUncertainChild;
    if (this.startAttempted) {
      const stopped = await this.#stopServer('immediate');
      if (!stopped) return false;
    }
    if (preserveForUncertainChild || this.childUncertain) return false;
    await this.#cleanupRoot();
    return true;
  }

  async start() {
    if (this.state !== 'new') fail('HARNESS_LIFECYCLE_ALREADY_STARTED');
    this.state = 'starting';
    try {
      await this.#resolveBaseRoot();
      await this.#verifyToolchain();
      await this.#createRoot();

      const suffix = entropySuffix();
      const adminRole = assertSqlIdentifier(`lorh_admin_${suffix}`, 'admin_role');
      const database = assertSqlIdentifier(`lorh_db_${suffix}`, 'database');
      const port = 20_000 + randomBytes(2).readUInt16BE(0) % 40_000;
      const socketFile = path.join(this.paths.socketDirectory, `.s.PGSQL.${port}`);
      if (Buffer.byteLength(socketFile, 'utf8') > MAX_SOCKET_PATH_BYTES) {
        fail('UNIX_SOCKET_PATH_TOO_LONG');
      }
      this.runtime = Object.freeze({ adminRole, database, port });

      await this.#assertInitdbTargets();
      await this.#runChecked(this.binaries.initdb, [
        '--pgdata',
        this.paths.dataDirectory,
        '--username',
        adminRole,
        '--auth-local=trust',
        '--auth-host=reject',
        '--encoding=UTF8',
        '--locale=C',
        '--no-instructions',
      ], 'INITDB_FAILED');
      this.targetIdentities.dataDirectory = await this.#captureOwnedDirectory(
        this.paths.dataDirectory,
        'DATA_DIRECTORY',
      );
      await this.#assertRuntimeTargets();
      await appendStableRegularFile(
        path.join(this.paths.dataDirectory, 'postgresql.conf'),
        Buffer.from(
          postgresConfiguration({ socketDirectory: this.paths.socketDirectory, port }),
          'utf8',
        ),
        'POSTGRES_CONFIGURATION',
      );

      this.startAttempted = true;
      await this.#assertRuntimeTargets();
      const seconds = String(Math.max(1, Math.ceil(this.startupTimeoutMs / 1_000)));
      await this.#runChecked(this.binaries.pgCtl, [
        'start',
        '-D',
        this.paths.dataDirectory,
        '-l',
        this.paths.logPath,
        '-w',
        '-t',
        seconds,
      ], 'POSTGRES_START_FAILED');
      this.serverStarted = true;

      await this.#assertRuntimeTargets();
      await this.#runChecked(this.binaries.createdb, [
        '--host',
        this.paths.socketDirectory,
        '--port',
        String(port),
        '--username',
        adminRole,
        '--maintenance-db=postgres',
        database,
      ], 'DATABASE_CREATE_FAILED');

      this.state = 'running';
      return this.describe();
    } catch {
      const contained = await this.#containStartFailure().catch(() => false);
      this.state = contained ? 'stopped' : 'failed_unclean';
      if (!contained) fail('START_FAILED_CLEANUP_UNPROVEN');
      fail('START_FAILED_CONTAINED');
    }
  }

  describe() {
    if (this.state !== 'running' || !this.runtime || !this.paths) fail('HARNESS_NOT_RUNNING');
    return Object.freeze({
      schemaVersion: HARNESS_SCHEMA,
      lifecycle: 'running',
      syntheticOnly: true,
      externallyReachable: false,
      transport: 'unix_socket_only',
      tempRoot: this.paths.root,
      socketDirectory: this.paths.socketDirectory,
      port: this.runtime.port,
      database: this.runtime.database,
      administrativeRole: this.runtime.adminRole,
      applicationRole: APPLICATION_ROLE,
    });
  }

  connectionOptions(options = undefined) {
    if (this.state !== 'running') fail('HARNESS_NOT_RUNNING');
    if (options !== undefined) fail('CONNECTION_OPTIONS_INVALID');
    return Object.freeze({
      host: this.paths.socketDirectory,
      port: this.runtime.port,
      database: this.runtime.database,
      user: this.runtime.adminRole,
    });
  }

  async applySqlFile(filePath) {
    if (this.state !== 'running') fail('HARNESS_NOT_RUNNING');
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) fail('SQL_FILE_PATH_INVALID');
    try {
      await this.#assertRuntimeTargets();
    } catch {
      this.state = 'failed_unclean';
      fail('APPLY_TARGET_IDENTITY_MISMATCH_ROOT_PRESERVED');
    }
    const sqlBytes = await readStableSqlBytes(filePath);
    await this.#assertOwnedRoot();
    const snapshotPath = assertPathWithin(
      this.paths.root,
      path.join(this.paths.root, `migration-${entropySuffix()}.sql`),
      'sql_snapshot',
    );
    await writeFile(snapshotPath, sqlBytes, { mode: 0o600, flag: 'wx' });
    await chmod(snapshotPath, 0o400);
    await this.#assertOwnedRoot();
    const snapshotStat = await lstat(snapshotPath);
    if (
      !snapshotStat.isFile()
      || snapshotStat.isSymbolicLink()
      || (snapshotStat.mode & 0o777) !== 0o400
    ) {
      fail('SQL_SNAPSHOT_UNSAFE');
    }
    try {
      await this.#assertRuntimeTargets();
    } catch {
      this.state = 'failed_unclean';
      fail('APPLY_TARGET_IDENTITY_MISMATCH_ROOT_PRESERVED');
    }
    await this.#runChecked(this.binaries.psql, [
      '-X',
      '--no-password',
      '--set',
      'ON_ERROR_STOP=1',
      '--host',
      this.paths.socketDirectory,
      '--port',
      String(this.runtime.port),
      '--username',
      this.runtime.adminRole,
      '--dbname',
      this.runtime.database,
      '--file',
      '-',
    ], 'SQL_FILE_APPLY_FAILED', { stdin: sqlBytes });
    return Object.freeze({ applied: true, syntheticLocalOnly: true });
  }

  async stop() {
    if (this.state === 'stopped') {
      return Object.freeze({ stopped: true, cleaned: true, alreadyStopped: true });
    }
    if (this.state !== 'running') fail('HARNESS_NOT_RUNNING');
    this.state = 'stopping';
    let stopped;
    try {
      stopped = await this.#stopServer('fast');
      if (!stopped) stopped = await this.#stopServer('immediate');
    } catch {
      this.state = 'failed_unclean';
      fail('SHUTDOWN_TARGET_IDENTITY_MISMATCH_ROOT_PRESERVED');
    }
    if (!stopped) {
      this.state = 'failed_unclean';
      fail('SHUTDOWN_UNPROVEN_ROOT_PRESERVED');
    }
    if (this.childUncertain) {
      this.state = 'failed_unclean';
      fail('CHILD_UNCERTAIN_ROOT_PRESERVED');
    }
    try {
      await this.#cleanupRoot();
    } catch {
      this.state = 'failed_unclean';
      fail('CLEANUP_FAILED_ROOT_PRESERVED');
    }
    this.state = 'stopped';
    return Object.freeze({ stopped: true, cleaned: true, alreadyStopped: false });
  }
}

/**
 * Create, but do not start, a disposable PostgreSQL harness.
 *
 * There is deliberately no connection-string, existing-data-directory, host,
 * user, password, or cluster option. Callers supply reviewed absolute paths for
 * the four PostgreSQL executables; all identities and data paths are generated
 * inside one validated temporary root. The harness can only start that new
 * cluster, snapshot and apply reviewed SQL, return its socket-only descriptor,
 * and stop it.
 */
export function createDisposablePostgresHarness(options = {}) {
  if (!isRecord(options) || Object.keys(options).some((key) => !OPTION_KEYS.has(key))) {
    fail('HARNESS_OPTIONS_UNRECOGNIZED');
  }
  const {
    baseTempRoot = tmpdir(),
    binaries,
    startupTimeoutMs = 20_000,
    shutdownTimeoutMs = 10_000,
    commandRunner = defaultCommandRunner,
  } = options;
  return new DisposablePostgresHarness({
    baseTempRoot,
    binaries,
    startupTimeoutMs,
    shutdownTimeoutMs,
    commandRunner,
  });
}

export const POSTGRES_HARNESS_CONTRACT = Object.freeze({
  schemaVersion: HARNESS_SCHEMA,
  data: 'synthetic_non_identifying_only',
  transport: 'unix_socket_only_under_validated_temp_root',
  externalTargets: 'prohibited',
  existingClusters: 'prohibited_no_input_surface',
  connectionStrings: 'prohibited_no_input_surface',
  credentials: 'none_local_socket_trust_inside_mode_0700_root',
  uniqueIdentities: ['tempRoot', 'administrativeRole', 'database'],
  binaries: 'required_absolute_paths',
  applicationRole: APPLICATION_ROLE,
  poolLoginRole: 'unique_harness_admin_then_transaction_set_local_role',
  startup: 'bounded_initdb_pg_ctl_createdb',
  sqlFiles: 'absolute_regular_non_symlink_files_only',
  sqlExecution: 'stable_descriptor_bytes_to_bounded_psql_stdin_plus_private_mode_0400_snapshot',
  shutdown: 'bounded_fast_then_immediate',
  cleanup: 'realpath_parent_prefix_inode_and_device_validated_before_recursive_remove',
  commandTargets: 'root_data_and_socket_inode_device_verified_immediately_before_use',
  commandOutput: 'bounded_drained_and_discarded',
  commandReaping: 'success_only_after_close_uncertain_child_preserves_root',
});
