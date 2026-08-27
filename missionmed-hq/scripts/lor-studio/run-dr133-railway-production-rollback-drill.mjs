import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_SUCCESSOR_STAGES,
  DR133_TARGET,
  assertFoundationSentinelRow,
  classifySafeFailure,
  extractRollbackGuardVerificationSql,
  extractSuccessorRollbackGuardVerificationSql,
  failDr133,
  parsePrivateDatabaseUrl,
  postgresOutcomeIsUnknown,
  rewriteDr133TunnelConnectionString,
  sha256Bytes,
  targetGucEntries,
  verifiedDr133DatabaseCa,
} from './railway-dr133-production-runner-core.mjs';
import {
  DR133_ADVISORY_LOCK_SQL,
  DR133_ADVISORY_UNLOCK_SQL,
  DR133_FOUNDATION_SENTINEL_SQL,
  DR133_SUCCESSOR_PREFLIGHT_SQL,
  classifyDr133ProductionSchemaCursor,
} from './run-dr133-railway-production-migrations.mjs';

const { Client } = pg;

export const DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT =
  'missionmed.lor.railway-dr133-production-rollback-drill.v1';

const DR133_ROLLBACK_DRILL_MODE = 'rollback-drill';
const DR133_ROLLBACK_ORDER = Object.freeze([
  ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => stage.rollbackId),
  'rls-rollback',
  'foundation-rollback',
]);
const DR133_EXPECTED_ARTIFACT_COUNT = 20;
const DR133_EXPECTED_RELATION_COUNT = 36;
const DR133_EXPECTED_ROLLBACK_COUNT = 10;
const DR133_ROLLBACK_DRILL_ENV_KEYS = Object.freeze([
  'LOR_DR133_ADMIN_DATABASE_URL',
  'LOR_DR133_MODE',
  'LOR_DR133_RUNTIME_DATABASE_CA',
  'LOR_DR133_TUNNEL_HOST',
  'LOR_DR133_TUNNEL_PORT',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_ENVIRONMENT_NAME',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
]);
const SAFE_CODE_PATTERN = /^[A-Z0-9_]{3,80}$/u;
const POSTGRES_CODE_PATTERN = /^[0-9A-Z]{5}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

const ARTIFACT_RECEIPT_KEYS = Object.freeze({
  foundation: 'foundationSha256',
  rls: 'rlsSha256',
  'foundation-rollback': 'foundationRollbackSha256',
  'rls-rollback': 'rlsRollbackSha256',
  'identity-scope': 'identityScopeSha256',
  'identity-scope-rollback': 'identityScopeRollbackSha256',
  'faculty-invitation': 'facultyInvitationSha256',
  'faculty-invitation-rollback': 'facultyInvitationRollbackSha256',
  'faculty-private-export': 'facultyPrivateExportSha256',
  'faculty-private-export-rollback': 'facultyPrivateExportRollbackSha256',
  'ai-proposal': 'aiProposalSha256',
  'ai-proposal-rollback': 'aiProposalRollbackSha256',
  'student-evidence': 'studentEvidenceSha256',
  'student-evidence-rollback': 'studentEvidenceRollbackSha256',
  'encrypted-private-storage': 'encryptedPrivateStorageSha256',
  'encrypted-private-storage-rollback': 'encryptedPrivateStorageRollbackSha256',
  'faculty-candidate-auth-handoff': 'facultyCandidateAuthHandoffSha256',
  'faculty-candidate-auth-handoff-rollback':
    'facultyCandidateAuthHandoffRollbackSha256',
  'mentor-assignment': 'mentorAssignmentSha256',
  'mentor-assignment-rollback': 'mentorAssignmentRollbackSha256',
});

const RECEIPT_KEYS = new Set([
  'contract',
  'mode',
  'result',
  'runnerCode',
  'postgresCode',
  'postgresMajor',
  'relationCount',
  'rollbackCount',
  'verifiedArtifactCount',
  ...Object.values(ARTIFACT_RECEIPT_KEYS),
]);

