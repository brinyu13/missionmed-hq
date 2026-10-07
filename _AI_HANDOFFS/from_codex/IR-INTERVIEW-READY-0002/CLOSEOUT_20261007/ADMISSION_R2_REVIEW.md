# Independent R2 closeout recovery admission — 2026-10-07

Verdict: **APPROVE bounded owned-delta restoration under normal REGISTRY fence, followed by normal registrar acquisition and ten-path staging only.** Reviewer `/root/ir_closeout_review`. No commit/push approval until independent exact staged-byte review.

The first attempt failed before staging/commit/push because the named-profile validator unconditionally requires CURRENT to mention the mission, whereas the existing CURRENT generator omits done/archived missions. Inspected both implementations. This is a closure-validation mismatch, not production evidence failure. Correct bounded handling is universal BOOT after done plus explicit mission/profile done checks, OS lint and independent semantic/routing review of the exact staged closed records. Preserve the earlier active-profile BOOT PASS; do not edit shared generator/validator or invent an active CURRENT entry. This does not waive canonical dependency/authority checks: the subsequent staged review must verify all IR profile dependencies exist and markers route to the recorded authority.

The failed ten-path candidate and backed-up snapshot independently match every SHA256 in FAILED_OWNED_PATHS.json. Observed OS HEAD remains 3a45264354084f64be712e92ab532a45e48fe0c7, exact nine tracked modifications and one new untracked DR396, empty index, and no other dirty/untracked paths. Root separately reports first-attempt provider release/readback; this reviewer did not access the provider.

Reviewed revised helper bytes. R2 control names preserve first-attempt evidence and prevent reuse. Admission additionally seals FAILED_OWNED_PATHS.json. Recovery verifies exact path/hash ownership, preserved backup equality and current base, acquires the existing normal scoped REGISTRY lease/client with five-second RegistryLeaseKeeper, and restores only those nine tracked paths from their exact HEAD bytes while removing only the backed-up newly created decision. No reset, clean, unrelated file mutation or shared tool change. It checks tracked-clean state, heartbeats and normally releases that recovery fence before MissionRegistryRegistrar.begin performs its normal fresh canonical fetch/allocation/fencing. Base or decision allocation drift stops execution. No reserved allocation, keeper bypass or historical backfill.

Credential transport is unchanged at 6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad. Earlier substantive admission findings remain satisfied: temporal post-deployment truth, missing historical leases disclosed, public-commerce-only closure, account/admin acceptance deferred, no runtime/source/deployment/private-state writes, and safe original receipts retained. The final helper retains exact index-blob and worktree SHA256 checks before commit, non-force push and exact remote readback. Provider-clear confirmation remains a separate post-release gate. This admission makes no claim that canonical closure is already filed.

Only static/read-only inspection and this report/admission creation performed. No helper import/execution, credential/keychain/provider access, OS write or Git commit by this reviewer.

Sealed inputs:
- `register_closeout.py`: `1cad6e545b04efb449b32ec17c5ac20206cdd2bd29ff58eac61fb1b69c952219`
- `RECONCILIATION.md`: `6053ace69ba3ca31eb973346bb875dfb31370894fe8278f52f1424e84b57c1e7`
- `LIVE_READBACK.json`: `fd127c3338fcd10bc577c779538945c3d22bacd5458afbd2aa06c36aa51bd19d`
- `FAILED_OWNED_PATHS.json`: `7c893fa5779a7aaed4e84af3039f1461ce759152ac3494509f00a3fc625a927a`
