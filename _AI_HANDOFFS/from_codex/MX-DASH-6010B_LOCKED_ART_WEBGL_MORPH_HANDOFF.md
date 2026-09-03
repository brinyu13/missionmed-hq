# MX-DASH-6010B — Locked-Art WebGL Morph Handoff

Date: 2026-09-03  
Terminal state: `READY FOR FOUNDER VISUAL APPROVAL`  
Production exposure: administrator-only morph canary; student-wide morph activation is OFF.

## Authority and custody

- Mission: `MX-DASH-6010B`.
- Decisions: `DR-177`, `DR-178`, `DR-179`.
- Founder runtime-drift override: accepted only for `student_os_js`, `student_os_css`, `class_mmed_student_os_php`, `calendar_v4_js`, `calendar_v4_css`, and `storyforge_js`.
- Canonical MissionMed OS verification commit: `971121889c1b137aa1b7172c5c0c538e63283c42`.
- MissionMed HQ `origin/main` observed during boot: `569e63de284fe086a0da588333f7b96ac72a2409`.
- Worktree: `/Users/brianb/MissionMed_worktrees/MX-DASH-6010B-webgl-morph`.
- Branch: `codex/mx-dash-6010b-locked-art-webgl-morph`.
- Starting product commit: `eba31899799c11d598f1cbd2c1824146aaa403d9`.
- Implementation commits: `5fa460e9c84639005a6d24c26a8f2f9f0799c685`, `8f562a2`, `f5ecade`.
- Current source/remote commit before this handoff commit: `f5ecade`.
- Force push: not used.

## Live-source and drift reconciliation

Current production was used as merge truth. No stale runtime-lock byte was copied into the product.

| Runtime surface | Current production SHA-256 / treatment |
|---|---|
| `student_os_js` | `16ca42c53ca2e890a1e791fc2731fc3b0c86a9082f5f801198fc1a12274593fa`; preserved |
| `student_os_css` | `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260`; preserved |
| `class_mmed_student_os_php` | Live merge base `b6565d9f0bff0b7b4ae21027818668bb632e8b90d80c992bb784840b1dd15406`; current `15d095f11796b25dcb49290c730fc5aaf571c8aa9f1c439b2d6afae595c8c698` after the 31-line additive administrator-only immutable-asset enqueue seam |
| `calendar_v4_js` | `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480`; preserved |
| `calendar_v4_css` | `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e`; preserved |
| `storyforge_js` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`; preserved |

No new unexpected protected drift appeared. `class-mmed-dashboard-experience.php`, `missionmed-hub.php`, Dashboard art JS, Scheduler, Calendar behavior, StoryForge behavior, File Vault, auth, roles, routing, and data were not changed.

The live browser initially proved that the public CDN continued to serve the prior unversioned Dashboard JS/CSS after an affected Kinsta site/CDN/all-cache purge. DR-177/178 and the Founder directive expressly permit the smallest live-based enqueue/version integration when required. The final canary therefore routes administrators only to immutable `mmed-dashboard-v2.6010b.js/.css` filenames. Ordinary students retain the established handles; the morph runtime itself also fails closed unless the server-resolved payload has both `experience === "matrix2"` and `is_admin === true`.

The Matrix runtime-lock manifest remains unchanged at this Founder-review stage. The runbook reserves the exact affected runtime-lock update for the later `APPROVE FOR STUDENTS` continuation.

## Locked inputs and deterministic extraction

Verified immutable source hashes:

| Source | SHA-256 |
|---|---|
| `missionmed_app_card_background_system.png` | `7630178b303241bc23d61005581d1b7673e18809dd3715c8db55bf123d623382` |
| `missionmed_matrix_dashboard_concept_board.png` | `d1a0e5bb4195a0fe0959b9537e4671b36e6ca684b34c843bb2d9bcfc8204a2a8` |
| `pencil_to_cinematic_hover_morph_system.png` | `dbcb2d193baa409b7b48000eb24e1bfc06d51af694330c1082abb35d1a7941f8` |

Crop/UV manifest: `wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/crop-manifest.json`  
Manifest SHA-256: `f8e99e39ab29a7b6bfff629bfd3edc8525aea034be60dc4abd3dc564b85d88bf`.

| Card | Pencil rectangle | Cinematic rectangle | Pencil SHA-256 | Cinematic SHA-256 |
|---|---:|---:|---|---|
| HomeBase | `172,158,266,329` | `25,122,341,385` | `816b465cbda57cfde680a69a2187901c8c97c1d8692ed3bf1ed76b3bd117e51f` | `0961c33d17e95ffc53ab26fbd0228ac261774f17ca4c6b7a431487d1cea72e16` |
| Calendar | `453,158,258,329` | `374,122,346,385` | `7cc915d798648faceea3a5ab66f711d3e00f8dbd86f709b7765dfe850c87a57a` | `d0e4dd8febe578e51bf86f748a6359fa681f769a96c5f017006a6c4f7df6aca3` |
| Scheduler | `727,158,255,329` | `728,122,337,385` | `b49df8fe9c5270c4d03cd8ed09115b67a3267eaa462dab4d65c7ec11c6cd243f` | `1d74993b50b8efb5b8cc04bf5ae0abcad8c2c5bbc26beaa9e84efa60986be1fc` |
| StoryForge | `996,188,246,300` | `1073,122,349,385` | `2c275dd04bb821576f8524129956be0d0170f2e2b26245182ab43d8f044503e8` | `df53e21cf51f450d81d8a726408b5a7be53557a4905937105c482b21fcce532d` |
| IV Prep On-Call | `172,500,266,290` | `25,515,341,375` | `3858096899db3daa5bb186623b999c3fa69b1921258ab8ce79f2942813bf6e4f` | `6204776031ccc7b542c1245f528c1a9646f5df342acf929af3aafb60c563c33a` |
| RISE | `453,500,258,290` | `374,515,346,375` | `74775fba748c3948700fcfaf54d7fb3d2136520edb9f54f860492d3276e526eb` | `ab5c393eb9b5938fb5ff6b42a0f21d0cfa84549fb95942aab2b2fdb92e898a6c` |
| RankList IQ | `727,500,255,290` | `728,515,337,375` | `fae43575a45401ed90b3dbe928bb4d5170b13f87c82ad65fb240891b0c6e2378` | `544f5a98c32f2d4c4f8ada517b6102434189a9246b1d0d73e63bb35fb6943d0d` |
| LOR Studio | `996,502,246,288` | `1073,515,349,375` | `7aa78752df6dc2a19334edfa60a6b7269d64b2c3fdbc3d81e3f7dc863c78fd04` | `aa7ebd37541900b2fec139c73d028e0986684d8c90a08e991db4b58ee1b24ff9` |

`locked_art_tool.py --verify` decodes every crop and compares its RGBA pixel buffer with the corresponding source rectangle: `LOCKED_ART_VERIFY_PASS cards=8 endpoints=16`. No AI generation, redraw, recolor, reinterpretation, or lossy endpoint transformation occurred.

## Files added or changed

Changed:

- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.js`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.css`
- `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php`

Added runtime/custody:

- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b.js`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b.css`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/crop-manifest.json`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/source/missionmed_app_card_background_system.png`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/source/missionmed_matrix_dashboard_concept_board.png`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/source/pencil_to_cinematic_hover_morph_system.png`
- The sixteen exact PNG endpoints under `locked-art/pencil/` and `locked-art/cinematic/` named `homebase`, `calendar`, `scheduler`, `storyforge`, `ivprep`, `rise`, `ranklist`, and `lor`.

Added verification/evidence:

- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/harness.html`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/browser-qa.cjs`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/locked_art_tool.py`
- `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/browser-qa-results.json`
- `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/admin-pencil-desktop.png`
- `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/homebase-morph-midpoint.png`
- `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/homebase-cinematic.png`
- `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/admin-mobile-390x844.png`