const RECEIPT_RESULTS = new Set([
  'NO_MUTATION',
  'ROLLBACK_PROGRESS_PRESERVED',
  'ROLLBACK_PROGRESS_OUTCOME_UNKNOWN',
  'ROLLBACK_DRILL_COMMITTED_POSTFLIGHT_REJECTED',
  'ROLLBACK_DRILL_COMMITTED_VERIFICATION_UNKNOWN',
  'ROLLBACK_DRILL_COMMITTED_VERIFIED_CLEANUP_FAILED',
  'ROLLBACK_DRILL_COMMITTED_VERIFIED',
]);

export const DR133_ROLLBACK_DRILL_ABSENCE_SQL = `
/* missionmed:dr133:production-rollback-drill-absence */
SELECT
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'
  ) AS schema_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname LIKE 'lor\\_studio\\_%' ESCAPE '\\'
  ) AS role_count
`;

export const DR133_ROLLBACK_DRILL_EMPTY_RELATIONS_SQL = `
/* missionmed:dr133:production-rollback-drill-empty-relations */
DO $empty_relations_guard$
DECLARE
  relation record;
  relation_has_rows boolean;
BEGIN
  FOR relation IN
    SELECT namespace.nspname, class.relname
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relkind IN ('r', 'p')
    ORDER BY class.relname COLLATE "C"
  LOOP
    EXECUTE pg_catalog.format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I)',
      relation.nspname,
      relation.relname
    ) INTO relation_has_rows;
    IF relation_has_rows THEN
      RAISE EXCEPTION 'DR-133 rollback requires every current LOR relation to be empty'
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END
$empty_relations_guard$;
`;

function requiredString(value, code) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 4_096
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) failDr133(code);
  return value;
}

function assertExact(value, expected, code) {
  if (requiredString(value, code) !== expected) failDr133(code);
}

export function resolveDr133RollbackDrillEnvironment(rawEnvironment) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') failDr133('ENVIRONMENT_REQUIRED');
  for (const key of DR133_ROLLBACK_DRILL_ENV_KEYS) {
    if (key !== 'LOR_DR133_RUNTIME_DATABASE_CA') {
      requiredString(rawEnvironment[key], `${key}_REQUIRED`);
    }
  }
  const observedLorKeys = Object.keys(rawEnvironment)
    .filter((key) => key.startsWith('LOR_DR133_'))
    .sort();
  const expectedLorKeys = DR133_ROLLBACK_DRILL_ENV_KEYS
    .filter((key) => key.startsWith('LOR_DR133_'))
    .sort();
  if (JSON.stringify(observedLorKeys) !== JSON.stringify(expectedLorKeys)) {
    failDr133('UNEXPECTED_LOR_ENVIRONMENT_KEY');
  }

  assertExact(rawEnvironment.LOR_DR133_MODE, DR133_ROLLBACK_DRILL_MODE, 'MODE_MISMATCH');
  assertExact(rawEnvironment.RAILWAY_PROJECT_ID, DR133_TARGET.projectId, 'PROJECT_ID_MISMATCH');
  assertExact(
    rawEnvironment.RAILWAY_ENVIRONMENT_ID,
    DR133_TARGET.environmentId,
    'ENVIRONMENT_ID_MISMATCH',
  );
  assertExact(
    rawEnvironment.RAILWAY_ENVIRONMENT_NAME,
    DR133_TARGET.environmentName,
    'ENVIRONMENT_NAME_MISMATCH',
  );
  assertExact(
    rawEnvironment.RAILWAY_SERVICE_ID,
    DR133_TARGET.executionServiceId,
    'EXECUTION_SERVICE_ID_MISMATCH',
  );
  const admin = parsePrivateDatabaseUrl(
    rawEnvironment.LOR_DR133_ADMIN_DATABASE_URL,
    DR133_TARGET.databaseAdmin,
  );
  const tunnel = rewriteDr133TunnelConnectionString(
    admin.pgConnectionString,
    rawEnvironment.LOR_DR133_TUNNEL_HOST,
    rawEnvironment.LOR_DR133_TUNNEL_PORT,
  );
  const databaseCa = verifiedDr133DatabaseCa(
    rawEnvironment.LOR_DR133_RUNTIME_DATABASE_CA,
  );
  return Object.freeze({
    adminPgConnectionString: tunnel.connectionString,
    databaseCa,
    databaseTlsServername: tunnel.tlsServername,
    tunnelHost: tunnel.tunnelHost,
    tunnelPort: tunnel.tunnelPort,
  });
}

