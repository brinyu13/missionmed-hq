import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import pg from 'pg';

import {
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const { Pool } = pg;
const RUN_REAL_MATRIX = process.env.LOR_RUN_REAL_POSTGRES_MATRIX === '1';
const TOOLCHAINS = Object.freeze([
  Object.freeze({ major: 16, root: '/opt/homebrew/opt/postgresql@16/bin' }),
  Object.freeze({ major: 18, root: '/opt/homebrew/opt/postgresql@18/bin' }),
]);
const EXPECTED_SNAPSHOT_HASH = Object.freeze({
  16: '9d937c7afb12b672396d6e71068456e2a5fddcd756c9848a46e3a75f49bb7957',
  18: '94161596e3cb46a717a1a823c2b1405defc244b5aa5e77668c8a43d343a2348b',
});
const MIGRATION_NAMES = Object.freeze([
  '20260820180700_f2_lor_1012_schema_foundation.sql',
  '20260820180800_f2_lor_1012_rls_projection_grants.sql',
  '20260825010200_f2_lor_1012_identity_scope_commands.sql',
  '20260825010400_f2_lor_1012_faculty_invitation_commands.sql',
  '20260825010600_f2_lor_1012_faculty_private_export_commands.sql',
  '20260825010800_f2_lor_1012_ai_proposal_commands.sql',
]);
const migrationsDirectory = new URL('../../scripts/lor-studio/migrations/', import.meta.url);
const rollbackPath = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010800_f2_lor_1012_ai_proposal_commands.rollback.sql',
  import.meta.url,
);
const productionRollbackPath = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010900_f2_lor_1012_production_ai_proposal_commands.rollback.sql',
  import.meta.url,
);

function binaries(root) {
  return Object.freeze({
    initdb: path.join(root, 'initdb'),
    pgCtl: path.join(root, 'pg_ctl'),
    createdb: path.join(root, 'createdb'),
    psql: path.join(root, 'psql'),
  });
}

function extractSnapshotSql(source) {
  const match = source.match(
    /-- BEGIN AI_ROLLBACK_CUSTODY_SNAPSHOT\n([\s\S]*?)  -- END AI_ROLLBACK_CUSTODY_SNAPSHOT/u,
  );
  assert.ok(match, 'exact AI rollback custody snapshot marker is required');
  const query = match[1].replace(
    /SELECT lor_studio\.canonical_jsonb_sha256\(snapshot\.value\)\n  INTO snapshot_hash\n  FROM snapshot;/u,
    'SELECT lor_studio.canonical_jsonb_sha256(snapshot.value) AS snapshot_hash FROM snapshot;',
  );
  assert.notEqual(query, match[1], 'snapshot query must expose one test-readable hash');
  return query;
}

