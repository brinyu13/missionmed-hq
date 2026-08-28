import { createHash } from 'node:crypto';
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
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  verifiedDr133DatabaseCa,
} from './railway-dr133-production-runner-core.mjs';
import {
  createSecretSafeRailwayCommandRunner,
  dr133FileSnapshotsMatch,
} from './railway-dr133-production-runtime-ca-transfer.mjs';
import {
  normalizeDr133ProductionProviderRuntimeUrl,
} from './run-dr133-railway-production-service-operation.mjs';

export const DR133_RELEASE_ORCHESTRATOR_CONTRACT =
  'missionmed.lor.railway-dr133-production-release-orchestrator.v1';
export const DR133_RELEASE_VARIABLE_EXPECTATION_SCHEMA =
  'missionmed.lor.railway-dr133-production-release-variable-expectations.v1';
export const DR133_RELEASE_VARIABLE_PROBE_CONTRACT =
  'missionmed.lor.railway-dr133-production-release-variable-probe.v1';

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const GIT_ROOT = path.resolve(MODULE_DIRECTORY, '..', '..', '..');
const OPENAI_PRODUCTION_PROJECT_ID = 'proj_UTCDEhLVMT6aQnCXnBElihZT';
const PRODUCTION_ORIGIN = 'https://missionmed-hq-production.up.railway.app';
const HEALTH_URL = `${PRODUCTION_ORIGIN}/health`;
const LOR_READINESS_URL = `${PRODUCTION_ORIGIN}/health/lor-studio`;
const DARK_CONTAINMENT_URL = `${PRODUCTION_ORIGIN}/api/lor-studio/auth/candidate/start`;
const DARK_CONTAINMENT_PROBES = Object.freeze([
  Object.freeze({ method: 'GET', path: '/api/lor-studio/auth/start' }),
  Object.freeze({ method: 'GET', path: '/api/lor-studio/auth/callback' }),
  Object.freeze({ method: 'POST', path: '/api/lor-studio/auth/logout' }),
  Object.freeze({ method: 'POST', path: '/api/lor-studio/auth/candidate/start' }),
  Object.freeze({ method: 'GET', path: '/lor-studio' }),
  Object.freeze({ method: 'GET', path: '/lor-studio/' }),
  Object.freeze({ method: 'GET', path: '/lor-studio/index.html' }),
]);
const REMOTE_PROBE_PATH =
  'missionmed-hq/scripts/lor-studio/run-dr133-railway-production-release-variable-probe.mjs';
const REMOTE_NODE_BINARY = '/usr/local/bin/node';
const RAILWAY_DASHBOARD_ORIGIN = 'https://railway.com';

const RAILWAY_BINARY = '/opt/homebrew/Cellar/railway/5.30.4/bin/railway';
const RAILWAY_BINARY_SHA256 =
  '6b508973c6b3f43c7926e5345a4460cef40ed22b766d0e2fcc6a498d00262684';
const GIT_BINARY = '/Library/Developer/CommandLineTools/usr/bin/git';
const GIT_BINARY_SHA256 =
  'be4afb2b003904725826250de9fb76567bbacf82323457b5a1ec26706b66bcae';
const TAR_BINARY = '/usr/bin/bsdtar';
const TAR_BINARY_SHA256 =
  'bdccb76a715fbebc4915a1a1b1de0e7050ad842ebb730c47935b3a22c13e3af9';

const RELEASE_ARCHIVE_PATHS = Object.freeze([
  '.railwayignore',
  'missionmed-hq',
  'package-lock.json',
  'package.json',
  'railway.json',
]);
const ROOT_PREFIX = 'f2-lor-dr133-release-';
const ROOT_NAME = /^f2-lor-dr133-release-[A-Za-z0-9_-]{6,}$/u;
const ARCHIVE_FILENAME = 'custody.tar';
const STAGE_DIRECTORY_NAME = 'stage';
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const DEPLOYMENT_STATUSES = new Set([
  'BUILDING', 'CRASHED', 'DEPLOYING', 'FAILED', 'INITIALIZING', 'QUEUED',
  'REMOVED', 'REMOVING', 'SKIPPED', 'SLEEPING', 'SUCCESS', 'WAITING',
]);
const TERMINAL_FAILURE_STATUSES = new Set(['CRASHED', 'FAILED', 'REMOVED', 'REMOVING', 'SKIPPED']);
const SAFE_PATH = '/usr/bin:/bin';
const MAX_STDIN_BYTES = 64 * 1_024;
const MAX_EXPECTATION_BYTES = 16 * 1_024;
const MAX_HTTP_BODY_BYTES = 4 * 1_024;
const COMMAND_TIMEOUT_MS = 30_000;
const QUERY_TIMEOUT_MS = 20_000;
const DEPLOYMENT_WAIT_MS = 10 * 60 * 1_000;
const DEPLOYMENT_POLL_MS = 2_000;
const HTTP_TIMEOUT_MS = 10_000;

const LIST_DEPLOYMENTS_DOCUMENT = [
  'query LorReleaseDeployments($input: DeploymentListInput!) {',
  '  deployments(input: $input, first: 50) {',
  '    edges { node { id status createdAt canRollback } }',
  '  }',
  '}',
].join(' ');
const ROLLBACK_DOCUMENT = [
  'mutation LorReleaseRollback($id: String!) {',
  '  deploymentRollback(id: $id) { id }',
  '}',
].join(' ');
const REDEPLOY_DOCUMENT = [
  'mutation LorReleaseRedeploy($id: String!) {',
  '  deploymentRedeploy(id: $id) { id }',
  '}',
].join(' ');

const TARGET_EXACT_VALUES = Object.freeze({
  MMHQ_LOR_STUDIO_TARGET_SCHEMA_VERSION: 'missionmed.lor.target-binding.v2',
  MMHQ_LOR_STUDIO_TARGET_RATIFIED: 'true',
  MMHQ_LOR_STUDIO_TARGET_DECISION_RECORD: DR133_TARGET.decisionRecord,
  MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT: DR133_TARGET.deploymentEnvironment,
  MMHQ_LOR_STUDIO_TARGET_PROVIDER: DR133_TARGET.provider,
  MMHQ_LOR_STUDIO_TARGET_PROJECT_ID: DR133_TARGET.projectId,
  MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_ID: DR133_TARGET.environmentId,
  MMHQ_LOR_STUDIO_TARGET_SERVICE_ID: DR133_TARGET.databaseServiceId,
  MMHQ_LOR_STUDIO_TARGET_DATABASE_NAME: DR133_TARGET.databaseName,
  MMHQ_LOR_STUDIO_TARGET_REGION: DR133_TARGET.region,
  MMHQ_LOR_STUDIO_TARGET_SCHEMA: 'lor_studio',
  MMHQ_LOR_STUDIO_TARGET_MIGRATION_LEDGER: DR133_TARGET.migrationLedger,
  MMHQ_LOR_STUDIO_TARGET_PROVIDER_RESOURCE_BOUND: 'true',
  MMHQ_LOR_STUDIO_TARGET_INDEPENDENTLY_VERIFIED: 'true',
  MMHQ_LOR_STUDIO_TARGET_HEALTH: 'ready',
  MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_BOUND: 'true',
  MMHQ_LOR_STUDIO_TARGET_DATA_COPIED: DR133_TARGET.dataCopied,
  MMHQ_LOR_STUDIO_TARGET_PRODUCTION_DATA_BINDING_PASSED: 'true',
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_SCHEMA_VERSION:
    'missionmed.lor.production-runtime-target.v1',
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_EXECUTION_SERVICE_ID: DR133_TARGET.applicationServiceId,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_HOST: DR133_TARGET.databaseHost,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_ADMIN: DR133_TARGET.databaseAdmin,
  MMHQ_LOR_STUDIO_RUNTIME_TARGET_LOGIN: DR133_RUNTIME_LOGIN,
});

const PROOF_TRUE_KEYS = Object.freeze([
  'MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED',
  'MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND',
]);

const RELEASE_VARIABLE_KEYS_INTERNAL = Object.freeze([
  'LOR_DR133_RUNTIME_DATABASE_CA',
  'LOR_DR133_RUNTIME_DATABASE_URL',
  'MMHQ_LOR_INVITATION_HMAC_KEY',
  'MMHQ_LOR_INVITATION_HMAC_KEY_VERSION',
  'MMHQ_LOR_INVITATION_ORIGIN',
  ...PROOF_TRUE_KEYS.filter((key) => key.startsWith('MMHQ_LOR_INVITATION_')),
  'MMHQ_LOR_OPENAI_API_KEY',
  'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL',
  'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64',
  'MMHQ_LOR_OPENAI_PROJECT_ID',
  'MMHQ_LOR_POSTMARK_FROM_EMAIL',
  'MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL',
  'MMHQ_LOR_POSTMARK_SERVER_ID',
  'MMHQ_LOR_POSTMARK_SERVER_TOKEN',
  ...PROOF_TRUE_KEYS.filter((key) => key.startsWith('MMHQ_LOR_POSTMARK_')),
  'MMHQ_LOR_PRIVATE_STORAGE_IDENTITY',
  'MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64',
  'MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION',
  ...PROOF_TRUE_KEYS.filter((key) => key.startsWith('MMHQ_LOR_PRIVATE_STORAGE_')),
  'MMHQ_LOR_RELEASE_COMMIT',
  'MMHQ_LOR_RESTORE_PROOF_BASE64URL',
  'MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64',
  'MMHQ_LOR_STUDIO_ENABLED',
  'MMHQ_LOR_STUDIO_KILL_SWITCH',
  'MMHQ_LOR_STUDIO_REQUIRE_CANARY',
  ...Object.keys(TARGET_EXACT_VALUES),
].sort());

