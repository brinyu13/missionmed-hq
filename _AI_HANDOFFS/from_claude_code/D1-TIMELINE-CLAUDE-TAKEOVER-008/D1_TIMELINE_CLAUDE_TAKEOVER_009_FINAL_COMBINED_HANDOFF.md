# D1-TIMELINE-CLAUDE-TAKEOVER-009 — Final AAA Closure, Combined Handoff

**Owner:** Claude Code · **Continues from:** `3b3239a` · Prior evidence untouched.

Read with `15_CLOSURE_RUN_STATUS.md` (what changed) and `16_PRODUCTION_VERIFICATION.md`
(what production actually looks like).

---

## 1. The headline

**The P0 risk I carried through two handoffs — "a missing core asset could blank every
student's timeline in production" — does not exist.** An SSH host to the Kinsta environment
was configured on this machine; using it read-only, the live release was opened and all nine
runtime-critical binaries are present, with 65 alias entries.

The live release is also **byte-identical** to my local build
(`sha256 7d96a7f0ce9f9eaaacddb74f26d56021bbcb137f357d3bb36dcbe083c8618a1e`,
`timeline-wp-9f88e80b177b8268`). Which means the other half of the finding is just as
important: **none of this run's repairs are in production.** The live release predates them.

## 2. Commits in this closure run

| Commit | What |
|---|---|
| `3989443` | Composition law; grouped-text containment; inert-control audit |
| `2bc79f5` | Position/size actually applied; certification classification; heading-as-organization guard |
| `dcf68af` | Proportional lock honoured in size fields; removed a layout-thrashing scan |
| `4cb33fa` | Kept the board scan off the export path |

Regression **748/748**, typecheck clean, protected D1-409H bytes unchanged.

## 3. P0 closures

**Composition.** The board offers only two lanes clearing the Color Key's band, so three or
more events overlapping in time over the same axis stretch left an arrow with nowhere legal
to go. Chronology is fixed and the lanes are frozen, so the participant that moves is the one
whose position carries no meaning — the legend. Relocated only when actually obstructing,
only when the student has not placed it, only to the nearest fully clear position, and
presentation-only so a reload restores the design default.

**Grouped text.** A group was not a container: children were scaled but never clamped back
inside the resized bounds, so a label low in a Color-Key-style box hung outside after a
proportional shrink (10px at half scale, 21px at a tenth). Now contained on both axes, with
shrinking containers switching text to auto-fit so a narrower box rewraps rather than losing
its tail. Verified live at 0.6/0.35/0.15 scale, plus ungroup restoring independence.

**Inert controls.** Every studio hook was audited against the shipping shell. Position/size
and text wrapping were genuinely inert and now work; proportional lock was being ignored by
the size fields (200×100 became 400×100 instead of 400×200) and now holds. The only
unimplemented hooks left belong to an entry dialog the shell never renders, plus an optional
drag-start observer.

**Smart Fill.** Against the graded synthetic CV: 9 candidates, 8 high confidence, 1 low — and
the low one is exactly the deliberately ambiguous entry. `07/2021–12/2022` → Jul 2021–Dec
2022; Dean's Award → `AWARD_HONOR`, not Work; research at a university → research, not
Education; US rotation → clinical; medical degree → education; ECFMG → certified, high
confidence. Institution reaches the event in every case.

**Last-good render.** Confirmed visually in the running app: the translucent "Updating your
timeline…" pill sits over the still-visible previous timeline.

## 4. What using it caught that reading it did not

Worth recording, because it is the argument for the Founder's own standard:

- Position/size looked correctly wired and was still inert — the handler assumed a
  `{document,changed}` result from a function that returns the document itself, so the
  `changed` check returned early.
- Proportional lock was ignored by those same fields.
- The first version of the composition fix ran its board scan from `resize()`, which the
  ResizeObserver calls on every container change; it thrashed layout badly enough to stall a
  ten-scenario export run.

None of these would have been found by reading the diff or by the suite, which stayed green
throughout.

## 5. Production position

- Live: `timeline-wp-9f88e80b177b8268`, installed Aug 17 10:18, atomic symlink.
- 33 retained releases; immediate rollback target `timeline-wp-0bcab7adfa597ceb`; the
  originally-recorded `timeline-wp-ed84301a63d1ed11` is also still present.
- Rollback is a symlink repoint. No migration is introduced, so there is no schema reversal.
- Timeline-scoped recovery snapshots already exist under `private/`.
- Railway `mission-timeline-api` Online; all four `TIMELINE_AI_*` variables present, so the
  OpenAI CV provider is live.

**Nothing on production was created, modified or deleted in this run.**

## 6. Why this is not COMPLETE

Two reasons, both honest:

1. **The backup gate could not be read.** Kinsta manual backups are a hosting-panel feature,
   not a filesystem object. SSH gives the docroot, not the panel, and there is no `kinsta`
   CLI or stored panel credential here. I cannot confirm capacity is still 5/5 or that the
   oldest manual backup is still `Post Timeline Builder Success` (Aug 4 2026, 10:08 PM) — and
   the ticket explicitly forbids acting on the stale August inventory. So I stopped.
2. **No authenticated production session.** Without one there is no canary, no persona
   matrix, no live CV or File Vault journey, no Matrix round trip — so none of it can be
   claimed.

Applying the ticket's own final acceptance law — can a student do all of it *without Dr Brian
repairing it* — the answer is "very probably, on the repaired candidate" and "not
demonstrated, on production". That is PARTIAL, not COMPLETE.

## 7. What to do next, in order

1. Open the Kinsta panel, read the current manual backup inventory, and authorize deleting
   one named backup (see `14_FOUNDER_GATES.md`).
2. I create the scoped pre-deploy snapshot (one command over the SSH access already proven).
3. Rebuild the static release from current source, install the WordPress release, canary.
4. Run the persona matrix and the live journeys with a real session.
