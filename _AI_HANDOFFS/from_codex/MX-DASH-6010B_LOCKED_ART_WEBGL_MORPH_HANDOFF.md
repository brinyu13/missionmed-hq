# MX-DASH-6010B — Locked-Art WebGL Morph Handoff

Date: 2026-09-03  
Terminal state: `READY FOR FOUNDER VISUAL APPROVAL — SAME-COMPOSITION MORPH POLISH COMPLETE`
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
- Same-composition polish implementation commit: `9bd0cbc304013bcf8f9d855991f5604aee731d97`.
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

## Founder Steer — Same-Composition AAA Morph Polish

### Controlling steer and custody

Brian's active-task `NEEDS TUNING` steer applies to this same
`MX-DASH-6010B` task, thread, worktree, branch, and administrator canary.
It explicitly supersedes the earlier progress-0 requirement for exact pixels
from the historical pencil crop when those pixels prevent geometric
registration. The production idle endpoint may now be a deterministic,
non-generative pencil rendering of the exact cinematic crop. The cinematic
endpoint remains the exact approved cinematic crop.

No new ticket or branch was created. Student-wide activation remains OFF.
The three original approved source boards, the sixteen historical exact crops,
and `crop-manifest.json` remain present and unchanged. Their controlling
source hashes remain:

- cinematic board: `7630178b303241bc23d61005581d1b7673e18809dd3715c8db55bf123d623382`;
- pencil style board: `d1a0e5bb4195a0fe0959b9537e4671b36e6ca684b34c843bb2d9bcfc8204a2a8`;
- motion-direction board: `dbcb2d193baa409b7b48000eb24e1bfc06d51af694330c1082abb35d1a7941f8`; and
- historical crop/UV manifest: `f8e99e39ab29a7b6bfff629bfd3edc8525aea034be60dc4abd3dc564b85d88bf`.

No AI-generated or AI-regenerated image asset was used.

### Deterministic registered-pencil derivation

The standard-library-only build helper
`tests/mx-dash-6010b/locked_art_tool.py` now supplies `derive` and
`verify-derived`. Derivation version
`mx-dash-6010b-registered-graphite-v5` uses BT.709 luminance,
deterministic q02/q98 shadow lift, multi-scale dark-line extraction, six-band
tonal graphite, restrained directional hatching, and pencil-board-calibrated
ivory paper/grain. The measured paper tone is `[233,229,223]`; deterministic
grain amplitude is `2`. The approved pencil board is used only as the
paper/hatch style source and keeps its exact SHA-256 above.

There is no resampling or coordinate transform between a derived pencil image
and its cinematic image. Each pair has the same decoded width and height,
subject bounds, scale, position, perspective, and framing by construction.
`REGISTERED_PENCIL_VERIFY_PASS cards=8 identity-registered=8`.

Machine-readable derivation manifest:
`assets/dashboard-v2/locked-art/derived-pencil-manifest.json`,
SHA-256 `d2c3a0003acb12c857aee0de82c8bf47a28cd68246d82410a796b789d5df91de`.

| Card | Dimensions | Derived pencil PNG SHA-256 | Preserved cinematic PNG SHA-256 |
|---|---:|---|---|
| HomeBase | `341x385` | `fc15a7b292d6095ffeb35c2d8a8e774c0905ca10622fd86a236963ed3bb7c05b` | `0961c33d17e95ffc53ab26fbd0228ac261774f17ca4c6b7a431487d1cea72e16` |
| Calendar | `346x385` | `104535407a6022f53271526646afe995ffe22f2a5a0a8b6966d28eb3b8022292` | `d0e4dd8febe578e51bf86f748a6359fa681f769a96c5f017006a6c4f7df6aca3` |
| Scheduler | `337x385` | `4428f376c9ec6e4af3902871ba9b846d127a3e6d43a246d465a43f80caf858b5` | `1d74993b50b8efb5b8cc04bf5ae0abcad8c2c5bbc26beaa9e84efa60986be1fc` |
| StoryForge | `349x385` | `6120bdd9818ff8fab2d4bb2d47f67d4603392067d858935a2c632f9b7d821c40` | `df53e21cf51f450d81d8a726408b5a7be53557a4905937105c482b21fcce532d` |
| IV Prep On-Call | `341x375` | `ac7cccb4e5ee3b6bf5e9ae8cf06c585afe22957b862a885a108f4071be62077e` | `6204776031ccc7b542c1245f528c1a9646f5df342acf929af3aafb60c563c33a` |
| RISE | `346x375` | `2f17cbf7dfaa298b140b665712b74d8fddaf88da4a12477fab6ea4e959897ca3` | `ab5c393eb9b5938fb5ff6b42a0f21d0cfa84549fb95942aab2b2fdb92e898a6c` |
| RankList IQ | `337x375` | `34fc404b35de4b62d56c48df34eacbcd617820cf1fcf25c453ec6af8216287dc` | `544f5a98c32f2d4c4f8ada517b6102434189a9246b1d0d73e63bb35fb6943d0d` |
| LOR Studio | `349x375` | `a6f9c7b5704f9d1681a5b22f3a0ed52e95b3b825cec9fa4625457242600597ac` | `aa7ebd37541900b2fec139c73d028e0986684d8c90a08e991db4b58ee1b24ff9` |

