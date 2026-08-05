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
file("database/migrations/202608040004_d1_500_grant_hardening.sql");
file("database/roles/202608040002_d1_500_runtime_roles.sql");
file("database/migrations/20260805223000_rc1_first_use_identity_provisioning.sql");

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
const grantAuthorityClaims = claims("service_export", 410009, "SERVICE", { service_scopes: ["audit:read"] });
const firstUsePrincipalId = "bce24766-0392-58f4-95ce-6655d2d952df";
const firstUseClaims = claims(firstUsePrincipalId, 410101, "STUDENT", { program_ids: [] });
const firstUseIneligibleClaims = claims("ba0c7a54-8354-51ef-91d2-253b75978cc8", 410102, "STUDENT", {
  program_ids: [], has_learndash_3893_access: false,
});

function affectedRows(claimSet, statement, role = "timeline_authenticated", persist = false) {
  return Number(sql(`begin; set local role ${role}; select set_config('request.jwt.claims','${claimSet}',true); with affected as (${statement} returning 1) select count(*) from affected; ${persist ? "commit" : "rollback"};`).stdout.split("\n").at(-1));
}

const adminWithoutGrant = visibleDocuments(adminClaims);
const studentAOwn = visibleDocuments(studentAClaims);
const studentBCross = Number(sql(`begin; set local role timeline_authenticated; select set_config('request.jwt.claims','${studentBClaims}',true); select count(*) from timeline.documents where id='document_a'; rollback;`).stdout.split("\n").at(-1));
const deniedWithoutEntitlement = visibleDocuments(studentDeniedClaims);
const studentAOwnUpdate = affectedRows(studentAClaims, "update timeline.documents set status=status where id='document_a'");
const studentBCrossUpdate = affectedRows(studentBClaims, "update timeline.documents set status=status where id='document_a'");

sql(`
  begin;
  set local role timeline_identity_sync;
  select set_config('request.jwt.claims','${firstUseClaims}',true);
  insert into timeline.principals (id, matrix_wp_user_id, wp_user_id, role, status)
  values ('${firstUsePrincipalId}', 410101, 410101, 'STUDENT', 'ACTIVE');
  insert into timeline.principal_programs (principal_id, program_id)
  values ('${firstUsePrincipalId}', 'missionmed-360:3893');
  insert into timeline.audit_events (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
  values ('audit_rc1_first_use', '${firstUsePrincipalId}', 'PRINCIPAL_PROVISIONED_FIRST_USE', 'PRINCIPAL', '${firstUsePrincipalId}', 'SUCCESS', 'request_rc1_first_use', '{}'::jsonb);
  commit;
`);
const firstUseAuthenticatedVisibility = Number(sql(`
  begin;
  set local role timeline_authenticated;
  select set_config('request.jwt.claims','${firstUseClaims}',true);
  select
    (select count(*) from timeline.principals where id='${firstUsePrincipalId}')
    + (select count(*) from timeline.principal_programs where principal_id='${firstUsePrincipalId}');
  rollback;
`).stdout.split("\n").at(-1));
const firstUseAuditCount = Number(sql(`
  begin;
  set local role timeline_authenticated;
  select set_config('request.jwt.claims','${firstUseClaims}',true);
  select count(*) from timeline.audit_events where id='audit_rc1_first_use';
  rollback;
`).stdout.split("\n").at(-1));
const firstUseIneligibleAttempt = sql(`
  begin;
  set local role timeline_identity_sync;
  select set_config('request.jwt.claims','${firstUseIneligibleClaims}',true);
  insert into timeline.principals (id, matrix_wp_user_id, wp_user_id, role, status)
  values ('ba0c7a54-8354-51ef-91d2-253b75978cc8', 410102, 410102, 'STUDENT', 'ACTIVE');
  rollback;
`, { allowFailure: true });
const firstUseCrossSubjectAttempt = sql(`
  begin;
  set local role timeline_identity_sync;
  select set_config('request.jwt.claims','${firstUseClaims}',true);
  insert into timeline.principals (id, matrix_wp_user_id, wp_user_id, role, status)
  values ('6bd1f3c3-6174-5afd-ac97-02e9a0ad2680', 410103, 410103, 'STUDENT', 'ACTIVE');
  rollback;
`, { allowFailure: true });

const ordinaryAdminGrantAttempt = sql(`
  begin;
  set local role timeline_authenticated;
  select set_config('request.jwt.claims','${adminClaims}',true);
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_ordinary_forbidden', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'breakglass_audit_1', 'Ordinary sessions must never grant access', now() - interval '1 minute', now() + interval '1 day'
  );
  rollback;
`, { allowFailure: true });

const missingAuditGrantAttempt = sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_missing_audit_411c', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'audit_does_not_exist', 'Missing audit must be rejected', now() - interval '1 minute', now() + interval '1 day'
  );
  rollback;
`, { allowFailure: true });

const authorityWithoutScopeAttempt = sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${claims("service_export", 410009, "SERVICE")}',true);
  insert into timeline.audit_events (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
  values ('grant_audit_no_scope_411c', 'service_export', 'ADMIN_RESOURCE_GRANT', 'DOCUMENT', 'document_a', 'ALLOW', 'request_no_scope_411c', '{}'::jsonb);
  rollback;
`, { allowFailure: true });

