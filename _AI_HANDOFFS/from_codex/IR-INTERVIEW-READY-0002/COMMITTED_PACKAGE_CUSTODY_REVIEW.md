# Independent committed package custody review

Verdict: **ARTIFACT CUSTODY PASS; PROVIDER SOURCE RELEASE/CLEAR PASS.** Reviewer `/root/integration_lease_runner`, Sol6.1 Medium, independent of the integration product builder and Foreman's actual execution. This is routine package custody evidence, not account-security, native acceptance, runtime installation or production approval. Report remains uncommitted for Foreman filing; no HEAD/index change.

## Qualified archive and reproducibility

Examined `/private/tmp/ir-phase1-committed-package-20261004/interview-ready-candidate.tar.gz`, release-manifest/plan/receipt, committed packager/tests/builder, media policy/credits, phase1 configuration, product handoff and a7adc5e→b61c2ce source/manifest changes. Exact artifact bindings:

- Full product commit: `b61c2ce000ff90f73d240ac9781a2b035eb30bba`; original manifest `sourceRef` label: `b61c2ce`.
- Archive SHA256: `3516355a7d1ffd88658512639caf787a2a5ee08ee5c4fc91acea750e238e1c45`; 1,029,476 bytes.
- Release-manifest SHA256: `cb7e6a65bf9fa9647aa446a060e6adacd79c98c555a2b950533e94a3e58f10bb`.
- Release-plan SHA256: `d9e030122831401a895e9f415d35e06ea4c09a4b348c593dede5e191c8d822c2`.

Independent repack command completed without the draft flag:

```text
python3 -B /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/interview-ready/integration/release.py --source-ref b61c2ce --output-dir /private/tmp/ir-custody-independent-repack-20261004-02
```

The resulting archive is byte-for-byte identical; both sidecar metadata files equal the archived copies and the independently repacked copies. A first default-HEAD repack at `/private/tmp/ir-custody-independent-repack-20261004-01` differed only in manifest `sourceRef` (`HEAD` versus `b61c2ce`); resolved full commit, all consumed source/artifact bytes and HTML remained identical. That label participates in archive metadata, so deterministic equality requires the same source-ref label. Bind the full resolved commit plus exact archive/manifest bytes; do not treat label-only metadata as payload drift.

Seven unique regular archive entries equal the exact five payload allowlist plus root `release-manifest.json` and `release-plan.json`. No extra member, symlink, absolute/traversal name or unexpected metadata exists. Every member has fixed mode 0644, uid/gid/mtime 0 and empty owner names. The four immutable release payloads live beneath `wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e/`; the gateway is the dedicated `wp-content/mu-plugins/missionmed-interview-ready.php`.

| Payload | Bytes | SHA256 |
| --- | --- | --- |
| account-gate.html | 36683 | da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff |
| build-manifest.json | 3946 | b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006 |
| interview-ready.html | 1464240 | 158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e |
| matrix-entry.js | 2839 | 238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad |
| missionmed-interview-ready.php | 20727 | 819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5 |

All five payload hashes/sizes pass. Gateway and Matrix bytes equal their exact committed source files; independent rebuilding reproduces generated HTML, gate and build-manifest. All 35 consumed source/approved-media mapping hashes match the full committed object and current inputs. Manifest explicitly records `EXACT_COMMITTED_INPUTS`, empty `uncommittedInputs`, `candidate: true`, `productionApproved: false`; source mappings name the fixed gateway, Matrix addon, builder/generated gate and allowlist HTML. The product commit touches exactly the packet's ten paths, with no unrelated application-source change in the a7adc5e→b61c2ce scoped diff.

## Manifest/media/guard preservation