### Root cause and motion polish

The previous smash-cut impression had three causes, so the prior
reduced-motion diagnosis was PARTIAL:

1. Brian's real Chrome/macOS profile reports
   `prefers-reduced-motion: reduce`, intentionally selecting the 200 ms
   fallback rather than WebGL.
2. The two historical boards used independently composed scenes, so the
   subject jumped even when the shader interpolated correctly.
3. The prior diagonal threshold and displacement read as a wipe and made the
   remaining alignment error more visible.

The tuned 960 ms shader removes UV displacement and the dominant diagonal
wipe. It uses normalized-UV four-octave value-noise regions, cubic progress,
gamma-correct material mixing, persistent graphite contours, a restrained
warm line-activation interval, progressive shadow/color materialization, and
a short contrast settle. Exact endpoint early returns guarantee the registered
pencil at 0 and exact cinematic pixels at 1. Initial canvas render is
synchronous, eliminating black/stale-frame flash. Reverse uses the same
timeline from current progress.

An administrator-only review parameter,
`mx_dash_6010b_motion=full`, bypasses reduced motion only when the
server-resolved client is already an administrator on the active Matrix 2.0
canary. Normal production behavior still honors
`prefers-reduced-motion: reduce`; non-admin and anonymous requests do not
receive the immutable polish asset, and the client also fails closed unless
`experience === "matrix2"` and `is_admin === true`.

Founder full-motion URL:
`https://missionmedinstitute.com/hub/?mx_dash_6010b_motion=full#dashboard`

Ordinary accessibility-respecting URL:
`https://missionmedinstitute.com/hub/#dashboard`

### Typography polish

The exact cinematic image file is unchanged. Localized top and bottom scrims
cover the baked-copy zones without covering central photographic subjects.
Canonical, semantic DOM copy supplies the app name, perspective-aware
subtitle, and support line. Scrim widths are tuned per card.

At the live desktop grid, every title measured `26.356px`, weight `900`,
and `rgb(255,255,255)`; subtitles measured white and support copy
`rgb(248,251,255)`. Tested grid/mobile titles remain at least 23 px.
The all-eight fit check requires no wrap, no overflow, and no clipping.
Card semantics and the pre-existing accessible button label remain intact.

### Intermediate evidence and QA

The deterministic harness captures all eight cards at
`0.00/0.20/0.40/0.60/0.80/1.00`. Each card produced six distinct pixel
hashes. The 48 source frames are in
`evidence/progress-frames/`.

- all-eight contact sheet SHA-256:
  `95b10a111ff66f52a5a697851500c23a654242d06b029babba3243c91f9e225c`;
- HomeBase forward/reverse WebM: 2.133 seconds, 64 captured frames,
  289,230 bytes, SHA-256
  `a181570cb1bc54380fdf96e3240c55c178420af8e9a97e9cadba2f35c6b03851`;
- tuned idle screenshot SHA-256:
  `0b885c5fde8ae46f51dae4271b4099e650f49e4d9341a6df63c134b4d4b25d69`;
- tuned midpoint screenshot SHA-256:
  `c561724eb15f62bb3ca0cd0112dbec79968bc1cc4db0d282e32250a780cd62c7`;
- tuned cinematic screenshot SHA-256:
  `6f8f4e202931977061c4d36e0e27e926053c5bc05087f92952d4a67cb1b6df33`;
