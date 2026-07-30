import {
  definePgAcceptanceSuite,
  inRollback,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

const sourceCases = [
  ['T2-01', 'INTEND inserts a zero-attempt intended row', /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, 'intended'\)/],
  ['T2-02', 'INTEND is idempotent for one open object key', /ON CONFLICT \(object_key\) WHERE state = 'intended'[\s\S]*DO NOTHING/],
  ['T2-03', 'resolved keys may receive a later open intent', /ON CONFLICT \(object_key\) WHERE state = 'intended'/],
  ['T2-04', 'failed keys may receive a later open intent', /WHERE state = 'intended'/],
  ['T2-05', 'successful object deletion resolves deleted-confirmed', /return 'deleted_confirmed'/],
  ['T2-06', 'NoSuchKey resolves object-absent', /noSuchKey\(error\)\) return 'object_absent'/],
  ['T2-07', 'object deletion failure increments attempts', /SET attempts = attempts \+ 1/],
  ['T2-08', 'three failed attempts transition terminally', /INTENT_MAX_ATTEMPTS = 3[\s\S]*SET state = 'failed'/],
  ['T2-09', 'exhausted intent aborts with the ruled reason', /error\.code = 'reconciliation_audit_failed'/],
  ['T2-10', 'RESOLVE and audit share one database transaction', /async function resolveIntent[\s\S]*return transaction\(async \(client\)[\s\S]*await appendAudit/],
  ['T2-11', 'deleted confirmation emits reconciliation_deleted', /action: terminalState === 'object_absent'[\s\S]*: 'reconciliation_deleted'/],
  ['T2-12', 'object absence emits reconciliation_object_absent', /'reconciliation_object_absent'/],
  ['T2-13', 'deletion-intent audit uses the intent entity', /entityType: 'deletion_intent'/],
  ['T2-14', 'orphan audit foreign keys are null', /\$1, \$2, \$3, NULL, NULL, NULL, \$4::jsonb/],
  ['T2-15', 'dry-run returns before intent creation', /if \(mode === 'on'\)[\s\S]*createIntent/],
  ['T2-16', 'R2 deletion is isolated to the live-mode intent processor', /new DeleteObjectCommand/],
  ['T2-17', 'unresolved intended rows are recovered before listing', /await recoverUnresolved\(counters\)[\s\S]*await listPage/],
  ['T2-18', 'recovery treats repeat 404 deletion as object-absent', /noSuchKey\(error\)[\s\S]*object_absent/],
  ['T2-24', 'retry writes the bounded retry audit action', /action: 'object_delete_retried'/],
];

const cases = sourceCases.map(([id, name, pattern]) => (
  sourceCase(id, name, 'reconciliation', pattern)
));

cases.push(
  {
    id: 'T2-19',
    name: 'state check rejects unknown intent states',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        await assert.rejects(
          tx.query(
            `INSERT INTO public.sf_audio_deletion_intents
              (run_id, object_key, category, ref_state, state)
             VALUES (gen_random_uuid(),'storyforge-audio/x','orphan_invalid_key','invalid_key','unknown')`,
          ),
          (error) => error.code === '23514',
        );
      });
    },
  },
  {
    id: 'T2-20',
    name: 'category check rejects unknown categories',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        await assert.rejects(
          tx.query(
            `INSERT INTO public.sf_audio_deletion_intents
              (run_id, object_key, category, ref_state)
             VALUES (gen_random_uuid(),'storyforge-audio/x','unknown','invalid_key')`,
          ),
          /sf_audio_deletion_intents_category_check/,
        );
      });
    },
  },
  {
    id: 'T2-21',
    name: 'reference-state check rejects unknown values',
    async run({ assert, client }) {
      await inRollback(client, async (tx) => {
        await assert.rejects(
          tx.query(
            `INSERT INTO public.sf_audio_deletion_intents
              (run_id, object_key, category, ref_state)
             VALUES (gen_random_uuid(),'storyforge-audio/x','orphan_invalid_key','unknown')`,
          ),
          /sf_audio_deletion_intents_ref_state_check/,
        );
      });
    },
  },
  {
    id: 'T2-22',
    name: 'attempt counter is constrained to zero through three',
    async run({ assert, client }) {
      const definition = await scalar(
        client,
        `SELECT pg_get_constraintdef(oid)
           FROM pg_constraint
          WHERE conrelid='public.sf_audio_deletion_intents'::regclass
            AND conname='sf_audio_deletion_intents_attempts_check'`,
      );
      assert.match(definition, /attempts >= 0[\s\S]*attempts <= 3/);
    },
  },
  {
    id: 'T2-23',
    name: 'service role has no intent DELETE authority',
    async run({ assert, client }) {
      assert.equal(
        await scalar(client, `SELECT has_table_privilege('storyforge_app','public.sf_audio_deletion_intents','DELETE')`),
        false,
      );
    },
  },
  {
    id: 'T2-25',
    name: 'terminal-state and resolved-at consistency is enforced',
    async run({ assert, client }) {
      const definitions = await client.query(
        `SELECT pg_get_constraintdef(oid) AS definition
           FROM pg_constraint
          WHERE conrelid='public.sf_audio_deletion_intents'::regclass
            AND contype='c'`,
      );
      assert.ok(definitions.rows.some(({ definition }) => (
        definition.includes("state = 'intended'") && definition.includes('resolved_at IS NULL')
      )));
    },
  },
);

definePgAcceptanceSuite(cases);
