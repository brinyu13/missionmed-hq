-- Rollback: 20260825010900_f2_lor_1012_production_ai_proposal_commands.rollback.sql
-- Authority: F2-LOR-1012 / DR-133
-- Reverses: 20260825010900_f2_lor_1012_production_ai_proposal_commands.sql
-- Exact target: MissionMed Railway project 29afe885 / lor-staging environment f5705d38 / Postgres service b49a52e7

BEGIN;

DO $identity_guard$
DECLARE
  database_name text := pg_catalog.current_database();
  target_provider text := pg_catalog.current_setting('missionmed.lor.target_provider', true);
  target_project_id text := pg_catalog.current_setting('missionmed.lor.target_project_id', true);
  target_environment_id text := pg_catalog.current_setting('missionmed.lor.target_environment_id', true);
  target_service_id text := pg_catalog.current_setting('missionmed.lor.target_service_id', true);
  target_database_name text := pg_catalog.current_setting('missionmed.lor.target_database_name', true);
  target_region text := pg_catalog.current_setting('missionmed.lor.target_region', true);
  target_decision_record text := pg_catalog.current_setting('missionmed.lor.target_decision_record', true);
  target_data_copied text := pg_catalog.current_setting('missionmed.lor.target_data_copied', true);
  target_identity_text text;
  expected_sentinel text;
  observed_sentinel text;
  database_owner name;
  schema_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(database.datdba)
  INTO database_owner
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = database_name;
  SELECT
    pg_catalog.pg_get_userbyid(namespace.nspowner),
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO schema_owner, observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  target_identity_text := pg_catalog.concat_ws('|',
    target_provider, target_project_id, target_environment_id, target_service_id,
    target_database_name, target_region, target_decision_record, target_data_copied
  );
  expected_sentinel := pg_catalog.format(
    'missionmed.lor.railway-postgres-target.v1|provider=%s|project=%s|environment=%s|service=%s|database=%s|admin=%s|region=%s|decision=%s|dataCopied=%s|foundation=20260825010000|identityScope=20260825010300|facultyInvitationCommands=20260825010500|facultyPrivateExportCommands=20260825010700|aiProposalCommands=20260825010900',
    target_provider, target_project_id, target_environment_id, target_service_id,
    target_database_name, current_user, target_region, target_decision_record,
    target_data_copied
  );
  IF pg_catalog.current_setting('server_version_num')::integer / 10000 NOT IN (16, 18)
    OR target_identity_text LIKE '%mftguikkftmrxjxrkdln%'
    OR target_identity_text LIKE '%fglyvdykwgbuivikqoah%'
    OR target_provider IS DISTINCT FROM 'railway-postgres'
    OR target_project_id IS DISTINCT FROM '29afe885-b9b1-425d-8fd8-8611cd275409'
    OR target_environment_id IS DISTINCT FROM 'f5705d38-393c-4176-9cc2-0d1dbad42c93'
    OR target_service_id IS DISTINCT FROM 'b49a52e7-df15-4417-b67a-a64403aa5db7'
    OR target_database_name IS DISTINCT FROM 'railway'
    OR target_database_name IS DISTINCT FROM database_name
    OR target_region IS DISTINCT FROM 'us-west2'
    OR target_decision_record IS DISTINCT FROM 'DR-133'
    OR target_data_copied IS DISTINCT FROM 'false'
    OR current_user IS DISTINCT FROM 'postgres'
    OR session_user IS DISTINCT FROM current_user
    OR database_owner IS DISTINCT FROM current_user
    OR schema_owner IS DISTINCT FROM current_user
    OR pg_catalog.inet_server_addr() IS NULL
    OR NOT (
      pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7'
    )
    OR pg_catalog.current_setting('ssl') IS DISTINCT FROM 'on'
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_ssl AS ssl_session
      WHERE ssl_session.pid = pg_catalog.pg_backend_pid() AND ssl_session.ssl
    )
    OR observed_sentinel IS DISTINCT FROM expected_sentinel
  THEN
    RAISE EXCEPTION 'DR-133 AI proposal command rollback requires the exact successor-bound private Railway PostgreSQL identity'
      USING ERRCODE = '42501';
  END IF;
END
$identity_guard$;

LOCK TABLE
  lor_studio.ai_proposal_command_receipts,
  lor_studio.ai_proposal_generation_reservation_receipts,
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.recommendation_case_audit_events,
  lor_studio.recommendation_cases
IN ACCESS EXCLUSIVE MODE;

DO $catalog_guard$
DECLARE
  postgres_major integer := pg_catalog.current_setting('server_version_num')::integer / 10000;
  snapshot_hash text;
  expected_snapshot_hash text;
