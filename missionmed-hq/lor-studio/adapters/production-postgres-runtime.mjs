import pg from 'pg';
import { createHash, X509Certificate } from 'node:crypto';

import {
  AuthorizationDeniedError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  InvitationDeniedError,
  NotFoundError,
  StaleRevisionError,
} from '../domain/errors.js';
import { hashValue, sha256 } from '../domain/value-utils.js';
import { readTrustedRequestContext } from '../security/trusted-request-context.mjs';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import {
  NODE_POSTGRES_DATABASE_ROLE,
  createNodePostgresExecutor,
} from './node-postgres-executor.mjs';
import {
  PRODUCTION_RUNTIME_TARGET_CONTRACT,
  resolveProductionRuntimeTarget,
} from './production-runtime-target.mjs';
import {
  SupabaseDurableMentorAssignmentRepository,
} from '../repositories/supabase-durable-mentor-assignment-repository.mjs';
import {
  createDurableMentorAssignmentOperator,
} from '../services/durable-mentor-assignment-service.mjs';
import {
  DR133_RELATIONS as DR133_STAGING_RELATIONS,
  DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES as DR133_STAGING_APPROVED_DEFINERS,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES as DR133_STAGING_APP_DEFINERS,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';
import {
  DR133_PRODUCTION_DATABASE_CA_DER_SHA256,
  DR133_RELATIONS as DR133_PRODUCTION_RELATIONS,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES as DR133_PRODUCTION_APPROVED_DEFINERS,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES as DR133_PRODUCTION_APP_DEFINERS,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';

const { Pool } = pg;
const atomicDriverModuleUrl = new URL('./atomic-rls-case-driver.mjs', import.meta.url);
const { createAtomicRlsCaseDriver } = await import(atomicDriverModuleUrl.href);
const AUTHENTIC_PRODUCTION_POSTGRES_READINESS = new WeakSet();

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
const CANDIDATE_SCOPE_SCHEMA = 'missionmed.lor.faculty-invitation-candidate-scope.v1';
const AI_COMMAND_SCHEMA = 'missionmed.lor.ai-proposal-driver-command.v1';
const AI_ERROR_RECEIPT_SCHEMA = 'missionmed.lor.ai-proposal-error-receipt.v1';
const ACTOR_CASE_ACCESS_SCHEMA = 'missionmed.lor.actor-case-access.v1';
const BINDING_SCHEMA = 'missionmed.lor.student-auth-binding-receipt.v1';
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const DEPLOYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BINDING_ID = /^binding_[a-f0-9]{64}$/u;
const OPTION_KEYS = new Set(['environment', 'PoolClass']);
const REQUEST_KEYS = new Set(['caseId', 'operation', 'resourceStudentId']);
const ACTOR_ACCESS_REQUEST_KEYS = new Set(['authenticatedSubject', 'caseId']);
const ACTOR_ACCESS_RESULT_KEYS = new Set([
  'actorId', 'actorRole', 'authoritySource', 'caseId', 'resourceStudentId', 'schemaVersion',
]);
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
const CANDIDATE_SCOPE_REQUEST_KEYS = new Set(['invitationId', 'operation']);
const CANDIDATE_SCOPE_KEYS = new Set([
  'schemaVersion', 'authoritySource', 'authenticated', 'roleVerified', 'authUid',
  'authenticatedSubject', 'actorId', 'actorRole', 'operation', 'purpose', 'invitationId',
  'entitlementVerified', 'lorEnabled', 'canaryAuthorized',
]);
const ISSUE_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'scope', 'actorId', 'caseId', 'expectedRevision', 'invitationId',
  'recipientEmailHash', 'tokenHash', 'challengeId', 'otpCodeHash', 'invitationExpiresAt',
  'challengeExpiresAt', 'maxAttempts', 'attemptWindowMs', 'lockoutMs', 'idempotencyKey',
  'requestHash',
]);
const RESEND_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'scope', 'actorId', 'caseId', 'recipientEmailHash', 'challengeId',
  'otpCodeHash', 'challengeExpiresAt', 'idempotencyKey', 'requestHash',
]);
const REVOKE_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'scope', 'actorId', 'caseId', 'idempotencyKey', 'requestHash',
]);
const DELIVERY_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'studentScope', 'caseId', 'invitationId', 'providerMessageRefHash',
  'idempotencyKey', 'requestHash',
]);
const RESERVE_DELIVERY_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'studentScope', 'caseId', 'invitationId', 'deliveryAction',
  'idempotencyKey', 'requestHash',
]);
const UNKNOWN_DELIVERY_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'studentScope', 'caseId', 'invitationId', 'idempotencyKey', 'requestHash',
]);
const VERIFY_INVITATION_COMMAND_KEYS = new Set([
  'binding', 'candidateScope', 'invitationId', 'recipientEmailHash', 'tokenHash',
  'otpCode', 'idempotencyKey', 'requestHash',
]);
const RESERVE_CANDIDATE_HANDOFF_COMMAND_KEYS = new Set([
  'binding', 'invitationId', 'tokenHash', 'flowNonceHash', 'maximumLifetimeSeconds',
]);
const REDEEM_CANDIDATE_HANDOFF_COMMAND_KEYS = new Set([
  'binding', 'invitationId', 'tokenHash', 'flowNonceHash', 'authenticatedSubject',
  'issuedAt', 'expiresAt',
]);
const AI_WRITE_COMMAND_KEYS = new Set([
  'schemaVersion', 'operation', 'binding', 'targetBindingHash', 'scope', 'scopeHash',
  'caseId', 'proposalId', 'idempotencyKey', 'requestHash', 'recordHash', 'providerRunHash',
  'outputHash', 'decisionHash', 'acceptedContentHash', 'expectedState',
  'expectedOutputHash', 'expectedDecisionHash', 'record',
]);
const AI_RESERVATION_COMMAND_KEYS = new Set([
  'schemaVersion', 'operation', 'binding', 'targetBindingHash', 'scope', 'scopeHash',
  'caseId', 'idempotencyKey', 'requestHash',
]);
const AI_READ_COMMAND_KEYS = new Set([
  'schemaVersion', 'operation', 'binding', 'targetBindingHash', 'scope', 'scopeHash',
  'caseId', 'proposalId',
]);
const ARTIFACT_AUDIT_COMMAND_SCHEMA = 'missionmed.lor.artifact-audit-command.v1';
const ARTIFACT_AUDIT_COMMAND_KEYS = new Set([
  'schemaVersion', 'binding', 'targetBindingHash', 'scope', 'scopeHash',
  'caseId', 'event', 'eventHash',
]);
const ARTIFACT_AUDIT_EVENT_KEYS = new Set([
  'schemaVersion', 'eventId', 'type', 'at', 'actorRole', 'actorRef', 'caseRef',
  'targetRef', 'outcome', 'metadata',
]);
const ARTIFACT_GENERATED_METADATA_KEYS = new Set([
  'action', 'artifactFormat', 'result', 'artifactSha256',
  'releaseDocumentHash', 'sourceRevision',
]);
const ARTIFACT_DENIED_METADATA_KEYS = new Set([
  'action', 'artifactFormat', 'reasonCode',
]);
const PRIVATE_STORAGE_PUT_COMMAND_KEYS = new Set([
  'actorId', 'actorRole', 'aadHash', 'authTagBase64', 'byteLength', 'capabilityId',
  'caseId', 'checksum', 'ciphertextBase64', 'contentClass', 'contentType', 'evidenceId',
  'hkdfSaltBase64', 'idempotencyKey', 'ivBase64', 'keyVersion', 'objectId', 'objectKey',
  'purpose', 'requestHash', 'storageIdentity',
]);
const PRIVATE_STORAGE_GET_COMMAND_KEYS = new Set([
  'actorId', 'actorRole', 'capabilityId', 'caseId', 'contentClass', 'evidenceId',
  'objectId', 'objectKey', 'purpose', 'storageIdentity', 'versionId',
]);
const ASSIGN_MENTOR_COMMAND_KEYS = new Set([
  'binding', 'caseId', 'studentAuthSubject', 'mentorAuthSubject', 'purpose',
  'maximumLifetimeSeconds', 'idempotencyKey',
]);
const REVOKE_MENTOR_COMMAND_KEYS = new Set([
  'binding', 'caseId', 'studentAuthSubject', 'assignmentId', 'reasonCode',
  'idempotencyKey',
]);
const RELATIONS = Object.freeze([...DR133_STAGING_RELATIONS].sort());
const DEFINERS = DR133_STAGING_APPROVED_DEFINERS;
const APP_EXECUTABLE_DEFINERS = DR133_STAGING_APP_DEFINERS;
const APP_RELATION_PRIVILEGES = Object.freeze([
  'administrative_case_grant_revocations:SELECT:false',
  'administrative_case_grants:SELECT:false',
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
const helperFunctionPrivileges = Object.freeze([
  'ai_grounding_manifest_is_complete(jsonb)',
  'audit_event_is_metadata(jsonb)',
  'canonical_jsonb_sha256(jsonb)',
  'canonical_jsonb_text(jsonb)',
  'operational_content_context_allows(text,text,text[],text[])',
  'student_context_allows(text,text,uuid,text[])',
  'student_write_axes_satisfied()',
]);
function functionPrivileges(definers) {
  return Object.freeze([
    ...definers,
    ...helperFunctionPrivileges,
  ].map((identity) => `${identity}:EXECUTE:false`).sort());
}
const APP_FUNCTION_PRIVILEGES = functionPrivileges(APP_EXECUTABLE_DEFINERS);
const STAGING_CATALOG = Object.freeze({
  relations: RELATIONS,
  definers: DEFINERS,
  appExecutableDefiners: APP_EXECUTABLE_DEFINERS,
  appFunctionPrivileges: APP_FUNCTION_PRIVILEGES,
  appRelationPrivileges: APP_RELATION_PRIVILEGES,
});
const PRODUCTION_CATALOG = Object.freeze({
  relations: Object.freeze([...DR133_PRODUCTION_RELATIONS].sort()),
  definers: DR133_PRODUCTION_APPROVED_DEFINERS,
  appExecutableDefiners: DR133_PRODUCTION_APP_DEFINERS,
  appFunctionPrivileges: functionPrivileges(DR133_PRODUCTION_APP_DEFINERS),
  // The encrypted private-storage table is reachable only through the two
  // command-owner SECURITY DEFINER functions. The application role must never
  // acquire a direct table grant, including SELECT.
  appRelationPrivileges: APP_RELATION_PRIVILEGES,
});

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
const ACTOR_ACCESS_SQL = `SELECT ${SCHEMA}.resolve_lor_actor_case_access($1, $2) AS result`;
const ISSUE_INVITATION_SQL = `SELECT ${SCHEMA}.issue_faculty_invitation(
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
) AS result`;
const RESEND_INVITATION_SQL = `SELECT ${SCHEMA}.resend_faculty_invitation_otp(
  $1, $2, $3, $4, $5, $6, $7
) AS result`;
const REVOKE_INVITATION_SQL = `SELECT ${SCHEMA}.revoke_faculty_invitation(
  $1, $2, $3
) AS result`;
const VERIFY_INVITATION_SQL = `SELECT ${SCHEMA}.verify_faculty_invitation(
  $1, $2, $3, $4, $5, $6
) AS result`;
const RESERVE_CANDIDATE_HANDOFF_SQL =
  `SELECT ${SCHEMA}.reserve_faculty_candidate_auth_handoff(
  $1, $2, $3, $4
) AS result`;
const REDEEM_CANDIDATE_HANDOFF_SQL =
  `SELECT ${SCHEMA}.redeem_faculty_candidate_auth_handoff(
  $1, $2, $3, $4, $5, $6
) AS result`;
const DELIVERY_INVITATION_SQL = `SELECT ${SCHEMA}.commit_faculty_invitation_delivery(
  $1, $2, $3, $4, $5
) AS result`;
const RESERVE_DELIVERY_INVITATION_SQL =
  `SELECT ${SCHEMA}.commit_faculty_invitation_delivery(
  $1, $2, $3, $4, $5
) AS result`;
const UNKNOWN_DELIVERY_INVITATION_SQL =
  `SELECT ${SCHEMA}.commit_faculty_invitation_delivery(
  $1, $2, $3, $4, $5
) AS result`;
const PERSIST_AI_PROPOSAL_SQL = `SELECT ${SCHEMA}.persist_ai_provider_run_and_proposal_atomic(
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) AS result`;
const TRANSITION_AI_GENERATION_SQL =
  `SELECT ${SCHEMA}.transition_ai_proposal_generation_reservation(
  $1, $2, $3, $4, $5, $6
) AS result`;
const READ_AI_PROPOSAL_SQL = `SELECT ${SCHEMA}.read_actor_safe_ai_proposal(
  $1, $2, $3, $4
) AS result`;
const ATTACH_AI_DECISION_SQL = `SELECT ${SCHEMA}.attach_ai_proposal_decision_if_undecided_atomic(
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) AS result`;
const APPEND_ARTIFACT_AUDIT_SQL = `SELECT ${SCHEMA}.append_artifact_export_audit(
  $1::jsonb, $2, $3, $4
) AS result`;
const PUT_ENCRYPTED_PRIVATE_ARTIFACT_SQL =
  `SELECT ${SCHEMA}.put_encrypted_private_artifact_version(
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
) AS result`;
const GET_ENCRYPTED_PRIVATE_ARTIFACT_SQL =
  `SELECT ${SCHEMA}.get_encrypted_private_artifact_version(
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
) AS result`;
const ASSIGN_MENTOR_SQL = `SELECT ${SCHEMA}.assign_mentor_to_case(
  $1, $2, $3, $4, $5, $6
) AS result`;
const REVOKE_MENTOR_SQL = `SELECT ${SCHEMA}.revoke_mentor_case_assignment(
  $1, $2, $3, $4, $5
) AS result`;

function readinessSql(target) {
  return `/* missionmed:dr133:lor-runtime-readiness-v2 */
WITH relation_inventory AS (
  SELECT class.oid AS relation_oid, class.relname::text AS relation_name,
    class.relrowsecurity, class.relforcerowsecurity
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = '${SCHEMA}' AND class.relkind = 'r'
), definer_inventory AS (
  SELECT procedure.proname || '(' ||
    pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ',') || ')'
      AS function_identity, procedure.oid, procedure.proowner, procedure.proconfig
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = '${SCHEMA}' AND procedure.prosecdef
), public_function_acl AS (
  SELECT procedure.proname || '(' ||
    pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ',') || ')'
      AS function_identity
  FROM pg_catalog.pg_proc AS procedure
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
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${target.databaseAdmin}')
      AS admin_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${APP_ROLE}') AS app_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_command_owner')
      AS command_owner_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${target.runtimeLogin}')
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
    pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ',') || '):' ||
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
  (SELECT COALESCE(pg_catalog.array_agg(function_identity
      ORDER BY function_identity COLLATE "C"), ARRAY[]::text[])
    FROM definer_inventory
    WHERE pg_catalog.has_function_privilege(current_user, oid, 'EXECUTE'))
      AS app_execute_identities,
  (SELECT pg_catalog.count(*) = 1
      AND COALESCE(pg_catalog.bool_and(NOT pg_catalog.has_function_privilege(
        current_user, oid, 'EXECUTE'
      )), false)
    FROM definer_inventory
    WHERE function_identity = '${DR133_PRE_EVIDENCE_DEFINER_IDENTITY}')
      AS pre_evidence_app_execute_denied,
  (SELECT pg_catalog.count(*) = 0 FROM public_function_acl
    WHERE function_identity = '${DR133_PRE_EVIDENCE_DEFINER_IDENTITY}')
      AS pre_evidence_public_execute_denied,
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
    WHERE role.rolname = '${target.runtimeLogin}' AND NOT role.rolsuper
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
  NOT pg_catalog.has_schema_privilege('${target.runtimeLogin}', '${SCHEMA}', 'CREATE')
    AS runtime_schema_create_denied,
  pg_catalog.has_schema_privilege('${APP_ROLE}', '${SCHEMA}', 'USAGE') AS app_schema_usage
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname = '${SCHEMA}'`;
}

const TRANSPORT_READINESS_SQL = `/* missionmed:dr133:lor-runtime-transport-readiness-v1 */
SELECT pg_catalog.current_database()::text AS database_name,
  (pg_catalog.current_setting('server_version_num')::integer / 10000) AS postgres_major,
  current_user::text AS current_user, session_user::text AS session_user,
  (pg_catalog.inet_server_addr() IS NOT NULL AND (
    pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
    OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7')) AS private_server_address,
  (pg_catalog.current_setting('ssl') = 'on' AND COALESCE((
    SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid = pg_catalog.pg_backend_pid()
  ), false)) AS ssl_active`;
const TRANSPORT_READINESS_QUERY_TIMEOUT_MILLISECONDS = 5_000;

async function probePrivateTlsTarget(pool, target) {
  let client = null;
  let destroyConnection = false;
  let ready = false;
  try {
    client = await pool.connect();
    const result = await client.query({
      text: TRANSPORT_READINESS_SQL,
      values: [],
      query_timeout: TRANSPORT_READINESS_QUERY_TIMEOUT_MILLISECONDS,
    });
    const row = Array.isArray(result?.rows) && result.rows.length === 1
      ? result.rows[0] : null;
    ready = Boolean(
      row
      && row.database_name === target.databaseName
      && [16, 18].includes(row.postgres_major)
      && row.current_user === target.runtimeLogin
      && row.session_user === target.runtimeLogin
      && row.private_server_address === true
      && row.ssl_active === true
    );
    // A client whose session identity or transport cannot be positively
    // attested is not safe to return to the shared pool.
    destroyConnection = !ready;
  } catch {
    destroyConnection = true;
    ready = false;
  } finally {
    if (client) {
      try {
        if (destroyConnection) client.release(true);
        else client.release();
      } catch {
        ready = false;
      }
    }
  }
  return ready;
}

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
  if (
    binding.schemaVersion !== 'missionmed.lor.target-binding.v2'
    || binding.decisionRecord !== 'DR-133'
    || binding.provider !== 'railway-postgres'
    || (binding.environment !== 'staging' && binding.environment !== 'production')
    || binding.schema !== SCHEMA
  ) throw disabled('DR133_TARGET_BINDING_MISMATCH');
  return binding;
}
function verifiedDatabaseCa(rawValue, target) {
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
      || !(Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo))
      || (
        target.deploymentEnvironment === 'production'
        && createHash('sha256').update(certificate.raw).digest('hex')
          !== DR133_PRODUCTION_DATABASE_CA_DER_SHA256
      )) {
      throw new TypeError('untrusted root');
    }
    return certificate.toString();
  } catch {
    throw disabled('RUNTIME_DATABASE_CA_REJECTED');
  }
}
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;

