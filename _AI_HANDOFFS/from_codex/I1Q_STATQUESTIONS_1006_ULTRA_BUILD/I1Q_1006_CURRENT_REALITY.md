# I1Q 1006 Current Engineering Reality

## Runtime ownership

- VERIFIED: Root `package.json` starts `missionmed-hq/server.mjs` and has no current I1Q application entry.
- PROTECTED: MissionMed HQ and its server are protected active runtime surfaces.
- VERIFIED: `missionmed-hq/question_selector.mjs` selects mutable DBOC interview questions. It is not a reusable STAT question-pool selector.
- VERIFIED: There was no dedicated Question Platform application before this run.

## Datastore and migration reality

- VERIFIED: The data-flow contract assigns STAT duels and `dataset_questions` to RANKLISTIQ Supabase.
- VERIFIED: `dataset_questions` has the frozen nine-field projection, with composite key `(dataset_version, question_id)`.
- VERIFIED: A later staging migration adds `quality_tier`, but that field is not part of the frozen export projection.
- VERIFIED: `question_metadata` uses `question_id` alone as primary key and has no foreign key to dataset version.
- INFERENCE: Current `question_metadata` can collide across dataset versions and its default `1.0` does not match `v4` or `v5_tier_a`.
- PROTECTED: The repository Supabase migration tree is governed by a forward-only protocol and was not changed.

## STAT contracts

- VERIFIED: Public STAT code requests runtime, indexes, and lookup JSON from CDN paths.
- VERIFIED: Current runtime normalization accepts public correct-answer fields.
- VERIFIED: Current sealed-pack RPCs keep `answer_map` out of pre-finalization envelopes and score server-side.
- VERIFIED: The actual answer map is an ordered array of `{id, answer}` records, despite older map wording.
- INFERENCE: Public answer-bearing runtime JSON and sealed duel IDs create an unresolved anti-cheat exposure risk for any future adapter.
- INFERENCE: Frozen seven-field canon, actual RPC wrapper, and client-normalized pack need an explicit reconciliation decision before cutover.

## Drills contracts

- VERIFIED: Daily requires `video_id`, `title`, `playback_url`, `nodes_url`, and `transcript_url`.
- VERIFIED: Drills normalizes the same URL-backed source shape, requires nodes, and is more tolerant of transcript absence than Daily.
- VERIFIED: Nodes accept flat arrays and common `drill_nodes`, `drillNodes`, or `nodes` wrappers.
- VERIFIED: Transcript normalization accepts arrays under common segment/chunk keys and common text/time aliases.
- BLOCKED: No unprotected canonical I1Q producer endpoint for that contract exists.

## Auth, deploy, and rollback

- PROTECTED: Current auth/session and MissionMed HQ extension points require a decision record before modification.
- UNKNOWN: No current authority routes I1Q to a canonical internal host, auth adapter, database project, or deployment pipeline.
- VERIFIED: No Railway, WordPress, Supabase, CDN, R2, or production deployment action occurred.
- VERIFIED: The candidate startup denies every protected API unless an identity resolver is injected or localhost synthetic-demo mode is explicitly enabled.

## Test and UI tooling

- VERIFIED: Node 24 is available. The candidate uses Node's built-in test runner and no new dependency installation.
- VERIFIED: Browser automation was performed through the in-app browser at 390, 1024, and 1440 pixel widths.
- VERIFIED: The root declares `jsdom`, but it was not installed in this worktree; UI checks were made dependency-free.

## Additive execution map

1. VERIFIED: Isolated service, schemas, local UI, pipeline contracts, exports, and tests in `i1q-question-platform/`.
2. OPEN: Ratify registration patch and protected integration decision.
3. OPEN: Bind canonical internal identity and datastore through approved adapters.
4. OPEN: Preview migration on an approved branch or staging database.
5. OPEN: Authorize read-only media inventory after privacy ownership.
6. OPEN: Run real pilot, then adapters, staging, rollback, and canary.
