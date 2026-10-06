# Timeline Builder V1.1 field repair — release candidate report

Date: 2026-10-06. Foreman: Claude Code / Fable 5.1, continuing the Codex takeover packet in
`_AI_HANDOFFS/from_codex/TIMELINE_CLAUDE_FABLE51_TAKEOVER_20261006/` (that packet stays
untracked because it carries applicant facts). This report is de-identified: the live
applicant is "the applicant", the other student whose production document was involved is
"student B". Named evidence (renders, documents, screenshots, test receipts) is in the
ignored private directory `.timeline-recovery-20261002/field-repair-20261006/`.

Worktree `/Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002`, branch
`codex/timeline-astra6-recovery-20261002`, base `db5f2e7` (live WordPress source). Nothing
was deployed. No lease was acquired. Pre-existing dirty work (`d1-031` test, the composer
change in `locked-407f-export.js`, untracked `d1-032` test, the two earlier handoff
directories) is preserved uncommitted; the composer file carries both the dirty hunks and
this repair's hunks, and only this repair's hunks are staged.

## Root cause — actually reproduced

1. **Wrong identity.** Read from the live production document through the Founder's admin
   session: the applicant's CV was imported at 14:51 UTC into the Timeline document of
   student B (WordPress user 141), which already held a typed placeholder profile
   ("Sarah Chen", Johns Hopkins, MD 2027) plus guided-builder test events, none with
   source provenance. The import never extracted the applicant's name: the MyERAS CV
   prints it as `Lastname, First (AAMC ID)`, and the only name rule recognised
   `Name:` labels or `Surname, MD` forms. Even an extracted name would only have filled an
   *empty* profile. So the headline silently stayed "Timeline: Sarah Chen".
2. **Re-asking what the CV states.** The same receipt shows `intelligenceMode:
   LOCAL_LIMITED, fallbackReason: CV_AI_CONSENT_REQUIRED`. The intake checkbox "I consent
   to secure AI-assisted extraction" only unlocked the local read; the server also
   requires a WordPress-recorded AI consent that students never granted, so every live CV
   fell to the generic free-text parser. That parser read the MyERAS layout as loose
   lines: locations dropped, rotations landed as UNCLASSIFIED, the degree and the name
   were lost, publications became broken events. Reproduced byte-for-byte in Node from the
   real CV (35 candidates, identical to the production receipt).
3. **Axis opened at every CV year** because the span used the earliest event start;
   one-month rotations overflowed their arrows at native text size; Guardian offered no
   repair for either.

## What changed (smallest coherent repair, live V1 preserved)

