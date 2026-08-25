import { createHash } from 'node:crypto';

export const DR133_RUNNER_CONTRACT = 'missionmed.lor.railway-dr133-runner.v1';
export const DR133_RUNTIME_LOGIN = 'lor_studio_runtime_login';
export const DR133_APPLICATION_ROLE = 'lor_studio_app';
export const DR133_COMMAND_OWNER_ROLE = 'lor_studio_command_owner';

export const DR133_TARGET = Object.freeze({
  provider: 'railway-postgres',
  projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
  environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
  environmentName: 'lor-staging',
  executionServiceId: 'bf0e291c-c90b-4bd9-8319-b249a7d02ad0',
  databaseServiceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
  databaseHost: 'postgres.railway.internal',
  databaseName: 'railway',
  databaseAdmin: 'postgres',
  region: 'us-west2',
  decisionRecord: 'DR-133',
  dataCopied: 'false',
  sourceBaselineCommit: '1ad44368d56b694042a1a7dc5a5d7f82dd3321e2',
  sourceBaselineTree: 'ea87b55f67fe256f5f20a0831a3b2783c1ae84dd',
});

export const DR133_ARTIFACTS = Object.freeze([
  Object.freeze({
    id: 'foundation',
    purpose: 'forward',
    relativePath: 'migrations/20260825010000_f2_lor_1012_production_schema_foundation.sql',
    sha256: '2e94b728b01c91e6f252b7fe4f583d4cba9951ba5b2ddba2d84ca950fe64cce4',
  }),
  Object.freeze({
    id: 'rls',
    purpose: 'forward',
    relativePath: 'migrations/20260825010100_f2_lor_1012_production_rls_projection_grants.sql',
    sha256: '2330e9f1cc8ccc23a4b498e9be62ea383d450d7d27d0f2ae26a1f540a2cd9a0a',
  }),
  Object.freeze({
    id: 'foundation-rollback',
    purpose: 'recovery-custody',
    relativePath:
      'rollbacks/20260825010000_f2_lor_1012_production_schema_foundation.rollback.sql',
    sha256: '3b197ff5f5a84692f2bb9d29e846a6dac2d4d3cda265a4149e9a0b6c3754fdf8',
  }),
  Object.freeze({
    id: 'rls-rollback',
    purpose: 'recovery-custody-and-guard-verification',
    relativePath:
      'rollbacks/20260825010100_f2_lor_1012_production_rls_projection_grants.rollback.sql',
    sha256: '0960ab73642eb7c0b27b16289025509ad21a7253bd93800c55c12b751b6f1d04',
  }),
]);

export const DR133_RELATIONS = Object.freeze([
  'administrative_case_grant_revocations',
  'administrative_case_grants',
  'ai_generation_runs',
  'ai_letter_proposals',
  'ai_proposal_decisions',
  'consent_receipts',
  'deletion_hold_releases',
  'deletion_intents',
  'deletion_receipts',
  'faculty_invitations',
  'faculty_otp_challenge_revocations',
  'faculty_otp_challenges',
  'faculty_otp_proof_revocations',
  'faculty_otp_verification_receipts',
  'faculty_private_content',
  'mentor_case_assignment_revocations',
  'mentor_case_assignments',
  'recommendation_case_audit_events',
  'recommendation_case_creation_reservations',
  'recommendation_case_private_write_receipts',
  'recommendation_case_protected_revision_states',
  'recommendation_case_write_receipts',
  'recommendation_cases',
  'released_student_documents',
  'student_auth_binding_revocations',
  'student_auth_bindings',
  'waiver_receipts',
  'writer_depot_artifacts',
]);

export const DR133_APPROVED_DEFINER_IDENTITIES = Object.freeze([
  'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)',
  'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)',
  'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'read_faculty_case_projection()',
  'read_mentor_case_projection()',
]);

