# Y2-3101 Ledger, Memory, and Reconnection

## Implementation

`FileSessionLedger` stores one canonical JSON envelope with:

- generation;
- sessions;
- ordered event envelopes;
- ordered immutable ledger revisions;
- SHA-256 payload, event, revision, and file hashes.

Writes use an exclusive lock file, a same-directory temporary file, file sync, and atomic rename. In-memory append is rolled back if persistence fails.

## Concurrency and Retry

- Session start is idempotent only for the same authority and payload.
- Turn commit is idempotent only for the same event type and payload hash.
- Expected revision prevents stale in-process mutation.
- Disk content hash prevents stale cross-process writers.
- A failed stale writer leaves its in-memory event/revision append rolled back.

## Memory Model

The reducer preserves:

- claims with exact grounding references;
- open/used callbacks;
- question threads and probe counts;
- possible inconsistencies;
- cumulative STAR coverage;
- reconnect epoch;
- configuration references and status.

Callbacks are durable structured records, not prompt-window memory. Policy may use one only after the configured event threshold and while the current thread retains probe budget.

## Verification

- Unit tests reopen a complete hash chain.
- Corruption is rejected before state is returned.
- Forced reconnect creates a new Brain instance over the same validated ledger.
- Stress wrote and reopened 1,000 events/revisions.
- Twenty development fixtures produced byte-identical decisions across 100 repeated analyses each.
- Frozen holdout T2 passed all 10 ordinary and all 10 forced-reconnect callback cases with zero wrong attribution or confabulation.

## Limitations

The file ledger is an isolated research store. It is not a production database, not a multi-host consensus system, not Y1 authorization, and not a CIE timeline. Production integration requires an accepted transactional repository, RLS-safe command adapter, consent and deletion closure, and separately trusted audit/rollback anchors.

The amended-prompt audit also found commit-time integrity and locking gaps: commit validates revision number and event sequence but does not bind the incoming revision's session ID or previous-revision hash before persistence, so some corruptions fail only on reopen. Lock cleanup removes the lock path even if this process failed to acquire it, which can remove another writer's live lock. These defects are mandatory `Y2-3103` repairs and further prohibit production use.
