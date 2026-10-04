# Fixed manual runtime operations handoff

**DORMANT PREPARATION ONLY; INDEPENDENT REVIEW REQUIRED BEFORE EXECUTION.** Builder /root/integration_lease_runner, Sol6.1 Medium. Only manual_runtime_operations.py and this handoff are assigned writes. No SSH, credential/provider/lease operation, runtime staging, native bootstrap, tests, source/OS/index/HEAD change, push or deployment occurred. Foreman alone executes after independent exact-byte approval; stop uncommitted.

| Binding | SHA256 |
| --- | --- |
| manual_runtime_operations.py (29671 bytes) | f2843a86f9995c147023807ee20d056f0ade17a8da23e4cc3b811b433cf2a3a6 |
| INSTALL-only runtime_native_runner.py, unchanged | 714c09d781b75c62e0296cd0f064879dbfeb7fb96c37833fb81cffa95dd617da |
| EXACT_RUNTIME_INSTALL_RECOVERY_PLAN.md, unchanged | 6a1cd7a25ee809a0abe99bf77992cc1be4f03e28db19a4d0c7f97f8c8b355a97 |
| Full-ref candidate archive, 1,029,475 bytes | 16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa |

SourceCommit remains b61c2ce000ff90f73d240ac9781a2b035eb30bba; approval sourceHead is the actual separately frozen preparation HEAD. Fixed package directory is /private/tmp/ir-phase1-qualified-fullref-20261004. Four local package-file hashes and seven exact runtimeBindings are compiled constants. The unchanged INSTALL snapshot verifies archive's five payloads/two metadata files, all consumed committed inputs/tests/handoffs/manifest, current source/OS HEAD, authority/native/client/transport pins and report bytes. It executes no remote operation. This helper imports exactly that hash-pinned runner; it cannot enable the runner's blocked AUTH phase.

## Exact local approval and fencing gates

Execution requires --execute, one fixed operation, exact absolute --approval directly in this handoff directory, --approval-sha256, exact --control-directory and --binding. Controls are independently authored; builder creates none. Before EVERY remote logical step and after its completion, helper rechecks approval bytes, phase install/schema/verdict/independent report digest/fresh expiry, full actual snapshot equality, canonical contract digest, exact full sourceCommit/packageFiles/runtimeBindings/three ABSENT qualifiedPreimages, plan hash, control directory and healthy INSTALL guard. READY/STATUS install phase, sourceHead/binding, matching SHA256 fence identity and the exact stable deadlineUnix are checked. Both the actual admitted deadline and canonical server expiresAt must have at least 30 seconds remaining before each dispatch guard; FAILURE or stale/expired/drifted controls stop. Top-level wrapper approval uses the default wrapper report role, excluding this helper builder, wrapper builder and Foreman. The helper/plan phaseDecision, recovery and prior-provider-clear records use report_record(..., role="install_artifact"), excluding this helper builder and Foreman while permitting the independently assigned wrapper builder to review a different artifact. Snapshot uses that same per-artifact role. These remain custody attestations, not cryptographic independence proof.

Additional fields belong inside the exact snapshot-bound spec, not an unbound command override:

- qualifications.phaseDecision.manualOperationsSha256 = current helper hash above.
- qualifications.phaseDecision.installPlanSha256 = exact plan hash above.
- qualifications.phaseDecision.manualOperationMode = install for install operations; recovery for withdrawal/recovery readback.
- In recovery mode, qualifications.recovery.installedRuntimeBindings must equal the fixed seven bindings. Its priorInstallProviderClear is a separate independent APPROVE report record with exact reportFile/reportSha256, phase install, released true, integer activeIR0/pendingIR0 and finite current observedUnix younger than 300 seconds. Original qualifiedPreimages remain the exact three ABSENT values. Fresh independently accepted recovery INSTALL controls/lease are required; no original claim reuse or automatic withdrawal.

Prospective CLI form only; not an executed or admitted command:

    python3 -B /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/manual_runtime_operations.py --execute --operation <fixed-operation> --approval <absolute-independent-install-approval.json> --approval-sha256 <exact-approval-byte-sha256> --control-directory <exact-install-control-directory> --binding <approved-canonical-contract-sha256>

