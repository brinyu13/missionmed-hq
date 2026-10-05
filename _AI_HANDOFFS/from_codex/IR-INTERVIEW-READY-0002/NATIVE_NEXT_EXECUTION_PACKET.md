# Next native inventory/account execution packet

**PREPARATION ONLY — no execution/control approval or semantic true flags.** Builder /root/phase1_native_qa_runner, Sol6.1 High. Actual custody HEAD `3da89f3d6a40b620cc89aba1a79d3d55a273a3f8`; product source `8717ebd04ad1cd60e66ef197b55080d58492e2be`; OS R2 `bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2`. Write set only this new packet. No tests replayed, controls issued, provider/SSH/WordPress bootstrap/DB/identity/cache operation or source/HEAD change.

## Frozen inputs and usable evidence

Paths below are in _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002 unless otherwise stated.

| Input | SHA256 |
| --- | --- |
| native_account_qa.py | c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1 |
| native_account_qa_tests.py | 20f3510bd448acb876195eaba9592ca8d6845a1233f880b1deb8d872445e5015 |
| NATIVE_ACCOUNT_QA_RUNNER_HANDOFF.md | 4b25238b522405fbd5f46eb87a5bbef12d8c051e40f8189b427596125df16026 |
| runtime_native_runner.py | 42fec695a6161da453881d40c75ea940de1c55055a8e3641f3c60a72400a7302 |
| runtime_native_runner_tests.py | 0f44c89d2064e0942e55aec570332a1598fdc450fbbb6a97b3e7309e9faa933e |
| RUNTIME_NATIVE_RUNNER_HANDOFF.md | c74b91c0ffb09180bc5cc49dd9c2e74460467ac099d1ccc61d81213c9c824615 |
| NATIVE_READBACK_FINITE_INDEPENDENT_REVIEW.md | d837eb243fce03ce86ef6e8b77dd1953437edaa77144e94a57c0f73b48031e07 |
| NATIVE_AUTH_CONTAINMENT_INDEPENDENT_REVIEW.md | 8c714122bf02d2924186e6d0add357ad0c941717ca726902f4a1cb4a11e70383 |
| NATIVE_QA_INDEPENDENT_REVIEW.md (historical harness lineage) | fb5bb3e71c67eeadd9a6d3c1d3897f0fb3f2ccc0dc673ae026ce0b4a70bb2696 |
| RENDER_FIX_RESUME_INSTALL_CLEAR_REVIEW.md | b83817ee3962b291029942839fc8b488b620c5ce1e402cd27a02d71d46e24210 |

The independent d837 report resolves the finite runtime-readback blocker in8c for current wrapper bytes and reuses unchanged native containment evidence. Neither report supplies bootstrap/callback semantics or execution admission. Older native review bytes are lineage only. b838 records actual released INSTALL epoch4851/UPGRADED layout, all7 installed bindings and15 shared hashes; its provider observation1791157507.208790 is historical, not automatically fresh now. Root clarified the manual installer is not imported/dispatched by either AUTH entry, so its stale wrapper pin is not an AUTH execution dependency; INSTALL helper repinning remains separate. No installer action/report is substituted for bootstrap or native qualification.

Canonical DR375 SHA05803e16c985437a6400aa261e55bdb57f50ed2a0c7200f904fcffc49155a508 and DR376 SHA452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e bind the two named no-course fixtures, canonical self-only _mmed_ir_state_v1, no mail/enrollment/deletion, same-owner API scope and independent gates. Canonical client36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431 and transport6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad stay unchanged.

## Concrete common spec and reports

Use the existing exact wrapper schemas: ir.runtime_native.contract.v1, ir.runtime_native.approval.v1 and ir.runtime_native.read_admission.v1. Both phases claim only SHARED:AUTH, sharedDomains=[AUTH], writePaths=[wp-includes/user.php,wp-includes/meta.php,wp-content/mu-plugins/missionmed-interview-ready.php]. These are API anchors, no core/gateway edit. Existing six canonical lease RPC/keeper/fence/release semantics apply.

