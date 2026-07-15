# I1Q-1007X Ecosystem Dependency Graph

## Scope Completed

Read-only mapping is complete for MissionMed OS boot, mission/product registries, the Question Platform passport and DR-006; canonical WordPress, Railway HQ, and Supabase authentication; RANKLISTIQ and Growth Engine ownership; Matrix, Arena, STAT, Drills, and Daily Rounds; MMVS, CIE, Stream, R2/CDN, transcript, VTT, nodes, and Drive source paths; legacy v4 identity; and the GitHub, Railway, Supabase, WordPress, and CDN deployment routes.

The application topology is anchored to source commit 5ae58b091842af0a0aa570cd53a8c879e2925d24. During validation, commit 4724a24 added I1Q-owned STAT, class-A, and Drills adapter repairs, and uncommitted work appeared in auth.mjs, pipeline.mjs, privacy.mjs, and server.mjs. Those concurrent repairs are preserved and recorded as in-flight, not release-certified. No protected consumer, shared auth runtime, shared migration, MissionMed OS, feature-flag, or deployment file was changed by this mapper.

## Authority Snapshot

Assignment-time treatment: DR-006 was a reviewed candidate on codex/i1q-1007x-registration at b3d8089, with CANONICAL MERGE PENDING and independent verification pending.

Observed after assignment:

| Evidence | Observation |
| --- | --- |
| MissionMed OS main | 93c0404794fe105235b80514c75fffc3177f140b |
| origin/main | Same commit; worktree clean |
| Merge parents | 7144435 and b3d8089 |
| Merge subject | Merge PR #12: register and authorize I1Q Question Platform |
| DR-006 candidate/main SHA-256 | 8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae |
| Routed authority diff | No difference between candidate and main |

The map preserves the required assignment label, CANONICAL MERGE PENDING, as historical authority state. A clean canonical merge is now observed, but this mapper did not perform the independent release certification or exercise any resulting integration authority. Final acceptance belongs to the Root Supervisor.

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
| MissionMed OS | Root Supervisor and Brian | BOOT, authority index, DR-006, passport | Selects all downstream authority | Root-only | No adapter; append-only authority procedure | BOOT, CURRENT freshness, registry resolution, clean main |
| I1Q app | Question Platform; Root integrates | DR-006, 1004C, passport | Internal authoring/review/release | Isolated candidate | Dedicated app with narrow auth and DB adapters | Existing 30 tests plus negative security and DB tests |
| WordPress identity | WordPress and HQ | MR-078B, DR-006 | Identity and signed handoff | Protected | Reuse handoff; app-owned role mapping | Expiry, signature, host allowlist, role denial |
| HQ Railway session | HQ | Critical Systems Manifest | Cookie/bearer session and Supabase bootstrap | Protected active runtime | Root-owned introspection or isolated app route after security repair | Expiry, revocation, CSRF, secret, CORS, outage |
| RANKLISTIQ | Arena/STAT data plane; Root migrates | MR-078B, DR-006 | Auth, STAT, future i1q schema | Protected shared project | Additive schema with server transaction context | Preview migration, forced RLS, pooling, rollback, consumer smokes |
| Growth Engine | HQ/Growth data plane | MR-078A/B | CRM, media, contract-listed drill registry | Protected and history-desynchronized | Existing owner APIs only | Project pin and migration-history reconciliation |
| Matrix | Matrix | Delegated Matrix lock | Shared estate only | Protected active | No I1Q adapter | Guard, hashes, all App Mode routes |
| Arena | Arena | Arena passport, critical manifest | Routes STAT and Daily; shared auth | Legacy protected | No Arena edit | Auth entry, project pin, route and avatar smokes |
| STAT | STAT | STAT Canon, MR-078B, DR-006 | Exact nine-field dataset and sealed packs | Frozen protected contract | New dataset release projection only | Nine fields, hash vector, answer isolation, joins |
| Drills | Drills/MMVS ingestion owner | DR-006, deployment lock | Playback, required nodes, optional transcript | Ingestion protected | Read-only sidecar availability projection | Registry, nodes, transcript, playback, launch; direct adapter repair tests now pass |
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
| Mission/product registration and DR-006 | Clean merge observed; Root acceptance remains authoritative |
| I1Q runtime | Local synthetic or auth-adapter-required server |
| Persistence | MemoryRepository only |
| Canonical identity adapter | Absent |
| RANKLISTIQ repository | Absent |
| Candidate SQL | Unapplied and MR-078A filename/header/route noncompliant |
| Real corpus | State A inventory evidence: 97 of 97 rows have playback, transcript, and nodes |
| Privacy-safe corpus | Privacy owner accepts all 97 as source-level verified_drj; 96 may support a future segment allowlist, one is zero-retention; all remain extraction-blocked |
| STAT channel | Baseline exact projection plus a committed adapter repair at 4724a24; direct tests pass; consumer flag off and owner certification absent |
| Drills channel | Baseline artifact incompatible; committed explicit-availability adapter repair at 4724a24 passes direct tests; integration and consumer-owner certification absent; flag off |
| Legacy v4 | Sanitized evidence hashes 845 static v4 rows and a 3,961-row CDN runtime collection; zero ID overlap, no import, and no production DB read |
| Daily, Arena, other channels | Contract-only; no I1Q activation |
| Internal platform/review flags | Off |
| Student flag | Off |
| Preview/staging/internal production | Not proven or deployed |
| Rollback/monitoring | Not executed or proven |
| Security | Independent veto remains |
| UX/accessibility | Independent veto remains |

## Root Dependency Alert

The read-only root npm audit found four advisories across three vulnerable packages:

| Package | Relationship | Advisory severity |
| --- | --- | --- |
| form-data | Direct root dependency | High |
| ws | Direct root dependency | High |
| ws | Direct root dependency | Moderate |
| esbuild | Transitive root dependency | Low |

The audit summary reports two high-severity packages, one low-severity package, and no critical package. A source import scan found no imports of form-data, ws, or esbuild outside manifests and lock material. The isolated I1Q package declares no dependencies.

Classification: REPOSITORY-WIDE RELEASE RISK. The absence of imports lowers demonstrated reachability but does not clear the shared root lock, build, test, or Railway repository context. Root owns an isolated dependency update and full regression pass.

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
| I1Q npm test before concurrent repairs | Pass, 30 of 30 |
| Direct adapter repair suite at 4724a24 | Pass, 34 of 34; consumer-owner certification still absent |
| Local protected-consumer validation | Pass; VALIDATION/validate_deploy.sh |
| I1Q npm run validate | Expected fail; src/validate-evidence.mjs is missing |
| npm audit | Four advisories across form-data, ws, and esbuild |
| Source import scan | No imports found |

No live browser, authenticated production, database, migration, network deployment, feature-flag, rollback, or monitoring test was performed by this mapper.

## Handoff To Root Supervisor

1. Accept this graph as the pre-mutation protected-consumer baseline.
2. Preserve all consumer flags off.
3. Route the P0/P1 application repairs through the disjoint ownership matrix.
4. Assign shared HQ expiry, configured-secret, and CORS findings to the auth owner under a separate protected-path decision.
5. Require Architecture/Data to produce a new canonical RANKLISTIQ migration candidate, then have Root run preview RLS and rollback/reapply evidence.
6. Obtain a STAT owner ruling on the frozen seven-field pack specification versus the deployed wrapper/client shape and on the Data Flow client-hash contradiction.
7. Require Drills/Daily owner approval of a read-only explicit-availability sidecar contract.
8. Do not enter staging until security, UX, privacy, dependency, deployment-route, and protected-consumer gates are green on one fixed commit.
