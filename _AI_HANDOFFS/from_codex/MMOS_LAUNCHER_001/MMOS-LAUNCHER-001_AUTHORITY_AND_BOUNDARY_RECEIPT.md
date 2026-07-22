# MMOS-LAUNCHER-001 Authority and Boundary Receipt

Date: 2026-07-22
Implementation lane: local Founder-review tooling
Engineering status: `PROVISIONAL_LOCAL_STANDARD_CANDIDATE`
Adoption status: `NOT_CANONICAL`
Runtime status: `NOT_DEPLOYED`, `NOT_PRODUCTION-INTEGRATED`

## Authority routed

The Founder request in this Codex task directly authorizes a bounded local launcher implementation and immediate I1Q-4000 integration. The MissionMed OS authority chain and Question Platform passport permit local prototype work while preserving the separation between prototype review and production or canonical adoption.

| Authority source | SHA-256 |
| --- | --- |
| `/Users/brianb/MissionMed_OS/BOOT.md` | `70d0664c9c4391e05beea9142471603b2a79e0f9f4287e31dec147e4db27e9b1` |
| `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` | `c9968defe0fd55a6f8857cd05b1fc38f86bc7b6eb90c1486c90d5e106b0855ab` |
| `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md` | `fa8827b087b08379b90ec63678198876b0d10301391dd8593340e26a40562164` |
| `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md` | `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| `/Users/brianb/MissionMed_OS/handoffs/from_fable/MM-FABLE-MMOS-006_MISSIONMED_ENGINEERING_CONSTITUTION.md` | `7e01f7b88bf07c24f22088ad1759014272c38993b3153034a30467603187eb9b` |

Implementation starts from repository commit `a8949fc0811b0be49524dbe6cbb7fdd01abf2a59` on branch `codex/mmos-launcher-001`.

## Resolved authority boundary

`MMOS-LAUNCHER-001` is not present in the current MMOS mission, product, or authority registries, and no ratified decision record currently makes this implementation canonical. Therefore:

- the code and standard are delivered as a complete local standard candidate;
- this task does not edit MissionMed OS registries, `CURRENT.md`, Launchpad authority, protected Matrix paths, or production runtimes;
- no hosting, deployment, remote persistence, telemetry, secrets, learner data, or protected data source is introduced;
- a later independently reviewed and Founder-ratified MMOS decision is required before the word *canonical* or *permanent* may describe governance status.

This classification does not reduce the implementation or validation target. It prevents a local code change from silently manufacturing organization-wide authority.

## Authorized local mutations

- add a reusable, configuration-driven launcher framework under this handoff;
- add thin launcher entry points and an explicit configuration to the sealed I1Q-4000 local package;
- update local documentation, validation, manifests, and checksum ledgers;
- run local deterministic tests and local loopback launch verification;
- commit and push the candidate branch.

## Explicit non-actions

- no Sites deployment or hosting version;
- no production or learner-facing mutation;
- no package-manager, runtime, or framework auto-detection used as execution authority;
- no indiscriminate PID or port kill;
- no credential, bearer token, environment secret, or protected value written to the repository or launcher state;
- no claim of Windows validation without a Windows test environment.
