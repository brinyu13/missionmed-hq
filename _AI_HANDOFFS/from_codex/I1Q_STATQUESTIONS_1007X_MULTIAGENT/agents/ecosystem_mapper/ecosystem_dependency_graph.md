# I1Q-1007X Ecosystem Dependency Graph

## Scope Completed

Read-only mapping is complete for MissionMed OS boot, mission/product registries, the Question Platform passport and DR-006; canonical WordPress, Railway HQ, and Supabase authentication; RANKLISTIQ and Growth Engine ownership; Matrix, Arena, STAT, Drills, and Daily Rounds; MMVS, CIE, Stream, R2/CDN, transcript, VTT, nodes, and Drive source paths; legacy v4 identity; and the GitHub, Railway, Supabase, WordPress, and CDN deployment routes.

The worktree changed during mapping as other agents committed I1Q-owned adapter work and modified I1Q implementation files. Those repairs are preserved and recorded as in-flight, not release-certified. No protected consumer, shared auth runtime, shared migration, MissionMed OS, feature flag, or deployment file was changed by this mapper. A frozen integration commit is required before certification.

## Authority Snapshot

| Evidence | Current observation |
| --- | --- |
| MissionMed OS `main` | `93c0404794fe105235b80514c75fffc3177f140b` |
| Local `origin/main` | Same commit; OS worktree clean |
| Mission registry | `I1Q-1006` active; `I1Q-1007X-MA` is the current next action |
| DR-006 | Merged, indexed as `I1Q_DR_006`, SHA-256 `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| Product passport | `PRODUCT_PASSPORTS/question-platform.md`; internal build authorized and student release blocked |
| Auth architecture gap | `MM-AUTH-ARCH-001` is referenced by MR-078B/MR-079 but absent from both canonical local trees |
| Protected passport gap | Product index paths for HQ, Arena, Matrix, and USCE are absent at this OS commit |

DR-006 is current authority, not a pending candidate. This mapper did not exercise migration, deployment, feature-flag, or consumer-activation authority.

## Ecosystem Shape

    MissionMed OS BOOT / CURRENT / registry / passport / DR-006
                                  |
                                  v
                  Dedicated I1Q internal application
                    |             |              |
          identity adapter   DB repository   source adapters
                    |             |              |
                    v             v              v
    WordPress -> HQ Railway -> RANKLISTIQ   MMVS / CIE / Stream / R2
       identity    session      i1q schema    transcript / VTT / nodes
                       |
                       v
              Supabase Auth bootstrap
                 |            |
                 v            v
               Arena -------> STAT
                 |
                 +----------> Daily Rounds -----> Drills

    Matrix shares the protected WordPress estate but has no authorized
    direct I1Q integration in this wave.

## Dependency Findings

| Boundary | Owner | Authority | Coupling | Protected status | Safest adapter | Required baseline |
| --- | --- | --- | --- | --- | --- | --- |
| MissionMed OS | Root Supervisor and Brian | BOOT, authority index, DR-006, Question Platform passport | Selects all downstream authority | Root-only | No adapter; append-only authority procedure | BOOT, CURRENT freshness, registry resolution, clean main |
| I1Q app | Question Platform; Root integrates | DR-006, 1004C, passport | Internal authoring/review/release | Isolated candidate | Dedicated app with narrow auth and DB adapters | Existing 30 tests plus negative security and DB tests |
| WordPress identity | WordPress and HQ | MR-078B, DR-006 | Identity and signed handoff | Protected | Reuse handoff; app-owned role mapping | Expiry, signature, host allowlist, role denial |
| HQ Railway session | HQ | Critical Systems Contract and Manifest, DR-006 | Cookie/bearer session and Supabase bootstrap | Protected active runtime | Root-owned introspection or isolated app route after security repair | Expiry, revocation, CSRF, secret, CORS, outage |
| RANKLISTIQ | Arena/STAT data plane; Root migrates | MR-078B, DR-006 | Auth, STAT, future i1q schema | Protected shared project | Additive schema with server transaction context | Preview migration, forced RLS, pooling, rollback, consumer smokes |
| Growth Engine | HQ/Growth data plane | MR-078A/B | CRM, media, contract-listed drill registry | Protected and history-desynchronized | Existing owner APIs only | Project pin and migration-history reconciliation |
| Matrix | Matrix | Delegated Matrix lock | Shared estate only | Protected active | No I1Q adapter | Guard, hashes, all App Mode routes |
| Arena | Arena | Critical Systems Manifest and MR-078B; indexed passport file is absent | Routes STAT and Daily; shared auth | Legacy protected | No Arena edit | Auth entry, project pin, route and avatar smokes |
| STAT | STAT | STAT Canon, MR-078B, DR-006 | Exact nine-field dataset and sealed packs | Frozen protected contract | New dataset release projection only | Nine fields, hash vector, answer isolation, joins |
| Drills | Drills/MMVS ingestion owner | DR-006, deployment lock | Playback, required nodes, optional transcript | Ingestion protected | I1Q-owned read-only availability sidecar exists locally; consumer wiring remains prohibited | Registry, nodes, transcript, VTT, playback, launch; owner certification absent |
| Daily Rounds | Daily surface with Drills/Arena | DR-006, Arena route contract | Five-field registry rows and control table | Protected shared runtime | Reuse Drills sidecar; no source write | Required fields, active filter, launch route |
| MMVS registry | MMVS/Drills ingestion owner | DR-006 read-only | Canonical current Drills and Daily source | Read-only for I1Q | Hash and inventory only | GET-only, schema, duplicate, reachability |
| CIE media routes | HQ Media/CIE | HQ runtime, DR-006 | Optional authenticated media metadata and chunks | Protected | Read-only owner endpoint | Auth gate, health, detail, no mutation |
| Stream/R2/CDN | Media owner and Root deploy owner | DR-006, HTML lock | Playback, source objects, runtime HTML | Protected | Metadata/object reads; GitHub-only runtime writes | Host, MIME, hash, CDN and wrapper checks |
| Transcript/VTT/nodes | Media/Drills plus Privacy Owner | DR-006, 1004C | Restricted extraction sources | Restricted | Redact before extraction; persist only safe segments | Speaker, identity, patient, timestamp, no-raw-log tests |
| Drive | MissionMed file owner plus Privacy Owner | DR-006 | Optional authorized corpus | Read-only if allowlisted | File-ID allowlist and hashes | Rights, owner, MIME, privacy |
| Legacy v4 | STAT | DR-006, STAT Canon | Read-only reconciliation and old joins | Immutable | Static hashed export and composite mapping | Counts, hash, duplicates, historical joins |
| GitHub delivery | Root and Release/Reliability | DR-006, critical contract, MR-078A | Preview through internal production | Root-only | Commit-pinned workflow with rollback | CI, staging, consumers, rollback, monitoring |

## Supabase Ownership

| Project | Authority domain | I1Q treatment |
| --- | --- | --- |
| RANKLISTIQ, fglyvdykwgbuivikqoah | Arena, STAT, dataset questions, duel state, telemetry, Supabase Auth | Authorized target for the additive i1q schema |
| Growth Engine, plgndqcplokwiuimwhzh | HQ CRM, media tables, Data Flow contract drill catalog | Not the I1Q datastore target |
| Scheduler staging, avpdetdkpwmqqxtvomix | Scheduler staging | No I1Q dependency |

The root supabase/migrations directory is declared to target Growth Engine, while STAT migrations use a separate RANKLISTIQ route. The candidate file i1q-question-platform/db/migrations/0001_i1q_question_platform.sql is therefore a design artifact, not an apply-ready migration.

## Current State

| Capability | State |
| --- | --- |
| Mission/product registration and DR-006 | Canonical and current at OS commit `93c0404`; release certification remains separate |
| I1Q runtime | Local synthetic or auth-adapter-required server |
| Persistence | `MemoryRepository` only; no RANKLISTIQ repository proven |
| Canonical identity adapter | Absent; I1Q auth hardening is not a canonical HQ resolver |
| RANKLISTIQ repository | Absent |
| Candidate SQL | Unapplied and MR-078A filename/header/route noncompliant |
| Real corpus | State A inventory evidence: 97 of 97 rows have playback, transcript, and nodes |
| Privacy-safe corpus | Privacy owner accepts all 97 as source-level verified_drj; 96 may support a future segment allowlist, one is zero-retention; all remain extraction-blocked |
| STAT channel | Baseline exact projection plus a committed adapter repair at 4724a24; direct tests pass; consumer flag off and owner certification absent |
| Drills channel | Explicit-availability adapter exists locally; integration and consumer-owner certification absent; flag off |
| Legacy v4 | Sanitized evidence hashes 845 static v4 rows and a 3,961-row CDN runtime collection; zero ID overlap, no import, and no production DB read |
| Daily, Arena, other channels | Contract-only; no I1Q activation |
| Internal platform/review flags | Off |
| Student flag | Off |
| Preview/staging/internal production | Not proven or deployed |
| Rollback/monitoring | Not executed or proven |
| Security | Not certified; current shared-auth and application-test findings remain release-blocking |
| UX/accessibility | Independent certification is not current on one frozen integrated commit |

## Dependency Audit

The offline audit result is not release evidence because the local advisory cache did not contain the current records. A current online `npm audit --json` reported four advisories across three vulnerable packages: high severity for `form-data`, moderate and high severity for `ws`, and low severity for transitive `esbuild`. No critical advisory was reported. Root must perform an isolated compatible dependency update and rerun repository tests before dependency clearance. This remains separate from auth, datastore, deployment, consumer, privacy, and application-test gates.

## Proposed File Ownership

| Owner | Exclusive scope |
| --- | --- |
| Ecosystem Mapper | agents/ecosystem_mapper only |
| Adapter and Identity Implementer | contracts.mjs, exports.mjs, new src/adapters files, new adapters-security test |
| Auth and Release Security Implementer | auth.mjs, server.mjs, platform.mjs, new security-regressions test |
| Privacy Normalization Implementer | privacy.mjs, pipeline.mjs, new privacy-regressions test |
| Evidence Validator Implementer | new validate-evidence.mjs, new validator test and fixtures |
| Architecture and Data | New I1Q repository design and new canonical migration candidate; Root chooses canonical path and applies it |
| Consumer owners | Tests and explicit approval for their own protected products; no I1Q agent edits protected consumer files |
| Root Supervisor | MissionMed OS, HQ/WordPress auth, shared migrations, protected runtimes, GitHub workflows, Railway, R2/CDN, flags, secrets, deployment, rollback, monitoring |

## Tests Performed

| Test | Result |
| --- | --- |
| Candidate BOOT and CURRENT read | Pass; no blocked mission or stale marker observed |
| Candidate/main DR-006 SHA-256 and routed file diff | Pass; identical |
| Initial source protected/application diff from 5ae58b0 | Pass at initial trace |
| Validation snapshot refresh | I1Q adapter commit and in-flight I1Q repairs observed; protected/shared paths still unchanged |
| I1Q npm test before concurrent repairs | Historical pass, 30 of 30 |
| Direct adapter repair suite at 4724a24 | Historical pass, 34 of 34; consumer-owner certification still absent |
| Current full I1Q snapshot | Not certified by this mapper. A 76-test, 66-pass, 10-fail run occurred while concurrent implementation edits were incomplete and is retained only as transient diagnostic evidence. Root must certify the final frozen integration commit. |
| Local protected-consumer validation | Pass; VALIDATION/validate_deploy.sh |
| I1Q npm run validate | Expected fail; src/validate-evidence.mjs is missing |
| npm audit online | Four advisories across `form-data`, `ws`, and transitive `esbuild`; dependency gate remains open |

No live browser, authenticated production, database, migration, network deployment, feature-flag, rollback, or monitoring test was performed by this mapper.

## Handoff To Root Supervisor

1. Accept this graph as the pre-mutation protected-consumer baseline.
2. Preserve all consumer flags off.
3. Treat `collision_risk_register.md` P0 findings as stop-the-line before any shared mutation or deploy.
4. Assign shared HQ expiry, configured-secret, CORS, nonce-replay, manifest-coverage, and mu-plugin findings to the protected-system owners.
5. Require Architecture/Data to produce a new canonical RANKLISTIQ migration candidate, then have Root run preview RLS and rollback/reapply evidence.
6. Obtain a STAT owner ruling on the frozen seven-field pack specification, tracked wrapper/client shape, answer-equivalent `bootstrap_match` response, and Data Flow client-hash contradiction.
7. Require Drills/Daily owner approval and protected-consumer tests for the local read-only explicit-availability sidecar.
8. Do not enter staging until security, UX, privacy, deployment-route, application tests, and protected-consumer gates are green on one fixed commit.
