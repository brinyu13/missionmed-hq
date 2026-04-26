# MMOS Context Builder Engine v1.0

**Prompt ID:** (M)-MMOS_CONTEXT_BUILDER_ENGINE-090
**Scope:** System design. This file defines the reusable engine that converts a short, high-level idea into a complete, structured PROJECT CONTEXT fit for the downstream MMOS manual generator.
**Non-scope:** This engine does not generate prompts, steps, workflows, or manuals. It produces CONTEXT only.

---

## 1. Engine Design Explanation

The Context Builder Engine is a deterministic expansion function. Input is a one-sentence idea. Output is a 12-section PROJECT CONTEXT document in a fixed order, written at the level of rigour a senior engineer would use when briefing a project to another senior engineer.

The engine runs three internal stages and does not emit the stage artefacts to the operator; only the final CONTEXT is returned.

Stage 1, IDEA PARSE, tokenizes the input into subject, verb, target system, and implied scope. It asks four parse questions internally: what object is being built or changed, which MissionMed subsystem owns that object, which user-facing surface will change, and which backend surface will change.

Stage 2, DOMAIN LOOKUP, projects each parsed element against the MissionMed domain model. The domain model the engine must carry in context at all times is: single-file HTML client architecture, Supabase as the sole backend, CDN asset delivery, deterministic scoring requirements for any competitive feature, async-first gameplay (neither player online simultaneously unless stated), RLS-enforced data access, and the no-em-dash copy rule. At this stage the engine walks the workspace file inventory (or, when run outside the workspace, the declared inventory from the operator) and assigns each matching artefact to either CURRENT STATE, PARTIAL SYSTEMS, or FILES.

Stage 3, STRUCTURED EMIT, writes the 12 sections in fixed order with the labeling rules enforced: any inferred claim carries a bracketed [ASSUMPTION] tag, any unresolved question is lifted to UNKNOWNS, any blocker that requires a human decision is lifted to DECISIONS REQUIRED, and any testable end-state criterion is written in SUCCESS CRITERIA in verifiable form (a proposition that is either true or false after a test run, not a vibe statement).

The engine is intentionally narrow. It does not design the system it describes, it does not choose between options when UNKNOWNS surface, and it does not generate execution steps. Its sole contract is to produce a clean handoff to the downstream manual generator. A weak Context Builder compromises every downstream deliverable; a strong Context Builder makes one-shot manual generation possible.

---

## 2. The Context Builder Prompt Template (reusable)

Operators paste the idea into the `{{IDEA}}` slot and submit to any Claude-class reasoning model. The template carries the full domain model inline so the engine runs identically in any thread.

```
You are the MMOS Context Builder Engine. Your sole output is a structured PROJECT CONTEXT. You do not generate prompts, steps, workflows, manuals, or code. You produce CONTEXT only.

INPUT IDEA:
{{IDEA}}

DOMAIN MODEL (non-negotiable, always in scope):
- Client architecture: single-file HTML per feature surface
- Backend: Supabase only (Postgres + RPC + RLS + Auth); no custom server processes
- Asset delivery: CDN-based, immutable asset paths
- Gameplay: async-first (neither player online simultaneously unless stated)
- Scoring: deterministic (same inputs produce same result for every observer)
- Data access: RLS-enforced on every table exposed to the client
- Copy rule: zero em-dashes; zero AI writing tells; operator-facing prose reads as written by a senior engineer

EXECUTION RULES:
1. ZERO GUESSING WITHOUT LABELING
   - Inferred claim: mark with [ASSUMPTION]
   - Open question: route to UNKNOWNS
   - Blocker requiring human decision: route to DECISIONS REQUIRED
   - Never fabricate specifics; fabrication is a protocol violation
2. MAXIMUM DEPTH
   - Each section is specific, actionable, and structured
   - Every CURRENT STATE bullet names an artefact or an observable behaviour
   - Every SUCCESS CRITERIA bullet is testable (a proposition with a determinate truth value after a test run)
3. FORCE COMPLETENESS
   - If the input is vague, expand intelligently and surface every open question
   - Do not collapse to a summary; a thin CONTEXT is a failed run
4. FIXED OUTPUT CONTRACT
   - The 12 sections below are emitted in this exact order, with these exact labels

OUTPUT CONTRACT (emit verbatim, in order):

RESULT: COMPLETE
SUMMARY: Context fully expanded and structured for MMOS pipeline.

PROJECT:
<one-line project title that a human would assign to the resulting manual>

CURRENT STATE:
<what exists today that is relevant to this idea; each bullet names an artefact, a behaviour, or a system boundary>

PARTIAL SYSTEMS:
<what is half-built; each bullet identifies the artefact and what is missing from it to count as complete>

MISSING (CRITICAL):
<what must exist for the goal to be reachable but does not exist today; each bullet is an atomic unit of work>

GOAL (FINAL STATE):
<a single paragraph describing the observable end state when the work is complete; written as a post-condition, not as a plan>

CONSTRAINTS:
<domain-model constraints that apply and any additional project-specific constraints; each bullet is a hard limit, not a preference>

FILES:
<named files in the workspace that are inputs, contracts, or authoritative references; path-relative where possible>

RISKS:
<technical, security, data, or UX risks specific to this idea; each bullet states the risk and the failure mode it produces>

ASSUMPTIONS:
<inferred claims the engine made to produce this CONTEXT; each bullet begins with [ASSUMPTION] and is individually falsifiable>

UNKNOWNS:
<open questions the engine could not answer from the idea or the workspace; each bullet is a specific question, not a topic>

DECISIONS REQUIRED:
<blockers that require a human decision before execution can start; each bullet states the decision point and the options in play>

SUCCESS CRITERIA:
<end-state conditions that a verification run can grade as pass or fail; each bullet is a testable proposition>

END OF CONTEXT.
```

