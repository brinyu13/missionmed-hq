# B1-505C · StoryForge V5.5 Phase 1 · Delivery Execution Plan (r3)

Role: Chief Delivery Officer. Objective: real MissionMed students recording, transcribing, editing, saving, and replaying stories in production, in the shortest realistic time, at AAA quality. This document optimizes execution. It does not redesign anything: every B1-504A/B1-504B technical decision stands frozen, and this plan changes only sequence, parallelism, and permission structure. Revision r3 incorporates two full rounds of closures from three independent adversarial reviewers (Section 11); r1 and r2 are superseded.

## 0. Executive summary

The architecture is done. The specification is done. The remaining distance to a private pilot is one Codex build, one dormant deploy, one human-recorded bake-off corpus, and two founder sittings. The prior pipeline (Codex discovery run B1-505D, then a Fable amendment pass, then a Fable-authored execution MegaRun B1-506, then the build) spends 24 to 48 hours of wall clock on ceremony between three AI runs and two human paste steps, and almost none of that ceremony changes what Codex will build, because B1-504B isolated nearly every unknown production fact into environment, configuration, and deploy-time preconditions.

The structural change: collapse discovery and implementation into ONE Codex run (it keeps the ID B1-506), with discovery running from hour zero in parallel with the build lanes, and move each evidence gate from "before the run" to "before the step that consumes that fact." A small, enumerated set of facts IS consumed by code (Section 3.4); those probes run as an hour-zero wave so the affected files are authored after their evidence exists. Every stop rule, outcome table, founder gate, and safety invariant from B1-504B is retained unchanged. The Fable amendment pass becomes exception-based, with the handful of pre-identified mechanical, evidence-bound edits explicitly re-delegated to Codex by this founder-authorized plan (Section 5.4).

Two hard truths this plan states rather than hides. First, the transcription bake-off requires a HUMAN-recorded corpus (40 scripted medical passages across at least six accent groups); it is the longest external dependency, it cannot be faked with synthetic audio under the authority, and its mobilization is therefore the single most urgent item of the founder's first sitting. Second, no designated student records anything until FG-1 is ruled and the ruled retention copy, delete control, and consent notice are live; the default-safe copy path exists for founder-only testing, never for students.

Verdict (Section 12): RECOMMENDED REORDERING. Clean case: private pilot with designated real-student testers live at roughly T0+36 to T0+44 hours from the founder's mobilization sitting. Commitment number: T0+72 hours. Both are conditioned on corpus completion by roughly T0+24; the build and deploy chain is deliberately independent of the corpus so a corpus slip delays only voice activation, never the deployed release. Controlled cohort beta is NOT compressed: it keeps FG-2, the completed B1-505 fresh read, G7, and both observation windows.

## 1. Ground truth at planning time (verified this run)

- Repository side: B1-504B verified WordPress SSO, auth.mjs, config, storage seam, migrations, and edge config at source line level. The cohort claim is already minted in production JWTs; the only auth change is a one-line surfacing in `auth.mjs`.
- Authority side: 14 B1-504B documents plus manifest on device in both destinations, hash-pinned (25-entry manifest). The V5.5 prototype (SHA `0df61b56...`), the r2 copy revision (SHA `95104069...`), and canonical V5 (SHA `3ac2871f...`) are product law.
- Evidence side (checked fresh): `_AI_HANDOFFS/from_codex/` contains NO B1-505D discovery evidence and NO completed B1-505 (360 beta cohort) authority anywhere in the handoff tree. Nothing has executed since B1-504B. No discovery has been spent; none is waiting to be consumed.
- Founder side: FG-1 (audio retention plus r2 copy, including the deactivated-student wind-down) is unruled. FG-2 is unruled and is not needed for the pilot. The separate admin account (two-account rule) does not exist yet. The bake-off corpus has no scheduled readers.
- Product side: recording, near-live transcription, overlap merge, recovery, review, save, and replay all work in the approved prototype. The prototype is the behavior oracle; production work is porting plus hardening, not invention.

## 2. The delivery thesis: why the reorder is safe

B1-504B's NOT READY verdict was correct about one thing only: PRODUCTION ACTIONS may not execute on unverified production facts. It was never a claim that code cannot be written. Two facts make the collapse safe:

