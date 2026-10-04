# Render fix product independent review

**APPROVE_WITH_CONDITIONS: exact corrected package for the existing ordinary public/free-account pilot.** No changed-product defect found in this narrow review. This is independent product/package qualification; it does not approve the reviewer's wrapper, the pending upgrade helper, AUTH execution, final production flags, or LIVE/native acceptance.

Reviewer `/root/phase1_native_qa_runner`, Sol6.1 High, 2026-10-04; not the render-fix product builder. Reviewed source commit and actual HEAD `8717ebd04ad1cd60e66ef197b55080d58492e2be`, predecessor product `b61c2ce000ff90f73d240ac9781a2b035eb30bba`, canonical R2 OS `bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2`. Fresh local BOOT mission-profile validation PASS, HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. DR-375/376, mission, passport and authority routing remain applicable; this report creates no new authority.

## Exact source and semantic qualification

Commit8717 changes exactly three product files. Their SHA256 values are:

| Source path | SHA256 |
| --- | --- |
| `interview-ready/build.py` | `fa3e73e912d9c0f8c114d04f64043ab33bc6d6e21ba8d07c7e8e5e3ca13a050c` |
| `interview-ready/integration/release.test.py` | `cdb53f1a3d747c377d72d9d43953bad31823e439604000704306c471063dccd0` |
| `interview-ready/evidence/integration-worker-handoff.md` | `d2630716df99b74235e1b919d6be2c5b337161b13ad4f8964b6efc4d62e4a118` |

The build asserts exactly one `s.revision<0` occurrence in account.js and substitutes `0>s.revision` only in the rendered account script. Missing/duplicate seams reject the build before creating output. The actual new archive HTML equals the previously qualified archive HTML after exactly that one replacement; both HTML lengths remain1,464,240 bytes. All other HTML bytes, including UI, CSS/motion, phase flags, catalog/media data, inline state engine and injected session seam, are identical. This is a build-only correction; account.js remains SHA256 `018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a`.

Both relational expressions give identical results for the admitted safe-integer revision domain, including negative, zero and positive boundaries. A local Node check also agreed over18 primitive/ordinary representative values (NaN/infinities/null/undefined/strings/arrays included); the existing Number.isSafeInteger validation and all other state validation are unchanged. This is not a claim about arbitrary side-effectful object coercion, which the existing validator excludes.

The independent diagnosis `LIVE_RENDER_COMPATIBILITY_DIAGNOSIS.md` SHA256 `5f31e00f4704532bea3cd6e8985242e83f8df1459ccad3b6bcdcb6b1c145230f` establishes the observed host false-tag corruption boundary. This substitution removes that exact opening while avoiding shared processor changes. The responsible outer callback remains unidentified; successful local parsing is not corrected served-response proof.

A product-tree comparison fromb61 to8717 finds only the three files above. Gateway, account/CAS/idempotency/history/privacy implementation, Matrix addon, phase flags, source UI/catalog/assets and package builder release.py are unchanged. `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` also remains unchanged. Reuse unchanged predecessor engine/media/security qualification in `INTEGRATION_NATIVE_PILOT_INDEPENDENT_REVIEW.md` SHA256 `a34c1b45553acb21de1ccfb04d84ed6368d3263dfaa547d655e361325803a2f4`; no media re-research or repeated broad product audit was needed.

## Exact package custody and prospective bindings

Qualified directory `/private/tmp/ir-phase1-renderfix-20261004`. The manifest binds full40 sourceRef/sourceCommit8717, EXACT_COMMITTED_INPUTS, no uncommitted inputs and productionApproved=false. All35 build input hashes independently match both actual local bytes and Git8717 objects. Against old16f8, only consumed build.py changes; the test/handoff changes are separately committed evidence, not extra build inputs.

The actual archive has exactly seven unique regular entries: five exact manifest artifacts and byte-identical embedded release-manifest.json/release-plan.json. No absolute/traversal/linked/extra entry; timestamps zero; every artifact length/digest verified. The build-manifest changes only rendered HTML SHA and its build.py input SHA; all remaining fields/input hashes are identical. The local plan remains nonexecutable CANDIDATE_HOLD and explicitly preserves private state on code recovery. Its general absent/preimage wording does not qualify a PRESENT overwrite.