const mismatchedAuditGrantAttempt = sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  insert into timeline.audit_events (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
  values ('grant_audit_mismatch_411c', 'service_export', 'ADMIN_RESOURCE_GRANT', 'DOCUMENT', 'document_a', 'ALLOW', 'request_mismatch_411c',
    jsonb_build_object(
      'grant_id', 'grant_mismatch_411c',
      'administrator_principal_id', 'program_admin_a',
      'student_principal_id', 'student_b',
      'actions', to_jsonb(array['document:read']::text[]),
      'reason', 'Mismatched audit must be rejected',
      'starts_at', (now() - interval '1 minute')::text,
      'expires_at', (now() + interval '1 day')::text
    ));
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_mismatch_411c', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'grant_audit_mismatch_411c', 'Mismatched audit must be rejected', now() - interval '1 minute', now() + interval '1 day'
  );
  rollback;
`, { allowFailure: true });

sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  insert into timeline.audit_events (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
  values ('grant_audit_411c', 'service_export', 'ADMIN_RESOURCE_GRANT', 'DOCUMENT', 'document_a', 'ALLOW', 'request_grant_411c',
    jsonb_build_object(
      'grant_id', 'grant_411c',
      'administrator_principal_id', 'program_admin_a',
      'student_principal_id', 'student_a',
      'actions', to_jsonb(array['document:read']::text[]),
      'reason', 'Controlled beta support review',
      'starts_at', (now() - interval '1 minute')::text,
      'expires_at', (now() + interval '1 day')::text
    ));
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_411c', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'grant_audit_411c', 'Controlled beta support review', now() - interval '1 minute', now() + interval '1 day'
  );
  commit;
`);

const adminWithGrant = visibleDocuments(adminClaims);
const adminWrongDocument = Number(sql(`begin; set local role timeline_authenticated; select set_config('request.jwt.claims','${adminClaims}',true); select count(*) from timeline.documents where id='document_b'; rollback;`).stdout.split("\n").at(-1));
const adminReadGrantUpdate = affectedRows(adminClaims, "update timeline.documents set status=status where id='document_a'");
const reusedAuditGrantAttempt = sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_reuse_411c', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'grant_audit_411c', 'Controlled beta support review', now() - interval '1 minute', now() + interval '1 day'
  );
  rollback;
`, { allowFailure: true });
const grantScopeMutationAttempt = sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  update timeline.admin_resource_grants set actions=array['document:read','document:edit'] where id='grant_411c';
  rollback;
`, { allowFailure: true });
const grantDeleteAttempt = sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  delete from timeline.admin_resource_grants where id='grant_411c';
  rollback;