function parsePrivateRuntimeDatabaseUrl(rawValue, target) {
  if (
    typeof rawValue !== 'string'
    || rawValue.length === 0
    || rawValue.length > 4_096
    || CONTROL_CHARACTER.test(rawValue)
  ) throw disabled('RUNTIME_DATABASE_URL_REJECTED');
  let parsed;
  let databasePath;
  let username;
  let password;
  try {
    parsed = new URL(rawValue);
    databasePath = decodeURIComponent(parsed.pathname);
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw disabled('RUNTIME_DATABASE_URL_REJECTED');
  }
  if (
    CONTROL_CHARACTER.test(databasePath)
    || CONTROL_CHARACTER.test(username)
    || CONTROL_CHARACTER.test(password)
    || !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.hostname !== target.databaseHost
    || parsed.port !== '5432'
    || databasePath !== `/${target.databaseName}`
    || username !== target.runtimeLogin
    || password.length < 32
    || password.length > 512
    || parsed.hash !== ''
  ) throw disabled('RUNTIME_DATABASE_URL_REJECTED');
  const queryKeys = [...parsed.searchParams.keys()];
  if (
    queryKeys.length !== 1
    || queryKeys[0] !== 'sslmode'
    || parsed.searchParams.getAll('sslmode').length !== 1
    || parsed.searchParams.get('sslmode') !== 'require'
  ) throw disabled('RUNTIME_DATABASE_URL_REJECTED');
  parsed.search = '';
  return parsed.toString();
}