function artifactById(artifacts, id) {
  const artifact = artifacts.get(id);
  if (!artifact) failDr133('ROLLBACK_ARTIFACT_INVENTORY_INVALID');
  return artifact;
}

async function loadVerifiedArtifacts(readFileFn) {
  if (typeof readFileFn !== 'function') failDr133('ARTIFACT_READER_INVALID');
  if (
    DR133_ARTIFACTS.length !== DR133_EXPECTED_ARTIFACT_COUNT
    || DR133_RELATIONS.length !== DR133_EXPECTED_RELATION_COUNT
    || Object.keys(ARTIFACT_RECEIPT_KEYS).length !== DR133_ARTIFACTS.length
    || new Set(DR133_ARTIFACTS.map((artifact) => artifact.id)).size
      !== DR133_EXPECTED_ARTIFACT_COUNT
    || DR133_ROLLBACK_ORDER.length !== DR133_EXPECTED_ROLLBACK_COUNT
    || new Set(DR133_ROLLBACK_ORDER).size !== DR133_EXPECTED_ROLLBACK_COUNT
  ) failDr133('ROLLBACK_ARTIFACT_INVENTORY_INVALID');

  const artifacts = new Map();
  for (const contract of DR133_ARTIFACTS) {
    let bytes;
    try {
      bytes = await readFileFn(new URL(contract.relativePath, import.meta.url));
    } catch {
      failDr133('ARTIFACT_READ_FAILED');
    }
    if (!(bytes instanceof Uint8Array) || sha256Bytes(bytes) !== contract.sha256) {
      failDr133('ARTIFACT_HASH_MISMATCH');
    }
    artifacts.set(contract.id, Object.freeze({
      contract,
      bytes: Buffer.from(bytes),
    }));
  }

  for (const rollbackId of DR133_ROLLBACK_ORDER) {
    const source = artifactById(artifacts, rollbackId).bytes.toString('utf8');
    if (
      /\bCASCADE\b/iu.test(source)
      || /\bDROP\s+OWNED\b/iu.test(source)
      || /\bREASSIGN\s+OWNED\b/iu.test(source)
    ) failDr133('ROLLBACK_DESTRUCTIVE_SCOPE_INVALID');
  }

  const guards = new Map();
  for (const stage of DR133_SUCCESSOR_STAGES) {
    const source = artifactById(artifacts, stage.rollbackId).bytes.toString('utf8');
    guards.set(
      stage.rollbackId,
      extractSuccessorRollbackGuardVerificationSql(source, stage.rollbackId),
    );
  }
  guards.set(
    'rls-rollback',
    extractRollbackGuardVerificationSql(
      artifactById(artifacts, 'rls-rollback').bytes.toString('utf8'),
    ),
  );
  return Object.freeze({ artifacts, guards });
}

function artifactReceiptHashes() {
  return Object.fromEntries(DR133_ARTIFACTS.map((artifact) => [
    ARTIFACT_RECEIPT_KEYS[artifact.id],
    artifact.sha256,
  ]));
}