const DENIED_IDENTIFIERS = Object.freeze([
  'fglyvdykwgbuivikqoah',
  'mftguikkftmrxjxrkdln',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const POSTGRES_CODE_PATTERN = /^[0-9A-Z]{5}$/u;
const POSTGRES_CODE_CLASSES = new Set([
  '00', '01', '02', '03', '08', '09', '0A', '0B', '0F', '0L', '0P', '0Z',
  '20', '21', '22', '23', '24', '25', '26', '27', '28', '2B', '2D', '2F',
  '34', '38', '39', '3B', '3D', '3F', '40', '42', '44', '53', '54', '55',
  '57', '58', '72', 'F0', 'HV', 'P0', 'P1', 'XX',
]);
const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{3,80}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUNTIME_PASSWORD_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const ROLLBACK_LITERAL_MARKER =
  '-- Literal reverse operations follow. This marker is consumed by static custody tests.';
const DR133_RECEIPT_KEYS = Object.freeze([
  'contract',
  'definerCount',
  'foundationSha256',
  'mode',
  'postgresCode',
  'postgresMajor',
  'relationCount',
  'result',
  'rlsSha256',
  'runnerCode',
]);
const DR133_RECEIPT_MODES = Object.freeze(['migration', 'runtime-login']);
const DR133_RECEIPT_RESULTS = Object.freeze([
  'NO_MUTATION',
  'FOUNDATION_ROLLED_BACK',
  'FOUNDATION_OUTCOME_UNKNOWN',
  'FOUNDATION_ONLY_COMMITTED',
  'RLS_OUTCOME_UNKNOWN',
  'BOTH_COMMITTED_POSTFLIGHT_REJECTED',
  'BOTH_COMMITTED_VERIFIED_CLEANUP_FAILED',
  'BOTH_COMMITTED_VERIFIED',
  'RUNTIME_LOGIN_ROLLED_BACK',
  'RUNTIME_LOGIN_OUTCOME_UNKNOWN',
  'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED',
  'RUNTIME_LOGIN_COMMITTED_VERIFIED_CLEANUP_FAILED',
  'RUNTIME_LOGIN_COMMITTED_VERIFIED',
]);

export const DR133_RUNNER_ENV_KEYS = Object.freeze([
  'LOR_DR133_ADMIN_DATABASE_URL',
  'LOR_DR133_MODE',
  'RAILWAY_DEPLOYMENT_ID',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_ENVIRONMENT_NAME',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_REPLICA_REGION',
  'RAILWAY_SERVICE_ID',
]);

export const DR133_RUNTIME_ENV_KEYS = Object.freeze([
  ...DR133_RUNNER_ENV_KEYS,
  'LOR_DR133_RUNTIME_DATABASE_URL',
]);

export class Dr133RunnerError extends Error {
  constructor(code) {
    super(`DR-133 Railway runner failed: ${code}`);
    this.name = 'Dr133RunnerError';
    this.code = code;
  }
}

export function failDr133(code) {
  throw new Dr133RunnerError(code);
}

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
  return value;
}

function assertNoDeniedIdentifier(value) {
  const normalized = String(value).toLowerCase();
  if (DENIED_IDENTIFIERS.some((denied) => normalized.includes(denied))) {
    failDr133('DENIED_TARGET_IDENTIFIER');
  }
}

export function parsePrivateDatabaseUrl(rawValue, expectedUser) {
  if (![DR133_TARGET.databaseAdmin, DR133_RUNTIME_LOGIN].includes(expectedUser)) {
    failDr133('DATABASE_USER_EXPECTATION_INVALID');
  }
  const raw = requiredString(rawValue, 'DATABASE_URL_REQUIRED');
  assertNoDeniedIdentifier(raw);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    failDr133('DATABASE_URL_INVALID');
  }

  let databasePath;
  let username;
  let password;
  try {
    databasePath = decodeURIComponent(parsed.pathname);
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    failDr133('DATABASE_URL_INVALID');
  }
  if (
    CONTROL_CHARACTER_PATTERN.test(databasePath)
    || CONTROL_CHARACTER_PATTERN.test(username)
    || CONTROL_CHARACTER_PATTERN.test(password)
  ) failDr133('DATABASE_URL_INVALID');
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) failDr133('DATABASE_URL_INVALID');
  if (parsed.hostname !== DR133_TARGET.databaseHost) failDr133('DATABASE_HOST_INVALID');
  if (parsed.port !== '5432') failDr133('DATABASE_PORT_INVALID');
  if (databasePath !== `/${DR133_TARGET.databaseName}`) failDr133('DATABASE_NAME_INVALID');
  if (username !== expectedUser) failDr133('DATABASE_USER_INVALID');
  if (password.length < 32 || password.length > 512) failDr133('DATABASE_PASSWORD_INVALID');
  if (parsed.hash !== '') failDr133('DATABASE_URL_INVALID');
  const queryKeys = [...parsed.searchParams.keys()];
  if (
    queryKeys.length !== 1
    || queryKeys[0] !== 'sslmode'
    || parsed.searchParams.getAll('sslmode').length !== 1
    || parsed.searchParams.get('sslmode') !== 'require'
  ) failDr133('DATABASE_SSLMODE_INVALID');
  parsed.search = '';
  return Object.freeze({
    pgConnectionString: parsed.toString(),
    password,
  });
}