function runtimeConfiguration(environment, target) {
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
    [RAILWAY_ENV_KEYS.environmentId]: target.environmentId,
    [RAILWAY_ENV_KEYS.environmentName]: target.environmentName,
    [RAILWAY_ENV_KEYS.projectId]: target.projectId,
    [RAILWAY_ENV_KEYS.region]: target.region,
    [RAILWAY_ENV_KEYS.serviceId]: target.executionServiceId,
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
  const ca = verifiedDatabaseCa(caDescriptor.value, target);
  try {
    return Object.freeze({
      ca,
      connectionString: parsePrivateRuntimeDatabaseUrl(descriptor.value, target),
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
function actorAccessRequestSnapshot(raw) {
  const request = exactDataSnapshot(raw, ACTOR_ACCESS_REQUEST_KEYS, 'ACTOR_ACCESS_REQUEST_INVALID');
  if (!SUBJECT.test(request.authenticatedSubject ?? '') || !CASE_ID.test(request.caseId ?? '')) {
    throw disabled('ACTOR_ACCESS_REQUEST_INVALID');
  }
  return request;
}
function actorAccessResult(raw, request) {
  const result = exactDataSnapshot(raw, ACTOR_ACCESS_RESULT_KEYS, 'ACTOR_ACCESS_RESULT_INVALID');
  if (result.schemaVersion !== ACTOR_CASE_ACCESS_SCHEMA
    || result.authoritySource !== 'database_verified_case_access'
    || result.actorId !== request.authenticatedSubject
    || !['student', 'faculty', 'mentor'].includes(result.actorRole)
    || !SUBJECT.test(result.resourceStudentId ?? '')
    || result.caseId !== request.caseId
    || (result.actorRole === 'student' && result.resourceStudentId !== result.actorId)) {
    throw disabled('ACTOR_ACCESS_RESULT_INVALID');
  }
  return Object.freeze(result);
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
function actorResolverFor(executor, isHealthy) {
  return Object.freeze({
    async resolve(rawRequest) {
      if (!isHealthy()) throw disabled('RUNTIME_DATABASE_UNAVAILABLE');
      try {
        const request = actorAccessRequestSnapshot(rawRequest);
        const rawResult = await transaction(executor, async (tx) => {
          await tx.execute(statement('lor_runtime_actor_access_gucs', RESOLUTION_GUCS_SQL, [
            '', request.authenticatedSubject, 'service', '', request.caseId,
            'read', 'actor_case_access_resolution', '', '', '',
            'true', 'true', 'true', 'actor-access-v1', 'true',
          ]));
          return oneResult(await tx.execute(statement(
            'lor_runtime_resolve_actor_case_access',
            ACTOR_ACCESS_SQL,
            [request.authenticatedSubject, request.caseId],
          )));
        });
        if (rawResult === null || rawResult === undefined) {
          throw new AuthorizationDeniedError('DATABASE_CASE_ACCESS_NOT_FOUND');
        }
        return actorAccessResult(rawResult, request);
      } catch (error) {
        throw mapScopeError(error);
      }
    },
  });
}
function identifier(value) {
  return typeof value === 'string' && CASE_ID.test(value);
}
function digest(value) {
  return typeof value === 'string' && SHA256.test(value);
}
function boundedKey(value, maximum = 240) {
  return typeof value === 'string' && value.length >= 1 && value.length <= maximum;
}
function assertBindingMatch(rawBinding, binding, status) {
  const expectedKeys = new Set(Object.keys(binding));
  const candidate = exactDataSnapshot(rawBinding, expectedKeys, status);
  if (Object.entries(binding).some(([key, value]) => candidate[key] !== value)) {
    throw disabled(status);
  }
  return Object.freeze(candidate);
}
function commandScope(rawScope, { actorRole, caseId, operation }, status) {
  const scope = exactDataSnapshot(rawScope, SCOPE_KEYS, status);
  if (scope.schemaVersion !== SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true || scope.roleVerified !== true
    || !UUID.test(scope.authUid ?? '') || !SUBJECT.test(scope.authenticatedSubject ?? '')
    || scope.actorId !== scope.authenticatedSubject || scope.actorRole !== actorRole
    || !SUBJECT.test(scope.resourceStudentId ?? '') || scope.caseId !== caseId
    || scope.operation !== operation || scope.entitlementVerified !== true
    || scope.lorEnabled !== true || scope.canaryAuthorized !== true) {
    throw disabled(status);
  }
  if (actorRole === 'student' && (scope.resourceStudentId !== scope.actorId
    || scope.purpose !== (operation === 'read' ? 'student_case_read' : 'student_case_write')
    || scope.assignmentId !== null
    || scope.invitationId !== null || scope.administrativeGrantId !== null)) {
    throw disabled(status);
  }
  if (actorRole === 'faculty' && (scope.purpose !== 'faculty_private_edit'
    || !identifier(scope.invitationId) || scope.assignmentId !== null
    || scope.administrativeGrantId !== null)) {
    throw disabled(status);
  }
  return Object.freeze(scope);
}
function deterministicFacultyAuthUid(subject) {
  const value = sha256(`missionmed.lor.faculty-auth-uid.v1:${subject}`);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-5${value.slice(13, 16)}`
    + `-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}
function candidateScopeProviderFor(isHealthy) {
  return async (rawRequest) => {
    if (!isHealthy()) throw disabled('RUNTIME_DATABASE_UNAVAILABLE');
    const request = exactDataSnapshot(
      rawRequest,
      CANDIDATE_SCOPE_REQUEST_KEYS,
      'CANDIDATE_SCOPE_REQUEST_INVALID',
    );
    if (request.operation !== 'verify_faculty_invitation' || !identifier(request.invitationId)) {
      throw new InvitationDeniedError();
    }
    let context;
    try { context = readTrustedRequestContext(); } catch {
      throw disabled('TRUSTED_REQUEST_CONTEXT_REQUIRED');
    }
    const authenticatedSubject = context.authenticatedSubject;
    if (context.actorRole !== 'faculty' || typeof authenticatedSubject !== 'string'
      || !SUBJECT.test(authenticatedSubject)
      || context.entitlementVerified !== true || context.lorEnabled !== true
      || context.canaryAuthorized !== true || context.clientAsserted !== false) {
      throw new InvitationDeniedError();
    }
    return Object.freeze({
      schemaVersion: CANDIDATE_SCOPE_SCHEMA,
      authoritySource: 'server_verified_wordpress_invitation_candidate',
      authenticated: true,
      roleVerified: true,
      authUid: deterministicFacultyAuthUid(authenticatedSubject),
      authenticatedSubject,
      actorId: authenticatedSubject,
      actorRole: 'faculty',
      operation: 'verify_faculty_invitation',
      purpose: 'faculty_private_edit',
      invitationId: request.invitationId,
      entitlementVerified: true,
      lorEnabled: true,
      canaryAuthorized: true,
    });
  };
}
function candidateCommandScope(rawScope, invitationId, status) {
  const scope = exactDataSnapshot(rawScope, CANDIDATE_SCOPE_KEYS, status);
  if (scope.schemaVersion !== CANDIDATE_SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_wordpress_invitation_candidate'
    || scope.authenticated !== true || scope.roleVerified !== true
    || !SUBJECT.test(scope.authenticatedSubject ?? '')
    || scope.actorId !== scope.authenticatedSubject || scope.actorRole !== 'faculty'
    || scope.authUid !== deterministicFacultyAuthUid(scope.actorId)
    || scope.operation !== 'verify_faculty_invitation'
    || scope.purpose !== 'faculty_private_edit' || scope.invitationId !== invitationId
    || scope.entitlementVerified !== true || scope.lorEnabled !== true
    || scope.canaryAuthorized !== true) {
    throw new InvitationDeniedError();
  }
  return Object.freeze(scope);
}
function gucValues(scope, overrides = {}) {
  return [
    overrides.authUid ?? scope.authUid,
    overrides.authenticatedSubject ?? scope.authenticatedSubject,
    overrides.actorRole ?? scope.actorRole,
    overrides.resourceStudentId ?? scope.resourceStudentId ?? '',
    overrides.caseId ?? scope.caseId ?? '',
    overrides.operation ?? scope.operation,
    overrides.purpose ?? scope.purpose,
    overrides.invitationId ?? scope.invitationId ?? '',
    overrides.assignmentId ?? scope.assignmentId ?? '',
    overrides.administrativeGrantId ?? scope.administrativeGrantId ?? '',
    String(overrides.entitlementVerified ?? scope.entitlementVerified),
    String(overrides.lorEnabled ?? scope.lorEnabled),
    String(overrides.canaryAuthorized ?? scope.canaryAuthorized),
    overrides.trustedServiceActor ?? '',
    'true',
  ];
}
function inertJsonClone(value, status, depth = 0) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (depth > 24 || (!Array.isArray(value) && !plain(value))) throw disabled(status);
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw disabled(status);
  }
  if (Array.isArray(value)) {
    if (keys.length !== value.length + 1 || keys.at(-1) !== 'length') throw disabled(status);
    const clone = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
        throw disabled(status);
      }
      clone.push(inertJsonClone(descriptor.value, status, depth + 1));
    }
    return clone;
  }
  const clone = {};
  for (const key of keys) {
    if (typeof key !== 'string') throw disabled(status);
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true || key === '__proto__') throw disabled(status);
    clone[key] = inertJsonClone(descriptor.value, status, depth + 1);
  }
  return clone;
}
async function executeRuntimeCommand(executor, gucs, statementId, text, values, status) {
  const raw = await transaction(executor, async (tx) => {
    await tx.execute(statement(`${statementId}_gucs`, RESOLUTION_GUCS_SQL, gucs));
    return oneResult(await tx.execute(statement(statementId, text, values)));
  });
  if (!plain(raw)) throw disabled(status);
  return raw;
}
function mapInvitationDatabaseError(error, command) {
  const exact = `${typeof error?.code === 'string' ? error.code : ''}/${
    typeof error?.message === 'string' ? error.message : ''}`;
  if (exact === 'P1301/LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED') {
    return new AuthorizationDeniedError('DATABASE_INVITATION_COMMAND_DENIED');
  }
  if (exact === 'P1302/LOR_FACULTY_INVITATION_IDEMPOTENCY_CONFLICT') {
    return new IdempotencyConflictError({ idempotencyKey: command.idempotencyKey });
  }
  if (exact === 'P1303/LOR_FACULTY_INVITATION_CASE_NOT_FOUND') {
    return new InvitationDeniedError();
  }
  if (exact === 'P1306/LOR_FACULTY_INVITATION_STALE_REVISION') {
    return new StaleRevisionError({
      caseId: command.caseId,
      expectedRevision: command.expectedRevision ?? null,
      actualRevision: null,
    });
  }
  return disabled('ATOMIC_FACULTY_INVITATION_TRANSACTION_FAILED');
}
function mapCandidateHandoffDatabaseError(error) {
  const exact = String(typeof error?.code === 'string' ? error.code : '')
    + '/'
    + String(typeof error?.message === 'string' ? error.message : '');
  if (exact === 'P1311/LOR_FACULTY_CANDIDATE_HANDOFF_DENIED') {
    return new InvitationDeniedError();
  }
  return disabled('ATOMIC_FACULTY_CANDIDATE_HANDOFF_TRANSACTION_FAILED');
}
function aiErrorReceipt(error, command) {
  const exact = `${typeof error?.code === 'string' ? error.code : ''}/${
    typeof error?.message === 'string' ? error.message : ''}`;
  let errorCode = null;
  if (exact === 'P1402/LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT') {
    errorCode = 'IDEMPOTENCY_CONFLICT';
  } else if (exact === 'P1403/LOR_AI_PROPOSAL_NOT_FOUND') {
    errorCode = 'NOT_FOUND';
  } else if (command.operation === 'attach_decision' && [
    'P1404/LOR_AI_PROPOSAL_ALREADY_DECIDED',
    'P1404/LOR_AI_PROPOSAL_STATE_INVALID',
  ].includes(exact)) {
    errorCode = 'AI_PROPOSAL_ALREADY_DECIDED';
  }
  if (errorCode === null) return null;
  return Object.freeze({
    schemaVersion: AI_ERROR_RECEIPT_SCHEMA,
    operation: command.operation,
    errorCode,
    caseId: command.caseId,
    proposalId: command.proposalId,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    scopeHash: command.scopeHash,
    targetBindingHash: command.targetBindingHash,
  });
}
function aiReservationErrorReceipt(error, command) {
  const exact = String(typeof error?.code === 'string' ? error.code : '') + '/'
    + String(typeof error?.message === 'string' ? error.message : '');
  if (exact !== 'P1402/LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT') return null;
  return Object.freeze({
    schemaVersion: AI_ERROR_RECEIPT_SCHEMA,
    operation: command.operation,
    errorCode: 'IDEMPOTENCY_CONFLICT',
    caseId: command.caseId,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    scopeHash: command.scopeHash,
    targetBindingHash: command.targetBindingHash,
  });
}
function arraysEqual(value, expected) {
  return Array.isArray(value) && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}
