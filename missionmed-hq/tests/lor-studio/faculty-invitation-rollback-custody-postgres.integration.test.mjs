import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import pg from 'pg';

import {
  createAtomicRlsCaseDriver,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  NODE_POSTGRES_DATABASE_ROLE,
  createNodePostgresExecutor,
} from '../../lor-studio/adapters/node-postgres-executor.mjs';
import {
  BUILDER_STEPS,
  autosaveStudentSafeBuilderStep,
  completeStudentSafeBuilderStep,
  createStudentSafeRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';
import { createDisposablePostgresHarness } from '../../scripts/lor-studio/postgres-harness.mjs';

const { Pool } = pg;
const RUN_REAL_MATRIX = process.env.LOR_RUN_REAL_POSTGRES_MATRIX === '1';
const TOOLCHAINS = Object.freeze([
  Object.freeze({ major: 16, root: '/opt/homebrew/opt/postgresql@16/bin' }),
  Object.freeze({ major: 18, root: '/opt/homebrew/opt/postgresql@18/bin' }),
]);
const MIGRATION_NAMES = Object.freeze([
  '20260820180700_f2_lor_1012_schema_foundation.sql',
  '20260820180800_f2_lor_1012_rls_projection_grants.sql',
  '20260825010200_f2_lor_1012_identity_scope_commands.sql',
  '20260825010400_f2_lor_1012_faculty_invitation_commands.sql',
]);
const migrationsDirectory = new URL('../../scripts/lor-studio/migrations/', import.meta.url);
const rollbackPath = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010400_f2_lor_1012_faculty_invitation_commands.rollback.sql',
  import.meta.url,
);
const migrationPath = new URL(
  '../../scripts/lor-studio/migrations/20260825010400_f2_lor_1012_faculty_invitation_commands.sql',
  import.meta.url,
);

const CONSENT_CASE_ID = 'case_invitation_consent_custody_0001';
const CONSENT_STUDENT = 'wp:941';
const CONSENT_STUDENT_UID = '94100000-0000-4000-8000-000000000001';
const CONSENT_BINDING_ID = 'binding_invitation_consent_custody_0001';
const CONSENT_BUILDER_SESSION_ID = 'builder_invitation_consent_custody_0001';
const CURRENT_CONSENT_POLICY = 'dr-133-identified-education-record-v1';
const CURRENT_CONSENT_GRANTS = Object.freeze([
  'ai_drafting',
  'builder_autosave',
  'evidence_grounding',
  'faculty_handoff',
]);
const CONSENT_TARGET_BINDING = resolveLorTargetBinding({
  schemaVersion: LOR_TARGET_BINDING_SCHEMA,
  ratified: true,
  decisionRecord: 'DR-133',
  environment: 'staging',
  provider: 'railway-postgres',
  projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
  environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
  serviceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
  databaseName: 'railway',
  region: 'us-west2',
  schema: 'lor_studio',
  migrationLedger: 'lor_studio/migrations/disposable-local',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: false,
});

const INVITATION_FUNCTION_IDENTITIES = Object.freeze([
  'commit_faculty_invitation_delivery(text,text,text,text,text)',
  'enforce_recommendation_case_update()',
  'faculty_context_allows(text,text,text[])',
  'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,bigint,bigint,text,text)',
  'resend_faculty_invitation_otp(text,text,text,text,timestamp with time zone,text,text)',
  'resolve_lor_actor_case_access(text,text)',
  'revoke_faculty_invitation(text,text,text)',
  'verify_faculty_invitation(text,text,text,text,text,text)',
]);

const INVITATION_POLICY_NAMES = Object.freeze([
  'consent_receipts_invitation_command_select',
  'faculty_invitation_command_receipts_command_insert',
  'faculty_invitation_command_receipts_command_select',
  'faculty_invitations_invitation_command_insert',
  'faculty_invitations_invitation_command_select',
  'faculty_invitations_invitation_command_update',
  'faculty_otp_challenge_revocations_invitation_command_insert',
  'faculty_otp_challenge_revocations_invitation_command_select',
  'faculty_otp_challenges_invitation_command_insert',
  'faculty_otp_challenges_invitation_command_select',
  'faculty_otp_proof_revocations_actor_access_select',
  'faculty_otp_verification_receipts_invitation_command_insert',
  'faculty_otp_verification_receipts_invitation_command_select',
  'mentor_case_assignment_revocations_actor_access_select',
  'mentor_case_assignments_actor_access_select',
  'protected_revision_states_invitation_command_insert',
  'protected_revision_states_invitation_command_select',
  'recommendation_case_audit_events_invitation_command_insert',
  'recommendation_case_audit_events_invitation_command_select',
  'recommendation_cases_invitation_command_select',
  'recommendation_cases_invitation_command_update',
  'student_auth_binding_revocations_actor_access_select',
  'student_auth_bindings_actor_access_select',
]);

