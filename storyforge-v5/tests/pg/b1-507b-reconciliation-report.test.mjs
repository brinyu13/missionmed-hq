import {
  definePgAcceptanceSuite,
  inRollback,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

definePgAcceptanceSuite([
  sourceCase('T3-01', 'report authorizes only live StoryForge admin identity', 'migration', /sf_has_live_identity\(ARRAY\['admin'\]\)/),
  sourceCase('T3-02', 'student identity is outside the report role allowlist', 'migration', /RAISE EXCEPTION 'administrator identity required'/),
  sourceCase('T3-03', 'mentor identity is outside the report role allowlist', 'migration', /ARRAY\['admin'\]/),
  {
    id: 'T3-04',
    name: 'service role without identity context is denied by the function',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        await tx.query('SET LOCAL ROLE storyforge_app');
        await assert.rejects(
          tx.query('SELECT * FROM public.sf_reconciliation_report(5)'),
          (error) => error.code === '42501',
        );
      });
    },
  },
  {
    id: 'T3-05',
    name: 'anonymous role has no report execute grant',
    async run({ assert, client }) {
      assert.equal(
        await scalar(client, `SELECT has_function_privilege('anon','public.sf_reconciliation_report(integer)','EXECUTE')`),
        false,
      );
    },
  },
  sourceCase('T3-06', 'report limit clamps low to one', 'migration', /greatest\(1, least\(coalesce\(p_limit, 5\), 8\)\)/),
  sourceCase('T3-07', 'report limit clamps high to eight', 'migration', /least\(coalesce\(p_limit, 5\), 8\)/),
  sourceCase('T3-08', 'report default limit is five', 'migration', /coalesce\(p_limit, 5\)/),
  {
    id: 'T3-09',
    name: 'report return type exposes every ruled field',
    async run({ assert, client }) {
      const definition = await scalar(
        client,
        `SELECT pg_get_function_result('public.sf_reconciliation_report(integer)'::regprocedure)`,
      );
      for (const field of [
        'run_id', 'mode', 'started_at', 'finished_at', 'pages_listed',
        'keys_evaluated', 'candidates', 'preserved', 'deleted_confirmed',
        'object_absent', 'retried', 'failed', 'abort_reason', 'suspended',
        'suspension_reason', 'cursor_digest_start', 'cursor_digest_end', 'replica_id',
      ]) assert.match(definition, new RegExp(`\\b${field}\\b`));
    },
  },
  {
    id: 'T3-10',
    name: 'run schema has no object-key column',
    async run({ assert, client }) {
      assert.equal(
        await scalar(client, `SELECT count(*) FROM information_schema.columns WHERE table_name='sf_reconciliation_runs' AND column_name IN ('object_key','cursor_key')`),
        '0',
      );
    },
  },
  {
    id: 'T3-11',
    name: 'run schema has no student or story identifier',
    async run({ assert, client }) {
      assert.equal(
        await scalar(client, `SELECT count(*) FROM information_schema.columns WHERE table_name='sf_reconciliation_runs' AND (column_name ILIKE '%student%' OR column_name ILIKE '%story%')`),
        '0',
      );
    },
  },
  {
    id: 'T3-13',
    name: 'retention sweep deletes finished runs older than 180 days',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        const inserted = await tx.query(
          `INSERT INTO public.sf_reconciliation_runs
             (mode, started_at, finished_at, replica_id)
           VALUES ('dry_run', now()-interval '200 days', now()-interval '190 days', 'test')
           RETURNING id`,
        );
        assert.equal(await scalar(tx, 'SELECT public.sf_reconciliation_sweep_old_runs()'), 1);
        assert.equal(await scalar(tx, 'SELECT count(*) FROM public.sf_reconciliation_runs WHERE id=$1', [inserted.rows[0].id]), '0');
      });
    },
  },
  {
    id: 'T3-14',
    name: 'retention sweep preserves unfinished runs',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        const inserted = await tx.query(
          `INSERT INTO public.sf_reconciliation_runs (mode, started_at, replica_id)
           VALUES ('dry_run', now()-interval '200 days', 'test') RETURNING id`,
        );
        await tx.query('SELECT public.sf_reconciliation_sweep_old_runs()');
        assert.equal(await scalar(tx, 'SELECT count(*) FROM public.sf_reconciliation_runs WHERE id=$1', [inserted.rows[0].id]), '1');
      });
    },
  },
  {
    id: 'T3-15',
    name: 'retention sweep preserves recent finished runs',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        const inserted = await tx.query(
          `INSERT INTO public.sf_reconciliation_runs
             (mode, started_at, finished_at, replica_id)
           VALUES ('dry_run', now()-interval '3 days', now()-interval '2 days', 'test')
           RETURNING id`,
        );
        await tx.query('SELECT public.sf_reconciliation_sweep_old_runs()');
        assert.equal(await scalar(tx, 'SELECT count(*) FROM public.sf_reconciliation_runs WHERE id=$1', [inserted.rows[0].id]), '1');
      });
    },
  },
  sourceCase('T3-19', 'WordPress role alone is never consulted by report authorization', 'migration', /sf_has_live_identity\(ARRAY\['admin'\]\)/),
]);
