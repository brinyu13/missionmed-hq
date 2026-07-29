# [B1-506] STORYFORGE V5.5 PHASE 1 · COMBINED DISCOVERY + IMPLEMENTATION RUN (r3)

Model: Codex GPT-5.6 Sol Ultra. Paste this document as the run prompt. This is the execution order authorized by founder directive B1-505C, per the B1-505C Delivery Execution Plan (r3). It is deliberately thin: it grants permission and sequence. It contains NO technical content of its own.

## 1. Authority stack (highest first)

1. Founder directives (B1-505C and any later founder message).
2. The 14 B1-504B documents in `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/`. They are the complete and only technical authority: database SQL, endpoint contracts, session model, R2 lifecycle and assembly decision table, transcription lock and its single bake-off outcome table, flag semantics, error copy, runbook steps S1..S24, rollback ladder, conformance matrix, discovery packet.
3. The canonical product artifacts: V5.5 prototype SHA `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90`, r2 copy revision SHA `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b`, canonical V5 SHA `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`. Compare against the artifacts directly; never reconstruct from memory.
4. This kickoff, for sequence and permission only. On any technical contradiction between this document and the B1-504B set, the B1-504B set wins: STOP the affected lane and report.

SUPERSESSIONS (founder-ratified at F1, sequencing only): (a) B1-504B's requirement that a Fable amendment pass complete and emit a runnable MegaRun before implementation begins is superseded by this order. (b) Runbook step S6 (bake-off cutover decision) is resequenced: it is NOT a precondition of S7..S11; it IS a hard precondition of S14 (first student activation). S12a founder-scope activation may precede it, truthfully labeled pre-bake-off. (c) S15 (denied-identity) and S17 (failure drills) execute BEFORE S14, not after. Every other safety rule stands, including these two, verbatim and binding on every lane:

"When repository or production evidence contradicts this authority, do not redesign around the contradiction. Stop the affected implementation lane, preserve the evidence, and return the discrepancy to Fable for an authority amendment."

"Codex may prove a fact. Codex may not convert an unresolved fact into an architectural choice."

## 2. Preflight (strict order)

1. Work only in the existing worktree `B1-StoryForge-502`. Create no new worktree.
2. Run probe RP-2 (worktree git health) FIRST, exactly as the Discovery Packet specifies; RP-2 exists precisely because the worktree mount previously failed traversal, so it precedes everything, including hashing. Expected-dirty: the authority folders. A broken link follows RP-2's own BLOCKER outcome.
3. Verify all four hashes above plus both MANIFEST.sha256 files (B1-504A and B1-504B folders). Any mismatch = STOP the run. Then make the run's first commit: the authority folders only, message `B1-506: commit B1-504A/B1-504B authority folders (per RP-2)`. Then execute runbook S1 (baseline lock on the RP-2-recorded branch) and S2 (baseline suites: `npm test`, `npm run test:postgres`, `npm run test:e2e`, `scripts/run-conformance.sh`). A red baseline is a BLOCKER to Fable: do not build on a broken baseline.
4. Evidence root: `_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/`. Packet probes file at the packet's own paths; everything else files under the run root, one file per step (for example `S7_MIGRATION_EVIDENCE.md`). A zero exit code is never success by itself; every claim carries captured output.

## 3. Hour-zero probe wave W0 (before authoring the files these facts shape)

After RP-2: run RP-5, then in parallel RP-7, RP-8, RP-9 (pin the local harness to PostgreSQL 18 parity), RP-13. All are local or read-only, exactly as the packet specifies. These five resolve every fact that code consumes:

| Fact | Probe | Shapes | Disposition |
|---|---|---|---|
| Service connection role name | RP-13(a) | M1 grants and service policies | if not `storyforge_app`, substitute the actual name: PRE-AUTHORIZED mechanical edit, justification filed, ONLY when the evidenced role is a dedicated service role with `rolsuper=false` and `rolbypassrls=false` and is not a shared login. A superuser, BYPASSRLS, or shared connection is a BLOCKER to Fable, never a substitution |
| Runner wraps files in a transaction | RP-13(e) | M1/M2 embedded BEGIN/COMMIT | strip if yes: PRE-AUTHORIZED mechanical edit |
| Story-deletion model | RP-13(d) | story-delete handler extension | select the branch the DB spec's two-branch table binds to the evidence; the BLOCKER branch stops the lane |
| Assembly Option A vs B | RP-8 | E7 assembly module + player | implement exactly one option per the R2 spec's binding table |
| Primary confidence availability | RP-7 | adapter `flaggedTerms` source | per Transcription Lock Section 3 |

These four pre-authorizations are deterministic table-lookups on filed evidence, re-delegated from the Fable amendment pass by founder authority. Nothing else is delegated: any other contradiction stops the lane. Two Fable duties remain open: audit-SQL confirmation against RP-13 evidence, required BEFORE S14 (pilot incident response depends on those queries; request it as soon as RP-13 files), and platform cursor simplification (deferred, CI-only).