export const FACULTY_INVITATION_CUSTODY_FINGERPRINT_SQL = String.raw`
WITH role_ids AS (
  SELECT
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user) AS migration_admin_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_command_owner')
      AS command_owner_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_app') AS app_role_oid
),
catalog_rows AS (
  SELECT
    'schema'::text AS category,
    namespace.nspname::text AS identity,
    pg_catalog.jsonb_build_object(
      'owner', CASE
        WHEN namespace.nspowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
        WHEN namespace.nspowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
        WHEN namespace.nspowner = roles.app_role_oid THEN 'APP'
        ELSE pg_catalog.pg_get_userbyid(namespace.nspowner)
      END,
      'aclIsNull', namespace.nspacl IS NULL,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantor', CASE
            WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantor = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantor)
          END,
          'grantee', CASE
            WHEN acl.grantee = 0 THEN 'PUBLIC'
            WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantee = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantee)
          END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
        FROM pg_catalog.aclexplode(namespace.nspacl) AS acl
      ), '[]'::jsonb),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
          AND security_label.objoid = namespace.oid
      ), '[]'::jsonb)
    ) AS definition
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN role_ids AS roles
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'class',
    class.relkind::text || ':' || class.relname,
    pg_catalog.jsonb_build_object(
      'kind', class.relkind,
      'owner', CASE
        WHEN class.relowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
        WHEN class.relowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
        WHEN class.relowner = roles.app_role_oid THEN 'APP'
        ELSE pg_catalog.pg_get_userbyid(class.relowner)
      END,
      'persistence', class.relpersistence,
      'rowSecurity', class.relrowsecurity,
      'forceRowSecurity', class.relforcerowsecurity,
      'replicaIdentity', class.relreplident,
      'isPartition', class.relispartition,
      'hasIndex', class.relhasindex,
      'checks', class.relchecks,
      'hasRules', class.relhasrules,
      'hasTriggers', class.relhastriggers,
      'natts', (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.pg_attribute AS live_attribute
        WHERE live_attribute.attrelid = class.oid
          AND live_attribute.attnum > 0
          AND NOT live_attribute.attisdropped
      ),
      'options', pg_catalog.to_jsonb(class.reloptions),
      'accessMethod', access_method.amname,
      'partitionBound', pg_catalog.pg_get_expr(class.relpartbound, class.oid, true),
      'indexDefinition', CASE WHEN class.relkind = 'i'
        THEN pg_catalog.pg_get_indexdef(class.oid, 0, true) ELSE NULL END,
      'viewDefinition', CASE WHEN class.relkind IN ('v', 'm')
        THEN pg_catalog.pg_get_viewdef(class.oid, true) ELSE NULL END,
      'aclIsNull', class.relacl IS NULL,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantor', CASE
            WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantor = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantor)
          END,
          'grantee', CASE
            WHEN acl.grantee = 0 THEN 'PUBLIC'
            WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantee = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantee)
          END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
        FROM pg_catalog.aclexplode(class.relacl) AS acl
      ), '[]'::jsonb),
      'comment', pg_catalog.obj_description(class.oid, 'pg_class'),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
          AND security_label.objoid = class.oid
          AND security_label.objsubid = 0
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = class.relam
  CROSS JOIN role_ids AS roles
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'column',
    class.relkind::text || ':' || class.relname || '.' ||
      attribute.attnum::text || '.' || attribute.attname,
    pg_catalog.jsonb_build_object(
      'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
      'notNull', attribute.attnotnull,
      'default', pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true),
      'identity', attribute.attidentity,
      'generated', attribute.attgenerated,
      'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
        pg_catalog.format('%I.%I', collation_namespace.nspname, collation_row.collname) END,
      'storage', attribute.attstorage,
      'compression', attribute.attcompression,
      'statistics', attribute.attstattarget,
      'options', pg_catalog.to_jsonb(attribute.attoptions),
      'fdwOptions', pg_catalog.to_jsonb(attribute.attfdwoptions),
      'aclIsNull', attribute.attacl IS NULL,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantor', CASE
            WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantor = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantor)
          END,
          'grantee', CASE
            WHEN acl.grantee = 0 THEN 'PUBLIC'
            WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantee = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantee)
          END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
        FROM pg_catalog.aclexplode(attribute.attacl) AS acl
      ), '[]'::jsonb),
      'comment', pg_catalog.col_description(class.oid, attribute.attnum),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label
        ) ORDER BY security_label.provider)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
          AND security_label.objoid = class.oid
          AND security_label.objsubid = attribute.attnum
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef AS default_value
    ON default_value.adrelid = attribute.attrelid
   AND default_value.adnum = attribute.attnum
  LEFT JOIN pg_catalog.pg_collation AS collation_row
    ON collation_row.oid = attribute.attcollation
  LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
    ON collation_namespace.oid = collation_row.collnamespace
  CROSS JOIN role_ids AS roles
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind IN ('r', 'v', 'm')
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped

  UNION ALL

  SELECT
    'function',
    procedure.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
    pg_catalog.jsonb_build_object(
      'definition', pg_catalog.pg_get_functiondef(procedure.oid),
      'owner', CASE
        WHEN procedure.proowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
        WHEN procedure.proowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
        WHEN procedure.proowner = roles.app_role_oid THEN 'APP'
        ELSE pg_catalog.pg_get_userbyid(procedure.proowner)
      END,
      'aclIsNull', procedure.proacl IS NULL,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'grantor', CASE
            WHEN acl.grantor = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantor = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantor = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantor)
          END,
          'grantee', CASE
            WHEN acl.grantee = 0 THEN 'PUBLIC'
            WHEN acl.grantee = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
            WHEN acl.grantee = roles.command_owner_oid THEN 'COMMAND_OWNER'
            WHEN acl.grantee = roles.app_role_oid THEN 'APP'
            ELSE pg_catalog.pg_get_userbyid(acl.grantee)
          END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable)
        FROM pg_catalog.aclexplode(procedure.proacl) AS acl
      ), '[]'::jsonb),
      'comment', pg_catalog.obj_description(procedure.oid, 'pg_proc'),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          AND security_label.objoid = procedure.oid
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN role_ids AS roles
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'policy',
    class.relname || '.' || policy.polname,
    pg_catalog.jsonb_build_object(
      'command', policy.polcmd,
      'permissive', policy.polpermissive,
      'roles', COALESCE((
        SELECT pg_catalog.jsonb_agg(COALESCE(role.rolname, 'PUBLIC')
          ORDER BY COALESCE(role.rolname, 'PUBLIC'))
        FROM pg_catalog.unnest(policy.polroles) AS policy_role(role_oid)
        LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = policy_role.role_oid
      ), '[]'::jsonb),
      'qualifier', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, true),
      'withCheck', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, true),
      'comment', pg_catalog.obj_description(policy.oid, 'pg_policy'),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_policy'::pg_catalog.regclass
          AND security_label.objoid = policy.oid
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'trigger',
    class.relname || '.' || CASE WHEN trigger.tgisinternal THEN
      'internal:' || COALESCE(constraint_row.conname, '<unbound>') || ':' ||
      function_row.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(function_row.oid) || '):' ||
      trigger.tgtype::text
    ELSE 'user:' || trigger.tgname END,
    pg_catalog.jsonb_build_object(
      'internal', trigger.tgisinternal,
      'enabled', trigger.tgenabled,
      'type', trigger.tgtype,
      'constraint', constraint_row.conname,
      'function', function_row.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(function_row.oid) || ')',
      'definition', CASE WHEN trigger.tgisinternal THEN
        pg_catalog.regexp_replace(
          pg_catalog.pg_get_triggerdef(trigger.oid, true),
          '^CREATE CONSTRAINT TRIGGER [^ ]+',
          'CREATE CONSTRAINT TRIGGER <internal>'
        )
      ELSE pg_catalog.pg_get_triggerdef(trigger.oid, true) END,
      'comment', pg_catalog.obj_description(trigger.oid, 'pg_trigger'),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_trigger'::pg_catalog.regclass
          AND security_label.objoid = trigger.oid
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_trigger AS trigger
  JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  JOIN pg_catalog.pg_proc AS function_row ON function_row.oid = trigger.tgfoid
  LEFT JOIN pg_catalog.pg_constraint AS constraint_row
    ON constraint_row.oid = trigger.tgconstraint
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'constraint',
    COALESCE(class.relname, '<type>') || '.' || constraint_row.contype::text || '.' ||
      constraint_row.conname,
    pg_catalog.jsonb_build_object(
      'type', constraint_row.contype,
      'deferrable', constraint_row.condeferrable,
      'deferred', constraint_row.condeferred,
      'validated', constraint_row.convalidated,
      'noInherit', constraint_row.connoinherit,
      'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
      'comment', pg_catalog.obj_description(constraint_row.oid, 'pg_constraint'),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_constraint'::pg_catalog.regclass
          AND security_label.objoid = constraint_row.oid
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_row.connamespace
  LEFT JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'type',
    type.typtype::text || ':' || type.typname,
    pg_catalog.jsonb_build_object(
      'owner', CASE
        WHEN type.typowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
        WHEN type.typowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
        WHEN type.typowner = roles.app_role_oid THEN 'APP'
        ELSE pg_catalog.pg_get_userbyid(type.typowner)
      END,
      'kind', type.typtype,
      'category', type.typcategory,
      'notNull', type.typnotnull,
      'byValue', type.typbyval,
      'length', type.typlen,
      'alignment', type.typalign,
      'storage', type.typstorage,
      'elementType', CASE WHEN type.typelem = 0 THEN NULL
        ELSE pg_catalog.format_type(type.typelem, NULL) END,
      'arrayType', CASE WHEN type.typarray = 0 THEN NULL
        ELSE pg_catalog.format_type(type.typarray, NULL) END,
      'aclIsNull', type.typacl IS NULL,
      'comment', pg_catalog.obj_description(type.oid, 'pg_type'),
      'securityLabels', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'provider', security_label.provider,
          'label', security_label.label,
          'subId', security_label.objsubid
        ) ORDER BY security_label.provider, security_label.objsubid)
        FROM pg_catalog.pg_seclabel AS security_label
        WHERE security_label.classoid = 'pg_catalog.pg_type'::pg_catalog.regclass
          AND security_label.objoid = type.oid
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_type AS type
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
  CROSS JOIN role_ids AS roles
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'publication_relation',
    publication.pubname || '.' || class.relname,
    pg_catalog.jsonb_build_object(
      'rowFilter', pg_catalog.pg_get_expr(
        publication_relation.prqual,
        publication_relation.prrelid,
        true
      ),
      'columns', COALESCE((
        SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY published.ordinality)
        FROM pg_catalog.unnest(publication_relation.prattrs::smallint[])
          WITH ORDINALITY AS published(attnum, ordinality)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = publication_relation.prrelid
         AND attribute.attnum = published.attnum
      ), '[]'::jsonb)
    )
  FROM pg_catalog.pg_publication_rel AS publication_relation
  JOIN pg_catalog.pg_publication AS publication
    ON publication.oid = publication_relation.prpubid
  JOIN pg_catalog.pg_class AS class ON class.oid = publication_relation.prrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'

  UNION ALL

  SELECT
    'extended_statistics',
    class.relname || '.' || statistics.stxname,
    pg_catalog.jsonb_build_object(
      'owner', CASE
        WHEN statistics.stxowner = roles.migration_admin_oid THEN 'MIGRATION_ADMIN'
        WHEN statistics.stxowner = roles.command_owner_oid THEN 'COMMAND_OWNER'
        WHEN statistics.stxowner = roles.app_role_oid THEN 'APP'
        ELSE pg_catalog.pg_get_userbyid(statistics.stxowner)
      END,
      'target', statistics.stxstattarget,
      'kinds', pg_catalog.to_jsonb(statistics.stxkind),
      'keys', COALESCE((
        SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY statistic_key.ordinality)
        FROM pg_catalog.unnest(statistics.stxkeys::smallint[])
          WITH ORDINALITY AS statistic_key(attnum, ordinality)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = statistics.stxrelid
         AND attribute.attnum = statistic_key.attnum
      ), '[]'::jsonb),
      'definition', pg_catalog.pg_get_statisticsobjdef(statistics.oid)
    )
  FROM pg_catalog.pg_statistic_ext AS statistics
  JOIN pg_catalog.pg_class AS class ON class.oid = statistics.stxrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = statistics.stxnamespace
  CROSS JOIN role_ids AS roles
  WHERE namespace.nspname = 'lor_studio'
),
catalog_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'category', category,
      'identity', identity,
      'definition', definition
    ) ORDER BY category, identity),
    '[]'::jsonb
  )) AS value
  FROM catalog_rows
),
index_inventory AS (
  SELECT
    index_class.relname::text AS object_name,
    relation_class.relname::text AS relation_name,
    pg_catalog.pg_get_indexdef(index_class.oid, 0, false) AS definition
  FROM pg_catalog.pg_class AS index_class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
  JOIN pg_catalog.pg_index AS index_row ON index_row.indexrelid = index_class.oid
  JOIN pg_catalog.pg_class AS relation_class ON relation_class.oid = index_row.indrelid
  WHERE namespace.nspname = 'lor_studio' AND index_class.relkind = 'i'
),
index_fingerprint AS (
  SELECT
    pg_catalog.count(*) AS object_count,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(pg_catalog.string_agg(pg_catalog.format(
        '%s:%s|%s:%s|%s:%s',
        pg_catalog.octet_length(pg_catalog.convert_to(object_name, 'UTF8')), object_name,
        pg_catalog.octet_length(pg_catalog.convert_to(relation_name, 'UTF8')), relation_name,
        pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')), definition
      ), E'\n' ORDER BY object_name, relation_name, definition), ''),
      'UTF8'
    )), 'hex') AS value
  FROM index_inventory
),
constraint_inventory AS (
  SELECT
    constraint_row.conname::text AS object_name,
    constraint_row.contype::text AS object_type,
    COALESCE(class.relname::text, '') AS relation_name,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, false) AS definition
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_row.connamespace
  LEFT JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  WHERE namespace.nspname = 'lor_studio'
),
constraint_fingerprint AS (
  SELECT
    pg_catalog.count(*) AS object_count,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(pg_catalog.string_agg(pg_catalog.format(
        '%s:%s|%s:%s|%s:%s|%s:%s',
        pg_catalog.octet_length(pg_catalog.convert_to(object_name, 'UTF8')), object_name,
        pg_catalog.octet_length(pg_catalog.convert_to(object_type, 'UTF8')), object_type,
        pg_catalog.octet_length(pg_catalog.convert_to(relation_name, 'UTF8')), relation_name,
        pg_catalog.octet_length(pg_catalog.convert_to(definition, 'UTF8')), definition
      ), E'\n' ORDER BY object_name, object_type, relation_name, definition), ''),
      'UTF8'
    )), 'hex') AS value
  FROM constraint_inventory
),
dependency_targets AS (
  SELECT
    'class:' || class.relname AS target_name,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid AS catalog_id,
    class.oid AS object_id
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'faculty_invitation_command_receipts'
  UNION ALL
  SELECT
    'function:' || procedure.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    procedure.oid
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.proname IN (
      'commit_faculty_invitation_delivery',
      'enforce_recommendation_case_update',
      'faculty_context_allows',
      'issue_faculty_invitation',
      'resend_faculty_invitation_otp',
      'resolve_lor_actor_case_access',
      'revoke_faculty_invitation',
      'verify_faculty_invitation'
    )
  UNION ALL
  SELECT
    'constraint:' || class.relname || '.' || constraint_row.conname,
    'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
    constraint_row.oid
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND (
      class.relname = 'faculty_invitation_command_receipts'
      OR constraint_row.conname IN (
        'recommendation_case_audit_events_event_type_known',
        'faculty_otp_verification_receipts_proof_shape'
      )
    )
  UNION ALL
  SELECT
    'policy:' || class.relname || '.' || policy.polname,
    'pg_catalog.pg_policy'::pg_catalog.regclass::oid,
    policy.oid
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname IN (
      'consent_receipts_invitation_command_select',
      'faculty_invitation_command_receipts_command_insert',
      'faculty_invitation_command_receipts_command_select',
      'faculty_invitations_invitation_command_insert',
      'faculty_invitations_invitation_command_select',
      'faculty_invitations_invitation_command_update',
      'faculty_otp_challenge_revocations_invitation_command_insert',
      'faculty_otp_challenge_revocations_invitation_command_select',
      'faculty_otp_challenges_invitation_command_insert',
      'faculty_otp_challenges_invitation_command_select',
      'faculty_otp_proof_revocations_actor_access_select',
      'faculty_otp_verification_receipts_invitation_command_insert',
      'faculty_otp_verification_receipts_invitation_command_select',
      'mentor_case_assignment_revocations_actor_access_select',
      'mentor_case_assignments_actor_access_select',
      'protected_revision_states_invitation_command_insert',
      'protected_revision_states_invitation_command_select',
      'recommendation_case_audit_events_invitation_command_insert',
      'recommendation_case_audit_events_invitation_command_select',
      'recommendation_cases_invitation_command_select',
      'recommendation_cases_invitation_command_update',
      'student_auth_binding_revocations_actor_access_select',
      'student_auth_bindings_actor_access_select'
    )
),
dependency_groups AS (
  SELECT
    target.target_name,
    dependency.classid::pg_catalog.regclass::text AS object_catalog,
    dependency.refclassid::pg_catalog.regclass::text AS referenced_catalog,
    dependency.deptype,
    dependency.objsubid,
    dependency.refobjsubid,
    pg_catalog.count(*) AS edge_count
  FROM dependency_targets AS target
  JOIN pg_catalog.pg_depend AS dependency ON (
    dependency.classid = target.catalog_id AND dependency.objid = target.object_id
  ) OR (
    dependency.refclassid = target.catalog_id AND dependency.refobjid = target.object_id
  )
  WHERE NOT (
    dependency.classid = 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid
    AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint AS implicit_constraint
      WHERE implicit_constraint.oid = dependency.objid
        AND implicit_constraint.contype = 'n'
    )
  )
    AND NOT (
      dependency.refclassid = 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid
      AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint AS implicit_constraint
        WHERE implicit_constraint.oid = dependency.refobjid
          AND implicit_constraint.contype = 'n'
      )
    )
  GROUP BY target.target_name, dependency.classid, dependency.refclassid,
    dependency.deptype, dependency.objsubid, dependency.refobjsubid
),
dependency_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'target', target_name,
      'objectCatalog', object_catalog,
      'referencedCatalog', referenced_catalog,
      'dependencyType', deptype,
      'objectSubId', objsubid,
      'referencedSubId', refobjsubid,
      'edgeCount', edge_count
    ) ORDER BY target_name, object_catalog, referenced_catalog, deptype,
      objsubid, refobjsubid),
    '[]'::jsonb
  )) AS value
  FROM dependency_groups
)
SELECT
  (SELECT value FROM catalog_fingerprint) AS catalog_fingerprint,
  (SELECT object_count::text FROM index_fingerprint) AS index_count,
  (SELECT value FROM index_fingerprint) AS index_fingerprint,
  (SELECT object_count::text FROM constraint_fingerprint) AS constraint_count,
  (SELECT value FROM constraint_fingerprint) AS constraint_fingerprint,
  (SELECT value FROM dependency_fingerprint) AS dependency_fingerprint`;