Original manifest a7adc5e SHA256 `41a35e9d3fd5dee394ceee2a66d0cfd4fe1959bca5535f1c58bf36ee764c33ec`; committed manifest SHA256 `5bd21265a8d8c48986ada406e7cf2802a6cb755200892448adbd58474b8eb150`. Removing only the dedicated new IR owner, ten appended protected paths, three appended IR route checks and one appended IR browser journey yields complete parsed-JSON equality with the original. Every pre-existing semantic value, selection/pin, known-good root, delegated lock, timestamp and list order is preserved. Two pre-existing middle-dot spellings changed to JSON unicode escapes only; parsed values are identical.

The policy remains default deny, with 19 allowed media hashes. Decoding all 39 HTML data-URI occurrences yields exactly those 19 unique hashes. All 35 denied image files (24 WebP, ten JPG, one PNG) are excluded by hash and encoded-payload checks; originals remain on disk. The three Creative Commons credit objects remain in bundled research with exact author/source/license links: CNEcija12345, Christoph Soltmannowski and TaurusEmerald. `production-assets.json`, `catalog.json`, `evidence/product-media.json`, `account.js` and `src.html` are byte-identical to a7adc5e. These checks preserve supplied rights/credit custody; they do not newly certify source rights or live rendered credit behavior.

Removing only `builderImplementation` from committed phase1 configuration yields complete equality with the original. `releaseState` remains founder-preview, accountPersistenceReady false and charity disabled; existing commercial/event/route fields remain unchanged. Independent `build.py --production --output-dir /private/tmp/ir-custody-production-blocked-20261004` exited 2 with constant production-blocked reasons and created no output. The archive is an allowed-media candidate, not a production build. The plan remains `CANDIDATE_HOLD`, nonexecutable and productionApproval false.

## Independent provider-clear readback

One safe aggregate-only SELECT via the connected Supabase execute_sql tool, fixed coordination project `brxqytrfdisrgakrxkhd`, observed **2026-10-04 20:12:32.023105 UTC**:

| Check | Count |
| --- | --- |
| Exact source lease b16507d4-ad3f-4806-94a3-db6c754b754a / epoch4700 rows | 1 |
| Exact row with released_at not null | 1 |
| Exact active unreleased future-expiry row | 0 |
| Active IR owner/integration-session/exact-lease claims | 0 |
| Applicable ungranted future-deadline IR waiters | 0 |
| Unrelated active claims, count only | 1; preserved |

Predicates reused the independently established column names: lease_id/fencing_epoch/released_at/expires_at/owner_id/session_id and waiter granted_at/deadline_at. This proves actual released state at observation; Foreman's local DONE/RELEASED/empty diagnostics was not substituted for provider truth. No raw nonce, key, private JSON, identity/user data, raw unrelated records, credentials or full provider response was selected. No retrieval, RPC, DML, cleanup or provider mutation occurred.

## Plan, recovery and outstanding gates

The nonexecutable plan names host `missionmed-kinsta`, webroot `/www/theresidencyacademy_209/public`, the dedicated immutable release directory and current pointer. Code-only rollback restores only freshly qualified IR gateway/current-pointer preimages; retain `_mmed_ir_state_v1`, identities, user history, enrollment and all siblings. Root separately reported fresh shared-origin/public byte preservation and dedicated gateway/runtime absence; this routine reviewer did not perform SSH/browser absence or shared-selection readback and does not independently certify that report. Fresh collision/preimage qualification remains a runtime gate.

No PHP 64/browser regression or native account-security suite was rerun here. Separate High independent source/security review, exact package/recovery acceptance, freshly healthy narrow runtime fencing, native WP/MySQL concurrency/cache/drop-in/property-copy tests, normal no-course/A-B/admin/MR/browser/mobile/motion isolation, current shared 15 origin/public bytes and actual selections, and independently accepted activation/live verification remain outstanding. This custody PASS authorizes no install, production flag, native fixture creation or deployment. The runtime is not installed by this review.

Only this report is written in the assigned handoff directory; two independent temporary repacks are retained. No product/OS/source/index/HEAD change, push, merge or deployment. **STOP UNCOMMITTED.**