const READINESS_GROUP_CHECKS = Object.freeze({
  database: Object.freeze([
    'runtimeIdentity', 'privateTlsTarget', 'applicationRole', 'targetSentinel',
    'relationsForcedRls', 'securityDefiners', 'appExecute', 'functionAclCustody',
    'publicDriftAbsent', 'aclGranteesRestricted', 'viewCustody', 'roleCustody',
    'relationAclCustody',
  ]),
  repository: Object.freeze([
    'runtimeIdentity', 'privateTlsTarget', 'applicationRole', 'targetSentinel',
    'functionAclCustody', 'aclGranteesRestricted', 'roleCustody',
    'relationAclCustody',
  ]),
  rls: Object.freeze([
    'relationsForcedRls', 'securityDefiners', 'appExecute', 'functionAclCustody',
    'publicDriftAbsent', 'aclGranteesRestricted', 'viewCustody', 'roleCustody',
    'relationAclCustody',
  ]),
  // This is deliberately catalog custody, not a claim that an end-to-end audit
  // transaction or restore rehearsal has run.  The production operational
  // coordinator requires a separate fresh audit receipt before `audit` can be
  // reported ready.
  auditCatalog: Object.freeze([
    'targetSentinel', 'relationsForcedRls', 'securityDefiners', 'appExecute',
    'functionAclCustody', 'publicDriftAbsent', 'aclGranteesRestricted',
    'roleCustody', 'relationAclCustody',
  ]),
});
function groupedReadiness(checks) {
  return Object.freeze(Object.fromEntries(
    Object.entries(READINESS_GROUP_CHECKS).map(([group, names]) => [
      group,
      names.every((name) => checks[name] === true),
    ]),
  ));
}
function safeReadiness(checks, reasonCode) {
  const frozen = Object.freeze({ ...checks });
  return Object.freeze({
    ready: Object.values(frozen).every((value) => value === true),
    reasonCode,
    checks: frozen,
    groups: groupedReadiness(frozen),
  });
}
function readinessFor(executor, health, target, catalog, pool) {
  const targetReadinessSql = readinessSql(target);
  const allFalse = () => ({
    runtimeIdentity: false, privateTlsTarget: false, applicationRole: false,
    targetSentinel: false, relationsForcedRls: false, securityDefiners: false,
    appExecute: false, functionAclCustody: false, publicDriftAbsent: false,
    aclGranteesRestricted: false,
    viewCustody: false, roleCustody: false, relationAclCustody: false,
  });
  const readiness = Object.freeze({
    async probe() {
      if (!health.mayProbe()) return safeReadiness(allFalse(), 'DATABASE_UNAVAILABLE');
      // pg_stat_ssl redacts its current-session row after SET LOCAL ROLE switches
      // to the no-login application role. Prove the exact runtime login, private
      // address, and live TLS session before entering the least-privilege catalog
      // transaction, then keep every catalog query under lor_studio_app.
      if (!await probePrivateTlsTarget(pool, target)) {
        health.markUnavailable();
        return safeReadiness(allFalse(), 'DATABASE_UNAVAILABLE');
      }
      try {
        const row = await transaction(executor, async (tx) => {
          const result = await tx.execute(statement('lor_runtime_readiness', targetReadinessSql));
          return result.rows.length === 1 ? result.rows[0] : null;
        });
        if (!row) {
          health.markUnavailable();
          return safeReadiness(allFalse(), 'CATALOG_FINGERPRINT_MISMATCH');
        }
        const checks = {
          runtimeIdentity: row.database_name === target.databaseName
            && [16, 18].includes(row.postgres_major)
            && row.session_user === target.runtimeLogin,
          privateTlsTarget: true,
          applicationRole: row.current_user === APP_ROLE,
          targetSentinel: row.schema_sentinel === target.successorSentinel
            && row.schema_owner === target.databaseAdmin,
          relationsForcedRls: row.relation_count === String(catalog.relations.length)
            && row.forced_rls_count === String(catalog.relations.length)
            && arraysEqual(row.relation_names, catalog.relations),
          securityDefiners: row.definer_count === String(catalog.definers.length)
            && row.definer_custody_safe === true
            && arraysEqual(row.definer_identities, catalog.definers),
          appExecute: row.app_execute_count === String(catalog.appExecutableDefiners.length)
            && arraysEqual(row.app_execute_identities, catalog.appExecutableDefiners)
            && row.pre_evidence_app_execute_denied === true,
          functionAclCustody: arraysEqual(
            row.app_function_privileges,
            catalog.appFunctionPrivileges,
          ) && row.runtime_function_acl_count === '0',
          publicDriftAbsent: row.public_function_execute_count === '0'
            && row.public_relation_privilege_count === '0'
            && row.pre_evidence_public_execute_denied === true,
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
          relationAclCustody: arraysEqual(
            row.app_relation_privileges,
            catalog.appRelationPrivileges,
          )
            && row.runtime_relation_acl_count === '0'
            && row.unexpected_sequence_acl_count === '0'
            && row.unexpected_column_acl_count === '0',
        };
        const ready = Object.values(checks).every((value) => value === true);
        if (ready) health.markReady();
        else health.markUnavailable();
        return safeReadiness(checks, ready ? 'READY' : 'CATALOG_FINGERPRINT_MISMATCH');
      } catch {
        health.markUnavailable();
        return safeReadiness(allFalse(), 'DATABASE_UNAVAILABLE');
      }
    },
  });
  AUTHENTIC_PRODUCTION_POSTGRES_READINESS.add(readiness);
  return readiness;
}

export function isAuthenticProductionPostgresReadiness(value) {
  if (!value || typeof value !== 'object') return false;
  try {
    return Object.isFrozen(value)
      && Reflect.ownKeys(value).length === 1
      && typeof value.probe === 'function'
      && Object.getOwnPropertyDescriptor(value, 'probe')?.value === value.probe
      && AUTHENTIC_PRODUCTION_POSTGRES_READINESS.has(value);
  } catch {
    return false;
  }
}