if (new Set(RELEASE_VARIABLE_KEYS_INTERNAL).size !== RELEASE_VARIABLE_KEYS_INTERNAL.length) {
  throw new Error('DR-133 release variable inventory contains duplicates');
}

export const DR133_RELEASE_VARIABLE_KEYS = RELEASE_VARIABLE_KEYS_INTERNAL;

const RELEASE_VARIABLE_KEY_SET = new Set(DR133_RELEASE_VARIABLE_KEYS);
const FLAG_KEYS = new Set([
  'MMHQ_LOR_STUDIO_ENABLED',
  'MMHQ_LOR_STUDIO_KILL_SWITCH',
  'MMHQ_LOR_STUDIO_REQUIRE_CANARY',
]);
const SECRET_KEYS = new Set([
  'LOR_DR133_RUNTIME_DATABASE_CA',
  'LOR_DR133_RUNTIME_DATABASE_URL',
  'MMHQ_LOR_INVITATION_HMAC_KEY',
  'MMHQ_LOR_OPENAI_API_KEY',
  'MMHQ_LOR_POSTMARK_SERVER_TOKEN',
  'MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64',
  'MMHQ_LOR_RESTORE_PROOF_BASE64URL',
]);
const OUTCOME_KEYS = new Set([
  'exitCode', 'stdout', 'stderrBytes', 'childStarted', 'spawnFailed', 'timedOut',
  'overflow', 'killFailed', 'closeObserved', 'uncertainChild', 'processError',
  'stdinError', 'stdoutError', 'stderrError', 'executableDrift',
]);
const ORCHESTRATOR_DEPENDENCY_KEYS = new Set([
  'clock', 'commandRunner', 'createArchive', 'fetchImplementation', 'sleep',
]);
const OPERATIONS = new Set([
  'activate-canary',
  'activate-rollout',
  'bind-variable',
  'capture-preimage',
  'deploy-dark',
  'inspect-variable',
  'rollback-redeploy',
  'verify-bindings',
  'verify-dark',
]);

export class Dr133ProductionReleaseError extends Error {
  constructor(code, { mutationState = 'NOT_ATTEMPTED' } = {}) {
    super(`DR-133 production release operation failed: ${code}`);
    this.name = 'Dr133ProductionReleaseError';
    this.code = code;
    this.mutationState = mutationState;
  }
}

function fail(code, options) {
  throw new Dr133ProductionReleaseError(code, options);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function ownDataProperties(value) {
  return plain(value) && Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => Object.hasOwn(descriptor, 'value'),
  );
}

function exactKeys(value, expected) {
  return ownDataProperties(value)
    && Reflect.ownKeys(value).length === expected.size
    && Reflect.ownKeys(value).every(
      (key) => typeof key === 'string' && expected.has(key),
    );
}

function safeAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)
    || value.length > 4_096 || CONTROL.test(value)) fail(code);
  return value;
}

function exactUuid(value, code = 'DEPLOYMENT_ID_INVALID', options) {
  if (typeof value !== 'string' || !UUID.test(value)) fail(code, options);
  return value;
}

function exactSha(value, code = 'SHA256_INVALID') {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(code);
  return value;
}

