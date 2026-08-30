# Y1-Y2-CAM-V6-3528B — CLAUDE CODE HANDOFF
AAA Game-Experience Visual Rebuild · Claude Code (Fable 5) · 2026-08-29

## What this is
A ground-up visual/interaction rebuild of the IV Prep On-Call game-shell prototype to
flagship game-menu standards, adapting the Founder's Fortnite reference compositions
(full-bleed world lobby + bottom mode-card row, portrait mode select, detail-panel +
moments-track debrief, archive card wall) to interview prep — original MissionMed
identity, zero Epic/Fortnite IP. The approved scientific cockpit identity (Founder
scanners, piano, corridors, hold-last-valid honesty, one-whisper coaching) is preserved
and recomposed around readable XL information.

**Everything on screen is deterministic simulation and is labeled as such**
(persistent top badge: `3528B VISUAL PROTOTYPE · SIMULATED DATA · NOT PRODUCTION`).
Nothing here claims the real analytics engine was changed. It was not touched.

## Launch
```bash
python3 "/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/_AI_HANDOFFS/from_claude_code/Y1-Y2-CAM-V6-3528B_AAA_GAME_EXPERIENCE_VISUAL_REBUILD/PROTOTYPE/serve.py" 4174
```
Then open http://localhost:4174/index.html in Chrome.
(`serve.py` sends `Cache-Control: no-store` so iterative edits always load. A
`.claude/launch.json` config `ivoc-3528b` exists for the Claude Code browser pane.
Opening `index.html` via `file://` also works, minus the Google-font fetch.)

Dev/QA query params (prototype only, all off by default):
- `?dev=1` + `#/live` — direct room entry with a seeded draft (bypasses the recovery
  redirect that normally fires when a live session is refreshed).
- `&ff=40` — deterministic fast-forward of the sim engine for screenshots.
- `&tuner=pace` — opens an instrument's corridor tuner popover on load.

