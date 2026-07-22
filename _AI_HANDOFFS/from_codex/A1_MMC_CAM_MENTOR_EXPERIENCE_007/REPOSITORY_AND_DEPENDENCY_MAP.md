# Repository and Dependency Map

RESULT: `MMC_007_DEPENDENCIES_BOUNDED`

## Runtime topology

```text
authenticated mentor browser
  -> /mmc-private/**
  -> MissionMed HQ session and private-route authorization
  -> explicitly enabled FIXTURE/LOCAL CAM asset mount
  -> /api/auth/session for bounded in-memory CSRF bootstrap
  -> /api/mmc/v2/mentor/**
  -> derived mentor/operator principal and capability checks
  -> deterministic MemoryMentorRepository
  -> exact query envelopes / raw typed command results
```

No configured database, provider, worker daemon, object store, notification service, or external source is in this loop.

## Owned implementation families

| Family | Responsibility |
| --- | --- |
| `missionmed-hq/lib/mmc/contracts/mentor-query-contract.mjs` | Thirteen mentor query shapes, eleven typed local commands, strict payload/result validation, semantic hashing, and authority-field rejection |
| `missionmed-hq/lib/mmc/queries/` | Deterministic synthetic seed, shared transaction repository, attention ordering, and policy-filtered mentor projections |
| `missionmed-hq/lib/mmc/commands/mentor-owner-handlers.mjs` | One explicit owning handler per enabled local command, versioning, idempotency, audit, local-only outbox, assignment and subject continuity |
| `missionmed-hq/routes/mmc/mentor.mjs` | Fourteen route contracts, exact-origin/CSRF checks, bounded JSON, role/capability enforcement, and local-runtime denial outside FIXTURE/LOCAL |
| `missionmed-hq/lib/mmc/ui/local-review-mount.mjs` | Explicit local-only CAM UI enablement, route allowlist, realpath/symlink confinement, asset-type allowlist, and strict response headers |
| `missionmed-hq/public/mmc-private/src/cam/` | Isolated semantic CAM shell, route views, components, state adapter, and responsive styling |
| `missionmed-hq/tests/mmc-cam/` | Contract, API, browser, security, state, accessibility-baseline, responsive, visual, usability-heuristic, performance, and scale evidence |

## Shared owners touched narrowly

| Shared boundary | 007 impact | Required protection |
| --- | --- | --- |
| `missionmed-hq/server.mjs` | Adds default-off local CAM mount/config and passes an isolated mentor configuration/JSON responder | Existing session authorization, route order, CSRF ownership, exports, and non-MMC routes remain intact |
| `missionmed-hq/routes/mmc/index.mjs` | Dispatches the exact mentor API family before the generic v2 route | Near-prefixes and unsupported methods remain denied |
| `missionmed-hq/lib/mmc/trust/security.mjs` | Adds strict CAM document headers | Existing JSON/security constants remain unchanged |
| `missionmed-hq/lib/mmc/jobs/durable-job-kernel.mjs` | Exports the existing job-kind vocabulary for parity generation | No durable behavior or provider dispatch changes |
| Existing private-mount/schema validators | Recognize the isolated CAM root and shared vocabulary | Historical assets remain sealed and migrations remain unapplied |

## Authentication and data dependencies

- Authentication source: existing MissionMed HQ session boundary.
- Runtime CSRF source: existing same-origin `/api/auth/session`; the client reads only `authenticated` and `csrfToken` into memory.
- Authorization source: server-derived MMC principal, role ceiling, capabilities, and active assignment.
- 007 data source: deterministic synthetic seed held by `MemoryMentorRepository`.
- 006 durable schema source: the checked-in additive migration, still unapplied to configured environments.
- Browser storage: none; no localStorage, sessionStorage, IndexedDB, Cache Storage, or Service Worker authority.

## Protected ecosystem

Matrix, Scheduler, Calendar, Daily Drills, `video_registry.json`, Webex, OpenAI, R2, Stream, File Vault, WordPress/LearnDash, Supabase configured environments, Railway, Cloudflare, notifications, email, payments, and other MissionMed applications are `PROTECTED_REFERENCE` or `DO NOT TOUCH`. The 007 product does not write to them or claim their health.

## Historical families

- `missionmed-hq/public/mmc-private/` outside `src/cam/`: preserved, authenticated, sealed archaeology; not imported by the CAM client.
- `mmc-v1-core/`: preserved behavioral oracle; not runtime authority.
- `/mmc-partner-demo/`: preserved historical synthetic feature archaeology; design rejected.

The local 007 product has no dependency on the MacBook Air.