No shared PHP other than the explicitly authorized `class-mmed-student-os.php` enqueue/version seam changed.

## Morph architecture and accessibility

- Exact pencil PNG is the idle endpoint and exact cinematic PNG is the final endpoint.
- The intermediate WebGL2 fragment shader uses a diagonal procedural noise mask, bounded UV displacement, source pencil-edge glow, and restrained depth/contrast modulation. It is a genuine per-pixel shader transition, not a two-image opacity crossfade.
- Duration is 820 ms and direction reverses from the current progress value.
- Only one card owns the shared WebGL2 canvas at a time; maximum observed active contexts was one.
- The shader/program/buffer are warmed during idle time. Per-card endpoint textures are created only for a transition and deleted at the endpoint. Route/unmount/rerender disposal releases textures, buffers, program, and context.
- Cinematic targets load lazily. Hidden-document animation pauses and resumes without advancing hidden time.
- Desktop uses pointer enter/leave and keyboard focus/blur. Coarse-pointer layouts use a visibility threshold rather than hover.
- `prefers-reduced-motion: reduce` uses a 200 ms CSS dissolve and never starts WebGL.
- Missing WebGL2, image failure, or initialization failure uses the same bounded CSS fallback.
- Visible duplicate DOM labels/categories/descriptions are suppressed for locked art, while the card button keeps its semantic `aria-label` and existing click behavior.
- Any explicit administrator `card_image` or `detail_image` override uses the established override renderer. Copy-only overrides retain locked art.

## QA and measurements

Automated browser result: every named check passed with `failures: []`:

- exact admin endpoints; HomeBase forward/reverse; genuine shader midpoint; keyboard;
- all eight cards; repeated-hover resource cleanup; route cleanup;
- card detail and launch; editor; custom-image override; copy-only override;
- true-student unchanged; Classic; reduced motion; WebGL fallback; exact 390×844.

Live authenticated administrator QA at 1920×961, with reduced-motion emulation disabled only for the measurement:

- all eight cards reached cinematic and returned to pencil;
- 1,689 sampled shader frames, average interval `8.41 ms` (about 119 fps), maximum interval `50.4 ms` including focus/navigation transitions;
- warm shader compile `10.7 ms` (first idle compile in the tab `286.8 ms`); maximum active contexts `1`;
- texture resource sets `18 created / 18 disposed`; failures `0`;
- route cleanup reached `contextsCreated 3 / contextsDisposed 3`, `activeContexts 0`;
- no Dashboard/locked-art/WebGL console error appeared. The page still emits its pre-existing unrelated WordPress `@wordpress/api-fetch` unstable-API error.

Exact 390×844 live QA:

- `innerWidth 390`, document width `390`, no page overflow;
- first card `x=12`, width `335.398`, right edge `347.398`;
- detail panel exactly `390×844`.

Exact 390×844 deterministic browser run:

- 51 frames, average interval `16.666 ms` (60 fps), maximum `16.8 ms`;
- compile `74.6 ms`, maximum active contexts `1`, texture sets `1/1`, failures `0`.

The cold headless SwiftShader reference is recorded rather than hidden: 26 frames, average `35.328 ms`, maximum `116.6 ms`, compile `2,974.3 ms`. That is a software-only renderer and is not the live hardware result. Live Chrome and the 390×844 run meet the target, so the performance gate is PASS.

Evidence:

- `admin-pencil-desktop.png` SHA-256 `20d81c81b64708d2996d6d40189d6ee9b899e02473e79b9826b24d3207d11393`
- `homebase-morph-midpoint.png` SHA-256 `d9b623cd1ad67ad4e446d5eb4de719b6b78e26214053213aa92012bc517b7274`
- `homebase-cinematic.png` SHA-256 `4ed792aed3de904d4930700ac5980cd35b7584bfe135ae124483c85abd556c2e`
- `admin-mobile-390x844.png` SHA-256 `ba684b3fb29adf4fcf1e98ed32c757fbd18c9be480896e96e7399f90272175fe`
- `browser-qa-results.json` SHA-256 `491eb528621fd7032fa4248235660fda3a23b5e49a362bfaed156f2960ae5829`

## Production state

- Live URL: `https://missionmedinstitute.com/hub/#dashboard`.
- Administrator canary: LIVE for HomeBase and all eight exact pairs.
- Student-wide morph activation: OFF. The admin-only condition is server-resolved and enforced again in the client.
- Dashboard options readback: V2 enabled `1`, default `matrix2`, Force Classic `0`, invite `1`, no `mmed_dashboard_featured_apps` override option.
- Production/public versioned JS SHA-256: `525797f4c63ee5287be21b88da425c7a02872857a937ffc32ca1fe381d2652c0`.
- Production/public versioned CSS SHA-256: `03429c46625dec8b9c041ae28a4057a0285c56cef1315bae971975f1648f892f`.
- Public delivery readback: both versioned assets and all sixteen endpoint PNGs match local source exactly.

## Rollback

Verified preimage/absence records:

- `/www/theresidencyacademy_209/private/matrix-dashboard-backups/MX-DASH-6010B/20260903T224659Z`
  - prior Dashboard JS `f984adcebff66ca320f9c75b0c405eb55e00f849de4195fad5067d6ccb5115c1`
  - prior Dashboard CSS `436ca0e0b8dc9cddc1b13b27b84c3db9c00ca91499c38dcd0852151c5d4e7a31`
  - additive locked-art absence marker
- `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/MX-DASH-6010B/20260903T230240Z`
  - prior `class-mmed-student-os.php` `b6565d9f0bff0b7b4ae21027818668bb632e8b90d80c992bb784840b1dd15406`
- `/www/theresidencyacademy_209/private/matrix-dashboard-backups/MX-DASH-6010B/20260903T230155Z-cache-bust`
  - immutable `6010b` asset absence marker

File-level restore rehearsal copied the three preimages out of private storage and re-verified all three expected hashes. Additive removal markers were read back. Result: `FULL_ROLLBACK_REHEARSAL_PASS`. No production rollback was executed because the canary passed.

## Founder review

1. Open `https://missionmedinstitute.com/hub/#dashboard` while signed in as Brian/administrator.
2. Hover any Featured Apps card, or use Tab to focus it. HomeBase and all eight cards are active in the canary.
3. Move away/blur to see the transition reverse to pencil.
4. The current Chrome/macOS profile reports Reduce Motion enabled, so it intentionally shows the accessible 200 ms dissolve. To judge the full WebGL shader, temporarily turn off macOS **System Settings → Accessibility → Display → Reduce motion**, then reload the Dashboard. No MissionMed setting needs to change.
5. Reply only `APPROVE FOR STUDENTS` or `NEEDS TUNING`.

On `APPROVE FOR STUDENTS`, continue in this same task with student activation, live true-student QA, the runtime-lock update, final Lease V2 closeout, and the final handoff. Do not activate students before that explicit approval.

READY FOR FOUNDER VISUAL APPROVAL
