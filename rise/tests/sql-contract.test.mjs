import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const upPath = path.resolve(here, "../sql/001_rise_registry.proposed.sql");
const downPath = path.resolve(here, "../sql/001_rise_registry.down.proposed.sql");
const appUpPath = path.resolve(here, "../sql/002_rise_app_and_audit.proposed.sql");
const appDownPath = path.resolve(here, "../sql/002_rise_app_and_audit.down.proposed.sql");
const hardeningUpPath = path.resolve(here, "../sql/003_rise_release_security_hardening.proposed.sql");
const hardeningDownPath = path.resolve(here, "../sql/003_rise_release_security_hardening.down.proposed.sql");
const studentStateUpPath = path.resolve(here, "../sql/004_student_program_state.proposed.sql");
const studentStateDownPath = path.resolve(here, "../sql/004_student_program_state.down.proposed.sql");

async function readUp() {
  return fs.readFile(upPath, "utf8");
}

function tableBody(sql, table) {
  const match = sql.match(new RegExp(`CREATE TABLE rise\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(match, `missing rise.${table}`);
  return match[1];
}

function functionBody(sql, name) {
  const match = sql.match(new RegExp(`CREATE FUNCTION rise\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`));
  assert.ok(match, `missing rise.${name}`);
  return match[1];
}

test("proposed registry schema is transaction-scoped and fail-closed", async () => {
  const sql = await readUp();
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS rise;/);
  assert.match(sql, /REVOKE ALL ON SCHEMA rise FROM PUBLIC;/);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA rise FROM PUBLIC;/);
  assert.match(sql, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise FROM PUBLIC;/);
  for (const table of [
    "registry_releases", "registry_activation_history", "registry_active_release",
    "import_runs", "source_documents", "programs", "specialties",
    "program_specialties", "browse_memberships", "claims", "quarantined_observations",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE rise\\.${table} \\(`));
  }
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|SCHEMA)/i);
  assert.match(sql, /CREATE ROLE rise_registry_reader NOLOGIN/);
  assert.match(sql, /CREATE ROLE rise_registry_importer NOLOGIN/);
  assert.match(sql, /CREATE ROLE rise_registry_release_manager NOLOGIN/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION rise\.set_active_registry_release[\s\S]*TO rise_registry_release_manager/);
  assert.doesNotMatch(sql, /GRANT\s+(?:UPDATE|DELETE)[\s\S]*TO rise_registry_(?:reader|importer|release_manager)/i);
});

test("snapshot-owned stable IDs are release-scoped composite primary keys", async () => {
  const sql = await readUp();
  const scopedIds = new Map([
    ["import_runs", "import_run_id"],
    ["source_documents", "source_document_id"],
    ["programs", "program_id"],
    ["specialties", "specialty_id"],
    ["program_specialties", "program_specialty_id"],
    ["browse_memberships", "browse_membership_id"],
    ["claims", "claim_id"],
    ["quarantined_observations", "quarantine_id"],
  ]);

  for (const [table, stableId] of scopedIds) {
    const body = tableBody(sql, table);
    assert.match(body, new RegExp(`PRIMARY KEY \\(release_id, ${stableId}\\)`));
    assert.doesNotMatch(body, new RegExp(`${stableId}\\s+text\\s+PRIMARY KEY`));
  }
});

