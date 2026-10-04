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

## Current wrapper pin adoption (2026-10-04)

This bounded repin supersedes only the current executable RUNNER_SHA and helper hash; the preceding pins and review history remain historical. Baseline is 4b020fafdbf60bcbab1ddb92edb98dd0be759bb2. The helper differs from that baseline by exactly one literal replacement: RUNNER_SHA 714c09d781b75c62e0296cd0f064879dbfeb7fb96c37833fb81cffa95dd617da to f1a5ee7ee7930d8d9a0beee69aea205868370ed3f35ede5dcec7ab10051d08c6. Current helper SHA256 is cfcb92fd110b03bbb6b9012dbf08cdde6bb4de6ce331d84dd4c7f47cc343a47f.

The current wrapper bytes were hash-checked at SHA256 f1a5ee7ee7930d8d9a0beee69aea205868370ed3f35ede5dcec7ab10051d08c6, 33,285 bytes. Exact byte comparison against the wrapper at the same baseline proved its only change is OS_HEAD from historical 81c3ac794b0b3436c7ce66cada31b9f2a1e05356 to bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2. Its current Native handoff bytes were hash-checked at 27074433cf56bb297315efe90e34e5dfefdb065ae2abe5fd9975480a1104b9c5. Foreman reports fresh BOOT PASS and unchanged routed IR records/dependencies with only unrelated OS additions; this helper task did not independently repeat that authority review.

Exact helper baseline/literal comparison and local compile PASS. Default invocation exits 0 with DORMANT: independently approved INSTALL manual operation required. No broader tests, remote operation, provider access, credential access, runtime execution, staging, commit or deployment occurred. Plan/package/embedded remote program and operation contract bytes are unchanged. STOP UNCOMMITTED for Native independent review of these exact helper bytes; Foreman owns any later commit and admission.

## Canonical TTL30 alignment (2026-10-04)

This bounded source correction supersedes only the current wrapper/helper pins and the duplicated local deadline margins; prior reviews and attempt receipts remain historical. Baseline 6f1c2c8c8b61226258e0038974f4ead25056a7c9 exact byte comparison PASS: three substitutions only, RUNNER_SHA f1a5ee7ee7930d8d9a0beee69aea205868370ed3f35ede5dcec7ab10051d08c6 to proposed wrapper a0c89cd028d1dda1f94672a77f71465ec2c42e9a8c488871565b8f2c4e639956, session margin literal30 to runner.MANUAL_DISPATCH_MARGIN (30), server margin literal30 to runner.MANUAL_SERVER_MARGIN (20). Actual proposed wrapper bytes/hash and named constants were read. Matrix independent wrapper review remains external to this helper builder; no approval is claimed.

Current helper SHA256 9f797a2dc6e7d88c77aedeeed990e873aa7e75139f44a9f245ca8066094a909a. Historical attempt1 clear review bytes matched f1c3076ef3b93221352d971886c85c9a42d14a7a36be98de6007b73c2bf45571. Canonical server TTL30 permits a healthy dispatch with at least20 seconds server remaining and at least30 seconds actual session remaining; these are separate deadlines. Both guard invocations before dispatch retain the same named-floor requirements. Margin reduction does not extend a lease, acknowledge an operation, bypass STOP, or authorize retries.

REMOTE_SOURCE byte equality to baseline PASS; SHA256 remains 7c9bbf981a16e64470e59a8537bb24bdb3f450c3f740a5b97f43fc08f7c22dc9. Package, plan, remote paths/program, markers, roles, operation UUID/deadline/state, <=10-second dispatch budget, >=30-second session margin, 8-second remote alarm, completion-before-postguard and uncertainty/drain protocol remain unchanged. The earlier prose specifying30 seconds for BOTH deadlines is historical and is superseded here for server expiry only.

AST/compile/default DORMANT exit0 PASS. Focused real local_guard fixtures used synthetic public-only in-memory approval/READY/status objects and fake report/snapshot adapters; no actual files, controls, capabilities or wrapper acquisition were read/created. They accepted canonical remainingTTL30 and boundary server20/session30; rejected server19.999, session29.999 and simulated post-marker guard2 STOP despite healthy margins. These fixtures verify helper duplicated wiring, not independent wrapper review or live provider behavior.

