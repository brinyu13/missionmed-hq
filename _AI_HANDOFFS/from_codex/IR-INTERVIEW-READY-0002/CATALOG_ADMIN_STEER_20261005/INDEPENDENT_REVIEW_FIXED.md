# Independent catalog PREP fix review — 2026-10-05

**BLOCK pending one bounded draft-projection concealment correction. The three original exact reproductions are resolved. Fresh catalog-storage annex and separate integration/activation acceptance remain mandatory; no rollout authorization.** Reviewer `/root/native_stage_diagnostics`, independent of builder. Review BASE `f64dbc6f6cc57fb4d89bf518ed626a9d42f34c9b`, accepted product unchanged.

| Exact artifact | SHA-256 |
| --- | --- |
| Updated catalog-admin.patch | `464a3d772f13c914dd190a4360c29738db59a373511cf74368c3ff36cfbba8f7` |
| Updated admin-ui.test.js | `5c9f0416fc7c7ff9a781bc481b1c4e27486dc89e8b49d0850f007c3c9dd99e3c` |
| Prior blocked independent report | `8750e3497b1b18d3077fc77d07c0d3109ec2c6e98dae1720864bd51a9e9410b9` |

Read the prior report, updated HANDOFF and actual frontend delta/fixtures; did not redo unrelated architecture/security archaeology. Historical hashes in the HANDOFF's initial section remain old evidence; its final updated hash section matches the current reviewed bytes.

## Resolved original failures

- Adapter now reuses only the original sealed legacy photo and complete compatible credit. Actual unchanged production assetFor/productVisual/phase1-wrapper fixture renders the licensed photo/credit without TypeError. Unsupported new remote image metadata is not emitted as an image or partial credit; the existing truthful source-photo-link fallback renders. This closes the renderer failure by preserving a **blocked new-imagery gap**, not by satisfying new remote/photo rights/provider acceptance.
- Public hydration captures projection generation and checks generation/owner after fetch and JSON decode. Saved-draft Preview/Student switch/publication/concealment claim ownership. Deferred public JSON no longer overwrites preview; Student switch resets preview authorization and Publish.
- Admin request checks generation/abort/visibility after JSON decode; load/write check again before state publication. Generation-owned catch/finally guards prevent obsolete GET/POST completion from revealing controls or unlocking newer requests. Visibility/pagehide JSON races, old GET after newer revalidation, and obsolete POST after revoked revalidation all pass the focused actual-script fixtures.

## Remaining concrete blocker

**[P2] Unpublished draft remains displayed after capability revocation/lifecycle concealment.** The updated hide handler and request's 401/403 branch call `api.claimProjection('concealed')` and hide controls, but neither restores the last published projection nor hides/clears the shopping projection. A prior `api.applyProjection(state.draft,'preview')` has already replaced CATALOG/RESEARCH through the real apply hook. Concealing ownership cancels pending loads but leaves that unpublished catalog in the shopping page. On later revalidation returning 403, the ordinary/revoked session retains the draft presentation even though the admin toggle is hidden.

Independent bounded actual-script/fake-fetch reproduction uses distinguishable published/draft payloads: initial public load → authorized admin Preview → visibility hidden → visibility visible with admin GET 403. Apply sequence is `[published,unpublished-draft]`; after rejection the last displayed catalog is still `unpublished-draft` and admin toggle is hidden. This falls within the requested hide/revoke ordering and published-visibility boundary; existing fixtures assert only panel/toggle/Publish concealment, so miss the shopping content.

On hide/401/403, fence public operations and restore a safe published projection or conceal all preview-derived shopping content until a newly authorized projection is selected. If no published override exists, restore the original immutable embedded guide or conceal rather than retain draft. Keep server mutation authority unchanged. Add a focused fixture with **different** draft/published catalogs asserting the visible shopping projection after hide and rejected revalidation, including no-published case and obsolete POST completion. No generic auth/engine change is needed.

## Independent verification and limits

Executed `node .../CATALOG_ADMIN_STEER_20261005/admin-ui.test.js`: PASS 42 assertions. Executed `php .../catalog-admin.test.php`: PASS 60 assertions. `git apply --check .../catalog-admin.patch`: PASS, applicability only. Read-only chunk comparison against the exact prior patch committed at BASE confirms **all nonfrontend patch chunks byte-identical**, including PHP/server capability/nonce/origin/CAS/schema/image policy, gateway, build/release, CSS and default-OFF gate. Extra bounded in-memory updated-script exercise confirms the remaining projection issue; no actual fetch/network/browser was used.

No new server/source/DB/provider/lease/runtime/Git mutation or feature activation occurred. Only this fresh review report was written. Current remote-photo gap remains intentionally closed/fallback; source rights, provider hydration, browser/accessibility, real role/native storage, release and fresh annex acceptance remain separate. **STOP for bounded projection correction and another exact-byte preparation review.**