## 4. Lanes (parallel; EXACTLY ONE lane writes a given file)

- LANE 0 · DISCOVERY. The packet's remaining probes: RP-1, RP-3 (use the founder-supplied authenticated pilot session from F1; no other credentials), RP-4, RP-6, RP-10, RP-12. Read-only. RP-11 is NOT a packet probe: see BAKE below.
- LANE 1 · DATABASE (owns `infra/postgres/migrations/*` additions). M1 and M2 exactly as printed in the DB spec, with only the W0-bound mechanical selections applied, plus the guarded runner. Prove on LOCAL PostgreSQL 18 with `tests/postgres/recording-rls.test.mjs` and `flags-rls.test.mjs`. Never touch the production database in this lane.
- LANE 2 · BACKEND, two sub-lanes. L2-recordings (owns `server/recordings.mjs`, `server/flags.mjs`, the `app.mjs` mounts, the one-line `auth.mjs` cohort surfacing): E1..E6, sweeps, E7 attach + assembly per the RP-8-locked option, E8, legacy presign/confirm subordination. L2-transcription (owns `server/transcription/*`): build the ADAPTER FIRST so the bake-off can run the moment corpus and keys exist. Author the assembly module and story-delete extension only after their W0 facts are filed. Slack-time option: pre-stage the `openai-realtime` driver skeleton the Transcription Lock pre-authorizes for the latency-miss outcome, on a PARKED BRANCH merged only if that outcome fires; it never enters the integration branch and never rides the S8 deploy.
- LANE 3 · FRONTEND (owns `public/app.js`, `styles.css`). Port the voice section per the Implementation Map against the prototype artifact directly; all copy PA-immutable including the seven error strings; author the player module after RP-8 files. Lane exit: a harness sanity pass of the full voice flow in desktop Chrome and Safari.
- LANE 4 · VERIFICATION (owns new harness files). Conformance screenshots at 1440x900 and 390x844, string assertions, 72-surface flag-off suite, axe. ALSO: pre-run every acceptance row executable in the controlled environment (RLS denials, cross-student fixtures A1/A17b/c, log-content sweep) during the build, and verify each pilot-roster student's entitlement and `sf_users` UUID mapping read-only, filed SUMMARY-STYLE (UUIDs recorded only where S14 needs them). Report gaps to the founder immediately: the FOUNDER executes any `allowed_user_ids` additions at S14 time (ratified at F1, backup-first, audited); Codex never touches access policy. A never-logged-in student is a VALID outcome via the two-step path (invite at flag-off, first login mints the UUID, the admin adds it to the allowlist).
- LANE 5 · OPS. L5a (read-only): backup RESTORE REHEARSAL, `npm run scan:secrets`, deploy script readiness. L5b (AUTHORIZED WRITES under runbook S5, only after RP-5/RP-6/RP-7 evidence shows them missing, using the minting authority the founder granted at F1 item 11): create the R2 production and staging buckets, the scoped token, CORS, and the OpenAI key, exactly per the R2 and Transcription specs, as EXTERNAL RESOURCES ONLY. Default is just-in-time minting under granted console access with values entering Railway directly at S8; on the founder-pre-mint fallback, custody sits in the founder's password manager until S8 and "S8 credential entry" is a wake-channel event. Handle every value under the RP-7 bound: non-logging shell, never written to any file or evidence; on a run restart the value is re-supplied, never recovered from disk. Do NOT write Railway variables during the build: they land ONLY at S8 with the dormant deploy, because earlier writes would arm the currently deployed, not-yet-subordinated legacy presign/confirm endpoints and restart production mid-build. If a needed credential cannot be minted with the collected authority, escalate to the founder immediately instead of stalling; the hq key is NEVER used for transcription.
- BAKE · RP-11 in the controlled environment, when four inputs exist: the L2 adapter, the founder-side human corpus (mobilized at F1, hand-verified streaming by the F1-named verifier), RP-7 keys, and RP-12 filed clean (provider posture is proven before any human corpus audio reaches the provider). The Transcription Lock's SINGLE OUTCOME TABLE governs; synthetic audio never substitutes for the corpus in accent scoring. RETAIN raw corpus audio under the same handling bound until the S14 activation decision is final INCLUDING any pending FG-3 or Realtime retest (the recovery branches re-run on the same corpus), then delete; hashes retained throughout. File `BAKEOFF_DECISION_RECORD.md`. This is the S14 activation gate.

Merges: rolling, one integration branch, order L1 -> L2 -> L3 -> L4 as each lane completes, full suite at every merge, red blocks the next merge.

## 5. Deploy chain and gates (a step may not run before its row is filed and matches a proceed outcome)

