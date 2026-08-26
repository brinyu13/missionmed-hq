-- Rollback: 20260825011000_f2_lor_1012_student_evidence_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-133
-- Reverses: 20260825011000_f2_lor_1012_student_evidence_commands.sql
-- Boundary: exact disposable PostgreSQL 16/18 harness only

BEGIN;

DO $identity_guard$
DECLARE
  database_suffix text;
  admin_suffix text;
  data_directory text := pg_catalog.current_setting('data_directory');
  socket_directories text := pg_catalog.current_setting('unix_socket_directories');
  harness_root text;
  expected_sentinel text;
  observed_sentinel text;
  database_owner name;
  schema_owner name;
BEGIN
  database_suffix := pg_catalog.substring(
    pg_catalog.current_database(), '^lorh_db_([a-f0-9]{20})$'
  );
  admin_suffix := pg_catalog.substring(current_user, '^lorh_admin_([a-f0-9]{20})$');
  harness_root := pg_catalog.regexp_replace(data_directory, '/d$', '');
  SELECT pg_catalog.pg_get_userbyid(database.datdba)
  INTO database_owner
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = pg_catalog.current_database();
  SELECT pg_catalog.pg_get_userbyid(namespace.nspowner),
         pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO schema_owner, observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  expected_sentinel := pg_catalog.format(
    'missionmed.lor.disposable-postgres-harness.v1|database=%s|admin=%s|root=%s|foundation=20260820180700|identityScope=20260825010200|facultyInvitationCommands=20260825010400|facultyPrivateExportCommands=20260825010600|aiProposalCommands=20260825010800|studentEvidenceCommands=20260825011000',
    pg_catalog.current_database(), current_user, harness_root
  );
  IF pg_catalog.current_setting('server_version_num')::integer / 10000 NOT IN (16, 18)
    OR database_suffix IS NULL
    OR admin_suffix IS DISTINCT FROM database_suffix
    OR session_user IS DISTINCT FROM current_user
    OR database_owner IS DISTINCT FROM current_user
    OR schema_owner IS DISTINCT FROM current_user
    OR pg_catalog.inet_server_addr() IS NOT NULL
    OR pg_catalog.current_setting('listen_addresses') <> ''
    OR data_directory !~ '^/.+/f2lorpg-[A-Za-z0-9_-]{6,}/d$'
    OR harness_root = data_directory
    OR socket_directories IS DISTINCT FROM harness_root || '/s'
    OR socket_directories LIKE '%,%'
    OR observed_sentinel IS DISTINCT FROM expected_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 evidence rollback requires the exact successor-bound disposable harness identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.student_evidence_records,
  lor_studio.consent_receipts,
  lor_studio.faculty_invitations,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_case_protected_revision_states,
  lor_studio.recommendation_case_write_receipts,
  lor_studio.recommendation_cases
IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE evidence_rollback_preflight_counts (
  relation_count bigint NOT NULL,
  forced_rls_count bigint NOT NULL,
  definer_count bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO evidence_rollback_preflight_counts
SELECT
  (SELECT pg_catalog.count(*)
   FROM pg_catalog.pg_class AS class
   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'),
  (SELECT pg_catalog.count(*)
   FROM pg_catalog.pg_class AS class
   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
   WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
     AND class.relrowsecurity AND class.relforcerowsecurity),
  (SELECT pg_catalog.count(*)
   FROM pg_catalog.pg_proc AS procedure
   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
   WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef
     AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner');

DO $exact_catalog_guard$
DECLARE
  postgres_major integer := pg_catalog.current_setting('server_version_num')::integer / 10000;
  snapshot_hash text;
  expected_snapshot_hash text;
BEGIN
  -- BEGIN STUDENT_EVIDENCE_ROLLBACK_CUSTODY_SNAPSHOT
  WITH target_relations AS (
    SELECT class.oid, class.relname, class.reltoastrelid, class.reltype
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = ANY (ARRAY[
        'recommendation_case_write_receipts',
        'student_evidence_records'
      ]::text[])
      AND class.relkind IN ('r', 'p')
  ),
  acl_relations AS (
    SELECT class.oid, class.relname, class.relowner, class.relacl
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = ANY (ARRAY[
        'recommendation_case_write_receipts',
        'student_evidence_records'
      ]::text[])
  ),
  target_toast AS (
    SELECT relation.relname AS base_relation, toast.*
    FROM target_relations AS relation
    JOIN pg_catalog.pg_class AS toast ON toast.oid = relation.reltoastrelid
  ),
  target_types AS (
    SELECT relation.relname AS base_relation, 'row'::text AS type_kind,
      type_row.*, namespace.nspname AS namespace_name
    FROM target_relations AS relation
    JOIN pg_catalog.pg_type AS type_row ON type_row.oid = relation.reltype
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type_row.typnamespace
    UNION ALL
    SELECT relation.relname, 'array'::text,
      array_type.*, namespace.nspname
    FROM target_relations AS relation
    JOIN pg_catalog.pg_type AS row_type ON row_type.oid = relation.reltype
    JOIN pg_catalog.pg_type AS array_type ON array_type.oid = row_type.typarray
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = array_type.typnamespace
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
      index_class.relacl AS class_acl,
      relation.relation_key,
      index_namespace.nspname AS index_namespace_name,
      access_method.amname AS access_method_name,
      tablespace.spcname AS tablespace_name
    FROM index_relations AS relation
    JOIN pg_catalog.pg_index AS index_row ON index_row.indrelid = relation.oid
    JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
    JOIN pg_catalog.pg_namespace AS index_namespace
      ON index_namespace.oid = index_class.relnamespace
    LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = index_class.relam
    LEFT JOIN pg_catalog.pg_tablespace AS tablespace
      ON tablespace.oid = index_class.reltablespace
  ),
  target_functions AS (
    SELECT procedure.*, namespace.nspname AS namespace_name,
      language.lanname AS language_name
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    JOIN pg_catalog.pg_language AS language ON language.oid = procedure.prolang
    WHERE procedure.oid = ANY (ARRAY[
      pg_catalog.to_regprocedure(
        'lor_studio.student_evidence_record_is_complete(jsonb,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.build_student_safe_case_state(text,text,bigint,text,timestamptz,timestamptz,timestamptz,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()'),
      pg_catalog.to_regprocedure(
        'lor_studio.read_faculty_drafting_context_pre_evidence()'
      )
    ]::oid[])
  ),
  target_policies AS (
    SELECT policy.*, class.relname,
      COALESCE((
        SELECT pg_catalog.jsonb_agg(
          COALESCE(role.rolname, 'PUBLIC') ORDER BY COALESCE(role.rolname, 'PUBLIC')
        )
        FROM pg_catalog.unnest(policy.polroles) AS policy_role(role_oid)
        LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = policy_role.role_oid
      ), '[]'::jsonb) AS role_names
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = ANY (ARRAY[
        'recommendation_case_write_receipts',
        'student_evidence_records'
      ]::text[])
  ),
  relation_rows AS (
    SELECT relation.relname AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'catalog', (
          pg_catalog.to_jsonb(class) - ARRAY[
            'oid', 'relnamespace', 'reltype', 'reloftype', 'relowner', 'relam',
            'relfilenode', 'reltablespace', 'relpages', 'reltuples',
            'relallvisible', 'reltoastrelid', 'relfrozenxid', 'relminmxid',
            'relacl', 'relrewrite', 'relpartbound', 'relnatts'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'owner', CASE pg_catalog.pg_get_userbyid(class.relowner)
            WHEN current_user THEN 'MIGRATION_ADMIN'
            ELSE pg_catalog.pg_get_userbyid(class.relowner)
          END,
          'aclIsNull', class.relacl IS NULL,
          'liveColumnCount', (
            SELECT pg_catalog.count(*)
            FROM pg_catalog.pg_attribute AS live_attribute
            WHERE live_attribute.attrelid = class.oid
              AND live_attribute.attnum > 0
              AND NOT live_attribute.attisdropped
          ),
          'accessMethod', access_method.amname,
          'tablespace', COALESCE(tablespace.spcname, 'DATABASE_DEFAULT'),
          'partitionBound', pg_catalog.pg_get_expr(class.relpartbound, class.oid, true)
        )
      ) AS value
    FROM target_relations AS relation
    JOIN pg_catalog.pg_class AS class ON class.oid = relation.oid
    LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = class.relam
    LEFT JOIN pg_catalog.pg_tablespace AS tablespace ON tablespace.oid = class.reltablespace
  ),
  toast_rows AS (
    SELECT toast.base_relation AS sort_key,
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
          'aclIsNull', toast.relacl IS NULL,
          'accessMethod', access_method.amname,
          'tablespace', COALESCE(tablespace.spcname, 'DATABASE_DEFAULT')
        )
      ) AS value
    FROM target_toast AS toast
    LEFT JOIN pg_catalog.pg_am AS access_method ON access_method.oid = toast.relam
    LEFT JOIN pg_catalog.pg_tablespace AS tablespace ON tablespace.oid = toast.reltablespace
  ),
  type_rows AS (
    SELECT target.base_relation || ':' || target.type_kind AS sort_key,
      pg_catalog.jsonb_build_object(
        'baseRelation', target.base_relation,
        'kind', target.type_kind,
        'name', target.typname,
        'catalog', (
          pg_catalog.to_jsonb(target) - ARRAY[
            'oid', 'base_relation', 'type_kind', 'namespace_name',
            'typnamespace', 'typowner', 'typrelid', 'typsubscript',
            'typelem', 'typarray', 'typinput', 'typoutput', 'typreceive',
            'typsend', 'typmodin', 'typmodout', 'typanalyze', 'typbasetype',
            'typcollation', 'typacl'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'namespace', target.namespace_name,
          'owner', CASE pg_catalog.pg_get_userbyid(target.typowner)
            WHEN current_user THEN 'MIGRATION_ADMIN'
            ELSE pg_catalog.pg_get_userbyid(target.typowner)
          END,
          'relation', CASE WHEN target.typrelid = 0 THEN NULL
            ELSE target.base_relation END,
          'subscript', CASE WHEN target.typsubscript = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_proc'::pg_catalog.regclass,
              target.typsubscript, 0
            ) END,
          'element', CASE WHEN target.typelem = 0 THEN NULL
            ELSE pg_catalog.format_type(target.typelem, NULL) END,
          'array', CASE WHEN target.typarray = 0 THEN NULL
            ELSE pg_catalog.format_type(target.typarray, NULL) END,
          'input', pg_catalog.pg_describe_object(
            'pg_catalog.pg_proc'::pg_catalog.regclass, target.typinput, 0
          ),
          'output', pg_catalog.pg_describe_object(
            'pg_catalog.pg_proc'::pg_catalog.regclass, target.typoutput, 0
          ),
          'receive', CASE WHEN target.typreceive = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_proc'::pg_catalog.regclass,
              target.typreceive, 0
            ) END,
          'send', CASE WHEN target.typsend = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_proc'::pg_catalog.regclass, target.typsend, 0
            ) END,
          'typeModifierInput', CASE WHEN target.typmodin = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_proc'::pg_catalog.regclass, target.typmodin, 0
            ) END,
          'typeModifierOutput', CASE WHEN target.typmodout = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_proc'::pg_catalog.regclass, target.typmodout, 0
            ) END,
          'analyze', CASE WHEN target.typanalyze = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_proc'::pg_catalog.regclass, target.typanalyze, 0
            ) END,
          'baseType', CASE WHEN target.typbasetype = 0 THEN NULL
            ELSE pg_catalog.format_type(target.typbasetype, target.typtypmod) END,
          'collation', CASE WHEN target.typcollation = 0 THEN NULL ELSE
            pg_catalog.pg_describe_object(
              'pg_catalog.pg_collation'::pg_catalog.regclass,
              target.typcollation, 0
            ) END,
          'aclIsNull', target.typacl IS NULL
        )
      ) AS value
    FROM target_types AS target
  ),
  column_rows AS (
    -- The complete pg_attribute row retains attstorage, attcompression,
    -- attstattarget, attoptions, attfdwoptions, atthasmissing, and all
    -- remaining semantic column state after unstable object IDs are normalized.
    SELECT relation.relname || ':' || attribute.attname
      AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'catalog', (
          pg_catalog.to_jsonb(attribute) - ARRAY[
            'attrelid', 'attnum', 'atttypid', 'attcollation', 'attacl',
            'attmissingval'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
          'collation', CASE WHEN attribute.attcollation = 0 THEN NULL ELSE
            pg_catalog.format('%I.%I', collation_namespace.nspname, collation_row.collname)
          END,
          'default', pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true),
          'missingValue', pg_catalog.to_jsonb(attribute.attmissingval),
          'aclIsNull', attribute.attacl IS NULL
        )
      ) AS value
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
  ),
  constraint_rows AS (
    -- Include every constraint row, including PostgreSQL 18 contype = 'n'
    -- NOT NULL objects and their conenforced state.
    SELECT relation.relname || ':' || constraint_row.conname AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'catalog', (
          pg_catalog.to_jsonb(constraint_row) - ARRAY[
            'oid', 'connamespace', 'conrelid', 'contypid', 'conindid',
            'conparentid', 'confrelid', 'conpfeqop', 'conppeqop', 'conffeqop',
            'conexclop', 'conbin', 'conkey', 'confkey'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
          'columns', COALESCE((
            SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY member.ordinality)
            FROM pg_catalog.unnest(constraint_row.conkey)
              WITH ORDINALITY AS member(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS attribute
              ON attribute.attrelid = constraint_row.conrelid
             AND attribute.attnum = member.attnum
          ), '[]'::jsonb),
          'referencedColumns', COALESCE((
            SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY member.ordinality)
            FROM pg_catalog.unnest(constraint_row.confkey)
              WITH ORDINALITY AS member(attnum, ordinality)
            JOIN pg_catalog.pg_attribute AS attribute
              ON attribute.attrelid = constraint_row.confrelid
             AND attribute.attnum = member.attnum
          ), '[]'::jsonb),
          'referencedRelation', referenced_class.relname,
          'backingIndex', index_class.relname,
          'parentConstraint', parent_constraint.conname
        )
      ) AS value
    FROM target_relations AS relation
    JOIN pg_catalog.pg_constraint AS constraint_row
      ON constraint_row.conrelid = relation.oid
    LEFT JOIN pg_catalog.pg_class AS referenced_class
      ON referenced_class.oid = constraint_row.confrelid
    LEFT JOIN pg_catalog.pg_class AS index_class ON index_class.oid = constraint_row.conindid
    LEFT JOIN pg_catalog.pg_constraint AS parent_constraint
      ON parent_constraint.oid = constraint_row.conparentid
  ),
  index_rows AS (
    -- The complete pg_index record retains every state bit, including
    -- indisclustered, indisreplident, indisvalid, indisready, and indislive.
    SELECT target.relation_key || ':' || pg_catalog.regexp_replace(
        target.relname, '^pg_toast_[0-9]+', 'pg_toast_*'
      ) AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', target.relation_key,
        'name', pg_catalog.regexp_replace(
          target.relname, '^pg_toast_[0-9]+', 'pg_toast_*'
        ),
        'index', (
          pg_catalog.to_jsonb(target.index_catalog) - ARRAY[
            'indexrelid', 'indrelid', 'indcollation', 'indclass',
            'indexprs', 'indpred', 'indkey'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'expression', pg_catalog.pg_get_expr(
            target.indexprs, target.indrelid, true
          ),
          'predicate', pg_catalog.pg_get_expr(
            target.indpred, target.indrelid, true
          )
        ),
        'class', (
          pg_catalog.to_jsonb(target.class_catalog) - ARRAY[
            'oid', 'relname', 'relnamespace', 'reltype', 'reloftype', 'relowner',
            'relam', 'relfilenode', 'reltablespace', 'relpages', 'reltuples',
            'relallvisible', 'reltoastrelid', 'relfrozenxid', 'relminmxid',
            'relacl', 'relrewrite', 'relpartbound'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'owner', CASE pg_catalog.pg_get_userbyid(target.relowner)
            WHEN current_user THEN 'MIGRATION_ADMIN'
            ELSE pg_catalog.pg_get_userbyid(target.relowner)
          END,
          'aclIsNull', target.class_acl IS NULL,
          'accessMethod', target.access_method_name,
          'tablespace', COALESCE(target.tablespace_name, 'DATABASE_DEFAULT')
        ),
        'definition', pg_catalog.regexp_replace(
          pg_catalog.pg_get_indexdef(target.indexrelid),
          'pg_toast_[0-9]+', 'pg_toast_*', 'g'
        )
      ) AS value
    FROM target_indexes AS target
  ),
  trigger_rows AS (
    -- The complete pg_trigger record retains tgisinternal, tgenabled, and
    -- every other trigger state field before unstable OIDs are normalized.
    SELECT relation.relname || ':' || pg_catalog.regexp_replace(
        trigger_row.tgname, '^RI_ConstraintTrigger_[a-z]_[0-9]+$',
        'RI_ConstraintTrigger_*'
      ) || ':' || COALESCE(constraint_row.conname, '') || ':' ||
        function_namespace.nspname || '.' || function_row.proname || ':' ||
        trigger_row.tgtype::text AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'catalog', (
          pg_catalog.to_jsonb(trigger_row) - ARRAY[
            'oid', 'tgname', 'tgrelid', 'tgparentid', 'tgfoid', 'tgconstraint',
            'tgconstrrelid', 'tgconstrindid', 'tgqual', 'tgattr'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'name', pg_catalog.regexp_replace(
            trigger_row.tgname, '^RI_ConstraintTrigger_[a-z]_[0-9]+$',
            'RI_ConstraintTrigger_*'
          ),
          'function', pg_catalog.format(
            '%I.%I(%s)', function_namespace.nspname, function_row.proname,
            pg_catalog.pg_get_function_identity_arguments(function_row.oid)
          ),
          'constraint', constraint_row.conname,
          'constraintRelation', constraint_relation.relname,
          'constraintIndex', CASE WHEN constraint_index.oid IS NULL THEN NULL ELSE
            pg_catalog.format('%I.%I', constraint_index_namespace.nspname,
              constraint_index.relname) END,
          'qualifier', pg_catalog.pg_get_expr(
            trigger_row.tgqual, trigger_row.tgrelid, true
          ),
          'definition', pg_catalog.regexp_replace(
            pg_catalog.pg_get_triggerdef(trigger_row.oid, true),
            'RI_ConstraintTrigger_[a-z]_[0-9]+', 'RI_ConstraintTrigger_*', 'g'
          )
        )
      ) AS value
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
  ),
  policy_rows AS (
    SELECT policy.relname || ':' || policy.polname AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', policy.relname,
        'catalog', (
          pg_catalog.to_jsonb(policy) - ARRAY[
            'oid', 'polrelid', 'polroles', 'polqual', 'polwithcheck', 'relname',
            'role_names'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'roles', policy.role_names,
          'qualifier', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, true),
          'withCheck', pg_catalog.pg_get_expr(
            policy.polwithcheck, policy.polrelid, true
          )
        )
      ) AS value
    FROM target_policies AS policy
  ),
  function_rows AS (
    -- The complete pg_proc record retains proconfig and all execution flags.
    SELECT procedure.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')' AS sort_key,
      pg_catalog.jsonb_build_object(
        'identity', procedure.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
        'catalog', (
          pg_catalog.to_jsonb(procedure) - ARRAY[
            'oid', 'pronamespace', 'proowner', 'prolang', 'prosupport',
            'prorettype', 'proargtypes', 'proallargtypes', 'provariadic',
            'proargdefaults', 'protrftypes', 'prosqlbody', 'proacl',
            'namespace_name', 'language_name'
          ]::text[]
        ) || pg_catalog.jsonb_build_object(
          'owner', CASE pg_catalog.pg_get_userbyid(procedure.proowner)
            WHEN current_user THEN 'MIGRATION_ADMIN'
            ELSE pg_catalog.pg_get_userbyid(procedure.proowner)
          END,
          'language', procedure.language_name,
          'result', pg_catalog.pg_get_function_result(procedure.oid),
          'arguments', pg_catalog.pg_get_function_arguments(procedure.oid),
          'identityArguments', pg_catalog.pg_get_function_identity_arguments(procedure.oid),
          'support', CASE WHEN procedure.prosupport = 0 THEN NULL ELSE
            procedure.prosupport::pg_catalog.regprocedure::text
          END,
          'aclIsNull', procedure.proacl IS NULL,
          'definition', pg_catalog.pg_get_functiondef(procedure.oid)
        )
      ) AS value
    FROM target_functions AS procedure
  ),
  relation_acl_rows AS (
    SELECT relation.relname || ':' || COALESCE(grantee.rolname, 'PUBLIC') || ':' ||
        acl.privilege_type AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'grantor', CASE grantor.rolname WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE grantor.rolname END,
        'grantee', CASE COALESCE(grantee.rolname, 'PUBLIC')
          WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE COALESCE(grantee.rolname, 'PUBLIC') END,
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      ) AS value
    FROM acl_relations AS relation
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
      relation.relacl, pg_catalog.acldefault('r', relation.relowner)
    )) AS acl
    LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
    LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  ),
  column_acl_rows AS (
    SELECT relation.relname || ':' || attribute.attname || ':' ||
        COALESCE(grantee.rolname, 'PUBLIC') || ':' || acl.privilege_type AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'column', attribute.attname,
        'grantor', CASE grantor.rolname WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE grantor.rolname END,
        'grantee', CASE COALESCE(grantee.rolname, 'PUBLIC')
          WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE COALESCE(grantee.rolname, 'PUBLIC') END,
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      ) AS value
    FROM acl_relations AS relation
    JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
    LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
    LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
    WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
  ),
  function_acl_rows AS (
    SELECT procedure.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(procedure.oid) || '):' ||
        COALESCE(grantee.rolname, 'PUBLIC') || ':' || acl.privilege_type AS sort_key,
      pg_catalog.jsonb_build_object(
        'function', procedure.proname || '(' ||
          pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')',
        'grantor', CASE grantor.rolname WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE grantor.rolname END,
        'grantee', CASE COALESCE(grantee.rolname, 'PUBLIC')
          WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE COALESCE(grantee.rolname, 'PUBLIC') END,
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      ) AS value
    FROM target_functions AS procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
      procedure.proacl, pg_catalog.acldefault('f', procedure.proowner)
    )) AS acl
    LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
    LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  ),
  type_acl_rows AS (
    SELECT target.base_relation || ':' || target.type_kind || ':' ||
        COALESCE(grantee.rolname, 'PUBLIC') || ':' || acl.privilege_type AS sort_key,
      pg_catalog.jsonb_build_object(
        'baseRelation', target.base_relation,
        'kind', target.type_kind,
        'type', target.typname,
        'grantor', CASE grantor.rolname WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE grantor.rolname END,
        'grantee', CASE COALESCE(grantee.rolname, 'PUBLIC')
          WHEN current_user THEN 'MIGRATION_ADMIN'
          ELSE COALESCE(grantee.rolname, 'PUBLIC') END,
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      ) AS value
    FROM target_types AS target
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(
      target.typacl, pg_catalog.acldefault('T', target.typowner)
    )) AS acl
    LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
    LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  ),
  rule_rows AS (
    SELECT relation.relname || ':' || rule.rulename AS sort_key,
      pg_catalog.jsonb_build_object(
        'relation', relation.relname,
        'catalog', (
          pg_catalog.to_jsonb(rule) - ARRAY[
            'oid', 'ev_class', 'ev_action', 'ev_qual'
          ]::text[]
        ),
        'definition', pg_catalog.pg_get_ruledef(rule.oid, true)
      ) AS value
    FROM target_relations AS relation
    JOIN pg_catalog.pg_rewrite AS rule ON rule.ev_class = relation.oid
  ),
  inheritance_rows AS (
    SELECT child_namespace.nspname || '.' || child.relname || '->' ||
        parent_namespace.nspname || '.' || parent.relname AS sort_key,
      pg_catalog.jsonb_build_object(
        'child', child_namespace.nspname || '.' || child.relname,
        'parent', parent_namespace.nspname || '.' || parent.relname,
        'catalog', pg_catalog.to_jsonb(inheritance) - ARRAY[
          'inhrelid', 'inhparent'
        ]::text[]
      ) AS value
    FROM pg_catalog.pg_inherits AS inheritance
    JOIN pg_catalog.pg_class AS child ON child.oid = inheritance.inhrelid
    JOIN pg_catalog.pg_namespace AS child_namespace
      ON child_namespace.oid = child.relnamespace
    JOIN pg_catalog.pg_class AS parent ON parent.oid = inheritance.inhparent
    JOIN pg_catalog.pg_namespace AS parent_namespace
      ON parent_namespace.oid = parent.relnamespace
    WHERE inheritance.inhrelid IN (SELECT oid FROM target_relations)
       OR inheritance.inhparent IN (SELECT oid FROM target_relations)
  ),
  publication_rows AS (
    SELECT publication.pubname || ':' || relation.relname AS sort_key,
      pg_catalog.jsonb_build_object(
        'publication', publication.pubname,
        'relation', relation.relname,
        'catalog', pg_catalog.to_jsonb(publication_relation) - ARRAY[
          'oid', 'prpubid', 'prrelid', 'prattrs', 'prqual'
        ]::text[],
        'columns', COALESCE((
          SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY attribute.attnum)
          FROM pg_catalog.unnest(publication_relation.prattrs) AS member(attnum)
          JOIN pg_catalog.pg_attribute AS attribute
            ON attribute.attrelid = publication_relation.prrelid
           AND attribute.attnum = member.attnum
        ), '[]'::jsonb),
        'qualifier', pg_catalog.pg_get_expr(
          publication_relation.prqual, publication_relation.prrelid, true
        )
      ) AS value
    FROM target_relations AS relation
    JOIN pg_catalog.pg_publication_rel AS publication_relation
      ON publication_relation.prrelid = relation.oid
    JOIN pg_catalog.pg_publication AS publication
      ON publication.oid = publication_relation.prpubid
  ),
  statistics_rows AS (
    SELECT relation.relname || ':' || statistics.stxname AS sort_key,
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
      ) AS value
    FROM target_relations AS relation
    JOIN pg_catalog.pg_statistic_ext AS statistics ON statistics.stxrelid = relation.oid
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
    SELECT 'pg_catalog.pg_type'::pg_catalog.regclass::oid,
      type_row.oid, 0,
      'type:' || type_row.base_relation || ':' || type_row.type_kind
    FROM target_types AS type_row
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
      ) || ':' || COALESCE(constraint_row.conname, '') || ':' ||
        function_namespace.nspname || '.' || function_row.proname
    FROM target_relations AS relation
    JOIN pg_catalog.pg_trigger AS trigger_row ON trigger_row.tgrelid = relation.oid
    JOIN pg_catalog.pg_proc AS function_row ON function_row.oid = trigger_row.tgfoid
    JOIN pg_catalog.pg_namespace AS function_namespace
      ON function_namespace.oid = function_row.pronamespace
    LEFT JOIN pg_catalog.pg_constraint AS constraint_row
      ON constraint_row.oid = trigger_row.tgconstraint
    UNION ALL
    SELECT 'pg_catalog.pg_policy'::pg_catalog.regclass::oid,
      policy.oid, 0, 'policy:' || policy.relname || ':' || policy.polname
    FROM target_policies AS policy
    UNION ALL
    SELECT 'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
      procedure.oid, 0,
      'function:' || procedure.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')'
    FROM target_functions AS procedure
    UNION ALL
    SELECT 'pg_catalog.pg_rewrite'::pg_catalog.regclass::oid,
      rule.oid, 0, 'rule:' || relation.relname || ':' || rule.rulename
    FROM target_relations AS relation
    JOIN pg_catalog.pg_rewrite AS rule ON rule.ev_class = relation.oid
    UNION ALL
    SELECT 'pg_catalog.pg_statistic_ext'::pg_catalog.regclass::oid,
      statistics.oid, 0, 'statistics:' || relation.relname || ':' || statistics.stxname
    FROM target_relations AS relation
    JOIN pg_catalog.pg_statistic_ext AS statistics ON statistics.stxrelid = relation.oid
  ),
  comment_rows AS (
    SELECT target.target_name AS sort_key,
      pg_catalog.jsonb_build_object(
        'target', target.target_name,
        'description', description.description
      ) AS value
    FROM object_targets AS target
    JOIN pg_catalog.pg_description AS description
      ON description.classoid = target.class_id
     AND description.objoid = target.object_id
     AND description.objsubid = target.object_sub_id
  ),
  security_label_rows AS (
    SELECT target.target_name || ':' || label.provider AS sort_key,
      pg_catalog.jsonb_build_object(
        'target', target.target_name,
        'provider', label.provider,
        'label', label.label
      ) AS value
    FROM object_targets AS target
    JOIN pg_catalog.pg_seclabel AS label
      ON label.classoid = target.class_id
     AND label.objoid = target.object_id
     AND label.objsubid = target.object_sub_id
  ),
  dependency_rows AS (
    SELECT
      target.target_name || ':' || dependency.deptype::text || ':' ||
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_describe_object(
              dependency.classid, dependency.objid, dependency.objsubid
            ),
            'RI_ConstraintTrigger_[a-z]_[0-9]+', 'RI_ConstraintTrigger_*', 'g'
          ),
          'pg_toast_[0-9]+', 'pg_toast_*', 'g'
        ) || '->' || pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_describe_object(
              dependency.refclassid, dependency.refobjid, dependency.refobjsubid
            ),
            'RI_ConstraintTrigger_[a-z]_[0-9]+', 'RI_ConstraintTrigger_*', 'g'
          ),
          'pg_toast_[0-9]+', 'pg_toast_*', 'g'
        ) AS sort_key,
      pg_catalog.jsonb_build_object(
        'target', target.target_name,
        'type', dependency.deptype,
        'object', pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_describe_object(
              dependency.classid, dependency.objid, dependency.objsubid
            ),
            'RI_ConstraintTrigger_[a-z]_[0-9]+', 'RI_ConstraintTrigger_*', 'g'
          ),
          'pg_toast_[0-9]+', 'pg_toast_*', 'g'
        ),
        'referenced', pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_describe_object(
              dependency.refclassid, dependency.refobjid, dependency.refobjsubid
            ),
            'RI_ConstraintTrigger_[a-z]_[0-9]+', 'RI_ConstraintTrigger_*', 'g'
          ),
          'pg_toast_[0-9]+', 'pg_toast_*', 'g'
        )
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
  ),
  snapshot AS (
    SELECT pg_catalog.jsonb_build_object(
      'relations', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM relation_rows), '[]'::jsonb),
      'toast', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM toast_rows), '[]'::jsonb),
      'types', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM type_rows), '[]'::jsonb),
      'columns', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM column_rows), '[]'::jsonb),
      'constraints', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM constraint_rows), '[]'::jsonb),
      'indexes', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM index_rows), '[]'::jsonb),
      'triggers', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM trigger_rows), '[]'::jsonb),
      'policies', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM policy_rows), '[]'::jsonb),
      'functions', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM function_rows), '[]'::jsonb),
      'relationAcl', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM relation_acl_rows), '[]'::jsonb),
      'columnAcl', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM column_acl_rows), '[]'::jsonb),
      'functionAcl', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM function_acl_rows), '[]'::jsonb),
      'typeAcl', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM type_acl_rows), '[]'::jsonb),
      'rules', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM rule_rows), '[]'::jsonb),
      'inheritance', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM inheritance_rows), '[]'::jsonb),
      'publications', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM publication_rows), '[]'::jsonb),
      'statistics', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM statistics_rows), '[]'::jsonb),
      'comments', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM comment_rows), '[]'::jsonb),
      'securityLabels', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM security_label_rows), '[]'::jsonb),
      'dependencies', COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY sort_key)
        FROM dependency_rows), '[]'::jsonb)
    ) AS value
  )
  SELECT lor_studio.canonical_jsonb_sha256(snapshot.value)
  INTO snapshot_hash
  FROM snapshot;
  -- END STUDENT_EVIDENCE_ROLLBACK_CUSTODY_SNAPSHOT

  expected_snapshot_hash := CASE postgres_major
    WHEN 16 THEN '0a3331526ff140d11938a8df63901c98a98f80d8356f4f2ccb27525fb33aaca2'
    WHEN 18 THEN 'afeed91d58ac1a9eed44d6acf817f571748727231e85176925bba3e9fa310b3f'
    ELSE NULL
  END;

  IF snapshot_hash IS DISTINCT FROM expected_snapshot_hash
    OR EXISTS (SELECT 1 FROM lor_studio.student_evidence_records)
    OR EXISTS (
      SELECT 1
      FROM lor_studio.recommendation_case_write_receipts AS receipt
      WHERE receipt.command_type = 'student.evidence.publish'
    )
  THEN
    RAISE EXCEPTION 'DR-133 student evidence rollback exact custody or emptiness mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$exact_catalog_guard$;

