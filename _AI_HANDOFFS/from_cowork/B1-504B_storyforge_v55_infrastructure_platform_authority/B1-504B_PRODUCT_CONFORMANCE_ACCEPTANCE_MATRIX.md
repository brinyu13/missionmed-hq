# B1-504B · Product Conformance and Acceptance Matrix

Labels per the Infrastructure Authority Lock. Authority artifacts: canonical V5.5 prototype SHA `0df61b56...`, r2 copy revision SHA `95104069...` (ships only under the approved retention ruling), canonical V5 parent SHA `3ac2871f...`. Codex compares implementation against the artifacts directly; memory reconstruction is forbidden. B1-504A's acceptance matrix A1..A25 + A17b/A17c is carried in full and remains binding; this document adds the conformance method and the consolidated PASS ledger.

## 1. Conformance method (AA)

- Deterministic browser comparison: Playwright screenshot matrix at 1440x900 and 390x844 for every changed surface (home hero, capture sheet in all five dock states, review with chips, recovery banner, story room audio card, admin release panel) against the canonical prototype rendered at the same viewports; plus the existing 72-surface flag-off suite against the V5 baseline.
- Terminology and copy: string-level assertions for every PA-immutable string (dock states, privacy copy, retention copy, consent notice, delete confirm, error states). Copy source of truth: the prototype artifact + the bounded-delegation strings in the B1-504A Authority Lock.
- Human review: founder walkthrough at S12/S13 constitutes the emotional-character check; founder notes become either accepted-delta records or defects.
- Delta ledger (complete, binding): (1) the 390 px bottom-nav clip fix, ships unflagged, the ONLY delta against canonical V5 flag-off surfaces; (2) the authority-extension surfaces whose exact strings and placement are fixed by bounded delegation and are therefore APPROVED additions, not defects: delete-audio control + confirm dialog, first-recording consent notice, 18:00 countdown state, aria additions, the fixed error-copy set (Frontend Map), and the admin Release Controls panel, which is EXEMPT from the pixel matrix (the prototype panel is interaction authority only; its production controls are specified in the Frontend Map). Everything else visible or behavioral is a defect until a Fable authority amendment approves it with a new artifact revision.

## 2. Conformance rows (validated against the prototype artifact)

Visible screens and hierarchy; responsive behavior at both controlled viewports; terminology; recording workflow (idle -> arming -> recording -> paused -> review); interruption recovery (banner content includes duration and word count); transcript appearance (same textarea, ghost line styling); merge behavior (no duplicated words across pause/resume, prototype QA case reproduced); medical-term review (chips render only with real signals; tap-applies; Fix all when > 1); save behavior (private by default, original telling preserved immutably, working copy editable); privacy copy (approved retention strings; consent notice); audio player (single continuous control regardless of assembly option); delete behavior (confirm strings; transcript intact; card removal; toast); submission boundary (mentor sees only submitted; recordings never); mentor playback (assigned + submitted only); flag behavior (off = typing-only V5.5 with the single enumerated delta); accessibility (axe pass no regression; dock aria-labels; timer aria-live polite); error states (fixed truthful copy set).

## 3. Acceptance gate ledger (release cannot ship with any row open)

| Domain | PASS definition | Source rows |
|---|---|---|
| Product conformance | Section 2 all green + delta ledger matches Section 1 exactly | screenshots + string tests |
| Functional | full voice flow on founder + test-student accounts, desktop and mobile | A2..A14 |
| Authorization | all denial rows incl. foreign attach and session endpoints; mentor and admin boundaries | A1, A17, A17b, A17c, A19, A20 |
| Privacy | deletion proofs incl. a cancelled take's transcript ABSENT from sf_recording_segments (database purge proof), expired signatures, log-content sweep clean, a targeted E13 assertion that the health surface emits counts and states only and can never carry another student's content, provider posture evidence filed | A15, A16, A18, purge query, E13 content test, RP-12 |
| RLS | postgres suite incl. FORCE RLS proofs on new tables | suite |
| R2 | bucket denial proofs, CORS proofs, TTL expiry proof, lifecycle sweeps observed | Storage Spec Section checklist |
| Transcription | bake-off thresholds met by locked primary (or fallback path invoked with founder notice); truthful outage drill | RP-11, drill 17 |
| Rollback | A21 scope-off drill, A22 env kill (legacy endpoints included, playback/delete exempt), Kinsta and Railway rollback rehearsed | A21, A22, runbook 24 |
| Interoperability | platform contract tests green (field inclusion AND exclusion assertions, denial paths, purpose checks); `STORYFORGE_PLATFORM_OFF` honored | contract suite |
| Browser | matrix rows on real devices; word-loss bound at segment boundaries | A6..A8, 16 |
| Production observation | windows 1 and 2 complete without threshold breach | runbook 19/21 |