Exact focused fixture command executed locally:

```sh
python3 -B - <<'PY'
import runpy,hashlib,types,datetime,subprocess,ast
from pathlib import Path
p=Path('_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/manual_runtime_operations.py')
n=runpy.run_path(str(p)); g=n['local_guard'].__globals__
base=subprocess.check_output(['git','show','6f1c2c8c8b61226258e0038974f4ead25056a7c9:'+str(p)])
expected=base.replace(b'f1a5ee7ee7930d8d9a0beee69aea205868370ed3f35ede5dcec7ab10051d08c6',b'a0c89cd028d1dda1f94672a77f71465ec2c42e9a8c488871565b8f2c4e639956',1).replace(b"status['deadlineUnix']-now>=30",b"status['deadlineUnix']-now>=runner.MANUAL_DISPATCH_MARGIN",1).replace(b"timestamp()-now>=30",b"timestamp()-now>=runner.MANUAL_SERVER_MARGIN",1)
assert p.read_bytes()==expected
old=ast.parse(base); new=ast.parse(p.read_bytes())
def remote(tree):
 return next(ast.literal_eval(x.value) for x in tree.body if isinstance(x,ast.Assign) and any(isinstance(y,ast.Name) and y.id=='REMOTE_SOURCE' for y in x.targets))
assert remote(old)==remote(new)
compile(p.read_bytes(),str(p),'exec');ast.parse(remote(new))
# Synthetic public-only objects; no files/control capabilities are created or read.
clock=1000.0
g['time']=types.SimpleNamespace(time=lambda:clock)
g['digest']=lambda path: g['PLAN_SHA'] if Path(path).name=='EXACT_RUNTIME_INSTALL_RECOVERY_PLAN.md' else 'a'*64
directory=g['HERE']/'NONEXISTENT_LOCAL_FIXTURE'
phase={'independentReviewer':'independent-fixture','manualOperationsSha256':'a'*64,'installPlanSha256':g['PLAN_SHA'],'manualOperationMode':'install'}
spec={'controlDirectory':str(directory),'sourceCommit':g['SOURCE'],'packageDirectory':str(g['PACKAGE']),'packageFiles':g['PACKAGE_FILES'],'runtimeBindings':g['BINDINGS'],'qualifiedPreimages':{g['GATEWAY']:'ABSENT',g['RUNTIME']:'ABSENT',g['RUNTIME']+'/current':'ABSENT'},'qualifications':{'phaseDecision':phase,'recovery':{'independentReviewer':'independent-fixture'}}}
contract={'phase':'install','spec':spec,'sourceHead':'b'*40}
binding=hashlib.sha256(g['canonical'](contract)).hexdigest()
approval={'schema':'ir.runtime_native.approval.v1','phase':'install','independentReviewer':'independent-fixture','contract':contract,'spec':spec}
ready={'phase':'install','bindingSha256':binding,'sourceHead':contract['sourceHead'],'fenceSha256':'c'*64,'deadlineUnix':1030.0}
status={'phase':'install','state':'HEALTHY','fenceSha256':'c'*64,'deadlineUnix':1030.0,'expiresAt':datetime.datetime.fromtimestamp(1020,datetime.timezone.utc).isoformat()}
def guard(*args):
 g['check'](status['state']=='HEALTHY')
 return status
runner=types.SimpleNamespace(OWNER='owner-fixture',BUILDER='wrapper-fixture',MANUAL_DISPATCH_MARGIN=30,MANUAL_SERVER_MARGIN=20,read_json=lambda path:ready if Path(path).name=='READY.json' else approval,fresh=lambda record:True,report_record=lambda *args,**kwargs:None,snapshot=lambda *args:contract,canonical=g['canonical'],check_install_guard=guard)
args=types.SimpleNamespace(approval=g['HERE']/'NONEXISTENT_APPROVAL.json',approval_sha256='a'*64,control_directory=directory,binding=binding,operation='stage')
# Canonical TTL30 is usable at remaining30 and at admitted server floor20.
for seconds in (30,20):
 status['expiresAt']=datetime.datetime.fromtimestamp(clock+seconds,datetime.timezone.utc).isoformat()
 n['local_guard'](args,runner)
def rejected():
 try:n['local_guard'](args,runner)
 except n['Stop']:return
 raise AssertionError('guard accepted fixture')
status['expiresAt']=datetime.datetime.fromtimestamp(clock+19.999,datetime.timezone.utc).isoformat();rejected()
status['expiresAt']=datetime.datetime.fromtimestamp(clock+30,datetime.timezone.utc).isoformat()
status['deadlineUnix']=ready['deadlineUnix']=clock+29.999;rejected()
status['deadlineUnix']=ready['deadlineUnix']=clock+30
n['local_guard'](args,runner)
# Simulate guard2 after marker: STOP prevents dispatch even with both margins healthy.
status['state']='STOP';rejected()
print('EXACT_DIFF_REMOTE_AST_AND_FIVE_GUARD_FIXTURES_PASS')
print('REMOTE_SHA256',hashlib.sha256(remote(new).encode()).hexdigest())
PY
```

