# B1-506C StoryForge V5.5 — Rollback Runbook Amendment

Recorded: 2026-07-29T16:40:00Z

Status: **MECHANICAL AMENDMENT REQUIRED BY B1-506B**

This document amends only the StoryForge V5.5 rollback ladder in
`_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_PRODUCTION_DEPLOYMENT_ROLLBACK_RUNBOOK.md`.
It does not authorize a rollback, deployment, migration, provider call, or
production configuration change.

## 1. Ordinary reconciliation rollback

The ordinary reversible kill for weekly permanent-audio reconciliation remains:

```text
STORYFORGE_AUDIO_RECONCILIATION=off
```

Unsetting the key is equivalent to `off`. This changes no schema and adds no
migration rollback rung. Reconciliation ships `off` by default.

## 2. Mandatory pre-step for rollback rung 6

Before executing rung 6, **Migration repair or reverse**, the human operator
must set a non-empty production configuration value:

```text
STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED=rung6-<YYYY-MM-DD>
```

The operator must verify the non-empty value is present in the exact target
environment before any migration repair or reverse begins. The operations log
must record:

- UTC date and time;
- target environment and service;
- operator identity;
- rollback incident or decision reference;
- configured value; and
- configuration readback evidence.

If the suspension cannot be set and read back, rung 6 stops.

## 3. Mandatory pre-step for rollback rung 7

Before executing rung 7, **Restore from backup**, the human operator must set a
non-empty production configuration value:

```text
STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED=rung7-<YYYY-MM-DD>
```

The same evidence fields and fail-closed stop rule from section 2 apply. The
suspension must be active before restoration begins so audio uploaded after the
backup time is preserved for manual review and possible re-linking.

## 4. Suspension behavior and structural backstop

Any non-empty `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` value takes priority
over mode and cadence. A suspended run reports `suspended` and performs:

- no storage list;
- no PostgreSQL reference check; and
- no object deletion.

The suspension must never be cleared automatically, by a timer, by a deployment,
or by a maintenance run.

Rollback of M3 provides a second fail-closed wall: reconciliation must
successfully execute `public.sf_voice_audio_reference_check` before any
deletion. If the function is absent, a configured run aborts with zero
deletions. No configuration value may bypass that check.

## 5. Founder-only clearance

Only a human operator acting on an explicit Founder review decision may remove
`STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED`.

Before removal, the operations log must contain:

- Founder decision reference;
- Founder decision date;
- operator identity;
- target environment and service;
- restored-backup time boundary;
- disposition of post-backup audio reviewed for manual re-linking;
- intended reconciliation mode after clearance; and
- pre-change configuration and runtime evidence.

After removal, record configuration readback and runtime telemetry. Promotion
from `dry_run` to `on` remains a separate Founder gate and requires review of at
least one completed production `dry_run` cycle.

## 6. Evidence template

```text
B1-506C RUNG 6/7 SUSPENSION RECEIPT
UTC:
Environment:
Service:
Operator:
Rung:
Incident/decision reference:
Configured key: STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED
Configured value:
Configuration readback receipt:
Runtime suspended telemetry receipt:
Founder clearance decision reference (blank until authorized):
Founder clearance date (blank until authorized):
Post-backup audio review receipt (blank until completed):
Clearance operator (blank until authorized):
Post-clearance configuration readback (blank until authorized):
Post-clearance mode:
```

## 7. Execution statement

No rung, production configuration change, migration, restore, or reconciliation
run was executed while creating this amendment.
