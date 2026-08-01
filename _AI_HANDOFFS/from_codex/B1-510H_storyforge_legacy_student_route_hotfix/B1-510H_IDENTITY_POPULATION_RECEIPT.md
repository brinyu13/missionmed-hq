# B1-510H Identity Population Receipt

## Applied population

- canonical entitled non-admin students: 439;
- PostgreSQL rows inserted: 439;
- WordPress UUID metadata values written: 439;
- existing Founder mappings reassigned: 0;
- duplicate WordPress IDs: 0;
- duplicate UUIDs: 0;
- conflicts or invalid identities: 0.

PostgreSQL applied all rows in one transaction. A deliberate repeat exposed a
retry weakness in the operator implementation: the transaction attempted an
already-present primary key. No mapping was changed or duplicated. The command
was hardened to use conflict-free insertion followed by exact identity
verification. Its repeat then completed with 441 rows and zero changes.

WordPress application results:

- initial apply: 439 checked, 439 written;
- verify: 439 checked, 0 written;
- repeat apply: 439 checked, 0 written;
- final verify: 439 checked, 0 written.

## Acceptance roster

All 11 Founder-specified existing accounts resolved, passed canonical
entitlement, received or preserved one UUID, matched one PostgreSQL row, and
issued a valid StoryForge student JWT. The receipt omits usernames, emails,
WordPress IDs, and UUIDs to avoid reproducing private identity data.

## Final integrity

- `sf_users`: 441;
- distinct WordPress IDs: 441;
- distinct UUIDs: 441;
- final entitled `ALREADY_VALID`: 439;
- remaining needs/conflicts/invalid: 0.
