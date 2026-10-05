# Catalog Admin steer handoff — preparation only

Base: `f64dbc6f6cc57fb4d89bf518ed626a9d42f34c9b` in existing assigned worktree. Source is unchanged by this worker. No product/provider/WordPress/database/deployment operation, no commit or self-merge. Existing unrelated dirty `supabase/.temp/cli-latest` and `_AI_INPUTS/` preserved. Root is the integration owner.

## Prepared files and SHA256

- `CONTRACT.md` — `9b6f46eb760b2811ab16a0d23c82d1277690a30a1beb691d163d1d559a43d1af` (8761 bytes)
- `catalog-admin.patch` — `322421044f62a15e8e07387a536f14686113a26638d62b9d3685730f04f2941e` (44951 bytes)
- `catalog-admin.test.php` — `77d7e028237c47cb93ce00ec60fbc59d7783ce0aa508ed3697c56568941c2533` (15103 bytes)
- `admin-ui.test.js` — `09425be9f974e6944ce0eb68dc8875f3d7e752205bec5e269e461a18efc51f8a` (8480 bytes)

## Validation performed

- `php catalog-admin.test.php`: PASS 60 assertions. Canonical admin/student/anonymous boundary, nonce/origin/subject/owner spoof negatives, legacy ASIN binding, exact image approval, schema and volatile-data rejection, draft/published separation, preview/CAS/idempotency, archive preservation, WP write failure/lock failure/no reconnect/corrupt-record behavior. Native DB and WP functions are fixtures.
- `node admin-ui.test.js`: PASS 42 assertions. Default-off context, no ordinary-user controls, canonical tier ordering, alternatives/badges/legacy identity, primary/archive/move helpers, Student/Admin toggle, local preview, declined publish, nonce/subject/server digest publish and revoked-capability concealment. DOM and HTTP are fixtures.
- `git apply --check catalog-admin.patch`: PASS against the assigned existing base. No patch was applied.
- Proposed build.py and integration/release.py reconstructed in memory and Python syntax compiled: PASS. No full build, package generation, real browser, native MySQL or live verification performed.

## Exact prospective product paths

- New `interview-ready/integration/missionmed-interview-ready-catalog.php` (dedicated namespaced mu-plugin support; feature default OFF).
- New `interview-ready/catalog-runtime.js`, `catalog-admin.js`, `catalog-admin.css`.
- Narrow edits to `interview-ready/integration/missionmed-interview-ready.php`, `interview-ready/build.py`, `interview-ready/integration/release.py`.
- No completion.js/css or phase1.js/css changes. Existing account.js, KIT_KEYS, personal metadata and Phase1 false flags remain unchanged.

## Admission and integration requirements

Fresh independent decision annex REQUIRED before product integration/activation: DR-376 authorizes only self-owned WP user metadata and does not admit the `_mmed_ir_catalog_v1` option or admin curation writes. CONTRACT.md supplies the exact narrow option, capability, CAS, image policy, runtime injection, audit and recovery terms to route. Admit the dedicated support mu-plugin path, source/build/release paths, exact option APIs/cache invalidation, fixed catalog lock, default-off feature activation and immutable review/rollback. ROOT must acquire fresh exact narrow leases and independent byte/security/release acceptance; preserve current AUTH work and all DR-375 exclusions. Do not merely set the feature constant.

Once admitted, authorized admins can import the unchanged guide as a draft, add/edit/move/reorder/enable/disable/archive, choose primary/alternatives and badges, edit editorial and expert/media links, preview and publish without ordinary catalog deployments. Public/student GET exposes active published products only; admin endpoints use canonical same-origin WP nonce+subject+manage_options. No frontend flag grants writes. Server removes encoded admin payload from every response and injects executable admin code only on authorized private response. Forms/actions are inert during saving to avoid discarding edits made while a write is in flight.

Image policy is deny-by-default. A server-owned exact approved-image record must be wired through `mmed_ir_catalog_approved_image` after verified rights admission; admin-entered evidence URLs alone cannot authorize image reuse. Existing unchanged legacy identity may reuse build-approved media. No newly authorized provider or image rights are claimed.

Provider research supplied by Root: Creators API access remains UNKNOWN; current account navigation redirected to sign-in. No credential generation/read, new API requests, scraped data or copied commerce interface. Catalog writes cannot set Amazon ratings/prices/offers/availability/title. Existing false numeric/API gates remain false. Root should incorporate its official-source evidence; this worker performed no provider research or acceptance.

New/moved products with no original exact category/tier/ASIN key cannot save to personal kits. Adapter outputs `catalog:<stable-id>`, and controls are disabled. Nonempty legacyKey is checked against original KIT_KEYS and exact category/tier/ASIN; the UI clears it on moves/ASIN changes. Saved old kits retain original account-map metadata and never retarget to a different ASIN. Dynamic kit persistence needs a separate approved stable-id extension. Shopping integration must display `category.alternatives` and explicit `item.badges`; adapter preserves 3 primary tier order.

Runtime integration hook: `window.IRApplyPublishedCatalog(catalog)`, with `IRCatalog.adapt(catalog, originalLegacyCategories)` creating the existing item shape. Parent shopping worker can supply the hook; patch provides a default. Public async hydration is additive, leaving existing embedded guide when no published option exists. Independent review should check async preview/hydration ordering and actual browser mutation/concealment behavior before activation.