| Binding | SHA256 |
| --- | --- |
| Archive (1,029,472 bytes) | `a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3` |
| release-manifest.json | `4d4d9977163180c748282f94446fe900f75b0d5df2fff7d247f99f24c5367f33` |
| release-plan.json | `44ab7337ba0b82e350658bd14c07ae550985197b5fbdafcf4c7b18f179d4e037` |
| package-receipt.json | `9ecd3caf9519ef2337e8902176cddd3145f8b09464153afd3b417b1e136585fa` |
| HTML / immutable release directory digest | `456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c` |
| Gateway (unchanged) | `819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5` |
| Matrix addon (unchanged) | `238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad` |
| Account gate (unchanged) | `da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff` |
| build-manifest.json | `f142c8255a9cd93fbb8567cba3b323327fe3e8cd20491ece6565b7b2750c4ffe` |
| Prospective relative current target,73 bytes/no LF | `4e055c987d9d65cd866a41bff5ac3dff8e3b2b0bcf1b3c193c475917020f9c46` |

The prospective target is exactly `releases/456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c`. The prior16f8 archive/158080e6 release remains historical recovery material. No package was rebuilt or edited by this reviewer.

## Focused checks and admission conditions

Actual archived HTML: three inline scripts individually pass `node --check -`. Focused command `python3 -B interview-ready/integration/release.test.py PackageFixtures.test_built_account_comparison_survives_html_processing_without_source_change PackageFixtures.test_deterministic_committed_package_and_exact_mappings` passes2 tests in4.143s. These use disposable local fixture repositories; the new regression proves source preservation and missing/duplicate seam refusal. Independent direct archive/input checks and18-value Node comparison check PASS. No broader suite or runtime call occurred.

1. This corrected package is eligible for the already explicit pilot exposure: ordinary public `/interview-ready/`, intentional anonymous free-account gate, and `/interview-ready/app/` personal tools for every normally authenticated WP account irrespective of enrollment. This remains real public/all-normal-account exposure, not a QA allowlist. Existing founder-preview, accountPersistenceReady=false, charity-disabled and releaseApproved=false flags remain byte-identical; none may be promoted by this report.
2. Before any runtime write, independently qualify the exact PRESENT pointer-only upgrade/recovery helper and plan, fresh actual gateway/current/tree preimages and all15 shared bytes. Use a fresh healthy exact INSTALL lease and one-use controls bound to this package, actual current sourceHead, helper and independent reports. Keep the existing gateway and prior release; no application of the original three-ABSENT installation plan to the present layout. Code-only rollback restores the qualified pointer and retains users, metadata/history, enrollment and siblings.
3. Read-only inspection confirms the current wrapper SHA256 `4aab4b5b37625134572cd231ac326cc6d8b95eb2aee94e70175cf92a48185dc3` requires actual package/input/source qualification snapshots. A new35-input snapshot against this candidate and the actual final source/helper qualification reports remains to be performed after those reports are sealed. This report is not a wrapper review or an invented snapshot PASS. The six frozen helper hashes were checked unchanged.
4. Independently qualify the pending INSTALL-only wrapper/helper controls. Foreman reported the new independent reviewer found runtime_readback uses post-capture caps and an unbounded/untracked kill/wait path. AUTH stays BLOCKED until that specific containment defect is repaired and independently accepted; no earlier native qualification or this product report overrides it. INSTALL must not dispatch AUTH/readback capability subject to that defect.
5. After separately admitted upgrade and exact readback, only independently qualified per-URL IR/home HTML refresh may occur. Verify actual ordinary served account-script grammar, public/anonymous/free-account route/browser behavior and unchanged shared selections. Corrected live rendering is not yet proven here. Normal native A/B persistence/concurrency/logout-relogin and isolation gates, hook inventory/bootstrap qualification, fresh AUTH controls and final production decision remain outstanding.

Only this report was written, uncommitted. No helper/product/OS/sourceHEAD mutation, credentials, provider/SSH/HTTP runtime/native/cache action, identity/history creation/deletion, stage/commit/deploy. **STOP for Foreman custody and separate upgrade-helper qualification.**