function mentorAssignmentCommandDriverFor(executor, binding, isHealthy) {
  const assertHealthy = () => {
    if (!isHealthy()) throw disabled('RUNTIME_DATABASE_UNAVAILABLE');
  };
  const command = (rawCommand, keys, status) => {
    const snapshot = exactDataSnapshot(rawCommand, keys, status);
    assertBindingMatch(snapshot.binding, binding, status);
    if (
      !identifier(snapshot.caseId)
      || !SUBJECT.test(snapshot.studentAuthSubject ?? '')
      || !boundedKey(snapshot.idempotencyKey, 200)
      || !CASE_ID.test(snapshot.idempotencyKey)
    ) throw disabled(status);
    return snapshot;
  };
  const mapError = (error, snapshot) => {
    const exact = `${typeof error?.code === 'string' ? error.code : ''}/${
      typeof error?.message === 'string' ? error.message : ''}`;
    if (exact === 'P1601/LOR_MENTOR_ASSIGNMENT_COMMAND_DENIED') {
      return new AuthorizationDeniedError('DATABASE_MENTOR_ASSIGNMENT_COMMAND_DENIED');
    }
    if (
      exact === 'P1602/LOR_MENTOR_IDEMPOTENCY_CONFLICT'
      || exact === 'P1604/LOR_MENTOR_ASSIGNMENT_ALREADY_ACTIVE'
    ) return new IdempotencyConflictError({ idempotencyKey: snapshot.idempotencyKey });
    if (exact === 'P1603/LOR_MENTOR_ASSIGNMENT_NOT_FOUND') {
      return new NotFoundError('mentor_assignment', snapshot.assignmentId);
    }
    return disabled('ATOMIC_MENTOR_ASSIGNMENT_TRANSACTION_FAILED');
  };
  return Object.freeze({
    serverOnly: true,
    rlsEnforced: true,
    databaseClock: true,
    atomicMentorAssignmentCommands: true,
    async assignMentorCaseAtomic(rawCommand) {
      assertHealthy();
      const snapshot = command(
        rawCommand,
        ASSIGN_MENTOR_COMMAND_KEYS,
        'MENTOR_ASSIGNMENT_COMMAND_INVALID',
      );
      if (
        !SUBJECT.test(snapshot.mentorAuthSubject ?? '')
        || snapshot.mentorAuthSubject === snapshot.studentAuthSubject
        || typeof snapshot.purpose !== 'string'
        || snapshot.purpose.length < 1
        || snapshot.purpose.length > 160
        || snapshot.purpose.trim() !== snapshot.purpose
        || /[\u0000-\u001f\u007f]/u.test(snapshot.purpose)
        || !Number.isSafeInteger(snapshot.maximumLifetimeSeconds)
        || snapshot.maximumLifetimeSeconds < 300
        || snapshot.maximumLifetimeSeconds > 15_552_000
      ) throw disabled('MENTOR_ASSIGNMENT_COMMAND_INVALID');
      try {
        return await executeRuntimeCommand(
          executor,
          [
            '', 'service:lor-mentor-assignment-operator-v1', 'service',
            snapshot.studentAuthSubject, snapshot.caseId, 'assign_mentor_case',
            'mentor_assignment_administration', '', '', '', 'true', 'true', 'true',
            'lor-mentor-assignment-operator-v1', 'true',
          ],
          'lor_runtime_assign_mentor_to_case',
          ASSIGN_MENTOR_SQL,
          [
            snapshot.caseId, snapshot.studentAuthSubject, snapshot.mentorAuthSubject,
            snapshot.purpose, snapshot.maximumLifetimeSeconds, snapshot.idempotencyKey,
          ],
          'MENTOR_ASSIGNMENT_RECEIPT_INVALID',
        );
      } catch (error) {
        if (
          error instanceof AuthorizationDeniedError
          || error instanceof IdempotencyConflictError
          || error instanceof NotFoundError
        ) throw error;
        throw mapError(error, snapshot);
      }
    },
    async revokeMentorCaseAssignmentAtomic(rawCommand) {
      assertHealthy();
      const snapshot = command(
        rawCommand,
        REVOKE_MENTOR_COMMAND_KEYS,
        'MENTOR_REVOCATION_COMMAND_INVALID',
      );
      if (
        !/^mentor_service_assignment_[a-f0-9]{64}$/u.test(snapshot.assignmentId ?? '')
        || !/^[A-Z0-9_:-]{1,120}$/u.test(snapshot.reasonCode ?? '')
      ) throw disabled('MENTOR_REVOCATION_COMMAND_INVALID');
      try {
        return await executeRuntimeCommand(
          executor,
          [
            '', 'service:lor-mentor-assignment-operator-v1', 'service',
            snapshot.studentAuthSubject, snapshot.caseId, 'revoke_mentor_assignment',
            'mentor_assignment_administration', '', snapshot.assignmentId, '',
            'true', 'true', 'true', 'lor-mentor-assignment-operator-v1', 'true',
          ],
          'lor_runtime_revoke_mentor_case_assignment',
          REVOKE_MENTOR_SQL,
          [
            snapshot.caseId, snapshot.studentAuthSubject, snapshot.assignmentId,
            snapshot.reasonCode, snapshot.idempotencyKey,
          ],
          'MENTOR_REVOCATION_RECEIPT_INVALID',
        );
      } catch (error) {
        if (
          error instanceof AuthorizationDeniedError
          || error instanceof IdempotencyConflictError
          || error instanceof NotFoundError
        ) throw error;
        throw mapError(error, snapshot);
      }
    },
  });
}

