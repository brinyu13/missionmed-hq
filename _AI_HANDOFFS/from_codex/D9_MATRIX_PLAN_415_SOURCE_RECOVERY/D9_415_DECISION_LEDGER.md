# D9-415 Decision Ledger

Ticket: `D9-MATRIX-PLAN-415`  
Decision owner for scoped recovery: Dr. Brian under `D9-415-FOUNDATION-001`  
Main-agent write owner: Codex `/root`

| ID | Phase | Decision | Basis | Consequence | Status |
|---|---|---|---|---|---|
| D9-415-D001 | 0 | Use `https://github.com/brinyu13/missionmed-hq.git`, branch `d9-matrix-plan-415-source-recovery`, based on current `origin/main` `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`. | Founder decision plus direct Git preflight. | Recovery has one bounded repository, branch, and clean worktree. | APPLIED |
| D9-415-D002 | 0 | Treat direct production bytes captured during this run as observed runtime authority; use D9-410 as prior evidence, not as a substitute for current production. | Founder decision, BOOT runtime-truth law, and Critical Systems source-of-truth rules. | Any post-D9-410 runtime drift must be represented honestly in the observed baseline. | APPLIED |
| D9-415-D003 | 0 | Proceed under the explicit founder decision despite D9-415 being absent from the current MissionMed OS mission registry; do not invent or mutate a registry entry. | BOOT permits graceful degradation, the task supplies the mission identity and protected local track, and permitted writes exclude registry mutation. | Record governance degradation; file only through authorized product/handoff paths and append the activity log after validation. | APPLIED |
| D9-415-D004 | 0 | Treat the active Matrix lock manifest as newer evidence than D9-410. | Active manifest SHA-256 `efb1d51b916ccc32fa0bf56fa3bd77b828f5cfa63ca04fb8b29c914654c9952d`, updated `2026-07-13T14:55:56Z`; it now pins the live Calendar CSS and newer fingerprinted shell/controller artifacts. | Wave 1 and the snapshot must validate current production directly. D9-410's ten hashes remain historical baseline evidence. | APPLIED |
| D9-415-D005 | 0 | Make no product-tree source write before the execution plan exists and all four Wave 1 reports are synthesized. | Prompt Phase 0 hard gate. | Only handoff/evidence ledger writes are allowed until Phase 1 closes. | APPLIED |
| D9-415-D006 | 0 | Stage production reads first in a local forensic evidence snapshot, scan and validate it, then run the Matrix guard against a path-shaped staging tree before importing protected paths into the product tree. | Matrix lock preflight law plus no-secret/no-data law. | Avoids both preflight circularity and unscanned source entering Git. | ACTIVE |
| D9-415-D007 | 0 | Do not modify the active Matrix manifest, protocol, guard, passport, production, database, cache, flags, auth, entitlements, or CDN in this ticket. | Founder decision and protected-path rules. | Reconciliation is branch-local evidence and a passport patch proposal only. | ACTIVE |
| D9-415-D008 | 1 | Freeze all production inspection after the protected controller mismatch and prohibit snapshot/import/tag/package/publication. | Direct production `23da5c...` versus active lock `c0a538...`; production mtime postdates lock; BOOT/Matrix/Critical/ticket hard stops. | Wave 1 evidence may be synthesized, but Phase 2 and every downstream write are blocked. | RESOLVED BY D9-415-D011 |
| D9-415-D009 | 1 | Attribute the observed byte to Y1-CAM-4005 without treating that candidate as authority. | Local content hash search: candidate `23da5c...`; pre-change backup `c0a538...`. | The drift is explained technically but remains unauthorized for D9-415 recovery until exact direction/cutoff. | APPLIED |
| D9-415-D010 | 1 | Require exact, hash-scoped authority rather than inferring that the generic founder source-precedence decision overrides the newer entitlement-significant lock conflict. | New controller behavior was not named in the original D9-415 decision and active protected lock disagrees. | Prevents accidental normalization of a concurrent/unreconciled protected deployment. | SATISFIED |
| D9-415-D011 | 1R | Apply `D9-415-FOUNDATION-002` exactly to controller hash `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` for source recovery, while retaining the active-lock hash `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` as historical/rollback evidence. | Hash-scoped founder authorization supplied in the resume ticket; one read-only production recheck confirmed the authorized byte is still current. | Phase 2 may resume without treating Y1-CAM-4005 behavior as approved and without modifying protected global lock files. | APPLIED |
| D9-415-D012 | 2 | Define quiescence through identical full T0/T1 manifests around one inbound read-only forensic copy. | Founder authorization requires equality of relative path, type, size, SHA-256, and mode for every included production path. | Any difference produces `PRODUCTION NOT QUIESCENT` and stops before import/commit; an identical comparison freezes the only admissible snapshot. | APPLIED — IDENTICAL T0/T1 |
| D9-415-D013 | 2 | Preserve current entitlement-significant source without fixing, reverting, approving, or normalizing its behavior in D9-415. | `D9-415-FOUNDATION-002` separates runtime source truth from entitlement/auth authority. | D9-416 adjudicates behavior; D9-420 remains blocked and must not infer deployability from D9-415 artifacts. | APPLIED |
| D9-415-D014 | 2 | Supersede Wave 1's `123` plugin-file estimate with the complete T0/T1 count of `125`. | Two independent local counts and both full production manifests report 125 files; T0/T1 are byte-identical across the entire snapshot window. | Preserve Wave 1 named-file findings, but use the sealed 125-file manifest for baseline scope and classification. | APPLIED |
| D9-415-D015 | 3 | Seal a ten-file Matrix-related MU closure rather than the seven Wave 1 candidates alone. | Local source analysis proved `missionmed-drj-drills-access.php` directly changes Student OS Matrix route/feature access, calls four functions from `arena-route-proxy.php`, and `missionmed-performance-boost.php` explicitly preserves exact Matrix asset query versions. | Include the three source-evidenced additions unchanged; exclude the other 116 observed MU files as unrelated. | APPLIED |
| D9-415-D016 | 3 | Permit exact product-tree import after redacted content scanning and split Matrix guard validation. | One Webex PKCS#8 validation phrase and two schema labels were false positives; no secret/private data found; nine unchanged protected assets passed guard and Decision 002 covers only the controller warning. | Import all 125 plugin files and ten MU files byte-for-byte; no broad guard override. | APPLIED |
| D9-415-D017 | 5-8 | Preserve the already-created A→B→C→D sequence rather than duplicate or rewrite it after resume-state discovery. | Git history, reflog, commit scope, tag target, and a clean worktree proved the required sequence was complete. | Independently validate the sequence and continue at Wave 2. | APPLIED |
| D9-415-D018 | 9 | Accept the reproducibility reviewer's three P1 validation findings; treat the release reviewer's two P1 items as mandatory F closeout gaps. | Main-agent source review reproduced mutable trust inputs, optional syntax tools, and missing workflow/dependency coverage. | Create one non-empty D9-415E and close documentation in D9-415F. | APPLIED |
| D9-415-D019 | 9 | Seal D9-415 trust anchors in code, require PHP/Node and exact counts, cover all consumed inputs, pin checkout, and disable persisted credentials. | Detached precommit, real-commit, fresh-clone, and GitHub-hosted validation all passed. | CI now fails closed; package bytes remain unchanged. | APPLIED |
| D9-415-D020 | 9 | Accept full-branch whitespace warnings only for immutable production/evidence bytes; require all authored E/F deltas to pass diff checks. | D9-415A must remain byte-exact and contains CRLF/trailing whitespace observed in production. | Do not normalize the baseline; document the exception. | APPLIED |
| D9-415-D021 | 10 | Publish the branch/tag and open draft PR #9 before F so final reports can record the actual PR identity. | Prompt orders publication before Phase 11; PR is draft and DO NOT MERGE. | Push E/tag, verify, open PR, then file/push F and reverify. | APPLIED |
| D9-415-D022 | 11 | Make the final combined handoff contain every required Markdown deliverable verbatim plus standalone Wave 1 evidence, excluding nested prior combined files. | Original prompt defines deliverable order; user also requested one combined Markdown file. | Generate deterministic markers and verify embedded bytes. | APPLIED |
| D9-415-D023 | 11 | Pass G-D9-5A while leaving G-D9-5B open and overall G-D9-5 partial. | Exact source, reproducibility, review, publication, and non-mutation evidence are complete; data/auth/deploy authority remains outside D9-415. | D9-416 READY; D9-420 BLOCKED. | APPLIED |

