# V1 Study Schedule — Ecosystem Dependency Map

## Direct dependency graph

| System | Current relationship | Target relationship | Failure if mishandled |
|---|---|---|---|
| WordPress plugin bootstrap | Loads Study, REST, Calendar, Student OS | Load dedicated V1 services additively | Global plugin fatal or missing route |
| MU-plugin bootstrap | Shared load order and runtime shims | Preserve exact alphabetical/runtime closure | Broad Matrix outage |
| Student OS controller | Emits module list/assets/access | Emit V1 permission/config/immutable descriptors | Every learner shell affected |
| Student OS client | Contains legacy renderer and router | Loader-only seam; do not edit hash in place | Route race, cache/source drift |
| Matrix Runtime | Optional route/app-mode owner | Register V1 route when present | Duplicate renderers or blank route |
| Shared REST namespace | Hosts current endpoints | Dedicated versioned controller, compatible namespace policy | Route collision or overbroad auth |
| WordPress identity | Current user ID drives rows | Canonical actor; validate program/course context server-side | Cross-user or wrong-program data |
| Access/entitlement | Client temp lock + login-only REST | Structured actor identity, entitlement, rollout exposure, then scoped action/resource/field authorization | Hidden UI with callable API or leakage |
| Calendar engine | Current Study persistence and mutation owner | Busy/fixed input; optional marked projection | Dual-write and record contamination |
| MissionMed Scheduler | Unrelated product; shared shell only | No product coupling | Scope drift and booking regressions |
| Appointment systems | Unrelated booking product; no direct V1 dependency proven | No V1-8010 work; use only a generic anchor seam if a later decision proves necessity | Scope drift or booking mutation |
| Courses | No V1 adapter | Context/targets/evidence | Wrong study context |
| Arena | No V1 adapter | Outcome evidence/proposal only | Silent learner completion |
| StoryForge/Vault/Profile | No V1 contract | Optional explicit context adapters | Hidden coupling or privacy leakage |
| Messages/notifications | No V1 event contract | Dedupe, timezone, consent, quiet-hours adapter | Spam or sensitive disclosure |
| Mentor Console | No V1 boundary | Assigned-scope ghost suggestions only | Direct edits or privacy breach |
| Dashboard | Static locked Study card | Accurate entitlement/status projection | Misleading availability |
| Cache/CDN | Hashed active asset; stale unversioned object | Immutable V1 assets and manifest | Mixed code versions |
| Runtime lock | No V1 asset/app entry | Govern controller/loader/bundle/rollback hashes | Guard failure or unreviewed blast radius |
| Deployment package | D9-415 source package only | Additive V1 package, migration preview, canary | Non-reproducible release |

## Shared writers requiring containment

- `MMED_Study_Schedule` writes Calendar `study_block`.
- Calendar v4 maps categories to and from `study_block`.
- Admin OS recognizes `study_block`.
- Session Manager recognizes `study_block`.
- Calendar's scheduler-feed upsert may create shared events.

These are source-capable writers or recognizers; concurrent live execution was
not observed. They are not permission to write V1 Plan state. V1-owned
UUIDs/tables and provenance markers prevent collision. Legacy import is explicit,
one-way, idempotent, and auditable.

## Load-order contract

The future loader must tolerate both shell-first and loader-first initialization.
It must register once, unmount cleanly, avoid redefining unrelated globals, and
leave all non-Study routes unchanged. Compatibility tests cover Runtime-v2
present/absent, flag on/off, entitled/unentitled, audit-only admin, explicit
learner principal, warm/cold cache, and direct hash navigation.

## Shared-system exclusions

No V1 ticket may absorb:

- Scheduler/Webex broker work;
- appointment booking or office-hours flows;
- Calendar v4 redesign;
- broad authentication or Access Gate replacement;
- general Student OS decomposition;
- Supabase adoption;
- unrelated Arena, CAM, StoryForge, Vault, RankListIQ, or security remediation.

A shared system enters scope only through a named adapter or regression contract.

## Required cross-app regression set

Before staging and at every canary:

1. WordPress login/logout and member-dashboard redirect.
2. Student OS shell boot with protected hashed asset.
3. Dashboard and profile.
4. Unrelated Matrix routes and booking systems remain byte/behavior compatible;
   this is regression coverage, not appointment-product implementation.
5. CAM entitlement/launch behavior.
6. Arena, Courses, StoryForge, Vault, Messages, and Mentor navigation.
7. REST authorization isolation for a non-entitled user.
8. Flag-off byte/runtime behavior.
9. Cache-warm and cache-cold direct `#study` navigation.
10. Pre/post-cutover rollback modes: atomic watermark honored, truthful V1
    read-only continuity, legacy writes denied, and no second writable truth.
