# B1-507A Complete Combined Handoff

## StoryForge Phase 1 Authority Recovery and Production-Launch Dossier

Date: 2026-07-29
Ticket: B1-507A
Method: repository inspection, Git/GitHub evidence, authenticated read-only production inspection, source/test tracing, three independent specialist audits, and screenshot verification.
Mutation boundary: no application source, production system, provider, database, remote branch, deployment, entitlement, or infrastructure setting was changed.

## Final dossier verdict

**READY TO AUTHOR THE FULL PHASE 1 PRODUCTION MEGARUN**

This verdict means the authority, implementation, production baseline, real blockers, exact launch order, rollback ladder, and completion standard are now recovered well enough to write a self-resolving production megarun without guessing.

It does **not** mean StoryForge Phase 1 is ready to activate today.

The live B1-503 text product is healthy. The V5.5 Phase 1 release candidate is substantially implemented and strongly locally tested. The complete production voice release still has 18 real blockers, including production-seam code gaps, external infrastructure, provider/privacy/corpus evidence, fresh backups/migrations, five definite Fable rulings, one conditional scheduler ruling, Founder decisions, and real production/device acceptance.

## 1. Verified source and release state

| Field | Verified value |
|---|---|
| Worktree | `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` |
| Branch | `codex/b1-503-storyforge-product-recovery` |
| Local HEAD | `82669485c187cd3127ab2c84cb79864d827e0aef` |
| Application-source commit | `df42c5e05dd11f63c7ea17f99127e43e2d03347c` |
| Upstream | `origin/codex/b1-503-storyforge-product-recovery` |
| Upstream SHA | `0bd7da46b5f25122ad53cd73f8eaf6eb1f546409` |
| Divergence | 18 ahead, 0 behind |
| Pre-dossier worktree | Clean |
| Deterministic candidate | `v-0892c26c62d96206` |
| GitHub custody | Candidate not pushed; no StoryForge PR/check/release; branch unprotected |
| Current production commit | `6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Current production release | `v-0912286e7dfc2327` |

Canonical hashes:

- V5 HTML: `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- V5.5 prototype: `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90`
- V5.5 r2 prototype: `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b`
- Generated candidate assets recorded by B1-506C: app `3ae148bb…`, auth `d2cfc4…`, CSS `08a392…`

Latest local evidence:

| Suite | Passing |
|---|---:|
| Unit | 189/189 across 26 files |
| PostgreSQL | 150/150 |
| Browser E2E | 45/45 across 8 specs |
| Product conformance | 72/72 |
| B1-506C implementation ledger | 36/36 |

The voice tests use fake microphone/provider/storage/assembly boundaries. No real StoryForge provider, R2, WordPress multipart/DELETE, physical-device, or production voice E2E has passed. The destructive container-backed integration script was not freshly rerun; its historical 7/7 is not current voice proof.

## 2. Authority hierarchy and recovered corrections

Controlling precedence:

1. Founder-approved V5 HTML controls unchanged product surfaces.
2. Founder-approved V5.5 prototype/r2 controls Phase 1 voice product behavior.
3. B1-504A controls product scope, workflow, provider bakeoff, privacy/lifecycle, and acceptance.
4. B1-504B controls platform/infrastructure integration.
5. B1-505C controls delivery sequencing, not product behavior.
6. B1-506A supplies six bounded Fable amendments.
7. B1-506B supplies the exact 90-second and reconciliation rulings.
8. The B1-507A Founder scope confirmation requires the entire voice/audio/deletion lifecycle for completed Phase 1 and defines the audience.
9. The current repository is implementation truth under those authorities.
10. B1-506C is implementation/test evidence.
11. B1-503 receipts plus fresh read-only probes define what is live.

Recovered corrections:

