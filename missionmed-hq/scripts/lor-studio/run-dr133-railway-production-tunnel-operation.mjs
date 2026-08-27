import { spawn } from 'node:child_process';
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
  readlink,
  realpath,
  rm,
} from 'node:fs/promises';
import { createServer, createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_RUNNER_CONTRACT,
  DR133_TARGET,
  DR133_TUNNEL_HOST,
  dr133RuntimeDeprovisionRollbackArtifactId,
  verifiedDr133DatabaseCa,
  writeDr133Receipt,
} from './railway-dr133-production-runner-core.mjs';
import {
  createDr133DedicatedRailwaySshAgentVerifier,
  dr133FileSnapshotsMatch,
} from './railway-dr133-production-runtime-ca-transfer.mjs';

export const DR133_PRODUCTION_TUNNEL_OPERATION_CONTRACT =
  'missionmed.lor.railway-dr133-production-tunnel-operation.v1';
export const DR133_DATABASE_SERVICE_NAME = 'Postgres-3TCU';
const DR133_PRODUCTION_CONNECTIVITY_CONTRACT =
  'missionmed.lor.railway-dr133-production-connectivity.v1';
const DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT =
  'missionmed.lor.railway-dr133-production-rollback-drill.v1';

const RAILWAY_BINARY = '/opt/homebrew/Cellar/railway/5.30.4/bin/railway';
const RAILWAY_BINARY_SHA256 =
  '6b508973c6b3f43c7926e5345a4460cef40ed22b766d0e2fcc6a498d00262684';
const SSH_BINARY = '/usr/bin/ssh';
const SSH_BINARY_SHA256 =
  '29d2ea00c47d0e92b4cc25bd58d1b3468dc31b3a1aeb6ed877d562a163f21e6e';
const GIT_BINARY = '/Library/Developer/CommandLineTools/usr/bin/git';
const GIT_BINARY_SHA256 =
  'be4afb2b003904725826250de9fb76567bbacf82323457b5a1ec26706b66bcae';
const NODE_BINARY = '/usr/local/bin/node';
const NODE_BINARY_SHA256 =
  '9e831e9b13aa47c5e5eaa3904d232aa527124e8abba7ca5d72b67b46cfb10ae8';
const ENV_BINARY = '/usr/bin/env';
const ENV_BINARY_SHA256 =
  '9eb7c5aed7f3c7fe07b77d9a84d0a7c6a8c68c17a15aa3dace0d8ff02d352776';
const PYTHON_BINARY = '/usr/bin/python3';
const PYTHON_BINARY_SHA256 =
  '12bed4523661307059b879b9b54e77a73176e9d27d27a0e40363271d8f0668ba';
const PYTHON_BINARY_NLINK = 78n;
const PYTHON_TOOLCHAIN_DIRECTORY = '/Library/Developer/CommandLineTools';
const PYTHON_TOOLCHAIN_ENTRY = `${PYTHON_TOOLCHAIN_DIRECTORY}/usr/bin/python3`;
const PYTHON_RUNTIME_BINARY =
  '/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/bin/python3.9';
const PYTHON_RUNTIME_BINARY_SHA256 =
  'bdea59019a38eb6600cc9e71e984a97fedadc406448431281e7657030f54987e';
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MODULE_DIRECTORY, '..', '..');
const GIT_ROOT = path.resolve(REPOSITORY_ROOT, '..');
const SERVICE_OPERATION_RELATIVE_PATH =
  'scripts/lor-studio/run-dr133-railway-production-service-operation.mjs';
const SANITIZER_RELATIVE_PATH =
  'scripts/lor-studio/dr133_railway_production_service_sanitizer.py';
