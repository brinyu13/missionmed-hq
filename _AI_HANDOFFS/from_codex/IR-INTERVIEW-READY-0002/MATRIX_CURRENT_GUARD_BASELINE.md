# Current Matrix selection and additive IR guard baseline

Verdict: **CURRENT SELECTION QUALIFIED; FILED DR-376 DEDICATED-ONLY EXCEPTION CAN APPLY WITH PRESERVATION GATES**. Independent reviewer `phase1_registration_contract_review` (Sol6.1 High), read-only observations 2026-10-04 approximately 18:38–18:42 UTC. This is baseline preparation, not implementation/deployment approval, shared-core authority, stale-lock override or full Matrix PASS. Source HEAD remained `99e83447896c9450c2275b4e4dad2fbfaf16b31f`; this report is deliberately uncommitted while the account worker holds that HEAD.

Authority: canonically filed DR-376 at OS `84754150b8c834ac25466860ab98600b5d5c1b9e`, SHA256 `32ad43957a4b9a245e5eb715c998692bf0ad8ed13d0766d88ab0e9955b7513bd`, expressly limits IR to a new dedicated addon while preserving shared bytes, selected sources, lock and cache. Earlier `MATRIX_LINEAGE_REVIEW.md` established origin custody, not actual browser selection. The new evidence below resolves that narrower selection question; it does not repair or newly approve the old fallback bytes.

## Observed selection and mechanism

Foreman reports actual authenticated admin Chrome `/member-dashboard/` DOM: MATCH TOOLS `.sos-nav-label` within `.sos-nav-section` / `.sos-nav-list`, existing direct InterviewIQ anchor, IR absent. Reported script sources are the `38507...` student shell, dashboard art, uploaded IIQ namespaced renderer and `3f9f...` File Vault asset listed below. This reviewer did not repeat an authenticated browser capture or inspect private user data; those DOM facts retain Foreman provenance.

Fresh bounded static source reads independently explain both overrides:

- Hub `class-mmed-student-os.php` still initially enqueues `student-os.16ca42c53ca2e890.js` on `mmed-student-os-js`. Existing MU `missionmed-matrix-runtime-pin.php` filters `script_loader_src` at priority 20 for that exact handle, checks the pinned asset exists, and rewrites the hashed filename to `student-os.38507e1ac8a555ba.js`. Its fallback returns the original source. This reconciles the observed browser `38507...` with unchanged PHP `16ca...`; it is not evidence that either was just changed.
- Hub dashboard experience initially enqueues the ordinary renderer/art. The student-OS class's Matrix2 branch selects `mmed-dashboard-v2.6010b-students.js`; existing IIQ MU priority-100 enqueue/filter then substitutes only handle `mmed-dashboard-v2-js` with uploaded `matrix-v2-iiq-1203.js`. The source renderer `56dee...` and uploaded `8d4b...` remain distinct. IR must preserve both and must not copy/reselect either renderer.

The bounded top-level MU selector search also identified `missionmed-performance-boost.php`'s priority-15 static-resource query-string filter; its bytes are included for preservation. No options, bootstrap payload, profile or entitlement response was read. The runtime pin was not present at the inspected HQ `origin/main:wp-content/mu-plugins/...` path, so no immutable HQ source/authority custody for that file is asserted. Its fresh origin hash plus actual observed selection are preservation evidence only; its source comments are not borrowed executable authority.

## Exact preservation set

Paths below are relative to live webroot `/www/theresidencyacademy_209/public`, SSH alias `missionmed-kinsta`. Public body digests were fetched anonymously over verified HTTPS from `https://missionmedinstitute.com/<path>?ir_guard_baseline=<fresh stamp>`, without cookies, redirects, proxies, purge or other mutation. Each listed public asset digest equaled its fixed-path origin digest. PHP/MU code has origin-only custody; no public PHP response is represented as its source bytes.

