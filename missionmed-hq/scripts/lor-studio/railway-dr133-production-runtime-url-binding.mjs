import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rm,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
} from './railway-dr133-production-runner-core.mjs';
import {
  Dr133RuntimeCaTransferError,
  acceptDr133VariableSetOutcome,
  createSecretSafeRailwayCommandRunner,
  dr133FileSnapshotsMatch,
} from './railway-dr133-production-runtime-ca-transfer.mjs';

export const DR133_RUNTIME_URL_BINDING_CONTRACT =
  'missionmed.lor.dr133-production-runtime-url-binding.v1';
export const DR133_RUNTIME_URL_VARIABLE_KEY = 'LOR_DR133_RUNTIME_DATABASE_URL';

const RAILWAY_BINARY = '/opt/homebrew/Cellar/railway/5.30.4/bin/railway';
const RAILWAY_BINARY_SHA256 =
  '6b508973c6b3f43c7926e5345a4460cef40ed22b766d0e2fcc6a498d00262684';
const ROOT_PREFIX = 'f2-lor-dr133-production-runtime-url-';
const ROOT_NAME = /^f2-lor-dr133-production-runtime-url-[A-Za-z0-9_-]{6,}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const RUNTIME_PASSWORD = /^[A-Za-z0-9_-]{43,128}$/u;
const OPTION_KEYS = new Set(['commandRunner', 'environment', 'runtimeDatabaseUrl']);
const BINDING_STATES = new Set(['NOT_ATTEMPTED', 'OUTCOME_UNKNOWN', 'PROVIDER_CONFIRMED']);
const SAFE_PATH = '/usr/bin:/bin';

export class Dr133RuntimeUrlBindingError extends Error {
  constructor(code, { bindingState = 'NOT_ATTEMPTED' } = {}) {
    super(`DR-133 runtime URL binding failed: ${code}`);
    this.name = 'Dr133RuntimeUrlBindingError';
    this.code = code;
    this.bindingState = BINDING_STATES.has(bindingState) ? bindingState : 'OUTCOME_UNKNOWN';
    this.bindingCommitted = this.bindingState !== 'NOT_ATTEMPTED';
  }
}

function fail(code, options) {
  throw new Dr133RuntimeUrlBindingError(code, options);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function safeAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)
    || value.length > 4_096 || CONTROL.test(value)) fail(code);
  return value;
}

function normalizedRuntimeUrl(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.length < 64
    || rawValue.length > 4_096 || CONTROL.test(rawValue)) {
    fail('RUNTIME_DATABASE_URL_INVALID');
  }
  let parsed;
  let username;
  let password;
  let databasePath;
  try {
    parsed = new URL(rawValue);
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
    databasePath = decodeURIComponent(parsed.pathname);
  } catch {
    fail('RUNTIME_DATABASE_URL_INVALID');
  }
  const queryKeys = [...parsed.searchParams.keys()];
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.hostname !== DR133_TARGET.databaseHost
    || parsed.port !== '5432'
    || databasePath !== `/${DR133_TARGET.databaseName}`
    || username !== DR133_RUNTIME_LOGIN
    || !RUNTIME_PASSWORD.test(password)
    || parsed.hash !== ''
    || queryKeys.length !== 1
    || queryKeys[0] !== 'sslmode'
    || parsed.searchParams.getAll('sslmode').length !== 1
    || parsed.searchParams.get('sslmode') !== 'require'
  ) fail('RUNTIME_DATABASE_URL_INVALID');
  return parsed.toString();
}

function safeEnvironment(rawEnvironment) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') fail('ENVIRONMENT_REQUIRED');
  const token = rawEnvironment.RAILWAY_API_TOKEN;
  if (typeof token !== 'string' || token.length < 20 || token.length > 2_048
    || /[\u0000-\u0020\u007f]/u.test(token)) fail('RAILWAY_CREDENTIAL_INVALID');
  return Object.freeze({
    token,
    home: safeAbsolutePath(rawEnvironment.HOME ?? homedir(), 'HOME_INVALID'),
    temporary: safeAbsolutePath(rawEnvironment.TMPDIR ?? tmpdir(), 'TMPDIR_INVALID'),
  });
}