- browser matrix JSON SHA-256:
  `eb869c47626c08eac0cf9ff25d143e4b05c2abaa11a32e6c19ecdc5dabb78bf3`.

The instrumented local browser matrix finished with `failures: []` and PASS
for all endpoints, genuine intermediate states, identity registration,
typography/contrast, all eight, forward/reverse, keyboard, reduced motion,
Founder preview, WebGL fallback, stress/route cleanup, launch/detail/editor,
image and copy-only overrides, true-student unchanged, Classic, exact
`390x844`, and real-time video.

The cold SwiftShader reference averaged `46.11 ms` with a
`3,206 ms` cold compile; it is explicitly software/nonrepresentative.
Stress exercised 130 transitions and 542 frames, maximum one context,
60/60 resource sets released, and zero failures. Route cleanup recorded
61/61 resource sets and one created/one disposed context. Exact `390x844`
measured document width 390, card left 16/right 351.391/width 335.391,
`16.958 ms` average (about 59 fps), `33.3 ms` max, maximum one context,
1/1 resource sets released, zero failures, and `83.3 ms` compile.

Live authenticated Chrome on Brian's actual reduced-motion profile proved:

- the full-motion URL advanced Scheduler
  `0.026 -> 0.173 -> 0.521 -> 1.000` over the 960 ms path with exactly
  one live canvas and no fallback;
- live reverse advanced
  `0.748 -> 0.557 -> 0.201 -> 0.000` and released the canvas;
- a live HomeBase DOM-progress sample changed every `8.57 ms` on average
  with a `16 ms` maximum during the sampled motion segment (about 117 Hz);
- all eight live cards referenced `pencil-registered/`, reported identical
  pencil/cinematic natural dimensions, started WebGL without a fallback, and
  never exceeded one canvas;
- the ordinary URL on the same profile produced
  `data-morph-fallback="reduced-motion"`, progress 1, and zero canvases;
- the immutable `.6010b-polish.js` asset was present for the administrator;
  anonymous full-motion requests received neither that asset nor registered
  pencil canary markup; and
- the only observed console errors remain the pre-existing unrelated
  WordPress `@wordpress/api-fetch` unstable-API error recorded before this
  mission; no Dashboard/morph error occurred.

The prior authenticated live exact-`390x844` proof remains preserved in this
handoff; the tuned code passed the same exact local viewport gate, and every
deployed tuned source/media hash matched that tested commit.

### Production and rollback

Same administrator canary: LIVE. Student-wide activation: OFF.

- source/remote tuning commit:
  `9bd0cbc304013bcf8f9d855991f5604aee731d97`;
- production/public polish JS:
  `4fdcf13828e3eca0b5e6f7d3fae169e8aee0ab42589dfb01238675681ff6cbec`;
- production/public polish CSS:
  `d5bac8d5fbdbe67369d2ff54b50def51dca4a7240513ecdd6af0cf94310e46c7`;
- production shared enqueue seam:
  `17c2a89f64093468d4ee2424d1b6720c1af39adaba7cc9b4f2d76cfb212ac130`;
- public manifest and all eight derived PNGs matched local source byte for
  byte.

The fresh private preimage/absence package is:
`/www/theresidencyacademy_209/private/matrix-dashboard-backups/MX-DASH-6010B/20260904T025104Z-same-composition-polish`.
Its five predecessor files pass `sha256sum -c`; its four-line absence ledger
names the new polish JS/CSS, derived manifest, and registered-pencil directory.
The runtime guard separately backed up and deployed the three protected files:
`/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/MX-DASH-6010B/20260904T025134Z`.
The guarded deploy verified origin and public hashes. Rollback is the exact
three-file restore plus deletion of only the four additive mission-owned
targets named in the absence ledger. No rollback was executed because every
canary gate passed. Result: `ROLLBACK_PREIMAGE_AND_ABSENCE_LEDGER_PASS`.

The Matrix runtime-lock manifest remains unchanged at this Founder-review
stage. The established task defers any student activation and final runtime
lock update until a fresh explicit `APPROVE FOR STUDENTS`.

READY FOR FOUNDER VISUAL APPROVAL — SAME-COMPOSITION MORPH POLISH COMPLETE

## Founder Visual Fail — True-Morph Recovery

