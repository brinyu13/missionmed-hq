# Partial-run schema recovery decision

Decision: `ARCHIVE_CONTRACT_INVALID_PARTIAL_RUN_AND_REEXTRACT`

Status: approved for a bounded, non-destructive recovery after independent tool audit

## Evidence

- The corrected fresh extraction accounted for all 97 transcript artifacts but completed only 95: 95 `COMPLETE_WITH_QUARANTINE`, two `FAILED_WITH_PROVEN_BLOCKER`.
- The ledger accounts for 855 completed automated pass cells and 18 blocked cells, totaling the exact 873-cell denominator with zero silent omissions.
- Both failures are `SCHEMA_INSTANCE_REJECTED`. Restricted local diagnosis found exactly one invalid occurrence in each artifact.
- Both invalid rows had the same bounded combination: `NONMEDICAL`, `POTENTIAL_DIRECT_IDENTIFIER`, and the correct privacy-precedence lifecycle `PRIVACY_QUARANTINED`.
- The implementation and correction comparator were correct. The occurrence schema still imposed the superseded unconditional rule `NONMEDICAL => REJECTED_NONMEDICAL`.
- The schema now permits `PRIVACY_QUARANTINED` for NONMEDICAL rows and separately requires that lifecycle whenever `privacy_class` is `POTENTIAL_DIRECT_IDENTIFIER`.
- The focused regression and the full non-rotation suite pass: 82/82.

## Bound state

- Extraction run: `opaque_run_i2IwFt-nc8yUknV2OcX47LKN7Ibxoqh2WLuNZIrma5M`
- Partial run contract: `9872762e6cc15303e0767bba1bd0e9f219315389404421199f8507c796ee821b`
- Roster root: `0aa8ab3a17786763c57ff575ebcda59bcb69d273f8f84557d9e94aed5b4258a7`
- Partial extraction state: `65adacab90fd3563de9252d04cba5bbd91a937921c7f41312bde8dff8b972ffc`
- Partial extraction receipt: `f33a5a7a76dd09e2fdc01f85dc47ba06e2f9663981dfa4841aafef36dc97aa29`
- Partial safe coverage receipt: `5dd6056ab2b45a59dace4f5f7b6964e450bda06a95956e448bb97fdcc6f2a48e`
- Partial safe processing ledger: `d87a66aa7acbb19057c2de9797dd48f65396d5526e1761cbe76435b8f19419c1`
- Partial safe failure ledger: `e564283ab63d907b648dd10fe5698b43e5947f5a549d0515c2ee7569676ce763`
- Corrected occurrence-schema bytes: `fc018bbd267695ad0236a944fc3c5726468faed0140aee66c29e6db471196318`
- Corrected extraction-test bytes: `4488c9a464f52913fa1b6e7fa39cd706dc6a533bfe4400c63af977db07324310`

## Authorized recovery scope

After a dedicated recovery tool passes synthetic crash/resume, lock, no-clobber, and preservation audit, it may atomically archive only these derived units:

- `working/`
- `reviews/`
- `state/extraction-state.json`
- `state/extraction-journal.json`
- `audit/extraction-receipt.json`
- `audit/processing-receipts/`
- `audit/retrieval-receipts/`
- `audit/artifact-failures/`
- the current partial-run Git-safe ledgers and generated evidence projections

It must preserve byte-identically the raw corpus, acquisition state/receipt/targets, alias map and locks, network/boundary approvals, the completed supersession status and receipts, and every prior quarantine archive. It must recreate only the exact empty derived directories needed by a clean extraction.

The operation must use the shared kernel extraction lock, preflight/postflight boundary checks, no-clobber atomic renames, a content-addressed PREPARED/MOVING/COMPLETE recovery status, per-unit crash resume, and preservation-root verification. Destructive deletion, production mutation, release authority, and final medical approval remain prohibited.

Because the corrected schema bytes are part of the extraction run contract, resume under the partial contract is prohibited. The only authorized next action is non-destructive archive followed by a clean deterministic re-extraction.