const SANITIZER_PATH = path.join(REPOSITORY_ROOT, SANITIZER_RELATIVE_PATH);
export const DR133_OPERATION_CLOSURE_PATHS = Object.freeze([
  'package.json',
  'package-lock.json',
  'missionmed-hq/package.json',
  ...[
    'scripts/lor-studio/complete-dr133-railway-production-runtime-binding.mjs',
    'scripts/lor-studio/deprovision-dr133-railway-production-runtime-login.mjs',
    SANITIZER_RELATIVE_PATH,
    'scripts/lor-studio/provision-dr133-railway-production-runtime-login.mjs',
    'scripts/lor-studio/railway-dr133-production-runner-core.mjs',
    'scripts/lor-studio/railway-dr133-production-runtime-ca-transfer.mjs',
    'scripts/lor-studio/railway-dr133-production-runtime-url-binding.mjs',
    'scripts/lor-studio/run-dr133-railway-production-migrations.mjs',
    'scripts/lor-studio/run-dr133-railway-production-rollback-drill.mjs',
    SERVICE_OPERATION_RELATIVE_PATH,
    'scripts/lor-studio/run-dr133-railway-production-tunnel-operation.mjs',
    'scripts/lor-studio/verify-dr133-railway-production-connectivity.mjs',
    ...DR133_ARTIFACTS.map((artifact) => `scripts/lor-studio/${artifact.relativePath}`),
  ].map((relativePath) => `missionmed-hq/${relativePath}`),
]);
const PG_PACKAGE_CLOSURE = Object.freeze([
  Object.freeze({ name: 'pg', version: '8.23.0', integrity: 'sha512-Ip2EQCngowJLGOfCwkFhPXU7/ljlhn6Rxlmy4XYfL2Y+vyRM59+8uR2xqRWKdYmbXmxCFOAmKxBuSUCdF34qLg==', fileCount: 20, treeSha256: 'a03a1029902c8757832be7dc7f38320447d3bdd30b220118b5b8647516a2185e' }),
  Object.freeze({ name: 'pg-connection-string', version: '2.14.0', integrity: 'sha512-XwWDGcLRGCXAR8F/AM5bG7Q+A3Wm2s6QeEjlOKZLlH3UYcguiqCWKyWXVag5TLTIjR7oOJUY8kcADaZgWPyLeg==', fileCount: 6, treeSha256: '1eab073fca180f444558ddbd7950911f5f1416df22880226ecb5a33caa1d6802' }),
  Object.freeze({ name: 'pg-int8', version: '1.0.1', integrity: 'sha512-WCtabS6t3c8SkpDBUlb1kjOs7l66xsGdKpIPZsg4wR+B3+u9UAum2odSsF9tnvxg80h4ZxLWMy4pRjOsFIqQpw==', fileCount: 4, treeSha256: '0ae5aa379850877276554160ef9b6cb9e095fdc4ded84452c1de58cea6377485' }),
  Object.freeze({ name: 'pg-pool', version: '3.14.0', integrity: 'sha512-gKtPkFdQPU3DksooVLi9LsjZxrsBUZIpa+7aVx+LV5pNh0KzP4Zleud2po+ConrxbuXGBJ6Hfer6hdgpIBpBaw==', fileCount: 5, treeSha256: 'f294494492290433124f17858d40deb0a38372783b4b10c1cf246ceac5d3889f' }),
  Object.freeze({ name: 'pg-protocol', version: '1.16.0', integrity: 'sha512-sILXutLVjCLjcDuOmvhX5e2Z4cS5qG/6Bu3VkpFwdf/633ElGLpEh9bgmuI5I4sqKqkifQiGyiCcx1HdtrK7tg==', fileCount: 42, treeSha256: '02e55db479f97eea447f129e49b05affa7d3a3cf474cc0447bd963e78e73b987' }),
  Object.freeze({ name: 'pg-types', version: '2.2.0', integrity: 'sha512-qTAAlrEsl8s4OiEQY69wDvcMIdQN6wdz5ojQiOy6YRMuynxenON0O5oCpJI6lshc6scgAY8qvJ2On/p+CXY0GA==', fileCount: 13, treeSha256: 'a51a2d2ae7f9a6e317d6fa473c45d713a509b260f52059756c33fe545d458a1f' }),
  Object.freeze({ name: 'pgpass', version: '1.0.5', integrity: 'sha512-FdW9r/jQZhSeohs1Z3sI1yxFQNFvMcnmfuj4WBMUTxOrAyLMaTcE1aAMBiTlbMNaXvBCQuVi0R7hd8udDSP7ug==', fileCount: 4, treeSha256: '3f2d7836854f52c873b050fcfdd04a02d6b16d095904190d5c4efc770516a741' }),
  Object.freeze({ name: 'postgres-array', version: '2.0.0', integrity: 'sha512-VpZrUqU5A69eQyW2c5CA1jtLecCsN2U/bD6VilrFDWq5+5UIEVO7nazS3TEcHf1zuPYO/sqGvUvW62g86RXZuA==', fileCount: 5, treeSha256: 'acd5d8dab864ce4774690f6c22c722da303c4a26ccfd7f466b0d6761774cee2e' }),
  Object.freeze({ name: 'postgres-bytea', version: '1.0.1', integrity: 'sha512-5+5HqXnsZPE65IJZSMkZtURARZelel2oXUEO8rH83VS/hxH5vv1uHquPg5wZs8yMAfdv971IU+kcPUczi7NVBQ==', fileCount: 4, treeSha256: '507a805ed713da42d462fe8943c3ad24ca1dde27abac43dae7dc73a16d60467e' }),
  Object.freeze({ name: 'postgres-date', version: '1.0.7', integrity: 'sha512-suDmjLVQg78nMK2UZ454hAG+OAW+HQPZ6n++TNDUX+L0+uUlLywnoxJKDou51Zm+zTCjrCl0Nq6J9C5hP9vK/Q==', fileCount: 4, treeSha256: '5d82f01ebf3ce25d2d106b5735a3440592f96517dd09171e4a1a626086c9977b' }),
  Object.freeze({ name: 'postgres-interval', version: '1.2.0', integrity: 'sha512-9ZhXKM/rw350N1ovuWHbGxnGh/SNJ4cnxHiM0rxE4VN41wsg8P8zWn9hv/buK00RP4WvlOyr/RBDiptyxVbkZQ==', fileCount: 5, treeSha256: '7b09598add7f433d030ba25d637bad445c1b1c9ed3fa3538586aab18ccd1e390' }),
  Object.freeze({ name: 'split2', version: '4.2.0', integrity: 'sha512-UcjcJOWknrNkF6PLX83qcHM6KHgVKNkV62Y8a5uYDVv9ydGQVwAHMKqHdJje1VTWpljG0WYpCDhrCdAOYH4TWg==', fileCount: 6, treeSha256: 'e5ec21d8ee65fba0274cf897fe88d7cdc1ebe3b697cade9ba431a70d7aef6b89' }),
  Object.freeze({ name: 'xtend', version: '4.0.2', integrity: 'sha512-LKYU1iAXJXUgAXn9URjiu+MWhyUXHsvfp7mcuYm9dSUKK0/CjtrUwFAxD82/mCWbtLsGjFIad0wIsod4zrTAEQ==', fileCount: 7, treeSha256: '0d6b0889b07b3bd2711b5f2d55bae5d0761a843d9ae71b2c8cb327151287e3c1' }),
]);
const TEMP_PREFIX = 'f2-lor-dr133-production-tunnel-';
const TEMP_ROOT_NAME = /^f2-lor-dr133-production-tunnel-[A-Za-z0-9_-]{6,}$/u;
const SAFE_CONTROL = /[\u0000-\u001f\u007f]/u;
const SAFE_ERROR_CODE = /^[A-Z0-9_]{3,80}$/u;
const SAFE_POSTGRES_CODE = /^[0-9A-Z]{5}$/u;
const SAFE_SHA256 = /^[0-9a-f]{64}$/u;
const MAX_RECEIPT_BYTES = 64 * 1024;
const PORT_MINIMUM = 1_024;
const PORT_MAXIMUM = 65_535;
const MODES = new Set([
  'connectivity-preflight',
  'migration',
  'successor-migration',
  'schema-verifier',
  'rollback-drill',
  'runtime-login',
  'runtime-login-deprovision',
]);
const SUCCESS_RESULTS = Object.freeze({
  'connectivity-preflight': new Set(['FRESH_PRIVATE_TARGET_VERIFIED']),
  migration: new Set(['CUMULATIVE_SCHEMA_COMMITTED_VERIFIED']),
  'successor-migration': new Set([
    'SUCCESSOR_COMMITTED_VERIFIED',
    'SUCCESSOR_ALREADY_COMMITTED_VERIFIED',
  ]),
  'schema-verifier': new Set(['SCHEMA_VERIFIED_NO_MUTATION']),
  'rollback-drill': new Set(['ROLLBACK_DRILL_COMMITTED_VERIFIED']),
  'runtime-login': new Set(['RUNTIME_LOGIN_COMMITTED_VERIFIED']),
  'runtime-login-deprovision': new Set([
    'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
  ]),
});
const RUNNER_HASH_KEYS = Object.freeze({
  aiProposalRollbackSha256: 'ai-proposal-rollback',
  aiProposalSha256: 'ai-proposal',
  encryptedPrivateStorageRollbackSha256: 'encrypted-private-storage-rollback',
  encryptedPrivateStorageSha256: 'encrypted-private-storage',
  facultyCandidateAuthHandoffRollbackSha256:
    'faculty-candidate-auth-handoff-rollback',
  facultyCandidateAuthHandoffSha256: 'faculty-candidate-auth-handoff',
  mentorAssignmentRollbackSha256: 'mentor-assignment-rollback',
  mentorAssignmentSha256: 'mentor-assignment',
  facultyInvitationRollbackSha256: 'faculty-invitation-rollback',
  facultyInvitationSha256: 'faculty-invitation',
  facultyPrivateExportRollbackSha256: 'faculty-private-export-rollback',
  facultyPrivateExportSha256: 'faculty-private-export',
  foundationSha256: 'foundation',
  identityScopeRollbackSha256: 'identity-scope-rollback',
  identityScopeSha256: 'identity-scope',
  rlsSha256: 'rls',
  studentEvidenceRollbackSha256: 'student-evidence-rollback',
  studentEvidenceSha256: 'student-evidence',
});
const ROLLBACK_HASH_KEYS = Object.freeze({
  ...RUNNER_HASH_KEYS,
  foundationRollbackSha256: 'foundation-rollback',
  rlsRollbackSha256: 'rls-rollback',
});
const ROLLBACK_RECEIPT_KEYS = new Set([
  'contract',
  'mode',
  'result',
  'runnerCode',
  'postgresCode',
  'postgresMajor',
  'relationCount',
  'rollbackCount',
  'verifiedArtifactCount',
  ...Object.keys(ROLLBACK_HASH_KEYS),
]);
const ROLLBACK_RESULTS = new Set([
  'NO_MUTATION',
  'ROLLBACK_PROGRESS_PRESERVED',
  'ROLLBACK_PROGRESS_OUTCOME_UNKNOWN',
  'ROLLBACK_DRILL_COMMITTED_POSTFLIGHT_REJECTED',
  'ROLLBACK_DRILL_COMMITTED_VERIFICATION_UNKNOWN',
  'ROLLBACK_DRILL_COMMITTED_VERIFIED_CLEANUP_FAILED',
  'ROLLBACK_DRILL_COMMITTED_VERIFIED',
]);
const DR133_ARTIFACT_COUNT = DR133_ARTIFACTS.length;
const DR133_ROLLBACK_ARTIFACT_COUNT = DR133_ARTIFACTS.filter(
  (artifact) => artifact.relativePath.startsWith('rollbacks/'),
).length;
const DEFAULT_TIMINGS = Object.freeze({
  startupAttempts: 100,
  startupDelayMs: 100,
  startupStabilityMs: 150,
  probeTimeoutMs: 250,
  shutdownGraceMs: 3_000,
  killGraceMs: 2_000,
  processGroupProbeDelayMs: 100,
  portClosureAttempts: 40,
  portClosureDelayMs: 100,
});
const DEFAULT_OPERATION_TIMEOUTS = Object.freeze({
  'connectivity-preflight': 60_000,
  migration: 480_000,
  'successor-migration': 480_000,
  'schema-verifier': 120_000,
  'rollback-drill': 900_000,
  'runtime-login': 480_000,
  'runtime-login-deprovision': 480_000,
});
const DEPENDENCY_KEYS = new Set([
  'allocatePort',
  'cleanupWorkspace',
  'createNodeVerifier',
  'createOperationSourceVerifier',
  'createSshAgentVerifier',
  'createWorkspace',
  'isProcessGroupAlive',
  'operationTimeoutMs',
  'probeLoopbackPort',
  'signalProcessGroup',
  'sleep',
  'spawnProcess',
  'stageRailwayBinary',
  'timings',
  'verifySshTransportBinary',
]);
const OPTION_KEYS = new Set([
  'databaseCa', 'environment', 'mode', 'runtimeDatabaseUrl', 'sourceCommit',
]);

export class Dr133ProductionTunnelOperationError extends Error {
  constructor(code, safeReceipt = null, safeReceipts = null) {
    super(`DR-133 production tunnel operation failed: ${code}`);
    this.name = 'Dr133ProductionTunnelOperationError';
    this.code = code;
    const receipts = safeReceipts ?? (safeReceipt ? [safeReceipt] : []);
    this.safeReceipts = Object.freeze([...receipts]);
    this.safeReceipt = safeReceipt ?? this.safeReceipts.at(-1) ?? null;
  }
}

