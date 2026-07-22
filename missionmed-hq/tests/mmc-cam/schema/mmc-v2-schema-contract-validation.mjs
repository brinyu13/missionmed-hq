#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MMC_COMMAND_KINDS,
  MMC_STUDENT_RESPONSE_KINDS,
} from '../../../lib/mmc/contracts/command-contract.mjs';
import { ENVIRONMENT } from '../../../lib/mmc/contracts/state-contract.mjs';
import { MMC_JOB_KINDS } from '../../../lib/mmc/jobs/durable-job-kernel.mjs';
import { PUBLICATION_ITEM_KIND } from '../../../lib/mmc/publication/publication-contract.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, '../../../..');
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations');
const snippetsDirectory = resolve(repositoryRoot, 'supabase/snippets');
const migrationPattern = /^(\d{14})_a1_mmc_006_trust_data_worker_kernel\.sql$/;
const candidates = readdirSync(migrationsDirectory).filter((name) => migrationPattern.test(name));

assert.equal(candidates.length, 1, `expected exactly one A1-MMC-006 migration, found: ${candidates.join(', ')}`);

const migrationName = candidates[0];
const migrationTimestamp = migrationName.match(migrationPattern)[1];
const migration = readFileSync(resolve(migrationsDirectory, migrationName), 'utf8');
const validationName = '20260715_mmc_cam_v2_rls_validation.sql';
const validation = readFileSync(resolve(snippetsDirectory, validationName), 'utf8');

function sorted(values) {
  return [...values].sort();
}

function parseSqlStringList(source) {
  return [...source.matchAll(/'((?:''|[^'])*)'/g)].map((match) => match[1].replaceAll("''", "'"));
}

