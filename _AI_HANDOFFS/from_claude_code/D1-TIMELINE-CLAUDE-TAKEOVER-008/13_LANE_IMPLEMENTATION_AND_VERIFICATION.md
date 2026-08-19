# 13 — Lane Implementation and Adversarial Verification

Four specialist lanes implemented on **disjoint file sets** (the lead held
`kernel-host.js`, `canvas.js`, and the two adapters). 52 changes total. Each lane's work
was then handed to an independent agent instructed to **refute** it by reading current
bytes and executing the code — not by trusting the report.

Machine-readable detail: `evidence/CONTINUATION_LANE_RESULTS.json`.

## Why the verification pass earned its cost

All four lanes' edits were real, in-scope, and left the suite green. Every verifier still
returned `workingAsClaimed: false`, and three of the findings were changes that made the
product **worse than the bug they replaced**. A green suite would have shipped all three.

### 1. The parser began stating wrong institutions with confidence (SEVERE)

The CV-AI lane made a dated line with no organization adopt its preceding line. In the very
common layout where the institution sits *below* the dated line, this shifted **every**
institution up one entry, and a trailing institution was silently dropped. It also promoted
prose to organization — the verifier reproduced an approved event whose institution was
"Shadowed attendings in the cardiac catheterization laboratory".

At `HEAD` those fields were merely blank. The change converted *missing* into *confidently
wrong*, and because those entries land in the HIGH-confidence lane, a student sweeps them
into their timeline with one click. The lane's own tests only used the institution-above
layout, so they passed.

**Fixed:** the pairing direction is decided once per section (from whether the section's
first line is dated) rather than guessed per entry, and prose is rejected. A second pass was
required: matching verb *stems* wrongly rejected ordinary job titles — "**Rotating**
Internship" and "**Research** Assistant" — so only past-tense duty verbs now count as prose.

Verified across all three layouts: institution-below pairs correctly, institution-above
still works, prose is not adopted, and the two-page CV fixture produces all 12 records.

### 2. Drag-to-canvas announced a success that never happened (CRITICAL)

The studio lane's new payload set `action:"place"`, which no drop handler branch accepts —
so the drop was a no-op. But because the payload's `kind` changed to `"insert"`, it now
passed the guard that used to reject it, and the shell fired
`toast("Added to your timeline")` unconditionally. The student-visible change was from
"nothing happens" to "nothing happens while the app claims it worked."

**Fixed:** dragging an object the student already owns is now genuinely handled
(`placeAdvancedObjectAt` was written but never wired), `onAssetDrop` reports whether it
acted, and the confirmation only appears when something actually landed.

### 3. The new Smart Fill review surfaces had no CSS at all

Zero rules existed for `.intake-suggestions`, `.candidate-lane`, `.needs-help` and six other
new classes, so the "Before you review" panel, the three confidence lanes and the compact
low-confidence card rendered unstyled — and wrapping cards in `.candidate-lane` took the
card gap with it. **Fixed**, matching the existing intake card styling.

### Also corrected

- `dist-api/server.mjs` — the bundle `npm start` actually runs — was built from an
  intermediate state and still contained the cross-student existence oracle the File Vault
  fix was meant to close. Rebuilt; `FILE_VAULT_INGEST_OWNER_REQUIRED` is gone and the
  indistinguishable 404 is present.
- A base64 change was described as "~40% lower peak memory"; the verifier measured it as
  ~25% *slower* and ~2.4 MB *heavier* on Node 24. The code is correct and has a genuine
  native fast path, so it stays — the false claim was corrected instead.

## What the lanes genuinely delivered

**Smart Fill** — the server AI quality review is wired into the workflow instead of being
discarded; confidence now drives three distinct behaviours (one-click bulk accept for HIGH,
confirm for MEDIUM, minimal targeted questions for LOW); the parsed institution reaches the
event; title-case headings are recognised; section context survives page breaks; "Sept. 2019"
and full ISO dates parse. The verifier independently confirmed each of these by execution.

**File Vault** — ingestion carries the real student principal instead of a forged SERVICE
one. The verifier executed the path: ingest 201 with a STUDENT owner, cross-owner and
missing both byte-identical 404s, >20 MB 413, delete 204 with bytes released and a victim's
object untouched, forged SERVICE 403, bad SHA-256 400, and no `storageKey` in any response.

**Student language** — one translation layer between internal errors and the screen; the
toast is a polite live region; the boot gate, media library and responsive banner speak to a
student.

**Studio/export** — export blocked-reasons are human and actionable, the interstitial always
clears its `inert`, and rail thumbnails are constrained.

## Lane claims that did NOT survive verification

Recorded so nobody re-reads them as delivered:

- **Grouped-text containment is still breakable.** `resizeAdvancedGroup` never re-clamps a
  text child inside the resized container, so a row near the bottom of a Color-Key-style box
  hangs outside after a proportional shrink (measured 10px at 0.5 scale, 21px at 0.1). The
  lane's test used only a top-anchored label.
- **Position/size and wrapping controls are inert.** `onGeometry` has no shell
  implementation and no renderer reads `item.wrap`; both render and change nothing.
- **D-12 not delivered** — the chooser still makes the redundant detail round trip.
- **Duplicate flags can appear three times** in SERVER_AI mode.
- Staging/production `putOwnedObject` have no test coverage, so the claimed regression guard
  does not exist (the implementations are correct — the verifier wrote tests and they pass).