function exactCommit(value) {
  if (typeof value !== 'string' || !COMMIT.test(value)) fail('SOURCE_COMMIT_INVALID');
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function variableValueSha256(key, bytes) {
  return createHash('sha256')
    .update(`${DR133_RELEASE_VARIABLE_EXPECTATION_SCHEMA}\0${key}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

export const dr133ReleaseVariableValueSha256 = variableValueSha256;

function strictString(bytes, { allowEmpty = false, maximum = MAX_STDIN_BYTES } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length > maximum || (!allowEmpty && bytes.length === 0)) {
    fail('VARIABLE_VALUE_INVALID');
  }
  let value;
  try {
    value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('VARIABLE_VALUE_INVALID');
  }
  if (Buffer.byteLength(value, 'utf8') !== bytes.length || value.includes('\u0000')) {
    fail('VARIABLE_VALUE_INVALID');
  }
  return value;
}

function validBase64(value, byteLength) {
  if (!BASE64.test(value) || value.length % 4 !== 0) return false;
  let bytes;
  try {
    bytes = Buffer.from(value, 'base64');
    return bytes.length === byteLength && bytes.toString('base64') === value;
  } catch {
    return false;
  } finally {
    bytes?.fill(0);
  }
}

function validEncodedBytes(value, { encoding, maximumLength, pattern }) {
  if (value.length > maximumLength || !pattern.test(value)
    || (encoding === 'base64' && value.length % 4 !== 0)) return false;
  let bytes;
  try {
    bytes = Buffer.from(value, encoding);
    return bytes.length > 0 && bytes.toString(encoding) === value;
  } catch {
    return false;
  } finally {
    bytes?.fill(0);
  }
}

function validEmail(value, { optional = false } = {}) {
  if (optional && value === '') return true;
  return /^(?=.{3,320}$)[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(value)
    && value.normalize('NFKC').toLowerCase() === value;
}

function validHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.pathname === '/' && url.search === ''
      && url.hash === '' && url.username === '' && url.password === ''
      && url.origin === value;
  } catch {
    return false;
  }
}

function assertVariableTextShape(key, value) {
  const exact = TARGET_EXACT_VALUES[key];
  if (exact !== undefined) {
    if (value !== exact) fail('VARIABLE_VALUE_SHAPE_INVALID');
    return;
  }
  if (PROOF_TRUE_KEYS.includes(key)) {
    if (value !== 'true') fail('VARIABLE_VALUE_SHAPE_INVALID');
    return;
  }
  if (FLAG_KEYS.has(key)) {
    if (!['true', 'false'].includes(value)) fail('VARIABLE_VALUE_SHAPE_INVALID');
    return;
  }
  switch (key) {
    case 'LOR_DR133_RUNTIME_DATABASE_CA':
      try { verifiedDr133DatabaseCa(value); } catch { fail('VARIABLE_VALUE_SHAPE_INVALID'); }
      return;
    case 'LOR_DR133_RUNTIME_DATABASE_URL':
      if (!normalizeDr133ProductionProviderRuntimeUrl(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_OPENAI_API_KEY':
    case 'MMHQ_LOR_POSTMARK_SERVER_TOKEN':
      if (value.length < 16 || value.length > 4_096 || value.trim() !== value || /\s/u.test(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_OPENAI_PROJECT_ID':
      if (value !== OPENAI_PRODUCTION_PROJECT_ID) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_RELEASE_COMMIT':
      if (!COMMIT.test(value)) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL':
      if (!validEncodedBytes(value, {
        encoding: 'base64url', maximumLength: 32 * 1_024, pattern: BASE64URL,
      })) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64':
      if (!validEncodedBytes(value, {
        encoding: 'base64', maximumLength: 2 * 1_024, pattern: BASE64,
      })) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_POSTMARK_SERVER_ID':
      if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u.test(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_POSTMARK_FROM_EMAIL':
      if (!validEmail(value)) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL':
      if (!validEmail(value, { optional: true })) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_INVITATION_ORIGIN':
      if (!validHttpsOrigin(value)) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_INVITATION_HMAC_KEY': {
      if (!/^[A-Za-z0-9_-]{43,342}$/u.test(value)) fail('VARIABLE_VALUE_SHAPE_INVALID');
      let bytes;
      try {
        bytes = Buffer.from(value, 'base64url');
        if (bytes.length < 32 || bytes.length > 256 || bytes.toString('base64url') !== value) {
          fail('VARIABLE_VALUE_SHAPE_INVALID');
        }
      } finally {
        bytes?.fill(0);
      }
      return;
    }
    case 'MMHQ_LOR_INVITATION_HMAC_KEY_VERSION':
      if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/u.test(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64':
      if (!validBase64(value, 32)) fail('VARIABLE_VALUE_SHAPE_INVALID');
      return;
    case 'MMHQ_LOR_PRIVATE_STORAGE_IDENTITY':
      if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$/u.test(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION':
      if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/u.test(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_RESTORE_PROOF_BASE64URL':
      if (value.length > 64 * 1_024 || !BASE64URL.test(value)) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    case 'MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64':
      if (value.length > 2 * 1_024 || !BASE64.test(value) || value.length % 4 !== 0) {
        fail('VARIABLE_VALUE_SHAPE_INVALID');
      }
      return;
    default:
      fail('VARIABLE_KEY_NOT_ALLOWED');
  }
}

export function inspectDr133ReleaseVariableValue(key, rawBytes) {
  if (typeof key !== 'string' || !RELEASE_VARIABLE_KEY_SET.has(key)) {
    fail('VARIABLE_KEY_NOT_ALLOWED');
  }
  if (!Buffer.isBuffer(rawBytes)) fail('VARIABLE_VALUE_INVALID');
  const bytes = rawBytes;
  const value = strictString(bytes, {
    allowEmpty: key === 'MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL',
  });
  assertVariableTextShape(key, value);
  return Object.freeze({
    key,
    byteLength: bytes.length,
    valueSha256: variableValueSha256(key, bytes),
    secret: SECRET_KEYS.has(key),
  });
}

function validatedExpectationEntries(rawEntries) {
  if (!Array.isArray(rawEntries) || rawEntries.length !== DR133_RELEASE_VARIABLE_KEYS.length) {
    fail('VARIABLE_EXPECTATIONS_INCOMPLETE');
  }
  const entries = rawEntries.map((raw, index) => {
    if (!exactKeys(raw, new Set(['key', 'sha256']))) fail('VARIABLE_EXPECTATION_INVALID');
    const key = DR133_RELEASE_VARIABLE_KEYS[index];
    if (raw.key !== key) fail('VARIABLE_EXPECTATION_ORDER_INVALID');
    return Object.freeze({ key, sha256: exactSha(raw.sha256, 'VARIABLE_EXPECTATION_HASH_INVALID') });
  });
  return Object.freeze(entries);
}

export function createDr133ReleaseVariableExpectationManifest(rawEntries) {
  const variables = validatedExpectationEntries(rawEntries);
  const manifest = Object.freeze({
    schemaVersion: DR133_RELEASE_VARIABLE_EXPECTATION_SCHEMA,
    variables,
  });
  return Object.freeze({
    manifest,
    manifestSha256: sha256(canonicalJson(manifest)),
    encoded: Buffer.from(canonicalJson(manifest), 'utf8').toString('base64url'),
  });
}

export function parseDr133ReleaseVariableExpectationManifest(encoded) {
  if (typeof encoded !== 'string' || encoded.length < 16
    || encoded.length > MAX_EXPECTATION_BYTES * 2 || !BASE64URL.test(encoded)) {
    fail('VARIABLE_EXPECTATION_ENCODING_INVALID');
  }
  let bytes;
  try {
    bytes = Buffer.from(encoded, 'base64url');
    if (bytes.length < 2 || bytes.length > MAX_EXPECTATION_BYTES
      || bytes.toString('base64url') !== encoded) fail('VARIABLE_EXPECTATION_ENCODING_INVALID');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    let raw;
    try { raw = JSON.parse(text); } catch { fail('VARIABLE_EXPECTATION_JSON_INVALID'); }
    if (!exactKeys(raw, new Set(['schemaVersion', 'variables']))
      || raw.schemaVersion !== DR133_RELEASE_VARIABLE_EXPECTATION_SCHEMA) {
      fail('VARIABLE_EXPECTATION_INVALID');
    }
    const created = createDr133ReleaseVariableExpectationManifest(raw.variables);
    if (canonicalJson(created.manifest) !== text || created.encoded !== encoded) {
      fail('VARIABLE_EXPECTATION_NOT_CANONICAL');
    }
    return created;
  } catch (error) {
    if (error instanceof Dr133ProductionReleaseError) throw error;
    fail('VARIABLE_EXPECTATION_ENCODING_INVALID');
  } finally {
    bytes?.fill(0);
  }
}

function expectationMap(parsed) {
  return new Map(parsed.manifest.variables.map((entry) => [entry.key, entry.sha256]));
}

function assertReleaseCommitExpectation(parsed, releaseCommit) {
  const key = 'MMHQ_LOR_RELEASE_COMMIT';
  const bytes = Buffer.from(releaseCommit, 'utf8');
  try {
    if (expectationMap(parsed).get(key) !== variableValueSha256(key, bytes)) {
      fail('RELEASE_COMMIT_EXPECTATION_INVALID');
    }
  } finally {
    bytes.fill(0);
  }
}

function assertDarkFlagExpectations(parsed) {
  const expected = expectationMap(parsed);
  for (const [key, value] of [
    ['MMHQ_LOR_STUDIO_ENABLED', 'false'],
    ['MMHQ_LOR_STUDIO_KILL_SWITCH', 'true'],
    ['MMHQ_LOR_STUDIO_REQUIRE_CANARY', 'true'],
  ]) {
    const bytes = Buffer.from(value, 'utf8');
    try {
      if (expected.get(key) !== variableValueSha256(key, bytes)) {
        fail('DARK_FLAG_EXPECTATION_INVALID');
      }
    } finally {
      bytes.fill(0);
    }
  }
}

function assertCanaryFlagExpectations(parsed) {
  const expected = expectationMap(parsed);
  for (const [key, value] of [
    ['MMHQ_LOR_STUDIO_ENABLED', 'true'],
    ['MMHQ_LOR_STUDIO_KILL_SWITCH', 'false'],
    ['MMHQ_LOR_STUDIO_REQUIRE_CANARY', 'true'],
  ]) {
    const bytes = Buffer.from(value, 'utf8');
    try {
      if (expected.get(key) !== variableValueSha256(key, bytes)) {
        fail('CANARY_FLAG_EXPECTATION_INVALID');
      }
    } finally {
      bytes.fill(0);
    }
  }
}

function assertRolloutFlagExpectations(parsed) {
  const expected = expectationMap(parsed);
  for (const [key, value] of [
    ['MMHQ_LOR_STUDIO_ENABLED', 'true'],
    ['MMHQ_LOR_STUDIO_KILL_SWITCH', 'false'],
    ['MMHQ_LOR_STUDIO_REQUIRE_CANARY', 'false'],
  ]) {
    const bytes = Buffer.from(value, 'utf8');
    try {
      if (expected.get(key) !== variableValueSha256(key, bytes)) {
        fail('ROLLOUT_FLAG_EXPECTATION_INVALID');
      }
    } finally {
      bytes.fill(0);
    }
  }
}

export function verifyDr133ReleaseVariablesFromEnvironment({
  encodedExpectations,
  environment,
} = {}) {
  const parsed = parseDr133ReleaseVariableExpectationManifest(encodedExpectations);
  if (!environment || (typeof environment !== 'object' && typeof environment !== 'function')) {
    fail('VARIABLE_PROBE_ENVIRONMENT_INVALID');
  }
  const expected = expectationMap(parsed);
  for (const key of DR133_RELEASE_VARIABLE_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(environment, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')
      || typeof descriptor.value !== 'string') fail('VARIABLE_PROBE_VALUE_MISSING');
    const bytes = Buffer.from(descriptor.value, 'utf8');
    try {
      const inspected = inspectDr133ReleaseVariableValue(key, bytes);
      if (inspected.valueSha256 !== expected.get(key)) fail('VARIABLE_PROBE_HASH_MISMATCH');
    } finally {
      bytes.fill(0);
    }
  }
  return Object.freeze({
    contract: DR133_RELEASE_VARIABLE_PROBE_CONTRACT,
    result: 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
    manifestSha256: parsed.manifestSha256,
    variableCount: DR133_RELEASE_VARIABLE_KEYS.length,
  });
}

function safeEnvironment(rawEnvironment) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') fail('ENVIRONMENT_REQUIRED');
  const home = safeAbsolutePath(rawEnvironment.HOME ?? homedir(), 'HOME_INVALID');
  const temporary = safeAbsolutePath(rawEnvironment.TMPDIR ?? tmpdir(), 'TMPDIR_INVALID');
  const baseEnvironment = {
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
  if (rawEnvironment.RAILWAY_API_TOKEN !== undefined) {
    const token = rawEnvironment.RAILWAY_API_TOKEN;
    if (typeof token !== 'string' || token.length < 20 || token.length > 2_048
      || /[\u0000-\u0020\u007f]/u.test(token)) fail('RAILWAY_CREDENTIAL_INVALID');
    baseEnvironment.RAILWAY_API_TOKEN = token;
  }
  if (rawEnvironment.DR133_SSH_AUTH_SOCK !== undefined) {
    baseEnvironment.SSH_AUTH_SOCK = safeAbsolutePath(
      rawEnvironment.DR133_SSH_AUTH_SOCK,
      'SSH_AGENT_SOCKET_INVALID',
    );
  }
  const railwayEnvironment = Object.freeze(baseEnvironment);
  const localEnvironment = Object.freeze(Object.fromEntries(
    Object.entries(baseEnvironment).filter(
      ([key]) => !['RAILWAY_API_TOKEN', 'SSH_AUTH_SOCK'].includes(key),
    ),
  ));
  return Object.freeze({
    local: localEnvironment,
    railway: railwayEnvironment,
    home,
    temporary,
  });
}

async function verifyPinnedExecutable(executablePath, expectedSha256) {
  let handle;
  let bytes;
  try {
    if (await realpath(executablePath) !== executablePath
      || !Number.isInteger(fsConstants.O_NOFOLLOW)) fail('EXECUTABLE_DRIFT');
    const before = await lstat(executablePath, { bigint: true });
    handle = await open(executablePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.isSymbolicLink() || opened.nlink !== 1n
      || !dr133FileSnapshotsMatch(before, opened)
      || !dr133FileSnapshotsMatch(opened, after)
      || Number(opened.mode & 0o111n) === 0
      || BigInt(bytes.length) !== opened.size
      || sha256(bytes) !== expectedSha256) fail('EXECUTABLE_DRIFT');
  } catch (error) {
    if (error instanceof Dr133ProductionReleaseError) throw error;
    fail('EXECUTABLE_DRIFT');
  } finally {
    bytes?.fill(0);
    await handle?.close().catch(() => undefined);
  }
  return true;
}

export function createDr133ReleaseCommandRunner() {
  const definitions = Object.freeze({
    git: Object.freeze({ path: GIT_BINARY, sha256: GIT_BINARY_SHA256 }),
    railway: Object.freeze({ path: RAILWAY_BINARY, sha256: RAILWAY_BINARY_SHA256 }),
    tar: Object.freeze({ path: TAR_BINARY, sha256: TAR_BINARY_SHA256 }),
  });
  const runners = new Map();
  return async (descriptor) => {
    if (!exactKeys(descriptor, new Set([
      'args', 'binary', 'cwd', 'env', 'stdin', 'timeoutMs',
    ]))) fail('COMMAND_DESCRIPTOR_INVALID');
    const definition = definitions[descriptor.binary];
    if (!definition) fail('COMMAND_BINARY_NOT_ALLOWED');
    let runner = runners.get(descriptor.binary);
    if (!runner) {
      runner = createSecretSafeRailwayCommandRunner(definition.path, {
        verifyExecutable: async (filePath) => {
          if (filePath !== definition.path) fail('EXECUTABLE_DRIFT');
          return await verifyPinnedExecutable(filePath, definition.sha256);
        },
      });
      runners.set(descriptor.binary, runner);
    }
    return await runner({
      args: descriptor.args,
      cwd: descriptor.cwd,
      env: descriptor.env,
      stdin: descriptor.stdin,
      timeoutMs: descriptor.timeoutMs,
    });
  };
}

function acceptedCommandOutput(outcome, { mutation = false, stdout = 'json' } = {}) {
  const known = exactKeys(outcome, OUTCOME_KEYS) && Buffer.isBuffer(outcome.stdout);
  if (!known) {
    outcome?.stdout?.fill?.(0);
    fail('COMMAND_OUTCOME_INVALID', {
      mutationState: mutation ? 'OUTCOME_UNKNOWN' : 'NOT_ATTEMPTED',
    });
  }
  const started = outcome.childStarted === true;
  const accepted = outcome.exitCode === 0 && outcome.stderrBytes === 0 && started
    && outcome.spawnFailed === false && outcome.timedOut === false
    && outcome.overflow === false && outcome.killFailed === false
    && outcome.closeObserved === true && outcome.uncertainChild === false
    && outcome.processError === false && outcome.stdinError === false
    && outcome.stdoutError === false && outcome.stderrError === false
    && outcome.executableDrift === false
    && (stdout !== 'silent' || outcome.stdout.length === 0);
  if (!accepted) {
    outcome.stdout.fill(0);
    fail('COMMAND_FAILED_CLOSED', {
      mutationState: mutation && started ? 'OUTCOME_UNKNOWN' : 'NOT_ATTEMPTED',
    });
  }
  return outcome.stdout;
}

function parseJsonBytes(bytes, code, options) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > 64 * 1_024) {
    fail(code, options);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail(code, options);
  }
}

function variableSetArgs(key) {
  return Object.freeze([
    'variable', 'set', key,
    '--stdin', '--skip-deploys', '--json',
    '--project', DR133_TARGET.projectId,
    '--environment', DR133_TARGET.environmentId,
    '--service', DR133_TARGET.applicationServiceId,
  ]);
}

function validateVariableSetReceipt(bytes, key) {
  const failure = { mutationState: 'OUTCOME_UNKNOWN' };
  const receipt = parseJsonBytes(bytes, 'VARIABLE_SET_RECEIPT_INVALID', failure);
  if (!exactKeys(receipt, new Set(['keys', 'set'])) || receipt.set !== true
    || !Array.isArray(receipt.keys) || receipt.keys.length !== 1 || receipt.keys[0] !== key) {
    fail('VARIABLE_SET_RECEIPT_INVALID', failure);
  }
}

export async function bindDr133ReleaseVariable({
  commandRunner = createDr133ReleaseCommandRunner(),
  environment = process.env,
  expectedSha256,
  key,
  value,
} = {}) {
  exactSha(expectedSha256, 'VARIABLE_EXPECTED_HASH_INVALID');
  if (!Buffer.isBuffer(value) || value.length > MAX_STDIN_BYTES) fail('VARIABLE_VALUE_INVALID');
  const input = Buffer.from(value);
  let output;
  try {
    const inspected = inspectDr133ReleaseVariableValue(key, input);
    if (inspected.valueSha256 !== expectedSha256) fail('VARIABLE_VALUE_HASH_MISMATCH');
    const sanitized = safeEnvironment(environment);
    const outcome = await commandRunner(Object.freeze({
      args: variableSetArgs(key),
      binary: 'railway',
      cwd: GIT_ROOT,
      env: sanitized.railway,
      stdin: input,
      timeoutMs: QUERY_TIMEOUT_MS,
    }));
    output = acceptedCommandOutput(outcome, { mutation: true });
    validateVariableSetReceipt(output, key);
    return Object.freeze({
      contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
      operation: 'bind-variable',
      result: 'VARIABLE_STAGED_NO_DEPLOY_VERIFIED',
      key,
      valueSha256: inspected.valueSha256,
      bindingState: 'PROVIDER_CONFIRMED',
    });
  } finally {
    input.fill(0);
    value.fill(0);
    output?.fill(0);
  }
}

export function inspectDr133ReleaseVariable({ key, value } = {}) {
  if (!Buffer.isBuffer(value) || value.length > MAX_STDIN_BYTES) fail('VARIABLE_VALUE_INVALID');
  try {
    const inspected = inspectDr133ReleaseVariableValue(key, value);
    return Object.freeze({
      contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
      operation: 'inspect-variable',
      result: 'VARIABLE_NAME_SHAPE_HASH_VERIFIED',
      key: inspected.key,
      byteLength: inspected.byteLength,
      valueSha256: inspected.valueSha256,
    });
  } finally {
    value.fill(0);
  }
}

function deploymentListArgs() {
  return Object.freeze([
    'api', LIST_DEPLOYMENTS_DOCUMENT,
    '--variables', canonicalJson({
      input: {
        environmentId: DR133_TARGET.environmentId,
        projectId: DR133_TARGET.projectId,
        serviceId: DR133_TARGET.applicationServiceId,
      },
    }),
    '--operation-name', 'LorReleaseDeployments', '--compact',
  ]);
}

function deploymentRecord(raw) {
  if (!exactKeys(raw, new Set(['canRollback', 'createdAt', 'id', 'status']))) {
    fail('DEPLOYMENT_LIST_RECEIPT_INVALID');
  }
  const id = exactUuid(raw.id);
  if (typeof raw.status !== 'string' || !DEPLOYMENT_STATUSES.has(raw.status)) {
    fail('DEPLOYMENT_LIST_RECEIPT_INVALID');
  }
  const created = new Date(raw.createdAt);
  if (typeof raw.createdAt !== 'string' || !Number.isFinite(created.valueOf())
    || created.toISOString() !== raw.createdAt || typeof raw.canRollback !== 'boolean') {
    fail('DEPLOYMENT_LIST_RECEIPT_INVALID');
  }
  return Object.freeze({
    id,
    status: raw.status,
    createdAt: raw.createdAt,
    canRollback: raw.canRollback,
  });
}

export function parseDr133ReleaseDeploymentList(bytes) {
  const payload = parseJsonBytes(bytes, 'DEPLOYMENT_LIST_RECEIPT_INVALID');
  if (!exactKeys(payload, new Set(['data']))
    || !exactKeys(payload.data, new Set(['deployments']))
    || !exactKeys(payload.data.deployments, new Set(['edges']))
    || !Array.isArray(payload.data.deployments.edges)
    || payload.data.deployments.edges.length > 50) fail('DEPLOYMENT_LIST_RECEIPT_INVALID');
  const seen = new Set();
  return Object.freeze(payload.data.deployments.edges.map((edge) => {
    if (!exactKeys(edge, new Set(['node']))) fail('DEPLOYMENT_LIST_RECEIPT_INVALID');
    const record = deploymentRecord(edge.node);
    if (seen.has(record.id)) fail('DEPLOYMENT_LIST_RECEIPT_INVALID');
    seen.add(record.id);
    return record;
  }));
}

export function dr133ReleaseDeploymentRef(record) {
  const validated = deploymentRecord(record);
  return sha256(canonicalJson({
    schemaVersion: 'missionmed.lor.railway-dr133-deployment-ref.v1',
    createdAt: validated.createdAt,
    deploymentId: validated.id,
    environmentId: DR133_TARGET.environmentId,
    projectId: DR133_TARGET.projectId,
    serviceId: DR133_TARGET.applicationServiceId,
    status: validated.status,
  }));
}

async function listDeployments(commandRunner, environment) {
  const sanitized = safeEnvironment(environment);
  let output;
  try {
    const outcome = await commandRunner(Object.freeze({
      args: deploymentListArgs(),
      binary: 'railway',
      cwd: GIT_ROOT,
      env: sanitized.railway,
      stdin: null,
      timeoutMs: QUERY_TIMEOUT_MS,
    }));
    output = acceptedCommandOutput(outcome);
    return parseDr133ReleaseDeploymentList(output);
  } finally {
    output?.fill(0);
  }
}

export async function captureDr133ReleaseDeploymentPreimage({
  commandRunner = createDr133ReleaseCommandRunner(),
  environment = process.env,
} = {}) {
  const deployments = await listDeployments(commandRunner, environment);
  const current = deployments.find((deployment) => deployment.status === 'SUCCESS');
  if (!current) fail('ACTIVE_DEPLOYMENT_PREIMAGE_NOT_FOUND');
  return Object.freeze({
    contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
    operation: 'capture-preimage',
    result: 'EXACT_DEPLOYMENT_PREIMAGE_CAPTURED',
    deploymentId: current.id,
    deploymentRef: dr133ReleaseDeploymentRef(current),
    createdAt: current.createdAt,
  });
}

function validateProbeReceipt(bytes, parsed) {
  const receipt = parseJsonBytes(bytes, 'VARIABLE_PROBE_RECEIPT_INVALID');
  if (!exactKeys(receipt, new Set([
    'contract', 'manifestSha256', 'result', 'variableCount',
  ]))
    || receipt.contract !== DR133_RELEASE_VARIABLE_PROBE_CONTRACT
    || receipt.result !== 'VARIABLE_KEYS_SHAPES_HASHES_VERIFIED'
    || receipt.manifestSha256 !== parsed.manifestSha256
    || receipt.variableCount !== DR133_RELEASE_VARIABLE_KEYS.length) {
    fail('VARIABLE_PROBE_RECEIPT_INVALID');
  }
  return receipt;
}

export async function verifyDr133ReleaseRemoteBindings({
  commandRunner = createDr133ReleaseCommandRunner(),
  encodedExpectations,
  environment = process.env,
} = {}) {
  const parsed = parseDr133ReleaseVariableExpectationManifest(encodedExpectations);
  const sanitized = safeEnvironment(environment);
  if (!sanitized.railway.SSH_AUTH_SOCK) fail('SSH_AGENT_SOCKET_REQUIRED');
  let output;
  try {
    const outcome = await commandRunner(Object.freeze({
      args: Object.freeze([
        'ssh', '--project', DR133_TARGET.projectId,
        '--environment', DR133_TARGET.environmentId,
        '--service', DR133_TARGET.applicationServiceId,
        REMOTE_NODE_BINARY, REMOTE_PROBE_PATH, encodedExpectations,
      ]),
      binary: 'railway',
      cwd: GIT_ROOT,
      env: sanitized.railway,
      stdin: null,
      timeoutMs: COMMAND_TIMEOUT_MS,
    }));
    output = acceptedCommandOutput(outcome);
    validateProbeReceipt(output, parsed);
    return Object.freeze({
      contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
      operation: 'verify-bindings',
      result: 'REMOTE_VARIABLE_KEYS_SHAPES_HASHES_VERIFIED',
      manifestSha256: parsed.manifestSha256,
      variableCount: DR133_RELEASE_VARIABLE_KEYS.length,
    });
  } finally {
    output?.fill(0);
  }
}

async function walkStageTree(root) {
  const records = [];
  const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
  const walk = async (directory, relative = '') => {
    const stat = await lstat(directory, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || (currentUid !== null && stat.uid !== currentUid)) fail('ARCHIVE_STAGE_INVALID');
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail('ARCHIVE_STAGE_INVALID');
      if (entry.isDirectory()) {
        await walk(child, childRelative);
        continue;
      }
      if (!entry.isFile()) fail('ARCHIVE_STAGE_INVALID');
      let bytes;
      try {
        const before = await lstat(child, { bigint: true });
        bytes = await readFile(child);
        const after = await lstat(child, { bigint: true });
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
          || !dr133FileSnapshotsMatch(before, after)
          || BigInt(bytes.length) !== before.size
          || (currentUid !== null && before.uid !== currentUid)) fail('ARCHIVE_STAGE_INVALID');
        records.push(`${childRelative}\0${Number(before.mode & 0o777n)}\0${bytes.length}\0${sha256(bytes)}`);
      } finally {
        bytes?.fill(0);
      }
    }
  };
  await walk(root);
  for (const required of RELEASE_ARCHIVE_PATHS) {
    if (!records.some((record) => record.startsWith(`${required}\0`) || record.startsWith(`${required}/`))) {
      fail('ARCHIVE_STAGE_INCOMPLETE');
    }
  }
  return Object.freeze({
    fileCount: records.length,
    treeSha256: sha256(records.join('\n')),
  });
}

async function runArchiveCommand(commandRunner, descriptor, stdout = 'silent') {
  let output;
  try {
    output = acceptedCommandOutput(await commandRunner(descriptor), { stdout });
    return Buffer.from(output);
  } finally {
    output?.fill(0);
  }
}

export async function createDr133ImmutableReleaseArchive({
  commandRunner = createDr133ReleaseCommandRunner(),
  environment = process.env,
  sourceCommit,
} = {}) {
  const commit = exactCommit(sourceCommit);
  const sanitized = safeEnvironment(environment);
  const base = await realpath(sanitized.temporary);
  let root;
  let rootSafe = false;
  try {
    root = await mkdtemp(path.join(base, ROOT_PREFIX));
    rootSafe = path.dirname(root) === base && ROOT_NAME.test(path.basename(root));
    if (!rootSafe || await realpath(root) !== root) fail('TEMP_ROOT_REJECTED');
    await chmod(root, 0o700);
    const stageDirectory = path.join(root, STAGE_DIRECTORY_NAME);
    const archivePath = path.join(root, ARCHIVE_FILENAME);
    await mkdir(stageDirectory, { mode: 0o700 });
    const gitEnvironment = Object.freeze({
      ...sanitized.local,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
    });
    let headBytes;
    try {
      headBytes = await runArchiveCommand(commandRunner, Object.freeze({
        args: Object.freeze(['-C', GIT_ROOT, 'rev-parse', '--verify', 'HEAD']),
        binary: 'git', cwd: GIT_ROOT, env: gitEnvironment, stdin: null,
        timeoutMs: QUERY_TIMEOUT_MS,
      }), 'text');
      if (headBytes.toString('utf8') !== `${commit}\n`) fail('SOURCE_COMMIT_NOT_HEAD');
    } finally {
      headBytes?.fill(0);
    }
    await runArchiveCommand(commandRunner, Object.freeze({
      args: Object.freeze([
        '-C', GIT_ROOT, 'archive', '--format=tar', `--output=${archivePath}`,
        commit, '--', ...RELEASE_ARCHIVE_PATHS,
      ]),
      binary: 'git', cwd: GIT_ROOT, env: gitEnvironment, stdin: null,
      timeoutMs: COMMAND_TIMEOUT_MS,
    }));
    await runArchiveCommand(commandRunner, Object.freeze({
      args: Object.freeze(['-xf', archivePath, '-C', stageDirectory]),
      binary: 'tar', cwd: root, env: sanitized.local, stdin: null,
      timeoutMs: COMMAND_TIMEOUT_MS,
    }));
    let archiveBytes;
    try {
      archiveBytes = await readFile(archivePath);
      if (archiveBytes.length < 1) fail('ARCHIVE_EMPTY');
      const archiveSha256 = sha256(archiveBytes);
      const tree = await walkStageTree(stageDirectory);
      let cleaned = false;
      return Object.freeze({
        archiveSha256,
        fileCount: tree.fileCount,
        sourceCommit: commit,
        stageDirectory,
        treeSha256: tree.treeSha256,
        async cleanup() {
          if (cleaned) return true;
          if (!rootSafe || path.dirname(root) !== base || !ROOT_NAME.test(path.basename(root))) {
            fail('TEMP_ROOT_REJECTED');
          }
          await rm(root, { recursive: true, force: false });
          cleaned = true;
          return true;
        },
        async verify() {
          if (cleaned) fail('ARCHIVE_ALREADY_CLEANED');
          const currentTree = await walkStageTree(stageDirectory);
          if (currentTree.fileCount !== tree.fileCount || currentTree.treeSha256 !== tree.treeSha256) {
            fail('ARCHIVE_STAGE_DRIFT');
          }
          return true;
        },
      });
    } finally {
      archiveBytes?.fill(0);
    }
  } catch (error) {
    if (root && rootSafe) await rm(root, { recursive: true, force: false }).catch(() => undefined);
    if (error instanceof Dr133ProductionReleaseError) throw error;
    fail('ARCHIVE_CREATION_FAILED');
  }
}

function newestSuccessful(deployments, excluded = new Set()) {
  return deployments.find(
    (deployment) => deployment.status === 'SUCCESS' && !excluded.has(deployment.id),
  ) ?? null;
}

function latestSuccessfulDeployment(deployments) {
  let latest = null;
  let ambiguous = false;
  for (const deployment of deployments) {
    if (deployment.status !== 'SUCCESS') continue;
    if (!latest || deployment.createdAt > latest.createdAt) {
      latest = deployment;
      ambiguous = false;
      continue;
    }
    if (deployment.createdAt === latest.createdAt && deployment.id !== latest.id) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : latest;
}

function assertCurrentSuccessfulDeployment(deployments, deploymentId, deploymentRef) {
  const current = latestSuccessfulDeployment(deployments);
  if (
    !current
    || current.id !== deploymentId
    || dr133ReleaseDeploymentRef(current) !== deploymentRef
  ) fail('ROLLOUT_CANARY_PREIMAGE_UNPROVEN');
  return current;
}

async function waitForDeployment({
  clock,
  commandRunner,
  environment,
  expectedId = null,
  excludedIds = new Set(),
  sleep,
}) {
  const startedAt = clock();
  while (clock() - startedAt <= DEPLOYMENT_WAIT_MS) {
    const deployments = await listDeployments(commandRunner, environment);
    const target = expectedId
      ? deployments.find((deployment) => deployment.id === expectedId)
      : deployments.find((deployment) => !excludedIds.has(deployment.id));
    if (target?.status === 'SUCCESS') return target;
    if (target && TERMINAL_FAILURE_STATUSES.has(target.status)) fail('DEPLOYMENT_TERMINAL_FAILURE', {
      mutationState: 'PROVIDER_CONFIRMED',
    });
    await sleep(DEPLOYMENT_POLL_MS);
  }
  fail('DEPLOYMENT_WAIT_TIMEOUT', { mutationState: 'OUTCOME_UNKNOWN' });
}

function uploadedDeploymentId(bytes) {
  const failure = { mutationState: 'OUTCOME_UNKNOWN' };
  const payload = parseJsonBytes(bytes, 'DEPLOYMENT_UPLOAD_RECEIPT_INVALID', failure);
  const legacy = exactKeys(payload, new Set(['deploymentId']));
  const current = exactKeys(payload, new Set(['deploymentId', 'logsUrl']));
  if ((!legacy && !current)
    || typeof payload.deploymentId !== 'string'
    || !UUID.test(payload.deploymentId)
    || (current && !validDeploymentLogsUrl(payload.logsUrl, payload.deploymentId))) {
    fail('DEPLOYMENT_UPLOAD_RECEIPT_INVALID', failure);
  }
  return payload.deploymentId;
}

function validDeploymentLogsUrl(value, deploymentId) {
  if (typeof value !== 'string' || value.length > 2_048 || CONTROL.test(value)
    || /\s/u.test(value) || value.includes('%') || value.includes('+')
    || !UUID.test(deploymentId ?? '')) return false;
  const expectedPath = `/project/${DR133_TARGET.projectId}`
    + `/service/${DR133_TARGET.applicationServiceId}`;
  if (!value.startsWith(`${RAILWAY_DASHBOARD_ORIGIN}${expectedPath}?`)) return false;
  // Existing-project uploads return Backboard's raw logs_url. Railway v5.30.4
  // does not construct this URL and has emitted both an id-only form with a
  // trailing ampersand and environment/id variants. Accept only the six exact
  // observed/compatible query strings, all bound to this deployment and target.
  const allowedSearches = new Set([
    `?id=${deploymentId}`,
    `?id=${deploymentId}&`,
    `?environmentId=${DR133_TARGET.environmentId}&id=${deploymentId}`,
    `?environmentId=${DR133_TARGET.environmentId}&id=${deploymentId}&`,
    `?id=${deploymentId}&environmentId=${DR133_TARGET.environmentId}`,
    `?id=${deploymentId}&environmentId=${DR133_TARGET.environmentId}&`,
  ]);
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.host === 'railway.com'
      && url.username === ''
      && url.password === ''
      && url.pathname === expectedPath
      && url.hash === ''
      && allowedSearches.has(url.search);
  } catch {
    return false;
  }
}

export async function deployDr133ImmutableDarkCandidate({
  clock = () => Date.now(),
  commandRunner = createDr133ReleaseCommandRunner(),
  createArchive = createDr133ImmutableReleaseArchive,
  encodedExpectations,
  environment = process.env,
  sleep = async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
  sourceCommit,
} = {}) {
  const commit = exactCommit(sourceCommit);
  const parsed = parseDr133ReleaseVariableExpectationManifest(encodedExpectations);
  assertReleaseCommitExpectation(parsed, commit);
  assertDarkFlagExpectations(parsed);
  const before = await listDeployments(commandRunner, environment);
  const preimage = newestSuccessful(before);
  if (!preimage) fail('ACTIVE_DEPLOYMENT_PREIMAGE_NOT_FOUND');
  const archive = await createArchive({ commandRunner, environment, sourceCommit: commit });
  let output;
  let mutationStarted = false;
  try {
    await archive.verify();
    const sanitized = safeEnvironment(environment);
    const outcome = await commandRunner(Object.freeze({
      args: Object.freeze([
        'up', archive.stageDirectory,
        '--path-as-root', '--detach', '--json', '--yes',
        '--message', `F2-LOR-1012 DR-133 ${commit}`,
        '--project', DR133_TARGET.projectId,
        '--environment', DR133_TARGET.environmentId,
        '--service', DR133_TARGET.applicationServiceId,
      ]),
      binary: 'railway', cwd: GIT_ROOT, env: sanitized.railway, stdin: null,
      timeoutMs: COMMAND_TIMEOUT_MS,
    }));
    mutationStarted = outcome?.childStarted === true;
    output = acceptedCommandOutput(outcome, { mutation: true });
    const candidateDeploymentId = uploadedDeploymentId(output);
    await archive.verify();
    const candidate = await waitForDeployment({
      clock, commandRunner, environment,
      expectedId: candidateDeploymentId, sleep,
    });
    return Object.freeze({
      contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
      operation: 'deploy-dark',
      result: 'IMMUTABLE_DARK_CANDIDATE_DEPLOYED',
      sourceCommit: commit,
      archiveSha256: archive.archiveSha256,
      treeSha256: archive.treeSha256,
      fileCount: archive.fileCount,
      manifestSha256: parsed.manifestSha256,
      preimageDeploymentId: preimage.id,
      preimageDeploymentRef: dr133ReleaseDeploymentRef(preimage),
      candidateDeploymentId: candidate.id,
      candidateDeploymentRef: dr133ReleaseDeploymentRef(candidate),
    });
  } catch (error) {
    if (error instanceof Dr133ProductionReleaseError) throw error;
    fail('DARK_DEPLOY_FAILED', {
      mutationState: mutationStarted ? 'OUTCOME_UNKNOWN' : 'NOT_ATTEMPTED',
    });
  } finally {
    output?.fill(0);
    try {
      await archive.cleanup();
    } catch {
      fail('TEMP_CLEANUP_FAILED', {
        mutationState: mutationStarted ? 'PROVIDER_CONFIRMED' : 'NOT_ATTEMPTED',
      });
    }
  }
}

async function readBoundedBody(response) {
  if (!response?.body || typeof response.body.getReader !== 'function') fail('HTTP_RESPONSE_INVALID');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (!plain(part) || typeof part.done !== 'boolean') fail('HTTP_RESPONSE_INVALID');
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) fail('HTTP_RESPONSE_INVALID');
      const bytes = Buffer.from(part.value);
      total += bytes.length;
      if (total > MAX_HTTP_BODY_BYTES) {
        bytes.fill(0);
        fail('HTTP_RESPONSE_TOO_LARGE');
      }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks);
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    await reader.cancel().catch(() => undefined);
  }
}

async function fixedHttpJson(fetchImplementation, url, options, expectedStatus) {
  let response;
  let body;
  try {
    response = await fetchImplementation(url, {
      ...options,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: Object.freeze({ Accept: 'application/json' }),
    });
    if (!response || response.status !== expectedStatus || response.url !== url) {
      fail('HTTP_STATUS_INVALID');
    }
    body = await readBoundedBody(response);
    return parseJsonBytes(body, 'HTTP_JSON_INVALID');
  } catch (error) {
    if (error instanceof Dr133ProductionReleaseError) throw error;
    fail('HTTP_PROBE_FAILED');
  } finally {
    body?.fill(0);
  }
}

export async function verifyDr133DarkHealthAndContainment({
  fetchImplementation = globalThis.fetch,
} = {}) {
  if (typeof fetchImplementation !== 'function') fail('FETCH_IMPLEMENTATION_INVALID');
  const health = await fixedHttpJson(fetchImplementation, HEALTH_URL, { method: 'GET' }, 200);
  if (!exactKeys(health, new Set(['status'])) || health.status !== 'ok') {
    fail('HEALTH_RECEIPT_INVALID');
  }
  const readiness = await fixedHttpJson(
    fetchImplementation,
    LOR_READINESS_URL,
    { method: 'GET' },
    200,
  );
  if (!exactKeys(readiness, new Set(['status'])) || readiness.status !== 'ready') {
    fail('OPERATOR_READINESS_RECEIPT_INVALID');
  }
  for (const { method, path: pathname } of DARK_CONTAINMENT_PROBES) {
    const containment = await fixedHttpJson(
      fetchImplementation,
      `${PRODUCTION_ORIGIN}${pathname}`,
      { method },
      404,
    );
    if (!exactKeys(containment, new Set(['error']))
      || containment.error !== 'lor_feature_disabled') fail('DARK_CONTAINMENT_INVALID');
  }
  return Object.freeze({
    health: 'VERIFIED',
    containment: 'FEATURE_DISABLED_VERIFIED',
    operatorReadiness: 'VERIFIED_METADATA_ONLY',
    launchReady: true,
  });
}

export async function verifyDr133CanaryHealthAndContainment({
  fetchImplementation = globalThis.fetch,
} = {}) {
  if (typeof fetchImplementation !== 'function') fail('FETCH_IMPLEMENTATION_INVALID');
  const health = await fixedHttpJson(fetchImplementation, HEALTH_URL, { method: 'GET' }, 200);
  if (!exactKeys(health, new Set(['status'])) || health.status !== 'ok') {
    fail('HEALTH_RECEIPT_INVALID');
  }
  const readiness = await fixedHttpJson(
    fetchImplementation,
    LOR_READINESS_URL,
    { method: 'GET' },
    200,
  );
  if (!exactKeys(readiness, new Set(['status'])) || readiness.status !== 'ready') {
    fail('OPERATOR_READINESS_RECEIPT_INVALID');
  }
  const denial = await fixedHttpJson(
    fetchImplementation,
    DARK_CONTAINMENT_URL,
    { method: 'POST' },
    403,
  );
  if (!exactKeys(denial, new Set(['error', 'message']))
    || denial.error !== 'candidate_auth_start_denied'
    || denial.message !== 'Faculty invitation sign-in could not be started.') {
    fail('CANARY_ANONYMOUS_DENIAL_INVALID');
  }
  return Object.freeze({
    health: 'VERIFIED',
    containment: 'FEATURE_ACTIVE_ANONYMOUS_DENIAL_VERIFIED',
    operatorReadiness: 'VERIFIED_METADATA_ONLY',
    launchReady: true,
  });
}

export async function verifyDr133DarkDeployment({
  commandRunner = createDr133ReleaseCommandRunner(),
  deploymentId,
  deploymentRef: expectedDeploymentRef,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const id = exactUuid(deploymentId);
  exactSha(expectedDeploymentRef, 'DEPLOYMENT_REF_INVALID');
  const deployments = await listDeployments(commandRunner, environment);
  const deployment = deployments.find((entry) => entry.id === id);
  if (!deployment || deployment.status !== 'SUCCESS'
    || dr133ReleaseDeploymentRef(deployment) !== expectedDeploymentRef) {
    fail('DEPLOYMENT_IDENTITY_UNPROVEN');
  }
  const probe = await verifyDr133DarkHealthAndContainment({ fetchImplementation });
  return Object.freeze({
    contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
    operation: 'verify-dark',
    result: 'DARK_HEALTH_CONTAINMENT_AND_READINESS_VERIFIED',
    deploymentId: id,
    deploymentRef: expectedDeploymentRef,
    health: probe.health,
    containment: probe.containment,
    operatorReadiness: probe.operatorReadiness,
    launchReady: probe.launchReady,
  });
}

function deploymentMutationArgs(operation, deploymentId) {
  const [document, operationName] = operation === 'rollback'
    ? [ROLLBACK_DOCUMENT, 'LorReleaseRollback']
    : [REDEPLOY_DOCUMENT, 'LorReleaseRedeploy'];
  return Object.freeze([
    'api', document,
    '--variables', canonicalJson({ id: deploymentId }),
    '--operation-name', operationName,
    '--compact',
  ]);
}

function mutationDeploymentId(bytes, operation) {
  const failure = { mutationState: 'OUTCOME_UNKNOWN' };
  const payload = parseJsonBytes(bytes, 'DEPLOYMENT_MUTATION_RECEIPT_INVALID', failure);
  const field = operation === 'rollback' ? 'deploymentRollback' : 'deploymentRedeploy';
  if (!exactKeys(payload, new Set(['data']))
    || !exactKeys(payload.data, new Set([field]))
    || !exactKeys(payload.data[field], new Set(['id']))) {
    fail('DEPLOYMENT_MUTATION_RECEIPT_INVALID', failure);
  }
  return exactUuid(
    payload.data[field].id,
    'DEPLOYMENT_MUTATION_RECEIPT_INVALID',
    failure,
  );
}

async function mutateDeployment({ commandRunner, deploymentId, environment, operation }) {
  const sanitized = safeEnvironment(environment);
  let output;
  try {
    const outcome = await commandRunner(Object.freeze({
      args: deploymentMutationArgs(operation, deploymentId),
      binary: 'railway', cwd: GIT_ROOT, env: sanitized.railway, stdin: null,
      timeoutMs: QUERY_TIMEOUT_MS,
    }));
    output = acceptedCommandOutput(outcome, { mutation: true });
    return mutationDeploymentId(output, operation);
  } finally {
    output?.fill(0);
  }
}

const CANARY_FLAG_VALUES = Object.freeze([
  Object.freeze(['MMHQ_LOR_STUDIO_REQUIRE_CANARY', 'true']),
  Object.freeze(['MMHQ_LOR_STUDIO_ENABLED', 'true']),
  Object.freeze(['MMHQ_LOR_STUDIO_KILL_SWITCH', 'false']),
]);
const ROLLOUT_FLAG_VALUES = Object.freeze([
  Object.freeze(['MMHQ_LOR_STUDIO_REQUIRE_CANARY', 'false']),
  Object.freeze(['MMHQ_LOR_STUDIO_ENABLED', 'true']),
  Object.freeze(['MMHQ_LOR_STUDIO_KILL_SWITCH', 'false']),
]);
const DARK_FLAG_VALUES = Object.freeze([
  Object.freeze(['MMHQ_LOR_STUDIO_KILL_SWITCH', 'true']),
  Object.freeze(['MMHQ_LOR_STUDIO_ENABLED', 'false']),
  Object.freeze(['MMHQ_LOR_STUDIO_REQUIRE_CANARY', 'true']),
]);

function expectationManifestWithFlags(parsed, flagValues) {
  const replacements = new Map(flagValues.map(([key, value]) => {
    const bytes = Buffer.from(value, 'utf8');
    try {
      return [key, variableValueSha256(key, bytes)];
    } finally {
      bytes.fill(0);
    }
  }));
  return createDr133ReleaseVariableExpectationManifest(
    parsed.manifest.variables.map(({ key, sha256: expectedSha256 }) => Object.freeze({
      key,
      sha256: replacements.get(key) ?? expectedSha256,
    })),
  );
}

async function bindKnownReleaseFlags({ commandRunner, environment, flagValues }) {
  for (const [key, value] of flagValues) {
    const bytes = Buffer.from(value, 'utf8');
    const expectedSha256 = variableValueSha256(key, bytes);
    await bindDr133ReleaseVariable({
      commandRunner,
      environment,
      expectedSha256,
      key,
      value: bytes,
    });
  }
}

async function restoreDarkCandidate({
  candidateDeploymentId,
  clock,
  commandRunner,
  darkExpectations,
  environment,
  fetchImplementation,
  sleep,
}) {
  await bindKnownReleaseFlags({
    commandRunner,
    environment,
    flagValues: DARK_FLAG_VALUES,
  });
  const restoredId = await mutateDeployment({
    commandRunner,
    deploymentId: candidateDeploymentId,
    environment,
    operation: 'redeploy',
  });
  const restored = await waitForDeployment({
    clock,
    commandRunner,
    environment,
    expectedId: restoredId,
    sleep,
  });
  await verifyDr133ReleaseRemoteBindings({
    commandRunner,
    encodedExpectations: darkExpectations.encoded,
    environment,
  });
  const dark = await verifyDr133DarkHealthAndContainment({ fetchImplementation });
  return Object.freeze({ dark, restored });
}

export async function activateDr133NamedCanaryCandidate({
  candidateDeploymentId,
  candidateDeploymentRef,
  clock = () => Date.now(),
  commandRunner = createDr133ReleaseCommandRunner(),
  encodedExpectations,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  sleep = async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const candidateId = exactUuid(candidateDeploymentId);
  exactSha(candidateDeploymentRef, 'DEPLOYMENT_REF_INVALID');
  const parsed = parseDr133ReleaseVariableExpectationManifest(encodedExpectations);
  assertCanaryFlagExpectations(parsed);
  const before = await listDeployments(commandRunner, environment);
  const candidate = before.find(({ id }) => id === candidateId);
  if (!candidate || candidate.status !== 'SUCCESS'
    || dr133ReleaseDeploymentRef(candidate) !== candidateDeploymentRef) {
    fail('CANARY_CANDIDATE_UNPROVEN');
  }
  await verifyDr133DarkHealthAndContainment({ fetchImplementation });

  const darkExpectations = expectationManifestWithFlags(parsed, DARK_FLAG_VALUES);
  let releaseStateMutationAttempted = false;
  try {
    releaseStateMutationAttempted = true;
    await bindKnownReleaseFlags({
      commandRunner,
      environment,
      flagValues: CANARY_FLAG_VALUES,
    });
    const activatedId = await mutateDeployment({
      commandRunner,
      deploymentId: candidateId,
      environment,
      operation: 'redeploy',
    });
    const activated = await waitForDeployment({
      clock,
      commandRunner,
      environment,
      expectedId: activatedId,
      sleep,
    });
    const bindings = await verifyDr133ReleaseRemoteBindings({
      commandRunner,
      encodedExpectations: parsed.encoded,
      environment,
    });
    const canary = await verifyDr133CanaryHealthAndContainment({ fetchImplementation });
    return Object.freeze({
      contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
      operation: 'activate-canary',
      result: 'NAMED_CANARY_ACTIVATED_VERIFIED',
      candidateDeploymentId: candidateId,
      candidateDeploymentRef,
      activatedDeploymentId: activated.id,
      activatedDeploymentRef: dr133ReleaseDeploymentRef(activated),
      manifestSha256: bindings.manifestSha256,
      variableCount: bindings.variableCount,
      health: canary.health,
      containment: canary.containment,
      operatorReadiness: canary.operatorReadiness,
      launchReady: canary.launchReady,
      canaryRequired: 'VERIFIED_BY_REMOTE_BINDING',
    });
  } catch (activationError) {
    if (!releaseStateMutationAttempted) throw activationError;
    try {
      await restoreDarkCandidate({
        candidateDeploymentId: candidateId,
        clock,
        commandRunner,
        darkExpectations,
        environment,
        fetchImplementation,
        sleep,
      });
    } catch {
      fail('CANARY_ACTIVATION_ROLLBACK_UNPROVEN', { mutationState: 'OUTCOME_UNKNOWN' });
    }
    fail('CANARY_ACTIVATION_FAILED_DARK_RESTORED', {
      mutationState: 'PROVIDER_CONFIRMED',
    });
  }
}

export async function activateDr133NamedRolloutCandidate({
  candidateDeploymentId,
  candidateDeploymentRef,
  clock = () => Date.now(),
  commandRunner = createDr133ReleaseCommandRunner(),
  encodedExpectations,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  sleep = async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const candidateId = exactUuid(candidateDeploymentId);
  exactSha(candidateDeploymentRef, 'DEPLOYMENT_REF_INVALID');
  const canaryExpectations = parseDr133ReleaseVariableExpectationManifest(encodedExpectations);
  assertCanaryFlagExpectations(canaryExpectations);
  const before = await listDeployments(commandRunner, environment);
  assertCurrentSuccessfulDeployment(before, candidateId, candidateDeploymentRef);
  await verifyDr133ReleaseRemoteBindings({
    commandRunner,
    encodedExpectations: canaryExpectations.encoded,
    environment,
  });
  await verifyDr133CanaryHealthAndContainment({ fetchImplementation });
  // Re-read after the generic public probe. A newer successful deployment cannot
  // borrow the named canary's proof and then promote a historical deployment.
  const confirmed = await listDeployments(commandRunner, environment);
  assertCurrentSuccessfulDeployment(confirmed, candidateId, candidateDeploymentRef);

  const rolloutExpectations = expectationManifestWithFlags(
    canaryExpectations,
    ROLLOUT_FLAG_VALUES,
  );
  assertRolloutFlagExpectations(rolloutExpectations);
  const darkExpectations = expectationManifestWithFlags(canaryExpectations, DARK_FLAG_VALUES);
  let releaseStateMutationAttempted = false;
  try {
    releaseStateMutationAttempted = true;
    await bindKnownReleaseFlags({
      commandRunner,
      environment,
      flagValues: ROLLOUT_FLAG_VALUES,
    });
    const activatedId = await mutateDeployment({
      commandRunner,
      deploymentId: candidateId,
      environment,
      operation: 'redeploy',
    });
    const activated = await waitForDeployment({
      clock,
      commandRunner,
      environment,
      expectedId: activatedId,
      sleep,
    });
    const bindings = await verifyDr133ReleaseRemoteBindings({
      commandRunner,
      encodedExpectations: rolloutExpectations.encoded,
      environment,
    });
    const rollout = await verifyDr133CanaryHealthAndContainment({ fetchImplementation });
    return Object.freeze({
      contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
      operation: 'activate-rollout',
      result: 'NAMED_ROLLOUT_ACTIVATED_VERIFIED',
      candidateDeploymentId: candidateId,
      candidateDeploymentRef,
      activatedDeploymentId: activated.id,
      activatedDeploymentRef: dr133ReleaseDeploymentRef(activated),
      manifestSha256: bindings.manifestSha256,
      variableCount: bindings.variableCount,
      health: rollout.health,
      containment: rollout.containment,
      operatorReadiness: rollout.operatorReadiness,
      launchReady: rollout.launchReady,
      canaryRequired: 'DISABLED_BY_REMOTE_BINDING',
    });
  } catch (activationError) {
    if (!releaseStateMutationAttempted) throw activationError;
    try {
      await restoreDarkCandidate({
        candidateDeploymentId: candidateId,
        clock,
        commandRunner,
        darkExpectations,
        environment,
        fetchImplementation,
        sleep,
      });
    } catch {
      fail('ROLLOUT_ACTIVATION_ROLLBACK_UNPROVEN', { mutationState: 'OUTCOME_UNKNOWN' });
    }
    fail('ROLLOUT_ACTIVATION_FAILED_DARK_RESTORED', {
      mutationState: 'PROVIDER_CONFIRMED',
    });
  }
}

export async function runDr133ExactRollbackRedeployDrill({
  candidateDeploymentId,
  candidateDeploymentRef,
  clock = () => Date.now(),
  commandRunner = createDr133ReleaseCommandRunner(),
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  preimageDeploymentId,
  preimageDeploymentRef,
  sleep = async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const preimageId = exactUuid(preimageDeploymentId);
  const candidateId = exactUuid(candidateDeploymentId);
  if (preimageId === candidateId) fail('ROLLBACK_IDENTITIES_COLLIDE');
  exactSha(preimageDeploymentRef, 'DEPLOYMENT_REF_INVALID');
  exactSha(candidateDeploymentRef, 'DEPLOYMENT_REF_INVALID');
  const before = await listDeployments(commandRunner, environment);
  const preimage = before.find(({ id }) => id === preimageId);
  const candidate = before.find(({ id }) => id === candidateId);
  if (!preimage || !candidate || preimage.status !== 'SUCCESS' || candidate.status !== 'SUCCESS'
    || preimage.canRollback !== true
    || dr133ReleaseDeploymentRef(preimage) !== preimageDeploymentRef
    || dr133ReleaseDeploymentRef(candidate) !== candidateDeploymentRef) {
    fail('ROLLBACK_PREIMAGE_UNPROVEN');
  }

  const rollbackId = await mutateDeployment({
    commandRunner, deploymentId: preimageId, environment, operation: 'rollback',
  });
  await waitForDeployment({
    clock, commandRunner, environment, expectedId: rollbackId, sleep,
  });
  let rollbackHealth = 'VERIFIED';
  try {
    const health = await fixedHttpJson(fetchImplementation, HEALTH_URL, { method: 'GET' }, 200);
    if (!exactKeys(health, new Set(['status'])) || health.status !== 'ok') {
      fail('ROLLBACK_HEALTH_INVALID', { mutationState: 'PROVIDER_CONFIRMED' });
    }
  } catch {
    rollbackHealth = 'FAILED';
  }

  const redeployId = await mutateDeployment({
    commandRunner, deploymentId: candidateId, environment, operation: 'redeploy',
  });
  const redeployed = await waitForDeployment({
    clock, commandRunner, environment, expectedId: redeployId, sleep,
  });
  const dark = await verifyDr133DarkHealthAndContainment({ fetchImplementation });
  if (rollbackHealth !== 'VERIFIED') {
    fail('ROLLBACK_HEALTH_FAILED_CANDIDATE_REDEPLOYED', {
      mutationState: 'PROVIDER_CONFIRMED',
    });
  }
  return Object.freeze({
    contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
    operation: 'rollback-redeploy',
    result: 'EXACT_PREIMAGE_ROLLBACK_AND_CANDIDATE_REDEPLOY_VERIFIED',
    preimageDeploymentId: preimageId,
    preimageDeploymentRef,
    rollbackDeploymentId: rollbackId,
    candidateDeploymentId: candidateId,
    candidateDeploymentRef,
    redeployedDeploymentId: redeployed.id,
    health: dark.health,
    containment: dark.containment,
    operatorReadiness: dark.operatorReadiness,
    launchReady: dark.launchReady,
  });
}

function normalizeDependencies(rawDependencies = {}) {
  if (!ownDataProperties(rawDependencies) || Reflect.ownKeys(rawDependencies).some(
    (key) => typeof key !== 'string' || !ORCHESTRATOR_DEPENDENCY_KEYS.has(key),
  )) fail('DEPENDENCIES_INVALID');
  const dependencies = {
    clock: () => Date.now(),
    commandRunner: createDr133ReleaseCommandRunner(),
    createArchive: createDr133ImmutableReleaseArchive,
    fetchImplementation: globalThis.fetch,
    sleep: async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
    ...rawDependencies,
  };
  if (Object.values(dependencies).some((value) => typeof value !== 'function')) {
    fail('DEPENDENCIES_INVALID');
  }
  return Object.freeze(dependencies);
}

export function createDr133ProductionReleaseOrchestrator(rawDependencies = {}) {
  const dependencies = normalizeDependencies(rawDependencies);
  return async ({ args = [], environment = process.env, operation, stdin = null } = {}) => {
    if (!OPERATIONS.has(operation) || !Array.isArray(args)
      || args.some((value) => typeof value !== 'string' || value.length > MAX_EXPECTATION_BYTES * 2
        || CONTROL.test(value))) fail('OPERATION_INVALID');
    switch (operation) {
      case 'activate-canary':
        if (args.length !== 3 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await activateDr133NamedCanaryCandidate({
          ...dependencies,
          candidateDeploymentId: args[0],
          candidateDeploymentRef: args[1],
          encodedExpectations: args[2],
          environment,
        });
      case 'activate-rollout':
        if (args.length !== 3 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await activateDr133NamedRolloutCandidate({
          ...dependencies,
          candidateDeploymentId: args[0],
          candidateDeploymentRef: args[1],
          encodedExpectations: args[2],
          environment,
        });
      case 'bind-variable':
        if (args.length !== 2 || !Buffer.isBuffer(stdin)) fail('OPERATION_ARGUMENTS_INVALID');
        return await bindDr133ReleaseVariable({
          commandRunner: dependencies.commandRunner,
          environment,
          expectedSha256: args[1],
          key: args[0],
          value: stdin,
        });
      case 'capture-preimage':
        if (args.length !== 0 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await captureDr133ReleaseDeploymentPreimage({
          commandRunner: dependencies.commandRunner, environment,
        });
      case 'inspect-variable':
        if (args.length !== 1 || !Buffer.isBuffer(stdin)) fail('OPERATION_ARGUMENTS_INVALID');
        return inspectDr133ReleaseVariable({ key: args[0], value: stdin });
      case 'deploy-dark':
        if (args.length !== 2 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await deployDr133ImmutableDarkCandidate({
          ...dependencies, encodedExpectations: args[1], environment, sourceCommit: args[0],
        });
      case 'rollback-redeploy':
        if (args.length !== 4 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await runDr133ExactRollbackRedeployDrill({
          ...dependencies,
          preimageDeploymentId: args[0], preimageDeploymentRef: args[1],
          candidateDeploymentId: args[2], candidateDeploymentRef: args[3], environment,
        });
      case 'verify-bindings':
        if (args.length !== 1 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await verifyDr133ReleaseRemoteBindings({
          commandRunner: dependencies.commandRunner,
          encodedExpectations: args[0], environment,
        });
      case 'verify-dark':
        if (args.length !== 2 || stdin !== null) fail('OPERATION_ARGUMENTS_INVALID');
        return await verifyDr133DarkDeployment({
          commandRunner: dependencies.commandRunner,
          deploymentId: args[0], deploymentRef: args[1], environment,
          fetchImplementation: dependencies.fetchImplementation,
        });
      default:
        return fail('OPERATION_INVALID');
    }
  };
}

export function dr133ProductionReleaseErrorReceipt(error, operation = 'unknown') {
  return Object.freeze({
    contract: DR133_RELEASE_ORCHESTRATOR_CONTRACT,
    operation: OPERATIONS.has(operation) ? operation : 'unknown',
    result: 'BLOCKED',
    errorCode: error instanceof Dr133ProductionReleaseError
      ? error.code : 'UNEXPECTED_FAILURE',
    mutationState: error instanceof Dr133ProductionReleaseError
      ? error.mutationState : 'OUTCOME_UNKNOWN',
  });
}

export const DR133_PRODUCTION_RELEASE_CONTRACT = Object.freeze({
  activeCanaryDenial: 'POST_candidate_start_without_credentials_403',
  archivePaths: RELEASE_ARCHIVE_PATHS,
  darkContainmentUrl: DARK_CONTAINMENT_URL,
  darkContainmentSurfaces: DARK_CONTAINMENT_PROBES,
  healthUrl: HEALTH_URL,
  operatorReadinessRoute: '/health/lor-studio',
  openAiProjectId: OPENAI_PRODUCTION_PROJECT_ID,
  operations: [...OPERATIONS].sort(),
  projectId: DR133_TARGET.projectId,
  environmentId: DR133_TARGET.environmentId,
  serviceId: DR133_TARGET.applicationServiceId,
  sourceCommitBinding: 'MMHQ_LOR_RELEASE_COMMIT_domain_separated_expectation_hash',
  variableCount: DR133_RELEASE_VARIABLE_KEYS.length,
  variableKeys: DR133_RELEASE_VARIABLE_KEYS,
  variableMutation: 'railway variable set KEY --stdin --skip-deploys --json',
  arbitraryCommands: false,
  environmentDump: false,
  secretOutput: false,
});