| Relative path | SHA256 | Qualification |
| --- | --- | --- |
| `wp-content/plugins/missionmed-hub/assets/student-os.38507e1ac8a555ba.js` | `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a` | Origin/public equal; Foreman browser-selected |
| `wp-content/plugins/missionmed-hub/assets/student-os.16ca42c53ca2e890.js` | `0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201` | Origin/public equal; preserved PHP fallback; known filename/content mismatch |
| `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2-art.js` | `ac77de458b893d38c20c622099b5996b5cb464de0e74cc1868f91ca3dabaffaf` | Origin/public equal; Foreman browser-selected |
| `wp-content/uploads/missionmed-interviewiq-discovery/iiq-1203-v1/matrix-v2-iiq-1203.js` | `8d4b57a24132681f6d02fd8c072e3368246b9e5d4e56a3d68e8bbb12c5aba9ee` | Origin/public equal; Foreman browser-selected |
| `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js` | `56dee16717478f9351cb038e6a0976c3f4fad71e522b092b552cff6754a66235` | Origin/public equal; source-selected before IIQ override |
| `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.js` | `4fdcf13828e3eca0b5e6f7d3fae169e8aee0ab42589dfb01238675681ff6cbec` | Origin/public equal; ordinary dashboard candidate, not claimed selected |
| `wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.3f9f0152e8bfbc03.js` | `3f9f0152e8bfbc034ae5ede0843fb756754daf3aa99f89ddc83124b4be263582` | Origin/public equal; Foreman browser-selected |
| `wp-content/plugins/missionmed-hub/assets/student-os.css` | `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260` | Origin/public equal; source enqueue |
| `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css` | `be5ade93749eb3fcd6d62cfcb3fa9c05278b07ef52fd53b84049a5faea68612d` | Origin/public equal; Matrix2 source enqueue, no new browser CSS claim |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php` | `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d` | Origin-only; unchanged from prior lineage |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php` | `c7285a39f698101b9ec7a5e6c7fb6a535c08e1247e9cf02dc5dece8897b9c461` | Origin-only; unchanged from prior lineage |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-dashboard-experience.php` | `63e9c2f8aa69681ae271c6630643df6fa2d791a07dd7c9a315561cdb14595e89` | Origin-only; renderer/art selection source |
| `wp-content/mu-plugins/missionmed-matrix-runtime-pin.php` | `cf2251762f7e88357467a9225eae27e19fe67d7ad44311faecce63b506344a0e` | Origin-only; explains current shell URL override |
| `wp-content/mu-plugins/missionmed-matrix-interviewiq-entry.php` | `94d1668e8c45cf9fb830c7c10f78151ba25c4adb23904bce0c166ad115767f7c` | Origin-only; matches prior IIQ lineage; preserve entry/renderer selection |
| `wp-content/mu-plugins/missionmed-performance-boost.php` | `00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1` | Origin-only; existing static-resource filter |

Canonical HQ `origin/main` Matrix lock manifest remains SHA256 `f8d1496763bed12a2333be6e9286256f814fcd5f8c36a45af72ae8cb397b7d90`. This is immutable-source custody, not a live option/manifest reconciliation. Initial Python public GET attempts failed and produced no qualified digest; verified system-curl reads supplied the matching public digests. No empty/error response hash was admitted as an asset hash.

## Narrow application and stops

DR-376's fresh exception can apply to the new IR-owned addon without requiring a false all-core PASS: append only an idempotent accessible ordinary external anchor in the observed Match Tools rail, plus its own accessible fallback, enforcing IR eligibility at its WP destination. Preserve current shell/IIQ selection and every qualified shared byte, existing anchors, routing, globals, observers, eligibility and sibling behavior. Do not alter the runtime pin, old fallback, registered lock, cache or existing IIQ entry. The discovered pin explains selection; it supplies no new IR authority.

Immediately before any addon operation, refresh these preimages and actual authorized DOM selections, qualify the new artifact's committed source/digest/owner/smoke/rollback and absence/collision checks, obtain exact scoped fencing, and independently review its implementation. Afterward recheck origin/public equality and actual sources plus sidebar/rerender/mobile/sibling navigation. New unexplained drift, any missing equality/selection proof, name collision or need to edit/repoint shared assets closes this narrow gate; full existing shared guard/sovereign stops then apply outside this exception. This baseline alone does not authorize deployment or restore the old bytes.

Only this handoff report was written. No index/commit/HEAD change, provider/options/cache/source mutation, Matrix preflight or stale-warning override occurred. Stop uncommitted until Foreman confirms the active source worker has stopped; no push.
