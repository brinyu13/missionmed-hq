# B1-507A Audio Lifecycle and Reconciliation

Date: 2026-07-29

## Authoritative lifecycle

1. Audio begins as browser-local segments and private temporary objects associated with a recording session.
2. Segment transcript results are durable in the authorized database schema. The student-edited story text is authoritative for the saved story; assembly failure cannot erase or rewrite it.
3. On finish, the selected executor creates or verifies the permanent representation.
4. A permanent asset becomes authoritative only after storage verification and the transaction-bound story/original/audio-asset attachment succeeds.
5. Temporary objects are deleted only after permanent storage and database attachment are verified.
6. Pending assembly/permanent-asset work is recoverable after delayed completion or process restart.
7. Permanent audio remains private and available only to authorized identities through short-lived signed playback URLs.
8. Explicit deletion, story deletion, account closure, and the final Founder retention ruling control retirement/deletion.
9. Weekly reconciliation detects and, only in approved `on` mode, removes eligible orphaned objects with audit evidence.

## The 90-second rule

- The client polls assembly while protecting the transcript independently.
- At 90 seconds, the exact binding dialog offers **Keep Waiting** and **Save Without Audio**.
- **Keep Waiting:** closes the decision cycle, continues polling, and may show the same choice again after another bounded interval. It does not duplicate save or assembly jobs.
- **Save Without Audio:** saves the exact current story text byte-for-byte and exits the blocking wait. It does not cancel recoverable server work; later recovery may attach the finished audio.
- The dialog has safe initial focus, focus trap/restore, repeated-cycle behavior, and single-flight race handling covered locally.
- Transcript text must never be lost because audio timed out, failed, or was deferred.

## Recovery and cleanup

- Startup resumes pending transcription, pending assemblies, and pending permanent assets.
- Pending asset recovery is bounded; a terminal failure occurs after 60 minutes rather than looping forever.
- Cancel/abandon cleanup is server-owned. The product authority uses a 24-hour abandoned-session sweep.
- Browser-local buffered segments expire after seven days when the local voice database is opened.
- Temporary objects are not treated as permanent story assets.
- Partial upload and duplicate-submit paths are idempotent and fail closed.

## Weekly reconciliation binding rules

| Control | Binding behavior |
|---|---|
| Schedule | In-process weekly run |
| Modes | `off`, `dry_run`, `on` |
| Default/live state | `off` |
| Suspension | Any nonempty `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` suppresses activity |
| Control object | `storyforge-audio/_control/reconciliation.json` |
| Eligibility age | Older than 168 hours |
| R2 listing | Pages of at most 1,000 |
| Evaluation bound | At most 5,000 keys per run under current implementation |
| Delete cap | At most 200 per run |
| Reference checks | At most 1,000 per batch/path under current implementation |
| Retry | One delete retry |
| `dry_run` | Computes candidates; deletes and audit writes are zero |
| `on` | Permitted only after blockers are resolved, dry-run evidence reviewed, and Founder approval recorded |
| Rollback rung | Set mode off/suspended; preserve evidence; do not improvise deletes |

## FABLE-C1 through C4 and PROBE-C5

| Code | Original issue and source | Current implementation/test | Scope blocked | Can Codex resolve now? |
|---|---|---|---|---|
| FABLE-C1 | R2 delete and PostgreSQL audit cannot be atomic across systems; crash ordering lacks binding truth. Source: B1-506C combined handoff blocker packet. | Delete/retry/audit paths exist with fake-storage tests, but no architecture can make the two systems one transaction. | Reconciliation `on` and automatic permanent-audio deletion; because automatic deletion is required for complete Phase 1, final launch completion | No. Fable must choose the durable intent/outbox/retry/recovery truth and acceptable claim. |
| FABLE-C2 | E11 is defined as a feature-flag surface, but the reconciliation rules require an operator-visible action/candidate surface. | Feature-flag E11 is implemented; no authorized reconciliation action view exists. | Reconciliation activation/operator acceptance | No. Fable must name the exact query/surface and audience. |
| FABLE-C3 | Orphan R2 keys may encode UUIDs that do not reference existing database rows; current audit foreign keys cannot attribute a post-delete event truthfully. | Parser/reference checks exist; impossible attribution remains. | Orphan automatic deletion and its audit proof | No. Fable must rule on nullable attribution, preserved tombstone, or other exact model. |
| FABLE-C4 | A fixed first-5,000 evaluation bound without continuation can starve later students/keys indefinitely. | Bounded list/delete logic is implemented and tested, but fairness/continuation is not. | Automatic deletion at production scale | No. Fable must authorize a cursor/checkpoint/fair selection rule or narrow the claim. |
| PROBE-C5 | Every Railway replica starts the in-process weekly timer; no lease/CAS coordinates schedulers. | Fresh production evidence shows one running API instance, but this is an observation, not a locked invariant. | Reconciliation scheduler safety | Operational evidence can resolve only if Railway is locked to one replica with alerting. Otherwise Fable must authorize coordination. |

No later authority artifact resolves C1-C5. They do not block the current text product or a dormant/default-off release. They do block turning reconciliation `on`. Under the Founder’s present definition—automatic permanent-audio deletion is mandatory—they also block declaring the full Phase 1 release complete.

## Foreign keys, service principal, and audit

- RLS and service-principal paths were PostgreSQL-tested locally.
- Production currently has `storyforge_app` as a login role, non-superuser, no `BYPASSRLS`.
- The migration’s older comment assuming `NOLOGIN` is stale relative to the guarded production runner’s explicit role contract.
- Deletion/audit must remain append-only and exclude student content, raw audio, signed URLs, and secrets.
- C3 prevents truthful audit attribution for an object whose encoded row identities never existed.

## Administrator and Founder controls

- `dry_run` evidence must identify counts/reasons without exposing student content.
- Founder must approve transition to `on`.
- Suspension must be tested before activation.
- E11/operator visibility must be resolved before approval is meaningful.
- A rollback drill must prove mode `off` and suspension halt future deletion attempts.

## Current status

Production has no Phase 1 tables, no StoryForge R2 bucket, no reconciliation environment variable, and one observed API replica. Source defaults reconciliation to `off`. No automatic audio deletion is live.