export const FACULTY_INVITATION_EXACT_CUSTODY_SQL = String.raw`
WITH target_relations AS (
  SELECT class.oid, class.relname, class.reltoastrelid, class.reltype
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = ANY (ARRAY[
      'faculty_invitation_command_receipts',
      'faculty_invitations',
      'faculty_otp_challenge_revocations',
      'faculty_otp_challenges',
      'faculty_otp_proof_revocations',
      'faculty_otp_verification_receipts',
      'mentor_case_assignment_revocations',
      'mentor_case_assignments',
      'recommendation_case_audit_events',
      'recommendation_case_protected_revision_states',
      'recommendation_cases',
      'student_auth_binding_revocations',
      'student_auth_bindings'
    ]::text[])
    AND class.relkind IN ('r', 'p')
),
target_toast AS (
  SELECT relation.relname AS base_relation, toast.*
  FROM target_relations AS relation
  JOIN pg_catalog.pg_class AS toast ON toast.oid = relation.reltoastrelid
),
index_relations AS (
  SELECT relation.oid, relation.relname AS relation_key
  FROM target_relations AS relation
  UNION ALL
  SELECT toast.oid, 'toast:' || toast.base_relation
  FROM target_toast AS toast
),
target_indexes AS (
  SELECT index_row AS index_catalog, index_class AS class_catalog,
    index_row.indexrelid, index_row.indrelid, index_row.indexprs,
    index_row.indpred, index_class.relname, index_class.relowner,
    relation.relation_key, access_method.amname AS access_method_name,
    tablespace.spcname AS tablespace_name
  FROM index_relations AS relation
  JOIN pg_catalog.pg_index AS index_row ON index_row.indrelid = relation.oid
  JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
  LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = index_class.relam
  LEFT JOIN pg_catalog.pg_tablespace AS tablespace
    ON tablespace.oid = index_class.reltablespace
),
target_functions AS (
  SELECT procedure.oid, procedure.proname
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')' = ANY (ARRAY[
        'commit_faculty_invitation_delivery(text,text,text,text,text)',
        'enforce_recommendation_case_update()',
        'faculty_context_allows(text,text,text[])',
        'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,bigint,bigint,text,text)',
        'resend_faculty_invitation_otp(text,text,text,text,timestamp with time zone,text,text)',
        'resolve_lor_actor_case_access(text,text)',
        'revoke_faculty_invitation(text,text,text)',
        'verify_faculty_invitation(text,text,text,text,text,text)'
      ]::text[])
),
target_policies AS (
  SELECT policy.oid, policy.polname, policy.polrelid, class.relname
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname = ANY (ARRAY[
      'consent_receipts_invitation_command_select',
      'faculty_invitation_command_receipts_command_insert',
      'faculty_invitation_command_receipts_command_select',
      'faculty_invitations_invitation_command_insert',
      'faculty_invitations_invitation_command_select',
      'faculty_invitations_invitation_command_update',
      'faculty_otp_challenge_revocations_invitation_command_insert',
      'faculty_otp_challenge_revocations_invitation_command_select',
      'faculty_otp_challenges_invitation_command_insert',
      'faculty_otp_challenges_invitation_command_select',
      'faculty_otp_proof_revocations_actor_access_select',
      'faculty_otp_verification_receipts_invitation_command_insert',
      'faculty_otp_verification_receipts_invitation_command_select',
      'mentor_case_assignment_revocations_actor_access_select',
      'mentor_case_assignments_actor_access_select',
      'protected_revision_states_invitation_command_insert',
      'protected_revision_states_invitation_command_select',
      'recommendation_case_audit_events_invitation_command_insert',
      'recommendation_case_audit_events_invitation_command_select',
      'recommendation_cases_invitation_command_select',
      'recommendation_cases_invitation_command_update',
      'student_auth_binding_revocations_actor_access_select',
      'student_auth_bindings_actor_access_select'
    ]::text[])
),
target_types AS (
  SELECT type.*
  FROM pg_catalog.pg_type AS type
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND (
      type.typrelid IN (SELECT relation.oid FROM target_relations AS relation)
      OR type.typelem IN (SELECT relation.reltype FROM target_relations AS relation)
    )
),
object_targets AS (
  SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid AS class_id,
    relation.oid AS object_id, 0::integer AS object_sub_id,
    'relation:' || relation.relname AS target_name
  FROM target_relations AS relation
  UNION ALL
  SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    relation.oid, attribute.attnum,
    'column:' || relation.relname || '.' || attribute.attname
  FROM target_relations AS relation
  JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
  WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
  UNION ALL
  SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    toast.oid, 0, 'toast:' || toast.base_relation
  FROM target_toast AS toast
  UNION ALL
  SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    index_row.indexrelid, 0,
    'index:' || index_row.relation_key || ':' || pg_catalog.regexp_replace(
      index_row.relname, '^pg_toast_[0-9]+', 'pg_toast_*'
    )
  FROM target_indexes AS index_row
  UNION ALL
  SELECT 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
    constraint_row.oid, 0,
    'constraint:' || relation.relname || ':' || constraint_row.conname
  FROM target_relations AS relation
  JOIN pg_catalog.pg_constraint AS constraint_row ON constraint_row.conrelid = relation.oid
  UNION ALL
  SELECT 'pg_catalog.pg_trigger'::pg_catalog.regclass::oid,
    trigger_row.oid, 0,
    'trigger:' || relation.relname || ':' || pg_catalog.regexp_replace(
      trigger_row.tgname, '^RI_ConstraintTrigger_[a-z]_[0-9]+$',
      'RI_ConstraintTrigger_*'
    )
  FROM target_relations AS relation
  JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = relation.oid
  UNION ALL
  SELECT 'pg_catalog.pg_policy'::pg_catalog.regclass::oid,
    policy.oid, 0, 'policy:' || policy.relname || ':' || policy.polname
  FROM target_policies AS policy
  UNION ALL
  SELECT 'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    procedure.oid, 0, 'function:' || procedure.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')'
  FROM target_functions AS procedure
  UNION ALL
  SELECT 'pg_catalog.pg_type'::pg_catalog.regclass::oid,
    type.oid, 0, 'type:' || type.typname
  FROM target_types AS type
  UNION ALL
  SELECT 'pg_catalog.pg_rewrite'::pg_catalog.regclass::oid,
    rule.oid, 0, 'rule:' || relation.relname || ':' || rule.rulename
  FROM target_relations AS relation
  JOIN pg_catalog.pg_rewrite AS rule ON rule.ev_class = relation.oid
  UNION ALL
  SELECT 'pg_catalog.pg_statistic_ext'::pg_catalog.regclass::oid,
    statistics.oid, 0,
    'statistics:' || relation.relname || ':' || statistics.stxname
  FROM target_relations AS relation
  JOIN pg_catalog.pg_statistic_ext AS statistics ON statistics.stxrelid = relation.oid
),
snapshot AS (
  SELECT pg_catalog.jsonb_build_object(
    'relations', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', relation.relname,
          'catalog', (
            pg_catalog.to_jsonb(class) - ARRAY[
              'oid', 'relnamespace', 'reltype', 'reloftype', 'relowner', 'relam',
              'relfilenode', 'reltablespace', 'relpages', 'reltuples',
              'relallvisible', 'reltoastrelid', 'relfrozenxid', 'relminmxid',
              'relacl', 'relrewrite', 'relpartbound'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'owner', CASE pg_catalog.pg_get_userbyid(class.relowner)
              WHEN current_user THEN 'MIGRATION_ADMIN'
              ELSE pg_catalog.pg_get_userbyid(class.relowner)
            END,
            'accessMethod', access_method.amname,
            'tablespace', COALESCE(tablespace.spcname, 'DATABASE_DEFAULT'),
            'partitionBound', pg_catalog.pg_get_expr(class.relpartbound, class.oid, true)
          )
        ) ORDER BY relation.relname
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_class AS class ON class.oid = relation.oid
      LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = class.relam
      LEFT JOIN pg_catalog.pg_tablespace AS tablespace
        ON tablespace.oid = class.reltablespace
    ), '[]'::jsonb),
    'toast', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'baseRelation', toast.base_relation,
          'catalog', (
            pg_catalog.to_jsonb(toast) - ARRAY[
              'oid', 'relname', 'relnamespace', 'reltype', 'reloftype', 'relowner',
              'relam', 'relfilenode', 'reltablespace', 'relpages', 'reltuples',
              'relallvisible', 'reltoastrelid', 'relfrozenxid', 'relminmxid',
              'relacl', 'relrewrite', 'relpartbound'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'owner', CASE pg_catalog.pg_get_userbyid(toast.relowner)
              WHEN current_user THEN 'MIGRATION_ADMIN'
              ELSE pg_catalog.pg_get_userbyid(toast.relowner)
            END,
            'accessMethod', access_method.amname,
            'tablespace', COALESCE(tablespace.spcname, 'DATABASE_DEFAULT')
          )
        ) ORDER BY toast.base_relation
      )
      FROM target_toast AS toast
      LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = toast.relam
      LEFT JOIN pg_catalog.pg_tablespace AS tablespace
        ON tablespace.oid = toast.reltablespace
    ), '[]'::jsonb),
    'columns', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', relation.relname,
          'catalog', (
            pg_catalog.to_jsonb(attribute) - ARRAY[
              'attrelid', 'atttypid', 'attcollation', 'attacl', 'attmissingval'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
            'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
              pg_catalog.format('%I.%I', collation_namespace.nspname,
                collation_row.collname) END,
            'default', pg_catalog.pg_get_expr(default_value.adbin,
              default_value.adrelid, true),
            'missingValue', pg_catalog.to_jsonb(attribute.attmissingval)
          )
        ) ORDER BY relation.relname, attribute.attnum
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
      LEFT JOIN pg_catalog.pg_attrdef AS default_value
        ON default_value.adrelid = attribute.attrelid
       AND default_value.adnum = attribute.attnum
      LEFT JOIN pg_catalog.pg_collation AS collation_row
        ON collation_row.oid = attribute.attcollation
      LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
        ON collation_namespace.oid = collation_row.collnamespace
      WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
    ), '[]'::jsonb),
    'constraints', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', relation.relname,
          'catalog', (
            pg_catalog.to_jsonb(constraint_row) - ARRAY[
              'oid', 'connamespace', 'conrelid', 'contypid', 'conindid',
              'conparentid', 'confrelid', 'conpfeqop', 'conppeqop', 'conffeqop',
              'conexclop', 'conbin'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
            'referencedRelation', referenced_class.relname,
            'backingIndex', index_class.relname,
            'parentConstraint', parent_constraint.conname
          )
        ) ORDER BY relation.relname, constraint_row.conname,
          constraint_row.contype
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_constraint AS constraint_row
        ON constraint_row.conrelid = relation.oid
      LEFT JOIN pg_catalog.pg_class AS referenced_class
        ON referenced_class.oid = constraint_row.confrelid
      LEFT JOIN pg_catalog.pg_class AS index_class
        ON index_class.oid = constraint_row.conindid
      LEFT JOIN pg_catalog.pg_constraint AS parent_constraint
        ON parent_constraint.oid = constraint_row.conparentid
    ), '[]'::jsonb),
    'indexes', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', target.relation_key,
          'name', pg_catalog.regexp_replace(target.relname,
            '^pg_toast_[0-9]+', 'pg_toast_*'),
          'index', (
            pg_catalog.to_jsonb(target.index_catalog) - ARRAY[
              'indexrelid', 'indrelid', 'indcollation', 'indclass',
              'indexprs', 'indpred'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'expression', pg_catalog.pg_get_expr(target.indexprs,
              target.indrelid, true),
            'predicate', pg_catalog.pg_get_expr(target.indpred,
              target.indrelid, true)
          ),
          'class', (
            pg_catalog.to_jsonb(target.class_catalog) - ARRAY[
              'oid', 'relname', 'relnamespace', 'reltype', 'reloftype',
              'relowner', 'relam', 'relfilenode', 'reltablespace', 'relpages',
              'reltuples', 'relallvisible', 'reltoastrelid', 'relfrozenxid',
              'relminmxid', 'relacl', 'relrewrite', 'relpartbound'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'owner', CASE pg_catalog.pg_get_userbyid(target.relowner)
              WHEN current_user THEN 'MIGRATION_ADMIN'
              ELSE pg_catalog.pg_get_userbyid(target.relowner)
            END,
            'accessMethod', target.access_method_name,
            'tablespace', COALESCE(target.tablespace_name, 'DATABASE_DEFAULT')
          ),
          'definition', pg_catalog.regexp_replace(
            pg_catalog.pg_get_indexdef(target.indexrelid),
            'pg_toast_[0-9]+', 'pg_toast_*', 'g'
          )
        ) ORDER BY target.relation_key,
          pg_catalog.regexp_replace(target.relname, '^pg_toast_[0-9]+', 'pg_toast_*')
      )
      FROM target_indexes AS target
    ), '[]'::jsonb),
    'triggers', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', relation.relname,
          'catalog', (
            pg_catalog.to_jsonb(trigger_row) - ARRAY[
              'oid', 'tgname', 'tgrelid', 'tgparentid', 'tgfoid', 'tgconstraint',
              'tgconstrrelid', 'tgconstrindid', 'tgqual'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'name', pg_catalog.regexp_replace(trigger_row.tgname,
              '^RI_ConstraintTrigger_[a-z]_[0-9]+$', 'RI_ConstraintTrigger_*'),
            'function', pg_catalog.format('%I.%I(%s)',
              function_namespace.nspname, function_row.proname,
              pg_catalog.pg_get_function_identity_arguments(function_row.oid)),
            'constraint', constraint_row.conname,
            'constraintRelation', constraint_relation.relname,
            'constraintIndex', CASE WHEN constraint_index.oid IS NULL THEN NULL ELSE
              pg_catalog.format('%I.%I', constraint_index_namespace.nspname,
                constraint_index.relname) END,
            'qualifier', pg_catalog.pg_get_expr(trigger_row.tgqual,
              trigger_row.tgrelid, true),
            'definition', pg_catalog.regexp_replace(
              pg_catalog.pg_get_triggerdef(trigger_row.oid, true),
              'RI_ConstraintTrigger_[a-z]_[0-9]+',
              'RI_ConstraintTrigger_*', 'g'
            )
          )
        ) ORDER BY relation.relname, trigger_row.tgisinternal,
          constraint_row.conname, function_namespace.nspname,
          function_row.proname, trigger_row.tgtype,
          pg_catalog.regexp_replace(trigger_row.tgname,
            '^RI_ConstraintTrigger_[a-z]_[0-9]+$', 'RI_ConstraintTrigger_*')
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = relation.oid
      JOIN pg_catalog.pg_proc AS function_row ON function_row.oid = trigger_row.tgfoid
      JOIN pg_catalog.pg_namespace AS function_namespace
        ON function_namespace.oid = function_row.pronamespace
      LEFT JOIN pg_catalog.pg_constraint AS constraint_row
        ON constraint_row.oid = trigger_row.tgconstraint
      LEFT JOIN pg_catalog.pg_class AS constraint_relation
        ON constraint_relation.oid = trigger_row.tgconstrrelid
      LEFT JOIN pg_catalog.pg_class AS constraint_index
        ON constraint_index.oid = trigger_row.tgconstrindid
      LEFT JOIN pg_catalog.pg_namespace AS constraint_index_namespace
        ON constraint_index_namespace.oid = constraint_index.relnamespace
    ), '[]'::jsonb),
    'types', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', type.typname,
          'catalog', (
            pg_catalog.to_jsonb(type) - ARRAY[
              'oid', 'typnamespace', 'typowner', 'typrelid', 'typelem',
              'typarray', 'typbasetype', 'typcollation', 'typacl'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'owner', CASE pg_catalog.pg_get_userbyid(type.typowner)
              WHEN current_user THEN 'MIGRATION_ADMIN'
              ELSE pg_catalog.pg_get_userbyid(type.typowner)
            END,
            'relation', relation.relname,
            'elementType', CASE WHEN type.typelem = 0 THEN NULL ELSE
              pg_catalog.format_type(type.typelem, NULL) END,
            'arrayType', CASE WHEN type.typarray = 0 THEN NULL ELSE
              pg_catalog.format_type(type.typarray, NULL) END,
            'baseType', CASE WHEN type.typbasetype = 0 THEN NULL ELSE
              pg_catalog.format_type(type.typbasetype, type.typtypmod) END,
            'collation', CASE WHEN type.typcollation = 0 THEN NULL ELSE
              pg_catalog.format('%I.%I', collation_namespace.nspname,
                collation_row.collname) END
          )
        ) ORDER BY type.typname
      )
      FROM target_types AS type
      LEFT JOIN target_relations AS relation ON relation.oid = type.typrelid
      LEFT JOIN pg_catalog.pg_collation AS collation_row
        ON collation_row.oid = type.typcollation
      LEFT JOIN pg_catalog.pg_namespace AS collation_namespace
        ON collation_namespace.oid = collation_row.collnamespace
    ), '[]'::jsonb),
    'typeAcl', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'type', type.typname,
          'grantor', CASE grantor.rolname WHEN current_user THEN 'MIGRATION_ADMIN'
            ELSE grantor.rolname END,
          'grantee', CASE COALESCE(grantee.rolname, 'PUBLIC')
            WHEN current_user THEN 'MIGRATION_ADMIN'
            ELSE COALESCE(grantee.rolname, 'PUBLIC') END,
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        ) ORDER BY type.typname, COALESCE(grantee.rolname, 'PUBLIC'),
          acl.privilege_type, acl.is_grantable
      )
      FROM target_types AS type
      CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
        type.typacl, pg_catalog.acldefault('T', type.typowner)
      )) AS acl
      LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
      LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
    ), '[]'::jsonb),
    'rules', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', relation.relname,
          'catalog', pg_catalog.to_jsonb(rule) - ARRAY[
            'oid', 'ev_class', 'ev_action', 'ev_qual'
          ]::text[],
          'definition', pg_catalog.pg_get_ruledef(rule.oid, true)
        ) ORDER BY relation.relname, rule.rulename
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_rewrite AS rule ON rule.ev_class = relation.oid
    ), '[]'::jsonb),
    'inheritance', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'child', child_namespace.nspname || '.' || child.relname,
          'parent', parent_namespace.nspname || '.' || parent.relname,
          'catalog', pg_catalog.to_jsonb(inheritance) - ARRAY[
            'inhrelid', 'inhparent'
          ]::text[]
        ) ORDER BY child_namespace.nspname, child.relname,
          parent_namespace.nspname, parent.relname
      )
      FROM pg_catalog.pg_inherits AS inheritance
      JOIN pg_catalog.pg_class AS child ON child.oid = inheritance.inhrelid
      JOIN pg_catalog.pg_namespace AS child_namespace
        ON child_namespace.oid = child.relnamespace
      JOIN pg_catalog.pg_class AS parent ON parent.oid = inheritance.inhparent
      JOIN pg_catalog.pg_namespace AS parent_namespace
        ON parent_namespace.oid = parent.relnamespace
      WHERE inheritance.inhrelid IN (SELECT relation.oid FROM target_relations AS relation)
         OR inheritance.inhparent IN (SELECT relation.oid FROM target_relations AS relation)
    ), '[]'::jsonb),
    'publications', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'publication', publication.pubname,
          'relation', relation.relname,
          'catalog', pg_catalog.to_jsonb(publication_relation) - ARRAY[
            'oid', 'prpubid', 'prrelid', 'prattrs', 'prqual'
          ]::text[],
          'columns', COALESCE((
            SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY member.ordinality)
            FROM pg_catalog.unnest(publication_relation.prattrs::smallint[])
              WITH ORDINALITY AS member(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS attribute
              ON attribute.attrelid = publication_relation.prrelid
             AND attribute.attnum = member.attnum
          ), '[]'::jsonb),
          'qualifier', pg_catalog.pg_get_expr(publication_relation.prqual,
            publication_relation.prrelid, true)
        ) ORDER BY publication.pubname, relation.relname
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_publication_rel AS publication_relation
        ON publication_relation.prrelid = relation.oid
      JOIN pg_catalog.pg_publication AS publication
        ON publication.oid = publication_relation.prpubid
    ), '[]'::jsonb),
    'statistics', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'relation', relation.relname,
          'catalog', (
            pg_catalog.to_jsonb(statistics) - ARRAY[
              'oid', 'stxrelid', 'stxnamespace', 'stxowner', 'stxkeys', 'stxexprs'
            ]::text[]
          ) || pg_catalog.jsonb_build_object(
            'owner', CASE pg_catalog.pg_get_userbyid(statistics.stxowner)
              WHEN current_user THEN 'MIGRATION_ADMIN'
              ELSE pg_catalog.pg_get_userbyid(statistics.stxowner)
            END,
            'definition', pg_catalog.pg_get_statisticsobjdef(statistics.oid)
          )
        ) ORDER BY relation.relname, statistics.stxname
      )
      FROM target_relations AS relation
      JOIN pg_catalog.pg_statistic_ext AS statistics
        ON statistics.stxrelid = relation.oid
    ), '[]'::jsonb),
    'dependencies', COALESCE((
      SELECT pg_catalog.jsonb_agg(dependency_row.value ORDER BY dependency_row.sort_key)
      FROM (
        SELECT DISTINCT
          target.target_name || ':' || dependency.deptype::text || ':' ||
            pg_catalog.regexp_replace(pg_catalog.regexp_replace(
              pg_catalog.pg_describe_object(dependency.classid,
                dependency.objid, dependency.objsubid),
              'RI_ConstraintTrigger_[a-z]_[0-9]+',
              'RI_ConstraintTrigger_*', 'g'),
              'pg_toast_[0-9]+', 'pg_toast_*', 'g') || '->' ||
            pg_catalog.regexp_replace(pg_catalog.regexp_replace(
              pg_catalog.pg_describe_object(dependency.refclassid,
                dependency.refobjid, dependency.refobjsubid),
              'RI_ConstraintTrigger_[a-z]_[0-9]+',
              'RI_ConstraintTrigger_*', 'g'),
              'pg_toast_[0-9]+', 'pg_toast_*', 'g') AS sort_key,
          pg_catalog.jsonb_build_object(
            'target', target.target_name,
            'type', dependency.deptype,
            'object', pg_catalog.regexp_replace(pg_catalog.regexp_replace(
              pg_catalog.pg_describe_object(dependency.classid,
                dependency.objid, dependency.objsubid),
              'RI_ConstraintTrigger_[a-z]_[0-9]+',
              'RI_ConstraintTrigger_*', 'g'),
              'pg_toast_[0-9]+', 'pg_toast_*', 'g'),
            'referenced', pg_catalog.regexp_replace(pg_catalog.regexp_replace(
              pg_catalog.pg_describe_object(dependency.refclassid,
                dependency.refobjid, dependency.refobjsubid),
              'RI_ConstraintTrigger_[a-z]_[0-9]+',
              'RI_ConstraintTrigger_*', 'g'),
              'pg_toast_[0-9]+', 'pg_toast_*', 'g')
          ) AS value
        FROM object_targets AS target
        JOIN pg_catalog.pg_depend AS dependency ON (
          dependency.classid = target.class_id
          AND dependency.objid = target.object_id
          AND dependency.objsubid = target.object_sub_id
        ) OR (
          dependency.refclassid = target.class_id
          AND dependency.refobjid = target.object_id
          AND dependency.refobjsubid = target.object_sub_id
        )
      ) AS dependency_row
    ), '[]'::jsonb)
  ) AS value
)
SELECT lor_studio.canonical_jsonb_sha256(snapshot.value)
  AS exact_custody_fingerprint
FROM snapshot`;