test("all snapshot relationships include release_id and reject cross-release provenance", async () => {
  const sql = await readUp();
  const expectedForeignKeys = [
    ["programs", "source_document_id", "source_documents"],
    ["program_specialties", "program_id", "programs"],
    ["browse_memberships", "program_specialty_id", "program_specialties"],
    ["browse_memberships", "specialty_id", "specialties"],
    ["claims", "source_document_id", "source_documents"],
    ["claims", "program_id", "programs"],
    ["claims", "program_specialty_id", "program_specialties"],
  ];

  for (const [table, stableId, target] of expectedForeignKeys) {
    const body = tableBody(sql, table);
    assert.match(
      body,
      new RegExp(`FOREIGN KEY \\(release_id, ${stableId}\\)\\s+REFERENCES rise\\.${target}\\(release_id, ${stableId}\\)`),
    );
  }

  assert.doesNotMatch(
    sql,
    /REFERENCES rise\.(?:source_documents|programs|specialties|program_specialties)\s*\((?:source_document_id|program_id|specialty_id|program_specialty_id)\)/,
  );

  const claims = tableBody(sql, "claims");
  assert.match(claims, /subject_type = 'program' AND program_id IS NOT NULL AND program_id = subject_id AND program_specialty_id IS NULL/);
  assert.match(claims, /subject_type = 'program_specialty' AND program_specialty_id IS NOT NULL AND program_specialty_id = subject_id AND program_id IS NULL/);
});

test("browse relationship vocabulary includes related single-specialty aliases", async () => {
  const memberships = tableBody(await readUp(), "browse_memberships");
  assert.match(
    memberships,
    /relationship IN \('EXACT_DESIGNATION', 'RELATED_SPECIALTY', 'RELATED_COMBINED'\)/,
  );
});

test("claim publication vocabulary distinguishes attributed snapshots from quarantine", async () => {
  const claims = tableBody(await readUp(), "claims");
  assert.match(
    claims,
    /publication IN \('source_attributed_snapshot', 'quarantined'\)/,
  );
  assert.doesNotMatch(claims, /evidence_labeled/);
});

test("active release pointer and activation history are consistent and auditable", async () => {
  const sql = await readUp();
  const pointer = tableBody(sql, "registry_active_release");
  const history = tableBody(sql, "registry_activation_history");

  assert.match(pointer, /singleton_key boolean PRIMARY KEY DEFAULT true CHECK \(singleton_key\)/);
  assert.match(sql, /INSERT INTO rise\.registry_active_release \(singleton_key\) VALUES \(true\);/);
  assert.match(
    pointer,
    /FOREIGN KEY \(last_activation_id, active_release_id\)\s+REFERENCES rise\.registry_activation_history\(activation_id, target_release_id\)/,
  );
  assert.match(history, /action text NOT NULL CHECK \(action IN \('activate', 'rollback'\)\)/);
  assert.match(history, /restores_activation_id bigint/);
  assert.match(
    history,
    /FOREIGN KEY \(restores_activation_id, target_release_id\)\s+REFERENCES rise\.registry_activation_history\(activation_id, target_release_id\)/,
  );
  assert.match(history, /action = 'rollback' AND restores_activation_id IS NOT NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX rise_registry_one_active_release_idx[\s\S]*WHERE activation_status = 'active';/);
});