Real WP/browser acceptance still required: authorized admin and ordinary registered/anonymous role flows, live current capability checks and revoke/logout, concurrent CAS, unknown write outcome retry, primary archive/replacement, rights checks, retained published catalog on failures, reload across sessions/devices, unchanged personal A/B isolation and historical kits, mobile/desktop views, exact immutable package/manifest and code-only rollback. Not deployed; not LIVE; not VERIFIED.

Memory quick pass: MEMORY.md lines 185–206 informed preservation of existing engine, supplied asset rights and no-fabricated commerce facts; these were rechecked against current Founder/DR375/376 inputs. Parent should cite if it uses those memory-derived guidance notes.

STOP: artifact preparation complete; Root owns subsequent admission/review/integration.

## Bounded frontend corrections following independent review

Fresh preparation base: `f64dbc6f6cc57fb4d89bf518ed626a9d42f34c9b`. Reviewed INDEPENDENT_REVIEW.md and CONTRACT.md read only. Only this preparation patch, frontend fixture and handoff were edited. Existing accepted product bytes remain untouched.

- Image adaptation now reuses only a matching sealed legacy product photo and its existing full renderer-compatible credit (source, licenseUrl, caption, author, license and changes). New remote image metadata, even if server approved or admin asserted, does not become an image URL: production assetFor has no separately admitted remote path. Missing images use the unchanged truthful original-photo-link fallback. No image policy or rights admission is broadened.
- Public hydration captures projection generation and rechecks after fetch and JSON decode. Admin saved-draft Preview, Student switch, publication and lifecycle concealment claim projection ownership; older public requests cannot overwrite the preview. Student switch also clears preview authorization and disables Publish.
- Admin requests recheck generation, abort and visibility after response decode. GET/POST completions recheck immediately before state/DOM publication. Each operation owns its generation, catch and finally cleanup: obsolete reads/writes cannot reveal controls, change newer request state or restore Publish after hide/revoke/pagehide. Revalidation alone restores usable controls. Preview requires no active request and a visible current lifecycle.

Updated exact SHA-256:

- catalog-admin.patch: `464a3d772f13c914dd190a4360c29738db59a373511cf74368c3ff36cfbba8f7`
- admin-ui.test.js: `5c9f0416fc7c7ff9a781bc481b1c4e27486dc89e8b49d0850f007c3c9dd99e3c`

PASS: focused Node VM fixtures, 42 assertions including real candidate scripts, actual unchanged production productVisual/phase1 wrapper with sealed media and full credit, unsupported remote-image fallback, deferred public JSON after preview, visibility/pagehide during admin JSON, stale older GET after newer revalidation, and obsolete POST JSON after revocation. PASS: git apply --check. Nonfrontend patch sections (PHP/server capability/nonce/CAS/schema, gateway, build/release, default-OFF gate) were checked byte-identical to the accepted preparation artifact. No server/runtime/DB/provider/Git/product mutation, commit, or broad suite.

**Blocked image gap:** a server-owned approval record alone still does not admit a new remote image to the existing sealed production ASSET/rights pipeline. New remote photos require separately routed source hooks, explicit rights qualification and independently reviewed renderer/build admission. This patch deliberately preserves fallback rather than claiming those missing approvals. Browser, real roles, native storage, provider hydration and release acceptance remain unverified. Existing independent review block requires fresh exact-byte review; builder tests do not lift it. Root owns annex admission, commit and subsequent SOURCE integration. STOP after this bounded handoff.

## Residual published-visibility correction

Read INDEPENDENT_REVIEW_FIXED.md read only. Its reproduced Preview → hide → visible GET 403 retained unpublished shopping content despite concealed controls. Corrected frontend preparation only: lifecycle hide, admin 401/403 and Student cancellation now restore the last published projection through the existing apply hook; when no published override exists they restore the immutable embedded guide via the existing legacy seed adapter. Current successful revalidation replaces that safe view with its current published projection. All restores claim projection generation, invalidating stale public responses. Older GET/POST response handling and operation-owned catch/finally fences remain intact. No server/schema/media/production-policy or actual source changes.

Fresh exact SHA-256:

- catalog-admin.patch: `ad46b43f40022892198c57d97014984c72e6f07726ebb73d110379196d258be4`
- admin-ui.test.js: `86c55338a8d090366f34b5aef50f54fb14d9e97e9132d10ab27cfb42a37b9c2f`

PASS: focused frontend tests, 59 assertions. The adversarial fixtures now execute the **actual catalog_hook extracted from the candidate build patch** and inspect actual CATALOG/RESEARCH state, not only projection-call counts. Draft/public records have distinct displayed titles. Fixtures cover Preview → hidden → visible GET 401 and 403, published shopping restoration while controls remain concealed, no-published immutable fallback on Student cancellation/pagehide/direct revocation, newer successful revalidation selecting published rather than draft, and obsolete POST decode after rejected revalidation retaining safe published content. Previous media/decode/public-hydration regressions remain passing. PASS: git apply --check. No product mutation, commit or deployment. Fresh independent review must reproduce the actual residual sequence before lifting its block; existing annex and release gates remain required. STOP after handoff; Root owns subsequent filing/admission.
