# Canonical Drills v3 Logic

## Accepted runtime owner

The latest accepted live Drills v3 owner is the 070B R2 artifact with SHA-256 `d14aab14802c51c440d85b3cb019d7812f6aeee79a36a256983d63e8c0daf2f6`. Its accepted route is `/drills?entry=daily_rounds&mode=daily_drills_v3` through the WordPress proxy to `html-system/LIVE/daily_drills_v3.html`. The exact accepted rollback copy is `MM-DRILLS-V3-SCHEDULE-BACKFILL-062/_ROLLBACKS/MM-DRILLS-V3-PAUSE-POINT-REGRESSION-070C/daily_drills_v3.070B.usable.before-070C.html`.

The detector slice at lines 2397–2589 has SHA-256 `561abe4b6c4d5a8d625605ed4059de4182e8f552e1d0e27268c158ca7196a07d`. The latest exact commit-backed detector source is commit `86df235045f501ac58b7af6070dfc509bdbe2712`.

## Observed behavior

The runtime normalizes Nodes entries, merges consecutive exact speaker labels into whole turns, and constructs a candidate at a Dr-to-non-Dr speaker transition when the instructor turn is not filtered and at least five seconds have elapsed since the prior accepted candidate. A second heuristic scores structural markers, question words, punctuation, clinical vocabulary, imperatives, and length. Only Nodes are fetched for this detection path; the registry transcript URL is carried but is not used by the live detector.

The accepted runtime does **not** perform roster-backed student-name matching, semantic student-call sequence reconstruction, or primary/follow-up classification. Its queued “follow-up” behavior is a chronological runtime queue, not a semantic question role. The 070C multi-queue/student-preservation experiment was rolled back and was not accepted as live behavior.

## Proven limitations

Accepted 071 diagnostics show the stored Nodes payloads are transcript-segment mirrors rather than curated pause nodes. Proven loss points include same-speaker question collapse, valid short-question filtering, broad filler filtering, suppression of rapid follow-ups inside five seconds, Dr-to-Dr sequence loss, exclusion of student questions, and whole-turn capture that can mix questions with teaching or answers. The runtime prompt counter counts loaded prompts rather than canonical medical questions.

## Reuse decision

The Gold Set pins the accepted runtime artifact and detector hashes for comparison and compatibility evidence. It reuses timestamp normalization and deterministic runtime-comparison behavior. It does not treat the lossy live detector as Gold truth. Gold extraction is transcript-grounded, preserves rapid follow-ups, reconstructs explicit student-call sequences, and binds every retained question to source spans. Historical `DRJ_SEGMENT_BOUNDARY_V1` roster/name code is design evidence only because current production artifacts were proven not to carry that ruleset.

No runtime, CDN, R2 object, registry, bootstrap, auth path, or production source was modified.