const EXPECTED_FINGERPRINTS = Object.freeze({
  16: Object.freeze({
    catalog_fingerprint: 'eb4b7791ae16854bc303071d5f9e2e77d929a4c1e803a309404c48e348bf346f',
    index_count: '120',
    index_fingerprint: 'e6db9894469dc8759bf744b393d5d88b1bd61c86b2ba0d08b9d397b191d81baf',
    constraint_count: '320',
    constraint_fingerprint: 'a8aa002c39963b9748571999ab10ec8c65cc06d575e7b9a52ff09247720e0c92',
    dependency_fingerprint: '6d48ee2035eb01e1f2515746d55e3a1dcbdee5f14df4b20da85145edb4bb95d8',
    exact_custody_fingerprint: 'da75dfc13713b48af9ae9b9fef2180e250c150f9eaa22c50f0fb1d51c73ae001',
  }),
  18: Object.freeze({
    catalog_fingerprint: 'b4c7bbeb5d49c651d5ad0378a3bf946e74f20eaf7ede416763c17f881e813628',
    index_count: '120',
    index_fingerprint: 'e6db9894469dc8759bf744b393d5d88b1bd61c86b2ba0d08b9d397b191d81baf',
    constraint_count: '642',
    constraint_fingerprint: 'c8351d93dc16910d294ec6ef511e645bcda0c8017908bbba2fb2e00e8877fc33',
    dependency_fingerprint: '6d48ee2035eb01e1f2515746d55e3a1dcbdee5f14df4b20da85145edb4bb95d8',
    exact_custody_fingerprint: '7c0c453eb5cf36497b093c921da7e648d9f660be0ab6dccabac7e3a22d9bb7be',
  }),
});