function driverFacade(driver, executor, binding, isHealthy) {
  const targetBindingHash = hashValue(binding);
  const assertHealthy = () => {
    if (!isHealthy()) throw disabled('RUNTIME_DATABASE_UNAVAILABLE');
  };
  const invitationCommand = (rawCommand, keys, status, scopeField = 'scope') => {
    const command = exactDataSnapshot(rawCommand, keys, status);
    assertBindingMatch(command.binding, binding, status);
    if (!identifier(command.caseId) || !boundedKey(command.idempotencyKey)
      || !digest(command.requestHash)) throw disabled(status);
    command[scopeField] = commandScope(
      command[scopeField],
      { actorRole: 'student', caseId: command.caseId, operation: 'save' },
      status,
    );
    return command;
  };
  const aiCommand = (rawCommand, keys, operation, status) => {
    const command = exactDataSnapshot(rawCommand, keys, status);
    assertBindingMatch(command.binding, binding, status);
    if (command.schemaVersion !== AI_COMMAND_SCHEMA || command.operation !== operation
      || !identifier(command.caseId) || !identifier(command.proposalId)
      || command.targetBindingHash !== targetBindingHash || !digest(command.scopeHash)) {
      throw disabled(status);
    }
    const scopeOperation = operation === 'get_proposal' ? 'read' : 'save';
    command.scope = commandScope(
      command.scope,
      { actorRole: 'faculty', caseId: command.caseId, operation: scopeOperation },
      status,
    );
    if (command.scopeHash !== hashValue(command.scope)) throw disabled(status);
    if (operation !== 'get_proposal') {
      if (!boundedKey(command.idempotencyKey, 200) || !digest(command.requestHash)
        || !digest(command.recordHash) || !digest(command.providerRunHash)
        || !digest(command.outputHash)) throw disabled(status);
      command.record = inertJsonClone(command.record, status);
      if (command.record.caseId !== command.caseId || command.record.id !== command.proposalId) {
        throw disabled(status);
      }
      if (operation === 'put_proposal') {
        if (command.expectedState !== 'absent_or_same_idempotency'
          || command.expectedOutputHash !== null || command.expectedDecisionHash !== null
          || command.decisionHash !== null || command.acceptedContentHash !== null) {
          throw disabled(status);
        }
      } else if (command.expectedState !== 'proposal'
        || command.expectedOutputHash !== command.outputHash
        || command.expectedDecisionHash !== null || !digest(command.decisionHash)
        || (command.acceptedContentHash !== null && !digest(command.acceptedContentHash))) {
        throw disabled(status);
      }
    }
    return command;
  };
  const aiReservationCommand = (rawCommand, operation, status) => {
    const command = exactDataSnapshot(rawCommand, AI_RESERVATION_COMMAND_KEYS, status);
    assertBindingMatch(command.binding, binding, status);
    if (command.schemaVersion !== AI_COMMAND_SCHEMA || command.operation !== operation
      || !['reserve_generation', 'mark_generation_unknown'].includes(operation)
      || !identifier(command.caseId) || !boundedKey(command.idempotencyKey, 200)
      || !digest(command.requestHash) || command.targetBindingHash !== targetBindingHash
      || !digest(command.scopeHash)) {
      throw disabled(status);
    }
    command.scope = commandScope(
      command.scope,
      { actorRole: 'faculty', caseId: command.caseId, operation: 'save' },
      status,
    );
    if (command.scopeHash !== hashValue(command.scope)) throw disabled(status);
    return command;
  };
  const artifactAuditCommand = (rawCommand) => {
    const status = 'ARTIFACT_AUDIT_COMMAND_INVALID';
    const command = exactDataSnapshot(rawCommand, ARTIFACT_AUDIT_COMMAND_KEYS, status);
    assertBindingMatch(command.binding, binding, status);
    command.event = inertJsonClone(command.event, status);
    if (command.schemaVersion !== ARTIFACT_AUDIT_COMMAND_SCHEMA
      || command.targetBindingHash !== targetBindingHash
      || !digest(command.targetBindingHash)
      || !identifier(command.caseId)
      || !digest(command.scopeHash)
      || !digest(command.eventHash)
      || !exactKeys(command.event, ARTIFACT_AUDIT_EVENT_KEYS)
      || command.event.schemaVersion !== 1
      || !UUID.test(command.event.eventId ?? '')
      || !['student', 'faculty'].includes(command.event.actorRole)
      || !['artifact.generated', 'artifact.denied'].includes(command.event.type)
      || (command.event.type === 'artifact.generated' && command.event.outcome !== 'success')
      || (command.event.type === 'artifact.denied' && command.event.outcome !== 'denied')
      || !/^[a-f0-9]{24}$/u.test(command.event.actorRef ?? '')
      || !/^[a-f0-9]{24}$/u.test(command.event.caseRef ?? '')
      || (command.event.targetRef !== ''
        && !/^[a-f0-9]{24}$/u.test(command.event.targetRef ?? ''))
      || !validTime(command.event.at)
      || !plain(command.event.metadata)) {
      throw disabled(status);
    }
    const metadata = command.event.metadata;
    const metadataValid = command.event.type === 'artifact.generated'
      ? exactKeys(metadata, ARTIFACT_GENERATED_METADATA_KEYS)
        && metadata.action === 'export_final_document'
        && metadata.artifactFormat === 'docx'
        && metadata.result === (command.event.actorRole === 'student'
          ? 'student_visible'
          : 'faculty_owner')
        && digest(metadata.artifactSha256)
        && (command.event.actorRole === 'student'
          ? digest(metadata.releaseDocumentHash)
          : (metadata.releaseDocumentHash === null || digest(metadata.releaseDocumentHash)))
        && Number.isSafeInteger(metadata.sourceRevision)
        && Number(metadata.sourceRevision) >= 0
      : exactKeys(metadata, ARTIFACT_DENIED_METADATA_KEYS)
        && metadata.action === 'export_final_document'
        && metadata.artifactFormat === 'docx'
        && typeof metadata.reasonCode === 'string'
        && /^[A-Z0-9_:-]{1,120}$/u.test(metadata.reasonCode);
    if (!metadataValid) throw disabled(status);
    command.scope = commandScope(
      command.scope,
      { actorRole: command.event.actorRole, caseId: command.caseId, operation: 'read' },
      status,
    );
    if (command.event.actorRef !== sha256(
      `lor-studio:actor:${command.scope.actorId}`,
    ).slice(0, 24)
      || command.event.caseRef !== sha256(`lor-studio:case:${command.caseId}`).slice(0, 24)
      || command.scopeHash !== hashValue(command.scope)
      || command.eventHash !== hashValue(command.event)) {
      throw disabled(status);
    }
    return command;
  };
  const privateStorageCommand = (rawCommand, expectedKeys, status) => {
    const command = exactDataSnapshot(rawCommand, expectedKeys, status);
    let context;
    try { context = readTrustedRequestContext(); } catch {
      throw disabled('TRUSTED_REQUEST_CONTEXT_REQUIRED');
    }
    if (
      command.actorId !== context.authenticatedSubject
      || command.actorRole !== context.actorRole
      || !['student', 'faculty'].includes(command.actorRole)
      || !identifier(command.caseId)
      || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$/u.test(command.objectId ?? '')
      || !boundedKey(command.objectKey, 1_024)
      || !['student_prepared', 'faculty_private', 'released_final', 'structural_waiver_material']
        .includes(command.contentClass)
      || !['case_workflow', 'faculty_review', 'final_delivery', 'privacy_request', 'restore_rehearsal']
        .includes(command.purpose)
      || !/^capability_[a-f0-9]{64}$/u.test(command.capabilityId ?? '')
      || !/^evidence_[a-f0-9]{64}$/u.test(command.evidenceId ?? '')
      || !boundedKey(command.storageIdentity, 300)
    ) throw disabled(status);
    return command;
  };
  const mapPrivateStorageDatabaseError = (error, command) => {
    const exact = `${typeof error?.code === 'string' ? error.code : ''}/${
      typeof error?.message === 'string' ? error.message : ''}`;
    if (exact === 'P1501/LOR_PRIVATE_STORAGE_AUTHORIZATION_DENIED') {
      return new AuthorizationDeniedError('DATABASE_PRIVATE_STORAGE_DENIED');
    }
    if (exact === 'P1502/LOR_PRIVATE_STORAGE_IDEMPOTENCY_CONFLICT') {
      return new IdempotencyConflictError({ idempotencyKey: command.idempotencyKey });
    }
    if (exact === 'P1503/LOR_PRIVATE_STORAGE_NOT_FOUND'
      || exact === 'P1503/LOR_PRIVATE_STORAGE_RELEASE_NOT_FOUND') {
      return new NotFoundError('private_artifact_version', command.versionId ?? command.objectId);
    }
    return disabled('ATOMIC_PRIVATE_STORAGE_COMMAND_FAILED');
  };
  const facade = {
    atomicStateAndAudit: true,
    rlsEnforced: true,
    serverOnly: true,
    actorSafeCommands: true,
    databaseClock: true,
    actorSafeReads: true,
    atomicProviderCallReservation: true,
    atomicFacultyInvitationCommands: true,
    atomicFacultyCandidateHandoffs: true,
    atomicProviderRunAndProposal: true,
    conditionalAtomicOneDecision: true,
    appendOnlyArtifactAudit: true,
    encryptedPrivateStorageCommands: true,
  };
  for (const name of [
    'selectCase', 'executeAtomicCaseCommand', 'readStudentSafeCase',
    'readFacultyCaseProjection', 'readFacultyDraftingContext',
    'readMentorCaseProjection', 'reserveCaseCreation',
    'readFinalDocumentExport',
    'commitStudentCaseCreate', 'commitStudentBuilderAutosave', 'commitStudentBuilderComplete',
    'commitStudentConsentReceipt', 'commitStudentWaiverReceipt',
    'commitStudentEvidencePublication',
    'commitFacultyPrivateContent',
    'commitFacultyFinalDocumentRelease',
  ]) {
    facade[name] = (...args) => {
      assertHealthy();
      return driver[name](...args);
    };
  }
  facade.issueFacultyInvitationAtomic = async (rawCommand) => {
    assertHealthy();
    const command = invitationCommand(
      rawCommand,
      ISSUE_INVITATION_COMMAND_KEYS,
      'ISSUE_FACULTY_INVITATION_COMMAND_INVALID',
    );
    if (command.actorId !== command.scope.actorId
      || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0
      || !identifier(command.invitationId) || !digest(command.recipientEmailHash)
      || !digest(command.tokenHash) || !identifier(command.challengeId)
      || !digest(command.otpCodeHash) || !validTime(command.invitationExpiresAt)
      || !validTime(command.challengeExpiresAt)
      || !Number.isSafeInteger(command.maxAttempts) || command.maxAttempts < 1
      || command.maxAttempts > 20 || !Number.isSafeInteger(command.attemptWindowMs)
      || command.attemptWindowMs < 1_000 || command.attemptWindowMs > 86_400_000
      || !Number.isSafeInteger(command.lockoutMs) || command.lockoutMs < 1_000
      || command.lockoutMs > 86_400_000) {
      throw disabled('ISSUE_FACULTY_INVITATION_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { operation: 'issue_faculty_invitation' }),
        'lor_runtime_issue_faculty_invitation',
        ISSUE_INVITATION_SQL,
        [
          command.caseId, command.expectedRevision, command.invitationId,
          command.recipientEmailHash, command.tokenHash, command.challengeId,
          command.otpCodeHash, command.invitationExpiresAt, command.challengeExpiresAt,
          command.maxAttempts, command.attemptWindowMs, command.lockoutMs,
          command.idempotencyKey, command.requestHash,
        ],
        'ISSUE_FACULTY_INVITATION_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.resendFacultyInvitationOtpAtomic = async (rawCommand) => {
    assertHealthy();
    const command = invitationCommand(
      rawCommand,
      RESEND_INVITATION_COMMAND_KEYS,
      'RESEND_FACULTY_INVITATION_COMMAND_INVALID',
    );
    if (command.actorId !== command.scope.actorId || !digest(command.recipientEmailHash)
      || !identifier(command.challengeId) || !digest(command.otpCodeHash)
      || !validTime(command.challengeExpiresAt)) {
      throw disabled('RESEND_FACULTY_INVITATION_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { operation: 'resend_faculty_invitation_otp' }),
        'lor_runtime_resend_faculty_invitation_otp',
        RESEND_INVITATION_SQL,
        [command.caseId, command.recipientEmailHash, command.challengeId, command.otpCodeHash,
          command.challengeExpiresAt, command.idempotencyKey, command.requestHash],
        'RESEND_FACULTY_INVITATION_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.revokeFacultyInvitationAtomic = async (rawCommand) => {
    assertHealthy();
    const command = invitationCommand(
      rawCommand,
      REVOKE_INVITATION_COMMAND_KEYS,
      'REVOKE_FACULTY_INVITATION_COMMAND_INVALID',
    );
    if (command.actorId !== command.scope.actorId) {
      throw disabled('REVOKE_FACULTY_INVITATION_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { operation: 'revoke_faculty_invitation' }),
        'lor_runtime_revoke_faculty_invitation',
        REVOKE_INVITATION_SQL,
        [command.caseId, command.idempotencyKey, command.requestHash],
        'REVOKE_FACULTY_INVITATION_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.commitFacultyInvitationDeliveryAtomic = async (rawCommand) => {
    assertHealthy();
    const command = invitationCommand(
      rawCommand,
      DELIVERY_INVITATION_COMMAND_KEYS,
      'FACULTY_INVITATION_DELIVERY_COMMAND_INVALID',
      'studentScope',
    );
    if (!identifier(command.invitationId) || !digest(command.providerMessageRefHash)) {
      throw disabled('FACULTY_INVITATION_DELIVERY_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.studentScope, {
          actorRole: 'service',
          operation: 'commit_faculty_invitation_delivery',
          purpose: 'faculty_invitation_delivery',
          invitationId: command.invitationId,
          trustedServiceActor: 'postmark-delivery-v1',
        }),
        'lor_runtime_commit_faculty_invitation_delivery',
        DELIVERY_INVITATION_SQL,
        [command.caseId, command.invitationId, command.providerMessageRefHash,
          command.idempotencyKey, command.requestHash],
        'FACULTY_INVITATION_DELIVERY_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.reserveFacultyInvitationDeliveryAtomic = async (rawCommand) => {
    assertHealthy();
    const command = invitationCommand(
      rawCommand,
      RESERVE_DELIVERY_INVITATION_COMMAND_KEYS,
      'FACULTY_INVITATION_DELIVERY_RESERVATION_COMMAND_INVALID',
      'studentScope',
    );
    if (
      !identifier(command.invitationId)
      || !['issue', 'resend'].includes(command.deliveryAction)
    ) {
      throw disabled('FACULTY_INVITATION_DELIVERY_RESERVATION_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.studentScope, {
          actorRole: 'service',
          operation: 'reserve_faculty_invitation_delivery',
          purpose: 'faculty_invitation_delivery',
          invitationId: command.invitationId,
          trustedServiceActor: 'postmark-delivery-v1',
        }),
        'lor_runtime_reserve_faculty_invitation_delivery',
        RESERVE_DELIVERY_INVITATION_SQL,
        [command.caseId, command.invitationId, command.deliveryAction,
          command.idempotencyKey, command.requestHash],
        'FACULTY_INVITATION_DELIVERY_RESERVATION_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.markFacultyInvitationDeliveryUnknownAtomic = async (rawCommand) => {
    assertHealthy();
    const command = invitationCommand(
      rawCommand,
      UNKNOWN_DELIVERY_INVITATION_COMMAND_KEYS,
      'FACULTY_INVITATION_DELIVERY_UNKNOWN_COMMAND_INVALID',
      'studentScope',
    );
    if (!identifier(command.invitationId)) {
      throw disabled('FACULTY_INVITATION_DELIVERY_UNKNOWN_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.studentScope, {
          actorRole: 'service',
          operation: 'mark_faculty_invitation_delivery_unknown',
          purpose: 'faculty_invitation_delivery',
          invitationId: command.invitationId,
          trustedServiceActor: 'postmark-delivery-v1',
        }),
        'lor_runtime_mark_faculty_invitation_delivery_unknown',
        UNKNOWN_DELIVERY_INVITATION_SQL,
        [command.caseId, command.invitationId, 'unknown',
          command.idempotencyKey, command.requestHash],
        'FACULTY_INVITATION_DELIVERY_UNKNOWN_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.verifyFacultyInvitationAtomic = async (rawCommand) => {
    assertHealthy();
    const command = exactDataSnapshot(
      rawCommand,
      VERIFY_INVITATION_COMMAND_KEYS,
      'VERIFY_FACULTY_INVITATION_COMMAND_INVALID',
    );
    assertBindingMatch(
      command.binding,
      binding,
      'VERIFY_FACULTY_INVITATION_COMMAND_INVALID',
    );
    if (!identifier(command.invitationId) || !digest(command.recipientEmailHash)
      || !digest(command.tokenHash) || !/^[0-9]{6}$/u.test(command.otpCode ?? '')
      || !boundedKey(command.idempotencyKey) || !digest(command.requestHash)) {
      throw new InvitationDeniedError();
    }
    command.candidateScope = candidateCommandScope(
      command.candidateScope,
      command.invitationId,
      'VERIFY_FACULTY_INVITATION_COMMAND_INVALID',
    );
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.candidateScope, {
          resourceStudentId: '',
          caseId: '',
          invitationId: command.invitationId,
        }),
        'lor_runtime_verify_faculty_invitation',
        VERIFY_INVITATION_SQL,
        [command.invitationId, command.recipientEmailHash, command.tokenHash, command.otpCode,
          command.idempotencyKey, command.requestHash],
        'VERIFY_FACULTY_INVITATION_RECEIPT_INVALID',
      );
    } catch (error) { throw mapInvitationDatabaseError(error, command); }
  };
  facade.reserveFacultyCandidateAuthHandoffAtomic = async (rawCommand) => {
    assertHealthy();
    const command = exactDataSnapshot(
      rawCommand,
      RESERVE_CANDIDATE_HANDOFF_COMMAND_KEYS,
      'RESERVE_FACULTY_CANDIDATE_HANDOFF_COMMAND_INVALID',
    );
    assertBindingMatch(
      command.binding,
      binding,
      'RESERVE_FACULTY_CANDIDATE_HANDOFF_COMMAND_INVALID',
    );
    if (
      !identifier(command.invitationId)
      || !digest(command.tokenHash)
      || !digest(command.flowNonceHash)
      || !Number.isSafeInteger(command.maximumLifetimeSeconds)
      || command.maximumLifetimeSeconds < 60
      || command.maximumLifetimeSeconds > 900
    ) throw new InvitationDeniedError();
    try {
      return await executeRuntimeCommand(
        executor,
        [
          '', '', 'service', '', '', 'reserve_faculty_candidate_auth_handoff',
          'faculty_candidate_auth', command.invitationId, '', '', 'false', 'true', 'true',
          'lor-candidate-auth-v1', 'true',
        ],
        'lor_runtime_reserve_faculty_candidate_auth_handoff',
        RESERVE_CANDIDATE_HANDOFF_SQL,
        [
          command.invitationId,
          command.tokenHash,
          command.flowNonceHash,
          command.maximumLifetimeSeconds,
        ],
        'RESERVE_FACULTY_CANDIDATE_HANDOFF_RECEIPT_INVALID',
      );
    } catch (error) {
      if (error instanceof InvitationDeniedError) throw error;
      throw mapCandidateHandoffDatabaseError(error);
    }
  };
  facade.redeemFacultyCandidateAuthHandoffAtomic = async (rawCommand) => {
    assertHealthy();
    const command = exactDataSnapshot(
      rawCommand,
      REDEEM_CANDIDATE_HANDOFF_COMMAND_KEYS,
      'REDEEM_FACULTY_CANDIDATE_HANDOFF_COMMAND_INVALID',
    );
    assertBindingMatch(
      command.binding,
      binding,
      'REDEEM_FACULTY_CANDIDATE_HANDOFF_COMMAND_INVALID',
    );
    if (
      !identifier(command.invitationId)
      || !digest(command.tokenHash)
      || !digest(command.flowNonceHash)
      || !SUBJECT.test(command.authenticatedSubject ?? '')
      || !validTime(command.issuedAt)
      || !validTime(command.expiresAt)
      || new Date(command.issuedAt).toISOString() !== command.issuedAt
      || new Date(command.expiresAt).toISOString() !== command.expiresAt
      || Date.parse(command.expiresAt) <= Date.parse(command.issuedAt)
      || Date.parse(command.expiresAt) - Date.parse(command.issuedAt) > 900_000
    ) throw new InvitationDeniedError();
    try {
      return await executeRuntimeCommand(
        executor,
        [
          '', command.authenticatedSubject, 'service', '', '',
          'redeem_faculty_candidate_auth_handoff', 'faculty_candidate_auth',
          command.invitationId, '', '', 'false', 'true', 'true',
          'lor-candidate-auth-v1', 'true',
        ],
        'lor_runtime_redeem_faculty_candidate_auth_handoff',
        REDEEM_CANDIDATE_HANDOFF_SQL,
        [
          command.invitationId,
          command.tokenHash,
          command.flowNonceHash,
          command.authenticatedSubject,
          command.issuedAt,
          command.expiresAt,
        ],
        'REDEEM_FACULTY_CANDIDATE_HANDOFF_RECEIPT_INVALID',
      );
    } catch (error) {
      if (error instanceof InvitationDeniedError) throw error;
      throw mapCandidateHandoffDatabaseError(error);
    }
  };
  const transitionAiGeneration = async (rawCommand, operation, statementId, invalidStatus) => {
    assertHealthy();
    const command = aiReservationCommand(rawCommand, operation, invalidStatus);
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { trustedServiceActor: 'lor-ai-proposal-store-v1' }),
        statementId,
        TRANSITION_AI_GENERATION_SQL,
        [command.caseId, command.idempotencyKey, command.requestHash,
          command.scopeHash, command.targetBindingHash, command.operation],
        'AI_GENERATION_RESERVATION_RECEIPT_INVALID',
      );
    } catch (error) {
      const receipt = aiReservationErrorReceipt(error, command);
      if (receipt) return receipt;
      throw disabled('ATOMIC_AI_GENERATION_RESERVATION_FAILED');
    }
  };
  facade.reserveAiProposalGenerationAtomic = (rawCommand) => transitionAiGeneration(
    rawCommand,
    'reserve_generation',
    'lor_runtime_reserve_ai_proposal_generation',
    'RESERVE_AI_GENERATION_COMMAND_INVALID',
  );
  facade.markAiProposalGenerationUnknownAtomic = (rawCommand) => transitionAiGeneration(
    rawCommand,
    'mark_generation_unknown',
    'lor_runtime_mark_ai_proposal_generation_unknown',
    'MARK_AI_GENERATION_UNKNOWN_COMMAND_INVALID',
  );
  facade.persistProviderRunAndProposalAtomic = async (rawCommand) => {
    assertHealthy();
    const command = aiCommand(
      rawCommand,
      AI_WRITE_COMMAND_KEYS,
      'put_proposal',
      'PERSIST_AI_PROPOSAL_COMMAND_INVALID',
    );
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { trustedServiceActor: 'lor-ai-proposal-store-v1' }),
        'lor_runtime_persist_ai_provider_run_and_proposal',
        PERSIST_AI_PROPOSAL_SQL,
        [command.caseId, command.proposalId, command.idempotencyKey, command.requestHash,
          command.scopeHash, command.targetBindingHash, command.recordHash,
          command.providerRunHash, command.outputHash, command.record],
        'PERSIST_AI_PROPOSAL_RECEIPT_INVALID',
      );
    } catch (error) {
      const receipt = aiErrorReceipt(error, command);
      if (receipt) return receipt;
      throw disabled('ATOMIC_AI_PROPOSAL_TRANSACTION_FAILED');
    }
  };
  facade.readActorSafeAiProposal = async (rawCommand) => {
    assertHealthy();
    const command = aiCommand(
      rawCommand,
      AI_READ_COMMAND_KEYS,
      'get_proposal',
      'READ_AI_PROPOSAL_COMMAND_INVALID',
    );
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { trustedServiceActor: 'lor-ai-proposal-store-v1' }),
        'lor_runtime_read_actor_safe_ai_proposal',
        READ_AI_PROPOSAL_SQL,
        [command.caseId, command.proposalId, command.scopeHash, command.targetBindingHash],
        'READ_AI_PROPOSAL_RECEIPT_INVALID',
      );
    } catch { throw disabled('ACTOR_SAFE_AI_PROPOSAL_READ_FAILED'); }
  };
  facade.attachDecisionIfUndecidedAtomic = async (rawCommand) => {
    assertHealthy();
    const command = aiCommand(
      rawCommand,
      AI_WRITE_COMMAND_KEYS,
      'attach_decision',
      'ATTACH_AI_DECISION_COMMAND_INVALID',
    );
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope, { trustedServiceActor: 'lor-ai-proposal-store-v1' }),
        'lor_runtime_attach_ai_proposal_decision',
        ATTACH_AI_DECISION_SQL,
        [command.caseId, command.proposalId, command.idempotencyKey, command.requestHash,
          command.scopeHash, command.targetBindingHash, command.recordHash,
          command.providerRunHash, command.outputHash, command.decisionHash,
          command.acceptedContentHash, command.record],
        'ATTACH_AI_DECISION_RECEIPT_INVALID',
      );
    } catch (error) {
      const receipt = aiErrorReceipt(error, command);
      if (receipt) return receipt;
      throw disabled('ATOMIC_AI_DECISION_TRANSACTION_FAILED');
    }
  };
  facade.putEncryptedPrivateArtifactAtomic = async (rawCommand) => {
    assertHealthy();
    const command = privateStorageCommand(
      rawCommand,
      PRIVATE_STORAGE_PUT_COMMAND_KEYS,
      'PRIVATE_STORAGE_PUT_COMMAND_INVALID',
    );
    if (
      !digest(command.aadHash)
      || !digest(command.checksum)
      || !digest(command.requestHash)
      || !boundedKey(command.contentType, 160)
      || !boundedKey(command.idempotencyKey, 200)
      || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/u.test(command.keyVersion ?? '')
      || !Number.isSafeInteger(command.byteLength)
      || command.byteLength < 1
      || command.byteLength > 52_428_800
      || !boundedKey(command.hkdfSaltBase64, 64)
      || !boundedKey(command.ivBase64, 32)
      || !boundedKey(command.authTagBase64, 32)
      || !boundedKey(command.ciphertextBase64, 80_000_000)
    ) throw disabled('PRIVATE_STORAGE_PUT_COMMAND_INVALID');
    try {
      return await executeRuntimeCommand(
        executor,
        [
          '', command.actorId, 'service', '', command.caseId,
          'read', 'actor_case_access_resolution', '', '', '',
          'true', 'true', 'true', 'actor-access-v1', 'true',
        ],
        'lor_runtime_put_encrypted_private_artifact',
        PUT_ENCRYPTED_PRIVATE_ARTIFACT_SQL,
        [
          command.actorId, command.actorRole, command.caseId, command.objectId,
          command.objectKey, command.contentClass, command.purpose, command.contentType,
          command.checksum, command.byteLength, command.idempotencyKey, command.requestHash,
          command.storageIdentity, command.keyVersion, command.capabilityId, command.evidenceId,
          command.hkdfSaltBase64, command.ivBase64, command.authTagBase64,
          command.ciphertextBase64, command.aadHash,
        ],
        'PRIVATE_STORAGE_PUT_RECEIPT_INVALID',
      );
    } catch (error) {
      throw mapPrivateStorageDatabaseError(error, command);
    }
  };
  facade.getEncryptedPrivateArtifactAtomic = async (rawCommand) => {
    assertHealthy();
    const command = privateStorageCommand(
      rawCommand,
      PRIVATE_STORAGE_GET_COMMAND_KEYS,
      'PRIVATE_STORAGE_GET_COMMAND_INVALID',
    );
    if (!/^version_[a-f0-9]{64}$/u.test(command.versionId ?? '')) {
      throw disabled('PRIVATE_STORAGE_GET_COMMAND_INVALID');
    }
    try {
      return await executeRuntimeCommand(
        executor,
        [
          '', command.actorId, 'service', '', command.caseId,
          'read', 'actor_case_access_resolution', '', '', '',
          'true', 'true', 'true', 'actor-access-v1', 'true',
        ],
        'lor_runtime_get_encrypted_private_artifact',
        GET_ENCRYPTED_PRIVATE_ARTIFACT_SQL,
        [
          command.actorId, command.actorRole, command.caseId, command.objectId,
          command.versionId, command.objectKey, command.contentClass, command.purpose,
          command.storageIdentity, command.capabilityId, command.evidenceId,
        ],
        'PRIVATE_STORAGE_GET_RECEIPT_INVALID',
      );
    } catch (error) {
      throw mapPrivateStorageDatabaseError(error, command);
    }
  };
  facade.appendArtifactExportAuditAtomic = async (rawCommand) => {
    assertHealthy();
    const command = artifactAuditCommand(rawCommand);
    try {
      return await executeRuntimeCommand(
        executor,
        gucValues(command.scope),
        'lor_runtime_append_artifact_export_audit',
        APPEND_ARTIFACT_AUDIT_SQL,
        [command.event, command.eventHash, command.scopeHash, command.targetBindingHash],
        'ARTIFACT_AUDIT_RECEIPT_INVALID',
      );
    } catch (error) {
      if (error?.code === 'P1002') {
        throw new IdempotencyConflictError({ idempotencyKey: command.event.eventId });
      }
      if (error?.code === 'P1004') {
        throw new AuthorizationDeniedError('DATABASE_ARTIFACT_AUDIT_DENIED');
      }
      throw disabled('ATOMIC_ARTIFACT_AUDIT_FAILED');
    }
  };
  return Object.freeze(facade);
}

