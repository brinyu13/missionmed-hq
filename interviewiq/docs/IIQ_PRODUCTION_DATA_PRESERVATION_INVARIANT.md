# InterviewIQ production data preservation invariant

**Production InterviewIQ user/admin data is protected state. Application code, UI and schemas may evolve, but production data must be preserved across deployments, migrations, refactors, rollbacks, integrations, test runs and feature development. Destructive production-data operations require explicit Founder authorization plus verified backup and restore evidence.**

Authority: direct Founder IIQ-1202 directive, 2026-10-03, registered by MissionMed
OS DR-370. Canonical authority lives in
`missionmed-os/handoffs/from_codex/IIQ_1202_PRESERVATION/IIQ_PRODUCTION_DATA_PRESERVATION_INVARIANT.md`.
This repository copy makes the requirement load with the code. In an authority
conflict, STOP and reconcile; do not choose a weaker version.

## Scope

All existing and future canonical user/admin state is protected, including
retained synthetic production records. Preserve interview offers and IDs,
canonical student ownership, program identity and track, dates and local times,
timezones and DST fold decisions, format/location/join information, events and
socials, deadlines, reschedules, cancellation/restoration and lifecycle history.

Preserve research demands, RISE references, research packages/submissions,
validation state, provenance, administrator decisions, contribution state and
access grants. Preserve preparation/Why Program work, StoryForge references and
consent, IVOC references, learning signals, Interview Day data, debriefs, raw
speech, edited recollections, structured reports, captured questions, private
learning, optional shared intelligence, retractions, mentor data, administrator
input, audit history, privacy/consent records, and future canonical state.

The absence of a current UI, an integration upgrade, a provider/model change, or
an empty table today does not make these data classes disposable tomorrow.

## Non-negotiable controls

- Expand first. Preserve IDs, ownership, original content, history, privacy and
  relationships. Old records must remain readable with new nullable fields.
- Never reset, reseed, truncate, drop, rebuild from fixtures, silently orphan,
  replace IDs, overwrite newer edits, reset consent, or replay corrupt migrations.
- Production test/reset targets fail closed before fixture writes. Runtime
  identity and RLS remain independently qualified. Privileged migration access
  never belongs in the API or browser.
- A schema-changing release needs a fresh target-bound backup and tested isolated
  restore, an immutable migration plan, and compatible application rollback.
- Potentially destructive operations STOP for the exact Founder authorization
  protocol in the migration contract. General development permission is not enough.
- Application rollback preserves the current database and all newer entries.
  Database recovery is a separate emergency procedure, never an automatic deploy step.
- Failed preservation checks stop feature rollout and further deployments until
  the discrepancy is reconciled and repaired. Never erase legitimate concurrent
  edits merely to match an earlier fingerprint.

## Research and debrief inheritance

Research pipelines must retain immutable originals where retention policy requires,
source/provenance, review state and canonical relationships. Corrections become
versioned repairs with links to prior evidence. Support retraction without silently
rewriting history, and keep private submissions distinct from approved shared output.
MRX/RISE schema changes never authorize deleting contributed research history.

Raw speech, student-edited recollection, structured facts, AI-proposed structure,
student confirmation, private learning, share selections, administrator review and
publication state must remain distinguishable. A new transcription provider or AI
model must not replace the student's canonical recollection. Consent revocation
and authorized retention/deletion rules must propagate deliberately.

Preservation during development does not override a legitimate authorized privacy
or deletion request. That requires its own scoped policy, identity verification,
retention/legal decision, audit and controlled erasure procedure. Cancellation is
not erasure. Neither an ad hoc reset nor silent permanent retention substitutes
for that workflow.

## Durable routing

Every future InterviewIQ task packet must include this file and the current data
map/migration contract. Repository `AGENTS.md`, the OS product passport, IIQ-1200
and owner BOOT profiles, and Brain `products/interviewiq.md` / generated
`packs/interviewiq.pack.md` carry the pointer. Chat memory is not authority.

Product intent is unchanged. This is a permanent operational safety requirement.