Default command executed: python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/manual_runtime_operations.py. STOP UNCOMMITTED for Native independent changed-helper review. Only this helper and handoff were written. No provider, SSH, network, credential, runtime, actual marker, stage, commit, deployment or HEAD change occurred. Proposed wrapper approval and fresh execution admission remain Foreman's separate gates.


## PRESENT pointer-only live-render upgrade — 2026-10-04

This section supersedes historical initial-ABSENT INSTALL admission for these current helper bytes; prior reports/controls/receipts remain historical custody. Builder `/root/phase1_matrix_release_implementation`, Sol6.1 High, source BASE `8717ebd04ad1cd60e66ef197b55080d58492e2be`. **DORMANT PREPARATION ONLY, STOP UNCOMMITTED; NO EXECUTION OR SELF-APPROVAL.** Foreman alone executes after Native independently reviews product/helper/plan and the distinct release verifier approves wrapper/top controls. Current helper builder identity is Matrix; wrapper/report role exclusions remain strict.

| Current artifact | SHA256 |
| --- | --- |
| manual_runtime_operations.py | 9a27d0f739fef2f5935ce3f78afe7650d10d5e765bb3c593bb5c8d05b2472c42 |
| manual_runtime_operations_tests.py | ece842c8892d00115a600815a43421b062c6c816e01bd2a829e1bbe219950b8e |
| EXACT_RUNTIME_UPGRADE_RECOVERY_PLAN.md | 8920d9a21fb5cebf61ef2b995b3995e42400c5d3b48ef9890b9103fd122d7f0f |
| Required frozen runtime_native_runner.py | 4aab4b5b37625134572cd231ac326cc6d8b95eb2aee94e70175cf92a48185dc3 |
| Frozen runtime_native_runner_tests.py | 2fe7b2f4eb735566676b7b85b0b7246db0ab7dd245b494d6f30f2ad7e5a23150 |
| NARROW_ROUTE_CACHE_MECHANISM.md | e9b1e404f46311fc1c676f3d88aabd554afac93dda65b537a5e34a23e36b8657 |
| Independent PRESENT custody LIVE_RENDER_SOURCE_CLEAR_REVIEW.md | a3a6767253095a352da8f388d74ea05fbfc819dd88d5bb037199b9384ec6a786 |

New source/fullref package path `/private/tmp/ir-phase1-renderfix-20261004`, archive `a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3`/1029472bytes; exact four sidecar hashes and five artifacts are static helper constants. Old sourceb61/package16f8 runtime bindings are preserved as OLD_BINDINGS; newHTML `456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c` and manifest `f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe` are the only changed payloads. Gateway819dd7, Matrix238d936 and gateda798 remain byte-identical. All candidate-only flags and account engine/data are unchanged; no production/native acceptance is claimed.

Exact initial qualifiedPreimages:

```json
{
  "wp-content/mu-plugins/missionmed-interview-ready-runtime": {
    "schema": "ir.runtime_native.layout_preimage.v1",
    "sha256": "c07522fc030cf916529d5d58d44cd5f507b052a93c24f1ce572a8243c94427ac"
  },
  "wp-content/mu-plugins/missionmed-interview-ready-runtime/current": "81ddf0fbca4b746addc71c35327a7c0057a61aa5a0d17c8a45fca5573117239e",
  "wp-content/mu-plugins/missionmed-interview-ready.php": "819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5"
}
```

The typed RUNTIME schema is exactly `ir.runtime_native.layout_preimage.v1` with schema+sha256 only. Its c07522... digest is the canonical enumerated structural dictionary from independent custody (types, immediate children, regular hashes/sizes, symlink literal/hash/bytes, old-temp ABSENT), not a directory file-content hash. Both known old and expected new members are bounded and verified before/after every step, with all15 shared byte hashes. Unexpected children/types/layout/pointer/package/member/vendor/collision stop; no unknown adoption.

Fixed helper modes are only `upgrade` and `upgrade-recovery`; initial `install`/historic `recovery`/three-ABSENT controls reject. Top approval/default wrapper report role excludes this builder, Native wrapper builder and Foreman; per-artifact Native reports may qualify this helper, never its author's wrapper. Exact helper/plan hashes seal qualifications.phaseDecision, manualOperationMode; recovery binds oldRuntimeBindings, upgradeRuntimeBindings and identical typed qualifiedPreimages. An independent priorInstallProviderClear report must attest actual released INSTALL, IR0/pendingIR0 with finite observedUnix<300 seconds at each operation. A prior source/auth release is not substituted. Fresh provider/custody proof and final frozenHEAD/spec/top one-use controls are Foreman/verifier-owned, not generated by this builder.

Operation order: readback OLD → stage(mkdir-stage then transfer) → extract(extract then lint) → publish-release → publish-pointer(prepare-pointer then exchange/retain backup) → readback UPGRADED → refresh-ir-html and refresh-home-html separately → ordinary public/cache/browser preservation verification → Foreman STOP/release and independent provider-clear. Gateway is never republished. New stage `.candidate-a93cb2e0be061ca1` and release456269... are exclusive; current old81dd literal exchanges atomically via Linux renameat2 RENAME_EXCHANGE with `.current-a93cb2e0be061ca1`; exact old link is retained via NOREPLACE as `.previous-16f8f5795b1f54eb-to-a93cb2e0be061ca1`. No fallback overwrite/unlink/deletion or old stage/release cleanup.

Fresh separately admitted upgrade-recovery only exchanges exact current-new and retained old backup, preserving new pointer in backup after restoration. Exact interrupted exchange (old link still deterministic temp, backup absent) is separately qualified by its EXCHANGED inventory/preimages; restore exchanges then NOREPLACE retains the new link. Every other partial/unknown layout stops without automatic retry/cleanup. Normal UPGRADED inventory `1d3d599cad977e5489932f2c3866abd721c7bb2a76959d6d066486415c7ac9e4`, interrupted EXCHANGED `8b643d02d2f045f79a5386903594a656d22d646a60b4c66a51ca25dffe49f4d3`, restored `d6f569ad0bf748c7ba6a6bfd761037629de477b60711e4b9c16598a483fb3bd1`. Full maps/digests/recovery limitations are in the bound plan. Identity/account state/history/enrollment are never rollback material.

Marker sync/identity/begin/transition functions are byte-identical to BASE. Existing guard1/exclusive ACTIVE/guard2 flow, at most10s operation, at least30s session and20s server start margins, SSH connect8/remotealarm8, COMPLETE-before-postguard, UNCERTAIN/no completion-from-kill and reviewed STOP-only wrapper drain are preserved. Local tests inject the filesystem/network seams and cannot prove Linux atomic syscall, server hardwall, real provider/SSH or remote rollback.