export function resolveDr133RunnerEnvironment(rawEnvironment, { mode }) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') failDr133('ENVIRONMENT_REQUIRED');
  if (!['migration', 'runtime-login'].includes(mode)) failDr133('MODE_INVALID');
  const expectedKeys = mode === 'migration' ? DR133_RUNNER_ENV_KEYS : DR133_RUNTIME_ENV_KEYS;
  for (const key of expectedKeys) requiredString(rawEnvironment[key], `${key}_REQUIRED`);

  const expectedLorKeys = expectedKeys.filter((key) => key.startsWith('LOR_DR133_')).sort();
  const observedLorKeys = Object.keys(rawEnvironment)
    .filter((key) => key.startsWith('LOR_DR133_'))
    .sort();
  if (JSON.stringify(observedLorKeys) !== JSON.stringify(expectedLorKeys)) {
    failDr133('UNEXPECTED_LOR_ENVIRONMENT_KEY');
  }

  assertExact(rawEnvironment.LOR_DR133_MODE, mode, 'MODE_MISMATCH');
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
  assertExact(rawEnvironment.RAILWAY_REPLICA_REGION, DR133_TARGET.region, 'REGION_MISMATCH');
  if (!UUID_PATTERN.test(rawEnvironment.RAILWAY_DEPLOYMENT_ID)) failDr133('DEPLOYMENT_ID_INVALID');

  const admin = parsePrivateDatabaseUrl(
    rawEnvironment.LOR_DR133_ADMIN_DATABASE_URL,
    DR133_TARGET.databaseAdmin,
  );
  const runtime = mode === 'runtime-login'
    ? parsePrivateDatabaseUrl(rawEnvironment.LOR_DR133_RUNTIME_DATABASE_URL, DR133_RUNTIME_LOGIN)
    : null;
  if (runtime && runtime.password === admin.password) failDr133('RUNTIME_PASSWORD_NOT_SEPARATE');
  if (runtime && !RUNTIME_PASSWORD_PATTERN.test(runtime.password)) {
    failDr133('RUNTIME_PASSWORD_FORMAT_INVALID');
  }

  return Object.freeze({
    mode,
    deploymentId: rawEnvironment.RAILWAY_DEPLOYMENT_ID,
    adminPgConnectionString: admin.pgConnectionString,
    runtimePgConnectionString: runtime?.pgConnectionString ?? null,
    runtimePassword: runtime?.password ?? null,
  });
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function expectedDr133Sentinel() {
  return [
    'missionmed.lor.railway-postgres-target.v1',
    `provider=${DR133_TARGET.provider}`,
    `project=${DR133_TARGET.projectId}`,
    `environment=${DR133_TARGET.environmentId}`,
    `service=${DR133_TARGET.databaseServiceId}`,
    `database=${DR133_TARGET.databaseName}`,
    `admin=${DR133_TARGET.databaseAdmin}`,
    `region=${DR133_TARGET.region}`,
    `decision=${DR133_TARGET.decisionRecord}`,
    `dataCopied=${DR133_TARGET.dataCopied}`,
    'foundation=20260825010000',
  ].join('|');
}

