# I1Q-1007X Ecosystem Dependencies

## Verdict

`MAPPED, SHARED INTEGRATION BLOCKED`

The I1Q application has a safe isolated engineering boundary, but no canonical authenticated host, RANKLISTIQ migration workflow, staging environment, or deployment route was found. The protected consumer and shared-auth dependencies are mapped and remain unchanged.

## Canonical Ownership

| Boundary | Owner | I1Q rule |
| --- | --- | --- |
| Identity provider | WordPress | Reuse signed handoff; no parallel identity |
| Encrypted session and bootstrap | MissionMed HQ on Railway | Reuse only after expiry, secret, CORS, revocation, and outage proof |
| App roles and assignments | I1Q | Resolve from app-owned records; never infer physician status from title, name, or WordPress role |
| I1Q datastore | RANKLISTIQ Supabase | Additive `i1q` schema through a new MR-078A route |
| STAT runtime | STAT owner | Exact versioned server projection; no sealed-pack change |
| Drills and Daily ingestion | Existing Drills/MMVS owner | Read-only source and sidecar adapter; no ingestion mutation |
| Stream, R2, and CDN | Existing media and deployment owners | Read-only source work; GitHub-only runtime deployment |
| Raw transcript processing | Privacy owner | Restricted zone only; no raw text in Git, logs, or handoffs |
| Production deployment and flags | Root Supervisor plus owners | Same certified hashes; all flags off until gates pass |

## Authentication Topology

The observed browser path is WordPress login, signed 60-second handoff, HQ session exchange, encrypted HttpOnly cookie, and RANKLISTIQ Supabase bootstrap. Arena, STAT, and Daily already use this route.

The dedicated I1Q service currently has no canonical `identityResolver`. I1Q roles are not WordPress roles. A safe adapter must obtain a verified canonical actor, resolve I1Q roles and current assignments server-side, enforce expiry and revocation, apply CSRF and origin checks, and establish a trusted database context without exposing credentials.

Shared HQ source review found three release blockers:

- expired, missing-expiry, or invalid-expiry encrypted sessions are warned about but returned
- the session-secret fallback makes configured-secret checks appear true even when the environment secret is absent
- credentialed CORS can reflect an arbitrary request origin when no fixed origin is configured

No shared HQ or WordPress file was changed in this run.

## Datastore Topology

DR-006 routes the additive schema to RANKLISTIQ. The root `supabase/migrations/` path is documented as Growth Engine ownership and has a migration-history desynchronization. It is not a safe I1Q target.

No tracked GitHub workflow or canonical RANKLISTIQ migration directory was found. The app-local `20260715122434` migration is a validated standalone MR-078A candidate and passed disposable PostgreSQL apply, reapply, RLS, compensation, and reapply tests. It still cannot enter preview or staging until an owner-provided project-pinned workflow exists.

## Consumer Boundaries

### STAT

I1Q may publish only a new immutable versioned dataset through the exact nine-field server projection. The sealed pack, answer map, scoring, active datasets, historical attempts, and protected runtime are no-touch.

Two authority collisions require STAT-owner resolution before activation: the documented seven-field `get_duel_pack` contract differs from tracked SQL and runtime envelopes, and client hash recomputation requirements conflict across current authority documents.

### Drills And Daily

The current MMVS API is the observed 97-row source. Drills requires playback or Stream ID and nodes, while transcript absence can be explicit. Daily currently requires video ID, title, playback, nodes, and transcript URLs. I1Q must preserve those differences with a versioned read-only adapter.

The canonical ownership split among MMVS, RANKLISTIQ drill controls, and Growth Engine registry declarations requires a named Drills and Data owner ruling. I1Q must not duplicate or mutate ingestion.

### Protected Runtime

Arena, STAT, Drills, Daily, and WordPress wrapper routes are reachable and current runtime markers pass. All four deployed CDN files differ materially from tracked `LIVE/` checksums. Deployed bytes therefore remain runtime truth, and the tracked files cannot serve as a deployment or rollback baseline.

## Media Sources

The real inventory observed 97 playback references, 97 transcript JSON artifacts, and 97 nodes JSON artifacts. No separate VTT artifact was verified. Stream, transcript, nodes, and any future VTT availability must be represented independently.

No additional Drive corpus source was observed. HQ and CIE media routes exist but were not wired into I1Q. All source access remains read-only and all real sources remain privacy-blocked.

## Deployment Topology

The existing `railway.json` starts MissionMed HQ and must not be overloaded. The local R2 and CDN deploy scripts belong to protected consumer HTML and are not an authorized I1Q route. No I1Q URL, preview environment, staging environment, production runtime, workflow, monitor, or rollback rehearsal was found.

A future route must pin:

- exact GitHub commit and application build root
- dedicated internal host and health and API routes
- canonical session adapter and fixed allowed origins
- RANKLISTIQ schema and migration project pin
- preview, staging, backup, rollback, reapply, and monitoring steps
- all consumer and student flags off by default

## Dependency Risk

The repository lockfile was updated to fixed versions. The current root `npm audit --audit-level=low` result is zero vulnerabilities.

## Baselines

| Baseline | Result |
| --- | --- |
| MissionMed OS registration and DR-006 | PASS, canonical main merge verified |
| Protected static deploy validator | PASS |
| Protected LIVE route reachability and markers | PASS |
| Protected source and runtime checksums | FAIL, four of four diverge |
| I1Q current local suite | PASS, 228 discovered, 227 passed, 0 failed, and 1 disposable-database skip |
| STAT, Drills, and Class C adapter suite | PASS, 48 of 48 |
| Evidence validator | PASS, 20 of 20 files and State A |
| Live authenticated session journey | NOT RUN |
| Browser journey | BLOCKED, in-app browser unavailable |
| Disposable local migration and RLS | PASS, 13 of 13; preview still not run |
| Staging, rollback, and monitoring | NOT AVAILABLE |

## Current Release Position

Engineering may continue inside `i1q-question-platform/` with synthetic, non-medical fixtures. Real extraction, shared-auth coupling, protected consumer integration, migration application, staging, and deployment remain blocked until their named gates have owner-certified evidence.
