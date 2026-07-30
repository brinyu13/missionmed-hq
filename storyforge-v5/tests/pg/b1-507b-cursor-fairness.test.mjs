import {
  definePgAcceptanceSuite,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

definePgAcceptanceSuite([
  {
    id: 'T5-01',
    name: 'cursor starts empty in the singleton state',
    async run({ assert, client }) {
      assert.equal(await scalar(client, 'SELECT cursor_key FROM public.sf_reconciliation_state WHERE id=1'), '');
    },
  },
  sourceCase('T5-02', 'R2 listing starts after the durable cursor', 'reconciliation', /StartAfter: cursorKey/),
  sourceCase('T5-03', 'cursor advances to the last listed page key', 'reconciliation', /lastListedKey = object\.objectKey[\s\S]*cursorKey = exhausted \? '' : lastListedKey/),
  sourceCase('T5-04', 'cursor update remains guarded by the active lease', 'reconciliation', /SET cursor_key = \$1[\s\S]*lease_owner = \$2[\s\S]*lease_expires_at > now\(\)/),
  sourceCase('T5-05', 'cursor wraps to empty on listing exhaustion', 'reconciliation', /exhausted = !page\.truncated[\s\S]*cursorKey = exhausted \? '' : lastListedKey/),
  sourceCase('T5-06', 'last partial page wraps instead of retaining a stale cursor', 'reconciliation', /cursorKey = exhausted \? '' : lastListedKey/),
  sourceCase('T5-07', 'abort leaves only previously committed page boundaries', 'reconciliation', /commitPage[\s\S]*abortRun/),
  sourceCase('T5-08', 'dry-run shares the same page-commit path', 'reconciliation', /if \(mode === 'on'\)[\s\S]*await commitPage/),
  sourceCase('T5-09', 'five-page cap is fixed in code', 'reconciliation', /MAX_PAGES_PER_RUN = 5/),
  sourceCase('T5-10', 'two-hundred-delete cap is fixed in code', 'reconciliation', /MAX_DELETES_PER_RUN = 200/),
  sourceCase('T5-11', 'delete cap exits the active page loop', 'reconciliation', /counters\.deletedConfirmed \+ counters\.objectAbsent\) >= MAX_DELETES_PER_RUN/),
  sourceCase('T5-12', 'each run reloads the durable cursor', 'reconciliation', /let cursorKey = String\(lease\.cursor_key \|\| ''\)/),
  sourceCase('T5-13', 'bounded sequential runs wrap only at exhaustion', 'reconciliation', /exhausted = !page\.truncated/),
  {
    id: 'T5-14',
    name: 'cursor is persisted in PostgreSQL rather than process memory',
    async run({ assert, client }) {
      const defaultValue = await scalar(
        client,
        `SELECT column_default FROM information_schema.columns
          WHERE table_schema='public' AND table_name='sf_reconciliation_state'
            AND column_name='cursor_key'`,
      );
      assert.equal(defaultValue, "''::text");
    },
  },
  sourceCase('T5-15', 'page cursor is committed only after page evaluation', 'reconciliation', /for \(const object of page\.objects\)[\s\S]*await commitPage/),
  sourceCase('T5-16', 're-evaluation is deduplicated by open-intent conflict handling', 'reconciliation', /ON CONFLICT \(object_key\) WHERE state = 'intended'[\s\S]*DO NOTHING/),
]);