Founder verdict on `mx-dash-6010b-registered-graphite-v5`: **NEEDS TUNING — VISUAL FAIL**. The prior polish remains technical evidence only. It is not an approved pencil endpoint, and its hover is not an accepted true morph.

### Required pencil-endpoint bakeoff

The locked cinematic crops remained the exact geometry source and the approved pencil board remained the visual-style authority. A deterministic, source-derived bakeoff was produced for HomeBase and StoryForge only:

- A: clean architectural graphite;
- B: softer hand-rendered pencil;
- C: hybrid blueprint/concept sketch;
- comparison columns: approved pencil / A / B / C / exact cinematic.

Evidence:

- contact sheet: `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/true-morph-recovery/bakeoff/variant-contact-sheet.png`, SHA-256 `40d895e9551ecf8d9880f5362338a447c44e9f29c7a6bf53f1a0916247f9f02e`;
- metrics: `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/true-morph-recovery/bakeoff/variant-metrics.json`, SHA-256 `d79db8ba717726a5a4a444511755cf9170e1fbea0a3784dae24b2a5046935d9d`;
- HomeBase A/B/C SHA-256: `dac62eda803a0aea284972eec1875c196d1a487b271636ac43675eb66d154f2e`, `9f151efaa9068ff43bfba1f6faf1e1ebc19c6b9debb01e5f2c4988a33e7dd247`, `d974b4e22d9d21eea4000e7024d0dc6cdc16836b4bdbb493b432713be890f554`;
- StoryForge A/B/C SHA-256: `5fd1cd73cf6fab617a6bc2d0bd7d3103d07ee3f24a1c1c991f1c46fd602b6284`, `e6dcf755e23ef22713af4586a894ba86229185bb9d1baff9ac5ce8c8f225de44`, `7aa67ad4af258747578bbef5b2e96f424dcacf0a7abee41f496bc7bce2cada36`.

All three variants were independently visually rejected. A and B remain washed-out, filter-like edge treatments. C improves registration and line separation but is still a mechanical wireframe/technical trace: monoline contours, arbitrary diagonal construction marks, inadequate graphite mass, and lost semantic form (especially the HomeBase chair). StoryForge remains recognizable but cluttered. No variant matches the approved hand-rendered pencil board, so no renderer was selected and none was promoted to the eight-card implementation.

Representative quantitative differences support but do not replace that visual verdict. Approved StoryForge has edge density `0.4710` and `13.703%` graphite pixels at luma <=110; candidate C has `0.3105` and `2.868%`. Approved HomeBase has edge density `0.4409` and median luma `214`; candidate C has `0.3077` and median `223`.

### True-morph, typography, and performance gates

The true-morph implementation did not proceed past the failed endpoint gate. Therefore continuous style interpolation, endpoint-neutral coincident typography, cinematic title readability, the 0–100% morph contact sheet, new forward/reverse videos, exact `390x844` recovery validation, and the required real-time 60 fps recovery measurement are not complete.

Screening of the existing technical video is explicitly a failing baseline, not recovery evidence. `_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/homebase-full-motion-forward-reverse.webm` is 1200x900 at 30 fps with 64 decoded frames. Its card-region normalized RGB mean-absolute-difference has median `0.02730675`, maximum `0.16089385`, and maximum/median `5.89209x`; this fails the `<3x` perceptual smash-cut guardrail and is not the requested 60 fps capture.

The existing v5 material ramp also concentrates approximately `73` percentage points of the material change between progress `0.4` and `0.6`. Its pencil typography is baked/outlined while the cinematic DOM copy uses hard near-black bars, so typography does not read as a continuous part of the same image.

### Custody, production, and disposition

- cinematic source board SHA-256 remains `7630178b303241bc23d61005581d1b7673e18809dd3715c8db55bf123d623382`;
- approved pencil board SHA-256 remains `d1a0e5bb4195a0fe0959b9537e4671b36e6ca684b34c843bb2d9bcfc8204a2a8`;
- approved motion reference SHA-256 remains `dbcb2d193baa409b7b48000eb24e1bfc06d51af694330c1082abb35d1a7941f8`;
- AI-regenerated assets: **NO**;
- student-wide activation: **OFF**;
- no production asset, shared enqueue seam, runtime lock, or student path was changed during this recovery attempt;
- the administrator canary remains live on the previously deployed, Founder-rejected v5 assets; no failed A/B/C candidate was surfaced;
- the existing verified rollback preimage and absence ledger remain intact and unexercised.