export function targetGucEntries() {
  return Object.freeze([
    Object.freeze(['missionmed.lor.target_provider', DR133_TARGET.provider]),
    Object.freeze(['missionmed.lor.target_project_id', DR133_TARGET.projectId]),
    Object.freeze(['missionmed.lor.target_environment_id', DR133_TARGET.environmentId]),
    Object.freeze(['missionmed.lor.target_service_id', DR133_TARGET.databaseServiceId]),
    Object.freeze(['missionmed.lor.target_database_name', DR133_TARGET.databaseName]),
    Object.freeze(['missionmed.lor.target_region', DR133_TARGET.region]),
    Object.freeze(['missionmed.lor.target_decision_record', DR133_TARGET.decisionRecord]),
    Object.freeze(['missionmed.lor.target_data_copied', DR133_TARGET.dataCopied]),
  ]);
}

export function classifySafeFailure(error) {
  const runnerCode = error instanceof Dr133RunnerError && SAFE_ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : 'UNEXPECTED_FAILURE';
  const postgresCode = typeof error?.code === 'string'
    && POSTGRES_CODE_PATTERN.test(error.code)
    && POSTGRES_CODE_CLASSES.has(error.code.slice(0, 2))
    ? error.code
    : null;
  return Object.freeze({ runnerCode, postgresCode });
}

export function postgresOutcomeIsUnknown(error) {
  const { postgresCode: code } = classifySafeFailure(error);
  return code === null
    || code.startsWith('08')
    || ['57P01', '57P02', '57P03', '57P04'].includes(code);
}