## Instruction and authority resolution

Loaded instruction files and scope:

- `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415/AGENTS.md`: worktree-local MissionMed boot and hard stops.
- `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415/CLAUDE.md`: same local boot and hard-stop scope.
- `/Users/brianb/MissionMed_OS/BOOT.md` from fetched `origin/main`: operating-system resolution chain and shared laws.
- `/Users/brianb/MissionMed_OS/CURRENT.md` from fetched `origin/main`: generated estate state at `2026-07-13T11:48:53-04:00`.
- Mission record: no `D9-MATRIX-PLAN-415` entry exists in fetched `origin/main:missions.json`.
- Product routing: Matrix entry in fetched `origin/main:products_index.json` points to `PRODUCT_PASSPORTS/matrix.md`.
- Authority routing: fetched `origin/main:authority_index.json` routes the Matrix lock protocol/manifest, Critical Systems Contract, and Codex guardrails.
- Product passport: `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415/PRODUCT_PASSPORTS/matrix.md`.

Conflict resolution:

- The mission-registry absence is governance degradation, not competing substantive authority. The founder-supplied mission packet is exact and the prompt does not authorize registry edits.
- D9-410 and the active Matrix manifest differ because the active manifest was updated later the same day. Runtime truth and the newer active manifest govern current snapshot validation; D9-410 remains immutable prior evidence.
- No unresolved authority conflict currently prevents read-only discovery. Any stale Matrix guard warning or current production/manifest contradiction remains a hard stop for the affected write phase.

## Final resolution

Founder Decision 002, the identical snapshot cutoff, immutable A/tag, safe B/C/D/E lineage, 4/4 Wave 2 review, dedicated branch review, hosted CI, and final closeout resolve all D9-415 source-authority conflicts. Entitlement and operational authority are deliberately routed to D9-416 rather than inferred.