export function dr133RuntimeUrlVariableSetArgs() {
  return Object.freeze([
    'variable', 'set', DR133_RUNTIME_URL_VARIABLE_KEY,
    '--stdin', '--skip-deploys', '--json',
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.applicationServiceId,
  ]);
}

export function validateDr133RuntimeUrlVariableSetReceipt(bytes) {
  let receipt;
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > 16_384) {
      fail('VARIABLE_SET_RECEIPT_REJECTED', { bindingState: 'OUTCOME_UNKNOWN' });
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    receipt = JSON.parse(text);
    if (!plain(receipt)
      || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(['keys', 'set'])
      || receipt.set !== true
      || !Array.isArray(receipt.keys)
      || receipt.keys.length !== 1
      || receipt.keys[0] !== DR133_RUNTIME_URL_VARIABLE_KEY) {
      fail('VARIABLE_SET_RECEIPT_REJECTED', { bindingState: 'OUTCOME_UNKNOWN' });
    }
  } catch (error) {
    if (error instanceof Dr133RuntimeUrlBindingError) throw error;
    fail('VARIABLE_SET_RECEIPT_REJECTED', { bindingState: 'OUTCOME_UNKNOWN' });
  }
  return true;
}

async function stableExecutableBytes(executablePath) {
  let handle;
  let bytes;
  try {
    if (!Number.isInteger(fsConstants.O_NOFOLLOW)
      || await realpath(executablePath) !== executablePath) fail('RAILWAY_BINARY_DRIFT');
    const before = await lstat(executablePath, { bigint: true });
    handle = await open(executablePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.isSymbolicLink() || opened.nlink !== 1n
      || !dr133FileSnapshotsMatch(before, opened)
      || !dr133FileSnapshotsMatch(opened, after)
      || BigInt(bytes.length) !== opened.size
      || createHash('sha256').update(bytes).digest('hex') !== RAILWAY_BINARY_SHA256) {
      fail('RAILWAY_BINARY_DRIFT');
    }
    return bytes;
  } catch (error) {
    bytes?.fill(0);
    if (error instanceof Dr133RuntimeUrlBindingError) throw error;
    fail('RAILWAY_BINARY_DRIFT');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function stageRailwayBinary(root) {
  let sourceBytes;
  let handle;
  try {
    sourceBytes = await stableExecutableBytes(RAILWAY_BINARY);
    const directory = path.join(root, 'bin');
    await mkdir(directory, { mode: 0o700 });
    if (await realpath(directory) !== directory) fail('RAILWAY_BINARY_STAGE_FAILED');
    const stagedPath = path.join(directory, 'railway');
    handle = await open(
      stagedPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o500,
    );
    await handle.writeFile(sourceBytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(stagedPath, 0o500);
    const stagedBytes = await stableExecutableBytes(stagedPath);
    stagedBytes.fill(0);
    return stagedPath;
  } catch (error) {
    if (error instanceof Dr133RuntimeUrlBindingError) throw error;
    fail('RAILWAY_BINARY_STAGE_FAILED');
  } finally {
    sourceBytes?.fill(0);
    await handle?.close().catch(() => undefined);
  }
}

function mapCommandError(error) {
  if (error instanceof Dr133RuntimeCaTransferError
    && error.code === 'COMMAND_FAILED_CLOSED') {
    return new Dr133RuntimeUrlBindingError('VARIABLE_SET_NOT_STARTED', {
      bindingState: 'NOT_ATTEMPTED',
    });
  }
  return new Dr133RuntimeUrlBindingError('VARIABLE_SET_OUTCOME_UNKNOWN', {
    bindingState: 'OUTCOME_UNKNOWN',
  });
}

export async function bindDr133RailwayProductionRuntimeDatabaseUrl(rawOptions = {}) {
  if (!plain(rawOptions) || Reflect.ownKeys(rawOptions).some(
    (key) => typeof key !== 'string' || !OPTION_KEYS.has(key),
  )) fail('OPTIONS_INVALID');
  const environment = safeEnvironment(rawOptions.environment ?? process.env);
  const runtimeUrl = normalizedRuntimeUrl(rawOptions.runtimeDatabaseUrl);
  let root;
  let rootSafe = false;
  let input;
  let output;
  let bindingState = 'NOT_ATTEMPTED';
  let primaryError = null;
  try {
    let commandRunner = rawOptions.commandRunner;
    let cwd = process.cwd();
    let childEnvironment = Object.freeze({
      PATH: SAFE_PATH,
      HOME: environment.home,
      TMPDIR: environment.temporary,
      LANG: 'C',
      LC_ALL: 'C',
      TZ: 'UTC',
      TERM: 'dumb',
      NO_COLOR: '1',
      CI: '1',
      RAILWAY_NO_TELEMETRY: '1',
      RAILWAY_NO_AUTO_UPDATE: '1',
      RAILWAY_API_TOKEN: environment.token,
    });
    if (commandRunner === undefined) {
      const base = await realpath(environment.temporary);
      root = await mkdtemp(path.join(base, ROOT_PREFIX));
      rootSafe = path.dirname(root) === base && ROOT_NAME.test(path.basename(root));
      if (!rootSafe) fail('TEMP_ROOT_REJECTED');
      await chmod(root, 0o700);
      if (await realpath(root) !== root) fail('TEMP_ROOT_REJECTED');
      const home = path.join(root, 'home');
      await mkdir(home, { mode: 0o700 });
      const stagedPath = await stageRailwayBinary(root);
      commandRunner = createSecretSafeRailwayCommandRunner(stagedPath);
      cwd = root;
      childEnvironment = Object.freeze({
        ...childEnvironment,
        HOME: home,
        TMPDIR: root,
      });
    }
    if (typeof commandRunner !== 'function') fail('COMMAND_RUNNER_INVALID');
    input = Buffer.from(runtimeUrl, 'utf8');
    let outcome;
    try {
      outcome = await commandRunner(Object.freeze({
        args: dr133RuntimeUrlVariableSetArgs(),
        cwd,
        env: childEnvironment,
        stdin: input,
        timeoutMs: 15_000,
      }));
      output = acceptDr133VariableSetOutcome(outcome);
      bindingState = 'OUTCOME_UNKNOWN';
      validateDr133RuntimeUrlVariableSetReceipt(output);
      bindingState = 'PROVIDER_CONFIRMED';
    } catch (error) {
      throw mapCommandError(error);
    }
  } catch (error) {
    primaryError = error instanceof Dr133RuntimeUrlBindingError
      ? error
      : new Dr133RuntimeUrlBindingError('VARIABLE_BINDING_FAILED_CLOSED', {
        bindingState,
      });
  } finally {
    input?.fill(0);
    output?.fill(0);
    if (root) {
      try {
        if (!rootSafe || !ROOT_NAME.test(path.basename(root))) fail('TEMP_ROOT_REJECTED');
        await rm(root, { recursive: true, force: false });
      } catch {
        primaryError ??= new Dr133RuntimeUrlBindingError(
          bindingState === 'PROVIDER_CONFIRMED'
            ? 'CLEANUP_FAILED_AFTER_BIND' : 'CLEANUP_FAILED',
          { bindingState },
        );
      }
    }
  }
  if (primaryError) throw primaryError;
  if (bindingState !== 'PROVIDER_CONFIRMED') {
    fail('VARIABLE_SET_UNPROVEN', { bindingState });
  }
  return Object.freeze({
    contract: DR133_RUNTIME_URL_BINDING_CONTRACT,
    result: 'RUNTIME_DATABASE_URL_STAGED_NO_DEPLOY_CONFIRMED',
    variableKey: DR133_RUNTIME_URL_VARIABLE_KEY,
  });
}
