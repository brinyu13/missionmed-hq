# Rollback Contract — Pending Product and Provider Mutations

Status: PROPOSAL ONLY. No product/provider mutation occurred, so there is no applied state to reverse.

Before any future write in WP-3 through WP-7:

1. Re-read exact provider/project/service/source/commit/object identities and all affected callers.
2. Capture a privacy-safe pre-state hash/config export and an exact reverse operation.
3. Obtain the narrowest Lease V2 scope and the mutation-specific approval required by the active ticket.
4. Gate or migrate consumers before revoking access.
5. Apply one bounded change, read back natively, run the required negative and positive tests, and issue a receipt.
6. On any failed positive student flow, ambiguous identity, lost lease, or failed negative test, stop exposure growth and execute only the recorded reverse operation.

Never delete recordings, objects, registry entries, tables, student data, or transcript content. Never restore broad anonymous access merely to make a flow pass; instead disable the new path/feature flag and return to the captured safe pre-state.