## Corrected active-operation coordination

The initial helper was held by independent Native High review for two substantive findings: wrong per-artifact reviewer exclusions and uncoordinated lease release while manual SSH could still be active. This correction supersedes its initial helper hashes. Exact final wrapper pin is 714c09d781b75c62e0296cd0f064879dbfeb7fb96c37833fb81cffa95dd617da; its handoff SHA256 ecd5dd924138242b44d768920afbf294d71647d55a50f34f35b187506cb71e93 was read. The wrapper builder reports 20 local fixtures PASS; this helper builder did not rerun them or claim their independent acceptance. Matrix High reviews the wrapper; Native High reviews this changed helper. AUTH remains blocked.

Before each fixed remote logical substep, after actual guard/margins, the helper exclusively creates controlDirectory/MANUAL_OPERATION.json with exactly schema, bindingSha256, fenceSha256, operation, operationId, startUnix, deadlineUnix and state. Schema is ir.runtime_native.manual_operation.v1; operation is the fixed wrapper enum; operationId is a public lowercase v4 UUID; finite startUnix is actual time and deadlineUnix=startUnix+10; state ACTIVE. File and control-directory fsync precede dispatch. Validation uses the pinned runner.manual_operation_record API, not a permissive private parser.

A valid current-binding/fence COMPLETE from the prior owned step may be consumed only during the NEXT freshly guarded operation. ACTIVE, UNCERTAIN, foreign, invalid or changed identities are never removed/replaced or used for new dispatch. COMPLETE stays present after acknowledgement, including when postguard closes. The wrapper never removes operation markers; if it observed ACTIVE, disappearance/identity change is lost custody and cannot replace same-operation COMPLETE.

After exclusive ACTIVE registration, guard2 rechecks the exact actual snapshot, healthy source/binding/fence and BOTH 30-second margins before any SSH. The exact ACTIVE record must still match. The ten-second marker budget includes guard2 and is rechecked before and after SSH process creation; communicate uses only the remaining positive admitted budget. Guard2 closure/budget exhaustion dispatches no remote code and records best-effort UNCERTAIN, rather than cleanup or automatic retry.

Only actual successful SSH EOF, zero exit and exact closed remote acknowledgement allow the SAME marker identity to atomically become COMPLETE, durably before postguard. If only postguard closes after that actual acknowledgement, COMPLETE remains. Timeout, invalid/nonacknowledged output, unexpected failure or ambiguous storage leaves best-effort UNCERTAIN; malformed/unwritable ACTIVE also remains a defer condition. SSH kill never marks completion. Marker updates change state only; exact identity is reread before replacement. Local control temporaries contain only the same public schema and are not remote runtime children.

The new wrapper closes dispatch with STOP before drain, does not republish HEALTHY while closing, and waits at most 20 seconds for same-operation COMPLETE. Unknown/UNCERTAIN/lost/invalid/remaining ACTIVE or source/fence/expiry drift yields STOP/RELEASE_DEFERRED with no canonical release or marker cleanup. Its finite wait excludes separately performed source-sealing time; neither component claims a total hard wall or remote cancellation. Foreman owns actual reconciliation, fresh independently qualified recovery and provider truth. This helper never acquires/releases a lease or revives a closing status.

## Fixed remote sequence and custody

Only SSH alias missionmed-kinsta, webroot /www/theresidencyacademy_209/public and fixed python3 stdin are available. BatchMode/StrictHostKeyChecking are enabled; no caller-selected command, host/path/source/plugin/identity is accepted. Archive bytes travel as a fixed verified base64 literal in private SSH stdin, never SCP/third-party transfer, credential argument or temporary local secret file. Remote stderr is discarded; raw output/error/exception text never reaches CLI. Accepted output is a closed operation/PASS/sharedChecked 15/binding record; readback also emits safe actual qualified hashes or ABSENT activation states.

Define R=webroot/wp-content/mu-plugins/missionmed-interview-ready-runtime. Staging is R/.candidate-16f8f5795b1f54eb with exactly archive and payload/. Gateway stays nested under staged payload/wp-content/mu-plugins until publication, never a duplicate backup PHP in autoloaded MU root. Immutable release is R/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e. Four release names are interview-ready.html, matrix-entry.js, account-gate.html, build-manifest.json. All ancestors/fixed files reject symlinks; only the intentional pointer may be a symlink.

