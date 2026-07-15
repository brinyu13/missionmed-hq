# V1 Study Schedule — Canonical Source Decision

## Decision

Use the repository state at
`d4455bf4ee401eaa8b074603497eb9fcd6eb04a0` as the canonical implementation
foundation for V1-8010.

At run start, the V1 reconciliation branch exactly equaled
`origin/d9-matrix-plan-415-source-recovery`. Its application-source base remains
that ref after the handoff-only publication commit. A future implementation
branch should start from `d4455bf` plus the accepted V1-8000 handoff, not from
`origin/main` and not from a prototype directory.

## Why this source

- D9-415 mapped 135/135 production package files to recovered Git source.
- The recovered branch includes the observed production plugin, MU-plugin
  closure, provenance, test, rollback, and reconciliation reports.
- The active served hashed Student OS asset matches the recovered source byte for
  byte.
- The worktree's Study class, REST controller, Student OS controller, Calendar
  engine, plugin bootstrap, and active Student OS asset have stable recorded
  hashes.
- No competing implementation has stronger source/runtime provenance. Multiple
  references containing the same Study blob are duplicates, not separate
  products.

All-ref verification found 32 refs resolving
`wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php` and
every one resolved blob `84fa3f4d89c1e7c1a0f733a41679cb4e329d7833`.
`git log --all -S` searches for `renderJourney`, `GhostSuggestion`,
`ReserveItem`, honest closeout, and Quick Build found no plugin implementation
commit. No D9-416 or D9-420 implementation ref was found.

## Load-bearing source inventory

| File | SHA-256 | Role |
|---|---|---|
| `wp-content/plugins/missionmed-hub/missionmed-hub.php` | `ed02cd301205557b656cb4758e9ba2848d3938a2429647825606da6230c96cad` | Plugin bootstrap |
| `includes/class-mmed-student-os.php` | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | Shell/controller/module payload |
| `includes/class-mmed-study-schedule.php` | `2356d2369007db715849a3e2ba5959ac0e4323a04a8c4206b9f8b50bd97c3234` | Legacy Study-to-Calendar adapter |
| `includes/class-mmed-calendar-engine.php` | `b97bef169a25ca77bba93a8e27bbb40f3055bcc63ab85d1d864512353cdc56cb` | Shared Calendar event store and mutations |
| `includes/class-mmed-rest-api.php` | `2e2a282d05ac876c658b0c5717e4412989b362ce63cc0731f7f97f8187126b16` | Shared REST namespace/routes |
| `assets/student-os.646e3598d284fff3.js` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | Active Student OS client bundle |

Paths after the first row are relative to
`wp-content/plugins/missionmed-hub/`.

## What this decision does not mean

- The legacy Calendar-backed Study panel is not the intended V1 product.
- `mmed_events` is not selected as the V1 Plan store.
- Existing REST permission behavior is not accepted.
- The current client lock is not accepted as entitlement.
- The active hashed shell must not be edited in place.
- D9-415's source recovery does not close D9-416, data, auth, feature-flag,
  staging, deployment, or production gates.

## Implementation home

V1-8010 should use a new `codex/` branch based on `d4455bf` in a dedicated V1
worktree. The D9 recovery branch and its reports remain immutable evidence.

The safe seam is a dedicated V1 module with:

- a small eligible-user loader;
- immutable lazy-loaded JS/CSS;
- route registration through `window.MatrixRuntime` when active and a controlled
  `MMED_OS.render.study` replacement otherwise;
- a dedicated V1 repository and REST controller;
- a default-off `v1_study_schedule` rollout switch;
- server-derived entitlement shared by nav, loading, and REST.

## Runtime-lock disposition

Among declared guard inputs, the Matrix guard differs only for
`class_mmed_student_os_php`. Brian explicitly approved that override for this
mission. V1-8000 used it solely to read and reconcile evidence. The global lock
does not inventory the active hashed bundle path; it inventories unversioned
`assets/student-os.js`, whose public object differs from the recovered source
twin. The stale Matrix passport also omits the active hashed bundle. V1-8010A
must record the override and pin the controller, active hashed bundle,
unversioned source twin, and cache behavior together before any protected edit;
lock updates then use only the governed release process.