- The binding transcription pair is `gpt-4o-transcribe` then `whisper-1`; the older B1-504B label is superseded.
- Full Phase 1 is not text-only. Permanent audio, replay, delayed recovery, cleanup, and automatic deletion are mandatory.
- “36/36 implemented” is local authorized-lane completion, not production readiness.
- Both assembly executors are candidates; no executor is selected or wired.
- Production Phase 1 tables are absent, not merely empty.
- One observed Railway replica is not a locked scheduler invariant.
- The current replay client is not product-conformant despite a working backend playback path.
- Current WordPress eligibility code is evidence, not the missing final B1-505 360 authority receipt.
- `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` is stale and contradicts the fresh no-Worker evidence.

No B1-506D or B1-506E artifact exists. No final B1-505 eligibility handoff exists.

The detailed 52-artifact classification, plus three missing/stale artifact findings, is in `B1-507A_AUTHORITY_DOCUMENT_INDEX.md`.

## 3. Canonical Phase 1 product

Required production outcome:

1. Open normal StoryForge through WordPress/Matrix.
2. Keep the familiar typed-story path unchanged.
3. Show the approved first-recording privacy/consent notice.
4. Request microphone permission and provide truthful record/pause/resume/stop/cancel state.
5. Segment and locally buffer audio, then authenticated multipart-upload it to private temporary storage.
6. Transcribe through the replaceable provider boundary and poll near-live ordered results.
7. Merge transcript into the normal editable story without losing student edits.
8. Finish/save text independently of audio completion.
9. Assemble and verify permanent private audio.
10. Attach audio transactionally to the story and only then clean temporary objects.
11. At 90 seconds offer exact **Keep Waiting** and **Save Without Audio** behavior.
12. Recover delayed/restarted work and later attach completed audio.
13. Replay through a product-conformant private player.
14. Apply explicit/story/account/retention deletion and weekly reconciliation under approved safety controls.
15. Preserve RLS, audit, privacy, feature flags, force-off, rollback, and audience isolation.

Audience:

- Founder
- WordPress administrators
- currently enrolled 360 Match Mentorship students

The product is not public. Student-facing AI scoring, rewriting, coaching, themes, analogies, Socratic questions, and mentor intelligence remain deferred.

## 4. Implementation status

| Capability | Current state | Required next proof/work |
|---|---|---|
| V5 text workflows | Live and healthy | Post-cutover regression |
| Voice UI/capture | Implemented, simulated-browser tested, production-disabled | Real desktop/mobile/AX and production proof |
| Permission/pause/resume/stop/cancel | Implemented/tested with fakes | iPhone/Android interruption and permission matrix |
| IndexedDB buffering/segmentation | Implemented/tested | Real browser retention/recovery |
| Multipart upload API | Implemented/API-direct tested | Fix WordPress 415; R2 and live gateway proof |
| Near-live transcript | Implemented/fake-provider tested | RP-7, corpus, real provider/latency/failure |
| Transcript editing/provenance | Implemented/local tests | Production E2E |
| Assembly A and B | Both implemented/local tests | RP-8 equivalent, selection, wiring |
| 90-second UX | Implemented/strong local tests | Production timing/failure |
| Permanent attachment | Implemented/fake storage + PG tests | Migrations, R2, executor, production proof |
| Replay backend | Implemented/local tests | R2/live proof |
| Replay UX | Partial | Implement canonical pause/progress/time |
| Explicit deletion backend | Implemented/local tests | FG-1/control, WordPress DELETE |
| Cleanup/sweeps | Implemented/local tests | Production configuration/R2 |
| Delayed/restart recovery | Implemented/local tests | Selected executor/real storage/restart |
| Reconciliation | Implemented against fakes; off | Resolve C1-C5; dry-run/on acceptance |
| Phase 1 schema/RLS/audit/flags | Implemented/PG-tested | Backup/restore and production migration |

## 5. Exact voice architecture

Browser:

- native `getUserMedia` and `MediaRecorder`;
- MIME preference `audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`, `audio/ogg`;
- 20-minute/50-MB bounds;
- initial four-second then about fifteen-second segments;
- IndexedDB with seven-day expiry on voice-database open;
- two-second ordered transcript polling;
- idempotent retry/recovery paths.

Storage:

- temporary key model `storyforge-rec/{student_uuid}/{recording_uuid}/seg-{sequence}.{extension}`;
- permanent stem `storyforge-audio/{student_uuid}/{story_uuid}/{audio_asset_uuid}`;
- private objects only;
- server-derived keys and signed replay URLs;
- storage verification and transaction-bound attachment before temp deletion.

Provider:

- adapter `server/transcription/adapter.mjs`;
- primary `gpt-4o-transcribe`;
- fallback `whisper-1`;
- `/v1/audio/transcriptions`;
- 30-second provider-request timeout;
- production remains provider `none`.

Assembly:

- Option A: server-side final media object.
- Option B: permanent manifest/segment layout.
- Both are implemented/tested.
- Runtime intentionally wires an unavailable executor until RP-8 selects one.

Replay:

- authenticated playback endpoint and signed URL refresh exist;
- ordered multi-segment playback is tested;
- current client cannot offer the canonical usable pause/progress/time experience.

Reconciliation:

- in-process weekly scheduler;
- modes off/dry_run/on;
- production default off;
- nonempty suspension value stops it;
- 168-hour eligibility;
- list page ≤1,000, evaluation ≤5,000, delete cap 200, one retry;
- dry-run performs zero deletes and zero audit writes.

## 6. RP-7 and RP-8

### RP-7 — provider/privacy/quality

Purpose: prove real account, key, privacy, medical/accent accuracy, latency, failure, and cost.

Observed:

- authenticated OpenAI session;
- Personal organization, Default project only;
- no StoryForge-scoped project/key;
- broad active Default-project keys exist but are not StoryForge authority;
- API call logging “Enabled per call”;
- audit logging not enabled;
- no MissionMed BAA/Healthcare Addendum/ZDR proof for this workload;
- no StoryForge production provider call;
- no evidenced human corpus.

Required corpus/bakeoff:

- 40 medical passages;
- at least six accent groups;
- three runs;
- WER ≤12% and no worse than baseline;
- medical recall ≥92% and baseline +10 points where specified;
- substitution ≤3%;
- accent degradation ≤8 points;
- first-text p95 ≤10 seconds;
- final p95 ≤8 seconds;
- failure <1% after one retry;
- cost ≤$0.01/minute.

RP-7 is a real activation blocker. Computer Use can perform account/project/key/test operations after Founder/privacy/corpus inputs. It cannot invent contract status or a human corpus.

### RP-8 — assembly selection

Binding definition: compare both candidates in the authorized Nixpacks runtime with 40×15-second fixtures (ten minutes total), complete Chrome/Safari playback, and select the option meeting the ≤60-second criterion with evidence.

Host-only 0.11/0.12-second results do not count. The old text specifies a local Nixpacks container. Local container troubleshooting is now prohibited. Docker is not an architectural requirement, but no existing binding authority explicitly permits an equivalent non-Docker execution path.

Required resolution: a narrow Fable amendment authorizing an ephemeral non-production Railway/Nixpacks-equivalent probe or another exact equivalent. Then Codex can execute, select, wire, and regression-test the winner. RP-8 is a real permanent-audio launch blocker.

## 7. Reconciliation contradictions

| Code | Exact contradiction | Status/launch effect |
|---|---|---|
| FABLE-C1 | R2 delete and PostgreSQL audit cannot be atomic; crash truth unspecified | Needs Fable durable-intent/recovery ruling; blocks `on` |
| FABLE-C2 | E11 is feature flags, but operator-visible reconciliation actions are required | Needs exact query/surface/audience ruling; blocks operational acceptance |
| FABLE-C3 | Orphan keys can encode nonexistent UUID rows, defeating audit foreign keys | Needs exact attribution/tombstone model; blocks orphan auto-delete |
| FABLE-C4 | Fixed first-5,000 evaluation can starve later students | Needs cursor/checkpoint/fair selection or claim change; blocks scaled `on` |
| PROBE-C5 | Every replica starts a timer; one current replica is not a locked invariant | Lock/monitor one replica or obtain coordination authority |

No later authority resolves these. They do not block the live text product or a dormant default-off release. They block automatic deletion, which the Founder explicitly made part of completed Phase 1.

## 8. WordPress/Matrix integration