| Step | Requires filed evidence |
|---|---|
| PRE/S1 | RP-2 |
| L5b/S5 (external resources only; NO Railway variable writes) | RP-5, RP-6 (PUBLIC audio bucket = BLOCKER), RP-7, F1 item 11 minting authority |
| S7 migrations (production; FRESH S4 backups re-taken immediately before) | RP-13 + RP-10 (the M2 seed's founder UUID parameter is injected from RP-10 evidence and recorded) |
| S8 backend dormant deploy (Railway variables land HERE; then off-scope probes: E1 and legacy presign/confirm return `voice_disabled`) | RP-3 (MISMATCH vs the B1-503 receipt = BLOCKER re-baseline) |
| S9 suites | S8 |
| S10 frontend hidden release | RP-4 (active `/storyforge/*` worker route = BLOCKER), RP-10 (plugin hash mismatch = flag to Fable) |
| S11 flag-off conformance | S10; passes with EXACTLY the enumerated delta ledger |
| S15 denied-identity probes, split: flag-independent rows (ineligible account, E7 foreign-attach, E8/E9 foreign-object) run here with the F1-supplied ineligible session; the flag-SCOPED session-endpoint rows re-run at S14 time AFTER roster allowlisting and BEFORE invites release so they exercise ownership denial, not `voice_disabled`; evidence marks which denial path each row hit | S10 (first part); S14 allowlisting (second part) |
| S12a founder activation (executed BY THE FOUNDER via the admin account, 2 minutes, pre-authorized at F1; when S11 is green Codex files a one-line execution card with the panel URL, the pre-filled UUID, and the expected audit row, notifies the founder on the F1-named wake channel, and stands by live; Codex NEVER activates any scope) | RP-10, RP-12 (material policy conflict stops the release lane) |
| SMK device smoke + P4X (S16 remaining device rows, S17 FULL drill set, rollback rungs 1 and 4 rehearsed; kill-switch drills execute STRICTLY OUTSIDE the founder's active testing window) | S12a |
| S13 founder acceptance | SMK + internal QA |
| S14 student activation (the FOUNDER executes any needed `allowed_user_ids` additions, backup-first, audited, ratified at F1; then verified roster UUIDs to the flag allowlist; access invites released) | S13 signed + S15/P4X complete + `BAKEOFF_DECISION_RECORD.md` proceed outcome + CONFIG-DELTA CLAUSE: if the BAKE-locked configuration differs from the S13/SMK-tested one, re-run the transcription-dependent acceptance subset plus the provider-outage drill at founder scope and record founder acknowledgment first (a Realtime-lane outcome always requires a fresh founder device pass) + FG-1 ruled copy, delete control, and consent notice LIVE (no default-safe exception for students) + Fable audit-SQL confirmation on file |
| S18+ any cohort scope | RP-1 (completed B1-505, quoted) + FG-2 + G7. NOT part of this run. |

FG-1 mechanics: the founder rules FG-1 at F1, so S10 ships the ruled copy. If FG-1 is somehow still open at S10, ship the ORIGINAL copy default-safe and execute S10b (second release with the ruled copy plus flag-off conformance re-run) BEFORE S14. Never choose copy yourself.

## 6. Operating rules

- Stop scope (unchanged): no WordPress access-policy changes (`allowed_user_ids`, `allowed_roles`, `allowed_cohorts`) except the F1 admin-account addition; no DNS/zone/Cloudflare changes (cache purge of an affected path is an allowed operational action); no retention semantics decisions; no platform exposure (`STORYFORGE_PLATFORM_OFF=1` stays forced; platform contract = CI tests only); no new endpoints, tables, flags, vendors, or AI features; no student-facing intelligence; no vendor names in user-facing language; never log story text, transcripts, audio bytes, tokens, or signed URLs.
- Self-healing boundary: fix forward autonomously against unambiguous spec lines; STOP the lane on ambiguity, contradiction, or stop-scope contact. The founder checks for stopped lanes every 3 to 4 waking hours; report stopped lanes prominently and keep unrelated lanes running.
- Pilot operations handoff: before declaring S14, file a one-page `PILOT_OPERATIONS.md` instantiating the plan's Section 7.5 annex: daily E13 health check owner, the scheduled daily health run, the support address used in invites, and the response contract (privacy-class event = founder rung 1 immediately; sustained failure = same day).

## 7. Completion

The run is complete when: S1..S14 evidence is filed; all suites and conformance green with exactly the enumerated delta ledger; the bake-off decision record is filed; the founder has signed S13; S14 is live with the verified roster; rollback readiness (S24) verified; `PILOT_OPERATIONS.md` filed; and `B1-506_PRODUCTION_DEPLOYMENT_RECEIPT.md` filed with full identities (commits, release IDs, Railway deployment, migration rows, flag state, hashes). If any lane is stopped on a contradiction, deliver everything else plus the preserved evidence and an explicit list of stopped lanes: partial honest delivery beats complete guessing.