---

## 3. Example Output using test input "build async duel system for STAT"

```
RESULT: COMPLETE
SUMMARY: Context fully expanded and structured for MMOS pipeline.

PROJECT:
STAT Async Duel System v1.0

CURRENT STATE:
- Single-player STAT mode is live; UI iterated through v4 (reference artefacts STAT_v1_before.png, STAT_v2_after.png, STAT_v3_after_703.png, STAT_v4_after_703.png)
- Supabase schema scaffold for async duels is drafted in (ST)-STAT-v2-CLAUDE-extra-high-702_Async_Duel_Backend.sql
- Leaderboard RPC is drafted in (ST)-STAT-v2-CLAUDE-high-716_Leaderboard_RPC.sql
- Player stats migration is drafted in (ST)-STAT-v2-CLAUDE-ultra-715_Player_Stats_Migration.sql
- Async duel behavioural spec is drafted in (T)-Duels_TournaMed-claude-opus-high-302_QSTAT_Duel_Async_Spec_2026-04-15.md
- Joint QSTAT plus Daily Rounds launch spec is drafted in (T)-Duels_TournaMed_QSTAT_DailyRounds_Launch_Spec_v1.0.md
- STAT client is a single-file HTML surface served from CDN; authentication propagates from the MissionMed HQ auth module

PARTIAL SYSTEMS:
- Duel backend schema exists in SQL but has not been applied against the live Supabase project and has no RLS policy coverage verified end to end
- Leaderboard RPC exists but is not wired to a duel-resolution trigger; leaderboard does not currently move when a duel resolves
- Player stats table is migrated but the ELO update function is spec-only; no server-side function computes the rating delta
- Async duel spec names a state machine but the state transitions are not encoded in the SQL schema as CHECK constraints or triggers

MISSING (CRITICAL):
- Matchmaking pairing RPC (queue-based or invite-based, see DECISIONS REQUIRED)
- Deterministic question-set selection function keyed on duel ID and player role
- Duel state machine enforcement (pending, active, resolved, expired, forfeited) at the database layer
- Client-side duel view inside the STAT single-file HTML (entry, answer, wait-for-opponent, resolution)
- Expiry and forfeit scheduler or Supabase cron entry
- Notification or polling mechanism to tell player B that player A has submitted
- RLS policy suite proving that a non-participant account cannot read a duel row
- Anti-cheat surface: prevention of answer lookup between submission attempts by player A and player B

GOAL (FINAL STATE):
Two authenticated MissionMed players can start a duel from the STAT lobby, answer the same question set during an agreed expiry window without being online at the same time, and see a resolved outcome on both clients with ELO updated, leaderboard reflecting the result, and all reads and writes enforced by Supabase RLS. Scoring is deterministic so that identical answer logs produce the identical result on every observer. The entire client change fits inside the existing STAT single-file HTML under the current size budget.

CONSTRAINTS:
- STAT client must remain a single HTML file served from CDN
- Supabase is the only backend; no new server processes
- All duel rows and derived tables must be covered by RLS with participant-only read and participant-only write
- Scoring must be deterministic against identical inputs across clients
- Timers and expiry are server-authoritative; client clock is never trusted
- Zero em-dashes in any operator-visible or player-visible copy
- No new third-party dependencies without an explicit MR- approval entry in the activity log

FILES:
- (ST)-STAT-v2-CLAUDE-extra-high-702_Async_Duel_Backend.sql (schema; authoritative unless superseded in this cycle)
- (ST)-STAT-v2-CLAUDE-high-716_Leaderboard_RPC.sql (leaderboard contract)
- (ST)-STAT-v2-CLAUDE-ultra-715_Player_Stats_Migration.sql (player stats contract)
- (T)-Duels_TournaMed-claude-opus-high-302_QSTAT_Duel_Async_Spec_2026-04-15.md (behavioural spec)
- (T)-Duels_TournaMed_QSTAT_DailyRounds_Launch_Spec_v1.0.md (joint launch spec)
- STAT_v4_after_703.png (current UI reference frame for lobby and post-game surfaces)

RISKS:
- Deterministic question-set selection collisions if the seed is derived from duel ID alone without salting per player role, leaking ordering to an attacker who observes both client requests
- RLS gap that allows non-participants to read duel rows, exposing opponent answer logs before resolution
- Transaction race if both players submit simultaneously and the scoring function is not wrapped in a single transactional RPC, producing divergent ELO updates
- Client clock skew used to enforce per-question timers would let a modified client exceed the intended time budget; timers must be server-authoritative
- Abandoned duels accumulating in pending state will bloat the matchmaking queue and degrade pairing latency over time
- Leaderboard write amplification if every duel resolution fires a full recompute rather than an incremental update
- Copy drift: any operator-visible string generated by Claude threads during execution may introduce em-dashes, violating the no-em-dash rule

ASSUMPTIONS:
- [ASSUMPTION] The Supabase schema drafted in 702.sql is the current source of truth and has not been rolled back by a later migration
- [ASSUMPTION] The STAT question bank is already tagged with difficulty metadata sufficient for paired selection; if not, a tagging pass is a dependency
- [ASSUMPTION] Player authentication is already handled by the MissionMed HQ auth module and the JWT propagates to Supabase; STAT does not need its own auth surface
- [ASSUMPTION] ELO starting rating is 1000 and the K-factor is fixed at the value named in the 302.md draft spec
- [ASSUMPTION] The existing STAT single-file HTML has remaining size budget for the duel view; if it does not, a separate file or a router is required

UNKNOWNS:
- What is the expiry window for an async duel (24 hours, 48 hours, 7 days, player-configurable)
- Are duels targeted (player-to-player invite) or queue-based (random pairing) or both
- Is the question set shared across the duel (same N questions for both players) or independently sampled per player
- Are ties allowed, and if not, what is the tiebreaker policy (sudden-death question, first-submitter wins, average response time)
- Is spectator mode in scope for v1
- What is the v1 notification channel (in-app polling on lobby open, Supabase realtime subscription, push, email)
- Does the duel resolution update the TournaMed or Daily Rounds surfaces, or only the STAT leaderboard

DECISIONS REQUIRED:
- Pairing model selection (targeted invite only, queue-based random only, or both) before the matchmaking RPC can be written
- Expiry window and forfeit rule selection before the state machine can be encoded
- Question-set policy (shared versus independent sample) before the deterministic selection function can be written
- Tiebreaker policy selection before the scoring function can be closed
- v1 notification mechanism selection before the client wait-for-opponent surface can be built
- Scope call on whether duel resolution must update TournaMed and Daily Rounds leaderboards or only STAT

SUCCESS CRITERIA:
- Two staging test accounts can complete an end-to-end duel in the staging Supabase project with identical scoring when replayed against identical answer logs
- An RLS audit run with a non-participant account returns zero rows from the duel table for any in-flight duel row
- Leaderboard reflects the duel outcome within 60 seconds of the second submission in a staging run
- An expiry run executed against a duel with one submission correctly transitions the row to forfeited and awards the win to the submitting player with no manual intervention
- The STAT client bundle after the change remains a single HTML file and stays at or below the pre-change byte size budget
- A full grep of the shipped client and server SQL returns zero U+2014 em-dash characters and zero U+2013 en-dash characters
- A simultaneous-submission stress test with both players submitting inside a 100 ms window produces a single resolved row with a consistent ELO delta

END OF CONTEXT.
```

---

## 4. Engine Invariants (enforced on every run)

The engine run is considered successful only when every invariant below holds. A run that violates any invariant is a failed run and must be regenerated, not patched.

The 12 sections are emitted in fixed order with the exact labels given in the output contract. Any reordering, omission, or relabeling is a protocol violation.

Every claim in CURRENT STATE, PARTIAL SYSTEMS, and FILES either names an artefact that exists in the workspace or is tagged [ASSUMPTION]. The engine does not invent artefact names.

Every bullet in SUCCESS CRITERIA is a proposition with a determinate truth value after a test run. Statements that read as aspirations rather than tests are rewritten or demoted to GOAL.

Every UNKNOWN is a specific question, not a topic. "Notification strategy" is a topic; "what is the v1 notification channel" is a question.

Every DECISION REQUIRED names the options in play. A decision point without options is not actionable and is rewritten.

Zero em-dashes (U+2014) and zero en-dashes (U+2013) are present in the emitted CONTEXT. The engine treats these characters as banned tokens.

The CONTEXT is self-contained. A downstream manual generator reading only the CONTEXT and the domain model must be able to generate a complete manual without loading any additional prior thread context.