function findClosingParenthesis(source, openingIndex) {
  let depth = 0;
  let quoted = false;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "'") {
      if (quoted && source[index + 1] === "'") {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === '(') {
      depth += 1;
    } else if (!quoted && character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitSqlParameters(source) {
  const parameters = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "'") {
      if (quoted && source[index + 1] === "'") {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === '(') {
      depth += 1;
    } else if (!quoted && character === ')') {
      depth -= 1;
    } else if (!quoted && depth === 0 && character === ',') {
      parameters.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parameters.push(source.slice(start));
  return parameters.map((value) => value.trim()).filter(Boolean);
}

function normalizeSqlType(source) {
  return source.trim().replace(/\s+/g, ' ').replace(/\s*\[\s*\]/g, '[]').toLowerCase();
}

function extractFunctionIdentitySignature(name, source) {
  const openingIndex = source.indexOf('(');
  const closingIndex = findClosingParenthesis(source, openingIndex);
  assert.notEqual(closingIndex, -1, `unterminated parameter list for ${name}`);
  const types = splitSqlParameters(source.slice(openingIndex + 1, closingIndex)).map((parameter) => {
    const declaration = parameter
      .replace(/--[^\n]*/g, ' ')
      .replace(/\s+DEFAULT\s+[\s\S]*$/i, '')
      .trim();
    const words = declaration.split(/\s+/);
    if (/^(IN|OUT|INOUT|VARIADIC)$/i.test(words[0])) words.shift();
    assert.ok(words.length >= 2, `function parameter must name its type: ${name}(${declaration})`);
    words.shift();
    return normalizeSqlType(words.join(' '));
  });
  return `${name}(${types.join(',')})`;
}

function extractTableBody(table) {
  const match = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS mmc\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(match, `could not extract table definition for ${table}`);
  return match[1];
}

function extractSqlCheckVocabulary(table, column) {
  const body = extractTableBody(table);
  const match = body.match(new RegExp(`CHECK \\(\\s*${column} IN \\(([^)]*)\\)\\s*\\)`));
  assert.ok(match, `could not extract ${table}.${column} CHECK vocabulary`);
  return parseSqlStringList(match[1]);
}

function extractFunction(name) {
  const marker = `CREATE OR REPLACE FUNCTION mmc.${name}`;
  const start = migration.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `could not extract function ${name}`);
  return migration.slice(start, end + 4);
}

function utcDateFromTimestamp(timestamp) {
  const parts = timestamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  assert.ok(parts, `invalid UTC migration timestamp: ${timestamp}`);
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  assert.equal(
    value.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
    timestamp,
    `nonexistent or non-canonical UTC timestamp: ${timestamp}`,
  );
  return value;
}

const allMigrationTimestamps = readdirSync(migrationsDirectory)
  .map((name) => name.match(/^(\d{14})_/))
  .filter(Boolean)
  .map((match) => match[1]);
assert.equal(new Set(allMigrationTimestamps).size, allMigrationTimestamps.length, 'duplicate 14-digit migration timestamp');

const priorTimestamps = allMigrationTimestamps.filter((timestamp) => timestamp !== migrationTimestamp);
const latestPrior = priorTimestamps.sort().at(-1);
assert.ok(latestPrior, 'expected at least one prior migration');
assert.ok(
  utcDateFromTimestamp(migrationTimestamp).getTime() - utcDateFromTimestamp(latestPrior).getTime() >= 60_000,
  `A1-MMC-006 migration must be at least 60 seconds newer than ${latestPrior}`,
);

const requiredHeader = [
  `-- Migration: ${migrationName}`,
  '-- Authority: A1-MMC-006 / MR-078A',
  '-- Date: 2026-07-15',
  '-- Depends on: 20260626040000_mmc_coaching_intelligence_pipeline.sql',
  '-- Description:',
  '-- Idempotent: YES',
];
for (const field of requiredHeader) {
  assert.ok(migration.includes(field), `missing MR-078A header field: ${field}`);
}

assert.match(migration, /BEGIN;[\s\S]+COMMIT;\s*$/);
assert.equal((migration.match(/^BEGIN;$/gm) ?? []).length, 1, 'migration must have one top-level BEGIN');
assert.equal((migration.match(/^COMMIT;$/gm) ?? []).length, 1, 'migration must have one top-level COMMIT');
assert.match(migration, /current_setting\('mmc\.schema_build_target', true\)/);
for (const target of ['local', 'staging', 'ci']) {
  assert.ok(migration.includes(`'${target}'`), `missing build guard target ${target}`);
}

const forbiddenPatterns = [
  [/\bCASCADE\b/i, 'CASCADE'],
  [/supabase_migrations/i, 'migration-history write/reference'],
  [/service_role/i, 'unrestricted runtime role'],
  [/BYPASSRLS/i, 'RLS bypass'],
  [/\bEXECUTE\s+(?:format|immediate)\b/i, 'dynamic SQL'],
  [/\bGRANT\s+DELETE\b/i, 'runtime DELETE grant'],
  [/\bGRANT\s+(?:INSERT|UPDATE|ALL)\b[^;]*\bTO\s+authenticated\b/is, 'authenticated table DML grant'],
  [/\bGRANT\b[^;]*\bTO\s+anon\b/is, 'anon grant'],
  [/\bTRUNCATE\b/i, 'destructive truncate'],
];
for (const [pattern, label] of forbiddenPatterns) {
  assert.doesNotMatch(migration, pattern, `forbidden ${label}`);
}

const requiredTables = [
  'cam_v2_tenants',
  'cam_v2_principals',
  'cam_v2_subject_links',
  'cam_v2_assignments',
  'cam_v2_authority_grants',
  'cam_v2_policy_versions',
  'cam_v2_sessions',
  'cam_v2_tasks',
  'cam_v2_commitments',
  'cam_v2_goals',
  'cam_v2_milestones',
  'cam_v2_student_statements',
  'cam_v2_student_responses',
  'cam_v2_source_assets',
  'cam_v2_transcript_versions',
  'cam_v2_job_inputs',
  'cam_v2_evidence_spans',
  'cam_v2_analysis_runs',
  'cam_v2_ai_proposals',
  'cam_v2_review_decisions',
  'cam_v2_publications',
  'cam_v2_publication_items',
  'cam_v2_command_receipts',
  'cam_v2_idempotency_records',
  'cam_v2_jobs',
  'cam_v2_outbox_events',
  'cam_v2_consumer_effects',
  'cam_v2_consumer_inbox',
  'cam_v2_lineage_edges',
  'cam_v2_audit_events',
  'cam_v2_cutover_states',
];

const declaredTables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS mmc\.(cam_v2_[a-z0-9_]+)\s*\(/g)]
  .map((match) => match[1]);
assert.deepEqual(new Set(declaredTables), new Set(requiredTables), 'unexpected or missing CAM v2 table');
assert.equal(declaredTables.length, requiredTables.length, 'each CAM v2 table must be declared once');

for (const table of requiredTables) {
  const tableMatch = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS mmc\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(tableMatch, `could not extract table definition for ${table}`);
  const tableBody = tableMatch[1];
  assert.match(tableBody, /\bobject_version bigint NOT NULL DEFAULT 1\b/, `${table} lacks object_version`);
  if (table === 'cam_v2_tenants') {
    assert.match(tableBody, /UNIQUE \(id, environment\)/, 'tenant scope key must include environment');
  } else {
    assert.match(tableBody, /\btenant_id uuid NOT NULL\b/, `${table} lacks tenant_id`);
    assert.match(tableBody, /\benvironment text NOT NULL\b/, `${table} lacks environment`);
    assert.match(tableBody, /UNIQUE \(tenant_id, environment, id\)/, `${table} lacks composite scoped identity`);
    assert.match(
      tableBody,
      /FOREIGN KEY \(tenant_id, environment\)\s+REFERENCES mmc\.cam_v2_tenants\(id, environment\)/,
      `${table} lacks tenant/environment tenant FK`,
    );
  }
  assert.match(migration, new RegExp(`ALTER TABLE mmc\\.${table} ENABLE ROW LEVEL SECURITY;`), `${table} does not enable RLS`);
  assert.match(migration, new RegExp(`ALTER TABLE mmc\\.${table} FORCE ROW LEVEL SECURITY;`), `${table} does not force RLS`);
  const adminPolicy = new RegExp(
    `CREATE POLICY [^\\n]+ ON mmc\\.${table} FOR SELECT TO authenticated[\\s\\S]{0,500}?USING \\(`,
  );
  assert.match(migration, adminPolicy, `${table} lacks a read-only trust policy`);
}

assert.equal((migration.match(/FORCE ROW LEVEL SECURITY;/g) ?? []).length, requiredTables.length);
assert.ok(
  migration.lastIndexOf('FORCE ROW LEVEL SECURITY;') < migration.indexOf('GRANT USAGE ON SCHEMA'),
  'all forced-RLS installation must precede runtime grants',
);
assert.doesNotMatch(
  migration,
  /REFERENCES mmc\.cam_v2_[a-z0-9_]+\s*\(id\)/,
  'cross-object v2 foreign keys must include tenant and environment',
);

const capabilityContracts = [
  'mmc.admin.trust_manage',
  'mmc.operator.trust_read',
  'mmc.operator.trust_write',
  'mmc.mentor.read',
  'mmc.mentor.command',
  'mmc.mentor.review',
  'mmc.mentor.publish',
  'mmc.student.publication_read',
  'mmc.student.self_author',
  'mmc.student.respond',
  'mmc.worker.claim',
  'mmc.worker.lease',
  'mmc.worker.asset_process',
  'mmc.worker.analysis',
  'mmc.worker.heartbeat',
  'mmc.worker.complete',
  'mmc.worker.outbox_dispatch',
  'mmc.worker.inbox',
];
for (const capability of capabilityContracts) {
  assert.ok(migration.includes(`'${capability}'`), `missing capability contract ${capability}`);
}

assert.match(migration, /assignment\.mentor_principal_id = mmc\.cam_v2_current_principal_id\(\)/);
assert.match(migration, /p_subject_link_id = mmc\.cam_v2_current_subject_link_id\(\)/);
assert.match(migration, /job\.lease_generation = mmc\.cam_v2_current_lease_generation\(\)/);
assert.match(migration, /job\.lease_expires_at > statement_timestamp\(\)/);
assert.match(migration, /publication_state IN \('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED'\)/);
assert.match(
  migration,
  /CHECK \(response_kind IN \('ACKNOWLEDGEMENT', 'AGREEMENT', 'CLARIFICATION_REQUEST', 'DISPUTE', 'SELF_REPORTED_COMPLETE', 'BLOCKER_REPORT'\)\)/,
  'SQL and command/publication contracts must share one exact student-response vocabulary',
);
assert.doesNotMatch(migration, /'ACKNOWLEDGE'|'AGREE'|'COMMENT'/,
  'legacy response spellings must not remain admissible in the v2 schema');

// Exact-set parity is executable rather than a loose string-presence check.
// MegaRun 007 exports the durable vocabulary so both this gate and the
// machine-readable parity manifest consume one JavaScript authority.
assert.deepEqual(
  sorted(extractSqlCheckVocabulary('cam_v2_tenants', 'environment')),
  sorted(Object.values(ENVIRONMENT)),
  'SQL and JS environment vocabularies drifted',
);
assert.deepEqual(
  sorted(extractSqlCheckVocabulary('cam_v2_jobs', 'job_kind')),
  sorted(MMC_JOB_KINDS),
  'SQL and JS durable-job kind vocabularies drifted',
);
assert.deepEqual(
  sorted(extractSqlCheckVocabulary('cam_v2_publication_items', 'item_kind')),
  sorted(Object.values(PUBLICATION_ITEM_KIND)),
  'SQL and JS publication-item vocabularies drifted',
);
assert.deepEqual(
  sorted(extractSqlCheckVocabulary('cam_v2_student_responses', 'response_kind')),
  sorted(MMC_STUDENT_RESPONSE_KINDS),
  'SQL and JS student-response vocabularies drifted',
);
assert.deepEqual(
  sorted(extractSqlCheckVocabulary('cam_v2_command_receipts', 'command_kind')),
  sorted(MMC_COMMAND_KINDS),
  'SQL and JS command-kind vocabularies drifted',
);
assert.doesNotMatch(migration, /writer_state[^\n]*DUAL/i, 'single-writer state machine must not admit dual-write');
assert.match(migration, /safe_plain_text !~\* '[^']*'/, 'publication items must reject active content');

assert.doesNotMatch(
  migration,
  /CREATE POLICY[^\n]+FOR (?:ALL|INSERT|UPDATE|DELETE) TO authenticated/i,
  'authenticated must have no latent table-write policy',
);
assert.match(migration, /FROM PUBLIC, anon, authenticated;/, 'all runtime table privileges must be reset before SELECT grants');
assert.match(migration, /GRANT SELECT ON TABLE[\s\S]+TO authenticated;/, 'authenticated must receive SELECT explicitly');
assert.doesNotMatch(
  migration,
  /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)[^;]*TO authenticated;/i,
  'authenticated table DML must remain unavailable',
);