Further deterministic image-filter parameter tuning is not expected to meet the approved-board standard. Recovery now requires a materially different deterministic semantic/manual mask workflow or separately authorized professional redraw/source art before true-morph work can resume.

RESULT: PARTIAL — VISUAL ACCEPTANCE NOT MET

## Founder-Approved Source Art Installation + True Morph

### Scope, authority, and source custody

This recovery remained on the same `MX-DASH-6010B` task, thread, worktree,
branch, and administrator-only Matrix 2 canary. No new ticket or branch was
created. Student-wide activation remains **OFF**.

The controlling source package was readable and passed archive-integrity,
safe-path, byte-count, dimension, and SHA-256 validation before use:

- package: `MX-DASH-6010B_APPROVED_SOURCE_ART.zip`;
- package SHA-256: `ffe7491b6bb0300843f00e6f0ea0bafe85078d072944a084ee2eeede09fa88a8`;
- package bytes: `32907378`;
- package `MANIFEST.json` SHA-256: `882b9824bc6ddf1c99dbbf45ddcf1f81f3ed0d93a8d0c49ac2b1e993d02f8b75`;
- package `README.md` SHA-256: `1ac4ecf6dafc4eb6feb4f03f1f5e5361e5fd582eae4163b2ee31bc9a3a708c9e`;
- controlling install-prompt SHA-256: `f916b3e336b580771b6a806a0670b9ea5f5b750781e190152bce771ec924c8a0`;
- AI-regenerated assets during this Codex run: **NO**.

All sixteen production endpoints are exact source-package bytes:

| App | Approved pencil SHA-256 | Approved cinematic SHA-256 |
|---|---|---|
| HomeBase | `96b40f615513db9c6f6224b1f12639482347f16697f0b6577a2aa79b1e4b4d32` | `f2a58f93735c60c42fb40745a50c01c776c8cbf08ba6ea0cdba4d3a4d7008144` |
| Calendar | `68bcf94581fef8cef13e25dc6ddcac14fb2f6cd28edfb18ec958d4dac021b10d` | `b041bf4fcb86f15605de63151c380d86a04cb9ad1a9f126fa0a9b3a67e233b1a` |
| Scheduler | `994366d74cce98084314febc8bf4a28e7e19d832c2f63edda3a1f0137aee3e35` | `bb35e07228024cd88a5b6c047e510a84e7347b505e6e9c9732ae541308617c44` |
| StoryForge | `7a9b75a2dc5699adf4de055dfe7b170021ce7679108c2883f4bfc249936c9869` | `08a8ac3a6e647c69752142c9e3628853acbd605760844711acdf59b2333d0149` |
| IV Prep On-Call | `61d6eb3c84654f1f0a7ba3452053d5f72871aa1879f0573a6b08dd6388ad7b7c` | `9013ad791ce8c004cfe630c26833c4482438891bc2218865ee97ff5604a4d8ab` |
| RISE | `3cb0ec15440f2461086d15b3e57c737e59595b589a553cbc59dbd821fb458e5e` | `0991518645c5b124f78f13194ae33ee0e8e1db5e89dd2574602d15437dbc972b` |
| RankList IQ | `67a6d4e745845987537cda055cc1be8e4cb520e38169ee74b15fc8c397447dcc` | `cedf356daad32580fbdb71c27b6e8d305e7c8f6b34dcc36e71646479330072f6` |
| LOR Studio | `16c5105ddec4e0a6d6e3f37796ac0f732bff7c8d1c0cdf825951866aa5a02f10` | `4dec9cb8cd3531385b918992e047d2a07b0df6f858257ba126a6d3a2dc69a073` |

Historical/rejected endpoints remain intact. The new immutable custody root is
`wp-content/plugins/missionmed-hub/assets/dashboard-v2/locked-art/founder-approved/`.
It contains the exact package README, source manifest, eight `pencil/` files,
eight `cinematic/` files, `manifest-v1.json`, and
`registration-manifest-v1.json`. Installed manifest SHA-256 is
`7f8f292b42f50688109b39554e90bd16300108c4fe72d59b4edd6e2ba43375dd`;
registration-manifest SHA-256 is
`75edf536bacbba8380f657bdc6872dc773bd2a419f263598e750f593ad0b0831`.

