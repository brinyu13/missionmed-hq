# Implementation Report

RESULT: `MMC_007_MENTOR_CAM_IMPLEMENTED_LOCALLY`

## Product implementation

007 adds a new isolated CAM application under `missionmed-hq/public/mmc-private/src/cam/`; it does not restyle or import the historical private client or Partner Demo.

The shell provides:

- semantic skip link, navigation, main landmark, route `h1`, live status, and focus restoration;
- Today, Students, Work, Reviews, and capability-gated Operations;
- desktop rail, compact tablet behavior, narrow-screen bottom navigation, and More disclosure;
- same-origin History API routes and deep links;
- in-memory environment, connectivity, save, and unsaved-work truth;
- command palette, Quick Capture, Focus mode, dialogs, and evidence inspector;
- deep-ink CAM tokens, restrained ember/gold/cyan/violet semantics, one dominant action, and reduced-motion/forced-colors CSS.

## Mentor operating loop

- Today renders exactly three first-tier attention conditions and at most four more, ordered by objective policy rather than person score.
- Students opens a route-owned directory and Student Workspace.
- Student Workspace implements Overview, Plan, History, session detail, Files, and Call Prep without a global mutable student selector.
- Call Prep can start a subject-pinned local session.
- Live Session supports typed capture, pause, resume, and end-for-review with visible persistence/connectivity state.
- Capture creates an actionable review item rather than silently promoting it.
- Post-session Review and Reviews support item-level decisions; publication items remain disabled.
- Work groups explicit-owner tasks and commitments.
- Operations reports local gateway/query posture while provider actions, job repair, durable persistence, and student publication remain unavailable.

## Contract and backend implementation

- Thirteen query resources and fourteen HTTP route patterns.
- Eleven local command kinds and one explicit owner per kind.
- Seven capture kinds: student task, mentor task, mutual commitment, private memory, question, flag, and publication candidate.
- Exact query envelope and raw typed command result.
- Version conflict, command-ID binding, semantic idempotency, assignment revocation, subject continuity, audit hash chain, and local-only outbox behavior.
- Bounded cursors/pages and scale fixtures for 1,000 students, 10,000 work items, 500 reviews, and 100 sessions for one student.

## Shared-runtime integration

The shared server gains only default-off MMC-specific configuration and routing:

- `MMHQ_MMC_CAM_V2_LOCAL_UI_ENABLED`
- `MMHQ_MMC_CAM_MENTOR_ENABLED`
- `MMHQ_MMC_CAM_MENTOR_COMMANDS_ENABLED`
- `MMHQ_MMC_CAM_LOCAL_IN_MEMORY_ENABLED`
- `MMHQ_MMC_CAM_LOCAL_HTTP_ENABLED`
- existing v2 tenant/environment/origin/body-limit bindings

Enablement is effective only in a non-production process and only for `FIXTURE` or `LOCAL`. The authenticated mount uses an exact application-route allowlist, asset-extension allowlist, realpath containment, and strict document headers. Historical assets remain sealed and are not fallback files.

## Contract parity artifact

`missionmed-hq/lib/mmc/contracts/cam-v2-parity-manifest.json` inventories 4 environments, 18 capabilities and SQL mappings, 7 durable commands, 11 local mentor commands, 13 mentor queries, 7 capture kinds, 6 job kinds, 8 job states, 7 publication item kinds, 9 publication states, 6 student response kinds, 8 policy kinds, 4 authority-grant kinds, 97 durable SQL functions, and 229 safe error codes. It also hashes twelve controlling source files. The generator is an executable drift gate; the final publication step must regenerate it after the last source change and require byte equality.

## Deliberately absent

No student application, real student identity, durable writer adapter, migration apply, worker daemon, provider, media pipeline, notification, deployment, production route replacement, or production monitoring was implemented. Those omissions are explicit run boundaries, not hidden completeness claims.