for (const helper of [
  'cam_v2_actor_is_active',
  'cam_v2_plane_is_enabled',
  'cam_v2_job_authority_is_active',
  'cam_v2_worker_row_matches_job',
]) {
  assert.ok(migration.includes(`FUNCTION mmc.${helper}`), `missing hardened helper ${helper}`);
}
assert.match(migration, /tenant\.status = 'ACTIVE'/, 'tenant activity must be rechecked from durable state');
assert.match(migration, /principal\.status = 'ACTIVE'/, 'principal activity must be rechecked from durable state');
assert.match(migration, /authority\.status = 'ACTIVE'/, 'authority activity must be rechecked from durable state');
assert.match(migration, /authority\.effective_at <= statement_timestamp\(\)/, 'authority effective time must be enforced');
assert.match(migration, /authority\.revoked_at IS NULL/, 'authority revocation must be enforced');
assert.match(migration, /job\.queue_name = mmc\.cam_v2_current_queue_name\(\)/, 'leased job reads require the signed queue');
assert.match(migration, /p_queue_name IS DISTINCT FROM mmc\.cam_v2_current_queue_name\(\)/, 'claim RPC requires the signed queue');
assert.match(migration, /job\.assignment_id IS NOT DISTINCT FROM p_assignment_id/, 'worker row assignment must equal the job');
assert.match(migration, /job\.subject_link_id IS NOT DISTINCT FROM p_subject_link_id/, 'worker row subject must equal the job');
assert.ok(
  (migration.match(/REFERENCES mmc\.cam_v2_jobs\(tenant_id, environment, id, assignment_id, subject_link_id\)/g) ?? []).length >= 5,
  'worker-derived rows require composite job/assignment/subject foreign keys',
);
assert.match(
  migration,
  /REFERENCES mmc\.cam_v2_authority_grants\(tenant_id, environment, id, assignment_id, subject_link_id\)/,
  'jobs require exact authority/assignment/subject binding',
);
assert.match(migration, /writer_state text NOT NULL DEFAULT 'SEALED_NO_WRITER'/, 'cutover must default to no writer');
for (const state of ['SEALED_NO_WRITER', 'SHADOW_READS', 'V1_FROZEN', 'V2_ACTIVE', 'FORWARD_REPAIR']) {
  assert.ok(migration.includes(`'${state}'`), `missing cutover state ${state}`);
}
for (const plane of [
  'reads_enabled',
  'commands_enabled',
  'ingest_enabled',
  'ai_proposal_enabled',
  'operational_promotion_enabled',
  'student_publication_enabled',
]) {
  assert.ok(migration.includes(plane), `missing durable cutover plane ${plane}`);
}
assert.match(migration, /cutover\.writer_state = 'V2_ACTIVE'/, 'mutating worker paths require durable V2 writer authority');

