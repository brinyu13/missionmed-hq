# D1-TIMELINE-CLAUDE-TAKEOVER-008 — Full Combined Handoff

**Owner:** Claude Code · **Date:** 2026-08-19 · **RESULT: PARTIAL**

This document is designed so another operator can resume without rediscovery.

---

## 1. Source of truth (proved, not assumed)

Work in **`/Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001`**, branch
`codex/timeline-rc1-stabilization-001`.

- Baseline at takeover: `e0c87ce` · **Work commit: `b8b871d`**
- `git merge-base --is-ancestor 49ba56d e0c87ce` → true. RC1 is **173 commits ahead** of the
  UXR-002 worktree; UXR-002 has **0** commits not in RC1. Its only tracked code delta is one
  npm script alias. Nothing is lost by working in RC1.
- No destructive git operation was run anywhere. UXR-002's dirty state is untouched.

Protected D1-409H bytes are **unchanged** — all three hashes verified after the work:
`bb471c57…e52c24` (HTML), `4efd5088…98ef7` (CSS), `ed46fdf2…86cb32` (JS).

## 2. Why the Founder and the test suite disagreed

The 711/711 suite did not exercise the **served runtime path**, and the protected kernel's
`postRenderChecks` inspects only `.arrow` parts — **milestone flags are never bounds-checked
or collision-checked**. So a crowded milestone row rendered as jumbled, clipped text while
every automated gate reported success. That is the *"jumbled text in the upper-right corner"*
the Founder saw, and an HTTP 200 was never going to catch it.

Driving the app by hand reproduced five release blockers within the first hour, including
an ordinary student timeline dying with **"We could not display your timeline."** because a
medical-school entry carried the location *Karachi, Pakistan*.

## 3. What was fixed (commit `b8b871d`)

**Renderer / layout**
- `OBJECT_OUT_OF_BOUNDS` no longer blanks the timeline — the host recovers progressively
  (move label inside → shorten → shorten date → drop).
- Events no longer render under the Color Key — the host relocates the arrow to a lane that
  actually clears the furniture it struck, instead of surrendering to overlap-tolerant mode
  and telling the student to fix the layout.
- `autoArrange`'s unbounded lanes no longer collapse onto lane 6 and stack events.
- Milestone flags stack across three rows, shrink/ellipsize only when still crowded, and are
  re-fitted immediately before export.
- `serve.mjs` CSP framing exemption covers the `/timeline/` mount (the canvas never rendered
  locally without this).
- An iframe `load` race that could leave the mount pending forever is closed.
- Fail-soft messaging is truthful: silent for layout adjustments, plain language for real loss.

**CV intelligence** (production has no AI provider, so the local parser *is* the product)
- Ranges without spaces (`07/2021-12/2022`, `Jan 2023-Jun 2024`) now yield both dates.
- Research at a university is no longer classified as Education.
- US rotations whose geography sits in the organization are no longer quarantined; non-US and
  no-geography entries stay conservatively unclassified.

**Editor** — text no longer collapses on selection (handles were measured as text); zoom
percentage field is usable; rail thumbnails constrained; tall uploads aspect-fit on both axes.

**Truthfulness** — the legacy shell no longer repaints "ALL CHANGES SAVED" over offline and
conflict states.

**Security** — `signDownload` restores the owner check for private `SOURCE` objects; the
upload-confirm response no longer returns the private R2 storage key.

## 4. Evidence

- Regression **714/714** (567 JS, 147 TS), `typecheck` clean.
- `evidence/export-density/` — **25 artifacts** across sparse / medium / milestone-heavy /
  dense / long-chronology (PNG + Letter PDF + A4 PDF each), **zero console errors**,
  backgrounds present, no arrow parts out of bounds, **no flags off board**, same-row
  overlaps reduced from 9 to 1 in the worst case. All opened and visually inspected; PDFs
  verified single-page at Letter 792×612 pt and A4 841.89×595.28 pt.
- `evidence/LANE_FINDINGS_RAW.json` + `02_FOUNDER_REQUIREMENTS_TRACEABILITY.md` — **69
  findings** from six specialist lanes, each BLOCKER/MAJOR independently adversarially
  verified (30 of 35 verdicts upheld).
- New gate: `web/tests/run_takeover_008_export_density.mjs`.