BEGIN
  -- BEGIN AI_ROLLBACK_CUSTODY_SNAPSHOT
  WITH target_relations AS (
    SELECT class.oid, class.relname, class.reltoastrelid, class.reltype
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = ANY (ARRAY[
        'ai_letter_proposals',
        'ai_proposal_command_receipts',
        'ai_proposal_decisions',
        'ai_proposal_generation_reservation_receipts'
      ]::text[])
      AND class.relkind IN ('r', 'p')
  ),
  acl_relations AS (
    SELECT class.oid, class.relname, class.relowner, class.relacl
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = ANY (ARRAY[
        'ai_generation_runs',
        'ai_letter_proposals',
        'ai_proposal_command_receipts',
        'ai_proposal_decisions',
        'ai_proposal_generation_reservation_receipts'
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
        'lor_studio.ai_grounding_manifest_is_complete(jsonb)'
      ),
      pg_catalog.to_regprocedure('lor_studio.ai_proposal_record_is_complete(jsonb)'),
      pg_catalog.to_regprocedure(
        'lor_studio.ai_proposal_command_context_allows(text,text)'
      ),
      pg_catalog.to_regprocedure('lor_studio.ai_proposal_scope_hash(text,text)'),
      pg_catalog.to_regprocedure('lor_studio.read_faculty_drafting_context()'),
      pg_catalog.to_regprocedure(
        'lor_studio.transition_ai_proposal_generation_reservation(text,text,text,text,text,text)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.persist_ai_provider_run_and_proposal_atomic(text,text,text,text,text,text,text,text,text,jsonb)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.read_actor_safe_ai_proposal(text,text,text,text)'
      ),
      pg_catalog.to_regprocedure(
        'lor_studio.attach_ai_proposal_decision_if_undecided_atomic(text,text,text,text,text,text,text,text,text,text,text,jsonb)'
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
      AND (
        policy.polname = ANY (ARRAY[
          'recommendation_cases_ai_command_service_select',
          'ai_generation_runs_ai_command_service_select',
          'ai_generation_runs_ai_command_service_insert',
          'ai_letter_proposals_ai_command_service_insert',
          'ai_proposal_command_receipts_faculty_select',
          'ai_proposal_command_receipts_faculty_insert',
          'ai_proposal_generation_reservations_faculty_select',
          'ai_proposal_generation_reservations_faculty_insert'
        ]::text[])
        OR class.relname = ANY (ARRAY[
          'ai_proposal_command_receipts',
          'ai_proposal_generation_reservation_receipts'
        ]::text[])
      )
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
  -- END AI_ROLLBACK_CUSTODY_SNAPSHOT

  expected_snapshot_hash := CASE postgres_major
    WHEN 16 THEN '9d937c7afb12b672396d6e71068456e2a5fddcd756c9848a46e3a75f49bb7957'
    WHEN 18 THEN '94161596e3cb46a717a1a823c2b1405defc244b5aa5e77668c8a43d343a2348b'
    ELSE NULL
  END;

  IF snapshot_hash IS DISTINCT FROM expected_snapshot_hash
    OR EXISTS (SELECT 1 FROM lor_studio.ai_proposal_command_receipts)
    OR EXISTS (
      SELECT 1 FROM lor_studio.ai_proposal_generation_reservation_receipts
    )
    OR EXISTS (SELECT 1 FROM lor_studio.ai_generation_runs)
    OR EXISTS (SELECT 1 FROM lor_studio.ai_letter_proposals)
    OR EXISTS (SELECT 1 FROM lor_studio.ai_proposal_decisions)
    OR EXISTS (
      SELECT 1
      FROM lor_studio.recommendation_case_audit_events AS audit_event
      WHERE audit_event.event_type IN (
        'ai.proposal_generated', 'ai.proposal_decision_recorded'
      )
    )
  THEN
    RAISE EXCEPTION 'DR-133 AI proposal command rollback exact custody or emptiness mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_guard$;

-- Literal reverse operations follow; every dependency is removed explicitly.
REVOKE EXECUTE ON FUNCTION lor_studio.read_faculty_drafting_context()
FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  text, text, text, text, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  text, text, text, text, text, text, text, text, text, jsonb
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.read_actor_safe_ai_proposal(
  text, text, text, text
) FROM lor_studio_app;
REVOKE EXECUTE ON FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
) FROM lor_studio_app;

ALTER FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  text, text, text, text, text, text
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  text, text, text, text, text, text, text, text, text, jsonb
) OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.read_faculty_drafting_context() OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.read_actor_safe_ai_proposal(text, text, text, text)
OWNER TO CURRENT_USER;
ALTER FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
) OWNER TO CURRENT_USER;

DROP FUNCTION lor_studio.transition_ai_proposal_generation_reservation(
  text, text, text, text, text, text
);
DROP FUNCTION lor_studio.persist_ai_provider_run_and_proposal_atomic(
  text, text, text, text, text, text, text, text, text, jsonb
);
DROP FUNCTION lor_studio.read_faculty_drafting_context();
DROP FUNCTION lor_studio.read_actor_safe_ai_proposal(text, text, text, text);
DROP FUNCTION lor_studio.attach_ai_proposal_decision_if_undecided_atomic(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
);

DROP POLICY recommendation_cases_ai_command_service_select
  ON lor_studio.recommendation_cases;