DO $catalog_guard$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  table_fingerprint text;
  function_fingerprint text;
  policy_fingerprint text;
  trigger_fingerprint text;
  receipt_constraint_fingerprint text;
  grant_fingerprint text;
  dependency_fingerprint text;
  metadata_fingerprint text;
  successor_sentinel text;
  expected_successor_sentinel text;
BEGIN
WITH evidence_class AS (
  SELECT class.*
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relname = 'student_evidence_records'
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
      FROM evidence_class AS class
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
      FROM evidence_class AS class
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
      FROM evidence_class AS class
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
      FROM evidence_class AS class
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
      'ownerClass', CASE
        WHEN pg_catalog.pg_get_userbyid(procedure.proowner) =
          'lor_studio_command_owner' THEN 'COMMAND_OWNER'
        WHEN pg_catalog.pg_get_userbyid(procedure.proowner) = current_user
          THEN 'CURRENT_USER'
        ELSE pg_catalog.pg_get_userbyid(procedure.proowner)
      END,
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
        'lor_studio.student_evidence_record_is_complete(jsonb,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.build_student_safe_case_state(text,text,bigint,text,timestamptz,timestamptz,timestamptz,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()'),
      pg_catalog.to_regprocedure(
        'lor_studio.read_faculty_drafting_context_pre_evidence()'
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
    AND class.relname = 'student_evidence_records'
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
  FROM evidence_class AS class
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
    AND class.relname = 'recommendation_case_write_receipts'
    AND constraint_row.conname =
      'recommendation_case_write_receipts_command_type_known'
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
      'student_evidence_records',
      'recommendation_case_write_receipts'
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
      'student_evidence_records',
      'recommendation_case_write_receipts'
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
        'lor_studio.student_evidence_record_is_complete(jsonb,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.build_student_safe_case_state(text,text,bigint,text,timestamptz,timestamptz,timestamptz,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()'),
      pg_catalog.to_regprocedure(
        'lor_studio.read_faculty_drafting_context_pre_evidence()'
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
  SELECT 'table:student_evidence_records'::text AS target_name,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid AS catalog_id,
    pg_catalog.to_regclass('lor_studio.student_evidence_records')::oid AS object_id
  UNION ALL
  SELECT 'function:student_evidence_record_is_complete',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure(
      'lor_studio.student_evidence_record_is_complete(jsonb,jsonb)'
    )::oid
  UNION ALL
  SELECT 'function:build_student_safe_case_state',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure(
      'lor_studio.build_student_safe_case_state(text,text,bigint,text,timestamptz,timestamptz,timestamptz,jsonb)'
    )::oid
  UNION ALL
  SELECT 'function:commit_student_evidence_publication',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure(
      'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
    )::oid
  UNION ALL
  SELECT 'function:read_faculty_drafting_context',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()')::oid
  UNION ALL
  SELECT 'function:read_faculty_drafting_context_pre_evidence',
    'pg_catalog.pg_proc'::pg_catalog.regclass::oid,
    pg_catalog.to_regprocedure(
      'lor_studio.read_faculty_drafting_context_pre_evidence()'
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
  FROM evidence_class AS class
  UNION ALL
  SELECT 'column:' || class.relname || '.' || attribute.attname,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    class.oid,
    attribute.attnum
  FROM evidence_class AS class
  JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = class.oid
  WHERE attribute.attnum > 0 AND NOT attribute.attisdropped
  UNION ALL
  SELECT 'index:' || index_class.relname,
    'pg_catalog.pg_class'::pg_catalog.regclass::oid,
    index_class.oid,
    0
  FROM evidence_class AS class
  JOIN pg_catalog.pg_index AS index_row ON index_row.indrelid = class.oid
  JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
  UNION ALL
  SELECT 'constraint:' || constraint_row.conname,
    'pg_catalog.pg_constraint'::pg_catalog.regclass::oid,
    constraint_row.oid,
    0
  FROM evidence_class AS class
  JOIN pg_catalog.pg_constraint AS constraint_row ON constraint_row.conrelid = class.oid
  UNION ALL
  SELECT 'type:' || type_row.typname,
    'pg_catalog.pg_type'::pg_catalog.regclass::oid,
    type_row.oid,
    0
  FROM evidence_class AS class
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
        'lor_studio.student_evidence_record_is_complete(jsonb,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.build_student_safe_case_state(text,text,bigint,text,timestamptz,timestamptz,timestamptz,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()'),
      pg_catalog.to_regprocedure(
        'lor_studio.read_faculty_drafting_context_pre_evidence()'
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
    AND class.relname = 'student_evidence_records'
    AND policy.polname IN (
      'student_evidence_records_student_command_insert',
      'student_evidence_records_command_select'
    )
  UNION ALL
  SELECT 'trigger:' || trigger_row.tgname,
    'pg_catalog.pg_trigger'::pg_catalog.regclass::oid,
    trigger_row.oid,
    0
  FROM evidence_class AS class
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
    AND class.relname = 'recommendation_case_write_receipts'
    AND constraint_row.conname =
      'recommendation_case_write_receipts_command_type_known'
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
  (SELECT value FROM table_fingerprint),
  (SELECT value FROM function_fingerprint),
  (SELECT value FROM policy_fingerprint),
  (SELECT value FROM trigger_fingerprint),
  (SELECT value FROM receipt_constraint_fingerprint),
  (SELECT value FROM grant_fingerprint),
  (SELECT value FROM dependency_fingerprint),
  (SELECT value FROM metadata_fingerprint)
INTO STRICT
  table_fingerprint,
  function_fingerprint,
  policy_fingerprint,
  trigger_fingerprint,
  receipt_constraint_fingerprint,
  grant_fingerprint,
  dependency_fingerprint,
  metadata_fingerprint;

  expected_successor_sentinel := pg_catalog.format(
    'missionmed.lor.disposable-postgres-harness.v1|database=%s|admin=%s|root=%s|foundation=20260820180700|identityScope=20260825010200|facultyInvitationCommands=20260825010400|facultyPrivateExportCommands=20260825010600|aiProposalCommands=20260825010800|studentEvidenceCommands=20260825011000',
    pg_catalog.current_database(), current_user,
    pg_catalog.regexp_replace(
      pg_catalog.current_setting('data_directory'), '/d$', ''
    )
  );

  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT successor_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';

  IF table_fingerprint IS DISTINCT FROM
      '6d002afe804b32d7ca9b06a736b2decc583e1ca52b92ce02e7983b4120406bd0'
    OR function_fingerprint IS DISTINCT FROM
      '2ffbf96b1bd79e1b4f885f145f8b970a04471d91aa599bcfb36c188512e22831'
    OR policy_fingerprint IS DISTINCT FROM
      '1a23c8f1ee8a374c4567422e904a0350c305c7b744fe6e9da3237624fec66c57'
    OR trigger_fingerprint IS DISTINCT FROM
      '5394f91e98c2b4e27d562c7da6f098fdfde4bcbdd2de81ba3951ca066a5d0d30'
    OR receipt_constraint_fingerprint IS DISTINCT FROM
      'd1e7a8f69ffd1abdc8a7595d7ba9a4c0c9b97c0f6e4ea0f236499719df3d6ed0'
    OR grant_fingerprint IS DISTINCT FROM
      'fef93a2ec93bd89dbcc6d6658e5081acc750738e56ee1c0a6ac3996bd2cbdedc'
    OR dependency_fingerprint IS DISTINCT FROM
      '4b377e2205b6745bc98befbfb9539a6ac693db3a868a625b4abdbf01b892ac76'
    OR metadata_fingerprint IS DISTINCT FROM
      '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
    OR successor_sentinel IS DISTINCT FROM expected_successor_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 evidence rollback successor semantic fingerprint mismatch'
      USING ERRCODE = '55000';
  END IF;

  SELECT counts.relation_count, counts.forced_rls_count, counts.definer_count
  INTO STRICT relation_count, forced_rls_count, definer_count
  FROM evidence_rollback_preflight_counts AS counts;
  IF relation_count IS DISTINCT FROM 33
    OR forced_rls_count IS DISTINCT FROM 33
    OR definer_count IS DISTINCT FROM 28
    OR pg_catalog.to_regclass('lor_studio.student_evidence_records') IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()') IS NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.read_faculty_drafting_context_pre_evidence()'
    ) IS NULL
    OR EXISTS (SELECT 1 FROM lor_studio.student_evidence_records)
    OR EXISTS (
      SELECT 1 FROM lor_studio.recommendation_case_write_receipts AS receipt
      WHERE receipt.command_type = 'student.evidence.publish'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relname = 'student_evidence_records'
        AND trigger.tgname = 'student_evidence_records_append_only'
        AND NOT trigger.tgisinternal
    )
  THEN
    RAISE EXCEPTION 'DR-133 evidence rollback refuses to remove live evidence custody'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

REVOKE EXECUTE ON FUNCTION lor_studio.commit_student_evidence_publication(
  bigint, text, text, jsonb, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()
FROM lor_studio_app;

ALTER FUNCTION lor_studio.commit_student_evidence_publication(
  bigint, text, text, jsonb, text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.read_faculty_drafting_context() OWNER TO CURRENT_USER;
DROP FUNCTION lor_studio.commit_student_evidence_publication(
  bigint, text, text, jsonb, text
);
DROP FUNCTION lor_studio.read_faculty_drafting_context();

ALTER FUNCTION lor_studio.read_faculty_drafting_context_pre_evidence()
OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.read_faculty_drafting_context_pre_evidence()
RENAME TO read_faculty_drafting_context;
ALTER FUNCTION lor_studio.read_faculty_drafting_context()
OWNER TO lor_studio_command_owner;
REVOKE ALL ON FUNCTION lor_studio.read_faculty_drafting_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()
TO lor_studio_app;

REVOKE SELECT, INSERT ON TABLE lor_studio.student_evidence_records
FROM lor_studio_command_owner;
DROP POLICY student_evidence_records_student_command_insert
  ON lor_studio.student_evidence_records;
DROP POLICY student_evidence_records_command_select
  ON lor_studio.student_evidence_records;
DROP TRIGGER student_evidence_records_append_only
  ON lor_studio.student_evidence_records;
DROP TABLE lor_studio.student_evidence_records;

ALTER TABLE lor_studio.recommendation_case_write_receipts
  DROP CONSTRAINT recommendation_case_write_receipts_command_type_known,
  ADD CONSTRAINT recommendation_case_write_receipts_command_type_known CHECK (
    command_type IN (
      'student.case.create',
      'student.builder.autosave',
      'student.builder.complete',
      'student.consent.record',
      'student.waiver.record'
    )
  );

REVOKE EXECUTE ON FUNCTION lor_studio.build_student_safe_case_state(
  text, text, bigint, text, timestamptz, timestamptz, timestamptz, jsonb
) FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.student_evidence_record_is_complete(jsonb, jsonb)
FROM lor_studio_command_owner;
DROP FUNCTION lor_studio.build_student_safe_case_state(
  text, text, bigint, text, timestamptz, timestamptz, timestamptz, jsonb
);
DROP FUNCTION lor_studio.student_evidence_record_is_complete(jsonb, jsonb);

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
  predecessor_relation_count bigint;
  predecessor_forced_rls_count bigint;
  predecessor_definer_count bigint;
BEGIN
  SELECT counts.relation_count, counts.forced_rls_count, counts.definer_count
  INTO STRICT predecessor_relation_count, predecessor_forced_rls_count,
    predecessor_definer_count
  FROM evidence_rollback_preflight_counts AS counts;
  SELECT pg_catalog.count(*) INTO relation_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r';
  SELECT pg_catalog.count(*) INTO forced_rls_count
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r'
    AND class.relrowsecurity AND class.relforcerowsecurity;
  SELECT pg_catalog.count(*) INTO definer_count
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'lor_studio_command_owner';
  IF relation_count IS DISTINCT FROM predecessor_relation_count - 1
    OR forced_rls_count IS DISTINCT FROM predecessor_forced_rls_count - 1
    OR definer_count IS DISTINCT FROM predecessor_definer_count - 2
    OR pg_catalog.to_regclass('lor_studio.student_evidence_records') IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.commit_student_evidence_publication(bigint,text,text,jsonb,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()') IS NULL
    OR NOT pg_catalog.has_function_privilege(
      'lor_studio_app', 'lor_studio.read_faculty_drafting_context()', 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'DR-133 evidence rollback postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

DO $restore_sentinel$
DECLARE observed_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    pg_catalog.regexp_replace(
      observed_sentinel, '\|studentEvidenceCommands=20260825011000$', ''
    )
  );
END
$restore_sentinel$;

COMMIT;
