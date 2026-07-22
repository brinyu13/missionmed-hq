# Y2-3100 DISC-06 Events, Idempotency, and Audit

## Existing Mutation Envelope

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/mutationEnvelope.mjs:19` through `:37` normalizes `idempotency_key`, `request_hash`, `expected_row_version`, `request_id`, `correlation_id`, and `causation_id`.
- **VERIFIED:** Lines `:40` through `:44` reject reuse of one idempotency key with a different canonical request hash.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/mutationReceiptStore.mjs:16` through `:46` begins or replays a durable mutation receipt; `:49` through `:68` records completion or failure.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/auditStore.mjs:7` through `:38` writes server-authoritative actor, owner, event type, resource identity, and bounded details.

## Required Interview Event Shape

The following is a future contract recommendation, not an implemented route:

```text
InterviewTurnEventV1
  event_id
  session_id
  owner_user_id
  turn_sequence
  event_type
  actor_type
  actor_ref
  policy_snapshot_ref
  model_adapter_ref
  grounded_input_refs[]
  safe_projection
  guard_results[]
  request_id
  correlation_id
  causation_id
  idempotency_key
  request_hash
  occurred_at
  content_hash
```

- **INFERENCE:** A production InterviewTurnEventV1 must make identity, sequence, policy/model references, timestamps, hashes, and event state server-owned.
- **INFERENCE:** Applying CAM's verified mutation law means retryable commands use a caller-stable idempotency key; same key plus same hash returns the original result, and same key plus different hash returns conflict.
- **INFERENCE:** Applying the verified evidence law means turn events and ledger revisions are append-only, with a new revision or superseding event for corrections.
- **INFERENCE:** A safe Y2 audit projection may contain bounded decision facts and guard codes but cannot contain raw credentials, hidden chain-of-thought, provider secrets, or unredacted sensitive answer content.
- **INFERENCE:** A future interviewer service should correlate each turn with CAM request and deletion evidence rather than keeping an independent untraceable log.
- **VERIFIED:** The current Phase 0 Y2 file ledger is isolated from CAM. Passing its deterministic local tests does not establish integrated audit or idempotency.

## Boundary Verdict

CAM's mutation envelope and receipt pattern is the correct donor. The Y2 harness has not adopted that production boundary and cannot claim CAM-integrated event authority.
