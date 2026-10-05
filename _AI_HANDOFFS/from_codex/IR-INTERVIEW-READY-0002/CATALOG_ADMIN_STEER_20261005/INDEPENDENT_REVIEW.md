# Independent catalog/admin candidate review — 2026-10-05

**BLOCK exact candidate pending three bounded frontend fixes and fresh independently reviewed catalog-storage annex before integration/activation. No rollout authorization.** Reviewer `/root/native_stage_diagnostics`, separate from catalog/admin builder. Immutable review BASE `3c72c5b8399d2bc8ab7e849052230cbf80d33da8`. Root supplied routed R2 BOOT/unchanged DR-375/376 custody; this review does not expand the existing personal-state-only authority.

| Reviewed preparation artifact | SHA-256 |
| --- | --- |
| CONTRACT.md | `9b6f46eb760b2811ab16a0d23c82d1277690a30a1beb691d163d1d559a43d1af` |
| catalog-admin.patch | `322421044f62a15e8e07387a536f14686113a26638d62b9d3685730f04f2941e` |
| catalog-admin.test.php | `77d7e028237c47cb93ce00ec60fbc59d7783ce0aa508ed3697c56568941c2533` |
| admin-ui.test.js | `09425be9f974e6944ce0eb68dc8875f3d7e752205bec5e269e461a18efc51f8a` |

Read actual complete patch/contract/HANDOFF, fixtures and declared existing account/phase1/completion/gateway seams. No product patch applied; independent exercises execute added JS only in memory with bounded fake DOM/fetch, and PHP fixtures use fake WordPress/MySQL.

## Concrete blockers

1. **[P2] Approved new images crash the unchanged production renderer and have no approved production URL path.** In catalog-runtime.js `adapt`, new approved image metadata becomes `imageCredit={source,licenseUrl,caption}`. Existing phase1.js `productVisual` expects `credit.changes.includes('cropped')`, as well as author/license fields. Passing the actual adapted approved-image product to that unchanged wrapper independently reproduces `TypeError: Cannot read properties of undefined (reading 'includes')`; a valid new product image can break catalog rendering/preview. Separately, current production build rewrites completion's assetFor to the bundled ASSET allowlist only, so the adapter's remote approved `image.url` would otherwise resolve to empty while truthy `i.image` suppresses the fallback. Provide a complete compatible approved image/credit renderer and explicitly qualified URL policy seam; retain deny-by-default rights admission. Add a focused adapted-approved-image → actual production renderer fixture, not adapter-only checks.

2. **[P2] Late public hydration overwrites the saved-draft preview while Publish remains enabled.** catalog-runtime.js `load` unconditionally applies its published response when the fetch resolves. Admin preview applies state.draft and sets previewed=true/Publish enabled, without canceling or fencing that public load. An independent deferred-public-response exercise of both actual added scripts produces apply order `[draft,published]` after clicking Preview, with Publish still enabled. The admin can confirm publishing the saved draft while actually viewing old published content, breaking the preview-before-publish contract. Establish projection ownership/generation between public hydration and Admin preview/Student switch; stale public responses must not override an active preview. Add the deferred-public-load-after-preview fixture.

3. **[P2] Lifecycle generation is checked before JSON parsing, so obsolete admin responses can restore concealed controls.** catalog-admin.js `request` checks token against generation immediately after fetch, then awaits r.json without rechecking. `load` applies the later data and sets obscured=false/toggle.hidden=false. Independent deferred-JSON GET exercise: after visibilitychange to hidden, toggle.hidden is true; resolving that old response's JSON sets it false. The hidden/lifecycle-invalidated response is thus accepted after hide incremented generation and aborted its controller. Revalidate generation/lifecycle after every awaited response decode and immediately before state/DOM publication; obsolete write/load completion must not reset newer in-flight state. Add hide/revoke/pagehide during JSON parse, and older request completing after newer revalidation fixtures. Server capability still blocks unauthorized mutation, but does not cure stale admin UI/draft disclosure.

## Server and storage assessment

The prospective server gate defaults OFF and reuses the existing canonical gateway permission: logged-in current server identity, wp_rest nonce, same-origin Origin/Referer plus Fetch Metadata, no owner/query parameters, exact HMAC subject, then manage_options. Capability/current UID are checked again before mutation. Existing nonce/origin/subject/anonymous/student negatives pass; frontend context cannot grant server authority.

CAS/idempotency operates under fixed catalog advisory lock on the original mysqli handle via unchanged MMed_IR_Locked_DB. Expected revision, exact saved-draft digest, command-ID/content reuse checks, original connection integrity and finally release are present. Draft save leaves published intact; publish validates all enabled tier primaries and swaps the one option envelope. Published-ID disappearance is denied; archive/disable preserves history. Readback/error paths are closed. An update committed before later connection/readback failure may truthfully return uncertain 503; no transaction rollback is implied. Retry and real native DB/cache/failure behavior remain live acceptance gates, not fixture-established atomicity proof.

Public response projects only published enabled/unarchived products and enabled categories; draft/audit/actor are confined to admin. Exact schema rejects volatile Amazon fields, arbitrary HTML and malformed URLs/ASINs. Central destination is exact missionmatch-20. Legacy key must remain original KIT_KEYS plus exact category/tier/ASIN; relocation/ASIN edit clears it. Existing account item map is retained; new catalog keys do not gain personal persistence. Image URLs require a server-owned exact approved record; admin-entered rights assertions alone are denied. Existing provider/API gates remain false.

## Independent checks and limits

`php .../CATALOG_ADMIN_STEER_20261005/catalog-admin.test.php`: PASS 60 assertions. `node .../admin-ui.test.js`: PASS 28 assertions. `git apply --check .../catalog-admin.patch`: PASS; applicability only, no application. Three additional read-only in-memory actual-script/dependency exercises independently confirm the above blockers. Existing fixture coverage does not include these renderer/hydration/decode races.

Declared dependencies rechecked byte-equal to immutable BASE: account.js `018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a`; phase1.js `fc7a46267bcb98354008d77451f7e2db03336ec26e064404efdd0ba91f73fcb0`; completion.js `b05f8a70857b4994dd4503e9ccb93d27d0d9c12eb6719250e9c5175d29523810`; gateway `819dd734ae7bf61ded755dd3bdda5e64e4945bac05d28bd4aee5cd68f7a9d7f5`.

The candidate deliberately does not yet integrate dynamic category.alternatives/badges into the shopping patch's renderer; HANDOFF identifies this remaining integration work. Source/fixture checks are not browser, genuine role, native MySQL/cache, concurrent admin, uncertain commit/retry, image rights/provider hydration or deployment proof. Fresh storage/option/cache/lock/route/immutable-asset annex and exact guarded source/runtime release acceptance remain mandatory; do not enable the constant under DR-376 alone.

Only this report was written. No source/provider/DB/network/runtime/Git mutation or execution controls; no rollout approval. **STOP for bounded preparation fixes, new exact-byte review, and separately routed annex admission.**