`, { allowFailure: true });
const grantRevoked = affectedRows(grantAuthorityClaims, "update timeline.admin_resource_grants set revoked_at=now() where id='grant_411c'", "timeline_grant_authority", true);
sql(`
  begin;
  set local role timeline_grant_authority;
  select set_config('request.jwt.claims','${grantAuthorityClaims}',true);
  insert into timeline.audit_events (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
  values ('grant_audit_expired_411c', 'service_export', 'ADMIN_RESOURCE_GRANT', 'DOCUMENT', 'document_a', 'ALLOW', 'request_expired_411c',
    jsonb_build_object(
      'grant_id', 'grant_expired_411c',
      'administrator_principal_id', 'program_admin_a',
      'student_principal_id', 'student_a',
      'actions', to_jsonb(array['document:read']::text[]),
      'reason', 'Expired grant must not authorize access',
      'starts_at', (now() - interval '2 days')::text,
      'expires_at', (now() - interval '1 day')::text
    ));
  insert into timeline.admin_resource_grants (
    id, administrator_principal_id, student_principal_id, document_id, actions,
    created_by_principal_id, authorization_audit_id, reason, starts_at, expires_at
  ) values (
    'grant_expired_411c', 'program_admin_a', 'student_a', 'document_a', array['document:read'],
    'service_export', 'grant_audit_expired_411c', 'Expired grant must not authorize access', now() - interval '2 days', now() - interval '1 day'
  );
  commit;
`);
const adminAfterRevocation = visibleDocuments(adminClaims);
const identityMutation = sql("update timeline.principals set wp_user_id=999999 where id='student_a'", { allowFailure: true });
const roleSafety = sql("select count(*) from pg_roles where rolname in ('timeline_authenticated','timeline_identity_sync','timeline_grant_authority') and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit and not rolbypassrls").stdout;
const leastPrivilegeLeaks = sql(`select (
  has_table_privilege('timeline_authenticated','timeline.admin_resource_grants','INSERT')
  or has_table_privilege('timeline_identity_sync','timeline.documents','SELECT')
  or has_table_privilege('timeline_grant_authority','timeline.documents','UPDATE')
  or has_table_privilege('timeline_grant_authority','timeline.audit_events','UPDATE')
)::int`).stdout;
const publicAccess = sql(`with public_surface as (
  select n.oid::text from pg_namespace n where n.nspname='timeline'
    and (has_schema_privilege('public',n.oid,'USAGE') or has_schema_privilege('public',n.oid,'CREATE'))
  union all
  select c.oid::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='timeline' and c.relkind in ('r','p','v','m') and (
      has_table_privilege('public',c.oid,'SELECT') or has_table_privilege('public',c.oid,'INSERT')
      or has_table_privilege('public',c.oid,'UPDATE') or has_table_privilege('public',c.oid,'DELETE')
      or has_table_privilege('public',c.oid,'TRUNCATE') or has_table_privilege('public',c.oid,'REFERENCES')
      or has_table_privilege('public',c.oid,'TRIGGER'))
  union all
  select c.oid::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='timeline' and c.relkind='S' and (
      has_sequence_privilege('public',c.oid,'USAGE') or has_sequence_privilege('public',c.oid,'SELECT')
      or has_sequence_privilege('public',c.oid,'UPDATE'))
  union all
  select p.oid::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='timeline' and has_function_privilege('public',p.oid,'EXECUTE')
) select count(*) from public_surface`).stdout;
const rlsUnsafeTables = sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='timeline' and c.relkind in ('r','p') and (not c.relrowsecurity or not c.relforcerowsecurity)").stdout;

const result = {
  schema_version: sql("select timeline.schema_version()").stdout,
  safe_runtime_role_count: Number(roleSafety),
  least_privilege_leak_count: Number(leastPrivilegeLeaks),
  public_access_surface_count: Number(publicAccess),
  tables_without_forced_rls: Number(rlsUnsafeTables),
  admin_without_grant_visible_documents: adminWithoutGrant,
  admin_with_exact_grant_visible_documents: adminWithGrant,
  admin_wrong_document_visible_documents: adminWrongDocument,
  admin_read_grant_updated_documents: adminReadGrantUpdate,
  grant_authority_revoked_grants: grantRevoked,
  admin_after_revocation_visible_documents: adminAfterRevocation,
  student_owner_visible_documents: studentAOwn,
  student_owner_updated_documents: studentAOwnUpdate,
  cross_student_target_visible_documents: studentBCross,
  cross_student_updated_documents: studentBCrossUpdate,
  student_without_learndash_3893_visible_documents: deniedWithoutEntitlement,
  first_use_authenticated_identity_rows: firstUseAuthenticatedVisibility,
  first_use_audit_rows: firstUseAuditCount,
  first_use_ineligible_rejected: firstUseIneligibleAttempt.status !== 0,
  first_use_cross_subject_rejected: firstUseCrossSubjectAttempt.status !== 0,
  ordinary_session_grant_rejected: ordinaryAdminGrantAttempt.status !== 0,
  missing_audit_grant_rejected: missingAuditGrantAttempt.status !== 0,
  authority_without_scope_rejected: authorityWithoutScopeAttempt.status !== 0,
  mismatched_audit_grant_rejected: mismatchedAuditGrantAttempt.status !== 0 && mismatchedAuditGrantAttempt.stderr.includes("exact independently audited authorization"),
  reused_audit_grant_rejected: reusedAuditGrantAttempt.status !== 0,
  grant_scope_mutation_rejected: grantScopeMutationAttempt.status !== 0 && grantScopeMutationAttempt.stderr.includes("scope is immutable"),
  grant_delete_rejected: grantDeleteAttempt.status !== 0,
  immutable_identity_update_rejected: identityMutation.status !== 0 && identityMutation.stderr.includes("Timeline principal identity is immutable"),
};

const pass = result.schema_version === "d1-timeline-db-500.1"
  && result.safe_runtime_role_count === 3
  && result.least_privilege_leak_count === 0
  && result.public_access_surface_count === 0
  && result.tables_without_forced_rls === 0
  && result.admin_without_grant_visible_documents === 0
  && result.admin_with_exact_grant_visible_documents === 1
  && result.admin_wrong_document_visible_documents === 0
  && result.admin_read_grant_updated_documents === 0
  && result.grant_authority_revoked_grants === 1
  && result.admin_after_revocation_visible_documents === 0
  && result.student_owner_visible_documents === 1
  && result.student_owner_updated_documents === 1
  && result.cross_student_target_visible_documents === 0
  && result.cross_student_updated_documents === 0
  && result.student_without_learndash_3893_visible_documents === 0
  && result.first_use_authenticated_identity_rows === 2
  && result.first_use_audit_rows === 1
  && result.first_use_ineligible_rejected
  && result.first_use_cross_subject_rejected
  && result.ordinary_session_grant_rejected
  && result.missing_audit_grant_rejected
  && result.authority_without_scope_rejected
  && result.mismatched_audit_grant_rejected
  && result.reused_audit_grant_rejected
  && result.grant_scope_mutation_rejected
  && result.grant_delete_rejected
  && result.immutable_identity_update_rejected;

process.stdout.write(`${JSON.stringify({ pass, ...result })}\n`);
if (!pass) process.exitCode = 1;