export const DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT =
  'missionmed.lor.railway-dr133-source-custody-preflight.v1';

function fail(code, safeReceipt = null) {
  throw new Dr133ProductionTunnelOperationError(code, safeReceipt);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function ownDataProperties(value) {
  if (!plain(value)) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => Object.hasOwn(descriptor, 'value'),
  );
}

function safeAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)
    || value.length > 4_096 || SAFE_CONTROL.test(value)) fail(code);
  return value;
}

function requiredMode(value) {
  if (typeof value !== 'string' || !MODES.has(value)) fail('MODE_INVALID');
  return value;
}

function requiredPort(value) {
  if (!Number.isSafeInteger(value) || value < PORT_MINIMUM || value > PORT_MAXIMUM) {
    fail('TUNNEL_PORT_INVALID');
  }
  return value;
}

function safeToken(rawEnvironment) {
  const value = rawEnvironment?.RAILWAY_API_TOKEN;
  if (typeof value !== 'string' || value.length < 20 || value.length > 2_048
    || /[\u0000-\u0020\u007f]/u.test(value)) fail('RAILWAY_CREDENTIAL_INVALID');
  return value;
}

function safeRuntimeUrl(value, mode) {
  if (mode !== 'runtime-login') {
    if (value !== undefined) fail('RUNTIME_DATABASE_URL_FORBIDDEN');
    return null;
  }
  if (typeof value !== 'string' || value.length < 64 || value.length > 4_096
    || SAFE_CONTROL.test(value) || !/^postgres(?:ql)?:\/\//u.test(value)) {
    fail('RUNTIME_DATABASE_URL_INVALID');
  }
  return value;
}

function artifactHash(id) {
  const value = DR133_ARTIFACTS.find((artifact) => artifact.id === id)?.sha256;
  if (!SAFE_SHA256.test(value ?? '')) fail('ARTIFACT_INVENTORY_INVALID');
  return value;
}

function assertExactArtifactHashes(receipt, mapping) {
  for (const [receiptKey, artifactId] of Object.entries(mapping)) {
    if (Object.hasOwn(receipt, receiptKey) && receipt[receiptKey] !== artifactHash(artifactId)) {
      fail('SERVICE_RECEIPT_ARTIFACT_HASH_MISMATCH');
    }
  }
}

function validateConnectivityReceipt(receipt) {
  const keys = Object.keys(receipt).sort();
  if (receipt.contract !== DR133_PRODUCTION_CONNECTIVITY_CONTRACT) {
    fail('SERVICE_RECEIPT_INVALID');
  }
  if (receipt.result === 'FRESH_PRIVATE_TARGET_VERIFIED') {
    if (JSON.stringify(keys) !== JSON.stringify(['contract', 'postgresMajor', 'result'])
      || ![16, 18].includes(receipt.postgresMajor)) fail('SERVICE_RECEIPT_INVALID');
    return;
  }
  if (receipt.result !== 'BLOCKED'
    || JSON.stringify(keys) !== JSON.stringify([
      'contract', 'postgresCode', 'result', 'runnerCode',
    ])
    || !SAFE_ERROR_CODE.test(receipt.runnerCode)
    || !(receipt.postgresCode === null
      || (typeof receipt.postgresCode === 'string'
        && SAFE_POSTGRES_CODE.test(receipt.postgresCode)))) {
    fail('SERVICE_RECEIPT_INVALID');
  }
}

function validateRollbackReceipt(receipt) {
  if (Object.keys(receipt).some((key) => !ROLLBACK_RECEIPT_KEYS.has(key))
    || receipt.contract !== DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT
    || receipt.mode !== 'rollback-drill'
    || !ROLLBACK_RESULTS.has(receipt.result)
    || !Number.isSafeInteger(receipt.verifiedArtifactCount)
    || receipt.verifiedArtifactCount < 0
    || receipt.verifiedArtifactCount > DR133_ARTIFACT_COUNT
    || !Number.isSafeInteger(receipt.rollbackCount)
    || receipt.rollbackCount < 0
    || receipt.rollbackCount > DR133_ROLLBACK_ARTIFACT_COUNT) {
    fail('SERVICE_RECEIPT_INVALID');
  }
  if (receipt.runnerCode !== undefined
    && (typeof receipt.runnerCode !== 'string' || !SAFE_ERROR_CODE.test(receipt.runnerCode))) {
    fail('SERVICE_RECEIPT_INVALID');
  }
  if (receipt.postgresCode !== undefined && receipt.postgresCode !== null
    && (typeof receipt.postgresCode !== 'string'
      || !SAFE_POSTGRES_CODE.test(receipt.postgresCode))) fail('SERVICE_RECEIPT_INVALID');
  for (const key of Object.keys(ROLLBACK_HASH_KEYS)) {
    if (receipt[key] !== undefined
      && (typeof receipt[key] !== 'string' || !SAFE_SHA256.test(receipt[key]))) {
      fail('SERVICE_RECEIPT_INVALID');
    }
  }
  if (receipt.postgresMajor !== undefined && ![16, 18].includes(receipt.postgresMajor)) {
    fail('SERVICE_RECEIPT_INVALID');
  }
  if (receipt.relationCount !== undefined && receipt.relationCount !== DR133_RELATIONS.length) {
    fail('SERVICE_RECEIPT_INVALID');
  }
  const success = receipt.result === 'ROLLBACK_DRILL_COMMITTED_VERIFIED';
  if (success) {
    if (receipt.runnerCode !== undefined || receipt.postgresCode !== undefined
      || receipt.verifiedArtifactCount !== DR133_ARTIFACT_COUNT
      || receipt.rollbackCount !== DR133_ROLLBACK_ARTIFACT_COUNT
      || ![16, 18].includes(receipt.postgresMajor)
      || receipt.relationCount !== DR133_RELATIONS.length
      || Object.keys(ROLLBACK_HASH_KEYS).some((key) => !receipt[key])) {
      fail('SERVICE_RECEIPT_INVALID');
    }
  } else if (typeof receipt.runnerCode !== 'string'
    || !Object.hasOwn(receipt, 'postgresCode')) fail('SERVICE_RECEIPT_INVALID');
  assertExactArtifactHashes(receipt, ROLLBACK_HASH_KEYS);
}

export function validateDr133TunnelServiceReceipt(bytes, expectedMode, exitCode) {
  const mode = requiredMode(expectedMode);
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > MAX_RECEIPT_BYTES) {
    bytes?.fill?.(0);
    fail('SERVICE_RECEIPT_INVALID');
  }
  let text;
  let receipt;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    receipt = JSON.parse(text);
  } catch {
    fail('SERVICE_RECEIPT_INVALID');
  }
  if (!ownDataProperties(receipt)
    || `${JSON.stringify(receipt)}\n` !== text
    || /postgres(?:ql)?:\/\/|-----BEGIN CERTIFICATE-----|PRIVATE KEY/iu.test(text)) {
    fail('SERVICE_RECEIPT_INVALID');
  }
  if (mode === 'connectivity-preflight') {
    validateConnectivityReceipt(receipt);
  } else if (mode === 'rollback-drill') {
    validateRollbackReceipt(receipt);
  } else {
    try {
      writeDr133Receipt({ write() {} }, receipt);
    } catch {
      fail('SERVICE_RECEIPT_INVALID');
    }
    if (receipt.contract !== DR133_RUNNER_CONTRACT || receipt.mode !== mode) {
      fail('SERVICE_RECEIPT_INVALID');
    }
    assertExactArtifactHashes(receipt, RUNNER_HASH_KEYS);
    if (mode === 'runtime-login-deprovision' && receipt.result !== 'NO_MUTATION') {
      const expectedGuardArtifact = dr133RuntimeDeprovisionRollbackArtifactId(
        receipt.runtimeDeprovisionGuardStage,
      );
      if (
        receipt.runtimeDeprovisionGuardRollbackSha256
        !== artifactHash(expectedGuardArtifact)
      ) fail('SERVICE_RECEIPT_ARTIFACT_HASH_MISMATCH');
    }
  }
  const success = SUCCESS_RESULTS[mode].has(receipt.result);
  if ((success && exitCode !== 0) || (!success && exitCode !== 1)) {
    fail('SERVICE_RECEIPT_EXIT_MISMATCH');
  }
  return Object.freeze(receipt);
}

