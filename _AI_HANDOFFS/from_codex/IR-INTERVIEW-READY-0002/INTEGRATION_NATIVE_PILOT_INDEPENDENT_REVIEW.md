# Independent integration security and public pilot review

Verdict: **APPROVE_WITH_CONDITIONS — exact source/package and code-only recovery for a bounded public/native-evidence pilot.** No confirmed new source-level critical/high security defect was found. This is not final production acceptance, an executable control approval, native account acceptance or a LIVE claim. Reviewer `/root/phase1_native_qa_runner`, assigned Sol6.1 High, did not build the integration product or packager. The review excludes this reviewer's native harness and runtime wrapper; both require their separate non-builder review and exact execution controls. The separately reported wrapper package-input blocker must be resolved before any lease runner execution.

## Exact bindings and independent checks

Product commit: `b61c2ce000ff90f73d240ac9781a2b035eb30bba`. Its ten paths are exactly the nine source/test/config paths plus `interview-ready/evidence/integration-worker-handoff.md` listed by that committed handoff; their current bytes equal the committed objects. The comparison base is independently reviewed account commit `a7adc5eb4107dc26d3dce38cae7195ad8b9868f3`.

Canonical R2 OS is clean at `81c3ac794b0b3436c7ce66cada31b9f2a1e05356`. Mission record, passport, CURRENT and authority routing resolve DR-375/376. Fresh mission-profile BOOT returned PASS with canonical HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. DR-375 SHA256 `05803e16c985437a6400aa261e55bdb57f50ed2a0c7200f904fcffc49155a508`; DR-376 SHA256 `452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e`. An initial validator invocation used the wrong HQ path and failed before any mutation; the corrected canonical `/Users/brianb/MissionMed/.git` invocation supplies the PASS. No authority files were changed or pulled by this reviewer.

Bound candidate directory: `/private/tmp/ir-phase1-qualified-fullref-20261004`.

| Artifact | SHA256 |
| --- | --- |
| `interview-ready-candidate.tar.gz` (1,029,475 bytes) | `16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa` |
| `release-manifest.json` | `9c009a2192b00721fe41b0791f63678b7c7d9664f89627200a8d6234f1265f40` |
| `release-plan.json` | `d9e030122831401a895e9f415d35e06ea4c09a4b348c593dede5e191c8d822c2` |
| `package-receipt.json` | `9510bb279d0c5fd2f4c378ae76ec1b4c384c2fa591c3edd9c54c8f20908cc92e` |
| Dedicated gateway | `819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5` |
| Immutable HTML | `158080e62a169bfb6c4b444bfcb47609bd49482ae7815e59ca13437314ba198e` |
| Matrix addon | `238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad` |
| Account gate | `da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff` |
| Build manifest | `b84d685de54dcfc01c208df7bb3afd584f52a072e7ef129391f8a330dc3be006` |

Independently inspected the fullref archive in memory: seven unique regular entries, exactly five dedicated payloads and two metadata entries, no links/traversal/extra payload. Every payload digest/size matches; archived manifest/plan equal sidecars; all 35 consumed input hashes equal the full product Git object. Compared every entry against routine custody archive `3516355a7d1ffd88658512639caf787a2a5ee08ee5c4fc91acea750e238e1c45`: the only changed member is release-manifest.json, whose only changed field is sourceRef, from short `b61c2ce` to the exact full commit. All payloads and plan are unchanged. Both sourceRef/sourceCommit now equal the full commit, sourceState is EXACT_COMMITTED_INPUTS, uncommittedInputs is empty and productionApproved is false.

Reused `COMMITTED_PACKAGE_CUSTODY_REVIEW.md` SHA256 `46e399bd6a5bd062013fe5fbaa616320342da9ce2fe6dcf5975aed0adaa33064` for independent deterministic repack, media/credit custody, blocked-production and released source-lease/provider-clear evidence. Did not repeat its provider read or broad package/browser suites. Focused independent replay: PHP gateway **64 assertions PASS**, PHP lint and addon Node syntax PASS, exact source diff whitespace check PASS. These PHP functions are mocked; they prove no native WP/MySQL/cache/provider behavior. No direct browser automation was run by this reviewer.

## Product/security assessment

The account/CAS/lock/connection fencing implementation before the new artifact seam, account context/normal return helpers, menu hooks and REST privacy hooks remain byte-preserved from a7adc5e. account.js, qa-account.py, source HTML, catalog and media policy are unchanged. The predecessor review `ACCOUNT_IMPLEMENTATION_INDEPENDENT_REVIEW.md` SHA256 `046e05bf7a9de25b07e7f527100d0d647da145f9d906d80a83d0d12317bcbe27` remains conditional source acceptance; its native compatibility and provider cache conditions still apply.

The addon adds one ordinary `/interview-ready/app/` anchor on authenticated exact member-dashboard footer delivery. It does not intercept routing, repoint a shell asset, grant access or mutate course/enrollment/menu tables. It observes body child changes only, removes only its namespaced links, deduplicates execution, supplies an accessible fallback and disconnects its own observer/frame/pagehide listener. Its single pageshow reactivation remains intentional. Existing Matrix entitlement guards and sibling listeners/selection stay owned by existing code. This source assessment does not replace actual mobile/BFCache/sibling acceptance.

