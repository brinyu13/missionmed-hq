# 13 Current Architecture and Runtime

RESULT: `CURRENT_MMC_ENGINEERING_ARCHITECTURE_VERIFIED`

## Scope and authority

This report describes the reconciled engineering baseline in:

- Worktree: `/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-004`
- Branch: `a1-macair-mmc-mentor-intelligence-004`
- Private product route: `/mmc-private/`
- MMC API roots: `/api/mmc/persistence` and `/api/mmc/coaching-pipeline`

It is a current code-and-local-validation description. It is not a production-topology decision, deployment authorization, schema-apply authorization, or claim that MMC is live. The most recent read-only production observation preserved by Prompt 004 found `/mmc-private/` absent. Prompt 004A performed no deployment or production mutation.

## Architecture in one view

```text
Authorized mentor browser
  |
  | encrypted HQ session, MMC role/capability gate, CSRF on mutations
  v
missionmed-hq/server.mjs
  |-- GET /mmc-private/*
  |     `-- static MMC HTML/CSS/JS after route-specific authorization
  |
  |-- /api/mmc/persistence
  |     `-- staging-project allowlist + anon key + short-lived RLS JWT
  |           `-- forced-RLS mmc.* ownership schema
  |
  `-- /api/mmc/coaching-pipeline
        |-- admin review, source assets, worker, identity, prompts, analysis
        |-- optional GET-only Webex source discovery/download
        `-- writes only to MMC-owned schema and an explicit local drop zone