| Concern | Change |
|---|---|
| Structured MyERAS CV | New `web/js/ingestion/eras-cv-parser.js`: page-header identity (name + AAMC ID, every page must agree), medical education span and degree milestone, honors, certifications, experiences with ERAS type and city/state, scholarly work, languages/hobbies. Explicit rotation specialty read from the applicant's own bullet with the line as evidence. Used by the local adapter whenever the layout signature is present, whatever the filename-based type label says. |
| Classification | `event-classifier.js`: ERAS entries classify from title + stated type + stated location (US observership/elective → USCE, research, volunteer, internship, residency, leadership); certifications section → CERTIFICATION; scholarly kinds; degree milestone. Clinical duty bullets are not screened as personal disclosure (`privacy-detector.js` title-only scope). Same-title rotations at different hospitals are no longer duplicates (`quality-review.js`). |
| Identity invariant | `intake.js`: `identityReview` compares the document's applicant with the Timeline name. Empty → adopted (visible, undoable). Match → silent. Different → approval is blocked until the student chooses "Use <document name>" or "Keep <current name>"; nothing is replaced or kept silently. Adopting over a different name also replaces the typed school/degree/graduation that belonged to the other identity and records what was replaced. Guardian `IDENTITY_MISMATCH` blocks export when the Timeline name later diverges from an adopted document. Name binding is `document-identity` provenance, visible on the interview-safe board. |
| Review | Summary line ("We found N items. R look ready, plus K records we keep but do not draw. Q need your attention."), compact one-line ready rows with Accept/Edit/Reject, "Accept these N" per section, record-only group (honors, certifications, scholarly work) with "Keep all", duplicate groups with Keep A / Keep B / Merge / Keep both (undoable, never deletes), explicit MyERAS profile facts prefilled with a visible checkbox. Shell styles in `407f-upgrade.css`. |
| AI consent | `407f-engineering-adapter.js`: when a signed-in student ticks the intake consent box and AI processing is available but their WordPress AI consent is not yet recorded, the consent they just gave is recorded (`setAiConsent("grant")`) before the read; failure still falls back honestly to the local check. |
| Founder start year | `adaptive-layout.js` `deriveFounderYearDomain`: graduate → graduation year; current student → school start minus one; earlier years only for an included personal milestone, a bounded experience that would otherwise vanish, or manual axis expansion. Background spans (school, volunteering, clubs, internship) paint from the left edge with true dates; `clampedStart` arrows carry their institution under the arrow start. Export composer honours `scene.yearDomain`. Width is redistributed across the displayed years; a single label can no longer claim more than 60% of the axis. |
| Guardian safe repair | `quality-guardian.js`: `TEXT_CONTAINER_OVERFLOW` and `LONG_EVENT_LABELS` offer Fix-for-me `CONCISE_LABELS` / `CONCISE_INSTITUTIONS`: presentation overrides only, staged ("Clinical Elective" → "Elective" → specialty code such as "ID", "H/O", "HM"), applied only when the re-render overflows less and adds no blocker, undoable, source titles untouched. The shell qualifies label repairs by readability instead of the geometry-only rule. `founderConciseRole/Institution` in `founder-display-rules.js`. |
| Display rules | Automatic trim of generic "Clinical " prefixes for display; dotted "M.B.,B.S." keeps its degree flag; ECFMG certification no longer demands a study arrow. |

## Acceptance against the real applicant CV (private evidence)

| Item | Result |
|---|---|
| Correct identity | Headline, profile card, PDF and PPTX all carry the applicant's name and AAMC ID; evidence is the two page-header lines. |
| Explicit dates | All ten experiences with month-precision starts and ends; "Present" as ongoing; education span and degree date distinct. |
| Explicit institutions and locations | All populated; no hospital-name or date questions. |
| Categories | Five US rotations → USCE (high), research elective → Research, volunteer → Volunteer, internship/residency → Work, club captain → Work/Leadership. |
| Review | 36 items: 13 ready (one line each), 23 records, 0 questions, 0 false duplicates. Accept-section and keep-records work. |
| Year domain | Graduate (degree 05/2026) → default 2026, extended to 2025 for the two 2025 electives; 2019 spans clamped at the edge. Axis 2025–2026 instead of 2018–2026. |
| Guardian | Blocked by five overflowing roles → Fix-for-me → READY TO EXPORT (six sections). |
| Save/reopen | Review state and the 36-event document survive reload on the local build. |
| Exports | PDF Letter: one raster landscape page (V1 behaviour). Editable PPTX: 515 KB, 0 inspection errors, 58 text objects, 96 shapes, 7 images, 16 groups; names, dates, concise labels present. |
| Entitlement | `d1-046-current-entitlement` 3/3, `identity-authorization.test.ts` 4/4; the entitlement predicate was not touched. |

## Tests

New: `tests/d1-050-field-repair-myeras-cv.test.mjs` (10 tests, synthetic applicant in the
exact MyERAS layout). Final receipt (`final-test-receipt.txt`, private dir): every intake,
review, display, Guardian, export, layout, privacy and entitlement suite in TEST_MAP passes.
Pre-existing failures unchanged from HEAD and from the dirty baseline: `d1-500-wordpress-
executable` (PHP harness lacks `get_user_by`), `d1-042`, `d1-037`, `d1-026`, `uxr-002-
keynote-renderer`, `d1-021-founder-fidelity-deltas`, `d1-025`, `d1-022`, `uxr-002-themes`,
and the dirty `d1-031` / untracked `d1-032` layout tests (identical with and without this
repair).

## Founder decisions to confirm (none blocking)