DROP POLICY ai_generation_runs_ai_command_service_select
  ON lor_studio.ai_generation_runs;
DROP POLICY ai_generation_runs_ai_command_service_insert
  ON lor_studio.ai_generation_runs;
DROP POLICY ai_letter_proposals_ai_command_service_insert
  ON lor_studio.ai_letter_proposals;
DROP POLICY ai_proposal_command_receipts_faculty_select
  ON lor_studio.ai_proposal_command_receipts;
DROP POLICY ai_proposal_command_receipts_faculty_insert
  ON lor_studio.ai_proposal_command_receipts;
DROP POLICY ai_proposal_generation_reservations_faculty_select
  ON lor_studio.ai_proposal_generation_reservation_receipts;
DROP POLICY ai_proposal_generation_reservations_faculty_insert
  ON lor_studio.ai_proposal_generation_reservation_receipts;

REVOKE SELECT, INSERT ON TABLE
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals,
  lor_studio.ai_proposal_decisions,
  lor_studio.ai_proposal_command_receipts,
  lor_studio.ai_proposal_generation_reservation_receipts
FROM lor_studio_command_owner;

GRANT SELECT, INSERT ON TABLE
  lor_studio.ai_generation_runs,
  lor_studio.ai_letter_proposals
TO lor_studio_app;
GRANT SELECT ON TABLE lor_studio.ai_proposal_decisions TO lor_studio_app;

DROP TRIGGER ai_proposal_command_receipts_append_only
  ON lor_studio.ai_proposal_command_receipts;
DROP TABLE lor_studio.ai_proposal_command_receipts;

DROP TRIGGER ai_proposal_generation_reservation_receipts_append_only
  ON lor_studio.ai_proposal_generation_reservation_receipts;
DROP TABLE lor_studio.ai_proposal_generation_reservation_receipts;

ALTER TABLE lor_studio.ai_proposal_decisions
  DROP CONSTRAINT ai_proposal_decisions_record_complete,
  DROP CONSTRAINT ai_proposal_decisions_record_hashes,
  DROP COLUMN accepted_content_record_hash,
  DROP COLUMN decision_record,
  DROP COLUMN proposal_record_hash,
  DROP COLUMN proposal_record;

ALTER TABLE lor_studio.ai_letter_proposals
  DROP CONSTRAINT ai_letter_proposals_record_complete,
  DROP CONSTRAINT ai_letter_proposals_record_hashes,
  DROP COLUMN provider_run_hash,
  DROP COLUMN proposal_record_hash,
  DROP COLUMN proposal_record;

REVOKE EXECUTE ON FUNCTION lor_studio.ai_proposal_record_is_complete(jsonb)
FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.ai_grounding_manifest_is_complete(jsonb)
FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.ai_proposal_command_context_allows(text, text)
FROM lor_studio_command_owner;
REVOKE EXECUTE ON FUNCTION lor_studio.ai_proposal_scope_hash(text, text)
FROM lor_studio_command_owner;
DROP FUNCTION lor_studio.ai_proposal_scope_hash(text, text);
DROP FUNCTION lor_studio.ai_proposal_command_context_allows(text, text);
DROP FUNCTION lor_studio.ai_proposal_record_is_complete(jsonb);

DO $catalog_postflight$
DECLARE
  relation_count bigint;
  forced_rls_count bigint;
  definer_count bigint;
BEGIN
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
  IF relation_count IS DISTINCT FROM 30
    OR forced_rls_count IS DISTINCT FROM 30
    OR definer_count IS DISTINCT FROM 21
    OR pg_catalog.to_regclass('lor_studio.ai_proposal_command_receipts') IS NOT NULL
    OR pg_catalog.to_regclass(
      'lor_studio.ai_proposal_generation_reservation_receipts'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.transition_ai_proposal_generation_reservation(text,text,text,text,text,text)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.persist_ai_provider_run_and_proposal_atomic(text,text,text,text,text,text,text,text,text,jsonb)'
    ) IS NOT NULL
    OR pg_catalog.to_regprocedure(
      'lor_studio.read_faculty_drafting_context()'
    ) IS NOT NULL
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.ai_generation_runs', 'SELECT,INSERT'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.ai_letter_proposals', 'SELECT,INSERT'
    )
    OR NOT pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.ai_proposal_decisions', 'SELECT'
    )
  THEN
    RAISE EXCEPTION 'DR-133 AI proposal command rollback postflight mismatch'
      USING ERRCODE = '55000';
  END IF;
END
$catalog_postflight$;

DO $restore_sentinel$
DECLARE
  observed_sentinel text;
BEGIN
  SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
  INTO STRICT observed_sentinel
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'lor_studio';
  EXECUTE pg_catalog.format(
    'COMMENT ON SCHEMA lor_studio IS %L',
    pg_catalog.regexp_replace(
      observed_sentinel, '\|aiProposalCommands=20260825010900$', ''
    )
  );
END
$restore_sentinel$;

COMMIT;