export function dr133TunnelCommandArgs(port) {
  const selected = requiredPort(port);
  return Object.freeze([
    'connect',
    DR133_DATABASE_SERVICE_NAME,
    '--project',
    DR133_TARGET.projectId,
    '--environment',
    DR133_TARGET.environmentId,
    '--ssh',
    '--tunnel-only',
    '--port',
    String(selected),
  ]);
}

export function dr133ServiceOperationCommandArgs(mode, port) {
  const selectedMode = requiredMode(mode);
  const selectedPort = requiredPort(port);
  return Object.freeze([
    'run',
    '--project',
    DR133_TARGET.projectId,
    '--environment',
    DR133_TARGET.environmentId,
    '--service',
    DR133_TARGET.databaseServiceId,
    '--no-local',
    '--',
    ENV_BINARY,
    '-u', 'DEVELOPER_DIR',
    '-u', 'DYLD_FRAMEWORK_PATH',
    '-u', 'BASHOPTS',
    '-u', 'BASH_ENV',
    '-u', 'CDPATH',
    '-u', 'DATABASE_PUBLIC_URL',
    '-u', 'DYLD_INSERT_LIBRARIES',
    '-u', 'DYLD_LIBRARY_PATH',
    '-u', 'ENV',
    '-u', 'GLOBIGNORE',
    '-u', 'IFS',
    '-u', 'LD_LIBRARY_PATH',
    '-u', 'LD_PRELOAD',
    '-u', 'NODE_OPTIONS',
    '-u', 'NODE_PATH',
    '-u', 'NODE_EXTRA_CA_CERTS',
    '-u', 'OPENSSL_CONF',
    '-u', 'PATH',
    '-u', 'PGOPTIONS',
    '-u', 'PGSSLNEGOTIATION',
    '-u', 'PYTHONHOME',
    '-u', 'PYTHONPATH',
    '-u', 'PYTHONSTARTUP',
    '-u', 'SHELLOPTS',
    '-u', 'SSL_CERT_DIR',
    '-u', 'SSL_CERT_FILE',
    `DEVELOPER_DIR=${PYTHON_TOOLCHAIN_DIRECTORY}`,
    PYTHON_BINARY,
    '-I',
    '-E',
    '-s',
    SANITIZER_PATH,
    NODE_BINARY,
    path.join(REPOSITORY_ROOT, SERVICE_OPERATION_RELATIVE_PATH),
    selectedMode,
    String(selectedPort),
  ]);
}

function baseChildEnvironment({ token, workspace, nodeDirectory }) {
  return {
    PATH: `${nodeDirectory}:/usr/bin:/bin`,
    HOME: workspace.home,
    TMPDIR: workspace.temporary,
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: '1',
    DO_NOT_TRACK: '1',
    RAILWAY_NO_TELEMETRY: '1',
    RAILWAY_NO_AUTO_UPDATE: '1',
    RAILWAY_API_TOKEN: token,
  };
}

export function buildDr133TunnelChildEnvironments({
  databaseCa,
  mode,
  nodeDirectory,
  port,
  runtimeDatabaseUrl,
  socketPath,
  token,
  workspace,
}) {
  const base = baseChildEnvironment({ token, workspace, nodeDirectory });
  const tunnel = Object.freeze({ ...base, SSH_AUTH_SOCK: socketPath });
  const operation = Object.freeze({
    ...base,
    LOR_DR133_MODE: mode,
    LOR_DR133_RUNTIME_DATABASE_CA: databaseCa,
    LOR_DR133_TUNNEL_HOST: DR133_TUNNEL_HOST,
    LOR_DR133_TUNNEL_PORT: String(port),
    ...(runtimeDatabaseUrl ? { LOR_DR133_RUNTIME_DATABASE_URL: runtimeDatabaseUrl } : {}),
  });
  return Object.freeze({ tunnel, operation });
}

async function readPinnedFile(executablePath, expectedSha256, {
  expectedMode = null,
  expectedUid = null,
  expectedGid = null,
  expectedNlink = 1n,
} = {}) {
  let handle;
  let bytes;
  try {
    if (typeof expectedNlink !== 'bigint' || expectedNlink < 1n
      || await realpath(executablePath) !== executablePath
      || !Number.isInteger(fsConstants.O_NOFOLLOW)) fail('PINNED_EXECUTABLE_DRIFT');
    const before = await lstat(executablePath, { bigint: true });
    handle = await open(executablePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.isSymbolicLink() || opened.nlink !== expectedNlink
      || !dr133FileSnapshotsMatch(before, opened)
      || !dr133FileSnapshotsMatch(opened, after)
      || BigInt(bytes.length) !== opened.size
      || (expectedMode !== null && Number(opened.mode & 0o777n) !== expectedMode)
      || (expectedUid !== null && opened.uid !== expectedUid)
      || (expectedGid !== null && opened.gid !== expectedGid)
      || createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
      fail('PINNED_EXECUTABLE_DRIFT');
    }
    return Object.freeze({ bytes, snapshot: opened });
  } catch (error) {
    bytes?.fill(0);
    if (error instanceof Dr133ProductionTunnelOperationError) throw error;
    fail('PINNED_EXECUTABLE_DRIFT');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function verifyPinnedSshTransportBinary() {
  const checked = await readPinnedFile(SSH_BINARY, SSH_BINARY_SHA256, {
    expectedMode: 0o755,
    expectedUid: 0n,
    expectedGid: 0n,
  });
  checked.bytes.fill(0);
  return true;
}

async function verifyStagedRailwayBinary(stagedPath) {
  const checked = await readPinnedFile(stagedPath, RAILWAY_BINARY_SHA256, {
    expectedMode: 0o500,
    expectedUid: typeof process.getuid === 'function' ? BigInt(process.getuid()) : null,
  });
  checked.bytes.fill(0);
  return true;
}

async function stagePinnedRailwayBinary(workspace) {
  const source = await readPinnedFile(RAILWAY_BINARY, RAILWAY_BINARY_SHA256);
  let handle;
  try {
    const binDirectory = path.join(workspace.root, 'bin');
    await mkdir(binDirectory, { mode: 0o700 });
    if (await realpath(binDirectory) !== binDirectory) fail('RAILWAY_BINARY_STAGE_FAILED');
    const stagedPath = path.join(binDirectory, 'railway');
    handle = await open(
      stagedPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o500,
    );
    await handle.writeFile(source.bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await verifyStagedRailwayBinary(stagedPath);
    return Object.freeze({ path: stagedPath, verify: () => verifyStagedRailwayBinary(stagedPath) });
  } catch (error) {
    if (error instanceof Dr133ProductionTunnelOperationError) throw error;
    fail('RAILWAY_BINARY_STAGE_FAILED');
  } finally {
    source.bytes.fill(0);
    await handle?.close().catch(() => undefined);
  }
}

async function createWorkspace(rawEnvironment) {
  const requestedBase = rawEnvironment?.TMPDIR ?? tmpdir();
  let base;
  try {
    base = await realpath(safeAbsolutePath(requestedBase, 'TMPDIR_INVALID'));
  } catch (error) {
    if (error instanceof Dr133ProductionTunnelOperationError) throw error;
    fail('TMPDIR_INVALID');
  }
  const root = await mkdtemp(path.join(base, TEMP_PREFIX));
  try {
    if (path.dirname(root) !== base || !TEMP_ROOT_NAME.test(path.basename(root))) {
      fail('TEMP_ROOT_REJECTED');
    }
    await chmod(root, 0o700);
    if (await realpath(root) !== root) fail('TEMP_ROOT_REJECTED');
    const home = path.join(root, 'home');
    const temporary = path.join(root, 'tmp');
    await mkdir(home, { mode: 0o700 });
    await mkdir(temporary, { mode: 0o700 });
    return Object.freeze({ base, root, home, temporary });
  } catch (error) {
    await rm(root, { recursive: true, force: false }).catch(() => undefined);
    if (error instanceof Dr133ProductionTunnelOperationError) throw error;
    fail('TEMP_ROOT_REJECTED');
  }
}

async function cleanupWorkspace(workspace) {
  if (!workspace || path.dirname(workspace.root) !== workspace.base
    || !TEMP_ROOT_NAME.test(path.basename(workspace.root))) fail('TEMP_ROOT_REJECTED');
  try {
    await rm(workspace.root, { recursive: true, force: false });
  } catch {
    fail('TEMP_CLEANUP_FAILED');
  }
}

async function createAnchoredFileVerifier(filePath, { code, executable = false } = {}) {
  let handle;
  let bytes;
  try {
    if (await realpath(filePath) !== filePath || !Number.isInteger(fsConstants.O_NOFOLLOW)) fail(code);
    const before = await lstat(filePath, { bigint: true });
    handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
    if (!opened.isFile() || opened.isSymbolicLink() || opened.nlink !== 1n
      || !dr133FileSnapshotsMatch(before, opened)
      || !dr133FileSnapshotsMatch(opened, after)
      || BigInt(bytes.length) !== opened.size
      || (currentUid !== null && ![0n, currentUid].includes(opened.uid))
      || (executable && (Number(opened.mode & 0o111n) === 0))) fail(code);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const verify = async () => {
      let verifyHandle;
      let verifyBytes;
      try {
        if (await realpath(filePath) !== filePath) fail(code);
        verifyHandle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
        const currentBefore = await verifyHandle.stat({ bigint: true });
        verifyBytes = await verifyHandle.readFile();
        const currentAfter = await verifyHandle.stat({ bigint: true });
        if (!dr133FileSnapshotsMatch(opened, currentBefore)
          || !dr133FileSnapshotsMatch(currentBefore, currentAfter)
          || BigInt(verifyBytes.length) !== currentBefore.size
          || createHash('sha256').update(verifyBytes).digest('hex') !== sha256) fail(code);
        return true;
      } catch (error) {
        if (error instanceof Dr133ProductionTunnelOperationError) throw error;
        fail(code);
      } finally {
        verifyBytes?.fill(0);
        await verifyHandle?.close().catch(() => undefined);
      }
    };
    return Object.freeze({ verify });
  } catch (error) {
    if (error instanceof Dr133ProductionTunnelOperationError) throw error;
    fail(code);
  } finally {
    bytes?.fill(0);
    await handle?.close().catch(() => undefined);
  }
}

async function verifyPinnedGitBinary() {
  const checked = await readPinnedFile(GIT_BINARY, GIT_BINARY_SHA256, {
    expectedMode: 0o755,
    expectedUid: 0n,
    expectedGid: 0n,
  });
  checked.bytes.fill(0);
  return true;
}

async function runQuietGitCustodyCommand(args, { stdoutExpectation = null } = {}) {
  await verifyPinnedGitBinary();
  const result = await new Promise((resolve) => {
    let child;
    let settled = false;
    let stdoutBytes = 0;
    const stdoutChunks = [];
    let timer;
    let killTimer;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      for (const chunk of stdoutChunks) chunk.fill(0);
      stdoutChunks.length = 0;
      resolve(value);
    };
    try {
      child = spawn(GIT_BINARY, args, {
        cwd: GIT_ROOT,
        env: Object.freeze({
          PATH: '/usr/bin:/bin',
          LANG: 'C',
          LC_ALL: 'C',
          TZ: 'UTC',
          TERM: 'dumb',
          NO_COLOR: '1',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
        }),
        shell: false,
        stdio: ['ignore', stdoutExpectation !== null ? 'pipe' : 'ignore', 'ignore'],
      });
    } catch {
      finish(false);
      return;
    }
    if (!Number.isSafeInteger(child?.pid) || child.pid < 1) {
      finish(false);
      return;
    }
    if (stdoutExpectation !== null) {
      child.stdout.on('data', (value) => {
        const bytes = Buffer.from(value);
        stdoutBytes += bytes.length;
        if (stdoutBytes > 128) {
          bytes.fill(0);
          finish(false);
        } else {
          stdoutChunks.push(bytes);
        }
      });
      child.stdout.once('error', () => finish(false));
    }
    child.once('error', () => finish(false));
    child.once('close', (code, signal) => {
      let stdoutMatches = true;
      if (stdoutExpectation !== null) {
        const bytes = Buffer.concat(stdoutChunks);
        stdoutMatches = bytes.toString('utf8') === stdoutExpectation;
        bytes.fill(0);
        for (const chunk of stdoutChunks) chunk.fill(0);
      }
      finish(code === 0 && signal === null && stdoutMatches);
    });
    timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        finish(false);
        return;
      }
      killTimer = setTimeout(() => finish(false), 1_000);
    }, 10_000);
  });
  await verifyPinnedGitBinary();
  if (!result) fail('SERVICE_OPERATION_SOURCE_NOT_COMMITTED');
}

