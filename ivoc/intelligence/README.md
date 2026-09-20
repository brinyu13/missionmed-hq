# IVOC Application Intelligence — pure domain core (lane `ivoc/intelligence/**`)

Mission `IVOC-APPINTEL-8002` · Base `d65dfaa91e4897ac28e26e4d949fadb55fcf0a46` · Branch `fable/ivoc-appintel-8002-domain-core`
Specification: `IVOC_FABLE51_REMAINING_ARCHITECTURE_AND_DONOR_PACKET.md` §3–§6, §12 (Fable 5.1, 2026-09-18).

This lane is a **donor**. Nothing in production imports it. It has no routes, no
database, no provider calls, no DOM, no Railway, no migrations. Codex integrates it
after reset (see `IVOC_APPINTEL_8002_HANDOFF.md`).

## Pipeline

```
matrix.projection.v1 envelopes ─► normalize/intake        (facts + SourceReceipts, subject-locked, fail-closed)
                               ─► signals/rules           (ais_rules@2026-09-18.1 → InterviewAttentionSignals)
                               ─► pack/assemble           (versioned, budgeted InterviewContextPack + actor block)
                               ─► director/triggers       (reactive lexical matching, browser-safe)
                               ─► director/arbitrate      (five-lane DirectorMove, Founder law encoded)
```

Schemas (fixed): `ivoc.application_fact.v1`, `ivoc.attention_signal.v1`,
`ivoc.interview_context_pack.v1`, `ivoc.pressure_profile.v1`, `ivoc.director_move.v1`.
Receipt ref for `session.context_receipts`: `ctxpack:<pack_id>@<pack_version>`.

## Purity rules

- Only `provenance/receipts.mjs` imports from Node (`node:crypto`). `pack/trigger-index.mjs`,
  `pack/serialize.mjs`, `director/triggers.mjs` are browser-safe.
- Reads `../contracts/projection-envelope.mjs` and `../contracts/question-pool.mjs` from the
  F1 lane; never writes there. `ivoc/contracts/index.mjs` is untouched (production-load-bearing).
- No `red_flag` concept exists. `stance ∈ {interviewer_plausible, objective_concern}` and
  `sensitivity ∈ {routine, guarded, restricted}` are the only judgment fields; restricted is
  never proactive; objective_concern never reaches the Actor.
- Documents never enter as text. Owners (or a later `DocumentExcerptor`) deliver typed
  entries/claims/statements; the payload shapes are documented at the top of each file in
  `normalize/normalizers/`.

## Run

```
node --test "ivoc/intelligence/**/*.test.mjs"      # 47 tests, Node 22
```

## Module map

| Path | Purpose |
|---|---|
| `contracts/` | assert functions and constants for the five schemas; `resolvePressureProfile` |
| `normalize/intake.mjs` | envelope validation, subject separation, revocation/freshness, routing |
| `normalize/normalizers/*.mjs` | payload → facts for filevault.document_projection, storyforge.approved_stories, rise.program_cheat_sheet, mcc.priorities / ivoc.mentor_priorities, ivoc.longitudinal_summary, timeline.chronology, matrix.applicant_fields |
| `provenance/receipts.mjs` | canonical JSON, sha256, fact/signal/pack identity, invalidation reasons |
| `signals/rules.mjs` | AIS-R01…R12; `signals/consistency.mjs`, `signals/salience.mjs` |
| `pack/assemble.mjs` | `assembleContextPack`, `packReuseDecision` (byte- and count-budgeted, deterministic) |
| `pack/serialize.mjs` | `serializeForActor` (≤ 6 KB block), `redactForRole` |
| `director/triggers.mjs` | `evaluateReactiveTriggers`, `evaluateLiveConsistency`, duration extraction |
| `director/semantic-matcher.mjs` | provider-neutral `SemanticMatcher` contract + deterministic/unavailable implementations |
| `director/arbitrate.mjs` | `arbitrate`, `createMemory`, `applyMemoryDelta`, lane priors, share correction |
| `fixtures/` | fictional projections, pool snapshot and the five scenario files |

## Budgets (from the packet, enforced in code)

Pack ≤ 32 KB canonical JSON; facts ≤ 120; signals ≤ 24 (10/6/6/4 by kind); fact line ≤ 30
words; probe ≤ 25 words; actor block ≤ 6 KB; trigger index ≤ 200 entries. When the byte
cap binds, unreferenced facts (oldest first) are dropped, then strength signals, then the
lowest-salience signals; every drop is recorded in `budgets_applied`.