1. **2025 electives on a 2026 graduate's Timeline.** Implemented: the domain opens at the
   graduation year and extends back only far enough to keep a bounded experience that
   would otherwise vanish; long background spans are clamped at the edge. Alternative:
   strict graduation-year domain with the earlier electives hidden until manual expansion.
2. **Specialty codes for one-month rotations** ("ID", "H/O", "HM", "Cards Res.") follow the
   Keynote's "IM"/"FM" grammar and are only applied by Guardian on request, undoably.
3. **Entitlement roster includes a synthetic QA account** ("InterviewIQ Discovery QA",
   `@example.invalid`) among the two IV Prep Complete members. Not changed here.
4. **Student B's production document** still contains the placeholder identity and events
   with the applicant's imported entries underneath. This repair prevents recurrence; it
   does not edit that document.

## Follow-up (same day): template photo slots and the interview-day block

Founder request after the first candidate: the three default photo slots, the profile photo
in the summary box, and the top-right interview block (program, scheduled date, logo) must be
present on the Timeline and carried into both the editable PowerPoint and the PDF, with
photos coming from the media library or by click / drag-drop upload.

What existed: all five canonical frames and the interview ribbon were already part of the
2025 design and could be filled, but only on the unlocked Advanced canvas; the Builder
preview and both exports omitted empty frames, so the slots looked absent.

| Change | Where |
|---|---|
| Template slots are painted on every in-app surface (edit canvas, Builder/Home previews, full preview) | `407f-engineering-adapter.js` surface options |
| Exports carry the frames: editable PPTX keeps the DROP PHOTO / PROFILE PHOTO / PROGRAM LOGO prompts so photos can be dropped in Keynote; PDF and PNG paint the same frames with blank apertures (new `emptySlotStyle:"print"`) | `export-adapter.js`, `founder-presentation-serializer.js`, `locked-407f-export.js` |
| Guided-Timeline frame chooser: tapping a polaroid, the profile portrait or the logo well offers Upload a photo, a media-library pick, and (when filled) Replace / Remove; external image files can be dropped onto a frame; the Builder preview's frame taps open the same chooser | `407f-engineering-adapter.js` (`openGuidedFrameChooser`), `advanced-studio.js` (`fillCanonicalMediaFrame` `allowLocked`) |
| Canonical frames fill without an Advanced unlock on the guided Timeline (fixed containers, no geometry change); free placement on the board still requires the unlock, and the Advanced canvas keeps its lock protection | `captureMediaUploadBinding407F` |
| The interview ribbon (canvas and preview) and the logo well open the existing Review & Finish interview editor: program name, interview date, logo upload and position | `openInterviewDetails` |
| The logo well is the logo's single home: a logo uploaded in the interview editor now fills the well, "Remove from this interview timeline" clears it, and the editor's older free placement (a loose image above the ribbon) only serves a Timeline whose well is still empty, so one logo is never painted twice | `specialty-variants.js` `applyActiveSpecialtyVariant`, interview logo handlers in `407f-engineering-adapter.js` |

Tests: `tests/d1-051-template-slots.test.mjs` (frames on screen / editable / print, ribbon with
program and date, guided fill contract, logo-well precedence). Verified in the local build on the
real applicant document: photo 1 filled by upload, the profile portrait filled from the media
library, the program logo filled by upload from the well's chooser, the ribbon carrying the program
and "Interview · Nov 14, 2026"; the editable PowerPoint and the Letter PDF both generated to
"Download ready" with every attached image resolved (the earlier "Export failed" in the Export
screen came from running the export while the Guardian dialog still held the Home view, not from
the frames). A synthetic deck built through the same composer carries the two filled frames and the
logo as images, the DROP PHOTO prompts for the two empty frames and the ribbon text, with zero
inspection errors. Guardian's readability note "Attached images must load before the final export
can be verified" remains the existing pre-export behaviour: it is a review note, not a blocker.

## Release sequence (not executed)

Candidate commit on this branch; `build:release` requires a clean checkout of that commit
plus the accepted-asset authority, so it must run from a fresh worktree at the candidate
SHA per PRODUCTION.md, followed by independent review, fresh leases, backup/restore
boundary and the Founder's deployment approval. WordPress plugin untouched; API untouched.