async function assertOperationClosureCommittedClean(expectedCommit) {
  if (typeof expectedCommit !== 'string' || !/^[0-9a-f]{40}$/u.test(expectedCommit)) {
    fail('SOURCE_COMMIT_INVALID');
  }
  if (new Set(DR133_OPERATION_CLOSURE_PATHS).size !== DR133_OPERATION_CLOSURE_PATHS.length
    || DR133_OPERATION_CLOSURE_PATHS.some(
      (value) => typeof value !== 'string' || value.length < 1
        || path.isAbsolute(value) || value.startsWith('../') || SAFE_CONTROL.test(value),
    )) fail('SERVICE_OPERATION_SOURCE_INVENTORY_INVALID');
  await runQuietGitCustodyCommand(
    ['--literal-pathspecs', '-C', GIT_ROOT, 'rev-parse', '--verify', 'HEAD'],
    { stdoutExpectation: `${expectedCommit}\n` },
  );
  await runQuietGitCustodyCommand([
    '--literal-pathspecs', '-C', GIT_ROOT,
    'ls-files', '--error-unmatch', '--', ...DR133_OPERATION_CLOSURE_PATHS,
  ]);
  await runQuietGitCustodyCommand([
    '--literal-pathspecs', '-C', GIT_ROOT,
    'status', '--porcelain=v1', '--untracked-files=all', '--',
    ...DR133_OPERATION_CLOSURE_PATHS,
  ], { stdoutExpectation: '' });
}

async function packageTreeReceipt(packageRoot) {
  const records = [];
  const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
  const walk = async (directory, relative = '') => {
    let entries;
    try {
      const stat = await lstat(directory, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink()
        || (currentUid !== null && stat.uid !== currentUid)
        || Number(stat.mode & 0o022n) !== 0) fail('DEPENDENCY_CUSTODY_INVALID');
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Dr133ProductionTunnelOperationError) throw error;
      fail('DEPENDENCY_CUSTODY_INVALID');
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const childPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail('DEPENDENCY_CUSTODY_INVALID');
      if (entry.isDirectory()) {
        await walk(childPath, childRelative);
        continue;
      }
      if (!entry.isFile()) fail('DEPENDENCY_CUSTODY_INVALID');
      let bytes;
      try {
        const before = await lstat(childPath, { bigint: true });
        bytes = await readFile(childPath);
        const after = await lstat(childPath, { bigint: true });
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
          || !dr133FileSnapshotsMatch(before, after)
          || (currentUid !== null && before.uid !== currentUid)
          || BigInt(bytes.length) !== before.size) fail('DEPENDENCY_CUSTODY_INVALID');
        records.push([
          childRelative,
          Number(before.mode & 0o777n),
          bytes.length,
          createHash('sha256').update(bytes).digest('hex'),
        ].join('\0'));
      } catch (error) {
        if (error instanceof Dr133ProductionTunnelOperationError) throw error;
        fail('DEPENDENCY_CUSTODY_INVALID');
      } finally {
        bytes?.fill(0);
      }
    }
  };
  if (await realpath(packageRoot) !== packageRoot) fail('DEPENDENCY_CUSTODY_INVALID');
  await walk(packageRoot);
  return Object.freeze({
    fileCount: records.length,
    treeSha256: createHash('sha256').update(records.join('\n')).digest('hex'),
  });
}

export async function verifyDr133PgDependencyClosure() {
  let lockBytes;
  let manifestBytes;
  let lock;
  let manifest;
  try {
    lockBytes = await readFile(path.join(GIT_ROOT, 'package-lock.json'));
    manifestBytes = await readFile(path.join(GIT_ROOT, 'package.json'));
    lock = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(lockBytes));
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  } catch {
    fail('DEPENDENCY_LOCK_INVALID');
  } finally {
    lockBytes?.fill(0);
    manifestBytes?.fill(0);
  }
  if (!ownDataProperties(lock) || !ownDataProperties(lock.packages)
    || !ownDataProperties(manifest) || manifest.dependencies?.pg !== '8.23.0'
    || PG_PACKAGE_CLOSURE.length !== 13
    || new Set(PG_PACKAGE_CLOSURE.map(({ name }) => name)).size !== 13) {
    fail('DEPENDENCY_LOCK_INVALID');
  }
  for (const expected of PG_PACKAGE_CLOSURE) {
    const locked = lock.packages[`node_modules/${expected.name}`];
    if (!ownDataProperties(locked)
      || locked.version !== expected.version
      || locked.integrity !== expected.integrity) fail('DEPENDENCY_LOCK_INVALID');
    const observed = await packageTreeReceipt(
      path.join(GIT_ROOT, 'node_modules', expected.name),
    );
    if (observed.fileCount !== expected.fileCount
      || observed.treeSha256 !== expected.treeSha256) fail('DEPENDENCY_CUSTODY_INVALID');
  }
  return true;
}