Cache operations rehash exact five installed vendor files and issue only fixed provider-loopback POST `https://localhost/kinsta-clear-cache/v2/immediate`; no proxy/cookie/auth/token/redirect/bootstrap/settings. Each body has one exact single-key form: `single%7Cir_route=missionmedinstitute.com%2Finterview-ready%2F` or separately `single%7Cir_home=missionmedinstitute.com%2F`. Match installed vendor TLS exemption only for literal localhost; timeout5/response<=65536/status2xx, report only status/bytes/bodySHA. ACK is transport evidence, not semantic invalidation or live/cache propagation proof. No group/broad/edge/object purge; only independently admitted exact MyKinsta URL cache with subdirectories unchecked is a narrow later fallback if needed.

Focused builder verification: `python3 -B .../manual_runtime_operations_tests.py`: **13 tests PASS in1.664seconds**. Actual fixed REMOTE_SOURCE executes against isolated old/new real package fixture trees; old inventory/preservation, no-clobber collision/current/gateway/stage/unknown rejection, exact successful exchange/recovery, interrupted exchange retention/fresh recovery, archive hash/cap gate, exact loopback bodies/headers/no proxy/redirect/auth/2xx cap/vendor drift, guard2 no SSH/UNCERTAIN, serialized actual remote ACK COMPLETE before closing postguard, nonack UNCERTAIN, actual helper+wrapper pair typed-present/oldABSENT/mode/selfreview/server/session rejection, compile/defaultDORMANT. Remote Linux renameat2 is injected by a platform-independent fixture exchange; cache opener is fake. No actual SSH/provider/cache call occurred. Helper/tests/remote compile PASS; defaultDORMANT exit0; exact marker function byte-preservation PASS; scoped diff whitespace PASS. No broad unrelated suite/rebuild was added.

Only the four assigned artifacts were written: helper, this handoff, new tests and new plan. Product/source/OS/native wrapper/client/transport and other workers' reports/files are preserved; no stage/commit/HEAD/push/deploy/credential/provider/runtime/cache/identity/WordPress operation. **FROZEN STOP UNCOMMITTED for Native independent review.** This handoff's fourth hash is delivered externally; it is not self-pinned.


## PUBLISHED-only resume and READY freshness correction — 2026-10-04

This current section supersedes the historical per-operation300second prior-clear requirement and two-mode restriction above. Builder /root/phase1_matrix_release_implementation, Sol6.1 High; BASE f47c6ee83d31776a97dccb3572216956efc65a1b, canonical OSbc1d36f unchanged. Only the same four helper/test/plan/handoff files are changed. STOP UNCOMMITTED; no runtime or self-approval.

Independent RENDER_FIX_INSTALL_INTERRUPTION_REVIEW.md SHA256 `00f2debdf30789bc4b2ae92a027abcf23a14baf80bc4958850cc42d701402f8c` was read and verified. Its actual PUBLISHED observation1791156220.6512587 full enumerated dictionary and15 shared hashes exactly equal helper profile4fd4af873d6ac04fc79e86907fd48a1dc0b048eac0480f0a4679b4e17410598d. Old current remains81dd, newtemp/retainedbackup ABSENT, both old/new files/stages/archive preserved. Original claim c04b13d8-46bc-492c-8d23-081de278ea3f epoch4839, bindingcba6d30910cf4a109239cc0a93fc5afad2b208787395678da7b901f9dfcb01d2, expires1791155296.586786 is RETIRED_BY_EXPIRY, released=false. Actual provider observation1791155751.582921 exactreleased0/expired-unreleased1/IR0/pendingIR0 is time-specific. Guard2 NOT_DISPATCHED is qualified by exact sealed fixture/order/timestamps under the report's nondecreasing-clock condition. Original UNCERTAIN prepare-pointer marker, controls/read/claim/receipts remain immutable; nothing is rewritten COMPLETE or RELEASED.

Minimal changed behavior:

- `upgrade-resume` requires exactly RESUME_PREIMAGES=PUBLISHED typed map, unchanged gateway819dd/current81dd. CLI permits only publish-pointer, readback and the two fixed cache requests. Remote mode rejects stage/transfer/extract/lint/republication/restore; pointer preparation/exchange retains exact PUBLISHED→PREPARED→EXCHANGED→UPGRADED checks and old-link backup. Resume readback permits PUBLISHED with old active bindings or UPGRADED with new bindings; cache requires UPGRADED. Unknown/PREPARED initial admission remains blocked.
- Prior independently qualified INSTALL IR0/pendingIR0 observation is fresh at immutable initial READY: positive finite observedUnix<=READY.updatedUnix<observedUnix+300 and READY.updatedUnix<=now. Later own operations retain exact current HEALTHY source/fence/marker/stable deadline/30session+20server margins. They do not demand the historical pre-acquisition report stay younger than300seconds. No admission/deadline extension or source/auth substitution.
- Resume priorInstallProviderClear additionally binds the exact PUBLISHED preimages. `retirement: RELEASED` requires released=true; `retirement: RETIRED_BY_EXPIRY` requires released=false/expired=true/guard2NotDispatched=true, public UUID priorClaimId, lowercase64 priorBindingSha256, positive finite expiresUnix<=observedUnix and expiresUnix<READY.updatedUnix. The independent report must truthfully qualify exact original claim/binding/expiry and fresh current clearance/layout; a historical report cannot supply a new observed time. Schema fields are sealed inside existing qualifications, without wrapper/controller changes.
- `remote_step` keeps private dispatched=false until immediately before attempting Popen. Guard2/other pre-Popen abort with a valid owned ACTIVE marker records canceled COMPLETE because no SSH was attempted. Once Popen is attempted, launch failure/nonack/timeout/unknown remains UNCERTAIN unless exact closed ACK qualifies completion. Invalid/unwritable markers still defer; ACK COMPLETE remains before closing postguard. Original marker is untouched. Marker sync/identity/begin/transition function bytes remain identical to BASE.

Current frozen artifact pins:

| Artifact | SHA256 |
| --- | --- |
| manual_runtime_operations.py | 8ab2d30b5bd5b8170250e124dd6c8bdf6268915d4ff62002eb857aa68a747389 |
| manual_runtime_operations_tests.py | cba6974c6c7c01c2bd2b02a219c5db9870ef338f0b69359f2e187938b5b905ae |
| EXACT_RUNTIME_UPGRADE_RECOVERY_PLAN.md | 80e86a5e2413a21cecf2ce75ed165dea7268824949a5a2b49a2ee5102291288b |
| Required unchanged runtime_native_runner.py | 4aab4b5b37625134572cd231ac326cc6d8b95eb2aee94e70175cf92a48185dc3 |

Focused command `python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/manual_runtime_operations_tests.py`: **16 tests PASS in1.967seconds**. Existing13 meaningful cases retained with guard2 expectation corrected to canceled COMPLETE; three added cases cover exact PUBLISHED resume/no re-publish, wrong initial/duplicate-prepared/hash-drift rejection, and attempted Popen failure UNCERTAIN. Actual helper+wrapper paired fixture additionally verifies fresh-at-READY/later>300seconds healthy acceptance, stale/future/nonfinite observation rejection, exact resume preimages/operation whitelist, expiry-vs-release/expiry-time/UUID/binding/unknown-retirement negative cases. It retains self-review/mode/ABSENT/server/session, old preservation/collision/cache/recovery/ACK negatives. Compile/defaultDORMANT and marker-function/wrapper/plan pins PASS. Frozen interruption full inventory/provider facts match PASS. Scoped diff whitespace PASS. No product rebuild, broad suite, provider/SSH/cache/native operation or live atomicity/rollback claim.

Top controls and every actual admission remain independently reviewed, fresh, one-use and distinct from prior attempt. Native independently reviews this changed helper/plan; Foreman owns custody and later actual lease/execution. AUTH remains BLOCKED, candidate flags/source/account engine/shared files unchanged. Only these four allowed artifacts are written; no old reports/receipts/markers, wrapper/client/transport/product/OS/HEAD/index/stage/commit/secret/history edits. Four final hashes are handed off externally to avoid self-hash cycles. **FROZEN STOP UNCOMMITTED.**
