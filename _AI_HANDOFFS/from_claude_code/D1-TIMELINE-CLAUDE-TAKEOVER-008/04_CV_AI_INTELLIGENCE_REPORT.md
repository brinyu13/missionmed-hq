# 04 — CV / AI Intelligence Report

Ticket §7 is explicit: if a student uploads a detailed CV and then has to re-enter obvious
dates and classifications, the feature has failed. **Production has no AI provider
configured**, so the local deterministic parser *is* the product today. It was, on three
counts, doing exactly what §7 forbids.

## Fixed in this run — each verified by executing the real modules

### C-01 — Date ranges without spaces yielded no dates at all (BLOCKER)
`normalizeDateRange` split on `/\s+(?:-|–|—|to|through|until)\s+/i`, requiring whitespace on
**both** sides, while `cv-parser` captured ranges with `\s*`. The two regexes disagreed, so
the overwhelmingly common CV forms produced blank start *and* end dates, and
`validateCandidateForApproval` then refused approval until the student hand-typed both.

A pre-normalisation step inserts the spaces only when the dash is followed by another date
token, so ISO values are untouched. Verified:

| Input | Before | After |
|---|---|---|
| `07/2021-12/2022` | start=null | 2021-07 → 2022-12, HIGH |
| `Jan 2023-Jun 2024` | start=null | 2023-01 → 2024-06, HIGH |
| `2021-2023` | start=null | 2021-01 → 2023-12, MEDIUM (year-only, flagged) |
| `March 2020-Present` | start=null | 2020-03 → open-ended, HIGH |
| `2023-01`, `2023-01 to 2024-06` | unchanged | unchanged |

### C-02 — Research at a university was classified as Education (BLOCKER)
The education rule tested `university|college` against text that *included the employer
name*, and ran before the research rule. Research assistants overwhelmingly work at
universities, so essentially every research entry landed in the Education category and the
review card then demanded "Medical school", "Degree" and "Medical school country" for a
research job.

The research-section rule now runs first, and `university|college|secondary school` only
implies education when it appears in the entry's own **title**.

### C-03 — Every US rotation was quarantined as unclassified (BLOCKER)
`structuredLocation` never looked at `organization`, but ordinary (non pipe-delimited) CV
text leaves `location` empty and puts `"Mount Sinai Hospital, New York, NY"` in
`organization`. So `hasUnitedStatesContext` was false for every ordinary CV and each
observership/externship became UNCLASSIFIED in Work Experience with a low-confidence badge.
USCE is the single most important thing on an IMG timeline.

**Note on the fix:** the proposed remedy — appending `organization` to the joined location
string — is *wrong*, and I caught it because it broke two existing tests. The US state
regexes are anchored to the END of the string they are given, so appending the organization
after "Boston, MA" pushes the state code into the middle and stops it matching. Each
candidate is now tested independently instead.

Verified, with the conservative guards deliberately preserved:

| Case | Result |
|---|---|
| Observership · `Mount Sinai Hospital, New York, NY` (org carries geography) | OBSERVERSHIP / th |
| Observership · location `Boston, MA` (pipe-delimited CV) | OBSERVERSHIP / th |
| Observership · `Civil Hospital, Karachi, Pakistan` | UNCLASSIFIED (correct) |
| Observership · `Mount Sinai Hospital` (no geography) | UNCLASSIFIED (correct) |
| Explicit non-US country + US-looking site | UNCLASSIFIED (correct) |
| `Dean's Award` (the ticket's own example) | AWARD_HONOR, **not** Work |
| `MBBS, Bachelor of Medicine` | MEDICAL_DEGREE |

## Confirmed but NOT fixed — remaining §7/§8/§9 gaps

- **C-04** — The extracted employer / medical school never reaches the event's `siteName`
  (`intake.js:583`), so the institution is dropped on the floor after being parsed.
- **C-05** — Title and organization are swapped for education-style blocks: the school
  becomes the title and the degree becomes the school (`cv-parser.js:55`).
- **C-06** — The §9 AI quality-review layer **is computed on the server and then discarded
  by the client** (`intake-d1-408-adapter.js:567`). The feature effectively exists but is
  never shown; this is the cheapest large win remaining.
- **C-07 / C-08** — Title-case headings that are not exact aliases are never recognised, and
  section context resets to "unknown" at every page boundary — so a two-page CV loses its
  section context and with it much of the classification accuracy.
- **C-09** — HIGH/MEDIUM/LOW confidence is computed everywhere but drives **no differentiated
  UI behaviour** (`intake.js:1048`). §8's three decision classes (auto-prefill / prefill and
  confirm / smallest targeted question) are therefore not actually implemented in the UI,
  even though the data to drive them exists.
- **C-10** — The internal flag `mappingReviewRequired` leaks into the student's editable
  field list.
- **C-11** — `"Sept. 2019"` (abbreviated month with a period) is unparseable.
- **C-12** — Within-document duplicate and conflict detection never runs in the shipping app.

## Provenance and the AI provider

Provenance (source document, section, evidence span, parser version, page number) *is*
stored per candidate and survives into `fields.sourceProvenance` — that part of §8 is real.
Production still lacks `TIMELINE_AI_PROVIDER`, `TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`
and `TIMELINE_AI_CONSENT_VERSION`. **All four absent is a safe local-limited mode; partial
configuration stops service startup.** Installing them is a Founder action — the values must
not pass through this session.

## Honest status against §14 (production CV test)

Not performed end-to-end. The parser-level behaviour above is verified by direct execution,
but a full live journey — upload → extract → classify → review → accept → timeline populates
→ save → reload → export — was not run against production, because production requires an
authenticated student session that was not available in this run.
