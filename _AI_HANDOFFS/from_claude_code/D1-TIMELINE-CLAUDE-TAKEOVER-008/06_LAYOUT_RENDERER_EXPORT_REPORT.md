# 06 — Layout, Renderer and Export

## The governing constraint

The protected D1-409H kernel is byte-verified and was not edited. All three hashes match the
governing values exactly after this run:

```
HTML bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24
CSS  4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7
JS   ed46fdf21588554aaaadbeaebacd81321177d45ad357c7e8cb8570a20786cb32
```

Every repair below therefore lives in the **host** layer.

## Why automated PASS and the Founder's eyes disagreed

The kernel's `postRenderChecks` iterates `document.querySelectorAll('.arrow')` and inspects
only `.die`, `.date` and `.loc`. **Milestone flags are never bounds-checked and never
collision-checked.** `buildFlags` pins every flag to a single row at `top:82px` anchored to
its date, with a `white-space:nowrap` label that never shrinks, and `#board{overflow:hidden}`
silently clips whatever runs past x=1920.

So a crowded milestone row renders as jumbled, clipped text while every automated gate
reports success. That is precisely the Founder's *"jumbled text in the upper-right corner"*,
and it is why an HTTP 200 and a green suite were never going to catch it.

## Fixed in this run

| Defect | Behaviour before | Repair |
|---|---|---|
| `OBJECT_OUT_OF_BOUNDS` blanked the whole timeline | A location label on an early event rendered at x=−37 and the kernel failed the entire render → "We could not display your timeline." Reproduced with an ordinary entry: *MBBS, Dow University of Health Sciences · Karachi, Pakistan* | Host recovers progressively: move the label inside the arrow, then shorten it, then shorten the arrow's display date (a host-produced string), then drop it. Never blanks. |
| Events rendered under the Color Key | The host surrendered to `collisionPolicy:"warn"` and showed the student a banner telling them to move an item themselves | Host relocates the arrow to a lane that actually clears the furniture it struck, using the kernel's own reported collision pairs; only warns if no lane exists |
| Lane overflow stacked events | `autoArrange` emitted unbounded lane indexes silently clamped to lane 6, so several events drew at the same y with overlapping labels | Clamped at the generator; illegal lanes no longer forwarded as overrides; an override is honoured only when its lane is genuinely free, else `EVENT_LANE_OVERRIDE_REJECTED` |
| Milestone flags jumbled and clipped | Single row, no de-collision, ran off the board | Three-row upward stack (82 / 48 / 14) clear of the axis (y=112) and of the title plaque, each flag taking the lowest genuinely free row; shrink then ellipsize only if still crowded; re-applied immediately before export |
| Canvas never rendered locally | `serve.mjs` exempted only `/web/presentation/d1-409h-a1/` from `frame-ancestors 'none'`, but the app requests the kernel under `/timeline/` | Exemption covers both mounts |
| Mount could hang forever | A frame that finished loading before its `load` listener attached left the mount pending behind "Preparing your timeline…" with no error | Resolve on whichever comes first: the load event, or the frame demonstrably present |

The student-facing message after a fail-soft render was also corrected: layout adjustments
the host makes on the student's behalf are now silent (narrating them makes a working
timeline feel broken), and only real content loss is reported, in plain language. Previously
a relocated label would have been announced as *"1 unavailable media asset was omitted."*

## The new export quality gate

`web/tests/run_takeover_008_export_density.mjs` exports **five real densities** — sparse,
medium, milestone-heavy, dense, long-chronology — as PNG + Letter PDF + A4 PDF, and
mechanically asserts the geometry the kernel never validates. The pre-existing RC1 proof
rendered a single event plus three decorative shapes, which is why exports could be certified
PASS while looking broken.

Results after the repairs (25 artifacts, all opened):

| Scenario | Arrows | Flags | Background | Arrow parts OOB | Flags off board | Same-row overlaps | Console errors |
|---|---|---|---|---|---|---|---|
| sparse | 1 | 1 | yes | 0 | 0 | 0 | 0 |
| medium | 5 | 3 | yes | 0 | 0 | 0 | 0 |
| milestone-heavy | 4 | 6 | yes | 0 | 0 | 1 | 0 |
| dense | 10 | 5 | yes | 0 | 0 | 0 | 0 |
| long-chronology | 6 | 4 | yes | 0 | 0 | 0 | 0 |

Before the repairs the same gate reported flags off board in two scenarios and nine
same-row overlaps in milestone-heavy.

PDFs verified structurally and visually: single page, Letter 792×612 pt, A4 841.89×595.28 pt,
full composition present — background, title plaque, year axis, Color Key, profile card,
event arrows, three-row milestone flags — with no clipping and nothing off-page.

## Remaining, confirmed, NOT fixed

- **B-01 / F-01 (BLOCKER)** — 38 runtime binary assets (8 textures, `us_flag.png`, 29 keynote
  PNGs) exist only in the accepted-asset root, not in `web/`. The protected kernel's core
  asset gate probes three textures and throws `ASSET_LOAD_FAILED` if any 404 — and that gate
  is **unreachable by the host fail-soft path**, because a core-asset failure carries no
  `error.path`, so `omitFailedMediaFromKernelModel` returns `omitted:false` and the host
  rethrows. If those assets ever 404 in production, every student's timeline goes blank. See
  `09_PRODUCTION_DEPLOYMENT_RECEIPT.md`.
- **B-03** — `TEXT_FIT_UNRESOLVED` still has no fail-soft path. The four host retries cannot
  change any measured input, and the kernel's mat-exclusion gate hard-fails before it ever
  attempts to shrink. This is what kills the Home preview when the profile card cannot fit
  beside the photo mat.
- **B-07** — A zero-event canvas renders a dark placeholder with none of the board furniture
  (ticket §1 wants the default background always present). A ghost example board already
  exists in the codebase and is unused.
- **B-08** — The explanation callout is silently discarded for essentially every real
  timeline, because the frozen sticky-endpoint window only accepts a target ending at
  x 1040–1200.
- **B-09** — The interview ribbon label is clipped mid-word and the interview date is emitted
  raw with no host fit pass — the second contributor to upper-right crowding.
- **B-10** — `EVENT_LANE_AUTOASSIGNED` fires for every work/clinical/personal event even when
  it lands in its canonical lane with zero contention, so a clean board reports fake layout
  warnings and real signal is buried.