External systems remain evidence sources or protected references:
WordPress / LearnDash / Matrix / Scheduler / Calendar / CRM / Webex / R2 / Stream
No shared-system write is part of the current baseline.
```

## Runtime layers

| Layer | Current implementation | Authority and boundary |
| --- | --- | --- |
| HTTP/runtime host | `missionmed-hq/server.mjs` | Shared protected HQ runtime. Prompt 004 semantically integrated five MMC hunks; Prompt 004A did not replace or broadly merge this file. |
| Private client | `missionmed-hq/public/mmc-private/index.html` plus `src/` | Current consolidated MMC product candidate. Static browser application with fixture-safe fallback and same-origin APIs. |
| Local product oracle | `mmc-v1-core/` | Preserved MMC-005A historical product/test fixture, not the mounted runtime. |
| Data adapter | `missionmed-hq/public/mmc-private/src/mmc-data-adapters.js` | Explicit no-network reality gate. Keeps fixtures when real identity and no-write read paths are not verified. |
| Ownership runtime | `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js` | MMC-owned state, deterministic intelligence, and same-origin persistence adapter. No general localStorage data fallback. |
| Persistence route | `/api/mmc/persistence` in `server.mjs` | Authenticated, mutation-CSRF-protected, staging-allowlisted, RLS-scoped access to `mmc.*`. Disabled by default. |
| Coaching pipeline | `missionmed-hq/routes/mmc-coaching-pipeline.mjs` | Private-route authorization plus persistence context; admin-only for import, identity approval, prompt administration, and Webex pull. |
| Media import | `missionmed-hq/lib/mmc-coaching-import-worker.mjs` | Dedicated, manually invoked scanner/importer. Does not import or start the Daily Drills watcher. |
| Webex discovery | `missionmed-hq/lib/mmc-webex-triggered-pull.mjs` | Optional trigger-gated, GET-only source API use; disabled without approved token and explicit pull enablement. |
| Identity | student-resolution and roster-verification libraries | Deterministic confidence, explicit review, fixture blocking, and no name-only auto-attachment. |
| AI analysis | pipeline route plus repository prompt | Structured, evidence-required output. Provider execution disabled unless separately configured; review remains required. |
| Database definition | two `supabase/migrations/*mmc*` files | Preserved and statically validated staging evidence. No migration was applied in this run. |

## Private mount and security model

`missionmed-hq/server.mjs` implements a route-specific private mount:

1. Only `GET` is accepted for `/mmc-private/*` assets.
2. An absent HQ session redirects through the existing authentication start route.
3. An authenticated user must have an allowed configured role, an explicit configured allowlisted address, or the WordPress `manage_options` capability.
4. Unauthorized sessions receive `403 mmc_private_forbidden`.
5. Authorized responses carry `X-MissionMed-Private-Mount: admin-only`, `X-MissionMed-Route: mmc-private`, and `X-Robots-Tag: noindex, nofollow`.
6. Static-path resolution remains inside the existing HQ static-server contract.

The MMC APIs sit behind the HQ authenticated API guard. Mutating methods require the existing `x-mmhq-csrf` token. The coaching route repeats the MMC-private authorization check and requires the MMC persistence context before handling data. Admin-only operations additionally call the pipeline-admin role gate.

No service-role browser/runtime key is used. The persistence integration is deliberately built around the Supabase anon key and a short-lived, server-minted JWT containing scoped MMC principal claims, with forced RLS as the database enforcement layer.

## Persistence configuration gate

Persistence is fail-closed and disabled by default. `getMmcPersistenceConfig()` rejects operation unless all of the following are true:

- `MMHQ_MMC_PERSISTENCE_ENABLED` is enabled for a separately authorized environment;
- a valid MMC Supabase URL exists;
- the URL's project reference is not in the forbidden production set;
- the project reference exactly matches the configured allowed staging reference;
- an anon key exists;
- an MMC JWT signing secret exists.

The report intentionally records environment variable names but no values. Prompt 004A did not read secret values into a file, enable persistence, apply schema, or connect a real account.

## Current schema and data ownership

The preserved schema foundation defines 12 base tables in `mmc`:

| Domain | Table | Owner |
| --- | --- | --- |
| Cross-system identity evidence | `mmc.identity_references` | MMC after verification; external systems remain source owners |
| Mentor principal | `mmc.mentors` | MMC |
| Mentor-to-student access | `mmc.mentor_assignments` | MMC |
| Call lifecycle | `mmc.coaching_sessions` | MMC |
| Session summaries and references | `mmc.session_artifacts` | MMC |
| Relationship and coaching context | `mmc.mentor_memory` | MMC |
| Mentor-only notes | `mmc.private_notes` | MMC |
| Tasks and promises | `mmc.action_items` | MMC |
| Goals and milestones | `mmc.goals` | MMC |
| Unfinished commitments/topics | `mmc.open_loops` | MMC |
| Derived briefing/analysis state | `mmc.intelligence_snapshots` | MMC |
| Immutable operational trace | `mmc.audit_events` | MMC |

The coaching-intelligence migration adds three tables:

- `mmc.ai_prompt_versions`
- `mmc.coaching_source_assets`
- `mmc.coaching_analysis_runs`

All 15 tables enable and force RLS. Policies distinguish administrators from an assigned mentor, and access helpers evaluate the current principal, current MMC role, active assignment, and subject reference. The migration grants only the intended authenticated operations; delete is not part of the client contract. Prompt 004A did not apply either migration.

## Browser-side state

The private client has three intentionally different state classes:

1. **Fixture-safe working state.** The adapter supplies a clearly labeled demo roster when real sources are not verified. It performs no external request and reports zero real-data replacements.
2. **MMC-owned state.** The ownership layer models assignments, memory, notes, goals, tasks, promises, sessions, artifacts, open loops, identity references, and intelligence snapshots. When the same-origin persistence route is available, it hydrates/synchronizes only these MMC domains.
3. **Presentation preferences.** Display density, expanded profile detail, and Pipeline Admin trigger-filter preference may use best-effort browser storage. Profile-photo storage is a separate local internal-pilot path. These preferences are not canonical student records.

There is no general localStorage fallback for persistent coaching records. In the local evidence run, persistence and external integrations were intentionally disabled; the rendered content therefore represents fixtures and in-memory/local preference behavior, not live authority.

## Current route inventory

### Product and persistence

- `GET /mmc-private/`
- `GET /mmc-private/index.html`
- `GET /mmc-private/src/app.js`
- `GET /mmc-private/src/mmc-data-adapters.js`
- `GET /mmc-private/src/mmc-ownership-layer.js`
- `GET /mmc-private/src/styles.css`
- `/api/mmc/persistence` — same-origin load/sync contract implemented in `server.mjs`

### Coaching pipeline

The route advertises and implements:

- `GET /api/mmc/coaching-pipeline/status`
- `GET /api/mmc/coaching-pipeline/inventory`
- `GET /api/mmc/coaching-pipeline/source-assets`
- `POST /api/mmc/coaching-pipeline/source-assets/import`
- `GET /api/mmc/coaching-pipeline/worker/status`
- `GET /api/mmc/coaching-pipeline/worker/scan`
- `POST /api/mmc/coaching-pipeline/worker/import`
- `POST /api/mmc/coaching-pipeline/worker/process`
- `GET /api/mmc/coaching-pipeline/webex/status`
- `GET /api/mmc/coaching-pipeline/webex/recordings`
- `POST /api/mmc/coaching-pipeline/webex/pull`
- `GET /api/mmc/coaching-pipeline/student-resolution/review-queue`
- `POST /api/mmc/coaching-pipeline/student-resolution/resolve`
- `POST /api/mmc/coaching-pipeline/student-resolution/approve`
- `GET /api/mmc/coaching-pipeline/roster-verification/sources`
- `POST /api/mmc/coaching-pipeline/roster-verification/resolve`
- `POST /api/mmc/coaching-pipeline/roster-verification/approve`
- `GET /api/mmc/coaching-pipeline/prompts`
- `POST /api/mmc/coaching-pipeline/prompts`
- `POST /api/mmc/coaching-pipeline/prompts/activate`
- `POST /api/mmc/coaching-pipeline/prompts/rollback`
- `POST /api/mmc/coaching-pipeline/prompts/test`
- `POST /api/mmc/coaching-pipeline/analysis-runs`
- `POST /api/mmc/coaching-pipeline/analysis-runs/attach`
- `POST /api/mmc/coaching-pipeline/analysis-runs/mock-analyze`
- `POST /api/mmc/coaching-pipeline/analysis-runs/analyze`

Mutating routes are implementation contracts, not authorization to invoke them against staging or production.

## Current screen architecture

The private route is a single-page static application with the following implemented surfaces:

- Today dashboard and operating rollup
- Actions, tasks, reviews, promises, decisions, and follow-ups
- Attention-ranked Student Directory
- Student Profile with readiness, risk, strategy, goals, timeline, meetings, messages, and files
- Meeting Intelligence with source/session history, transcript/recording pointers, analysis, and empty states
- Mentor Memory / Call Prep with relationship context, prior advice, open loops, and next best move
- Session Command for live capture
- Post-Session Capture for summary/action/visibility review
- Student View Preview for role-scoped projection
- Pipeline Admin for worker state, Webex triggers, source inventory, identity resolution, roster verification, prompt/analysis workflow
- Quick Capture and private-alpha status controls

The synthetic partner demo at `/mmc-partner-demo/` is a preserved, self-contained product-history surface. It is not private-route authority, production proof, or an integration client.

## Runtime lifecycle

```text
Start local HQ runtime
  -> serve authorized private mount
  -> hydrate fixture-safe UI immediately
  -> attempt same-origin MMC persistence bootstrap
       -> fail closed to labeled fixture state if disabled/unavailable
       -> otherwise mint scoped RLS JWT and load assigned MMC records
  -> mentor navigates directory/profile/call prep
  -> optional session command and post-session review update MMC state
  -> optional Pipeline Admin scans explicit local media pairs
  -> identity/roster review decides whether attachment is allowed
  -> optional structured analysis persists evidence-linked MMC objects
  -> student preview exposes only approved student-visible projections
```

## External-system boundaries

| System | Current MMC relationship | Forbidden in this run and baseline |
| --- | --- | --- |
| WordPress | Existing HQ authentication; future identity evidence | No WordPress writes or auth weakening |
| LearnDash | Future read-only enrollment evidence | No enrollment mutation |
| Matrix | Protected profile reference only | No runtime asset touch, import, deployment, or claim of parity |
| Scheduler / Calendar | Future no-write supporting evidence | No booking, cancellation, reschedule, sync, cache, or credential mutation |
| Webex | Optional read-only inventory/download foundation | No Webex recording, meeting, token, or configuration mutation |
| Daily Drills / Video System | Read-only registry inventory and isolated drop-zone contract | Do not start watcher or write `video_registry.json` |
| R2 / Stream | Explicitly excluded | No object or video mutation |
| File Vault / Arena / STAT / StoryForge / ACTN | Protected peers or future references | No cross-app mutation or unapproved coupling |

The Matrix all-assets guard does not establish a clean Matrix runtime in this MMC worktree. Accordingly, this branch treats Matrix only as a protected external reference and claims no Matrix deployment readiness.

## Canonical source hierarchy

1. MissionMed OS authority and protected known-good records
2. Current tracked implementation and deterministic validators on this branch
3. Prompt 004A reports and screenshot evidence
4. Prompt 004 migration reports as provenance
5. `historical_macbook_air/HISTORICAL_CORPUS_MANIFEST.sha256`
6. Raw MacBook Air archive and quarantine as local-only historical evidence

The 188 raw historical reports remain local because the remote repository is public. Their sanitized manifest proves byte identity without publishing report bodies, personal/operational metadata, or credentials.

## Known architecture decisions still open

- **Production topology:** historical authority preferred a standalone runtime, while the current validated engineering candidate is HQ-mounted. Neither is silently promoted to production authority. Fable may shape the product experience, but an explicit engineering decision record must choose topology later.
- **Live identity sources:** WordPress, LearnDash, Matrix, Scheduler, CRM, Calendar, and Webex evidence envelopes are not yet proven end-to-end with approved least-privilege access.
- **Staging persistence:** schema and contracts exist, but this run did not execute credentialed staging proof or apply migrations.
- **Webex drop-zone spelling:** the pull module retains a historical `MissionWebexVidoes` default while the worker prefers `MissionWebexVideos`; compatibility normalization requires its own tested ticket.
- **Student publication model:** object-level visibility exists in schema/UX concepts but needs a single explicit approval/publish lifecycle.

## Architecture conclusion

The branch contains a coherent, launchable local engineering foundation: an authorized private client, MMC-owned schema and RLS contracts, same-origin persistence, a dedicated coaching import pipeline, deterministic identity/review lanes, versioned evidence-bound analysis, and protected-system boundaries. It is suitable as the canonical input to Fable 5 CAM v2.0 architecture work. It is not deployed, not connected to production data, and not authorization to mutate any shared or external system.
