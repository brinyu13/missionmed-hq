# Y2-3100 DISC-03 Deletion Closure

## Current Orchestrator

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/deletionOrchestrator.mjs:8` through `:15` defines supported root resource classes.
- **VERIFIED:** Lines `:65` through `:83` create the deletion closure snapshot before destructive work.
- **VERIFIED:** Lines `:156` through `:171` derive required resource steps, and `:174` through `:187` fail if the exact step set is not present.
- **VERIFIED:** Lines `:235` through `:273` perform provider deletion and verify absence rather than treating a request as proof.
- **VERIFIED:** Lines `:276` through `:299` purge internal artifacts, `:301` through `:315` finalize audit evidence, `:334` through `:385` run the state machine, and `:389` through `:409` reconcile pending work.

## Database Closure

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/20260715213000_y1_cam_4008a_certification_closure_repair.sql:423` through `:559` creates a durable job and closure snapshot.
- **VERIFIED:** Lines `:507` through `:510` include future derived artifact inventories.
- **VERIFIED:** Lines `:561` through `:578` define expected resource steps.
- **VERIFIED:** Lines `:580` through `:648` verify closure; `:615` through `:624` fail closed if unsupported future arrays are nonempty; `:625` through `:643` require absence evidence.
- **VERIFIED:** Lines `:661` through `:673` block completion until every required step is terminal with the required proof.

## Future Artifact Law

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/4008A_FUTURE_DERIVED_ARTIFACT_DELETION_MAP.md:7` through `:45` enumerates future transcript, analysis, projection, cache, outbox, and related classes with required tombstone, cleanup, and absence behavior.
- **VERIFIED:** Lines `:47` through `:58` prescribe the order: durable intent, tombstone, revoke, provider cleanup, absence proof, purge, audit, completion.
- **VERIFIED:** Lines `:68` through `:74` require deletion workers to remain available during feature rollback and block account deletion until closure.

## Y2 Registration Requirements

- **UNKNOWN:** There is no plugin-style runtime API that lets Y2 dynamically register a deletion class. Current closure classes and SQL steps are explicit.
- **INFERENCE:** Before any integrated interviewer artifact can be written, its schema and orchestrator changes must add the class to the closure snapshot, durable step inventory, tombstone command, idempotent provider cleanup, internal purge, absence verifier, and terminal audit proof.
- **INFERENCE:** At minimum, future registered classes must include interview sessions, turn events, transcript revisions, session-ledger revisions, consent receipts, visibility grants, model/provider artifacts, and any queue/outbox record.
- **INFERENCE:** Applying the verified fail-closed closure law means a missing implementation blocks writes and a nonempty unrecognized class blocks `COMPLETE`.
- **INFERENCE:** Applying the verified rollback law means feature rollback may disable new interviewer sessions and model work but cannot disable deletion reconciliation.

## Boundary Verdict

Deletion is a reusable contract, not an automatic inheritance. No Y2 artifact may be integrated until it is explicitly registered and proven in the same server-owned closure state machine.
