import pg from 'pg';
import { X509Certificate } from 'node:crypto';

import { AuthorizationDeniedError, IntegrationDisabledError } from '../domain/errors.js';
import { readTrustedRequestContext } from '../security/trusted-request-context.mjs';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import {
  NODE_POSTGRES_DATABASE_ROLE,
  createNodePostgresExecutor,
} from './node-postgres-executor.mjs';
import {
  DR133_APPROVED_DEFINER_IDENTITIES,
  DR133_RELATIONS,
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  expectedDr133Sentinel,
  parsePrivateDatabaseUrl,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';

const { Pool } = pg;
const atomicDriverModuleUrl = new URL('./atomic-rls-case-driver.mjs', import.meta.url);
const { createAtomicRlsCaseDriver } = await import(atomicDriverModuleUrl.href);

export const PRODUCTION_POSTGRES_RUNTIME_INTEGRATION = 'lor_production_postgres_runtime';

const ENV_KEY = 'LOR_DR133_RUNTIME_DATABASE_URL';
const CA_ENV_KEY = 'LOR_DR133_RUNTIME_DATABASE_CA';
const RAILWAY_ENV_KEYS = Object.freeze({
  deploymentId: 'RAILWAY_DEPLOYMENT_ID',
  environmentId: 'RAILWAY_ENVIRONMENT_ID',
  environmentName: 'RAILWAY_ENVIRONMENT_NAME',
  projectId: 'RAILWAY_PROJECT_ID',
  region: 'RAILWAY_REPLICA_REGION',
  serviceId: 'RAILWAY_SERVICE_ID',
});
const APP_ROLE = 'lor_studio_app';
const SCHEMA = 'lor_studio';
const SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const BINDING_SCHEMA = 'missionmed.lor.student-auth-binding-receipt.v1';
const SUCCESSOR_SENTINEL = `${expectedDr133Sentinel()}|identityScope=20260825010300`;
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const DEPLOYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BINDING_ID = /^binding_[a-f0-9]{64}$/u;
const OPTION_KEYS = new Set(['environment', 'PoolClass']);
const REQUEST_KEYS = new Set(['caseId', 'operation', 'resourceStudentId']);
const RECEIPT_KEYS = new Set([
  'schemaVersion', 'studentAuthSubject', 'studentAuthUid', 'bindingId', 'bindingSource',
  'sourceReferenceHash', 'boundAt', 'expiresAt', 'replayed',
]);
const SCOPE_KEYS = new Set([
  'schemaVersion', 'authoritySource', 'authenticated', 'roleVerified', 'authUid',
  'authenticatedSubject', 'actorId', 'actorRole', 'resourceStudentId', 'caseId',
  'operation', 'purpose', 'assignmentId', 'invitationId', 'administrativeGrantId',
  'entitlementVerified', 'lorEnabled', 'canaryAuthorized',
]);
const RELATIONS = Object.freeze([...DR133_RELATIONS].sort());
const DEFINERS = Object.freeze([
  ...DR133_APPROVED_DEFINER_IDENTITIES,
  'ensure_student_auth_binding(text,text,text)',
  'resolve_faculty_case_scope(text,text,text)',
  'resolve_mentor_case_scope(text,text,text)',
  'revoke_student_auth_binding(text,text)',
].sort());
const APP_RELATION_PRIVILEGES = Object.freeze([
  'administrative_case_grant_revocations:SELECT:false',
  'administrative_case_grants:SELECT:false',
  'ai_generation_runs:INSERT:false',
  'ai_generation_runs:SELECT:false',
  'ai_letter_proposals:INSERT:false',
  'ai_letter_proposals:SELECT:false',
  'ai_proposal_decisions:SELECT:false',
  'consent_receipts:SELECT:false',
  'deletion_hold_releases:INSERT:false',
  'deletion_hold_releases:SELECT:false',
  'deletion_intents:INSERT:false',
  'deletion_intents:SELECT:false',
  'deletion_receipts:INSERT:false',
  'deletion_receipts:SELECT:false',
  'recommendation_case_audit_events:INSERT:false',
  'recommendation_case_audit_events:SELECT:false',
  'recommendation_case_creation_reservations:INSERT:false',
  'recommendation_case_creation_reservations:SELECT:false',
  'recommendation_cases:SELECT:false',
  'released_student_documents:SELECT:false',
  'student_auth_binding_revocations:SELECT:false',
  'student_auth_bindings:SELECT:false',
  'student_recommendation_case_projection:SELECT:false',
  'waiver_receipts:SELECT:false',
  'writer_depot_artifacts:SELECT:false',
].sort());
const APP_FUNCTION_PRIVILEGES = Object.freeze([
  ...DEFINERS,
  'ai_grounding_manifest_is_complete(jsonb)',
  'audit_event_is_metadata(jsonb)',
  'canonical_jsonb_sha256(jsonb)',
  'canonical_jsonb_text(jsonb)',
  'operational_content_context_allows(text,text,text[],text[])',
  'student_context_allows(text,text,uuid,text[])',
  'student_write_axes_satisfied()',
].map((identity) => `${identity}:EXECUTE:false`).sort());

const RESOLUTION_GUCS_SQL = `SELECT
  pg_catalog.set_config('request.jwt.claim.sub', $1, true) AS auth_uid,
  pg_catalog.set_config('${SCHEMA}.student_auth_subject', $2, true) AS student_auth_subject,
  pg_catalog.set_config('${SCHEMA}.actor_role', $3, true) AS actor_role,
  pg_catalog.set_config('${SCHEMA}.resource_student_id', $4, true) AS resource_student_id,
  pg_catalog.set_config('${SCHEMA}.case_id', $5, true) AS case_id,
  pg_catalog.set_config('${SCHEMA}.operation', $6, true) AS operation,
  pg_catalog.set_config('${SCHEMA}.purpose', $7, true) AS purpose,
  pg_catalog.set_config('${SCHEMA}.invitation_id', $8, true) AS invitation_id,
  pg_catalog.set_config('${SCHEMA}.assignment_id', $9, true) AS assignment_id,
  pg_catalog.set_config('${SCHEMA}.administrative_grant_id', $10, true) AS administrative_grant_id,
  pg_catalog.set_config('${SCHEMA}.entitlement_verified', $11, true) AS entitlement_verified,
  pg_catalog.set_config('${SCHEMA}.lor_enabled', $12, true) AS lor_enabled,
  pg_catalog.set_config('${SCHEMA}.canary_authorized', $13, true) AS canary_authorized,
  pg_catalog.set_config('${SCHEMA}.trusted_service_actor', $14, true) AS trusted_service_actor,
  pg_catalog.set_config('${SCHEMA}.identity_resolution_verified', $15, true)
    AS identity_resolution_verified`;
const ENSURE_SQL = `SELECT ${SCHEMA}.ensure_student_auth_binding($1, $2, $3) AS result`;
const FACULTY_SQL = `SELECT ${SCHEMA}.resolve_faculty_case_scope($1, $2, $3) AS result`;
const MENTOR_SQL = `SELECT ${SCHEMA}.resolve_mentor_case_scope($1, $2, $3) AS result`;

const READINESS_SQL = `/* missionmed:dr133:lor-runtime-readiness-v1 */
WITH ssl_session AS (
  SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid = pg_catalog.pg_backend_pid()
), relation_inventory AS (
  SELECT class.oid AS relation_oid, class.relname::text AS relation_name,
    class.relrowsecurity, class.relforcerowsecurity
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = '${SCHEMA}' AND class.relkind = 'r'
), definer_inventory AS (
  SELECT procedure.proname || '(' ||
    pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', '') || ')'
      AS function_identity, procedure.oid, procedure.proowner, procedure.proconfig
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = '${SCHEMA}' AND procedure.prosecdef
), public_function_acl AS (
  SELECT 1 FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
), public_relation_acl AS (
  SELECT 1 FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND class.relkind IN ('r', 'v', 'm', 'p')
    AND acl.grantee = 0
), role_oids AS (
  SELECT
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${DR133_TARGET.databaseAdmin}')
      AS admin_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${APP_ROLE}') AS app_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_command_owner')
      AS command_owner_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${DR133_RUNTIME_LOGIN}')
      AS runtime_oid
), runtime_memberships AS (
  SELECT membership.* FROM pg_catalog.pg_auth_members AS membership CROSS JOIN role_oids
  WHERE membership.roleid IN (role_oids.app_oid, role_oids.command_owner_oid, role_oids.runtime_oid)
    OR membership.member IN (role_oids.app_oid, role_oids.command_owner_oid, role_oids.runtime_oid)
), runtime_owned_objects AS (
  SELECT namespace.oid FROM pg_catalog.pg_namespace AS namespace CROSS JOIN role_oids
  WHERE namespace.nspowner = role_oids.runtime_oid
  UNION ALL
  SELECT class.oid FROM pg_catalog.pg_class AS class CROSS JOIN role_oids
  WHERE class.relowner = role_oids.runtime_oid
  UNION ALL
  SELECT procedure.oid FROM pg_catalog.pg_proc AS procedure CROSS JOIN role_oids
  WHERE procedure.proowner = role_oids.runtime_oid
  UNION ALL
  SELECT type.oid FROM pg_catalog.pg_type AS type CROSS JOIN role_oids
  WHERE type.typowner = role_oids.runtime_oid
), app_owned_objects AS (
  SELECT namespace.oid FROM pg_catalog.pg_namespace AS namespace CROSS JOIN role_oids
  WHERE namespace.nspowner = role_oids.app_oid
  UNION ALL
  SELECT class.oid FROM pg_catalog.pg_class AS class CROSS JOIN role_oids
  WHERE class.relowner = role_oids.app_oid
  UNION ALL
  SELECT procedure.oid FROM pg_catalog.pg_proc AS procedure CROSS JOIN role_oids
  WHERE procedure.proowner = role_oids.app_oid
  UNION ALL
  SELECT type.oid FROM pg_catalog.pg_type AS type CROSS JOIN role_oids
  WHERE type.typowner = role_oids.app_oid
), runtime_default_acls AS (
  SELECT default_acl.oid FROM pg_catalog.pg_default_acl AS default_acl CROSS JOIN role_oids
  WHERE default_acl.defaclrole = role_oids.runtime_oid
), application_relation_acl AS (
  SELECT class.relname::text || ':' || acl.privilege_type || ':' || acl.is_grantable::text
    AS privilege_identity
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND class.relkind IN ('r', 'v', 'm', 'p')
    AND acl.grantee = role_oids.app_oid
), runtime_relation_acl AS (
  SELECT class.oid
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND class.relkind IN ('r', 'v', 'm', 'p')
    AND acl.grantee = role_oids.runtime_oid
), application_function_acl AS (
  SELECT procedure.proname || '(' ||
    pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', '') || '):' ||
    acl.privilege_type || ':' || acl.is_grantable::text AS privilege_identity
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND acl.grantee = role_oids.app_oid
), runtime_function_acl AS (
  SELECT procedure.oid
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND acl.grantee = role_oids.runtime_oid
), unexpected_sequence_acl AS (
  SELECT class.oid
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('S', class.relowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND class.relkind = 'S'
    AND acl.grantee IN (0, role_oids.app_oid, role_oids.command_owner_oid, role_oids.runtime_oid)
), unexpected_column_acl AS (
  SELECT attribute.attrelid
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND acl.grantee IN (0, role_oids.app_oid, role_oids.command_owner_oid, role_oids.runtime_oid)
), application_schema_acl AS (
  SELECT acl.privilege_type || ':' || acl.is_grantable::text AS privilege_identity
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND acl.grantee = role_oids.app_oid
), unexpected_schema_acl AS (
  SELECT namespace.oid
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}'
    AND acl.grantee IN (0, role_oids.runtime_oid)
), unexpected_acl_grantees AS (
  SELECT namespace.oid
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND NOT acl.grantee = ANY (ARRAY[
    0::oid, COALESCE(role_oids.admin_oid, 0::oid), COALESCE(role_oids.app_oid, 0::oid),
    COALESCE(role_oids.command_owner_oid, 0::oid), COALESCE(role_oids.runtime_oid, 0::oid)
  ])
  UNION ALL
  SELECT class.oid
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND NOT acl.grantee = ANY (ARRAY[
    0::oid, COALESCE(role_oids.admin_oid, 0::oid), COALESCE(role_oids.app_oid, 0::oid),
    COALESCE(role_oids.command_owner_oid, 0::oid), COALESCE(role_oids.runtime_oid, 0::oid)
  ])
  UNION ALL
  SELECT procedure.oid
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND NOT acl.grantee = ANY (ARRAY[
    0::oid, COALESCE(role_oids.admin_oid, 0::oid), COALESCE(role_oids.app_oid, 0::oid),
    COALESCE(role_oids.command_owner_oid, 0::oid), COALESCE(role_oids.runtime_oid, 0::oid)
  ])
  UNION ALL
  SELECT type.oid
  FROM pg_catalog.pg_type AS type
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(type.typacl, pg_catalog.acldefault('T', type.typowner))) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND NOT acl.grantee = ANY (ARRAY[
    0::oid, COALESCE(role_oids.admin_oid, 0::oid), COALESCE(role_oids.app_oid, 0::oid),
    COALESCE(role_oids.command_owner_oid, 0::oid), COALESCE(role_oids.runtime_oid, 0::oid)
  ])
  UNION ALL
  SELECT attribute.attrelid
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN role_oids
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  WHERE namespace.nspname = '${SCHEMA}' AND attribute.attnum > 0
    AND NOT attribute.attisdropped AND NOT acl.grantee = ANY (ARRAY[
      0::oid, COALESCE(role_oids.admin_oid, 0::oid), COALESCE(role_oids.app_oid, 0::oid),
      COALESCE(role_oids.command_owner_oid, 0::oid), COALESCE(role_oids.runtime_oid, 0::oid)
    ])
)
SELECT pg_catalog.current_database()::text AS database_name,
  (pg_catalog.current_setting('server_version_num')::integer / 10000) AS postgres_major,
  current_user::text AS current_user, session_user::text AS session_user,
  (pg_catalog.inet_server_addr() IS NOT NULL AND (
    pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7')) AS private_server_address,
  (pg_catalog.current_setting('ssl') = 'on' AND COALESCE(ssl_session.ssl, false)) AS ssl_active,
  pg_catalog.obj_description(namespace.oid, 'pg_namespace') AS schema_sentinel,
  pg_catalog.pg_get_userbyid(namespace.nspowner)::text AS schema_owner,
  (SELECT COALESCE(pg_catalog.array_agg(relation_name ORDER BY relation_name COLLATE "C"),
    ARRAY[]::text[]) FROM relation_inventory) AS relation_names,
  (SELECT pg_catalog.count(*)::text FROM relation_inventory) AS relation_count,
  (SELECT pg_catalog.count(*)::text FROM relation_inventory
    WHERE relrowsecurity AND relforcerowsecurity) AS forced_rls_count,
  (SELECT COALESCE(pg_catalog.array_agg(function_identity ORDER BY function_identity COLLATE "C"),
    ARRAY[]::text[]) FROM definer_inventory) AS definer_identities,
  (SELECT pg_catalog.count(*)::text FROM definer_inventory) AS definer_count,
  (SELECT COALESCE(pg_catalog.bool_and(pg_catalog.pg_get_userbyid(proowner) =
    'lor_studio_command_owner' AND proconfig IS NOT DISTINCT FROM
    ARRAY['search_path=""']::text[]), false) FROM definer_inventory) AS definer_custody_safe,
  (SELECT pg_catalog.count(*)::text FROM definer_inventory
    WHERE pg_catalog.has_function_privilege(current_user, oid, 'EXECUTE')) AS app_execute_count,
  (SELECT pg_catalog.count(*)::text FROM public_function_acl) AS public_function_execute_count,
  (SELECT pg_catalog.count(*)::text FROM public_relation_acl) AS public_relation_privilege_count,
  (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS view_namespace ON view_namespace.oid = class.relnamespace
    WHERE view_namespace.nspname = '${SCHEMA}' AND class.relkind IN ('v', 'm')) AS view_count,
  (SELECT pg_catalog.string_agg(class.relname::text || '@' ||
    pg_catalog.pg_get_userbyid(class.relowner), ',' ORDER BY class.relname)
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS view_namespace ON view_namespace.oid = class.relnamespace
    WHERE view_namespace.nspname = '${SCHEMA}' AND class.relkind IN ('v', 'm')) AS view_identity,
  (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS view_namespace ON view_namespace.oid = class.relnamespace
    WHERE view_namespace.nspname = '${SCHEMA}' AND class.relkind = 'v'
      AND class.relname = 'student_recommendation_case_projection'
      AND class.reloptions @> ARRAY['security_invoker=true']::text[]) AS security_invoker_view_count,
  (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS view_namespace ON view_namespace.oid = class.relnamespace
    WHERE view_namespace.nspname = '${SCHEMA}' AND class.relkind = 'v'
      AND class.relname = 'student_recommendation_case_projection'
      AND class.reloptions @> ARRAY['security_barrier=true']::text[]) AS security_barrier_view_count,
  (SELECT pg_catalog.count(*) = 1 FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = '${APP_ROLE}' AND NOT role.rolsuper AND NOT role.rolinherit
      AND NOT role.rolcreaterole AND NOT role.rolcreatedb AND NOT role.rolcanlogin
      AND NOT role.rolreplication AND NOT role.rolbypassrls AND role.rolconnlimit = -1
      AND role.rolvaliduntil IS NULL
      AND role.rolconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[])
    AS app_role_safe,
  (SELECT pg_catalog.count(*) = 1 FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'lor_studio_command_owner' AND NOT role.rolsuper
      AND NOT role.rolinherit AND NOT role.rolcreaterole AND NOT role.rolcreatedb
      AND NOT role.rolcanlogin AND NOT role.rolreplication AND NOT role.rolbypassrls
      AND role.rolconnlimit = -1 AND role.rolvaliduntil IS NULL
      AND role.rolconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[])
    AS command_owner_role_safe,
  (SELECT pg_catalog.count(*) = 1 FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = '${DR133_RUNTIME_LOGIN}' AND NOT role.rolsuper
      AND NOT role.rolinherit AND NOT role.rolcreaterole AND NOT role.rolcreatedb
      AND role.rolcanlogin AND NOT role.rolreplication AND NOT role.rolbypassrls
      AND role.rolconnlimit = 20 AND role.rolvaliduntil IS NULL
      AND role.rolconfig @> ARRAY['search_path=pg_catalog','statement_timeout=15s',
        'lock_timeout=5s','idle_in_transaction_session_timeout=15s']::text[]
      AND pg_catalog.cardinality(role.rolconfig) = 4) AS runtime_role_safe,
  (SELECT pg_catalog.count(*) = 1 FROM runtime_memberships AS membership CROSS JOIN role_oids
    WHERE membership.roleid = role_oids.app_oid AND membership.member = role_oids.runtime_oid
      AND NOT membership.admin_option AND NOT membership.inherit_option
      AND membership.set_option) AS runtime_membership_safe,
  (SELECT pg_catalog.count(*)::text FROM runtime_memberships) AS runtime_membership_count,
  (SELECT pg_catalog.count(*)::text FROM runtime_owned_objects) AS runtime_owned_object_count,
  (SELECT pg_catalog.count(*)::text FROM app_owned_objects) AS app_owned_object_count,
  (SELECT pg_catalog.count(*)::text FROM runtime_default_acls) AS runtime_default_acl_count,
  (SELECT COALESCE(pg_catalog.array_agg(privilege_identity
      ORDER BY privilege_identity COLLATE "C"), ARRAY[]::text[])
    FROM application_relation_acl) AS app_relation_privileges,
  (SELECT pg_catalog.count(*)::text FROM runtime_relation_acl) AS runtime_relation_acl_count,
  (SELECT COALESCE(pg_catalog.array_agg(privilege_identity
      ORDER BY privilege_identity COLLATE "C"), ARRAY[]::text[])
    FROM application_function_acl) AS app_function_privileges,
  (SELECT pg_catalog.count(*)::text FROM runtime_function_acl) AS runtime_function_acl_count,
  (SELECT pg_catalog.count(*)::text FROM unexpected_sequence_acl) AS unexpected_sequence_acl_count,
  (SELECT pg_catalog.count(*)::text FROM unexpected_column_acl) AS unexpected_column_acl_count,
  (SELECT COALESCE(pg_catalog.array_agg(privilege_identity
      ORDER BY privilege_identity COLLATE "C"), ARRAY[]::text[])
    FROM application_schema_acl) AS app_schema_privileges,
  (SELECT pg_catalog.count(*)::text FROM unexpected_schema_acl) AS unexpected_schema_acl_count,
  (SELECT pg_catalog.count(*)::text FROM unexpected_acl_grantees)
    AS unexpected_acl_grantee_count,
  NOT pg_catalog.has_schema_privilege('${APP_ROLE}', '${SCHEMA}', 'CREATE')
    AS app_schema_create_denied,
  NOT pg_catalog.has_schema_privilege('${DR133_RUNTIME_LOGIN}', '${SCHEMA}', 'CREATE')
    AS runtime_schema_create_denied,
  pg_catalog.has_schema_privilege('${APP_ROLE}', '${SCHEMA}', 'USAGE') AS app_schema_usage
FROM pg_catalog.pg_namespace AS namespace LEFT JOIN ssl_session ON true
WHERE namespace.nspname = '${SCHEMA}'`;

function disabled(status) {
  return new IntegrationDisabledError(PRODUCTION_POSTGRES_RUNTIME_INTEGRATION, status);
}
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exactKeys(value, expected) {
  if (!plain(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}
function exactDataSnapshot(value, expected, status) {
  if (!plain(value)) throw disabled(status);
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw disabled(status);
  }
  if (ownKeys.length !== expected.size
    || ownKeys.some((key) => typeof key !== 'string' || !expected.has(key))) {
    throw disabled(status);
  }
  const snapshot = {};
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      throw disabled(status);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}
function descriptorSnapshot(value, allowed) {
  if (!plain(value)) throw disabled('RUNTIME_FACTORY_OPTIONS_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key))) {
    throw disabled('RUNTIME_FACTORY_OPTIONS_INVALID');
  }
  const snapshot = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      throw disabled('RUNTIME_FACTORY_OPTIONS_INVALID');
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}
function validateBinding(raw) {
  const binding = assertValidatedLorTargetBinding(raw, PRODUCTION_POSTGRES_RUNTIME_INTEGRATION);
  const expected = {
    schemaVersion: 'missionmed.lor.target-binding.v2', decisionRecord: 'DR-133',
    environment: 'staging', provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId, environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId, databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region, schema: SCHEMA,
    migrationLedger: 'lor_studio/migrations/staging',
  };
  if (Object.entries(expected).some(([key, value]) => binding[key] !== value)) {
    throw disabled('DR133_TARGET_BINDING_MISMATCH');
  }
  return binding;
}
function verifiedDatabaseCa(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.length < 256 || rawValue.length > 16_384
    || rawValue.includes('PRIVATE KEY')
    || rawValue.match(/-----BEGIN CERTIFICATE-----/gu)?.length !== 1
    || rawValue.match(/-----END CERTIFICATE-----/gu)?.length !== 1) {
    throw disabled('RUNTIME_DATABASE_CA_REJECTED');
  }
  try {
    const certificate = new X509Certificate(rawValue);
    const now = Date.now();
    if (certificate.ca !== true || !certificate.checkIssued(certificate)
      || !certificate.verify(certificate.publicKey)
      || !(Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo))) {
      throw new TypeError('untrusted root');
    }
    return certificate.toString();
  } catch {
    throw disabled('RUNTIME_DATABASE_CA_REJECTED');
  }
}
function runtimeConfiguration(environment) {
  if (!environment || typeof environment !== 'object') throw disabled('RUNTIME_ENVIRONMENT_REQUIRED');
  let keys;
  let descriptor;
  try {
    keys = Reflect.ownKeys(environment)
      .filter((key) => typeof key === 'string' && key.startsWith('LOR_DR133_')).sort();
    descriptor = Object.getOwnPropertyDescriptor(environment, ENV_KEY);
  } catch {
    throw disabled('RUNTIME_ENVIRONMENT_INVALID');
  }
  if (keys.length !== 2 || keys[0] !== CA_ENV_KEY || keys[1] !== ENV_KEY || !descriptor
    || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true
    || typeof descriptor.value !== 'string') {
    throw disabled('UNEXPECTED_LOR_RUNTIME_ENVIRONMENT_KEY');
  }
  const expectedRailway = {
    [RAILWAY_ENV_KEYS.environmentId]: DR133_TARGET.environmentId,
    [RAILWAY_ENV_KEYS.environmentName]: DR133_TARGET.environmentName,
    [RAILWAY_ENV_KEYS.projectId]: DR133_TARGET.projectId,
    [RAILWAY_ENV_KEYS.region]: DR133_TARGET.region,
    [RAILWAY_ENV_KEYS.serviceId]: DR133_TARGET.executionServiceId,
  };
  for (const [key, expected] of Object.entries(expectedRailway)) {
    const railwayDescriptor = Object.getOwnPropertyDescriptor(environment, key);
    if (!railwayDescriptor || !Object.hasOwn(railwayDescriptor, 'value')
      || railwayDescriptor.enumerable !== true || railwayDescriptor.value !== expected) {
      throw disabled('RAILWAY_RUNTIME_IDENTITY_MISMATCH');
    }
  }
  const deploymentDescriptor = Object.getOwnPropertyDescriptor(
    environment,
    RAILWAY_ENV_KEYS.deploymentId,
  );
  if (!deploymentDescriptor || !Object.hasOwn(deploymentDescriptor, 'value')
    || deploymentDescriptor.enumerable !== true
    || !DEPLOYMENT_ID.test(deploymentDescriptor.value ?? '')) {
    throw disabled('RAILWAY_RUNTIME_IDENTITY_MISMATCH');
  }
  const caDescriptor = Object.getOwnPropertyDescriptor(environment, CA_ENV_KEY);
  if (!caDescriptor || !Object.hasOwn(caDescriptor, 'value')
    || caDescriptor.enumerable !== true) {
    throw disabled('RUNTIME_DATABASE_CA_REJECTED');
  }
  const ca = verifiedDatabaseCa(caDescriptor.value);
  try {
    return Object.freeze({
      ca,
      connectionString: parsePrivateDatabaseUrl(
        descriptor.value,
        DR133_RUNTIME_LOGIN,
      ).pgConnectionString,
    });
  } catch {
    throw disabled('RUNTIME_DATABASE_URL_REJECTED');
  }
}
function statement(statementId, text, values = []) { return { statementId, text, values }; }
function oneResult(result) {
  return result?.rows?.length === 1 ? result.rows[0]?.result : undefined;
}
async function transaction(executor, operation) {
  return executor.withConnection((connection) => connection.transaction(operation));
}
function requestSnapshot(raw, context) {
  if (!plain(raw)) throw disabled('SCOPE_REQUEST_INVALID');
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(raw);
    descriptors = Object.getOwnPropertyDescriptors(raw);
  } catch {
    throw disabled('SCOPE_REQUEST_INVALID');
  }
  if (keys.length < 2 || keys.length > 3
    || keys.some((key) => typeof key !== 'string' || !REQUEST_KEYS.has(key))) {
    throw disabled('SCOPE_REQUEST_INVALID');
  }
  for (const key of keys.filter((entry) => typeof entry === 'string')) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      throw disabled('SCOPE_REQUEST_INVALID');
    }
  }
  if (!Object.hasOwn(descriptors, 'caseId') || !Object.hasOwn(descriptors, 'operation')) {
    throw disabled('SCOPE_REQUEST_INVALID');
  }
  const request = {
    caseId: descriptors.caseId.value,
    operation: descriptors.operation.value,
    resourceStudentId: Object.hasOwn(descriptors, 'resourceStudentId')
      ? descriptors.resourceStudentId.value : null,
  };
  if (!CASE_ID.test(request.caseId ?? '') || !['read', 'create', 'save'].includes(request.operation)
    || (request.resourceStudentId !== null && !SUBJECT.test(request.resourceStudentId ?? ''))) {
    throw disabled('SCOPE_REQUEST_INVALID');
  }
  if (context.actorRole === 'student'
    && request.resourceStudentId !== context.authenticatedSubject) {
    throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
  }
  if (context.actorRole !== 'student' && request.resourceStudentId !== null) {
    throw new AuthorizationDeniedError('DATABASE_RESOLVED_RESOURCE_REQUIRED');
  }
  if (context.actorRole === 'faculty' && !['read', 'save'].includes(request.operation)) {
    throw new AuthorizationDeniedError('FACULTY_SCOPE_OPERATION_DENIED');
  }
  if (context.actorRole === 'mentor' && request.operation !== 'read') {
    throw new AuthorizationDeniedError('MENTOR_SCOPE_OPERATION_DENIED');
  }
  return Object.freeze(request);
}
function validTime(value) {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}
function bindingReceipt(value, context) {
  const receipt = exactDataSnapshot(value, RECEIPT_KEYS, 'STUDENT_BINDING_RECEIPT_INVALID');
  if (receipt.schemaVersion !== BINDING_SCHEMA
    || receipt.studentAuthSubject !== context.authenticatedSubject
    || !UUID.test(receipt.studentAuthUid ?? '') || !BINDING_ID.test(receipt.bindingId ?? '')
    || receipt.bindingSource !== 'wordpress_verified_bootstrap'
    || receipt.sourceReferenceHash !== context.sourceReferenceHash || !validTime(receipt.boundAt)
    || receipt.expiresAt !== null || typeof receipt.replayed !== 'boolean') {
    throw disabled('STUDENT_BINDING_RECEIPT_INVALID');
  }
  return Object.freeze(receipt);
}
function resolvedScope(value, context, request) {
  const scope = exactDataSnapshot(value, SCOPE_KEYS, 'DATABASE_SCOPE_INVALID');
  if (scope.schemaVersion !== SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true || scope.roleVerified !== true
    || !UUID.test(scope.authUid ?? '') || scope.authenticatedSubject !== context.authenticatedSubject
    || scope.actorId !== context.authenticatedSubject || scope.actorRole !== context.actorRole
    || !SUBJECT.test(scope.resourceStudentId ?? '') || scope.caseId !== request.caseId
    || scope.operation !== request.operation || scope.entitlementVerified !== true
    || scope.lorEnabled !== true || scope.canaryAuthorized !== true) {
    throw disabled('DATABASE_SCOPE_INVALID');
  }
  if (context.actorRole === 'faculty' && (scope.purpose !== 'faculty_private_edit'
    || typeof scope.invitationId !== 'string' || scope.invitationId.length === 0
    || scope.assignmentId !== null || scope.administrativeGrantId !== null)) {
    throw disabled('DATABASE_SCOPE_INVALID');
  }
  if (context.actorRole === 'mentor' && (typeof scope.purpose !== 'string'
    || scope.purpose.length < 1 || scope.purpose.length > 160
    || typeof scope.assignmentId !== 'string' || scope.assignmentId.length === 0
    || scope.invitationId !== null || scope.administrativeGrantId !== null)) {
    throw disabled('DATABASE_SCOPE_INVALID');
  }
  return Object.freeze(scope);
}
function mapScopeError(error) {
  if (error instanceof AuthorizationDeniedError) return error;
  if (error?.code === 'P1101' || error?.code === 'P1201') {
    return new AuthorizationDeniedError('DATABASE_SCOPE_AUTHORIZATION_DENIED');
  }
  return disabled('RUNTIME_SCOPE_RESOLUTION_FAILED');
}
function scopeProviderFor(executor, isHealthy) {
  return async (rawRequest) => {
    if (!isHealthy()) throw disabled('RUNTIME_DATABASE_UNAVAILABLE');
    let context;
    try { context = readTrustedRequestContext(); } catch {
      throw disabled('TRUSTED_REQUEST_CONTEXT_REQUIRED');
    }
    try {
      const request = requestSnapshot(rawRequest, context);
      if (context.actorRole === 'student') {
        if (typeof context.sourceReferenceHash !== 'string'
          || !SHA256.test(context.sourceReferenceHash)
          || typeof context.proofHash !== 'string' || !SHA256.test(context.proofHash)) {
          throw new AuthorizationDeniedError('STUDENT_IDENTITY_PROOF_REQUIRED');
        }
        const receipt = await transaction(executor, async (tx) => {
          await tx.execute(statement('lor_runtime_student_bootstrap_gucs', RESOLUTION_GUCS_SQL, [
            '', context.authenticatedSubject, 'service', context.authenticatedSubject,
            '', 'ensure_student_binding', 'wordpress_verified_bootstrap', '', '', '',
            'true', 'true', 'true', 'wordpress-admission-v2', 'true',
          ]));
          return bindingReceipt(oneResult(await tx.execute(statement(
            'lor_runtime_ensure_student_binding',
            ENSURE_SQL,
            [context.authenticatedSubject, context.sourceReferenceHash, context.proofHash],
          ))), context);
        });
        return Object.freeze({
          schemaVersion: SCOPE_SCHEMA, authoritySource: 'server_verified_session_crosswalk',
          authenticated: true, roleVerified: true, authUid: receipt.studentAuthUid,
          authenticatedSubject: context.authenticatedSubject, actorId: context.authenticatedSubject,
          actorRole: 'student', resourceStudentId: context.authenticatedSubject,
          caseId: request.caseId, operation: request.operation,
          purpose: request.operation === 'read' ? 'student_case_read' : 'student_case_write',
          assignmentId: null, invitationId: null, administrativeGrantId: null,
          entitlementVerified: true, lorEnabled: true, canaryAuthorized: true,
        });
      }
      const faculty = context.actorRole === 'faculty';
      const purpose = faculty ? 'faculty_scope_resolution' : 'mentor_scope_resolution';
      return await transaction(executor, async (tx) => {
        await tx.execute(statement('lor_runtime_actor_scope_gucs', RESOLUTION_GUCS_SQL, [
          '', context.authenticatedSubject, context.actorRole, '', request.caseId,
          request.operation, purpose, '', '', '', 'true', 'true', 'true', '', 'true',
        ]));
        const rawScope = oneResult(await tx.execute(statement(
          faculty ? 'lor_runtime_resolve_faculty_scope' : 'lor_runtime_resolve_mentor_scope',
          faculty ? FACULTY_SQL : MENTOR_SQL,
          [context.authenticatedSubject, request.caseId, request.operation],
        )));
        if (rawScope === null || rawScope === undefined) {
          throw new AuthorizationDeniedError('DATABASE_SCOPE_NOT_FOUND');
        }
        return resolvedScope(rawScope, context, request);
      });
    } catch (error) { throw mapScopeError(error); }
  };
}
function arraysEqual(value, expected) {
  return Array.isArray(value) && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}