function writeSafeReceipt(stream, payload) {
  if (!stream || typeof stream.write !== 'function') failDr133('OUTPUT_STREAM_INVALID');
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))
    || Object.keys(payload).some((key) => !RECEIPT_KEYS.has(key))
    || payload.contract !== DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT
    || payload.mode !== DR133_ROLLBACK_DRILL_MODE
    || !RECEIPT_RESULTS.has(payload.result)
    || !Number.isSafeInteger(payload.verifiedArtifactCount)
    || payload.verifiedArtifactCount < 0
    || payload.verifiedArtifactCount > DR133_EXPECTED_ARTIFACT_COUNT
    || !Number.isSafeInteger(payload.rollbackCount)
    || payload.rollbackCount < 0
    || payload.rollbackCount > DR133_EXPECTED_ROLLBACK_COUNT
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.runnerCode !== undefined
    && (typeof payload.runnerCode !== 'string' || !SAFE_CODE_PATTERN.test(payload.runnerCode))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.postgresCode !== undefined
    && payload.postgresCode !== null
    && (
      typeof payload.postgresCode !== 'string'
      || !POSTGRES_CODE_PATTERN.test(payload.postgresCode)
    )
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  for (const key of Object.values(ARTIFACT_RECEIPT_KEYS)) {
    if (payload[key] !== undefined && !SHA256_PATTERN.test(payload[key])) {
      failDr133('OUTPUT_RECEIPT_INVALID');
    }
  }
  if (
    payload.postgresMajor !== undefined
    && ![16, 18].includes(payload.postgresMajor)
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.relationCount !== undefined
    && payload.relationCount !== DR133_RELATIONS.length
  ) failDr133('OUTPUT_RECEIPT_INVALID');

  const success = payload.result === 'ROLLBACK_DRILL_COMMITTED_VERIFIED';
  if (success) {
    if (
      payload.runnerCode !== undefined
      || payload.postgresCode !== undefined
      || payload.verifiedArtifactCount !== DR133_EXPECTED_ARTIFACT_COUNT
      || payload.rollbackCount !== DR133_EXPECTED_ROLLBACK_COUNT
      || ![16, 18].includes(payload.postgresMajor)
      || payload.relationCount !== DR133_EXPECTED_RELATION_COUNT
      || Object.values(ARTIFACT_RECEIPT_KEYS).some((key) => !payload[key])
    ) failDr133('OUTPUT_RECEIPT_INVALID');
  } else if (
    typeof payload.runnerCode !== 'string'
    || !Object.hasOwn(payload, 'postgresCode')
  ) failDr133('OUTPUT_RECEIPT_INVALID');

  stream.write(`${JSON.stringify(payload)}\n`);
}

function rollbackStartIndex(cursor) {
  if (cursor.state === 'absent') return DR133_ROLLBACK_ORDER.length;
  if (cursor.state === 'foundation') return DR133_ROLLBACK_ORDER.length - 1;
  if (cursor.state === 'committed') {
    return DR133_SUCCESSOR_STAGES.length - cursor.successorStageIndex;
  }
  failDr133('ROLLBACK_SCHEMA_CURSOR_INVALID');
}

function sameCursor(left, right) {
  return left.state === right.state
    && left.successorStageIndex === right.successorStageIndex;
}

function assertAbsentPostflightRow(row) {
  if (!row || row.schema_count !== '0' || row.role_count !== '0') {
    failDr133('ROLLBACK_POSTFLIGHT_CATALOG_INVALID');
  }
}

async function closeClientFailClosed(client, state) {
  if (!client || !state.connected) return null;
  let cleanupError = null;
  if (state.locked) {
    try {
      const result = await client.query(DR133_ADVISORY_UNLOCK_SQL);
      if (result.rows?.[0]?.released !== true) failDr133('ADVISORY_UNLOCK_FAILED');
      state.locked = false;
    } catch (error) {
      cleanupError = error;
    }
  }
  try {
    await client.end();
    state.connected = false;
  } catch (error) {
    cleanupError ??= error;
  }
  return cleanupError;
}

function failureResult(stage, error, rollbackCount) {
  if (stage === 'POSTFLIGHT_VERIFIED') {
    return 'ROLLBACK_DRILL_COMMITTED_VERIFIED_CLEANUP_FAILED';
  }
  if (stage === 'POSTFLIGHT_DISPATCHED') {
    return postgresOutcomeIsUnknown(error)
      ? 'ROLLBACK_DRILL_COMMITTED_VERIFICATION_UNKNOWN'
      : 'ROLLBACK_DRILL_COMMITTED_POSTFLIGHT_REJECTED';
  }
  if (stage === 'POSTFLIGHT_RETURNED') {
    return 'ROLLBACK_DRILL_COMMITTED_POSTFLIGHT_REJECTED';
  }
  if (stage.endsWith('_ROLLBACK_DISPATCHED') && postgresOutcomeIsUnknown(error)) {
    return 'ROLLBACK_PROGRESS_OUTCOME_UNKNOWN';
  }
  return rollbackCount > 0 ? 'ROLLBACK_PROGRESS_PRESERVED' : 'NO_MUTATION';
}

