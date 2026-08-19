# 15 — Closure Run Status (D1-TIMELINE-CLAUDE-TAKEOVER-009-FINAL-AAA-CLOSURE)

Continues from `3b3239a`. Prior evidence untouched; this file is additive.

## Commits added

| Commit | What |
|---|---|
| `3989443` | Composition law (furniture/event mutual awareness), grouped-text containment, inert controls |
| `2bc79f5` | Position/size control actually applied; certification classification; heading-as-organization guard |

Regression **748/748**, typecheck clean, protected D1-409H bytes unchanged.

## P0 — Composition law

The board offers only two event lanes that clear the Color Key's default band, so once three
or more events overlap in time over the same stretch of axis, some arrow had nowhere legal
to go and was drawn underneath the legend with its label unreadable.

Chronology is not negotiable and the lane geometry is frozen in the protected kernel, so the
participant that moves is the one whose position carries no meaning: the legend. It is
relocated **only** when it actually obstructs, **only** when the student has not positioned
it themselves, and **only** to the nearest position that clears every arrow, flag and other
piece of furniture. The approved default therefore survives every composition that fits, and
the change is presentation-only — the document is never mutated, so a reload with fewer
events puts the legend back where the design intends.

The adversarial gate now measures furniture where it actually is rather than at design
coordinates, so it can neither report phantom obstructions nor miss real ones.

## P0 — Grouped text / container law

A group was not really a container: children were scaled but never clamped back inside the
resized bounds, and because the 32×24 minimums stop a child shrinking by the full factor, a
label low in a Color-Key-style box hung outside it after a proportional shrink (measured
10px at half scale, 21px at a tenth).

Children are now contained on both axes, and shrinking a container switches its text to
auto-fit so a narrower box rewraps rather than losing its tail. Verified live in the running
app at 0.6/0.35/0.15 scale: contained vertically and horizontally at every step, font scaling
down to the readable floor, and ungroup restoring independent editability.

## P0 — Inert controls

Every hook the Advanced Studio can call was audited against the shipping shell:

- **Functional:** all student-reachable controls, after wiring position/size.
- **Unreachable module code:** `onDialogPrimary` / `onDialogSecondary` belong to an advanced-
  mode entry dialog the shipping shell never renders. Not visible UI.
- **Optional observer:** `onDragStart` — the drag payload is set on `dataTransfer` regardless,
  so the drag works without it.

Two controls were genuinely inert and are now genuinely working:
- **Position and size.** Worth recording how this was nearly missed: the first wiring looked
  correct but assumed `setAdvancedObjectGeometry` returned `{document,changed}` when it
  returns the next document itself, so the `changed` check returned early and typing a width
  still moved nothing. Reading the code said "wired"; using it said "inert".
- **Text wrapping.** The control persisted a field no renderer read.

## P0 — CV Smart Fill, against the graded synthetic CV

Two-page CV containing a medical school with dates, employment with dates, a US rotation,
research at a university, a Dean's Award, a certification, several explicit ranges, and one
deliberately ambiguous entry. Result: **9 candidates, 8 high confidence, 1 low.**

| Ticket requirement | Result |
|---|---|
| `07/2021 – 12/2022` | Jul 2021 → Dec 2022 |
| Dean's Award | `AWARD_HONOR` — **not** Work |
| Research at a university | `research` — **not** Education |
| US rotation | `clinical` (US Clinical Experience) |
| Medical degree | `education` |
| Certification | `ECFMG_CERTIFICATION`, high confidence |
| Ambiguous item | the only low-confidence entry, left for review |

Institution reaches the event in every case. Two fixes were needed to get here: a bare
"ECFMG Certification" under the student's own Certifications heading now classifies (every
negation, pending, expired and Pathway guard still runs first), and a lone unrecognised
heading is no longer adopted as an organization — "Miscellaneous" was being written onto the
following event as its institution.

Quality suggestions carry plain-language `reason` and `recommendation` with no engineering
terminology, and are surfaced before review rather than discarded.

## P0 — Last-good render

Confirmed **visually in the running app**: adding an object showed the small translucent
"Updating your timeline…" pill over the still-visible previous timeline, which is the
behaviour the law requires and the inverse of what the code did before this work.

## Production asset integrity — a correction

The earlier framing ("if the raw texture path 404s in production every timeline is blank")
was based on the wrong URL scheme. Production serves assets from the alias route:
`/timeline/_asset/…` returns **303** (auth gate), while the raw
`presentation/d1-409h-a1/assets/tex/…` path returns the WordPress 404 page — which is
expected, not a defect.

The deployable artifact was verified instead: `dist-wordpress/release.php` contains **63
alias entries**, each with a sha256, including all nine critical binaries (the eight textures
and `us_flag.png`). `check-release` verifies 24 runtime-critical assets are present and
non-empty. Live verification through the alias route still requires an authenticated session.