| Fixed operation | Guarded remote logical steps |
| --- | --- |
| stage | exclusive R, R/releases and named stage creation; archive transfer/hash/size check |
| extract | seven exact regular allowlisted tar entries into new payload only; metadata/payload hash verification; fixed staged gateway php -l |
| publish-release | Linux libc renameat2(RENAME_NOREPLACE) of exact four-file directory; live hashes/artifact bindings |
| publish-pointer | create exact temporary link; separate atomic renameat2(RENAME_NOREPLACE) publication |
| publish-gateway | separate fixed php -l/rehash; exclusive same-filesystem os.link after current passes |
| readback | all release/gateway/pointer/package hashes and fifteen shared hashes; recovery admits exact absent activation states |
| withdraw-gateway | recovery-only; exact gateway hash/type/size and pointer verification, then unlink gateway only |
| withdraw-pointer | recovery-only; gateway already absent and exact pointer literal/digest, then unlink current only |

Every remote step checks all fifteen compiled shared origin hashes before AND after, and its exact lexical preimages/owned stage transitions. Collisions stop instead of overwriting or adopting. Seven-entry extraction rejects duplicates/extras/links/traversal/types/metadata drift; hashes every member before writing and verifies resulting exact file set. No tar.extractall or generic path proxy exists. php -l has five-second timeout and no WP bootstrap. Atomic no-clobber release/pointer publication uses fixed Linux renameat2 flag 1; gateway uses exclusive os.link with fixed verified regular source/same filesystem. All modes/paths are fixed. Public counterpart/browser selection equality is a separate Foreman readback; helper origin checks do not certify it.

Pointer target is exactly releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e, 73 UTF-8 bytes with no LF, SHA256 81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e. Gateway can publish only after current target, exact release directory and all payload/artifact bindings pass. Candidate flags remain unchanged; publication exposes ordinary public/free-account routes and is pilot evidence collection, not hidden QA-only deployment or final LIVE promotion.

Each SSH communication uses the remaining positive budget from its exact ten-second ACTIVE marker, connect ceiling 8, unchanged remote single-thread alarm 8; lint ceiling 5. Timeout/connection/fence failure reports constant MANUAL_RUNTIME_STOP. It may leave a partial owned stage or completed remote mutation with missing acknowledgement. SSH termination is not proof of cancellation or of a kernel-blocked operation draining. Foreman must stop subsequent writes, preserve uncertain custody, qualify actual fixed state and completion, and independently admit recovery/release. The new wrapper defers release for UNCERTAIN/lost/active records; no auto-retry, auto-cleanup, lease release or inferred remote success occurs here.

Withdrawal verifies only the exact current gateway (SHA 819dd734...,20,727 bytes) and pointer; already ABSENT is idempotent, different present objects stop. Gateway precedes pointer withdrawal. Immutable release/stage/archive/metadata/owned temporary pointer remain; identities/_mmed_ir_state_v1/history/enrollment/sibling/core/cache/locks/options are never deleted/reset/restored. Recovery readback distinguishes still installed, gateway absent/pointer present and both activation objects absent; it never represents ABSENT objects as installed hashes. Helpers do not create synthetic accounts, execute native harness, mutate DB, install plugins, change production flags or acquire/release leases.

## Limited local validation and stop

Executed only local AST parsing of both corrected helper and embedded fixed remote program, and default invocation. AST PASS; default exits 0 with DORMANT: independently approved INSTALL manual operation required. Embedded remote program bytes remain unchanged, SHA256 7c9bbf981a16e64470e59a8537bb24bdb3f450c3f740a5b97f43fc08f7c22dc9; fixed package/plan/shared hashes and remote branches are unchanged. No functional/mock/runtime test is claimed or required by this task. All remote branches, libc/permissions/publication/deadline/preimage behavior remain unexecuted and require non-builder byte/operation review before Foreman invocation.

**STOP UNCOMMITTED.** Only these two helper files were written by this correction; controls/approvals, wrapper, plan, package, product/native files and existing receipts remain untouched. No actual marker or execution admission was created.
