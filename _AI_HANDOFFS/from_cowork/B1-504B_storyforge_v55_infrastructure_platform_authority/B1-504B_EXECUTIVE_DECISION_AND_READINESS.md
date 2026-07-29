# B1-504B · Executive Decision and Readiness

Date: 2026-07-29 (evidence verified 2026-07-28) · Author: Claude Cowork (Fable 5, xhigh) · Labels and ladder per the Infrastructure Authority Lock.

## VERDICT: NOT READY FOR CODEX IMPLEMENTATION

Not because the architecture is undecided (it is decided, in full, in this package), but because the package's own no-guessing rule is violated by nothing and satisfied by everything EXCEPT a bounded set of production facts this authoring session could not access, and one upstream authority that does not exist yet. Issuing an implementation MegaRun over those gaps would hand Codex exactly the improvisation this authority forbids. The path is short: one discovery-only Codex run (packet included), one Fable evidence-consumption pass, then the execution MegaRun.

## What is LOCKED (no Codex discretion remains in these domains)

1. Product authority: canonical V5.5 prototype (SHA `0df61b56...`), r2 copy revision (SHA `95104069...`), bounded-delegation strings, single enumerated visual delta, conformance law and method.
2. Topology decision set: public URL and route; WordPress/Kinsta frontend runtime; Railway API-only origin; isolated Railway PostgreSQL 18 (the Supabase question is closed with evidence: no Supabase component participates); dormant edge worker excluded from Phase 1; no DNS/zone changes authorized.
3. Identity: JWT claim set verified line-level, INCLUDING the discovery that the cohort claim already exists in minted tokens; the only auth change is surfacing it in `auth.mjs`; TTL, issuer, audience, denial codes, refresh skew all pinned.
4. Database: full disposition of all 25 existing tables; production-ready SQL for M1 (recording sessions/segments with FORCE RLS, one-active-session index) and M2 (feature flags); validation queries; rollback rules; no other schema change permitted.
5. Storage: bucket names, key layout, caps, CORS, TTLs, lifecycle, deletion propagation, retention policy and copy; assembly locked to a two-row decision table driven by the ffmpeg probe (Option A else Option B, both fully specified).
6. Transcription: adapter module layout and contract; primary `gpt-transcribe`, fallback `whisper-1`, StoryForge-scoped key; segmentation plan [4000, 15000]; retries, failover, taxonomy, outage behavior; bake-off thresholds as an activation gate with a deterministic fallback outcome; no mocks; no new vendors without a founder gate.
7. Frontend/backend map: every approved behavior mapped to exact files, functions, endpoints, tests, and forbidden deltas; browser matrix and truthful limitations (second-device microphone resume is not promised).
8. Flags and rollout: `sf_feature_flags` scopes, env kill precedence, legacy endpoint subordination with E8/E9 carve-outs, grace rules, rollout order, audit.
9. Platform: canonical ownership, stable IDs, read models with binding inclusions AND exclusions, `/platform/v1` with seven endpoints implemented dormant in Phase 1 and eight defined-additive, service-token model with purpose claims, consent/reuse matrix, cursor change feed over the append-only audit trail (no invented event platform), five consumer contract examples, compatibility and contract-test regime.
10. Deployment and rollback: 24-step sequence with named commands and stop conditions; deterministic trigger table; containment-before-restoration ladder; data-preservation invariants.
11. Observability: event set, forbidden log contents, thresholds, triage, incident package.

## What remains UNKNOWN (each with a defined probe; none delegable to Codex judgment)

RP-1 B1-505 completed authority (ABSENT at this run; VERIFIED). RP-2 worktree git health on the Mac (sandbox mount artifact suspected). RP-3 live baseline identity vs receipts (founder-session authenticated). RP-4 Cloudflare route audit (worker must be un-routed). RP-5 Railway service + ALL variable names. RP-6 R2 bucket reality. RP-7 StoryForge OpenAI key + models listing (bounded secret-use rule). RP-8 ffmpeg feasibility (local Nixpacks build; feeds the locked assembly table). RP-9 staging existence + harness boot. RP-10 WP settings summary + deployed-plugin hash vs worktree + iframe check. RP-11 bake-off (implementation-run gate; human corpus scheduling starts now). RP-12 provider data-handling posture. RP-13 database introspection (service-role attributes, sf_users columns, audit PK shape, story-deletion model, runner transaction behavior, ownership patterns).

Platform API production posture (binding): `STORYFORGE_PLATFORM_OFF=1` forced in production for all of Phase 1; no consumer entries in production (contract-test lives in CI/controlled env only); an end-user-proof amendment (v1.1) is a REQUIRED precondition before any real consumer registers.

## Founder gates (register)

Open: FG-1 final audio-retention ruling + r2 copy (recommended ruling: approve as specified; default safe state: build proceeds, cohort activation blocked; includes the deactivated-student 30-day wind-down rider, Infrastructure Lock Section 6). FG-2 production cohort activation (runbook steps S18 and S20; blocked until B1-505 and FG-1 close). Conditional: FG-3 new transcription vendor (only if the bake-off escalates). Closed by prior authority: no student-facing AI (Phase 1 exclusion stands); Phase 2 remains a separate later authorization; cross-app reuse of private stories is limited to authenticated self-use purposes (this package sets that as the recommended ruling inside FG-1's sitting; a founder amendment can narrow it before any consumer ships, since zero consumers ship in Phase 1).

## Codex discretion audit (post-verification, honest)

Three independent adversarial reviewers audited the package (infrastructure/data; security/privacy; Codex-ambiguity/conformance). Their first pass found one P0 and sixteen P1-class items, several of which were exactly consequential-discretion leaks the first draft of this section failed to admit (unauthored error copy, an undesigned admin panel, an unspecified privileged database path, an unpinned story-deletion path, a contradictory latency-miss fork, the E12 fork, and two access-control configuration locations). ALL were remediated in-place before this package was finalized: the error copy set and the daily-limit state are now authored verbatim; the admin panel controls are specified as bounded delegation and exempted from the pixel matrix; the service path has explicit grants and policies in M1/M2 plus an RP-13 evidence probe; story deletion has a two-branch evidence-bound decision table and M1 uses ON DELETE SET NULL; the latency fork has a single outcome table; E12 is decided out (E3 polling is the heartbeat); cohort validity lives in `STORYFORGE_VALID_COHORTS` and the founder scope value is removed entirely (founder stage = allowlist with the pilot UUID); the retention-copy release mechanics are pre-authorized for both FG-1 timing cases.
Remaining Codex latitude, all parameter-level: migration filename timestamp matching, daily-ceiling counting mechanics, retry jitter, module-internal organization, evidence formatting, the optional 30 s capability cache, queue internals. Every consequential fork is locked or resolved by a deterministic evidence-bound table.

## Superseding note

`B1-504A_CODEX_5.6_SOL_ULTRA_MEGARUN.md` is SUPERSEDED as a runnable mission (its content is absorbed and extended here; running it without B1-504B evidence closure would violate the no-guessing rule). The B1-504B execution MegaRun will be issued by the next Fable pass after the discovery evidence returns; it is intentionally NOT created in this package.

## Next actions, in order

1. Founder: rule FG-1 (retention + copy). 2. Codex: run `B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md` (safe, read-only; ~hours). 3. B1-505 completes (independent). 4. Fable: consume evidence, amend anything contradicted, emit the execution MegaRun. 5. Codex: implement under B1-506.
