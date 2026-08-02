import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.D1_411C_PGHOST || "127.0.0.1";
const port = process.env.D1_411C_PGPORT || "55412";
const user = process.env.D1_411C_PGUSER || process.env.USER;
const database = process.env.D1_411C_PGDATABASE || "d1_411c_proof";

if (!["127.0.0.1", "localhost", "::1"].includes(host) || !database.startsWith("d1_411c_")) {
  throw new Error("D1_411C_RLS_PROOF_REFUSES_NONLOCAL_OR_NONDISPOSABLE_DATABASE");
}

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync("psql", ["-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(JSON.stringify({ args, status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }));
  }
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function file(path) {
  return run(["-f", join(root, path)]);
}

function sql(statement, options) {
  return run(["-c", statement], options);
}

file("database/migrations/202607150001_timeline_v1.down.sql");
file("database/migrations/202607150001_timeline_v1.sql");
file("database/disposable/seed_413.sql");
file("database/migrations/202607150002_timeline_v1_413_hardening.sql");
file("database/migrations/202608020003_d1_411c_identity_and_admin_grants.sql");
file("database/roles/202608020001_d1_411c_runtime_roles.sql");

const claims = (principalId, wpUserId, role, extra = {}) => JSON.stringify({
  sub: principalId,
  wp_user_id: wpUserId,
  timeline_role: role,
  program_ids: role === "PROGRAM_ADMIN" ? ["program_a"] : role === "STUDENT" ? [principalId === "student_a" ? "program_a" : "program_b"] : [],
  has_learndash_3893_access: role === "STUDENT",
  is_wordpress_administrator: role === "PROGRAM_ADMIN",
  ...extra,
}).replaceAll("'", "''");

function visibleDocuments(claimSet) {
  return Number(sql(`begin; set local role timeline_authenticated; select set_config('request.jwt.claims','${claimSet}',true); select count(*) from timeline.documents; rollback;`).stdout.split("\n").at(-1));
}

const adminClaims = claims("program_admin_a", 410006, "PROGRAM_ADMIN");
const studentAClaims = claims("student_a", 410001, "STUDENT");
const studentBClaims = claims("student_b", 410002, "STUDENT");
const studentDeniedClaims = claims("student_a", 410001, "STUDENT", { has_learndash_3893_access: false });

const adminWithoutGrant = visibleDocuments(adminClaims);
const studentAOwn = visibleDocuments(studentAClaims);
const studentBCross = Number(sql(`begin; set local role timeline_authenticated; select set_config('request.jwt.claims','${studentBClaims}',true); select count(*) from timeline.documents where id='document_a'; rollback;`).stdout.split("\n").at(-1));
const deniedWithoutEntitlement = visibleDocuments(studentDeniedClaims);

sql(`
  insert into timeline.audit_events (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
  values ('grant_audit_411c', 'service_export', 'ADMIN_RESOURCE_GRANT', 'DOCUMENT', 'document_a', 'ALLOW', 'request_grant_411c',
    '{"administrator_principal_id":"program_admin_a","student_principal_id":"student_a"}'::jsonb);
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_411c', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'grant_audit_411c', 'Controlled beta support review', now() - interval '1 minute', now() + interval '1 day'
  );
`);

const adminWithGrant = visibleDocuments(adminClaims);
const identityMutation = sql("update timeline.principals set wp_user_id=999999 where id='student_a'", { allowFailure: true });

const result = {
  schema_version: sql("select timeline.schema_version()").stdout,
  admin_without_grant_visible_documents: adminWithoutGrant,
  admin_with_exact_grant_visible_documents: adminWithGrant,
  student_owner_visible_documents: studentAOwn,
  cross_student_target_visible_documents: studentBCross,
  student_without_learndash_3893_visible_documents: deniedWithoutEntitlement,
  immutable_identity_update_rejected: identityMutation.status !== 0 && identityMutation.stderr.includes("Timeline principal identity is immutable"),
};

const pass = result.schema_version === "d1-timeline-db-411c.1"
  && result.admin_without_grant_visible_documents === 0
  && result.admin_with_exact_grant_visible_documents === 1
  && result.student_owner_visible_documents === 1
  && result.cross_student_target_visible_documents === 0
  && result.student_without_learndash_3893_visible_documents === 0
  && result.immutable_identity_update_rejected;

process.stdout.write(`${JSON.stringify({ pass, ...result })}\n`);
if (!pass) process.exitCode = 1;