export async function runDr133ProductionRollbackDrill({
  environment = process.env,
  ClientClass = Client,
  readFileFn = readFile,
  output = process.stdout,
} = {}) {
  let stage = 'INITIAL';
  let primaryError = null;
  let client = null;
  let postgresMajor = null;
  let verifiedArtifactCount = 0;
  let rollbackCount = 0;
  let preflightCursor = null;
  const state = { connected: false, locked: false };
  let verified;

  try {
    const resolved = resolveDr133RollbackDrillEnvironment(environment);
    verified = await loadVerifiedArtifacts(readFileFn);
    verifiedArtifactCount = DR133_ARTIFACTS.length;
    stage = 'ARTIFACTS_VERIFIED';

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-production-rollback-drill',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflight = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    preflightCursor = classifyDr133ProductionSchemaCursor(preflight.rows?.[0]);
    postgresMajor = preflight.rows[0].postgres_major;
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflight = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    const lockedCursor = classifyDr133ProductionSchemaCursor(lockedPreflight.rows?.[0]);
    if (!sameCursor(preflightCursor, lockedCursor)) {
      failDr133('ROLLBACK_SCHEMA_CURSOR_CHANGED');
    }
    const startIndex = rollbackStartIndex(lockedCursor);
    rollbackCount = startIndex;
    stage = 'LOCKED_PREFLIGHT_VERIFIED';

    await client.query("SET statement_timeout = '300s'");
    await client.query("SET lock_timeout = '15s'");
    await client.query("SET idle_in_transaction_session_timeout = '120s'");
    for (const [name, value] of targetGucEntries()) {
      const configured = await client.query(
        'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
        [name, value],
      );
      if (configured.rows?.[0]?.configured_value !== value) {
        failDr133('TARGET_GUC_REJECTED');
      }
    }
    stage = 'TARGET_GUCS_VERIFIED';

    if (lockedCursor.state !== 'absent') {
      await client.query(DR133_ROLLBACK_DRILL_EMPTY_RELATIONS_SQL);
    }
    stage = 'EMPTY_RELATIONS_VERIFIED';

    for (const rollbackId of DR133_ROLLBACK_ORDER.slice(startIndex)) {
      const stageName = rollbackId.replaceAll('-', '_').toUpperCase();
      if (rollbackId === 'foundation-rollback') {
        const sentinel = await client.query(DR133_FOUNDATION_SENTINEL_SQL);
        assertFoundationSentinelRow(sentinel.rows?.[0]);
      } else {
        stage = `${stageName}_GUARD_DISPATCHED`;
        await client.query(verified.guards.get(rollbackId));
        stage = `${stageName}_GUARD_VERIFIED`;
      }
      stage = `${stageName}_ROLLBACK_DISPATCHED`;
      await client.query(
        artifactById(verified.artifacts, rollbackId).bytes.toString('utf8'),
      );
      rollbackCount += 1;
      stage = `${stageName}_ROLLBACK_RETURNED`;
    }

    stage = 'POSTFLIGHT_DISPATCHED';
    const postflight = await client.query(DR133_ROLLBACK_DRILL_ABSENCE_SQL);
    stage = 'POSTFLIGHT_RETURNED';
    assertAbsentPostflightRow(postflight.rows?.[0]);
    stage = 'POSTFLIGHT_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  const cleanupError = await closeClientFailClosed(client, state);
  primaryError ??= cleanupError;

  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeSafeReceipt(output, {
      contract: DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT,
      mode: DR133_ROLLBACK_DRILL_MODE,
      result: failureResult(stage, primaryError, rollbackCount),
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      verifiedArtifactCount,
      rollbackCount,
    });
    failDr133(
      safeFailure.postgresCode
        ? `POSTGRES_${safeFailure.postgresCode}`
        : safeFailure.runnerCode,
    );
  }

  writeSafeReceipt(output, {
    contract: DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT,
    mode: DR133_ROLLBACK_DRILL_MODE,
    result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED',
    postgresMajor,
    relationCount: DR133_RELATIONS.length,
    rollbackCount,
    verifiedArtifactCount,
    ...artifactReceiptHashes(),
  });
  return Object.freeze({ result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED' });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runDr133ProductionRollbackDrill().catch(() => {
    process.exitCode = 1;
  });
}
