# 11 — Ecosystem Safety and Rollback

## Safety posture

The extraction system is intentionally isolated from production, release, and learner-facing systems. It operates as a restricted Lane B workflow with these invariant prohibitions:

- no production database mutation;
- no release or learner publication;
- no credentialed physician approval;
- no final assessment approval;
- no final governance approval; and
- no protected source content in Git-safe outputs.

All automated classifications and specialist artifacts remain review evidence. They do not confer downstream authority.

## Bounded isolation

Protected source and derived working state remain inside a dedicated encrypted boundary outside the repository and synchronized storage. The boundary enforces owner-only directories and files, rejects symbolic and unexpected hard links, and separates keys from writable data paths. Git-safe reports, ledgers, and evidence expose only approved counts, statuses, and content roots.

Network acquisition is separately approved and target-restricted. Extraction, specialist finalization, supersession, partial recovery, and safe reporting do not broaden that authority.

## Shared exclusion and no-clobber guarantees

Every live state-changing operation uses the same kernel-backed operation lock. A stable protected lock-file identity prevents pathname replacement from silently changing the lock target. Contention fails immediately, and observed lock loss aborts the operation.

Durable publication follows a no-clobber protocol:

1. Create an owner-only temporary file exclusively.
2. Write and synchronize the complete payload.
3. Synchronize the parent directory.
4. Publish without replacing an existing differing file.
5. Synchronize publication.
6. Remove the temporary link and synchronize cleanup.
7. Read back and verify exact bytes, mode, link count, and content address.

A retry may reuse an existing output only when it is byte-identical and contract-identical. A differing output is a collision and stops the run.

## Non-destructive recovery modes

The system supports two bounded recovery scopes.

### Full supersession

Full supersession archives an entire derived extraction state when the run is validly superseded. Immutable acquisition inputs and protected source artifacts remain unchanged. The archive is content-addressed, source and destination roots are verified, and a durable completion receipt records that the new working area is clean before another run begins.

### Partial recovery

Partial recovery handles a run that stopped after only part of the 97-artifact cohort completed under a now-invalid contract. The recovery decision accounts for all 873 pass cells, including 855 completed cells and 18 explicitly blocked cells, with no silent omission. Only enumerated derived units may move into the non-destructive archive. Acquisition state, immutable inputs, and unrelated prior archives remain preserved.

The partial path uses the same lock, no-clobber operations, content-addressed state machine, crash resume, source-manifest verification, destination-manifest verification, and preservation-root checks as full supersession.

## Rollback model

Rollback is preservation-first rather than deletion-first:

- **Before publication:** discard only an unlinked temporary file.
- **After temporary durability but before publication:** recover or remove the temporary file, then retry from the same manifest.
- **After publication but before cleanup:** verify the published and temporary links reference the same durable bytes, then complete cleanup.
- **During supersession:** resume from the durable state record and process only the next authorized unit.
- **After supersession completion:** retain the content-addressed archive and begin only from a verified clean derived workspace.
- **On any contract or authority mismatch:** stop without integrating results and require a new authorized recovery or execution decision.

No recovery path authorizes destructive deletion of protected source material. No rollback path mutates production state.

## Corrected safety incidents

Independent review corrected several design defects before live reliance:

- process-metadata locks were replaced with kernel-backed exclusion;
- overwrite-capable publication was replaced with no-clobber publication;
- recovery receipts were restricted to exact authorized source manifests;
- reviewer and completion evidence were cross-bound to authoritative state;
- the unlocked legacy specialist assembler was disabled;
- full-roster totals and identity uniqueness are recomputed; and
- safe-roster comparison became order-independent only after validating unique roster positions and exact row semantics.

The roster-order incident caused a false rejection of an equivalent safe projection. It did not permit tampering, because acquisition order remained bound by the authoritative roster root and all positions were validated before sorting.

## Completed extraction transition

The current engineering result is 127 of 127 tests passing across five suites. The protected transition has also completed under the corrected contract; the test result supplements rather than substitutes for the bound integration evidence.

The earlier integration state failed closed on a run-contract mismatch. No specialist completion aggregate from that state was accepted, and no production or release mutation occurred.

The second non-destructive contract-drift supersession completed with a durable archive and preservation checks. A fresh contract-bound extraction, four-role specialist integration, deterministic integration replay, and refreshed safe evidence then completed. The final integration records 97 transcript artifacts, 99 Nodes artifacts, 873 automated cells, 194 specialist cells, 388 role reviews, and zero production mutations.