function binaries(root) {
  return Object.freeze({
    initdb: path.join(root, 'initdb'),
    pgCtl: path.join(root, 'pg_ctl'),
    createdb: path.join(root, 'createdb'),
    psql: path.join(root, 'psql'),
  });
}

async function withHarness(toolchain, operation) {
  for (const binary of Object.values(binaries(toolchain.root))) await access(binary);
  const harness = createDisposablePostgresHarness({
    binaries: binaries(toolchain.root),
    startupTimeoutMs: 30_000,
    shutdownTimeoutMs: 15_000,
  });
  let running = false;
  let pool;
  try {
    await harness.start();
    running = true;
    pool = new Pool({
      ...harness.connectionOptions(),
      max: 2,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 5_000,
    });
    await operation({ harness, pool });
  } finally {
    if (pool) await pool.end();
    if (running) await harness.stop();
  }
}

async function applyForward(harness) {
  for (const name of MIGRATION_NAMES) {
    await harness.applySqlFile(path.resolve(migrationsDirectory.pathname, name));
  }
}

function consentStudentScope(operation, caseId = CONSENT_CASE_ID) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: CONSENT_STUDENT_UID,
    authenticatedSubject: CONSENT_STUDENT,
    actorId: CONSENT_STUDENT,
    actorRole: 'student',
    resourceStudentId: CONSENT_STUDENT,
    caseId,
    operation,
    purpose: operation === 'read' ? 'student_case_read' : 'student_case_write',
    assignmentId: null,
    invitationId: null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  };
}

