import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import pg from 'pg';

import { createAtomicRlsCaseDriver } from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  NODE_POSTGRES_DATABASE_ROLE,
  createNodePostgresExecutor,
} from '../../lor-studio/adapters/node-postgres-executor.mjs';
import { SupabaseDurableRecommendationCaseRepository } from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';
import {
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

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
  '20260825010600_f2_lor_1012_faculty_private_export_commands.sql',
]);
const migrationsDirectory = new URL('../../scripts/lor-studio/migrations/', import.meta.url);
const rollbackPath = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010600_f2_lor_1012_faculty_private_export_commands.rollback.sql',
  import.meta.url,
);
const productionRollbackPath = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010700_f2_lor_1012_production_faculty_private_export_commands.rollback.sql',
  import.meta.url,
);
const EXPECTED_EXACT_CUSTODY_HASH = Object.freeze({
  16: 'cfa4fa8e9e13fc3dc787c8f8cf94af6e50deb205c41171e3048ce38bf93a82b7',
  18: '35fab7f464be14d86a64b05b5cb369eaa711b768fb78a864562c1ac39f60f1e0',
});
const BINDING = resolveLorTargetBinding({
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

export const ARTIFACT_EXPORT_CUSTODY_FINGERPRINT_SQL = String.raw`
WITH audit_class AS (
  SELECT class.*
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'artifact_export_audit_events'
),
table_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(pg_catalog.jsonb_build_object(
    'class', COALESCE((
      SELECT pg_catalog.jsonb_build_object(
        'relkind', class.relkind,
        'persistence', class.relpersistence,
        'rowSecurity', class.relrowsecurity,
        'forceRowSecurity', class.relforcerowsecurity,
        'replicaIdentity', class.relreplident,
        'isPartition', class.relispartition,
        'hasIndex', class.relhasindex,
        'checks', class.relchecks,
        'hasRules', class.relhasrules,
        'hasTriggers', class.relhastriggers,
        'natts', class.relnatts,
        'ownerIsCurrentUser', pg_catalog.pg_get_userbyid(class.relowner) = current_user,
        'options', pg_catalog.to_jsonb(class.reloptions)
      )
      FROM audit_class AS class
    ), 'null'::jsonb),
    'columns', COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'number', attribute.attnum,
        'name', attribute.attname,
        'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
        'notNull', attribute.attnotnull,
        'identity', attribute.attidentity,
        'generated', attribute.attgenerated,
        'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
          pg_catalog.format('%I.%I', collation_namespace.nspname, collation_row.collname)
        END,
        'default', pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true)
      ) ORDER BY attribute.attnum)
      FROM audit_class AS class
      JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = class.oid
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
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', constraint_row.conname,
        'type', constraint_row.contype,
        'deferrable', constraint_row.condeferrable,
        'deferred', constraint_row.condeferred,
        'validated', constraint_row.convalidated,
        'noInherit', constraint_row.connoinherit,
        'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
      ) ORDER BY constraint_row.conname)
      FROM audit_class AS class
      JOIN pg_catalog.pg_constraint AS constraint_row
        ON constraint_row.conrelid = class.oid
      WHERE constraint_row.contype <> 'n'
    ), '[]'::jsonb),
    'indexes', COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', index_class.relname,
        'accessMethod', access_method.amname,
        'tablespace', tablespace.spcname,
        'persistence', index_class.relpersistence,
        'options', pg_catalog.to_jsonb(index_class.reloptions),
        'attributeCount', index_row.indnatts,
        'keyAttributeCount', index_row.indnkeyatts,
        'unique', index_row.indisunique,
        'primary', index_row.indisprimary,
        'exclusion', index_row.indisexclusion,
        'immediate', index_row.indimmediate,
        'clustered', index_row.indisclustered,
        'valid', index_row.indisvalid,
        'checkXmin', index_row.indcheckxmin,
        'ready', index_row.indisready,
        'live', index_row.indislive,
        'replicaIdentity', index_row.indisreplident,
        'nullsNotDistinct', index_row.indnullsnotdistinct,
        'definition', pg_catalog.pg_get_indexdef(index_class.oid)
      ) ORDER BY index_class.relname)
      FROM audit_class AS class
      JOIN pg_catalog.pg_index AS index_row ON index_row.indrelid = class.oid
      JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
      JOIN pg_catalog.pg_am AS access_method ON access_method.oid = index_class.relam
      LEFT JOIN pg_catalog.pg_tablespace AS tablespace
        ON tablespace.oid = index_class.reltablespace
    ), '[]'::jsonb)
  )) AS value
),
function_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', procedure.proname,
      'arguments', pg_catalog.pg_get_function_identity_arguments(procedure.oid),
      'result', pg_catalog.pg_get_function_result(procedure.oid),
      'language', language.lanname,
      'kind', procedure.prokind,
      'volatility', procedure.provolatile,
      'parallel', procedure.proparallel,
      'strict', procedure.proisstrict,
      'securityDefiner', procedure.prosecdef,
      'leakproof', procedure.proleakproof,
      'cost', procedure.procost,
      'rows', procedure.prorows,
      'owner', pg_catalog.pg_get_userbyid(procedure.proowner),
      'config', pg_catalog.to_jsonb(procedure.proconfig),
      'argumentTypes', procedure.proargtypes::text,
      'allArgumentTypes', procedure.proallargtypes::text,
      'argumentModes', procedure.proargmodes::text,
      'argumentNames', procedure.proargnames::text,
      'bodyHash', pg_catalog.encode(pg_catalog.sha256(
        pg_catalog.convert_to(procedure.prosrc, 'UTF8')
      ), 'hex')
    ) ORDER BY procedure.proname), '[]'::jsonb
  )) AS value
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  JOIN pg_catalog.pg_language AS language ON language.oid = procedure.prolang
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.oid IN (
      pg_catalog.to_regprocedure(
        'lor_studio.append_artifact_export_audit(jsonb,text,text,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_final_document_export()'),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)'
      )
    )
),
policy_rows AS (
  SELECT
    class.relname,
    policy.polname,
    policy.polcmd,
    policy.polpermissive,
    COALESCE((
      SELECT pg_catalog.jsonb_agg(COALESCE(role.rolname, 'PUBLIC') ORDER BY
        COALESCE(role.rolname, 'PUBLIC'))
      FROM pg_catalog.unnest(policy.polroles) AS policy_role(role_oid)
      LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = policy_role.role_oid
    ), '[]'::jsonb) AS roles,
    pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, true) AS qualifier,
    pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, true) AS with_check
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname IN (
      'artifact_export_audit_events',
      'faculty_private_content',
      'released_student_documents'
    )
),
policy_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'relation', relname,
      'name', polname,
      'command', polcmd,
      'permissive', polpermissive,
      'roles', roles,
      'qualifier', qualifier,
      'withCheck', with_check
    ) ORDER BY relname, polname), '[]'::jsonb
  )) AS value
  FROM policy_rows
),
trigger_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', CASE WHEN trigger_row.tgisinternal THEN NULL ELSE trigger_row.tgname END,
      'internal', trigger_row.tgisinternal,
      'enabled', trigger_row.tgenabled,
      'type', trigger_row.tgtype,
      'deferrable', trigger_row.tgdeferrable,
      'initiallyDeferred', trigger_row.tginitdeferred,
      'constraint', constraint_row.conname,
      'referencedRelation', CASE WHEN referenced_class.oid IS NULL THEN NULL ELSE
        pg_catalog.format('%I.%I', referenced_namespace.nspname, referenced_class.relname)
      END,
      'hasParent', trigger_row.tgparentid <> 0,
      'attributes', trigger_row.tgattr::text,
      'when', pg_catalog.pg_get_expr(trigger_row.tgqual, trigger_row.tgrelid, true),
      'oldTransitionTable', trigger_row.tgoldtable,
      'newTransitionTable', trigger_row.tgnewtable,
      'arguments', pg_catalog.encode(trigger_row.tgargs, 'hex'),
      'functionSchema', function_namespace.nspname,
      'function', function_row.proname,
      'functionArguments', pg_catalog.pg_get_function_identity_arguments(function_row.oid),
      'functionBodyHash', pg_catalog.encode(pg_catalog.sha256(
        pg_catalog.convert_to(function_row.prosrc, 'UTF8')
      ), 'hex'),
      'definition', CASE WHEN trigger_row.tgisinternal THEN NULL ELSE
        pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
      END
    ) ORDER BY trigger_row.tgisinternal, constraint_row.conname,
      function_namespace.nspname, function_row.proname, trigger_row.tgtype,
      trigger_row.tgname), '[]'::jsonb
  )) AS value
  FROM audit_class AS class
  JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = class.oid
  JOIN pg_catalog.pg_proc AS function_row ON function_row.oid = trigger_row.tgfoid
  JOIN pg_catalog.pg_namespace AS function_namespace
    ON function_namespace.oid = function_row.pronamespace
  LEFT JOIN pg_catalog.pg_constraint AS constraint_row
    ON constraint_row.oid = trigger_row.tgconstraint
  LEFT JOIN pg_catalog.pg_class AS referenced_class
    ON referenced_class.oid = NULLIF(trigger_row.tgconstrrelid, 0)
  LEFT JOIN pg_catalog.pg_namespace AS referenced_namespace
    ON referenced_namespace.oid = referenced_class.relnamespace
),
receipt_constraint_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', constraint_row.conname,
      'type', constraint_row.contype,
      'deferrable', constraint_row.condeferrable,
      'deferred', constraint_row.condeferred,
      'validated', constraint_row.convalidated,
      'noInherit', constraint_row.connoinherit,
      'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
    ) ORDER BY constraint_row.conname), '[]'::jsonb
  )) AS value
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'recommendation_case_private_write_receipts'
    AND constraint_row.conname =
      'recommendation_case_private_write_receipts_command_type_known'
),
grant_rows AS (
  SELECT
    'relation'::text AS object_type,
    class.relname AS object_name,
    CASE
      WHEN acl.grantee = 0 THEN 'PUBLIC'
      WHEN acl.grantee = class.relowner THEN 'OWNER'
      ELSE role.rolname
    END AS grantee,
    acl.privilege_type,
    acl.is_grantable
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
    class.relacl,
    pg_catalog.acldefault('r', class.relowner)
  )) AS acl
  LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = acl.grantee
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname IN (
      'artifact_export_audit_events',
      'faculty_private_content',
      'recommendation_case_private_write_receipts',
      'released_student_documents'
    )
    AND acl.grantee <> class.relowner
  UNION ALL
  SELECT
    'column',
    class.relname || '.' || attribute.attname,
    CASE
      WHEN acl.grantee = 0 THEN 'PUBLIC'
      WHEN acl.grantee = class.relowner THEN 'OWNER'
      ELSE role.rolname
    END,
    acl.privilege_type,
    acl.is_grantable
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = class.oid
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
  LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = acl.grantee
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname IN (
      'artifact_export_audit_events',
      'faculty_private_content',
      'recommendation_case_private_write_receipts',
      'released_student_documents'
    )
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND acl.grantee <> class.relowner
  UNION ALL
  SELECT
    'function',
    procedure.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
    COALESCE(role.rolname, 'PUBLIC'),
    acl.privilege_type,
    acl.is_grantable
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
    procedure.proacl,
    pg_catalog.acldefault('f', procedure.proowner)
  )) AS acl
  LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = acl.grantee
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.oid IN (
      pg_catalog.to_regprocedure(
        'lor_studio.append_artifact_export_audit(jsonb,text,text,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_final_document_export()'),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)'
      )
    )
    AND acl.grantee <> procedure.proowner
),
grant_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'objectType', object_type,
      'objectName', object_name,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) ORDER BY object_type, object_name, grantee, privilege_type), '[]'::jsonb
  )) AS value
  FROM grant_rows
),
dependency_targets AS (
  SELECT 'table:artifact_export_audit_events'::text AS target_name,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid AS catalog_id,
    pg_catalog.to_regclass('lor_studio.artifact_export_audit_events')::oid AS object_id
  UNION ALL
  SELECT 'function:append_artifact_export_audit',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure(
      'lor_studio.append_artifact_export_audit(jsonb,text,text,text)'
    )::oid
  UNION ALL
  SELECT 'function:read_final_document_export',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure('lor_studio.read_final_document_export()')::oid
  UNION ALL
  SELECT 'function:commit_faculty_private_content',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure(
      'lor_studio.commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)'
    )::oid
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
    dependency.classid = target.catalog_id
    AND dependency.objid = target.object_id
  ) OR (
    dependency.refclassid = target.catalog_id
    AND dependency.refobjid = target.object_id
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
      objsubid, refobjsubid), '[]'::jsonb
  )) AS value
  FROM dependency_groups
),
metadata_targets AS (
  SELECT 'table:' || class.relname AS target_name,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid AS class_id,
    class.oid AS object_id,
    0::integer AS object_sub_id
  FROM audit_class AS class
  UNION ALL
  SELECT 'column:' || class.relname || '.' || attribute.attname,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    class.oid,
    attribute.attnum
  FROM audit_class AS class
  JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = class.oid
  WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
  UNION ALL
  SELECT 'index:' || index_class.relname,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    index_class.oid,
    0
  FROM audit_class AS class
  JOIN pg_catalog.pg_index AS index_row ON index_row.indrelid = class.oid
  JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
  UNION ALL
  SELECT 'constraint:' || constraint_row.conname,
    'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
    constraint_row.oid,
    0
  FROM audit_class AS class
  JOIN pg_catalog.pg_constraint AS constraint_row ON constraint_row.conrelid = class.oid
  UNION ALL
  SELECT 'type:' || type_row.typname,
    'pg_catalog.pg_type'::pg_catalog.regclass::oid,
    type_row.oid,
    0
  FROM audit_class AS class
  JOIN pg_catalog.pg_type AS type_row
    ON type_row.typrelid = class.oid OR type_row.typelem = class.reltype
  UNION ALL
  SELECT 'function:' || procedure.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    procedure.oid,
    0
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.oid IN (
      pg_catalog.to_regprocedure(
        'lor_studio.append_artifact_export_audit(jsonb,text,text,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_final_document_export()'),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_faculty_private_content(bigint,jsonb,text,text,jsonb,text)'
      )
    )
  UNION ALL
  SELECT 'policy:' || class.relname || '.' || policy.polname,
    'pg_catalog.pg_policy'::pg_catalog.regclass::oid,
    policy.oid,
    0
  FROM pg_catalog.pg_policy AS policy
  JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND policy.polname IN (
      'faculty_private_content_faculty_command_insert',
      'released_student_documents_student_export_select',
      'artifact_export_audit_events_command_insert',
      'artifact_export_audit_events_command_select'
    )
  UNION ALL
  SELECT 'trigger:' || trigger_row.tgname,
    'pg_catalog.pg_trigger'::pg_catalog.regclass::oid,
    trigger_row.oid,
    0
  FROM audit_class AS class
  JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = class.oid
  UNION ALL
  SELECT 'constraint:' || constraint_row.conname,
    'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
    constraint_row.oid,
    0
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'recommendation_case_private_write_receipts'
    AND constraint_row.conname =
      'recommendation_case_private_write_receipts_command_type_known'
),
metadata_rows AS (
  SELECT target.target_name,
    'comment'::text AS metadata_kind,
    NULL::text AS provider,
    description.description AS metadata_value
  FROM metadata_targets AS target
  JOIN pg_catalog.pg_description AS description
    ON description.classoid = target.class_id
   AND description.objoid = target.object_id
   AND description.objsubid = target.object_sub_id
  UNION ALL
  SELECT target.target_name,
    'security_label',
    security_label.provider,
    security_label.label
  FROM metadata_targets AS target
  JOIN pg_catalog.pg_seclabel AS security_label
    ON security_label.classoid = target.class_id
   AND security_label.objoid = target.object_id
   AND security_label.objsubid = target.object_sub_id
),
metadata_fingerprint AS (
  SELECT lor_studio.canonical_jsonb_sha256(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'target', target_name,
      'kind', metadata_kind,
      'provider', provider,
      'value', metadata_value
    ) ORDER BY target_name, metadata_kind, provider), '[]'::jsonb
  )) AS value
  FROM metadata_rows
)
SELECT
  (SELECT value FROM table_fingerprint) AS table_fingerprint,
  (SELECT value FROM function_fingerprint) AS function_fingerprint,
  (SELECT value FROM policy_fingerprint) AS policy_fingerprint,
  (SELECT value FROM trigger_fingerprint) AS trigger_fingerprint,
  (SELECT value FROM receipt_constraint_fingerprint) AS receipt_constraint_fingerprint,
  (SELECT value FROM grant_fingerprint) AS grant_fingerprint,
  (SELECT value FROM dependency_fingerprint) AS dependency_fingerprint,
  (SELECT value FROM metadata_fingerprint) AS metadata_fingerprint`;

const EXPECTED_FINGERPRINTS = Object.freeze({
  table_fingerprint: '526be962fef863864d982940a8a6ad47bfad6f5341777e104e0cef63d4b276eb',
  function_fingerprint: '174743488bf6957e49086682fc9c9a8fa28c262f0dcb0d75953ad2e4f900acb9',
  policy_fingerprint: 'abf9cad0a6de27fdf0fddf2819e8a206d490853c85c055c80c1f0b19a429d887',
  trigger_fingerprint: 'cab1823e9cc012de645f8fe200489d40ea5a0202a39cd6fde509aca14c1d6039',
  receipt_constraint_fingerprint: 'aaad35a52f81078a4d7146b255562ae3077d71e0cf18ff97ad5e9e83e98943db',
  grant_fingerprint: '15cf60b890b2bcd0ac3b9c4756218a5e45de813f7a7dd80dbb22930a152d1e75',
  dependency_fingerprint: '08134cddaea4e280f6a73ef78cf7fefe0ab720c997cbb952fbd414ae5d284fc3',
  metadata_fingerprint: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
});

function binaries(root) {
  return Object.freeze({
    initdb: path.join(root, 'initdb'),
    pgCtl: path.join(root, 'pg_ctl'),
    createdb: path.join(root, 'createdb'),
    psql: path.join(root, 'psql'),
  });
}

function extractExactCustodySql(source) {
  const match = source.match(
    /-- BEGIN ARTIFACT_ROLLBACK_CUSTODY_SNAPSHOT\n([\s\S]*?)  -- END ARTIFACT_ROLLBACK_CUSTODY_SNAPSHOT/u,
  );
  assert.ok(match, 'artifact exact-custody snapshot marker is required');
  const query = match[1].replace(
    /SELECT lor_studio\.canonical_jsonb_sha256\(snapshot\.value\)\n  INTO snapshot_hash\n  FROM snapshot;/u,
    'SELECT lor_studio.canonical_jsonb_sha256(snapshot.value) AS snapshot_hash FROM snapshot;',
  );
  assert.notEqual(query, match[1], 'snapshot must expose one test-readable hash');
  return query;
}

async function readExactCustodyHash(pool, exactSnapshotSql) {
  const { rows } = await pool.query(exactSnapshotSql);
  assert.equal(rows.length, 1);
  return rows[0].snapshot_hash;
}

test('106/107 exact artifact-custody snapshots are semantic twins with every destructive axis', async () => {
  const [localRollback, productionRollback] = await Promise.all([
    readFile(rollbackPath, 'utf8'),
    readFile(productionRollbackPath, 'utf8'),
  ]);
  const localSnapshot = extractExactCustodySql(localRollback);
  const productionSnapshot = extractExactCustodySql(productionRollback);
  assert.equal(productionSnapshot, localSnapshot);
  for (const required of [
    'pg_attribute', 'attacl', 'attstorage', 'attcompression', 'attstattarget',
    'attoptions', 'attmissingval', 'pg_attrdef', 'pg_constraint', 'conenforced',
    "contype='n'", 'pg_index', 'indisclustered', 'indisreplident',
    'target_toast', 'pg_type', 'typacl', 'pg_trigger', 'tgisinternal',
    'tgenabled', 'pg_policy', 'pg_rewrite', 'pg_inherits', 'pg_depend',
    'pg_publication_rel', 'pg_statistic_ext', 'pg_description', 'pg_seclabel',
    'pg_get_functiondef', 'proconfig', 'aclexplode',
  ]) {
    assert.match(localSnapshot, new RegExp(required, 'u'), required);
  }
  assert.doesNotMatch(localRollback, /\bCASCADE\b/u);
  assert.doesNotMatch(productionRollback, /\bCASCADE\b/u);
  for (const hash of Object.values(EXPECTED_EXACT_CUSTODY_HASH)) {
    assert.match(localRollback, new RegExp(hash, 'u'));
    assert.match(productionRollback, new RegExp(hash, 'u'));
  }
});

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

async function readFingerprints(pool) {
  const { rows: [fingerprints] } = await pool.query(
    ARTIFACT_EXPORT_CUSTODY_FINGERPRINT_SQL,
  );
  return fingerprints;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createStudentService(pool, { actorSubject, actorUid, caseId, now }) {
  const executor = createNodePostgresExecutor({
    pool,
    databaseRole: NODE_POSTGRES_DATABASE_ROLE,
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider: async ({ caseId: requestedCaseId, operation, resourceStudentId }) => ({
      schemaVersion: 'missionmed.lor.server-query-scope.v1',
      authoritySource: 'server_verified_session_crosswalk',
      authenticated: true,
      roleVerified: true,
      authUid: actorUid,
      authenticatedSubject: actorSubject,
      actorId: actorSubject,
      actorRole: 'student',
      resourceStudentId: resourceStudentId || actorSubject,
      caseId: requestedCaseId,
      operation,
      purpose: operation === 'read' ? 'student_case_read' : 'student_case_write',
      assignmentId: null,
      invitationId: null,
      administrativeGrantId: null,
      entitlementVerified: true,
      lorEnabled: true,
      canaryAuthorized: true,
    }),
  });
  return new RecommendationCaseService({
    repository,
    entitlementPort: {
      async getStudentEntitlement() {
        return {
          studentId: actorSubject,
          producerStatus: 'VERIFIED',
          revoked: false,
          active: true,
          tier: 'tier3_360',
          lorEnabled: true,
        };
      },
    },
    clock: () => new Date(now),
    caseIdFactory: () => caseId,
    protectedIdFactory: () => 'artifact-binding-session',
  });
}

async function assertRollbackRejected(harness) {
  await assert.rejects(
    () => harness.applySqlFile(rollbackPath.pathname),
    (error) => error?.code === 'SQL_FILE_APPLY_FAILED',
  );
}

async function assertStudentNullArtifactBindingRejected(pool) {
  const actorSubject = 'wp:401';
  const actorUid = '445fb648-06cf-46f1-ac4d-f1924cbaff19';
  const caseId = 'case_artifact_binding_0001';
  const now = new Date().toISOString();
  const event = {
    schemaVersion: 1,
    eventId: randomUUID(),
    type: 'artifact.generated',
    at: now,
    actorRole: 'student',
    actorRef: sha256(`lor-studio:actor:${actorSubject}`).slice(0, 24),
    caseRef: sha256(`lor-studio:case:${caseId}`).slice(0, 24),
    targetRef: sha256('lor-studio:target:released-document').slice(0, 24),
    outcome: 'success',
    metadata: {
      action: 'export_final_document',
      artifactFormat: 'docx',
      result: 'student_visible',
      artifactSha256: sha256('synthetic DOCX bytes'),
      releaseDocumentHash: null,
      sourceRevision: 0,
    },
  };
  const { rows: [{ event_hash: eventHash }] } = await pool.query({
    text: `SELECT lor_studio.canonical_jsonb_sha256($1::jsonb) AS event_hash`,
    values: [event],
  });

  await assert.rejects(
    () => pool.query({
      text: `INSERT INTO lor_studio.artifact_export_audit_events (
        event_id, case_id, student_auth_subject, actor_auth_subject, actor_role,
        event_type, outcome, event_hash, scope_hash, target_binding_hash,
        artifact_sha256, release_document_hash, source_revision, event,
        transaction_id, committed_at
      ) VALUES (
        $1::uuid, $2, $3, $3, 'student', 'artifact.generated', 'success',
        $4, $5, $6, $7, NULL, 0, $8::jsonb, '1', $9::timestamptz
      )`,
      values: [
        event.eventId, caseId, actorSubject, eventHash, sha256('scope'),
        sha256('target'), event.metadata.artifactSha256, event, now,
      ],
    }),
    (error) => error?.constraint === 'artifact_export_audit_events_artifact_binding',
  );

  await pool.query({
    text: `INSERT INTO lor_studio.student_auth_bindings (
      binding_id, student_auth_subject, student_auth_uid, binding_source,
      source_reference_hash, proof_hash, bound_at, expires_at, created_at
    ) VALUES ($1, $2, $3::uuid, 'wordpress_verified_bootstrap', $4, $5,
      pg_catalog.statement_timestamp() - interval '1 minute', NULL,
      pg_catalog.statement_timestamp())`,
    values: ['binding_artifact_0001', actorSubject, actorUid, sha256('source'), sha256('proof')],
  });
  await createStudentService(pool, { actorSubject, actorUid, caseId, now }).createCase({
    actor: { id: actorSubject, role: 'student' },
    idempotencyKey: 'artifact-binding-create',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query('SET LOCAL ROLE lor_studio_app');
    await client.query({
      text: `SELECT
        pg_catalog.set_config('request.jwt.claim.sub', $1, true),
        pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
        pg_catalog.set_config('lor_studio.actor_role', 'student', true),
        pg_catalog.set_config('lor_studio.resource_student_id', $2, true),
        pg_catalog.set_config('lor_studio.case_id', $3, true),
        pg_catalog.set_config('lor_studio.operation', 'read', true),
        pg_catalog.set_config('lor_studio.purpose', 'student_case_read', true),
        pg_catalog.set_config('lor_studio.entitlement_verified', 'true', true),
        pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
        pg_catalog.set_config('lor_studio.canary_authorized', 'true', true)`,
      values: [actorUid, actorSubject, caseId],
    });
    await assert.rejects(
      () => client.query({
        text: `SELECT lor_studio.append_artifact_export_audit(
          $1::jsonb, $2, $3, $4
        )`,
        values: [event, eventHash, sha256('scope'), sha256('target')],
      }),
      (error) => error?.code === 'P1005',
    );
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

async function assertContainedDriftRejected({
  harness,
  pool,
  exactSnapshotSql,
  expectedExactHash,
  postgresMajor,
}) {
  const { rows: [{ definition: originalFunction }] } = await pool.query(`SELECT
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'lor_studio.read_final_document_export()'
    )) AS definition`);
  const { rows: [{ definition: originalConstraint }] } = await pool.query(`SELECT
    pg_catalog.pg_get_constraintdef(constraint_row.oid, true) AS definition
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = 'recommendation_case_private_write_receipts'
      AND constraint_row.conname =
        'recommendation_case_private_write_receipts_command_type_known'`);
  const { rows: [eventAttributePreimage] } = await pool.query(`SELECT
      attribute.attcompression
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid =
        'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
      AND attribute.attname = 'event'`);
  const scenarios = [
    {
      mutate: () => pool.query('CREATE INDEX artifact_export_audit_events_contained_drift_idx ON lor_studio.artifact_export_audit_events (case_id)'),
      restore: () => pool.query('DROP INDEX lor_studio.artifact_export_audit_events_contained_drift_idx'),
    },
    {
      mutate: () => pool.query('CREATE POLICY artifact_export_audit_events_contained_drift ON lor_studio.artifact_export_audit_events FOR SELECT TO lor_studio_command_owner USING (false)'),
      restore: () => pool.query('DROP POLICY artifact_export_audit_events_contained_drift ON lor_studio.artifact_export_audit_events'),
    },
    {
      mutate: () => pool.query('CREATE TRIGGER artifact_export_audit_events_contained_drift BEFORE UPDATE ON lor_studio.artifact_export_audit_events FOR EACH ROW EXECUTE FUNCTION lor_studio.reject_append_only_mutation()'),
      restore: () => pool.query('DROP TRIGGER artifact_export_audit_events_contained_drift ON lor_studio.artifact_export_audit_events'),
    },
    {
      mutate: () => pool.query(`CREATE OR REPLACE FUNCTION lor_studio.read_final_document_export()
        RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
        AS $$ BEGIN RETURN '{}'::jsonb; END $$`),
      restore: () => pool.query(originalFunction),
    },
    {
      mutate: () => pool.query(`ALTER FUNCTION lor_studio.read_final_document_export()
        SET work_mem = '64kB'`),
      restore: () => pool.query(`ALTER FUNCTION lor_studio.read_final_document_export()
        RESET work_mem`),
    },
    {
      mutate: () => pool.query(`GRANT EXECUTE ON FUNCTION
        lor_studio.read_final_document_export() TO PUBLIC`),
      restore: () => pool.query(`REVOKE EXECUTE ON FUNCTION
        lor_studio.read_final_document_export() FROM PUBLIC`),
    },
    {
      mutate: async () => {
        await pool.query(`ALTER TABLE lor_studio.recommendation_case_private_write_receipts
          DROP CONSTRAINT recommendation_case_private_write_receipts_command_type_known`);
        await pool.query(`ALTER TABLE lor_studio.recommendation_case_private_write_receipts
          ADD CONSTRAINT recommendation_case_private_write_receipts_command_type_known
          CHECK (command_type IN ('faculty.final_document_release',
            'faculty.private_content_update', 'contained.drift'))`);
      },
      restore: async () => {
        await pool.query(`ALTER TABLE lor_studio.recommendation_case_private_write_receipts
          DROP CONSTRAINT recommendation_case_private_write_receipts_command_type_known`);
        await pool.query(`ALTER TABLE lor_studio.recommendation_case_private_write_receipts
          ADD CONSTRAINT recommendation_case_private_write_receipts_command_type_known ${originalConstraint}`);
      },
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN event_hash DROP NOT NULL`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN event_hash SET NOT NULL`),
    },
    ...(postgresMajor >= 18 ? [{
      mutate: () => pool.query(`UPDATE pg_catalog.pg_constraint
        SET conenforced = false
        WHERE conrelid =
            'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
          AND contype = 'n'
          AND conkey = ARRAY[(SELECT attnum
            FROM pg_catalog.pg_attribute
            WHERE attrelid =
                'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
              AND attname = 'event_hash')]::smallint[]`),
      restore: () => pool.query(`UPDATE pg_catalog.pg_constraint
        SET conenforced = true
        WHERE conrelid =
            'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
          AND contype = 'n'
          AND conkey = ARRAY[(SELECT attnum
            FROM pg_catalog.pg_attribute
            WHERE attrelid =
                'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
              AND attname = 'event_hash')]::smallint[]`),
    }] : []),
    {
      mutate: () => pool.query('GRANT SELECT ON lor_studio.artifact_export_audit_events TO lor_studio_app'),
      restore: () => pool.query('REVOKE SELECT ON lor_studio.artifact_export_audit_events FROM lor_studio_app'),
    },
    {
      mutate: () => pool.query('GRANT SELECT (event_hash) ON lor_studio.artifact_export_audit_events TO lor_studio_app'),
      restore: () => pool.query('REVOKE SELECT (event_hash) ON lor_studio.artifact_export_audit_events FROM lor_studio_app'),
    },
    {
      mutate: () => pool.query(`GRANT USAGE ON TYPE
        lor_studio.artifact_export_audit_events TO lor_studio_app`),
      restore: async () => {
        await pool.query(`REVOKE USAGE ON TYPE
          lor_studio.artifact_export_audit_events FROM lor_studio_app`);
        await pool.query(`UPDATE pg_catalog.pg_type SET typacl = NULL
          WHERE oid =
            'lor_studio.artifact_export_audit_events'::pg_catalog.regtype`);
      },
    },
    {
      mutate: () => pool.query("COMMENT ON COLUMN lor_studio.artifact_export_audit_events.event_hash IS 'contained custody drift'"),
      restore: () => pool.query('COMMENT ON COLUMN lor_studio.artifact_export_audit_events.event_hash IS NULL'),
    },
    {
      mutate: () => pool.query(`COMMENT ON TYPE
        lor_studio.artifact_export_audit_events IS 'contained custody drift'`),
      restore: () => pool.query(`COMMENT ON TYPE
        lor_studio.artifact_export_audit_events IS NULL`),
    },
    {
      mutate: () => pool.query(`INSERT INTO pg_catalog.pg_seclabel (
          objoid, classoid, objsubid, provider, label
        )
        SELECT class.oid, 'pg_catalog.pg_class'::pg_catalog.regclass::oid,
          0, 'missionmed_custody_test', 'contained custody drift'
        FROM pg_catalog.pg_class AS class
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = class.relnamespace
        WHERE namespace.nspname = 'lor_studio'
          AND class.relname = 'artifact_export_audit_events'`),
      restore: () => pool.query(`DELETE FROM pg_catalog.pg_seclabel
        WHERE classoid = 'pg_catalog.pg_class'::pg_catalog.regclass::oid
          AND objoid = 'lor_studio.artifact_export_audit_events'::pg_catalog.regclass::oid
          AND objsubid = 0
          AND provider = 'missionmed_custody_test'`),
    },
    {
      mutate: () => pool.query(`DO $contained_drift$
        DECLARE trigger_name name;
        BEGIN
          SELECT trigger_row.tgname INTO STRICT trigger_name
          FROM pg_catalog.pg_trigger AS trigger_row
          WHERE trigger_row.tgrelid =
              'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
            AND trigger_row.tgisinternal
          ORDER BY trigger_row.tgname
          LIMIT 1;
          EXECUTE pg_catalog.format(
            'ALTER TABLE lor_studio.artifact_export_audit_events DISABLE TRIGGER %I',
            trigger_name
          );
        END
        $contained_drift$`),
      restore: () => pool.query(`DO $contained_drift$
        DECLARE trigger_name name;
        BEGIN
          SELECT trigger_row.tgname INTO STRICT trigger_name
          FROM pg_catalog.pg_trigger AS trigger_row
          WHERE trigger_row.tgrelid =
              'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
            AND trigger_row.tgisinternal
          ORDER BY trigger_row.tgname
          LIMIT 1;
          EXECUTE pg_catalog.format(
            'ALTER TABLE lor_studio.artifact_export_audit_events ENABLE TRIGGER %I',
            trigger_name
          );
        END
        $contained_drift$`),
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        CLUSTER ON artifact_export_audit_events_pkey`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        SET WITHOUT CLUSTER`),
    },
    {
      mutate: () => pool.query(`ALTER INDEX lor_studio.artifact_export_audit_events_pkey
        SET (fillfactor = 70)`),
      restore: () => pool.query(`ALTER INDEX lor_studio.artifact_export_audit_events_pkey
        RESET (fillfactor)`),
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        SET (autovacuum_enabled = false)`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        RESET (autovacuum_enabled)`),
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        SET (toast.autovacuum_enabled = false)`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        RESET (toast.autovacuum_enabled)`),
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN case_id SET DEFAULT 'contained-custody-drift'`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN case_id DROP DEFAULT`),
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN event SET STORAGE EXTERNAL`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN event SET STORAGE EXTENDED`),
    },
    {
      mutate: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN event SET STATISTICS 101`),
      restore: () => pool.query(`ALTER TABLE lor_studio.artifact_export_audit_events
        ALTER COLUMN event SET STATISTICS -1`),
    },
    {
      mutate: () => pool.query(`UPDATE pg_catalog.pg_attribute
        SET attcompression = CASE WHEN attcompression = 'p'::\"char\"
          THEN 'l'::\"char\" ELSE 'p'::\"char\" END
        WHERE attrelid =
            'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
          AND attname = 'event'`),
      restore: () => pool.query({
        text: `UPDATE pg_catalog.pg_attribute SET attcompression = $1::\"char\"
          WHERE attrelid =
              'lor_studio.artifact_export_audit_events'::pg_catalog.regclass
            AND attname = 'event'`,
        values: [eventAttributePreimage.attcompression],
      }),
    },
    {
      mutate: () => pool.query('CREATE VIEW lor_studio.artifact_export_audit_events_contained_drift AS SELECT event_id FROM lor_studio.artifact_export_audit_events'),
      restore: () => pool.query('DROP VIEW lor_studio.artifact_export_audit_events_contained_drift'),
    },
    {
      mutate: () => pool.query(`CREATE RULE artifact_export_contained_drift_rule AS
        ON DELETE TO lor_studio.artifact_export_audit_events DO INSTEAD NOTHING`),
      restore: async () => {
        await pool.query(`DROP RULE artifact_export_contained_drift_rule
          ON lor_studio.artifact_export_audit_events`);
        await pool.query(`UPDATE pg_catalog.pg_class SET relhasrules = false
          WHERE oid =
            'lor_studio.artifact_export_audit_events'::pg_catalog.regclass`);
      },
    },
    {
      mutate: () => pool.query(`CREATE TABLE
        lor_studio.artifact_export_contained_drift_child ()
        INHERITS (lor_studio.artifact_export_audit_events)`),
      restore: async () => {
        await pool.query(`DROP TABLE
          lor_studio.artifact_export_contained_drift_child`);
        await pool.query(`UPDATE pg_catalog.pg_class SET relhassubclass = false
          WHERE oid =
            'lor_studio.artifact_export_audit_events'::pg_catalog.regclass`);
      },
    },
    {
      mutate: () => pool.query(`CREATE PUBLICATION
        artifact_export_contained_drift_publication
        FOR TABLE lor_studio.artifact_export_audit_events`),
      restore: () => pool.query(`DROP PUBLICATION
        artifact_export_contained_drift_publication`),
    },
    {
      mutate: () => pool.query(`CREATE STATISTICS
        lor_studio.artifact_export_contained_drift_statistics
        ON case_id, student_auth_subject
        FROM lor_studio.artifact_export_audit_events`),
      restore: () => pool.query(`DROP STATISTICS
        lor_studio.artifact_export_contained_drift_statistics`),
    },
  ];
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    await scenario.mutate();
    assert.notEqual(
      await readExactCustodyHash(pool, exactSnapshotSql),
      expectedExactHash,
    );
    await assertRollbackRejected(harness);
    await scenario.restore();
    assert.deepEqual(
      await readFingerprints(pool),
      EXPECTED_FINGERPRINTS,
      `scenario ${scenarioIndex} legacy fingerprint restore`,
    );
    assert.equal(
      await readExactCustodyHash(pool, exactSnapshotSql),
      expectedExactHash,
      `scenario ${scenarioIndex} exact fingerprint restore`,
    );
  }
}

test('artifact-export rollback fingerprints are stable on PostgreSQL 16 and 18', {
  skip: RUN_REAL_MATRIX ? false : 'set LOR_RUN_REAL_POSTGRES_MATRIX=1',
  timeout: 120_000,
}, async (matrix) => {
  const exactSnapshotSql = extractExactCustodySql(
    await readFile(rollbackPath, 'utf8'),
  );
  for (const toolchain of TOOLCHAINS) {
    await matrix.test(`PostgreSQL ${toolchain.major} exact fingerprints`, {
      timeout: 60_000,
    }, async () => {
      await withHarness(toolchain, async ({ harness, pool }) => {
        await applyForward(harness);
        assert.deepEqual(await readFingerprints(pool), EXPECTED_FINGERPRINTS);
        assert.equal(
          await readExactCustodyHash(pool, exactSnapshotSql),
          EXPECTED_EXACT_CUSTODY_HASH[toolchain.major],
        );
        await assertStudentNullArtifactBindingRejected(pool);
        await assertContainedDriftRejected({
          harness,
          pool,
          exactSnapshotSql,
          expectedExactHash: EXPECTED_EXACT_CUSTODY_HASH[toolchain.major],
          postgresMajor: toolchain.major,
        });
        await harness.applySqlFile(rollbackPath.pathname);
        await harness.applySqlFile(path.resolve(
          migrationsDirectory.pathname,
          MIGRATION_NAMES.at(-1),
        ));
        assert.deepEqual(await readFingerprints(pool), EXPECTED_FINGERPRINTS);
        assert.equal(
          await readExactCustodyHash(pool, exactSnapshotSql),
          EXPECTED_EXACT_CUSTODY_HASH[toolchain.major],
        );
      });
    });
  }
});