Only fixed matrix-entry.js/account-gate.html names are readable through the new seam. The selected immutable HTML verifies its directory digest and unique context marker; artifact reads recheck the selected directory/HTML digest, fixed filename, size, symlink rejection and unique embedded artifact hash. Inline addon delivery rejects a closing-script sequence. Account placeholders are replaced with escaped fixed same-origin URLs. No new state/nonce is added to public HTML or the anonymous gate. Normal WordPress/WooCommerce authentication remains the owner; no frontend flag or course is used to grant account access.

Manifest changes are one new IR runtime owner plus appended ten protected paths, three route checks and one browser journey; removing those additions yields full parsed equality with the predecessor. phase1.json only adds builder evidence; all previous values remain identical. founder-preview, accountPersistenceReady false, charity disabled and the blocked production builder/packager are retained. The candidate uses the same allowed-media payload, credit provenance and deferred-content exclusions qualified by routine custody. This review does not refresh third-party commercial claims or newly certify image rights.

## Explicit exposure and qualified recovery

**Installing this ordinary gateway makes `/interview-ready/` publicly available, exposes the anonymous free-account gate at `/interview-ready/app/`, and permits every normally authenticated WordPress account to access its own personal tools without course enrollment.** Primary/member menu links and the authenticated Matrix addon are also discoverable. There is no QA-only allowlist or hidden feature flag. This bounded pilot exposure is admitted by filed DR-375/376 and the independently reviewed pilot plan, subject to the conditions below. It must not be represented as completed production verification. No promotion of production flags is needed or approved to collect evidence.

Foreman supplied `PREINSTALL_SHARED_BYTE_READBACK.json` SHA256 `10883816955c03507d8b5c25e40e2eeb00d255b0ac578a7aca8beef0d1b3d28a` (15 origin/nine anonymous static hashes and aggregate owner absence). Its successor `PREINSTALL_EXACT_READBACK.json` SHA256 `7a29679b76ae3cbfc9a5a3867992265141ef98e464ea7e67f39166307dd7c763`, observedUnix `1791145606.614901`, binds the full commit, unchanged fifteen shared origin hashes and these exact lexical preimages:

- `wp-content/mu-plugins/missionmed-interview-ready.php`: ABSENT.
- `wp-content/mu-plugins/missionmed-interview-ready-runtime`: ABSENT.
- `wp-content/mu-plugins/missionmed-interview-ready-runtime/current`: ABSENT.

It records actual Chrome tab315031902 member-dashboard selection of the existing four shell/art/IIQ/File Vault scripts, Matrix markup present and IR absent. These are attributed Foreman SSH/browser observations inspected by this reviewer, not independent remote reads performed here. They qualify this absence-based code recovery plan at their observed time; recheck against collisions/drift immediately before mutation. The known alternate16ca hash contradiction remains preserved; no shared-core PASS or stale-lock rewrite is approved.

Withdrawal under a fresh healthy installation claim restores only the qualified dedicated gateway/current-pointer preimages. With these ABSENT preimages, withdraw the newly installed autoloaded gateway and current pointer; preserve any unused immutable release evidence, canonical users, `_mmed_ir_state_v1`, history, enrollment and all siblings. No duplicate backup PHP may be left in the autoloaded MU root. Do not restore/delete/reset database state or use recursive/broad cleanup. Prove routes/addon withdrawn and shared bytes/selections preserved afterward.

## Conditions that remain before execution and final release

1. Exact independent runtime-control/harness/wrapper approval must bind this fullref package, current source/authority, qualified absent preimages and fresh phase decision. This product review cannot approve its author's orchestration. Missing or failed package/control gates stop before retrieval or mutation; no automatic retry.
2. Foreman alone performs installation under the exact PATH claim for the dedicated runtime root plus gateway, shared_domains MATRIX-SHELL, immediate healthy fencing and checks before every operation. Transfer actual bytes, verify all five payloads, atomically activate only the dedicated pointer/gateway, then verify dedicated hashes/pointer, fifteen shared origin bytes, anonymous static hashes and actual shell/IIQ selections. No shared asset/cache/option/lock/renderer/auth change is admitted. Normal release and independent provider-clear precede separate AUTH work.
3. Native QA requires a separate AUTH claim and independently qualified reachable/bootstrap hook effects before any account creation. Mutations remain limited to the two named fictional subscriber/no-course identities and their own canonical IR state; collisions stop. No outbound mail/provisioning/enrollment/external dispatch, credentials in durable/output surfaces or account deletion/reset is admitted.
4. Actual native WP/PHP/MySQL/property-copy/cache hooks, two-connection first/revision races, lock denial, idempotent retry, original-owner restoration and narrowly admitted failure seam remain required. A local mocked PASS cannot satisfy them. Real private HTML/API/error cache exclusions, normal no-course login/registration return, A/B session/device isolation, logout/newlogin/BFCache and anonymous/wrong nonce/origin/owner rejection remain required. Any leakage, incompatible persistence behavior, unknown hook effect, shared drift or unhealthy fence stops the pilot; release AUTH and reacquire the installation claim for bounded code withdrawal.
5. Final role/browser/mobile/motion/MR/admin/sibling acceptance and independently accepted live byte/provider readback precede any production flag promotion or LIVE verdict. Retained QA identities/history are not rollback material. Limited isolated handle-close evidence must remain labeled limited; no claim of full HTTP disconnect proof.

Only this report was written for this review. No product/OS/index/HEAD change, staging/commit, provider/SSH/runtime/DB operation, credential retrieval, QA identity creation, install, deployment, push or cleanup occurred. **STOP UNCOMMITTED.**
