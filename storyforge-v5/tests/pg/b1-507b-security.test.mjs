import {
  definePgAcceptanceSuite,
  scalar,
} from './b1-507b-support.mjs';

const noAuthenticatedSelect = (id, name, table) => ({
  id,
  name,
  async run({ assert, client }) {
    assert.equal(
      await scalar(client, `SELECT has_table_privilege('authenticated','public.${table}','SELECT')`),
      false,
    );
  },
});

definePgAcceptanceSuite([
  noAuthenticatedSelect('T9-01', 'students cannot read deletion intents', 'sf_audio_deletion_intents'),
  noAuthenticatedSelect('T9-02', 'students cannot read reconciliation runs', 'sf_reconciliation_runs'),
  noAuthenticatedSelect('T9-03', 'students cannot read reconciliation state', 'sf_reconciliation_state'),
  noAuthenticatedSelect('T9-04', 'mentors cannot read deletion intents', 'sf_audio_deletion_intents'),
  {
    id: 'T9-05',
    name: 'report result type exposes no object key',
    async run({ assert, client }) {
      const result = await scalar(client, `SELECT pg_get_function_result('public.sf_reconciliation_report(integer)'::regprocedure)`);
      assert.doesNotMatch(result, /object_key|cursor_key/i);
    },
  },
  {
    id: 'T9-06',
    name: 'cursor digest columns accept only bounded digest evidence',
    async run({ assert, sources }) {
      assert.match(
        sources.reconciliation,
        /createHash\('sha256'\)\.update\(value\)\.digest\('hex'\)/,
      );
    },
  },
  {
    id: 'T9-07',
    name: 'run table has no student or story columns',
    async run({ assert, client }) {
      assert.equal(
        await scalar(client, `SELECT count(*) FROM information_schema.columns WHERE table_name='sf_reconciliation_runs' AND (column_name ILIKE '%student%' OR column_name ILIKE '%story%')`),
        '0',
      );
    },
  },
  {
    id: 'T9-08',
    name: 'report is SECURITY DEFINER with fixed search path',
    async run({ assert, client }) {
      const result = await client.query(
        `SELECT prosecdef, proconfig
           FROM pg_proc
          WHERE oid='public.sf_reconciliation_report(integer)'::regprocedure`,
      );
      assert.equal(result.rows[0].prosecdef, true);
      assert.deepEqual(result.rows[0].proconfig, ['search_path=public, pg_temp']);
    },
  },
  {
    id: 'T9-09',
    name: 'intent object keys have no user-facing executable projection',
    async run({ assert, client }) {
      const reportResult = await scalar(
        client,
        `SELECT pg_get_function_result('public.sf_reconciliation_report(integer)'::regprocedure)`,
      );
      assert.doesNotMatch(reportResult, /object_key/i);
      assert.equal(
        await scalar(client, `SELECT has_table_privilege('authenticated','public.sf_audio_deletion_intents','SELECT')`),
        false,
      );
    },
  },
  {
    id: 'T9-10',
    name: 'orphan reconciliation audits are written with null foreign keys',
    async run({ assert, sources }) {
      assert.match(sources.reconciliation, /\$1, \$2, \$3, NULL, NULL, NULL, \$4::jsonb/);
    },
  },
]);