## 5. The single most important thing to check next

**B-01 / F-01.** 38 runtime binary assets (8 textures, `us_flag.png`, 29 keynote PNGs) live
only in the accepted-asset root and `dist/` — never in `web/`, and in no git object. The
protected kernel probes three textures and throws `ASSET_LOAD_FAILED` if any 404, and that
gate is **unreachable by the host fail-soft path**. If they 404 in production, **every
student's timeline is blank**. `F-02` compounds it: the WordPress runtime builder silently
leaves unresolvable JS asset literals relative where the CSS/HTML rewriters throw.

Fetch those three texture URLs with an authenticated session. Five minutes.

## 6. Top remaining defects (all confirmed, none fixed)

| ID | Defect |
|---|---|
| B-01/F-01 | 38 protected runtime assets absent from `web/`; core-asset failure is unrecoverable |
| B-03 | `TEXT_FIT_UNRESOLVED` has no fail-soft path — this is what kills the Home preview |
| E-01/E-02/E-08 | §12 last-good-render retention not implemented; a failed update is silent to the student |
| C-06 | The AI quality-review layer is computed server-side and discarded by the client |
| C-09 | Confidence is computed but drives no differentiated UI behaviour (§8 unimplemented in UI) |
| D-01 | File Vault → Smart Fill forges a SERVICE principal; dead in production |
| A4/A5/A7/A8/A10 | Text alignment, dragging flags/plaque/photos, keyboard zoom, Advanced text focus loss, rail drag payloads |
| E-04/E-05/E-06 | Internal error text (kernel/adapter/entitlement internals) reaches students |
| D-04/D-07 | CV bytes never deletable; pre-consent media silently lost on other devices |
| F-07 | Rollback tool cannot roll back the WordPress runtime release students actually load |
| F-05 | `matrix-launch.js` injected twice with different `?ver` |

## 7. Production status

**No production mutation occurred.** Production is unchanged.

- `GET /timeline/` → `303 → /member-dashboard/` (auth gate active)
- Timeline API healthy: `timeline-c9eda9eeb7d6cf98`
- Railway `mission-timeline-api` **Online**, deployment **`2d815dbd-85b2-4d12-8ed0-8aea8fbc1347`**
  — note this **differs from the inherited record** (`8e0385ce-…`), which is stale.

**Founder-only gates:**
1. Kinsta backup capacity 5/5 — the mandatory pre-deploy backup needs authorization to delete
   exactly one existing backup, and existing authority names different backups.
2. `TIMELINE_AI_PROVIDER` / `_API_KEY` / `_MODEL` / `_CONSENT_VERSION` must be installed
   together (partial configuration stops startup). Railway CLI is authenticated here.
3. An authenticated production session for canary, personas, live CV/media/export and the
   Matrix round trip.

## 8. One correction future operators should not repeat

A permanent "Preparing your timeline…" state observed mid-run was **not** a product defect:
`requestAnimationFrame` does not fire in the kernel iframe while the browser pane is hidden,
and the kernel's `twoFrameStable()` waits on rAF. Confirm the page is compositing before
treating that stall as a bug. (The genuine iframe `load` race found while chasing it is real
and is fixed.)

## 9. Local runtime for the next operator

`.claude/launch.json` config `timeline-rc1` serves the package with
`TIMELINE_ACCEPTED_WEB_ASSET_ROOT` pointed at the built `dist/` tree, which is what makes the
accepted private assets resolve locally. Without it the canvas cannot render.

Export gate:
```bash
D1_CAPTURE_DIR=/tmp/gate node web/tests/run_takeover_008_export_density.mjs
```

---

# CONTINUATION — D1-TIMELINE-CLAUDE-TAKEOVER-008-COMPLETION

Appended, not overwritten. Prior sections above remain the record of the first run.

**RESULT: PARTIAL.** Commits `6ea20c0`, `e1797fe`, `48c2831`, `e2cb864` on
`codex/timeline-rc1-stabilization-001`. Regression **748/748** (600 JS, 148 TS), typecheck
clean, `check-release` and the WordPress runtime build both pass, protected D1-409H bytes
unchanged.

## Correction to the first run's report