assert.match(migration, /expected_version bigint NOT NULL/, 'durable commands require expectedVersion');
assert.match(migration, /CHECK \(expected_version >= 0\)/, 'command expectedVersion must be non-negative');
assert.match(migration, /CHECK \(schema_version = 1\)/, 'SQL command schema version must equal the JS wire version');
assert.match(migration, /status = 'RECEIVED' AND result_digest IS NULL/, 'uncommitted receipt result must be empty');
assert.match(migration, /receipt\.result_digest IS NOT DISTINCT FROM NEW\.result_digest/,
  'idempotency records must bind the exact receipt result digest');
assert.match(migration, /command_id uuid NOT NULL/, 'durable receipts require the client command ID');
assert.match(migration, /correlation_id text NOT NULL/, 'runtime opaque correlation IDs require a text contract');
assert.match(migration, /environment IN \('FIXTURE', 'LOCAL', 'STAGING', 'LIVE'\)/,
  'durable runtime environments must align with the JS wire contract');
for (const runtimeCapability of ['mmc.command', 'mmc.review', 'mmc.worker.claim', 'mmc.worker.complete']) {
  assert.ok(migration.includes(`'${runtimeCapability}'`), `missing runtime capability alias ${runtimeCapability}`);
}

const rpcRowSecurity = new Map([
  ['cam_v2_claim_job', 'on'],
  ['cam_v2_heartbeat_job', 'on'],
  ['cam_v2_record_external_dispatch_intent', 'on'],
  ['cam_v2_record_external_result', 'on'],
  ['cam_v2_reconcile_expired_external_result', 'on'],
  ['cam_v2_complete_job', 'on'],
  ['cam_v2_cancel_inactive_job', 'on'],
  ['cam_v2_claim_outbox', 'on'],
  ['cam_v2_heartbeat_outbox', 'on'],
  // This RPC must inspect an exact durable receipt before requiring a current
  // lease; its SECURITY DEFINER body still applies signed-scope predicates.
  ['cam_v2_record_inbox_effect', 'off'],
  ['cam_v2_complete_outbox', 'on'],
  ['cam_v2_dead_letter_inactive_outbox', 'on'],
  ['cam_v2_register_job_input', 'on'],
]);
const rpcDefinitions = new Map();
for (const [rpc, rowSecurity] of rpcRowSecurity) {
  const functionDefinition = extractFunction(rpc);
  rpcDefinitions.set(rpc, functionDefinition);
  assert.match(functionDefinition, /SECURITY DEFINER/);
  assert.match(functionDefinition, /SET search_path = pg_catalog, mmc/);
  assert.match(functionDefinition, new RegExp(`SET row_security = ${rowSecurity}`));
  assert.match(functionDefinition, /cam_v2_lock_audit_chain\(/,
    `${rpc} must acquire the audit serializer before durable object locks`);
}
assert.match(migration, /FOR UPDATE OF queued SKIP LOCKED/);
assert.match(migration, /lease_generation = claimed\.lease_generation \+ 1/);
assert.match(migration, /UNIQUE \(tenant_id, environment, outbox_event_id\)/,
  'consumer effects and receipts must be unique per scoped outbox event');
assert.match(rpcDefinitions.get('cam_v2_claim_job'), /p_queue_name IS DISTINCT FROM mmc\.cam_v2_current_queue_name\(\)/);
assert.match(rpcDefinitions.get('cam_v2_claim_job'), /mmc\.cam_v2_job_authority_is_active\(queued\.id\)/);
assert.match(rpcDefinitions.get('cam_v2_claim_job'), /mmc\.cam_v2_plane_is_enabled\(mmc\.cam_v2_job_plane\(queued\.job_kind\)\)/);
assert.match(rpcDefinitions.get('cam_v2_claim_job'),
  /job_kind IN \('ASSET_ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_ANALYSIS'\)/,
  'only job kinds with reviewed typed success attestations may be claimed');
assert.match(rpcDefinitions.get('cam_v2_claim_job'), /cam_v2_job_inputs_potentially_ready\(queued\.id\)/,
  'dependency readiness must be filtered before the bounded claim window');
assert.match(rpcDefinitions.get('cam_v2_heartbeat_job'),
  /cam_v2_lock_job_mutation_authority\([\s\S]*?'mmc\.worker\.heartbeat', 'CURRENT_LEASE'/);
assert.match(rpcDefinitions.get('cam_v2_complete_job'),
  /cam_v2_lock_job_mutation_authority\([\s\S]*?'mmc\.worker\.complete', 'CURRENT_LEASE'/);
assert.ok(
  (rpcDefinitions.get('cam_v2_complete_job').match(/cam_v2_terminal_completion_replay\(/g) ?? []).length >= 2,
  'completion must recheck an exact terminal receipt after audit-lock serialization',
);
assert.ok(
  (rpcDefinitions.get('cam_v2_complete_outbox').match(/cam_v2_terminal_outbox_completion_replay\(/g) ?? []).length >= 2,
  'outbox completion must recheck an exact terminal receipt after audit-lock serialization',
);
assert.ok(
  rpcDefinitions.get('cam_v2_record_inbox_effect').indexOf('Lost-response replay')
    < rpcDefinitions.get('cam_v2_record_inbox_effect').indexOf("cam_v2_lock_outbox_delivery(p_outbox_event_id, 'CURRENT_LEASE')"),
  'exact inbox receipt replay must precede current-lease enforcement',
);
assert.match(
  rpcDefinitions.get('cam_v2_register_job_input'),
  /source\.asset_state IN \('PAIR_VERIFIED', 'ATTACHED', 'RETAINED'\)\s+FOR UPDATE/,
  'source eligibility must remain locked through immutable handoff-edge insertion',
);
assert.match(
  rpcDefinitions.get('cam_v2_register_job_input'),
  /transcript\.transcript_state = 'VERIFIED'\s+FOR UPDATE/,
  'transcript eligibility must remain locked through immutable handoff-edge insertion',
);

// Every SECURITY DEFINER is explicitly removed from PUBLIC/anon/authenticated
// before the reviewed outer RPC/read-helper allowlist is granted back.
const functionDefinitions = [];
for (const match of migration.matchAll(/CREATE OR REPLACE FUNCTION mmc\.([a-z0-9_]+)\s*\(/g)) {
  const end = migration.indexOf('\n$$;', match.index);
  assert.notEqual(end, -1, `unterminated function definition ${match[1]}`);
  const source = migration.slice(match.index, end + 4);
  functionDefinitions.push({
    name: match[1],
    signature: extractFunctionIdentitySignature(match[1], source),
    source,
  });
}
const securityDefiners = functionDefinitions.filter(({ source }) => source.includes('SECURITY DEFINER'));
assert.equal(securityDefiners.length, 74, 'review the SECURITY DEFINER inventory when its count changes');
const revokedSignatures = new Set(
  [...migration.matchAll(
    /REVOKE ALL ON FUNCTION mmc\.([a-z0-9_]+)\(([^)]*)\) FROM PUBLIC, anon(?:, authenticated)?;/g,
  )].map((match) => `${match[1]}(${splitSqlParameters(match[2]).map(normalizeSqlType).join(',')})`),
);
for (const { signature } of securityDefiners) {
  assert.ok(
    revokedSignatures.has(signature),
    `SECURITY DEFINER ${signature} lacks an exact-signature PUBLIC/anon revoke`,
  );
}
assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION mmc\.[^(]+\([^;]+\) TO (?:PUBLIC|anon);/i,
  'no function may be executable by PUBLIC or anon');

// Durable lowercase SHA-256 fields may never degrade to arbitrary text.
for (const table of requiredTables) {
  const body = extractTableBody(table);
  const digestColumns = [...body.matchAll(/\b([a-z0-9_]+_digest) text\b/g)].map((match) => match[1]);
  for (const column of digestColumns) {
    assert.ok(
      body.includes(`${column} ~ '^[a-f0-9]{64}$'`),
      `${table}.${column} lacks an exact lowercase SHA-256 CHECK`,
    );
  }
}

assert.match(migration, /provider_idempotency_key_digest text NOT NULL/,
  'every external provider call must persist one stable idempotency key');
assert.match(migration, /CHECK \(provider_execution_mode = 'EXTERNAL'\)/,
  'the unreviewed internal-provider completion path must remain sealed');
assert.match(migration, /cam_v2_terminal_completion_replay\(/,
  'terminal worker completion must support exact lost-response replay');
assert.match(migration, /cam_v2_terminal_reconciliation_replay\(/,
  'terminal operator reconciliation must support exact lost-response replay');
assert.match(migration, /cam_v2_terminal_outbox_completion_replay\(/,
  'terminal outbox control completion must support exact lost-response replay');
assert.match(migration, /delivery_state = 'QUARANTINED'/,
  'late provider results must be preserved as quarantined evidence');
assert.match(migration, /external_result_recorded_at = v_recorded_at/,
  'job and quarantine evidence must share one exact provider-result timestamp');
assert.match(migration, /external_resolution = v_finding \|\| ':' \|\| v_disposition/,
  'operator recovery must resolve the exact quarantined evidence row');

assert.match(migration, /NEW\.safe_plain_text := CASE NEW\.item_kind/,
  'publication readback text must be derived from the typed payload');
assert.match(migration, /NEW\.due_at := CASE\s+WHEN NEW\.item_kind = 'TASK'/,
  'publication due time must be derived from the typed payload');
assert.match(migration, /cam_v2_sha256_jsonb\(jsonb_build_object\(/,
  'publication source versions must use canonical keyed JSONB hashing');
assert.match(migration, /cam_v2_is_valid_rfc3339\(value\)/,
  'publication timestamps must use the strict calendar-aware parser');
assert.match(migration, /item_payload ->> 'changeSummary', 'x'\)\) > 2048/,
  'SQL correction changeSummary cap must equal the JS summary byte cap');
assert.match(migration, /NEW\.item_kind = 'PLAN_UPDATE'[\s\S]{0,120}item_payload ->> 'summary'\) > 2048/,
  'SQL plan-update summary cap must equal the JS summary byte cap');
assert.match(migration, /NEW\.item_kind = 'SESSION_SUMMARY'[\s\S]{0,120}item_payload ->> 'summary'\) > 4096/,
  'SQL session-summary cap must equal the JS body byte cap');
assert.match(migration, /eyJ\[A-Za-z0-9_-\]\{6,\}\[\.\]eyJ/,
  'publication payload safety must reject JWT-shaped credentials');
assert.match(migration, /cam_v2_enforce_publication_seal/,
  'published projection/item truth must be digest-attested and immutable');
assert.match(migration, /v_item_count NOT BETWEEN 1 AND 100/,
  'SQL publication seal must enforce the JS one-to-100 item boundary');
assert.match(migration, /NEW\.item_set_digest IS DISTINCT FROM v_item_set_digest/,
  'readable publication state must verify the complete ordered child-attestation set');
assert.match(migration, /CREATE CONSTRAINT TRIGGER cam_v2_publications_final_coherence[\s\S]+DEFERRABLE INITIALLY DEFERRED/,
  'correction item/state parity must be checked against transaction-final publication truth');
assert.match(migration, /readable_head_subject_link_id uuid GENERATED ALWAYS AS/,
  'readable publication identity must be derived from durable publication state');
assert.match(migration,
  /CONSTRAINT cam_v2_publications_one_readable_head[\s\S]{0,220}DEFERRABLE INITIALLY DEFERRED/,
  'the single readable publication head must be concurrency-safe and transaction-deferred');
assert.match(migration, /v_readable_head_count > 1[\s\S]+cam_v2_publications_single_readable_head/,
  'transaction-final publication truth must reject dual readable subject heads');
const publicationSealDefinition = extractFunction('cam_v2_enforce_publication_seal');
assert.doesNotMatch(publicationSealDefinition, /OLD\.publication_state = 'CORRECTED'/,
  'CORRECTED must remain fail-closed terminal until the contradictory JS outgoing-state contract is resolved');
assert.match(publicationSealDefinition,
  /NEW\.created_at IS DISTINCT FROM OLD\.created_at[\s\S]+NEW\.object_version IS DISTINCT FROM OLD\.object_version \+ 1/,
  'every publication mutation must preserve creation time and advance exactly one version');
assert.match(publicationSealDefinition,
  /publication item mutations require immutable creation time and one exact version advance[\s\S]+cam_v2_publication_items_version_fence/,
  'every publication-item mutation must preserve creation time and advance exactly one version');
assert.match(publicationSealDefinition,
  /predecessor\.publication_state IN \('PUBLISHED', 'ACKNOWLEDGED'\)[\s\S]+FOR UPDATE/,
  'a successor seal must lock an exact readable current predecessor');
assert.match(migration, /projection_digest is the JS authority digest/,
  'SQL must not overload the JS projection digest with its independent item-set seal');
assert.match(migration, /\[1-8\]\[0-9a-fA-F\]\{3\}/,
  'wire UUID validation must accept RFC 9562 versions 1 through 8');
assert.doesNotMatch(migration, /\[1-9\]\[0-9a-fA-F\]\{3\}/,
  'wire UUID validation must reject reserved UUID version 9');
assert.match(migration, /cam_v2_enforce_student_authorship_and_target/,
  'student-authored rows require exact durable student and target binding');
assert.match(migration, /student_principal_kind text NOT NULL DEFAULT 'STUDENT'/,
  'subject links must bind the referenced principal role structurally');
assert.match(migration, /mentor_principal_kind text NOT NULL DEFAULT 'MENTOR'/,
  'assignments must bind the referenced principal role structurally');

// Owner sessions and future privileged adapters must not be able to rewrite
// durable trust scope, role provenance, evidence lineage, or delivery receipts.
for (const invariant of [
  'cam_v2_principal_role_exact',
  'cam_v2_subject_link_verified_binding_immutable',
  'cam_v2_assignment_binding_immutable',
  'cam_v2_policy_version_immutable',
  'cam_v2_authority_grant_immutable',
  'cam_v2_durable_evidence_append_only',
  'cam_v2_lineage_core_immutable',
  'cam_v2_lineage_active_endpoint_version',
  'cam_v2_publication_items_version_fence',
  'cam_v2_job_reclaim_exact',
  'cam_v2_job_terminal_evidence_immutable',
  'cam_v2_job_success_provider_evidence',
  'cam_v2_outbox_delivered_effect_exact',
]) {
  assert.ok(migration.includes(invariant), `missing structural invariant ${invariant}`);
}
assert.match(migration, /CHECK \(assignment_scope = 'COACHING'\)/,
  'assignment scope must be the one reviewed coaching scope');
assert.match(migration, /CHECK \(queue_name ~ '\^\[a-z0-9\]\[a-z0-9\._-\]\{0,63\}\$'\)/,
  'durable queue names require a bounded canonical form');
assert.match(migration, /\(status IN \('LEASED', 'RUNNING'\)[\s\S]{0,180}lease_owner_principal_id IS NOT NULL/,
  'job state and lease evidence must have one coherent shape');
assert.match(migration, /\(delivery_state IN \('PENDING', 'QUARANTINED', 'LEASED'\)[\s\S]{0,120}delivered_at IS NULL/,
  'outbox state and lease or terminal evidence must have one coherent shape');
assert.match(migration,
  /FOREIGN KEY \(tenant_id, environment, authority_grant_id, authoring_assignment_id, subject_link_id\)/,
  'publications require one exact durable publication grant');
assert.match(migration,
  /p_approved_by_principal_id = v_assignment_mentor_id/,
  'publication approval must bind the exact assigned mentor');
assert.match(migration,
  /FOREIGN KEY \(tenant_id, environment, assignment_id, subject_link_id, reviewer_principal_id\)/,
  'review decisions must bind the exact assigned mentor');
assert.match(migration,
  /FOREIGN KEY \(tenant_id, environment, principal_id, effective_principal_kind\)/,
  'audit events must bind the effective role to the exact durable principal');
assert.match(migration, /cam_v2_outbox_origin_is_active/,
  'outbox delivery must revalidate the exact originating authority');
assert.match(migration, /CREATE TRIGGER cam_v2_01_cutover_lifecycle/,
  'cutover state must preserve trust-plane dependency ordering');
assert.match(migration, /CREATE TRIGGER cam_v2_01_lineage_lifecycle/,
  'lineage evidence must reject mutation');
assert.match(migration,
  /CREATE CONSTRAINT TRIGGER cam_v2_jobs_success_evidence[\s\S]+DEFERRABLE INITIALLY DEFERRED/,
  'successful jobs require transaction-final provider and typed-handoff evidence');
const jobLeaseTransitionDefinition = extractFunction('cam_v2_enforce_job_lease_transition');
assert.match(jobLeaseTransitionDefinition,
  /OLD\.status IN \('SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'\)[\s\S]+cam_v2_job_terminal_evidence_immutable/,
  'terminal jobs must reject every later evidence or completion rewrite');
const jobSuccessEvidenceDefinition = extractFunction('cam_v2_enforce_job_success_evidence');
for (const exactProviderField of [
  'external_provider_receipt_digest',
  'external_provider_idempotency_proven',
  'external_provider_idempotency_key_digest',
]) {
  assert.ok(jobSuccessEvidenceDefinition.includes(`evidence.${exactProviderField}`),
    `successful-job evidence must bind exact ${exactProviderField}`);
}
assert.match(migration, /CREATE TRIGGER cam_v2_04_outbox_delivered_effect/,
  'outbox delivery must require an exact consumer effect and inbox receipt');
assert.equal(
  (migration.match(/CREATE TRIGGER cam_v2_04_active_lineage_guard/g) ?? []).length,
  13,
  'every governed lineage endpoint table must protect active exact versions',
);
assert.match(migration, /CREATE TRIGGER cam_v2_99_consumer_effects_append_only/,
  'consumer effects must remain append-only');
assert.match(migration, /CREATE TRIGGER cam_v2_99_consumer_inbox_append_only/,
  'consumer inbox receipts must remain append-only');

for (const triggerTable of [
  'cam_v2_jobs',
  'cam_v2_consumer_effects',
  'cam_v2_consumer_inbox',
  'cam_v2_job_inputs',
]) {
  assert.match(
    migration,
    new RegExp(`CREATE TRIGGER [^\\n]+\\nAFTER (?:UPDATE|INSERT) ON mmc\\.${triggerTable}\\nFOR EACH ROW EXECUTE FUNCTION mmc\\.cam_v2_audit_runtime_mutation\\(\\);`),
    `${triggerTable} runtime mutation is not transactionally audited`,
  );
}
assert.match(
  migration,
  /CREATE TRIGGER cam_v2_outbox_runtime_audit\nAFTER INSERT OR UPDATE ON mmc\.cam_v2_outbox_events\nFOR EACH ROW EXECUTE FUNCTION mmc\.cam_v2_audit_runtime_mutation\(\);/,
  'outbox appends and transitions must both be transactionally audited',
);
const runtimeAuditDefinition = extractFunction('cam_v2_audit_runtime_mutation');
assert.match(runtimeAuditDefinition,
  /NEW\.external_result_generation IS NOT NULL[\s\S]+JOB_EXTERNAL_RESULT_RECORDED/,
  'clearing provider-result evidence for retry must not be mislabeled as recording it');
assert.match(runtimeAuditDefinition,
  /NEW\.external_dispatch_generation IS NOT NULL[\s\S]+JOB_EXTERNAL_DISPATCH_RECORDED/,
  'clearing provider-dispatch evidence for retry must not be mislabeled as recording it');

assert.match(validation, /^-- Validation:/);
assert.match(validation, /BEGIN;/);
assert.match(validation, /ROLLBACK;\s*$/);
assert.doesNotMatch(validation, /COMMIT;/);
assert.match(validation, /mmc\.schema_build_target/);
for (const marker of [
  'ROLE_CAPABILITY_MATRIX',
  'CROSS_TENANT_DENY',
  'CROSS_ENVIRONMENT_DENY',
  'WRONG_SUBJECT_DENY',
  'REVOKED_ASSIGNMENT_DENY',
  'REVOKED_PRINCIPAL_DENY',
  'REVOKED_TENANT_DENY',
  'STALE_WORKER_GENERATION_DENY',
  'QUEUE_MISMATCH_DENY',
  'REVOKED_AUTHORITY_DENY',
  'NO_DIRECT_DML_DENY',
  'CUTOVER_PLANE_DENY',
  'EXACT_WORKER_QUEUE_ALLOW',
  'EXACT_STUDENT_PUBLICATION_ALLOW',
  'STRICT_TIMESTAMP_AND_UUID_PARITY',
  'CANONICAL_BINDING_MISMATCH_DENY',
  'PUBLICATION_SUBJECT_BINDING_DENY',
  'PUBLICATION_SOURCE_ELIGIBILITY_DENY',
  'PUBLICATION_PROJECTION_SEAL',
  'PUBLICATION_JWT_SECRET_DENY',
  'SESSION_SUMMARY_BODY_CAP_PARITY',
  'PUBLICATION_ITEM_COUNT_BOUNDARY',
  'PUBLICATION_ITEM_VERSION_FENCE',
  'PUBLICATION_ITEM_ACTIVE_LINEAGE_VERSION_DENY',
  'PUBLICATION_SINGLE_READABLE_HEAD',
  'PUBLICATION_CORRECTION_FINAL_COHERENCE',
  'SOURCE_ASSET_PREHANDOFF_ENRICHMENT',
  'TYPED_AI_SUCCESS_ATTESTATION',
  'AUDIT_CHAIN_SERIALIZED_APPEND_ONLY',
  'STALE_PREFIX_NO_STARVATION',
  'EXACT_SIGNED_QUEUE_CLAIM_ALLOW',
  'OUTBOX_BOUND_EFFECT_ALLOW',
  'ATOMIC_INBOX_EFFECT',
  'EXACT_RECEIPT_REPLAY',
  'QUARANTINED_RESULT_NOT_CLAIMABLE',
  'WORKER_RETRY_COMPLETION_REPLAY',
  'OUTBOX_CONTROL_COMPLETION_REPLAY',
  'EVIDENCE_BACKED_OPERATOR_RECOVERY',
  'STRUCTURAL_ROLE_STATE_AND_IMMUTABILITY_DENY',
  'SUBJECT_REVOCATION_FENCES_RUNTIME',
  'STUDENT_REVOCATION_FENCES_SCOPED_OUTBOX',
  'ACTIVE_EXPIRY_IMMUTABILITY_DENY',
  'POLICY_RETIREMENT_AFTER_APPROVER_REVOCATION',
  'JOB_RECLAIM_SHAPE_DENY',
  'JOB_TERMINAL_EVIDENCE_IMMUTABILITY_DENY',
  'EXPIRED_RUNNING_RECLAIM',
  'JOB_SUCCESS_EVIDENCE_DENY',
  'OUTBOX_DELIVERY_EFFECT_DENY',
  'INACTIVE_WORK_TERMINAL_CLEANUP',
]) {
  assert.ok(validation.includes(marker), `RLS validation omits ${marker}`);
}
assert.ok(
  validation.indexOf('RESET ROLE;') < validation.indexOf('SET LOCAL ROLE authenticated;'),
  'validation fixtures must bootstrap in owner context before authenticated assertions',
);
assert.match(validation, /SET LOCAL row_security = off;/, 'owner bootstrap must be explicit');
assert.match(validation, /SET LOCAL row_security = on;\s*SET LOCAL ROLE authenticated;/,
  'runtime assertions must restore RLS before assuming authenticated');
for (const capability of capabilityContracts) {
  assert.ok(validation.includes(capability), `RLS validation matrix omits ${capability}`);
}

console.log(JSON.stringify({
  result: 'MMC_V2_SCHEMA_CONTRACT_VALID',
  migration: migrationName,
  tables: requiredTables.length,
  forcedRlsTables: requiredTables.length,
  validation: validationName,
  schemaApplied: false,
}, null, 2));
