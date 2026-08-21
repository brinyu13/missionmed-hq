# 07 — Human Acceptance Report

## What was actually done, and what was not

Real-browser driving was performed against the **local served runtime** at
`http://localhost:8792/timeline/` and against **headless Chrome** via the export gate.
A live authenticated production student journey was **not** performed — production
`/timeline/` redirects to `/member-dashboard/` and no authenticated session was available
in this run. Nothing in this document should be read as live production acceptance.

## Founder-class defects reproduced by hand before any code was changed

Driving the app as a first-time student immediately reproduced release blockers the
711/711 automated suite does not catch, because the suite does not exercise the served
runtime path:

1. Opening **Edit Timeline** with events present showed `Preparing your timeline…`
   indefinitely over a blank grey pane. Console: `Timeline canvas update unavailable
   {surface: edit, code: 18}` and a CSP `frame-ancestors` violation.
2. With the frame unblocked, an ordinary 8-event student timeline — the kind of thing a real
   IMG would build — failed outright with `OBJECT_OUT_OF_BOUNDS` and the message
   **"We could not display your timeline."** The trigger was mundane: a medical-school entry
   with the location *Karachi, Pakistan*.
3. **Home's "Latest timeline preview" was a dead grey box** with 15 events present; the
   kernel reported `error:"TEXT_FIT_UNRESOLVED"`. The student's *first screen* showed nothing.
4. A routine 15-event timeline only rendered via `EXISTING_LAYOUT_OVERLAP_RECOVERED`, with the
   Color Key covering a live event arrow and a banner reading *"Some items overlap. Your
   timeline is still available; move an item slightly to improve the layout."* Asking a
   student to hand-fix the layout is the exact failure this commission exists to end.
5. Milestone flags overlapped by up to 99px and ran off the right edge — the visible source
   of the Founder's *"jumbled text in the upper-right corner"*.

Items 1, 2, 4 and 5 are fixed and re-verified. Item 3 is **not** fixed (see B-03).

## A correction worth recording

Mid-run I attributed a permanent "Preparing your timeline…" state to a product defect and
A/B-tested it against the pre-change baseline, which reproduced it. That attribution was
**wrong**. `requestAnimationFrame` does not fire inside the kernel iframe while the browser
pane is hidden, and the kernel's `twoFrameStable()` waits on rAF — so the stall was an
artifact of my hidden preview pane, and the successful runs were exactly those where the pane
was visible. The genuine latent bug found while chasing it (the iframe `load` race) is real
and is fixed. Anyone continuing this work should not treat that stall as a product defect
without first confirming the page is compositing.

## Student-facing quality issues confirmed and NOT fixed

These are the answers to ticket §18's questions, and several are serious:

- **E-01 / E-02 (BLOCKER)** — A failed Edit-Timeline projection update is **completely silent
  to the student**: the message is written to a data-attribute and the console, and nothing
  listens for `d1-411a:error`. Meanwhile `_fail()` hides the retained last-good render behind
  the opaque "Preparing your timeline…" panel. So the one thing §12 demands — keep the last
  good render visible — is inverted.
- **E-08** — §12's last-good-render retention is **not implemented**. No "Updating your
  timeline…" class of copy exists anywhere in the codebase, and both refresh overlays are
  full-bleed opaque wipes.
- **E-03** — The overlap banner fires on the *first successful render* of a routine timeline
  and tells the student to "move an item" — on the Home preview, which is deliberately
  non-interactive. (The underlying overlap cause is fixed; the banner logic is not.)
- **E-04 / E-05 / E-06 / D-09** — Internal error text reaches students: entitlement denial
  reasons are raw WordPress/config strings; 24 adapter call sites toast raw
  `error.message` including *"D1-411A kernel projection is unavailable."* and *"Protected
  D1-409H-A1 kernel was not loaded."*; the CV dropzone renders raw adapter errors as a field
  error. This directly violates §11's "never casually expose kernel/adapter/canonical".
- **E-07** — The global toast is not a live region, so every confirmation and error is silent
  for screen-reader users, and it auto-dismisses in 2.6s with no dismiss control.
- **E-09** — Zero-event Edit Timeline shows a dark abstract box and zero-event Home shows
  three grey bars; neither resembles the artifact being built, though an unused ghost example
  board already exists.
- **E-10** — On a phone the Edit Timeline toolbar is `display:none` with no explanation;
  `RESPONSIVE_BANNER` is defined and never rendered.
- **E-11** — The boot gate says "Loading local timeline…" (developer wording) and has no
  timeout or global error fallback, so a module that never executes leaves a permanent
  full-screen dead gate.
- **E-12** — The media library uses asset-management vocabulary ("asset reference", "Replace
  asset", "Delete asset") instead of the student's word: image.

## Honest verdict against §18

Would a first-time student now get a timeline that renders instead of dying, and an export
that is not jumbled? **Yes — that is materially fixed and proven.** Would they always
understand what happened when something goes wrong, or trust the save state? **Not yet**:
E-01, E-02 and E-08 remain, and they are the difference between "works" and "feels
trustworthy". I would not certify AAA human acceptance on this evidence.
