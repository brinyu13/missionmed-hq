# B1-504B · Production Deployment and Rollback Runbook

Labels per the Infrastructure Authority Lock. Operator: Codex under B1-506 authority, founder present for S12/S13, the G7 retention/copy gate, and S18/S20 activations. Every step produces filed evidence; a zero exit code is never success by itself.
Naming convention (binding): runbook steps are S1..S24 (the table's # column). Gate letters G0..G10 refer to the B1-504A gate scheme; G7 (retention/copy agreement) and FG-n founder gates keep their names. FG-2 (cohort activation) covers BOTH S18 (narrow pilot cohort) and S20 (full 360): any activation that reaches real students beyond designated testers requires it.
Retention-copy release mechanics (binding): FG-1 is next-action number one and is expected to be ruled before the frontend build (S10). G7 PRECONDITION, explicit: the FG-1 ruling must include the deactivated-student wind-down decision (Infra Lock Section 6, PROPOSED) or an explicit acceptance of the account-closure fallback; the retention copy may not reach any cohort before that ruling exists. If FG-1 is ruled by S10: the S10 release carries the approved copy (r2 strings + delete control + consent notice, or the permanent-retention variant). If FG-1 is still open at S10: S10 ships the ORIGINAL copy with no delete control (default-safe), S12..S17 proceed, and a step S10b (second Kinsta immutable release carrying the ruled copy, plus flag-off conformance re-run) executes after FG-1 and before S18. Both paths are pre-authorized; Codex never chooses copy.

## 1. Deployment sequence (binding order; commands named where they exist today)

| # | Step | Tool/command (VST where named) | Gate/stop condition | Evidence |
|---|---|---|---|---|
| 1 | Baseline lock | `git status` clean apart from the committed authority folders; branch = the exact branch recorded by RP-2 evidence (no other branch qualifies); hash-verify canonical V5, V5.5, r2, B1-504A/B manifests | any mismatch = STOP | hash log |
| 2 | B1-503 conformance baseline | run existing suites: `npm test`, `npm run test:postgres`, `npm run test:e2e`, conformance runner `scripts/run-conformance.sh` | any failure = STOP (baseline broken is a BLOCKER to Fable) | suite outputs |
| 3 | B1-505 fresh read | read COMPLETED handoff + access receipt; quote cohort values | absent/partial/failed = access lanes STOP (build lanes continue) | quoted extract |
| 4 | Backups | Kinsta recovery point; PG dump + RESTORE REHEARSAL (B1-503 discipline); Railway variable export; WP plugin + `missionmed_storyforge_settings` option export | rehearsal failure = STOP | receipts |
| 5 | Secrets and ownership | RP-5/6/7 evidence: Railway vars present list, R2 buckets + scoped token, `STORYFORGE_OPENAI_API_KEY` set; `npm run scan:secrets` | missing = provision per specs; scan failure = STOP | redacted inventory |
| 6 | Bake-off (RP-11) or accepted prior evidence | per Transcription Lock; decision record filed | any threshold miss = the Transcription Lock's single outcome table governs (no other path) | `BAKEOFF_DECISION_RECORD.md` |
| 7 | Migrations M1, M2 | `scripts/apply-production-migrations.sh` (guarded runner), order fixed | validation queries (DB spec Section 4) mismatch = STOP + rollback packet | query outputs |
| 8 | Backend dormant deploy | Railway deploy of the API build (`npm run build:api` path) | `/healthz` green; scope `off` probes: E1 and legacy presign/confirm return `voice_disabled` | probe captures |
| 9 | Backend test pass | unit + postgres suites incl. new RLS tests; platform contract tests with `contract-test` consumer | any failure = STOP | suite outputs |
| 10 | Frontend hidden deploy | `npm run build:release` + Kinsta immutable release + pointer install script | flag-off conformance: 72-surface suite passes with EXACTLY the enumerated nav-fix delta | conformance report |
| 11 | Product-conformance comparison | screenshot matrix vs canonical V5.5 at 1440x900 and 390x844 (Conformance doc) | unapproved delta = defect, STOP | screenshot set |
| 12 | Founder-only activation | E11 scope `allowlist` = the founder PILOT account UUID only. Two-account rule: the pilot account keeps its `student` override and does the testing; a SEPARATE founder-controlled account receives the `admin` override (R-8 settings change, backup-first) and operates E11/E13 | flag audit event present; both accounts documented | audit row |
| 13 | Founder full-workflow test | acceptance A2..A22 on the founder PILOT (student) account, desktop Chrome + iPhone Safari | any privacy/auth failure = kill + STOP | per-row evidence |
| 14 | Designated student tests | scope `allowlist`; abbreviated matrix incl. second-device recovery | same | evidence |
| 15 | Denied-identity tests | ineligible account, foreign-session/attach/object probes (A1, A17b/c) | any success = kill + STOP (P0) | captures |
| 16 | Browser matrix | desktop Safari + Android Chrome capture rows | word-loss/interruption gates | device evidence |
| 17 | Failure drills (environment and method PER DRILL, no operator improvisation): mic denial = deny permission on a fresh founder-device profile (production); app switch/screen lock = real devices (production, founder scope); network loss = browser devtools offline 20 s (production, founder scope); provider outage = CONTROLLED environment only, adapter env `STORYFORGE_TRANSCRIBE_PROVIDER=none`, verifying the truthful cannot-transcribe state and later retry; R2 outage = CONTROLLED environment only, revoke the STAGING bucket token; reload recovery = production founder scope; deletion + rollback drills A21/A22 = production founder scope | each drill passes its truthful-state criterion | captures |
| 18 | Pilot cohort activation | scope `cohort` with ONE B1-505 cohort value (narrow pilot) | G7 retention/copy gate satisfied first | flag audit + copy screenshots |
| 19 | Observation window 1 | 72 h, thresholds per Observability Runbook | breach = rollback ladder | monitoring extract |
| 20 | 360 beta activation | scope `cohort` with the full B1-505 value set | founder approval logged (FG: cohort activation) | audit row |
| 21 | Observation window 2 | 7 days scheduled reviews: usage, failures, latency, cost, privacy, complaints | breach = ladder | weekly extract |
| 22 | Platform contract verification | contract tests green in CI (CI/controlled env only); PRODUCTION checks: `STORYFORGE_PLATFORM_OFF=1` is SET, and `STORYFORGE_PLATFORM_CONSUMERS` is ABSENT or empty in the production environment (the `contract-test` consumer never exists in production) | failure = fix within voice-independent lane | CI output + redacted production var evidence |
| 23 | Production deployment receipt | full identities: commits, release IDs, Railway deployment, migration rows, flag state, hashes | incomplete = not done | `B1-506_PRODUCTION_DEPLOYMENT_RECEIPT.md` |
| 24 | Rollback readiness preserved | prior Kinsta release retained; prior Railway build retained; reversal SQL filed; backups verified restorable | any gap = not done | checklist |

## 2. Rollback ladder (deterministic; containment before restoration)

Supersession note: this 7-rung ladder supersedes the 6-rung ladder in B1-504A (rungs are renumbered; the substance is unchanged except rung 2, transcription-off, which is new).

1. Disable new recording: flag scope `off` (seconds; DB) or env `STORYFORGE_VOICE_FORCE_OFF=1`. Preserves everything saved; playback and deletion remain (E8/E9 outside the flag).
2. Disable transcription only: adapter env `STORYFORGE_TRANSCRIBE_PROVIDER=none` -> record-now-transcribe-later truthful mode.
3. Typing-only capture: same as step 1 (the product IS typing-only V5.5 with the flag off).
4. Frontend rollback: Kinsta pointer rollback script to the prior immutable release.
5. Backend rollback: redeploy prior Railway build (new tables inert).
6. Migration repair or reverse: only with founder authorization + fresh backup; never to merely disable voice.
7. Restore from backup: last resort per B1-503 restore discipline.

Trigger table: privacy/authorization failure -> immediate step 1 + investigation (and step 4/5 if the defect is in shipped code); provider outage -> step 2 (automatic failover first); latency breach sustained -> step 2 and bake-off review; transcription quality complaints (>= 3 students) -> step 2 + keywords/lexicon review; R2 upload failure -> client buffering handles transient, sustained -> step 1; R2 credential failure -> rotate token, step 1 during rotation; frontend/backend regression -> steps 4/5; auth/WP claim failure -> step 1 + WP settings/plugin restore from backup; RLS failure -> IMMEDIATE step 1 + P0 incident + Fable; CDN cache leak (HTML cached) -> Cloudflare CACHE PURGE for the affected path is explicitly authorized as an operational action (it is not a zone/routing change) + Fable notice; migration failure mid-apply -> transaction aborts by construction; if partial state is ever observed, STOP + restore path; DB performance -> index review lane, flag off if user-facing; cost spike -> step 2 + ceiling review; cohort complaint -> triage via health surface; cross-app contract defect -> `STORYFORGE_PLATFORM_OFF=1` (independent kill); change-feed defect -> same platform kill; accidental access broadening -> immediate narrowest-scope revert + audit review + Fable.
Invariants under every rung: saved stories, transcripts, audio, and approved states are preserved; deletion rights preserved; no orphaned audio (sweeps continue); no private-story exposure introduced by rollback itself.