## Files (all NEW, all inside this handoff folder)
```
PROTOTYPE/
  index.html              app entry: fonts, css, env canvas, world layer, nav rail mount
  serve.py                no-store dev server (launch above)
  styles/tokens.css       design tokens, type tiers, focus ring, reduced-motion kill
  styles/shell.css        env/world layers, nav rail, Back/Next bar, chips/buttons,
                          toggles, toasts, coaching whisper, modal, proto badge
  styles/menus.css        lobby cards, mode select, question grid/preview, setup,
                          ready stage + countdown, recovery tiles
  styles/cockpit.css      live room grid, instrument family, scan wells, corridor
                          bands, piano, rec dock, vocal-variation deck, responsive tiers
  styles/post.css         results (plates/counters/moments/actions), library posters,
                          progress, settings, mentor
  app/main.mjs            state (ivoc.ui.v2 / ivoc.setupDraft.v2), hash router with
                          per-screen env themes + rail auto-collapse, spatial keyboard
                          focus (arrows/Enter/Esc), toasts, whisper, confirm modal
  app/env.mjs             EnvironmentLayer: drifting depth glows + pointer-parallax
                          particles + light sweep, ≤30 fps, pauses hidden, reduced-motion
                          static, themed per section, disabled in the live room
  app/art.mjs             ORIGINAL semantic SVG scene art (8 distinct compositions in
                          one visual universe) — see PROTOTYPE/assets/ART_MANIFEST.json
  app/data.mjs            question corpus, sessions, calibration, deterministic
                          seeded SimEngine (LCG — no Math.random), sim camera painter
  app/menus.mjs           home lobby, practice mode select, question select, setup,
                          ready (gold position guide + countdown), recovery
  app/live.mjs            recomposed live cockpit + processing interstitial
  app/post.mjs            results debrief, library, progress, settings, mentor
  assets/ART_MANIFEST.json          art provenance/licensing per doc-07
  assets/arena-world-day.jpg        Founder Arena key art (lobby world)
  assets/arena-world-sunset.jpg     Founder Arena key art (reserved)
  assets/founder-face-scanner.png   verbatim copy — Founder instrument art
  assets/founder-body-scanner.png   verbatim copy — Founder instrument art
EVIDENCE/*.png            accepted checkpoint captures (see below)
```
Also touched: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/.claude/launch.json`
(added the two dev-server configs). **Nothing else in the worktree was modified. The real
runtime `ivprep-v6/public/live-analytics/` is untouched.**

## Accepted browser checkpoints
| Checkpoint | Evidence | Status |
|---|---|---|
| A — game shell: lobby world + semantic cards, mode select, question library | EVIDENCE/cpA_home.png, cpA_practice.png, cpA_questions.png | PASS (surfaced to Founder mid-build) |
| B — voice instruments: shared geometry, XL 1–10, verbs, corridor bands, piano, ⚙ tuner popover | EVIDENCE/cpBCD_live_answering.png, cpB_tuner.png | PASS |
| C — head/body: Founder scanners in glow wells, XL counters (smiles/nods/gestures), hands state, activity glow | EVIDENCE/cpBCD_live_answering.png | PASS |
| D — recording dock + vocal variation: dedicated dock (never over the chart), READY→REC→PAUSED→RESUMING→FINALIZING→SAVED exercised live; deck with readable controls, silence visible, now-anchored axis | pane run (record→pause→resume→stop→saved→results) + EVIDENCE captures | PASS |
| E — results + responsive: post-match debrief; six-viewport sweep | EVIDENCE/cpE_results.png, live_1920x1080.png, live2_1440x900.png, live2_1180x760.png | PASS |

## Responsive QA result (doc-08 set)
Live room verified at 1920×1080 · 1626×968 · 1512×982 · 1440×900 · 1280×800 · 1180×760:
no page scroll, video 16:9 locked (measured AR 1.778), tier collapse in order
(DETAIL → MEDIUM; XL/LARGE never shrink). DOM probe at 1626×968:
score numerals 56px (62px ≥1500w×940h), counters 44–46px (≥36px at collapsed tiers),
deck controls 38px tall, no text under 11px in the room, video ≈53% of viewport width
with the rail auto-collapsed. Menu screens fluid across the same set.

## Interaction model delivered
- Controller grammar: arrow-key spatial focus, Enter activates, Esc = back / pause menu
  (in-room: RESUME / END & SAVE), focus ring + white-frame card focus everywhere.
- Left nav rail: expanded/collapsible in the menu flow only. Per the Founder ROOM-IMMERSION
  addendum (2026-08-29) the rail is **completely absent for the entire interview-room flow**:
  READY → countdown → LIVE (incl. PAUSED and INTERVIEW-ONLY) → FINISH/PROCESSING. It returns
  on RESULTS. The room is a dedicated full-screen session environment; exits are FINISH and
  the Esc pause menu. The recovered width feeds the 16:9 stage, wider instrument rails
  (306/352px) and larger Founder scanner wells (126/158px).
- Zero required typing (only optional session-title rename).
- Back/Next footer on every multi-step screen; refresh restores state; a live-session
  refresh lands on the RECOVERY screen (save-partial / resume-setup / discard).
- Recording dock states + top-bar REC mirror + red/amber stage border; analytics keep
  measuring while paused; NOT-RECORDING is also always visible.
- Live coaching: per-instrument ↑/↓/✓ arrows + one dominant whisper at a time (3.5s
  sustained deviation, cooldown), master LIVE COACHING toggle keeps measurement on.
- Interview-Only mode (analytics visible OFF): clean room — video + prompt + dock only.
- Hold-last-valid + hatched WAITING FOR SPEECH + "no speech observed yet" honesty.
- Reduced-motion: settings/config toggle + `prefers-reduced-motion` — static env frame,
  instant transitions, instant count-ups.

## Known visual limitations (honest)
- Scene art is original generated SVG — semantic and coherent, but it is the doc-07
  "v1 ship" tier, not photographic AAA key art. Swapping tiles to graded photo/painted
  art is a URI replacement (ART_MANIFEST.json), never a layout change.
- The simulated camera feed is a stylized painted avatar (labeled SIMULATED FEED). With
  a real `getUserMedia` stream the same stage element hosts the `<video>` directly.
- The lobby world uses the ~1100px 3528A capture of the Founder's Arena painting;
  Codex should re-crop from the 2560px originals for full crispness.
- Focus-mode expansion is implemented as focus ring + scale + dim-siblings + tuner
  popover; the full 1.35× anchored-overlay expansion of doc-04 §4 (with 60s micro-trend)
  is not built.
- Density switch (STANDARD/SIMPLE/LAB) and the scanner click-to-drawer provenance view
  are not built (SIMPLE's calm-view intent is covered by Interview-Only).
- Mock-mode multi-select order tray is drag-free (click order + remove only).
- Piano register is driven by the sim's semitone walk; key-span mapping (±7 keys around
  the speaker median) is presentation-final but Codex should bind register/median from
  the real PITCH frames.

## Codex integration notes (what to wire, what not to touch)
The visual shell expects a per-frame metric object whose fields mirror the real
projector contract (`live-metric-projector.mjs` LIVE_METRIC_IDS):
`speedWpm.wordsPerMinute`, `volume.speechLufsK`, `volumeModulation.speechModulationRangeLu`,
`pitch.semitonesFromSpeakerMedian` / `register`, plus behavior-intelligence
nods / qualifying smiles / effective gestures / hands visibility / camera-facing.
Binding points, in order:
1. `app/live.mjs` — replace `SimEngine` with the real runtime mount (media-bridge +
   projector + behavior runtime). `frame()` shape is documented at the top of
   `app/data.mjs`; every renderer reads only that frame. Delete the sim-feed painter
   and attach the real stream to the stage `<video>`.
2. `app/live.mjs` recording dock — swap the state timers for MediaRecorder + chunked
   upload per the 3527 storage contract (doc-05: 5s chunks, retry, seal on stop,
   paused spans excised). States/UI are final.
3. `app/post.mjs` results/library/progress — replace `SESSIONS`/`session.last` with
   persisted `ivoc.analytics.v1` reads; click-moment → real player seek.
4. `app/menus.mjs` setup — real `enumerateDevices()` into the device wheels; real
   preview + mic meter; permission-denied designed state.
5. Matrix entry/entitlement, R2, auth: per the standing 3527 blueprint + 3528A doc-10.
6. Remove the dev params (`dev/ff/tuner`) or gate them out of production builds.
7. `CALIBRATION` corridor edits from the ⚙ tuners currently mutate the in-memory
   object; persist to the profile store (`ivoc.prefs`).

## Verification honesty
- LAW #1 status: this build proves the EXPERIENCE layer only. A metric suite on real
  camera/mic is NOT claimed. All signals are seeded sim, labeled on screen.
- Zero console errors across the full journey (home → … → live → paused → resumed →
  stopped → saved → processing → results → library → progress → settings → mentor).
- The real analytics engines, WPM infrastructure, storage, Matrix, and production were
  not modified.