1. Code lanes consume almost no unresolved production facts, and the exceptions are ENUMERATED, not discovered. Endpoints, SQL, RLS policies, error copy, flag semantics, session model, segment plan, and UI behavior are fixed by B1-504B. Exactly five evidence items feed code (Section 3.4): the RP-13 role/runner/story-delete facts, the RP-8 assembly option, and the RP-7 confidence capability. All five probes are local or read-only, run in the hour-zero wave, and complete before the files they shape are authored. Everything else unknown surfaces only as environment values and deploy-time preconditions.
2. Every deploy step has a named evidence dependency with an outcome table in the Discovery Packet (consumption map, Section 3.3, corrected in r2 against the packet's actual probe numbering). Moving a probe earlier in wall clock while keeping it before its consuming step preserves the no-guessing rule exactly: Codex may prove a fact; Codex may not convert an unresolved fact into an architectural choice. When repository or production evidence contradicts the authority, the affected lane stops, evidence is preserved, and the discrepancy returns to Fable. Both B1-504B verbatim rules bind every lane word for word.

Supersessions (founder authority B1-505C, sequencing only, substance untouched):
- The B1-504B rule that a Fable amendment pass must complete and emit a runnable MegaRun before implementation begins is superseded per Section 5.4.
- The runbook's placement of S6 (bake-off cutover decision) before S7..S11 is superseded: nothing in the dormant deploy chain consumes RP-11, and the Transcription Lock itself defines RP-11 as the ACTIVATION gate. New binding placement: the bake-off decision record must be filed before S14 (first student activation); S12 founder-scope activation may precede it, with the founder testing the candidate primary truthfully labeled as pre-bake-off. The founder ratifies this resequencing memo at F1.
- The runbook's placement of S15 (denied-identity) and S17 (failure drills) after S14 is superseded in the safe direction: both complete BEFORE S14, because this plan turns S14 from an abbreviated test into a week-long real pilot.

The B1-504B documents remain the sole technical authority; this plan adds no technical content and edits no B1-504B document.

## 3. Critical path analysis

### 3.1 Task graph

Founder tasks:

| ID | Task | Depends on | Duration | Unblocks |
|---|---|---|---|---|
| F1 | Mobilization sitting, full agenda in Section 3.5 (FG-1 ruling, corpus reader mobilization, roster + save-the-date invites, admin account creation, RP-3 + ineligible-account session handover, device holder, async-S12 wake channel, resequencing ratification, F2 slots, exception cadence, credential minting) | nothing | 60 to 75 min | everything |
| F2 | Acceptance sitting: S13 full workflow A2..A22 on desktop Chrome + iPhone Safari, sign acceptance | async S12 done + smoke pass + P3 exit | 2 h | S15/S16/S17 completion, then S14 |
| F3 | Beta gates (outside pilot scope): FG-2 ruling + completed B1-505 authority fresh read | pilot health | async | S18/S20 |

Codex run (single run, ID B1-506; lane detail in Section 5):

| ID | Lane / step | Depends on | Work content | Feeds code? |
|---|---|---|---|---|
| W0 | Hour-zero probe wave: RP-2 (worktree health), then RP-5 (Railway names), then in parallel RP-7 (keys + models), RP-8 (ffmpeg feasibility, local container), RP-9 (staging + harness boot, local PG 18 parity), RP-13 (DB introspection) | kickoff | 1 to 2 h (RP-8 up to 2 h with container build) | YES: Section 3.4 |
| L0 | Remaining probes: RP-1, RP-3 (needs founder session from F1), RP-4, RP-6, RP-10, RP-12 | kickoff | 1 to 2 h, parallel with W0 tail | no |
| PRE | Authority-folder commit (single commit, run-owned) then S1 baseline lock (branch per RP-2), then S2 baseline suites | RP-2 | 1 h | no |
| L1 | DB: M1/M2 migration files per the DB spec with the three RP-13-bound mechanical selections applied (Section 5.4) + guarded runner + RLS proofs on local PostgreSQL 18 | PRE + RP-13 | 2 to 4 h | consumed RP-13 |
| L2 | Backend: `server/recordings.mjs` (E1..E6, sweeps), `server/transcription/*` (adapter FIRST, for the bake-off), `server/flags.mjs`, E7 attach + assembly per the RP-8-locked option, E8, legacy subordination, auth.mjs cohort line; splits into recordings/flags and transcription sub-lanes (separate directories, no shared files) | PRE; assembly module waits for RP-8; story-delete branch waits for RP-13(d) | 8 to 12 h | consumed RP-8, RP-13(d), RP-7 |
| L3 | Frontend: `app.js` voice section per the Implementation Map; player module per the RP-8-locked option authored last; harness sanity pass of the full voice flow in desktop Chrome and Safari at lane end | PRE; player slice waits for RP-8 | 8 to 12 h | consumed RP-8 |
| L4 | Verification: conformance matrix, string assertions, 72-surface flag-off suite, axe, PLUS every acceptance row executable in the controlled environment (RLS denials, cross-student fixtures A1/A17b/c, log-content sweep) pre-run during P1 | RP-9 harness; L2/L3 outputs progressively | 4 to 6 h | no |
| L5a | Ops evidence (read-only): backup RESTORE REHEARSAL, secrets scan, deploy script readiness | RP-2/RP-5 | 2 h | no |
| L5b | Ops provisioning, EXTERNAL RESOURCES ONLY during P1 (authorized under runbook S5, only where RP-5/RP-6/RP-7 show them missing): R2 prod + staging buckets, scoped token, CORS, the OpenAI key, minted under the F1 item 11 authority. Values are staged under the RP-7 handling bound (non-logging shell, never written to any file or evidence). Railway variables land ONLY at S8 as part of the dormant deploy: writing them earlier would arm the currently deployed, not-yet-subordinated legacy presign/confirm endpoints and restart production mid-build | RP-5, RP-6, RP-7, F1 item 11 | 1 to 2 h | no |
| CORPUS | Human corpus: readers recruited at F1; recording proceeds founder-side; hand-verified references filed | F1 | external; target <= T0+24 h | no (feeds RP-11) |
| BAKE | RP-11 bake-off in the controlled environment: adapter + corpus + keys + RP-12 filed clean (provider posture is proven before any human corpus audio reaches the provider); single outcome table governs. Raw corpus audio is RETAINED under the same handling bound until the S14 activation decision is final INCLUDING any pending FG-3 or Realtime retest (the recovery branches re-run on the same corpus), then deleted; hashes retained throughout | L2 adapter + CORPUS + RP-7 + RP-12 | 3 to 5 h | activation gate for S14 |
| INT | Rolling merges L1 -> L2 -> L3 -> L4 as each lane completes, full suite at each; final residual only | per merge | residual 1 to 2 h | no |
| DEP | Deploy chain, serial: FRESH backups (S4 re-take immediately before S7), S7 migrations, S8 backend dormant + off-scope probes, S9 suites, S10 frontend hidden, S11 conformance | INT + L5 + per-step gates (3.3) | 3 to 5 h | no |
| S12a | Async founder activation: allowlist = founder pilot UUID only, executed BY THE FOUNDER via the admin account (2 minutes, pre-authorized at F1), audit row filed. When S11 goes green Codex files a one-line execution card (panel URL, UUID pre-filled, expected audit-row confirmation), notifies the founder on the F1-named wake channel, and stands by live | DEP + admin account + RP-10, RP-12 | 15 min elapsed (bounded by the wake channel, 3.5 item 7) | no |
| SMK | Real-device smoke at founder scope: scripted 15-minute voice pass on iPhone Safari + Android Chrome by the designated device holder | S12a | 1 h | no |
| S15x | S15 denied-identity probes, split by what they actually exercise: the flag-independent rows (ineligible account, E7 foreign-attach, E8/E9 foreign-object) run at P2 exit with the F1-supplied ineligible session, off the F2 window; the flag-SCOPED session-endpoint rows re-run at S14 time AFTER roster allowlisting and BEFORE invites release, so they hit ownership denial rather than passing vacuously on `voice_disabled`; evidence marks which denial path each row exercised | DEP (first part); S14 allowlisting (second part) | 30 to 60 min + 15 min | no |
| P4X | S16 remaining browser rows (desktop Safari), S17 full failure-drill set (mic denial, app switch/screen lock, network loss, provider outage controlled, R2 outage controlled via staging token, reload recovery, A21 scope-off, A22 env kill), rollback rehearsal rungs 1 and 4. The kill-switch drills (A21/A22, rungs 1/4) execute STRICTLY OUTSIDE the founder's active testing window | S12a; drills need F2 devices only where marked | 2 to 3 h, mostly parallel with F2 prep | no |
| S14 | Pilot activation: the FOUNDER executes any needed `allowed_user_ids` additions for the verified roster (WP settings change, backup-first, audited, ratified at F1; Codex never touches access policy), then student UUIDs go to the flag allowlist; access invites released. CONFIG-DELTA CLAUSE: if the BAKE-locked transcription configuration differs from the one tested at S13/SMK (fallback promotion or Realtime lane), re-run the transcription-dependent acceptance subset plus the provider-outage drill at founder scope and record the founder's acknowledgment in the decision record before activation; a Realtime-lane outcome always requires a fresh founder device pass | F2 signed + S15x/P4X done + BAKE decision filed + FG-1 copy live + roster verified (3.5) | 1 to 2 h | pilot |

### 3.2 The critical path

Two chains must both land:

- BUILD CHAIN: F1 (1 h) -> W0/PRE (1 to 2 h) -> max(L2, L3) (8 to 12 h) -> INT residual (1 to 2 h) -> DEP (3 to 5 h) -> S12a + SMK (1.5 h) -> F2 (2 h) + P4X (parallel, 2 to 3 h) -> S14 (1 h). Work content roughly 19 to 27 hours; with founder calendaring (two pre-booked F2 candidate slots at ~T0+28 and ~T0+36), acceptance completes T0+30 to T0+38.
- CORPUS CHAIN: F1 mobilization -> human recording (external, target <= T0+24) -> BAKE (3 to 5 h) -> decision record. Lands T0+16 to T0+30 if readers respond same-day.

Pilot = both chains complete: clean case T0+36 to T0+44. The build chain never waits on the corpus chain (S6 resequenced); the corpus chain's only downstream dependency is S14. If corpus recruiting stalls, the founder has a fully deployed, founder-accepted product and a pilot waiting only on the bake-off, which is exactly the right thing to be waiting on.

Bottleneck ranking: (1) the corpus, the only dependency requiring humans outside the founder's own calendar; (2) the longest code lane; (3) F2 scheduling, mitigated by two pre-booked slots; (4) the serial deploy chain, irreducible but short.

### 3.3 Deploy-step consumption map (corrected r2, matched to the packet's actual probe numbering)

| Consuming step | Requires filed evidence matching a proceed outcome |
|---|---|
| PRE/S1 baseline | RP-2 (worktree health, branch and commit identity) |
| L5b/S5 provisioning (external resources only; Railway variables land at S8) | RP-5 (Railway variable names), RP-6 (R2 bucket state; PUBLIC access on an audio bucket is a BLOCKER), RP-7 (key presence and model availability), F1 item 11 (minting authority) |
| S7 migrations | RP-13 (roles, service connection identity, runner transaction behavior, audit PK, story-delete model) + RP-10 (the M2 seed's founder UUID parameter is injected from RP-10 evidence and recorded) |
| S8 backend deploy | RP-3 (live baseline identity, founder-authenticated; MISMATCH with the B1-503 receipt is a BLOCKER re-baseline) |
| S10 frontend release | RP-4 (no active `/storyforge/*` worker route), RP-10 (WP settings summary, deployed plugin hash matches worktree, iframe check; a plugin hash mismatch reopens R-6 and flags to Fable) |
| S12a founder activation | RP-10, RP-12 (provider data-handling posture filed; material conflict with the approved retention policy stops the release lane) |
| S14 student activation | BAKE decision record per the single outcome table + FG-1 ruled copy live + S13/S15/S17 evidence + roster verification |
| S18+ cohort activation | RP-1 (completed B1-505 authority, quoted) + FG-2 + G7. NOT part of this run. |

### 3.4 Code-lane consumption sub-map (the five facts code waits for)

| Fact | Probe | Consuming code | Resolution |
|---|---|---|---|
| Actual service connection role name | RP-13(a) | M1 service policies and grants | mechanical substitution if it is not `storyforge_app`, pre-authorized (5.4) ONLY when the evidenced role is a dedicated service role with `rolsuper=false` and `rolbypassrls=false` and is not a shared login; a superuser, BYPASSRLS, or shared role is a BLOCKER to Fable, never a substitution |
| Guarded runner wraps files in its own transaction | RP-13(e) | M1/M2 embedded BEGIN/COMMIT | mechanical strip if yes (pre-authorized) |
| Story-deletion model (hard-DELETE paths, status values) | RP-13(d) | story-delete handler extension in L2 | binding two-branch table in the DB spec; branch selected by evidence, never preference; the BLOCKER branch stops the lane |
| Assembly Option A vs B | RP-8 | E7 assembly module (L2) + player (L3) | binding decision table in the R2 spec; "Codex implements exactly one option" is the spec's own instruction |
| Primary confidence/logprob availability | RP-7 | adapter `flaggedTerms` source selection | Transcription Lock Section 3 already branches on this evidence |

All five probes are local or read-only and complete in the hour-zero wave; L2/L3 author the affected modules last, so in practice no lane idles.

### 3.5 F1 mobilization agenda (complete, 60 to 75 minutes)

1. Rule FG-1: retention policy + r2 copy + deactivated-student wind-down (recommendation already prepared in B1-504B; a 10-minute ruling).
2. Mobilize the bake-off corpus NOW: name readers across the six accent groups (360 community, staff, TAs), distribute the 40 scripted passages from the B1-504A bake-off doc, set a recording deadline near T0+24, and NAME THE VERIFIER(S) who hand-check reference transcripts STREAMING as clips arrive, not after all land. Each reader gets a one-line disclosure that their clips are sent to MissionMed's transcription provider for evaluation and retained until the launch transcription decision is final (including any retest), then deleted; hashes retained. This is the most schedule-critical item on the agenda.
3. Name the pilot roster (3 to 8 real students). Ratify the roster access mechanics: any student not already entitled in WordPress is added to `allowed_user_ids` BY THE FOUNDER at S14 time (backup-first, audited; Codex never touches access policy; the stop scope binds Codex, not the founder, and runbook S14 presupposes founder-designated testers). Send save-the-date invites: early-access framing, a launch WINDOW with a confirm-later note (never a promised date), the support address included. During P1 Codex verifies entitlement and `sf_users` UUID mapping read-only, filed summary-style (UUIDs recorded only where S14 needs them); a never-logged-in student is a VALID outcome via the two-step path: invite at flag-off, first login mints the UUID, the admin then adds it to the allowlist.
4. Export the WP plugin files and the `missionmed_storyforge_settings` option FIRST (two minutes), then create the separate admin account (R-8 settings change, backup-first satisfied by that export, exempt from stop scope) at the sitting, not at S12.
5. Hand over the RP-3 authenticated founder pilot session material (gates S8) AND an ineligible-account session for the S15 production denied-identity probes.
6. Designate the device holder and confirm handset availability (iPhone Safari + Android Chrome).
7. Pre-authorize async S12a and NAME THE WAKE CHANNEL: the founder authorizes call/push for exactly two events (S11 green; any privacy-class stop) and commits to acting within 2 hours of an S11-green notification; the T0+36-to-44 clean case assumes that bound. Alternative the founder may choose instead: schedule F1 late afternoon so P2 exit lands in the founder's morning.
8. Ratify the resequencing memo (Section 2 supersessions) and the pre-authorized mechanical edits (Section 5.4, including the RP-13(a) posture bound).
9. Book TWO candidate F2 slots (~T0+28 and ~T0+36); the earlier is taken if P3 exits in time.
10. Declare the exception cadence: the founder checks for stopped lanes every 3 to 4 waking hours during the run window; privacy-class pilot events get an immediate rung-1 response (Section 7.5). The FIRST cadence check also relays the audit-SQL confirmation request to Fable and carries the confirmation back (minutes of work against RP-13 evidence; it sits on the S14 gate and must never surface as a last-minute stall).
11. Credential minting authority. DEFAULT: the founder grants console access so L5b mints just-in-time and the values enter Railway directly at the S8 moment. FALLBACK: the founder pre-mints at the sitting (10 guided minutes: OpenAI dashboard key scoped to StoryForge; Cloudflare R2 token scoped to the two buckets) with custody in the founder's password manager until S8, and "S8 credential entry" becomes a third wake-channel event so an overnight S8 never stalls on a value only the founder holds. All values are handled under the RP-7 bound: non-logging shell, never written to any file or evidence; on a run restart the value is re-supplied, never recovered from disk. If RP-7 files the key ABSENT and no authority was collected, Codex escalates immediately rather than stalling silently; the hq key is NEVER used for transcription.
12. Paste the Codex kickoff.

## 4. Optimized release train

Clock convention: T0 = F1 complete, kickoff pasted. Durations are work-content estimates with buffer; GATES decide advancement, never the clock.

| Phase | Owner | Objective | Inputs | Outputs | Blocking deps | Exit criteria | Duration | Parallel opportunities |
|---|---|---|---|---|---|---|---|---|
| P0 Mobilize (T0) | Founder + Fable | The twelve-item F1 agenda | this plan + kickoff | FG-1 ruling, corpus readers recording, roster invited, admin account, session material, credentials, authorizations | none | all twelve items done | 60 to 75 min | single sitting |
| P1 Evidence + Build (T0 to ~T0+16h) | Codex | W0 wave + all probes filed; all code lanes complete; controlled-env acceptance rows pre-run; adapter ready for bake-off; roster verified | B1-504B docs (law), prototype artifact, packet | probe evidence, merged lanes, pre-run QA record, `BAKEOFF` readiness | PRE green | zero unresolved contradictions on consumed facts; suites green at every rolling merge | 12 to 16 h | W0, L0, L1, L2 (two sub-lanes), L3, L4, L5a/b all concurrent; CORPUS external |
| P2 Dormant Deploy (~T0+16 to +22h) | Codex | Production carries the release fully dark | INT green, L5 done, fresh S4 backups | S7..S11 evidence, flag-off conformance report | per-step rows (3.3) | S11 passes with EXACTLY the enumerated delta; off-scope probes return `voice_disabled` | 3 to 5 h | BAKE runs here if corpus has landed |
| P3 Activation-for-testing + Smoke (~T0+22 to +26h) | Founder (2 min) + device holder + Codex | S12a async activation; real-device voice smoke; P4X drills start | P2 exit, admin account, RP-10/RP-12 | S12a audit row, smoke captures, drill evidence | founder availability for the 2-minute action | smoke pass on both devices; no P0 | 2 to 4 h | P4X rows without founder devices run now |
| P4 Founder Acceptance (~T0+28 or ~T0+36 slot) | Founder + Codex | S13 A2..A22 both form factors; remaining P4X rows; optional bounded taste-fix cycle | P3 exit | signed S13, complete S15/S16/S17 evidence, rungs 1 and 4 rehearsed | F2 slot | every row green; founder signs; any taste findings resolved via the bounded cycle (Section 7.4) or explicitly deferred by the founder | 2 to 3 h (+4 to 8 h only if the taste cycle triggers) | Codex files evidence live |
| P5 Private Pilot (from T0+36 to 44 clean case; T0+72 commitment) | Founder (roster, daily ruling) + Codex (health) | S14: designated students on the flag allowlist; access invites released; pilot operations per Section 7.5 | signed S13, BAKE decision, FG-1 copy live, verified roster | S14 audit row, daily health notes | both chains complete | students recording; day-1 health clean | activation 1 h; pilot runs ~1 week | none needed |
| P6 Controlled Beta (NOT compressed) | Founder + Codex | S18 narrow cohort then S20 full 360 under FG-2, RP-1 fresh read, G7 | pilot feedback read at an explicit go/no-go | S18/S20 audit rows, window 1 (72 h) and window 2 (7 d) extracts | F3 | windows clean | per runbook | observation windows are the quality mechanism |
| P7 General release | Founder | `eligible_all` under its own ruling | P6 | ruling + activation | founder ruling | per runbook | out of scope | none |

## 5. Codex execution strategy

### 5.1 Run shape
One run, ID B1-506, evidence to `_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/`. Lane 0 executes the Discovery Packet for RP-1..RP-10, RP-12, RP-13 exactly as written, including outcome tables and mandatory actions (the packet's own text excludes RP-11 and defers it to the implementation run; the bake-off is the separate BAKE task with its own gate). The hour-zero wave W0 is an ordering of packet probes, not a new probe.

### 5.2 Ownership and merges
L1 owns `infra/postgres/migrations/*`; L2-recordings owns `server/recordings.mjs`, `server/flags.mjs`, `app.mjs` mounts, `auth.mjs` line; L2-transcription owns `server/transcription/*`; L3 owns `public/app.js` + `styles.css`; L4 owns new test harness files; L5 owns scripts, backups, provisioning evidence. EXACTLY ONE lane may write a given file. Rolling merges into one integration branch in order L1 -> L2 -> L3 -> L4 as each lane completes; full suite at every merge; red blocks the next merge and the owning lane fixes forward.

### 5.3 Validation, rollback, evidence
Suites at every merge; conformance at S11 and after any frontend fix; acceptance rows filed per row with captured output, a zero exit code is never success by itself. Rollback: the 7-rung ladder is live from S7; before S12a it reduces to Kinsta pointer + Railway redeploy + filed reverse SQL; rungs 1 and 4 rehearsed at P4X. Fresh backups are re-taken immediately before S7 (the early L5a pass proves RESTORABILITY; the pre-S7 pass bounds data loss).

### 5.4 Fable exception model and pre-authorized mechanical edits
The standing amendment duties B1-504B routed to Fable are dispositioned here so none becomes a 2am stall:
- PRE-AUTHORIZED to Codex (deterministic, evidence-bound, justification filed with the evidence): RP-13(a) service-role name substitution in M1, ONLY under the 3.4 posture bound (dedicated service role, `rolsuper=false`, `rolbypassrls=false`, not shared; anything else is a BLOCKER to Fable, never a substitution); RP-13(e) BEGIN/COMMIT strip when the runner wraps; RP-13(d) story-delete branch selection per the DB spec's two-branch table (the BLOCKER branch still stops); RP-8 assembly option selection per the R2 spec's table (the spec already instructs "Codex implements exactly one option").
- REMAIN Fable: confirmation of the Observability Runbook audit SQL against RP-13 evidence, moved to BEFORE S14 because pilot-week incident response depends on those queries (minutes of work against evidence already on file); platform cursor simplification (CI-only surface, deferred).
- EXCEPTIONS: anything outside those lists that contradicts authority stops the lane; the founder's 3-to-4-hour check cadence bounds the stall; unrelated lanes continue.

### 5.5 Contingency pre-staging (slack-time only, CI-only)
If L2 finishes early, it MAY pre-stage the `openai-realtime` driver skeleton (WS, PCM16) that the Transcription Lock pre-authorizes for exactly the latency-miss outcome, on a PARKED BRANCH that is merged only if that outcome fires. It never enters the integration branch, never rides the S8 deploy, and never touches the critical path; it exists so a latency miss costs hours instead of a day.

### 5.6 Hard boundaries (unchanged)
No scope beyond `allowlist` founder UUID + verified roster; no S18+ lanes; no B1-504A/B document edits; no new endpoints, tables, flags, vendors, or AI features; `STORYFORGE_PLATFORM_OFF=1` stays forced; no WP access-policy changes beyond the admin account; no DNS/zone changes; no student-facing intelligence; no vendor names user-facing; never log story text, transcripts, audio, tokens, or signed URLs.

## 6. Acceleration ledger (time saved vs risk added)

| # | Acceleration | Saves | Risk delta |
|---|---|---|---|
| A1 | One combined run with per-step gates instead of three runs with paste gaps | 12 to 24 h | none: every gate retained, re-timed |
| A2 | Code lanes start after a 1-to-2-hour probe wave instead of after a full discovery-plus-amendment cycle | 6 to 12 h | near zero: the five code-consumed facts are resolved before the affected files are authored |
| A3 | FG-1 ruled at F1 | kills S10b and makes the S14 copy precondition free | none |
| A4 | Corpus mobilized at F1, adapter built first in L2, bake-off decoupled from the deploy chain (S6 resequenced to pre-S14) | moves the true long pole to hour zero and off the build chain | none: RP-11 stays the activation gate for students; founder tests pre-bake-off truthfully labeled |
| A5 | Exception-based Fable review + four pre-authorized mechanical edits | 6 to 12 h clean case; kills two near-certain 2am stalls | none: all four are deterministic table-lookups on filed evidence |
| A6 | Async S12a at P2 exit + smoke at founder scope BEFORE F2 | converts F2 into confirmation; saves a founder re-sit (8 to 24 h) on any device defect | none: founder-only exposure, audited |
| A7 | Restore rehearsal early; fresh backups re-taken at S7 | 2 to 3 h without a stale restore point | none |
| A8 | Pilot = S14 allowlist designated testers; S15/S17 pulled BEFORE S14; cohort stages untouched | first real students without waiting on FG-2/B1-505/window 1 | negative risk: more testing before students than the runbook's own order |
| A9 | Rolling merges; controlled-env acceptance rows pre-run during P1 | 3 to 6 h | none |
| A10 | Two pre-booked F2 slots + save-the-date invites at F1 | removes 8 to 12 h of silent founder-calendar float and 24 h of student lead time | none: access still gated on the S13 signature |

## 7. Deferred work and pilot operations

### 7.1 Deferred before launch
Platform consumers and the change feed (CI tests only; `STORYFORGE_PLATFORM_OFF=1` forced); CSP hardening; the UNSELECTED RP-8 assembly branch (whichever the evidence does not lock); `eligible_all`; Phase 2 mentor Socratic and all AI features; admin panel polish beyond the bounded spec; platform cursor simplification; any new authority documents.
### 7.2 Deferred into pilot week (guarded)
Weekly R2 reconciliation automation (sweeps ship at launch; the weekly backstop may land day 2 to 5 with `STORYFORGE_SWEEPS=on` discipline).
### 7.3 Never deferred
FG-1 ruled copy, delete control, and consent notice before any student records; the full S17 drill set before S14; denied-identity probes before S14; fresh backups before migrations.
### 7.4 Bounded taste-fix cycle (pre-scheduled contingency)
If S13 surfaces founder product-taste findings (copy feel, emotional register) rather than defects: one batched Fable amendment (copy/styling only, no behavior), artifact revision note, frontend string change, S11 conformance re-run. Budget +4 to 8 h. Access invites go out only after the founder signs, so the cycle never burns student-facing credibility.
### 7.5 Pilot operations annex (binding for P5)
Daily health operator: the founder via the admin account E13 surface, backed by a scheduled daily Codex health run filing an evidence note against the Observability Runbook thresholds. Support: every invite carries the support address; students are told exactly where to report problems; that route feeds the >= 3-complaints trigger. Response contract: privacy-class event = founder executes rung 1 (flag off) IMMEDIATELY, then investigation; sustained upload/transcription failure = same-day response; all else next-day. Narrative containment: invites use early-access framing and name the feedback route; the pilot-to-beta go/no-go explicitly reads pilot feedback before FG-2 goes to the founder.

## 8. Launch readiness matrix

| Level | Exact conditions |
|---|---|
| NOT READY | Any open P0; any red suite; any deploy step executed without its 3.3 row; any unresolved authority contradiction |
| READY FOR INTERNAL QA | All lanes merged; unit + postgres + e2e + flag-off conformance green; controlled-env acceptance rows pre-run clean; S7..S11 complete; off-scope probes return `voice_disabled`; zero outstanding contradictions |
| READY FOR FOUNDER ACCEPTANCE | Internal QA + S12a executed and audited + real-device smoke pass at founder scope + RP-12 filed clean |
| READY FOR PRIVATE PILOT | S13 signed (A2..A22 green, both form factors); S15 denied-identity clean; S16 device rows complete; S17 FULL drill set complete; rungs 1 and 4 rehearsed; BAKE decision record filed per the single outcome table, WITH the config-delta clause satisfied (any post-S13 primary change re-validated at founder scope and founder-acknowledged in the record); FG-1 ruled copy, delete control, and consent notice LIVE (no default-safe exception for students); roster verified per the 3.5 item 3 mechanics (founder-executed WP additions where needed; two-step UUID path valid); audit-SQL confirmation done; pilot operations annex active |
| READY FOR CONTROLLED BETA | Pilot week: no privacy/auth event, thresholds respected, feedback read at go/no-go; FG-2 ruled; RP-1 completed B1-505 fresh-read quoted; G7 satisfied; window 1 clean |
| READY FOR GENERAL RELEASE | Window 2 clean; cost/latency within thresholds; `eligible_all` ruling recorded |

## 9. The thirteen questions, answered

1. Optimal sequence? No: sound, but serialized for authority ceremony, and it left the corpus, the true long pole, unmobilized. 2. Parallel: six build sub-lanes, twelve probes, the corpus, backups, roster verification, founder logistics. 3. Unnecessarily serialized: discovery before code; a mandatory amendment pass before code; S6 ahead of the dormant deploy chain; S10b (killed by A3); invites and admin-account creation held until deploy week. 4. Critical path: the BUILD chain and the CORPUS chain of Section 3.2, whichever lands later. 5. Time without launch value: the full Fable re-authoring cycle when probes confirm; barrier-style integration; founder-calendar float; QA rows deferred to production that the harness can prove earlier. 6. Genuine blockers: probe contradictions on consumed facts (RP-3 mismatch, active worker route, public audio bucket, RLS posture mismatch, red baseline, broken harness), corpus non-delivery, bake-off misses per the single outcome table, device-matrix failures, restore-rehearsal failure. 7. Theoretical, safely waits: Section 7.1. 8. Discovery merges into the run with its evidence discipline intact; the gate belongs before consumption; five facts are consumed by code and get an hour-zero wave, the rest by deploy steps. 9. B1-506 as a separately authored post-amendment MegaRun: NOT necessary; replaced by the thin combined-run kickoff plus B1-504B as law plus the exception model of 5.4; the run keeps the ID. 10. Codex Ultra: seven concurrent work streams, single-owner files, rolling merges, per-step evidence, pre-authorized mechanical edits, hard stops elsewhere. 11. Founder decisions blocking the pilot: FG-1, corpus mobilization, roster plus its S14 access mechanics, admin account, credential minting, the async S12a action, the S13 signature. During implementation: only the pre-scheduled 2-minute S12a action and the 3-to-4-hour exception check cadence, both fixed at F1 with a named wake channel. After: FG-2, B1-505, `eligible_all`. 12. Highest slip probability, ranked: corpus delivery; iPhone Safari device defects (first touched at SMK ~T0+24, and pre-checked in the desktop harness sanity pass at L3 end); a bake-off miss (three of four miss classes BLOCK activation; the accuracy class can hand primary to whisper-1 only if whisper-1 itself passes; the latency class has the pre-authorized Realtime lane, pre-staged in slack time under 5.5); probe contradictions; founder calendar (bounded by A10). 13. The 48-hour demand: this plan is the honest answer: T0+36 to 44 clean case, T0+72 commitment, and the only ways to beat that number would cut the bake-off, the drills, or FG-1 copy, each of which risks exactly the student trust the pilot exists to build.

## 10. Slip analysis (honest branches)

Chain math gives T0+31 to 39 (build chain acceptance T0+30 to 38 plus one hour of S14 mechanics; corpus chain T0+16 to 30); the headline clean case of T0+36 to 44 carries the difference as EXPLICIT buffer for merge friction and founder-calendar granularity, so the commitment math is auditable. Single fix cycle (one device defect or one contradiction) adds 8 to 24 h: commitment T0+72. Corpus-bound branch: build chain completes and waits; pilot lands at corpus + bake-off + S14 mechanics, whatever that is; the founder sees a deployed, accepted product either way. Bake-off branches per the Transcription Lock's single outcome table: no misses = proceed; accuracy-only miss = one keywords retest, then whisper-1 primary ONLY if whisper-1 passes accuracy, else FG-3 to the founder; latency miss = batch path BLOCKED, Realtime driver lane (pre-authorized, parked-branch pre-staged if 5.5 ran) re-runs the gates, still missing = founder decision; reliability or cost miss = BLOCKED, evidence to Fable. Under the config-delta clause, ANY outcome that changes the primary from the S13-tested model triggers a founder-scope re-validation subset and explicit founder acknowledgment before students see it. Structural slip (red baseline at S2, RP-3 mismatch, broken harness at RP-9): the clock suspends; that is a BLOCKER by rule and no schedule promise survives it honestly.

## 11. Independent adversarial review record

Round 1 (three fresh-context reviewers: Principal Engineer, Elite Release Manager, Startup CTO) attempted to invalidate revision r1. Verdicts: INVALID, VALID WITH REVISIONS, INVALID. Consolidated material findings, all closed in r2:
- R1-1/R2-1/R3-1 (P0) The r1 consumption map misnumbered four of eight probe rows against the packet and cited RP-11 as packet-internal. CLOSED: Section 3.3 rebuilt row by row from the packet text; kickoff table matched; RP-11 handled as the separate BAKE task.
- R1-3/R3-3 (P0) "Code consumes zero production facts" was false for RP-13(a)(d)(e), RP-8, RP-7-confidence. CLOSED: Section 3.4 sub-map, hour-zero wave W0, affected modules authored last, mechanical selections pre-authorized in 5.4.
- R1-1/R2-2/R3-2 (P0) Bake-off priced as hours of synthetic audio; outcome table misquoted ("can never block"). CLOSED: corpus mobilization is F1 item 2; BAKE is its own chain; Section 10 quotes the real table; TTS remains excluded; Realtime contingency per 5.5.
- R3-4 (P0) The pilot gate allowed students to record under default-safe copy without delete control or consent. CLOSED: Section 8 pilot row requires FG-1 ruled copy LIVE, no exception; 7.3.
- R1-4/R3-3 (P1) r1 Section 7 pre-locked Option B, contradicting the RP-8 binding table. CLOSED: 7.1 defers only the unselected branch; RP-8 restored to the maps.
- R1-6/R2-3/R3-5 (P1) Pre-F2 smoke was impossible with the flag off and no admin account. CLOSED: admin account moves to F1; async S12a pre-authorized; smoke at founder scope.
- R1-7/R3-7 (P1) Amendment duties orphaned; near-certain mechanical stops hidden. CLOSED: 5.4 disposition list; exception cadence fixed at F1.
- R1-8 (P1) Early backups left a stale restore point at S7. CLOSED: rehearsal early, fresh backups re-taken at S7 (A7, 5.3).
- R1-9/R2-5/R3-11 (P1) Mid-run founder dependencies uncollected (RP-3 session, device holder, corpus readers). CLOSED: F1 agenda items 2, 5, 6.
- R2-4 (P1) S6 needlessly gated the dormant deploy chain. CLOSED: resequencing supersession, founder-ratified at F1.
- R2-6 (P1) Roster and invites waited until P4; entitlement gaps would surface late against stop scope. CLOSED: F1 item 3, save-the-date pattern, P1 read-only verification, access after S13.
- R2-8/R3-10 (P1) Headline number hid founder float and the zero-defect assumption. CLOSED: Section 0/10 state clean case vs commitment; L3 harness sanity pass added.
- R2-9/R2-10 (P2) Barrier integration and late QA rows. CLOSED: rolling merges; L4 pre-runs controlled-env rows.
- R3-6 (P1) Pilot week had no operator, support route, or response contract. CLOSED: 7.5 annex, binding.
- R3-8 (P1) No taste-fix loop; invites before signature. CLOSED: 7.4 bounded cycle; access invites post-signature.
- R3-9 (P1) Drill subset was discretionary. CLOSED: full S17 set enumerated, before S14 (7.3, P4X).
- R1-10/R1-11/R1-12, R2-13, R3-12 (P2) Preflight circularity, L5 provisioning ownership, harness/PG-18 pinning, RP-8 probe ordering, narrative containment. CLOSED: PRE ordering, L5a/L5b split, RP-9 in W0 with PG 18 parity, RP-8 in W0, 7.5 framing.
- R2-12 (P2) The review loop itself is pre-T0 waiting. CLOSED: one consolidated revision (this one) + one confirmation round; further review runs exception-based alongside P1.

Round 2 (same three reviewers against r2): all round-1 closures independently verified genuine. Verdicts: REVISE, REVISE, REVISE, with every residual a targeted gate tightening; all applied in r3 (this text):
- R2b-1 (P0) The roster constraint "already entitled" could make S14 infeasible (B1-503 was an exact-account pilot). CLOSED: F1 item 3 ratifies founder-executed `allowed_user_ids` additions at S14 time; Codex still never touches access policy.
- R1b-1/R3b-5 (P1) A post-S13 bake-off configuration change could reach students untested. CLOSED: config-delta clause in the S14 gate, Section 8, and Section 10.
- R2b-2 (P1) L5b Railway variable writes during P1 would arm the unsubordinated legacy endpoints early. CLOSED: L5b creates external resources only; variables land at S8 with the dormant deploy.
- R3b-1 (P1) The RP-13(a) substitution was unbounded (could ratify a superuser/BYPASSRLS connection). CLOSED: posture bound in 3.4/5.4 and the kickoff; violations are BLOCKERs.
- R3b-2/R1b-8 (P1) Credential-minting authority (OpenAI key, R2 token) was uncollected. CLOSED: F1 item 11 with escalation rule and secret-handling bound.
- R2b-3/R3b-7 (P1) The overnight S12a action had no wake channel or execution card. CLOSED: F1 item 7 names the channel and the 2-hour bound; Codex files the card and stands by.
- R1b-2/R3b-4 (P2) BAKE lacked an RP-12 input and corpus reader consent/retention. CLOSED: BAKE row + F1 item 2.
- R1b-3 (P2) S7 omitted the RP-10-fed M2 seed parameter. CLOSED: 3.3 row.
- R1b-4 (P2) The F1 admin-account change lacked its backup-first export. CLOSED: F1 item 4.
- R1b-5/R2b-7 (P2) S15 lacked session material and was needlessly gated on S12a. CLOSED: F1 item 5; S15x runs at P2 exit.
- R1b-6/R3b-8 (P2) Never-logged-in students were wrongly excluded; roster evidence risked an access snapshot; invites promised a date. CLOSED: two-step UUID path, summary-style filing, window framing (F1 item 3).
- R1b-7 (P2) Preflight hashed before RP-2. CLOSED: kickoff preflight reordered.
- R2b-5 (P2) Kill drills could fire during founder testing. CLOSED: P4X scheduling rule.
- R2b-6 (P2) Headline vs chain math unreconciled. CLOSED: Section 10 labels the buffer.
- R3b-3 (P2) The Realtime pre-stage rode the integration branch. CLOSED: parked branch, merged only on the latency outcome.
- R3b-6 (P2) Audit-SQL confirmation deferred past pilot incident needs. CLOSED: moved before S14 (5.4).

Round 3 (final confirmation against r3): reviewer 2 (Release Manager) OPTIMIZED ("no residual faster safe path; apply the three P2 edits at paste time and mobilize"; all three applied in this text: secret custody default just-in-time with password-manager fallback and the S8 wake event, audit-SQL relay folded into the first cadence check, stale references synced). Reviewer 3 (Startup CTO) OPTIMIZED ("every P0 and P1 raised across both rounds is now genuinely closed in the text with gate wiring that matches the B1-504B authorities line for line"; the corpus-retention and custody one-liners applied). Reviewer 1 (Principal Engineer) initially REVISE on one P1 (corpus deletion fired inside the bake-off's own recovery branches) plus two P2s (vacuous flag-scoped S15 rows at flag-off; stale references); all three fixed (corpus retained until the S14 decision is final including FG-3/Realtime retests; S15 split into flag-independent rows at P2 exit and flag-scoped session rows at S14 after allowlisting, before invites; references synced), then confirmed: "VERDICT: OPTIMIZED. Across three rounds every finding was closed with a verifiable text change rather than a claim, and the final documents now gate every production action, every code-consumed fact, and every irreversible operation on evidence that the B1-504B package actually produces." All three reviewers independently agree the execution strategy is optimized.

## 12. Final verdict

RECOMMENDED REORDERING.

The new release train is Section 4. Proceeding with the prior three-run sequence would reduce launch probability inside any aggressive window: it adds two human paste gaps and a full authoring cycle to the critical path, it leaves the bake-off corpus, the actual long pole, unmobilized until after discovery returns, and long idle gaps between runs are where context decays and scope creep enters. The reordered train deletes only ceremony and dead calendar. It deletes no gate, no probe, no founder authority, and no safety invariant, and it adds protections the old order lacked: drills and denied-identity checks before any student records, a hard FG-1 copy precondition for students, and a named pilot operations contract.

Success test: an elite engineering organization holding only this plan, the kickoff, and the B1-504B package knows what to build (implementation map), what to prove first (3.3 and 3.4), what the founder must do and when (3.5), what to defer (7.1), what blocks launch (8), when to stop (5.4/5.6), when to deploy (P2 gates), when to pilot (P5 gates), and when to expand (P6 gates).
