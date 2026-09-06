# I1Q-1008E Agent Decisions

| Decision | Resolution | Safety consequence |
| --- | --- | --- |
| Corpus claim | Use `C1_OBSERVED`; never claim the historical universe. | Keeps 105-source evidence bounded to what was observed and accessible. |
| Evidence authority | Treat transcript evidence as primary and legacy-derived material as secondary comparison evidence. | Legacy overlap cannot manufacture wording, override provenance, or prove completeness. |
| Alias protection | Reject a persistent HMAC-key design; use a protected random alias map without a reusable key. | Avoids adding secret-key lifecycle and exfiltration risk. |
| Automated versus specialist review | Treat automated PASS7/PASS8 output as provisional; require four independent specialist roles and finalizer integration. | Automated classification never becomes medical, assessment, or release approval by itself. |
| Medical/privacy correction | Promote exactly the independently proven 168 medical conflicts, retain 2 true administrative negatives, and make privacy quarantine precede nonmedical rejection for 2 rows. | Corrects false negatives without broad classifier expansion or privacy regression. |
| Schema privacy rule | Permit `PRIVACY_QUARANTINED` for nonmedical rows and require it when direct-identifier evidence is present. | Aligns schema with fail-closed privacy lifecycle precedence. |
| Supersession | Archive invalid or superseded derived state non-destructively; preserve acquisition and raw inputs byte-identically. | Makes correction and rollback auditable without destructive cleanup. |
| Shared exclusion | Use one kernel-backed operation lock with stable file-identity revalidation. | Path replacement, lock loss, and concurrent mutation fail closed. |
| Publication | Use exclusive no-clobber publication, synchronization, readback, and exact-byte replay. | A differing existing output is a collision, never an overwrite target. |
| Correction trust base | Expand the dependency-closed correction hash set from 7 to 11 files. | Prevents an incomplete trust-base manifest from authenticating only part of the behavior. |
| Specialist authority | Disable the legacy live assembler and bind batches, submissions, evidence roots, packets, completion, and downstream integration. | Prevents unlocked overwrite and generic-receipt substitution. |
| Roster ordering | Validate unique authoritative positions and exact row semantics before canonical sorting. | Equivalent safe permutations pass while roster tampering remains rejected. |
| Help behavior | Make `--help` and `-h` explicit zero-I/O modes; reject unsupported or mixed arguments. | Prevents a help request from silently entering live audit mode. |
| Contract compatibility | Reject additive compatibility for changed contract inputs; require strict non-destructive supersession and fresh extraction. | Prevents old packets from being finalized under new executable bytes. |
| Determinism | Require a second session-observed successful integration with identical contract-bound evidence. | Demonstrates replay safety while preserving that only one aggregate is durably logged. |
| Downstream authority | Keep release, medical approval, final MCQ generation, and production mutation disabled after extraction completion. | Extraction completion cannot be mistaken for product-release authority. |
