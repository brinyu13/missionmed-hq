# IVOC-APPINTEL-8002 — Application Intelligence donor handoff

**Status: donor only. Not production-integrated. Not production-ready by itself.**

- Base SHA: `d65dfaa91e4897ac28e26e4d949fadb55fcf0a46` (verified equal to `origin/codex/ivoc-converge-8001-production` on 2026-09-18)
- Branch: `fable/ivoc-appintel-8002-domain-core` · Worktree: `/Users/brianb/MissionMed_worktrees/ivoc-appintel-8002-fable`
- Donor commit: the single commit at the tip of the branch (`git log -1 fable/ivoc-appintel-8002-domain-core`); a commit cannot carry its own SHA, so the SHA is reported in the implementation response and in the OS registration Codex files.
- Write scope honoured: every changed file is under `ivoc/intelligence/**`. No other path changed.

## Changed files (51, all new)

`ivoc/intelligence/`: `README.md`, `IVOC_APPINTEL_8002_HANDOFF.md`, `index.mjs`, `test-helpers.mjs`, `acceptance.test.mjs`;
`contracts/` (`application-fact`, `attention-signal`, `context-pack`, `pressure-profile`, `director-move`, `index`, `contracts.test`);
`normalize/` (`intake`, `fact-builder`, `intake.test`, `normalizers/{filevault-document, storyforge-stories, rise-program, mcc-priorities, ivoc-longitudinal, timeline-chronology, matrix-applicant-fields}`);
`provenance/receipts.mjs`; `signals/` (`rules`, `consistency`, `salience`, `rules.test`);
`pack/` (`assemble`, `serialize`, `trigger-index`, `assemble.test`, `serialize.test`);
`director/` (`arbitrate`, `triggers`, `semantic-matcher`, `arbitrate.test`, `triggers.test`);
`fixtures/` (7 fictional projections, 1 other-subject projection, 1 pool snapshot, 5 scenarios).

## Implemented capabilities

Source/projection identity and version/freshness receipts; normalized facts with provenance; subject-locked intake; sensitivity/privacy metadata; Interview Attention Signals of four kinds (probe, clarification, strength/interest, consistency check) with stance, salience, confidence, proactive eligibility, reactive triggers, allowed interviewer roles and 1–3 possible probes; Interview Context Pack assembly, versioning (`pack_version` = sha256 of canonical content), invalidation (`packReuseDecision`, `invalidationReasons`) and deterministic budget trimming; actor serialization and role redaction; five-lane Director arbitration with pressure/follow-up policy inputs and Director-safe outputs; provider-neutral `SemanticMatcher` contract with a deterministic test implementation (no model is called).

## Tests and results

`node --test "ivoc/intelligence/**/*.test.mjs"` → **47 passed, 0 failed** (Node v22). Existing F1 suite unaffected (`ivoc/contracts`, `ivoc/core`, `ivoc/brain/prompted`: 10/10). Required behaviours: reactive probe PASS · proactive probe PASS · cross-source PASS · consistency/clarification PASS · pressure policy PASS · question-source policy PASS · privacy/subject separation PASS · malformed/missing input fail-closed PASS · repeatability PASS.

## Input/output contract summary

- In: `matrix.projection.v1` envelopes (validated with the F1 `assertProjectionEnvelope`) whose payloads follow the IVOC-side shapes documented in `normalize/normalizers/*.mjs`; `ivoc.question_pool_snapshot.v1`; session settings (`practice_goal`, style, `pressure_modifier`, `follow_up_intensity`, `target_asked_count`); live answer text (for triggers) and optional live candidates.
- Out: `ivoc.interview_context_pack.v1` (+ `ctxpack:` receipt ref for `session.context_receipts`), `pack.actor_block` (≤ 6 KB, the only application context the Actor may see), `ivoc.director_move.v1` with `lane`, `signal_refs`, `guidance` (≤ 60 words), `rationale_ref`, `memory_delta`, scored `candidates`.

## Privacy and provenance guarantees (enforced in code and tests)

Closed fact types and per-type attribute schemas; prohibited attribute keys (race, ethnicity, religion, disability, health, family status, sexual orientation, gender, age/DOB, visa/immigration, citizenship, …) are dropped and logged, never stored; exam and applicant-field facts are always `restricted`; restricted facts never enter the actor block and are never proactive; `objective_concern` is only a verifiable consistency check, never spoken, hidden from the student view; every fact carries projection id, source version and receipt hash; every signal carries `rule_id` and `rules_version`; every contextual move carries `signal_refs`; one subject per pack (mixing throws); revoked inputs are dropped and invalidate reuse; stale inputs are labelled; probes, rationales and guidance are screened against accusation vocabulary; fixtures are fictional.

## Intentionally deferred (not in this donor)

Persistence, migrations, RLS, routes, the live GPT-Live instruction whitelist change, the Spine/Director hint relay, browser injection, Results "why this was asked", Admin surfaces, consent storage, any owner adapter (File Vault, StoryForge, RISE, MCC/Top 3, Calendar, Timeline, Match Bridge), any model or embedding call, PDF/DOCX parsing (`DocumentExcerptor` is an interface only), Astra UX.

## Unresolved owner assumptions

1. Payload shapes in `normalize/normalizers/` are IVOC's smallest consumable projections; no owner has agreed to them yet (packet §7 classes stand: File Vault OWNER_CHANGE_REQUIRED; StoryForge, RISE, MCC/Top 3, Calendar, Timeline, Matrix applicant fields OWNER_CONTRACT_MISSING).
2. Consent basis: StoryForge stories require `authorization.basis = student_consent` and `consent_state = granted`; other owners are accepted on `owner_policy`/`mentor_assignment`. Codex confirms these bases against the real consent store.
3. Program specialty matching is lexical (`programAffinity`); RISE may supply canonical specialty codes later.
4. **Budget observation for the Architect:** the packet's 32 KB pack cap binds before the 120-fact/24-signal caps on realistic inputs (the fixtures already trigger byte trimming at ~14 facts). Behaviour is deterministic and recorded, but a raise of `PACK_BUDGETS.max_pack_bytes` (or lighter per-fact provenance) is a one-constant decision Fable should rule on before live use.

## Codex integration responsibilities

1. Reconcile this branch against then-current production HEAD; integrate or port selectively (the lane is unreferenced, so a fast-forward merge is conflict-free).
2. Register `IVOC-APPINTEL-8002` and the `ivoc/intelligence/**` PATH lease in MissionMed OS (mission record, decision record) before any production wiring.
3. Resolve real owner projection contracts (File Vault first: consented server projection + CV pointer).
4. Session-start hydration: build the pack at `ready_check`/`armed`, persist it (one additive, RLS-forced migration), pin `ctxpack:` in `session.context_receipts`, extend `normalizeLiveInterviewContext`/`buildLiveInterviewInstructions` with the pre-serialized actor block (stay under the 16 KB cap).
5. Live Spine/Director relay: evaluate triggers + arbitrate server-side per persisted turn, return at most one hint, inject via the data channel before the next response; record `brain.move.v1` with `lane` and `signal_refs`.
6. Production auth, privacy, consent storage, persistence and role enforcement at the API.
7. Live acceptance of the five behaviours with genuine identities and real audio; deploy/fix-forward; ledger (`IVOC_MEGARUN_STATE.md`) update.
