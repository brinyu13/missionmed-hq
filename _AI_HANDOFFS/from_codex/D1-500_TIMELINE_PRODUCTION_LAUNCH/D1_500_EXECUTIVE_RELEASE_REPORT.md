# D1-500 Executive Release Report

Status as of 2026-08-04: **PARTIAL — production remains access-off at the
server-secret binding gate**.

Audited execution progress is 35 of 45 defined work units (78%). This measure
tracks execution work, not final acceptance: live canary and 360 rollout remain
mandatory. Engineering confidence is 92%; confidence that this execution loop
ends with Timeline live inside Matrix is 74%, contingent on the Founder-only
secret bindings becoming verifiable.

The accepted Timeline Builder remains sealed as static release
`timeline-0c5cc515a76346d6` and WordPress runtime
`timeline-wp-c228658bc70bc395`. The product and security core pass 614
automated tests. Critical Systems passes 140 checks with zero failures and the
controlling Matrix lock passes ten of ten checks.

Production backup, data, and feature-off installation work is complete:

- the exact oldest Kinsta manual backup was deleted only after re-verifying the
  inventory and its independent local and remote recovery copies;
- replacement Kinsta backup `D1-500-PRE-20260804T161859Z` is READY with a
  restore control and all four newer retained backups remain;
- a Railway manual PostgreSQL volume backup is READY at 843 MB with a restore
  control;
- a PostgreSQL 18 custom logical dump is stored outside Git, hash-verified, and
  passed an isolated restore;
- all six accepted Timeline SQL assets applied successfully; production reads
  back `d1-timeline-db-500.1`, 20 tables, 53 policies, zero missing forced-RLS
  tables, and zero public schema/table access;
- the exact authorized Kinsta payload SHA-256
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`
  is installed and active with `timeline_enabled=false`,
  `rollout_stage=off`, an empty canary list, and eligibility unverified;
- anonymous `/timeline/` access returns to the approved Matrix flow and an
  anonymous token POST is denied `401`.

The first Railway image build failed closed because Nixpacks ran a locked
install and the repository build command attempted a second `npm ci` against
the active cache. The narrow config-only repair at commit `7cf30eb` retains the
Nixpacks locked install and runs typecheck, API build, and API-only validation
once. The retry built successfully but failed its `/healthz` gate before going
online because the production API service lacks its two required secret
variables. The PostgreSQL reference and all seven non-secret variables are
installed. No API container is live and no user access is enabled.

One consolidated Founder-only action remains: install matching secret pairs in
the exact server-side locations below without exposing their values:

- Railway project `295b3d56-f555-4851-91f4-eb32d7dc88e1`, production API
  service `12bfaf69-f883-42b5-a380-b6beea49f251`:
  `TIMELINE_JWT_SECRET`, `TIMELINE_GATEWAY_SECRET`;
- Kinsta production WordPress PHP runtime:
  `MISSIONMED_TIMELINE_JWT_SECRET`,
  `MISSIONMED_TIMELINE_GATEWAY_SECRET`.

The JWT values must match each other across Railway and Kinsta, and the gateway
values must match each other. After those four named bindings exist, resume at
API deploy/health, then principal provisioning, Founder/admin canary,
eligible-360 activation, browser/security verification, rollback rehearsal,
and release seal.