Production route: `https://missionmedinstitute.com/storyforge/`

Flow:

- WordPress owns login and initial eligibility.
- Active `missionmed-storyforge-sso` maps a stable UUID and issues a short-lived StoryForge JWT.
- Railway validates JWT/origin/role/flags.
- PostgreSQL RLS enforces row access.
- WordPress proxies the shell/API and owns token refresh/logout.

Current entitlement code:

- WordPress administrators are trusted active admins.
- Founder user ID 1 is allowlisted and currently rendered in student view.
- Student eligibility delegates to `mmhq_cam_build_entitlement`.
- Defaults require current LearnDash course `3893`, a verified qualifying purchase, product `3575` or `5511` or tier `360elite`, `360elite_onboarding`, or `360_match_mentorship`, and no expired/revoked/restricted state.

The missing final B1-505 authority/receipt must ratify or replace this seam and a representative identity matrix must prove it in production.

Critical gateway gap:

- current proxy allows GET/POST/PATCH only;
- current POST/PATCH require JSON;
- multipart segment upload returns 415;
- audio DELETE returns 405.

This is unresolved code, not configuration.

Kinsta uses immutable release directories and a current pointer to `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`. Cutover must create a new immutable release and retain the previous pointer/plugin/route receipts.

## 9. Production systems

Eight systems were inspected:

1. **GitHub:** upstream exists but lacks local candidate/review/check custody.
2. **Railway API:** B1-503 healthy; one observed instance; no V5.5 config.
3. **Railway PostgreSQL:** PG18.4; five migrations; Phase 1 tables absent.
4. **MyKinsta:** live MissionMed environment accessible; B1-503 pointer.
5. **WordPress:** SSO active; Founder pilot works; gateway incompatible with voice writes.
6. **Cloudflare Workers/routes:** no StoryForge Worker/route; stale manifest must be regenerated.
7. **Cloudflare R2:** no StoryForge bucket/token/lifecycle.
8. **OpenAI:** no StoryForge project/key/privacy/bakeoff proof.

Current Railway identifiers:

- project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- API service `dab015bf-15ef-4698-9f16-cbf8cf23de7a`;
- database service `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- API deployment `fa7ad084-4dae-4039-a154-2250a407d95e`;
- domain `storyforge-v5-api-production.up.railway.app`.

Live configuration has no R2, OpenAI StoryForge, voice, sweep, or reconciliation variables. Source defaults provider to `none` and reconciliation to `off`. `/healthz` is 200, `/api/config` reports audio unavailable and AI false, unauthorized API access fails, and the current text route is healthy.

## 10. Backups and migrations

B1-503 has historical Kinsta/database/rollback receipts. They are not a current Phase 1 recovery point.

Before any write:

1. create fresh Kinsta and PostgreSQL backups;
2. bind their IDs/receipts/hashes;
3. restore to an isolated target;
4. verify PG system identifier, version, ledger, user/content counts, and role flags;
5. retain current Railway deployment, Kinsta pointer/plugin/route/settings hashes;
6. time the rollback rehearsal with voice/provider/reconciliation off.

Candidate migrations:

- `20260729000100_b1_506_voice_recording_sessions.sql`
- `20260729000200_b1_506_feature_flags.sql`
- `20260729010000_b1_506a_voice_audit_lifecycle.sql`

The guarded `scripts/apply-production-migrations.sh preflight|apply` binds exact Railway IDs, backup receipt/hash, deploy SHA/source archive, PG target/system ID/counts, Founder UUID, role credential, migration ledger, and PostgreSQL 18 client. Apply requires its exact confirmation token and separate write authority.

## 11. Safest launch train

1. Resolve FG-1, RP-8, C1-C4 and the conditional C5 decision.
2. Implement gateway/replay/assembly/reconciliation-authorized changes and rerun full local suites.
3. Push exact candidate into reviewed GitHub custody.
4. regenerate deterministic assets, protected manifest, and secret/provenance evidence.
5. take fresh backups and pass isolated restore rehearsal.
6. provision private R2 and validate with nonstudent fixtures.
7. complete OpenAI project/privacy/human bakeoff.
8. complete the authorized RP-8-equivalent comparison and wire the winner.
9. run guarded production migration preflight, then separately authorized apply.
10. deploy dormant Railway backend with provider none, voice force-off, reconciliation off.
11. deploy corrected WordPress gateway/plugin and immutable Kinsta release while dormant.
12. prove Founder/admin/eligible-360/ineligible/anonymous/direct-API access.
13. activate Founder-only voice and run full real-service/device/AX acceptance.
14. widen to admin plus one eligible 360 test account and repeat.
15. run reconciliation dry-run and review evidence.
16. after explicit Founder approval, prove a bounded `on` deletion fixture and suspension.
17. activate currently enrolled 360 students in controlled cohorts with monitoring.

Rollback ladder:

1. remove cohort scope;
2. database flag off and voice force-off;
3. provider `none`;
4. reconciliation off/suspended;
5. previous Kinsta pointer/plugin/route;
6. previous Railway deployment;
7. preserve additive schema/evidence;
8. restore from proven backups only for actual corruption.

## 12. Complete launch blockers

Exactly 18 real blockers remain:

1. GitHub release custody/checks/protection.
2. stale protected-system manifest.
3. WordPress multipart/DELETE code gap.
4. replay conformance.
5. Founder FG-1 retention/consent/delete/wind-down ruling.
6. RP-8 equivalent/selection/wiring.
7. R2 provisioning/security/lifecycle.
8. production backup/restore and Phase 1 migrations.
9. RP-7 OpenAI project/key/privacy/contract.
10. required human medical/accent corpus/bakeoff.
11. final 360 entitlement authority/identity proof.
12. FABLE-C1.
13. FABLE-C2.
14. FABLE-C3.
15. FABLE-C4.
16. PROBE-C5.
17. fresh Kinsta/PostgreSQL recovery points and rollback rehearsal.
18. real provider/R2/gateway/device/accessibility/production acceptance.

Five definitely need new Fable authority: RP-8 and C1-C4. C5 needs Fable only if a one-replica invariant cannot be locked and evidenced. Founder inputs are FG-1, the human corpus, final 360 authority/accounts, contract/privacy/MFA actions, and explicit remote-write/activation approvals.

## 13. Production acceptance

“STORYFORGE PHASE 1 IS FULLY LIVE” requires every item below:

- canonical route and approved product;
- Founder/admin/currently enrolled 360 access and all unauthorized denials;
- bootstrap/refresh/logout/direct-API security;
- microphone permission/denial/recovery;
- record/pause/resume/stop/cancel;
- real multipart upload and private R2;
- real primary/fallback transcription and full bakeoff;
- transcript preservation/editing and byte-identical save;
- selected assembly, permanent attachment, cleanup;
- canonical replay/persistence/signed-URL refresh;
- reload/restart/delayed recovery;
- exact 90-second Keep Waiting/Save Without Audio;
- retry/idempotency/provider/storage failure truth;
- FG-1 lifecycle and explicit/story/account deletion;
- reconciliation dry-run, Founder-approved `on`, suspension, fairness, one scheduler, audit truth;
- fresh backup/restore and rehearsed rollback;
- desktop/mobile/VoiceOver/TalkBack/keyboard/responsive acceptance;
- full regression and no impact on other MissionMed applications.

The exhaustive checkbox matrix is in `B1-507A_PRODUCTION_ACCEPTANCE_CRITERIA.md`.

## 14. Environment/secret names

Required names, without values:

- runtime: `STORYFORGE_DATABASE_URL`, JWT/JWKS issuer/audience/secret variables, allowed origins, base/public/Matrix origins, origin-api-only, static directory, WordPress bootstrap/token paths, token-refresh skew;
- storage: `STORYFORGE_R2_ENDPOINT`, `STORYFORGE_R2_REGION`, `STORYFORGE_R2_BUCKET`, `STORYFORGE_R2_ACCESS_KEY_ID`, `STORYFORGE_R2_SECRET_ACCESS_KEY`, `STORYFORGE_R2_SIGNED_URL_TTL_SECONDS`;
- provider: `STORYFORGE_TRANSCRIBE_PROVIDER`, `STORYFORGE_OPENAI_API_KEY`, primary/fallback model variables;
- safety/lifecycle: `STORYFORGE_VOICE_FORCE_OFF`, valid cohorts, daily minutes, sweeps, audio reconciliation mode/suspension;
- deploy/migration: exact commit/source archive/hash, Railway project/environment/database service IDs, backup ID/receipt/hash, expected PG target/system/counts, Founder UUID, app DB password, migration confirmation, provider-injected Railway/PG target variables.

`STORYFORGE_PLATFORM_OFF` is not consumed by current runtime source and must not be claimed as an exercised kill switch.

## 15. Screenshots

Eight verified screenshots captured from 2026-07-30T03:12:17Z through 2026-07-30T03:30:42Z document:

1. live Founder student-view shell with voice disabled;
2. Railway B1-503 successful deployment and one observed replica;
3. live Kinsta environment;
4. R2 inventory without a StoryForge bucket;
5. no StoryForge Worker route;
6. upstream GitHub StoryForge branch;
7. OpenAI data-control readiness;
8. active WordPress StoryForge SSO plugin.

They are indexed in `B1-507A_SCREENSHOT_INDEX.md`. No secret values are visible.

## Exact inputs for the B1-507 full production megarun

Use:

- worktree `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`;
- branch `codex/b1-503-storyforge-product-recovery`;
- starting HEAD `82669485c187cd3127ab2c84cb79864d827e0aef`;
- candidate `v-0892c26c62d96206`;
- the V5/V5.5 canonical artifacts;
- B1-504A/504B, B1-505C, B1-506A/B/C authorities/handoffs;
- this complete B1-507A dossier;
- the eight production systems listed above;
- the exact environment/secret-name list above;
- the Founder/Fable inputs identified in the blocker register.

The megarun must:

1. reverify source/current production before any write;
2. resolve all 18 blockers without redesign;
3. preserve provider none, voice force-off, reconciliation off until their exact gates;
4. back up live, prove restore, and retain rollback before writes;
5. serialize Git/migrations/deployments;
6. run every real-service/device/identity/AX acceptance gate;
7. activate Founder, admins, then enrolled 360 students by controlled rung;
8. stop only at genuine authority/MFA/credential/irreversible boundaries;
9. never claim fully live while a mandatory audio-lifecycle capability is disabled.

Exact production URL: `https://missionmedinstitute.com/storyforge/`