function isCanonicalInteger(value, { minimum = 0, maximum = 100_000 } = {}) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function writeDr133Receipt(stream, payload) {
  if (!stream || typeof stream.write !== 'function') failDr133('OUTPUT_STREAM_INVALID');
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  if (Object.values(descriptors).some((descriptor) => !('value' in descriptor))) {
    failDr133('OUTPUT_RECEIPT_INVALID');
  }
  const keys = Object.keys(payload).sort();
  if (keys.some((key) => !DR133_RECEIPT_KEYS.includes(key))) {
    failDr133('OUTPUT_RECEIPT_INVALID');
  }
  if (
    payload.contract !== DR133_RUNNER_CONTRACT
    || !DR133_RECEIPT_MODES.includes(payload.mode)
    || !DR133_RECEIPT_RESULTS.includes(payload.result)
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.runnerCode !== undefined
    && (typeof payload.runnerCode !== 'string'
      || !SAFE_ERROR_CODE_PATTERN.test(payload.runnerCode))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  if (
    payload.postgresCode !== undefined
    && payload.postgresCode !== null
    && (typeof payload.postgresCode !== 'string'
      || !POSTGRES_CODE_PATTERN.test(payload.postgresCode)
      || !POSTGRES_CODE_CLASSES.has(payload.postgresCode.slice(0, 2)))
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  for (const hashKey of ['foundationSha256', 'rlsSha256']) {
    if (payload[hashKey] !== undefined && !SHA256_PATTERN.test(payload[hashKey])) {
      failDr133('OUTPUT_RECEIPT_INVALID');
    }
  }
  for (const integerKey of ['definerCount', 'postgresMajor', 'relationCount']) {
    if (payload[integerKey] !== undefined && !isCanonicalInteger(payload[integerKey])) {
      failDr133('OUTPUT_RECEIPT_INVALID');
    }
  }
  stream.write(`${JSON.stringify(payload)}\n`);
}

export function assertPreflightRow(row) {
  if (!row || typeof row !== 'object') failDr133('PREFLIGHT_RESULT_INVALID');
  if (
    row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
    || row.schema_count !== '0'
    || row.app_role_count !== '0'
    || row.command_owner_count !== '0'
    || row.runtime_login_count !== '0'
  ) failDr133('PREFLIGHT_TARGET_INVALID');
}

export function assertFoundationSentinelRow(row) {
  if (!row || row.schema_sentinel !== expectedDr133Sentinel()) {
    failDr133('FOUNDATION_SENTINEL_INVALID');
  }
}

export function assertPostflightRow(row) {
  if (!row || typeof row !== 'object') failDr133('POSTFLIGHT_RESULT_INVALID');
  const observedDefiners = Array.isArray(row.definer_identities) ? row.definer_identities : [];
  const observedRelations = Array.isArray(row.relation_names) ? row.relation_names : [];
  if (
    row.schema_sentinel !== expectedDr133Sentinel()
    || row.schema_owner !== DR133_TARGET.databaseAdmin
    || row.relation_count !== String(DR133_RELATIONS.length)
    || row.forced_rls_count !== String(DR133_RELATIONS.length)
    || row.definer_count !== String(DR133_APPROVED_DEFINER_IDENTITIES.length)
    || row.public_function_execute_count !== '0'
    || row.public_table_privilege_count !== '0'
    || row.nonempty_relation_count !== '0'
    || row.view_count !== '1'
    || row.view_identity !== 'student_recommendation_case_projection@postgres'
    || row.app_role_safe !== true
    || row.command_owner_safe !== true
    || row.definer_custody_safe !== true
    || row.nologin_role_membership_count !== '0'
    || JSON.stringify(observedRelations) !== JSON.stringify([...DR133_RELATIONS].sort())
    || JSON.stringify(observedDefiners)
      !== JSON.stringify([...DR133_APPROVED_DEFINER_IDENTITIES].sort())
  ) failDr133('POSTFLIGHT_CATALOG_INVALID');
}

export function assertRuntimeAdminRow(row) {
  if (
    !row
    || row.runtime_role_safe !== true
    || row.membership_safe !== true
    || row.membership_count !== '1'
    || row.runtime_owned_object_count !== '0'
    || row.runtime_default_acl_count !== '0'
  ) failDr133('RUNTIME_LOGIN_CATALOG_INVALID');
}

export function assertRuntimeIdentityRow(row) {
  if (
    !row
    || row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_RUNTIME_LOGIN
    || row.session_user !== DR133_RUNTIME_LOGIN
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
  ) failDr133('RUNTIME_LOGIN_IDENTITY_INVALID');
}

export function assertRuntimeSetRoleRow(row) {
  if (
    !row
    || row.current_user !== DR133_APPLICATION_ROLE
    || row.session_user !== DR133_RUNTIME_LOGIN
    || row.visible_case_count !== '0'
  ) failDr133('RUNTIME_SET_ROLE_INVALID');
}

export function assertRuntimeCleanupRow(row) {
  if (
    !row
    || row.current_user !== DR133_RUNTIME_LOGIN
    || row.session_user !== DR133_RUNTIME_LOGIN
  ) failDr133('RUNTIME_ROLE_CLEANUP_INVALID');
}

export function quoteFixedIdentifier(identifier) {
  if (!DR133_RELATIONS.includes(identifier)) failDr133('RELATION_IDENTIFIER_INVALID');
  return `"${identifier}"`;
}

export function buildNonemptyRelationsSql() {
  const branches = DR133_RELATIONS.map(
    (relation) => `SELECT 1 AS present WHERE EXISTS (SELECT 1 FROM lor_studio.${quoteFixedIdentifier(relation)})`,
  );
  return [
    'SELECT pg_catalog.count(*)::text AS nonempty_relation_count',
    'FROM (',
    branches.join('\nUNION ALL\n'),
    ') AS nonempty_relations',
  ].join('\n');
}

export function extractRollbackGuardVerificationSql(source) {
  if (typeof source !== 'string') failDr133('ROLLBACK_GUARD_SOURCE_INVALID');
  const rollbackArtifact = DR133_ARTIFACTS.find((artifact) => artifact.id === 'rls-rollback');
  if (sha256Bytes(source) !== rollbackArtifact.sha256) failDr133('ROLLBACK_ARTIFACT_HASH_MISMATCH');
  const markerIndex = source.indexOf(ROLLBACK_LITERAL_MARKER);
  if (
    markerIndex < 0
    || markerIndex !== source.lastIndexOf(ROLLBACK_LITERAL_MARKER)
  ) failDr133('ROLLBACK_GUARD_MARKER_INVALID');
  const prefix = source.slice(0, markerIndex).trimEnd();
  const destructiveTail = source.slice(markerIndex + ROLLBACK_LITERAL_MARKER.length).trimStart();
  if (
    !prefix.endsWith('END\n$catalog_guard$;')
    || !destructiveTail.startsWith(
      'REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_case_create',
    )
  ) failDr133('ROLLBACK_GUARD_BOUNDARY_INVALID');
  return `${prefix}\n\nROLLBACK;\n`;
}
