import {
  definePgAcceptanceSuite,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

const tableNames = [
  'sf_audio_deletion_intents',
  'sf_reconciliation_runs',
  'sf_reconciliation_state',
];

const repeatableFunctionNames = [
  'sf_reconciliation_report',
  'sf_append_voice_audit_service',
  'sf_voice_audit_payload_ok',
  'sf_reconciliation_sweep_old_runs',
];

function extractRepeatableFunction(source, functionName) {
  const startMarker = `CREATE OR REPLACE FUNCTION public.${functionName}`;
  const start = source.indexOf(startMarker);
  const endMarker = '\n$$;';
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`M4 function definition not found: ${functionName}`);
  }
  return source.slice(start, end + endMarker.length);
}

definePgAcceptanceSuite([
  {
    id: 'T0-01',
    name: 'M4 applies after M1-M3 and creates all three tables',
    async run({ assert, client }) {
      const result = await client.query(
        `SELECT relname
           FROM pg_class
          WHERE relnamespace = 'public'::regnamespace
            AND relname = ANY($1::text[])
          ORDER BY relname`,
        [tableNames],
      );
      assert.deepEqual(result.rows.map(({ relname }) => relname), [...tableNames].sort());
    },
  },
  sourceCase(
    'T0-02',
    'rollback drops the M4 objects and M3 remains independently re-applicable',
    'rollback',
    /DROP TABLE IF EXISTS public\.sf_reconciliation_state;[\s\S]*DROP TABLE IF EXISTS public\.sf_reconciliation_runs;[\s\S]*DROP TABLE IF EXISTS public\.sf_audio_deletion_intents;/,
  ),
  {
    id: 'T0-03',
    name: 'M4 CREATE OR REPLACE functions are re-executable',
    async run({ assert, client, sources }) {
      const definitions = repeatableFunctionNames.map((functionName) => ({
        functionName,
        sql: extractRepeatableFunction(sources.migration, functionName),
      }));
      assert.equal(definitions.length, 4);

      for (const { functionName, sql } of definitions) {
        await assert.doesNotReject(
          client.query(sql),
          `${functionName} must be safely replaceable after M4 is already applied`,
        );
      }
    },
  },
  {
    id: 'T0-04',
    name: 'deletion-intent schema has exact required columns and constraints',
    async run({ assert, client }) {
      const columns = await client.query(
        `SELECT column_name, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name='sf_audio_deletion_intents'
          ORDER BY ordinal_position`,
      );
      assert.deepEqual(
        columns.rows.map(({ column_name }) => column_name),
        ['id', 'run_id', 'object_key', 'category', 'student_ref', 'story_ref',
          'ref_state', 'state', 'attempts', 'resolved_at', 'created_at', 'updated_at'],
      );
      assert.equal(columns.rows.find((row) => row.column_name === 'state').column_default, "'intended'::text");
    },
  },
  {
    id: 'T0-05',
    name: 'reconciliation-runs schema has all eighteen columns',
    async run({ assert, client }) {
      const count = await scalar(
        client,
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='sf_reconciliation_runs'`,
      );
      assert.equal(count, '19');
    },
  },
  {
    id: 'T0-06',
    name: 'singleton-state schema has exact five columns',
    async run({ assert, client }) {
      const result = await client.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='sf_reconciliation_state'
          ORDER BY ordinal_position`,
      );
      assert.deepEqual(
        result.rows.map(({ column_name }) => column_name),
        ['id', 'cursor_key', 'lease_owner', 'lease_expires_at', 'updated_at'],
      );
    },
  },
  {
    id: 'T0-07',
    name: 'singleton row is seeded with the empty cursor',
    async run({ assert, client }) {
      const result = await client.query('SELECT id, cursor_key FROM public.sf_reconciliation_state');
      assert.deepEqual(result.rows, [{ id: 1, cursor_key: '' }]);
    },
  },
  {
    id: 'T0-08',
    name: 'singleton check and primary key enforce one row',
    async run({ assert, client }) {
      await assert.rejects(
        client.query('INSERT INTO public.sf_reconciliation_state (id) VALUES (2)'),
        /sf_reconciliation_state_id_check/,
      );
      await assert.rejects(
        client.query('INSERT INTO public.sf_reconciliation_state (id) VALUES (1)'),
        /duplicate key/,
      );
    },
  },
  {
    id: 'T0-09',
    name: 'all M4 tables force row-level security',
    async run({ assert, client }) {
      const result = await client.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
           FROM pg_class
          WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[])
          ORDER BY relname`,
        [tableNames],
      );
      assert.equal(result.rows.length, 3);
      assert.ok(result.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    },
  },
  {
    id: 'T0-10',
    name: 'deletion intents grant only bounded service access',
    async run({ assert, client }) {
      assert.equal(await scalar(client, `SELECT has_table_privilege('storyforge_app','public.sf_audio_deletion_intents','SELECT,INSERT,UPDATE')`), true);
      assert.equal(await scalar(client, `SELECT has_table_privilege('storyforge_app','public.sf_audio_deletion_intents','DELETE')`), false);
    },
  },
  {
    id: 'T0-11',
    name: 'reconciliation runs grant only bounded service access',
    async run({ assert, client }) {
      assert.equal(await scalar(client, `SELECT has_table_privilege('storyforge_app','public.sf_reconciliation_runs','SELECT,INSERT,UPDATE')`), true);
      assert.equal(await scalar(client, `SELECT has_table_privilege('authenticated','public.sf_reconciliation_runs','SELECT')`), false);
    },
  },
  {
    id: 'T0-12',
    name: 'reconciliation state denies service insert and delete',
    async run({ assert, client }) {
      assert.equal(await scalar(client, `SELECT has_table_privilege('storyforge_app','public.sf_reconciliation_state','SELECT,UPDATE')`), true);
      assert.equal(await scalar(client, `SELECT has_table_privilege('storyforge_app','public.sf_reconciliation_state','INSERT,DELETE')`), false);
    },
  },
  {
    id: 'T0-13',
    name: 'partial unique open-intent index is exact',
    async run({ assert, client }) {
      const definition = await scalar(client, `SELECT pg_get_indexdef('public.sf_deletion_intents_open_key_idx'::regclass)`);
      assert.match(definition, /UNIQUE INDEX[\s\S]*\(object_key\) WHERE \(state = 'intended'::text\)/);
    },
  },
  {
    id: 'T0-14',
    name: 'all three supporting indexes exist',
    async run({ assert, client }) {
      const count = await scalar(
        client,
        `SELECT count(*) FROM pg_indexes
          WHERE schemaname='public' AND indexname=ANY($1::text[])`,
        [[
          'sf_deletion_intents_run_idx',
          'sf_deletion_intents_unresolved_idx',
          'sf_reconciliation_runs_started_idx',
        ]],
      );
      assert.equal(count, '3');
    },
  },
]);