export function createProductionPostgresRuntimeDependencies(rawBinding, rawOptions = {}) {
  const options = descriptorSnapshot(rawOptions, OPTION_KEYS);
  const binding = validateBinding(rawBinding);
  const environment = Object.hasOwn(options, 'environment') ? options.environment : process.env;
  const target = resolveProductionRuntimeTarget(binding, environment);
  const catalog = binding.environment === 'production' ? PRODUCTION_CATALOG : STAGING_CATALOG;
  const PoolClass = Object.hasOwn(options, 'PoolClass') ? options.PoolClass : Pool;
  if (typeof PoolClass !== 'function') throw disabled('POOL_CLASS_INVALID');
  const { ca, connectionString } = runtimeConfiguration(environment, target);
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
    let closed = false;
    let circuitState = 'ready';
    const health = Object.freeze({
      isReady: () => !closed && circuitState === 'ready',
      mayProbe: () => !closed,
      markReady: () => {
        if (!closed) circuitState = 'ready';
      },
      markUnavailable: () => {
        if (!closed) circuitState = 'probe_required';
      },
    });
    poolErrorListener = () => { health.markUnavailable(); };
    pool.on('error', poolErrorListener);
    const isHealthy = health.isReady;
    const executor = createNodePostgresExecutor({ pool, databaseRole: NODE_POSTGRES_DATABASE_ROLE });
    const driver = createAtomicRlsCaseDriver({ binding, executor });
    const mentorAssignmentRepository = new SupabaseDurableMentorAssignmentRepository({
      binding,
      driver: mentorAssignmentCommandDriverFor(executor, binding, isHealthy),
    });
    const mentorAssignmentOperator = createDurableMentorAssignmentOperator({
      repository: mentorAssignmentRepository,
    });
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
      driver: driverFacade(driver, executor, binding, isHealthy),
      scopeProvider: scopeProviderFor(executor, isHealthy),
      candidateScopeProvider: candidateScopeProviderFor(isHealthy),
      actorResolver: actorResolverFor(executor, isHealthy),
      mentorAssignmentOperator,
      readiness: readinessFor(executor, health, target, catalog, pool), close,
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
  runtimeLogin: PRODUCTION_RUNTIME_TARGET_CONTRACT.runtimeLogin,
  applicationRole: APP_ROLE, relationCount: RELATIONS.length, securityDefinerCount: DEFINERS.length,
  appExecutableSecurityDefinerCount: APP_EXECUTABLE_DEFINERS.length,
  nonAppExecutableSecurityDefiner: DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  successorSentinel: 'derived_from_exact_resolved_runtime_target',
  runtimeTargetSchemaVersion: PRODUCTION_RUNTIME_TARGET_CONTRACT.schemaVersion,
  publicSurface: Object.freeze([
    'driver', 'scopeProvider', 'candidateScopeProvider', 'actorResolver',
    'mentorAssignmentOperator', 'readiness', 'close',
  ]),
  identitySource: 'active_trusted_request_context_only',
  actorRoleSource: 'database_verified_case_access_only',
  tls: 'verified_pinned_railway_root_ca_and_hostname',
  revocationCommand: 'module_private_trusted_service_operator_only',
  idlePoolErrorRecovery: 'fail_closed_until_fresh_authenticated_catalog_reprobe',
});