test("one transactional function serializes activation and prior-release rollback", async () => {
  const sql = await readUp();
  const body = functionBody(sql, "set_active_registry_release");

  assert.match(sql, /CREATE FUNCTION rise\.set_active_registry_release\([\s\S]*p_action text/);
  assert.match(sql, /LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = pg_catalog, rise/);
  assert.match(body, /p_action IS NULL OR p_action NOT IN \('activate', 'rollback'\)/);
  assert.match(body, /FROM rise\.registry_active_release[\s\S]*FOR UPDATE;/);
  assert.match(body, /v_current_release_id IS DISTINCT FROM p_expected_current_release_id/);
  assert.match(body, /v_target_immutable IS DISTINCT FROM true/);
  assert.match(body, /v_target_status <> 'staging'/);
  assert.match(body, /v_target_status <> 'retired'/);
  assert.match(body, /target_release_id = p_target_release_id[\s\S]*activation_id < v_current_activation_id/);
  assert.match(body, /UPDATE rise\.registry_releases[\s\S]*SET activation_status = 'retired'/);
  assert.match(body, /UPDATE rise\.registry_releases[\s\S]*SET activation_status = 'active'/);
  assert.match(body, /INSERT INTO rise\.registry_activation_history/);
  assert.match(body, /p_actor_subject,[\s\S]*session_user,[\s\S]*p_reason/);
  assert.match(body, /UPDATE rise\.registry_active_release[\s\S]*last_activation_id = v_activation_id/);
  assert.match(body, /RETURN v_activation_id;/);
  assert.doesNotMatch(body, /\b(?:COMMIT|ROLLBACK)\b/);

  const historyInsert = body.indexOf("INSERT INTO rise.registry_activation_history");
  const pointerUpdate = body.indexOf("UPDATE rise.registry_active_release");
  assert.ok(historyInsert >= 0 && pointerUpdate > historyInsert, "history must be written before its pointer");
});

test("snapshot mutation is blocked and runtime roles receive least privilege", async () => {
  const sql = await readUp();
  assert.match(sql, /CREATE FUNCTION rise\.enforce_registry_release_insert_state\(\)[\s\S]*SECURITY DEFINER/);
  assert.match(sql, /CREATE FUNCTION rise\.enforce_open_release_snapshot_insert\(\)[\s\S]*SECURITY DEFINER/);
  assert.match(sql, /CREATE FUNCTION rise\.reject_snapshot_mutation\(\)[\s\S]*SECURITY DEFINER/);
  assert.match(sql, /CREATE FUNCTION rise\.enforce_registry_release_immutability\(\)[\s\S]*SECURITY DEFINER/);
  assert.match(sql, /RISE immutable release identity, source, counts, and creation metadata cannot change/);
  for (const table of [
    "import_runs", "source_documents", "programs", "specialties", "program_specialties",
    "browse_memberships", "claims", "quarantined_observations", "activation_history",
  ]) {
    assert.match(sql, new RegExp(`CREATE TRIGGER rise_${table}_append_only`));
  }
  for (const table of [
    "import_runs", "source_documents", "programs", "specialties", "program_specialties",
    "browse_memberships", "claims", "quarantined_observations",
  ]) {
    assert.match(sql, new RegExp(`CREATE TRIGGER rise_${table}_open_release_insert`));
  }
  const initialStateGuard = functionBody(sql, "enforce_registry_release_insert_state");
  assert.match(initialStateGuard, /NEW\.activation_status NOT IN \('offline_shadow_only', 'staging'\)/);
  const snapshotInsertGuard = functionBody(sql, "enforce_open_release_snapshot_insert");
  assert.match(snapshotInsertGuard, /WHERE release_id = NEW\.release_id\s+FOR SHARE;/);
  assert.match(snapshotInsertGuard, /v_release_status NOT IN \('offline_shadow_only', 'staging'\)/);
  assert.match(sql, /CREATE TRIGGER rise_registry_releases_valid_initial_state\s+BEFORE INSERT ON rise\.registry_releases/);
  assert.match(sql, /GRANT SELECT, INSERT ON[\s\S]*TO rise_registry_importer;/);
  assert.match(sql, /GRANT SELECT ON ALL TABLES IN SCHEMA rise TO rise_registry_reader;/);
  assert.match(tableBody(sql, "registry_activation_history"), /actor_database_role text NOT NULL/);
});

test("proposed rollback refuses destructive schema deletion", async () => {
  const sql = await fs.readFile(downPath, "utf8");
  assert.match(sql, /intentionally fail-closed/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.match(sql, /reactivate a verified release instead/);
  assert.doesNotMatch(sql, /DROP\s+(?:DATABASE|ROLE|SCHEMA|TABLE)/i);
  assert.doesNotMatch(sql, /public\./i);
});

test("private application schema models consent, sessions, comparisons, handoffs, and operator work", async () => {
  const sql = await fs.readFile(appUpPath, "utf8");
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS rise_app;/);
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS rise_audit;/);
  for (const table of [
    "authorization_code_redemptions", "sessions", "profile_consents", "profile_projections",
    "saved_programs", "comparison_sets", "comparison_set_members", "match_assessments",
    "handoff_grants", "intelligence_queue_items",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE rise_app\\.${table} \\(`));
    assert.match(sql, new RegExp(`ALTER TABLE rise_app\\.${table} ENABLE ROW LEVEL SECURITY;`));
    assert.match(sql, new RegExp(`ALTER TABLE rise_app\\.${table} FORCE ROW LEVEL SECURITY;`));
  }
  assert.match(sql, /code_expires_at <= code_issued_at \+ interval '60 seconds'/);
  assert.match(sql, /expires_at <= issued_at \+ interval '5 minutes'/);
  assert.match(sql, /encrypted_projection bytea NOT NULL/);
  assert.match(sql, /purpose text NOT NULL CHECK \(purpose = 'rise_program_compatibility'\)/);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA rise_app FROM PUBLIC;/);
  assert.doesNotMatch(sql, /GRANT[\s\S]+TO PUBLIC/i);
});

test("audit and recovery evidence are append-only and private", async () => {
  const sql = await fs.readFile(appUpPath, "utf8");
  assert.match(sql, /CREATE TABLE rise_audit\.audit_events \(/);
  assert.match(sql, /CREATE TABLE rise_audit\.recovery_checkpoints \(/);
  assert.match(sql, /previous_event_sha256 char\(64\)/);
  assert.match(sql, /restore_rehearsal_status text NOT NULL/);
  assert.match(sql, /CREATE FUNCTION rise_audit\.reject_immutable_mutation\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, rise_audit/);
  assert.match(sql, /CREATE TRIGGER rise_audit_events_immutable/);
  assert.match(sql, /CREATE TRIGGER rise_recovery_checkpoints_immutable/);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA rise_audit FROM PUBLIC;/);
});

test("app and audit rollback refuses destructive schema deletion", async () => {
  const sql = await fs.readFile(appDownPath, "utf8");
  assert.match(sql, /intentionally fail-closed/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.doesNotMatch(sql, /DROP\s+(?:DATABASE|ROLE|SCHEMA|TABLE)/i);
});

test("release hardening binds activation to validation and current source rights", async () => {
  const sql = await fs.readFile(hardeningUpPath, "utf8");
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /ADD COLUMN data_classification text/);
  assert.match(sql, /ADD COLUMN source_authorization_set_sha256 char\(64\)/);
  assert.match(sql, /CREATE TABLE rise\.source_authorization_receipts/);
  assert.match(sql, /CREATE TABLE rise\.source_authorization_revocations/);
  assert.match(sql, /CREATE TABLE rise\.release_validation_receipts/);
  assert.match(sql, /UNIQUE \(release_id, source_authorization_set_sha256\)/);
  assert.equal((sql.match(/FOREIGN KEY \(release_id, source_authorization_set_sha256\)/g) ?? []).length, 2);
  assert.match(sql, /CREATE FUNCTION rise\.enforce_release_activation_evidence\(\)/);
  assert.match(sql, /NEW\.data_classification IS DISTINCT FROM 'source_controlled_registry'/);
  assert.match(sql, /auth_receipt\.revoked_at IS NOT NULL/);
  assert.match(sql, /auth_receipt\.valid_through < current_date/);
  assert.match(sql, /auth_receipt\.source_authorization_set_sha256 IS DISTINCT FROM NEW\.source_authorization_set_sha256/);
  assert.match(sql, /auth_receipt\.verified_at > now\(\)/);
  assert.match(sql, /v_validation\.validated_at > now\(\)/);
  assert.match(sql, /auth_revocation\.release_id IS NOT NULL/);
  assert.match(sql, /CREATE TRIGGER rise_registry_release_activation_evidence/);
  assert.match(sql, /CREATE TRIGGER rise_source_authorization_revocations_append_only/);
  assert.doesNotMatch(sql, /DROP\s+(?:DATABASE|ROLE|SCHEMA|TABLE)/i);
});

test("release hardening binds session identity and serializes externally computed HMAC audit records", async () => {
  const sql = await fs.readFile(hardeningUpPath, "utf8");
  assert.match(sql, /UNIQUE \(jti_sha256, subject_id, issuer, audience, role, capabilities\)/);
  assert.match(sql, /FOREIGN KEY \(jti_sha256, subject_id, issuer, audience, role, capabilities\)/);
  assert.match(sql, /ADD COLUMN hash_algorithm text NOT NULL CHECK \(hash_algorithm = 'hmac-sha256'\)/);
  assert.match(sql, /UNIQUE \(event_sha256\)/);
  assert.match(sql, /FOREIGN KEY \(previous_event_sha256\) REFERENCES rise_audit\.audit_events\(event_sha256\)/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('rise_audit_event_chain_v1'\)\)/);
  assert.match(sql, /NEW\.previous_event_sha256 IS DISTINCT FROM v_previous_sha256/);
  assert.match(sql, /CREATE TRIGGER rise_audit_events_chain_guard/);
});

test("registry readers can select only active, non-quarantine views", async () => {
  const sql = await fs.readFile(hardeningUpPath, "utf8");
  assert.match(sql, /REVOKE SELECT ON ALL TABLES IN SCHEMA rise FROM rise_registry_reader/);
  assert.match(sql, /CREATE VIEW rise\.current_authorized_release/);
  assert.match(sql, /LEFT JOIN rise\.source_authorization_revocations AS revocation/);
  for (const view of [
    "active_registry_release", "active_programs", "active_specialties", "active_program_specialties",
    "active_browse_memberships", "active_claims", "active_source_documents",
  ]) {
    assert.match(sql, new RegExp(`CREATE VIEW rise\\.${view}`));
  }
  assert.equal((sql.match(/JOIN rise\.current_authorized_release AS active/g) ?? []).length, 7);
  assert.match(sql, /WHERE claim\.publication = 'source_attributed_snapshot'/);
  assert.doesNotMatch(sql, /GRANT SELECT ON[\s\S]*quarantined_observations[\s\S]*TO rise_registry_reader/);
});

test("security-hardening rollback refuses weakening the evidence guards", async () => {
  const sql = await fs.readFile(hardeningDownPath, "utf8");
  assert.match(sql, /intentionally fail-closed/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.doesNotMatch(sql, /DROP\s+(?:DATABASE|ROLE|SCHEMA|TABLE)/i);
});

test("student program state is durable, subject-isolated, and release-aware", async () => {
  const sql = await fs.readFile(studentStateUpPath, "utf8");
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /CREATE ROLE rise_student_state_runtime NOLOGIN/);
  assert.match(sql, /CREATE TABLE rise_app\.student_program_states/);
  assert.match(sql, /PRIMARY KEY \(subject_key, program_specialty_id\)/);
  assert.match(sql, /FOREIGN KEY \(last_bound_release_id, program_specialty_id\)/);
  assert.match(sql, /REFERENCES rise\.program_specialties\(release_id, program_specialty_id\)/);
  assert.match(sql, /state IN \('SAVED', 'APPLIED', 'INTERVIEWING', 'RANKED'\)/);
  assert.match(sql, /length\(notes\) <= 4000/);
  assert.match(sql, /CREATE INDEX rise_student_program_states_subject_updated_idx/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /current_setting\('rise\.subject_key', true\)/);
  assert.match(sql, /REVOKE ALL ON rise_app\.student_program_states FROM PUBLIC/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON rise_app\.student_program_states TO rise_student_state_runtime/);
  assert.doesNotMatch(sql, /GRANT[\s\S]+TO PUBLIC/i);
  assert.doesNotMatch(sql, /DROP\s+(?:DATABASE|ROLE|SCHEMA|TABLE)/i);
});

test("student-state rollback preserves user data", async () => {
  const sql = await fs.readFile(studentStateDownPath, "utf8");
  assert.match(sql, /Destructive rollback refused/);
  assert.match(sql, /preserve student program state/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.doesNotMatch(sql, /DROP\s+(?:DATABASE|ROLE|SCHEMA|TABLE)/i);
});