async function createOperationSourceVerifier({ expectedCommit }) {
  await assertOperationClosureCommittedClean(expectedCommit);
  await verifyDr133PgDependencyClosure();
  const anchors = await Promise.all(DR133_OPERATION_CLOSURE_PATHS.map(
    async (relativePath) => await createAnchoredFileVerifier(
      path.join(GIT_ROOT, relativePath),
      { code: 'SERVICE_OPERATION_SOURCE_DRIFT' },
    ),
  ));
  return Object.freeze({
    verify: async () => {
      await assertOperationClosureCommittedClean(expectedCommit);
      for (const anchor of anchors) await anchor.verify();
      await verifyDr133PgDependencyClosure();
      return true;
    },
  });
}

export async function preflightDr133RailwayProductionTunnelSourceCustody(
  rawOptions = {},
) {
  if (!ownDataProperties(rawOptions)
    || Reflect.ownKeys(rawOptions).some(
      (key) => typeof key !== 'string' || key !== 'sourceCommit',
    )) fail('SOURCE_CUSTODY_PREFLIGHT_OPTIONS_INVALID');
  const sourceCommit = rawOptions.sourceCommit;
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/u.test(sourceCommit)) {
    fail('SOURCE_COMMIT_INVALID');
  }
  const verifier = await createOperationSourceVerifier({ expectedCommit: sourceCommit });
  await verifier.verify();
  return Object.freeze({
    contract: DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT,
    result: 'SOURCE_CUSTODY_VERIFIED',
    sourceCommit,
    trackedPathCount: DR133_OPERATION_CLOSURE_PATHS.length,
    dependencyPackageCount: PG_PACKAGE_CLOSURE.length,
  });
}

async function createNodeVerifier() {
  const executablePath = safeAbsolutePath(process.execPath, 'NODE_EXECUTABLE_DRIFT');
  if (executablePath !== NODE_BINARY || path.basename(executablePath) !== 'node') {
    fail('NODE_EXECUTABLE_DRIFT');
  }
  const verify = async () => {
    for (const [filePath, sha256, expectedNlink] of [
      [NODE_BINARY, NODE_BINARY_SHA256, 1n],
      [ENV_BINARY, ENV_BINARY_SHA256, 1n],
      [PYTHON_BINARY, PYTHON_BINARY_SHA256, PYTHON_BINARY_NLINK],
      [PYTHON_RUNTIME_BINARY, PYTHON_RUNTIME_BINARY_SHA256, 1n],
    ]) {
      const checked = await readPinnedFile(filePath, sha256, {
        expectedMode: 0o755,
        expectedUid: 0n,
        expectedGid: 0n,
        expectedNlink,
      });
      checked.bytes.fill(0);
    }
    try {
      const linked = await lstat(PYTHON_TOOLCHAIN_ENTRY, { bigint: true });
      if (!linked.isSymbolicLink()
        || await realpath(PYTHON_TOOLCHAIN_ENTRY) !== PYTHON_RUNTIME_BINARY
        || await readlink(PYTHON_TOOLCHAIN_ENTRY) !== '../../Library/Frameworks/Python3.framework/Versions/3.9/bin/python3') {
        fail('NODE_EXECUTABLE_DRIFT');
      }
    } catch (error) {
      if (error instanceof Dr133ProductionTunnelOperationError) throw error;
      fail('NODE_EXECUTABLE_DRIFT');
    }
    return true;
  };
  await verify();
  return Object.freeze({ verify, directory: path.dirname(executablePath) });
}

export async function verifyDr133ProductionPinnedToolchain() {
  const verifier = await createNodeVerifier();
  await verifier.verify();
  return true;
}

async function verifySshAgentSession(session) {
  try {
    if (await session.verify() !== true) fail('SSH_AGENT_IDENTITY_REJECTED');
  } catch (error) {
    if (error instanceof Dr133ProductionTunnelOperationError
      && error.code === 'SSH_AGENT_IDENTITY_REJECTED') throw error;
    fail('SSH_AGENT_IDENTITY_REJECTED');
  }
}

async function allocateLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = createServer({ pauseOnConnect: true });
    let settled = false;
    const finish = (error, port) => {
      if (settled) return;
      settled = true;
      if (!server.listening) {
        if (error) reject(error);
        else resolve(port);
        return;
      }
      server.close(() => (error ? reject(error) : resolve(port)));
    };
    server.once('error', (error) => finish(error));
    server.listen({ host: DR133_TUNNEL_HOST, port: 0, exclusive: true }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') finish(new Error('port allocation failed'));
      else finish(null, address.port);
    });
  }).catch(() => fail('TUNNEL_PORT_ALLOCATION_FAILED'));
}