Common spec keys EXACTLY sourceHead,sourceCommit,packageDirectory,packageFiles,runtimeBindings,qualifiedPreimages,qualifications,controlDirectory. sourceHead MUST be the actual frozen post-custody full HEAD when controls are sealed; the packet's observed HEAD is not a reservation. sourceCommit stays full8717. packageDirectory=/private/tmp/ir-phase1-renderfix-20261004. Four packageFiles:

| Filename | SHA256 |
| --- | --- |
| interview-ready-candidate.tar.gz | a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3 |
| release-manifest.json | 4d4d9977163180c748282f94446fe900f75b0d5df2fff7d247f99f24c5367f33 |
| release-plan.json | 44ab7337ba0b82e350658bd14c07ae550985197b5fbdafcf4c7b18f179d4e037 |
| package-receipt.json | 9ecd3caf9519ef2337e8902176cddd3145f8b09464153afd3b417b1e136585fa |

runtimeBindings keys EXACTLY package,gateway,html,matrix,gate,buildManifest,pointer:

```json
{
  "package":"a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3",
  "gateway":"819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5",
  "html":"456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c",
  "matrix":"238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad",
  "gate":"da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff",
  "buildManifest":"f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe",
  "pointer":"4e055c987d9d65cd866a41bff5ac3dff8e3b2b0bcf1b3c193c475917020f9c46"
}
```

qualifiedPreimages keys EXACTLY gateway path, runtime root and runtime/current. Current UPGRADED baseline is gateway819dd..., current4e055..., runtime typed record {schema:ir.runtime_native.layout_preimage.v1,sha256:1d3d599cad977e5489932f2c3866abd721c7bb2a76959d6d066486415c7ac9e4}; independently refresh/qualify exact layout before sealing, retaining both immutable releases/old pointer/history. recovery record must bind the identical map. No runtime mutation or state rollback belongs to either AUTH entry. Every controlDirectory is a new absent direct child of the handoff directory; inventory and account use distinct directories and distinct approval/read files.

Every qualification record includes verdict=APPROVE, independentReviewer, reportFile matching [A-Z0-9_]+.md, reportSha256 with actual digest. Existing wrapper independence exclusions remain Foreman/current helper builder/native-wrapper builder. The required qualifications set is phaseDecision,recovery,runtimeReadback,installProviderClear,nativeContainment plus bootstrapSafety for inventory or reachableHooks for account. Required extra fields:

- runtimeReadback.runtimeBindings exactly the7 above, backed by actual independently qualified current installed code/public asset evidence.
- installProviderClear: phase=install,released=true, integer activeIR=0,pendingIR=0, finite observedUnix from an actual fresh independent observation of the released4851 claim/current provider state. Preserve expired unreleased4839 as such; do not relabel it. Wrapper requires observed<=admitted<observed+300 before consumption/private capability, acquisition, initial verification and actual initial READY. Later healthy owned session keeps the exact record without aging it; no deadline extension.
- nativeContainment: nativeSha256=c84...,nativeTestsSha256=20f...,transport=curl-stdin-v1,finiteContainmentQualified=true,curlExecutable=/usr/bin/curl,curlVersion=8.7.1,curlAsynchDNS=true, independently justified by8c+d837/current bytes and the qualified installed dependency. No flag supplied by this packet.
- phaseDecision: independently qualifies this exact phase/action boundary, private owner-process custody and semantic prerequisites; top-level approval binds the actual complete snapshot/runner/tests/reports/authority, phase, maxSeconds1..3600 and expiry<=3600. Read admission separately binds exact approval digest, bindingSha256, phase/maxSeconds/report/expiry; one use only. No old controls or old16f8 snapshot reuse.

## Phase1 — read-only loaded hook inventory