function consentTransitionEvent(transition, eventId, eventType) {
  return createMetadataServiceEvent({
    eventId,
    eventType,
    caseId: CONSENT_CASE_ID,
    actorId: CONSENT_STUDENT,
    actorRole: 'student',
    correlationId: 'invitation-consent-custody-correlation',
    revision: transition.state.revision,
    occurredAt: transition.state.updatedAt,
  });
}

function consentStudentCommand({
  transition,
  expectedRevision,
  idempotencyKey,
  operation,
  eventType,
}) {
  return {
    binding: CONSENT_TARGET_BINDING,
    scope: consentStudentScope(expectedRevision === null ? 'create' : 'save'),
    state: transition.state,
    expectedRevision,
    idempotencyKey,
    requestHash: hashValue({
      schemaVersion: 'missionmed.lor.invitation-consent-test-command.v1',
      operation,
      caseId: CONSENT_CASE_ID,
      expectedRevision,
      idempotencyKey,
    }),
    event: consentTransitionEvent(transition, idempotencyKey, eventType),
    versionEntry: transition.versionEntry,
    receipt: null,
  };
}

async function seedConsentCase(pool) {
  await pool.query({
    text: `INSERT INTO lor_studio.student_auth_bindings (
      binding_id, student_auth_subject, student_auth_uid, binding_source,
      source_reference_hash, proof_hash, bound_at, expires_at, created_at
    ) VALUES (
      $1, $2, $3::uuid, 'wordpress_verified_bootstrap', $4, $5,
      $6::timestamptz, NULL, $6::timestamptz
    )`,
    values: [
      CONSENT_BINDING_ID,
      CONSENT_STUDENT,
      CONSENT_STUDENT_UID,
      sha256('invitation-consent-binding-source'),
      sha256('invitation-consent-binding-proof'),
      '2026-08-20T12:00:00.000Z',
    ],
  });
  const driver = createAtomicRlsCaseDriver({
    binding: CONSENT_TARGET_BINDING,
    executor: createNodePostgresExecutor({
      pool,
      databaseRole: NODE_POSTGRES_DATABASE_ROLE,
    }),
  });
  const createKey = 'idem-invitation-consent-create';
  const creationRef = `case_creation_${hashValue({
    schemaVersion: 'missionmed.lor.case-creation-key.v1',
    actorId: CONSENT_STUDENT,
    idempotencyKey: createKey,
  })}`;
  await driver.reserveCaseCreation({
    binding: CONSENT_TARGET_BINDING,
    scope: consentStudentScope('create', creationRef),
    operation: 'reserve_create',
    creationRef,
    actorRef: `actor_${sha256(`lor-studio:actor:${CONSENT_STUDENT}`)}`,
    idempotencyKey: createKey,
    requestHash: hashValue({
      operation: 'case.create',
      actorId: CONSENT_STUDENT,
      payload: {},
    }),
    proposedIdentifiers: {
      caseId: CONSENT_CASE_ID,
      builderSessionId: CONSENT_BUILDER_SESSION_ID,
      createdAt: '2026-08-20T12:00:00.000Z',
    },
  });
  const created = createStudentSafeRecommendationCase({
    id: CONSENT_CASE_ID,
    studentId: CONSENT_STUDENT,
    actorId: CONSENT_STUDENT,
    builderSessionId: CONSENT_BUILDER_SESSION_ID,
    now: '2026-08-20T12:00:00.000Z',
  });
  await driver.commitStudentCaseCreate(consentStudentCommand({
    transition: created,
    expectedRevision: null,
    idempotencyKey: createKey,
    operation: 'case.create',
    eventType: 'case.created',
  }));

  let state = created.state;
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    const autosaved = autosaveStudentSafeBuilderStep(state, {
      actorId: CONSENT_STUDENT,
      stepId,
      stepData: { acknowledged: true, stepId },
      now: new Date(Date.UTC(2026, 7, 20, 12, index * 2 + 1)).toISOString(),
    });
    await driver.commitStudentBuilderAutosave(consentStudentCommand({
      transition: autosaved,
      expectedRevision: state.revision,
      idempotencyKey: `idem-invitation-consent-autosave-${index}`,
      operation: 'builder.autosave',
      eventType: 'builder.autosaved',
    }));
    const completed = completeStudentSafeBuilderStep(autosaved.state, {
      actorId: CONSENT_STUDENT,
      stepId,
      now: new Date(Date.UTC(2026, 7, 20, 12, index * 2 + 2)).toISOString(),
    });
    await driver.commitStudentBuilderComplete(consentStudentCommand({
      transition: completed,
      expectedRevision: autosaved.state.revision,
      idempotencyKey: `idem-invitation-consent-complete-${index}`,
      operation: 'builder.complete',
      eventType: 'builder.step_completed',
    }));
    state = completed.state;
  }
  assert.deepEqual(state.builder.completedStepIds, BUILDER_STEPS);
  return state;
}

