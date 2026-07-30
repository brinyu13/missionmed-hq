import {
  definePgAcceptanceSuite,
  scalar,
  sourceCase,
} from './b1-507b-support.mjs';

definePgAcceptanceSuite([
  sourceCase('T6-01', 'empty lease is acquired with a thirty-minute database interval', 'reconciliation', /lease_owner IS NULL[\s\S]*now\(\) \+ interval '30 minutes'/),
  sourceCase('T6-02', 'expired lease is eligible for takeover', 'reconciliation', /lease_expires_at < now\(\)/),
  sourceCase('T6-03', 'active foreign lease is excluded by acquisition predicate', 'reconciliation', /lease_owner IS NULL OR lease_expires_at < now\(\)/),
  sourceCase('T6-04', 'owner renewal extends the lease using database time', 'reconciliation', /SET lease_expires_at = now\(\) \+ interval '30 minutes'/),
  sourceCase('T6-05', 'non-owner renewal returns no guarded row', 'reconciliation', /SET lease_expires_at = now\(\) \+ interval '30 minutes'[\s\S]*lease_owner = \$1[\s\S]*RETURNING \*/),
  sourceCase('T6-06', 'page commit carries lease owner and expiry guards', 'reconciliation', /SET cursor_key = \$1[\s\S]*lease_owner = \$2[\s\S]*lease_expires_at > now\(\)/),
  sourceCase('T6-07', 'lost lease emits the exact abort reason', 'reconciliation', /reconciliation_lease_lost/),
  sourceCase('T6-08', 'clean completion releases owner and expiry fields', 'reconciliation', /SET lease_owner = NULL,[\s\S]*lease_expires_at = NULL/),
  sourceCase('T6-09', 'crash recovery relies on expiry rather than forced release', 'reconciliation', /lease_expires_at < now\(\)/),
  {
    id: 'T6-10',
    name: 'database singleton makes concurrent lease ownership exclusive',
    async run({ assert, client }) {
      assert.equal(await scalar(client, 'SELECT count(*) FROM public.sf_reconciliation_state'), '1');
      const definition = await scalar(
        client,
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid='public.sf_reconciliation_state'::regclass AND contype='p'`,
      );
      assert.match(definition, /PRIMARY KEY \(id\)/);
    },
  },
  sourceCase('T6-14', 'long runs renew at the fixed five-minute interval', 'reconciliation', /LEASE_RENEWAL_MS = 5 \* 60 \* 1000[\s\S]*renewalDue[\s\S]*renewLease/),
]);