### Registration and correspondence

All pairs render on a common `1190x1322` (`595/661`) canvas. Registration uses
a bounded similarity/homography initialization over the cinematic cover crop,
then a wide multi-region material reveal. Dense optical flow and destructive
mesh fitting were rejected because the generated cross-modal scenes contain
real local topology differences. Those differences are revealed as material;
they are not force-warped. The registration manifest explicitly converts its
top-left diagnostic Y shifts to bottom-left WebGL UV coordinates.

HomeBase is the best-aligned pair: NCC `0.6008`, shift `(+2, 0)` px at the
`540x600` diagnostic canvas. Its frame, monitor bank, chair, and skyline stay
visually anchored through the transition. Per-card NCC and diagnostic shifts:

| App | Edge NCC | Shift px |
|---|---:|---:|
| HomeBase | `0.6008` | `(+2, 0)` |
| Calendar | `0.2543` | `(+4, -6)` |
| Scheduler | `0.3491` | `(+6, -5)` |
| StoryForge | `0.4515` | `(+4, -3)` |
| IV Prep On-Call | `0.4220` | `(+2, -18)` |
| RISE | `0.3993` | `(+10, -16)` |
| RankList IQ | `0.4456` | `(+15, -13)` |
| LOR Studio | `0.4032` | `(+4, -18)` |

### True-morph runtime

The new immutable runtime assets are:

- `mmed-dashboard-v2.6010b-true-morph.js`, SHA-256
  `7e9c2e57ae8a4d3a3fe54df306fb8eba1223496b12540153c3b7c4b39f8284d2`;
- `mmed-dashboard-v2.6010b-true-morph.css`, SHA-256
  `e72f26011f5b3bb87aa1250d553e68dd3311f882d946c6097f3c2efcf6edf9cf`;
- administrator enqueue seam `class-mmed-student-os.php`, SHA-256
  `248c12d1618fd08db1686297b355252a4f5dae36858b9f39945ea149b3620d76`.

The shader has exact endpoint bypasses, bounded correspondence UVs,
gamma-correct interpolation, four wide independently phased reveal regions,
graphite edge retention, progressive saturation/material resolution, and a
short contrast settle. Its `960 ms` timeline reverses from current progress.
Perceptual pacing reduces concentrated frame change without introducing a
wipe. Initial rendering is synchronous, there is no black/stale first frame,
only one WebGL2 context exists, and transition textures are released.

QA found and corrected two cancellation races: endpoint leave now clears a
canceled animation-frame handle so `is-running` cannot strand, and release is
idempotent while canceling any pending frame so rapid traversal cannot dispose
textures twice. Keyboard focus listeners are pointer-capability independent,
and route disposal releases the shared context.

Default cards show only the source artwork's integrated typography; there is
no duplicate visible DOM title/subtitle over the pencil endpoint. Exact source
art remains unoverlaid. A copy-only admin override uses a small feathered
bottom gradient with semantic DOM copy, not a hard rectangle. Custom-image
overrides use the safe static renderer. Cinematic typography remains legible
and visually integrated, and accessible labels remain on every card.

### Real-time visual evidence and acceptance

Final evidence root:
`_AI_HANDOFFS/from_codex/MX-DASH-6010B/evidence/founder-approved-true-morph/`.
Every required `0/10/20/30/40/50/60/70/80/90/100%` contact sheet has eleven
distinct, visually inspected frames with no diagonal wipe, cut, black frame,
or abrupt global reveal:

- HomeBase: `progress-final-verified/homebase-contact-sheet.png`, SHA-256
  `aa8570d298c4b24574b471dca4246c94012e1fa70f6ca2e3b499794053b08c48`;
- StoryForge: `progress-final-verified/storyforge-contact-sheet.png`, SHA-256
  `0055bae78d65e26491e1b294b7dd20c542866bc857ac6fe79066a29fdf6038bb`;
- RISE: `progress-final-verified/rise-contact-sheet.png`, SHA-256
  `49aa13beacdb89247d4774691b5597992c7abb7b4366c57ac4e6c052a37c76da`;
- Scheduler: `progress-final-verified/scheduler-contact-sheet.png`, SHA-256
  `b0f0e854159f6c1fc5e94582f90b9b0fce65d80980f3c139073d0992c5e11ed9`.