function safeReadiness(checks, reasonCode) {
  const frozen = Object.freeze({ ...checks });
  return Object.freeze({
    ready: Object.values(frozen).every((value) => value === true), reasonCode, checks: frozen,
  });
}
function readinessFor(executor, isHealthy) {
  const allFalse = () => ({
    runtimeIdentity: false, privateTlsTarget: false, applicationRole: false,
    targetSentinel: false, relationsForcedRls: false, securityDefiners: false,
    appExecute: false, functionAclCustody: false, publicDriftAbsent: false,
    aclGranteesRestricted: false,
    viewCustody: false, roleCustody: false, relationAclCustody: false,
  });
  return Object.freeze({
    async probe() {
      if (!isHealthy()) return safeReadiness(allFalse(), 'DATABASE_UNAVAILABLE');
      try {
        const row = await transaction(executor, async (tx) => {
          const result = await tx.execute(statement('lor_runtime_readiness', READINESS_SQL));
          return result.rows.length === 1 ? result.rows[0] : null;
        });
        if (!row) return safeReadiness(allFalse(), 'CATALOG_FINGERPRINT_MISMATCH');
        const checks = {
          runtimeIdentity: row.database_name === DR133_TARGET.databaseName
            && [16, 18].includes(row.postgres_major)
            && row.session_user === DR133_RUNTIME_LOGIN,
          privateTlsTarget: row.private_server_address === true && row.ssl_active === true,
          applicationRole: row.current_user === APP_ROLE,
          targetSentinel: row.schema_sentinel === SUCCESSOR_SENTINEL
            && row.schema_owner === DR133_TARGET.databaseAdmin,
          relationsForcedRls: row.relation_count === String(RELATIONS.length)
            && row.forced_rls_count === String(RELATIONS.length)
            && arraysEqual(row.relation_names, RELATIONS),
          securityDefiners: row.definer_count === String(DEFINERS.length)
            && row.definer_custody_safe === true && arraysEqual(row.definer_identities, DEFINERS),
          appExecute: row.app_execute_count === String(DEFINERS.length),
          functionAclCustody: arraysEqual(
            row.app_function_privileges,
            APP_FUNCTION_PRIVILEGES,
          ) && row.runtime_function_acl_count === '0',
          publicDriftAbsent: row.public_function_execute_count === '0'
            && row.public_relation_privilege_count === '0',
          aclGranteesRestricted: row.unexpected_acl_grantee_count === '0',
          viewCustody: row.view_count === '1'
            && row.view_identity === 'student_recommendation_case_projection@postgres'
            && row.security_invoker_view_count === '1'
            && row.security_barrier_view_count === '1',
          roleCustody: row.app_role_safe === true
            && row.command_owner_role_safe === true
            && row.runtime_role_safe === true
            && row.runtime_membership_safe === true
            && row.runtime_membership_count === '1'
            && row.runtime_owned_object_count === '0'
            && row.app_owned_object_count === '0'
            && row.runtime_default_acl_count === '0'
            && arraysEqual(row.app_schema_privileges, ['USAGE:false'])
            && row.unexpected_schema_acl_count === '0'
            && row.app_schema_create_denied === true
            && row.runtime_schema_create_denied === true
            && row.app_schema_usage === true,
          relationAclCustody: arraysEqual(row.app_relation_privileges, APP_RELATION_PRIVILEGES)
            && row.runtime_relation_acl_count === '0'
            && row.unexpected_sequence_acl_count === '0'
            && row.unexpected_column_acl_count === '0',
        };
        const ready = Object.values(checks).every((value) => value === true);
        return safeReadiness(checks, ready ? 'READY' : 'CATALOG_FINGERPRINT_MISMATCH');
      } catch { return safeReadiness(allFalse(), 'DATABASE_UNAVAILABLE'); }
    },
  });
}
function driverFacade(driver, isHealthy) {
  const facade = {
    atomicStateAndAudit: true, rlsEnforced: true, serverOnly: true, actorSafeCommands: true,
  };
  for (const name of [
    'selectCase', 'executeAtomicCaseCommand', 'readStudentSafeCase',
    'readFacultyCaseProjection', 'readMentorCaseProjection', 'reserveCaseCreation',
    'commitStudentCaseCreate', 'commitStudentBuilderAutosave', 'commitStudentBuilderComplete',
    'commitStudentConsentReceipt', 'commitStudentWaiverReceipt',
    'commitFacultyFinalDocumentRelease',
  ]) {
    facade[name] = (...args) => {
      if (!isHealthy()) throw disabled('RUNTIME_DATABASE_UNAVAILABLE');
      return driver[name](...args);
    };
  }
  return Object.freeze(facade);
}