Pending BEFORE WordPress bootstrap: Medium's fixed static evidence reader must be independently privacy-reviewed by High, then actual redacted source evidence acquired under its own exact admission. Independent semantic review must close the reachable bootstrap/read-inventory path, including wp-load/wp-config/wp-settings/core, roles dependencies and the actual MU61 chain/dynamic includes as observed. Seed files or source hashes alone do not close effects. Unknown direct transports, enrollment/provisioning, dynamic callbacks/includes or unqualified effects STOP. Do not set bootstrapSafety.bootstrapEffectsQualified or reachableInventoryEffectsQualified until that actual closure review supports both.

Inventory spec adds ONLY nativeActions=[creation_inventory_read]; there is no hookInventorySha256 key or identity/state action. bootstrapSafety requires bootstrapEffectsQualified=true and reachableInventoryEffectsQualified=true with actual independent source/effects report. Under fresh exact inventory controls, wrapper.execute(auth_inventory,...) performs canonical retrieval/probe/acquisition, current runtime readback, one fixed WP inventory entry and bounded drain/release. Registry capture is private<=1MiB, exact schema/count0..10000/row types/canonical full-row digest. CLI/durable receipts reveal ONLY mode,result,inventorySha256,callbacksCount; no raw callback rows/paths/output/userdata.

Use the **existing import API in one retained noninteractive private owner Python process**, not the one-shot inventory CLI, when subsequent semantic qualification needs the actual registry. After its independently approved one execution, retain the returned privateInventory in that process; pass it by reference to an independently reviewed private qualifier using sealed actual source evidence. That qualifier must inspect reachable callback semantics, not approve by digest. It may publish only reviewed aggregate verdict/proof/report fields and the registry digest/count. No full inventory crosses tool output, inter-agent messages, pickle/JSON/temp files, environment, argv, exception logs or interactive auto-repr. No new execution driver/qualifier is implemented or approved here; its exact safe custody code is an explicit pending execution-control qualification. A separate shell/API call cannot recover the previous process's Python object.

Prospective call sequence inside that retained process (pseudocode, NOT an executable approval):

```python
inventory_result = reviewed_wrapper.execute('auth_inventory', inventory_approval_path, inventory_read_path, inventory_seconds)
# Require BOUNDED_PHASE_COMPLETE, privateInventory present, actual RESULT RELEASED;
# independent provider-clear must qualify the exact inventory binding/claim.
private_inventory = inventory_result.pop('privateInventory')
# Retain privately after release while the independent qualifier reviews the
# complete rows against actual source closure; no print/log/serialization.
semantic_verdict = reviewed_private_qualifier(private_inventory, sealed_source_evidence)
# Only after its independent accepted report and NEW exact account controls:
account_result = reviewed_wrapper.execute('auth', account_approval_path, account_read_path, account_seconds)
```

Exact inventory entry CLI, only when retaining full registry is unnecessary: python3 -B runtime_native_runner.py --execute --phase auth_inventory --approval <independent-inventory-approval> --read-admission <distinct-inventory-read> --max-seconds <bound>. It cannot preserve full inventory for a later process. Never substitute CLI digest/count for callback semantics. Process loss/discarded inventory stops progression; no automatic rerun or controls reuse.

## Required private browser custody before account creation

**Concrete account-creation blocker:** execute_native() constructs Identity/passwords in local memory, returns only the aggregate, then finally assigns identity.password='' and clears client.context/jars. Wrapper execute() has no private credential return/custodian. No existing qualified browser bridge is present. Once that entry exits, the retained names collide on rerun and credentials cannot be recovered by adoption/reset/export. Its internal normal curl login/logout/relogin proves protocol only, not a visible Chrome journey. Do not create the fixtures before closing this custody gap.

