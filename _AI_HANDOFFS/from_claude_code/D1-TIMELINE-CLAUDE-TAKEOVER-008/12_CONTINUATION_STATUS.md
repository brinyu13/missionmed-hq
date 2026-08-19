# 12 — Continuation Status (D1-TIMELINE-CLAUDE-TAKEOVER-008-COMPLETION)

Continues from `b8b871d`. Prior evidence is untouched; this file and `13_*` are additive.

## RESULT: PARTIAL — substantially further, still not live

Commits added this continuation:

| Commit | What |
|---|---|
| `6ea20c0` | Last-good-render law, renderer fail-softs, zoom shortcuts, asset-integrity build gates |
| `e1797fe` | Fit actually fits (found by operating the editor, not by a test) |
| `48c2831` | Smart Fill review wiring, File Vault ingestion, student language — plus three verification corrections |

Regression at close: **748/748** (600 JS, 148 TS), typecheck clean, `check-release` and the
WordPress runtime build both pass, protected D1-409H bytes unchanged
(`ed46fdf2…86cb32`).

## A correction to my previous report

I previously reported the four `TIMELINE_AI_*` variables as **absent** in production. That
came from the inherited Codex handoff and was **stale**. All four are present in Railway
production, and `production-server.ts` throws on partial configuration, so the service being
Online proves they are valid. **The OpenAI CV intelligence provider is live in production.**
The AI gate I listed as a Founder blocker does not exist.

## P0 — Last-good render (the ticket's governing law)

The law was inverted before this run: `_fail()` cleared `data-ready`, which *un-hid* the
opaque "Preparing your timeline…" panel and drew it **over** the render being retained.

Now:
- A render that succeeds is marked durable (`data-has-render`). The first-load panel is keyed
  to that mark and can never cover a timeline the student has already seen.
- A hard failure **re-renders the last good model**. This matters because the protected
  kernel builds its DOM *before* running its post-render laws, so a failed render leaves the
  failed layout on the board — leaving the frame alone would have shown the student the
  broken layout, not their previous one.
- Recalculation shows a small translucent "Updating your timeline…" pill over the previous
  timeline, honouring `prefers-reduced-motion`.
- Failure copy: "We kept your timeline as it was." Diagnostics stay on the element.

Observed working on real data: a pathological timeline raised `TEXT_FIT_UNRESOLVED` during
the export gate and the board kept the previous timeline rather than blanking.

`TEXT_FIT_UNRESOLVED` also has two distinct causes that only its message distinguishes, and
both now degrade instead of failing: the profile card's values are compacted when the card
cannot fit, and crowded arrow labels are shortened when the kernel's two-frame stability
probe never settles — which is exactly what same-month and heavily overlapping timelines
produce. Both are host-owned display strings; nothing the student stored is altered.

## P0 — Asset integrity

`build-wordpress-runtime.mjs` silently left unresolvable JS asset literals **relative**,
while the CSS and HTML rewriters threw for the identical condition. Relative paths do not
resolve under the production `/timeline/_asset/` scheme, so one missed rewrite reached
students as a 404 — and a 404 on a core protected texture blanks the entire board. It now
fails the build. Running it strict immediately surfaced five unresolved literals; all five
are the Founder's private photo fixtures that `check-release` deliberately excludes, so they
are explicitly allowlisted and everything else is fatal.

`check-release` now verifies **24 runtime-critical assets** are present and non-empty,
including the three textures the kernel probes before it will render at all. Both gates pass
against the current build (`timeline-dfdeb5c6975978d3` → `timeline-wp-9f88e80b177b8268`).

**Not done:** verifying those URLs against *live production* still needs an authenticated
session. This remains the single highest-risk unknown and is a five-minute check.

## P1 — Found by operating the editor, not by a test

Three defects no test caught, all now fixed and re-verified in the browser:

1. **Fit did not fit.** With the Advanced Studio rail open the board rendered 996px inside a
   738px stage. The stage grid had no explicit track, so it sized itself to the board's
   intrinsic 1920px and `width:min(100%,…)` resolved against 1920. Now 690px inside 738px,
   no horizontal scroll, whole timeline visible. (Also: `uxr-002.css` is **not loaded** by
   the app — only `407f-upgrade.css` is. An edit to the wrong file is inert.)
2. **Zoom percentage field** — typed "175", all three characters landed, field kept focus,
   zoom applied live at 175%. Previously every keystroke destroyed the input.
3. **Text alignment** — the text box was a *row* flex container, so `text-align` never
   reached the anonymous text item and the vertical control moved text sideways.

Selection and contextual editing were exercised directly and behave well: clicking the Color
Key selects it, announces it, and opens a contextual panel with editable labels and colours.

## Verification caught three regressions worse than the bugs

Each lane's work was handed to an independent agent told to refute it. That found:

1. **The parser turned "missing institution" into "confidently wrong institution."** The new
   adopt-a-neighbouring-line rule was layout-blind: where the institution sits *below* the
   dated line it shifted every institution up one entry, and it promoted prose descriptions
   ("Shadowed attendings in the cardiac catheterization laboratory") to organization — which
   then flowed into the approved event through the one-click accept path. Fixed by deciding
   direction per section and rejecting prose. A second pass was needed because matching verb
   *stems* wrongly rejected ordinary titles like "Rotating Internship" and "Research
   Assistant".
2. **Drag-to-canvas announced a success that never happened** — "Added to your timeline" for
   a payload no handler accepted. Now the move is handled and the confirmation only appears
   when something landed.
3. **The new Smart Fill review surfaces had no CSS at all**, and their wrapper stole the card
   gap. Styled to match the existing intake cards.

Also corrected: the shipped `dist-api/server.mjs` still contained the cross-student existence
oracle the File Vault fix was meant to close (rebuilt), and an overstated base64 performance
claim was replaced with what was actually measured.

## Still open — honest list

- **Live production verification of the 38 accepted assets** (highest risk).
- **Grouped-text containment** is still breakable: `resizeAdvancedGroup` applies minimums to
  text children but never re-clamps them inside the resized container, so a row near the
  bottom of a Color-Key-style box can hang outside after a proportional shrink. The lane's
  own test only used a top-anchored label, so it passes trivially.
- **Position/size and wrapping controls are inert** — `onGeometry` has no shell
  implementation and no renderer reads `item.wrap`. They render and change nothing.
- **Duplicate flags can appear three times** in SERVER_AI mode (server emits one per
  candidate in a pair, the client pass adds a third with a different id).
- **D-12 not delivered** — the chooser still makes the redundant detail round trip.
- Dragging flags, the title plaque, photo tiles, the logo mount and the sticky note is still
  unimplemented (`_beginGesture` covers arrows, axis, colour key, profile card only).
- Direct manipulation is still disabled below 40% board scale.
- The intake evidence panel still shows confidence-engine reason strings verbatim
  ("Canonical event taxonomy match · +16") — pre-existing, untouched by this run.

## Production

Unchanged. No backup created or deleted, no release installed, no deploy triggered.
The remaining Founder-only gate is the Kinsta backup slot (see `09_*` and `14_*`).