export function createProductionPostgresRuntimeDependencies(rawBinding, rawOptions = {}) {
  const options = descriptorSnapshot(rawOptions, OPTION_KEYS);
  const binding = validateBinding(rawBinding);
  const environment = Object.hasOwn(options, 'environment') ? options.environment : process.env;
  const PoolClass = Object.hasOwn(options, 'PoolClass') ? options.PoolClass : Pool;
  if (typeof PoolClass !== 'function') throw disabled('POOL_CLASS_INVALID');
  const { ca, connectionString } = runtimeConfiguration(environment);
  let pool;
  let poolErrorListener = null;
  try {
    pool = new PoolClass({
      connectionString,
      ssl: { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-runtime', max: 10,
      connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000, allowExitOnIdle: false,
    });
    if (!pool || typeof pool.connect !== 'function' || typeof pool.end !== 'function'
      || typeof pool.on !== 'function' || typeof pool.removeListener !== 'function') {
      throw new TypeError('invalid pool');
    }
    let unhealthy = false;
    let closed = false;
    poolErrorListener = () => { unhealthy = true; };
    pool.on('error', poolErrorListener);
    const isHealthy = () => !unhealthy && !closed;
    const executor = createNodePostgresExecutor({ pool, databaseRole: NODE_POSTGRES_DATABASE_ROLE });
    const driver = createAtomicRlsCaseDriver({ binding, executor });
    let closePromise = null;
    const close = () => {
      if (!closePromise) {
        closed = true;
        closePromise = Promise.resolve().then(() => pool.end()).then(
          () => undefined,
          () => { throw disabled('POOL_CLOSE_FAILED'); },
        ).finally(() => { pool.removeListener('error', poolErrorListener); });
      }
      return closePromise;
    };
    return Object.freeze({
      driver: driverFacade(driver, isHealthy), scopeProvider: scopeProviderFor(executor, isHealthy),
      readiness: readinessFor(executor, isHealthy), close,
    });
  } catch (error) {
    if (pool && poolErrorListener && typeof pool.removeListener === 'function') {
      pool.removeListener('error', poolErrorListener);
    }
    if (pool && typeof pool.end === 'function') void Promise.resolve().then(() => pool.end()).catch(() => {});
    if (error instanceof IntegrationDisabledError) throw error;
    throw disabled('RUNTIME_DEPENDENCY_CONSTRUCTION_FAILED');
  }
}

export const PRODUCTION_POSTGRES_RUNTIME_CONTRACT = Object.freeze({
  authority: 'DR-133', environmentKey: ENV_KEY, caEnvironmentKey: CA_ENV_KEY,
  runtimeLogin: DR133_RUNTIME_LOGIN,
  applicationRole: APP_ROLE, relationCount: RELATIONS.length, securityDefinerCount: DEFINERS.length,
  successorSentinel: SUCCESSOR_SENTINEL,
  publicSurface: Object.freeze(['driver', 'scopeProvider', 'readiness', 'close']),
  identitySource: 'active_trusted_request_context_only',
  tls: 'verified_pinned_railway_root_ca_and_hostname',
  revocationCommand: 'omitted_until_distinct_trusted_service_context_exists',
});