async function withInvitationContext(pool, {
  actorRole = 'student',
  operation,
  invitationId = '',
}, query) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query('SET LOCAL ROLE lor_studio_app');
    await client.query({
      text: `SELECT
        pg_catalog.set_config('request.jwt.claim.sub', $1, true),
        pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
        pg_catalog.set_config('lor_studio.actor_role', $3, true),
        pg_catalog.set_config('lor_studio.resource_student_id', $4, true),
        pg_catalog.set_config('lor_studio.case_id', $5, true),
        pg_catalog.set_config('lor_studio.operation', $6, true),
        pg_catalog.set_config('lor_studio.purpose', $7, true),
        pg_catalog.set_config('lor_studio.invitation_id', $8, true),
        pg_catalog.set_config('lor_studio.identity_resolution_verified', $9, true),
        pg_catalog.set_config('lor_studio.trusted_service_actor', $10, true),
        pg_catalog.set_config('lor_studio.entitlement_verified', 'true', true),
        pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
        pg_catalog.set_config('lor_studio.canary_authorized', 'true', true)`,
      values: [
        actorRole === 'student' ? CONSENT_STUDENT_UID : '',
        actorRole === 'student' ? CONSENT_STUDENT : 'service:postmark-delivery-v1',
        actorRole,
        CONSENT_STUDENT,
        CONSENT_CASE_ID,
        operation,
        actorRole === 'student' ? 'student_case_write' : 'faculty_invitation_delivery',
        invitationId,
        actorRole === 'student' ? 'true' : 'false',
        actorRole === 'service' ? 'postmark-delivery-v1' : '',
      ],
    });
    const result = await query(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function replaceSyntheticConsent(pool, receipts) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query({
      text: `DELETE FROM lor_studio.consent_receipts
        WHERE case_id = $1 AND student_auth_subject = $2`,
      values: [CONSENT_CASE_ID, CONSENT_STUDENT],
    });
    for (const receipt of receipts) {
      await client.query({
        text: `INSERT INTO lor_studio.consent_receipts (
          receipt_id, case_id, student_auth_subject, student_auth_uid,
          case_revision, scopes, policy_version, recorded_at, receipt_hash
        ) VALUES ($1, $2, $3, $4::uuid, $5::bigint, $6::text[], $7,
          $8::timestamptz, $9)`,
        values: [
          receipt.id,
          CONSENT_CASE_ID,
          CONSENT_STUDENT,
          CONSENT_STUDENT_UID,
          receipt.caseRevision,
          receipt.scopes,
          receipt.policyVersion,
          receipt.recordedAt,
          sha256(`invitation-consent-receipt:${receipt.id}`),
        ],
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function exerciseInvitationConsentEnforcement(pool) {
  const completedState = await seedConsentCase(pool);
  const invitationId = 'invitation_consent_custody_0001';
  const recipientEmailHash = sha256('invitation-consent-recipient');
  const invitationExpiresAt = new Date(Date.now() + 86_400_000).toISOString();
  const issueChallengeId = 'challenge_invitation_consent_issue_0001';
  const issueValues = [
    CONSENT_CASE_ID,
    completedState.revision,
    invitationId,
    recipientEmailHash,
    sha256('invitation-consent-route-token'),
    issueChallengeId,
    sha256('invitation-consent-issue-otp'),
    invitationExpiresAt,
    new Date(Date.now() + 600_000).toISOString(),
    3,
    600_000,
    600_000,
    'idem-invitation-consent-issue',
    sha256('invitation-consent-issue-request'),
  ];
  const issueSql = `SELECT lor_studio.issue_faculty_invitation(
    $1, $2::bigint, $3, $4, $5, $6, $7,
    $8::timestamptz, $9::timestamptz, $10::integer,
    $11::bigint, $12::bigint, $13, $14
  ) AS result`;
  const invokeIssue = () => withInvitationContext(pool, {
    operation: 'issue_faculty_invitation',
  }, async (client) => (await client.query({ text: issueSql, values: issueValues })).rows[0].result);

  const preIssueScenarios = [
    { name: 'no consent', receipts: [] },
    {
      name: 'old policy',
      receipts: [{
        id: 'consent_invitation_old_policy',
        caseRevision: completedState.revision,
        scopes: CURRENT_CONSENT_GRANTS,
        policyVersion: 'dr-132-identified-education-record-v0',
        recordedAt: '2026-08-21T12:00:00.000Z',
      }],
    },
    {
      name: 'partial grants',
      receipts: [{
        id: 'consent_invitation_partial_grants',
        caseRevision: completedState.revision,
        scopes: ['builder_autosave', 'faculty_handoff'],
        policyVersion: CURRENT_CONSENT_POLICY,
        recordedAt: '2026-08-21T12:01:00.000Z',
      }],
    },
  ];
  for (const scenario of preIssueScenarios) {
    await replaceSyntheticConsent(pool, scenario.receipts);
    await assert.rejects(
      invokeIssue,
      (error) => error?.code === 'P1301'
        && error?.message === 'LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED',
      `${scenario.name} must block invitation issue`,
    );
  }

  const exactConsent = {
    id: 'consent_invitation_exact_current',
    caseRevision: completedState.revision,
    scopes: CURRENT_CONSENT_GRANTS,
    policyVersion: CURRENT_CONSENT_POLICY,
    recordedAt: '2026-08-21T12:02:00.000Z',
  };
  await replaceSyntheticConsent(pool, [exactConsent]);
  const issued = await invokeIssue();
  assert.equal(issued.caseRevision, completedState.revision + 1);

  const deliverySql =
    'SELECT lor_studio.commit_faculty_invitation_delivery($1, $2, $3, $4, $5) AS result';
  const acceptedDeliveryKey = 'idem-invitation-consent-delivery-accepted';
  const acceptedDeliveryRequestHash = sha256('invitation-consent-delivery-accepted-request');
  const invokeDelivery = (operation, deliveryValue, idempotencyKey, requestHash) =>
    withInvitationContext(pool, {
      actorRole: 'service',
      operation,
      invitationId,
    }, async (client) => (await client.query({
      text: deliverySql,
      values: [
        CONSENT_CASE_ID,
        invitationId,
        deliveryValue,
        idempotencyKey,
        requestHash,
      ],
    })).rows[0].result);
  const reserved = await invokeDelivery(
    'reserve_faculty_invitation_delivery',
    'issue',
    acceptedDeliveryKey,
    acceptedDeliveryRequestHash,
  );
  assert.equal(reserved.dispatchGranted, true);
  const providerMessageRefHash = sha256('invitation-consent-provider-message-ref');
  await invokeDelivery(
    'commit_faculty_invitation_delivery',
    providerMessageRefHash,
    acceptedDeliveryKey,
    acceptedDeliveryRequestHash,
  );

  const resendSql = `SELECT lor_studio.resend_faculty_invitation_otp(
    $1, $2, $3, $4, $5::timestamptz, $6, $7
  ) AS result`;
  let scenarioIndex = 0;
  const deniedAfterIssue = [
    { name: 'no consent', receipts: [] },
    {
      name: 'old policy',
      receipts: [{
        id: 'consent_invitation_post_issue_old',
        caseRevision: issued.caseRevision,
        scopes: CURRENT_CONSENT_GRANTS,
        policyVersion: 'dr-132-identified-education-record-v0',
        recordedAt: '2026-08-21T13:00:00.000Z',
      }],
    },
    {
      name: 'partial grants',
      receipts: [{
        id: 'consent_invitation_post_issue_partial',
        caseRevision: issued.caseRevision,
        scopes: ['builder_autosave', 'faculty_handoff'],
        policyVersion: CURRENT_CONSENT_POLICY,
        recordedAt: '2026-08-21T13:01:00.000Z',
      }],
    },
    {
      name: 'later withdrawal',
      receipts: [
        {
          ...exactConsent,
          id: 'consent_invitation_post_issue_exact',
          caseRevision: issued.caseRevision,
          recordedAt: '2026-08-21T13:02:00.000Z',
        },
        {
          id: 'consent_invitation_post_issue_withdrawal',
          caseRevision: issued.caseRevision,
          scopes: ['consent_withdrawn'],
          policyVersion: CURRENT_CONSENT_POLICY,
          recordedAt: '2026-08-21T13:03:00.000Z',
        },
      ],
    },
  ];
  for (const scenario of deniedAfterIssue) {
    scenarioIndex += 1;
    await replaceSyntheticConsent(pool, scenario.receipts);
    await assert.rejects(invokeIssue, (error) => error?.code === 'P1301',
      `${scenario.name} must block issue replay`);

    const deniedChallengeId = `challenge_invitation_consent_denied_${scenarioIndex}`;
    await assert.rejects(
      () => withInvitationContext(pool, {
        operation: 'resend_faculty_invitation_otp',
        invitationId,
      }, (client) => client.query({
        text: resendSql,
        values: [
          CONSENT_CASE_ID,
          recipientEmailHash,
          deniedChallengeId,
          sha256(`invitation-consent-denied-otp-${scenarioIndex}`),
          new Date(Date.now() + 600_000).toISOString(),
          `idem-invitation-consent-denied-resend-${scenarioIndex}`,
          sha256(`invitation-consent-denied-resend-request-${scenarioIndex}`),
        ],
      })),
      (error) => error?.code === 'P1301',
      `${scenario.name} must block OTP resend`,
    );

    const deniedDeliveryKey = `idem-invitation-consent-denied-delivery-${scenarioIndex}`;
    await assert.rejects(
      () => invokeDelivery(
        'reserve_faculty_invitation_delivery',
        'resend',
        deniedDeliveryKey,
        sha256(`invitation-consent-denied-delivery-request-${scenarioIndex}`),
      ),
      (error) => error?.code === 'P1301',
      `${scenario.name} must block a new provider-delivery reservation`,
    );
    const { rows: [deniedSideEffects] } = await pool.query({
      text: `SELECT
        (SELECT pg_catalog.count(*)::integer
          FROM lor_studio.faculty_invitation_command_receipts
          WHERE idempotency_key = $1) AS reservation_count,
        (SELECT pg_catalog.count(*)::integer
          FROM lor_studio.faculty_otp_challenges
          WHERE challenge_id = $2) AS challenge_count`,
      values: [deniedDeliveryKey, deniedChallengeId],
    });
    assert.deepEqual(deniedSideEffects, { reservation_count: 0, challenge_count: 0 });
  }

  const acceptedReplay = await invokeDelivery(
    'reserve_faculty_invitation_delivery',
    'issue',
    acceptedDeliveryKey,
    acceptedDeliveryRequestHash,
  );
  assert.equal(acceptedReplay.status, 'accepted');
  assert.equal(acceptedReplay.dispatchGranted, false);
  assert.equal(acceptedReplay.replayed, true);
  const acceptedReconciliation = await invokeDelivery(
    'commit_faculty_invitation_delivery',
    providerMessageRefHash,
    acceptedDeliveryKey,
    acceptedDeliveryRequestHash,
  );
  assert.equal(acceptedReconciliation.replayed, true);

  const withdrawnReceipt = deniedAfterIssue.at(-1).receipts.at(-1);
  const reconsentReceipt = {
    id: 'consent_invitation_reconsented_current',
    caseRevision: issued.caseRevision,
    scopes: CURRENT_CONSENT_GRANTS,
    policyVersion: CURRENT_CONSENT_POLICY,
    recordedAt: '2026-08-21T13:04:00.000Z',
  };
  await replaceSyntheticConsent(pool, [
    deniedAfterIssue.at(-1).receipts[0],
    withdrawnReceipt,
    reconsentReceipt,
  ]);
  const reconsentChallengeId = 'challenge_invitation_consent_reconsented';
  const resent = await withInvitationContext(pool, {
    operation: 'resend_faculty_invitation_otp',
    invitationId,
  }, async (client) => (await client.query({
    text: resendSql,
    values: [
      CONSENT_CASE_ID,
      recipientEmailHash,
      reconsentChallengeId,
      sha256('invitation-consent-reconsented-otp'),
      new Date(Date.now() + 600_000).toISOString(),
      'idem-invitation-consent-reconsented-resend',
      sha256('invitation-consent-reconsented-resend-request'),
    ],
  })).rows[0].result);
  assert.equal(resent.action, 'faculty.invitation.otp_resend');
  const reconsentedReservation = await invokeDelivery(
    'reserve_faculty_invitation_delivery',
    'resend',
    'idem-invitation-consent-reconsented-delivery',
    sha256('invitation-consent-reconsented-delivery-request'),
  );
  assert.equal(reconsentedReservation.dispatchGranted, true);

  const finalWithdrawal = {
    id: 'consent_invitation_final_withdrawal',
    caseRevision: issued.caseRevision,
    scopes: ['consent_withdrawn'],
    policyVersion: CURRENT_CONSENT_POLICY,
    recordedAt: '2026-08-21T13:05:00.000Z',
  };
  await replaceSyntheticConsent(pool, [reconsentReceipt, finalWithdrawal]);
  const revoked = await withInvitationContext(pool, {
    operation: 'revoke_faculty_invitation',
    invitationId,
  }, async (client) => (await client.query({
    text: 'SELECT lor_studio.revoke_faculty_invitation($1, $2, $3) AS result',
    values: [
      CONSENT_CASE_ID,
      'idem-invitation-consent-revoke-after-withdrawal',
      sha256('invitation-consent-revoke-after-withdrawal-request'),
    ],
  })).rows[0].result);
  assert.equal(revoked.action, 'faculty.invitation.revoke');
}

async function readFingerprints(pool) {
  const { rows: [fingerprints] } = await pool.query(`WITH base AS (
    ${FACULTY_INVITATION_CUSTODY_FINGERPRINT_SQL}
  ), exact AS (
    ${FACULTY_INVITATION_EXACT_CUSTODY_SQL}
  )
  SELECT base.*, exact.exact_custody_fingerprint
  FROM base CROSS JOIN exact`);
  return fingerprints;
}

async function assertRollbackRejected(harness) {
  await assert.rejects(
    () => harness.applySqlFile(rollbackPath.pathname),
    (error) => error?.code === 'SQL_FILE_APPLY_FAILED',
  );
}

async function exerciseAdversarialCustody({ harness, pool }) {
  let originalFunction;
  let internalTriggerName;
  const baselineFingerprints = await readFingerprints(pool);
  const sameCountScenarios = [
    {
      name: 'index definition',
      mutate: async () => {
        await pool.query(
          'DROP INDEX lor_studio.faculty_invitation_command_receipts_case_idx',
        );
        await pool.query(`CREATE INDEX faculty_invitation_command_receipts_case_idx
          ON lor_studio.faculty_invitation_command_receipts
          (student_auth_subject, case_id, invitation_id, committed_at)`);
      },
      restore: async () => {
        await pool.query(
          'DROP INDEX lor_studio.faculty_invitation_command_receipts_case_idx',
        );
        await pool.query(`CREATE INDEX faculty_invitation_command_receipts_case_idx
          ON lor_studio.faculty_invitation_command_receipts
          (case_id, student_auth_subject, invitation_id, committed_at)`);
      },
    },
    {
      name: 'index catalog options',
      mutate: async () => pool.query(`ALTER INDEX
        lor_studio.faculty_invitation_command_receipts_case_idx
        SET (fillfactor = 80)`),
      restore: async () => pool.query(`ALTER INDEX
        lor_studio.faculty_invitation_command_receipts_case_idx
        RESET (fillfactor)`),
    },
    {
      name: 'column storage metadata',
      mutate: async () => pool.query(`ALTER TABLE
        lor_studio.faculty_invitation_command_receipts
        ALTER COLUMN result SET STORAGE EXTERNAL`),
      restore: async () => pool.query(`ALTER TABLE
        lor_studio.faculty_invitation_command_receipts
        ALTER COLUMN result SET STORAGE EXTENDED`),
    },
    {
      name: 'toast catalog options',
      mutate: async () => pool.query(`ALTER TABLE
        lor_studio.faculty_invitation_command_receipts
        SET (toast.autovacuum_enabled = false)`),
      restore: async () => pool.query(`ALTER TABLE
        lor_studio.faculty_invitation_command_receipts
        RESET (toast.autovacuum_enabled)`),
    },
    {
      name: 'constraint definition',
      mutate: async () => {
        await pool.query(`ALTER TABLE lor_studio.faculty_invitation_command_receipts
          DROP CONSTRAINT faculty_invitation_command_receipts_time_order`);
        await pool.query(`ALTER TABLE lor_studio.faculty_invitation_command_receipts
          ADD CONSTRAINT faculty_invitation_command_receipts_time_order
          CHECK (committed_at > COALESCE(accepted_at, '-infinity'::timestamptz))`);
      },
      restore: async () => {
        await pool.query(`ALTER TABLE lor_studio.faculty_invitation_command_receipts
          DROP CONSTRAINT faculty_invitation_command_receipts_time_order`);
        await pool.query(`ALTER TABLE lor_studio.faculty_invitation_command_receipts
          ADD CONSTRAINT faculty_invitation_command_receipts_time_order CHECK (
            committed_at >= COALESCE(accepted_at, committed_at)
          )`);
      },
    },
    {
      name: 'function body',
      mutate: async () => {
        const { rows: [{ definition }] } = await pool.query(`SELECT
          pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
            'lor_studio.resolve_lor_actor_case_access(text,text)'
          )) AS definition`);
        originalFunction = definition;
        await pool.query(`CREATE OR REPLACE FUNCTION lor_studio.resolve_lor_actor_case_access(
          candidate_authenticated_subject text,
          candidate_case_id text
        ) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
        AS $$ SELECT NULL::jsonb $$`);
      },
      restore: async () => pool.query(originalFunction),
    },
    {
      name: 'policy predicate',
      mutate: async () => {
        await pool.query(`DROP POLICY faculty_invitation_command_receipts_command_select
          ON lor_studio.faculty_invitation_command_receipts`);
        await pool.query(`CREATE POLICY faculty_invitation_command_receipts_command_select
          ON lor_studio.faculty_invitation_command_receipts
          FOR SELECT TO lor_studio_command_owner USING (false)`);
      },
      restore: async () => {
        await pool.query(`DROP POLICY faculty_invitation_command_receipts_command_select
          ON lor_studio.faculty_invitation_command_receipts`);
        await pool.query(`CREATE POLICY faculty_invitation_command_receipts_command_select
          ON lor_studio.faculty_invitation_command_receipts
          FOR SELECT TO lor_studio_command_owner USING (
            case_id = pg_catalog.current_setting('lor_studio.case_id', true)
            AND student_auth_subject = pg_catalog.current_setting(
              'lor_studio.resource_student_id', true
            )
            AND pg_catalog.current_setting('lor_studio.operation', true) = ANY (ARRAY[
              'issue_faculty_invitation', 'resend_faculty_invitation_otp',
              'revoke_faculty_invitation', 'verify_faculty_invitation',
              'reserve_faculty_invitation_delivery',
              'mark_faculty_invitation_delivery_unknown',
              'commit_faculty_invitation_delivery'
            ]::text[])
          )`);
      },
    },
    {
      name: 'column ACL with unchanged total nonowner ACL count',
      mutate: async () => {
        await pool.query(`REVOKE SELECT ON TABLE
          lor_studio.faculty_invitation_command_receipts
          FROM lor_studio_command_owner`);
        await pool.query(`GRANT SELECT (case_id) ON
          lor_studio.faculty_invitation_command_receipts
          TO lor_studio_command_owner`);
      },
      restore: async () => {
        await pool.query(`REVOKE SELECT (case_id) ON
          lor_studio.faculty_invitation_command_receipts
          FROM lor_studio_command_owner`);
        await pool.query(`GRANT SELECT ON TABLE
          lor_studio.faculty_invitation_command_receipts
          TO lor_studio_command_owner`);
      },
    },
    {
      name: 'comment',
      mutate: async () => pool.query(`COMMENT ON COLUMN
        lor_studio.faculty_invitation_command_receipts.case_id
        IS 'adversarial custody drift'`),
      restore: async () => pool.query(`COMMENT ON COLUMN
        lor_studio.faculty_invitation_command_receipts.case_id IS NULL`),
    },
    {
      name: 'internal trigger state',
      mutate: async () => {
        const { rows: [trigger] } = await pool.query(`SELECT trigger.tgname
          FROM pg_catalog.pg_trigger AS trigger
          JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'lor_studio'
            AND class.relname = 'faculty_invitation_command_receipts'
            AND trigger.tgisinternal
          ORDER BY trigger.tgname
          LIMIT 1`);
        assert.ok(trigger?.tgname);
        internalTriggerName = trigger.tgname;
        await pool.query(`ALTER TABLE lor_studio.faculty_invitation_command_receipts
          DISABLE TRIGGER ${pg.escapeIdentifier(trigger.tgname)}`);
      },
      restore: async () => pool.query(`ALTER TABLE
        lor_studio.faculty_invitation_command_receipts
        ENABLE TRIGGER ${pg.escapeIdentifier(internalTriggerName)}`),
    },
    {
      name: 'incoming dependency',
      mutate: async () => pool.query(`CREATE VIEW public.faculty_invitation_dependency_drift
        AS SELECT receipt_id
        FROM lor_studio.faculty_invitation_command_receipts`),
      restore: async () => pool.query(
        'DROP VIEW public.faculty_invitation_dependency_drift',
      ),
    },
    {
      name: 'publication relation',
      mutate: async () => pool.query(`CREATE PUBLICATION faculty_invitation_drift_publication
        FOR TABLE lor_studio.faculty_invitation_command_receipts`),
      restore: async () => pool.query(
        'DROP PUBLICATION faculty_invitation_drift_publication',
      ),
    },
    {
      name: 'extended statistics',
      mutate: async () => pool.query(`CREATE STATISTICS
        lor_studio.faculty_invitation_drift_statistics
        ON case_id, invitation_id
        FROM lor_studio.faculty_invitation_command_receipts`),
      restore: async () => pool.query(
        'DROP STATISTICS lor_studio.faculty_invitation_drift_statistics',
      ),
    },
  ];

  for (const scenario of sameCountScenarios) {
    await scenario.mutate();
    await assertRollbackRejected(harness);
    await scenario.restore();
    assert.deepEqual(
      await readFingerprints(pool),
      baselineFingerprints,
      `${scenario.name} restoration must return the exact successor catalog`,
    );
  }
}

test('faculty invitation rollback statically inventories every hidden custody axis', async () => {
  const source = await readFile(rollbackPath, 'utf8');
  for (const required of [
    'attribute.attacl',
    'pg_catalog.obj_description',
    'pg_catalog.col_description',
    'pg_catalog.pg_seclabel',
    'trigger.tgisinternal',
    'pg_catalog.pg_depend',
    'pg_catalog.pg_index',
    'pg_catalog.pg_type',
    'type.typacl',
    'target_toast',
    'pg_catalog.pg_rewrite',
    'pg_catalog.pg_inherits',
    'pg_catalog.pg_publication_rel',
    'pg_catalog.pg_statistic_ext',
    'catalog_fingerprint',
    'index_fingerprint',
    'constraint_fingerprint',
    'dependency_fingerprint',
  ]) assert.match(source, new RegExp(required.replaceAll('.', '\\.'), 'u'));
  assert.match(
    source,
    /LOCK TABLE[\s\S]*lor_studio\.consent_receipts,[\s\S]*IN ACCESS EXCLUSIVE MODE;/u,
  );
  assert.doesNotMatch(source, /\bCASCADE\b/u);
  assert.equal(INVITATION_FUNCTION_IDENTITIES.length, 8);
  assert.equal(INVITATION_POLICY_NAMES.length, 23);
});

for (const toolchain of TOOLCHAINS) {
  test(`faculty invitation consent enforcement passes PostgreSQL ${toolchain.major}`, {
    skip: RUN_REAL_MATRIX ? false : 'set LOR_RUN_REAL_POSTGRES_MATRIX=1',
    timeout: 180_000,
  }, async () => {
    await withHarness(toolchain, async ({ harness, pool }) => {
      await applyForward(harness);
      await exerciseInvitationConsentEnforcement(pool);
    });
  });

  test(`faculty invitation exact rollback custody passes adversarial PostgreSQL ${toolchain.major}`, {
    skip: RUN_REAL_MATRIX ? false : 'set LOR_RUN_REAL_POSTGRES_MATRIX=1',
    timeout: 180_000,
  }, async () => {
    await withHarness(toolchain, async ({ harness, pool }) => {
      await applyForward(harness);
      assert.deepEqual(await readFingerprints(pool), EXPECTED_FINGERPRINTS[toolchain.major]);
      await exerciseAdversarialCustody({ harness, pool });
      assert.deepEqual(await readFingerprints(pool), EXPECTED_FINGERPRINTS[toolchain.major]);

      await harness.applySqlFile(rollbackPath.pathname);
      const { rows: [removed] } = await pool.query(`SELECT
        pg_catalog.to_regclass(
          'lor_studio.faculty_invitation_command_receipts'
        ) IS NULL AS receipt_table_absent,
        pg_catalog.to_regprocedure(
          'lor_studio.issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamptz,timestamptz,integer,bigint,bigint,text,text)'
        ) IS NULL AS issue_command_absent`);
      assert.deepEqual(removed, {
        receipt_table_absent: true,
        issue_command_absent: true,
      });

      await harness.applySqlFile(migrationPath.pathname);
      assert.deepEqual(await readFingerprints(pool), EXPECTED_FINGERPRINTS[toolchain.major]);
      await harness.applySqlFile(rollbackPath.pathname);
    });
  });
}