The four `TIMELINE_AI_*` variables are **present** in Railway production, not absent. That
claim came from the inherited Codex handoff and was stale. `production-server.ts` refuses to
start on partial configuration, so the service being Online proves them valid: **the OpenAI
CV intelligence provider is live**. One of the two gates I attributed to the Founder does not
exist.

## What changed

**Last-good render (P0).** The law was inverted: `_fail()` cleared `data-ready`, which
un-hid the opaque loading panel and drew it *over* the render being retained. A successful
render is now marked durable and can never be covered again; a hard failure genuinely
re-renders the last good model (necessary, because the protected kernel builds its DOM
*before* running its post-render laws, so a failed render leaves the broken layout on the
board); recalculation shows a translucent "Updating your timeline…" pill over the previous
timeline. `TEXT_FIT_UNRESOLVED` now degrades instead of failing — profile values are
compacted when the card cannot fit, and crowded arrow labels are shortened when the kernel's
stability probe never settles, which is what same-month and overlapping timelines produce.

**Asset integrity (P0).** `build-wordpress-runtime.mjs` silently left unresolvable JS asset
literals relative while the CSS and HTML rewriters threw — one missed rewrite reached
students as a 404, and a 404 on a core texture blanks the board. It now fails the build (the
five private photo fixtures `check-release` deliberately excludes are allowlisted).
`check-release` verifies 24 runtime-critical assets. Both pass.

**Found by operating the editor, not by tests:** Fit did not fit (the stage grid sized itself
to the board's intrinsic 1920px, so the board rendered wider than its own viewport); the zoom
percentage field is now typable and keeps focus; text alignment works (the text box was a
*row* flex container). Note `uxr-002.css` is **not loaded** by the app — only
`407f-upgrade.css` is.

**Four lanes delivered** Smart Fill review wiring, confidence-driven review lanes, File Vault
ingestion with the real student principal, and a student-language translation layer. See
`13_*` for what survived verification and what did not.

## The verification pass earned its cost

Every lane left the suite green; every verifier still found something. Three changes were
**worse than the bugs they replaced** and are corrected here: the parser began stating wrong
institutions with confidence in the one-click accept path; drag-to-canvas announced a success
that never happened; the new review surfaces had no CSS. `dist-api/server.mjs` was also still
serving a File Vault cross-student existence oracle from an intermediate build (rebuilt).

## Export evidence

Ten shapes — zero events, sparse, medium, dense, milestone-heavy, long labels, same-month,
overlapping chronology, future events, mixed categories — each from a **fresh page**, 50
artifacts, opened and inspected:

- **0 console errors** across the whole run
- background present in all 10; **0 flags off board; 0 arrow parts out of bounds**
- 1 residual same-row flag overlap, in the most extreme milestone case only
- zero-event state shows "Your timeline will appear here." with no jargon
- **4 arrows hidden behind the Color Key** in 2 of 10 shapes — newly measured, see below

## The one composition defect still open

In `same-month` and `overlapping`, event arrows draw underneath the Color Key with their
labels unreadable. This is a genuine capacity limit, not a bug in the recovery: only lanes 0
and 1 clear the Color Key's vertical band (y300–622), so once three or more events overlap in
time at the left edge, some must land beneath it. The gate now measures this, so it is
tracked rather than invisible.

Two remedies exist and both need a product decision rather than a quiet code change: the
Color Key is already directly manipulable by the student, and
`setColorKeyGeometryPresentationOverride` exists for an automated relocation. I did not move
approved furniture automatically, because the ticket requires preserving the MissionMed
visual identity.

## Still open

Grouped-text containment is breakable (a text row near the bottom of a container hangs
outside after a proportional shrink); the new position/size and wrapping controls are inert
(no shell implementation, no renderer reads `wrap`); duplicate flags can appear three times in
SERVER_AI mode; D-12's redundant round trip remains; dragging flags/plaque/photos/logo/sticky
is still unimplemented; direct manipulation is off below 40% scale; the intake evidence panel
still shows confidence-engine reason strings verbatim.

## Production

**Unchanged.** No backup created or deleted, no release installed, no deploy triggered. The
remaining gates are in `14_FOUNDER_GATES.md`: the Kinsta backup slot needs one authorization
sentence, and an authenticated session is needed for live verification — starting with the
three core texture URLs, which is a five-minute check that de-risks the entire release.