Required final declaration only after all acceptance gates:

```text
STORYFORGE PHASE 1 IS FULLY LIVE
```

Otherwise report the exact safe partial rollout rung and remaining blockers.

## Dossier file map

1. `B1-507A_AUTHORITY_DOCUMENT_INDEX.md`
2. `B1-507A_AUTHORITY_PRECEDENCE.md`
3. `B1-507A_PHASE1_CANONICAL_SCOPE.md`
4. `B1-507A_CURRENT_IMPLEMENTATION_STATE.md`
5. `B1-507A_VOICE_ARCHITECTURE.md`
6. `B1-507A_PROVIDER_AND_PRIVACY_READINESS.md`
7. `B1-507A_AUDIO_LIFECYCLE_AND_RECONCILIATION.md`
8. `B1-507A_WORDPRESS_MATRIX_INTEGRATION.md`
9. `B1-507A_PRODUCTION_INFRASTRUCTURE_INVENTORY.md`
10. `B1-507A_DEPLOYMENT_SEQUENCE.md`
11. `B1-507A_PRODUCTION_ACCEPTANCE_CRITERIA.md`
12. `B1-507A_BLOCKER_REGISTER.md`
13. `B1-507A_SCREENSHOT_INDEX.md`
14. `B1-507A_FINAL_MEGARUN_INPUTS.md`
15. `B1-507A_COMPLETE_COMBINED_HANDOFF.md`
16. `MANIFEST.sha256`
17. `screenshots/` (eight evidence images)

The manifest is generated only after all dossier content is final and is the package-integrity authority.