Final forward/reverse and rapid-traversal videos:

- HomeBase: `video/final-v3/homebase-hover-in-out.webm`, SHA-256
  `0c36fc62d1a0d1f5df412cb2ef6f2ad8b935f6ed43b8985794557b5f39a707c4`;
- StoryForge: `video/final-v3/storyforge-hover-in-out.webm`, SHA-256
  `63ceb69f2343360fb2a3aad00d20e40ac19950d1788666b7113a6c35624fed74`;
- RISE: `video/final-v3/rise-hover-in-out.webm`, SHA-256
  `b092ce4745861f3024c0712d9f23e05acb488e4a6345db2cce1385a85c002f03`;
- all-eight rapid traversal: `video/final-v3/rapid-all-eight.webm`, SHA-256
  `30a7fabe70f2529779194f9ce3a3dc130847a79086d250843a3dfc166e680422`.

The final HomeBase frame-delta report is
`frame-delta-metrics-final-v3.json`, SHA-256
`06bfb2bb0d5b08d381c9a6768b6d62bf7e9df45670054380326f62a8e629ee18`.
Across 55 input/51 nontrivial frames, median mean-absolute RGB delta is
`6.928185`, maximum is `19.200523`, and max/median is `2.771363946x`:
**PASS** against the `<3x` hard gate. The peak frame changes `88.6798%` of
pixels but remains a broad material transition, not a discrete cut.

The CDP screencast recorder itself delivered approximately `14-17 fps`; that
is capture throughput, not page rendering performance. Local rapid stress
measured `16.67618 ms` average frame interval (about `59.97 fps`), maximum one
context, `32/32` resource sets disposed, and zero failures. Authenticated live
Chrome measured the reverse animation across 124 rAF intervals at `8.46803 ms`
average (about `118.09 fps`), `8.3 ms` median, and `16.7 ms` maximum. It ended
at progress `0.0000`, then released its canvas with zero morph failures.

The local browser matrix also passed keyboard forward/reverse, reduced-motion
short dissolve, WebGL2-unavailable CSS fallback, route cleanup, image override,
copy-only override, detail/launch, student-admin-zero, Classic, and exact
`390x844`. Mobile measured document width `390`, card left `16`, right
`351.390625`, width `335.390625`, with no horizontal overflow.

### Production canary and rollback

Implementation/source commit `491130420f928e11c58576a79a35fe0795049159`
is pushed and verified at the branch remote. The guarded production update
backed up the shared PHP preimage, deployed the exact tested enqueue seam, and
verified origin readback. All eighteen public artifacts (runtime JS/CSS plus
sixteen endpoints) returned HTTP 200 and matched local SHA-256. An anonymous
full-motion request received neither the true-morph asset nor Founder-approved
canary markup: `ANONYMOUS_CANARY_OFF_PASS`.

Authenticated Chrome on the production administrator account loaded the
`.6010b-true-morph.js` asset and all sixteen Founder-approved image URLs. The
live HomeBase card visibly moved through an intermediate state to progress
`1.0000`, displayed the exact cinematic endpoint, reversed to `0.0000`, and
released its canvas. No morph failure was recorded. The full-motion review URL
is:
`https://missionmedinstitute.com/member-dashboard/?mx_dash_6010b_motion=full#dashboard`.
The equivalent `/hub/` route remains valid. The preview is **LIVE** for the
administrator canary only; student-wide activation remains **OFF**.

Fresh rejected-v5 rollback package:
`/www/theresidencyacademy_209/private/matrix-dashboard-backups/MX-DASH-6010B/20260904T125709Z-founder-approved-true-morph`.
Protected runtime-guard backup:
`/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/MX-DASH-6010B/20260904T130750Z`.
The predeploy checksum file and additive-target absence ledger pass. An
isolated rehearsal copied the rejected-v5 JS (`4fdcf138...`), CSS
(`d5bac8d5...`), and prior enqueue seam (`17c2a89f...`) into
`rollback-rehearsal/` and verified their full expected SHA-256 values. It did
not restore or delete any live file. Exact rollback is therefore verified;
production and student state were unaffected.

Final disposition: **COMPLETE** for Founder visual review. This does not grant
student activation. Brian must still explicitly issue `APPROVE FOR STUDENTS`.