async function probeLoopbackPort(port, timeoutMs) {
  requiredPort(port);
  return await new Promise((resolve) => {
    let settled = false;
    const socket = createConnection({ host: DR133_TUNNEL_HOST, port });
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

function sleep(ms, { signal } = {}) {
  return new Promise((resolve) => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    if (signal?.aborted) {
      finish();
      return;
    }
    timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

function signalProcessGroup(pid, signal) {
  if (!Number.isSafeInteger(pid) || pid < 1 || !['SIGINT', 'SIGTERM', 'SIGKILL'].includes(signal)) {
    return false;
  }
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

function isProcessGroupAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ESRCH') return false;
    return null;
  }
}

function childState(child, { captureOutput }) {
  const pid = child?.pid;
  if (!Number.isSafeInteger(pid) || pid < 1 || typeof child.once !== 'function') {
    fail('CHILD_START_FAILED');
  }
  let resolveClose;
  let resolveFault;
  const state = {
    child,
    pid,
    closed: false,
    code: null,
    signal: null,
    processError: false,
    stdoutBytes: 0,
    stderrBytes: 0,
    chunks: [],
    close: new Promise((resolve) => { resolveClose = resolve; }),
    fault: new Promise((resolve) => { resolveFault = resolve; }),
  };
  child.once('error', () => {
    state.processError = true;
    resolveFault('CHILD_PROCESS_ERROR');
  });
  child.once('close', (code, signal) => {
    state.closed = true;
    state.code = Number.isInteger(code) ? code : null;
    state.signal = typeof signal === 'string' ? signal : null;
    resolveClose(state);
  });
  if (captureOutput) {
    if (!child.stdout || !child.stderr
      || typeof child.stdout.on !== 'function' || typeof child.stderr.on !== 'function') {
      fail('CHILD_STREAM_INVALID');
    }
    child.stdout.on('data', (value) => {
      const chunk = Buffer.from(value);
      state.stdoutBytes += chunk.length;
      if (state.stdoutBytes > MAX_RECEIPT_BYTES) {
        chunk.fill(0);
        resolveFault('SERVICE_OUTPUT_OVERFLOW');
      } else {
        state.chunks.push(chunk);
      }
    });
    child.stderr.on('data', (value) => {
      state.stderrBytes += Buffer.byteLength(value);
      if (Buffer.isBuffer(value)) value.fill(0);
      resolveFault('SERVICE_STDERR_REJECTED');
    });
    child.stdout.once('error', () => resolveFault('SERVICE_STDOUT_ERROR'));
    child.stderr.once('error', () => resolveFault('SERVICE_STDERR_ERROR'));
  }
  return state;
}

function zeroCapturedOutput(state) {
  for (const chunk of state?.chunks ?? []) chunk.fill(0);
  if (state) state.chunks.length = 0;
}

async function waitOrTimeout(promise, timeoutMs, sleepFn) {
  const timeoutCancellation = new AbortController();
  try {
    return await Promise.race([
      promise.then((value) => ({ kind: 'event', value })),
      sleepFn(timeoutMs, { signal: timeoutCancellation.signal })
        .then(() => ({ kind: 'timeout' })),
    ]);
  } finally {
    timeoutCancellation.abort();
  }
}

async function terminateChild(state, dependencies, { firstSignal }) {
  if (!state) return true;
  const groupEmpty = async (waitMs) => {
    const attempts = Math.max(
      1,
      Math.ceil(waitMs / dependencies.timings.processGroupProbeDelayMs),
    );
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let alive;
      try {
        alive = await dependencies.isProcessGroupAlive(state.pid);
      } catch {
        return false;
      }
      if (alive === false) return true;
      if (alive !== true) return false;
      if (attempt + 1 < attempts) {
        await dependencies.sleep(dependencies.timings.processGroupProbeDelayMs);
      }
    }
    return false;
  };
  const fullyReaped = async (waitMs) => {
    if (!await groupEmpty(waitMs)) return false;
    if (state.closed) return true;
    const waited = await waitOrTimeout(state.close, waitMs, dependencies.sleep);
    return waited.kind === 'event' && state.closed;
  };
  if (await fullyReaped(0)) return true;
  for (const [signal, waitMs] of [
    [firstSignal, dependencies.timings.shutdownGraceMs],
    ['SIGTERM', dependencies.timings.shutdownGraceMs],
    ['SIGKILL', dependencies.timings.killGraceMs],
  ]) {
    dependencies.signalProcessGroup(state.pid, signal);
    if (await fullyReaped(waitMs)) return true;
  }
  return false;
}

async function waitForTunnelReady(tunnel, port, dependencies) {
  for (let attempt = 0; attempt < dependencies.timings.startupAttempts; attempt += 1) {
    if (tunnel.closed || tunnel.processError) fail('TUNNEL_START_FAILED');
    let ready = false;
    try {
      ready = await dependencies.probeLoopbackPort(
        port,
        dependencies.timings.probeTimeoutMs,
      );
    } catch {
      fail('TUNNEL_READINESS_UNKNOWN');
    }
    if (ready) {
      await dependencies.sleep(dependencies.timings.startupStabilityMs);
      if (tunnel.closed || tunnel.processError) fail('TUNNEL_START_FAILED');
      try {
        if (await dependencies.probeLoopbackPort(
          port,
          dependencies.timings.probeTimeoutMs,
        )) return true;
      } catch {
        fail('TUNNEL_READINESS_UNKNOWN');
      }
    }
    await dependencies.sleep(dependencies.timings.startupDelayMs);
  }
  fail('TUNNEL_READINESS_TIMEOUT');
}

async function provePortClosed(port, dependencies) {
  for (let attempt = 0; attempt < dependencies.timings.portClosureAttempts; attempt += 1) {
    let open;
    try {
      open = await dependencies.probeLoopbackPort(port, dependencies.timings.probeTimeoutMs);
    } catch {
      return false;
    }
    if (!open) return true;
    await dependencies.sleep(dependencies.timings.portClosureDelayMs);
  }
  return false;
}

async function runCapturedOperation({
  binaryPath,
  environment,
  mode,
  tunnel,
}, dependencies) {
  let child;
  try {
    child = dependencies.spawnProcess(binaryPath, dr133ServiceOperationCommandArgs(
      mode,
      Number(environment.LOR_DR133_TUNNEL_PORT),
    ), {
      cwd: REPOSITORY_ROOT,
      env: environment,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail('SERVICE_OPERATION_NOT_STARTED');
  }
  const operation = childState(child, { captureOutput: true });
  const timeoutMs = dependencies.operationTimeoutMs(mode);
  const timeoutCancellation = new AbortController();
  let raced;
  try {
    raced = await Promise.race([
      operation.close.then(() => ({ kind: 'operation-close' })),
      operation.fault.then((code) => ({ kind: 'operation-fault', code })),
      tunnel.close.then(() => ({ kind: 'tunnel-close' })),
      dependencies.sleep(timeoutMs, { signal: timeoutCancellation.signal })
        .then(() => ({ kind: 'operation-timeout' })),
    ]);
  } finally {
    timeoutCancellation.abort();
  }
  if (raced.kind !== 'operation-close') {
    const reaped = await terminateChild(operation, dependencies, { firstSignal: 'SIGINT' });
    zeroCapturedOutput(operation);
    if (!reaped) fail('SERVICE_CHILD_UNCERTAIN');
    if (raced.kind === 'tunnel-close') fail('TUNNEL_LOST_DURING_OPERATION');
    if (raced.kind === 'operation-timeout') fail('SERVICE_OPERATION_TIMEOUT_UNKNOWN');
    fail(raced.code ?? 'SERVICE_OPERATION_OUTCOME_UNKNOWN');
  }
  if (!await terminateChild(operation, dependencies, { firstSignal: 'SIGINT' })) {
    zeroCapturedOutput(operation);
    fail('SERVICE_CHILD_UNCERTAIN');
  }
  if (operation.processError || operation.signal !== null
    || ![0, 1].includes(operation.code) || operation.stderrBytes !== 0) {
    zeroCapturedOutput(operation);
    fail('SERVICE_OPERATION_OUTCOME_UNKNOWN');
  }
  const bytes = Buffer.concat(operation.chunks);
  zeroCapturedOutput(operation);
  try {
    return validateDr133TunnelServiceReceipt(bytes, mode, operation.code);
  } catch (error) {
    if (error instanceof Dr133ProductionTunnelOperationError) throw error;
    fail('SERVICE_RECEIPT_INVALID');
  } finally {
    bytes.fill(0);
  }
}

function normalizeDependencies(rawDependencies = {}) {
  if (!plain(rawDependencies)
    || Reflect.ownKeys(rawDependencies).some(
      (key) => typeof key !== 'string' || !DEPENDENCY_KEYS.has(key),
    )) fail('DEPENDENCIES_INVALID');
  const timings = Object.freeze({
    ...DEFAULT_TIMINGS,
    ...(rawDependencies.timings ?? {}),
  });
  if (!plain(rawDependencies.timings ?? {})
    || Object.keys(rawDependencies.timings ?? {}).some(
      (key) => !Object.hasOwn(DEFAULT_TIMINGS, key),
    )
    || Object.values(timings).some((value) => !Number.isSafeInteger(value) || value < 0)
    || timings.startupAttempts < 1 || timings.portClosureAttempts < 1
    || timings.probeTimeoutMs < 1 || timings.shutdownGraceMs < 1 || timings.killGraceMs < 1
    || timings.processGroupProbeDelayMs < 1) {
    fail('TIMINGS_INVALID');
  }
  const dependencies = {
    allocatePort: allocateLoopbackPort,
    cleanupWorkspace,
    createNodeVerifier,
    createOperationSourceVerifier,
    createSshAgentVerifier: createDr133DedicatedRailwaySshAgentVerifier,
    createWorkspace,
    isProcessGroupAlive,
    operationTimeoutMs: (mode) => DEFAULT_OPERATION_TIMEOUTS[mode],
    probeLoopbackPort,
    signalProcessGroup,
    sleep,
    spawnProcess: spawn,
    stageRailwayBinary: stagePinnedRailwayBinary,
    verifySshTransportBinary: verifyPinnedSshTransportBinary,
    ...rawDependencies,
    timings,
  };
  for (const key of DEPENDENCY_KEYS) {
    if (key !== 'timings' && typeof dependencies[key] !== 'function') fail('DEPENDENCIES_INVALID');
  }
  return Object.freeze(dependencies);
}

export function createDr133RailwayProductionTunnelExecutor(rawDependencies = {}) {
  const dependencies = normalizeDependencies(rawDependencies);
  return async (rawOptions = {}) => {
    if (!ownDataProperties(rawOptions)
      || Reflect.ownKeys(rawOptions).some(
        (key) => typeof key !== 'string' || !OPTION_KEYS.has(key),
      )) fail('OPTIONS_INVALID');
    const mode = requiredMode(rawOptions.mode);
    const sourceCommit = rawOptions.sourceCommit;
    if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/u.test(sourceCommit)) {
      fail('SOURCE_COMMIT_INVALID');
    }
    const rawEnvironment = rawOptions.environment ?? process.env;
    const token = safeToken(rawEnvironment);
    let databaseCa;
    try {
      databaseCa = verifiedDr133DatabaseCa(rawOptions.databaseCa);
    } catch {
      fail('DATABASE_CA_REJECTED');
    }
    const runtimeDatabaseUrl = safeRuntimeUrl(rawOptions.runtimeDatabaseUrl, mode);
    let workspace;
    let stagedBinary;
    let sshAgent;
    let operationSource;
    let nodeVerifier;
    let tunnel;
    let operationDispatched = false;
    let safeReceipt = null;
    const safeReceipts = [];
    let primaryError = null;
    let port = null;
    try {
      workspace = await dependencies.createWorkspace(rawEnvironment);
      stagedBinary = await dependencies.stageRailwayBinary(workspace);
      operationSource = await dependencies.createOperationSourceVerifier({
        expectedCommit: sourceCommit,
      });
      nodeVerifier = await dependencies.createNodeVerifier();
      try {
        sshAgent = await dependencies.createSshAgentVerifier({
          environment: rawEnvironment,
          cwd: workspace.root,
        });
      } catch {
        fail('SSH_AGENT_IDENTITY_REJECTED');
      }
      if (!plain(stagedBinary) || typeof stagedBinary.path !== 'string'
        || typeof stagedBinary.verify !== 'function'
        || !plain(operationSource) || typeof operationSource.verify !== 'function'
        || !plain(nodeVerifier) || typeof nodeVerifier.verify !== 'function'
        || typeof nodeVerifier.directory !== 'string'
        || !plain(sshAgent) || typeof sshAgent.socketPath !== 'string'
        || typeof sshAgent.verify !== 'function') fail('CUSTODY_SESSION_INVALID');
      await stagedBinary.verify();
      await operationSource.verify();
      await nodeVerifier.verify();
      await dependencies.verifySshTransportBinary();
      await verifySshAgentSession(sshAgent);
      port = requiredPort(await dependencies.allocatePort());
      if (await dependencies.probeLoopbackPort(port, dependencies.timings.probeTimeoutMs)) {
        fail('TUNNEL_PORT_NOT_FREE');
      }
      const childEnvironments = buildDr133TunnelChildEnvironments({
        databaseCa,
        mode,
        nodeDirectory: nodeVerifier.directory,
        port,
        runtimeDatabaseUrl,
        socketPath: sshAgent.socketPath,
        token,
        workspace,
      });
      let child;
      try {
        child = dependencies.spawnProcess(stagedBinary.path, dr133TunnelCommandArgs(port), {
          cwd: REPOSITORY_ROOT,
          env: childEnvironments.tunnel,
          shell: false,
          detached: true,
          stdio: ['ignore', 'ignore', 'ignore'],
        });
      } catch {
        fail('TUNNEL_NOT_STARTED');
      }
      tunnel = childState(child, { captureOutput: false });
      await waitForTunnelReady(tunnel, port, dependencies);
      await stagedBinary.verify();
      await operationSource.verify();
      await nodeVerifier.verify();
      await dependencies.verifySshTransportBinary();
      await verifySshAgentSession(sshAgent);
      operationDispatched = true;
      const runRuntimeLoginCleanup = async () => {
        const cleanupEnvironment = buildDr133TunnelChildEnvironments({
          databaseCa,
          mode: 'runtime-login-deprovision',
          nodeDirectory: nodeVerifier.directory,
          port,
          runtimeDatabaseUrl: null,
          socketPath: sshAgent.socketPath,
          token,
          workspace,
        }).operation;
        const cleanupReceipt = await runCapturedOperation({
          binaryPath: stagedBinary.path,
          environment: cleanupEnvironment,
          mode: 'runtime-login-deprovision',
          tunnel,
        }, dependencies);
        safeReceipts.push(cleanupReceipt);
        safeReceipt = cleanupReceipt;
        return cleanupReceipt;
      };
      try {
        safeReceipt = await runCapturedOperation({
          binaryPath: stagedBinary.path,
          environment: childEnvironments.operation,
          mode,
          tunnel,
        }, dependencies);
      } catch (error) {
        if (mode !== 'runtime-login'
          || (error instanceof Dr133ProductionTunnelOperationError
            && error.code === 'SERVICE_OPERATION_NOT_STARTED')) throw error;
        if (error instanceof Dr133ProductionTunnelOperationError
          && error.code === 'SERVICE_CHILD_UNCERTAIN') {
          throw new Dr133ProductionTunnelOperationError(
            'RUNTIME_LOGIN_CLEANUP_UNPROVEN',
            safeReceipt,
            safeReceipts,
          );
        }
        let cleanupReceipt;
        try {
          cleanupReceipt = await runRuntimeLoginCleanup();
        } catch {
          throw new Dr133ProductionTunnelOperationError(
            'RUNTIME_LOGIN_CLEANUP_UNPROVEN',
            safeReceipt,
            safeReceipts,
          );
        }
        if (SUCCESS_RESULTS['runtime-login-deprovision'].has(cleanupReceipt.result)) {
          throw new Dr133ProductionTunnelOperationError(
            'RUNTIME_LOGIN_OUTCOME_UNKNOWN_DEPROVISIONED',
            cleanupReceipt,
            safeReceipts,
          );
        }
        throw new Dr133ProductionTunnelOperationError(
          'RUNTIME_LOGIN_CLEANUP_UNPROVEN',
          cleanupReceipt,
          safeReceipts,
        );
      }
      safeReceipts.push(safeReceipt);
      await stagedBinary.verify();
      await operationSource.verify();
      await nodeVerifier.verify();
      await dependencies.verifySshTransportBinary();
      await verifySshAgentSession(sshAgent);
      if (mode === 'runtime-login' && !SUCCESS_RESULTS[mode].has(safeReceipt.result)
        && !['NO_MUTATION', 'RUNTIME_LOGIN_ROLLED_BACK'].includes(safeReceipt.result)) {
        let cleanupReceipt;
        try {
          cleanupReceipt = await runRuntimeLoginCleanup();
        } catch {
          throw new Dr133ProductionTunnelOperationError(
            'RUNTIME_LOGIN_CLEANUP_UNPROVEN',
            safeReceipt,
            safeReceipts,
          );
        }
        if (SUCCESS_RESULTS['runtime-login-deprovision'].has(cleanupReceipt.result)) {
          throw new Dr133ProductionTunnelOperationError(
            'RUNTIME_LOGIN_REJECTED_DEPROVISIONED',
            cleanupReceipt,
            safeReceipts,
          );
        }
        throw new Dr133ProductionTunnelOperationError(
          'RUNTIME_LOGIN_CLEANUP_UNPROVEN',
          cleanupReceipt,
          safeReceipts,
        );
      }
      if (!SUCCESS_RESULTS[mode].has(safeReceipt.result)) {
        fail('SERVICE_OPERATION_REJECTED', safeReceipt);
      }
    } catch (error) {
      primaryError = error instanceof Dr133ProductionTunnelOperationError
        ? error : new Dr133ProductionTunnelOperationError(
          operationDispatched ? 'SERVICE_OPERATION_OUTCOME_UNKNOWN' : 'TUNNEL_EXECUTOR_FAILED_CLOSED',
          safeReceipt,
          safeReceipts,
        );
    } finally {
      if (tunnel) {
        const reaped = await terminateChild(tunnel, dependencies, { firstSignal: 'SIGINT' });
        const closed = port !== null && await provePortClosed(port, dependencies);
        if (!reaped || !closed) {
          primaryError = new Dr133ProductionTunnelOperationError(
            'TUNNEL_CHILD_UNCERTAIN',
            safeReceipt ?? primaryError?.safeReceipt ?? null,
            safeReceipts.length > 0 ? safeReceipts : primaryError?.safeReceipts,
          );
        }
      }
      for (const verify of [
        stagedBinary?.verify,
        operationSource?.verify,
        nodeVerifier?.verify,
        dependencies.verifySshTransportBinary,
        sshAgent?.verify,
      ]) {
        if (typeof verify !== 'function') continue;
        try {
          await verify();
        } catch {
          primaryError ??= new Dr133ProductionTunnelOperationError(
            operationDispatched ? 'CUSTODY_DRIFT_AFTER_OPERATION' : 'CUSTODY_DRIFT',
            safeReceipt,
            safeReceipts,
          );
        }
      }
      if (workspace) {
        try {
          await dependencies.cleanupWorkspace(workspace);
        } catch {
          primaryError ??= new Dr133ProductionTunnelOperationError(
            operationDispatched ? 'CLEANUP_FAILED_AFTER_OPERATION' : 'CLEANUP_FAILED',
            safeReceipt,
            safeReceipts,
          );
        }
      }
    }
    if (primaryError) throw primaryError;
    return safeReceipt;
  };
}

const defaultExecutor = createDr133RailwayProductionTunnelExecutor();

export async function runDr133RailwayProductionTunnelOperation(rawOptions = {}) {
  return await defaultExecutor(rawOptions);
}

async function main() {
  let receipt;
  try {
    const mode = process.env.LOR_DR133_MODE;
    receipt = await runDr133RailwayProductionTunnelOperation({
      databaseCa: process.env.LOR_DR133_RUNTIME_DATABASE_CA,
      environment: process.env,
      mode,
      sourceCommit: process.env.LOR_DR133_SOURCE_COMMIT,
      ...(mode === 'runtime-login' && process.env.LOR_DR133_RUNTIME_DATABASE_URL
        ? { runtimeDatabaseUrl: process.env.LOR_DR133_RUNTIME_DATABASE_URL }
        : {}),
    });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    if (error instanceof Dr133ProductionTunnelOperationError) {
      for (const safeReceipt of error.safeReceipts) {
        process.stdout.write(`${JSON.stringify(safeReceipt)}\n`);
      }
    }
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