async function withHarness(toolchain, operation) {
  const toolchainBinaries = binaries(toolchain.root);
  for (const binary of Object.values(toolchainBinaries)) await access(binary);
  const harness = createDisposablePostgresHarness({
    binaries: toolchainBinaries,
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

async function assertRollbackRejected(harness) {
  await assert.rejects(
    () => harness.applySqlFile(rollbackPath.pathname),
    (error) => error?.code === 'SQL_FILE_APPLY_FAILED',
  );
}

async function readSnapshotHash(pool, snapshotSql) {
  const { rows } = await pool.query(snapshotSql);
  assert.equal(rows.length, 1);
  return rows[0].snapshot_hash;
}

function quoteIdentifier(value) {
  assert.match(value, /^[A-Za-z_][A-Za-z0-9_]*$/u);
  return `"${value}"`;
}

test('108/109 exact-custody guards are semantic twins and name every destructive catalog axis', async () => {
  const [localRollback, productionRollback] = await Promise.all([
    readFile(rollbackPath, 'utf8'),
    readFile(productionRollbackPath, 'utf8'),
  ]);
  const localSnapshot = extractSnapshotSql(localRollback);
  const productionSnapshot = extractSnapshotSql(productionRollback);
  assert.equal(productionSnapshot, localSnapshot);
  for (const required of [
    'pg_attribute', 'attacl', 'pg_attrdef', 'pg_constraint', 'pg_index',
    'indisclustered', 'indisreplident', 'pg_trigger', 'tgisinternal', 'tgenabled',
    'pg_policy', 'pg_rewrite', 'pg_inherits', 'pg_depend', 'pg_publication_rel',
    'pg_statistic_ext', 'pg_description', 'pg_seclabel', 'pg_get_functiondef',
    'pg_type', 'typacl', 'type_acl_rows', 'proconfig', 'reltoastrelid',
    'attmissingval', 'pg_get_constraintdef', 'pg_get_indexdef', 'aclIsNull',
    'aclexplode',
  ]) {
    assert.match(localSnapshot, new RegExp(required, 'u'), required);
  }
  assert.doesNotMatch(localRollback, /\bCASCADE\b/u);
  assert.doesNotMatch(productionRollback, /\bCASCADE\b/u);
  for (const hash of Object.values(EXPECTED_SNAPSHOT_HASH)) {
    assert.match(localRollback, new RegExp(hash, 'u'));
    assert.match(productionRollback, new RegExp(hash, 'u'));
  }
});

for (const toolchain of TOOLCHAINS) {
  test(`AI rollback exact custody rejects catalog drift and cleanly reverses/reapplies on PostgreSQL ${toolchain.major}`, {
    skip: !RUN_REAL_MATRIX,
    timeout: 180_000,
  }, async () => {
    const rollbackSource = await readFile(rollbackPath, 'utf8');
    const snapshotSql = extractSnapshotSql(rollbackSource);
    await withHarness(toolchain, async ({ harness, pool }) => {
      await applyForward(harness);
      assert.equal(
        await readSnapshotHash(pool, snapshotSql),
        EXPECTED_SNAPSHOT_HASH[toolchain.major],
      );

      const { rows: [functionRow] } = await pool.query(`
        SELECT pg_catalog.pg_get_functiondef(
          'lor_studio.ai_proposal_scope_hash(text,text)'::pg_catalog.regprocedure
        ) AS definition
      `);
      const { rows: [internalTriggerRow] } = await pool.query(`
        SELECT trigger_row.tgname
        FROM pg_catalog.pg_trigger AS trigger_row
        WHERE trigger_row.tgrelid =
          'lor_studio.ai_proposal_command_receipts'::pg_catalog.regclass
          AND trigger_row.tgisinternal
        ORDER BY trigger_row.tgname
        LIMIT 1
      `);
      assert.equal(typeof internalTriggerRow?.tgname, 'string');

      const cases = [
        {
          name: 'relation ACL',
          mutate: () => pool.query(
            'GRANT SELECT ON lor_studio.ai_proposal_command_receipts TO lor_studio_app',
          ),
          restore: () => pool.query(
            'REVOKE SELECT ON lor_studio.ai_proposal_command_receipts FROM lor_studio_app',
          ),
        },
        {
          name: 'column ACL',
          mutate: () => pool.query(
            'GRANT SELECT (case_id) ON lor_studio.ai_proposal_command_receipts TO lor_studio_app',
          ),
          restore: () => pool.query(
            'REVOKE SELECT (case_id) ON lor_studio.ai_proposal_command_receipts FROM lor_studio_app',
          ),
        },
        {
          name: 'row type ACL',
          mutate: () => pool.query(
            'GRANT USAGE ON TYPE lor_studio.ai_proposal_command_receipts TO lor_studio_app',
          ),
          restore: async () => {
            await pool.query(
              'REVOKE USAGE ON TYPE lor_studio.ai_proposal_command_receipts FROM lor_studio_app',
            );
            // REVOKE retains an explicit owner-only ACL; restore the exact NULL
            // catalog preimage in this disposable hostile-test database.
            await pool.query(`
              UPDATE pg_catalog.pg_type SET typacl = NULL
              WHERE oid = 'lor_studio.ai_proposal_command_receipts'::pg_catalog.regtype
            `);
          },
        },
        {
          name: 'function ACL',
          mutate: () => pool.query(
            'GRANT EXECUTE ON FUNCTION lor_studio.ai_proposal_scope_hash(text,text) TO lor_studio_app',
          ),
          restore: () => pool.query(
            'REVOKE EXECUTE ON FUNCTION lor_studio.ai_proposal_scope_hash(text,text) FROM lor_studio_app',
          ),
        },
        {
          name: 'function body',
          mutate: () => pool.query(`
            CREATE OR REPLACE FUNCTION lor_studio.ai_proposal_scope_hash(
              candidate_case_id text, candidate_operation text
            )
            RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
            AS $$ SELECT pg_catalog.repeat('0', 64) $$
          `),
          restore: () => pool.query(functionRow.definition),
        },
        {
          name: 'function configuration',
          mutate: () => pool.query(`
            ALTER FUNCTION lor_studio.ai_proposal_scope_hash(text,text)
            SET work_mem = '64kB'
          `),
          restore: () => pool.query(`
            ALTER FUNCTION lor_studio.ai_proposal_scope_hash(text,text)
            RESET work_mem
          `),
        },
        {
          name: 'relation comment',
          mutate: () => pool.query(`
            COMMENT ON TABLE lor_studio.ai_proposal_command_receipts
            IS 'contained custody drift'
          `),
          restore: () => pool.query(`
            COMMENT ON TABLE lor_studio.ai_proposal_command_receipts IS NULL
          `),
        },
        {
          name: 'function comment',
          mutate: () => pool.query(`
            COMMENT ON FUNCTION lor_studio.ai_proposal_scope_hash(text,text)
            IS 'contained custody drift'
          `),
          restore: () => pool.query(`
            COMMENT ON FUNCTION lor_studio.ai_proposal_scope_hash(text,text) IS NULL
          `),
        },
        {
          name: 'column comment',
          mutate: () => pool.query(`
            COMMENT ON COLUMN lor_studio.ai_proposal_command_receipts.case_id
            IS 'contained custody drift'
          `),
          restore: () => pool.query(`
            COMMENT ON COLUMN lor_studio.ai_proposal_command_receipts.case_id IS NULL
          `),
        },
        {
          name: 'row type comment',
          mutate: () => pool.query(`
            COMMENT ON TYPE lor_studio.ai_proposal_command_receipts
            IS 'contained custody drift'
          `),
          restore: () => pool.query(`
            COMMENT ON TYPE lor_studio.ai_proposal_command_receipts IS NULL
          `),
        },
        {
          name: 'security label metadata',
          mutate: () => pool.query(`
            INSERT INTO pg_catalog.pg_seclabel (
              objoid, classoid, objsubid, provider, label
            ) VALUES (
              'lor_studio.ai_proposal_command_receipts'::pg_catalog.regclass::oid,
              'pg_catalog.pg_class'::pg_catalog.regclass::oid,
              0, 'missionmed_custody_test', 'contained custody drift'
            )
          `),
          restore: () => pool.query(`
            DELETE FROM pg_catalog.pg_seclabel
            WHERE classoid = 'pg_catalog.pg_class'::pg_catalog.regclass::oid
              AND objoid =
                'lor_studio.ai_proposal_command_receipts'::pg_catalog.regclass::oid
              AND objsubid = 0
              AND provider = 'missionmed_custody_test'
          `),
        },
        {
          name: 'not-null metadata',
          mutate: () => pool.query(`
            ALTER TABLE lor_studio.ai_letter_proposals
            ALTER COLUMN proposal_record DROP NOT NULL
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_letter_proposals
            ALTER COLUMN proposal_record SET NOT NULL
          `),
        },
        {
          name: 'column default',
          mutate: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            ALTER COLUMN case_id SET DEFAULT 'contained-custody-drift'
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            ALTER COLUMN case_id DROP DEFAULT
          `),
        },
        {
          name: 'constraint inventory',
          mutate: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            ADD CONSTRAINT ai_command_contained_drift CHECK (true)
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            DROP CONSTRAINT ai_command_contained_drift
          `),
        },
        {
          name: 'index inventory',
          mutate: () => pool.query(`
            CREATE INDEX ai_command_contained_drift_idx
            ON lor_studio.ai_proposal_command_receipts (case_id)
          `),
          restore: () => pool.query('DROP INDEX lor_studio.ai_command_contained_drift_idx'),
        },
        {
          name: 'clustered index state',
          mutate: () => pool.query(`
            CLUSTER lor_studio.ai_proposal_command_receipts
            USING ai_proposal_command_receipts_proposal_idx
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts SET WITHOUT CLUSTER
          `),
        },
        {
          name: 'base relation options',
          mutate: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            SET (autovacuum_enabled = false)
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            RESET (autovacuum_enabled)
          `),
        },
        {
          name: 'index relation options',
          mutate: () => pool.query(`
            ALTER INDEX lor_studio.ai_proposal_command_receipts_proposal_idx
            SET (fillfactor = 80)
          `),
          restore: () => pool.query(`
            ALTER INDEX lor_studio.ai_proposal_command_receipts_proposal_idx
            RESET (fillfactor)
          `),
        },
        {
          name: 'internal trigger enable state',
          mutate: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            DISABLE TRIGGER ${quoteIdentifier(internalTriggerRow.tgname)}
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            ENABLE TRIGGER ${quoteIdentifier(internalTriggerRow.tgname)}
          `),
        },
        {
          name: 'policy roles',
          mutate: () => pool.query(`
            ALTER POLICY ai_proposal_command_receipts_faculty_select
            ON lor_studio.ai_proposal_command_receipts TO PUBLIC
          `),
          restore: () => pool.query(`
            ALTER POLICY ai_proposal_command_receipts_faculty_select
            ON lor_studio.ai_proposal_command_receipts TO lor_studio_command_owner
          `),
        },
        {
          name: 'rule inventory',
          mutate: () => pool.query(`
            CREATE RULE ai_command_contained_drift_rule AS
            ON DELETE TO lor_studio.ai_proposal_command_receipts DO INSTEAD NOTHING
          `),
          restore: async () => {
            await pool.query(`
              DROP RULE ai_command_contained_drift_rule
              ON lor_studio.ai_proposal_command_receipts
            `);
            // PostgreSQL leaves relhasrules as a conservative true hint after
            // the last rule is dropped; restore the exact disposable preimage.
            await pool.query(`
              UPDATE pg_catalog.pg_class SET relhasrules = false
              WHERE oid = 'lor_studio.ai_proposal_command_receipts'::pg_catalog.regclass
            `);
          },
        },
        {
          name: 'inheritance edge',
          mutate: () => pool.query(`
            CREATE TABLE lor_studio.ai_command_contained_drift_child ()
            INHERITS (lor_studio.ai_proposal_command_receipts)
          `),
          restore: async () => {
            await pool.query('DROP TABLE lor_studio.ai_command_contained_drift_child');
            // PostgreSQL retains relhassubclass as a conservative hint.
            await pool.query(`
              UPDATE pg_catalog.pg_class SET relhassubclass = false
              WHERE oid = 'lor_studio.ai_proposal_command_receipts'::pg_catalog.regclass
            `);
          },
        },
        {
          name: 'dependent object',
          mutate: () => pool.query(`
            CREATE VIEW lor_studio.ai_command_contained_drift_view AS
            SELECT receipt_id FROM lor_studio.ai_proposal_command_receipts
          `),
          restore: () => pool.query('DROP VIEW lor_studio.ai_command_contained_drift_view'),
        },
        {
          name: 'publication membership',
          mutate: () => pool.query(`
            CREATE PUBLICATION ai_command_contained_drift_publication
            FOR TABLE lor_studio.ai_proposal_command_receipts
          `),
          restore: () => pool.query('DROP PUBLICATION ai_command_contained_drift_publication'),
        },
        {
          name: 'extended statistics',
          mutate: () => pool.query(`
            CREATE STATISTICS lor_studio.ai_command_contained_drift_statistics
            ON case_id, student_auth_subject
            FROM lor_studio.ai_proposal_command_receipts
          `),
          restore: () => pool.query(
            'DROP STATISTICS lor_studio.ai_command_contained_drift_statistics',
          ),
        },
        {
          name: 'toast relation options',
          mutate: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            SET (toast.autovacuum_enabled = false)
          `),
          restore: () => pool.query(`
            ALTER TABLE lor_studio.ai_proposal_command_receipts
            RESET (toast.autovacuum_enabled)
          `),
        },
      ];

      for (const custodyCase of cases) {
        await custodyCase.mutate();
        assert.notEqual(
          await readSnapshotHash(pool, snapshotSql),
          EXPECTED_SNAPSHOT_HASH[toolchain.major],
          custodyCase.name,
        );
        await assertRollbackRejected(harness);
        await custodyCase.restore();
        assert.equal(
          await readSnapshotHash(pool, snapshotSql),
          EXPECTED_SNAPSHOT_HASH[toolchain.major],
          `${custodyCase.name} restore`,
        );
      }

      await harness.applySqlFile(rollbackPath.pathname);
      await harness.applySqlFile(path.resolve(
        migrationsDirectory.pathname,
        '20260825010800_f2_lor_1012_ai_proposal_commands.sql',
      ));
      assert.equal(
        await readSnapshotHash(pool, snapshotSql),
        EXPECTED_SNAPSHOT_HASH[toolchain.major],
      );
    });
  });
}