Minimal actionable proposal for a separately scoped source/review packet: add one owner-only private handoff before that finally to an independently reviewed in-process credential custodian, strictly bound to the two created name/email/UID identities, current admission and normal account/app destinations. Retain private password references only until the actual A/B refresh/logout/relogin browser journeys finish or their bounded custody stops; publish only opaque public handles and aggregate status. The bridge must consume those handles and fill the normal /my-account/ form through the approved computer-use surface without placing actual credentials/cookies/nonces in tool transcripts, files, argv, environment, chat or logs. No direct authenticate-cookie construction, browser cookie injection, session grant or account reset. The existing client_factory parameter is a local test seam, not approval of such a bridge. No established opaque private-value consumer is exposed in the current CUA text-fill contract; a concrete independently privacy-reviewed bridge capability is still required, not assumed. Retention alone cannot satisfy it. This proposal is not implemented or admitted by this packet; native harness/wrapper source and controls remain unchanged. Existing admin/MR regression remains read-only.

## Phase2 — named native account protocol

Only AFTER released inventory/current independent clear and semantic qualification: independently seal reachableHooks with hookInventorySha256 equal the privately validated complete registry digest, reachableEffectsQualified=true,bootstrapEffectsQualified=true,inventoryReadReleased=true,inventoryBindingSha256 equal the actual released inventory contract binding. Qualify reachable create/user/meta/role/mail/HTTP/direct-dispatch and normal login/logout/self-metadata effects, not all unrelated registry history. Request-local pre_wp_mail/pre_http_request suppression starts after bootstrap and does not prove direct effects safe. Unknown reachable effects block creation. Each create rechecks the full registry digest and collision immediately before normal wp_insert_user.

Account spec adds hookInventorySha256 plus nativeActions exactly collision_read,create_a,create_b,login,logout,app_get,state_get,state_post,rejection_post,metadata_read,lock_lifecycle. Optional native_connection_loss needs explicit separate seam admission; otherwise omit it. creation_inventory_read is excluded. Exactly mm_ir_phase1_qa_a_20261004 and mm_ir_phase1_qa_b_20261004, respective @fictional.example addresses, subscriber/no-course; at most2 identities. Credentials generated/retained in private process memory only; no output/argv/env/files/cookie jar. Collision or partial outcome stops without adopting/resetting/deleting an existing account. No automatically repeated native run: retained account names will correctly collide.

Prospective fixed call is wrapper.execute('auth',...) above, or python3 -B runtime_native_runner.py --execute --phase auth --approval <new-independent-account-approval> --read-admission <new-distinct-account-read> --max-seconds <bound>. It invokes ONLY reviewed execute_native: normal /my-account/ form login with return; A/B self GET/POST; nonce/origin/owner rejection; first-insert and revision200/409 races through separate sessions, CAS/idempotency, canonical metadata readback, isolated distinct CLI lock holder/HTTP lock denial, logout/new-login persistence. No direct table/core/schema/history corruption/enrollment changes. HTTP connection-ID/overlap and full disconnect are not inferred. The optional original-handle seam remains ISOLATED_DRIVER_SEAM_ONLY.

Expected safe account receipt is PASS_BOUNDED_PROTOCOL_CHECKS with aggregate checks,identities_retained=2,connection_loss and explicit existing limitation list; never full LIVE PASS. Gate stops new/queued dispatch at admission expiry/failure, keeps current finite workers/children tracked, joins before canonical release and preserves remote commit ambiguity/history. Readback I/O<=10s/current deadline+2s reap; native I/O<=12s/current deadline+2s reap; shared native drain15s only. Unreaped/unknown/source/fence/expiry failures produce STOP/deferred custody, no automatic retry/cleanup/remote rollback claim. Independent actual provider-clear is required after each terminal phase; server expiry is not RELEASED.

Final browser/mobile/BFCache/privacy/cache/admin/MR/sibling acceptance and native negatives outside the fixed harness remain pending per reviewed limits. The fixed native entry clears credential references on exit; this packet grants no later credential export/reset or bypass to facilitate visible journeys. Static source semantic qualification, actual loaded inventory qualification and native protocol evidence remain distinct. **STOP UNCOMMITTED after this packet; next work is the precisely assigned actual bootstrap-source semantic review, not execution.**
